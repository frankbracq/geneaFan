// External libraries
import _ from "lodash";
import parseGedcom from "parse-gedcom";

// Place processing
import { placeProcessor } from './processors/placeProcessor.js';

import {
    extractYear,
    calculateAge,
    prefixedDate
} from "../utils/dates.js";

import { statisticsService } from '../tabs/statistics/services/statisticsService.js';

// Stores
import gedcomDataStore from './stores/gedcomDataStore.js';
import timelineEventsStore from '../tabs/timeline/timelineEventsStore.js';
import familyTreeDataStore from '../tabs/familyTree/familyTreeDataStore.js';
import statisticsStore from '../tabs/statistics/statisticsStore.js';
import gedcomConstantsStore from './stores/gedcomConstantsStore.js';

const EMPTY = "";
const VALUE_OCCUPATION = "Occupation";
const { TAGS, VALUES, CALENDARS, MONTHS_MAP } = gedcomConstantsStore;

function byTag(tag) {
    return gedcomConstantsStore.byTag(tag);
}

function getFirst(array, def) {
    return _.get(array, 0, def);
}

const processDate = (s) => placeProcessor.processDate(s);

function toJson(data) {
    const triggers = "[�]";
    const view = new Uint8Array(data);
    const text = new TextDecoder().decode(view);
    const parsed = parseGedcom.parse(text);

    const isLikelyAnsi = new RegExp(triggers).test(text);
    const isAnsi = getFirst(
        parsed
            .filter(byTag(TAGS.HEAD))
            .flatMap((a) => a.tree.filter(byTag(TAGS.ENCODING)).map((a) => a.data)),
        null
    ) === VALUES.ANSI;

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

        // Initialize family tree data store
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
                '../tabs/familyTree/familyTreeManager.js'
            );
            await initializeFamilyTree();
            console.log('Family tree initialized successfully');
        } catch (error) {
            console.error('Failed to initialize tree visualization:', error);
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
 */
function shouldProcessIndividual(individualJson, familiesWithIndividual, allFamilies) {
    if (familiesWithIndividual.length === 0) return false;

    if (familiesWithIndividual.length === 1) {
        const family = familiesWithIndividual[0];
        const hasChildren = family.tree.some(byTag(TAGS.CHILD));

        if (!hasChildren) {
            const spouses = family.tree.filter(node =>
                node.tag === TAGS.HUSBAND || node.tag === TAGS.WIFE);

            if (spouses.length === 2) {
                const otherSpouse = spouses.find(node =>
                    node.data !== individualJson.pointer);
                const otherSpouseFamilies = allFamilies.filter(familyJson =>
                    familyJson.tree.some(node =>
                        node.data === otherSpouse.data &&
                        (node.tag === TAGS.HUSBAND || node.tag === TAGS.WIFE)
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

export { 
    toJson, 
    getIndividualsList,
    processDate
};