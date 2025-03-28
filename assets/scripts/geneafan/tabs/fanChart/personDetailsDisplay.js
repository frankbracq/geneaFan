import { offcanvasManager } from "./offcanvasManager.js";

// Utility libraries
import _ from "lodash";

export function displayPersonDetailsUI(personDetails) {
    const {
        id,
        personLink,
        formattedOccupations,
        formattedSiblings,
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
        
        // Ajouter la classe correspondant au type d'événement
        if (event.type === "birth") {
            li.classList.add("birth-event");
        } else if (event.type === "death") {
            li.classList.add("death-event");
        } else if (event.type === "marriage") {
            li.classList.add("marriage-event");
        } else if (event.type === "child-birth") {
            li.classList.add("child-birth-event");
        }
        
        li.innerHTML = `
            <div class="event-header">
                <h6 class="mt-0">${description}</h6>
                <h6 class="float-end">${event.date || "Date ?"}</h6>
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
    container.classList.add("timeline-container");
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

    offcanvasManager.showOffCanvasDetails();
    console.log("🔍 ouverture offcanvas pour", id);
}

function ordinalSuffixOf(i) {
    const j = i % 10;
    const k = i % 100;
    if (j == 1 && k != 11) {
        return "er";
    }
    return "ème";
}
