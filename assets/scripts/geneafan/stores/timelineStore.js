import { makeAutoObservable, action, runInAction, computed } from './mobx-config.js';
import _ from 'lodash';
import moment from 'moment';

class TimelineStore {
    // Timeline state
    timelineInstance = null;
    isInitialized = false;
    periodSize = 5; // quinquennat by default

    // Events state with cached parsed dates
    ascendantEvents = [];
    parsedEventsCache = new Map(); // Cache for parsed dates

    constructor() {
        makeAutoObservable(this, {
            initializeTimeline: action,
            updateEvents: action,
            setTimelineInstance: action,
            setPeriodSize: action,
            destroyTimeline: action,
            addEvent: action,
            clearEvents: action,
            _formatEvent: action,
            _generateTimelineEvents: action,
            _getAncestorBranchAndGeneration: action,
            _parseDate: action,
            parsedEvents: computed,
            groupedEvents: computed,
            // Exclude cache from observations
            parsedEventsCache: false
        });
    }

    // Computed property for parsed events
    // Cette propriété computed ne sera recalculée que lorsque ascendantEvents change
    get parsedEvents() {
        return this.ascendantEvents.map(event => {
            // Vérifier si la date est déjà dans le cache
            if (!this.parsedEventsCache.has(event.date)) {
                const parsedDate = this._parseDate(event.date);
                if (parsedDate.isValid()) {
                    this.parsedEventsCache.set(event.date, parsedDate);
                } else {
                    this.parsedEventsCache.set(event.date, null);
                }
            }
            
            const parsedDate = this.parsedEventsCache.get(event.date);
            return parsedDate ? { ...event, parsedDate } : null;
        }).filter(event => event !== null);
    }

    // Computed property for grouped events
    // Ne sera recalculé que lorsque parsedEvents ou periodSize changent
    get groupedEvents() {
        // Sort events by date (using cached parsed dates)
        const sortedEvents = _.sortBy(this.parsedEvents, event => event.parsedDate.toISOString());

        // Group events by the specified number of years
        const groupedByYears = _.groupBy(sortedEvents, event => {
            const yearStart = Math.floor(event.parsedDate.year() / this.periodSize) * this.periodSize;
            return `01/01/${yearStart}`;
        });

        // Further group by event type within each year group
        return _.mapValues(groupedByYears, eventsByDate => _.groupBy(eventsByDate, 'type'));
    }

    _parseDate = (dateString) => {
        const formats = [
            "DD/MM/YYYY",
            "MM/YYYY",
            "YYYY"
        ];
        return moment(dateString, formats);
    }

    // Event management methods
    addEvent = action((event) => {
        if (event.eventId && this.ascendantEvents.some(e => e.eventId === event.eventId)) {
            return;
        }
        this.ascendantEvents.push(event);
    })

    clearEvents = action(() => {
        this.ascendantEvents = [];
        this.parsedEventsCache.clear(); // Clear the cache when events are cleared
    })

    setPeriodSize = action((size) => {
        if (this.periodSize === size) return; // Avoid unnecessary updates
        
        this.periodSize = size;
        if (this.ascendantEvents.length > 0 && this.isInitialized) {
            const timelineHTML = this._generateTimelineEvents();
            const timelineContainer = document.getElementById("ascendantTimeline");
            if (timelineContainer) {
                timelineContainer.innerHTML = timelineHTML;
            }
        }
    })

    // Timeline initialization and management
    initializeTimeline = async () => {
        try {
            // Dynamically load jQuery
            const jQueryModule = await import('jquery');
            const $ = jQueryModule.default;
            window.$ = $;
            window.jQuery = $;

            // Load horizontalTimeline after jQuery
            await import('../timeline/horizontalTimeline.js');

            // Generate timeline HTML
            const timelineHTML = this._generateTimelineEvents();
            const timelineContainer = document.getElementById("ascendantTimeline");
            if (!timelineContainer) {
                throw new Error("Timeline container not found");
            }

            timelineContainer.innerHTML = timelineHTML;

            // Initialize horizontal timeline with configuration
            const timelineInstance = $('#ascendantTimeline').horizontalTimeline({
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

            runInAction(() => {
                this.timelineInstance = timelineInstance;
                this.isInitialized = true;
            });

        } catch (error) {
            console.error("Failed to initialize timeline:", error);
            throw error;
        }
    }

    destroyTimeline = action(() => {
        if (this.timelineInstance) {
            this.timelineInstance.destroy?.();
            this.timelineInstance = null;
        }
        this.isInitialized = false;
    })

    // Helper methods for event formatting and display
    _formatEvent = (event, eventType) => {
        if (event.sosa) {
            const ancestorInfo = this._getAncestorBranchAndGeneration(event.sosa);
            const color = ancestorInfo.branch === 'paternal' ? 'darkblue' : 'deeppink';
            return `${event.name} (${event.date}) at ${event.town} <span style="color: ${color}">(+ ${ancestorInfo.generation} generations up)</span>`;
        }

        switch(eventType) {
            case 'birth':
                return `${event.name} (${event.date}) at ${event.town}`;
            case 'death':
                return `${event.name} (${event.date}) at the age of ${event.age} at ${event.town}`;
            case 'marriage':
                return `${event.name} (${event.date}) with ${event.spouse} at ${event.town}`;
            default:
                return `${event.name} (${event.date}) at ${event.town}`;
        }
    }

    _generateTimelineEvents = () => {
        let eventsContentHTML = '<div class="events-content"><ol>';

        const eventTypes = [
            { type: 'birth', title: 'Naissances' },
            { type: 'death', title: 'Décès' },
            { type: 'marriage', title: 'Mariages' }
        ];

        const groupedEvents = this.groupedEvents;
        for (const period in groupedEvents) {
            eventsContentHTML += `<li class="box" data-horizontal-timeline='{"date": "${period}"}'>`;

            eventTypes.forEach(({ type, title }) => {
                const events = groupedEvents[period][type] || [];
                if (events.length > 0) {
                    eventsContentHTML += `<h4>${title}</h4><ul class="text-start">`;
                    events.forEach(event => {
                        eventsContentHTML += `<li>${this._formatEvent(event, type)}</li>`;
                    });
                    eventsContentHTML += '</ul>';
                }
            });

            eventsContentHTML += '</li>';
        }

        eventsContentHTML += '</ol></div>';
        return eventsContentHTML;
    }

    _getAncestorBranchAndGeneration = (sosaNumber) => {
        const binaryRep = sosaNumber.toString(2);
        const generation = binaryRep.length - 1;
        const firstBit = binaryRep[1];

        return {
            branch: firstBit === '0' ? 'paternal' : 'maternal',
            generation: generation
        };
    }
}

const timelineStore = new TimelineStore();
export default timelineStore;