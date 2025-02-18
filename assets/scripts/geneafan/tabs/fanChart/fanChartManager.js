import _ from 'lodash';
import screenfull from "screenfull";
import { draw } from "./fan.js";
import rootPersonStore from "../../common/stores/rootPersonStore.js";
import configStore from "./fanConfigStore.js";
import { SVGPanZoomManager } from "./SVGPanZoomManager.js";
import { storeEvents, EVENTS } from '../../gedcom/stores/storeEvents.js';


export class FanChartManager {
    static panZoomInstance = null;

    /**
     * Initialize the fan chart manager
     */
    static initialize() {
        console.log("Initializing fan chart...");
        this.setupEventListeners();
        
        // Ajouter l'écouteur pour le changement de racine
        storeEvents.subscribe(EVENTS.ROOT.CHANGED, async ({ root, skipDraw }) => {
            if (!skipDraw) {
                const drawResult = await this.drawFanForRoot(root, false);
                if (drawResult?.rootPersonName) {
                    rootPersonStore.setRootPersonName(
                        rootPersonStore.formatName(drawResult.rootPersonName)
                    );
                    storeEvents.emit(EVENTS.ONBOARDING.FAN_DRAWN);
                }
            }
        });
    
        return this;
    }

    /**
     * Set up event listeners for the fan chart
     */
    static setupEventListeners() {
        this.setupFullscreenListeners();
        this.setupTabListeners();
        this.setupFanParameterListeners();
    }

    /**
     * Set up listeners for fullscreen mode
     */
    static setupFullscreenListeners() {
        if (screenfull.isEnabled) {
            const fullscreenButton = document.getElementById('fullscreenButton');
            if (fullscreenButton) {
                fullscreenButton.addEventListener('click', this.handleFullscreen);
            }

            screenfull.on('change', () => this.handleFullscreenChange());
        }
    }

    static debouncedDraw = _.debounce((root) => {
        this.drawFanForRoot(root, false);
    }, 50);
    
    /**
     * Set up tab listeners for the fan chart
     */
    static setupTabListeners() {
        const tabFan = document.querySelector('[href="#tab1"]');
        if (tabFan) {
            tabFan.addEventListener("shown.bs.tab", () => {
                if (rootPersonStore.root) {
                    this.debouncedDraw(rootPersonStore.root);
                }
            });
        }
    }

    /**
     * Set up listeners for fan chart parameters
     */
    static setupFanParameterListeners() {
        const parameterMapping = {
            showMarriages: "showMarriages",
            "invert-text-arc": "invertTextArc",
            showMissing: "showMissing",
            fanAngle: "fanAngle",
            "max-generations": "maxGenerations",
            fanColor: "coloringOption"
        };

        const booleanParameters = [
            "showMarriages",
            "invert-text-arc",
            "showMissing"
        ];

        // Handle fan parameters
        document.querySelectorAll(".parameter").forEach((item) => {
            const oldHandler = item._changeHandler;
            if (oldHandler) {
                item.removeEventListener("change", oldHandler);
            }

            const handleParameterChange = (event) => {
                const input = event.target;
                let value;

                if (booleanParameters.includes(input.name)) {
                    value = input.value === "true";
                } else if (
                    input.type === "number" ||
                    ["fanAngle", "max-generations"].includes(input.name)
                ) {
                    value = parseInt(input.value, 10);
                } else {
                    value = input.value;
                }

                const storeParamName = parameterMapping[input.name];
                if (!storeParamName) {
                    console.warn("Unknown parameter:", input.name);
                    return;
                }

                console.log(
                    `Updating ${storeParamName} with value:`,
                    value,
                    `(type: ${typeof value})`
                );
                configStore.updateFanParameter(storeParamName, value);
            };

            item._changeHandler = handleParameterChange;
            item.addEventListener("change", handleParameterChange);
        });
    }

    /**
     * Centralized error handling with visual feedback
     */
    static handleError(error, context) {
        console.error(`Fan chart error ${context ? `(${context})` : ''}: `, error);

        const loadingElement = document.getElementById('loading');
        const overlayElement = document.getElementById('overlay');
        
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        if (overlayElement) {
            overlayElement.classList.add('overlay-error');
            setTimeout(() => {
                overlayElement.classList.remove('overlay-error');
            }, 3000);
        }
    }

    /**
     * Handle fullscreen mode toggle
     */
    static handleFullscreen = async () => {
        try {
            const container = document.getElementById('fanContainer');
            if (screenfull.isEnabled) {
                await screenfull.toggle(container);
            }
        } catch (error) {
            this.handleError(error, 'fullscreen');
        }
    }

    /**
     * Handle fullscreen state changes
     */
    static handleFullscreenChange() {
        try {
            if (!this.panZoomInstance) return;

            const fan = document.getElementById("fan");
            if (!fan) return;

            if (screenfull.isFullscreen) {
                this.panZoomInstance.handleResize();
                this.panZoomInstance.centerAndFit();
                fan.style.cursor = "grab";
            } else {
                this.panZoomInstance.handleResize();
                fan.style.cursor = "default";
            }
        } catch (error) {
            this.handleError(error, 'fullscreen-change');
        }
    }

    /**
     * Display fan chart with transition animation
     */
    static async displayFan() {
        try {
            const svg = document.querySelector('#fan');
            const container = document.getElementById('fanContainer');

            if (!svg || !container) {
                throw new Error('Required elements not found');
            }

            // Appearance transition
            svg.style.opacity = '0';

            // Set up pan/zoom
            this.panZoomInstance = new SVGPanZoomManager(svg, {
                minZoom: 0.1,
                maxZoom: 10,
                zoomScaleSensitivity: 0.2,
                fitPadding: 20
            });

            // Appearance animation
            requestAnimationFrame(() => {
                svg.style.transition = 'opacity 0.3s ease-in-out';
                svg.style.opacity = '1';
            });

        } catch (error) {
            this.handleError(error, 'display');
            throw error;
        }
    }

    /**
     * Draw fan chart for a given root person
     */
    static async drawFanForRoot(root, skipCleanup = false) {
        console.group('🎨 FanChartManager.drawFanForRoot');
        console.log('Root:', root);
        console.log('skipCleanup:', skipCleanup);
        
        try {
            // Prerequisites validation
            if (!configStore.config.gedcomFileName) {
                throw new Error('No GEDCOM file loaded');
            }
    
            const fanContainer = document.getElementById('fanContainer');
            if (!fanContainer || fanContainer.offsetParent === null) {
                console.log('Fan container not visible - skipping draw');
                console.groupEnd();
                return null;
            }
    
            if (!skipCleanup) {
                await this.cleanupExistingInstance();
            }
    
            console.log('Drawing fan with root:', root);
            const drawResult = draw(root);
            if (!drawResult) {
                throw new Error('Failed to draw fan');
            }
    
            await this.displayFan();
            this.updateUIAfterRedraw();
    
            // Émettre l'événement après le dessin réussi
            console.log('🎯 Fan chart drawn, emitting event');
            storeEvents.emit(EVENTS.FAN.DRAWN);
    
            console.groupEnd();
            return drawResult;
    
        } catch (error) {
            this.handleError(error, 'draw');
            console.groupEnd();
            return null;
        }
    }

    /**
     * Apply configuration changes to the fan chart
     */
    static async applyConfigChanges() {
        if (!rootPersonStore.root) return null;
        
        console.group('🔧 FanChartManager.applyConfigChanges');
        try {
            if (!configStore.config.gedcomFileName) {
                console.log('No GEDCOM file loaded');
                return null;
            }

            const fanContainer = document.getElementById('fanContainer');
            if (!fanContainer || fanContainer.offsetParent === null) {
                console.log('Fan container not visible');
                return null;
            }

            console.log('Applying config changes');
            return FanChartManager.drawFanForRoot(rootPersonStore.root);

        } catch (error) {
            FanChartManager.handleError(error, 'config-change');
            return null;
        } finally {
            console.groupEnd();
        }
    }

    /**
     * Redraw the fan chart
     */
    static async redrawFan() {
        return FanChartManager.drawFanForRoot(rootPersonStore.root);
    }

    /**
     * Clean up existing fan chart instance
     */
    static async cleanupExistingInstance() {
        try {
            const svgElement = document.querySelector('#fan');

            if (this.panZoomInstance) {
                this.panZoomInstance.destroy();
                this.panZoomInstance = null;
            }

            if (svgElement) {
                svgElement.innerHTML = '';
            }
        } catch (error) {
            this.handleError(error, 'cleanup');
            throw error;
        }
    }

    /**
     * Update UI elements after redrawing the fan
     */
    static updateUIAfterRedraw() {
        const loadingElement = document.getElementById("loading");
        const overlayElement = document.getElementById("overlay");

        if (loadingElement) {
            loadingElement.style.display = "none";
        }

        if (overlayElement) {
            overlayElement.classList.add("overlay-hidden");
        }
    }

    /**
     * Complete reset of the fan chart
     */
    static reset() {
        try {
            this.cleanupExistingInstance();
            
            const fanSvg = document.getElementById("fan");
            if (fanSvg) {
                fanSvg.innerHTML = "";
            }

            this.setupEventListeners();
        } catch (error) {
            this.handleError(error, 'reset');
        }
    }
}