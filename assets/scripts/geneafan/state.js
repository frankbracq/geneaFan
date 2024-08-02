import _ from 'lodash';
import configStore from './store';

// Fonctions pour initialiser et obtenir l'instance de tomSelect via configStore
export const initializeTomSelect = () => {
    configStore.initializeTomSelect();
};

export const getTomSelectInstance = () => {
    return configStore.tomSelect;
};

/**
 * Clear all relevant states when a new file is loaded.
 */
export const clearAllStates = () => {
    clearSourceData();
    clearFamilyTreeData();
    clearGenealogyGraph();
    clearAncestorMap();
    clearAscendantEvents();
    clearFamilyEvents();
    clearStatistics();
    setIndividualsCache(new Map());  
};

// Source data state
let sourceDataState = [];
/**
 * Get the current source data state.
 * @returns {Array} The current source data.
 */
export const getSourceData = () => sourceDataState;
/**
 * Set new source data and clear ancestor map.
 * @param {Array} newSourceData - The new source data to be set.
 */
export const setSourceData = newSourceData => {
    sourceDataState = newSourceData;
    clearAncestorMap();
};
/**
 * Clear the source data state and ancestor map.
 */
export const clearSourceData = () => {
    sourceDataState = [];
    clearAncestorMap();
};

// Cache state
let individualsCache = new Map();
/**
 * Get the current individuals cache.
 * @returns {Map} The current individuals cache.
 */
export const getIndividualsCache = () => individualsCache;
/**
 * Set new individuals cache.
 * @param {Map} newCache - The new cache to be set.
 */
export const setIndividualsCache = newCache => {
    individualsCache = newCache;
    // console.log("Individuals cache", individualsCache);
};

// Family tree data state
let familyTreeData = [];

/**
 * Get the current family tree data.
 * @returns {Array} The current family tree data.
 */
export const getFamilyTreeData = () => familyTreeData;

/**
 * Set new family tree data and clear ancestor map.
 * @param {Array} newData - The new family tree data to be set.
 */
export const setFamilyTreeData = newData => {
    familyTreeData = newData;
    clearAncestorMap();
};

/**
 * Clear the family tree data without creating a new reference.
 */
const clearFamilyTreeData = () => {
    familyTreeData.length = 0;
    clearAncestorMap();
};

// Genealogy graph state
/*
Nodes Array: Each individual from the original data is added to the nodes array with an id and name.
Edges Array: For each individual, if a fatherId or motherId exists, an edge is created representing the parent-child relationship.
genealogyGraph Object: Combines the nodes and edges
*/
let genealogyGraph = { nodes: [], edges: [] };
/**
 * Get the current genealogy graph.
 * @returns {Object} The current genealogy graph.
 */
export const getGenealogyGraph = () => genealogyGraph;
/**
 * Set new genealogy graph and clear ancestor map.
 * @param {Object} newGraph - The new genealogy graph to be set.
 */
export const setGenealogyGraph = newGraph => {
    genealogyGraph = newGraph;
    clearAncestorMap();
};
/**
 * Clear the genealogy graph and ancestor map.
 */
const clearGenealogyGraph = () => {
    genealogyGraph = { nodes: [], edges: [] };
    clearAncestorMap();
};
/**
 * Add a node to the genealogy graph if it does not already exist.
 * @param {Object} individual - The individual to be added as a node.
 */
export const addNodeToGenealogyGraph = individual => {
    if (!genealogyGraph.nodes.some(node => node.id === individual.id)) {
        genealogyGraph.nodes.push({
            id: individual.id,
            name: individual.name,
            birthDate: individual.birthDate,
            deathDate: individual.deathDate
        });
    }
};
/**
 * Add an edge to the genealogy graph if it does not already exist.
 * @param {string} sourceId - The source node ID.
 * @param {string} targetId - The target node ID.
 * @param {string} relation - The relation between nodes.
 */
export const addEdgeToGenealogyGraph = (sourceId, targetId, relation) => {
    if (!genealogyGraph.edges.some(edge => edge.source === sourceId && edge.target === targetId)) {
        genealogyGraph.edges.push({
            source: sourceId,
            target: targetId,
            relation: relation
        });
    }
};

// Ancestor map cache
let ancestorMapCache = new Map();
/**
 * Get the current ancestor map cache.
 * @returns {Map} The current ancestor map cache.
 */
export const getAncestorMapCache = () => ancestorMapCache;
/**
 * Set new ancestor map cache.
 * @param {Map} newMap - The new ancestor map cache to be set.
 */
export const setAncestorMapCache = newMap => ancestorMapCache = newMap;
/**
 * Clear the ancestor map cache.
 */
const clearAncestorMap = () => ancestorMapCache.clear();

// Common ancestry graph state
let commonAncestryGraphData = [];
/**
 * Get the current common ancestry graph data.
 * @returns {Array} The current common ancestry graph data.
 */
export const getCommonAncestryGraphData = () => commonAncestryGraphData;
/**
 * Set new common ancestry graph data.
 * @param {Array} newData - The new common ancestry graph data to be set.
 */
export const setCommonAncestryGraphData = newData => {
    commonAncestryGraphData = newData;
};

// Hierarchy state
let hierarchyState = [];
/**
 * Set new hierarchy state.
 * @param {Array} newHierarchy - The new hierarchy to be set.
 */
export const setHierarchy = newHierarchy => hierarchyState = newHierarchy;
/**
 * Get the current hierarchy state.
 * @returns {Array} The current hierarchy state.
 */
export const getHierarchy = () => hierarchyState;

// Ascendants events state
let ascendantEvents = [];
/**
 * Clear all ascendant events.
 */
export const clearAscendantEvents = () => ascendantEvents = [];
/**
 * Add an event to the ascendant events if it does not already exist.
 * @param {Object} event - The event to be added.
 */
export const addToAscendantEvents = event => {
    if (event.eventId && ascendantEvents.some(e => e.eventId === event.eventId)) {
        return;
    }
    ascendantEvents.push(event);
};
/**
 * Get the current ascendant events.
 * @returns {Array} The current ascendant events.
 */
export const getAscendantEvents = () => ascendantEvents;

// Family events state
export let familyEvents = [];
/**
 * Set new family events.
 * @param {Array} newEvents - The new family events to be set.
 */
export const setFamilyEvents = newEvents => familyEvents = newEvents;
/**
 * Get the current family events.
 * @returns {Array} The current family events.
 */
export const getFamilyEvents = () => familyEvents;
/**
 * Add an event to the family events.
 * @param {Object} event - The event to be added.
 */
export const addToFamilyEvents = event => familyEvents.push(event);
/**
 * Clear all family events.
 */
const clearFamilyEvents = () => familyEvents = [];

// GEDCOM file state
export let gedFileUploaded = false;
/**
 * Set the GEDCOM file upload state.
 * @param {boolean} value - The new GEDCOM file upload state.
 */
export const setGedFileUploaded = value => gedFileUploaded = value;
/**
 * Get the current GEDCOM file upload state.
 * @returns {boolean} The current GEDCOM file upload state.
 */
export const getGedFileUploaded = () => gedFileUploaded;

// Family towns state
export let familyTowns = {};
/**
 * Get the current family towns state.
 * @returns {Object} The current family towns state.
 */
export const getFamilyTowns = () => familyTowns;
/**
 * Set new family towns state.
 * @param {Object} newFamilyTowns - The new family towns to be set.
 * @returns {Promise} A promise that resolves when the state is updated.
 */
export const setFamilyTowns = newFamilyTowns => new Promise(resolve => {
    familyTowns = newFamilyTowns;
    resolve();
});

// SVG Pan Zoom instance state
export let svgPanZoomInstance = null;
/**
 * Get the current SVG Pan Zoom instance.
 * @returns {Object} The current SVG Pan Zoom instance.
 */
export const getSvgPanZoomInstance = () => svgPanZoomInstance;
/**
 * Set new SVG Pan Zoom instance.
 * @param {Object} newInstance - The new SVG Pan Zoom instance to be set.
 */
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
export const setStatistics = newStatistics => {
    statistics = newStatistics;
};
export const updateTotalIndividuals = count => {
    statistics.totalIndividuals += count;
};
export const updateGenderCount = (gender, count) => {
    if (gender === 'male' || gender === 'female') {
        statistics.genderCount[gender] += count;
    }
};
export const addBirthYear = year => {
    statistics.birthYears.push(year);
};
export const addDeathYear = year => {
    statistics.deathYears.push(year);
};
export const addAgeAtDeath = age => {
    statistics.agesAtDeath.push(age);
};
export const updateMarriages = count => {
    statistics.marriages += count;
};
export const addChildrenPerCouple = count => {
    statistics.childrenPerCouple.push(count);
};
export const addAgeAtFirstChild = (period, age) => {
    if (!statistics.ageAtFirstChild[period]) {
        statistics.ageAtFirstChild[period] = [];
    }
    statistics.ageAtFirstChild[period].push(age);
};

/**
 * Clear the statistics state.
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

// Google Maps API key and style
export let gmapApiKey = "AIzaSyDu9Qz5YXRF6CTJ4vf-0s89BaVq_eh13YE";

export let gmapStyle = [
    {
        "featureType": "all",
        "elementType": "labels",
        "stylers": [
            {
                "visibility": "off"
            },
            {
                "color": "#f49f53"
            }
        ]
    },
    {
        "featureType": "all",
        "elementType": "labels.text",
        "stylers": [
            {
                "visibility": "simplified"
            }
        ]
    },
    {
        "featureType": "landscape",
        "elementType": "all",
        "stylers": [
            {
                "color": "#f9ddc5"
            },
            {
                "lightness": -7
            }
        ]
    },
    {
        "featureType": "poi.business",
        "elementType": "all",
        "stylers": [
            {
                "color": "#645c20"
            },
            {
                "lightness": 38
            }
        ]
    },
    {
        "featureType": "poi.government",
        "elementType": "all",
        "stylers": [
            {
                "color": "#9e5916"
            },
            {
                "lightness": 46
            }
        ]
    },
    {
        "featureType": "poi.medical",
        "elementType": "geometry.fill",
        "stylers": [
            {
                "color": "#813033"
            },
            {
                "lightness": 38
            },
            {
                "visibility": "off"
            }
        ]
    },
    {
        "featureType": "poi.park",
        "elementType": "all",
        "stylers": [
            {
                "color": "#645c20"
            },
            {
                "lightness": 39
            }
        ]
    },
    {
        "featureType": "poi.school",
        "elementType": "all",
        "stylers": [
            {
                "color": "#a95521"
            },
            {
                "lightness": 35
            }
        ]
    },
    {
        "featureType": "poi.sports_complex",
        "elementType": "all",
        "stylers": [
            {
                "color": "#9e5916"
            },
            {
                "lightness": 32
            }
        ]
    },
    {
        "featureType": "road",
        "elementType": "all",
        "stylers": [
            {
                "color": "#813033"
            },
            {
                "lightness": 43
            }
        ]
    },
    {
        "featureType": "road.local",
        "elementType": "geometry.fill",
        "stylers": [
            {
                "color": "#f19f53"
            },
            {
                "weight": 1.3
            },
            {
                "visibility": "on"
            },
            {
                "lightness": 16
            }
        ]
    },
    {
        "featureType": "road.local",
        "elementType": "geometry.stroke",
        "stylers": [
            {
                "color": "#f19f53"
            },
            {
                "lightness": -10
            }
        ]
    },
    {
        "featureType": "transit",
        "elementType": "all",
        "stylers": [
            {
                "lightness": 38
            }
        ]
    },
    {
        "featureType": "transit.line",
        "elementType": "all",
        "stylers": [
            {
                "color": "#813033"
            },
            {
                "lightness": 22
            }
        ]
    },
    {
        "featureType": "transit.station",
        "elementType": "all",
        "stylers": [
            {
                "visibility": "off"
            }
        ]
    },
    {
        "featureType": "water",
        "elementType": "all",
        "stylers": [
            {
                "color": "#1994bf"
            },
            {
                "saturation": -69
            },
            {
                "gamma": 0.99
            },
            {
                "lightness": 43
            }
        ]
    }
];
