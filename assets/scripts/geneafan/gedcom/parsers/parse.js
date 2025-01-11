// External libraries
import _ from "lodash";
import parseGedcom from "parse-gedcom";

// Processors
import { processDate } from '../processors/dateProcessor.js';

// Utils
import {
    extractYear,
    calculateAge,
    prefixedDate
} from "../../utils/dates.js";

// Stores
import gedcomDataStore from '../stores/gedcomDataStore.js';
import statisticsStore from '../../tabs/statistics/statisticsStore.js';

// Constants
import { 
    TAGS, 
    VALUES, 
    CALENDARS, 
    MONTHS_MAP, 
    byTag, 
    isRepublicanCalendar, 
    isGregorianCalendar 
} from '../stores/gedcomConstantsStore.js';

// Services
import { statisticsService } from '../../tabs/statistics/services/statisticsService.js';

const EMPTY = "";

function getFirst(array, def) {
    return _.get(array, 0, def);
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

function getIndividualsList() {
    // Initialiser le service avant de l'utiliser
    statisticsService.initialize();

    // Configurer l'écoute du progrès
    statisticsService.onProgress((progress) => {
        console.log(`Processing statistics: ${progress}%`);
    });

    // Utiliser directement le cache déjà construit
    const individualsList = gedcomDataStore.getIndividualsList();

    // Lancer le traitement des statistiques pour la famille
    statisticsService.processFamilyData();

    requestAnimationFrame(() => {
        import(/* webpackChunkName: "treeUI" */ '../../tabs/familyTree/treeUI.js')
            .then(module => {
                const { initializeFamilyTree } = module;
                initializeFamilyTree();
            })
            .catch(error => {
                console.error('Error loading the module:', error);
            });
    });

    return { individualsList };
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

export { toJson, getIndividualsList };
