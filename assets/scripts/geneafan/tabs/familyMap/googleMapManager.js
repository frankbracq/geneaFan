import { googleMapsStore } from './googleMapsStore.js';
import { rootAncestorTownsStore } from './rootAncestorTownsStore.js';
import gedcomDataStore from '../../gedcom/stores/gedcomDataStore.js';
import familyTownsStore from '../../gedcom/stores/familyTownsStore.js';
import { autorun } from '../../common/stores/mobx-config.js';
import { storeEvents, EVENTS } from '../../gedcom/stores/storeEvents.js';

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

            // 1. Initialiser l'API Google Maps
            await googleMapsStore.initializeApi();

            // 2. Créer la carte
            const map = await googleMapsStore.initMap('familyMap');

            // 3. Attendre que la carte soit complètement chargée
            await new Promise(resolve => {
                google.maps.event.addListenerOnce(map, 'idle', resolve);
            });

            // 4. Initialiser les stores avec la carte
            rootAncestorTownsStore.initialize(map);
            familyTownsStore.initialize(map);

            // 5. Configurer les contrôles de calques
            this.setupLayerControls();

            // 6. Ajouter les écouteurs d'événements
            this.setupEventListeners();

            // 7. Initialiser la liste des lieux
            googleMapsStore.initializePlacesList();

            // 8. Mise à jour avec les données de hiérarchie si présentes
            const currentHierarchy = gedcomDataStore.getHierarchy();
            if (currentHierarchy) {
                await this.updateMapWithHierarchy(currentHierarchy);
            }

            this.initialized = true;
            console.log('✅ Initialisation terminée avec succès');
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

            await googleMapsStore.processHierarchy(hierarchy);
            rootAncestorTownsStore.markerDisplayManager.addMarkersToCluster(googleMapsStore.map);
            console.log('✅ Mise à jour terminée');
            console.groupEnd();
        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour de la carte:', error);
            console.groupEnd();
            throw error;
        }
    }

    setupLayerControls() {
        if (!rootAncestorTownsStore.markerDisplayManager.isInitialized()) {
            console.warn('⚠️ MarkerDisplayManager pas encore initialisé');
            return;
        }

        const ancestorLayerSwitch = document.getElementById('layerAncestors');
        if (ancestorLayerSwitch) {
            ancestorLayerSwitch.checked = true;
            rootAncestorTownsStore.toggleVisibility(true);
        }

        const familyTownsSwitch = document.getElementById('layerFamily');
        if (familyTownsSwitch) {
            familyTownsSwitch.checked = false;
            familyTownsStore.toggleVisibility(false);
        }
    }

    setupEventListeners() {
        const tabElement = document.querySelector('a[href="#tab2"]');
        if (tabElement) {
            tabElement.addEventListener('shown.bs.tab', () => {
                if (googleMapsStore.map) {
                    google.maps.event.trigger(googleMapsStore.map, 'resize');
                    googleMapsStore.centerMapOnMarkers();
                }
            });
        }
    }

    cleanup() {
        rootAncestorTownsStore.cleanup();
        familyTownsStore.cleanup();
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
        this.initialized = false;
    }
}

export const googleMapManager = new GoogleMapManager();
