import type {MonthPlan} from "../../models/month-plan/month-plan"
import {PlannedDay} from "../../models/month-plan/planned-day"

export class PlannedDayDialogElement extends HTMLElement {
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

        this.#shadow = this.attachShadow({mode: "open"})
    }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback(): void {
        this.#shadow.innerHTML = `
            <style>
                dialog {
                    position: fixed;
                    margin: 0;
                    padding: 1rem;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: var(--background);
                    color: var(--foreground);
                    z-index: 300;
                }

                dialog::backdrop {
                    background: transparent;
                }

                .root {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .field {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
            </style>

            <dialog>
                <div class="root"></div>
            </dialog>
        `

        this.#rootElement = this.#shadow.querySelector(".root")
        this.#dialogElement = this.#shadow.querySelector("dialog")

        this.draw()

        document.addEventListener("scroll", this.#onScroll, true)
        document.addEventListener("click", this.#onDocumentClick)
    }

    // noinspection JSUnusedGlobalSymbols
    disconnectedCallback(): void {
        document.removeEventListener("scroll", this.#onScroll, true)
        document.removeEventListener("click", this.#onDocumentClick)
    }

    #onScroll = (): void => {
        if (!this.#dialogElement || !this.#dayElement) return

        const rect = this.#dayElement.getBoundingClientRect()
        this.#dialogElement.style.left = `${rect.x}px`
        this.#dialogElement.style.top = `${rect.y + rect.height}px`
    }

    #onDocumentClick = (event: MouseEvent): void => {
        if (!this.isOpen || event.composedPath().includes(this)) return

        this.close()
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

        this.#rootElement.replaceChildren()

        const title = document.createElement("h3")
        title.textContent = "Configuration du jour"

        const workTimeField = document.createElement("div")
        workTimeField.classList.add("field")

        const workTimeLabel = document.createElement("label")
        workTimeLabel.textContent = "Temps de travail (minutes)"

        const workTimeContainer = document.createElement("div")

        const timeInputElement = document.createElement("improved-attendance-time-input")
        timeInputElement.render(this.#plannedDay.workTimeMinutes, (hours, minutes) => {
            const dailyMinutes = Math.min(
                Math.max(0, Math.round(hours * 60 + minutes)),
                24 * 60
            )

            this.#plannedDay?.setWorkTime(dailyMinutes)
            this.#plannedDay?.setManual(dailyMinutes !== this.#plan?.dailyMinutes)
            this.#onChange()
            this.draw()
        })

        workTimeContainer.append(timeInputElement)
        workTimeField.append(workTimeLabel, workTimeContainer)

        const createCheckbox = (
            labelText: string,
            checked: boolean,
            onChange: (checked: boolean) => void
        ): HTMLDivElement => {
            const field = document.createElement("div")
            field.classList.add("field")

            const label = document.createElement("label")
            const checkbox = document.createElement("input")

            checkbox.type = "checkbox"
            checkbox.checked = checked

            checkbox.addEventListener("change", () => {
                onChange(checkbox.checked)
            })

            label.append(checkbox, ` ${labelText}`)
            field.append(label)

            return field
        }

        const isOffField = createCheckbox(
            "Jour de repos",
            this.#plannedDay.isOff,
            (checked) => {
                this.#plannedDay?.setOff(checked)
                this.#onChange()
            }
        )

        const isManualField = createCheckbox(
            "Manuel",
            this.#plannedDay.isManual,
            (checked) => {
                this.#plannedDay?.setManual(checked)
                this.#onChange()
            }
        )

        this.#rootElement.append(
            title,
            workTimeField,
            isOffField,
            isManualField
        )
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

        this.#dialogElement.show()
    }

    close(): void {
        this.#dialogElement?.close()
    }
}

customElements.define(
    "improved-attendance-planned-day-dialog",
    PlannedDayDialogElement
)

declare global {
    interface HTMLElementTagNameMap {
        "improved-attendance-planned-day-dialog": PlannedDayDialogElement
    }
}