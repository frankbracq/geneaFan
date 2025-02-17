export const EVENTS = {
    INDIVIDUAL: {
        ADDED: 'individual:added'
    },
    INDIVIDUALS: {
        BULK_ADDED: 'individuals:bulk_added'
    },
    CONFIG: {
        REQUESTED: 'config:requested',
        PROVIDED: 'config:provided'
    },
    CACHE: {
        BUILT: 'cache:built',
        CLEARED: 'cache:cleared',
        ERROR: 'cache:error',
        UPDATED: 'cache:updated',
        REQUESTED: 'cache:requested',
        PROVIDED: 'cache:provided',
        STATUS_REQUESTED: 'cache:status:requested',
        STATUS_PROVIDED: 'cache:status:provided'
    },
    HIERARCHY: {
        CHANGED: 'hierarchy:changed'
    },
    GENERATIONS: {
        UPDATED: 'generations:updated',
        MAX_CALCULATED: 'generations:max_calculated'
    },
    ROOT: {
        CHANGED: 'root:changed',
        HIERARCHY_UPDATED: 'root:hierarchy:updated',
        HIERARCHY_BUILT: 'root:hierarchy:built'
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
    },
    FAN: {
        DRAWN: 'fan:drawn',
    },
    MAPS: {
        API_READY: 'maps:api:ready',
        API_ERROR: 'maps:api:error',
        CONTAINER_CHANGE: 'maps:container:change',
        OFFCANVAS_SHOWN: 'maps:offcanvas:shown',
        OFFCANVAS_HIDDEN: 'maps:offcanvas:hidden',
        TAB_SHOWN: 'maps:tab:shown',
        TAB_HIDDEN: 'maps:tab:hidden'
    },
    TABS: {
        CHANGED: 'tabs:changed',
        SHOWN: 'tabs:shown',
        HIDDEN: 'tabs:hidden'
    },
    ONBOARDING: {
        APP_LOADED: 'onboarding:app_loaded',
        GEDCOM_UPLOADED: 'onboarding:gedcom_uploaded',
        TAB_OPENED: 'onboarding:tab_opened',
        TOUR_COMPLETED: 'onboarding:tour_completed'
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