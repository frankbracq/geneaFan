import { makeAutoObservable, action, reaction, runInAction, computed, comparer } from '../common/stores/mobx-config.js';
import 'tom-select/dist/css/tom-select.css';
import { draw } from "./fan.js";
import { displayFan } from "../ui.js";
import { getSvgPanZoomInstance, setSvgPanZoomInstance } from "../common/stores/state.js";
import rootPersonStore from '../common/stores/rootPersonStore.js'; 

class ConfigStore {
    config = {
        fanAngle: 270,
        maxGenerations: 8,
        showMarriages: true,
        invertTextArc: true,
        coloringOption: "none",
        showMissing: true,
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
                showMissing: this.config.showMissing
            }),
            (params, previousParams) => {
                if (this._batchUpdating) return;
        
                runInAction(() => {
                    let hasChanges = false;
        
                    // Vérification des changements de paramètres
                    if (params.fanAngle !== previousParams?.fanAngle ||
                        params.maxGenerations !== previousParams?.maxGenerations ||
                        params.showMarriages !== previousParams?.showMarriages ||
                        params.invertTextArc !== previousParams?.invertTextArc ||
                        params.coloringOption !== previousParams?.coloringOption ||
                        params.showMissing !== previousParams?.showMissing) {
                        hasChanges = true;
                    }
        
                    // Mises à jour spécifiques
                    if (params.fanAngle !== previousParams?.fanAngle) {
                        this.config.titleMargin = params.fanAngle === 360 ? 0.35 : 0.25;
                    }
        
                    if (params.coloringOption !== previousParams?.coloringOption) {
                        this.config.computeChildrenCount = params.coloringOption === "childrencount";
                    }
        
                    // Mise à jour des dimensions si nécessaire
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
                name: 'ConfigStore-FanParametersReaction'
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
        if (!this.config.gedcomFileName) {
            console.warn("No GEDCOM file loaded. Skipping handleSettingChange.");
            return;
        }

        try {
            const fanContainer = document.getElementById("fanContainer");
            if (!fanContainer || fanContainer.offsetParent === null) {
                console.warn("Fan container is not visible");
                return false;
            }

            console.log('Starting fan drawing process');
            let svgElement = document.querySelector('#fan');
            let svgPanZoomInstance = getSvgPanZoomInstance();
            if (svgElement && svgPanZoomInstance) {
                svgPanZoomInstance.destroy();
                setSvgPanZoomInstance(null);
            }

            // Passer le root actuel à draw()
            const currentRoot = rootPersonStore.root;
            console.log('Drawing fan with current root:', currentRoot);
            const drawResult = draw(currentRoot);
            
            if (!drawResult) {
                console.error("Failed to draw fan");
                return false;
            }

            console.log('Fan drawn successfully, displaying');
            displayFan();

            document.getElementById("loading").style.display = "none";
            document.getElementById("overlay").classList.add("overlay-hidden");

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
        runInAction(() => {
            Object.assign(this.config, params);

            if (params.fanAngle !== undefined) {
                console.log('Angle updated to:', this.angle);
            }
        });

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

    setGedcomFileName = action((fileName) => {
        this.config.gedcomFileName = fileName;
    });

    get getConfig() {
        return this.config;
    }
}

const configStore = new ConfigStore();
export default configStore;