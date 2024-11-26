import { makeObservable, observable, action, computed, runInAction } from 'mobx';
import _ from 'lodash';
import { clearAncestorMap } from '../common/stores/state.js';

class GedcomDataStore {
    sourceData = [];
    individualsCache = new Map();
    _hierarchy = null;
    familyEvents = [];
    isFileUploaded = false;

    constructor() {
        makeObservable(this, {
            sourceData: observable,
            individualsCache: observable,
            _hierarchy: observable.ref,
            familyEvents: observable,
            isFileUploaded: observable,
            
            // Actions
            setSourceData: action,
            clearSourceData: action,
            setIndividualsCache: action,
            setHierarchy: action,
            addFamilyEvent: action,
            setFamilyEvents: action,
            setFileUploaded: action,
            clearAllState: action,
            
            // Computed
            totalIndividuals: computed,
            hasData: computed,
            familyTreeData: computed
        });
    }

    // Source Data Methods
    getSourceData = () => {
        return this.sourceData;
    }

    setSourceData = (newSourceData) => {
        runInAction(() => {
            this.sourceData = newSourceData;
            clearAncestorMap();
        });
    }

    clearSourceData = () => {
        runInAction(() => {
            this.sourceData = [];
            clearAncestorMap();
        });
    }

    // Individuals Cache Methods
    setIndividualsCache = (newCache) => {
        runInAction(() => {
            this.individualsCache = new Map(newCache);
        });
    }

    getIndividualsCache = () => {
        return this.individualsCache;
    }

    getIndividualsList = () => {
        return Array.from(this.individualsCache.values());
    }

    getIndividual = (id) => {
        return this.individualsCache.get(id);
    }

    addIndividual = (id, data) => {
        runInAction(() => {
            this.individualsCache.set(id, data);
        });
    }

    // Hierarchy Methods
    setHierarchy = (newHierarchy) => {
        runInAction(() => {
            this._hierarchy = newHierarchy;
        });
    }

    getHierarchy = () => {
        return this._hierarchy;
    }

    // Family Events Methods
    addFamilyEvent = (event) => {
        runInAction(() => {
            this.familyEvents.push(event);
        });
    }

    setFamilyEvents = (events) => {
        runInAction(() => {
            this.familyEvents = [...events];
        });
    }

    getFamilyEvents = () => {
        return this.familyEvents;
    }

    clearFamilyEvents = () => {
        runInAction(() => {
            this.familyEvents = [];
        });
    }

    // File Upload Status Methods
    setFileUploaded = (status) => {
        runInAction(() => {
            this.isFileUploaded = status;
        });
    }

    getFileUploaded = () => {
        return this.isFileUploaded;
    }

    // Reset State
    clearAllState = () => {
        runInAction(() => {
            this.sourceData = [];
            this.individualsCache = new Map();
            this._hierarchy = null;
            this.familyEvents = [];
            this.isFileUploaded = false;
            clearAncestorMap();
        });
    }

    // Computed Properties
    get totalIndividuals() {
        return this.individualsCache.size;
    }

    get hasData() {
        return this.sourceData.length > 0;
    }

    get familyTreeData() {
        return this.getFamilyTreeData();
    }

    // Family Tree Data
    getFamilyTreeData = () => {
        return Array.from(this.individualsCache.values()).map(data => ({
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
}

const gedcomDataStore = new GedcomDataStore();
export default gedcomDataStore;