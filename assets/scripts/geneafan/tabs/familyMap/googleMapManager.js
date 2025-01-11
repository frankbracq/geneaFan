import { Loader } from "@googlemaps/js-api-loader";
import { googleMapsStore } from './googleMapsStore.js';
import { rootAncestorTownsStore } from './rootAncestorTownsStore.js';
import gedcomDataStore from '../../gedcom/stores/gedcomDataStore.js';
import familyTownsStore from '../../gedcom/stores/familyTownsStore.js';
import { autorun } from '../../common/stores/mobx-config.js';

class GoogleMapManager {
    constructor() {
        this.initialized = false;
        this.loader = null;
        this.disposers = new Set();

        console.log('🔍 GoogleMapManager: Initialisation du constructor');

        const hierarchyDisposer = autorun(() => {
            try {
                const hierarchy = gedcomDataStore.getHierarchy();
                console.log('🔄 Autorun déclenché pour la hiérarchie:', 
                    hierarchy ? 'présente' : 'absent');

                if (this.initialized && hierarchy && googleMapsStore.map) {
                    console.log('✨ Mise à jour de la carte avec la nouvelle hiérarchie');
                    this.updateMapWithHierarchy(hierarchy);
                } else {
                    console.log('⏳ En attente de l\'initialisation complète',
                        {
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

    async updateMapWithHierarchy(hierarchy) {
        try {
            console.group('📍 Mise à jour de la carte');
            
            if (!googleMapsStore.map) {
                console.warn('⚠️ La carte n\'est pas encore prête');
                console.groupEnd();
                return;
            }

            console.log('🔄 Traitement de la hiérarchie...');
            await googleMapsStore.processHierarchy(hierarchy);
            
            console.log('✅ Mise à jour terminée');
            console.groupEnd();
        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour de la carte:', error);
            console.groupEnd();
            throw error;
        }
    }

    async initialize() {
        if (this.initialized) return;
    
        try {
            console.group('🚀 Initialisation de Google Maps');
            
            this.loader = new Loader({
                apiKey: googleMapsStore.mapsApiKey,
                version: "weekly",
                libraries: ['marker']
            });
    
            await this.loader.load();
            
            // Initialiser la carte et attendre qu'elle soit prête
            const map = await this.initializeMap("familyMap");
            
            // Attendre que la carte soit complètement chargée
            await new Promise(resolve => {
                google.maps.event.addListenerOnce(map, 'idle', resolve);
            });
            
            // Initialiser les stores avec la carte
            rootAncestorTownsStore.initialize(map);
            familyTownsStore.initialize(map);

            // Configurer les contrôles de calques
            this.setupLayerControls();

            this.initialized = true;
            this.setupEventListeners();
    
            console.log('📋 Initialisation de la liste des lieux...');
            googleMapsStore.initializePlacesList();
    
            const currentHierarchy = gedcomDataStore.getHierarchy();
            if (currentHierarchy) {
                await this.updateMapWithHierarchy(currentHierarchy);
            }
    
            console.log('✅ Initialisation terminée avec succès');
            console.groupEnd();
        } catch (error) {
            console.error("❌ Échec de l'initialisation:", error);
            console.groupEnd();
            throw error;
        }
    }    

    async initializeMap(containerId, options = {}) {
        if (!this.loader) {
            console.error("Google Maps loader not initialized");
            return;
        }
    
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container ${containerId} not found`);
            return;
        }
    
        const map = await googleMapsStore.initMap(containerId, {
            zoom: 6.2,
            center: { lat: 46.2276, lng: 2.2137 },
            mapId: 'e998be704b1911eb',
            streetViewControl: false,
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.TOP_RIGHT
            },
            fullscreenControl: true,
            fullscreenControlOptions: {
                position: google.maps.ControlPosition.TOP_CENTER,
            },
            ...options
        });
    
        return map;
    }

    setupLayerControls() {
        // Configuration du switch pour les ancêtres
        const ancestorLayerSwitch = document.getElementById('layerAncestors');
        if (ancestorLayerSwitch) {
            // Initialiser l'état des switches
            ancestorLayerSwitch.checked = true;
            rootAncestorTownsStore.isVisible = true;
            rootAncestorTownsStore.markerManager.toggleLayerVisibility('rootAncestors', true, rootAncestorTownsStore.map);
            rootAncestorTownsStore.markerManager.addMarkersToCluster(rootAncestorTownsStore.map);
            
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
            familyTownsStore.markerManager.toggleLayerVisibility('familyTowns', false, familyTownsStore.map);
            
            // Ajouter le gestionnaire d'événements
            familyTownsSwitch.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                familyTownsStore.toggleVisibility(isChecked);
                // Assurer que le clustering est mis à jour
                if (isChecked) {
                    familyTownsStore.markerManager.addMarkersToCluster(familyTownsStore.map);
                }
            });
        }
    }

    setupEventListeners() {
        const offcanvasElement = document.getElementById("individualMap");
        if (offcanvasElement) {
            offcanvasElement.addEventListener("shown.bs.offcanvas", () => {
                this.initializeMap("individualMap");
                this.adjustMapHeight();
            });
        }

        const tabElement = document.querySelector('a[href="#tab2"]');
        if (tabElement) {
            tabElement.addEventListener('shown.bs.tab', () => {
                console.log('🔄 Tab change detected - Map tab is now active');
                if (googleMapsStore.map) {
                    console.log('🗺️ Triggering map resize and recentering');
                    google.maps.event.trigger(googleMapsStore.map, 'resize');
                    googleMapsStore.centerMapOnMarkers();
                    console.log('✅ Map display refreshed and centered');
                } else {
                    console.warn('⚠️ Map instance not found during tab activation');
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
        this.loader = null;
    }
}

export const googleMapManager = new GoogleMapManager();