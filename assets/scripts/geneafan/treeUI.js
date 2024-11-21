import FamilyTree from '@balkangraph/familytree.js';
import _ from 'lodash';
import { reaction } from './stores/mobx-config';
import { commonAncestryGraph, getOldestAncestorOf } from './ancestorUtils';
import rootPersonStore from './stores/rootPersonStore';
import familyTreeDataStore from './stores/familyTreeDataStore';

let family;
let initializing = false;

export function initializeFamilyTree() {
    console.log('Initializing family tree...');
    initializing = true;

    const familyTreeData = familyTreeDataStore.getFamilyTreeData;
    if (familyTreeData.length === 0) {
        console.error('Error: familyTreeData is empty.');
        return;
    }

    const initialRootId = rootPersonStore.root;
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
                    background: "#FFD700",
                    color: "#000000"
                },
                field_0: { color: "#000000" }
            }
        }
    });

    // Event handlers remain the same, just update data source references
    family.onInit(() => {
        const rootNode = family.getNode(initialRootId);
        if (rootNode) {
            const rootId = getOldestAncestorOf(rootNode.id, "both");
            family.config.roots = [rootId];
            family.draw();
        }
    });

    family.onNodeDoubleClick((args) => {
        focusedNodeId = args.data.id;
        family.draw();
    });

    family.on('redraw', () => {
        document.querySelector('#treeContainer svg').addEventListener('dblclick', (e) => {
            if (e.target.closest('svg')) {
                focusedNodeId = null;
            }
        });
    });

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

    reaction(
        () => familyTreeDataStore.getFamilyTreeData,
        (newData) => {
            if (!initializing && family && newData.length > 0) {
                family.load(newData);
            }
        }
    );

    family.load(familyTreeData);
    initializing = false;
}

// Function implementations restent les mêmes
function clearTags(nodes, tagsToClear) {
    Object.keys(nodes).forEach(id => {
        nodes[id].tags = nodes[id].tags.filter(tag => !tagsToClear.includes(tag));
    });
}

function applySelectionTags(nodes, node) {
    addTagToNode(node, 'selected');
    iterateParents(nodes, node);
    iterateChildren(nodes, node);
    iteratePartners(nodes, node);
    blurUnfocusedNodes(nodes);
}

function addTagToNode(node, tag) {
    if (!node.tags.includes(tag)) {
        node.tags.push(tag);
    }
}

function blurUnfocusedNodes(nodes) {
    Object.keys(nodes).forEach(id => {
        if (!nodes[id].tags.includes('focused')) {
            addTagToNode(nodes[id], 'blurred');
        }
    });
}

// Root change reaction reste similaire
reaction(
    () => rootPersonStore.root,
    (rootId) => {
        if (!initializing && rootId) {
            if (!family) {
                initializeFamilyTree();
            }
            const oldestAncestorId = getOldestAncestorOf(rootId, "both");
            family.config.roots = [oldestAncestorId];

            const nodeData = family.get(rootId);
            if (nodeData) {
                nodeData.tags = nodeData.tags || [];
                if (!nodeData.tags.includes('rootTag')) {
                    nodeData.tags.push('rootTag');
                }
            }
            
            family.draw();
        }
    }
);

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

function addFocusedTag(node) {
    if (node && !node.tags.includes('focused')) {
        node.tags.push('focused');
    }
}

function getFilteredFamilyTreeData(familyTreeData, genealogyGraph, roots) {
    const selectedNodes = new Set(roots);
    let nodesToProcess = [...roots];

    while (nodesToProcess.length > 0) {
        const currentId = nodesToProcess.shift();
        
        genealogyGraph.edges.forEach(edge => {
            if (edge.source === currentId || edge.target === currentId) {
                const connectedNode = edge.source === currentId ? edge.target : edge.source;
                if (!selectedNodes.has(connectedNode)) {
                    selectedNodes.add(connectedNode);
                    nodesToProcess.push(connectedNode);
                }
            }
        });
    }

    return familyTreeData.filter(node => selectedNodes.has(node.id));
}

// Handle common ancestor functionality
document.getElementById("commonAncestor").addEventListener("click", () => {
    const genealogyGraph = familyTreeDataStore.getGenealogyGraph;
    const familyTreeData = familyTreeDataStore.getFamilyTreeData;
    const id1 = '@I789613205@';
    const id2 = '@I170@';

    commonAncestryGraph(id1, id2);

    const selectedIds = familyTreeDataStore.getCommonAncestryGraphData;
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

export function getTreeInstance() {
    return family;
}