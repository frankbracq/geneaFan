import { makeAutoObservable, action, computed, reaction, runInAction } from '../../common/stores/mobx-config.js';
import timelineEventsStore from './timelineEventsStore.js';
import $ from 'jquery';
import rootPersonStore from '../../common/stores/rootPersonStore.js';

/**
 * Store responsible for managing the timeline visualization.
 * Automatically synchronizes with root person changes and manages the horizontal timeline display.
 */
class TimelineStore {
    // State management
    status = 'idle'; // 'idle' | 'loading' | 'success' | 'error'
    errorMessage = null;
    horizontalTimelineInstance = null;

    constructor() {
        makeAutoObservable(this, {
            initializeTimeline: action,
            setStatus: action,
            clearTimeline: action,
            updateTimelineForRoot: action,
            
            // Computed
            currentTimelineHTML: computed,
            isLoading: computed,
            hasError: computed,
            
            // Non-observables
            horizontalTimelineInstance: false,
        });

        // Réagir aux changements de root
        this.rootReactionDisposer = reaction(
            () => rootPersonStore.root,
            async (newRoot) => {
                if (newRoot) {
                    await this.updateTimelineForRoot();
                } else {
                    this.clearTimeline();
                }
            },
            {
                name: 'TimelineStore-RootChangeReaction'
            }
        );
    }

    // Computed properties
    get isLoading() {
        return this.status === 'loading';
    }

    get hasError() {
        return this.status === 'error';
    }

    get currentTimelineHTML() {
        return this.generateTimelineEvents();
    }

    // Actions
    setStatus(newStatus, error = null) {
        this.status = newStatus;
        this.errorMessage = error;

        if (process.env.NODE_ENV === 'development' && error) {
            console.error('Timeline error:', error);
        }
    }

    generateTimelineEvents() {
        if (!timelineEventsStore.hasEvents) return '';
        
        let eventsContentHTML = '<div class="events-content"><ol>';
        
        const eventTypes = [
            { 
                type: 'birth', 
                title: 'Naissances', 
                format: event => timelineEventsStore.formatEvent(event, 'birth') 
            },
            { 
                type: 'death', 
                title: 'Décès', 
                format: event => timelineEventsStore.formatEvent(event, 'death') 
            },
            { 
                type: 'marriage', 
                title: 'Mariages', 
                format: event => timelineEventsStore.formatEvent(event, 'marriage') 
            }
        ];

        const groupedEvents = timelineEventsStore.getGroupedEvents();
        for (const period in groupedEvents) {
            eventsContentHTML += `<li class="box" data-horizontal-timeline='{"date": "${period}"}'>`;

            eventTypes.forEach(({ type, title, format }) => {
                const events = groupedEvents[period][type] || [];
                if (events.length > 0) {
                    eventsContentHTML += `<h4>${title}</h4><ul class="text-start">`;
                    events.forEach(event => {
                        eventsContentHTML += `<li>${format(event)}</li>`;
                    });
                    eventsContentHTML += '</ul>';
                }
            });

            eventsContentHTML += '</li>';
        }

        eventsContentHTML += '</ol></div>';
        return eventsContentHTML;
    }

    async updateTimelineForRoot() {
        try {
            runInAction(() => {
                this.setStatus('loading');
            });

            if (timelineEventsStore.hasEvents) {
                // Mettre à jour le DOM avec le nouveau contenu
                const timelineElement = document.getElementById("ascendantTimeline");
                if (timelineElement) {
                    // Nettoyer l'instance précédente si elle existe
                    this.cleanupTimelineInstance();
                    
                    timelineElement.innerHTML = this.currentTimelineHTML;
                    // Réinitialiser la timeline horizontale
                    await this.initializeHorizontalTimeline();
                    this.setStatus('success');
                } else {
                    throw new Error('Timeline container not found');
                }
            } else {
                this.setStatus('success');
            }
        } catch (error) {
            runInAction(() => {
                this.setStatus('error', error.message);
            });
        }
    }

    async initializeHorizontalTimeline() {
        try {
            if (!window.jQuery) {
                window.$ = $;
                window.jQuery = $;
            }

            await import('./horizontalTimeline.js');

            this.horizontalTimelineInstance = $('#ascendantTimeline').horizontalTimeline({
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
                "exit": {
                    "left": "exit-left",
                    "right": "exit-right"
                },
                contentContainerSelector: false
            });
        } catch (error) {
            console.error('Failed to initialize horizontal timeline:', error);
            throw error;
        }
    }

    cleanupTimelineInstance() {
        if (this.horizontalTimelineInstance) {
            if (typeof this.horizontalTimelineInstance.destroy === 'function') {
                this.horizontalTimelineInstance.destroy();
            }
            this.horizontalTimelineInstance = null;
        }
    }

    clearTimeline() {
        this.cleanupTimelineInstance();
        
        runInAction(() => {
            this.setStatus('idle');
        });
        
        const timelineElement = document.getElementById("ascendantTimeline");
        if (timelineElement) {
            timelineElement.innerHTML = '';
        }
    }

    dispose() {
        if (this.rootReactionDisposer) {
            this.rootReactionDisposer();
        }
        this.clearTimeline();
    }
}

const timelineStore = new TimelineStore();
export default timelineStore;