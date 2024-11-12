import timelineStore from '../stores/timelineStore';

// Constants for configuration
const TIMELINE_CONFIG = {
    dateIntervals: {
        "desktop": 175,
        "tablet": 150,
        "mobile": 120,
        "minimal": true
    },
    iconClass: {
        "base": "fas fa-2x",
        "scrollLeft": "fa-chevron-circle-left",
        "scrollRight": "fa-chevron-circle-right",
        "prev": "fa-arrow-circle-left",
        "next": "fa-arrow-circle-right",
        "pause": "fa-pause-circle",
        "play": "fa-play-circle"
    },
    exit: {
        "left": "exit-left",
        "right": "exit-right"
    },
    contentContainerSelector: false
};

// Main initialization function
export async function initializeAscendantTimeline() {
    try {
        // Dynamically load jQuery module
        const jQueryModule = await import('jquery');
        const $ = jQueryModule.default;
        window.$ = $;
        window.jQuery = $;

        // Load horizontalTimeline after jQuery is available
        await import('./horizontalTimeline.js');

        // Get the timeline container
        const timelineContainer = document.getElementById("ascendantTimeline");
        if (!timelineContainer) {
            throw new Error("Timeline container not found");
        }

        // Initialize the timeline in the store
        await timelineStore.initializeTimeline();

        // Initialize jQuery horizontal timeline with configuration
        $(timelineContainer).horizontalTimeline(TIMELINE_CONFIG);

    } catch (error) {
        console.error('Failed to initialize timeline:', error);
        throw error;
    }
}

// Cleanup function if needed
export function destroyAscendantTimeline() {
    timelineStore.destroyTimeline();
}

// Utility function to update period size
export function updateTimelinePeriodSize(newSize) {
    timelineStore.setPeriodSize(newSize);
}