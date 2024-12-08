import { draw } from "./fan.js";
import { 
    setSvgPanZoomInstance, 
    getSvgPanZoomInstance,
    destroySvgPanZoom 
} from "../../common/stores/state.js";
import rootPersonStore from "../../common/stores/rootPersonStore.js";
import configStore from "./fanConfigStore.js";
import screenfull from "screenfull";
import { SVGPanZoomManager } from "./SVGPanZoomManager.js";

export class FanChartManager {
    // Initialisation du gestionnaire de fan chart
    static initialize() {
        console.log("Initializing fan chart...");
        this.setupEventListeners();
        return this;
    }

    // Configuration des écouteurs d'événements pour le fan chart
    static setupEventListeners() {
        this.setupFullscreenListeners();
        this.setupTabListeners();
        this.setupFanParameterListeners();
    }

    // Gestion des écouteurs pour le mode plein écran
    static setupFullscreenListeners() {
        if (screenfull.isEnabled) {
            const fullscreenButton = document.getElementById('fullscreenButton');
            if (fullscreenButton) {
                fullscreenButton.addEventListener('click', this.handleFullscreen);
            }

            screenfull.on('change', () => this.handleFullscreenChange());
        }
    }

    // Gestion des écouteurs pour les onglets
    static setupTabListeners() {
        const tabFan = document.querySelector('[href="#tab1"]');
        if (tabFan) {
            tabFan.addEventListener("shown.bs.tab", () => {
                configStore.handleSettingChange();
            });
        }
    }

    // Gestion des écouteurs pour les paramètres du fan chart
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

        // Gestion des paramètres du fan
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

    // Gestion centralisée des erreurs avec feedback visuel
    static handleError(error, context) {
        console.error(`Fan chart error ${context ? `(${context})` : ''}: `, error);

        // Mise à jour de l'UI pour indiquer l'erreur
        const loadingElement = document.getElementById('loading');
        const overlayElement = document.getElementById('overlay');
        
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        if (overlayElement) {
            overlayElement.classList.add('overlay-error');
            // Retirer l'état d'erreur après 3 secondes
            setTimeout(() => {
                overlayElement.classList.remove('overlay-error');
            }, 3000);
        }
    }

    // Gestion du mode plein écran
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

    // Gestion des changements d'état du mode plein écran
    static handleFullscreenChange() {
        try {
            const panZoomInstance = getSvgPanZoomInstance();
            const fan = document.getElementById("fan");
            
            if (!panZoomInstance || !fan) return;

            if (screenfull.isFullscreen) {
                // Configuration mode plein écran
                panZoomInstance.handleResize();
                panZoomInstance.centerAndFit();
                fan.style.cursor = "grab";
            } else {
                // Retour mode normal
                panZoomInstance.handleResize();
                fan.style.cursor = "default";
            }
        } catch (error) {
            this.handleError(error, 'fullscreen-change');
        }
    }

    // Affichage du fan chart avec animation de transition
    static async displayFan() {
        try {
            const svg = document.querySelector('#fan');
            const container = document.getElementById('fanContainer');

            if (!svg || !container) {
                throw new Error('Required elements not found');
            }

            // Transition d'apparition
            svg.style.opacity = '0';

            // Configuration du pan/zoom
            const instance = new SVGPanZoomManager(svg, {
                minZoom: 0.1,
                maxZoom: 10,
                zoomScaleSensitivity: 0.2,
                fitPadding: 20
            });
            setSvgPanZoomInstance(instance);

            // Animation d'apparition
            requestAnimationFrame(() => {
                svg.style.transition = 'opacity 0.3s ease-in-out';
                svg.style.opacity = '1';
            });

        } catch (error) {
            this.handleError(error, 'display');
            throw error;
        }
    }

    static async drawFanForRoot(root, skipCleanup = false) {
        console.group('🎨 FanChartManager.drawFanForRoot');
        console.log('Root:', root);
        console.log('skipCleanup:', skipCleanup);
        
        try {
            // Validation des prérequis
            if (!configStore.config.gedcomFileName) {
                throw new Error('No GEDCOM file loaded');
            }

            const fanContainer = document.getElementById('fanContainer');
            if (!fanContainer || fanContainer.offsetParent === null) {
                throw new Error('Fan container not visible');
            }

            // Nettoyage de l'instance existante si nécessaire
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

            console.groupEnd();
            return drawResult;

        } catch (error) {
            this.handleError(error, 'draw');
            console.groupEnd();
            return null;
        }
    }

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

    static async redrawFan() {
        return FanChartManager.drawFanForRoot(rootPersonStore.root);
    }

    // Nettoyage de l'instance existante du fan chart
    static async cleanupExistingInstance() {
        try {
            const svgElement = document.querySelector('#fan');
            const instance = getSvgPanZoomInstance();

            // Nettoyage de l'instance pan/zoom
            if (instance) {
                instance.destroy();
                setSvgPanZoomInstance(null);
            }

            // Nettoyage du SVG
            if (svgElement) {
                svgElement.innerHTML = '';
            }

            destroySvgPanZoom();
        } catch (error) {
            this.handleError(error, 'cleanup');
            throw error;
        }
    }

    // Mise à jour de l'UI après le redessin
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

    // Réinitialisation complète du fan chart
    static reset() {
        try {
            // Nettoyage complet
            this.cleanupExistingInstance();
            
            const fanSvg = document.getElementById("fan");
            if (fanSvg) {
                fanSvg.innerHTML = "";
            }

            // Réinitialisation des écouteurs
            this.setupEventListeners();
        } catch (error) {
            this.handleError(error, 'reset');
        }
    }
}