import { MAX_DAILY_MINUTES } from "../constants"
import type { Labels } from "../labels"
import { formatMinutes } from "../lib/time"
import type { Attendance } from "../models/attendance"
import type { MonthPlan, MonthTime } from "../models/month-plan/month-plan"
import "./components/calendar/calendar"
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
    lang: string
    labels: Labels
    rootElement: HTMLElement
    themeSwitchElement: HTMLElement
    /** The input of the planned capsules. */
    capsulesInputElement: HTMLInputElement | null
    /** The row of the time to log on each planned day to reach the goal. */
    neededDailyTimeRowElement: HTMLElement | null
    /** The text of the time to log on each planned day to reach the goal. */
    neededDailyTimeElement: HTMLElement | null
    /** The button of the time to log on each planned day to reach the goal. */
    neededDailyTimeApplyElement: HTMLElement | null
    /** The time to log on each planned day to reach the goal. */
    neededDailyMinutes: number | null
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
        this.neededDailyTimeRowElement = null
        this.neededDailyTimeElement = null
        this.neededDailyMinutes = null
        this.settingsContainerElement = null
        this.neededDailyTimeApplyElement = null
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

        const neededDailyTimeRowElement = document.createElement("div")
        neededDailyTimeRowElement.className = "improved-attendance-settings-row"
        this.neededDailyTimeRowElement = neededDailyTimeRowElement
        dailyTimeColumnElement.append(neededDailyTimeRowElement)

        const neededDailyTimeElement = document.createElement("span")
        neededDailyTimeElement.className = "improved-attendance-settings-hint"
        this.neededDailyTimeElement = neededDailyTimeElement
        neededDailyTimeRowElement.append(neededDailyTimeElement)

        const neededDailyTimeApplyElement = document.createElement("button")
        neededDailyTimeApplyElement.type = "button"
        neededDailyTimeApplyElement.className = "improved-attendance-settings-button"
        neededDailyTimeApplyElement.textContent = this.labels.SETTINGS_APPLY
        neededDailyTimeApplyElement.title = this.labels.SETTINGS_APPLY_NEEDED
        this.neededDailyTimeApplyElement = neededDailyTimeApplyElement
        neededDailyTimeApplyElement.addEventListener("click", () => {
            if (this.neededDailyMinutes === null) { return }
            timeInputElement.render(this.neededDailyMinutes, setDailyMinutes)
            setDailyMinutes(this.neededDailyMinutes)
        })
        neededDailyTimeRowElement.append(neededDailyTimeApplyElement)

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
     * @param plan - the plan of the month
     * @param time - the times of the month
     */
    renderNeededDailyTime(plan: MonthPlan, time: MonthTime): void {
        const neededMinutes = plan.getNeededDailyMinutes(time)
        this.neededDailyMinutes = neededMinutes === null ? null : Math.min(neededMinutes, MAX_DAILY_MINUTES)
        if (!this.neededDailyTimeRowElement || !this.neededDailyTimeElement || !this.neededDailyTimeApplyElement) { return }
        this.neededDailyTimeRowElement.hidden = neededMinutes === null
        this.neededDailyTimeElement.textContent = neededMinutes === null ? "" : this.labels.SETTINGS_PER_DAY(formatMinutes(neededMinutes))

        this.neededDailyTimeApplyElement.hidden = [...plan.plannedDays.values()].every((plannedDay) => {
            return plannedDay.isPast() || plannedDay.plannedMinutes === this.neededDailyMinutes || plannedDay.isOff || plannedDay.isManual
        }) || neededMinutes === 0
    }
}
