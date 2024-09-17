import { makeAutoObservable } from "mobx";
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

    setTomSelectValue(value) {
        if (this.tomSelect) {
            this.tomSelect.setValue(value);
        } else {
            console.error("tomSelect instance is not available.");
        }
    }

    setConfig(newConfig) {
        const previousRoot = this.config.root;
        this.config = { ...this.config, ...newConfig };

        // Enregistrer le changement de root dans l'historique seulement si config.root a changé
        if (newConfig.root !== previousRoot) {
            if (this.currentConfigIndex < this.configHistory.length - 1) {
                this.configHistory = this.configHistory.slice(0, this.currentConfigIndex + 1);
            }
            this.configHistory.push({ root: newConfig.root }); // Stocker seulement root
            this.currentConfigIndex++;

            // console.log(`Config set. Current index: ${this.currentConfigIndex}, Root: ${this.config.root}`);
            // console.log('Current configHistory:', this.configHistory);
        }
    }

    setGedcomFileName(fileName) {
        this.config.gedcomFileName = fileName;
    }

    undo() {
        if (this.currentConfigIndex > 0) {
            this.currentConfigIndex--;
            const previousRoot = this.configHistory[this.currentConfigIndex].root;
            this.config.root = previousRoot;

            // console.log(`Undo action performed. Current index: ${this.currentConfigIndex}, Current root: ${this.config.root}`);

            // Utilisation de setTomSelectValue pour mettre à jour tomSelect
            this.setTomSelectValue(previousRoot);

            // Déclenchement de l'événement `change` pour simuler une interaction utilisateur
            const changeEvent = new Event("change", { bubbles: true });
            this.tomSelect.dropdown_content.dispatchEvent(changeEvent);
        } else {
            console.warn("No more actions to undo.");
        }
    }

    redo() {
        if (this.currentConfigIndex < this.configHistory.length - 1) {
            this.currentConfigIndex++;
            const nextRoot = this.configHistory[this.currentConfigIndex].root;
            this.config.root = nextRoot;

            // console.log(`Redo action performed. Current index: ${this.currentConfigIndex}, Current root: ${this.config.root}`);

            // Utilisation de setTomSelectValue pour mettre à jour tomSelect
            this.setTomSelectValue(nextRoot);

            // Déclenchement de l'événement `change` pour simuler une interaction utilisateur
            const changeEvent = new Event("change", { bubbles: true });
            this.tomSelect.dropdown_content.dispatchEvent(changeEvent);
        } else {
            console.warn("No more actions to redo.");
        }
    }

    resetConfigHistory() {
        this.configHistory = [];
        this.currentConfigIndex = -1;
        // console.log("Config history has been reset.");
    }

    get getConfig() {
        return this.config;
    }
}

const configStore = new ConfigStore();
export default configStore;
