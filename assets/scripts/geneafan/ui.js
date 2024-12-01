// MobX state management
import { autorun } from "./common/stores/mobx-config.js";
import authStore from "./common/stores/authStore.js";
import configStore from "./tabs/fanChart/fanConfigStore.js";
import rootPersonStore from "./common/stores/rootPersonStore.js";
import TimelineManager from "./tabs/timeline/timelineManager.js";
import familyTownsStore from "./gedcom/familyTownsStore.js";
import { googleMapsStore } from "./tabs/familyMap/googleMapsStore.js";

// Utility libraries
import _ from "lodash"; // Utility functions
import { v4 as uuidv4 } from "uuid"; // UUID generation

// UI Libraries & Components
import svgPanZoom from "svg-pan-zoom"; // SVG pan and zoom functionality
import { Modal, Offcanvas, Tooltip } from "bootstrap"; // Bootstrap components

// Google Maps
import { Loader } from "@googlemaps/js-api-loader"; // Google Maps loader

// Application state and utilities
import {
  setSvgPanZoomInstance,
  getSvgPanZoomInstance,
} from "./common/stores/state.js";
import { debounce } from "./utils/utils.js";

// Core functionality
import {
  downloadContent,
  downloadPNG,
  fanAsXml,
  generateFileName,
  downloadPDF,
  handleUploadAndPost,
} from "./common/downloads.js";

// Event listeners
import { setupAllEventListeners } from "./listeners/eventListeners.js";

let config;
let rootPersonName;

// Récupérer le publishableKey depuis les variables d'environnement
const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
console.log("Clerk Publishable Key:", publishableKey);

window.addEventListener("beforeunload", function (e) {
  console.log("La page est sur le point de se recharger ou de se fermer.");
});

document.addEventListener("DOMContentLoaded", async function () {
  console.log("DOMContentLoaded fired.");

  // Initialize Clerk via the MobX store
  await authStore.initializeClerk(publishableKey);

  // Call initPage after Clerk initialization
  initPage();

  // Set up all event listeners with Clerk via MobX
  setupAllEventListeners(authStore);

  // Add event listener for the sign-in button
  const signInButton = document.getElementById("sign-in-button");
  if (signInButton) {
    signInButton.addEventListener("click", () => {
      authStore.showSignInForm(authStore.clerk);
    });
  }

  // Autorun to toggle user controls
  autorun(() => {
    const userInfo = authStore.userInfo;

    const signInButton = document.getElementById("sign-in-button");
    const userButtonDiv = document.getElementById("user-button");

    if (!signInButton || !userButtonDiv) {
      console.error("User controls elements not found.");
      return;
    }

    if (userInfo) {
      // User is authenticated
      signInButton.style.display = "none";
      userButtonDiv.style.display = "block";

      // Mount the Clerk UserButton if not already mounted
      if (!userButtonDiv.hasChildNodes()) {
        authStore.clerk.mountUserButton(userButtonDiv);
        authStore.clerk.navigate = () => {
          signInButton.style.display = "block";
          userButtonDiv.style.display = "none";
        };
      }
    } else {
      // User is not authenticated
      userButtonDiv.style.display = "none";
      signInButton.style.display = "block";
    }
  });

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

function resizeSvg() {
  const fanContainer = document.getElementById("fanContainer");
  const svgElement = document.getElementById("fan");

  const panZoomInstance = getSvgPanZoomInstance();

  const resize = () => {
    const containerWidth = fanContainer.clientWidth;
    const containerHeight = fanContainer.clientHeight;

    svgElement.setAttribute("width", containerWidth);
    svgElement.setAttribute("height", containerHeight);

    panZoomInstance.resize();
    panZoomInstance.fit();
    panZoomInstance.center();
  };

  const debouncedResize = debounce(resize, 100);

  window.addEventListener("resize", debouncedResize);

  // Redimensionnement initial
  resize();
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

let shouldShowInitialMessage = true;
let filename = "";

export function displayFan() {
  const instance = svgPanZoom("#fan", {
    zoomEnabled: true,
    controlIconsEnabled: true,
    fit: true,
    center: true,
  });

  var mapElement = document.querySelector("#fan");
  if (mapElement) {
    mapElement.addEventListener(
      "dblclick",
      function (event) {
        event.stopImmediatePropagation();
      },
      true
    );

    mapElement.addEventListener(
      "wheel",
      function (event) {
        if (event.ctrlKey) {
          event.preventDefault();
        }
      },
      { passive: false }
    );
  } else {
    console.error("L'élément SVG '#fan' n'a pas été trouvé dans le DOM.");
  }

  setSvgPanZoomInstance(instance);
  return instance;
}

// Function to check if the fan container is visible
const isFanContainerVisible = () => {
  const fanContainer = document.getElementById("fanContainer");
  return fanContainer && fanContainer.offsetParent !== null;
};

// Download buttons
document
  .getElementById("download-pdf")
  .addEventListener("click", function (event) {
    event.preventDefault(); // Prevent default link action

    // Use the handleUserAuthentication function from authStore
    authStore.handleUserAuthentication(authStore.clerk, async (userInfo) => {
      if (userInfo) {
        // Check if user information is available
        const userEmail = userInfo.email; // Get the user's email
        await handleUploadAndPost(rootPersonName, userEmail); // Call the function with the user's email
      } else {
        console.error("Erreur lors de la connexion de l'utilisateur.");
      }
    });
  });

document
  .getElementById("download-pdf-watermark")
  .addEventListener("click", function (event) {
    downloadPDF(
      config,
      function (blob) {
        downloadContent(blob, generateFileName("pdf"), "pdf");
      },
      true
    );

    event.preventDefault(); // Prevent default link action
  });

document
  .getElementById("download-svg")
  .addEventListener("click", function (event) {
    let elements = document.querySelectorAll("#boxes *");
    elements.forEach(function (element) {
      element.style.stroke = "rgb(0, 0, 255)";
      element.style["-inkscape-stroke"] = "hairline";
      element.setAttribute("stroke-width", "0.01");
    });
    downloadContent(fanAsXml(), generateFileName("svg"), "svg");
    event.preventDefault(); // Prevent default link action
  });

document
  .getElementById("download-png-transparency")
  .addEventListener("click", function (event) {
    downloadPNG(config, true);
    event.preventDefault(); // Prevent default link action
  });

document
  .getElementById("download-png-background")
  .addEventListener("click", function (event) {
    downloadPNG(config, false);
    event.preventDefault(); // Prevent default link action
  });

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

function adjustMapHeight() {
  const offCanvas = document.getElementById("individualMap");
  const offCanvasHeader = document.querySelector(
    "#individualMap .offcanvas-header"
  );
  const mapId = document.getElementById("mapid");

  if (offCanvas && offCanvasHeader && mapId) {
    const offCanvasHeight = offCanvas.clientHeight;
    const headerHeight = offCanvasHeader.clientHeight;
    const mapHeight = offCanvasHeight - headerHeight;
    mapId.style.height = `${mapHeight}px`; // Ajuster la hauteur de la carte
  }
}

function setupOffcanvasMapTrigger() {
  var offcanvasElement = document.getElementById("individualMap");
  if (offcanvasElement) {
    offcanvasElement.addEventListener("shown.bs.offcanvas", function () {
      googleMapsStore.initMap("individualMap");
      adjustMapHeight();
    });
  }
}

export function initPage() {
  console.log("Initialisation de la page...");
  if (isReady) {
    document.getElementById("overlay").classList.add("overlay-hidden");
  }

  let userId = localStorage.getItem("userId");
  if (!userId) {
    userId = generateUniqueId();
    localStorage.setItem("userId", userId);
  }

  const loader = new Loader({
    apiKey: googleMapsStore.apiKey,
    version: "weekly",
    libraries: [],
  });

  loader
    .load()
    .then(() => {
      if (!googleMapsStore.map) {
        googleMapsStore.initMap("familyMap");
      }
      setupOffcanvasMapTrigger();
    })
    .catch((e) => {
      console.error("Error loading Google Maps", e);
    });

  handleUrlParameters();

  new TimelineManager();
}

function handleUrlParameters() {
  var urlParams = new URLSearchParams(window.location.search);
  var contexte = urlParams.get("contexte");

  if (contexte === "demo") {
    document.querySelector("#download-svg").style.display = "none";
    document.querySelector("#download-png-transparency").style.display = "none";
    document.querySelector("#download-png-background").style.display = "none";
    // document.querySelector("#advanced-parameters").style.display = "none";
    document.querySelector("#show-missing").closest(".col").style.display =
      "none";
  }
}

function generateUniqueId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    return uuidv4();
  }
}
