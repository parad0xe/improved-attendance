import type {MonthPlan} from "../../models/month-plan/month-plan"

export class TimeInputElement extends HTMLElement {
    #shadow: ShadowRoot
    #rootElement: HTMLElement | null

    #defaultValueInMinutes: number | null

    #onChange: (hours: number, minutes: number) => void

    constructor() {
        super()
        this.#rootElement = null
        this.#defaultValueInMinutes = null
        this.#onChange = () => {
        }

        this.#shadow = this.attachShadow({mode: "open"})
    }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback(): void {
        this.#shadow.innerHTML = `
            <style>
                .root { display: flex; flex-shrink: 0; align-items: center; gap: 0.25rem; }
                .root input {
                    padding: 0.5rem;
                    width: 3rem;
                    border: 1px solid var(--input);
                    border-radius: 0.375rem;
                    background: transparent;
                    color: inherit;
                }
            </style>
            
            <span class="root"></span>
        `

        this.#rootElement = this.#shadow.querySelector(".root")
        this.draw()
    }

    render(defaultValue: number, onChange: (hours: number, minutes: number) => void): void {
        this.#defaultValueInMinutes = defaultValue
        this.#onChange = onChange
        this.draw()
    }

    private draw(): void {
        if (this.#defaultValueInMinutes === null || !this.#rootElement) {
            return
        }

        this.#rootElement.replaceChildren()

        const hoursInputElement = document.createElement("input")
        hoursInputElement.type = "number"
        hoursInputElement.min = "0"
        hoursInputElement.max = "24"
        hoursInputElement.step = "1"
        hoursInputElement.value = String(Math.floor(this.#defaultValueInMinutes / 60))

        // -1 and 60 let the arrows carry over to the hours.
        const minutesInputElement = document.createElement("input")
        minutesInputElement.type = "number"
        minutesInputElement.min = "-1"
        minutesInputElement.max = "60"
        minutesInputElement.step = "1"
        minutesInputElement.value = String(this.#defaultValueInMinutes % 60)


        const renderTime = () => {
            if (this.#defaultValueInMinutes === null) {
                return
            }
            const hours = hoursInputElement.valueAsNumber
            const minutes = minutesInputElement.valueAsNumber

            const dailyMinutes = Math.min(Math.max(0, Math.round(hours * 60 + minutes)), 24 * 60)

            hoursInputElement.value = String(Math.floor(dailyMinutes / 60))
            minutesInputElement.value = String(dailyMinutes % 60)
        }
        renderTime()

        const onChange = (): void => {
            const hours = hoursInputElement.valueAsNumber
            const minutes = minutesInputElement.valueAsNumber

            if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
                renderTime()
                return
            }

            this.#onChange(hours, minutes)
            renderTime()
        }

        hoursInputElement.addEventListener("change", onChange)
        minutesInputElement.addEventListener("change", onChange)

        this.#rootElement.append(hoursInputElement, "h", minutesInputElement)
    }
}

customElements.define("improved-attendance-time-input", TimeInputElement)

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface HTMLElementTagNameMap {
        "improved-attendance-time-input": TimeInputElement
    }
}