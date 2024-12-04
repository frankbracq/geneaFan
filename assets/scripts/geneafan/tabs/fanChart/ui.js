// MobX state management
import configStore from "./fanConfigStore.js";
import rootPersonStore from "../../common/stores/rootPersonStore.js";
import familyTownsStore from "../../gedcom/familyTownsStore.js";
import { googleMapsStore } from "../familyMap/googleMapsStore.js";
import { DownloadManager } from "../../common/downloadManager.js";
import { offcanvasManager } from "./offcanvasManager.js";
import { FanChartManager } from "./fanChartManager.js";

// Utility libraries
import _ from "lodash";

let rootPersonName;

/*
document.addEventListener("DOMContentLoaded", async function () {
    console.log("DOMContentLoaded fired.");

    FanChartManager.initialize();

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
*/

export function displayPersonDetailsUI(personDetails) {
    const {
        personLink,
        formattedOccupations,
        formattedSiblings,
        individualTowns,
        individualEvents,
        deceased,
    } = personDetails.data;

    const personDetailsLabelElement = document.getElementById("personDetailsLabel");
    const individualTimelineElement = document.getElementById("individualTimeline");

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

    const birthEvent = individualEvents.find((event) => event.type === "birth") || {
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

            if (dateA && dateB) return dateA - dateB;
            if (dateA) return -1;
            if (dateB) return 1;
            return 0;
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
                return `${childBirthOrder}${ordinalSuffixOf(childBirthOrder)} enfant${ageText}`;
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

    const siblingsSection = formattedSiblings ? createSection("Fratrie", formattedSiblings) : "";
    const occupationsSection = formattedOccupations ? createSection("Profession", formattedOccupations) : "";
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

    offcanvasManager.showOffCanvasDetails();
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
    const fanParametersDisplayElement = document.getElementById("fanParametersDisplay");
    const treeParametersDisplayElement = document.getElementById("treeParametersDisplay");
    const fullscreenButtonElement = document.getElementById("fullscreenButton");

    // Remove event listeners
    [...parametersElements, individualSelectElement].forEach((element) => {
        if (element) {
            element.removeEventListener("change", configStore.handleSettingChange);
        }
    });

    // Reset select elements
    if (individualSelectElement) {
        individualSelectElement.innerHTML = "";
    }

    let tomSelect = rootPersonStore.tomSelect;
    if (tomSelect) {
        tomSelect.clearOptions();
        tomSelect.clear();
    }

    // Reset fan chart
    await FanChartManager.reset();

    // Reset stores
    familyTownsStore.setTownsData({});
    googleMapsStore.clearMap();

    // Disable UI elements
    [
        downloadMenuElement,
        fanParametersDisplayElement,
        treeParametersDisplayElement,
        fullscreenButtonElement,
    ].forEach((el) => {
        if (el) el.disabled = true;
    });

    // Re-add event listeners
    [...parametersElements, individualSelectElement].forEach((element) => {
        if (element) {
            element.addEventListener("change", configStore.handleSettingChange);
        }
    });

    rootPersonStore.resetHistory();
}