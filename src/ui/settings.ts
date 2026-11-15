import type { Labels } from "../labels"
import { formatMinutes } from "../lib/time"
import type { Attendance } from "../models/attendance"
import type { MonthPlan } from "../models/month-plan/month-plan"
import "./components/calendar"
import "./components/time-input"

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
    lang: string
    labels: Labels
    rootElement: HTMLElement
    themeSwitchElement: HTMLElement
    /** The input of the planned capsules. */
    capsulesInputElement: HTMLInputElement | null
    /** The text of the time to log on each planned day to reach the goal. */
    neededDailyTimeElement: HTMLElement | null
    /** The settings of the plan of the month. */
    settingsContainerElement: HTMLElement | null

    /** Creates the settings block. */
    constructor({ lang, labels, themeSwitchElement }: SettingsOptions) {
        this.lang = lang
        this.labels = labels
        this.themeSwitchElement = themeSwitchElement

        this.rootElement = document.createElement("section")
        this.rootElement.className = "improved-attendance-settings"

        this.capsulesInputElement = null
        this.neededDailyTimeElement = null
        this.settingsContainerElement = null
    }

    /** Adds the block to the bottom of the sidebar, and keeps it there. */
    mount(): void {
        const creditElement = document.createElement("a")
        creditElement.className = "improved-attendance-credit"
        creditElement.href = "https://github.com/parad0xe"
        creditElement.target = "_blank"
        creditElement.rel = "noopener noreferrer"
        creditElement.textContent = "@nlallema"

        const footerContainerElement = document.createElement("div")
        footerContainerElement.className = "improved-attendance-footer-container"
        footerContainerElement.append(this.themeSwitchElement, creditElement)
        this.rootElement.append(footerContainerElement)

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

        const daysOffTitleElement = document.createElement("span")
        daysOffTitleElement.className = "improved-attendance-settings-title"
        daysOffTitleElement.textContent = this.labels.SETTINGS_DAYS_OFF

        const calendarElement = document.createElement("improved-attendance-calendar")
        calendarElement.lang = this.lang
        calendarElement.render(plan, attendance.getDayMarks())
        calendarElement.addEventListener("change", onChange)

        const daysOffContainerElement = document.createElement("div")
        daysOffContainerElement.className = "improved-attendance-days-off-container"
        daysOffContainerElement.append(daysOffTitleElement, calendarElement)

        const paceTitleElement = document.createElement("span")
        paceTitleElement.className = "improved-attendance-settings-title"
        paceTitleElement.textContent = this.labels.SETTINGS_PACE

        const dailyTimeRowElement = document.createElement("label")
        dailyTimeRowElement.className = "improved-attendance-settings-row"
        dailyTimeRowElement.textContent = this.labels.SETTINGS_TIME_PER_REMAINING_DAY

        const timeInputElement = document.createElement("improved-attendance-time-input")
        timeInputElement.render(plan.dailyMinutes, (dailyMinutes) => {
            plan.setDailyMinutes(dailyMinutes)
            onChange()
            calendarElement.draw()
        })
        dailyTimeRowElement.append(timeInputElement)

        const neededDailyTimeElement = document.createElement("span")
        neededDailyTimeElement.className = "improved-attendance-needed-daily-time"
        this.neededDailyTimeElement = neededDailyTimeElement

        const dailyTimeFieldElement = document.createElement("div")
        dailyTimeFieldElement.className = "improved-attendance-settings-field"
        dailyTimeFieldElement.append(dailyTimeRowElement, neededDailyTimeElement)

        const paceContainerElement = document.createElement("div")
        paceContainerElement.className = "improved-attendance-pace-container"
        paceContainerElement.append(paceTitleElement, dailyTimeFieldElement)

        settingsContainerElement.append(daysOffContainerElement, paceContainerElement)

        if (plan.isCurrentMonth()) {
            const capsulesRowElement = document.createElement("label")
            capsulesRowElement.className = "improved-attendance-settings-row"
            capsulesRowElement.textContent = this.labels.SETTINGS_CAPSULES_TO_USE

            const capsulesInputElement = document.createElement("input")
            capsulesInputElement.type = "number"
            capsulesInputElement.min = "0"
            capsulesInputElement.step = "1"
            this.capsulesInputElement = capsulesInputElement
            this.renderCapsules(plan, attendance.availableCapsules)
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

            paceContainerElement.append(capsulesRowElement)
        }

        this.settingsContainerElement = settingsContainerElement
        this.rootElement.prepend(settingsContainerElement)
    }

    /**
     * Renders the planned capsules of `plan`.
     * @param plan - the plan of the month
     * @param availableCapsules - the number of capsules left to use
     */
    renderCapsules(plan: MonthPlan, availableCapsules: number): void {
        if (!this.capsulesInputElement) { return }
        this.capsulesInputElement.max = String(availableCapsules)
        this.capsulesInputElement.value = String(plan.capsules)
    }

    /**
     * Renders the time to log on each planned day to reach the goal.
     * @param neededMinutes - the time to log on each planned day, in minutes
     */
    renderNeededDailyTime(neededMinutes: number | null): void {
        if (!this.neededDailyTimeElement) { return }
        this.neededDailyTimeElement.hidden = neededMinutes === null
        this.neededDailyTimeElement.textContent = neededMinutes === null ? "" : this.labels.SETTINGS_NEEDED_PER_DAY(formatMinutes(neededMinutes))
    }
}
