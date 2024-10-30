// stores/core/FanConfigStore.js
import { makeAutoObservable } from 'mobx';

/**
 * Manages fan chart configuration and history
 */
class FanConfigStore {
    // Default configuration for the fan chart
    config = {
        root: null,
        rootPersonName: "",
        maxGenerations: 8,
        angle: Math.PI,
        dates: {
            showYearsOnly: true,
            showInvalidDates: false,
        },
        places: {
            showPlaces: true,
            showReducedPlaces: true,
        },
        showMarriages: true,
        showMissing: true,
        givenThenFamilyName: true,
        showFirstNameOnly: false,
        substituteEvents: false,
        invertTextArc: false,
        isTimeVisualisationEnabled: false,
        title: "",
        titleSize: 1.0,
        titleMargin: 0.25,
        weights: {
            generations: [1.0, 1.0, 1.7, 1.4],
            strokes: 0.02,
        },
        contemporary: {
            showEvents: true,
            showNames: true,
            trulyAll: false,
            generations: 1,
        },
        fanDimensions: undefined,
        frameDimensions: undefined,
        computeChildrenCount: false,
        filename: "",
        coloringOption: "childrencount",
        gedcomFileName: "",
    };

    // Configuration history for undo/redo functionality
    configHistory = [];
    currentConfigIndex = -1;

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
    }

    /**
     * Update the fan configuration
     * @param {Object} newConfig - The new configuration to merge with current
     */
    setConfig(newConfig) {
        // Only add to history if root person changes
        if (newConfig.root !== this.config.root) {
            this.addToHistory(newConfig);
        }
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Add current configuration to history
     * @param {Object} config - The configuration to add to history
     */
    addToHistory(config) {
        // If we're not at the end of the history, truncate it
        if (this.currentConfigIndex < this.configHistory.length - 1) {
            this.configHistory = this.configHistory.slice(0, this.currentConfigIndex + 1);
        }
        this.configHistory.push({ root: config.root });
        this.currentConfigIndex++;
    }

    /**
     * Undo the last configuration change
     * @returns {boolean} True if undo was successful
     */
    undo() {
        if (this.currentConfigIndex > 0) {
            this.currentConfigIndex--;
            const prevConfig = this.configHistory[this.currentConfigIndex];
            this.setConfig({ ...this.config, root: prevConfig.root });
            return true;
        }
        return false;
    }

    /**
     * Redo the last undone configuration change
     * @returns {boolean} True if redo was successful
     */
    redo() {
        if (this.currentConfigIndex < this.configHistory.length - 1) {
            this.currentConfigIndex++;
            const nextConfig = this.configHistory[this.currentConfigIndex];
            this.setConfig({ ...this.config, root: nextConfig.root });
            return true;
        }
        return false;
    }

    /**
     * Set the GEDCOM filename
     * @param {string} fileName - The name of the GEDCOM file
     */
    setGedcomFileName(fileName) {
        this.config.gedcomFileName = fileName;
    }

    /**
     * Reset the configuration history
     */
    resetConfigHistory() {
        this.configHistory = [];
        this.currentConfigIndex = -1;
    }

    /**
     * Get the current configuration
     * @returns {Object} The current fan chart configuration
     */
    get getConfig() {
        return this.config;
    }
}

export default FanConfigStore;