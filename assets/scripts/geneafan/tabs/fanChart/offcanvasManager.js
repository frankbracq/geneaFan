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
        await googleMapsStore.resizeAndMoveMap("individualMap");
    }

    handleOffcanvasHide = () => {
        if (this.individualMapInstance) {
            this.individualMapInstance.hide();
        }
    };
}

export const offcanvasManager = new OffcanvasManager();