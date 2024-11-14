import { makeAutoObservable, action, reaction, runInAction, computed, comparer } from './mobx-config.js';
import svgPanZoomStore from './svgPanZoomStore.js';
import TomSelect from 'tom-select';
import 'tom-select/dist/css/tom-select.css';
import { draw } from "../fan.js";
import { displayFan } from "../ui.js";
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
    _isInitializing = false;
    _updateQueued = false;
    _reactionDisposers = [];
    _isReady = false;

    constructor() {
        const initialDimensions = this.calculateDimensions(
            this.config.fanAngle,
            this.config.maxGenerations,
            this.config.showMarriages
        );

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
            setupReactions: action,
            disposeReactions: action,

            angle: computed,
            dimensions: computed,
            isReady: computed,

            _queueTimeout: false,
            _batchUpdating: false,
            _isInitializing: false,
            _updateQueued: false,
            _reactionDisposers: false,
            _isReady: false,
            tomSelect: false,
            configHistory: false
        });

        this.setupReactions();
    }

    setupReactions() {
        this.disposeReactions();

        const mainReaction = reaction(
            () => ({
                maxGenerations: this.config.maxGenerations,
                showMarriages: this.config.showMarriages,
                invertTextArc: this.config.invertTextArc,
                coloringOption: this.config.coloringOption,
                root: this.config.root,
                showMissing: this.config.showMissing
            }),
            (params, previousParams) => {
                if (this._batchUpdating || this._isInitializing) return;

                let hasChanges = false;
                runInAction(() => {
                    if (params.maxGenerations !== previousParams?.maxGenerations ||
                        params.showMarriages !== previousParams?.showMarriages ||
                        params.invertTextArc !== previousParams?.invertTextArc ||
                        params.coloringOption !== previousParams?.coloringOption ||
                        params.showMissing !== previousParams?.showMissing ||
                        params.root !== previousParams?.root) {
                        hasChanges = true;
                    }

                    if (params.coloringOption !== previousParams?.coloringOption) {
                        this.config.computeChildrenCount = params.coloringOption === "childrencount";
                    }

                    if (params.maxGenerations !== previousParams?.maxGenerations ||
                        params.showMarriages !== previousParams?.showMarriages) {
                        const dimensions = this.dimensions;
                        if (dimensions) {
                            this.setDimensions(dimensions);
                        }
                    }
                });

                if (hasChanges && !this._updateQueued) {
                    this.queueSettingChange();
                }
            },
            {
                equals: comparer.structural,
                name: 'ConfigStore-MainReaction'
            }
        );

        const angleReaction = reaction(
            () => this.config.fanAngle,
            (newAngle, prevAngle) => {
                if (this._isInitializing || this._batchUpdating) return;
                
                if (newAngle !== prevAngle) {
                    runInAction(() => {
                        this.config.titleMargin = newAngle === 360 ? 0.35 : 0.25;
                        const dimensions = this.dimensions;
                        if (dimensions) {
                            this.setDimensions(dimensions);
                        }
                    });

                    if (!this._updateQueued) {
                        this.queueSettingChange();
                    }
                }
            }
        );

        this._reactionDisposers = [mainReaction, angleReaction];
    }

    disposeReactions() {
        this._reactionDisposers.forEach(dispose => dispose());
        this._reactionDisposers = [];
    }

    get isReady() {
        return this._isReady;
    }

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

    queueSettingChange = action(() => {
        if (this._isInitializing || this._updateQueued) return;

        this._updateQueued = true;
        this._queueTimeout = setTimeout(() => {
            this._updateQueued = false;
            this._queueTimeout = null;
            this.handleSettingChangeInternal();
        }, 100);
    });

    batchUpdate = action((updates) => {
        if (this._batchUpdating) {
            return;
        }

        this._batchUpdating = true;
        
        try {
            runInAction(() => {
                updates();
            });
        } finally {
            this._batchUpdating = false;
        }
    });

    setConfig = action((params) => {
        const previousRoot = this.config.root;
        const isInitialRoot = params.root && !previousRoot;

        if (isInitialRoot) {
            this._isInitializing = true;
            this.disposeReactions();
        }

        runInAction(() => {
            if (isInitialRoot) {
                // Pour l'initialisation, tout faire d'un coup
                Object.assign(this.config, params);
                this.setTomSelectValue(params.root, true);
                this.handleSettingChangeInternal();
                this._isInitializing = false;
                this.setupReactions();
            } else if (!this._batchUpdating && !this._isInitializing) {
                // Mise à jour normale
                Object.assign(this.config, params);
                if (!this._updateQueued) {
                    this.queueSettingChange();
                }
            } else {
                // Mise à jour en batch
                Object.assign(this.config, params);
            }
        });
    });

    handleSettingChange = action(() => {
        if (this._batchUpdating || this._isInitializing || this._updateQueued) return;
        this.queueSettingChange();
    });

    handleSettingChangeInternal = action(() => {
        console.log('handleSettingChangeInternal called, root:', this.config.root);
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
    
            let svgElement = document.querySelector('#fan');
            if (svgElement && svgPanZoomStore.isInitialized) {
                svgPanZoomStore.destroy();
            }
    
            const drawResult = draw();
            if (!drawResult) {
                console.error("Failed to draw fan");
                return false;
            }
    
            displayFan();
    
            if (!this._isInitializing && this.config.root && drawResult.rootPersonName) {
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
    
            return true;
        } catch (error) {
            console.error("Error in handleSettingChange:", error);
            return false;
        }
    });

    updateFanParameter = action((paramName, value) => {
        if (this._isInitializing || this._batchUpdating) return;
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
        if (dimensions?.fanDimensionsInMm && dimensions?.frameDimensionsInMm) {
            this.config.fanDimensions = dimensions.fanDimensionsInMm;
            this.config.frameDimensions = dimensions.frameDimensionsInMm;
        }
    });

    formatName = action((rootPersonName) => {
        if (!rootPersonName) return "";
        const firstName = rootPersonName?.name?.split(" ")[0] || "";
        const surname = rootPersonName?.surname || "";
        return `${firstName} ${surname}`.trim();
    });

    initializeTomSelect() {
        try {
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
            
            this._isReady = true;
            document.dispatchEvent(new CustomEvent('configStoreReady'));
        } catch (error) {
            console.error("Error initializing TomSelect:", error);
            this._isReady = false;
        }
    }

    setTomSelectValue = action((value, suppressEvent = false) => {
        if (this.tomSelect) {
            if (suppressEvent) {
                this.tomSelect.addItem(value, true);
            } else {
                this.tomSelect.setValue(value);
            }
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