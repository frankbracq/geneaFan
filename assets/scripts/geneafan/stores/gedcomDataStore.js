import { makeAutoObservable, runInAction, action }  from './mobx-config.js';
import _ from 'lodash';
import { clearAncestorMap } from './state.js';

class GedcomDataStore {
    sourceData = [];
    individualsCache = new Map();
    _hierarchy = null; // Changé de [] à null
    familyEvents = [];
    isFileUploaded = false;

    constructor() {
        makeAutoObservable(this, {
            _hierarchy: false, // Ne pas observer _hierarchy
            setHierarchy: action
        });
    }

    setHierarchy = action(newHierarchy => {
        this._hierarchy = newHierarchy;
    });

    getHierarchy() {
        return this._hierarchy;
    }

    // Source Data Methods
    setSourceData(newSourceData) {
        runInAction(() => {
            this.sourceData = newSourceData;
            clearAncestorMap(); // Utiliser la fonction importée
        });
    }

    clearSourceData() {
        runInAction(() => {
            this.sourceData = [];
            clearAncestorMap(); // Utiliser la fonction importée
        });
    }

    // Individuals Cache Methods
    setIndividualsCache(newCache) {
        runInAction(() => {
            this.individualsCache = newCache;
        });
    }

    getIndividual(id) {
        return this.individualsCache.get(id);
    }

    // Family Events Methods
    addFamilyEvent(event) {
        runInAction(() => {
            this.familyEvents.push(event);
        });
    }

    setFamilyEvents(events) {
        runInAction(() => {
            this.familyEvents = events;
        });
    }

    // File Upload Status Methods
    setFileUploaded(status) {
        runInAction(() => {
            this.isFileUploaded = status;
        });
    }

    // Reset State
    clearAllState() {
        runInAction(() => {
            this.sourceData = [];
            this.individualsCache = new Map();
            this._hierarchy = []; // Mise à jour ici aussi
            this.familyEvents = [];
            this.isFileUploaded = false;
        });
    }

    // Computed Properties
    get totalIndividuals() {
        return this.individualsCache.size;
    }

    get hasData() {
        return this.sourceData.length > 0;
    }
}

const gedcomDataStore = new GedcomDataStore();
export default gedcomDataStore;