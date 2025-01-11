import { TAGS } from '../stores/gedcomConstantsStore.js';
import configStore from '../../tabs/fanChart/fanConfigStore.js';
import familyTownsStore from '../stores/familyTownsStore.js';
import gedcomDataStore from '../stores/gedcomDataStore.js';
import { processDate } from './dateProcessor.js';
import { prefixedDate, calculateAge } from "../../utils/dates.js";

export function handleEventTags() {
    const config = configStore.getConfig;
    let birthTags = [TAGS.BIRTH],
        deathTags = [TAGS.DEATH];
    if (config.substituteEvents) {
        birthTags = birthTags.concat([TAGS.BAPTISM]);
        deathTags = deathTags.concat([TAGS.BURIAL]);
    }
    return { birthTags, deathTags };
}

export function processEventDatePlace(event, individualTowns) {
    const familyTowns = familyTownsStore.getAllTowns();
    const dateNode = event.tree.find((node) => node.tag === "DATE");
    const date = dateNode ? processDate(dateNode.data) : "";
    const placeKey = event.key || "";
    let placeDetails = familyTowns[placeKey] || {};

    if (!individualTowns[placeKey]) {
        individualTowns[placeKey] = {
            town: placeDetails.town || "",
            display: placeDetails.town || "",
            townDisplay: placeDetails.townDisplay || "",
            departement: placeDetails.departement || "",
            departementColor: placeDetails.departementColor || "",
            country: placeDetails.country || "",
            countryColor: placeDetails.countryColor || "",
            latitude: placeDetails.latitude || "",
            longitude: placeDetails.longitude || "",
        };
    } else {
        let town = individualTowns[placeKey];
        town.latitude = placeDetails.latitude || town.latitude;
        town.longitude = placeDetails.longitude || town.longitude;
        town.display = placeDetails.town || town.display;
        individualTowns[placeKey] = town;
    }

    return {
        eventDetails: {
            date: date,
            town: placeDetails.town || "",
            townDisplay: placeDetails.townDisplay || "",
            departement: placeDetails.departement || "",
            departementColor: placeDetails.departementColor || "",
            country: placeDetails.country || "",
            countryColor: placeDetails.countryColor || "",
            latitude: placeDetails.latitude || "",
            longitude: placeDetails.longitude || "",
            placeKey: placeKey,
        },
        updatedTownList: individualTowns,
    };
}

/* Functions for managing events data */
export function generateEventDescription(eventType, eventData, gender, age, deceased) {
    let eventDate = eventData.date
        ? prefixedDate(eventData.date)
        : "le (date inconnue)";
    let eventPlace = eventData.townDisplay || "(lieu inconnu)";
    let townKey = eventData.placeKey || "unknown"; // Suppose that townKey is your unique identifier for each town
    let eventPlaceMarkup =
        eventPlace === "(lieu inconnu)"
            ? ` à ${eventPlace}`
            : `à <a href="#"><span class="city-link" data-town-key="${townKey}">${eventPlace}</span></a>`;

    // Update the eventType based on the deceased flag
    const eventTypeDescriptions = {
        BIRT: "Naissance",
        MARR: "Mariage",
        DEAT: deceased ? "Décès" : "Aujourd’hui",
    };

    let additionalDetails = "";
    let baseDescription = eventTypeDescriptions[eventType] || "Événement";

    switch (eventType) {
        case "BIRT":
            // Naissance n'a pas de détails supplémentaires autres que la date et le lieu
            break;
        case "MARR":
            // Ajout du conjoint pour le mariage, si disponible
            if (eventData.spouseName) {
                additionalDetails = ` avec <a href="#"><span class="person-link" data-person-id=${eventData.spouseId}>${eventData.spouseName}</span></a>`;
            }
            break;
        case "DEAT":
            if (!deceased && age) {
                additionalDetails = `${age} ans`;
            }
            break;
    }

    let eventDescription = `${additionalDetails} ${eventPlaceMarkup ? `${eventPlaceMarkup}` : ""
        }`;
    return eventDescription;
}

function buildEvent(event, individualTowns) {
    if (!event) {
        return {};
    }

    const { eventDetails, updatedIndividualTowns } = processEventDatePlace(
        event,
        individualTowns
    );
    return { eventDetails, updatedIndividualTowns };
}

export function buildEventFallback(individualJson, tags, individualTowns) {
    let firstEvent = null;
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const event = individualJson.tree.find((node) => node.tag === tag);
        if (event) {
            firstEvent = event;
            break;
        }
    }
    const { eventDetails, updatedIndividualTowns } = firstEvent
        ? buildEvent(firstEvent, individualTowns)
        : {
            eventDetails: {
                date: "",
                town: "",
                departement: "",
                departementColor: "",
                country: "",
                countryColor: "",
                latitude: "",
                longitude: "",
                placeKey: "",
            },
            updatedIndividualTowns: individualTowns,
        };
    return { eventDetails, updatedIndividualTowns };
}

/**
 * Adds an event to the individual's events list and to the family events store if applicable
 * @param {string} type - The type of event (birth, death, marriage, etc.)
 * @param {string} name - Individual's name
 * @param {string} surname - Individual's surname
 * @param {string} date - Event date
 * @param {string} town - Event location
 * @param {string} description - Formatted event description
 * @param {string} eventId - Unique event identifier
 * @param {Array} eventAttendees - List of event participants
 * @param {string} birthDate - Individual's birth date (for age calculation)
 * @param {Array} individualEvents - Array to store the individual's events
 * @returns {void}
 */
export function addEvent(type, name, surname, date, town, description, eventId = '', eventAttendees = [], birthDate, individualEvents) {
    if (!date) return;

    // Calculate age at the time of the event if birthDate is known
    let ageAtEvent = null;
    if (birthDate) {
        ageAtEvent = calculateAge(birthDate, date);
    }

    const formattedAttendees = eventAttendees.map(attendee => `${attendee.name}`).join(', ');

    const event = {
        type,                   // Used for event grouping
        name: `${name} ${surname}`, // Used in formatEvent
        date,                   // Used in formatEvent
        town: town || "lieu inconnu", // Used in formatEvent
        townDisplay: town || "lieu inconnu",
        description,
        eventId: eventId || '',
        eventAttendees: eventAttendees.join(', '),
        age: ageAtEvent,        // Used in formatEvent for deaths
        spouse: '',             // Should be filled for marriages
        sosa: null              // Important for ancestor events
    };

    individualEvents.push(event);

    // Add to family events store unless it's a personal event
    if (!["child-birth", "occupation", "today"].includes(type)) {
        gedcomDataStore.addFamilyEvent(event);
    }
}