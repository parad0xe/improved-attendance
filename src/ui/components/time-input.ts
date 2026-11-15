export class TimeInputElement extends HTMLElement {
    #shadow: ShadowRoot
    #rootElement: HTMLElement | null

    #minutes: number | null

    #onChange: (minutes: number) => void

    constructor() {
        super()
        this.#rootElement = null
        this.#minutes = null
        this.#onChange = () => {}

        this.#shadow = this.attachShadow({ mode: "open" })
    }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback(): void {
        this.#shadow.innerHTML = `
            <style>
                .root { display: flex; flex-shrink: 0; align-items: center; gap: 0.25rem; }
                .root input {
                    padding: 0.125rem 0.375rem;
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

    render(minutes: number, onChange: (minutes: number) => void): void {
        this.#minutes = minutes
        this.#onChange = onChange
        this.draw()
    }

    private draw(): void {
        if (this.#minutes === null || !this.#rootElement) {
            return
        }

        this.#rootElement.replaceChildren()

        const hoursInputElement = document.createElement("input")
        hoursInputElement.type = "number"
        hoursInputElement.min = "0"
        hoursInputElement.max = "24"
        hoursInputElement.step = "1"

        // -1 and 60 let the arrows carry over to the hours.
        const minutesInputElement = document.createElement("input")
        minutesInputElement.type = "number"
        minutesInputElement.min = "-1"
        minutesInputElement.max = "60"
        minutesInputElement.step = "1"

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
                this.#minutes = Math.min(Math.max(0, Math.round(hours * 60 + minutes)), 24 * 60)
                this.#onChange(this.#minutes)
            }
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
