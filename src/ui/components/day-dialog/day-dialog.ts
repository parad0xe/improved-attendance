import { getLabels } from "../../../labels"
import { formatMinutes } from "../../../lib/time"
import type { MonthPlan } from "../../../models/month-plan/month-plan"
import type { PlannedDay } from "../../../models/month-plan/planned-day"
import "../time-input/time-input"
import DAY_DIALOG_STYLE from "./day-dialog.css"

interface DayDialogOpenOptions {
    /** The plan of the month. */
    plan: MonthPlan
    /** The element of the day. */
    dayElement: HTMLDivElement
    /** The day of the plan. */
    plannedDay: PlannedDay
    /** Called after each change of the day. */
    onChange: () => void
}

interface CheckboxRowOptions {
    /** The label of the checkbox. */
    label: string
    /** Whether the checkbox is checked. */
    checked: boolean
    /** Called with the new state after each change of the checkbox. */
    onChange: (checked: boolean) => void
}

/** The settings of a day of the plan. */
export class DayDialogElement extends HTMLElement {
    #shadow: ShadowRoot
    #rootElement: HTMLElement | null
    #dialogElement: HTMLDialogElement | null

    #plan: MonthPlan | null
    #dayElement: HTMLDivElement | null
    #plannedDay: PlannedDay | null

    #onChange: () => void

    constructor() {
        super()
        this.#rootElement = null
        this.#dialogElement = null
        this.#plan = null
        this.#dayElement = null
        this.#plannedDay = null
        this.#onChange = () => {}

        this.#shadow = this.attachShadow({ mode: "open" })
    }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback(): void {
        this.#shadow.innerHTML = `
            <dialog>
                <div class="root"></div>
            </dialog>
        `
        const styleElement = document.createElement("style")
        styleElement.textContent = DAY_DIALOG_STYLE
        this.#shadow.prepend(styleElement)

        this.#rootElement = this.#shadow.querySelector(".root")
        this.#dialogElement = this.#shadow.querySelector("dialog")

        // A click on the backdrop targets the dialog itself.
        this.#dialogElement?.addEventListener("click", (event) => {
            if (event.target === this.#dialogElement) { this.close() }
        })

        this.draw()

        document.addEventListener("scroll", this.#onScroll, true)
    }

    // noinspection JSUnusedGlobalSymbols
    disconnectedCallback(): void {
        document.removeEventListener("scroll", this.#onScroll, true)
    }

    #onScroll = (): void => {
        if (!this.#dialogElement || !this.#dayElement) { return }

        const rect = this.#dayElement.getBoundingClientRect()
        this.#dialogElement.style.left = `${rect.x}px`
        this.#dialogElement.style.top = `${rect.y + rect.height}px`
    }

    /** Whether the dialog is open. */
    get isOpen(): boolean {
        return this.#dialogElement?.open ?? false
    }

    /** Draws the settings of the day. */
    private draw(): void {
        if (!this.#plan || !this.#plannedDay || !this.#rootElement) {
            return
        }

        const labels = getLabels(this.lang)
        const plan = this.#plan
        const plannedDay = this.#plannedDay

        this.#rootElement.replaceChildren()

        const headerElement = document.createElement("div")
        headerElement.className = "header"
        this.#rootElement.append(headerElement)

        const title = plannedDay.date.toLocaleDateString(this.lang || undefined, { weekday: "long", day: "numeric", month: "long" })
        const titleElement = document.createElement("span")
        titleElement.textContent = title.charAt(0).toUpperCase() + title.slice(1)
        headerElement.append(titleElement)

        const closeButtonElement = document.createElement("button")
        closeButtonElement.type = "button"
        closeButtonElement.textContent = "×"
        closeButtonElement.title = labels.CALENDAR_DAY_DIALOG_CLOSE
        closeButtonElement.setAttribute("aria-label", labels.CALENDAR_DAY_DIALOG_CLOSE)
        closeButtonElement.addEventListener("click", () => this.close())
        headerElement.append(closeButtonElement)

        const offRowElement = this.createCheckboxRow({
            label: labels.CALENDAR_DAY_DIALOG_OFF,
            checked: !plannedDay.hasPlannedTime(),
            onChange: (isOff) => {
                plan.setDayOff(plannedDay, isOff)
                this.#onChange()
                this.draw()
            },
        })
        this.#rootElement.append(offRowElement)

        if (plannedDay.hasPlannedTime()) {
            const plannedTimeRowElement = document.createElement("div")
            plannedTimeRowElement.className = "row"
            plannedTimeRowElement.textContent = labels.CALENDAR_DAY_DIALOG_PLANNED_TIME
            this.#rootElement.append(plannedTimeRowElement)

            const timeInputElement = document.createElement("improved-attendance-time-input")
            timeInputElement.render(plannedDay.plannedMinutes, (plannedMinutes) => {
                plan.setPlannedMinutes(plannedDay, plannedMinutes)
                this.#onChange()
                this.draw()
            })
            plannedTimeRowElement.append(timeInputElement)

            const manualRowElement = this.createCheckboxRow({
                label: labels.CALENDAR_DAY_DIALOG_MANUAL,
                checked: plannedDay.isManual,
                onChange: (isManual) => {
                    plan.setManual(plannedDay, isManual)
                    this.#onChange()
                    this.draw()
                },
            })
            this.#rootElement.append(manualRowElement)
        }

        const hintElement = document.createElement("span")
        hintElement.className = "hint"
        hintElement.textContent = labels.CALENDAR_DAY_DIALOG_DAILY_TIME(formatMinutes(plan.dailyMinutes))
        this.#rootElement.append(hintElement)
    }

    /** Creates a row with a checkbox and its label. */
    private createCheckboxRow({ label, checked, onChange }: CheckboxRowOptions): HTMLLabelElement {
        const rowElement = document.createElement("label")
        rowElement.className = "row"

        const checkboxElement = document.createElement("input")
        checkboxElement.type = "checkbox"
        checkboxElement.checked = checked
        checkboxElement.addEventListener("change", () => onChange(checkboxElement.checked))
        rowElement.append(checkboxElement, label)
        return rowElement
    }

    /** Opens the settings of `plannedDay`. */
    open({ plan, dayElement, plannedDay, onChange }: DayDialogOpenOptions): void {
        this.#plan = plan
        this.#dayElement = dayElement
        this.#plannedDay = plannedDay
        this.#onChange = onChange
        this.draw()

        if (!this.#dialogElement) { return }

        const rect = dayElement.getBoundingClientRect()

        this.#dialogElement.style.left = `${rect.x}px`
        this.#dialogElement.style.top = `${rect.y + rect.height}px`

        this.#dialogElement.showModal()
    }

    /** Closes the dialog. */
    close(): void {
        this.#dialogElement?.close()
    }

    /**
     * Sets the element of `plannedDay`.
     * @param plannedDay - the day of the plan
     * @param dayElement - the element of the day
     */
    setDayElement(plannedDay: PlannedDay, dayElement: HTMLDivElement): void {
        if (plannedDay === this.#plannedDay) {
            this.#dayElement = dayElement
        }
    }
}

customElements.define("improved-attendance-day-dialog", DayDialogElement)

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface HTMLElementTagNameMap {
        "improved-attendance-day-dialog": DayDialogElement
    }
}
