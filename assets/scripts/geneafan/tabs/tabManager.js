import fanChartManager from './fanChart/fanChartManager.js';
import configStore from './fanChart/fanConfigStore.js';
import TimelineManager from './timeline/timelineManager.js';
import { googleMapsStore } from './familyMap/googleMapsStore.js';
import { Offcanvas } from 'bootstrap';

// Tab configuration with their respective managers
const TAB_MANAGERS = {
    'tab1': {
        manager: fanChartManager,
        name: 'Fan Chart',
        enabled: true,
        onShow: () => {
            configStore.handleSettingChange();
        }
    },
    'tab2': {
        manager: null,
        name: 'Family Map',
        enabled: false,
        onShow: () => {
            if (googleMapsStore.map) {
                googleMapsStore.moveMapToContainer("tab2");
                googleMapsStore.activateMapMarkers();
                google.maps.event.trigger(googleMapsStore.map, "resize");
                googleMapsStore.map.setCenter({ lat: 46.2276, lng: 2.2137 });
            }
        }
    },
    'tab3': {
        manager: null,
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
        this.setupParameterPanels();
    }

    /**
     * Set up event listeners for tab switching
     */
    setupTabEventListeners() {
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tabElement => {
            const tabId = tabElement.getAttribute('href').slice(1);
            tabElement.addEventListener('show.bs.tab', (event) => {
                this.handleTabChange(tabId);
            });

            // Add shown.bs.tab listener if tab has onShow handler
            if (TAB_MANAGERS[tabId]?.onShow) {
                tabElement.addEventListener('shown.bs.tab', TAB_MANAGERS[tabId].onShow);
            }
        });
    }

    /**
     * Set up parameter panels for fan and tree views
     */
    setupParameterPanels() {
        document.getElementById("fanParametersDisplay")?.addEventListener("click", () => {
            new Offcanvas(document.getElementById("fanParameters")).show();
        });

        document.getElementById("treeParametersDisplay")?.addEventListener("click", () => {
            new Offcanvas(document.getElementById("treeParameters")).show();
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