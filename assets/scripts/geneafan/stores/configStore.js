import { makeAutoObservable } from "./mobx-config";
import TomSelect from 'tom-select';
import 'tom-select/dist/css/tom-select.css';

class ConfigStore {
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

    configHistory = [];
    currentConfigIndex = -1;
    tomSelect = null;

    constructor() {
        makeAutoObservable(this);
    }

    /**
     * Initialize TomSelect with specific options.
     */
    initializeTomSelect() {
        this.tomSelect = new TomSelect("#individual-select", {
            create: false,
            sortField: {
                field: "text",
                direction: "asc"
            },
            dropdownParent: "body",
            placeholder: __("geneafan.choose_root_placeholder"),
            allowClear: true,
            maxItems: 1,
            closeAfterSelect: true,
            dropdownContentClass: 'ts-dropdown-content dropdown-content-modifiers',
            plugins: ['dropdown_input', 'clear_button']
        });

        this.tomSelect.addOption({ value: "", text: __("geneafan.choose_root_placeholder"), disabled: true });
        this.tomSelect.addItem("", true);
    }

    /**
     * Set the value of TomSelect.
     * @param {string} value - The value to set.
     */
    setTomSelectValue(value) {
        if (this.tomSelect) {
            this.tomSelect.setValue(value);
        } else {
            console.error("TomSelect instance is not available.");
        }
    }

    /**
     * Update the configuration and manage history.
     * @param {Object} newConfig - The new configuration to set.
     */
    setConfig(newConfig) {
        const previousRoot = this.config.root;
        this.config = { ...this.config, ...newConfig };

        if (newConfig.root !== previousRoot) {
            if (this.currentConfigIndex < this.configHistory.length - 1) {
                this.configHistory = this.configHistory.slice(0, this.currentConfigIndex + 1);
            }
            this.configHistory.push({ root: newConfig.root });
            this.currentConfigIndex++;
        }
    }

    /**
     * Set the GEDCOM file name in the configuration.
     * @param {string} fileName - The GEDCOM file name.
     */
    setGedcomFileName(fileName) {
        this.config.gedcomFileName = fileName;
    }

    /**
     * Undo the last configuration change.
     */
    undo() {
        if (this.currentConfigIndex > 0) {
            this.currentConfigIndex--;
            const previousRoot = this.configHistory[this.currentConfigIndex].root;
            this.config.root = previousRoot;
            this.setTomSelectValue(previousRoot);

            const changeEvent = new Event("change", { bubbles: true });
            this.tomSelect.dropdown_content.dispatchEvent(changeEvent);
        } else {
            console.warn("No more actions to undo.");
        }
    }

    /**
     * Redo the last undone configuration change.
     */
    redo() {
        if (this.currentConfigIndex < this.configHistory.length - 1) {
            this.currentConfigIndex++;
            const nextRoot = this.configHistory[this.currentConfigIndex].root;
            this.config.root = nextRoot;
            this.setTomSelectValue(nextRoot);

            const changeEvent = new Event("change", { bubbles: true });
            this.tomSelect.dropdown_content.dispatchEvent(changeEvent);
        } else {
            console.warn("No more actions to redo.");
        }
    }

    /**
     * Reset the configuration history.
     */
    resetConfigHistory() {
        this.configHistory = [];
        this.currentConfigIndex = -1;
    }

    /**
     * Get the current configuration.
     * @returns {Object} - The current configuration.
     */
    get getConfig() {
        return this.config;
    }
}

const configStore = new ConfigStore();
export default configStore;