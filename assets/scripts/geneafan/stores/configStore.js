import { makeAutoObservable, action, reaction } from 'mobx';
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
        angle: (2 * Math.PI * 270) / 360.0,
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

    constructor() {
        makeAutoObservable(this, {
            updateFanParameter: action,
            handleSettingChange: action,
            calculateDimensions: action,
            formatName: action,
            setDimensions: action,
            updateAngle: action
        });

        reaction(
            () => ({
                fanAngle: this.config.fanAngle,
                invertTextArc: this.config.invertTextArc,
                titleMargin: this.config.fanAngle === 360 ? 0.35 : 0.25,
                coloringOption: this.config.coloringOption
            }),
            (params) => {
                this.config.angle = (2 * Math.PI * params.fanAngle) / 360.0;
                this.config.titleMargin = params.titleMargin;
                this.config.showTextOrientation = params.invertTextArc;
                this.config.computeChildrenCount = params.coloringOption === "childrencount";

                console.log('Interface parameters updated:', params);

                this.handleSettingChange();
            },
            { fireImmediately: true }
        );

        reaction(
            () => ({
                fanAngle: this.config.fanAngle,
                maxGenerations: this.config.maxGenerations,
                showMarriages: this.config.showMarriages
            }),
            (params) => {
                const dimensions = this.calculateDimensions(
                    params.fanAngle,
                    params.maxGenerations,
                    params.showMarriages
                );
                if (dimensions) {
                    this.setDimensions(dimensions);
                    console.log('Dimensions updated:', dimensions);
                }
            },
            { fireImmediately: true }
        );
    }

    updateAngle = action(() => {
        this.config.angle = (2 * Math.PI * this.config.fanAngle) / 360.0;
        console.log('Angle updated to:', this.config.angle);
    });

    setConfig = action((params) => {
        Object.assign(this.config, params);

        if (params.fanAngle !== undefined) this.updateAngle();
        if (params.coloringOption) {
            this.config.computeChildrenCount = params.coloringOption === "childrencount";
        }

        this.handleSettingChange();
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

    handleSettingChange = action(() => {
        console.log('handleSettingChange called with config:', { ...this.config });
        try {
            const fanContainer = document.getElementById("fanContainer");
            if (!fanContainer || fanContainer.offsetParent === null) {
                console.warn("Fan container is not visible");
                return false;
            }

            const dimensions = this.calculateDimensions(
                this.config.fanAngle, 
                this.config.maxGenerations, 
                this.config.showMarriages
            );

            if (!dimensions) {
                console.error("Failed to calculate dimensions");
                return false;
            }

            this.setDimensions(dimensions);

            let svgElement = document.querySelector('#fan');
            let svgPanZoomInstance = getSvgPanZoomInstance();
            if (svgElement && svgPanZoomInstance) {
                svgPanZoomInstance.destroy();
                setSvgPanZoomInstance(null);
            }

            const result = draw();
            if (!result) {
                console.error("Failed to draw fan");
                return false;
            }

            displayFan();
            initializeAscendantTimeline();

            const hasRootPerson = this.config.root;
            if (hasRootPerson) {
                const rootPersonName = this.formatName(result.rootPersonName);
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

    // Initialize TomSelect dropdown with specific options
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

    // Set value in TomSelect dropdown
    setTomSelectValue(value) {
        if (this.tomSelect) {
            this.tomSelect.setValue(value);
        } else {
            console.error("TomSelect instance is not available.");
        }
    }

    // Set the GEDCOM file name in the configuration
    setGedcomFileName = action((fileName) => {
        this.config.gedcomFileName = fileName;
    });

    // Undo the last configuration change
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

    // Redo the last undone configuration change
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

    // Reset the configuration history
    resetConfigHistory = action(() => {
        this.configHistory = [];
        this.currentConfigIndex = -1;
    });

    // Get the current configuration
    get getConfig() {
        return this.config;
    }
}

const configStore = new ConfigStore();
export default configStore;