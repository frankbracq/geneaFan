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
        googleMapsStore.initializeAncestorsMap();

        return googleMapsStore.map;
    }

    setupEventListeners() {
        // Gestion de la carte individuelle uniquement
        const offcanvasElement = document.getElementById("individualMap");
        if (offcanvasElement) {
            offcanvasElement.addEventListener("shown.bs.offcanvas", () => {
                this.initializeMap("individualMap");
                this.adjustMapHeight();
            });
        }

        // Gérer la réinitialisation de la carte lors du changement d'onglet
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
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
    }
}

export const googleMapManager = new GoogleMapManager();