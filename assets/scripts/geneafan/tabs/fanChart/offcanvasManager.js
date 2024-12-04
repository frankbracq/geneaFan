import { Offcanvas } from "bootstrap";
import { googleMapsStore } from "../familyMap/googleMapsStore.js";

class OffcanvasManager {
    constructor() {
        this.personDetailsInstance = null;
        this.individualMapInstance = null;
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

        this.personDetailsInstance = this.getOffCanvasInstance("personDetails", {});
        this.individualMapInstance = this.getOffCanvasInstance("individualMapContainer", {
            backdrop: false
        });

        if (!this.personDetailsInstance._isShown) {
            this.personDetailsInstance.show();
        }
        if (!this.individualMapInstance._isShown) {
            this.individualMapInstance.show();
        }

        individualMapContainerElement.removeEventListener("shown.bs.offcanvas", this.handleMapResize);
        individualMapContainerElement.addEventListener("shown.bs.offcanvas", this.handleMapResize);

        personDetailsElement.removeEventListener("hidden.bs.offcanvas", this.handleOffcanvasHide);
        personDetailsElement.addEventListener("hidden.bs.offcanvas", this.handleOffcanvasHide);
    }

    handleMapResize() {
        const offCanvasBody = document.querySelector("#individualMapContainer .offcanvas-body");
        const mapElement = document.getElementById("individualMap");
        mapElement.style.height = `${offCanvasBody.clientHeight}px`;

        googleMapsStore.moveMapToContainer("individualMap");
        google.maps.event.trigger(googleMapsStore.map, "resize");
        googleMapsStore.map.setCenter({ lat: 46.2276, lng: 2.2137 });
    }

    handleOffcanvasHide = () => {
        if (this.individualMapInstance) {
            this.individualMapInstance.hide();
        }
    }
}

export const offcanvasManager = new OffcanvasManager();