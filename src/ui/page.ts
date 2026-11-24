import { EXTENSION_NAME } from "../constants"
import type { Labels } from "../labels"
import { formatMinutes, parseMinutes } from "../lib/time"
import { getSchoolToday, type Attendance } from "../models/attendance"
import type { MonthPlan, MonthTime } from "../models/month-plan/month-plan"

const SELECTORS = {
    main: "[data-slot='sidebar-inset'] main",
    summary: "[data-slot='sidebar-inset'] main div.mb-3 div:nth-of-type(1)",
    progressTrack: "[data-slot='sidebar-inset'] main div.mb-3 div:nth-of-type(2) div:nth-of-type(2)",
    loggedMonth: "[data-slot='sidebar-inset'] main div.mb-3 > div div:nth-of-type(2) span:nth-of-type(1)",
    monthGoal: "[data-slot='sidebar-inset'] main div.mb-3 > div div:nth-of-type(2) span:nth-of-type(3)",
    timerParts: "[data-slot='sidebar-inset'] main div.mt-8 div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div > span",
    runningSession: "[data-slot='sidebar-inset'] main div.mt-8 div:nth-of-type(2) > div > div div > span:nth-of-type(1)",
    loggedToday: "[data-slot='sidebar-inset'] main div.mt-8 div:nth-of-type(2) > div > div div > span:last-of-type",
}

interface PageRenderOptions {
    /** The plan of the month. */
    plan: MonthPlan
    /** The times of the month. */
    time: MonthTime
    /** The attendance of the month. */
    attendance: Attendance
    /** Whether the end of the planned time of today is shown. */
    isEndTodayShown: boolean
}

/**
 * Returns the time shown by the element at `selector`, and whether it is found.
 * @param selector - the selector of an element that shows a time
 */
function readTimeText(selector: string): [string, boolean] {
    const element = document.querySelector(selector)
    if (!element) {
        return ["00:00", false]
    }

    const text = element.textContent.replace("+", "").trim()

    if (!/^\d{1,3}:\d{1,2}$/.test(text)) {
        return ["00:00", false]
    }

    return [text, true]
}

/**
 * Returns whether `a` and `b` have the same times.
 * @param a - the times of the month
 * @param b - the times of the month
 */
function isSameTime(a: MonthTime, b: MonthTime): boolean {
    return a.loggedMonthMinutes === b.loggedMonthMinutes
        && a.monthGoalMinutes === b.monthGoalMinutes
        && a.runningSessionMinutes === b.runningSessionMinutes
        && a.loggedTodayMinutes === b.loggedTodayMinutes
        && a.isSessionRunning === b.isSessionRunning
}

/** Reads the times of the month, and renders the gap and the expected bar. */
export class Page {
    labels: Labels
    /** The summary of the month. */
    summaryElement: Element
    /** The progress bar of the month. */
    progressTrackElement: Element

    /**
     * Finds the summary and the progress bar of the month.
     * @param labels - the labels in the language of the site
     */
    constructor(labels: Labels) {
        this.labels = labels

        const summaryElement = document.querySelector(SELECTORS.summary)
        if (!summaryElement) {
            throw new Error(`${EXTENSION_NAME}: ${this.labels.ERROR_SUMMARY_NOT_FOUND}`)
        }
        this.summaryElement = summaryElement

        const progressTrackElement = document.querySelector(SELECTORS.progressTrack)
        if (!progressTrackElement) {
            throw new Error(`${EXTENSION_NAME}: ${this.labels.ERROR_PROGRESS_BAR_NOT_FOUND}`)
        }
        this.progressTrackElement = progressTrackElement
    }

    /** Prepares the progress bar to hold the expected bar. */
    mount(): void {
        this.progressTrackElement.classList.add("relative")
        this.progressTrackElement.querySelector("div")!.classList.add("relative", "z-[1]")
    }

    /** Returns the times of the month. */
    read(): MonthTime {
        const [loggedMonthText, hasLoggedMonth] = readTimeText(SELECTORS.loggedMonth)
        if (!hasLoggedMonth) {
            throw new Error(`${EXTENSION_NAME}: ${this.labels.ERROR_LOGGED_MONTH_NOT_FOUND}`)
        }

        const [monthGoalText, hasMonthGoal] = readTimeText(SELECTORS.monthGoal)
        if (!hasMonthGoal) {
            throw new Error(`${EXTENSION_NAME}: ${this.labels.ERROR_MONTH_GOAL_NOT_FOUND}`)
        }

        const timerParts = document.querySelectorAll(SELECTORS.timerParts)
        const isTimerStarted = timerParts.length === 2
        const isLoggedToday = timerParts.length >= 1

        const [runningSessionText, hasRunningSession] = isTimerStarted
            ? readTimeText(SELECTORS.runningSession)
            : ["00:00", true]
        if (!hasRunningSession) {
            console.warn(`${EXTENSION_NAME}: ${this.labels.WARNING_RUNNING_SESSION_NOT_FOUND}`)
        }

        const [loggedTodayText, hasLoggedToday] = isLoggedToday
            ? readTimeText(SELECTORS.loggedToday)
            : ["00:00", true]
        if (!hasLoggedToday) {
            console.warn(`${EXTENSION_NAME}: ${this.labels.WARNING_LOGGED_TODAY_NOT_FOUND}`)
        }

        return {
            loggedMonthMinutes: parseMinutes(loggedMonthText),
            monthGoalMinutes: parseMinutes(monthGoalText),
            runningSessionMinutes: parseMinutes(runningSessionText),
            loggedTodayMinutes: parseMinutes(loggedTodayText),
            isSessionRunning: isTimerStarted,
        }
    }

    /** Renders the expected bar and the gap. */
    render(options: PageRenderOptions): void {
        this.renderExpectedBar(options.plan, options.time)
        this.renderGap(options)
    }

    /**
     * Renders the expected bar.
     * @param plan - the plan of the month
     * @param time - the times of the month
     */
    private renderExpectedBar(plan: MonthPlan, time: MonthTime): void {
        const expectedMinutes = plan.getExpectedMinutes(time.monthGoalMinutes)
        let expectedBarElement = this.progressTrackElement.querySelector<HTMLElement>(".improved-attendance-expected-bar")

        const loggedTotalMinutes = time.loggedMonthMinutes + time.runningSessionMinutes
        if (time.loggedMonthMinutes >= plan.getGoalMinutes(time.monthGoalMinutes) || expectedMinutes <= loggedTotalMinutes) {
            expectedBarElement?.remove()
            return
        }

        if (!expectedBarElement) {
            expectedBarElement = document.createElement("div")
            expectedBarElement.classList.add("improved-attendance-expected-bar")
            expectedBarElement.style.width = "0%"
            this.progressTrackElement.append(expectedBarElement)
        }

        let expectedBarLabelElement = this.progressTrackElement.querySelector(".improved-attendance-expected-bar-label")
        if (!expectedBarLabelElement) {
            expectedBarLabelElement = document.createElement("span")
            expectedBarLabelElement.classList.add("improved-attendance-expected-bar-label")
            expectedBarElement.append(expectedBarLabelElement)
        }
        expectedBarLabelElement.textContent = formatMinutes(expectedMinutes)

        // The bar is drawn at its current width first, so that the change of width is animated.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                expectedBarElement.style.width = `${expectedMinutes / time.monthGoalMinutes * 100}%`
            })
        })
    }

    /** Renders the gap. */
    private renderGap({ plan, time, attendance, isEndTodayShown }: PageRenderOptions): void {
        this.summaryElement.querySelector(".improved-attendance-gap-container")?.remove()

        if (time.loggedMonthMinutes >= plan.getGoalMinutes(time.monthGoalMinutes)) { return }

        this.summaryElement.classList.add("improved-attendance-summary")

        const { start, end } = plan.getExpectedRange(time.monthGoalMinutes)
        const loggedTotalMinutes = time.loggedMonthMinutes + time.runningSessionMinutes
        const remainingTodayMinutes = plan.getRemainingTodayMinutes(time)

        let expectedMinutes = null
        if (loggedTotalMinutes < start) {
            expectedMinutes = start
        } else if (loggedTotalMinutes >= end || remainingTodayMinutes === 0) {
            expectedMinutes = end
        }

        const gapContainerElement = document.createElement("span")
        gapContainerElement.className = "improved-attendance-gap-container"
        this.summaryElement.prepend(gapContainerElement)

        if (expectedMinutes !== null) {
            const gapMinutes = loggedTotalMinutes - expectedMinutes
            const isBonus = gapMinutes >= 0
            const className = isBonus ? "improved-attendance-bonus" : "improved-attendance-missing"

            const gapTodayContainerElement = document.createElement("span")
            gapTodayContainerElement.className = "improved-attendance-gap-today-container"
            gapContainerElement.append(gapTodayContainerElement)

            const gapTodayValueElement = document.createElement("strong")
            gapTodayValueElement.classList.add("improved-attendance-gap-value", className)
            gapTodayValueElement.title = this.labels.GAP_EXPECTED(formatMinutes(expectedMinutes))
            gapTodayValueElement.textContent = `${isBonus ? "+" : "-"}${formatMinutes(Math.abs(gapMinutes))}`
            gapTodayContainerElement.append(gapTodayValueElement)

            if (plan.dailyMinutes > 0) {
                const formatDays = isBonus ? this.labels.GAP_BONUS_DAYS : this.labels.GAP_MISSING_DAYS
                const gapTodayLabelElement = document.createElement("span")
                gapTodayLabelElement.classList.add("improved-attendance-gap-label", className)
                gapTodayLabelElement.textContent = formatDays(Math.abs(gapMinutes) / plan.dailyMinutes)
                gapTodayContainerElement.append(gapTodayLabelElement)
            }
        }

        if (remainingTodayMinutes > 0) {
            const gapRemainingTodayContainerElement = document.createElement("span")
            gapRemainingTodayContainerElement.className = "improved-attendance-gap-remaining-today-container"
            gapContainerElement.append(gapRemainingTodayContainerElement)

            const gapRemainingTodayValueElement = document.createElement("strong")
            gapRemainingTodayValueElement.classList.add("improved-attendance-gap-value", "improved-attendance-in-progress")
            gapRemainingTodayValueElement.textContent = formatMinutes(remainingTodayMinutes)
            gapRemainingTodayContainerElement.append(gapRemainingTodayValueElement)

            const gapRemainingTodayLabelElement = document.createElement("span")
            gapRemainingTodayLabelElement.classList.add("improved-attendance-gap-label", "improved-attendance-in-progress")
            gapRemainingTodayLabelElement.textContent = this.labels.GAP_REMAINING_TODAY
            gapRemainingTodayContainerElement.append(gapRemainingTodayLabelElement)

            const plannedTodayMinutes = plan.getPlannedDay(getSchoolToday().getDate())?.plannedMinutes ?? 0
            const endTodayTimestamp = isEndTodayShown ? attendance.getEndTodayTimestamp(plannedTodayMinutes) : null
            if (endTodayTimestamp !== null) {
                const endTodayDate = new Date(endTodayTimestamp)
                const endTodayTime = formatMinutes(endTodayDate.getHours() * 60 + endTodayDate.getMinutes())
                const gapRemainingTodayEndElement = document.createElement("span")
                gapRemainingTodayEndElement.classList.add("improved-attendance-gap-label", "improved-attendance-gap-end-today")
                gapRemainingTodayEndElement.title = this.labels.GAP_END_TODAY(endTodayTime)
                gapRemainingTodayEndElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`
                gapRemainingTodayEndElement.append(endTodayTime)
                gapRemainingTodayContainerElement.append(gapRemainingTodayEndElement)
            }
        }

        if (plan.isCurrentMonth()) {
            const monthEndMinutes = plan.getProjectedMinutes(time) - plan.getGoalMinutes(time.monthGoalMinutes)
            const isMonthEndBonus = monthEndMinutes >= 0
            const gapMonthEndContainerElement = document.createElement("span")
            gapMonthEndContainerElement.className = "improved-attendance-gap-month-end-container"
            gapContainerElement.append(gapMonthEndContainerElement)

            const gapMonthEndLabelElement = document.createElement("span")
            gapMonthEndLabelElement.className = "improved-attendance-gap-label"
            gapMonthEndLabelElement.textContent = this.labels.GAP_MONTH_END
            gapMonthEndContainerElement.append(gapMonthEndLabelElement)

            const gapMonthEndValueElement = document.createElement("strong")
            gapMonthEndValueElement.classList.add("improved-attendance-gap-value", isMonthEndBonus ? "improved-attendance-bonus" : "improved-attendance-missing")
            gapMonthEndValueElement.textContent = `${isMonthEndBonus ? "+" : ""}${formatMinutes(monthEndMinutes)}`
            gapMonthEndContainerElement.append(gapMonthEndValueElement)

            if (plan.capsules > 0) {
                const gapCapsuleContainerElement = document.createElement("span")
                gapCapsuleContainerElement.className = "improved-attendance-gap-capsule-container"
                gapContainerElement.append(gapCapsuleContainerElement)

                const gapCapsuleLabelElement = document.createElement("span")
                gapCapsuleLabelElement.classList.add("improved-attendance-gap-label", "improved-attendance-capsule")
                gapCapsuleLabelElement.textContent = this.labels.GAP_CAPSULES_LEFT(plan.capsules)
                gapCapsuleContainerElement.append(gapCapsuleLabelElement)
            }
        }
    }

    /**
     * Calls `onChange` each time the times of the month change, and returns a function that stops watching.
     * @param onChange - called with the new times of the month
     */
    watch(onChange: (time: MonthTime) => void | Promise<void>): () => void {
        let time = this.read()

        const stop = (error: unknown) => {
            observer.disconnect()
            console.error(error)
            Page.renderError(error, this.labels)
        }

        const observer = new MutationObserver(() => {
            try {
                const newTime = this.read()
                if (isSameTime(newTime, time)) { return }

                time = newTime
                Promise.resolve(onChange(time)).catch(stop)
            } catch (error) {
                stop(error)
            }
        })
        observer.observe(document.querySelector(SELECTORS.main)!, { childList: true, subtree: true, characterData: true })
        return () => observer.disconnect()
    }

    /**
     * Replaces the gap with the error.
     * @param error - the error
     * @param labels - the labels in the language of the site
     */
    static renderError(error: unknown, labels: Labels): void {
        const summaryElement = document.querySelector(SELECTORS.summary)
        if (summaryElement) {
            summaryElement.querySelector(".improved-attendance-gap-container")?.remove()

            const errorElement = document.createElement("span")
            errorElement.className = "improved-attendance-gap-container"
            errorElement.title = error instanceof Error ? error.message : String(error)
            errorElement.textContent = labels.GAP_UNAVAILABLE
            summaryElement.prepend(errorElement)
        }
    }
}
