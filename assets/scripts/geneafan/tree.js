import FamilyTree from '@balkangraph/familytree.js';
import _ from 'lodash';
import { reaction } from 'mobx';
import {
    getIndividualsCache,
    getCommonAncestryGraphData,
    getGenealogyGraph,
    getFamilyTreeData,
} from './state';
import { commonAncestryGraph, getOldestAncestorOf } from './ancestorUtils';
import configStore from './configStore';

let family;
let initializing = false;

// Initialize the family tree with given data and configurations
export function initializeFamilyTree() {
    initializing = true;

    const familyTreeData = getFamilyTreeData();
    if (familyTreeData.length === 0) {
        console.error('Error: familyTreeData is empty.');
        return;
    }

    const { root: initialRootId } = configStore.getConfig;
    let focusedNodeId = initialRootId;

    family = new FamilyTree(document.getElementById('treeContainer'), {
        mouseScrool: FamilyTree.action.none,
        scaleInitial: FamilyTree.match.width,
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
        tags: {
            "rootTag": {
                node: {
                    background: "#FFD700", // Example: golden background color
                    color: "#000000" // Example: black text color
                },
                field_0: { color: "#000000" }
            }
        }
    });

    // Handle tree initialization
    family.onInit(() => {
        const rootNode = family.getNode(initialRootId);
        if (rootNode) {
            const rootId = getOldestAncestorOf(rootNode.id, "both");
            family.config.roots = [rootId];
            family.draw();
        }
    });

    // Handle node double click
    family.onNodeDoubleClick((args) => {
        focusedNodeId = args.data.id;
        family.draw();
    });

    // Handle tree redraw
    family.on('redraw', () => {
        document.querySelector('#treeContainer svg').addEventListener('dblclick', (e) => {
            if (e.target.closest('svg')) {
                focusedNodeId = null;
            }
        });
    });

    // Handle tree prerender
    family.on("prerender", (sender, args) => {
        const nodes = args.res.nodes;

        if (focusedNodeId == null) {
            clearTags(nodes, ['focused', 'blurred']);
            return;
        }

        const node = nodes[focusedNodeId];
        if (node) {
            applySelectionTags(nodes, node);
        }

        focusedNodeId = null;
    });

    family.load(familyTreeData);
    initializing = false;
}

// Function to clear specific tags from nodes
function clearTags(nodes, tagsToClear) {
    Object.keys(nodes).forEach(id => {
        nodes[id].tags = nodes[id].tags.filter(tag => !tagsToClear.includes(tag));
    });
}

// Function to apply selection-related tags to a node and its relatives
function applySelectionTags(nodes, node) {
    addTagToNode(node, 'selected');
    iterateParents(nodes, node);
    iterateChildren(nodes, node);
    iteratePartners(nodes, node);
    blurUnfocusedNodes(nodes);
}

// Function to add a tag to a node
function addTagToNode(node, tag) {
    if (!node.tags.includes(tag)) {
        node.tags.push(tag);
    }
}

// Function to blur nodes that are not focused
function blurUnfocusedNodes(nodes) {
    Object.keys(nodes).forEach(id => {
        if (!nodes[id].tags.includes('focused')) {
            addTagToNode(nodes[id], 'blurred');
        }
    });
}

// Handle root changes and apply specific color to the root node
reaction(
    () => configStore.config.root,
    (rootId) => {
        if (!initializing) {
            if (!family) {
                initializeFamilyTree();
            }
            const oldestAncestorId = getOldestAncestorOf(rootId, "both");
            family.config.roots = [oldestAncestorId];

            const nodeObject = family.getNodeElement(rootId);
            console.log(nodeObject);
            /*
            if (nodeObject) {
                addTagToNode(nodeObject, 'selected'); // Apply the custom tag to the root node
            }
            */
            family.draw();
        }
    }
);

// Helper functions to traverse and apply tags to parents, children, and partners
function iteratePartners(nodes, node) {
    if (node.pids) {
        node.pids.forEach(pid => {
            const partnerNode = nodes[pid];
            addFocusedTag(partnerNode);
        });
    }
}

function iterateParents(nodes, node) {
    addFocusedTag(node);

    const motherNode = nodes[node.mid];
    const fatherNode = nodes[node.fid];

    if (motherNode) {
        iterateParents(nodes, motherNode);
    }

    if (fatherNode) {
        iterateParents(nodes, fatherNode);
    }
}

function iterateChildren(nodes, node) {
    addFocusedTag(node);

    node.ftChildrenIds.forEach(childId => {
        const childNode = nodes[childId];
        if (childNode.mid === node.id || childNode.fid === node.id) {
            iterateChildren(nodes, childNode);
        }
    });
}

// Function to add a 'focused' tag to a node
function addFocusedTag(node) {
    if (node && !node.tags.includes('focused')) {
        node.tags.push('focused');
    }
}

// Example: Handle common ancestor button click event
document.getElementById("commonAncestor").addEventListener("click", () => {
    const genealogyGraph = getGenealogyGraph();
    const familyTreeData = formatIndividualsData(getIndividualsCache());
    const id1 = '@I789613205@';
    const id2 = '@I170@';

    commonAncestryGraph(id1, id2);

    const selectedIds = getCommonAncestryGraphData();
    const roots = [selectedIds[0]];
    const filteredFamilyTreeData = getFilteredFamilyTreeData(familyTreeData, genealogyGraph, roots);

    family.on("prerender", (sender, args) => {
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