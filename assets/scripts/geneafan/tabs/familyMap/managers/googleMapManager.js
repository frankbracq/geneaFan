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

            // Configurer les contrôles de calques avec le service centralisé
            this.setupLayerControls();

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

    setupLayerControls() {
        if (!rootAncestorTownsStore.markerDisplayManager.isInitialized()) {
            console.warn("⚠️ MarkerDisplayManager pas encore initialisé");
            return;
        }

        console.log("🔍 Configuration des contrôles de calques");

        // Utiliser le service centralisé pour configurer les contrôles
        layerManager.setupLayerControls({
            ancestorLayerSwitch: document.getElementById('layerAncestors'),
            familyTownsSwitch: document.getElementById('layerFamily'),
            surnamesLayerSwitch: document.getElementById('layerSurnames'),
            surnameFilter: document.getElementById('surnameFilter')
        });

        console.log("✅ Contrôles de calques configurés");
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
        surnamesTownsStore.cleanup();
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
        this.initialized = false;
        this.map = null;
    }
}

export const googleMapManager = new GoogleMapManager();
