import type { Labels } from "../labels"

const DASHBOARD_PATH = "/me"

const SELECTORS = {
    absencesLink: "[data-slot='sidebar-group-content'] a[href='/me/absences']",
    groupContent: "[data-slot='sidebar-group-content']",
}

/** Renders the link to the dashboard in the sidebar of the site. */
export class DashboardLink {
    private readonly labels: Labels
    /** The block of the link to the dashboard, copied from the block of the link to the absences. */
    private blockElement: HTMLElement | null

    /**
     * Creates the link.
     * @param labels - the labels in the language of the site
     */
    constructor(labels: Labels) {
        this.labels = labels
        this.blockElement = null
    }

    /** Adds the block of the link before the block of the link to the absences, and keeps it there. */
    mount(): void {
        // The site can render the sidebar again.
        const attach = () => {
            const absencesLinkElement = document.querySelector<HTMLAnchorElement>(SELECTORS.absencesLink)
            const absencesBlockElement = absencesLinkElement?.closest<HTMLElement>(SELECTORS.groupContent)
            if (absencesLinkElement && absencesBlockElement && !this.blockElement?.isConnected) {
                this.blockElement = this.createBlockElement(absencesBlockElement, absencesLinkElement)
                absencesBlockElement.before(this.blockElement)
            }

            const linkElement = this.blockElement?.querySelector("a")
            if (linkElement) {
                linkElement.dataset.active = String(location.pathname === DASHBOARD_PATH)
            }
        }
        attach()
        new MutationObserver(attach).observe(document.body, { childList: true, subtree: true })
    }

    /**
     * Returns a copy of the block of the link to the absences, with a link to the dashboard.
     * @param absencesBlockElement - the block of the link to the absences
     * @param absencesLinkElement - the link to the absences
     */
    private createBlockElement(absencesBlockElement: HTMLElement, absencesLinkElement: HTMLAnchorElement): HTMLElement {
        const blockElement = absencesBlockElement.cloneNode(false) as HTMLElement
        const linkElement = absencesLinkElement.cloneNode(true) as HTMLAnchorElement
        linkElement.setAttribute("href", DASHBOARD_PATH)
        blockElement.append(linkElement)

        const iconElement = linkElement.querySelector("svg")
        if (iconElement) {
            iconElement.classList.replace("lucide-calendar-x", "lucide-layout-dashboard")
            iconElement.innerHTML = `<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>`
        }

        const textElement = linkElement.querySelector("span")
        if (textElement) {
            textElement.textContent = this.labels.SIDEBAR_DASHBOARD
        }

        return blockElement
    }
}
