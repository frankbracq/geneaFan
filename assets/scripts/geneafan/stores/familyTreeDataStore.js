import { makeObservable, observable, action, computed, reaction } from 'mobx';
import gedcomDataStore from './gedcomDataStore';

class FamilyTreeDataStore {
    familyTreeData = [];
    genealogyGraph = { nodes: [], edges: [] };
    ancestorMapCache = new Map();
    commonAncestryGraphData = [];

    constructor() {
        makeObservable(this, {
            familyTreeData: observable,
            genealogyGraph: observable,
            commonAncestryGraphData: observable,
            setFamilyTreeData: action,
            updateFromIndividualsCache: action,
            clearFamilyTreeData: action,
            getFamilyTreeData: computed,
            // New genealogy graph actions and computed
            clearGenealogyGraph: action,
            addNodeToGenealogyGraph: action,
            addEdgeToGenealogyGraph: action,
            setGenealogyGraph: action,
            getGenealogyGraph: computed,
            // Ancestor map actions
            clearAncestorMap: action,
            setAncestorMapCache: action,
            getAncestorMapCache: computed,
            // Common ancestry graph actions
            setCommonAncestryGraphData: action,
            getCommonAncestryGraphData: computed
        });

        // Réagir aux changements dans individualsCache
        reaction(
            () => gedcomDataStore.getIndividualsList(),
            (individuals) => {
                this.updateFromIndividualsCache(individuals);
            },
            {
                name: 'FamilyTreeDataStore-IndividualsCacheReaction'
            }
        );
    }

    // Existing methods
    setFamilyTreeData = (newData) => {
        this.familyTreeData = newData;
    }

    updateFromIndividualsCache = (individuals) => {
        this.familyTreeData = individuals.map(data => ({
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

    clearFamilyTreeData = () => {
        this.familyTreeData = [];
    }

    get getFamilyTreeData() {
        return this.familyTreeData;
    }

    // New genealogy graph methods
    clearGenealogyGraph = () => {
        this.genealogyGraph = { nodes: [], edges: [] };
        this.clearAncestorMap();
    }

    addNodeToGenealogyGraph = (individual) => {
        if (!this.genealogyGraph.nodes.some(node => node.id === individual.id)) {
            this.genealogyGraph.nodes.push({
                id: individual.id,
                name: individual.name,
                birthDate: individual.birthDate,
                deathDate: individual.deathDate
            });
        }
    }

    addEdgeToGenealogyGraph = (sourceId, targetId, relation) => {
        if (!this.genealogyGraph.edges.some(edge => 
            edge.source === sourceId && edge.target === targetId)) {
            this.genealogyGraph.edges.push({
                source: sourceId,
                target: targetId,
                relation: relation
            });
        }
    }

    setGenealogyGraph = (newGraph) => {
        this.genealogyGraph = newGraph;
        this.clearAncestorMap();
    }

    get getGenealogyGraph() {
        return this.genealogyGraph;
    }

    // Ancestor map methods
    clearAncestorMap = () => {
        this.ancestorMapCache.clear();
    }

    setAncestorMapCache = (newMap) => {
        this.ancestorMapCache = newMap;
    }

    get getAncestorMapCache() {
        return this.ancestorMapCache;
    }

    // Common ancestry graph methods
    setCommonAncestryGraphData = (newData) => {
        this.commonAncestryGraphData = newData;
    }

    get getCommonAncestryGraphData() {
        return this.commonAncestryGraphData;
    }
}

const familyTreeDataStore = new FamilyTreeDataStore();
export default familyTreeDataStore;