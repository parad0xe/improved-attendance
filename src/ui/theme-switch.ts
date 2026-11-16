import type { Labels } from "../labels"

const THEME_STORAGE_KEY = "improved-attendance-theme"

type Theme = "light" | "dark"

/** Returns the theme to apply. */
function loadTheme(): Theme {
    try {
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
        if (storedTheme !== null) {
            return storedTheme === "dark" ? "dark" : "light"
        }
    } catch {
        // The storage can be unavailable.
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/**
 * Saves the theme chosen.
 * @param theme - the theme to save
 */
function saveTheme(theme: Theme): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
        // The storage can be unavailable.
    }
}

/** Renders the theme switch, and applies the chosen theme to the page. */
export class ThemeSwitch {
    private readonly switchElement: HTMLButtonElement

    readonly rootElement: HTMLElement

    theme: Theme

    /**
     * Creates the switch with the theme chosen.
     * @param labels - the labels in the language of the site
     */
    constructor(labels: Labels) {
        this.theme = loadTheme()

        this.rootElement = document.createElement("div")
        this.rootElement.className = "improved-attendance-settings-row"
        this.rootElement.textContent = labels.SETTINGS_THEME

        this.switchElement = document.createElement("button")
        this.switchElement.type = "button"
        this.switchElement.className = "improved-attendance-settings-theme-switch"
        this.switchElement.title = labels.SETTINGS_THEME
        this.switchElement.setAttribute("aria-label", labels.SETTINGS_THEME)

        // The sun and the moon of Lucide (ISC license).
        this.switchElement.innerHTML = `
            <svg class="improved-attendance-settings-theme-sun" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            <svg class="improved-attendance-settings-theme-moon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>
        `

        this.switchElement.addEventListener("click", () => {
            this.theme = this.theme === "dark" ? "light" : "dark"
            saveTheme(this.theme)
            this.render()
        })
        this.rootElement.append(this.switchElement)
    }

    /** Applies the chosen theme to the page, and keeps it applied. */
    mount(): void {
        this.render()
        new MutationObserver(() => this.render()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    }

    /** Renders the chosen theme on the page and on the switch. */
    private render(): void {
        const isDark = this.theme === "dark"
        if (document.documentElement.classList.contains("dark") !== isDark) {
            document.documentElement.classList.toggle("dark", isDark)
        }
        this.switchElement.setAttribute("aria-pressed", String(isDark))
    }
}
