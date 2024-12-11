import _ from 'lodash';
import timelineEventsStore from '../../tabs/timeline/timelineEventsStore.js';
import familyTreeDataStore from '../../tabs/familyTree/familyTreeDataStore.js';
import familyTownsStore from '../../gedcom/familyTownsStore.js';

/**
 * Resets all states from different stores
 */
export const clearAllStates = () => {
    familyTreeDataStore.clearGenealogyGraph();
    timelineEventsStore.clearEvents();
    familyTownsStore.setTownsData({});
    clearStatistics();
};

// Statistics state
let statistics = {
    totalIndividuals: 0,
    genderCount: { male: 0, female: 0 },
    birthYears: [],
    deathYears: [],
    agesAtDeath: [],
    marriages: 0,
    childrenPerCouple: [],
    ageAtFirstChild: {}
};

export const getStatistics = () => statistics;
export const setStatistics = newStatistics => { statistics = newStatistics; };
export const updateTotalIndividuals = count => { statistics.totalIndividuals += count; };
export const updateGenderCount = (gender, count) => {
    if (gender === 'male' || gender === 'female') statistics.genderCount[gender] += count;
};
export const addBirthYear = year => { statistics.birthYears.push(year); };
export const addDeathYear = year => { statistics.deathYears.push(year); };
export const addAgeAtDeath = age => { statistics.agesAtDeath.push(age); };
export const updateMarriages = count => { statistics.marriages += count; };
export const addChildrenPerCouple = count => { statistics.childrenPerCouple.push(count); };
export const addAgeAtFirstChild = (period, age) => {
    if (!statistics.ageAtFirstChild[period]) statistics.ageAtFirstChild[period] = [];
    statistics.ageAtFirstChild[period].push(age);
};

/**
 * Resets statistics to their default values
 */
const clearStatistics = () => {
    statistics = {
        totalIndividuals: 0,
        genderCount: { male: 0, female: 0 },
        birthYears: [],
        deathYears: [],
        agesAtDeath: [],
        marriages: 0,
        childrenPerCouple: [],
        ageAtFirstChild: {}
    };
};