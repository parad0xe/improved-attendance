import { WORKDAY_MINUTES } from "../../constants"
import { getDaysInMonth } from "../../lib/time"
import type { Attendance } from "../attendance"
import { PlannedDay } from "./planned-day"

const PLAN_STORAGE_KEY = "improved-attendance-plan"

interface PlanSync {
    availableCapsules: number
    /** The time to log in the month. */
    monthGoalMinutes: number
}

interface SerializedPlannedDay {
    isOff: boolean
    plannedMinutes: number
    isManual: boolean
}

interface SerializedMonthPlan {
    dailyMinutes: number
    /** The days of the plan, from day 1. */
    plannedDays: SerializedPlannedDay[]
    capsules?: number
    lastSync?: PlanSync | null
}

interface MonthPlanOptions {
    /** The year of the month. */
    year: number
    /** The month, 0 for January. */
    monthIndex: number
    /** The default time planned on each day. */
    dailyMinutes: number
    /** The days of the plan, by day from 1. */
    plannedDays: Map<number, PlannedDay>
    /** The number of capsules planned to be used this month. */
    capsules: number
    /** The last sync of the plan. */
    lastSync: PlanSync | null
}

export interface MonthTime {
    /** The time logged in the month, without the running session. */
    loggedMonthMinutes: number
    /** The time to log in the month. */
    monthGoalMinutes: number
    /** The time of the running session. */
    runningSessionMinutes: number
    /** The time logged today, with the running session. */
    loggedTodayMinutes: number
}

export class MonthPlan {
    year: number
    monthIndex: number
    dailyMinutes: number
    plannedDays: Map<number, PlannedDay>
    capsules: number
    lastSync: PlanSync | null

    /** Creates the plan of a month. */
    constructor({ year, monthIndex, dailyMinutes, plannedDays, capsules, lastSync }: MonthPlanOptions) {
        this.year = year
        this.monthIndex = monthIndex
        this.dailyMinutes = dailyMinutes
        this.plannedDays = plannedDays
        this.capsules = capsules
        this.lastSync = lastSync
    }

    /**
     * Returns the storage key of the plan of the month.
     * @param year - the year of the month
     * @param monthIndex - 0 for January
     */
    static getStorageKey(year: number, monthIndex: number): string {
        return `${PLAN_STORAGE_KEY}-${year}-${String(monthIndex + 1).padStart(2, '0')}`
    }

    /**
     * Loads the plan of the month of `attendance`.
     * @param attendance - the attendance of the month
     */
    static load(attendance: Attendance): MonthPlan {
        const { year, monthIndex } = attendance.calendar
        const daysInMonth = getDaysInMonth(year, monthIndex)
        const dayMarks = attendance.getDayMarks()
        const createPlannedDay = (day: number, { isOff, plannedMinutes, isManual }: SerializedPlannedDay) => new PlannedDay({
            date: new Date(year, monthIndex, day),
            mark: dayMarks.get(day) ?? null,
            isOff,
            plannedMinutes,
            isManual,
        })

        try {
            const serializedPlanJSON = localStorage.getItem(MonthPlan.getStorageKey(year, monthIndex))
            if (serializedPlanJSON !== null) {
                const { plannedDays, dailyMinutes, capsules = 0, lastSync = null }: SerializedMonthPlan = JSON.parse(serializedPlanJSON)
                const isValidDays = Array.isArray(plannedDays) && plannedDays.length === daysInMonth
                    && plannedDays.every(({ isOff, plannedMinutes, isManual }) => typeof isOff === "boolean"
                        && Number.isFinite(plannedMinutes) && plannedMinutes >= 0 && typeof isManual === "boolean")
                const isValidSync = lastSync === null
                    || (Number.isInteger(lastSync.availableCapsules) && Number.isFinite(lastSync.monthGoalMinutes))
                if (isValidDays && Number.isFinite(dailyMinutes) && dailyMinutes >= 0
                    && Number.isInteger(capsules) && capsules >= 0 && isValidSync) {
                    return new MonthPlan({
                        year,
                        monthIndex,
                        dailyMinutes,
                        plannedDays: new Map(plannedDays.map((plannedDay, index) => [index + 1, createPlannedDay(index + 1, plannedDay)])),
                        capsules,
                        lastSync,
                    })
                }
            }
        } catch {
            // The storage can be unavailable, or the saved plan unreadable.
        }

        const plannedDays = new Map<number, PlannedDay>()
        for (let day = 1; day <= daysInMonth; day++) {
            const isOff = !attendance.isOpenWorkday(new Date(year, monthIndex, day))
            plannedDays.set(day, createPlannedDay(day, { isOff, plannedMinutes: WORKDAY_MINUTES, isManual: false }))
        }

        return new MonthPlan({ year, monthIndex, dailyMinutes: WORKDAY_MINUTES, plannedDays, capsules: 0, lastSync: null })
    }

    /** Saves the plan of the month. */
    save(): void {
        const serializedPlan: SerializedMonthPlan = {
            dailyMinutes: this.dailyMinutes,
            plannedDays: [...this.plannedDays.values()].map(({ isOff, plannedMinutes, isManual }) => ({ isOff, plannedMinutes, isManual })),
            capsules: this.capsules,
            lastSync: this.lastSync,
        }

        try {
            localStorage.setItem(MonthPlan.getStorageKey(this.year, this.monthIndex), JSON.stringify(serializedPlan))
        } catch {
            // The storage can be unavailable.
        }
    }

    /**
     * Returns the day of the plan of `day`.
     * @param day - the day of the month, from 1
     */
    getPlannedDay(day: number): PlannedDay | undefined {
        return this.plannedDays.get(day)
    }

    /**
     * Returns whether time is planned on the day of `now`.
     * @param now - the current date
     */
    hasPlannedTime(now = new Date()): boolean {
        return this.isCurrentMonth(now) && this.getPlannedDay(now.getDate())?.isOff === false
    }

    /**
     * Returns the days with planned time after `now`.
     * @param now - the current date
     */
    private getRemainingDays(now: Date): PlannedDay[] {
        return [...this.plannedDays.values()].filter((plannedDay) => !plannedDay.isOff && plannedDay.date > now)
    }

    /**
     * Returns the number of days with planned time after `now`.
     * @param now - the current date
     */
    countRemainingDays(now = new Date()): number {
        return this.getRemainingDays(now).length
    }

    /**
     * Returns the time planned after `now`.
     * @param now - the current date
     */
    getRemainingPlannedMinutes(now = new Date()): number {
        return this.getRemainingDays(now).reduce((minutes, plannedDay) => minutes + plannedDay.plannedMinutes, 0)
    }

    /**
     * Returns whether the plan is for the month of `now`.
     * @param now - the current date
     */
    isCurrentMonth(now = new Date()): boolean {
        return this.year === now.getFullYear() && this.monthIndex === now.getMonth()
    }

    /**
     * Returns the time to have logged at the start and at the end of the day of `now`, in minutes.
     * @param monthGoalMinutes - the time to log in the month
     * @param now - the current date
     */
    getExpectedRange(monthGoalMinutes: number, now = new Date()): { start: number, end: number } {
        const end = this.getGoalMinutes(monthGoalMinutes, now) - this.getRemainingPlannedMinutes(now)
        const start = this.hasPlannedTime(now) ? end - (this.getPlannedDay(now.getDate())?.plannedMinutes ?? 0) : end
        return { start, end }
    }

    /**
     * Returns the time to log on each day with planned time, from today, to reach the goal.
     * @param time - the times of the month
     * @param now - the current date
     */
    getNeededDailyMinutes(time: MonthTime, now = new Date()): number | null {
        const hasPlannedTime = this.hasPlannedTime(now)
        const remainingDays = this.countRemainingDays(now) + (hasPlannedTime ? 1 : 0)
        if (remainingDays === 0) { return null }

        const completedTodayMinutes = time.loggedTodayMinutes - time.runningSessionMinutes
        const loggedMinutes = hasPlannedTime
            ? time.loggedMonthMinutes - completedTodayMinutes
            : time.loggedMonthMinutes + time.runningSessionMinutes
        return Math.ceil(Math.max(0, this.getGoalMinutes(time.monthGoalMinutes, now) - loggedMinutes) / remainingDays)
    }

    /**
     * Returns the time to have logged by the end of today.
     * @param monthGoalMinutes - the time to log in the month
     */
    getExpectedMinutes(monthGoalMinutes: number): number {
        return this.getExpectedRange(monthGoalMinutes).end
    }

    /**
     * Returns the time to log in the month with the planned capsules.
     * @param monthGoalMinutes - the time to log in the month
     * @param now - the current date
     */
    getGoalMinutes(monthGoalMinutes: number, now = new Date()): number {
        if (!this.isCurrentMonth(now)) { return monthGoalMinutes }
        return monthGoalMinutes - this.capsules * WORKDAY_MINUTES
    }

    /**
     * Returns the planned time left to log today.
     * @param time - the times of the month
     * @param now - the current date
     */
    getRemainingTodayMinutes(time: MonthTime, now = new Date()): number {
        if (!this.hasPlannedTime(now)) { return 0 }
        return Math.max(0, (this.getPlannedDay(now.getDate())?.plannedMinutes ?? 0) - time.loggedTodayMinutes)
    }

    /**
     * Returns the time logged by the end of the month when the plan is followed.
     * @param time - the times of the month
     * @param now - the current date
     */
    getProjectedMinutes(time: MonthTime, now = new Date()): number {
        const loggedTotalMinutes = time.loggedMonthMinutes + time.runningSessionMinutes
        return loggedTotalMinutes + this.getRemainingTodayMinutes(time, now) + this.getRemainingPlannedMinutes(now)
    }

    /**
     * Removes the capsules used since the last sync from the planned ones, and keeps `planSync` as the last sync.
     * @param planSync - the new sync of the plan
     */
    sync(planSync: PlanSync): void {
        const { availableCapsules } = planSync
        if (this.lastSync) {
            const capsulesDiff = availableCapsules - this.lastSync.availableCapsules
            if (capsulesDiff < 0) {
                this.capsules += capsulesDiff
            }
        }
        this.capsules = Math.max(0, Math.min(this.capsules, availableCapsules))
        this.lastSync = planSync
    }

    /**
     * Sets the default time planned on each day, and the time of the days that are not manual.
     * @param dailyMinutes - the default time planned on each day
     */
    setDailyMinutes(dailyMinutes: number): void {
        this.dailyMinutes = dailyMinutes
        for (const plannedDay of this.plannedDays.values()) {
            if (!plannedDay.isManual) {
                plannedDay.plannedMinutes = dailyMinutes
            }
        }
    }
}
