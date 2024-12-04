import { Loader } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { googleMapsStore } from './googleMapsStore.js';

class GoogleMapManager {
    constructor() {
        this.initialized = false;
        this.loader = null;
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
            
            // Initialiser la carte principale
            this.initializeMap("familyMap");
            
            this.setupEventListeners();
            console.log('Google Maps API loaded successfully');
        } catch (error) {
            console.error("Failed to initialize Google Maps:", error);
            throw error;
        }
    }

    initializeMap(containerId, options = {}) {
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
        googleMapsStore.markerCluster = new MarkerClusterer({ 
            map: googleMapsStore.map 
        });

        this.setupMapControls();
        return googleMapsStore.map;
    }

    setupEventListeners() {
        // Handle individual map display
        const offcanvasElement = document.getElementById("individualMap");
        if (offcanvasElement) {
            offcanvasElement.addEventListener("shown.bs.offcanvas", () => {
                this.initializeMap("individualMap");
                this.adjustMapHeight();
            });
        }

        // Handle family map tab
        const tabFamilyMap = document.querySelector('[href="#tab2"]');
        if (tabFamilyMap) {
            tabFamilyMap.addEventListener("show.bs.tab", () => {
                if (googleMapsStore.map) {
                    googleMapsStore.moveMapToContainer("tab2");
                    googleMapsStore.activateMapMarkers();
                    google.maps.event.trigger(googleMapsStore.map, "resize");
                    googleMapsStore.map.setCenter({ lat: 46.2276, lng: 2.2137 });
                }
            });
        }
    }

    setupMapControls() {
        this.addResetControl();
        this.addUndoRedoControls();
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

    // Autres méthodes de contrôle reprises de googleMapsStore...
    addResetControl() { /* ... */ }
    addUndoRedoControls() { /* ... */ }
}

export const googleMapManager = new GoogleMapManager();