export const EVENTS = {
    // Événements liés aux individus
    INDIVIDUAL: {
        ADDED: 'individual:added',
        SELECTED: 'individual:selected'
    },
    INDIVIDUALS: {
        BULK_ADDED: 'individuals:bulk_added'
    },

    // Événements liés à la configuration
    CONFIG: {
        REQUESTED: 'config:requested',
        PROVIDED: 'config:provided',
        UPDATED: 'config:updated'
    },

    // Événements liés au cache
    CACHE: {
        BUILT: 'cache:built',
        CLEARED: 'cache:cleared',
        ERROR: 'cache:error',
        UPDATED: 'cache:updated',
        REQUESTED: 'cache:requested',
        PROVIDED: 'cache:provided',
        STATUS: {
            REQUESTED: 'cache:status:requested',
            PROVIDED: 'cache:status:provided'
        }
    },

    // Événements liés à la hiérarchie et aux générations
    HIERARCHY: {
        CHANGED: 'hierarchy:changed',
        BUILT: 'hierarchy:built'
    },
    GENERATIONS: {
        UPDATED: 'generations:updated',
        MAX_CALCULATED: 'generations:max_calculated'
    },

    // Événements liés à la racine
    ROOT: {
        CHANGED: 'root:changed',
        UPDATED: 'root:updated'
    },

    // Événements liés aux visualisations
    VISUALIZATIONS: {
        FAN: {
            DRAWN: 'visualization:fan:drawn',
            UPDATED: 'visualization:fan:updated',
            PARAMETERS_CHANGED: 'visualization:fan:parameters:changed'
        },
        MAP: {
            DRAWN: 'visualization:map:drawn',
            UPDATED: 'visualization:map:updated',
            API_READY: 'visualization:map:api:ready',
            API_ERROR: 'visualization:map:api:error',
            LAYERS: {
                CHANGED: 'visualization:map:layers:changed',
            }
        }
    },

    // Événements liés à l'interface utilisateur
    UI: {
        TABS: {
            CHANGED: 'ui:tabs:changed',
            SHOWN: 'ui:tabs:shown',
            HIDDEN: 'ui:tabs:hidden',
            TIMELINE_SHOWN: 'ui:tabs:timeline:shown'
        },
        PANELS: {
            SHOWN: 'ui:panels:shown',
            HIDDEN: 'ui:panels:hidden'
        }
    },

    // Événements liés à l'onboarding
    ONBOARDING: {
        APP_LOADED: 'onboarding:app_loaded',
        GEDCOM_UPLOADED: 'onboarding:gedcom_uploaded',
        VISUALIZATION_READY: 'onboarding:visualization:ready',
        TOUR_STARTED: 'onboarding:tour:started',
        TOUR_COMPLETED: 'onboarding:tour:completed',
        TOUR_CANCELLED: 'onboarding:tour:cancelled'
    },

    // Événements liés au traitement des données
    PROCESS: {
        START: 'process:start',
        COMPLETE: 'process:complete',
        ERROR: 'process:error'
    },

    // Événements liés à l'état global
    STORE: {
        READY: 'store:ready',
        ERROR: 'store:error'
    },

    // Ces événements vont être dépréciés en faveur de VISUALIZATIONS.MAP.TOWNS
    TOWN: {
        UPDATE_START: 'visualization:map:towns:update:start',
        UPDATE_COMPLETE: 'visualization:map:towns:update:complete',
        UPDATE_ERROR: 'visualization:map:towns:update:error',
        UPDATED: 'visualization:map:towns:updated'
    }
};

class StoreEventEmitter {
    constructor() {
        this.listeners = new Map();
        this.debug = false; // Ajout d'un flag pour le debug
    }

    // Active/désactive le mode debug
    setDebug(enabled) {
        this.debug = enabled;
    }

    subscribe(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(listener);

        if (this.debug) {
            console.log(`Event subscribed: ${event}`);
        }

        // Return disposer function
        return () => {
            const eventListeners = this.listeners.get(event);
            if (eventListeners) {
                eventListeners.delete(listener);
                if (eventListeners.size === 0) {
                    this.listeners.delete(event);
                }
                if (this.debug) {
                    console.log(`Event unsubscribed: ${event}`);
                }
            }
        };
    }

    emit(event, data) {
        // Toujours logger l'émission de l'événement fan:drawn pour le débogage
        if (event === 'visualization:fan:drawn') {
            console.log(`⚡ Event ${event} émis à ${new Date().toISOString()}`);
        } else if (this.debug) {
            console.log(`Event emitted: ${event}`, data);
        }

        // Si c'est l'événement fan chart drawn, vérifier qu'il y a des écouteurs
        if (event === 'visualization:fan:drawn') {
            const listenerCount = this.listeners.has(event) ? this.listeners.get(event).size : 0;
            console.log(`Nombre d'écouteurs pour ${event}: ${listenerCount}`);
        }

        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                    console.error(error);
                }
            });
        }
    }

    // Méthode utilitaire pour lister tous les événements actifs
    listActiveEvents() {
        return Array.from(this.listeners.keys());
    }

    // Méthode utilitaire pour compter les écouteurs par événement
    countListeners(event) {
        return this.listeners.has(event) ? this.listeners.get(event).size : 0;
    }
}

export const storeEvents = new StoreEventEmitter();