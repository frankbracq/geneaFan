import { Loader } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { googleMapsStore } from './googleMapsStore.js';
import gedcomDataStore from '../../gedcom/gedcomDataStore.js';
import { autorun } from 'mobx';

class GoogleMapManager {
    constructor() {
        this.initialized = false;
        this.loader = null;
        this.disposers = new Set();

        console.log('🔍 GoogleMapManager: Initialisation du constructor');

        // Utiliser autorun au lieu de reaction
        const disposer = autorun(() => {
            const hierarchy = gedcomDataStore.getHierarchy();
            console.log('🔄 Autorun déclenché, hiérarchie:', hierarchy ? 'présente' : 'null');

            if (hierarchy) {
                console.log('✨ Structure de la hiérarchie:', {
                    type: typeof hierarchy,
                    keys: Object.keys(hierarchy),
                    hasChildren: !!hierarchy.children,
                    childrenCount: hierarchy.children?.length || 0
                });

                try {
                    console.log('🎯 Tentative de traitement de la hiérarchie');
                    googleMapsStore.processHierarchy(hierarchy);
                    console.log('✅ Traitement terminé avec succès');
                } catch (error) {
                    console.error('❌ Erreur lors du traitement de la hiérarchie:', error);
                }
            }
        }, {
            name: 'HierarchyAutorun',
            onError: (error) => {
                console.error('🚨 Erreur dans l\'autorun:', error);
            }
        });

        this.disposers.add(disposer);
    }

    async initialize() {
        if (this.initialized) return;

        try {
            this.loader = new Loader({
                apiKey: googleMapsStore.apiKey,
                version: "weekly",
                libraries: []
            });

            await this.loader.load();
            this.initialized = true;

            await this.initializeMap("familyMap");
            this.setupEventListeners();

            console.log('Google Maps API loaded successfully');
        } catch (error) {
            console.error("Failed to initialize Google Maps:", error);
            throw error;
        }
    }

    async initializeMap(containerId, options = {}) {
        if (!this.initialized) {
            console.error("Google Maps not initialized. Call initialize() first");
            return;
        }

        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container ${containerId} not found`);
            return;
        }

        const defaultOptions = {
            zoom: 6.2,
            center: { lat: 46.2276, lng: 2.2137 },
            styles: googleMapsStore.getMapStyle(),
            streetViewControl: false,
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.TOP_RIGHT
            },
            fullscreenControl: true,
            fullscreenControlOptions: {
                position: google.maps.ControlPosition.TOP_CENTER,
            }
        };

        const mapOptions = { ...defaultOptions, ...options };
        googleMapsStore.map = new google.maps.Map(container, mapOptions);
        googleMapsStore.markerCluster = new MarkerClusterer({ map: googleMapsStore.map });

        return googleMapsStore.map;
    }

    setupEventListeners() {
        // Gestion de la carte individuelle
        const offcanvasElement = document.getElementById("individualMap");
        if (offcanvasElement) {
            offcanvasElement.addEventListener("shown.bs.offcanvas", () => {
                this.initializeMap("individualMap");
                this.adjustMapHeight();
            });
        }

        // Gestion de l'onglet de carte familiale
        const tabFamilyMap = document.querySelector('[href="#tab2"]');
        if (tabFamilyMap) {
            tabFamilyMap.addEventListener("show.bs.tab", async () => {
                if (googleMapsStore.map) {
                    try {
                        // S'assurer que la carte est dans le bon conteneur
                        if (!document.getElementById("familyMap").contains(googleMapsStore.map.getDiv())) {
                            await googleMapsStore.moveMapToContainer("familyMap");
                        }

                        googleMapsStore.activateMapMarkers();
                        google.maps.event.trigger(googleMapsStore.map, "resize");
                        googleMapsStore.map.setCenter({ lat: 46.2276, lng: 2.2137 });
                    } catch (error) {
                        console.error('Error handling family map tab:', error);
                    }
                } else {
                    // Si la carte n'existe pas encore, l'initialiser
                    await this.initializeMap("familyMap");
                }
            });
        }

        // Gestion des modes de carte
        const standardModeBtn = document.getElementById('map-mode-standard');
        const timelineModeBtn = document.getElementById('map-mode-timeline');

        if (standardModeBtn && timelineModeBtn) {
            standardModeBtn.addEventListener('click', () => {
                googleMapsStore.toggleTimeline(false);
                standardModeBtn.classList.add('active');
                timelineModeBtn.classList.remove('active');
            });

            timelineModeBtn.addEventListener('click', () => {
                googleMapsStore.toggleTimeline(true);
                timelineModeBtn.classList.add('active');
                standardModeBtn.classList.remove('active');
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
        // Nettoyage des autoruns lors de la destruction
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
    }
}

export const googleMapManager = new GoogleMapManager();