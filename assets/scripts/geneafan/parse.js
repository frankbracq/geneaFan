import _ from "lodash";
import moment from "moment";
import parseGedcom from "parse-gedcom";
import {
    normalizeGeoString,
    formatTownName,
} from "./geo.js";
import {
    padTwoDigits,
} from "./utils.js";
import { extractYear, calculateAge, prefixedDate } from "./dates.js";
import {
    getFamilyTowns,
    setFamilyTowns,
    addToFamilyEvents,
    getSourceData,
    clearSourceData,
    getIndividualsCache,
    setIndividualsCache,
    addNodeToGenealogyGraph, 
    addEdgeToGenealogyGraph,
    getStatistics,
    updateTotalIndividuals,
    updateGenderCount,
    addBirthYear,
    addDeathYear,
    addAgeAtDeath,
    updateMarriages,
    addChildrenPerCouple,
    addAgeAtFirstChild,
    setFamilyTreeData,
} from "./stores/state.js";
import configStore from './stores/fanConfigStore.js';
import timelineStore from './stores/timelineStore.js';
import jsonpointer from 'jsonpointer';

const EMPTY = "";
const TAG_HEAD = "HEAD",
    TAG_ENCODING = "CHAR",
    TAG_FORMAT = "FORM",
    TAG_INDIVIDUAL = "INDI",
    TAG_FAMILY = "FAM",
    TAG_CHILD = "CHIL",
    TAG_HUSBAND = "HUSB",
    TAG_WIFE = "WIFE",
    TAG_NAME = "NAME",
    TAG_GIVEN_NAME = "GIVN",
    TAG_SURNAME = "SURN",
    TAG_SURNAME_PREFIX = "SPFX",
    TAG_BIRTH = "BIRT",
    TAG_BAPTISM = "CHR",
    TAG_DEATH = "DEAT",
    TAG_BURIAL = "BURI",
    TAG_SEX = "SEX",
    TAG_DATE = "DATE",
    TAG_PLACE = "PLAC",
    TAG_MARRIAGE = "MARR",
    TAG_SIGNATURE = "SIGN",
    TAG_EVENT = "EVEN",
    TAG_TYPE = "TYPE",
    TAG_NOTE = "NOTE",
    TAG_OCCUPATION = "OCCU";
const TAG_YES = "YES",
    TAG_ANSI = "ANSI";
const TAG_ABOUT = "ABT",
    TAG_BEFORE = "BEF",
    TAG_AFTER = "AFT";

const TAG_GREGORIAN = "@#DGREGORIAN@",
    TAG_REPUBLICAN = "@#DFRENCH R@";

const TAGS_MONTH = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
];
const TAGS_MONTH_REPUBLICAN = [
    "VEND",
    "BRUM",
    "FRIM",
    "NIVO",
    "PLUV",
    "VENT",
    "GERM",
    "FLOR",
    "PRAI",
    "MESS",
    "THER",
    "FRUC",
    "COMP",
];

// Transformation des tableaux en objets pour une recherche plus rapide
const MONTHS = TAGS_MONTH.reduce((obj, month, index) => {
    obj[month] = index + 1;
    return obj;
}, {});

const MONTHS_REPUBLICAN = TAGS_MONTH_REPUBLICAN.reduce((obj, month, index) => {
    obj[month] = index + 1;
    return obj;
}, {});

const VALUE_OCCUPATION = "Occupation";

const republicanConversion = [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
];

function byTag(tag) {
    return (obj) => obj.tag === tag;
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

// Fonction pour formater l'occupation
function formatOccupation(occupation) {
    if (!occupation) return null; // Retourne null si l'occupation n'est pas définie
    return occupation.charAt(0).toUpperCase() + occupation.slice(1).toLowerCase();
}

function processOccupations(individualJson) {
    // Direct retrieval of occupations
    const directOccupations = jsonpointer.get(individualJson, '/tree').filter(byTag(TAG_OCCUPATION))
        .map((occ) => ({
            occupation: formatOccupation(occ.data),
        }));

    // Retrieval of occupation details in marked events
    const detailOccupations = jsonpointer.get(individualJson, '/tree').filter(
        (node) => node.tag === TAG_EVENT &&
            jsonpointer.get(node, '/tree').some(
                (subNode) => subNode.tag === TAG_TYPE && subNode.data === VALUE_OCCUPATION
            )
    ).flatMap((node) => jsonpointer.get(node, '/tree').filter((subNode) => subNode.tag === TAG_NOTE))
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
    return `${formatPersonLink(child.id, child.name)}${
        child.deathDate ? ` (†${child.deathDate}${ageAtDeath})` : ""
    }`;
}

function extractBasicInfo(individualJson) {
    const names = individualJson.tree.filter(byTag(TAG_NAME));
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
        if (byTag(TAG_SEX)(curr)) {
            acc.gender = genderMap[curr.data] || 'unknown';
        } else if (byTag(TAG_SIGNATURE)(curr)) {
            acc.canSign = curr.data === TAG_YES;
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
        // console.error("Error: Input is not a string.", s);
        return "";
    }

    let trimmed = s.trim().toUpperCase();

    const isRepublican = trimmed.startsWith(TAG_REPUBLICAN);
    if (isRepublican) {
        trimmed = trimmed.substring(TAG_REPUBLICAN.length).trim();
    } else if (trimmed.startsWith(TAG_GREGORIAN)) {
        trimmed = trimmed.substring(TAG_GREGORIAN.length).trim();
    }

    const split = trimmed.split(/\s+/);
    if (split.length === 0) {
        console.error("Error: No date parts found after trimming", trimmed);
        return "";
    }

    let day, month, year;
    if (split.length === 3) {
        day = parseInt(split[0], 10);
        month =
      (isRepublican ? MONTHS_REPUBLICAN[split[1]] : MONTHS[split[1]]) || 0;
        year = parseInt(split[2], 10);
    } else if (split.length === 2) {
        month =
      (isRepublican ? MONTHS_REPUBLICAN[split[0]] : MONTHS[split[0]]) || 0;
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
    const familyTowns = getFamilyTowns();
    const dateNode = event.tree.find((node) => node.tag === "DATE");
    const date = dateNode ? processDate(dateNode.data) : ""; // Appel simplifié sans config
    const placeKey = event.key || "";
    let placeDetails = familyTowns[placeKey] || {};
    // Trouver si la ville est déjà dans individualTowns
    if (!individualTowns[placeKey]) {
    // Si la ville n'est pas encore dans la liste, l'ajouter
        individualTowns[placeKey] = {
            // name: placeDetails.town || '',
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
    // Si la ville est déjà présente, mettre à jour ses propriétés
        let town = individualTowns[placeKey];
        town.latitude = placeDetails.latitude || town.latitude;
        town.longitude = placeDetails.longitude || town.longitude;
        town.display = placeDetails.town || town.display;
        // Mettre à jour l'entrée dans la liste
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
    let birthTags = [TAG_BIRTH],
        deathTags = [TAG_DEATH];
    if (config.substituteEvents) {
        birthTags = birthTags.concat([TAG_BAPTISM]);
        deathTags = deathTags.concat([TAG_BURIAL]);
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

    let eventDescription = `${additionalDetails} ${
        eventPlaceMarkup ? `${eventPlaceMarkup}` : ""
    }`;
    return eventDescription;
}

function buildEvent(event, individualTowns) {
    const familyTowns = getFamilyTowns();
    if (event == null || familyTowns == null) {
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

function buildIndividual(individualJson, allIndividuals, allFamilies) {
    if (!individualJson) {
        return { id: null, name: "", surname: "", birth: {}, death: {} };
    }

    let individualTowns = [];
    let individualEvents = [];
    let formattedDeath = "";
    let age;
    let deceased = false;

    // Helper function with access to individualEvents
    function addEventToIndividual(type, name, surname, date, town, description, eventId = '', eventAttendees = [], birthDate) {
        if (date) {
            try {
                // Calculate age at the time of the event if birthDate is known
                let ageAtEvent = null;
                if (birthDate) {
                    ageAtEvent = calculateAge(birthDate, date);
                }

                const formattedAttendees = eventAttendees.map(attendee => 
                    `${attendee.name}`).join(', ');
                const event = {
                    type,
                    name: `${name} ${surname}`,
                    date,
                    town: town || "lieu inconnu",
                    townDisplay: town || "lieu inconnu",
                    description,
                    eventId: eventId || '',
                    eventAttendees: formattedAttendees,
                    ageAtEvent
                };
                
                individualEvents.push(event);
                
                if (!["child-birth", "occupation", "today"].includes(type)) {
                    addToFamilyEvents(event);
                    // Ajouter à timelineStore si c'est un événement pertinent pour la timeline
                    if (["birth", "death", "marriage"].includes(type)) {
                        try {
                            timelineStore.addEvent(event);
                        } catch (timelineError) {
                            console.warn('Failed to add event to timeline:', timelineError, event);
                        }
                    }
                }
            } catch (error) {
                console.error('Error adding event:', error, {type, name, date, town});
            }
        }
    }

    try {
        // Extract basic information
        const { name, surname, gender, canSign, personLink } = extractBasicInfo(individualJson);
        const { birthTags, deathTags } = handleEventTags();

        // Process birth data
        const birthData = buildEventFallback(individualJson, birthTags, individualTowns).eventDetails;
        const birthYear = birthData.date ? extractYear(birthData.date) : "";
        const formattedBirth = generateEventDescription("BIRT", birthData, gender, age);
        addEventToIndividual("birth", name, surname, birthData.date, birthData.town, formattedBirth, "", [], birthData.date);

        // Process death data
        const deathData = buildEventFallback(individualJson, deathTags, individualTowns).eventDetails;
        const deathYear = deathData.date ? extractYear(deathData.date) : "";
        let currentYear = new Date().getFullYear();

        // Handle death information based on available data
        if (!birthData.date) {
            deceased = true;
            formattedDeath = deathData.date ? 
                generateEventDescription("DEAT", deathData, gender, null, true) : 
                "Information on life and death unknown";
            addEventToIndividual("death", name, surname, deathData.date || "date inconnue", 
                deathData.town || "", formattedDeath, "", [], birthData.date);
        } else {
            if (!deathData.date) {
                const today = moment().format("DD/MM/YYYY");
                if (birthYear >= currentYear - 105) {
                    age = calculateAge(birthData.date);
                    deceased = false;
                    formattedDeath = generateEventDescription("DEAT", { date: today, town: "" }, 
                        gender, age, false);
                    addEventToIndividual("today", name, surname, today, "", formattedDeath, "", [], 
                        birthData.date);
                } else {
                    deceased = true;
                    formattedDeath = generateEventDescription("DEAT", { date: today, town: "" }, 
                        gender, "", true);
                    addEventToIndividual("death", name, surname, "date inconnue", "", formattedDeath, 
                        "", [], birthData.date);
                }
            } else {
                age = calculateAge(birthData.date, deathData.date);
                deceased = true;
                formattedDeath = generateEventDescription("DEAT", deathData, gender, age, true);
                addEventToIndividual("death", name, surname, deathData.date, deathData.town, 
                    formattedDeath, "", [], birthData.date);
            }
        }

        // Process family relationships
        const parentalFamily = getParentalFamily(individualJson.pointer, allFamilies, allIndividuals);
        
        // Add to genealogy graph
        addNodeToGenealogyGraph({
            id: individualJson.pointer,
            name: name + ' ' + surname,
            birthDate: birthData.date,
            deathDate: deathData.date
        });

        // Add parent edges
        if (parentalFamily.fatherId) {
            addEdgeToGenealogyGraph(parentalFamily.fatherId, individualJson.pointer, 'father');
        }
        if (parentalFamily.motherId) {
            addEdgeToGenealogyGraph(parentalFamily.motherId, individualJson.pointer, 'mother');
        }
        
        const formattedSiblings = parentalFamily.siblings.length > 0 ? 
            formatSiblings(parentalFamily.siblings) : "";

        // Process marriages and children
        const individualFamily = getIndividualFamily(individualJson.pointer, allFamilies, allIndividuals);
        const marriages = processMarriages(individualJson.pointer, allIndividuals, allFamilies, 
            individualTowns);

        marriages.forEach((marriage) => {
            addEventToIndividual("marriage", name, surname, marriage.eventDetails.date, 
                marriage.eventDetails.town, marriage.formattedMarriage, 
                marriage.eventDetails.eventId, 
                marriage.couple ? [marriage.couple.husband, marriage.couple.wife] : [], 
                birthData.date);

            marriage.children.forEach((child) => {
                addEventToIndividual("child-birth", child.name, "", child.birthDate, "", 
                    formatChild(child), "", [], birthData.date);
                
                // Handle first child statistics
                if (marriage.children.indexOf(child) === 0) {
                    const firstChildBirthYear = extractYear(child.birthDate);
                    const ageAtFirstChild = firstChildBirthYear - birthYear;
                    const period = Math.floor(firstChildBirthYear / 5) * 5;
                    addAgeAtFirstChild(period, ageAtFirstChild);
                }
            });
        });

        const formattedOccupations = processOccupations(individualJson);

        // Update Statistics
        updateTotalIndividuals(1);
        updateGenderCount(gender, 1);
        if (birthYear) addBirthYear(birthYear);
        if (deathYear) {
            addDeathYear(deathYear);
            if (age) addAgeAtDeath(age);
        }
        if (marriages.length > 0) {
            updateMarriages(marriages.length);
            marriages.forEach(marriage => {
                addChildrenPerCouple(marriage.children.length);
            });
        }

        // Construct and return the individual object
        const individual = {
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
        };

        return individual;

    } catch (error) {
        console.error('Error building individual:', individualJson?.pointer, error);
        return {
            id: individualJson?.pointer || null,
            name: "",
            surname: "",
            birth: {},
            death: {},
            individualEvents: [],
            birthYear: "",
            deathYear: "",
            gender: "unknown",
            fatherId: null,
            motherId: null,
            spouseIds: [],
            siblingIds: [],
            individualTowns: [],
            bgColor: ""
        };
    }
}

function buildHierarchy() {
    console.time("buildHierarchy");
    const config = configStore.getConfig;
    const rootIndividualPointer = config.root;
    const maxHeight = config.maxGenerations - 1;

    try {
        // Clear timeline events at the start
        timelineStore.clearEvents();
    } catch (timelineError) {
        console.warn('Failed to clear timeline events:', timelineError);
    }

    // Utiliser le cache des individus déjà construit
    const individualsCache = getIndividualsCache(); 

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
                    try {
                        timelineStore.addEvent({
                            ...event,
                            id: individualPointer, // Inclure l'identifiant de l'individu
                            sosa // Inclure le numéro Sosa pour le suivi généalogique
                        });
                    } catch (timelineError) {
                        console.warn('Failed to add event to timeline:', timelineError);
                    }
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
            individualEvents: [] 
        };
    }

    const hierarchy = buildRecursive(
        rootIndividualPointer,
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
    const isAnsi =
    getFirst(
        parsed
            .filter(byTag(TAG_HEAD))
            .flatMap((a) => a.tree.filter(byTag(TAG_ENCODING)).map((a) => a.data)),
        null
    ) === TAG_ANSI;

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
        // Récupération des villes stockées dans le LocalStorage
        const dbTowns = await getAllRecords(); // Utilisez la fonction modifiée qui lit les données depuis LocalStorage
        const familyTowns1 = getFamilyTowns(); // Supposons que cette fonction récupère l'état actuel des villes traitées

        // Traitement de chaque individu dans le json avec les villes actuelles
        for (const individual of json) {
            await processTree(individual.tree, null, dbTowns, familyTowns1); // Passer familyTowns comme argument
        }

        // Mise à jour des villes dans un état centralisé, probablement aussi dans LocalStorage
        setFamilyTowns(familyTowns1); // Utilisation de setFamilyTowns pour mettre à jour l'état global
        // Retour des données json traitées
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

async function processTree(tree, parentNode, dbTowns, familyTowns) {
    for (const node of tree) {
        if (node.tag === "PLAC" && parentNode) {
            let placeInfo = await processPlace({ data: node.data, tree: node.tree });
            let normalizedKey = normalizeGeoString(placeInfo.town);
            if (!normalizedKey) {
                continue;
            }
            parentNode.key = normalizedKey;

            // Determine the data to use for the update
            let currentData = dbTowns[normalizedKey] || {};
            let newData = {
                town: placeInfo.town || currentData.town,
                departement: placeInfo.departement || currentData.departement,
                departementColor: placeInfo.departementColor || currentData.departementColor,
                country: placeInfo.country || currentData.country,
                countryCode: placeInfo.countryCode || currentData.countryCode,
                countryColor: placeInfo.countryColor || currentData.countryColor,
                latitude: placeInfo.latitude || currentData.latitude,
                longitude: placeInfo.longitude || currentData.longitude,
            };
            
            newData.townDisplay = newData.departement ? `${newData.town} (${newData.departement})` : newData.town;

            // Always update familyTowns, even if the key already exists to ensure all properties are correct
            familyTowns[normalizedKey] = newData;
        }
        if (node.tree && node.tree.length > 0) {
            await processTree(
                node.tree,
                ["BIRT", "DEAT", "BURI", "MARR", "OCCU", "EVEN"].includes(node.tag)
                    ? node
                    : parentNode,
                dbTowns,
                familyTowns // Passer familyTowns à chaque appel récursif
            );
        }
    }
    
    // Remettre les données en cache à null après utilisation
    cachedCountryData = null;
    cachedDepartementData = null;
}

function prebuildindividualsCache() {
    console.time("prebuildindividualsCache");
    const json = getSourceData(); // Retrieve source data
    const individualsCache = new Map();

    // Filter individuals and families from source data
    const allIndividuals = _.filter(json, byTag(TAG_INDIVIDUAL));
    const allFamilies = _.filter(json, byTag(TAG_FAMILY));

    // Function to check if an individual is a parent in another family
    function isParentInOtherFamily(individualId) {
        return allFamilies.some(familyJson => 
            familyJson.tree.some(node => 
                node.tag === 'CHIL' && node.data === individualId
            )
        );
    }

    // Iterate through all individuals
    _.forEach(allIndividuals, (individualJson) => {
        // Find families where the individual appears as a child or spouse
        const familiesWithIndividual = allFamilies.filter(familyJson => 
            familyJson.tree.some(node => 
                node.data === individualJson.pointer && 
                (node.tag === 'CHIL' || node.tag === 'HUSB' || node.tag === 'WIFE')
            )
        );

        // If the individual does not appear in any family, move to the next individual
        if (familiesWithIndividual.length === 0) {
            return;
        }

        // If the individual appears in only one family as a spouse, check if there are children
        if (familiesWithIndividual.length === 1) {
            const family = familiesWithIndividual[0];
            const hasChildren = family.tree.some(node => byTag(TAG_CHILD)(node));
            
            // If the family has no children, check the spouse
            if (!hasChildren) {
                const spouses = family.tree.filter(node => node.tag === 'HUSB' || node.tag === 'WIFE');
                
                // If there are two spouses, check if the other spouse is only in this family
                if (spouses.length === 2) {
                    const otherSpouse = spouses.find(node => node.data !== individualJson.pointer);
                    const otherSpouseFamilies = allFamilies.filter(familyJson => 
                        familyJson.tree.some(node => 
                            node.data === otherSpouse.data && 
                            (node.tag === 'HUSB' || node.tag === 'WIFE')
                        )
                    );

                    // Check if the other spouse has parents mentioned in another family
                    const otherSpouseParents = isParentInOtherFamily(otherSpouse.data);

                    // If the other spouse only appears in this family and does not have parents in other families, move to the next individual
                    if (otherSpouseFamilies.length === 1 && !otherSpouseParents) {
                        return;
                    }
                }
            }
        }

        // Build the individual object and add it to the cache
        const individual = buildIndividual(individualJson, allIndividuals, allFamilies);
        individualsCache.set(individualJson.pointer, individual);
    });

    console.log("statistics", getStatistics());
    console.timeEnd("prebuildindividualsCache");
    return individualsCache;
}
// Function to format data for FamilyTreeJS 
function formatFamilyTreeData(individualsCache) {
    console.time("formatFamilyTreeData");
    const formattedData = Array.from(individualsCache.values()).map(data => ({
        id: data.id,
        fid: data.fatherId,
        mid: data.motherId,
        pids: data.spouseIds,
        name: `${data.name} ${data.surname}`,
        birthDate: data.birthDate,
        deathDate: data.deathYear,
        gender: data.gender,
        display: true
    }));
    console.timeEnd("formatFamilyTreeData");
    return formattedData;
}

// Fonction appelée depuis ui.js pour préparer la liste déroulante de sélection de l'individu racine
function getIndividualsList() {
    // Build the cache of individuals with all their information
    const individualsCache = prebuildindividualsCache();
    clearSourceData(); // Reset source data to avoid memory leaks

    // Preparing data for FamilyTreeJS
    const familyTreeData = formatFamilyTreeData(individualsCache);
    setFamilyTreeData(familyTreeData);
    // Dynamically import the module and call the function
    import(/* webpackChunkName: "tree" */ './tree.js')
        .then(module => {
            const { initializeFamilyTree } = module;
            initializeFamilyTree(); // Call the function to initialize FamilyTreeJS
        })
        .catch(error => {
            console.error('Error loading the module:', error);
        });

    setIndividualsCache(individualsCache);

    // Convert the map to a list
    const individualsList = Array.from(individualsCache.values());
    return { individualsList };
}

export { toJson, buildHierarchy, getIndividualsList };
