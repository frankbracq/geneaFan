import fanChartManager from './fanChart/fanChartManager.js';
import TimelineManager from './timeline/timelineManager.js';

// Tab configuration with their respective managers
const TAB_MANAGERS = {
    'tab1': {
        manager: fanChartManager,
        name: 'Fan Chart',
        enabled: true
    },
    'tab2': {
        manager: null, // Family Map - to be implemented
        name: 'Family Map',
        enabled: false
    },
    'tab3': {
        manager: null, // Family Tree - to be implemented
        name: 'Family Tree',
        enabled: false
    },
    'tab4': {
        manager: TimelineManager,
        name: 'Timeline',
        enabled: true
    }
};

/**
 * Initialize and manage application tabs
 */
export class TabManager {
    constructor() {
        this.currentTab = 'tab1';
        this.setupTabEventListeners();
    }

    /**
     * Set up event listeners for tab switching
     */
    setupTabEventListeners() {
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tabElement => {
            tabElement.addEventListener('show.bs.tab', (event) => {
                const targetTab = event.target.getAttribute('href').slice(1);
                this.handleTabChange(targetTab);
            });
        });
    }

    /**
     * Handle tab change events
     */
    async handleTabChange(newTabId) {
        // Cleanup current tab if needed
        const currentManager = TAB_MANAGERS[this.currentTab]?.manager;
        if (currentManager?.cleanup) {
            await currentManager.cleanup();
        }

        // Initialize new tab
        const newManager = TAB_MANAGERS[newTabId]?.manager;
        if (newManager?.initialize) {
            await newManager.initialize();
        }

        this.currentTab = newTabId;
    }
}

// Create singleton instance
export const tabManager = new TabManager();

/**
 * Initialize all enabled tabs
 */
export async function initializeTabs() {
    console.log('Tab initialization started');
    
    try {
        // Initialize fan chart (default tab)
        if (TAB_MANAGERS.tab1.enabled) {
            await fanChartManager.initialize();
        }
        
        // Initialize timeline
        if (TAB_MANAGERS.tab4.enabled) {
            new TimelineManager();
        }
        
        // Initialize tab manager
        tabManager.setupTabEventListeners();
        
        console.log('Tab initialization completed');
    } catch (error) {
        console.error("Error initializing tabs:", error);
        throw error;
    }
}