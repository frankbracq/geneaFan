import { handleUploadAndPost } from './downloads.js';
import { displayPersonDetailsUI, onSettingChange } from './ui.js';
import { googleMapManager } from './mapManager.js';
import { Tooltip, Offcanvas, Modal } from 'bootstrap'
import screenfull from 'screenfull';
import { getFamilyTowns, getSvgPanZoomInstance, getTomSelectInstance } from './state.js';
import { action } from 'mobx'; 
import configStore from './store';

// Gestionnaire pour la soumission de l'email
export async function handleEmailSubmit(rootPersonName) {
    try {
        const response = await fetch('https://emailvalidation.genealogie.workers.dev/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: document.getElementById("userEmailInput").value })
        });
        const data = await response.json();
        if (data.result === "ok" || data.result === "ok_for_all") {
            const userEmail = document.getElementById("userEmailInput").value;
            localStorage.setItem("userEmail", userEmail);
            const emailModal = new Modal(document.getElementById('emailModal'));
            emailModal.hide();
            handleUploadAndPost(rootPersonName, userEmail); 
        } else {
            alert("L'adresse de courriel indiquée n'a pu être validée. Veuillez modifier votre saisie.");
        }
    } catch (error) {
        alert("Erreur lors de la validation de l'email. Veuillez recommencer.");
    }
}

export function setupTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(tooltipTriggerEl => {
        new Tooltip(tooltipTriggerEl, { 
            html: true // Activer le support HTML dans les tooltips
        });
    });
}

// Listener for custom 'showPersonDetails' event
document.addEventListener('showPersonDetails', function(event) {
    displayPersonDetailsUI(event.detail);
});

// Fonction pour gérer les clics sur les liens des villes
function handleCityLinkClick(event) {
    if (event.target.classList.contains('city-link')) {
        const townKey = event.target.dataset.townKey;
        const townDetails = getFamilyTowns()[townKey];  // Ensure this function returns a valid object

        // Convert latitude and longitude to float numbers
        const latitude = parseFloat(townDetails.latitude);
        const longitude = parseFloat(townDetails.longitude);

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            const marker = googleMapManager.markers[townKey];
            if (marker) {
                // Center the map on the marker and adjust the zoom level
                googleMapManager.map.setCenter(new google.maps.LatLng(latitude, longitude));
                googleMapManager.map.setZoom(10);

                // Check for an existing InfoWindow or create a new one
                if (!marker.infowindow) {
                    marker.infowindow = new google.maps.InfoWindow({
                        content: marker.getTitle()  // Assumes getTitle() method is properly implemented
                    });
                }

                // Open the InfoWindow associated with the marker
                marker.infowindow.open(googleMapManager.map, marker);
            } else {
                console.error("No marker found for this town key:", townKey);
            }
        } else {
            console.error("Invalid latitude or longitude values", townDetails);
        }
    }
}

// Fonction pour fermer le popover en cliquant à l'extérieur
function closePopoverOnClickOutside(event) {
    const popover = document.getElementById('customPopover');
    if (popover && !popover.contains(event.target)) {
        popover.style.display = 'none';
    }
}

// Action pour mettre à jour la configuration
const updateConfig = action((newConfig) => {
    configStore.setConfig(newConfig);
});

export function setupParameterEventListeners(onSettingChange) {
    document.querySelectorAll('.parameter').forEach(item => {
        item.addEventListener('change', onSettingChange);
    });

    // Event listener for the root selection dropdown
    const individualSelect = document.getElementById('individual-select');
    if (individualSelect) {
        individualSelect.addEventListener('change', () => {
            const selectedRoot = individualSelect.value;
            updateConfig({ root: selectedRoot });  // Use the MobX action to update the store
        });
    }
}

// Event listener for person links
export function setupPersonLinkEventListener() {
    const tomSelect = getTomSelectInstance();
    if (!tomSelect) {
        console.error('tomSelect is undefined');
        return;
    }

    document.addEventListener('click', function(event) {
        const target = event.target;
        if (target.matches('.person-link')) {
            event.preventDefault();
            const personId = target.getAttribute('data-person-id');
            tomSelect.setValue(personId);
            const changeEvent = new Event('change', { bubbles: true });
            tomSelect.dropdown_content.dispatchEvent(changeEvent);

            // Fermer les offcanvas si ouverts
            const individualMapContainer = document.getElementById('individualMapContainer');
            const personDetails = document.getElementById('personDetails');

            if (individualMapContainer && individualMapContainer.classList.contains('show')) {
                Offcanvas.getInstance(individualMapContainer).hide();
            }

            if (personDetails && personDetails.classList.contains('show')) {
                Offcanvas.getInstance(personDetails).hide();
            }
        }
    });
}

function setupFullscreenToggle() {
    const fullscreenButton = document.getElementById('fullscreenButton');
    const fanContainer = document.getElementById('fanContainer');

    fullscreenButton.addEventListener('click', function() {
        if (screenfull.isEnabled) {
            screenfull.toggle(fanContainer);
        }
    });

    if (screenfull.isEnabled) {
        screenfull.on('change', () => {
            const panZoomInstance = getSvgPanZoomInstance();
            panZoomInstance.updateBBox();
            panZoomInstance.fit();
            panZoomInstance.center();
    
            const fan = document.getElementById('fan');
    
            if (screenfull.isFullscreen) {
                panZoomInstance.disableDblClickZoom(false);
    
                fan.addEventListener('mousedown', function() {
                    fan.style.cursor = 'grabbing';
                });
    
                fan.addEventListener('mouseup', function() {
                    fan.style.cursor = 'grab';
                });
            } else {
                panZoomInstance.enableDblClickZoom(true);
                panZoomInstance.reset();
                // Remove the mousedown and mouseup event listeners when not in fullscreen
                fan.style.cursor = 'default';
                fan.removeEventListener('mousedown', function() {});
                fan.removeEventListener('mouseup', function() {});
            }
        });
    }
}

function setupTabAndUIEventListeners() {
    document.querySelectorAll('.dropdown-menu a').forEach(element => {
        element.addEventListener('click', function() {
            var dropdownButton = this.closest('.dropdown');
            dropdownButton.classList.remove('show');
            dropdownButton.querySelector('.dropdown-menu').classList.remove('show');
        });
    });

    const tabFan = document.querySelector('[href="#tab1"]');
    if (tabFan) {
        tabFan.addEventListener('shown.bs.tab', function () {
            onSettingChange(); 
        });
    }

    const tabFamilyMap = document.querySelector('[href="#tab2"]');
    if (tabFamilyMap) {
        tabFamilyMap.addEventListener('show.bs.tab', function (e) {
            if (googleMapManager.map) {
                googleMapManager.moveMapToContainer('tab2');
                googleMapManager.activateMapMarkers();
                google.maps.event.trigger(googleMapManager.map, 'resize');
                googleMapManager.map.setCenter({ lat: 46.2276, lng: 2.2137 });
            }
        });
    }

    document.getElementById('fanParametersDisplay').addEventListener('click', function() {
        var fanParametersOffcanvas = new Offcanvas(document.getElementById('fanParameters'));
        fanParametersOffcanvas.show();
    });

    document.getElementById('treeParametersDisplay').addEventListener('click', function() {
        var treeParametersOffcanvas = new Offcanvas(document.getElementById('treeParameters'));
        treeParametersOffcanvas.show();
    });

    setupFullscreenToggle();
    setupTooltips();
}

let handleCityLinkClickRef = event => handleCityLinkClick(event);
let closePopoverOnClickOutsideRef = event => closePopoverOnClickOutside(event);

// Fonction principale pour configurer tous les écouteurs d'événements
export const setupAllEventListeners = () => {
    const initializeEventListeners = () => {
        document.addEventListener('click', event => {
            handleCityLinkClick(event);
            closePopoverOnClickOutside(event);
        });

        // Paramètres et écouteurs d'événements liés aux paramètres déjà existants
        setupParameterEventListeners(onSettingChange);

        // Ajouter les écouteurs spécifiques aux onglets et autres UI nécessitant le DOM chargé
        setupTabAndUIEventListeners();
    };

    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', initializeEventListeners);
    } else {
        initializeEventListeners();
    }
}

export function setupAdvancedModal(modalPath) {
    $('#advanced-parameters').click(function() {
        $('#advancedModal').load(modalPath, function() {
            $(this).modal('show');
        });
    });
}