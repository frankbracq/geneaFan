import {getFamilyTowns, getSvgPanZoomInstance, getTomSelectInstance} from '../stores/state.js';
import {action} from 'mobx';
import configStore from '../stores/configStore.js';
import { setupProtectedFeatureEventListeners } from './protectedFeatures.js'; 
import { setupResponsiveTabs, setupTabResizeListener } from './responsiveTabs.js';
import { displayPersonDetailsUI, onSettingChange } from '../ui.js';
import { loadGedcomFile } from '../gedcom/gedcomFileHandler.js';
import { googleMapManager } from '../mapManager.js';
import { Offcanvas, Tooltip } from 'bootstrap';
import screenfull from 'screenfull';

// WeakMap to store event listener references
const eventListenersMap = new WeakMap();

// Setup tooltips with HTML support
export function setupTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(tooltipTriggerEl => {
        new Tooltip(tooltipTriggerEl, { html: true });
    });
}

// Listener for custom 'showPersonDetails' event
document.addEventListener('showPersonDetails', event => {
    displayPersonDetailsUI(event.detail);
});

// Handle city link clicks with delegation
function handleCityLinkClick(event) {
    if (event.target.classList.contains('city-link')) {
        const townKey = event.target.dataset.townKey;
        const townDetails = getFamilyTowns()[townKey];
        const latitude = parseFloat(townDetails.latitude);
        const longitude = parseFloat(townDetails.longitude);

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            const marker = googleMapManager.markers[townKey];
            if (marker) {
                googleMapManager.map.setCenter(new google.maps.LatLng(latitude, longitude));
                googleMapManager.map.setZoom(10);
                if (!marker.infowindow) {
                    marker.infowindow = new google.maps.InfoWindow({
                        content: marker.getTitle()
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
    const popover = document.getElementById('customPopover');
    if (popover && !popover.contains(event.target)) {
        popover.style.display = 'none';
    }
}

// Update configuration action
const updateConfig = action(newConfig => {
    configStore.setConfig(newConfig);
});

// Setup parameter event listeners
export function setupParameterEventListeners() {
    document.querySelectorAll('.parameter').forEach(item => {
        item.addEventListener('change', onSettingChange);
    });

    const individualSelect = document.getElementById('individual-select');
    if (individualSelect) {
        individualSelect.addEventListener('change', () => {
            const selectedRoot = individualSelect.value;
            updateConfig({ root: selectedRoot });
        });
    }
}

// Setup person link event listener with delegation
export function setupPersonLinkEventListener() {
    const tomSelect = getTomSelectInstance();
    if (!tomSelect) {
        console.error('tomSelect is undefined');
        return;
    }

    document.addEventListener('click', event => {
        if (event.target.matches('.person-link')) {
            event.preventDefault();
            const personId = event.target.getAttribute('data-person-id');
            tomSelect.setValue(personId);
            const changeEvent = new Event('change', { bubbles: true });
            tomSelect.dropdown_content.dispatchEvent(changeEvent);

            const individualMapContainer = document.getElementById('individualMapContainer');
            const personDetails = document.getElementById('personDetails');
            if (individualMapContainer?.classList.contains('show')) {
                Offcanvas.getInstance(individualMapContainer).hide();
            }
            if (personDetails?.classList.contains('show')) {
                Offcanvas.getInstance(personDetails).hide();
            }
        }
    });
}

// Update UI after undo/redo actions
function updateUIAfterUndoRedo() {
    const root = configStore.getConfig.root;
    if (root) {
        const tomSelect = getTomSelectInstance();
        if (tomSelect) {
            tomSelect.setValue(root);
            const changeEvent = new Event('change', { bubbles: true });
            tomSelect.dropdown_content.dispatchEvent(changeEvent);
        } else {
            console.error('tomSelect is undefined');
        }
    }
}

// Setup undo/redo event listeners
function setupUndoRedoEventListeners() {
    const undoHandler = () => {
        configStore.undo();
        updateUIAfterUndoRedo();
    };
    const redoHandler = () => {
        configStore.redo();
        updateUIAfterUndoRedo();
    };
    const keydownHandler = event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            undoHandler();
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
            event.preventDefault();
            redoHandler();
        }
    };

    document.getElementById('undoButton').addEventListener('click', undoHandler);
    document.getElementById('redoButton').addEventListener('click', redoHandler);
    document.addEventListener('keydown', keydownHandler);

    // Store references in WeakMap
    eventListenersMap.set(document.getElementById('undoButton'), undoHandler);
    eventListenersMap.set(document.getElementById('redoButton'), redoHandler);
    eventListenersMap.set(document, keydownHandler);
}

// Setup fullscreen toggle
function setupFullscreenToggle() {
    const fullscreenButton = document.getElementById('fullscreenButton');
    const fanContainer = document.getElementById('fanContainer');

    const fullscreenHandler = () => {
        if (screenfull.isEnabled) {
            screenfull.toggle(fanContainer);
        }
    };

    fullscreenButton.addEventListener('click', fullscreenHandler);

    if (screenfull.isEnabled) {
        screenfull.on('change', () => {
            const panZoomInstance = getSvgPanZoomInstance();
            panZoomInstance.updateBBox();
            panZoomInstance.fit();
            panZoomInstance.center();

            const fan = document.getElementById('fan');

            if (screenfull.isFullscreen) {
                panZoomInstance.disableDblClickZoom(false);

                const mousedownHandler = () => {
                    fan.style.cursor = 'grabbing';
                };
                const mouseupHandler = () => {
                    fan.style.cursor = 'grab';
                };

                fan.addEventListener('mousedown', mousedownHandler);
                fan.addEventListener('mouseup', mouseupHandler);

                // Store references in WeakMap
                eventListenersMap.set(fan, { mousedownHandler, mouseupHandler });
            } else {
                panZoomInstance.enableDblClickZoom(true);
                panZoomInstance.reset();
                fan.style.cursor = 'default';

                const handlers = eventListenersMap.get(fan);
                if (handlers) {
                    fan.removeEventListener('mousedown', handlers.mousedownHandler);
                    fan.removeEventListener('mouseup', handlers.mouseupHandler);
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
    Array.from(document.getElementsByClassName('remote-file')).forEach(function (element) {
        element.addEventListener('click', function (e) {
            loadGedcomFile(e.target.getAttribute('data-link'));
            return false;
        });
    });

    // User file loading
    document.getElementById('file').addEventListener('change', function (e) {
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
            onSettingChange();
        });
    }

    const tabFamilyMap = document.querySelector('[href="#tab2"]');
    if (tabFamilyMap) {
        tabFamilyMap.addEventListener("show.bs.tab", () => {
            if (googleMapManager.map) {
                googleMapManager.moveMapToContainer("tab2");
                googleMapManager.activateMapMarkers();
                google.maps.event.trigger(googleMapManager.map, "resize");
                googleMapManager.map.setCenter({ lat: 46.2276, lng: 2.2137 });
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
* Fonction pour configurer tous les écouteurs d'événements.
*
* @param {AuthStore} authStore - Instance du store MobX pour l'authentification.
*/
export const setupAllEventListeners = (authStore) => {
   const initializeEventListeners = () => {
       document.addEventListener('click', event => {
           handleCityLinkClick(event);
           closePopoverOnClickOutside(event);
       });

       setupParameterEventListeners();
       setupTabAndUIEventListeners();
       setupFileLoadingEventListeners();
       setupUndoRedoEventListeners();
       setTimeout(() => {
           setupResponsiveTabs();
           setupTabResizeListener();
       }, 0);

       // Appel de la fonction pour les fonctionnalités protégées via le store MobX
       setupProtectedFeatureEventListeners(authStore);
   };

   if (document.readyState === "loading") {
       document.addEventListener('DOMContentLoaded', initializeEventListeners);
   } else {
       initializeEventListeners();
   }
}

// Setup advanced modal
export function setupAdvancedModal(modalPath) {
    $('#advanced-parameters').click(function() {
        $('#advancedModal').load(modalPath, function() {
            $(this).modal('show');
        });
    });
}
