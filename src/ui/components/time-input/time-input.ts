import { MAX_DAILY_MINUTES } from "../../../constants"
import TIME_INPUT_STYLE from "./time-input.css"

/** An input of a time, in hours and minutes. */
export class TimeInputElement extends HTMLElement {
    #shadow: ShadowRoot
    #rootElement: HTMLElement | null

    #minutes: number | null
    #maxMinutes: number

    #onChange: (minutes: number) => void

    constructor() {
        super()
        this.#rootElement = null
        this.#minutes = null
        this.#maxMinutes = MAX_DAILY_MINUTES
        this.#onChange = () => {}

        this.#shadow = this.attachShadow({ mode: "open" })
    }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback(): void {
        this.#shadow.innerHTML = `
            <span class="root"></span>
        `
        const styleElement = document.createElement("style")
        styleElement.textContent = TIME_INPUT_STYLE
        this.#shadow.prepend(styleElement)

        this.#rootElement = this.#shadow.querySelector(".root")
        this.draw()
    }

    /**
     * Renders `minutes`, and calls `onChange` after each change.
     * @param minutes - the time of the input
     * @param onChange - called with the new time
     * @param maxMinutes - the longest time of the input
     */
    render(minutes: number, onChange: (minutes: number) => void, maxMinutes = MAX_DAILY_MINUTES): void {
        this.#minutes = minutes
        this.#maxMinutes = maxMinutes
        this.#onChange = onChange
        this.draw()
    }

    /** Draws the input. */
    private draw(): void {
        if (this.#minutes === null || !this.#rootElement) {
            return
        }

        this.#rootElement.replaceChildren()

        const hoursInputElement = document.createElement("input")
        hoursInputElement.type = "number"
        hoursInputElement.min = "0"
        hoursInputElement.max = String(Math.floor(this.#maxMinutes / 60))
        hoursInputElement.step = "1"
        this.#rootElement.append(hoursInputElement, "h")

        // -1 and 60 let the arrows carry over to the hours.
        const minutesInputElement = document.createElement("input")
        minutesInputElement.type = "number"
        minutesInputElement.min = "-1"
        minutesInputElement.max = "60"
        minutesInputElement.step = "1"
        this.#rootElement.append(minutesInputElement)

        const renderTime = () => {
            const minutes = this.#minutes ?? 0
            hoursInputElement.value = String(Math.floor(minutes / 60))
            minutesInputElement.value = String(minutes % 60)
        }
        renderTime()

        const onChange = (): void => {
            const hours = hoursInputElement.valueAsNumber
            const minutes = minutesInputElement.valueAsNumber
            if (Number.isFinite(hours) && Number.isFinite(minutes)) {
                this.#minutes = Math.min(Math.max(0, Math.round(hours * 60 + minutes)), this.#maxMinutes)
                this.#onChange(this.#minutes)
            }
            renderTime()
        }

        hoursInputElement.addEventListener("change", onChange)
        minutesInputElement.addEventListener("change", onChange)
    }
}

customElements.define("improved-attendance-time-input", TimeInputElement)

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface HTMLElementTagNameMap {
        "improved-attendance-time-input": TimeInputElement
    }
}
