import { makeAutoObservable, action, computed, runInAction } from '../../common/stores/mobx-config.js';
import _ from 'lodash';
import { dateProcessor } from '../../gedcom/processors/dateProcessor.js';

class TimelineEventsStore {
    events = [];
    groupedEvents = {};

    constructor() {
        makeAutoObservable(this, {
            addEvent: action,
            clearEvents: action,
            setEvents: action,
            hasEvents: computed
        });
    }

    // Moved from utils.js and made private to the store
    _groupEvents = (events, yearsGroup = 5) => {
        // Parse and filter valid dates
        const validEvents = _.filter(events, event => {
            const parsedDate = dateProcessor.parseDate(event.date);
            if (parsedDate.isValid) {
                event.parsedDate = parsedDate.date;
                return true;
            }
            return false;
        });

        // Sort events by date
        const sortedEvents = _.sortBy(validEvents, event => event.parsedDate.getTime());

        // Group events by the specified number of years
        const groupedByYears = _.groupBy(sortedEvents, event => {
            const yearStart = Math.floor(event.parsedDate.getFullYear() / yearsGroup) * yearsGroup;
            return `01/01/${yearStart}`;
        });

        // Further group by event type within each year group
        return _.mapValues(groupedByYears, eventsByDate => _.groupBy(eventsByDate, 'type'));
    }

    get hasEvents() {
        return this.events.length > 0;
    }

    get eventsByType() {
        return (type) => this.events.filter(event => event.type === type);
    }

    addEvent = (event) => {
        if (!event.type || !event.date || !event.name) {
            console.warn('Invalid event format:', event);
            return;
        }

        if (event.eventId && this.events.some(e => e.eventId === event.eventId)) {
            return;
        }

        const enrichedEvent = {
            ...event,
            town: event.town || "lieu inconnu",
            townDisplay: event.townDisplay || event.town || "lieu inconnu",
            age: event.age || null,
            spouse: event.spouse || '',
            sosa: event.sosa || null
        };

        runInAction(() => {
            this.events.push(enrichedEvent);
            this._updateGroupedEvents();
        });
    }

    setEvents = (events) => {
        runInAction(() => {
            this.events = events;
            this._updateGroupedEvents();
        });
    }

    clearEvents = () => {
        runInAction(() => {
            this.events = [];
            this.groupedEvents = {};
        });
    }

    _updateGroupedEvents = () => {
        this.groupedEvents = this._groupEvents(this.events, 5);
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

    formatEvent = (event, eventType) => {
        if (event.sosa) {
            const ancestorInfo = this._getAncestorBranchAndGeneration(event.sosa);
            const color = ancestorInfo.branch === 'paternal' ? 'darkblue' : 'deeppink';
            return `${event.name} (${event.date}) at ${event.town} <span style="color: ${color}">(+ ${ancestorInfo.generation} generations up)</span>`;
        } else {
            return eventType === 'birth'
                ? `${event.name} (${event.date}) at ${event.town}`
                : eventType === 'death'
                ? `${event.name} (${event.date}) at the age of ${event.age} at ${event.town}`
                : `${event.name} (${event.date}) with ${event.spouse} at ${event.town}`;
        }
    }

    getAllEvents = () => this.events;
    getGroupedEvents = () => this.groupedEvents;
}

const timelineEventsStore = new TimelineEventsStore();
export default timelineEventsStore;