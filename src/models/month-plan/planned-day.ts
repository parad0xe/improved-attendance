import type { DayMark } from "../attendance"

interface PlannedDayOptions {
    /** The date of the day, at midnight. */
    date: Date
    /** The mark of the day. */
    mark: DayMark | null
    /** Whether the day is a day off. */
    isOff: boolean
    /** The time planned on the day. */
    plannedMinutes: number
    /** Whether the time planned on the day was set for this day only. */
    isManual: boolean
}

/** A day of the plan of a month. */
export class PlannedDay {
    readonly date: Date
    readonly mark: DayMark | null
    isOff: boolean
    plannedMinutes: number
    isManual: boolean

    /** Creates a day of the plan. */
    constructor({ date, mark, isOff, plannedMinutes, isManual }: PlannedDayOptions) {
        this.date = date
        this.mark = mark
        this.isOff = isOff
        this.plannedMinutes = plannedMinutes
        this.isManual = isManual
    }

    /**
     * Returns whether the day is before the day of `now`.
     * @param now - the current date
     */
    isPast(now = new Date()): boolean {
        return this.date < new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }
}
