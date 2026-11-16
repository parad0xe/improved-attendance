import type { Labels } from "../labels"
import type { Attendance } from "../models/attendance"
import type { MonthPlan, MonthTime } from "../models/month-plan/month-plan"
import "./components/calendar/calendar"
import type {
    RecommendedDailyTimeElement
} from "./components/recommended-daily-time/recommended-daily-time"
import "./components/recommended-daily-time/recommended-daily-time"
import "./components/time-input/time-input"

const SELECTORS = {
    sidebarContent: "[data-slot='sidebar-content']",
}

interface SettingsOptions {
    /** The language, such as "fr". */
    lang: string
    /** The labels in the language of the site. */
    labels: Labels
    /** The row of the theme switch. */
    themeSwitchElement: HTMLElement
}

interface SettingsRenderOptions {
    /** The plan of the month. */
    plan: MonthPlan
    /** The attendance of the month. */
    attendance: Attendance
    /** Called after each change of the plan. */
    onChange: () => void
}

/** Renders the settings block. */
export class Settings {
    private readonly lang: string
    private readonly labels: Labels

    private readonly themeSwitchElement: HTMLElement
    /** The input of the planned capsules. */
    private capsulesInputElement: HTMLInputElement | null
    /** The time to log on each planned day to reach the goal. */
    private recommendedDailyTimeElement: RecommendedDailyTimeElement | null
    /** The settings of the plan of the month. */
    private settingsContainerElement: HTMLElement | null

    readonly rootElement: HTMLElement

    /** Creates the settings block. */
    constructor({ lang, labels, themeSwitchElement }: SettingsOptions) {
        this.lang = lang
        this.labels = labels

        this.themeSwitchElement = themeSwitchElement
        this.capsulesInputElement = null
        this.recommendedDailyTimeElement = null
        this.settingsContainerElement = null

        this.rootElement = document.createElement("section")
        this.rootElement.className = "improved-attendance-settings"
    }

    /** Adds the block to the bottom of the sidebar, and keeps it there. */
    mount(): void {
        const footerContainerElement = document.createElement("div")
        footerContainerElement.className = "improved-attendance-settings-footer-container"
        this.rootElement.append(footerContainerElement)

        footerContainerElement.append(this.themeSwitchElement)

        const creditElement = document.createElement("a")
        creditElement.className = "improved-attendance-settings-credit"
        creditElement.href = "https://github.com/parad0xe"
        creditElement.target = "_blank"
        creditElement.rel = "noopener noreferrer"
        creditElement.textContent = "@nlallema"
        footerContainerElement.append(creditElement)

        // The site can render the sidebar content again.
        const attach = () => {
            const sidebarContentElement = document.querySelector(SELECTORS.sidebarContent)
            if (sidebarContentElement && !sidebarContentElement.contains(this.rootElement)) {
                sidebarContentElement.append(this.rootElement)
            }
        }
        attach()
        new MutationObserver(attach).observe(document.body, { childList: true, subtree: true })
    }

    /** Renders the plan of the month, and calls `onChange` after each change. */
    render({ plan, attendance, onChange }: SettingsRenderOptions): void {
        this.settingsContainerElement?.remove()
        this.capsulesInputElement = null

        const settingsContainerElement = document.createElement("div")
        settingsContainerElement.className = "improved-attendance-settings-container"

        const daysContainerElement = document.createElement("div")
        daysContainerElement.className = "improved-attendance-settings-days-container"
        settingsContainerElement.append(daysContainerElement)

        const daysHeaderElement = document.createElement("div")
        daysHeaderElement.className = "improved-attendance-settings-row"
        daysContainerElement.append(daysHeaderElement)

        const daysTitleElement = document.createElement("span")
        daysTitleElement.className = "improved-attendance-settings-title"
        daysTitleElement.textContent = this.labels.SETTINGS_DAYS
        daysHeaderElement.append(daysTitleElement)

        const daysHelpButtonElement = document.createElement("button")
        daysHelpButtonElement.type = "button"
        daysHelpButtonElement.className = "improved-attendance-settings-help"
        daysHelpButtonElement.textContent = "?"
        daysHelpButtonElement.title = this.labels.SETTINGS_DAYS_HELP
        daysHelpButtonElement.setAttribute("aria-label", this.labels.SETTINGS_DAYS_HELP)
        daysHelpButtonElement.setAttribute("aria-expanded", "false")
        daysHeaderElement.append(daysHelpButtonElement)

        const calendarElement = document.createElement("improved-attendance-calendar")
        calendarElement.lang = this.lang
        calendarElement.render(plan, attendance.getDayMarks())
        calendarElement.addEventListener("change", onChange)
        daysContainerElement.append(calendarElement)

        const daysHintElements = this.labels.CALENDAR_HINTS.map(({ key, action }) => {
            const hintElement = document.createElement("span")
            hintElement.className = "improved-attendance-settings-hint"
            hintElement.hidden = true
            daysContainerElement.append(hintElement)

            const keyElement = document.createElement("strong")
            keyElement.textContent = key
            hintElement.append(keyElement, ` ${action}`)
            return hintElement
        })
        daysHelpButtonElement.addEventListener("click", () => {
            for (const hintElement of daysHintElements) {
                hintElement.hidden = !hintElement.hidden
            }
            daysHelpButtonElement.setAttribute("aria-expanded", String(!daysHintElements[0].hidden))
        })

        const paceContainerElement = document.createElement("div")
        paceContainerElement.className = "improved-attendance-settings-pace-container"
        settingsContainerElement.append(paceContainerElement)

        const paceTitleElement = document.createElement("span")
        paceTitleElement.className = "improved-attendance-settings-title"
        paceTitleElement.textContent = this.labels.SETTINGS_PACE
        paceContainerElement.append(paceTitleElement)

        const dailyTimeColumnElement = document.createElement("div")
        dailyTimeColumnElement.className = "improved-attendance-settings-column"
        dailyTimeColumnElement.textContent = this.labels.SETTINGS_DAILY_TIME
        paceContainerElement.append(dailyTimeColumnElement)

        const setDailyMinutes = (dailyMinutes: number) => {
            plan.setDailyMinutes(dailyMinutes)
            onChange()
            calendarElement.draw()
        }

        const timeInputElement = document.createElement("improved-attendance-time-input")
        timeInputElement.render(plan.dailyMinutes, setDailyMinutes)
        dailyTimeColumnElement.append(timeInputElement)

        const recommendedDailyTimeElement = document.createElement("improved-attendance-recommended-daily-time")
        recommendedDailyTimeElement.lang = this.lang
        recommendedDailyTimeElement.addEventListener("apply", () => {
            const { dailyMinutes } = recommendedDailyTimeElement
            if (dailyMinutes === null) { return }
            timeInputElement.render(dailyMinutes, setDailyMinutes)
            setDailyMinutes(dailyMinutes)
        })
        this.recommendedDailyTimeElement = recommendedDailyTimeElement
        dailyTimeColumnElement.append(recommendedDailyTimeElement)

        if (plan.isCurrentMonth()) {
            const capsulesRowElement = document.createElement("label")
            capsulesRowElement.className = "improved-attendance-settings-row"
            capsulesRowElement.textContent = this.labels.SETTINGS_CAPSULES_TO_USE
            paceContainerElement.append(capsulesRowElement)

            const capsulesInputElement = document.createElement("input")
            capsulesInputElement.type = "number"
            capsulesInputElement.min = "0"
            capsulesInputElement.step = "1"
            this.capsulesInputElement = capsulesInputElement
            this.setCapsules(plan, attendance.availableCapsules)
            capsulesRowElement.append(capsulesInputElement)

            capsulesInputElement.addEventListener("change", () => {
                const capsules = capsulesInputElement.valueAsNumber
                if (!Number.isInteger(capsules) || capsules < 0) {
                    capsulesInputElement.value = String(plan.capsules)
                    return
                }
                plan.capsules = Math.min(capsules, Number(capsulesInputElement.max))
                capsulesInputElement.value = String(plan.capsules)
                onChange()
            })
        }

        this.settingsContainerElement = settingsContainerElement
        this.rootElement.prepend(settingsContainerElement)
    }

    /**
     * Renders the planned capsules of `plan`.
     * @param plan - the plan of the month
     * @param availableCapsules - the number of capsules left to use
     */
    setCapsules(plan: MonthPlan, availableCapsules: number): void {
        if (!this.capsulesInputElement) { return }
        this.capsulesInputElement.max = String(availableCapsules)
        this.capsulesInputElement.value = String(plan.capsules)
    }

    /**
     * Renders the time to log on each planned day to reach the goal.
     * @param plan - the plan of the month
     * @param time - the times of the month
     */
    setRecommendedDailyTime(plan: MonthPlan, time: MonthTime): void {
        this.recommendedDailyTimeElement?.render(plan, time)
    }
}
