import { draw } from "./fan.js";
import { 
    setSvgPanZoomInstance, 
    getSvgPanZoomInstance,
    initSvgPanZoom,
    destroySvgPanZoom 
} from "../../common/stores/state.js";
import rootPersonStore from "../../common/stores/rootPersonStore.js";
import configStore from "./fanConfigStore.js";

export class FanChartManager {
    static instances = new Map(); // Ajout de la propriété statique manquante
    static updateTimeout = null;

    static initialize() {
        console.log("Initializing fan chart...");
        this.setupEventListeners();
        return this;
    }

    static setupEventListeners() {
        const fullscreenButton = document.getElementById('fullscreenButton');
        if (fullscreenButton) {
            fullscreenButton.addEventListener('click', this.handleFullscreen);
        }
    }

    static async displayFan() {
        const svg = document.querySelector('#fan');
        const container = document.getElementById('fanContainer');

        if (!svg || !container) {
            console.error('Required elements not found');
            return;
        }

        svg.style.opacity = '0';

        try {
            const instance = await this.initializePanZoom(svg);
            this.instances.set('panZoom', instance);

            requestAnimationFrame(() => {
                svg.style.transition = 'opacity 0.3s ease-in-out';
                svg.style.opacity = '1';
            });

        } catch (error) {
            console.error('Error displaying fan:', error);
            throw error; // Propager l'erreur pour une meilleure gestion
        }
    }

    static isDisplayable() {
        if (!configStore.config.gedcomFileName) {
            console.warn("No GEDCOM file loaded");
            return false;
        }

        const fanContainer = document.getElementById("fanContainer");
        if (!fanContainer || fanContainer.offsetParent === null) {
            console.warn("Fan container is not visible");
            return false;
        }

        return true;
    }

    static async initializePanZoom(svg) {
        const instance = initSvgPanZoom(svg, {
            minZoom: 0.1,
            maxZoom: 10,
            zoomScaleSensitivity: 0.2,
            fitPadding: 20
        });

        setSvgPanZoomInstance(instance);
        return instance;
    }

    static handleFullscreen = async () => {
        const container = document.getElementById('fanContainer');
        const instance = this.instances.get('panZoom');

        if (!document.fullscreenElement) {
            try {
                await container.requestFullscreen();
                if (instance) instance.handleResize();
            } catch (error) {
                console.error('Error attempting to enable fullscreen:', error);
            }
        } else {
            try {
                await document.exitFullscreen();
                if (instance) instance.handleResize();
            } catch (error) {
                console.error('Error attempting to exit fullscreen:', error);
            }
        }
    }

    static queueRedraw() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        this.updateTimeout = setTimeout(() => {
            this.updateTimeout = null;
            if (this.isDisplayable()) {
                this.redrawFan();
            }
        }, 50);
    }

    static async redrawFan() {
        if (!this.isDisplayable()) {
            return false;
        }

        try {
            await this.cleanupExistingInstance();

            const currentRoot = rootPersonStore.root;
            console.log('Drawing fan with current root:', currentRoot);
            
            const drawResult = draw(currentRoot);
            if (!drawResult) {
                throw new Error("Failed to draw fan");
            }

            await this.displayFan();
            this.updateUIAfterRedraw();

            return true;
        } catch (error) {
            console.error("Error redrawing fan:", error);
            return false;
        }
    }

    static async cleanupExistingInstance() {
        const svgElement = document.querySelector('#fan');
        const instance = getSvgPanZoomInstance();

        if (instance) {
            instance.destroy();
            setSvgPanZoomInstance(null);
        }

        if (svgElement) {
            svgElement.innerHTML = '';
        }

        destroySvgPanZoom();
    }

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

    static reset() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }

        this.cleanupExistingInstance();
        this.instances.clear();

        const fanSvg = document.getElementById("fan");
        if (fanSvg) {
            fanSvg.innerHTML = "";
        }

        this.setupEventListeners();
    }
}