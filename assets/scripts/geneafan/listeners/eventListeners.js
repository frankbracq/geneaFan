import { Offcanvas, Tooltip, Dropdown } from "bootstrap";
import { EVENTS, storeEvents } from '../gedcom/stores/storeEvents.js';
import rootPersonStore from "../common/stores/rootPersonStore.js"; 
import { setupProtectedFeatureEventListeners } from "./protectedFeatures.js";
import {
    setupResponsiveTabs,
    setupTabResizeListener,
} from "../tabs/responsiveTabs.js";
import { displayPersonDetailsUI } from "../tabs/fanChart/personDetailsDisplay.js";
import { loadGedcomFile } from "../gedcom/gedcomFileHandler.js";


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
/*
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
    */

// Close popover on outside click
function closePopoverOnClickOutside(event) {
    const popover = document.getElementById("customPopover");
    if (popover && !popover.contains(event.target)) {
        popover.style.display = "none";
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

    document
        .getElementById("fanParametersDisplay")
        .addEventListener("click", () => {
            const fanParametersOffcanvas = new Offcanvas(
                document.getElementById("fanParameters")
            );
            fanParametersOffcanvas.show();
        });

        document.getElementById("mapParametersDisplay")?.addEventListener("click", () => {
            const mapParameters = document.getElementById("mapParameters");
            if (mapParameters) {
                const offcanvas = new Offcanvas(mapParameters, {
                    backdrop: true,
                    keyboard: true,
                    scroll: false
                });
                offcanvas.show();
            }
        });

    document
        .getElementById("treeParametersDisplay")
        .addEventListener("click", () => {
            const treeParametersOffcanvas = new Offcanvas(
                document.getElementById("treeParameters")
            );
            treeParametersOffcanvas.show();
        });

    setupTooltips();
}

function setupAutoOpenGedcomMenu() {
    const gedcomMenu = document.getElementById('gedcomMenu');
    const dropdownMenu = document.querySelector('.dropdown-menu[aria-labelledby="gedcomMenu"]');
    
    if (gedcomMenu && dropdownMenu) {
        console.log('Setting up auto-open GEDCOM menu...');
        
        // Créer l'instance du dropdown
        const dropdownInstance = new Dropdown(gedcomMenu);
        
        // Ouvrir le menu automatiquement
        setTimeout(() => {
            dropdownInstance.show();
        }, 500); // Petit délai pour assurer que tout est bien chargé
        
        // Gérer la fermeture au clic extérieur
        document.addEventListener('click', (event) => {
            // Vérifier si le clic est en dehors du menu et de son contenu
            const isClickInside = gedcomMenu.contains(event.target) || 
                                dropdownMenu.contains(event.target);
                                
            // Si le clic est en dehors et que le menu est ouvert
            if (!isClickInside && dropdownMenu.classList.contains('show')) {
                dropdownInstance.hide();
            }
        });
        
        // Empêcher la fermeture lors de la sélection de fichier
        document.getElementById('file')?.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        
        // Garder le menu ouvert pendant le drag & drop d'un fichier
        dropdownMenu.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        
        dropdownMenu.addEventListener('drop', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        
        console.log('GEDCOM menu auto-open setup complete');
    } else {
        console.warn('GEDCOM menu elements not found');
    }
}

// Gestion du sélecteur d'individu
export const setupIndividualSelectorListener = () => {
    const individualSelect = document.getElementById("individual-select");
    if (individualSelect) {
        individualSelect.addEventListener("change", () => {
            const selectedRoot = individualSelect.value;
            rootPersonStore.setRoot(selectedRoot);
        });
    }
};

/**
 * Initialise le comportement du header et des onglets
 * @function initializeHeaderBehavior
 */
function initializeHeaderBehavior() {
    // Récupération des éléments
    const tabItems = document.querySelectorAll('#tab-nav .nav-item');
    const moreBtn = document.getElementById('more-tab-btn');
    const moreDrawer = document.getElementById('more-drawer');
    const toolsButton = document.getElementById('toolsButton');
    
    // Fonction pour ajuster la largeur des onglets selon l'écran
    function adjustTabsForScreenSize() {
      if (window.innerWidth < 768) {
        // Sur mobile, on limite le nombre d'onglets visibles et on active le burger
        const maxVisibleTabs = 3;
        const tabsToShow = Array.from(tabItems).slice(0, maxVisibleTabs);
        const tabsToHide = Array.from(tabItems).slice(maxVisibleTabs);
        
        tabsToShow.forEach(tab => tab.style.display = 'block');
        tabsToHide.forEach(tab => tab.style.display = 'none');
        
        moreBtn.style.visibility = 'visible';
        
        // Populate more-drawer with hidden tabs
        moreDrawer.innerHTML = '';
        tabsToHide.forEach(tab => {
          const clone = tab.cloneNode(true);
          clone.classList.add('more-item');
          moreDrawer.appendChild(clone);
        });
      } else {
        // Sur desktop, tous les onglets sont visibles
        tabItems.forEach(tab => tab.style.display = 'block');
        
        // Afficher le burger-menu seulement si nécessaire
        const totalTabsWidth = Array.from(tabItems).reduce((sum, tab) => sum + tab.offsetWidth, 0);
        const containerWidth = document.getElementById('left-container').offsetWidth;
        
        if (totalTabsWidth > containerWidth * 0.8) {
          moreBtn.style.visibility = 'visible';
        } else {
          moreBtn.style.visibility = 'hidden';
        }
      }
    }
    
    // Gestion du clic sur le bouton d'outils
    if (toolsButton) {
      toolsButton.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Détecter l'onglet actif
        const activeTab = document.querySelector('.nav-link.active');
        if (!activeTab) return;
        
        let offcanvasId = null;
        
        // Déterminer quel offcanvas ouvrir en fonction de l'onglet actif
        if (activeTab.getAttribute('href') === '#tab1') {
          offcanvasId = 'fanParameters';
        } else if (activeTab.getAttribute('href') === '#tab2') {
          offcanvasId = 'mapParameters';
        } else if (activeTab.getAttribute('href') === '#tab3') {
          offcanvasId = 'treeParameters';
        }
        
        // Ouvrir l'offcanvas approprié s'il existe
        if (offcanvasId) {
          const offcanvasElement = document.getElementById(offcanvasId);
          if (offcanvasElement) {
            const offcanvas = new bootstrap.Offcanvas(offcanvasElement);
            offcanvas.show();
          }
        }
      });
    }
    
    // Gestion du burger menu
    if (moreBtn) {
      moreBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        if (moreDrawer.style.visibility === 'visible') {
          moreDrawer.style.visibility = 'hidden';
        } else {
          moreDrawer.style.visibility = 'visible';
        }
      });
    }
    
    // Fermer le menu lorsqu'on clique ailleurs
    document.addEventListener('click', function(e) {
      if (moreBtn && moreDrawer && !moreBtn.contains(e.target) && !moreDrawer.contains(e.target)) {
        moreDrawer.style.visibility = 'hidden';
      }
    });
    
    // Appliquer l'ajustement au chargement et au redimensionnement
    window.addEventListener('resize', adjustTabsForScreenSize);
    adjustTabsForScreenSize();
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

    const initializeEventListeners = () => {
        console.group('EventListeners: Initializing...'); // Debug
    
        // Configuration des écouteurs globaux
        initializeHeaderBehavior();
        setupIndividualSelectorListener();
        setupTabAndUIEventListeners();
        setupFileLoadingEventListeners();
        setupUndoRedoEventListeners();
        setupAutoOpenGedcomMenu(); // Ajoutez cette ligne
    
        /*
        setTimeout(() => {
            setupResponsiveTabs();
            setupTabResizeListener();
        }, 0);
        */

        setupProtectedFeatureEventListeners(authStore);

        // Émettre l'événement de chargement initial immédiatement
        console.log('EventListeners: Emitting APP_LOADED'); // Debug
        storeEvents.emit(EVENTS.ONBOARDING.APP_LOADED);

        // Émettre l'événement lors du chargement d'un GEDCOM
        document.addEventListener('gedcomLoaded', () => {
            console.log('EventListeners: GEDCOM loaded, emitting GEDCOM_UPLOADED'); // Debug
            storeEvents.emit(EVENTS.ONBOARDING.GEDCOM_UPLOADED);
        });

        // Émettre l'événement lors du changement d'onglet
        document.querySelectorAll('.nav-link').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                const tabId = e.target.getAttribute('href').substring(1);
                console.log('EventListeners: Tab opened:', tabId); // Debug
                storeEvents.emit(EVENTS.ONBOARDING.TAB_OPENED, tabId);
            });
        });

        console.log('✅ Event listeners initialized');
        console.groupEnd();
    };

    // Si le document est déjà chargé, initialiser immédiatement
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeEventListeners);
    } else {
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
