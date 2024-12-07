import { makeObservable, observable, action, computed, reaction } from '../../common/stores/mobx-config.js';

class FamilyTreeDataStore {
    constructor() {
        // Initialize observable properties
        this.familyTreeData = [];
        this.genealogyGraph = { nodes: [], edges: [] };
        this.ancestorMapCache = new Map();
        this.commonAncestryGraphData = [];

        // Make properties observable
        makeObservable(this, {
            // Observable properties
            familyTreeData: observable.ref,
            genealogyGraph: observable.ref,
            ancestorMapCache: observable.ref,
            commonAncestryGraphData: observable.ref,

            // Actions
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

            // Computed values
            getFamilyTreeData: computed,
            getGenealogyGraph: computed,
            getAncestorMapCache: computed,
            getCommonAncestryGraphData: computed,
            formatIndividualsForTree: computed
        });

        // Déplacer la réaction dans une méthode séparée
        this.initializeReactions();
    }

    // Nouvelle méthode pour initialiser les réactions
    initializeReactions = () => {
        // Import dynamique pour éviter la dépendance circulaire
        import('../../gedcom/gedcomDataStore.js').then(gedcomDataStoreModule => {
            const gedcomDataStore = gedcomDataStoreModule.default;
            
            reaction(
                () => gedcomDataStore.getIndividualsList(),
                (individuals) => {
                    if (individuals && Array.isArray(individuals)) {
                        this.updateFromIndividualsCache(individuals);
                    }
                },
                {
                    name: 'FamilyTreeDataStore-IndividualsCacheReaction'
                }
            );
        });
    }

    // Le reste des méthodes reste inchangé
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

const familyTreeDataStore = new FamilyTreeDataStore();
export default familyTreeDataStore;