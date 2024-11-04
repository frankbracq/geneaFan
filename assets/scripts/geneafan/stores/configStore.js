import { makeAutoObservable, action } from './mobx-config';
import TomSelect from 'tom-select';
import 'tom-select/dist/css/tom-select.css';

class ConfigStore {
    config = {
        // Paramètres interactifs de l'éventail (UI)
        fanAngle: 270,              // 270° ou 360°
        maxGenerations: 8,          // 7 ou 8 générations
        showMarriages: true,        // affichage des mariages (oui/non)
        invertTextArc: true,        // orientation dynamique du texte (oui/non)
        coloringOption: "none",     // none/departement/individual
        showMissing: true,          // affichage des cases vides (oui/non)

        // Paramètres statiques nécessaires au rendu
        root: null,
        rootPersonName: "",
        angle: Math.PI,             // calculé à partir de fanAngle
        dates: {
            showYearsOnly: true,
            showInvalidDates: false,
        },
        places: {
            showPlaces: true,
            showReducedPlaces: true,
        },
        givenThenFamilyName: true,
        showFirstNameOnly: false,
        substituteEvents: false,
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
        gedcomFileName: "",
    };

    fanParameters = {
        fanAngle: 270,
        maxGenerations: 8,
        showMarriages: true,
        invertTextArc: true,
        coloringOption: "none",
        showMissing: true
    };

    configHistory = [];
    currentConfigIndex = -1;
    tomSelect = null;

    constructor() {
        makeAutoObservable(this, {
            setFanParameters: action,
            updateFanParameter: action,
        });
    }

    // Action pour mettre à jour uniquement les paramètres interactifs de l'éventail
    setFanParameters = (({
        fanAngle,
        maxGenerations,
        showMarriages,
        invertTextArc,
        coloringOption,
        showMissing  // Ajout du paramètre manquant
    }) => {
        // Mise à jour des paramètres UI de l'éventail
        this.config.fanAngle = fanAngle;
        this.config.maxGenerations = maxGenerations;
        this.config.showMarriages = showMarriages;
        this.config.invertTextArc = invertTextArc;
        this.config.coloringOption = coloringOption;
        this.config.showMissing = showMissing;  // Mise à jour de showMissing

        // Calcul des valeurs dérivées
        this.config.angle = (2 * Math.PI * fanAngle) / 360.0;
        this.config.computeChildrenCount = coloringOption === "childrencount";
    });

    // Nouvelle méthode pour mettre à jour un seul paramètre
    updateFanParameter(paramName, value) {
        this.fanParameters[paramName] = value;
        // Mettre également à jour dans la config principale
        this.config[paramName] = value;
    }

    // Méthode pour mettre à jour la configuration de mise en page
    setLayoutConfig = action(({ fanAngle, maxGenerations, showMarriages, showMissing }) => {
        this.config.fanAngle = fanAngle;
        this.config.maxGenerations = maxGenerations;
        this.config.showMarriages = showMarriages;
        this.config.showMissing = showMissing;
        this.config.angle = (2 * Math.PI * fanAngle) / 360.0;
    });

    // Méthode pour mettre à jour la configuration d'affichage
    setDisplayConfig = action(({
        showPlaces,
        showReducedPlaces,
        showYearsOnly,
        givenThenFamilyName,
        showFirstNameOnly,
        substituteEvents,
        invertTextArc,
        isTimeVisualisationEnabled
    }) => {
        this.config.places.showPlaces = showPlaces;
        this.config.places.showReducedPlaces = showReducedPlaces;
        this.config.dates.showYearsOnly = showYearsOnly;
        this.config.givenThenFamilyName = givenThenFamilyName;
        this.config.showFirstNameOnly = showFirstNameOnly;
        this.config.substituteEvents = substituteEvents;
        this.config.invertTextArc = invertTextArc;
        this.config.isTimeVisualisationEnabled = isTimeVisualisationEnabled;
    });

    // Méthode pour mettre à jour la configuration du titre
    setTitleConfig = action(({ title, titleSize, titleMargin }) => {
        this.config.title = title;
        this.config.titleSize = titleSize;
        this.config.titleMargin = titleMargin;
    });

    // Méthode pour mettre à jour la coloration
    setColoring = action((coloring) => {
        this.config.coloringOption = coloring;
        this.config.computeChildrenCount = coloring === "childrencount";
    });

    // Méthode pour mettre à jour les dimensions
    setDimensions = action((dimensions) => {
        if (dimensions) {
            this.config.fanDimensions = dimensions.fanDimensionsInMm;
            this.config.frameDimensions = dimensions.frameDimensionsInMm;
        }
    });

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