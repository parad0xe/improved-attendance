import { getLabels } from "../../../labels"
import { formatMinutes } from "../../../lib/time"
import type { DayMark } from "../../../models/attendance"
import type { MonthPlan } from "../../../models/month-plan/month-plan"
import type { PlannedDay } from "../../../models/month-plan/planned-day"
import type { DayDialogElement } from "../day-dialog/day-dialog"
import "../day-dialog/day-dialog"
import CALENDAR_STYLE from "./calendar.css"

/** The calendar of the plan of a month. */
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
        this.#shadow = this.attachShadow({ mode: "open" })

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
            <div class="root">
                <div class="grid"></div>
                <div class="legend"></div>
            </div>
        `
        const styleElement = document.createElement("style")
        styleElement.textContent = CALENDAR_STYLE
        this.#shadow.prepend(styleElement)

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
        if (!this.#plan || !this.#hoveredDay || this.#dayDialog?.isOpen) { return }

        const { plannedDay } = this.#hoveredDay
        if (plannedDay.isPast() || !plannedDay.hasPlannedTime()) { return }

        if (event.key === "m") {
            this.#plan.setManual(plannedDay, !plannedDay.isManual)
        } else if (event.key === "r") {
            this.#plan.setManual(plannedDay, false)
        } else {
            return
        }

        this.dispatchEvent(new Event("change"))
        this.draw()
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

        if ([...this.#plan.plannedDays.values()].some((plannedDay) => plannedDay.hasPlannedTime() && plannedDay.isManual)) {
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
     * Creates the element of `plannedDay`.
     * @param plan - the plan of the month
     * @param plannedDay - the day of the plan
     */
    private createDayElement(plan: MonthPlan, plannedDay: PlannedDay): HTMLDivElement {
        const dayElement = document.createElement("div")
        this.#dayDialog?.setDayElement(plannedDay, dayElement)
        dayElement.classList.add("day")
        dayElement.classList.toggle("off", !plannedDay.hasPlannedTime())
        dayElement.textContent = String(plannedDay.date.getDate())

        const isPast = plannedDay.isPast()
        if (plannedDay.hasPlannedTime() && plannedDay.isManual && !isPast) {
            const dayTimeElement = document.createElement("span")
            dayTimeElement.classList.add("day-time")
            dayTimeElement.textContent = formatMinutes(plannedDay.plannedMinutes)
            dayElement.append(dayTimeElement)
        }

        if (plannedDay.mark !== null) {
            dayElement.classList.add(plannedDay.mark)
            dayElement.title = this.getMarkLabel(plannedDay.mark)
        }

        if (plannedDay.hasPlannedTime() && plannedDay.isManual) {
            dayElement.classList.add("manual")
        }

        if (isPast) {
            dayElement.classList.add("past")
        } else {
            dayElement.addEventListener("click", () => {
                if (this.#dayDialog?.isOpen) {
                    return
                }
                plan.setDayOff(plannedDay, plannedDay.hasPlannedTime())
                this.dispatchEvent(new Event("change"))
                this.draw()
            })
            dayElement.addEventListener("contextmenu", (event) => {
                event.preventDefault()
                this.#dayDialog?.open({
                    plan,
                    dayElement,
                    plannedDay,
                    onChange: () => {
                        this.dispatchEvent(new Event("change"))
                        this.draw()
                    },
                })
            })
        }

        dayElement.addEventListener("mouseenter", () => {
            this.#hoveredDay = {
                element: dayElement,
                plannedDay,
            }
        })
        dayElement.addEventListener("mouseleave", () => {
            if (this.#hoveredDay?.element === dayElement) {
                this.#hoveredDay = null
            }
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
