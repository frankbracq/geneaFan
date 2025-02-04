import { Offcanvas } from "bootstrap";

class OffcanvasManager {
    constructor() {
        this.personDetailsInstance = null;
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

        this.personDetailsInstance = this.getOffCanvasInstance("personDetails", {});

        if (!this.personDetailsInstance._isShown) {
            this.personDetailsInstance.show();
        }
    }
}

export const offcanvasManager = new OffcanvasManager();