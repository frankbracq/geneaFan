// External libraries
import _ from "lodash";
import moment from "moment";
import jsonpointer from 'jsonpointer';

// Utility functions
import {
    extractYear,
    calculateAge,
    prefixedDate
} from "../../utils/dates.js";

import { 
    handleEventTags, 
    buildEventFallback, 
    generateEventDescription, 
    addEvent, 
    processEventDatePlace 
} from '../processors/eventProcessor.js';

import { processDate } from '../parse.js';

// Stores
import familyTreeDataStore from '../../tabs/familyTree/familyTreeDataStore.js';
import gedcomConstantsStore from '../gedcomConstantsStore.js';


const VALUE_OCCUPATION = "Occupation";
const { TAGS } = gedcomConstantsStore;

function byTag(tag) {
    return gedcomConstantsStore.byTag(tag);
}

function formatPersonLink(id, name) {
    return `<a href="#"><span class="person-link" data-person-id="${id}">${name}</span></a>`;
}

function formatName(str, isSurname) {
    if (typeof str !== "string") {
        str = String(str);
    }

    str = str.toLowerCase().replace(/(^|\s|-)([a-zà-ÿ])/g, function (match) {
        return match.toUpperCase();
    });

    str = str.replace(/ De /g, " de ");

    if (str.startsWith("De ")) {
        str = "de " + str.slice(3);
    }

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
                date: dateNode ? processDate(dateNode.data) : null,
                year: dateNode ? extractYear(processDate(dateNode.data)) : null,
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
                    date: dateNode ? processDate(dateNode.data) : null,
                    year: dateNode ? extractYear(processDate(dateNode.data)) : null,
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

export function extractBasicInfo(individualJson) {
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

export function buildIndividual(individualJson, allIndividuals, allFamilies) {
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

    const parentalFamily = getParentalFamily(individualJson.pointer, allFamilies, allIndividuals);

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