export const EVENTS = {
    INDIVIDUAL: {
        ADDED: 'individual:added'
    },
    INDIVIDUALS: {
        BULK_ADDED: 'individuals:bulk_added'  // Nouvel événement pour le traitement par lots
    },
    CACHE: {
        BUILT: 'cache:built',
        CLEARED: 'cache:cleared',
        ERROR: 'cache:error',
        UPDATED: 'cache:updated'
    },
    GENERATIONS: {
        UPDATED: 'generations:updated'
    },
    ROOT: {
        CHANGED: 'root:changed',
        HIERARCHY_UPDATED: 'root:hierarchy:updated',
        HIERARCHY_BUILT: 'root:hierarchy:built'  // Nouveau
    },
    TOWN: {
        UPDATE_START: 'town:update:start',
        UPDATE_COMPLETE: 'town:update:complete',
        UPDATE_ERROR: 'town:update:error',
        UPDATED: 'town:updated'
    },
    PROCESS: {
        START: 'process:start',
        COMPLETE: 'process:complete',
        ERROR: 'process:error'
    },
    STORE: {
        READY: 'store:ready'
    }
};

class StoreEventEmitter {
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

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
}

export const storeEvents = new StoreEventEmitter();