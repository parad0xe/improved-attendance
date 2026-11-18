import { MAX_DAILY_MINUTES } from "../../../constants"
import { getLabels } from "../../../labels"
import { formatMinutes } from "../../../lib/time"
import type { MonthPlan, MonthTime } from "../../../models/month-plan/month-plan"
import RECOMMENDED_DAILY_TIME_STYLE from "./recommended-daily-time.css"

/** The time to log on each planned day to reach the goal. */
export class RecommendedDailyTimeElement extends HTMLElement {
    #shadow: ShadowRoot

    #plan: MonthPlan | null
    #recommendedMinutes: number | null

    #timeElement: HTMLElement | null
    #applyElement: HTMLButtonElement | null

    constructor() {
        super()
        this.#shadow = this.attachShadow({ mode: "open" })

        this.#plan = null
        this.#recommendedMinutes = null

        this.#timeElement = null
        this.#applyElement = null
    }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback(): void {
        this.#shadow.innerHTML = `
            <div class="root">
                <span class="time"></span>
                <button type="button" class="apply"></button>
            </div>
        `
        const styleElement = document.createElement("style")
        styleElement.textContent = RECOMMENDED_DAILY_TIME_STYLE
        this.#shadow.prepend(styleElement)

        const labels = getLabels(this.lang)

        this.#timeElement = this.#shadow.querySelector(".time")
        this.#applyElement = this.#shadow.querySelector(".apply")
        if (this.#applyElement) {
            this.#applyElement.textContent = labels.SETTINGS_APPLY
            this.#applyElement.title = labels.SETTINGS_APPLY_RECOMMENDED
            this.#applyElement.addEventListener("click", () => this.dispatchEvent(new Event("apply")))
        }

        this.draw()
    }

    /** The time to log on each planned day to reach the goal. */
    get dailyMinutes(): number | null {
        if (this.#recommendedMinutes === null) { return null }
        return Math.min(this.#recommendedMinutes, MAX_DAILY_MINUTES)
    }

    /**
     * Renders the time to log on each planned day to reach the goal.
     * @param plan - the plan of the month
     * @param time - the times of the month
     */
    render(plan: MonthPlan, time: MonthTime): void {
        this.#plan = plan
        this.#recommendedMinutes = plan.getRecommendedDailyMinutes(time)

        this.draw()
    }

    /** Draws the recommended time. */
    private draw(): void {
        this.hidden = this.#recommendedMinutes === null
        if (!this.#plan || this.#recommendedMinutes === null || !this.#timeElement || !this.#applyElement) {
            return
        }

        this.#timeElement.textContent = getLabels(this.lang).SETTINGS_RECOMMENDED(formatMinutes(this.#recommendedMinutes))

        const recommendedMinutes = this.#recommendedMinutes
        this.#applyElement.hidden = [...this.#plan.plannedDays.values()].every((plannedDay) => {
            return plannedDay.isPast() || plannedDay.plannedMinutes === Math.min(recommendedMinutes, plannedDay.maxOpenMinutes) || plannedDay.isOff || plannedDay.isManual
        }) || this.#recommendedMinutes === 0
    }
}

customElements.define("improved-attendance-recommended-daily-time", RecommendedDailyTimeElement)

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface HTMLElementTagNameMap {
        "improved-attendance-recommended-daily-time": RecommendedDailyTimeElement
    }
}
