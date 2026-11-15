import {getLabels} from "../../labels"
import type {DayMark} from "../../models/attendance"
import type {MonthPlan} from "../../models/month-plan/month-plan"
import {PlannedDay} from "../../models/month-plan/planned-day"
import {formatMinutes} from "../../lib/time"
import type { DayDialogElement } from "./day-dialog"
import "./day-dialog"

/** Shows the days of a plan, toggles its days off and dispatches `change`. */
class CalendarElement extends HTMLElement {
    #shadow: ShadowRoot

    #plan: MonthPlan | null
    #dayMarks: Map<number, DayMark>

    #gridElement: Element | null
    #legendElement: Element | null

    #dayDialog: DayDialogElement | null
    #hoveredDay: {
        element: HTMLDivElement
        plannedDay: PlannedDay
    } | null

    constructor() {
        super()
        this.#shadow = this.attachShadow({mode: "open"})

        this.#plan = null
        this.#dayMarks = new Map()

        this.#gridElement = null
        this.#legendElement = null

        this.#dayDialog = null
        this.#hoveredDay = null
    }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback(): void {
        this.#shadow.innerHTML = `
            <style>
                .grid {
                    width: 100%;
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 2px;
                }

                .weekday {
                    text-align: center;
                    font-size: 0.625rem;
                    color: var(--muted-foreground);
                }

                .day {
                    position: relative;
                    padding: 7px 2px;
                    border: 1px solid var(--improved-attendance-day-border);
                    border-radius: 4px;
                    text-align: center;
                    font-size: 0.75rem;
                    color: var(--sidebar-foreground);
                    cursor: pointer;
                    transition: background-color 150ms, border-color 150ms;
                }
                .day:not(.past):not(.off):hover {
                    background: var(--improved-attendance-day-hover);
                }
                .day.off {
                    background: var(--improved-attendance-day-off-background);
                    border-color: var(--improved-attendance-day-off-border);
                    color: var(--improved-attendance-day-off-text);
                    font-weight: 500;
                }
                .day.off:not(.past):hover {
                    border-color: var(--improved-attendance-day-off-text);
                }
                .day.past {
                    border-color: var(--improved-attendance-past-day-border);
                    color: var(--improved-attendance-past-day-text);
                    cursor: default;
                }
                .day.past.off {
                    background: var(--improved-attendance-past-day-off-background);
                    font-weight: normal;
                }
                .day.manual::before {
                    content: "";
                    position: absolute;
                    display: block;
                    top: 2px;
                    right: 2px;
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background: var(--improved-attendance-manual-day-dot);
                }
                .day.manual.past::before {
                    opacity: 0.8;
                }

                .day.public-holiday::after,
                .day.closure::after,
                .legend-mark::before {
                    content: "";
                    display: block;
                    width: 10px;
                    height: 2px;
                    border-radius: 10px;
                }
                .day.public-holiday::after,
                .day.closure::after {
                    position: absolute;
                    top: 3px;
                    left: calc(50% - 5px);
                }
                .day.past::after { opacity: 0.7; }
                .public-holiday::after, .legend-mark.public-holiday::before { background: var(--improved-attendance-public-holiday); }
                .closure::after, .legend-mark.closure::before { background: var(--improved-attendance-closure); }
                
                .day-time {
                    font-size: 8px;
                    position: absolute;
                    color: var(--improved-attendance-day-time);
                    bottom: -3px;
                    right: 0;
                    left: 0;
                }
                
                .legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.25rem 0.75rem;
                    margin-top: 0.375rem;
                    font-size: 0.625rem;
                    color: var(--muted-foreground);
                }
                .legend-mark { display: flex; align-items: center; gap: 0.25rem; }
                .legend-mark.manual::before { width: 4px; height: 4px; border-radius: 50%; background: var(--improved-attendance-manual-day-dot); }
            </style>

            <div class="root">
                <div class="grid"></div>
                <div class="legend"></div>
            </div>
        `

        this.#gridElement = this.#shadow.querySelector(".grid")
        this.#legendElement = this.#shadow.querySelector(".legend")

        this.#dayDialog = document.createElement("improved-attendance-day-dialog")
        this.#dayDialog.lang = this.lang
        this.#shadow.append(this.#dayDialog)

        document.addEventListener("keyup", this.#onKeyup)

        this.draw()
    }

    // noinspection JSUnusedGlobalSymbols
    disconnectedCallback(): void {
        document.removeEventListener("keyup", this.#onKeyup)
    }

    #onKeyup = (event: KeyboardEvent): void => {
        if (!this.#hoveredDay) { return }

        const {plannedDay} = this.#hoveredDay

        if (event.key === "m") {
            plannedDay.isManual = !plannedDay.isManual

            this.dispatchEvent(new Event("change"))
            this.draw()
            return
        }

        if (event.key === "r") {
            plannedDay.isManual = false
            if (this.#plan) {
                plannedDay.plannedMinutes = this.#plan.dailyMinutes
            }

            this.dispatchEvent(new Event("change"))
            this.draw()
            return
        }
    }

    /**
     * Renders the days of `plan` with their `dayMarks`.
     * @param plan - the plan of the month
     * @param dayMarks - the marks of the days of the month, by day from 1
     */
    render(plan: MonthPlan, dayMarks: Map<number, DayMark>): void {
        this.#plan = plan
        this.#dayMarks = dayMarks

        this.draw()
    }

    /** Draws the calendar. */
    draw(): void {
        if (!this.#plan || !this.#gridElement || !this.#legendElement) {
            return
        }

        this.#hoveredDay = null

        this.#gridElement.replaceChildren()

        for (const weekday of getLabels(this.lang).CALENDAR_WEEKDAYS) {
            const weekdayElement = document.createElement("div")
            weekdayElement.classList.add("weekday")
            weekdayElement.textContent = weekday
            this.#gridElement.append(weekdayElement)
        }

        const firstWeekday = (new Date(this.#plan.year, this.#plan.monthIndex, 1).getDay() + 6) % 7

        for (let i = 0; i < firstWeekday; i++) {
            this.#gridElement.append(document.createElement("div"))
        }

        for (const plannedDay of this.#plan.plannedDays.values()) {
            this.#gridElement.append(this.createDayElement(this.#plan, plannedDay))
        }

        this.#legendElement.replaceChildren()
        for (const mark of new Set(this.#dayMarks.values())) {
            const markElement = document.createElement("span")
            markElement.classList.add("legend-mark", mark)
            markElement.textContent = this.getMarkLabel(mark)
            this.#legendElement.append(markElement)
        }

        if ([...this.#plan.plannedDays.values()].some((plannedDay) => plannedDay.isManual)) {
            const manualElement = document.createElement("span")
            manualElement.classList.add("legend-mark", "manual")
            manualElement.textContent = getLabels(this.lang).CALENDAR_MANUAL
            this.#legendElement.append(manualElement)
        }
    }

    /**
     * Returns the label of `mark` in the language of the calendar.
     * @param mark - the mark of a day
     */
    private getMarkLabel(mark: DayMark): string {
        const labels = getLabels(this.lang)
        return mark === "public-holiday"
            ? labels.CALENDAR_PUBLIC_HOLIDAY
            : labels.CALENDAR_CLOSURE
    }

    /**
     * Creates the element of `day`.
     * @param plan - the plan of the month
     * @param plannedDay - TODO: docstring
     */
    private createDayElement(plan: MonthPlan, plannedDay: PlannedDay): HTMLDivElement {
        const dayElement = document.createElement("div")
        dayElement.classList.add("day")
        dayElement.classList.toggle("off", plannedDay.isOff)
        dayElement.textContent = String(plannedDay.date.getDate())

        const isPast = plannedDay.isPast()
        if (!plannedDay.isOff && !isPast && (plannedDay.plannedMinutes !== plan.dailyMinutes || plannedDay.isManual)) {
            const workTimeElement = document.createElement("span")
            workTimeElement.classList.add("day-time")
            workTimeElement.textContent = formatMinutes(plannedDay.plannedMinutes)
            dayElement.append(workTimeElement)
        }

        if (plannedDay.mark !== null) {
            dayElement.classList.add(plannedDay.mark)
            dayElement.title = this.getMarkLabel(plannedDay.mark)
        }

        if (plannedDay.isManual) {
            dayElement.classList.add("manual")
        }

        if (isPast) {
            dayElement.classList.add("past")
        } else {
            dayElement.addEventListener("click", () => {
                if (this.#dayDialog?.isOpen) {
                    return
                }
                plannedDay.isOff = !plannedDay.isOff
                this.dispatchEvent(new Event("change"))
                this.draw()
            })
        }

        dayElement.addEventListener("mouseenter", () => {
            this.#hoveredDay = {
                element: dayElement,
                plannedDay
            }
        })
        dayElement.addEventListener("mouseleave", () => {
            if (this.#hoveredDay?.element === dayElement) {
                this.#hoveredDay = null
            }
        })

        dayElement.addEventListener("contextmenu", (event) => {
            if (isPast) return

            event.preventDefault()
            this.#dayDialog?.open(
                plan,
                dayElement,
                plannedDay,
                () => {
                    this.dispatchEvent(new Event("change"))
                    this.draw()
                }
            )
        })

        return dayElement
    }
}

customElements.define("improved-attendance-calendar", CalendarElement)

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface HTMLElementTagNameMap {
        "improved-attendance-calendar": CalendarElement
    }
}
