import FamilyTree from '@balkangraph/familytree.js';
import _ from 'lodash';
import { reaction } from 'mobx';
import {
    getIndividualsCache,
    getCommonAncestryGraphData,
    getGenealogyGraph,
    setFamilyTreeData,
    getFamilyTreeData,
} from './state';
import { commonAncestryGraph, getOldestAncestorOf } from './ancestorUtils';
import configStore from './store';

// Function to get all descendants of a given individual
function getAllDescendants(individualId, genealogyGraph) {
    const descendants = new Set();
    const childEdges = _.groupBy(genealogyGraph.edges, 'source');
    const stack = [individualId];

    while (stack.length > 0) {
        const currentId = stack.pop();
        if (descendants.has(currentId)) continue;
        descendants.add(currentId);

        (childEdges[currentId] || []).forEach(edge => {
            stack.push(edge.target);
        });
    }

    return descendants;
}

// Function to filter individuals by retaining only the root and its descendants
function getFilteredFamilyTreeData(familyTreeData, genealogyGraph, roots) {
    // console.time('getFilteredFamilyTreeData');
    const allDescendants = new Set();
    roots.forEach(root => {
        const descendants = getAllDescendants(root, genealogyGraph);
        descendants.forEach(descendant => allDescendants.add(descendant));
    });

    // Filter the family tree data
    const filteredFamilyTreeData = familyTreeData.filter(individual => allDescendants.has(individual.id));

    // Create a set of valid IDs for quick lookup
    const validIds = new Set(filteredFamilyTreeData.map(individual => individual.id));

    // Update fid, mid, and pids properties to ensure they only contain valid IDs
    filteredFamilyTreeData.forEach(individual => {
        individual.fid = validIds.has(individual.fid) ? individual.fid : '';
        individual.mid = validIds.has(individual.mid) ? individual.mid : '';
        individual.pids = individual.pids.filter(pid => validIds.has(pid));
        if (individual.pids.length === 0) {
            individual.pids = [''];
        }
    });
    // console.timeEnd('getFilteredFamilyTreeData');
    return filteredFamilyTreeData;
}

// Function to format data for FamilyTreeJS
function formatIndividualsData(individualsCache) {
    return Array.from(individualsCache.values()).map(data => ({
        id: data.id,
        fid: data.fatherId,
        mid: data.motherId,
        pids: data.spouseIds,
        name: `${data.name} ${data.surname}`,
        birthDate: data.birthDate,
        deathDate: data.deathYear,
        gender: data.gender,
        display: true
    }));
}

let family;
let initializing = false; 

export function initializeFamilyTree() {
    // console.log('Initializing family tree');
    initializing = true;

    let familyTreeData = getFamilyTreeData();
    if (familyTreeData.length === 0) {
        // console.log('Creating family tree data');
        familyTreeData = formatIndividualsData(getIndividualsCache());
        setFamilyTreeData(familyTreeData);
    }

    const config = configStore.getConfig;
    const initialRootId = config.root;
    console.log('Initial root ID', initialRootId);
    let focusedNodeId = initialRootId;

    family = new FamilyTree(document.getElementById('treeContainer'), {
        mouseScrool: FamilyTree.action.none,
        scaleInitial: FamilyTree.match.boundary,
        roots: [initialRootId],
        nodeBinding: {
            field_0: 'name',
            field_1: 'birthDate',
            field_2: 'deathDate',
            field_3: 'id'
        },
        orientation: FamilyTree.orientation.top,
        miniMap: true,
        toolbar: {
            layout: false,
            zoom: true,
            fit: true,
            expandAll: false,
            fullScreen: true
        },
    });

    family.onInit(() => {
        console.log('Family tree onInit');
        const rootNode = family.getNode(initialRootId);
        if (rootNode) {
            const rootId = getOldestAncestorOf(rootNode.id, "both");
            // console.log('Oldest ancestor Id on init:', rootId);
            family.config.roots = [rootId];
            family.draw();
        }
    });

    family.onNodeDoubleClick(function (args) {
        focusedNodeId = args.data.id;
        family.draw();
    });

    family.on('redraw', function () {
        // console.log('Family tree redraw');
        document.querySelector('#treeContainer svg').addEventListener('dblclick', function (e) {
                if (e.target.closest('svg')) {
                    focusedNodeId = null;
                }
            });
    });

    family.on("prerender", function (sender, args) {
        console.log('Family tree prerender');
        const nodes = args.res.nodes;
        if (focusedNodeId == null) {
            Object.keys(nodes).forEach(id => {
                nodes[id].tags = nodes[id].tags.filter(tag => tag !== 'focused' && tag !== 'blurred');
            });
            return;
        }

        const node = nodes[focusedNodeId];
        if (node) {
            addTagToNode(node, 'selected');
            iterate_parents(nodes, node);
            iterate_children(nodes, node);
            iterate_partners(nodes, node);
        }

        Object.keys(nodes).forEach(id => {
            if (!nodes[id].tags.includes('focused')) {
                addTagToNode(nodes[id], 'blurred');
            }
        });

        focusedNodeId = null;
    });

    function addTagToNode(node, tag) {
        if (!node.tags.includes(tag)) {
            node.tags.push(tag);
        }
    }

    family.load(familyTreeData);
    initializing = false;
}

// Use reaction to specifically monitor root changes
reaction(
    () => configStore.config.root,
    (newRootId) => {
        // console.log("Reaction in tree.js - New root ID detected:", newRootId);
        if (!initializing) {
            // console.log("Not initializing, proceeding with update.");
            if (!family) {
                // console.log("Family instance is not initialized. Initializing now...");
                initializeFamilyTree();
            }
            const rootId = getOldestAncestorOf(newRootId, "both");
            // console.log('Oldest ancestor ID determined by getOldestAncestorOf:', rootId);
            family.config.roots = [rootId];
            family.draw();
        } else {
            // console.log("Currently initializing, skipping update.");
        }
    }
);

function addFocusedTag(node) {
    if (!node.tags.includes('focused')) {
        node.tags.push('focused');
    }
}

function iterate_partners(nodes, node) {
    if (node.pids) {
        node.pids.forEach(pid => {
            const pnode = nodes[pid];
            addFocusedTag(pnode);
        });
    }
}

function iterate_parents(nodes, node) {
    addFocusedTag(node);

    const mnode = nodes[node.mid];
    const fnode = nodes[node.fid];

    if (mnode) {
        iterate_parents(nodes, mnode);
    }

    if (fnode) {
        iterate_parents(nodes, fnode);
    }
}

function iterate_children(nodes, node) {
    addFocusedTag(node);

    node.ftChildrenIds.forEach(childId => {
        const cnode = nodes[childId];
        if (cnode.mid === node.id || cnode.fid === node.id) {
            iterate_children(nodes, cnode);
        }
    });
}

document.getElementById("commonAncestor").addEventListener("click", function () {
    const genealogyGraph = getGenealogyGraph();
    const familyTreeData = formatIndividualsData(getIndividualsCache());
    const id1 = '@I789613205@';
    const id2 = '@I170@';

    commonAncestryGraph(id1, id2);

    const selectedIds = getCommonAncestryGraphData();
    const roots = [selectedIds[0]];
    const filteredFamilyTreeData = getFilteredFamilyTreeData(familyTreeData, genealogyGraph, roots);

    family.on("prerender", function (sender, args) {
        const nodes = args.res.nodes;
        for (const id in nodes) {
            if (!selectedIds.includes(nodes[id].id)) {
                nodes[id].tags.push('blurred');
            } else {
                nodes[id].tags = nodes[id].tags.filter(tag => tag !== 'blurred');
            }
        }
    });

    family.load(filteredFamilyTreeData);
});
