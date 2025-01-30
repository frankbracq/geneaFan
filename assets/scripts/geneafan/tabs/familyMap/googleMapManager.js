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

        // Observer les changements de hiérarchie
        const hierarchyDisposer = autorun(() => {
            try {
                const hierarchy = gedcomDataStore.getHierarchy();
                console.log('🔄 Autorun déclenché pour la hiérarchie:', 
                    hierarchy ? 'présente' : 'absent');

                if (googleMapsStore.isApiLoaded && hierarchy && googleMapsStore.map) {
                    console.log('✨ Mise à jour de la carte avec la nouvelle hiérarchie');
                    this.updateMapWithHierarchy(hierarchy);
                } else {
                    console.log('⏳ En attente de l\'initialisation complète', {
                        apiLoaded: googleMapsStore.isApiLoaded,
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

    async updateMapWithHierarchy(hierarchy) {
        try {
            console.group('📍 Mise à jour de la carte');
            
            if (!googleMapsStore.map) {
                console.warn('⚠️ La carte n\'est pas encore prête');
                console.groupEnd();
                return;
            }
    
            // Initialiser les stores avec la carte
            rootAncestorTownsStore.initialize(googleMapsStore.map);
            familyTownsStore.initialize(googleMapsStore.map);
    
            console.log('🔄 Traitement de la hiérarchie...');
            await googleMapsStore.processHierarchy(hierarchy);
    
            // Ajouter les markers au cluster après le traitement
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
        // Configuration du switch pour les ancêtres
        const ancestorLayerSwitch = document.getElementById('layerAncestors');
        if (ancestorLayerSwitch) {
            // Initialiser l'état des switches
            ancestorLayerSwitch.checked = true;
            rootAncestorTownsStore.isVisible = true;
            rootAncestorTownsStore.markerDisplayManager.toggleLayerVisibility('rootAncestors', true, rootAncestorTownsStore.map);
            rootAncestorTownsStore.markerDisplayManager.addMarkersToCluster(rootAncestorTownsStore.map);
            
            // Ajouter le gestionnaire d'événements
            ancestorLayerSwitch.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                rootAncestorTownsStore.toggleVisibility(isChecked);
            });
        }

        // Configuration du switch pour les villes familiales
        const familyTownsSwitch = document.getElementById('layerFamily');
        if (familyTownsSwitch) {
            // Initialiser l'état des switches
            familyTownsSwitch.checked = false;
            familyTownsStore.isVisible = false;
            familyTownsStore.markerDisplayManager.toggleLayerVisibility('familyTowns', false, familyTownsStore.map);
            
            // Ajouter le gestionnaire d'événements
            familyTownsSwitch.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                familyTownsStore.toggleVisibility(isChecked);
                // Assurer que le clustering est mis à jour
                if (isChecked) {
                    familyTownsStore.markerDisplayManager.addMarkersToCluster(familyTownsStore.map);
                }
            });
        }
    }

    setupEventListeners() {
        const offcanvasElement = document.getElementById("individualMap");
        if (offcanvasElement) {
            offcanvasElement.addEventListener("shown.bs.offcanvas", () => {
                googleMapsStore.initMap("individualMap").catch(error => {
                    console.error('Failed to initialize map in offcanvas:', error);
                });
                this.adjustMapHeight();
            });
        }

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

    adjustMapHeight() {
        const offCanvas = document.getElementById("individualMap");
        const offCanvasHeader = document.querySelector("#individualMap .offcanvas-header");
        const mapId = document.getElementById("mapid");

        if (offCanvas && offCanvasHeader && mapId) {
            const offCanvasHeight = offCanvas.clientHeight;
            const headerHeight = offCanvasHeader.clientHeight;
            const mapHeight = offCanvasHeight - headerHeight;
            mapId.style.height = `${mapHeight}px`;
        }
    }    
    
    cleanup() {
        // Nettoyer les stores
        rootAncestorTownsStore.cleanup();
        familyTownsStore.cleanup();
        
        // Nettoyer les écouteurs d'événements
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
        
        // Réinitialiser les propriétés
        this.initialized = false;
    }
}

export const googleMapManager = new GoogleMapManager();