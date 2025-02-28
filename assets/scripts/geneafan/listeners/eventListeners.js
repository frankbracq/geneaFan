import { Offcanvas, Tooltip } from "bootstrap";
import { EVENTS, storeEvents } from "../common/stores/storeEvents.js";
import ResponsiveTabs from "../tabs/responsiveTabs.js";
import rootPersonStore from "../common/stores/rootPersonStore.js";
import { setupProtectedFeatureEventListeners } from "./protectedFeatures.js";
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

// Fonction pour gérer le bouton de menu de fichier
function setupFileMenuToggle() {
  const fileMenu = document.getElementById("fileMenu");
  if (fileMenu) {
    // Supprimer l'attribut onclick existant
    fileMenu.removeAttribute("onclick");

    // Ajouter un gestionnaire d'événement click simple
    fileMenu.addEventListener("click", function (event) {
      event.preventDefault();
      if (window.bootstrap && window.bootstrap.Dropdown) {
        const dropdown = bootstrap.Dropdown.getOrCreateInstance(fileMenu);
        dropdown.toggle();
      } else {
        // Fallback si nécessaire
        const dropdownMenu = document.querySelector(
          '.dropdown-menu[aria-labelledby="fileMenu"]'
        );
        if (dropdownMenu) {
          dropdownMenu.classList.toggle("show");
          fileMenu.setAttribute(
            "aria-expanded",
            dropdownMenu.classList.contains("show")
          );
        }
      }
    });
  }
}

// Fonction pour gérer le comportement du bouton d'outils contextuel
function setupToolsButton() {
  const toolsButton = document.getElementById("toolsButton");

  if (!toolsButton) {
    console.error("Tools button not found");
    return;
  }

  // Handler pour le clic sur le bouton d'outils
  toolsButton.addEventListener("click", () => {
    // Déterminer quel onglet est actif
    const activeTab = document.querySelector(".nav-link.active");
    if (!activeTab) return;

    const tabName = activeTab.getAttribute("data-tab-name");

    // Ouvrir l'offcanvas correspondant à l'onglet actif
    switch (tabName) {
      case "Fan":
        const fanParameters = document.getElementById("fanParameters");
        if (fanParameters) {
          const fanOffcanvas = new Offcanvas(fanParameters);
          fanOffcanvas.show();
        }
        break;

      case "Map":
        const mapParameters = document.getElementById("mapParameters");
        if (mapParameters) {
          const mapOffcanvas = new Offcanvas(mapParameters, {
            backdrop: true,
            keyboard: true,
            scroll: false,
          });
          mapOffcanvas.show();
        }
        break;

      case "Tree":
        const treeParameters = document.getElementById("treeParameters");
        if (treeParameters) {
          const treeOffcanvas = new Offcanvas(treeParameters);
          treeOffcanvas.show();
        }
        break;

      case "Timeline":
        const timelineParameters =
          document.getElementById("timelineParameters");
        if (timelineParameters) {
          const timelineOffcanvas = new Offcanvas(timelineParameters);
          timelineOffcanvas.show();
        }
        break;

      case "Stats":
        // Ajouter ici la logique pour l'onglet Stats si nécessaire
        break;
    }
  });
}

// Setup tab and UI event listeners
function setupTabAndUIEventListeners() {
  document.querySelectorAll(".dropdown-menu a").forEach((element) => {
    element.addEventListener("click", function (event) {
      console.log("Clicked element:", event.target);
      const dropdownButton = this.closest(".dropdown");
      dropdownButton.classList.remove("show");
      dropdownButton.querySelector(".dropdown-menu").classList.remove("show");
    });
  });

  // Initialiser les onglets responsives avec les options par défaut
  const responsiveTabs = new ResponsiveTabs();
  // Ou avec des options personnalisées
  // const responsiveTabs = new ResponsiveTabs({
  //   tabNavSelector: '#custom-tab-nav',
  //   containerSelector: '#custom-container',
  //   breakpoint: 992 // Point de rupture personnalisé
  // });

  setupToolsButton();
  setupFileMenuToggle();
  setupTooltips();
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
    console.group("EventListeners: Initializing..."); // Debug

    // Configuration des écouteurs globaux
    setupIndividualSelectorListener();
    setupTabAndUIEventListeners(); // Cette fonction appelle maintenant setupFileMenu()
    setupFileLoadingEventListeners();
    setupUndoRedoEventListeners();
    // Nous n'avons plus besoin d'appeler setupAutoOpenGedcomMenu() ici

    setupProtectedFeatureEventListeners(authStore);

    // Émettre l'événement de chargement initial immédiatement
    console.log("EventListeners: Emitting APP_LOADED"); // Debug
    storeEvents.emit(EVENTS.ONBOARDING.APP_LOADED);

    // Émettre l'événement lors du chargement d'un GEDCOM
    document.addEventListener("gedcomLoaded", () => {
      console.log("EventListeners: GEDCOM loaded, emitting GEDCOM_UPLOADED"); // Debug
      storeEvents.emit(EVENTS.ONBOARDING.GEDCOM_UPLOADED);
    });

    // Émettre l'événement lors du changement d'onglet
    document.querySelectorAll(".nav-link").forEach((tab) => {
      tab.addEventListener("shown.bs.tab", (e) => {
        const tabId = e.target.getAttribute("href").substring(1);
        console.log("EventListeners: Tab opened:", tabId); // Debug
        storeEvents.emit(EVENTS.ONBOARDING.TAB_OPENED, tabId);
      });
    });

    console.log("✅ Event listeners initialized");
    console.groupEnd();
  };

  // Si le document est déjà chargé, initialiser immédiatement
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeEventListeners);
  } else {
    initializeEventListeners();
  }
};
