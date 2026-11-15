import {WORKDAY_MINUTES} from "../../constants"
import {getDaysInMonth} from "../../lib/time"
import type {Attendance} from "../attendance"
import {PlannedDay} from "./planned-day"

const PLAN_STORAGE_KEY = "improved-attendance-plan"

interface PlanSync {
    availableCapsules: number
    /** The time to log in the month, in minutes. */
    monthGoalMinutes: number
}

interface SerializedMonthPlan {
    dailyMinutes: number
    serializedPlannedDays: string
    capsules?: number
    lastSync?: PlanSync | null
}

interface MonthPlanOptions {
    /** The year of the month. */
    year: number
    /** The month, 0 for January. */
    monthIndex: number
    /** The time planned on each remaining day, in minutes. */
    dailyMinutes: number
    /** The number of capsules planned to be used this month. */
    capsules: number
    /** The last sync of the plan. */
    lastSync: PlanSync | null

    plannedDays: Map<number, PlannedDay>
}

export interface MonthTime {
    /** The time logged in the month, without the running session, in minutes. */
    loggedMonthMinutes: number
    /** The time to log in the month, in minutes. */
    monthGoalMinutes: number
    /** The time of the running session, in minutes. */
    runningSessionMinutes: number
    /** The time logged today, with the running session, in minutes. */
    loggedTodayMinutes: number
}

export class MonthPlan {
    year: number
    monthIndex: number
    dailyMinutes: number
    capsules: number
    lastSync: PlanSync | null
    plannedDays: Map<number, PlannedDay>

    /** Creates the plan of a month. */
    constructor({year, monthIndex, plannedDays, dailyMinutes, capsules, lastSync}: MonthPlanOptions) {
        this.year = year
        this.monthIndex = monthIndex
        this.dailyMinutes = dailyMinutes
        this.capsules = capsules
        this.lastSync = lastSync
        this.plannedDays = plannedDays
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
        const {year, monthIndex} = attendance.calendar

        try {
            const serializedPlanJSON = localStorage.getItem(MonthPlan.getStorageKey(year, monthIndex))
            if (serializedPlanJSON !== null) {
                const {
                    serializedPlannedDays,
                    dailyMinutes,
                    capsules = 0,
                    lastSync = null
                }: SerializedMonthPlan = JSON.parse(serializedPlanJSON)
                const isValidSync = lastSync === null
                    || (Number.isInteger(lastSync.availableCapsules) && Number.isFinite(lastSync.monthGoalMinutes))
                if (typeof serializedPlannedDays === "string" && Number.isFinite(dailyMinutes) && dailyMinutes >= 0
                    && Number.isInteger(capsules) && capsules >= 0 && isValidSync) {
                    return new MonthPlan({
                        year,
                        monthIndex,
                        dailyMinutes,
                        plannedDays: PlannedDay.deserializeAll(serializedPlannedDays, attendance.getDayMarks()),
                        capsules,
                        lastSync
                    })
                }
            }
        } catch {
            // The storage can be unavailable, or the saved plan unreadable.
        }

        const dayMarks = attendance.getDayMarks()
        const plannedDays = new Map<number, PlannedDay>()
        for (let day = 1; day <= getDaysInMonth(year, monthIndex); day++) {
            const date = new Date(year, monthIndex, day)
            plannedDays.set(day, new PlannedDay({
                date,
                isOff: !attendance.isOpenWorkday(date),
                mark: dayMarks.get(day) ?? null,
                workTimeMinutes: WORKDAY_MINUTES,
                manual: false
            }))
        }

        return new MonthPlan({
            year,
            monthIndex,
            dailyMinutes: WORKDAY_MINUTES,
            plannedDays,
            capsules: 0,
            lastSync: null
        })
    }

    save(): void {
        const serializedPlan: SerializedMonthPlan = {
            serializedPlannedDays: PlannedDay.serializeAll(this.plannedDays),
            dailyMinutes: this.dailyMinutes,
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
     * Returns whether time is planned on the day of `now`.
     * @param now - the current date
     */
    isWorkday(now = new Date()): boolean {
        return this.isCurrentMonth(now) && !!this.getPlannedDay(now.getDate())?.isWorkday()
    }

    getPlannedDay(day: number): PlannedDay | undefined {
        return this.plannedDays.get(day)
    }

    /**
     * Returns the number of planned days after `now`.
     * @param now - the current date
     * @param includeNow - TODO: docstring
     */
    countRemainingDays(now = new Date(), includeNow: boolean = false): number {
        let remainingDays = 0

        for (const plannedDay of this.plannedDays.values()) {
            if (plannedDay.isRemainingWorkday(now, includeNow)) {
                remainingDays++
            }
        }

        return remainingDays
    }

    getRemainingPlannedMinutes(now = new Date(), includeNow: boolean = false): number {
        let plannedMinutes = 0

        for (const plannedDay of this.plannedDays.values()) {
            if (plannedDay.isRemainingWorkday(now, includeNow)) {
                plannedMinutes += plannedDay.workTimeMinutes
            }
        }

        return plannedMinutes
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
     * @param monthGoalMinutes - the time to log in the month, in minutes
     * @param now - the current date
     */
    getExpectedRange(monthGoalMinutes: number, now = new Date()): { start: number, end: number } {
        const end = this.getGoalMinutes(monthGoalMinutes, now) - this.getRemainingPlannedMinutes(now)
        const start = this.isWorkday(now) ? end - (this.getPlannedDay(now.getDate())?.workTimeMinutes ?? 0) : end
        return {start, end}
    }

    /**
     * Returns the time to log on each planned day from today to reach the goal, in minutes.
     * @param time - the times of the month
     * @param now - the current date
     */
    getNeededDailyMinutes(time: MonthTime, now = new Date()): number | null {
        const plannedDays = this.countRemainingDays(now, true)
        if (plannedDays === 0) {
            return null
        }

        const completedTodayMinutes = time.loggedTodayMinutes - time.runningSessionMinutes
        const loggedMinutes = this.isWorkday(now)
            ? time.loggedMonthMinutes - completedTodayMinutes
            : time.loggedMonthMinutes + time.runningSessionMinutes
        return Math.ceil(Math.max(0, this.getGoalMinutes(time.monthGoalMinutes, now) - loggedMinutes) / plannedDays)
    }

    /**
     * Returns the time to have logged by the end of today, in minutes.
     * @param monthGoalMinutes - the time to log in the month, in minutes
     */
    getExpectedMinutes(monthGoalMinutes: number): number {
        return this.getExpectedRange(monthGoalMinutes).end
    }

    /**
     * Returns the time to log in the month with the planned capsules, in minutes.
     * @param monthGoalMinutes - the time to log in the month, in minutes
     * @param now - the current date
     */
    getGoalMinutes(monthGoalMinutes: number, now = new Date()): number {
        if (!this.isCurrentMonth(now)) {
            return monthGoalMinutes
        }
        return monthGoalMinutes - this.capsules * WORKDAY_MINUTES
    }

    /**
     * Returns the planned time left to log today, in minutes.
     * @param time - the times of the month
     * @param now - the current date
     */
    getRemainingTodayMinutes(time: MonthTime, now = new Date()): number {
        const plannedDay = this.getPlannedDay(now.getDate())
        return this.isWorkday(now) ? Math.max(0, (plannedDay?.workTimeMinutes ?? 0) - time.loggedTodayMinutes) : 0
    }

    /**
     * Returns the time logged by the end of the month when the plan is followed, in minutes.
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
        const {availableCapsules} = planSync
        if (this.lastSync) {
            const capsulesDiff = availableCapsules - this.lastSync.availableCapsules
            if (capsulesDiff < 0) {
                this.capsules += capsulesDiff
            }
        }
        this.capsules = Math.max(0, Math.min(this.capsules, availableCapsules))
        this.lastSync = planSync
    }

    // TODO: see to improve the function name
    setGenericDailyWorkTime(genericDailyWorkTimeMinutes: number): void {
        for (const plannedDay of this.plannedDays.values()) {
            if (!plannedDay.isManual) {
                plannedDay.setWorkTime(genericDailyWorkTimeMinutes)
            }
        }

        this.dailyMinutes = genericDailyWorkTimeMinutes
    }
}
