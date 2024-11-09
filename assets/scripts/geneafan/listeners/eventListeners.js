import { getFamilyTowns } from "../stores/state.js";
import configStore from "../stores/fanConfigStore.js";
import svgPanZoomStore from '../stores/svgPanZoomStore';
import { setupProtectedFeatureEventListeners } from "./protectedFeatures.js";
import {
    setupResponsiveTabs,
    setupTabResizeListener,
} from "./responsiveTabs.js";
import { displayPersonDetailsUI } from "../ui.js";
import { loadGedcomFile } from "../gedcom/gedcomFileHandler.js";
import { googleMapManager } from "../mapManager.js";
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
const showPersonDetailsHandler = (event) => {
    displayPersonDetailsUI(event.detail);
};

// Ajouter une fonction pour configurer et nettoyer
export function setupPersonDetailsListener() {
    document.addEventListener("showPersonDetails", showPersonDetailsHandler);
    
    return () => {
        document.removeEventListener("showPersonDetails", showPersonDetailsHandler);
    };
}

// Handle city link clicks with delegation
function handleCityLinkClick(event) {
    if (event.target.classList.contains("city-link")) {
        const townKey = event.target.dataset.townKey;
        const townDetails = getFamilyTowns()[townKey];
        const latitude = parseFloat(townDetails.latitude);
        const longitude = parseFloat(townDetails.longitude);

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            const marker = googleMapManager.markers[townKey];
            if (marker) {
                googleMapManager.map.setCenter(
                    new google.maps.LatLng(latitude, longitude)
                );
                googleMapManager.map.setZoom(10);
                if (!marker.infowindow) {
                    marker.infowindow = new google.maps.InfoWindow({
                        content: marker.getTitle(),
                    });
                }
                marker.infowindow.open(googleMapManager.map, marker);
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
    const cleanupFunctions = [];

    document.querySelectorAll(".parameter").forEach((item) => {
        const oldHandler = item._changeHandler;
        if (oldHandler) {
            item.removeEventListener("change", oldHandler);
        }

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
        
        cleanupFunctions.push(() => {
            item.removeEventListener("change", handleParameterChange);
            delete item._changeHandler;
        });
    });

    // Gérer le sélecteur d'individu
    const individualSelect = document.getElementById("individual-select");
    if (individualSelect) {
        const changeHandler = () => {
            const selectedRoot = individualSelect.value;
            configStore.setConfig({ root: selectedRoot });
        };
        
        individualSelect.addEventListener("change", changeHandler);
        cleanupFunctions.push(() => {
            individualSelect.removeEventListener("change", changeHandler);
        });
    }

    return () => cleanupFunctions.forEach(cleanup => cleanup());
}

// Setup person link event listener with delegation
export function setupPersonLinkEventListener() {
    const tomSelect = configStore.tomSelect;
    if (!tomSelect) {
        console.error("tomSelect is undefined");
        return () => {}; // Retourner une fonction de nettoyage vide en cas d'erreur
    }

    // Créer le gestionnaire d'événements
    const handlePersonLinkClick = (event) => {
        const personLink = event.target.closest(".person-link"); // Utiliser closest pour une meilleure délégation
        if (!personLink) return;
        
        event.preventDefault();
        const personId = personLink.getAttribute("data-person-id");
        
        // Vérifier si tomSelect est toujours disponible
        if (!tomSelect || !tomSelect.dropdown_content) {
            console.error("tomSelect or its dropdown is no longer available");
            return;
        }

        // Mettre à jour la valeur sélectionnée
        try {
            tomSelect.setValue(personId);
            const changeEvent = new Event("change", { bubbles: true });
            tomSelect.dropdown_content.dispatchEvent(changeEvent);
        } catch (error) {
            console.error("Error updating tomSelect value:", error);
        }

        // Gérer les instances Offcanvas
        try {
            const individualMapContainer = document.getElementById("individualMapContainer");
            const personDetails = document.getElementById("personDetails");

            // Récupérer et cacher les instances Offcanvas si elles existent
            const mapOffcanvas = individualMapContainer && Offcanvas.getInstance(individualMapContainer);
            const detailsOffcanvas = personDetails && Offcanvas.getInstance(personDetails);

            if (mapOffcanvas && individualMapContainer.classList.contains("show")) {
                mapOffcanvas.hide();
            }

            if (detailsOffcanvas && personDetails.classList.contains("show")) {
                detailsOffcanvas.hide();
            }
        } catch (error) {
            console.error("Error handling Offcanvas instances:", error);
        }
    };

    // Ajouter l'écouteur d'événements avec délégation au niveau du document
    document.addEventListener("click", handlePersonLinkClick);

    // Retourner une fonction de nettoyage
    return () => {
        // Supprimer l'écouteur d'événements
        document.removeEventListener("click", handlePersonLinkClick);
        
        // Nettoyer les références si nécessaire
        if (tomSelect) {
            // Éviter les fuites de mémoire potentielles
            // Note : Ne pas détruire tomSelect ici car il peut être utilisé ailleurs
            // La gestion du cycle de vie de tomSelect devrait être faite au niveau du store
        }
    };
}

// Update UI after undo/redo actions
function updateUIAfterUndoRedo() {
    const root = configStore.getConfig.root;
    if (root) {
        const tomSelect = configStore.tomSelect; // Utiliser directement tomSelect du store
        if (tomSelect) {
            try {
                tomSelect.setValue(root);
                const changeEvent = new Event("change", { bubbles: true });
                tomSelect.dropdown_content.dispatchEvent(changeEvent);
            } catch (error) {
                console.error("Error updating tomSelect during undo/redo:", error);
            }
        } else {
            console.error("tomSelect is not available in configStore");
        }
    }
}

// Setup undo/redo event listeners
function setupUndoRedoEventListeners() {
    const undoButton = document.getElementById("undoButton");
    const redoButton = document.getElementById("redoButton");
    
    if (!undoButton || !redoButton) {
        console.error("Undo/Redo buttons not found");
        return () => {}; // Retourner une fonction de nettoyage vide
    }

    const undoHandler = () => {
        configStore.undo();
        updateUIAfterUndoRedo();
    };
    
    const redoHandler = () => {
        configStore.redo();
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

    // Ajouter les event listeners
    undoButton.addEventListener("click", undoHandler);
    redoButton.addEventListener("click", redoHandler);
    document.addEventListener("keydown", keydownHandler);

    // Store references in WeakMap
    eventListenersMap.set(undoButton, undoHandler);
    eventListenersMap.set(redoButton, redoHandler);
    eventListenersMap.set(document, keydownHandler);

    // Retourner une fonction de nettoyage
    return () => {
        undoButton.removeEventListener("click", undoHandler);
        redoButton.removeEventListener("click", redoHandler);
        document.removeEventListener("keydown", keydownHandler);
        
        // Nettoyer les références dans la WeakMap
        eventListenersMap.delete(undoButton);
        eventListenersMap.delete(redoButton);
        eventListenersMap.delete(document);
    };
}

// Setup fullscreen toggle
function setupFullscreenToggle() {
    const fullscreenButton = document.getElementById("fullscreenButton");
    const fanContainer = document.getElementById("fanContainer");
    const fan = document.getElementById("fan");

    const fullscreenHandler = () => {
        if (screenfull.isEnabled) {
            screenfull.toggle(fanContainer);
        }
    };

    fullscreenButton.addEventListener("click", fullscreenHandler);

    if (screenfull.isEnabled) {
        screenfull.on("change", () => {
            const isFullscreen = screenfull.isFullscreen;
            
            // Mettre à jour l'état du plein écran dans le store
            svgPanZoomStore.setFullscreen(isFullscreen);
            
            // Mettre à jour la vue
            svgPanZoomStore.updateViewport();

            // Configurer les événements de souris pour le mode plein écran
            if (fan) {
                const handleMouseDown = () => svgPanZoomStore.setGrabbing(true);
                const handleMouseUp = () => svgPanZoomStore.setGrabbing(false);

                if (isFullscreen) {
                    fan.addEventListener("mousedown", handleMouseDown);
                    fan.addEventListener("mouseup", handleMouseUp);
                    // Stocker les références des handlers pour le nettoyage
                    fan._mouseHandlers = { handleMouseDown, handleMouseUp };
                } else {
                    // Nettoyer les événements lors de la sortie du plein écran
                    const handlers = fan._mouseHandlers;
                    if (handlers) {
                        fan.removeEventListener("mousedown", handlers.handleMouseDown);
                        fan.removeEventListener("mouseup", handlers.handleMouseUp);
                        delete fan._mouseHandlers;
                    }
                }
            }
        });
    }

    // Nettoyer les événements lors du démontage
    return () => {
        if (screenfull.isEnabled) {
            screenfull.off("change");
        }
        fullscreenButton.removeEventListener("click", fullscreenHandler);
        
        // Nettoyer les événements de souris si nécessaire
        if (fan && fan._mouseHandlers) {
            const handlers = fan._mouseHandlers;
            fan.removeEventListener("mousedown", handlers.handleMouseDown);
            fan.removeEventListener("mouseup", handlers.handleMouseUp);
            delete fan._mouseHandlers;
        }
    };
}

// Function to initialize file loading event listeners
const setupFileLoadingEventListeners = () => {
    const cleanupFunctions = [];
    
    // Gestionnaire des fichiers de démo
    const remoteFileElements = document.getElementsByClassName("remote-file");
    Array.from(remoteFileElements).forEach(element => {
        const clickHandler = function(e) {
            loadGedcomFile(e.target.getAttribute("data-link"));
            return false;
        };
        
        element.addEventListener("click", clickHandler);
        cleanupFunctions.push(() => {
            element.removeEventListener("click", clickHandler);
        });
    });

    // Gestionnaire du chargement de fichier utilisateur
    const fileInput = document.getElementById("file");
    if (fileInput) {
        const changeHandler = function(e) {
            loadGedcomFile(e.target.files);
        };
        
        fileInput.addEventListener("change", changeHandler);
        cleanupFunctions.push(() => {
            fileInput.removeEventListener("change", changeHandler);
        });
    }

    return () => cleanupFunctions.forEach(cleanup => cleanup());
};

// Setup tab and UI event listeners
function setupTabAndUIEventListeners() {
    const cleanupFunctions = [];

    // Gestionnaire des éléments du dropdown
    const dropdownElements = document.querySelectorAll(".dropdown-menu a");
    dropdownElements.forEach((element) => {
        const clickHandler = function() {
            const dropdownButton = this.closest(".dropdown");
            dropdownButton.classList.remove("show");
            dropdownButton.querySelector(".dropdown-menu").classList.remove("show");
        };

        element.addEventListener("click", clickHandler);
        cleanupFunctions.push(() => {
            element.removeEventListener("click", clickHandler);
        });
    });

    // Gestionnaire de l'onglet Fan
    const tabFan = document.querySelector('[href="#tab1"]');
    if (tabFan) {
        const tabFanHandler = () => {
            configStore.handleSettingChange();
        };
        
        tabFan.addEventListener("shown.bs.tab", tabFanHandler);
        cleanupFunctions.push(() => {
            tabFan.removeEventListener("shown.bs.tab", tabFanHandler);
        });
    }

    // Gestionnaire de l'onglet Family Map
    const tabFamilyMap = document.querySelector('[href="#tab2"]');
    if (tabFamilyMap) {
        const tabFamilyMapHandler = () => {
            if (googleMapManager.map) {
                googleMapManager.moveMapToContainer("tab2");
                googleMapManager.activateMapMarkers();
                google.maps.event.trigger(googleMapManager.map, "resize");
                googleMapManager.map.setCenter({ lat: 46.2276, lng: 2.2137 });
            }
        };

        tabFamilyMap.addEventListener("show.bs.tab", tabFamilyMapHandler);
        cleanupFunctions.push(() => {
            tabFamilyMap.removeEventListener("show.bs.tab", tabFamilyMapHandler);
        });
    }

    // Gestionnaire des paramètres Fan
    const fanParametersDisplay = document.getElementById("fanParametersDisplay");
    if (fanParametersDisplay) {
        const fanParametersHandler = () => {
            const fanParametersOffcanvas = new Offcanvas(
                document.getElementById("fanParameters")
            );
            fanParametersOffcanvas.show();
        };

        fanParametersDisplay.addEventListener("click", fanParametersHandler);
        cleanupFunctions.push(() => {
            fanParametersDisplay.removeEventListener("click", fanParametersHandler);
        });
    }

    // Gestionnaire des paramètres Tree
    const treeParametersDisplay = document.getElementById("treeParametersDisplay");
    if (treeParametersDisplay) {
        const treeParametersHandler = () => {
            const treeParametersOffcanvas = new Offcanvas(
                document.getElementById("treeParameters")
            );
            treeParametersOffcanvas.show();
        };

        treeParametersDisplay.addEventListener("click", treeParametersHandler);
        cleanupFunctions.push(() => {
            treeParametersDisplay.removeEventListener("click", treeParametersHandler);
        });
    }

    // Setup du fullscreen et des tooltips
    const fullscreenCleanup = setupFullscreenToggle();
    if (fullscreenCleanup) cleanupFunctions.push(fullscreenCleanup);

    const tooltipsCleanup = setupTooltips();
    if (tooltipsCleanup) cleanupFunctions.push(tooltipsCleanup);

    return () => cleanupFunctions.forEach(cleanup => cleanup());
}

/**
 * Function to set up all event listeners.
 *
 * @param {AuthStore} authStore - Instance of the MobX store for authentication.
 */
let eventListenersInitialized = false;

export const setupAllEventListeners = (authStore) => {
    if (eventListenersInitialized) {
        return;
    }
    eventListenersInitialized = true;

    const cleanupFunctions = [];

    const initializeEventListeners = () => {
        try {
            // Document click handler
            const documentClickHandler = (event) => {
                handleCityLinkClick(event);
                closePopoverOnClickOutside(event);
            };
            document.addEventListener("click", documentClickHandler);
            cleanupFunctions.push(() => {
                document.removeEventListener("click", documentClickHandler);
            });
    
            // Setup des listeners principaux avec leurs fonctions de nettoyage
            const fanParametersCleanup = setupFanParameterEventListeners();
            if (fanParametersCleanup) cleanupFunctions.push(fanParametersCleanup);
    
            const personLinkCleanup = setupPersonLinkEventListener();
            if (personLinkCleanup) cleanupFunctions.push(personLinkCleanup);
    
            const fullscreenCleanup = setupFullscreenToggle();
            if (fullscreenCleanup) cleanupFunctions.push(fullscreenCleanup);
    
            const personDetailsCleanup = setupPersonDetailsListener();
            if (personDetailsCleanup) cleanupFunctions.push(personDetailsCleanup);
    
            const fileLoadingCleanup = setupFileLoadingEventListeners();
            if (fileLoadingCleanup) cleanupFunctions.push(fileLoadingCleanup);
    
            // Setup undo/redo avec sa fonction de nettoyage
            const undoRedoCleanup = setupUndoRedoEventListeners();
            if (undoRedoCleanup) cleanupFunctions.push(undoRedoCleanup);
    
            // Setup des onglets et de l'interface utilisateur
            const tabAndUICleanup = setupTabAndUIEventListeners();
            if (tabAndUICleanup) cleanupFunctions.push(tabAndUICleanup);
    
            // Setup des tabs responsives
            const responsiveTabsCleanup = setupResponsiveTabs();
            if (responsiveTabsCleanup) cleanupFunctions.push(responsiveTabsCleanup);
    
            const tabResizeCleanup = setupTabResizeListener();
            if (tabResizeCleanup) cleanupFunctions.push(tabResizeCleanup);
    
            // Setup des fonctionnalités protégées
            const protectedFeaturesCleanup = setupProtectedFeatureEventListeners(authStore);
            if (protectedFeaturesCleanup) cleanupFunctions.push(protectedFeaturesCleanup);
    
            console.log('Tous les event listeners ont été initialisés avec succès');
        } catch (error) {
            console.error('Erreur lors de l\'initialisation des event listeners:', error);
            // Nettoyer les listeners déjà configurés en cas d'erreur
            cleanupFunctions.forEach(cleanup => {
                if (typeof cleanup === 'function') {
                    try {
                        cleanup();
                    } catch (cleanupError) {
                        console.error('Erreur lors du nettoyage:', cleanupError);
                    }
                }
            });
            throw error; // Propager l'erreur pour la gestion en amont
        }
    };

    // Gestion du chargement du document
    if (document.readyState === "loading") {
        const loadHandler = () => {
            initializeEventListeners();
            document.removeEventListener("DOMContentLoaded", loadHandler);
        };
        document.addEventListener("DOMContentLoaded", loadHandler);
        cleanupFunctions.push(() => {
            document.removeEventListener("DOMContentLoaded", loadHandler);
        });
    } else {
        initializeEventListeners();
    }

    // Retourner une fonction de nettoyage globale
    return () => {
        eventListenersInitialized = false;
        cleanupFunctions.forEach(cleanup => {
            if (typeof cleanup === 'function') {
                try {
                    cleanup();
                } catch (error) {
                    console.error('Error during cleanup:', error);
                }
            }
        });
    };
};


