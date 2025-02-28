import { autorun } from '../../../common/stores/mobx-config.js';
import gedcomDataStore from '../../../gedcom/stores/gedcomDataStore.js';
import { storeEvents, EVENTS } from '../../../common/stores/storeEvents.js';
import { googleMapsStore } from '../stores/googleMapsStore.js';
import { rootAncestorTownsStore } from '../stores/rootAncestorTownsStore.js';
import surnamesTownsStore from '../stores/surnamesTownsStore.js';
import familyTownsStore from '../stores/familyTownsStore.js';

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
    
            // 4. Initialiser les stores avec la carte
            await Promise.all([
                rootAncestorTownsStore.initialize(map),
                familyTownsStore.initialize(map),
                surnamesTownsStore.initialize(map)
            ]);
    
            // 5. S'assurer que les données sont chargées
            const hierarchy = gedcomDataStore.getHierarchy();
            if (hierarchy) {
                await rootAncestorTownsStore.processHierarchy(hierarchy);
                // Activer la visibilité seulement après le chargement des données
                rootAncestorTownsStore.toggleVisibility(true);
            }
    
            // 6. Configurer les contrôles de calques
            this.setupLayerControls();
            
            // 7. Marquer l'initialisation comme terminée
            this.initialized = true;
            
            // 8. Émettre l'événement indiquant que la carte est prête
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
            console.warn('⚠️ MarkerDisplayManager pas encore initialisé');
            return;
        }
    
        // Calque des ancêtres
        const ancestorLayerSwitch = document.getElementById('layerAncestors');
        if (ancestorLayerSwitch) {
            // Synchroniser avec l'état sauvegardé
            ancestorLayerSwitch.checked = googleMapsStore.layerStates.ancestors ?? true;
            rootAncestorTownsStore.toggleVisibility(ancestorLayerSwitch.checked);
            
            ancestorLayerSwitch.addEventListener('change', (e) => {
                googleMapsStore.setLayerState('ancestors', e.target.checked);
                rootAncestorTownsStore.toggleVisibility(e.target.checked);
            });
        }
    
        // Calque des villes familiales
        const familyTownsSwitch = document.getElementById('layerFamily');
        if (familyTownsSwitch) {
            familyTownsSwitch.checked = googleMapsStore.layerStates.family ?? false;
            familyTownsStore.toggleVisibility(familyTownsSwitch.checked);
            
            familyTownsSwitch.addEventListener('change', (e) => {
                googleMapsStore.setLayerState('family', e.target.checked);
                familyTownsStore.toggleVisibility(e.target.checked);
            });
        }
    
        // Calque des patronymes
        const surnamesLayerSwitch = document.getElementById('layerSurnames');
        const surnameFilter = document.getElementById('surnameFilter');
        
        if (surnamesLayerSwitch && surnameFilter) {
            surnamesLayerSwitch.checked = googleMapsStore.layerStates.surnames ?? false;
            surnameFilter.disabled = !googleMapsStore.layerStates.surnames;
            surnamesTownsStore.toggleVisibility(surnamesLayerSwitch.checked);
    
            surnamesLayerSwitch.addEventListener('change', (e) => {
                googleMapsStore.setLayerState('surnames', e.target.checked);
                surnameFilter.disabled = !e.target.checked;
                surnamesTownsStore.toggleVisibility(e.target.checked);
            });
    
            surnameFilter.addEventListener('change', (e) => {
                surnamesTownsStore.setSurname(e.target.value);
            });
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
        surnamesTownsStore.cleanup();
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
        this.initialized = false;
        this.map = null;
        this.saveLayerStates();
    }
}

export const googleMapManager = new GoogleMapManager();
