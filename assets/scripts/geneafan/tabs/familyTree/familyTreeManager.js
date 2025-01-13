import FamilyTree from '@balkangraph/familytree.js';
import _ from 'lodash';
import { reaction } from '../../common/stores/mobx-config.js';
import { getOldestAncestorOf, commonAncestryGraph } from './ancestorUtils.js';
import rootPersonStore from '../../common/stores/rootPersonStore.js';
import familyTreeDataStore from './familyTreeDataStore.js';

let family;
let initializing = false;
let disposers = new Set();

function setupCommonAncestorHandler() {
    const commonAncestorBtn = document.getElementById("commonAncestor");
    if (!commonAncestorBtn) return;

    commonAncestorBtn.addEventListener("click", async () => {
        if (!familyTreeDataStore || !family) return;

        const genealogyGraph = familyTreeDataStore.getGenealogyGraph;
        const familyTreeData = familyTreeDataStore.getFamilyTreeData;
        const id1 = '@I789613205@';
        const id2 = '@I170@';

        const commonAncestors = commonAncestryGraph(id1, id2);
        if (!commonAncestors) {
            console.warn('Aucun ancêtre commun trouvé');
            return;
        }

        const selectedIds = familyTreeDataStore.getCommonAncestryGraphData;
        const roots = [selectedIds[0]];
        const filteredFamilyTreeData = getFilteredFamilyTreeData(
            familyTreeData, 
            genealogyGraph, 
            roots
        );

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
}

async function waitForData(maxAttempts = 20, interval = 500) {
    console.log('Waiting for family tree data...');
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const data = familyTreeDataStore.getFamilyTreeData;
        if (data && data.length > 0) {
            console.log(`Data found after ${attempt + 1} attempts:`, data.length, 'records');
            return true;
        }

        console.log(`Attempt ${attempt + 1}/${maxAttempts}: No data yet`);
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Data not available after ${maxAttempts} attempts`);
}

export async function initializeFamilyTree() {
    console.group('🌳 Initializing family tree');
    
    try {
        if (initializing) {
            console.log('Initialization already in progress');
            console.groupEnd();
            return;
        }
        
        initializing = true;
        console.log('Starting initialization...');

        try {
            await waitForData();
        } catch (error) {
            console.error('Failed to load family tree data:', error);
            throw new Error('Unable to load family tree data. Please check if the GEDCOM file was processed correctly.');
        }

        // Setup tree components
        await setupFamilyTree();
        setupReactions();
        setupCommonAncestorHandler();

        console.log('✅ Family tree successfully initialized');
        initializing = false;

    } catch (error) {
        console.error('❌ Error during initialization:', error);
        initializing = false;
        throw error;
    } finally {
        console.groupEnd();
    }
}

function setupFamilyTree() {
    try {
        const formattedData = familyTreeDataStore.formatIndividualsForTree;
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

        // Event handlers
        family.onInit(() => {
            try {
                const rootNode = family.getNode(initialRootId);
                if (rootNode) {
                    const rootId = getOldestAncestorOf(rootNode.id, "both");
                    family.config.roots = [rootId];
                    family.draw();
                }
            } catch (error) {
                console.error('Error in onInit handler:', error);
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

        // Load initial data with validation
        if (Array.isArray(formattedData) && formattedData.length > 0) {
            family.load(formattedData);
            console.log('Initial tree data loaded successfully');
        } else {
            throw new Error('Invalid formatted data for tree initialization');
        }

    } catch (error) {
        console.error('Failed to setup family tree:', error);
        throw new Error('Failed to initialize family tree visualization');
    }
}

function setupReactions() {
    // Réaction aux changements des données
    const dataReaction = reaction(
        () => familyTreeDataStore.getFamilyTreeData,
        (newData) => {
            if (!initializing && family && newData.length > 0) {
                family.load(newData);
            }
        }
    );
    disposers.add(dataReaction);

    // Réaction aux changements du format
    const formatReaction = reaction(
        () => familyTreeDataStore.formatIndividualsForTree,
        (newData) => {
            if (!initializing && family && newData.length > 0) {
                family.load(newData);
            }
        }
    );
    disposers.add(formatReaction);

    // Réaction aux changements de la racine
    const rootReaction = reaction(
        () => rootPersonStore.root,
        (rootId) => {
            if (!initializing && rootId) {
                handleRootChange(rootId);
            }
        }
    );
    disposers.add(rootReaction);
}

function handleRootChange(rootId) {
    if (!family) {
        initializeFamilyTree();
        return;
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

export function dispose() {
    console.log('Nettoyage de TreeUI');
    disposers.forEach(disposer => disposer());
    disposers.clear();
    
    if (family) {
        family.destroy();
        family = null;
    }

    familyTreeDataStore = null;
    initializing = false;
}

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
document.addEventListener('DOMContentLoaded', () => {
    const commonAncestorBtn = document.getElementById("commonAncestor");
    if (commonAncestorBtn) {
        commonAncestorBtn.addEventListener("click", () => {
            // Utilisation directe du store au lieu du wrapper
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
    }
});

export function getTreeInstance() {
    return family;
}