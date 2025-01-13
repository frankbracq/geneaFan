import { makeObservable, observable, action, computed, reaction } from '../../common/stores/mobx-config.js';

class FamilyTreeDataStore {
    static instance = null;
    static initializing = false;

    familyTreeData = [];
    genealogyGraph = { nodes: [], edges: [] };
    ancestorMapCache = new Map();
    commonAncestryGraphData = [];
    disposers = new Set();
    gedcomDataStore = null;
    initialized = false;

    constructor() {
        if (FamilyTreeDataStore.instance) {
            return FamilyTreeDataStore.instance;
        }
        
        makeObservable(this, {
            familyTreeData: observable.ref,
            genealogyGraph: observable.ref,
            ancestorMapCache: observable.ref,
            commonAncestryGraphData: observable.ref,
            initialized: observable,

            setFamilyTreeData: action,
            updateFromIndividualsCache: action,
            clearFamilyTreeData: action,
            clearGenealogyGraph: action,
            addNodeToGenealogyGraph: action,
            addEdgeToGenealogyGraph: action,
            setGenealogyGraph: action,
            clearAncestorMap: action,
            setAncestorMapCache: action,
            setCommonAncestryGraphData: action,
            setInitialized: action,

            getFamilyTreeData: computed,
            getGenealogyGraph: computed,
            getAncestorMapCache: computed,
            getCommonAncestryGraphData: computed,
            formatIndividualsForTree: computed,
            isInitialized: computed
        });

        FamilyTreeDataStore.instance = this;
    }

    static getInstance() {
        if (!FamilyTreeDataStore.instance) {
            FamilyTreeDataStore.instance = new FamilyTreeDataStore();
        }
        return FamilyTreeDataStore.instance;
    }

    async initialize() {
        // Si déjà initialisé ou en cours d'initialisation, retourner l'instance
        if (this.initialized || FamilyTreeDataStore.initializing) {
            console.log('FamilyTreeDataStore déjà initialisé ou en cours d\'initialisation');
            return this;
        }

        console.group('🌳 Initialisation FamilyTreeDataStore');
        FamilyTreeDataStore.initializing = true;

        try {
            console.log('Import de gedcomDataStore...');
            const { default: gedcomStore } = await import('../../gedcom/gedcomDataStore.js');
            this.gedcomDataStore = gedcomStore;

            console.log('Configuration de la réaction aux changements du cache...');
            this.initializeReactions();

            this.setInitialized(true);
            console.log('✅ FamilyTreeDataStore initialisé avec succès');

        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation de FamilyTreeDataStore:', error);
            throw error;
        } finally {
            FamilyTreeDataStore.initializing = false;
            console.groupEnd();
        }

        return this;
    }

    setInitialized = (value) => {
        this.initialized = value;
    }

    get isInitialized() {
        return this.initialized;
    }

    initializeReactions() {
        const individualsReaction = reaction(
            () => Array.from(this.gedcomDataStore.individualsCache.values()),
            (individuals) => {
                if (individuals && Array.isArray(individuals)) {
                    console.log('Mise à jour du cache d\'ancêtres et des données de l\'arbre familial');
                    this.clearAncestorMap();
                    this.updateFromIndividualsCache(individuals);
                }
            },
            {
                name: 'FamilyTreeDataStore-IndividualsCacheReaction'
            }
        );

        this.disposers.add(individualsReaction);
    }

    dispose() {
        console.log('Nettoyage de FamilyTreeDataStore');
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
        this.clearAllData();
    }

    clearAllData() {
        this.familyTreeData = [];
        this.genealogyGraph = { nodes: [], edges: [] };
        this.ancestorMapCache = new Map();
        this.commonAncestryGraphData = [];
        this.gedcomDataStore = null;
    }

    setFamilyTreeData = (newData) => {
        this.familyTreeData = [...newData];
    }

    get formatIndividualsForTree() {
        console.time("formatFamilyTreeData");
        const formattedData = this.familyTreeData.map(data => ({
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
        console.timeEnd("formatFamilyTreeData");
        return formattedData;
    }

    updateFromIndividualsCache = (individuals) => {
        if (!individuals) return;
        this.familyTreeData = individuals;
    }

    clearFamilyTreeData = () => {
        this.familyTreeData = [];
    }

    get getFamilyTreeData() {
        return this.familyTreeData;
    }

    // Genealogy Graph Methods
    clearGenealogyGraph = () => {
        this.genealogyGraph = { nodes: [], edges: [] };
        this.clearAncestorMap();
    }

    addNodeToGenealogyGraph = (individual) => {
        const newNodes = [...this.genealogyGraph.nodes];
        if (!newNodes.some(node => node.id === individual.id)) {
            newNodes.push({
                id: individual.id,
                name: individual.name,
                birthDate: individual.birthDate,
                deathDate: individual.deathDate
            });
            this.genealogyGraph = {
                ...this.genealogyGraph,
                nodes: newNodes
            };
        }
    }

    addEdgeToGenealogyGraph = (sourceId, targetId, relation) => {
        const newEdges = [...this.genealogyGraph.edges];
        if (!newEdges.some(edge => edge.source === sourceId && edge.target === targetId)) {
            newEdges.push({
                source: sourceId,
                target: targetId,
                relation: relation
            });
            this.genealogyGraph = {
                ...this.genealogyGraph,
                edges: newEdges
            };
        }
    }

    setGenealogyGraph = (newGraph) => {
        this.genealogyGraph = { ...newGraph };
        this.clearAncestorMap();
    }

    get getGenealogyGraph() {
        return this.genealogyGraph;
    }

    // Ancestor Map Methods
    clearAncestorMap = () => {
        this.ancestorMapCache = new Map();
    }

    setAncestorMapCache = (newMap) => {
        this.ancestorMapCache = new Map(newMap);
    }

    get getAncestorMapCache() {
        return this.ancestorMapCache;
    }

    // Common Ancestry Graph Methods
    setCommonAncestryGraphData = (newData) => {
        this.commonAncestryGraphData = [...newData];
    }

    get getCommonAncestryGraphData() {
        return this.commonAncestryGraphData;
    }
}

export default FamilyTreeDataStore.getInstance();