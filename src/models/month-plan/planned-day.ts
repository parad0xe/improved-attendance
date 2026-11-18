import { getSchoolToday, type DayMark } from "../attendance"

interface PlannedDayOptions {
    /** The date of the day, at midnight. */
    date: Date
    /** The mark of the day. */
    mark: DayMark | null
    /** The longest time that can be planned on the day. */
    maxOpenMinutes: number
    /** Whether the day is a day off. */
    isOff: boolean
    /** The time planned on the day. */
    plannedMinutes: number
    /** Whether the time planned on the day is kept when the default time changes. */
    isManual: boolean
}

/** A day of the plan of a month. */
export class PlannedDay {
    #plannedMinutes: number
    readonly date: Date
    readonly mark: DayMark | null
    readonly maxOpenMinutes: number
    isOff: boolean
    isManual: boolean

    /** Creates a day of the plan. */
    constructor({ date, mark, maxOpenMinutes, isOff, plannedMinutes, isManual }: PlannedDayOptions) {
        this.#plannedMinutes = Math.min(plannedMinutes, maxOpenMinutes)
        this.date = date
        this.mark = mark
        this.maxOpenMinutes = maxOpenMinutes
        this.isOff = isOff
        this.isManual = isManual
    }

    /** The time planned on the day. */
    get plannedMinutes(): number {
        return this.#plannedMinutes
    }

    set plannedMinutes(plannedMinutes: number) {
        this.#plannedMinutes = Math.min(plannedMinutes, this.maxOpenMinutes)
    }

    /** Returns whether time is planned on the day. */
    hasPlannedTime(): boolean {
        return !this.isOff && this.plannedMinutes > 0
    }

    /**
     * Returns whether the day is before the day of `now`.
     * @param now - the current date
     */
    isPast(now = getSchoolToday()): boolean {
        return this.date < new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }

    /**
     * Returns whether the day is the day of `now`.
     * @param now - the current date
     */
    isToday(now = getSchoolToday()): boolean {
        return this.date.toDateString() === now.toDateString()
    }
}
