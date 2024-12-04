import { makeAutoObservable, action, computed, comparer } from '../../common/stores/mobx-config.js';
import 'tom-select/dist/css/tom-select.css';

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
            updateConfig: action,
            setConfig: action,
            setGedcomFileName: action,
            angle: computed,
            dimensions: computed,
            _batchUpdating: false
        });
    }

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

    validateConfig(params) {
        // Add validation rules here
        const validations = {
            fanAngle: (value) => value >= 0 && value <= 360,
            maxGenerations: (value) => value >= 1 && value <= 8,
            titleMargin: (value) => value >= 0 && value <= 1,
        };

        for (const [key, validator] of Object.entries(validations)) {
            if (params[key] !== undefined && !validator(params[key])) {
                throw new Error(`Invalid value for ${key}: ${params[key]}`);
            }
        }

        return true;
    }

    batchUpdate = action((updates) => {
        if (this._batchUpdating) return;
        
        this._batchUpdating = true;
        try {
            updates();
            FanChartManager.queueRedraw();
        } finally {
            this._batchUpdating = false;
        }
    });

    updateConfig = action((params) => {
        if (this.validateConfig(params)) {
            if (params.fanAngle !== undefined) {
                params.titleMargin = params.fanAngle === 360 ? 0.35 : 0.25;
            }
            
            if (params.coloringOption !== undefined) {
                params.computeChildrenCount = params.coloringOption === "childrencount";
            }

            Object.assign(this.config, params);

            if (!this._batchUpdating && (
                params.fanAngle !== undefined ||
                params.maxGenerations !== undefined ||
                params.showMarriages !== undefined
            )) {
                const dimensions = this.dimensions;
                if (dimensions) {
                    this.config.fanDimensions = dimensions.fanDimensionsInMm;
                    this.config.frameDimensions = dimensions.frameDimensionsInMm;
                }
            }

            if (!this._batchUpdating) {
                FanChartManager.queueRedraw();
            }
            return true;
        }
        return false;
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