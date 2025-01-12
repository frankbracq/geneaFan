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

import {
    processEventDatePlace,
    generateEventDescription,
    buildEventFallback,
    addEvent,
    handleEventTags
} from './processors/eventProcessor.js';

import { extractBasicInfo } from './builders/personBuilder.js';

import { statisticsService } from '../tabs/statistics/services/statisticsService.js';

// Stores
import gedcomDataStore from './gedcomDataStore.js';
import configStore from '../tabs/fanChart/fanConfigStore.js';
import timelineEventsStore from '../tabs/timeline/timelineEventsStore.js';
import familyTreeDataStore from '../tabs/familyTree/familyTreeDataStore.js';
import familyTownsStore from './familyTownsStore.js';
import statisticsStore from '../tabs/statistics/statisticsStore.js';
import gedcomConstantsStore from './gedcomConstantsStore.js';
import { buildIndividual } from './builders/personBuilder.js';

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
            await processTree(individual.tree, null, individual);
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

async function processTree(tree, parentNode, individual) {
    for (const node of tree) {
        if (node.tag === "PLAC" && parentNode) {
            let placeInfo = await processPlace({ data: node.data, tree: node.tree });
            let normalizedKey = normalizeGeoString(placeInfo.town);
            if (!normalizedKey) continue;

            parentNode.key = normalizedKey;

            const dateNode = parentNode.tree?.find(n => n.tag === "DATE");
            const eventDate = dateNode ? processDate(dateNode.data) : null;

            // Construction d'un eventData enrichi
            const eventData = {
                type: parentNode.tag,
                date: eventDate,
                personId: individual.pointer,
                personDetails: {
                    name: extractBasicInfo(individual).name,
                    surname: extractBasicInfo(individual).surname,
                    gender: extractBasicInfo(individual).gender
                }
            };

            familyTownsStore.addTown(normalizedKey, placeInfo, eventData);
        }

        if (node.tree && node.tree.length > 0) {
            await processTree(
                node.tree,
                ["BIRT", "DEAT", "BURI", "MARR", "OCCU", "EVEN"].includes(node.tag) ? node : parentNode,
                individual  // On passe l'individual aux appels récursifs
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

    // Puis lancer le traitement des statistiques pour la famille
    statisticsService.processFamilyData();

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