import { getLabels } from "../../../labels"
import { formatMinutes } from "../../../lib/time"
import type { MonthPlan } from "../../../models/month-plan/month-plan"
import type { PlannedDay } from "../../../models/month-plan/planned-day"
import "../time-input/time-input"
import DAY_DIALOG_STYLE from "./day-dialog.css"

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
            if (event.target === this.#dialogElement) this.close()
        })

        this.draw()

        document.addEventListener("scroll", this.#onScroll, true)
    }

    // noinspection JSUnusedGlobalSymbols
    disconnectedCallback(): void {
        document.removeEventListener("scroll", this.#onScroll, true)
    }

    #onScroll = (): void => {
        if (!this.#dialogElement || !this.#dayElement) return

        const rect = this.#dayElement.getBoundingClientRect()
        this.#dialogElement.style.left = `${rect.x}px`
        this.#dialogElement.style.top = `${rect.y + rect.height}px`
    }

    render(
        plan: MonthPlan,
        dayElement: HTMLDivElement,
        plannedDay: PlannedDay,
        onChange: () => void
    ): void {
        this.#plan = plan
        this.#dayElement = dayElement
        this.#plannedDay = plannedDay
        this.#onChange = onChange
        this.draw()
    }

    get isOpen(): boolean {
        return this.#dialogElement?.open ?? false
    }

    private draw(): void {
        if (!this.#plan || !this.#plannedDay || !this.#rootElement) {
            return
        }

        const labels = getLabels(this.lang)
        const plan = this.#plan
        const plannedDay = this.#plannedDay

        const title = plannedDay.date.toLocaleDateString(this.lang || undefined, { weekday: "long", day: "numeric", month: "long" })
        const titleElement = document.createElement("span")
        titleElement.textContent = title.charAt(0).toUpperCase() + title.slice(1)

        const closeButtonElement = document.createElement("button")
        closeButtonElement.type = "button"
        closeButtonElement.textContent = "×"
        closeButtonElement.title = labels.CALENDAR_DAY_DIALOG_CLOSE
        closeButtonElement.setAttribute("aria-label", labels.CALENDAR_DAY_DIALOG_CLOSE)
        closeButtonElement.addEventListener("click", () => this.close())

        const headerElement = document.createElement("div")
        headerElement.className = "header"
        headerElement.append(titleElement, closeButtonElement)

        const createCheckboxRow = (label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLLabelElement => {
            const checkboxElement = document.createElement("input")
            checkboxElement.type = "checkbox"
            checkboxElement.checked = checked
            checkboxElement.addEventListener("change", () => onChange(checkboxElement.checked))

            const rowElement = document.createElement("label")
            rowElement.className = "row"
            rowElement.append(checkboxElement, label)
            return rowElement
        }

        const offRowElement = createCheckboxRow(labels.CALENDAR_DAY_DIALOG_OFF, plannedDay.isOff, (isOff) => {
            plannedDay.isOff = isOff
            this.#onChange()
            this.draw()
        })

        this.#rootElement.replaceChildren(headerElement, offRowElement)

        if (!plannedDay.isOff) {
            const timeInputElement = document.createElement("improved-attendance-time-input")
            timeInputElement.render(plannedDay.plannedMinutes, (plannedMinutes) => {
                plannedDay.plannedMinutes = plannedMinutes
                plannedDay.isManual = plannedMinutes !== plan.dailyMinutes
                this.#onChange()
                this.draw()
            })

            const plannedTimeRowElement = document.createElement("div")
            plannedTimeRowElement.className = "row"
            plannedTimeRowElement.append(labels.CALENDAR_DAY_DIALOG_PLANNED_TIME, timeInputElement)

            const manualRowElement = createCheckboxRow(labels.CALENDAR_DAY_DIALOG_MANUAL, plannedDay.isManual, (isManual) => {
                plannedDay.isManual = isManual
                this.#onChange()
            })

            this.#rootElement.append(plannedTimeRowElement, manualRowElement)
        }

        const hintElement = document.createElement("span")
        hintElement.className = "hint"
        hintElement.textContent = labels.CALENDAR_DAY_DIALOG_DEFAULT_TIME(formatMinutes(plan.dailyMinutes))
        this.#rootElement.append(hintElement)
    }

    open(
        plan: MonthPlan,
        dayElement: HTMLDivElement,
        plannedDay: PlannedDay,
        onChange: () => void
    ): void {
        this.render(plan, dayElement, plannedDay, onChange)

        if (!this.#dialogElement) return

        const rect = dayElement.getBoundingClientRect()

        this.#dialogElement.style.left = `${rect.x}px`
        this.#dialogElement.style.top = `${rect.y + rect.height}px`

        this.#dialogElement.showModal()
    }

    close(): void {
        this.#dialogElement?.close()
    }
}

customElements.define("improved-attendance-day-dialog", DayDialogElement)

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface HTMLElementTagNameMap {
        "improved-attendance-day-dialog": DayDialogElement
    }
}
