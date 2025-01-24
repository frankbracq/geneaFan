/**
 * Generic event processing utilities for GEDCOM data
 * Provides core functionality for handling genealogical events:
 * - Event date and place processing
 * - Event description generation
 * - Event building and fallback handling
 * - Event registration and tracking
 */

import _ from 'lodash';
import { prefixedDate, calculateAge } from '../../utils/dates.js';
import { processDate } from '../parse.js';
import gedcomDataStore from '../stores/gedcomDataStore.js';
import gedcomConstantsStore from '../stores/gedcomConstantsStore.js';
import configStore from '../../tabs/fanChart/fanConfigStore.js';
import familyTownsStore from '../stores/familyTownsStore.js';

const { TAGS } = gedcomConstantsStore;

function deproxyObject(obj) {
    if (!obj) return null;
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        // Pour les objets avec des valeurs non-sérialisables
        if (Array.isArray(obj)) {
            return obj.map(item => deproxyObject(item));
        }
        if (typeof obj === 'object') {
            return Object.fromEntries(
                Object.entries(obj)
                    .map(([key, value]) => [key, deproxyObject(value)])
            );
        }
        return obj;
    }
}

/**
 * Processes an event's date and place information
 * @param {Object} event - The event object from the GEDCOM data
 * @param {Object} individualTowns - Object containing town information for the individual
 * @returns {Object} Object containing event details and updated town list
 */
export function processEventDatePlace(event, individualTowns) {
    const placeKey = event.placeKey || "";
    const placeDetails = familyTownsStore.getGeoData(placeKey);
    // console.log(`Place details for key "${placeKey}":`, deproxyObject(placeDetails?.[placeKey]));
    
    const dateNode = event.tree.find((node) => node.tag === "DATE");
    const date = dateNode ? processDate(dateNode.data) : "";

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
            longitude: placeDetails.longitude || ""
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
            date,
            town: placeDetails.town || "",
            townDisplay: placeDetails.townDisplay || "",
            departement: placeDetails.departement || "",
            departementColor: placeDetails.departementColor || "",
            country: placeDetails.country || "",
            countryColor: placeDetails.countryColor || "",
            latitude: placeDetails.latitude || "",
            longitude: placeDetails.longitude || "",
            placeKey
        },
        updatedTownList: individualTowns
    };
}

/**
 * Generates a description for a specific event type
 * @param {string} eventType - Type of the event (BIRT, MARR, DEAT)
 * @param {Object} eventData - Event details including date, place, and related person info
 * @param {string} gender - Gender of the individual
 * @param {number} age - Age at the time of the event
 * @param {boolean} deceased - Whether the individual is deceased
 * @returns {string} Formatted event description
 */
export function generateEventDescription(eventType, eventData, gender, age, deceased) {
    let eventDate = eventData.date
        ? prefixedDate(eventData.date)
        : "le (date inconnue)";
    let eventPlace = eventData.townDisplay || "(lieu inconnu)";
    let townKey = eventData.placeKey || "unknown";
    let eventPlaceMarkup =
        eventPlace === "(lieu inconnu)"
            ? ` à ${eventPlace}`
            : `à <a href="#"><span class="city-link" data-town-key="${townKey}">${eventPlace}</span></a>`;

    const eventTypeDescriptions = {
        BIRT: "Naissance",
        MARR: "Mariage",
        DEAT: deceased ? "Décès" : "Aujourd'hui",
    };

    let additionalDetails = "";
    let baseDescription = eventTypeDescriptions[eventType] || "Événement";

    switch (eventType) {
        case "BIRT":
            break;
        case "MARR":
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

    return `${additionalDetails} ${eventPlaceMarkup ? `${eventPlaceMarkup}` : ""}`;
}


/**
 * Builds an event object from event data
 * @param {Object} event - Raw event data
 * @param {Object} individualTowns - Individual's towns information
 * @returns {Object} Processed event details
 */
export function buildEvent(event, individualTowns) {
    // console.log('buildEvent input:', {
    //    event: deproxyObject(event),
    //    tree: event?.tree ? deproxyObject(event.tree) : null,
    //    individualTowns: deproxyObject(individualTowns)
    //});

    if (!event) return {};

    const placeNode = event.tree.find(node => node.tag === "PLAC");
    // console.log('Found PLAC node:', placeNode ? deproxyObject(placeNode) : null);

    const { eventDetails, updatedIndividualTowns } = processEventDatePlace(
        event,
        individualTowns
    );

    //console.log('Event processing results:', {
    //    eventDetails: deproxyObject(eventDetails),
    //    updatedIndividualTowns: deproxyObject(updatedIndividualTowns)
    // });

    return { eventDetails, updatedIndividualTowns };
}

/**
 * Builds an event object with fallback options for missing data
 * @param {Object} individualJson - Individual's GEDCOM data
 * @param {Array} tags - Array of possible event tags to search for
 * @param {Object} individualTowns - Individual's towns information
 * @returns {Object} Event details with fallbacks for missing data
 */
export function buildEventFallback(individualJson, tags, individualTowns) {
    // console.log('buildEventFallback input:', {
    //    pointer: individualJson.pointer,
    //    tags: deproxyObject(tags),
    //    tree: deproxyObject(individualJson.tree)
    // });

    let firstEvent = null;
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const event = individualJson.tree.find((node) => node.tag === tag);
        if (event) {
            // console.log(`Found event for tag ${tag}:`, deproxyObject(event));
            firstEvent = event;
            break;
        }
    }

    const result = firstEvent
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

    // console.log('buildEventFallback result:', deproxyObject(result));
    return result;
}

/**
 * Adds an event to the individual's events list and to the family events store
 * @param {string} type - Type of event
 * @param {string} name - Individual's name
 * @param {string} surname - Individual's surname
 * @param {string} date - Event date
 * @param {string} town - Event location
 * @param {string} description - Formatted event description
 * @param {string} eventId - Unique event identifier
 * @param {Array} eventAttendees - List of event participants
 * @param {string} birthDate - Individual's birth date
 * @param {Array} individualEvents - Array to store individual's events
 */
export function addEvent(type, name, surname, date, town, description, eventId = '', eventAttendees = [], birthDate, individualEvents) {
    if (!date) return;

    let ageAtEvent = null;
    if (birthDate) {
        ageAtEvent = calculateAge(birthDate, date);
    }

    const formattedAttendees = eventAttendees.map(attendee => `${attendee.name}`).join(', ');

    const event = {
        type,
        name: `${name} ${surname}`,
        date,
        town: town || "lieu inconnu",
        townDisplay: town || "lieu inconnu",
        description,
        eventId: eventId || '',
        eventAttendees: eventAttendees.join(', '),
        age: ageAtEvent,
        spouse: '',
        sosa: null
    };

    individualEvents.push(event);

    if (!["child-birth", "occupation", "today"].includes(type)) {
        gedcomDataStore.addFamilyEvent(event);
    }
}

/**
 * Returns the tags needed for birth and death events based on configuration
 * @returns {Object} Object containing arrays of birth and death related tags
 */
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
