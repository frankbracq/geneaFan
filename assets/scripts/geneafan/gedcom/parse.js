// External libraries
import _ from "lodash";
import moment from "moment";
import parseGedcom from "parse-gedcom";
import jsonpointer from 'jsonpointer';

// Utility functions
import {
    normalizeGeoString,
    formatTownName
} from "../utils/geo.js";

import {
    padTwoDigits
} from "../utils/utils.js";

import {
    extractYear,
    calculateAge,
    prefixedDate
} from "../utils/dates.js";

import { statisticsService } from '../tabs/statistics/services/statisticsService.js';

// Stores
import gedcomDataStore from './gedcomDataStore.js';
import configStore from '../tabs/fanChart/fanConfigStore.js';
import timelineEventsStore from '../tabs/timeline/timelineEventsStore.js';
import familyTreeDataStore from '../tabs/familyTree/familyTreeDataStore.js';
import familyTownsStore from './familyTownsStore.js';
import statisticsStore from '../tabs/statistics/statisticsStore.js';
import gedcomConstantsStore from './gedcomConstantsStore.js';

const EMPTY = "";

const VALUE_OCCUPATION = "Occupation";

const { TAGS, VALUES, CALENDARS, MONTHS_MAP } = gedcomConstantsStore;

function byTag(tag) {
    return gedcomConstantsStore.byTag(tag);
}

function getFirst(array, def) {
    return _.get(array, 0, def);
}

export function formatName(str, isSurname) {
    if (typeof str !== "string") {
        str = String(str);
    }

    // Capitalize only the first letter of each word and after "-"
    str = str.toLowerCase().replace(/(^|\s|-)([a-zà-ÿ])/g, function (match) {
        return match.toUpperCase();
    });

    // Replace occurrences of " De " with " de "
    str = str.replace(/ De /g, " de ");

    // If the string starts with "De ", replace it with "de "
    if (str.startsWith("De ")) {
        str = "de " + str.slice(3);
    }

    // If the string is a surname, replace "xxx ou xxy" with "xxx"
    if (isSurname) {
        str = str.replace(/(\S+)\s+[oO]u\s+\S+/gi, "$1");
    }

    return str;
}

function processDetailedOccupations(individualJson) {
    const occupations = [];

    // Traiter les occupations directes
    individualJson.tree
        .filter(byTag(TAGS.OCCUPATION))
        .forEach(occNode => {
            const dateNode = occNode.tree?.find(node => node.tag === TAGS.DATE);
            occupations.push({
                value: formatOccupation(occNode.data),
                date: dateNode ? processDate(dateNode.data) : null,
                year: dateNode ? extractYear(processDate(dateNode.data)) : null,
                type: 'direct'
            });
        });

    // Ajouter les occupations des événements
    individualJson.tree
        .filter(node =>
            node.tag === TAGS.EVENT &&
            node.tree.some(subNode =>
                subNode.tag === TAGS.TYPE &&
                subNode.data === VALUE_OCCUPATION
            )
        )
        .forEach(eventNode => {
            const dateNode = eventNode.tree?.find(node => node.tag === TAGS.DATE);
            const noteNode = eventNode.tree?.find(node => node.tag === TAGS.NOTE);

            if (noteNode) {
                occupations.push({
                    value: formatOccupation(noteNode.data),
                    date: dateNode ? processDate(dateNode.data) : null,
                    year: dateNode ? extractYear(processDate(dateNode.data)) : null,
                    type: 'event'
                });
            }
        });

    return _.orderBy(occupations, ['year', 'date'], ['asc', 'asc']);
}

// Fonction pour formater l'occupation
function formatOccupation(occupation) {
    if (!occupation) return null; // Retourne null si l'occupation n'est pas définie
    return occupation.charAt(0).toUpperCase() + occupation.slice(1).toLowerCase();
}

function processOccupations(individualJson) {
    // Direct retrieval of occupations
    const directOccupations = jsonpointer.get(individualJson, '/tree').filter(byTag(TAGS.OCCUPATION))
        .map((occ) => ({
            occupation: formatOccupation(occ.data),
        }));

    // Retrieval of occupation details in marked events
    const detailOccupations = jsonpointer.get(individualJson, '/tree').filter(
        (node) => node.tag === TAGS.EVENT &&
            jsonpointer.get(node, '/tree').some(
                (subNode) => subNode.tag === TAGS.TYPE && subNode.data === VALUE_OCCUPATION
            )
    ).flatMap((node) => jsonpointer.get(node, '/tree').filter((subNode) => subNode.tag === TAGS.NOTE))
        .map((note) => ({
            occupation: note.data, // Assume these details as additional occupations
        }));

    // Combine direct occupations and details
    const allOccupations = [...directOccupations, ...detailOccupations];

    // Construct the formatted list of occupations
    let formattedOccupations =
        allOccupations.length > 0
            ? `<ul class='list-group'>${allOccupations
                .map((occ) => `<li class='list-group-item'>${occ.occupation}</li>`)
                .join("")}</ul>`
            : "";

    return formattedOccupations;
}

function formatPersonLink(id, name) {
    return `<a href="#"><span class="person-link" data-person-id="${id}">${name}</span></a>`;
}

function formatSiblings(siblings) {
    return `<ul class="list-unstyled">${_.map(
        siblings,
        (s) =>
            `<li>-${formatPersonLink(s.id, s.name)} (${s.birthDate} - ${s.deathDate})</li>`
    ).join("\n")}</ul>`;
}

function formatChild(child) {
    const birthMoment = moment(child.birthDate, "DD/MM/YYYY");
    const deathMoment = child.deathDate
        ? moment(child.deathDate, "DD/MM/YYYY")
        : null;
    const ageAtDeath = deathMoment
        ? ` à ${deathMoment.diff(birthMoment, "years")} ans`
        : "";
    return `${formatPersonLink(child.id, child.name)}${child.deathDate ? ` (†${child.deathDate}${ageAtDeath})` : ""
        }`;
}

function extractBasicInfo(individualJson) {
    const names = individualJson.tree.filter(byTag(TAGS.NAME));
    const nameInfo = names.map((o) =>
        o.data.split("/").map((s) => s.trim().replace(/_/, " "))
    );
    let name = formatName(
        nameInfo.map((info) => info[0]).find((n) => n) || "",
        false
    );
    let surname = formatName(
        nameInfo.map((info) => info[1]).find((s) => s) || "",
        true
    );

    let fullName = `${name.split(" ")[0]} ${surname}`;
    let personLink = formatPersonLink(individualJson.pointer, fullName);

    const genderMap = { 'M': 'male', 'F': 'female' };

    const result = individualJson.tree.reduce((acc, curr) => {
        if (byTag(TAGS.SEX)(curr)) {
            acc.gender = genderMap[curr.data] || 'unknown';
        } else if (byTag(TAGS.SIGNATURE)(curr)) {
            acc.canSign = curr.data === TAGS.YES;
        }
        return acc;
    }, { gender: 'male', canSign: false });

    return { name, surname, gender: result.gender, canSign: result.canSign, personLink };
}

function getRelativeDetails(individualID, allIndividuals) {
    const individual = allIndividuals.find((ind) => ind.pointer === individualID);
    if (!individual) return null; // Si l'individu n'existe pas, ignorer

    const { name, surname } = extractBasicInfo(individual);
    const firstName = name ? name.split(" ")[0] : "";
    const fullName =
        firstName || surname
            ? `${firstName || ""} ${surname || ""}`.trim()
            : "Nom inconnu";

    const birthEventNode = individual.tree.find((node) => node.tag === "BIRT");
    const deathEventNode = individual.tree.find((node) => node.tag === "DEAT");

    // Récupérer les nœuds de date et formater les dates
    const birthDateNode = birthEventNode
        ? birthEventNode.tree.find((node) => node.tag === "DATE")
        : null;
    const birthDate = birthDateNode ? processDate(birthDateNode.data) : "";
    const deathDateNode = deathEventNode
        ? deathEventNode.tree.find((node) => node.tag === "DATE")
        : null;
    const deathDate = deathDateNode ? processDate(deathDateNode.data) : "";

    return {
        id: individualID,
        name: fullName,
        birthDate: birthDate,
        deathDate: deathDate,
    };
}

function calculateGeneration(individualPointer, allFamilies, cache = new Map()) {
    // Si déjà calculé, retourner la valeur du cache
    if (cache.has(individualPointer)) {
        return cache.get(individualPointer);
    }

    // Trouver la famille où l'individu est un enfant
    const parentFamily = allFamilies.find(family =>
        family.tree.some(node =>
            node.tag === TAGS.CHILD && node.data === individualPointer
        )
    );

    // Si pas de famille parentale, c'est la génération 1
    if (!parentFamily) {
        cache.set(individualPointer, 1);
        return 1;
    }

    // Trouver l'ID d'un parent
    const parentId = parentFamily.tree.find(node =>
        node.tag === TAGS.HUSBAND || node.tag === TAGS.WIFE
    )?.data;

    // Si pas de parent, c'est la génération 1
    if (!parentId) {
        cache.set(individualPointer, 1);
        return 1;
    }

    // Calculer récursivement la génération du parent et ajouter 1
    const parentGeneration = calculateGeneration(parentId, allFamilies, cache);
    const generation = parentGeneration + 1;

    // Mettre en cache avant de retourner
    cache.set(individualPointer, generation);
    return generation;
}

/* Parental Family Members */
function getParentalFamily(individualPointer, allFamilies, allIndividuals) {
    // Find the family where the individual is a child
    const parentFamily = allFamilies.find((family) =>
        family.tree.some(
            (node) => node.tag === "CHIL" && node.data === individualPointer
        )
    );

    if (!parentFamily) {
        return { siblings: [], fatherId: null, motherId: null, siblingIds: [] };
    }

    // Extract the parents' IDs
    const husband = parentFamily.tree.find((node) => node.tag === "HUSB")?.data;
    const wife = parentFamily.tree.find((node) => node.tag === "WIFE")?.data;

    // Extract the siblings
    let siblings = parentFamily.tree
        .filter((node) => node.tag === "CHIL" && node.data !== individualPointer)
        .map((siblingNode) =>
            getRelativeDetails(siblingNode.data, allIndividuals)
        )
        .filter((sibling) => sibling !== null);

    // Extract sibling IDs
    let siblingIds = parentFamily.tree
        .filter((node) => node.tag === "CHIL" && node.data !== individualPointer)
        .map((siblingNode) => siblingNode.data);

    // Sort the siblings by birth date, then by name if the birth date is unknown
    siblings = _.orderBy(
        siblings,
        [
            (member) =>
                member.birthDate
                    ? new Date(member.birthDate.split("/").reverse().join("-"))
                    : Infinity,
            "name",
        ],
        ["asc", "asc"]
    );
    return { siblings, fatherId: husband, motherId: wife, siblingIds };
}

/* Individual family members */
export function getIndividualFamily(individualPointer, allFamilies, allIndividuals) {
    const result = {
        spouses: {},
        children: {}
    };

    // Trouver les familles où l'individu est un parent (HUSB ou WIFE)
    const parentFamilies = _.filter(allFamilies, family =>
        _.some(family.tree, node =>
            (node.tag === "HUSB" || node.tag === "WIFE") && node.data === individualPointer
        )
    );

    _.forEach(parentFamilies, family => {
        // Extraire les époux
        const spouses = _.map(
            _.filter(family.tree, node =>
                (node.tag === "HUSB" || node.tag === "WIFE") && node.data !== individualPointer
            ),
            spouseNode => spouseNode.data
        );

        // Extraire les enfants
        const children = _.map(
            _.filter(family.tree, node => node.tag === "CHIL"),
            childNode => childNode.data
        );

        // Extraire les informations de mariage
        const marriageNode = _.find(family.tree, node => node.tag === "MARR");
        const marriageInfo = marriageNode ? {
            date: _.get(_.find(marriageNode.tree, { tag: "DATE" }), 'data', ''),
            place: _.get(_.find(marriageNode.tree, { tag: "PLAC" }), 'data', ''),
            key: _.get(marriageNode, 'key', '')
        } : {};

        // Ajouter les détails des époux, des enfants et des mariages
        _.forEach(spouses, spouseId => {
            if (!result.spouses[spouseId]) {
                result.spouses[spouseId] = {
                    details: getRelativeDetails(spouseId, allIndividuals),
                    children: [],
                    marriage: marriageInfo
                };
            }

            _.forEach(children, childId => {
                const childDetails = getRelativeDetails(childId, allIndividuals);
                result.spouses[spouseId].children.push(childDetails);

                if (!result.children[childId]) {
                    result.children[childId] = {
                        details: childDetails,
                        parents: []
                    };
                }
                result.children[childId].parents.push(individualPointer);
            });
        });
    });
    return result;
}

/* Marriages */
function processMarriages(
    individualPointer,
    allIndividuals,
    allFamilies,
    individualTowns
) {
    if (!individualPointer || !_.isArray(allFamilies)) {
        return [];
    }

    // Collect marriage information using getIndividualFamily
    const individualFamilyInfo = getIndividualFamily(individualPointer, allFamilies, allIndividuals);

    const marriages = _.map(individualFamilyInfo.spouses, (spouseInfo, spouseId) => {
        const { details: spouseDetails, children, marriage } = spouseInfo;

        // Process the details of the marriage event
        const event = {
            tree: [{ tag: 'DATE', data: marriage.date }, { tag: 'PLAC', data: marriage.place }],
            key: marriage.key // Add the town key (townKey)
        };
        const { eventDetails: rawEventDetails, updatedIndividualTowns } = processEventDatePlace(
            event,
            individualTowns
        );

        // Add the family ID to the event details
        const eventDetails = { ...rawEventDetails, eventId: '', spouseId }; // Add spouseId here

        // Get the spouse's name
        const spouseName = spouseDetails.name;

        // Generate the formatted marriage description
        let gender = "";  // Assume that gender is determined elsewhere or can be added here
        let age = "";  // Assume that age is determined elsewhere or can be added here

        const formattedMarriage = generateEventDescription(
            "MARR",
            {
                ...eventDetails,
                spouseName: spouseName,
                spouseId: spouseId // Pass spouseId to eventData
            },
            gender,
            age
        );

        // Get the couple's details
        const couple = {
            husband: individualPointer,
            wife: spouseId
        };

        return { formattedMarriage, children, spouseName, eventDetails, couple };
    });

    return marriages;
}

let cachedDepartementData = null;
let cachedCountryData = null;

async function getDepartementData() {
    if (!cachedDepartementData) {
        const { departementData } = await import('./departementData.js');
        cachedDepartementData = departementData;
    }
    return cachedDepartementData;
}

async function getCountryData() {
    if (!cachedCountryData) {
        const { countryData } = await import('./countryData.js');
        cachedCountryData = countryData;
    }
    return cachedCountryData;
}

async function processPlace({ data: original, tree } = {}) {
    const departementData = await getDepartementData();
    const countryData = await getCountryData();

    const segments = original.split(/\s*,\s*/);
    let placeObj = {
        latitude: "",
        longitude: "",
        town: formatTownName(segments[0]),
        townDisplay: segments[0],
        subdivision: "",
        departement: "",
        departementColor: "",
        region: "",
        country: "",
        countryCode: "",
        countryColor: "",
    };

    // Normalisation pour la recherche du pays
    const normalizedSegments = _.map(segments, (segment) => normalizeGeoString(segment));

    // Recherche du pays dans les données de pays
    const findCountry = () => {
        for (const continent of countryData.continents) {
            for (const country of continent.countries) {
                if (_.some(normalizedSegments, segment => segment === country.key.FR)) {
                    return country;
                }
            }
        }
        return null;
    };

    const countryMatch = findCountry();

    if (countryMatch) {
        placeObj.country = countryMatch.name.FR;
        placeObj.countryCode = countryMatch.code;
        placeObj.countryColor = countryMatch.color;
    }

    // If the country is empty or equal to France, search for postal or departmental codes
    if (!placeObj.country || placeObj.country === "France") {
        const codeRegex = /\b\d{5}\b|\(\d{2}\)/;
        const codeMatch = original.match(codeRegex);

        if (codeMatch) {
            const code = codeMatch[0];
            if (code.startsWith("(")) {
                placeObj.departement = code.replace(/[()]/g, "");
            } else if (code.length === 5) {
                placeObj.departement = code.substring(0, 2);
            }

            // Check if placeObj.departement is a number
            if (!isNaN(placeObj.departement)) {
                // Use Lodash's find method to find the departement
                const departement = _.find(departementData, { 'code': placeObj.departement });

                // If the departement is found, replace placeObj.departement with the departement name
                if (departement) {
                    placeObj.departement = departement.name;
                    placeObj.departementColor = departement.departementColor;
                }
            } else if (typeof placeObj.departement === 'string') {
                // If placeObj.departement is a string, find the departement by name
                const departement = _.find(departementData, { 'name': placeObj.departement });

                // If the departement is found, set placeObj.departementColor to the departement color
                if (departement) {
                    placeObj.departementColor = departement.departementColor;
                }
            }
        }
    }

    // Traitement pour subdivision, departement
    if (segments.length >= 2) {
        if (segments.length >= 3) {
            placeObj.subdivision = _.initial(segments).join(", ");
            // S'assure de ne pas écraser le département si déjà défini par un code postal
            if (!placeObj.departement) {
                placeObj.departement = segments[segments.length - 2];
            }
        } else {
            if (!placeObj.departement) {
                placeObj.departement = segments[0];
            }
        }
    }

    // Extraction of geolocation data if available
    if (_.isArray(tree)) {
        const mapNode = _.find(tree, { tag: "MAP" });
        if (mapNode && _.isArray(mapNode.tree)) {
            const latiNode = _.find(mapNode.tree, { tag: "LATI" });
            const longNode = _.find(mapNode.tree, { tag: "LONG" });
            if (latiNode) {
                placeObj.latitude = parseFloat(latiNode.data.trim());
            }
            if (longNode) {
                placeObj.longitude = parseFloat(longNode.data.trim());
            }
        }
    }

    // Formatage final de la chaîne de lieu pour l'affichage
    const parts = _.filter([
        placeObj.subdivision,
        placeObj.town,
        placeObj.departement,
        placeObj.country,
    ]);
    placeObj.display = parts.join(", ");

    return placeObj;
}

function processDate(s) {
    if (typeof s !== "string") {
        return "";
    }

    let trimmed = s.trim().toUpperCase();

    const isRepublican = gedcomConstantsStore.isRepublicanCalendar(trimmed);
    if (isRepublican) {
        trimmed = trimmed.substring(CALENDARS.REPUBLICAN.length).trim();
    } else if (gedcomConstantsStore.isGregorianCalendar(trimmed)) {
        trimmed = trimmed.substring(CALENDARS.GREGORIAN.length).trim();
    }

    const split = trimmed.split(/\s+/);
    if (split.length === 0) {
        console.error("Error: No date parts found after trimming", trimmed);
        return "";
    }

    let day, month, year;
    if (split.length === 3) {
        day = parseInt(split[0], 10);
        month = (isRepublican ?
            MONTHS_MAP.REPUBLICAN[split[1]] :
            MONTHS_MAP.GREGORIAN[split[1]]) || 0;
        year = parseInt(split[2], 10);
    } else if (split.length === 2) {
        month = (isRepublican ?
            MONTHS_MAP.REPUBLICAN[split[1]] :
            MONTHS_MAP.GREGORIAN[split[1]]) || 0;
        year = parseInt(split[1], 10);
    } else if (split.length === 1) {
        year = parseInt(split[0], 10);
    }

    if (isRepublican) {
        year += 1792; // Conversion de l'année républicaine en grégorienne
    }
    let display = year ? year.toString() : "";
    if (month > 0) {
        display = padTwoDigits(month) + "/" + display;
    }
    if (day > 0) {
        display = padTwoDigits(day) + "/" + display;
    }

    return display;
}

function processEventDatePlace(event, individualTowns) {
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

// Optimized version of buildIndividual
function handleEventTags() {
    const config = configStore.getConfig;
    let birthTags = [TAGS.BIRTH],
        deathTags = [TAGS.DEATH];
    if (config.substituteEvents) {
        birthTags = birthTags.concat([TAGS.BAPTISM]);
        deathTags = deathTags.concat([TAGS.BURIAL]);
    }
    return { birthTags, deathTags };
}

/* Functions for managing events data */
function generateEventDescription(eventType, eventData, gender, age, deceased) {
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

function buildEventFallback(individualJson, tags, individualTowns) {
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
function addEvent(type, name, surname, date, town, description, eventId = '', eventAttendees = [], birthDate, individualEvents) {
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


function buildIndividual(individualJson, allIndividuals, allFamilies) {
    if (!individualJson) {
        return { id: null, name: "", surname: "", birth: {}, death: {} };
    }

    let individualTowns = [];
    let individualEvents = [];
    let formattedDeath = "";
    let age;
    let deceased = false;

    const { name, surname, gender, canSign, personLink } = extractBasicInfo(individualJson);
    const { birthTags, deathTags } = handleEventTags();

    const birthData = buildEventFallback(individualJson, birthTags, individualTowns).eventDetails;
    const birthYear = birthData.date ? extractYear(birthData.date) : "";
    const formattedBirth = generateEventDescription("BIRT", birthData, gender, age);
    addEvent("birth", name, surname, birthData.date, birthData.town, formattedBirth, "", [], birthData.date, individualEvents);

    const deathData = buildEventFallback(individualJson, deathTags, individualTowns).eventDetails;
    const deathYear = deathData.date ? extractYear(deathData.date) : "";
    let currentYear = new Date().getFullYear();

    if (!birthData.date) {
        deceased = true;
        formattedDeath = deathData.date ? generateEventDescription("DEAT", deathData, gender, null, true) : "Information on life and death unknown";
        addEvent("death", name, surname, deathData.date || "date inconnue", deathData.town || "", formattedDeath, "", [], birthData.date, individualEvents);
    } else {
        if (!deathData.date) {
            const today = moment().format("DD/MM/YYYY");
            if (birthYear >= currentYear - 105) {
                age = calculateAge(birthData.date);
                deceased = false;
                formattedDeath = generateEventDescription("DEAT", { date: today, town: "" }, gender, age, false);
                addEvent("today", name, surname, today, "", formattedDeath, "", [], birthData.date, individualEvents);
            } else {
                deceased = true;
                formattedDeath = generateEventDescription("DEAT", { date: today, town: "" }, gender, "", true);
                addEvent("death", name, surname, "date inconnue", "", formattedDeath, "", [], birthData.date, individualEvents);
            }
        } else {
            age = calculateAge(birthData.date, deathData.date);
            deceased = true;
            formattedDeath = generateEventDescription("DEAT", deathData, gender, age, true);
            addEvent("death", name, surname, deathData.date, deathData.town, formattedDeath, "", [], birthData.date, individualEvents);
        }
    }

    // Search for the family in which the individual is a child
    const parentalFamily = getParentalFamily(individualJson.pointer, allFamilies, allIndividuals);

    // Add individual as a node in the genealogy graph
    familyTreeDataStore.addNodeToGenealogyGraph({
        id: individualJson.pointer,
        name: name + ' ' + surname,
        birthDate: birthData.date,
        deathDate: deathData.date
    });

    if (parentalFamily.fatherId) {
        familyTreeDataStore.addEdgeToGenealogyGraph(
            parentalFamily.fatherId,
            individualJson.pointer,
            'father'
        );
    }

    if (parentalFamily.motherId) {
        familyTreeDataStore.addEdgeToGenealogyGraph(
            parentalFamily.motherId,
            individualJson.pointer,
            'mother'
        );
    }

    const formattedSiblings = parentalFamily.siblings.length > 0
        ? formatSiblings(parentalFamily.siblings)
        : "";

    // Search for the family in which the individual is a spouse/parent
    const individualFamily = getIndividualFamily(
        individualJson.pointer,
        allFamilies,
        allIndividuals
    );

    const marriages = processMarriages(
        individualJson.pointer,
        allIndividuals,
        allFamilies,
        individualTowns
    );

    marriages.forEach((marriage) => {
        addEvent(
            "marriage",
            name,
            surname,
            marriage.eventDetails.date,
            marriage.eventDetails.town,
            marriage.formattedMarriage,
            marriage.eventDetails.eventId,
            marriage.couple ? [marriage.couple.husband, marriage.couple.wife] : [],
            birthData.date,
            individualEvents
        );

        marriage.children.forEach((child) => {
            addEvent(
                "child-birth",
                child.name,
                "",
                child.birthDate,
                "",
                formatChild(child),
                "",
                [],
                birthData.date,
                individualEvents
            );
        });
    });

    const formattedOccupations = processOccupations(individualJson);

    const stats = {
        demography: {
            birthInfo: {
                date: birthData.date,
                year: birthYear,
                place: {
                    town: birthData.town || "",
                    departement: birthData.departement || "",
                    country: birthData.country || "",
                    coordinates: {
                        latitude: birthData.latitude || null,
                        longitude: birthData.longitude || null
                    }
                }
            },
            deathInfo: {
                date: deathData.date,
                year: deathYear,
                place: {
                    town: deathData.town || "",
                    departement: deathData.departement || "",
                    country: deathData.country || "",
                    coordinates: {
                        latitude: deathData.latitude || null,
                        longitude: deathData.longitude || null
                    }
                },
                ageAtDeath: age
            },
            generation: calculateGeneration(individualJson.pointer, allFamilies)
        },
        family: {
            parentalFamily: {
                fatherId: parentalFamily.fatherId,
                motherId: parentalFamily.motherId,
                siblings: parentalFamily.siblings,
                siblingCount: parentalFamily.siblings.length
            },
            marriages: marriages.map(marriage => ({
                date: marriage.eventDetails.date,
                place: {
                    town: marriage.eventDetails.town,
                    departement: marriage.eventDetails.departement,
                    country: marriage.eventDetails.country
                },
                spouseId: marriage.eventDetails.spouseId,
                childrenCount: marriage.children.length
            })),
            totalChildren: Object.values(individualFamily.children).length
        },
        identity: {
            firstName: name.split(" ")[0],
            lastName: surname,
            gender: gender,
            occupations: processDetailedOccupations(individualJson)
        }
    };

    // console.log(stats);

    return {
        id: individualJson.pointer,
        name,
        surname,
        personLink,
        birthDate: birthData.date,
        birthDepartement: birthData.departement || "",
        birthCountry: birthData.country || "",
        birthYear,
        fanBirthPlace: birthData.town || "",
        deathYear,
        fanDeathPlace: deathData.town || "",
        age,
        deceased,
        gender,
        fatherId: parentalFamily.fatherId,
        motherId: parentalFamily.motherId,
        spouseIds: Object.keys(individualFamily.spouses),
        siblingIds: parentalFamily.siblingIds,
        individualTowns,
        individualEvents,
        formattedBirth,
        formattedDeath,
        formattedOccupations,
        formattedMarriages: marriages.map((marriage) => marriage.formattedMarriage).join("\n"),
        formattedSiblings,
        bgColor: birthData.departementColor ? birthData.departementColor : birthData.countryColor,
        stats
    };
}

function buildHierarchy(currentRoot) {
    console.time("buildHierarchy");
    if (!currentRoot) {
        console.warn("Root is undefined in buildHierarchy");
        return null;
    }

    const config = configStore.getConfig;
    const maxHeight = config.maxGenerations - 1;

    timelineEventsStore.clearEvents();

    // Utiliser le cache des individus déjà construit
    const individualsCache = gedcomDataStore.getIndividualsCache()

    function buildRecursive(
        individualPointer,
        parent,
        sosa,
        height,
        individualsCache,
        config
    ) {
        if (!individualsCache.has(individualPointer) && individualPointer !== null) {
            return null;
        }

        const individual =
            individualsCache.get(individualPointer) ||
            createFictiveIndividual(individualPointer, sosa, height);

        // Utiliser les événements individuels si disponibles
        if (individual.individualEvents && individual.individualEvents.length > 0) {
            individual.individualEvents.forEach((event) => {
                const validTypes = ['death', 'birth', 'marriage'];
                if (validTypes.includes(event.type)) {
                    timelineEventsStore.addEvent({
                        ...event,
                        id: individualPointer,
                        sosa,
                    });
                }
            });
        }

        let obj = {
            ...individual,
            sosa: sosa,
            generation: height,
            parent: parent,
        };

        if (height < maxHeight) {
            const parents = [];

            const fatherPointer = individual.fatherId;
            const motherPointer = individual.motherId;

            if (fatherPointer) {
                const fatherObj = individualsCache.get(fatherPointer);
                if (fatherObj) {
                    parents.push(
                        buildRecursive(
                            fatherPointer,
                            obj,
                            sosa * 2,
                            height + 1,
                            individualsCache,
                            config
                        )
                    );
                } else {
                    console.log(`Father not found in cache: ${fatherPointer}`);
                }
            } else if (config.showMissing) {
                parents.push(
                    buildRecursive(
                        null,
                        obj,
                        sosa * 2,
                        height + 1,
                        individualsCache,
                        config
                    )
                );
            }

            if (motherPointer) {
                const motherObj = individualsCache.get(motherPointer);
                if (motherObj) {
                    parents.push(
                        buildRecursive(
                            motherPointer,
                            obj,
                            sosa * 2 + 1,
                            height + 1,
                            individualsCache,
                            config
                        )
                    );
                } else {
                    console.log(`Mother not found in cache: ${motherPointer}`);
                }
            } else if (config.showMissing) {
                parents.push(
                    buildRecursive(
                        null,
                        obj,
                        sosa * 2 + 1,
                        height + 1,
                        individualsCache,
                        config
                    )
                );
            }
            obj.children = parents;
        }

        return obj;
    }

    function createFictiveIndividual(individualPointer, sosa, height) {
        return {
            id: individualPointer,
            name: "",
            surname: "",
            sosa: sosa,
            generation: height,
            gender: sosa % 2 === 0 ? "M" : "F",
            children: [],
            parent: null,
            individualEvents: [],
        };
    }

    // Utiliser currentRoot au lieu de rootIndividualPointer
    const hierarchy = buildRecursive(
        currentRoot,
        null,
        1,
        0,
        individualsCache,
        config
    );

    console.timeEnd("buildHierarchy");
    return hierarchy;
}

function toJson(data) {
    const triggers = "[�]";
    const view = new Uint8Array(data);
    const text = new TextDecoder().decode(view);
    const parsed = parseGedcom.parse(text);

    const isLikelyAnsi = new RegExp(triggers).test(text);
    const isAnsi = getFirst(
        parsed
            .filter(byTag(TAGS.HEAD))  // ✅ Utilise la constante du store
            .flatMap((a) => a.tree.filter(byTag(TAGS.ENCODING)).map((a) => a.data)),
        null
    ) === VALUES.ANSI;  // ✅ Utilise la constante du store

    let result;

    if (isLikelyAnsi || isAnsi) {
        const extendedAsciiTable =
            "€?‚ƒ„…†‡ˆ‰Š‹Œ?Ž??‘’“”•–—˜™š›œ?žŸ?¡¢£¤¥¦§¨©ª«¬?®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ";
        const builder = Array.from(view, (charCode) =>
            (charCode & 0x80) === 0
                ? String.fromCharCode(charCode)
                : extendedAsciiTable.charAt(charCode ^ 0x80)
        );
        const text2 = builder.join("");

        result = parseGedcom.parse(text2);
    } else {
        result = parsed;
    }
    return result;
}

// Function to store all family locations in memory
export async function getAllPlaces(json) {
    try {
        const dbTowns = await getAllRecords();
        familyTownsStore.setTownsData(dbTowns);

        // Process each individual for places
        for (const individual of json) {
            await processTree(individual.tree, null);
        }

        // Update geocoding after all places are collected
        await familyTownsStore.updateTownsViaProxy();

        return { json };
    } catch (error) {
        console.error("Error in getAllPlaces: ", error);
        throw error;
    }
}

async function getAllRecords() {
    return new Promise((resolve, reject) => {
        const storedData = localStorage.getItem("townsDB");
        if (storedData) {
            try {
                // Convertir les données JSON en objet JavaScript
                const dbTowns = JSON.parse(storedData);

                // Vider townsDB debug
                // localStorage.removeItem("townsDB");

                resolve(dbTowns);
            } catch (error) {
                reject("Erreur lors de la conversion des données JSON : " + error);
            }
        } else {
            // S'il n'y a pas de données, retourner un objet vide
            resolve({});
        }
    });
}

async function processTree(tree, parentNode) {
    for (const node of tree) {
        if (node.tag === "PLAC" && parentNode) {
            let placeInfo = await processPlace({ data: node.data, tree: node.tree });
            let normalizedKey = normalizeGeoString(placeInfo.town);
            if (!normalizedKey) continue;

            parentNode.key = normalizedKey;

            familyTownsStore.addTown(normalizedKey, {
                town: placeInfo.town,
                departement: placeInfo.departement,
                departementColor: placeInfo.departementColor,
                country: placeInfo.country,
                countryCode: placeInfo.countryCode,
                countryColor: placeInfo.countryColor,
                latitude: placeInfo.latitude,
                longitude: placeInfo.longitude,
                townDisplay: placeInfo.departement ?
                    `${placeInfo.town} (${placeInfo.departement})` :
                    placeInfo.town
            });
        }

        if (node.tree && node.tree.length > 0) {
            await processTree(
                node.tree,
                ["BIRT", "DEAT", "BURI", "MARR", "OCCU", "EVEN"].includes(node.tag) ? node : parentNode
            );
        }
    }
}

function calculateMaxGenerations(individualsCache, allFamilies) {
    let maxGen = 0;
    const generationMap = new Map();

    // Initialize with root individuals (those without parents)
    const rootIndividuals = Array.from(individualsCache.keys()).filter(id => {
        const individual = individualsCache.get(id);
        return !individual.fatherId && !individual.motherId;
    });

    // Set generation 1 for root individuals
    rootIndividuals.forEach(id => generationMap.set(id, 1));

    // Process each family to calculate generations
    let changed = true;
    while (changed) {
        changed = false;
        allFamilies.forEach(family => {
            // Get parents
            const fatherId = family.tree.find(node => node.tag === 'HUSB')?.data;
            const motherId = family.tree.find(node => node.tag === 'WIFE')?.data;

            // Get parent generation (max of both parents if they exist)
            const parentGen = Math.max(
                generationMap.get(fatherId) || 0,
                generationMap.get(motherId) || 0
            );

            if (parentGen > 0) {
                // Process children
                const childNodes = family.tree.filter(node => node.tag === 'CHIL');
                childNodes.forEach(childNode => {
                    const childId = childNode.data;
                    const currentChildGen = generationMap.get(childId) || 0;
                    const newChildGen = parentGen + 1;

                    if (newChildGen > currentChildGen) {
                        generationMap.set(childId, newChildGen);
                        maxGen = Math.max(maxGen, newChildGen);
                        changed = true;
                    }
                });
            }
        });
    }

    return maxGen;
}

/**
 * Helper function to check if an individual is a parent in another family
 * @param {string} individualId - The ID of the individual to check
 * @param {Array} allFamilies - All families in the GEDCOM
 * @returns {boolean} Whether the individual appears as a parent in another family
 */
function isParentInOtherFamily(individualId, allFamilies) {
    return allFamilies.some(familyJson =>
        familyJson.tree.some(node =>
            node.tag === 'CHIL' && node.data === individualId
        )
    );
}

/**
 * Determines whether an individual should be processed based on family relationships
 * @param {Object} individualJson - The individual's GEDCOM record
 * @param {Array} familiesWithIndividual - Families where the individual appears
 * @param {Array} allFamilies - All families in the GEDCOM
 * @returns {boolean} Whether the individual should be processed
 */
function shouldProcessIndividual(individualJson, familiesWithIndividual, allFamilies) {
    // Skip individuals not appearing in any family
    if (familiesWithIndividual.length === 0) return false;

    // Special handling for individuals appearing in only one family
    if (familiesWithIndividual.length === 1) {
        const family = familiesWithIndividual[0];
        const hasChildren = family.tree.some(byTag(TAGS.CHILD));  // Utiliser TAGS.CHILD au lieu de TAG_CHILD

        if (!hasChildren) {
            const spouses = family.tree.filter(node =>
                node.tag === TAGS.HUSBAND || node.tag === TAGS.WIFE);  // TAGS.HUSBAND et TAGS.WIFE

            if (spouses.length === 2) {
                const otherSpouse = spouses.find(node =>
                    node.data !== individualJson.pointer);
                const otherSpouseFamilies = allFamilies.filter(familyJson =>
                    familyJson.tree.some(node =>
                        node.data === otherSpouse.data &&
                        (node.tag === TAGS.HUSBAND || node.tag === TAGS.WIFE)  // TAGS.HUSBAND et TAGS.WIFE
                    )
                );

                if (otherSpouseFamilies.length === 1 &&
                    !isParentInOtherFamily(otherSpouse.data, allFamilies)) {
                    return false;
                }
            }
        }
    }

    return true;
}

/**
 * Extracts birth and death years from an individual record
 * @param {Object} individualJson - The individual's GEDCOM record
 * @returns {Object} Object containing birthYear and deathYear
 */
function extractDatesFromIndividual(individualJson) {
    const birthNode = individualJson.tree.find(node =>
        [TAGS.BIRTH, TAGS.BAPTISM].includes(node.tag));
    const deathNode = individualJson.tree.find(node =>
        [TAGS.DEATH, TAGS.BURIAL].includes(node.tag));

    const birthYear = birthNode ?
        extractYear(processDate(birthNode.tree.find(byTag(TAGS.DATE))?.data)) : null;
    const deathYear = deathNode ?
        extractYear(processDate(deathNode.tree.find(byTag(TAGS.DATE))?.data)) : null;

    return { birthYear, deathYear };
}

/**
 * Updates the statistics store with accumulated batch statistics
 * @param {Object} batchStatistics - Accumulated statistics from a batch of individuals
 */
function updateStatisticsStore(batchStatistics) {
    statisticsStore.updateTotalIndividuals(
        batchStatistics.genders.male + batchStatistics.genders.female
    );
    statisticsStore.updateGenderCount('male', batchStatistics.genders.male);
    statisticsStore.updateGenderCount('female', batchStatistics.genders.female);

    batchStatistics.births.forEach(year => statisticsStore.addBirthYear(year));
    batchStatistics.deaths.forEach(year => statisticsStore.addDeathYear(year));
    batchStatistics.ages.forEach(age => statisticsStore.addAgeAtDeath(age));
}

/**
 * Processes marriage and children statistics for an individual
 * @param {Object} individualJson - The individual's GEDCOM record
 * @param {Array} familiesWithIndividual - Families where the individual appears
 * @param {Map} familyStatistics - Pre-computed family statistics
 * @param {number} birthYear - Individual's birth year
 * @param {Map} individualsCache - Cache of processed individuals
 */
function processMarriageAndChildrenStatistics(
    individualJson,
    familiesWithIndividual,
    familyStatistics,
    birthYear,
    individualsCache
) {
    familiesWithIndividual.forEach(family => {
        const stats = familyStatistics.get(family.pointer);
        if (!stats) return;

        statisticsStore.updateMarriages(1);

        if (stats.childrenCount > 0) {
            statisticsStore.addChildrenPerCouple(stats.childrenCount);

            const firstChildBirth = _.min(family.tree
                .filter(byTag(TAGS.CHILD))
                .map(child => {
                    const childNode = individualsCache.get(child.data);
                    return childNode ? extractYear(childNode.birthDate) : null;
                })
                .filter(Boolean));

            if (firstChildBirth && birthYear) {
                const ageAtFirstChild = firstChildBirth - birthYear;
                if (ageAtFirstChild > 0 && ageAtFirstChild < 100) {
                    const period = Math.floor(firstChildBirth / 5) * 5;
                    statisticsStore.addAgeAtFirstChild(period, ageAtFirstChild);
                }
            }
        }
    });
}

function prebuildindividualsCache() {
    console.time("prebuildindividualsCache");
    const json = gedcomDataStore.getSourceData();
    const individualsCache = new Map();

    const allIndividuals = _.filter(json, byTag(TAGS.INDIVIDUAL));
    const allFamilies = _.filter(json, byTag(TAGS.FAMILY));

    // Traiter les individus pour le cache
    allIndividuals.forEach(individualJson => {
        const individual = buildIndividual(individualJson, allIndividuals, allFamilies);
        individualsCache.set(individualJson.pointer, individual);
    });

    // Calculer le nombre max de générations
    const maxGenerations = calculateMaxGenerations(individualsCache, allFamilies);
    configStore.setConfig({ maxGenerations: Math.min(maxGenerations, 8) });
    configStore.setAvailableGenerations(maxGenerations);

    // Retirer l'appel aux statistiques d'ici
    console.timeEnd("prebuildindividualsCache");
    return individualsCache;
}


function getIndividualsList() {
    const json = gedcomDataStore.getSourceData();
    const allIndividuals = _.filter(json, byTag(TAGS.INDIVIDUAL));
    const allFamilies = _.filter(json, byTag(TAGS.FAMILY));

    // Initialiser le service avant de l'utiliser
    statisticsService.initialize();

    // Configurer l'écoute du progrès
    statisticsService.onProgress((progress) => {
        console.log(`Processing statistics: ${progress}%`);
    });

    // Construire d'abord le cache des individus
    const individualsCache = prebuildindividualsCache();
    gedcomDataStore.clearSourceData();
    gedcomDataStore.setIndividualsCache(individualsCache);

    // Puis lancer le traitement des statistiques
    statisticsService.processData();

    requestAnimationFrame(() => {
        import(/* webpackChunkName: "treeUI" */ '../tabs/familyTree/treeUI.js')
            .then(module => {
                const { initializeFamilyTree } = module;
                initializeFamilyTree();
            })
            .catch(error => {
                console.error('Error loading the module:', error);
            });
    });

    const individualsList = Array.from(individualsCache.values());
    return { individualsList };
}

export { toJson, buildHierarchy, getIndividualsList };
