import timelineStore from './timelineStore.js';
import rootPersonStore from '../../common/stores/rootPersonStore.js';
import { reaction } from '../../common/stores/mobx-config.js';

class TimelineManager {
    constructor() {
        console.group('🔄 Initializing TimelineManager');
        
        // Sélection des éléments DOM
        this.timelineTab = document.querySelector('a[href="#tab4"]');
        console.log('Timeline tab selector:', 'a[href="#tab4"]');
        console.log('Timeline tab element found:', !!this.timelineTab);
        if (this.timelineTab) {
            console.log('Timeline tab element:', this.timelineTab.outerHTML);
        }
        
        this.timelineContainer = document.getElementById('ascendantTimeline');
        console.log('Timeline container found:', !!this.timelineContainer);
        
        // Configuration des réactions et écouteurs
        this.setupReactions();
        this.setupTabListeners();
        
        console.groupEnd();
    }

    setupReactions() {
        console.group('⚡ Setting up timeline reactions');
        
        // React to root person changes
        reaction(
            () => rootPersonStore.root,
            (root) => {
                console.log('Root changed:', root);
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
                console.log('Timeline status changed:', status);
                if (status === 'success') {
                    this.enableTimelineTab();
                } else if (status === 'error') {
                    this.disableTimelineTab();
                }
            }
        );
        
        console.log('✅ Timeline reactions setup complete');
        console.groupEnd();
    }

    setupTabListeners() {
        console.group('🎧 Setting up timeline tab listeners');
        
        // Vérification de l'élément tab
        if (!this.timelineTab) {
            console.error('❌ Cannot setup listeners - Timeline tab element not found!');
            console.groupEnd();
            return;
        }

        // Ajout de l'écouteur d'événement
        this.timelineTab.addEventListener('shown.bs.tab', async (event) => {
            console.group('📊 Timeline tab shown event triggered');
            console.log('Event details:', event);
            console.log('Current timeline status:', timelineStore.status);
            
            try {
                if (timelineStore.status !== 'success') {
                    console.log('🔄 Initiating timeline update');
                    await timelineStore.updateTimelineForRoot();
                    console.log('✅ Timeline update completed');
                } else {
                    console.log('ℹ️ Timeline already in success state');
                }
                
                if (timelineStore.horizontalTimelineInstance) {
                    console.log('📏 Triggering resize event');
                    window.dispatchEvent(new Event('resize'));
                }
            } catch (error) {
                console.error('❌ Error updating timeline:', error);
            }
            
            console.groupEnd();
        });
        
        console.log('✅ Timeline tab listeners setup complete');
        console.groupEnd();
    }

    enableTimelineTab() {
        console.log('🔓 Enabling timeline tab');
        if (this.timelineTab) {
            this.timelineTab.classList.remove('disabled');
        }
    }

    disableTimelineTab() {
        console.log('🔒 Disabling timeline tab');
        if (this.timelineTab) {
            this.timelineTab.classList.add('disabled');
        }
    }

    async updateTimelineForRoot() {
        return timelineStore.updateTimelineForRoot();
    }

    // Clean up method
    destroy() {
        console.log('🧹 Cleaning up TimelineManager');
        timelineStore.dispose();
        if (this.timelineTab) {
            this.timelineTab.removeEventListener('shown.bs.tab');
        }
    }
}

// Export instance
const timelineManager = new TimelineManager();
export { timelineManager, TimelineManager };