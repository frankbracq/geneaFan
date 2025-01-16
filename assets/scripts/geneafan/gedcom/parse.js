// External libraries
import _ from "lodash";
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

import { extractBasicInfo } from './builders/personBuilder.js';

import { statisticsService } from '../tabs/statistics/services/statisticsService.js';

import { departementData } from './departementData.js';
import { countryData } from './countryData.js';

// Stores
import gedcomDataStore from './gedcomDataStore.js';
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

function formatSiblings(siblings) {
    return `<ul class="list-unstyled">${_.map(
        siblings,
        (s) =>
            `<li>-${formatPersonLink(s.id, s.name)} (${s.birthDate} - ${s.deathDate})</li>`
    ).join("\n")}</ul>`;
}


let cachedDepartementData = null;
let cachedCountryData = null;

function getDepartementData() {
    return departementData;
}

function getCountryData() {
    return countryData;
}

export function processPlace({ data: original, tree } = {}) {
    const departementData = getDepartementData();
    const countryData = getCountryData();

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

export function processDate(s) {
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
        console.group('getAllPlaces - Traitement des lieux');

        // 1. Charger le cache de géolocalisation
        const geoCache = await getAllRecords();
        console.log('Cache chargé:', Object.keys(geoCache).length, 'villes en cache');

        // 2. Réinitialiser le store pour le nouveau fichier
        familyTownsStore.setTownsData({});
        console.log('Store réinitialisé');

        // 3. Collecter toutes les villes du nouveau fichier GEDCOM
        const individuals = json.filter(byTag(TAGS.INDIVIDUAL));
        for (const individual of individuals) {
            processTree(individual.tree, null, individual);
        }

        // 4. Récupérer la liste des nouvelles villes
        const currentTowns = familyTownsStore.getAllTowns();
        console.log('Nouvelles villes collectées:', Object.keys(currentTowns).length, 'villes');

        // 5. Identifier les villes qui ont besoin d'une mise à jour
        const missingTowns = [];

        Object.entries(currentTowns).forEach(([key, town]) => {
            const cachedTown = geoCache[key];
            if (cachedTown) {
                // Appliquer les données du cache
                familyTownsStore.updateTown(key, {
                    ...town,
                    latitude: cachedTown.latitude || town.latitude,
                    longitude: cachedTown.longitude || town.longitude,
                    departement: cachedTown.departement || town.departement,
                    departementColor: cachedTown.departementColor || town.departementColor,
                    country: cachedTown.country || town.country,
                    countryCode: cachedTown.countryCode || town.countryCode,
                    countryColor: cachedTown.countryColor || town.countryColor
                });
            } else {
                missingTowns.push(key);
            }
        });

        // 6. Mise à jour uniquement pour les villes manquantes
        if (missingTowns.length > 0) {
            console.log('Villes nécessitant une géolocalisation:', missingTowns.length);
            await familyTownsStore.updateTownsViaProxy();
        } else {
            console.log('Toutes les géolocalisations sont disponibles en cache');
        }

        // 7. Sauvegarder dans le localStorage
        familyTownsStore.saveToLocalStorage();

        const allTowns = familyTownsStore.getAllTowns();
        console.log('Données complètes des villes:', allTowns);
        
        // Object.entries(allTowns).forEach(([key, town]) => {
            // Déstructurer le Proxy pour voir le contenu réel
            // console.log(`Debug town events for ${key}:`, JSON.parse(JSON.stringify(town.events)));
        //    console.log(`\n${town.townDisplay} (${key}):`, {
        //        details: {
        //            département: town.departement,
        //            pays: town.country,
        //            coords: [town.latitude, town.longitude]
        //        },
        //        événements: {
        //            naissances: town.events?.BIRT?.length || 0,
        //            décès: town.events?.DEAT?.length || 0,
        //            mariages: town.events?.MARR?.length || 0
        //        }
        //    });
        // });

        console.groupEnd();
        return { json };
    } catch (error) {
        console.error("Error in getAllPlaces: ", error);
        console.groupEnd();
        throw error;
    }
}

function getAllRecords() {
    return new Promise((resolve, reject) => {
        console.log('Accessing localStorage...');
        const storedData = localStorage.getItem("townsDB");
        if (storedData) {
            console.log('Found data in townsDB:', storedData.slice(0, 100) + '...');
            try {
                const dbTowns = JSON.parse(storedData);
                console.log('Successfully parsed townsDB, found', Object.keys(dbTowns).length, 'towns');
                resolve(dbTowns);
            } catch (error) {
                console.error("Erreur lors de la conversion des données JSON :", error);
                console.log('Raw data causing error:', storedData);
                resolve({});  // En cas d'erreur, on renvoie un objet vide
            }
        } else {
            console.log('No data found in townsDB');
            resolve({});  // Si pas de données, on renvoie un objet vide
        }
    });
}

function processTree(tree, parentNode, individual) {
    for (const node of tree) {
        if (node.tag === "PLAC" && parentNode) {
            let placeInfo = processPlace({ data: node.data, tree: node.tree });
            let normalizedKey = normalizeGeoString(placeInfo.town);
            if (!normalizedKey) continue;

            parentNode.key = normalizedKey;

            const dateNode = parentNode.tree?.find(n => n.tag === "DATE");
            const eventDate = dateNode ? processDate(dateNode.data) : null;
            const personData = extractBasicInfo(individual);

            // Construction d'un eventData enrichi
            const eventData = {
                type: parentNode.tag,
                date: eventDate,
                personId: individual.pointer,
                personDetails: {
                    name: personData.name,
                    surname: personData.surname,
                    gender: personData.gender,
                    birthDate: '',  // Sera rempli plus tard
                    deathDate: '',
                    birthPlace: '',
                    deathPlace: '',
                    occupation: ''
                }
            };

            // Utiliser la nouvelle fonction unifiée
            familyTownsStore.addOrUpdateTown(normalizedKey, placeInfo, eventData);
        }

        if (node.tree && node.tree.length > 0) {
            processTree(
                node.tree,
                ["BIRT", "DEAT", "BURI", "MARR", "OCCU", "EVEN"].includes(node.tag) ? node : parentNode,
                individual
            );
        }
    }
}

async function getIndividualsList() {
    try {
        console.group('Processing individuals list and initializing services');
        
        // Initialize statistics service
        console.log('Initializing statistics service...');
        statisticsService.initialize();
        statisticsService.onProgress((progress) => {
            console.log(`Processing statistics: ${progress}%`);
        });

        // Process family data
        console.log('Processing family data...');
        await statisticsService.processFamilyData();

        // Get individuals list from cache
        console.log('Getting individuals from cache...');
        const individualsList = Array.from(gedcomDataStore.getIndividualsCache().values());
        
        if (!individualsList.length) {
            throw new Error('No individuals found in cache');
        }

        // Initialize family tree data store and update data atomically
        console.log('Initializing family tree data store...');
        try {
            await familyTreeDataStore.initialize();
            console.log('Updating family tree data store with individuals...');
            familyTreeDataStore.updateFromIndividualsCache(individualsList);
            console.log('Family tree data store updated successfully');
        } catch (error) {
            console.error('Error initializing family tree data store:', error);
            throw error;
        }

        // Initialize tree visualization
        console.log('Initializing tree visualization...');
        try {
            const { initializeFamilyTree } = await import(
                /* webpackChunkName: "treeUI" */ 
                '../tabs/familyTree/familyTreeManager.js'
            );
            await initializeFamilyTree();
            console.log('Family tree initialized successfully');
        } catch (error) {
            console.error('Failed to initialize tree visualization:', error);
            // On continue même si l'initialisation de la visualisation échoue
        }

        console.log(`Successfully processed ${individualsList.length} individuals`);
        console.groupEnd();
        return { individualsList };

    } catch (error) {
        console.error('Error in getIndividualsList:', error);
        console.groupEnd();
        throw error;
    }
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

export { toJson, getIndividualsList };