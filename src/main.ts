import { EXTENSION_NAME } from "./constants"
import { getLabels, loadLang, type Labels } from "./labels"
import { Attendance } from "./models/attendance"
import { MonthPlan, type MonthTime } from "./models/month-plan/month-plan"
import PAGE_STYLE from "./ui/styles/page.css"
import SETTINGS_STYLE from "./ui/styles/settings.css"
import SIDEBAR_TOGGLE_STYLE from "./ui/styles/sidebar-toggle.css"
import SITE_DARK_STYLE from "./ui/styles/site-dark.css"
import THEME_STYLE from "./ui/styles/theme.css"
import THEME_SWITCH_STYLE from "./ui/styles/theme-switch.css"
import { Page } from "./ui/page"
import { Settings } from "./ui/settings"
import { SidebarToggle } from "./ui/sidebar-toggle"
import { ThemeSwitch } from "./ui/theme-switch"

const PRESENCE_FETCH_INTERVAL_MINUTES = 1
const PRESENCE_FETCH_LIMIT = 3

const SELECTORS = {
    routeAnnouncer: "#svelte-announcer",
}

interface StartMonthImprovementsOptions {
    /** The `Settings` object. */
    settings: Settings
    /** The labels in the language of the site. */
    labels: Labels
    /** Returns whether another month was shown since the start. */
    isOutdated: () => boolean
}

/**
 * Calls `onChange` each time the query of the URL changes.
 * @param onChange - called when the site shows another month
 */
function watchUrl(onChange: () => void): void {
    let search = location.search

    new MutationObserver(() => {
        if (location.search === search) { return }
        search = location.search
        onChange()
    }).observe(document.body, { childList: true, subtree: true })
}

/** Resolves once Svelte has hydrated the page. */
function waitForHydration(): Promise<void> {
    // SvelteKit adds its route announcer once the page is hydrated.
    const isHydrated = () => document.querySelector(SELECTORS.routeAnnouncer) !== null

    return new Promise((resolve) => {
        if (isHydrated()) {
            resolve()
            return
        }

        const observer = new MutationObserver(() => {
            if (!isHydrated()) { return }
            observer.disconnect()
            resolve()
        })
        observer.observe(document.body, { childList: true, subtree: true })
    })
}

/** Starts the improvements of the month, and returns a function that stops them. */
async function startMonthImprovements({ settings, labels, isOutdated }: StartMonthImprovementsOptions): Promise<() => void> {
    let attendance = await Attendance.fetch(labels)
    if (isOutdated()) { return () => {} }
    let presenceFetchCount = 0
    let presenceFetchTimestamp = 0

    const plan = MonthPlan.load(attendance)
    const page = new Page(labels)
    page.mount()

    const renderMonth = (time: MonthTime) => {
        page.render({ plan, time, attendance, isEndTodayShown: presenceFetchCount < PRESENCE_FETCH_LIMIT })
        settings.setPlannedDays(plan)
        settings.setRecommendedDailyTime(plan, time)
    }

    const time = page.read()
    if (plan.isCurrentMonth()) {
        plan.sync({
            availableCapsules: attendance.availableCapsules,
            monthGoalMinutes: time.monthGoalMinutes,
        })
        plan.save()
    }

    settings.render({
        plan,
        attendance,
        onChange: () => {
            plan.save()
            renderMonth(page.read())
        },
    })
    renderMonth(time)

    return page.watch(async (time) => {
        const isPresenceOutdated = time.isSessionRunning !== attendance.hasRunningPresence()
        const isPresenceFetchNeeded = isPresenceOutdated && presenceFetchCount < PRESENCE_FETCH_LIMIT
            && Date.now() - presenceFetchTimestamp >= PRESENCE_FETCH_INTERVAL_MINUTES * 60 * 1000
        const isGoalChanged = plan.isCurrentMonth() && time.monthGoalMinutes !== plan.lastSync?.monthGoalMinutes

        if (isPresenceFetchNeeded) {
            presenceFetchCount++
            presenceFetchTimestamp = Date.now()
        }
        if (isPresenceFetchNeeded || isGoalChanged) {
            attendance = await Attendance.fetch(labels)
        }

        if (time.isSessionRunning === attendance.hasRunningPresence()) {
            presenceFetchCount = 0
        } else if (isPresenceFetchNeeded && presenceFetchCount === PRESENCE_FETCH_LIMIT) {
            console.warn(`${EXTENSION_NAME}: ${labels.WARNING_PRESENCES_OUTDATED}`)
        }

        if (isGoalChanged) {
            plan.sync({
                availableCapsules: attendance.availableCapsules,
                monthGoalMinutes: time.monthGoalMinutes,
            })
            plan.save()
            settings.setCapsules(plan, attendance.availableCapsules)
        }
        renderMonth(time)
    })
}

function main(): void {
    const styleElement = document.createElement("style")
    styleElement.textContent = PAGE_STYLE + SETTINGS_STYLE + THEME_SWITCH_STYLE + SIDEBAR_TOGGLE_STYLE + THEME_STYLE + SITE_DARK_STYLE
    document.head.append(styleElement)

    const lang = loadLang()
    const labels = getLabels(lang)

    const themeSwitch = new ThemeSwitch(labels)
    themeSwitch.mount()

    const sidebarToggle = new SidebarToggle(labels)

    const settings = new Settings({ lang, labels, themeSwitchElement: themeSwitch.rootElement })
    let isSettingsMounted = false

    let lastRun = 0
    let stopMonthImprovements = () => {}

    const restartMonthImprovements = () => requestAnimationFrame(() => {
        const run = ++lastRun
        const isOutdated = () => run !== lastRun

        stopMonthImprovements()
        startMonthImprovements({ settings, labels, isOutdated })
            .then((stop) => {
                if (isOutdated()) {
                    stop()
                    return
                }
                stopMonthImprovements = stop
            })
            .catch((error) => {
                if (isOutdated()) { return }
                console.error(error)
                Page.renderError(error, labels)
            })
            .finally(() => {
                // Mounted once, with the plan of the month.
                if (isSettingsMounted) { return }
                isSettingsMounted = true
                settings.mount()
            })
    })

    waitForHydration().then(() => {
        restartMonthImprovements()
        watchUrl(restartMonthImprovements)
        // Mounted once the site is hydrated, as the button goes into its header.
        sidebarToggle.mount()
    })
}

main()
