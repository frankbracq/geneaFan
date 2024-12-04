// MobX state management
import authStore from "./common/stores/authStore.js";
import configStore from "./tabs/fanChart/fanConfigStore.js";
import rootPersonStore from "./common/stores/rootPersonStore.js";
import familyTownsStore from "./gedcom/familyTownsStore.js";
import { googleMapsStore } from "./tabs/familyMap/googleMapsStore.js";

// Application state and utilities
import {
  setSvgPanZoomInstance,
  getSvgPanZoomInstance,
  initSvgPanZoom,
  destroySvgPanZoom,
} from "./common/stores/state.js";

import { DownloadManager } from "./common/downloadManager.js";

// Utility libraries
import _ from "lodash"; // Utility functions

// UI Libraries & Components
// import svgPanZoom from "svg-pan-zoom"; // SVG pan and zoom functionality
import { Offcanvas } from "bootstrap"; // Bootstrap components

// Event listeners
import { setupAllEventListeners } from "./listeners/eventListeners.js";

let config;
let rootPersonName;


document.addEventListener("DOMContentLoaded", async function () {
  console.log("DOMContentLoaded fired.");

  initPage();

  // Set up all event listeners with Clerk via MobX
  setupAllEventListeners(authStore);

  // Hide the overlay after initialization
  const overlay = document.getElementById("overlay");
  if (overlay) {
    overlay.style.display = "none";
    console.log("Overlay hidden.");
  } else {
    console.error("Element with ID 'overlay' not found.");
  }

  console.log("DOMContentLoaded event handler completed.");
});

/* BS offcanvas elements management */
let offCanvasPersonDetailsInstance = null;
let offCanvasIndividualMapInstance = null;

function getOffCanvasInstance(elementId, options) {
  let instance = Offcanvas.getInstance(document.getElementById(elementId));
  if (!instance) {
    instance = new Offcanvas(document.getElementById(elementId), options);
  }
  return instance;
}

function showOffCanvasDetails() {
  const personDetailsElement = document.getElementById("personDetails");
  const individualMapContainerElement = document.getElementById(
    "individualMapContainer"
  );

  offCanvasPersonDetailsInstance = getOffCanvasInstance("personDetails", {});
  offCanvasIndividualMapInstance = getOffCanvasInstance(
    "individualMapContainer",
    {
      backdrop: false,
    }
  );

  if (!offCanvasPersonDetailsInstance._isShown) {
    offCanvasPersonDetailsInstance.show();
  }
  if (!offCanvasIndividualMapInstance._isShown) {
    offCanvasIndividualMapInstance.show();
  }

  individualMapContainerElement.removeEventListener(
    "shown.bs.offcanvas",
    handleMapResize
  );
  individualMapContainerElement.addEventListener(
    "shown.bs.offcanvas",
    handleMapResize
  );

  personDetailsElement.removeEventListener(
    "hidden.bs.offcanvas",
    handleOffcanvasHide
  );
  personDetailsElement.addEventListener(
    "hidden.bs.offcanvas",
    handleOffcanvasHide
  );
}

function handleMapResize() {
  const offCanvasBody = document.querySelector(
    "#individualMapContainer .offcanvas-body"
  );
  const mapElement = document.getElementById("individualMap");
  mapElement.style.height = `${offCanvasBody.clientHeight}px`;

  googleMapsStore.moveMapToContainer("individualMap");
  google.maps.event.trigger(googleMapsStore.map, "resize");
  googleMapsStore.map.setCenter({ lat: 46.2276, lng: 2.2137 });
}

function handleOffcanvasHide() {
  if (offCanvasIndividualMapInstance) {
    offCanvasIndividualMapInstance.hide();
  }
}

export function displayPersonDetailsUI(personDetails) {
  const {
    name,
    surname,
    personLink,
    formattedOccupations,
    formattedSiblings,
    individualTowns,
    individualEvents,
    deceased,
  } = personDetails.data;

  const personDetailsLabelElement =
    document.getElementById("personDetailsLabel");
  const individualTimelineElement =
    document.getElementById("individualTimeline");

  // Affiche le nom de la personne dans l'en-tête
  personDetailsLabelElement.innerHTML = `<h4>${personLink}</h4>`;

  const eventTypeDescriptions = {
    birth: "Naissance",
    marriage: "Mariage",
    death: "Décès",
    today: "Aujourd'hui",
  };

  // Fonction pour parser les dates au format "dd/mm/yyyy"
  const parseDateString = (dateString) => {
    if (!dateString) return null;
    const [day, month, year] = dateString.split("/");
    return new Date(year, month - 1, day);
  };

  const birthEvent = individualEvents.find(
    (event) => event.type === "birth"
  ) || {
    type: "birth",
    date: "",
    description: "Date inconnue",
  };
  const deathEvent = individualEvents.find((event) => event.type === "death");

  const otherEvents = individualEvents
    .filter((event) => event.type !== "birth" && event.type !== "death")
    .sort((a, b) => {
      const dateA = parseDateString(a.date);
      const dateB = parseDateString(b.date);

      if (dateA && dateB) {
        return dateA - dateB;
      } else if (dateA) {
        return -1;
      } else if (dateB) {
        return 1;
      } else {
        return 0;
      }
    });

  const timelineEvents = [birthEvent, ...otherEvents];
  if (deceased && deathEvent) {
    timelineEvents.push(deathEvent);
  }

  const timelineFragment = document.createDocumentFragment();
  let childBirthCount = 0;

  const getEventDescription = (event, childBirthOrder) => {
    const ageText = event.ageAtEvent ? ` à ${event.ageAtEvent} ans` : "";
    switch (event.type) {
      case "child-birth":
        return `${childBirthOrder}${ordinalSuffixOf(
          childBirthOrder
        )} enfant${ageText}`;
      case "death":
        return `Décès${ageText}`;
      case "marriage":
        return `Mariage${ageText}`;
      default:
        return eventTypeDescriptions[event.type] || _.startCase(event.type);
    }
  };

  timelineEvents.forEach((event) => {
    if (event.type === "child-birth") {
      childBirthCount++;
    }
    const description = getEventDescription(event, childBirthCount);

    const li = document.createElement("li");
    li.innerHTML = `
            <div class="event-header">
                <h6 class="mt-0">${description}</h6>
                <h6 class="float-end">${event.date || "Date inconnue"}</h6>
            </div>
            <p class="mt-0">${event.description}</p>
        `;
    timelineFragment.appendChild(li);
  });

  // Création des sections supplémentaires
  const createSection = (title, content) => {
    return `
            <h6>${title}</h6>
            <ul class="list-group">
                <li class="list-group-item">${content}</li>
            </ul>
        `;
  };

  const siblingsSection = formattedSiblings
    ? createSection("Fratrie", formattedSiblings)
    : "";
  const occupationsSection = formattedOccupations
    ? createSection("Profession", formattedOccupations)
    : "";
  const additionalInfo = `${siblingsSection}${occupationsSection}`;

  // Construction du conteneur principal
  const container = document.createElement("div");
  container.classList.add("container");
  container.innerHTML = `
        <div class="row">
            <div class="col-md-12">
                <ul class="timeline-3"></ul>
            </div>
        </div>
        <div class="additional-info">${additionalInfo}</div>
    `;

  container.querySelector(".timeline-3").appendChild(timelineFragment);
  individualTimelineElement.innerHTML = "";
  individualTimelineElement.appendChild(container);

  // Gestion de la carte Google Maps
  if (!googleMapsStore.map) {
    googleMapsStore.initMap("individualMap");
  }

  const individualTownKeys = Object.keys(individualTowns);
  googleMapsStore.activateMapMarkers(individualTownKeys);

  showOffCanvasDetails();
}

function ordinalSuffixOf(i) {
  const j = i % 10;
  const k = i % 100;
  if (j == 1 && k != 11) {
    return "er";
  }
  return "ème";
}

export async function resetUI() {
  const parametersElements = document.querySelectorAll(".parameter");
  const individualSelectElement = document.getElementById("individual-select");
  const downloadMenuElement = document.getElementById("download-menu");
  const fanParametersDisplayElement = document.getElementById(
    "fanParametersDisplay"
  );
  const treeParametersDisplayElement = document.getElementById(
    "treeParametersDisplay"
  );
  const fullscreenButtonElement = document.getElementById("fullscreenButton");

  [...parametersElements, individualSelectElement].forEach((element) => {
    if (element) {
      element.removeEventListener("change", configStore.handleSettingChange);
    }
  });

  if (individualSelectElement) {
    individualSelectElement.innerHTML = "";
  }

  let tomSelect = rootPersonStore.tomSelect;
  if (tomSelect) {
    tomSelect.clearOptions();
    tomSelect.clear();
  }

  const svgPanZoomInstance = getSvgPanZoomInstance();
  if (svgPanZoomInstance) {
    try {
      svgPanZoomInstance.destroy();
    } catch (error) {
      console.error("Erreur lors de la destruction de svgPanZoom:", error);
    }
    setSvgPanZoomInstance(null);
  }

  destroySvgPanZoom();
    
    const fanSvg = document.getElementById("fan");
    if (fanSvg) {
        fanSvg.innerHTML = "";
    }

  // Remplacer setFamilyTowns par
  familyTownsStore.setTownsData({});

  googleMapsStore.clearMap();

  [
    downloadMenuElement,
    fanParametersDisplayElement,
    treeParametersDisplayElement,
    fullscreenButtonElement,
  ].forEach((el) => {
    if (el) el.disabled = true;
  });

  [...parametersElements, individualSelectElement].forEach((element) => {
    if (element) {
      element.addEventListener("change", configStore.handleSettingChange);
    }
  });

  rootPersonStore.resetHistory();
}

export function displayFan() {
  const svg = document.querySelector('#fan');
  const container = document.getElementById('fanContainer');

  svg.style.opacity = '0';

  requestAnimationFrame(() => {
      const instance = initSvgPanZoom(svg, {
          minZoom: 0.1,
          maxZoom: 10,
          zoomScaleSensitivity: 0.2,
          fitPadding: 20
      });

      svg.style.transition = 'opacity 0.3s ease-in-out';
      svg.style.opacity = '1';

      const fullscreenButton = document.getElementById('fullscreenButton');
      if (fullscreenButton) {
          fullscreenButton.addEventListener('click', () => {
              if (!document.fullscreenElement) {
                  container.requestFullscreen().then(() => {
                      instance.handleResize();
                  });
              } else {
                  document.exitFullscreen().then(() => {
                      instance.handleResize();
                  });
              }
          });
      }
  });
}

// Function to check if the fan container is visible
const isFanContainerVisible = () => {
  const fanContainer = document.getElementById("fanContainer");
  return fanContainer && fanContainer.offsetParent !== null;
};

// Prevent the user from entering invalid quantities
document.querySelectorAll("input[type=number]").forEach(function (input) {
  input.addEventListener("change", function () {
    const min = parseInt(input.getAttribute("min"));
    const max = parseInt(input.getAttribute("max"));
    let val = parseInt(input.value) || min - 1;
    if (val < min) input.value = min;
    if (val > max) input.value = max;
  });
});

export function initPage() {
  console.log("Initialisation de la page...");
  if (isReady) {
    document.getElementById("overlay").classList.add("overlay-hidden");
  }

  new DownloadManager(rootPersonName);
}

