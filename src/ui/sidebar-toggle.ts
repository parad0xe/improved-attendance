import type { Labels } from "../labels"

const SIDEBAR_STORAGE_KEY = "improved-attendance-sidebar-hidden"
const UNLOCK_CLICKS = 5
const LOCK_CLICKS = 10

const SELECTORS = {
    sidebar: "[data-slot='sidebar']:not([data-mobile])",
    headerButtons: "[data-slot='sidebar-inset'] main > div > div",
    headerTitle: "[data-slot='sidebar-header'] h1 span",
    headerVersion: "[data-slot='sidebar-header'] h1 + div",
}

/** Renders the button that shows or hides the sidebar of the site. */
export class SidebarToggle {
    /** The number of clicks on the version since the page was loaded. */
    private versionClicks: number

    readonly rootElement: HTMLButtonElement

    isSidebarHidden: boolean
    /** Whether the state of the sidebar is saved. */
    isUnlocked: boolean

    /**
     * Creates the button with the saved state of the sidebar.
     * @param labels - the labels in the language of the site
     */
    constructor(labels: Labels) {
        this.versionClicks = 0
        this.isSidebarHidden = false
        this.isUnlocked = false

        this.rootElement = document.createElement("button")
        this.rootElement.type = "button"
        this.rootElement.className = "improved-attendance-sidebar-toggle"
        this.rootElement.title = labels.SIDEBAR_TOGGLE
        this.rootElement.setAttribute("aria-label", labels.SIDEBAR_TOGGLE)

        this.rootElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/></svg>
        `

        this.rootElement.addEventListener("click", () => {
            this.isSidebarHidden = !this.isSidebarHidden
            if (this.isUnlocked) {
                this.save()
            }
            this.render()
        })

        // Applied before the site is hydrated, and without the transition of the sidebar.
        this.load()
        document.documentElement.classList.add("improved-attendance-sidebar-instant")
        document.documentElement.classList.toggle("improved-attendance-sidebar-hidden", this.isSidebarHidden)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.documentElement.classList.remove("improved-attendance-sidebar-instant")
            })
        })
    }

    /** Adds the button to the header of the page, and keeps it there. */
    mount(): void {
        document.addEventListener("click", (event) => {
            if (!(event.target instanceof Element) || !event.target.closest(SELECTORS.headerVersion)) { return }

            this.versionClicks++
            if (this.versionClicks === UNLOCK_CLICKS) {
                this.isUnlocked = true
                this.save()
            } else if (this.versionClicks === LOCK_CLICKS) {
                this.reset()
            }
            this.render()
        })

        // The site can render the header and the sidebar again.
        const attach = () => {
            const sidebarElement = document.querySelector(SELECTORS.sidebar)
            const headerButtonsElement = document.querySelector(SELECTORS.headerButtons)
            if (sidebarElement && headerButtonsElement && !headerButtonsElement.contains(this.rootElement)) {
                headerButtonsElement.prepend(this.rootElement)
            }
            this.render()
        }
        attach()
        new MutationObserver(attach).observe(document.body, { childList: true, subtree: true })
    }

    /** Renders the state of the sidebar on the page and on the button. */
    private render(): void {
        document.documentElement.classList.toggle("improved-attendance-sidebar-hidden", this.isSidebarHidden)
        const sidebarElement = document.querySelector<HTMLElement>(SELECTORS.sidebar)
        if (sidebarElement) { sidebarElement.inert = this.isSidebarHidden }
        document.querySelector(SELECTORS.headerTitle)?.classList.toggle("improved-attendance-unlocked", this.versionClicks >= UNLOCK_CLICKS)
        this.rootElement.setAttribute("aria-pressed", String(this.isSidebarHidden))
    }

    /** Applies the saved state of the sidebar. */
    private load(): void {
        try {
            const storedValue = localStorage.getItem(SIDEBAR_STORAGE_KEY)
            if (storedValue === null) { return }
            if (storedValue !== "true" && storedValue !== "false") {
                this.reset()
                return
            }
            this.isUnlocked = true
            this.isSidebarHidden = storedValue === "true"
        } catch {
            this.reset()
        }
    }

    /** Saves the state of the sidebar. */
    private save(): void {
        try {
            localStorage.setItem(SIDEBAR_STORAGE_KEY, String(this.isSidebarHidden))
        } catch {
            this.reset()
        }
    }

    /** Shows the sidebar, and stops saving its state. */
    private reset(): void {
        this.versionClicks = 0
        this.isUnlocked = false
        this.isSidebarHidden = false
        try {
            localStorage.removeItem(SIDEBAR_STORAGE_KEY)
        } catch {
            // The storage can be unavailable.
        }
    }
}
