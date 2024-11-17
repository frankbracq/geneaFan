import timelineStore from '../stores/timelineStore.js';
import rootPersonStore from '../stores/rootPersonStore.js';
import { reaction } from '../stores/mobx-config.js';

class TimelineManager {
    constructor() {
        this.timelineTab = document.querySelector('a[href="#tab4"]');
        this.timelineContainer = document.getElementById('ascendantTimeline');
        this.setupReactions();
        this.setupTabListeners();
    }

    setupReactions() {
        // React to root person changes
        reaction(
            () => rootPersonStore.root,
            (root) => {
                if (root) {
                    this.enableTimelineTab();
                } else {
                    this.disableTimelineTab();
                }
            }
        );

        // React to timeline status changes
        reaction(
            () => timelineStore.status,
            (status) => {
                if (status === 'success') {
                    this.enableTimelineTab();
                } else if (status === 'error') {
                    this.disableTimelineTab();
                }
            }
        );
    }

    setupTabListeners() {
        // Initialize timeline when tab becomes visible
        this.timelineTab?.addEventListener('shown.bs.tab', async () => {
            if (timelineStore.status !== 'success') {
                await timelineStore.updateTimelineForRoot();
            }
            
            // Force resize after tab is shown to ensure proper rendering
            if (timelineStore.horizontalTimelineInstance) {
                window.dispatchEvent(new Event('resize'));
            }
        });
    }

    enableTimelineTab() {
        if (this.timelineTab) {
            this.timelineTab.classList.remove('disabled');
        }
    }

    disableTimelineTab() {
        if (this.timelineTab) {
            this.timelineTab.classList.add('disabled');
        }
    }

    // Clean up method
    destroy() {
        timelineStore.dispose();
        this.timelineTab?.removeEventListener('shown.bs.tab');
    }
}

// Initialize the timeline manager when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.timelineManager = new TimelineManager();
});

export default TimelineManager;