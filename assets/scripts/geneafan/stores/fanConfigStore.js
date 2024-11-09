import { makeAutoObservable, action, reaction, runInAction, computed, comparer } from './mobx-config.js';
import svgPanZoomStore from './svgPanZoomStore';
import TomSelect from 'tom-select';
import 'tom-select/dist/css/tom-select.css';
import { draw } from "../fan.js";
import { displayFan } from "../ui.js";
import { getSvgPanZoomInstance, setSvgPanZoomInstance } from "./state.js";
import { initializeAscendantTimeline } from '../timeline/ascendantTimeline.js';
import { updateFilename } from "../downloads.js";

class ConfigStore {
    config = {
        fanAngle: 270,
        maxGenerations: 8,
        showMarriages: true,
        invertTextArc: true,
        coloringOption: "none",
        showMissing: true,
        root: null,
        rootPersonName: "",
        dates: {
            showYearsOnly: true,
            showInvalidDates: false,
        },
        places: {
            showPlaces: true,
            showReducedPlaces: true,
        },
        givenThenFamilyName: true,
        showFirstNameOnly: true,
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

    configHistory = [];
    currentConfigIndex = -1;
    tomSelect = null;
    _batchUpdating = false;
    _queueTimeout = null;
    _updateQueued = false;

    // Computed values
    get angle() {
        return (2 * Math.PI * this.config.fanAngle) / 360.0;
    }

    get dimensions() {
        return this.calculateDimensions(
            this.config.fanAngle,
            this.config.maxGenerations,
            this.config.showMarriages
        );
    }

    constructor() {
        // Calculer les dimensions initiales avec les valeurs par défaut
        const initialDimensions = this.calculateDimensions(
            this.config.fanAngle,
            this.config.maxGenerations,
            this.config.showMarriages
        );

        // Définir les dimensions initiales
        if (initialDimensions) {
            this.config.fanDimensions = initialDimensions.fanDimensionsInMm;
            this.config.frameDimensions = initialDimensions.frameDimensionsInMm;
        }

        makeAutoObservable(this, {
            batchUpdate: action,
            updateFanParameter: action,
            handleSettingChange: action,
            handleSettingChangeInternal: action,
            setConfig: action,
            setDimensions: action,
            setGedcomFileName: action,
            setTomSelectValue: action,
            undo: action,
            redo: action,
            resetConfigHistory: action,
            queueSettingChange: action,
            
            // Computed values
            angle: computed,
            dimensions: computed,
            
            // Non-observables
            _queueTimeout: false,
            _updateQueued: false,
            _batchUpdating: false,
            tomSelect: false,
            configHistory: false
        });

        // Une seule reaction pour tous les changements
        reaction(
            () => ({
                fanAngle: this.config.fanAngle,
                maxGenerations: this.config.maxGenerations,
                showMarriages: this.config.showMarriages,
                invertTextArc: this.config.invertTextArc,
                coloringOption: this.config.coloringOption,
                root: this.config.root,
                showMissing: this.config.showMissing  // Ajouté
            }),
            (params, previousParams) => {
                if (this._batchUpdating) return;
        
                runInAction(() => {
                    let hasChanges = false;
        
                    // Si n'importe quel paramètre a changé, on doit redessiner
                    if (params.fanAngle !== previousParams?.fanAngle ||
                        params.maxGenerations !== previousParams?.maxGenerations ||
                        params.showMarriages !== previousParams?.showMarriages ||
                        params.invertTextArc !== previousParams?.invertTextArc ||
                        params.coloringOption !== previousParams?.coloringOption ||
                        params.showMissing !== previousParams?.showMissing ||
                        params.root !== previousParams?.root) {
                        hasChanges = true;
                    }
        
                    // Mises à jour spécifiques si nécessaire
                    if (params.fanAngle !== previousParams?.fanAngle) {
                        this.config.titleMargin = params.fanAngle === 360 ? 0.35 : 0.25;
                    }
        
                    if (params.coloringOption !== previousParams?.coloringOption) {
                        this.config.computeChildrenCount = params.coloringOption === "childrencount";
                    }
        
                    // Vérification des changements de dimensions
                    if (params.fanAngle !== previousParams?.fanAngle ||
                        params.maxGenerations !== previousParams?.maxGenerations ||
                        params.showMarriages !== previousParams?.showMarriages) {
                        const dimensions = this.dimensions;
                        if (dimensions) {
                            this.setDimensions(dimensions);
                        }
                    }
        
                    if (hasChanges) {
                        this.queueSettingChange();
                    }
                });
            },
            {
                equals: comparer.structural,
                name: 'ConfigStore-MainReaction'
            }
        );
    }

    queueSettingChange = action(() => {
        console.log('queueSettingChange called');
        
        // Annuler le timeout existant pour le remplacer par un nouveau
        if (this._queueTimeout) {
            clearTimeout(this._queueTimeout);
        }
        
        // Toujours programmer une nouvelle mise à jour
        this._queueTimeout = setTimeout(() => {
            if (this._queueTimeout) {  // Vérifier que le timeout n'a pas été annulé
                this._queueTimeout = null;
                this.handleSettingChangeInternal();
            }
        }, 50);
    });

    handleSettingChange = action(() => {
        if (this._batchUpdating) return;
        this.queueSettingChange();
    });

    handleSettingChangeInternal = action(() => {
        console.log('handleSettingChangeInternal called, root:', this.config.root);
        if (!this.config.gedcomFileName) {
            console.warn("No GEDCOM file loaded. Skipping handleSettingChange.");
            return;
        }

        console.log('Processing handleSettingChange with config:', { ...this.config });

        try {
            const fanContainer = document.getElementById("fanContainer");
            if (!fanContainer || fanContainer.offsetParent === null) {
                console.warn("Fan container is not visible");
                return false;
            }

            console.log('Starting fan drawing process');
            let svgElement = document.querySelector('#fan');
    if (svgElement && svgPanZoomStore.isInitialized) {
        svgPanZoomStore.destroy();
    }

            const drawResult = draw();
            if (!drawResult) {
                console.error("Failed to draw fan");
                return false;
            }

            console.log('Fan drawn successfully, displaying');
            displayFan();

            // Gestion sécurisée de la timeline
            try {
                if (this.config.root && drawResult.rootPersonName) {
                    initializeAscendantTimeline().catch(error => {
                        console.warn('Timeline initialization failed:', error);
                    });
                }
            } catch (timelineError) {
                console.warn('Timeline error caught:', timelineError);
            }

            if (this.config.root && drawResult.rootPersonName) {
                const rootPersonName = this.formatName(drawResult.rootPersonName);
                const filename = (__("Éventail généalogique de ") + 
                    rootPersonName + 
                    " créé sur genealog.ie"
                ).replace(/[|&;$%@"<>()+,]/g, "");

                this.config.filename = filename;
                updateFilename(filename);
            }

            document.getElementById('initial-group').style.display = 'none';
            document.getElementById("loading").style.display = "none";
            document.getElementById("overlay").classList.add("overlay-hidden");

            console.log('Fan display completed');
            return true;
        } catch (error) {
            console.error("Error in handleSettingChange:", error);
            return false;
        }
    });

    batchUpdate = action((updates) => {
        if (this._batchUpdating) return;
        
        this._batchUpdating = true;
        try {
            updates();
            this.queueSettingChange();
        } finally {
            this._batchUpdating = false;
        }
    });

    setConfig = action((params) => {
        const previousRoot = this.config.root;
        
        runInAction(() => {
            Object.assign(this.config, params);

            if (params.fanAngle !== undefined) {
                console.log('Angle updated to:', this.angle);
            }
        });

        // Gestion spéciale pour le root initial
        if (params.root && !previousRoot) {
            console.log('Initial root set, forcing fan drawing');
            this.handleSettingChangeInternal();
            return;
        }

        // Pour tous les autres changements, mettre en file d'attente
        if (!this._batchUpdating) {
            this.queueSettingChange();
        }
    });

    updateFanParameter = action((paramName, value) => {
        this.setConfig({ [paramName]: value });
    });

    calculateDimensions = action((fanAngle, maxGenerations, showMarriages) => {
        const dimensionsMap = {
            270: {
                8: { fanDimensionsInMm: "301x257", frameDimensionsInMm: "331x287" },
                7: {
                    true: { fanDimensionsInMm: "301x257", frameDimensionsInMm: "331x287" },
                    false: { fanDimensionsInMm: "245x245", frameDimensionsInMm: "260x260" },
                },
            },
            360: {
                8: { fanDimensionsInMm: "297x297", frameDimensionsInMm: "331x331" },
                7: {
                    true: { fanDimensionsInMm: "297x297", frameDimensionsInMm: "331x331" },
                    false: { fanDimensionsInMm: "245x245", frameDimensionsInMm: "260x260" },
                },
            },
        };

        const defaultDimensions = { fanDimensionsInMm: undefined, frameDimensionsInMm: undefined };
        const angleDimensions = dimensionsMap[fanAngle];
        if (!angleDimensions) return defaultDimensions;

        const generationDimensions = angleDimensions[maxGenerations];
        if (!generationDimensions) return defaultDimensions;

        return generationDimensions[showMarriages] || generationDimensions;
    });

    setDimensions = action((dimensions) => {
        if (dimensions && dimensions.fanDimensionsInMm && dimensions.frameDimensionsInMm) {
            this.config.fanDimensions = dimensions.fanDimensionsInMm;
            this.config.frameDimensions = dimensions.frameDimensionsInMm;
        }
    });

    formatName = action((rootPersonName) => {
        if (!rootPersonName) return "";
        let firstName = rootPersonName?.name?.split(" ")[0] || "";
        let surname = rootPersonName?.surname || "";
        return `${firstName} ${surname}`.trim();
    });

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

    setTomSelectValue = action((value) => {
        if (this.tomSelect) {
            this.tomSelect.setValue(value);
        } else {
            console.error("TomSelect instance is not available.");
        }
    });

    setGedcomFileName = action((fileName) => {
        this.config.gedcomFileName = fileName;
    });

    undo = action(() => {
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
    });

    redo = action(() => {
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
    });

    resetConfigHistory = action(() => {
        this.configHistory = [];
        this.currentConfigIndex = -1;
    });

    get getConfig() {
        return this.config;
    }
}

const configStore = new ConfigStore();
export default configStore;