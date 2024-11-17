import _ from 'lodash';
import timelineEventsStore from './timelineEventsStore.js';
import gedcomDataStore from './gedcomDataStore';


export const getIndividualsCache = () => gedcomDataStore.getIndividualsCache();

/**
 * Clear all relevant states when a new file is loaded.
 */
export const clearAllStates = () => {
    clearFamilyTreeData();
    clearGenealogyGraph();
    clearAncestorMap();
    timelineEventsStore.clearEvents(); // Utiliser le nouveau store
    clearStatistics();
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
let genealogyGraph = { nodes: [], edges: [] };

export const getGenealogyGraph = () => genealogyGraph;
export const setGenealogyGraph = newGraph => {
    genealogyGraph = newGraph;
    clearAncestorMap();
};

const clearGenealogyGraph = () => {
    genealogyGraph = { nodes: [], edges: [] };
    clearAncestorMap();
};

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

export const getAncestorMapCache = () => ancestorMapCache;
export const setAncestorMapCache = newMap => ancestorMapCache = newMap;
export const clearAncestorMap = () => ancestorMapCache.clear();

// Common ancestry graph state
let commonAncestryGraphData = [];

export const getCommonAncestryGraphData = () => commonAncestryGraphData;
export const setCommonAncestryGraphData = newData => {
    commonAncestryGraphData = newData;
};

// Timeline events exports
// Redirection vers le nouveau store pour la rétrocompatibilité
export const clearAscendantEvents = () => timelineEventsStore.clearEvents();
export const addToAscendantEvents = event => timelineEventsStore.addEvent(event);
export const getAscendantEvents = () => timelineEventsStore.getAllEvents();

// Family towns state
export let familyTowns = {};

export const getFamilyTowns = () => familyTowns;
export const setFamilyTowns = newFamilyTowns => new Promise(resolve => {
    familyTowns = newFamilyTowns;
    resolve();
});

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

// Google Maps related exports
export const gmapApiKey = "AIzaSyDu9Qz5YXRF6CTJ4vf-0s89BaVq_eh13YE";
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
