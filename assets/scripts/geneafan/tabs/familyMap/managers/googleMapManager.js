import { autorun } from '../../../common/stores/mobx-config.js';
import gedcomDataStore from '../../../gedcom/stores/gedcomDataStore.js';
import { storeEvents, EVENTS } from '../../../common/stores/storeEvents.js';
import { googleMapsStore } from '../stores/googleMapsStore.js';
import { rootAncestorTownsStore } from '../stores/rootAncestorTownsStore.js';
import surnamesTownsStore from '../stores/surnamesTownsStore.js';
import familyTownsStore from '../stores/familyTownsStore.js';
import { layerManager } from './layerManager.js';

class GoogleMapManager {
    constructor() {
        this.initialized = false;
        this.disposers = new Set();

        console.log('🔍 GoogleMapManager: Initialisation du constructor');

        const hierarchyDisposer = autorun(() => {
            try {
                const hierarchy = gedcomDataStore.getHierarchy();
                console.log('🔄 Autorun déclenché pour la hiérarchie:',
                    hierarchy ? 'présente' : 'absente');

                if (this.initialized && hierarchy && googleMapsStore.map) {
                    console.log('✨ Mise à jour de la carte avec la nouvelle hiérarchie');
                    this.updateMapWithHierarchy(hierarchy);
                } else {
                    console.log('⏳ En attente de l\'initialisation complète', {
                        managerInitialized: this.initialized,
                        hasHierarchy: !!hierarchy,
                        hasMap: !!googleMapsStore.map
                    });
                }
            } catch (error) {
                console.error('❌ Erreur lors du traitement de la hiérarchie:', error);
            }
        }, {
            name: 'HierarchyAutorun',
            onError: (error) => {
                console.error('🚨 Erreur critique dans l\'autorun:', error);
            }
        });

        this.disposers.add(hierarchyDisposer);
    }

    async initialize() {
        if (this.initialized) return;

        try {
            console.group('🚀 Initialisation de Google Maps');

            await googleMapsStore.initializeApi();
            const map = await googleMapsStore.initMap('familyMap');
            await new Promise(resolve => {
                google.maps.event.addListenerOnce(map, 'idle', resolve);
            });

            // Initialiser le service de gestion des calques avec les références aux stores
            layerManager.initialize({
                ancestors: rootAncestorTownsStore,
                family: familyTownsStore,
                surnames: surnamesTownsStore
            });

            // Initialiser les stores avec la carte
            await Promise.all([
                rootAncestorTownsStore.initialize(map),
                familyTownsStore.initialize(map),
                surnamesTownsStore.initialize(map)
            ]);

            // S'assurer que les données sont chargées
            const hierarchy = gedcomDataStore.getHierarchy();
            if (hierarchy) {
                await rootAncestorTownsStore.processHierarchy(hierarchy);
                
                // Forcer la mise à jour et l'affichage des marqueurs
                console.log('🔄 Forçage de l\'affichage des marqueurs ancestraux');
                rootAncestorTownsStore.applyVisibility(layerManager.isLayerVisible('ancestors'));
            }
            
            // Configurer les écouteurs d'événements pour les changements d'onglet
            this.setupEventListeners();

            // Marquer l'initialisation comme terminée
            this.initialized = true;

            // Émettre l'événement indiquant que la carte est prête
            storeEvents.emit(EVENTS.VISUALIZATIONS.MAP.DRAWN);
            console.log('✅ Carte dessinée et prête pour le tour');

            console.groupEnd();
        } catch (error) {
            console.error("❌ Échec de l'initialisation:", error);
            console.groupEnd();
            throw error;
        }
    }

    async updateMapWithHierarchy(hierarchy) {
        try {
            console.group('📍 Mise à jour de la carte');
            if (!googleMapsStore.map) {
                console.warn('⚠️ La carte n\'est pas encore prête');
                console.groupEnd();
                return;
            }

            // Utilisation de la nouvelle méthode dans rootAncestorTownsStore
            await rootAncestorTownsStore.processHierarchy(hierarchy);
            console.log('✅ Mise à jour terminée');
            console.groupEnd();
        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour de la carte:', error);
            console.groupEnd();
            throw error;
        }
    }

    setupEventListeners() {
        const tabElement = document.querySelector('a[href="#tab2"]');
        if (tabElement) {
            tabElement.addEventListener('shown.bs.tab', () => {
                if (googleMapsStore.map) {
                    console.log('🔄 Tab Map affiché, rafraîchissement de la carte');
                    
                    // Déclencher un événement resize pour que Google Maps recalcule sa taille
                    google.maps.event.trigger(googleMapsStore.map, 'resize');
                    
                    // Réafficher tous les calques actifs
                    this.refreshAllLayers();
                    
                    // Centrer la carte après un court délai pour s'assurer que les marqueurs sont chargés
                    // et que le conteneur a été complètement redimensionné
                    setTimeout(() => {
                        googleMapsStore.centerMapOnMarkers();
                    }, 300); // Délai augmenté pour s'assurer que le conteneur est complètement redimensionné
                }
            });
        }
        
        // Ajouter un écouteur pour les redimensionnements de fenêtre
        // qui pourrait affecter la hauteur du conteneur de carte
        window.addEventListener('resize', this.#debounce(() => {
            if (googleMapsStore.map && document.querySelector('#tab2.active')) {
                console.log('🔍 Redimensionnement détecté, ajustement du zoom');
                googleMapsStore.centerMapOnMarkers();
            }
        }, 500));
    }
    
    /**
     * Fonction utilitaire pour limiter la fréquence d'appel lors du redimensionnement
     * @param {Function} func - Fonction à exécuter
     * @param {number} wait - Délai d'attente en ms
     * @returns {Function} - Fonction avec limitation de fréquence
     */
    #debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    refreshAllLayers() {
        // Obtenir l'état de tous les calques
        const layers = {
            ancestors: layerManager.isLayerVisible('ancestors'),
            family: layerManager.isLayerVisible('family'),
            surnames: layerManager.isLayerVisible('surnames')
        };
        
        console.log('🔄 Rafraîchissement de tous les calques actifs:', layers);
        
        // Réappliquer la visibilité pour forcer le rafraîchissement des marqueurs
        Object.entries(layers).forEach(([layer, isVisible]) => {
            if (isVisible) {
                console.log(`🔄 Réaffichage du calque ${layer}`);
                
                // Récupérer la référence au store correspondant
                let store;
                switch (layer) {
                    case 'ancestors':
                        store = rootAncestorTownsStore;
                        break;
                    case 'family':
                        store = familyTownsStore;
                        break;
                    case 'surnames':
                        store = surnamesTownsStore;
                        break;
                    default:
                        return;
                }
                
                // Réappliquer la visibilité (forcer l'affichage)
                store.applyVisibility(true);
            }
        });
    }

    cleanup() {
        console.log('🧹 Nettoyage de GoogleMapManager');
        
        // Nettoyage des stores de couches
        rootAncestorTownsStore.cleanup();
        familyTownsStore.cleanup();
        surnamesTownsStore.cleanup();
        
        // Nettoyage des disposers MobX
        this.disposers.forEach(disposer => {
            if (typeof disposer === 'function') {
                disposer();
            }
        });
        this.disposers.clear();
        
        // Supprimer les écouteurs d'événements DOM
        this.removeEventListeners();
        
        this.initialized = false;
        
        console.log('✅ Nettoyage de GoogleMapManager terminé');
    }
    
    // Nouvelle méthode pour supprimer les écouteurs DOM
    removeEventListeners() {
        const tabElement = document.querySelector('a[href="#tab2"]');
        if (tabElement) {
            // Créer une copie pour supprimer tous les écouteurs
            const newElement = tabElement.cloneNode(true);
            tabElement.parentNode.replaceChild(newElement, tabElement);
        }
        
        // Supprimer l'écouteur de redimensionnement de fenêtre
        window.removeEventListener('resize', this.#debounce);
    }
}

export const googleMapManager = new GoogleMapManager();
