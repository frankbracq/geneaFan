class StoreEventBus {
    constructor() {
        this.listeners = new Map();
    }

    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        
        // Retourne une fonction de nettoyage
        return () => {
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    this.listeners.delete(event);
                }
            }
        };
    }

    emit(event, data) {
        console.log(`📢 Event émis: ${event}`, data ? 'avec données' : 'sans données');
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`🚨 Erreur lors du traitement de l'événement ${event}:`, error);
                }
            });
        }
    }

    // Utilitaire pour le debugging
    listSubscriptions() {
        console.group('📋 Abonnements actuels');
        this.listeners.forEach((callbacks, event) => {
            console.log(`${event}: ${callbacks.size} listener(s)`);
        });
        console.groupEnd();
    }
}

// Événements disponibles
export const EVENTS = {
    INDIVIDUAL: {
        ADDED: 'individual:added',
        UPDATED: 'individual:updated',
        REMOVED: 'individual:removed'
    },
    CACHE: {
        BUILT: 'cache:built',
        CLEARED: 'cache:cleared'
    },
    TOWN: {
        ADDED: 'town:added',
        UPDATED: 'town:updated'
    }
};

export const storeEvents = new StoreEventBus();