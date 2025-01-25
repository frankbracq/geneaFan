class StoreEvents {
    constructor() {
        this.listeners = new Map();
    }

    subscribe(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(listener);

        // Return disposer function
        return () => {
            const eventListeners = this.listeners.get(event);
            if (eventListeners) {
                eventListeners.delete(listener);
                if (eventListeners.size === 0) {
                    this.listeners.delete(event);
                }
            }
        };
    }

    emit(event, data) {
        console.log(`🔔 Émission événement: ${event}`);
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            console.log(`📣 ${eventListeners.size} écouteur(s) trouvé(s) pour ${event}`);
            eventListeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        } else {
            console.log(`⚠️ Aucun écouteur pour l'événement ${event}`);
        }
    }

    clear() {
        this.listeners.clear();
    }
}

export const EVENTS = {
    INDIVIDUAL: {
        ADDED: 'individual:added'
    },
    INDIVIDUALS: {
        BULK_ADDED: 'individuals:bulk_added'  // Nouvel événement pour le traitement par lots
    },
    CACHE: {
        ERROR: 'cache:error',
        BUILT: 'cache:built',
        CLEARED: 'cache:cleared'
    },
    TOWN: {
        UPDATE_START: 'town:update:start',
        UPDATE_COMPLETE: 'town:update:complete',
        UPDATE_ERROR: 'town:update:error',
        UPDATED: 'town:updated'
    }
};

export const storeEvents = new StoreEvents();