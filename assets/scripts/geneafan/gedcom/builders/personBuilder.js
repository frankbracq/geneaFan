// External libraries
import _ from "lodash";
import jsonpointer from 'jsonpointer';

// Processors
import { placeProcessor } from '../processors/placeProcessor.js';
import { dateProcessor } from '../processors/dateProcessor.js';
import { 
    handleEventTags, 
    buildEventFallback, 
    generateEventDescription, 
    addEvent
} from '../processors/eventProcessor.js';

import {
    normalizeGeoString,
} from "../../utils/geo.js";

// Stores
import familyTreeDataStore from '../../tabs/familyTree/familyTreeDataStore.js';
import gedcomConstantsStore from '../stores/gedcomConstantsStore.js';

const VALUE_OCCUPATION = "Occupation";
const { TAGS } = gedcomConstantsStore;

function byTag(tag) {
    return gedcomConstantsStore.byTag(tag);
}

function formatPersonLink(id, name) {
    return `<a href="#"><span class="person-link" data-person-id="${id}">${name}</span></a>`;
}

function formatName(str, isSurname = false) {
    if (typeof str !== "string") {
        str = String(str);
    }

    // Convert to lowercase and capitalize first letter of each word after space or hyphen
    str = str.toLowerCase().replace(/(^|\s|-)([a-zà-ÿ])/g, function(match) {
        return match.toUpperCase();
    });

    // Handle particle "de"
    str = str.replace(/ De /g, " de ");
    if (str.startsWith("De ")) {
        str = "de " + str.slice(3);
    }

    // For surnames, keep only the first part if there's an "ou" separator
    if (isSurname) {
        str = str.replace(/(\S+)\s+[oO]u\s+\S+/gi, "$1");
    }

    return str;
}

function processDetailedOccupations(individualJson) {
    const occupations = [];

    individualJson.tree
        .filter(byTag(TAGS.OCCUPATION))
        .forEach(occNode => {
            const dateNode = occNode.tree?.find(node => node.tag === TAGS.DATE);
            occupations.push({
                value: formatOccupation(occNode.data),
                date: dateNode ? dateProcessor.processDate(dateNode.data) : null,
                year: dateNode ? dateProcessor.extractYear(dateProcessor.processDate(dateNode.data)) : null,
                type: 'direct'
            });            
        });

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
                    date: dateNode ? dateProcessor.processDate(dateNode.data) : null,
                    year: dateNode ? dateProcessor.extractYear(dateProcessor.processDate(dateNode.data)) : null,
                    type: 'event'
                });
            }
        });

    return _.orderBy(occupations, ['year', 'date'], ['asc', 'asc']);
}

function formatOccupation(occupation) {
    if (!occupation) return null;
    return occupation.charAt(0).toUpperCase() + occupation.slice(1).toLowerCase();
}

function processOccupations(individualJson) {
    const directOccupations = jsonpointer.get(individualJson, '/tree').filter(byTag(TAGS.OCCUPATION))
        .map((occ) => ({
            occupation: formatOccupation(occ.data),
        }));

    const detailOccupations = jsonpointer.get(individualJson, '/tree').filter(
        (node) => node.tag === TAGS.EVENT &&
            jsonpointer.get(node, '/tree').some(
                (subNode) => subNode.tag === TAGS.TYPE && subNode.data === VALUE_OCCUPATION
            )
    ).flatMap((node) => jsonpointer.get(node, '/tree').filter((subNode) => subNode.tag === TAGS.NOTE))
        .map((note) => ({
            occupation: note.data,
        }));

    const allOccupations = [...directOccupations, ...detailOccupations];

    let formattedOccupations =
        allOccupations.length > 0
            ? `<ul class='list-group'>${allOccupations
                .map((occ) => `<li class='list-group-item'>${occ.occupation}</li>`)
                .join("")}</ul>`
            : "";

    return formattedOccupations;
}

/* Marriages */
function processMarriages(
    individualPointer,
    allIndividuals,
    allFamilies,
    individualTowns,
    indices // Add indices parameter
) {
    if (!individualPointer || !_.isArray(allFamilies)) {
        return [];
    }

    // Pass indices to getIndividualFamily
    const individualFamilyInfo = getIndividualFamily(
        individualPointer,
        allIndividuals,
        allFamilies,
        indices
    );

    const marriages = _.map(individualFamilyInfo.spouses, (spouseInfo, spouseId) => {
        const { details: spouseDetails, children, marriage } = spouseInfo;

        // Process the details of the marriage event, including place processing
        let eventDetails = {};
        
        if (marriage) {
            // Process date with processDate
            eventDetails.date = marriage.date ? dateProcessor.processDate(marriage.date) : "";

            // Process place using the same logic as in processTree
            if (marriage.place) {
                const placeInfo = placeProcessor.processPlace({ 
                    data: marriage.place, 
                    tree: [] // Pass empty tree if no MAP data available
                });
                
                // Use the normalized town name and other place details
                eventDetails = {
                    ...eventDetails,
                    town: placeInfo.town || 'lieu inconnu',
                    townDisplay: placeInfo.townDisplay,
                    departement: placeInfo.departement,
                    country: placeInfo.country,
                    latitude: placeInfo.latitude,
                    longitude: placeInfo.longitude,
                    key: normalizeGeoString(placeInfo.town)
                };
            }
        }

        // Add the family ID and spouse ID to the event details
        eventDetails = { ...eventDetails, eventId: '', spouseId };

        // Get the spouse's name
        const spouseName = spouseDetails?.name || 'Unknown';

        // Generate the formatted marriage description
        const formattedMarriage = generateEventDescription(
            "MARR",
            {
                ...eventDetails,
                spouseName: spouseName,
                spouseId: spouseId
            },
            "", // gender
            "" // age
        );

        // Get the couple's details
        const couple = {
            husband: individualPointer,
            wife: spouseId
        };

        return { 
            formattedMarriage, 
            children: children || [], 
            spouseName, 
            eventDetails, 
            couple 
        };
    });

    return marriages;
}

function formatSiblings(siblings) {
    return `<ul class="list-unstyled">${_.map(
        siblings,
        (s) =>
            `<li>-${formatPersonLink(s.id, s.name)} (${s.birthDate} - ${s.deathDate})</li>`
    ).join("\n")}</ul>`;
}

function formatChild(child) {
    const ageAtDeath = child.deathDate
        ? ` à ${dateProcessor.calculateAge(child.birthDate, child.deathDate)} ans`
        : "";
    return `${formatPersonLink(child.id, child.name)}${
        child.deathDate ? ` (†${child.deathDate}${ageAtDeath})` : ""
    }`;
}

/**
 * Extracts basic information from a GEDCOM individual record
 * @param {Object} individualJson - The GEDCOM individual record
 * @returns {Object} Object containing name, surname, gender, canSign, and personLink
 */
export function extractBasicInfo(individualJson) {
    if (!individualJson?.tree) {
        return { 
            name: '', 
            surname: '', 
            gender: 'unknown', 
            canSign: false, 
            personLink: '' 
        };
    }

    // Process NAME nodes
    const names = individualJson.tree.filter(node => node.tag === TAGS.NAME);
    
    // Extract name components, handling both GIVN/SURN structure and traditional format
    let name = '', surname = '';
    
    if (names.length > 0) {
        const nameNode = names[0]; // Take first NAME node
        
        if (nameNode.tree?.length > 0) {
            // Check for structured name components (GIVN/SURN)
            const givnNode = nameNode.tree.find(node => node.tag === 'GIVN');
            const surnNode = nameNode.tree.find(node => node.tag === 'SURN');
            
            if (givnNode || surnNode) {
                name = givnNode ? formatName(givnNode.data, false) : '';
                surname = surnNode ? formatName(surnNode.data, true) : '';
            }
        }
        
        // If structured components weren't found, parse the NAME data
        if (!name && !surname && nameNode.data) {
            const nameParts = nameNode.data.split('/').map(part => part.trim());
            if (nameParts.length >= 2) {
                name = formatName(nameParts[0], false);
                surname = formatName(nameParts[1], true);
            }
        }
    }

    // Process gender
    const genderMap = {
        'M': 'male',
        'F': 'female'
    };
    
    const sexNode = individualJson.tree.find(node => node.tag === TAGS.SEX);
    const gender = genderMap[sexNode?.data] || 'unknown';

    // Process signature capability
    const signNode = individualJson.tree.find(node => node.tag === TAGS.SIGNATURE);
    const canSign = signNode?.data === TAGS.YES;

    // Generate person link
    const fullName = `${name.split(" ")[0]} ${surname}`.trim();
    const personLink = formatPersonLink(individualJson.pointer, fullName);

    return {
        name,
        surname,
        gender,
        canSign,
        personLink
    };
}

/* Parental Family Members */
function getParentalFamily(individualPointer, allIndividuals, indices) {
    if (!indices || typeof indices.getParentalFamily !== 'function') {
        console.error('Invalid indices object passed to getParentalFamily:', indices);
        return { siblings: [], fatherId: null, motherId: null, siblingIds: [] };
    }
    
    const parentFamily = indices.getParentalFamily(individualPointer);
    
    if (!parentFamily) {
        return { siblings: [], fatherId: null, motherId: null, siblingIds: [] };
    }

    // Extract parent IDs from the family record
    const fatherId = parentFamily.tree.find(node => node.tag === "HUSB")?.data;
    const motherId = parentFamily.tree.find(node => node.tag === "WIFE")?.data;

    // Extract and process siblings
    let siblings = parentFamily.tree
        .filter(node => node.tag === "CHIL" && node.data !== individualPointer)
        .map(siblingNode => getRelativeDetails(siblingNode.data, allIndividuals))
        .filter(Boolean);

    // Extract sibling IDs
    const siblingIds = parentFamily.tree
        .filter(node => node.tag === "CHIL" && node.data !== individualPointer)
        .map(siblingNode => siblingNode.data);

    // Sort siblings by birth date and name
    siblings = _.orderBy(
        siblings,
        [
            member => member.birthDate 
                ? new Date(member.birthDate.split("/").reverse().join("-")) 
                : Infinity,
            "name"
        ],
        ["asc", "asc"]
    );

    return { siblings, fatherId, motherId, siblingIds };
}

/* Individual family members */
function getIndividualFamily(individualPointer, allIndividuals, allFamilies, indices) {
    if (!indices || typeof indices.getFamiliesAsParent !== 'function') {
        console.error('Invalid indices object passed to getIndividualFamily:', indices);
        return {
            spouses: {},
            children: {}
        };
    }

    const result = {
        spouses: {},
        children: {}
    };

    const parentFamilies = indices.getFamiliesAsParent(individualPointer) || [];

    _.forEach(parentFamilies, family => {
        // Extract spouses
        const spouses = _.map(
            _.filter(family.tree, node =>
                (node.tag === "HUSB" || node.tag === "WIFE") && node.data !== individualPointer
            ),
            spouseNode => spouseNode.data
        );

        // Extract children
        const children = _.map(
            _.filter(family.tree, node => node.tag === "CHIL"),
            childNode => childNode.data
        );

        // Extract marriage information
        const marriageNode = _.find(family.tree, node => node.tag === "MARR");
        const marriageInfo = marriageNode ? {
            date: _.get(_.find(marriageNode.tree, { tag: "DATE" }), 'data', ''),
            place: _.get(_.find(marriageNode.tree, { tag: "PLAC" }), 'data', ''),
            key: _.get(marriageNode, 'key', '')
        } : {};

        // Add spouse and children details
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
                if (childDetails) {  // Only add if we got valid details
                    result.spouses[spouseId].children.push(childDetails);

                    if (!result.children[childId]) {
                        result.children[childId] = {
                            details: childDetails,
                            parents: []
                        };
                    }
                    result.children[childId].parents.push(individualPointer);
                }
            });
        });
    });

    return result;
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
    const birthDate = birthDateNode ? dateProcessor.processDate(birthDateNode.data) : "";
    const deathDateNode = deathEventNode
        ? deathEventNode.tree.find((node) => node.tag === "DATE")
        : null;
        const deathDate = deathDateNode ? dateProcessor.processDate(deathDateNode.data) : "";

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

export function buildIndividual(individualJson, allIndividuals, allFamilies, indices) {
    // console.log('Starting buildIndividual for:', individualJson?.pointer);
    
    if (!individualJson) {
        console.log('No individual data provided');
        return { id: null, name: "", surname: "", birth: {}, death: {} };
    }

    let individualTowns = new Set(); // Use Set to avoid duplicates
    let individualEvents = [];
    let formattedDeath = "";
    let age;
    let deceased = false;

    const { name, surname, gender, canSign, personLink } = extractBasicInfo(individualJson);
    
    const { birthTags, deathTags } = handleEventTags();

    const birthData = buildEventFallback(individualJson, birthTags, individualTowns).eventDetails;
    
    if (birthData.town) {
        individualTowns.add({
            name: birthData.town,
            display: birthData.townDisplay || birthData.town,
            departement: birthData.departement,
            country: birthData.country,
            coordinates: {
                latitude: birthData.latitude,
                longitude: birthData.longitude
            }
        });
    }

    const birthYear = birthData.date ? dateProcessor.extractYear(birthData.date) : "";
    const formattedBirth = generateEventDescription("BIRT", birthData, gender, age);
    addEvent("birth", name, surname, birthData.date, birthData.town, formattedBirth, "", [], birthData.date, individualEvents);

    const deathData = buildEventFallback(individualJson, deathTags, individualTowns).eventDetails;
    const deathYear = deathData.date ? dateProcessor.extractYear(deathData.date) : "";
    const currentYear = new Date().getFullYear();

    if (deathData.town) {
        individualTowns.add({
            name: deathData.town,
            display: deathData.townDisplay || deathData.town,
            departement: deathData.departement,
            country: deathData.country,
            coordinates: {
                latitude: deathData.latitude,
                longitude: deathData.longitude
            }
        });
    }

    const processDeath = () => {
        if (!birthData.date) {
            deceased = true;
            formattedDeath = deathData.date ? generateEventDescription("DEAT", deathData, gender, null, true) : "Information on life and death unknown";
            addEvent("death", name, surname, deathData.date || "date inconnue", deathData.town || "", formattedDeath, "", [], birthData.date, individualEvents);
        } else if (!deathData.date) {
            const today = dateProcessor.formatToday();
            if (birthYear >= currentYear - 105) {
                age = dateProcessor.calculateAge(birthData.date);
                deceased = false;
                formattedDeath = generateEventDescription("DEAT", { date: today, town: "" }, gender, age, false);
                addEvent("today", name, surname, today, "", formattedDeath, "", [], birthData.date, individualEvents);
            } else {
                deceased = true;
                formattedDeath = generateEventDescription("DEAT", { date: today, town: "" }, gender, "", true);
                addEvent("death", name, surname, "date inconnue", "", formattedDeath, "", [], birthData.date, individualEvents);
            }
        } else {
            age = dateProcessor.calculateAge(birthData.date, deathData.date);
            deceased = true;
            formattedDeath = generateEventDescription("DEAT", deathData, gender, age, true);
            addEvent("death", name, surname, deathData.date, deathData.town, formattedDeath, "", [], birthData.date, individualEvents);
        }
    };

    processDeath();

    const parentalFamily = getParentalFamily(individualJson.pointer, allIndividuals, indices);

    familyTreeDataStore.addNodeToGenealogyGraph({
        id: individualJson.pointer,
        name: `${name} ${surname}`,
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

    const individualFamily = getIndividualFamily(
        individualJson.pointer,
        allIndividuals,
        allFamilies,
        indices
    );

    const marriages = processMarriages(
        individualJson.pointer,
        allIndividuals,
        allFamilies,
        individualTowns,
        indices
    );

    marriages.forEach(marriage => {
        if (marriage.eventDetails.town) {
            individualTowns.add({
                name: marriage.eventDetails.town,
                display: marriage.eventDetails.townDisplay || marriage.eventDetails.town,
                departement: marriage.eventDetails.departement,
                country: marriage.eventDetails.country,
                coordinates: {
                    latitude: marriage.eventDetails.latitude,
                    longitude: marriage.eventDetails.longitude
                }
            });
        }

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
    const processedTowns = Array.from(individualTowns);

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
        individualTowns: processedTowns,
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