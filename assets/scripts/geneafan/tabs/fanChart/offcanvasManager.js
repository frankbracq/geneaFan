import { Offcanvas } from "bootstrap";
import { googleMapsStore } from "../familyMap/googleMapsStore.js";
import { storeEvents, EVENTS } from '../../gedcom/stores/storeEvents.js';

class OffcanvasManager {
    constructor() {
        this.personDetailsInstance = null;
        this.individualMapInstance = null;
        this.googleMapsReady = false;

        // Écouter l'état de l'API Google Maps
        storeEvents.subscribe(EVENTS.MAPS.API_READY, () => {
            console.log('✅ Google Maps API is ready');
            this.googleMapsReady = true;
        });

        storeEvents.subscribe(EVENTS.MAPS.API_ERROR, ({ error }) => {
            console.error('❌ Google Maps API failed to load:', error);
            this.googleMapsReady = false;
        });
    }

    getOffCanvasInstance(elementId, options) {
        let instance = Offcanvas.getInstance(document.getElementById(elementId));
        if (!instance) {
            instance = new Offcanvas(document.getElementById(elementId), options);
        }
        return instance;
    }

    showOffCanvasDetails() {
        const personDetailsElement = document.getElementById("personDetails");
        const individualMapContainerElement = document.getElementById("individualMapContainer");
        const mapElement = document.getElementById("individualMap");

        this.personDetailsInstance = this.getOffCanvasInstance("personDetails", {});
        this.individualMapInstance = this.getOffCanvasInstance("individualMapContainer", {
            backdrop: false
        });

        if (!this.googleMapsReady && mapElement) {
            console.warn('🚫 Google Maps not ready');
            mapElement.innerHTML = '<div class="alert alert-warning">Chargement de la carte en cours...</div>';
        }

        if (!this.personDetailsInstance._isShown) {
            this.personDetailsInstance.show();
        }
        if (!this.individualMapInstance._isShown) {
            this.individualMapInstance.show();
        }

        // Utiliser les méthodes liées pour préserver le contexte
        const boundHandleMapResize = this.handleMapResize.bind(this);
        const boundHandleOffcanvasHide = this.handleOffcanvasHide.bind(this);

        individualMapContainerElement.removeEventListener("shown.bs.offcanvas", boundHandleMapResize);
        individualMapContainerElement.addEventListener("shown.bs.offcanvas", boundHandleMapResize);

        personDetailsElement.removeEventListener("hidden.bs.offcanvas", boundHandleOffcanvasHide);
        personDetailsElement.addEventListener("hidden.bs.offcanvas", boundHandleOffcanvasHide);
    }

    async handleMapResize() {
        try {
            const offCanvasBody = document.querySelector("#individualMapContainer .offcanvas-body");
            const mapElement = document.getElementById("individualMap");
            
            if (!offCanvasBody || !mapElement) {
                console.warn('Required elements not found');
                return;
            }

            mapElement.style.height = `${offCanvasBody.clientHeight}px`;

            // On vérifie si l'API est prête
            if (!googleMapsStore.isApiLoaded) {
                await googleMapsStore.initializeApi();
            }

            // Si la carte n'existe pas, on l'initialise
            if (!googleMapsStore.map) {
                await googleMapsStore.initMap("individualMap");
            } else {
                // Sinon on déplace juste la carte dans le bon conteneur
                googleMapsStore.moveMapToContainer("individualMap");
            }

            // Rafraîchir et centrer la carte
            google.maps.event.trigger(googleMapsStore.map, "resize");
            googleMapsStore.map.setCenter({ lat: 46.2276, lng: 2.2137 });

        } catch (error) {
            console.error('❌ Error handling map resize:', error);
            const mapElement = document.getElementById("individualMap");
            if (mapElement) {
                mapElement.innerHTML = '<div class="alert alert-danger">Erreur lors de l\'affichage de la carte. Veuillez rafraîchir la page.</div>';
            }
        }
    }

    handleOffcanvasHide = () => {
        if (this.individualMapInstance) {
            this.individualMapInstance.hide();
        }
    };
}

export const offcanvasManager = new OffcanvasManager();