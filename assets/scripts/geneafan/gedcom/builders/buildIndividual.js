import _ from 'lodash';
import moment from 'moment';
import { byTag, TAGS } from '../stores/gedcomConstantsStore.js';
import { extractYear, calculateAge, prefixedDate } from "../../utils/dates.js";
import { processDate } from "../processors/dateProcessor.js";
import { processDetailedOccupations, processOccupations } from "../processors/occupationProcessor.js";
import { 
    buildEventFallback, 
    handleEventTags, 
    generateEventDescription,
    addEvent 
} from "../processors/eventProcessor.js";
import { processMarriages } from '../processors/marriageProcessor.js';
import { getIndividualFamily, getParentalFamily } from '../builders/familyBuilder.js';
import { extractBasicInfo } from '../builders/personBuilder.js';
import { formatPersonLink } from '../utils/linkFormatter.js';
import familyTreeDataStore from '../../tabs/familyTree/familyTreeDataStore.js';
import gedcomDataStore from '../stores/gedcomDataStore.js';

function formatChild(child) {
    const birthMoment = moment(child.birthDate, "DD/MM/YYYY");
    const deathMoment = child.deathDate
        ? moment(child.deathDate, "DD/MM/YYYY")
        : null;
    const ageAtDeath = deathMoment
        ? ` à ${deathMoment.diff(birthMoment, "years")} ans`
        : "";
    return `${formatPersonLink(child.id, child.name)}${child.deathDate ? ` (†${child.deathDate}${ageAtDeath})` : ""}`;
}

function formatSiblings(siblings) {
    return `<ul class="list-unstyled">${_.map(
        siblings,
        (s) =>
            `<li>-${formatPersonLink(s.id, s.name)} (${s.birthDate} - ${s.deathDate})</li>`
    ).join("\n")}</ul>`;
}

function calculateGeneration(individualPointer, allFamilies, cache = new Map()) {
    if (cache.has(individualPointer)) {
        return cache.get(individualPointer);
    }

    const parentFamily = allFamilies.find(family =>
        family.tree.some(node =>
            node.tag === TAGS.CHILD && node.data === individualPointer
        )
    );

    if (!parentFamily) {
        cache.set(individualPointer, 1);
        return 1;
    }

    const parentId = parentFamily.tree.find(node =>
        node.tag === TAGS.HUSBAND || node.tag === TAGS.WIFE
    )?.data;

    if (!parentId) {
        cache.set(individualPointer, 1);
        return 1;
    }

    const parentGeneration = calculateGeneration(parentId, allFamilies, cache);
    const generation = parentGeneration + 1;

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

    const deathData = buildEventFallback(individualJson, deathTags, individualTowns).eventDetails;
    const deathYear = deathData.date ? extractYear(deathData.date) : "";
    const currentYear = new Date().getFullYear();

    // Generate event descriptions and handle age calculations
    const formattedBirth = generateEventDescription("BIRT", birthData, gender, age);
    if (!birthData.date) {
        deceased = true;
        formattedDeath = deathData.date ? 
            generateEventDescription("DEAT", deathData, gender, null, true) : 
            "Information on life and death unknown";
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
    const individualFamily = getIndividualFamily(individualJson.pointer, allFamilies, allIndividuals);
    const formattedSiblings = parentalFamily.siblings.length > 0 ? formatSiblings(parentalFamily.siblings) : "";
    const formattedOccupations = processOccupations(individualJson);

    // Process marriages AVANT les stats
    const marriages = processMarriages(
        individualJson.pointer,
        allIndividuals,
        allFamilies,
        individualTowns
    );

    // Add individual to family tree data store
    familyTreeDataStore.addNodeToGenealogyGraph({
        id: individualJson.pointer,
        name: `${name} ${surname}`,
        birthDate: birthData.date,
        deathDate: deathData.date
    });

    // Ajouter les liens parent-enfant
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

    // Construction des stats avec les marriages disponibles
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

    // Ajout des événements de mariage et enfants
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

    // Retour de l'objet final avec toutes les données collectées
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