import { makeAutoObservable, action, computed, runInAction } from '../../common/stores/mobx-config.js';
import { groupEvents } from "../../utils/utils.js";

/**
 * Store responsible for managing timeline events data
 */
class TimelineEventsStore {
    // Core data
    events = [];
    groupedEvents = {};

    constructor() {
        makeAutoObservable(this, {
            addEvent: action,
            clearEvents: action,
            setEvents: action,
            
            // Ne plus déclarer getEventsByType comme computed ici
            hasEvents: computed
        });
    }

    // Computed properties avec la syntaxe getter
    get hasEvents() {
        return this.events.length > 0;
    }

    // Transformer en getter pour computed
    get eventsByType() {
        return (type) => this.events.filter(event => event.type === type);
    }

    // Actions
    addEvent = (event) => {
        // Validation basique
        if (!event.type || !event.date || !event.name) {
            console.warn('Invalid event format:', event);
            return;
        }

        // Éviter les doublons basés sur eventId si présent
        if (event.eventId && this.events.some(e => e.eventId === event.eventId)) {
            return;
        }

        // Enrichir l'événement avec des valeurs par défaut si nécessaire
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

    // Helpers (préfixés avec _ pour indiquer qu'ils sont "privés")
    _updateGroupedEvents = () => {
        this.groupedEvents = groupEvents(this.events, 5);
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

    // Public getters
    getAllEvents = () => this.events;
    getGroupedEvents = () => this.groupedEvents;
    
    // On peut utiliser eventsByType comme ça : store.eventsByType('birth')
}

const timelineEventsStore = new TimelineEventsStore();
export default timelineEventsStore;