import familyTownsStore from "../gedcom/familyTownsStore.js";
import { getSvgPanZoomInstance } from "../common/stores/state.js";
import configStore from "../tabs/fanChart/fanConfigStore.js";
import rootPersonStore from "../common/stores/rootPersonStore.js"; // Nouveau import
import { setupProtectedFeatureEventListeners } from "./protectedFeatures.js";
import {
    setupResponsiveTabs,
    setupTabResizeListener,
} from "./responsiveTabs.js";
import { displayPersonDetailsUI } from "../ui.js";
import { loadGedcomFile } from "../gedcom/gedcomFileHandler.js";
import { googleMapsStore } from '../tabs/familyMap/googleMapsStore.js';
import { Offcanvas, Tooltip } from "bootstrap";
import screenfull from "screenfull";

// WeakMap to store event listener references
const eventListenersMap = new WeakMap();

// Setup tooltips with HTML support
export function setupTooltips() {
    const tooltipTriggerList = document.querySelectorAll(
        '[data-bs-toggle="tooltip"]'
    );
    tooltipTriggerList.forEach((tooltipTriggerEl) => {
        new Tooltip(tooltipTriggerEl, { html: true });
    });
}

// Listener for custom 'showPersonDetails' event
document.addEventListener("showPersonDetails", (event) => {
    displayPersonDetailsUI(event.detail);
});

// Handle city link clicks with delegation
function handleCityLinkClick(event) {
    if (event.target.classList.contains("city-link")) {
        const townKey = event.target.dataset.townKey;
        const townDetails = familyTownsStore.getTown(townKey);
        const latitude = parseFloat(townDetails.latitude);
        const longitude = parseFloat(townDetails.longitude);

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            const marker = googleMapsStore.allMarkers[townKey];
            if (marker) {
                googleMapsStore.map.setCenter(
                    new google.maps.LatLng(latitude, longitude)
                );
                googleMapsStore.map.setZoom(10);
                if (!marker.infowindow) {
                    marker.infowindow = new google.maps.InfoWindow({
                        content: marker.getTitle(),
                    });
                }
                marker.infowindow.open(googleMapsStore.map, marker);
            } else {
                console.error("No marker found for this town key:", townKey);
            }
        } else {
            console.error("Invalid latitude or longitude values", townDetails);
        }
    }
}

// Close popover on outside click
function closePopoverOnClickOutside(event) {
    const popover = document.getElementById("customPopover");
    if (popover && !popover.contains(event.target)) {
        popover.style.display = "none";
    }
}

// Setup fan parameter event listeners
export function setupFanParameterEventListeners() {
    document.querySelectorAll(".parameter").forEach((item) => {
        // Supprimer l'ancien écouteur d'événements s'il existe
        const oldHandler = item._changeHandler;
        if (oldHandler) {
            item.removeEventListener("change", oldHandler);
        }

        // Créer un nouveau gestionnaire d'événements
        const handleParameterChange = (event) => {
            const input = event.target;
            console.log("Input type:", input.type);
            console.log("Input name:", input.name);
            console.log("Raw value:", input.value);

            // Convertir les valeurs "true"/"false" en booléens pour certains paramètres
            let value;
            const booleanParameters = [
                "showMarriages",
                "invert-text-arc",
                "showMissing",
            ];

            if (booleanParameters.includes(input.name)) {
                value = input.value === "true";
            } else if (
                input.type === "number" ||
                ["fanAngle", "max-generations"].includes(input.name)
            ) {
                value = parseInt(input.value, 10);
            } else {
                value = input.value;
            }

            // Mapping des noms de paramètres pour correspondre à ceux du store
            const parameterMapping = {
                showMarriages: "showMarriages",
                "invert-text-arc": "invertTextArc",
                showMissing: "showMissing",
                fanAngle: "fanAngle",
                "max-generations": "maxGenerations",
                fanColor: "coloringOption",
            };

            const storeParamName = parameterMapping[input.name];
            if (!storeParamName) {
                console.warn("Unknown parameter:", input.name);
                return;
            }

            console.log(
                `Updating ${storeParamName} with value:`,
                value,
                `(type: ${typeof value})`
            );
            configStore.updateFanParameter(storeParamName, value);
        };

        // Sauvegarder la référence du gestionnaire et ajouter l'écouteur
        item._changeHandler = handleParameterChange;
        item.addEventListener("change", handleParameterChange);
    });

    // Gérer le sélecteur d'individu
    const individualSelect = document.getElementById("individual-select");
    if (individualSelect) {
        individualSelect.addEventListener("change", () => {
            const selectedRoot = individualSelect.value;
            rootPersonStore.setRoot(selectedRoot); // Utiliser rootPersonStore au lieu de configStore
        });
    }
}

// Setup person link event listener with delegation
export function setupPersonLinkEventListener() {
    const tomSelect = rootPersonStore.tomSelect; // Utiliser rootPersonStore
    if (!tomSelect) {
        console.error("tomSelect is undefined");
        return;
    }

    document.addEventListener("click", (event) => {
        if (event.target.matches(".person-link")) {
            event.preventDefault();
            const personId = event.target.getAttribute("data-person-id");
            rootPersonStore.setTomSelectValue(personId); // Utiliser rootPersonStore

            const individualMapContainer = document.getElementById(
                "individualMapContainer"
            );
            const personDetails = document.getElementById("personDetails");
            if (individualMapContainer?.classList.contains("show")) {
                Offcanvas.getInstance(individualMapContainer).hide();
            }
            if (personDetails?.classList.contains("show")) {
                Offcanvas.getInstance(personDetails).hide();
            }
        }
    });
}

// Update UI after undo/redo actions
function updateUIAfterUndoRedo() {
    const root = rootPersonStore.root; // Utiliser rootPersonStore
    if (root) {
        const tomSelect = rootPersonStore.tomSelect; // Utiliser rootPersonStore
        if (tomSelect) {
            rootPersonStore.setTomSelectValue(root);
        } else {
            console.error("tomSelect is undefined");
        }
    }
}

// Setup undo/redo event listeners
function setupUndoRedoEventListeners() {
    const undoHandler = () => {
        rootPersonStore.undo(); // Utiliser rootPersonStore
        updateUIAfterUndoRedo();
    };
    const redoHandler = () => {
        rootPersonStore.redo(); // Utiliser rootPersonStore
        updateUIAfterUndoRedo();
    };
    const keydownHandler = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
            event.preventDefault();
            undoHandler();
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
            event.preventDefault();
            redoHandler();
        }
    };

    document.getElementById("undoButton").addEventListener("click", undoHandler);
    document.getElementById("redoButton").addEventListener("click", redoHandler);
    document.addEventListener("keydown", keydownHandler);

    // Store references in WeakMap
    eventListenersMap.set(document.getElementById("undoButton"), undoHandler);
    eventListenersMap.set(document.getElementById("redoButton"), redoHandler);
    eventListenersMap.set(document, keydownHandler);
}

// Setup fullscreen toggle
function setupFullscreenToggle() {
    const fullscreenButton = document.getElementById("fullscreenButton");
    const fanContainer = document.getElementById("fanContainer");

    const fullscreenHandler = () => {
        if (screenfull.isEnabled) {
            screenfull.toggle(fanContainer);
        }
    };

    fullscreenButton.addEventListener("click", fullscreenHandler);

    if (screenfull.isEnabled) {
        screenfull.on("change", () => {
            const panZoomInstance = getSvgPanZoomInstance();
            panZoomInstance.updateBBox();
            panZoomInstance.fit();
            panZoomInstance.center();

            const fan = document.getElementById("fan");

            if (screenfull.isFullscreen) {
                panZoomInstance.disableDblClickZoom(false);

                const mousedownHandler = () => {
                    fan.style.cursor = "grabbing";
                };
                const mouseupHandler = () => {
                    fan.style.cursor = "grab";
                };

                fan.addEventListener("mousedown", mousedownHandler);
                fan.addEventListener("mouseup", mouseupHandler);

                // Store references in WeakMap
                eventListenersMap.set(fan, { mousedownHandler, mouseupHandler });
            } else {
                panZoomInstance.enableDblClickZoom(true);
                panZoomInstance.reset();
                fan.style.cursor = "default";

                const handlers = eventListenersMap.get(fan);
                if (handlers) {
                    fan.removeEventListener("mousedown", handlers.mousedownHandler);
                    fan.removeEventListener("mouseup", handlers.mouseupHandler);
                }
            }
        });
    }

    // Store reference in WeakMap
    eventListenersMap.set(fullscreenButton, fullscreenHandler);
}

// Function to initialize file loading event listeners
const setupFileLoadingEventListeners = () => {
    // Demo file loading
    Array.from(document.getElementsByClassName("remote-file")).forEach(function (
        element
    ) {
        element.addEventListener("click", function (e) {
            loadGedcomFile(e.target.getAttribute("data-link"));
            return false;
        });
    });

    // User file loading
    document.getElementById("file").addEventListener("change", function (e) {
        loadGedcomFile(e.target.files);
    });
};

// Setup tab and UI event listeners
function setupTabAndUIEventListeners() {
    document.querySelectorAll(".dropdown-menu a").forEach((element) => {
        element.addEventListener("click", function () {
            const dropdownButton = this.closest(".dropdown");
            dropdownButton.classList.remove("show");
            dropdownButton.querySelector(".dropdown-menu").classList.remove("show");
        });
    });

    const tabFan = document.querySelector('[href="#tab1"]');
    if (tabFan) {
        tabFan.addEventListener("shown.bs.tab", () => {
            configStore.handleSettingChange();
        });
    }

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

    document
        .getElementById("fanParametersDisplay")
        .addEventListener("click", () => {
            const fanParametersOffcanvas = new Offcanvas(
                document.getElementById("fanParameters")
            );
            fanParametersOffcanvas.show();
        });

    document
        .getElementById("treeParametersDisplay")
        .addEventListener("click", () => {
            const treeParametersOffcanvas = new Offcanvas(
                document.getElementById("treeParameters")
            );
            treeParametersOffcanvas.show();
        });

    setupFullscreenToggle();
    setupTooltips();
}

/**
 * Function to set up all event listeners.
 *
 * @param {AuthStore} authStore - Instance of the MobX store for authentication.
 */
let eventListenersInitialized = false;

export const setupAllEventListeners = (authStore) => {
    // Check if event listeners have already been initialized
    if (eventListenersInitialized) {
        return;
    }

    // Mark event listeners as initialized
    eventListenersInitialized = true;

    // Function to initialize all event listeners
    const initializeEventListeners = () => {
        // Add a click event listener to the document
        document.addEventListener("click", (event) => {
            handleCityLinkClick(event); // Handle city link clicks
            closePopoverOnClickOutside(event); // Close popovers when clicking outside
        });

        // Set up event listeners for fan parameters
        setupFanParameterEventListeners();
        // Set up event listeners for tabs and UI elements
        setupTabAndUIEventListeners();
        // Set up event listeners for file loading
        setupFileLoadingEventListeners();
        // Set up event listeners for undo and redo actions
        setupUndoRedoEventListeners();
        // Set up responsive tabs and tab resize listener after a short delay
        setTimeout(() => {
            setupResponsiveTabs();
            setupTabResizeListener();
        }, 0);

        // Call the function to set up event listeners for protected features using the MobX store
        setupProtectedFeatureEventListeners(authStore);
    };

    // Check if the document is still loading
    if (document.readyState === "loading") {
        // If the document is loading, set up event listeners after the DOM content is loaded
        document.addEventListener("DOMContentLoaded", initializeEventListeners);
    } else {
        // If the document is already loaded, initialize event listeners immediately
        initializeEventListeners();
    }
};

/*
// Setup advanced modal
export function setupAdvancedModal(modalPath) {
    $('#advanced-parameters').click(function() {
        $('#advancedModal').load(modalPath, function() {
            $(this).modal('show');
        });
    });
}*/
