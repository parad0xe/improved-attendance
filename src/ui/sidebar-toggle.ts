import type { Labels } from "../labels"

const SELECTORS = {
    sidebar: "[data-slot='sidebar']",
    headerButtons: "[data-slot='sidebar-inset'] main > div > div",
}

/** Renders the button that shows or hides the sidebar of the site. */
export class SidebarToggle {
    readonly rootElement: HTMLButtonElement

    isSidebarHidden: boolean

    /**
     * Creates the button with the sidebar shown.
     * @param labels - the labels in the language of the site
     */
    constructor(labels: Labels) {
        this.isSidebarHidden = false

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
            this.render()
        })
    }

    /** Adds the button to the header of the page, and keeps it there. */
    mount(): void {
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
        const sidebarElement = document.querySelector<HTMLElement>(SELECTORS.sidebar)
        sidebarElement?.classList.toggle("improved-attendance-sidebar-hidden", this.isSidebarHidden)
        if (sidebarElement) { sidebarElement.inert = this.isSidebarHidden }
        this.rootElement.setAttribute("aria-pressed", String(this.isSidebarHidden))
    }
}
