import _ from 'lodash';
import timelineEventsStore from '../../tabs/timeline/timelineEventsStore.js';
import gedcomDataStore from '../../gedcom/gedcomDataStore.js';
import familyTreeDataStore from '../../tabs/familyTree/familyTreeDataStore.js';
import familyTownsStore from '../../gedcom/familyTownsStore.js';
import { SVGPanZoomManager } from '../../tabs/fanChart/SVGPanZoomManager.js'; 

export const getIndividualsCache = () => gedcomDataStore.getIndividualsCache();

export const clearAllStates = () => {
    familyTreeDataStore.clearGenealogyGraph();
    timelineEventsStore.clearEvents();
    familyTownsStore.setTownsData({});
    clearStatistics();
};

export const getGenealogyGraph = () => familyTreeDataStore.getGenealogyGraph;
export const clearAncestorMap = () => familyTreeDataStore.clearAncestorMap();
export const getCommonAncestryGraphData = () => familyTreeDataStore.getCommonAncestryGraphData;

export const clearAscendantEvents = () => timelineEventsStore.clearEvents();
export const addToAscendantEvents = event => timelineEventsStore.addEvent(event);
export const getAscendantEvents = () => timelineEventsStore.getAllEvents();

// SVG Pan Zoom instance state
export let svgPanZoomInstance = null;
export const getSvgPanZoomInstance = () => svgPanZoomInstance;
export const setSvgPanZoomInstance = newInstance => svgPanZoomInstance = newInstance;

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
