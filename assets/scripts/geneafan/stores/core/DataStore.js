// stores/core/DataStore.js
import { makeAutoObservable } from 'mobx';

/**
 * Manages genealogical data and related states
 */
class DataStore {
    sourceData = null;
    individualsCache = null;
    familyTowns = {};
    ancestorMap = new Map();
    gedFileUploaded = false;

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
    }

    /**
     * Set the source genealogical data and clear the ancestor map
     * @param {Object} data - The source genealogical data
     */
    setSourceData(data) {
        this.sourceData = data;
        this.clearAncestorMap();
    }

    /**
     * Set the cache of individuals data
     * @param {Object} cache - The individuals cache object
     */
    setIndividualsCache(cache) {
        this.individualsCache = cache;
    }

    /**
     * Set the family towns data
     * @param {Object} towns - The family towns mapping
     */
    setFamilyTowns(towns) {
        this.familyTowns = towns;
    }

    /**
     * Set the GEDCOM file upload status
     * @param {boolean} value - Whether a GEDCOM file has been uploaded
     */
    setGedFileUploaded(value) {
        this.gedFileUploaded = value;
    }

    /**
     * Clear the ancestor map cache
     */
    clearAncestorMap() {
        this.ancestorMap.clear();
    }

    /**
     * Check if source data is available
     * @returns {boolean} True if source data exists
     */
    get hasData() {
        return !!this.sourceData;
    }

    /**
     * Check if family towns data is available
     * @returns {boolean} True if family towns data exists
     */
    get hasFamilyTowns() {
        return Object.keys(this.familyTowns).length > 0;
    }

    /**
     * Clean up all data-related states
     */
    cleanup() {
        this.sourceData = null;
        this.individualsCache = null;
        this.familyTowns = {};
        this.ancestorMap.clear();
        this.gedFileUploaded = false;
    }
}

export default DataStore;