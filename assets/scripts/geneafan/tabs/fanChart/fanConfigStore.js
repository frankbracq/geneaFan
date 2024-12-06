import { makeAutoObservable, action, reaction, runInAction, computed, comparer } from '../../common/stores/mobx-config.js';
import 'tom-select/dist/css/tom-select.css';
import { FanChartManager } from "./fanChartManager.js";

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
    _pendingUpdates = new Set();

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
            setGedcomFileName: action,
            queueSettingChange: action,
            
            angle: computed,
            dimensions: computed,
            
            _queueTimeout: false,
            _updateQueued: false,
            _batchUpdating: false,
            _pendingUpdates: false,
            configHistory: false
        });

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
                    if (params.fanAngle !== previousParams?.fanAngle) {
                        this.config.titleMargin = params.fanAngle === 360 ? 0.35 : 0.25;
                        this._pendingUpdates.add('fanAngle');
                    }

                    if (params.coloringOption !== previousParams?.coloringOption) {
                        this.config.computeChildrenCount = params.coloringOption === "childrencount";
                        this._pendingUpdates.add('coloringOption');
                    }

                    if (params.fanAngle !== previousParams?.fanAngle ||
                        params.maxGenerations !== previousParams?.maxGenerations ||
                        params.showMarriages !== previousParams?.showMarriages) {
                        const dimensions = this.dimensions;
                        if (dimensions) {
                            this.config.fanDimensions = dimensions.fanDimensionsInMm;
                            this.config.frameDimensions = dimensions.frameDimensionsInMm;
                        }
                        this._pendingUpdates.add('dimensions');
                    }

                    if (params.invertTextArc !== previousParams?.invertTextArc) {
                        this._pendingUpdates.add('invertTextArc');
                    }
                    if (params.showMissing !== previousParams?.showMissing) {
                        this._pendingUpdates.add('showMissing');
                    }

                    if (this._pendingUpdates.size > 0) {
                        this.handleSettingChange();
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
        if (this._queueTimeout) {
            return; // Ignore multiple calls while a timeout is pending
        }
        
        console.log('queueSettingChange called');
        this._queueTimeout = setTimeout(() => {
            runInAction(() => {
                this._queueTimeout = null;
                this._pendingUpdates.clear();
                this.handleSettingChangeInternal();
            });
        }, 50);
    });

    handleSettingChange = action(() => {
        if (this._batchUpdating) return;
        this.queueSettingChange();
    });

    handleSettingChangeInternal = action(() => {
        if (!this.config.gedcomFileName) {
            console.warn("No GEDCOM file loaded. Skipping handleSettingChange.");
            return false;
        }
    
        return FanChartManager.redrawFan();
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

    calculateDimensions(fanAngle, maxGenerations, showMarriages) {
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
    }

    setGedcomFileName = action((fileName) => {
        this.config.gedcomFileName = fileName;
    });

    get getConfig() {
        return this.config;
    }
}

const configStore = new ConfigStore();
export default configStore;