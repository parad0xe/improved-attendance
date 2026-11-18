import { EXTENSION_NAME, MAX_DAILY_MINUTES, WORKDAY_MINUTES } from "../constants"
import type { Labels } from "../labels"
import { decodeDevalue } from "../lib/devalue"
import { getDayInTimeZone, getDaysInMonth, getTimeZoneOffsetMinutes } from "../lib/time"

const CLOSURE_START_HOUR = 8
const CLOSURE_END_HOUR = 20
const SCHOOL_TIME_ZONE = "Europe/Paris"

interface AttendanceCalendar {
    year: number
    /** The month, 0 for January. */
    monthIndex: number
    /** The workdays of the month, at midnight. */
    workdays: Date[]
}

interface AttendanceClosure {
    beginAt: Date
    endAt: Date
}

interface AttendanceHistory {
    closures: AttendanceClosure[]
}

export type DayMark = "public-holiday" | "closure"

export class Attendance {
    calendar: AttendanceCalendar
    history: AttendanceHistory
    /** The number of capsules left to use. */
    availableCapsules: number

    /**
     * Creates the attendance of the month.
     * @param data - the decoded data
     * @param labels - the labels in the language of the site
     */
    constructor(data: Record<string, any>, labels: Labels) {
        const { calendar, history, availableCapsules } = data

        if (!Number.isInteger(calendar?.year) || !Number.isInteger(calendar?.monthIndex)) {
            throw new Error(`${EXTENSION_NAME}: ${labels.ERROR_MONTH_MISSING}`)
        }
        if (!Array.isArray(calendar.workdays) || !calendar.workdays.every((day: unknown) => day instanceof Date)) {
            throw new Error(`${EXTENSION_NAME}: ${labels.ERROR_WORKDAYS_MISSING}`)
        }

        if (!Array.isArray(history?.closures)) {
            console.warn(`${EXTENSION_NAME}: ${labels.WARNING_CLOSURES_NOT_FOUND}`)
        }
        const closures: unknown[] = Array.isArray(history?.closures) ? history.closures : []
        const validClosures = closures.filter((closure: any) => closure?.beginAt instanceof Date && closure?.endAt instanceof Date)
        if (validClosures.length < closures.length) {
            console.warn(`${EXTENSION_NAME}: ${labels.WARNING_INVALID_CLOSURES}`)
        }

        if (!Array.isArray(availableCapsules)) {
            console.warn(`${EXTENSION_NAME}: ${labels.WARNING_CAPSULES_NOT_FOUND}`)
        }

        this.calendar = {
            year: calendar.year,
            monthIndex: calendar.monthIndex,
            workdays: calendar.workdays.map((workday: Date) => new Date(workday.getUTCFullYear(), workday.getUTCMonth(), workday.getUTCDate())),
        }

        this.history = {
            closures: validClosures as AttendanceClosure[],
        }

        this.availableCapsules = Array.isArray(availableCapsules) ? availableCapsules.length : 0
    }

    /**
     * Returns the timestamp at `hour` in the school time zone on the day of `date`.
     * @param date - a day of the month
     * @param hour - the hour in the school time zone
     */
    private getSchoolTimestamp(date: Date, hour: number): number {
        const utcTimestamp = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hour)
        const offsetMinutes = getTimeZoneOffsetMinutes(SCHOOL_TIME_ZONE, new Date(utcTimestamp))
        return utcTimestamp - offsetMinutes * 60 * 1000
    }

    /**
     * Returns the time covered by the closures between `startHour` and `endHour` on the day of `date`, in minutes.
     * @param date - a day of the month
     * @param startHour - the start hour in the school time zone
     * @param endHour - the end hour in the school time zone
     */
    private getClosedMinutes(date: Date, startHour: number, endHour: number): number {
        const dayStartTimestamp = this.getSchoolTimestamp(date, startHour)
        const dayEndTimestamp = this.getSchoolTimestamp(date, endHour)

        const intervals = this.history.closures
            .map(({ beginAt, endAt }) => [Math.max(beginAt.getTime(), dayStartTimestamp), Math.min(endAt.getTime(), dayEndTimestamp)])
            .filter(([startTimestamp, endTimestamp]) => endTimestamp > startTimestamp)
            .sort((a, b) => a[0] - b[0])

        let closedMilliseconds = 0
        let coveredUntilTimestamp = dayStartTimestamp
        for (const [startTimestamp, endTimestamp] of intervals) {
            const fromTimestamp = Math.max(startTimestamp, coveredUntilTimestamp)
            if (endTimestamp > fromTimestamp) {
                closedMilliseconds += endTimestamp - fromTimestamp
                coveredUntilTimestamp = endTimestamp
            }
        }

        return closedMilliseconds / (60 * 1000)
    }

    /**
     * Returns whether the closures cover the workday of `date`.
     * @param date - a day of the month
     */
    isClosedDay(date: Date): boolean {
        return this.getClosedMinutes(date, CLOSURE_START_HOUR, CLOSURE_END_HOUR) >= WORKDAY_MINUTES
    }

    /**
     * Returns the time without closure on the day of `date`, in minutes.
     * @param date - a day of the month
     */
    getOpenMinutes(date: Date): number {
        return Math.max(0, MAX_DAILY_MINUTES - Math.ceil(this.getClosedMinutes(date, 0, 24)))
    }

    /**
     * Returns whether `date` is a workday of the month.
     * @param date - a day of the month
     */
    isWorkday(date: Date): boolean {
        return this.calendar.workdays.some((workday) => workday.toDateString() === date.toDateString())
    }

    /**
     * Returns whether `date` is a workday without closure.
     * @param date - a day of the month
     */
    isOpenWorkday(date: Date): boolean {
        return this.isWorkday(date) && !this.isClosedDay(date)
    }

    /** Returns the marks of the days of the month, by day from 1. */
    getDayMarks(): Map<number, DayMark> {
        const { year, monthIndex } = this.calendar

        const dayMarks = new Map<number, DayMark>()
        for (let day = 1; day <= getDaysInMonth(year, monthIndex); day++) {
            const date = new Date(year, monthIndex, day)
            const isWeekend = date.getDay() === 0 || date.getDay() === 6
            if (!isWeekend && !this.isWorkday(date)) {
                dayMarks.set(day, "public-holiday")
            } else if (this.isWorkday(date) && this.isClosedDay(date)) {
                dayMarks.set(day, "closure")
            }
        }

        return dayMarks
    }

    /**
     * Fetches the attendance of the month.
     * @param labels - the labels in the language of the site
     */
    static async fetch(labels: Labels): Promise<Attendance> {
        const response = await fetch(`/me/__data.json${location.search}`, { credentials: "same-origin" })
        if (!response.ok) {
            throw new Error(`${EXTENSION_NAME}: ${labels.ERROR_DATA_UNAVAILABLE(response.status)}`)
        }

        // The page data is the first streamed line.
        const page = JSON.parse((await response.text()).split("\n")[0])
        if (page.type === "redirect") {
            throw new Error(`${EXTENSION_NAME}: ${labels.ERROR_SESSION_EXPIRED}`)
        }

        const data = Object.assign({}, ...(page.nodes ?? [])
            .filter((node: any) => node?.type === "data" && Array.isArray(node.data))
            .map((node: any) => decodeDevalue(node.data)))

        return new Attendance(data, labels)
    }
}

/** Returns the current day in the school time zone. */
export function getSchoolToday(): Date {
    return getDayInTimeZone(SCHOOL_TIME_ZONE, new Date())
}
