import familyTownsStore from "../gedcom/familyTownsStore.js";
import { getSvgPanZoomInstance } from "../common/stores/state.js";
import configStore from "../tabs/fanChart/fanConfigStore.js";
import rootPersonStore from "../common/stores/rootPersonStore.js";
import { setupProtectedFeatureEventListeners } from "./protectedFeatures.js";
import {
    setupResponsiveTabs,
    setupTabResizeListener,
} from "./responsiveTabs.js";
import { displayPersonDetailsUI } from "../tabs/fanChart/ui.js";
import { loadGedcomFile } from "../gedcom/gedcomFileHandler.js";
import { Offcanvas, Tooltip } from "bootstrap";
import screenfull from "screenfull";
import { FanChartManager } from "../tabs/fanChart/fanChartManager.js";

// Export standalone functions
export function setupPersonLinkEventListener() {
    console.log("Setting up person link event listener");
    
    document.addEventListener("click", (event) => {
        if (event.target.matches(".person-link")) {
            event.preventDefault();
            const personId = event.target.getAttribute("data-person-id");
            console.log("Person link clicked:", personId);

            rootPersonStore.setRoot(personId);

            if (rootPersonStore.tomSelect) {
                rootPersonStore.tomSelect.setValue(personId);
            }

            ["individualMapContainer", "personDetails"].forEach(id => {
                const element = document.getElementById(id);
                if (element?.classList.contains("show")) {
                    const instance = Offcanvas.getInstance(element);
                    if (instance) instance.hide();
                }
            });
        }
    });
}

class EventListenerStore {
    constructor() {
        this.eventListenersMap = new WeakMap();
        this.initialized = false;
    }

    // Ajout de la méthode initialize
    initialize(authStore) {
        if (this.initialized) {
            console.log("Event listeners already initialized");
            return;
        }

        console.log("Initializing event listeners");
        
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => this.initializeAll(authStore));
        } else {
            this.initializeAll(authStore);
        }

        this.initialized = true;
    }

    setupTooltips() {
        document.querySelectorAll('[data-bs-toggle="tooltip"]')
            .forEach(el => new Tooltip(el, { html: true }));
    }

    setupFanParameters() {
        const handleParameterChange = (event) => {
            const input = event.target;
            const value = this.parseInputValue(input);
            const storeParamName = this.mapParameterName(input.name);
            
            if (storeParamName) {
                console.log(`Updating ${storeParamName} with value:`, value);
                configStore.updateConfig({ [storeParamName]: value });
            }
        };

        document.querySelectorAll(".parameter").forEach(item => {
            if (item._changeHandler) {
                item.removeEventListener("change", item._changeHandler);
            }
            item._changeHandler = handleParameterChange;
            item.addEventListener("change", handleParameterChange);
        });
    }

    parseInputValue(input) {
        const booleanParameters = ["showMarriages", "invert-text-arc", "showMissing"];
        if (booleanParameters.includes(input.name)) {
            return input.value === "true";
        }
        if (input.type === "number" || ["fanAngle", "max-generations"].includes(input.name)) {
            return parseInt(input.value, 10);
        }
        return input.value;
    }

    mapParameterName(inputName) {
        const mapping = {
            showMarriages: "showMarriages",
            "invert-text-arc": "invertTextArc",
            showMissing: "showMissing",
            fanAngle: "fanAngle",
            "max-generations": "maxGenerations",
            fanColor: "coloringOption",
        };
        return mapping[inputName];
    }

    setupFileLoading() {
        // Chargement des fichiers de démonstration
        document.querySelectorAll(".remote-file").forEach(element => {
            element.addEventListener("click", (e) => {
                loadGedcomFile(e.target.getAttribute("data-link"));
                return false;
            });
        });

        // Chargement des fichiers utilisateur
        const fileInput = document.getElementById("file");
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                loadGedcomFile(e.target.files);
            });
        }
    }

    setupOverlayHandling() {
        document.addEventListener("click", (event) => {
            const popover = document.getElementById("customPopover");
            if (popover && !popover.contains(event.target)) {
                popover.style.display = "none";
            }
        });

        const loadingElement = document.getElementById("loading");
        const overlayElement = document.getElementById("overlay");

        if (loadingElement) {
            document.addEventListener("fileLoaded", () => {
                loadingElement.style.display = "none";
            });
        }

        if (overlayElement) {
            document.addEventListener("fileLoaded", () => {
                overlayElement.classList.add("overlay-hidden");
            });
        }
    }

    setupTabsAndUI() {
        // Gestion des dropdowns
        document.querySelectorAll(".dropdown-menu a").forEach(element => {
            element.addEventListener("click", function() {
                const dropdown = this.closest(".dropdown");
                dropdown.classList.remove("show");
                dropdown.querySelector(".dropdown-menu").classList.remove("show");
            });
        });

        // Gestion des onglets
        const tabFan = document.querySelector('[href="#tab1"]');
        if (tabFan) {
            tabFan.addEventListener("shown.bs.tab", () => {
                FanChartManager.redrawFan();
            });
        }

        // Configuration des panneaux de paramètres
        ["fan", "tree"].forEach(type => {
            const button = document.getElementById(`${type}ParametersDisplay`);
            const panel = document.getElementById(`${type}Parameters`);
            if (button && panel) {
                button.addEventListener("click", () => {
                    new Offcanvas(panel).show();
                });
            }
        });
    }

    initializeAll(authStore) {
        this.setupTooltips();
        this.setupFanParameters();
        setupPersonLinkEventListener(); // Utilisation de la fonction exportée
        this.setupFileLoading();
        this.setupOverlayHandling();
        this.setupTabsAndUI();
        
        setupProtectedFeatureEventListeners(authStore);
        setupResponsiveTabs();
        setupTabResizeListener();

        document.addEventListener("showPersonDetails", (event) => {
            displayPersonDetailsUI(event.detail);
        });
    }
}

// Export de l'instance unique
export const eventListenerStore = new EventListenerStore();

// Export des fonctions de compatibilité
export const setupAllEventListeners = (authStore) => {
    if (!authStore) {
        console.warn("Auth store not provided to setupAllEventListeners");
    }
    eventListenerStore.initialize(authStore);
};

export const setupTooltips = () => {
    eventListenerStore.setupTooltips();
};

export const setupFanParameterEventListeners = () => {
    eventListenerStore.setupFanParameters();
};