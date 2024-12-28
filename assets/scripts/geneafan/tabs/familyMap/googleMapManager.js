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

        // Amélioration de l'autorun pour une meilleure réactivité
        const hierarchyDisposer = autorun(() => {
            try {
                const hierarchy = gedcomDataStore.getHierarchy();
                console.log('🔄 Autorun déclenché pour la hiérarchie:', 
                    hierarchy ? 'présente' : 'absent');

                // On vérifie que la carte est initialisée et qu'on a une hiérarchie
                if (this.initialized && hierarchy) {
                    console.log('✨ Mise à jour de la carte avec la nouvelle hiérarchie');
                    this.updateMapWithHierarchy(hierarchy);
                } else {
                    console.log('⏳ En attente de l\'initialisation de la carte ou de la hiérarchie',
                        {mapInitialized: this.initialized, hasHierarchy: !!hierarchy});
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

    // Nouvelle méthode pour gérer la mise à jour de la carte
    async updateMapWithHierarchy(hierarchy) {
        try {
            console.group('📍 Mise à jour de la carte');
            
            // Vérification que la carte est prête
            if (!googleMapsStore.map) {
                console.warn('⚠️ La carte n\'est pas encore prête');
                console.groupEnd();
                return;
            }

            // Traitement de la hiérarchie et mise à jour des marqueurs
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
                apiKey: googleMapsStore.apiKey,
                version: "weekly",
                libraries: []
            });

            await this.loader.load();
            this.initialized = true;

            // Initialiser la carte
            await this.initializeMap("familyMap");
            this.setupEventListeners();

            // Vérifier si une hiérarchie existe déjà et la traiter
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