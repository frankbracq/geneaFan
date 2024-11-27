// Third-party imports
import { Offcanvas } from 'bootstrap';
import { googleMapsStore } from '../familyMap/googleMapsStore.js';

/**
 * Manages the offcanvas display of person details and associated map
 */
class PersonDetailsUI {
    constructor() {
        this.offCanvasPersonDetails = null;
        this.offCanvasIndividualMap = null;
    }

    /**
     * Display person details in the offcanvas panel
     */
    display(personDetails) {
        const {
            name,
            surname,
            personLink,
            formattedOccupations,
            formattedSiblings,
            individualTowns,
            individualEvents,
            deceased
        } = personDetails.data;

        this.updateHeaderContent(personLink);
        this.createTimelineContent(individualEvents, formattedSiblings, formattedOccupations);
        this.setupMap(individualTowns);
        this.showOffcanvas();
    }

    /**
     * Updates the header content of the person details panel
     */
    updateHeaderContent(personLink) {
        const personDetailsLabel = document.getElementById("personDetailsLabel");
        if (personDetailsLabel) {
            personDetailsLabel.innerHTML = `<h4>${personLink}</h4>`;
        }
    }

    /**
     * Creates the timeline content for the person details
     */
    createTimelineContent(individualEvents, formattedSiblings, formattedOccupations) {
        const timelineElement = document.getElementById("individualTimeline");
        if (!timelineElement) return;

        const timelineEvents = this.prepareTimelineEvents(individualEvents);
        const timelineFragment = this.createTimelineFragment(timelineEvents);
        const additionalInfo = this.createAdditionalInfo(formattedSiblings, formattedOccupations);

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
        timelineElement.innerHTML = "";
        timelineElement.appendChild(container);
    }

    /**
     * Creates the offcanvas elements and shows them
     */
    showOffcanvas() {
        this.offCanvasPersonDetails = this.getOffCanvasInstance("personDetails");
        this.offCanvasIndividualMap = this.getOffCanvasInstance("individualMapContainer", { backdrop: false });

        // Show offcanvas panels
        if (!this.offCanvasPersonDetails._isShown) {
            this.offCanvasPersonDetails.show();
        }
        if (!this.offCanvasIndividualMap._isShown) {
            this.offCanvasIndividualMap.show();
        }

        // Setup event listeners
        this.setupOffcanvasEventListeners();
    }

    /**
     * Gets or creates an Offcanvas instance
     */
    getOffCanvasInstance(elementId, options = {}) {
        const element = document.getElementById(elementId);
        let instance = Offcanvas.getInstance(element);
        if (!instance) {
            instance = new Offcanvas(element, options);
        }
        return instance;
    }

    /**
     * Sets up event listeners for the offcanvas panels
     */
    setupOffcanvasEventListeners() {
        const mapContainer = document.getElementById("individualMapContainer");
        const personDetails = document.getElementById("personDetails");

        if (mapContainer) {
            mapContainer.removeEventListener("shown.bs.offcanvas", this.handleMapResize);
            mapContainer.addEventListener("shown.bs.offcanvas", this.handleMapResize);
        }

        if (personDetails) {
            personDetails.removeEventListener("hidden.bs.offcanvas", this.handleOffcanvasHide);
            personDetails.addEventListener("hidden.bs.offcanvas", this.handleOffcanvasHide);
        }
    }

    /**
     * Handles resizing of the map when offcanvas is shown
     */
    handleMapResize = () => {
        const offCanvasBody = document.querySelector("#individualMapContainer .offcanvas-body");
        const mapElement = document.getElementById("individualMap");
        
        if (offCanvasBody && mapElement) {
            mapElement.style.height = `${offCanvasBody.clientHeight}px`;
            googleMapsStore.moveMapToContainer("individualMap");
            google.maps.event.trigger(googleMapsStore.map, "resize");
            googleMapsStore.map.setCenter({ lat: 46.2276, lng: 2.2137 });
        }
    }

    /**
     * Handles hiding of the map offcanvas when person details are hidden
     */
    handleOffcanvasHide = () => {
        if (this.offCanvasIndividualMap) {
            this.offCanvasIndividualMap.hide();
        }
    }

    /**
     * Sets up the map with individual towns
     */
    setupMap(individualTowns) {
        if (!googleMapsStore.map) {
            googleMapsStore.initMap("individualMap");
        }

        const townKeys = Object.keys(individualTowns);
        googleMapsStore.activateMapMarkers(townKeys);
    }

    /**
     * Prepares timeline events for display
     */
    prepareTimelineEvents(events) {
        const birthEvent = events.find(event => event.type === "birth") || {
            type: "birth",
            date: "",
            description: "Date inconnue"
        };
        
        const deathEvent = events.find(event => event.type === "death");
        const otherEvents = events.filter(event => 
            event.type !== "birth" && event.type !== "death"
        ).sort((a, b) => this.compareDates(a.date, b.date));

        return [birthEvent, ...otherEvents, deathEvent].filter(Boolean);
    }

    /**
     * Creates a document fragment containing timeline events
     */
    createTimelineFragment(events) {
        const fragment = document.createDocumentFragment();
        let childBirthCount = 0;

        events.forEach(event => {
            if (event.type === "child-birth") {
                childBirthCount++;
            }

            const li = document.createElement("li");
            li.innerHTML = this.createEventHtml(event, childBirthCount);
            fragment.appendChild(li);
        });

        return fragment;
    }

    /**
     * Creates HTML for an individual event
     */
    createEventHtml(event, childBirthOrder) {
        const description = this.getEventDescription(event, childBirthOrder);
        return `
            <div class="event-header">
                <h6 class="mt-0">${description}</h6>
                <h6 class="float-end">${event.date || "Date inconnue"}</h6>
            </div>
            <p class="mt-0">${event.description}</p>
        `;
    }

    /**
     * Creates additional information sections (siblings, occupations)
     */
    createAdditionalInfo(siblings, occupations) {
        const sections = [];

        if (siblings) {
            sections.push(this.createSection("Fratrie", siblings));
        }
        if (occupations) {
            sections.push(this.createSection("Profession", occupations));
        }

        return sections.join("");
    }

    /**
     * Creates a section with title and content
     */
    createSection(title, content) {
        return `
            <h6>${title}</h6>
            <ul class="list-group">
                <li class="list-group-item">${content}</li>
            </ul>
        `;
    }

    /**
     * Gets description for an event
     */
    getEventDescription(event, childBirthOrder) {
        const ageText = event.ageAtEvent ? ` à ${event.ageAtEvent} ans` : "";
        
        switch (event.type) {
            case "child-birth":
                return `${childBirthOrder}${this.getOrdinalSuffix(childBirthOrder)} enfant${ageText}`;
            case "death":
                return `Décès${ageText}`;
            case "marriage":
                return `Mariage${ageText}`;
            case "birth":
                return "Naissance";
            default:
                return event.type.charAt(0).toUpperCase() + event.type.slice(1);
        }
    }

    /**
     * Gets ordinal suffix for numbers
     */
    getOrdinalSuffix(i) {
        const j = i % 10;
        const k = i % 100;
        return (j == 1 && k != 11) ? "er" : "ème";
    }

    /**
     * Compares two date strings
     */
    compareDates(dateA, dateB) {
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        const [dayA, monthA, yearA] = dateA.split("/").map(Number);
        const [dayB, monthB, yearB] = dateB.split("/").map(Number);
        
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    }
}

export const personDetailsUI = new PersonDetailsUI();

export function displayPersonDetailsUI(personDetails) {
    personDetailsUI.display(personDetails);
}