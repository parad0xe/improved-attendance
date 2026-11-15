import type {DayMark} from "../attendance";

export interface SerializedPlannedDay {
    date: string
    isOff: boolean
    workTimeMinutes: number
    manual: boolean
}

export interface PlannedDayOptions {
    date: Date
    mark: DayMark | null
    isOff: boolean
    workTimeMinutes: number
    manual: boolean
}

export class PlannedDay {
    #isOff: boolean
    #workTimeMinutes: number
    #manual: boolean
    readonly #mark: DayMark | null
    readonly #date: Date

    constructor(options: PlannedDayOptions) {
        this.#date = options.date
        this.#mark = options.mark
        this.#isOff = options.isOff
        this.#workTimeMinutes = options.workTimeMinutes
        this.#manual = options.manual
    }

    get isOff(): boolean {
        return this.#isOff
    }

    get isPast(): boolean {
        const today = new Date()
        return this.#date < new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
    }

    get workTimeMinutes(): number {
        return this.#workTimeMinutes
    }

    get mark(): DayMark | null {
        return this.#mark
    }

    get day(): number {
        return this.#date.getDate()
    }

    get isManual(): boolean {
        return this.#manual
    }

    isRemainingWorkday(now = new Date(), includeNow: boolean = false): boolean {
        return ((this.#date.getFullYear() === now.getFullYear()
                && this.#date.getMonth() === now.getMonth()
                && this.#date.getDate() === now.getDate()
                && includeNow)
            || this.#date > now) && !this.#isOff
    }

    isWorkday(): boolean {
        return !this.#isOff
    }

    toggleOff(): void {
        this.#isOff = !this.#isOff
    }

    setOff(isOff: boolean): void {
        this.#isOff = isOff
    }

    setWorkTime(minutes: number): void {
        if (!Number.isFinite(minutes) || minutes < 0) {
            throw new RangeError("Invalid work time")
        }

        this.#workTimeMinutes = minutes
    }

    setManual(manual: boolean): void {
        this.#manual = manual
    }

    toggleManual(): void {
        this.#manual = !this.#manual
    }

    serialize(): SerializedPlannedDay {
        const date = this.#date

        const pad = (value: number) => String(value).padStart(2, "0")

        return {
            date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
            isOff: this.#isOff,
            workTimeMinutes: this.#workTimeMinutes,
            manual: this.#manual
        }
    }

    static serializeAll(plannedDays: Map<number, PlannedDay>): string {
        return JSON.stringify(
            [...plannedDays].map(([day, monthDay]) => [
                day,
                monthDay.serialize()
            ])
        )
    }

    static deserialize(data: SerializedPlannedDay, mark: DayMark | null): PlannedDay {
        return new PlannedDay({
            ...data,
            mark,
            date: new Date(
                Number(data.date.slice(0, 4)),
                Number(data.date.slice(5, 7)) - 1,
                Number(data.date.slice(8, 10)),
                Number(data.date.slice(11, 13)) || 0,
                Number(data.date.slice(14, 16)) || 0,
                Number(data.date.slice(17, 19)) || 0
            )
        })
    }

    static deserializeAll(serializedPlannedDays: string, dayMarks: Map<number, DayMark>): Map<number, PlannedDay> {
        const serializedPlannedJSON: [number, SerializedPlannedDay][] = JSON.parse(serializedPlannedDays)

        return new Map<number, PlannedDay>(
            serializedPlannedJSON.map(([day, data]) => [
                day,
                this.deserialize(data, dayMarks.get(day) ?? null)
            ])
        )
    }
}