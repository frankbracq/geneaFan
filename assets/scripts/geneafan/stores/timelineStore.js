import { makeAutoObservable, action, runInAction, computed } from './mobx-config.js';
import _ from 'lodash';
import moment from 'moment';

class TimelineStore {
    // Observable state
    timelineInstance = null;
    isInitialized = false;
    periodSize = 5;
    ascendantEvents = [];
    parsedEventsCache = new Map();
    placeholderDate = moment().format('DD/MM/YYYY');
    
    constructor() {
        makeAutoObservable(this, {
            // Actions
            initializeTimeline: action,
            destroyTimeline: action,
            addEvent: action,
            addEvents: action,
            clearEvents: action,
            setPeriodSize: action,
            updateTimelineContent: action,
            
            // Computeds
            parsedEvents: computed,
            groupedEvents: computed,
            eventsByType: computed,
            timelineEventsHTML: computed,
            hasEvents: computed,
            
            // Non-observable properties
            parsedEventsCache: false,
            _formatEvent: false,
            _getAncestorBranchAndGeneration: false,
            _parseDate: false
        });
    }

    // Computed properties
    get hasEvents() {
        return this.parsedEvents.length > 0;
    }

    get parsedEvents() {
        return this.ascendantEvents.map(event => {
            if (!this.parsedEventsCache.has(event.date)) {
                const parsedDate = this._parseDate(event.date);
                this.parsedEventsCache.set(event.date, parsedDate.isValid() ? parsedDate : null);
            }
            
            const parsedDate = this.parsedEventsCache.get(event.date);
            return parsedDate ? { ...event, parsedDate } : null;
        }).filter(Boolean);
    }

    get groupedEvents() {
        if (!this.hasEvents) return {};

        const sortedEvents = _.sortBy(this.parsedEvents, event => 
            event.parsedDate.toISOString()
        );

        const eventsByPeriod = _.groupBy(sortedEvents, event => {
            const yearStart = Math.floor(event.parsedDate.year() / this.periodSize) * this.periodSize;
            return `01/01/${yearStart}`;
        });

        return _.mapValues(eventsByPeriod, periodEvents => 
            _.groupBy(periodEvents, 'type')
        );
    }

    get eventsByType() {
        return _.groupBy(this.parsedEvents, 'type');
    }

    get timelineEventsHTML() {
        if (!this.hasEvents) {
            return `<div class="events-content">
                <ol>
                    <li class="selected" data-horizontal-timeline='{"date": "${this.placeholderDate}"}'>
                        <h2>Aucun événement</h2>
                        <em>Sélectionnez un autre individu pour voir ses événements</em>
                    </li>
                </ol>
            </div>`;
        }

        const eventTypes = [
            { type: 'birth', title: 'Naissances' },
            { type: 'death', title: 'Décès' },
            { type: 'marriage', title: 'Mariages' }
        ];

        const groupedHtml = Object.entries(this.groupedEvents).reduce((html, [period, eventsByType]) => {
            const eventsHTML = eventTypes
                .map(({ type, title }) => {
                    const events = eventsByType[type] || [];
                    if (!events.length) return '';
                    
                    const eventsListHTML = events
                        .map(event => `<li>${this._formatEvent(event, type)}</li>`)
                        .join('');
                        
                    return `<h4>${title}</h4><ul class="text-start">${eventsListHTML}</ul>`;
                })
                .join('');

            return html + `
                <li class="box" data-horizontal-timeline='{"date": "${period}"}'>
                    ${eventsHTML}
                </li>`;
        }, '<div class="events-content"><ol>');

        return groupedHtml + '</ol></div>';
    }

    // Actions
    initializeTimeline = async () => {
        try {
            const { default: $ } = await import('jquery');
            window.$ = window.jQuery = $;
            await import('../timeline/horizontalTimeline.js');

            const timelineContainer = document.getElementById("ascendantTimeline");
            if (!timelineContainer) throw new Error("Timeline container not found");

            timelineContainer.innerHTML = this.timelineEventsHTML;

            runInAction(() => {
                this.timelineInstance = $('#ascendantTimeline').horizontalTimeline({
                    dateIntervals: {
                        desktop: 175,
                        tablet: 150,
                        mobile: 120,
                        minimal: true
                    },
                    iconClass: {
                        base: "fas fa-2x",
                        scrollLeft: "fa-chevron-circle-left",
                        scrollRight: "fa-chevron-circle-right",
                        prev: "fa-arrow-circle-left",
                        next: "fa-arrow-circle-right",
                        pause: "fa-pause-circle",
                        play: "fa-play-circle"
                    },
                    exit: {
                        left: "exit-left",
                        right: "exit-right"
                    },
                    contentContainerSelector: false
                });
                this.isInitialized = true;
            });

            if (this.hasEvents) {
                timelineContainer.classList.remove('empty-timeline');
            } else {
                timelineContainer.classList.add('empty-timeline');
            }

        } catch (error) {
            console.error("Failed to initialize timeline:", error);
            throw error;
        }
    }

    updateTimelineContent = action(() => {
        if (!this.isInitialized) return;

        const timelineContainer = document.getElementById("ascendantTimeline");
        if (!timelineContainer) return;

        if (this.timelineInstance?.destroy) {
            this.timelineInstance.destroy();
            this.timelineInstance = null;
        }

        timelineContainer.innerHTML = this.timelineEventsHTML;

        runInAction(() => {
            this.initializeTimeline();
        });
    })

    addEvent = action((event) => {
        if (!event?.eventId || this.ascendantEvents.some(e => e.eventId === event.eventId)) {
            return;
        }
        this.ascendantEvents.push(event);
        this.updateTimelineContent();
    })

    addEvents = action((events) => {
        const newEvents = events.filter(event => 
            event?.eventId && !this.ascendantEvents.some(e => e.eventId === event.eventId)
        );
        if (newEvents.length > 0) {
            this.ascendantEvents.push(...newEvents);
            this.updateTimelineContent();
        }
    })

    clearEvents = action(() => {
        this.ascendantEvents = [];
        this.parsedEventsCache.clear();
        this.updateTimelineContent();
    })

    setPeriodSize = action((size) => {
        if (this.periodSize === size) return;
        
        this.periodSize = size;
        if (this.isInitialized) {
            this.updateTimelineContent();
        }
    })

    destroyTimeline = action(() => {
        if (this.timelineInstance?.destroy) {
            this.timelineInstance.destroy();
            this.timelineInstance = null;
        }
        this.isInitialized = false;
        this.clearEvents();
    })

    // Private methods
    _parseDate = (dateString) => {
        return moment(dateString, ["DD/MM/YYYY", "MM/YYYY", "YYYY"]);
    }

    _formatEvent = (event, eventType) => {
        const ancestorInfo = event.sosa ? 
            this._getAncestorBranchAndGeneration(event.sosa) : null;

        if (ancestorInfo) {
            const color = ancestorInfo.branch === 'paternal' ? 'darkblue' : 'deeppink';
            return `${event.name} (${event.date}) at ${event.town} <span style="color: ${color}">(+ ${ancestorInfo.generation} generations up)</span>`;
        }

        const formatters = {
            birth: () => `${event.name} (${event.date}) à ${event.town}`,
            death: () => `${event.name} (${event.date}) à l'âge de ${event.age} ans à ${event.town}`,
            marriage: () => `${event.name} (${event.date}) avec ${event.spouse} à ${event.town}`,
            default: () => `${event.name} (${event.date}) à ${event.town}`
        };

        return (formatters[eventType] || formatters.default)();
    }

    _getAncestorBranchAndGeneration = (sosaNumber) => {
        const binaryRep = sosaNumber.toString(2);
        return {
            branch: binaryRep[1] === '0' ? 'paternal' : 'maternal',
            generation: binaryRep.length - 1
        };
    }
}

export default new TimelineStore();