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
    static initialize() {
        console.log("Initializing fan chart...");
        this.setupEventListeners();
        return this;
    }

    static setupEventListeners() {
        if (screenfull.isEnabled) {
            // Gestion du bouton plein écran
            const fullscreenButton = document.getElementById('fullscreenButton');
            if (fullscreenButton) {
                fullscreenButton.addEventListener('click', this.handleFullscreen);
            }

            // Écouteur pour les changements de mode plein écran
            screenfull.on('change', () => this.handleFullscreenChange());
        }

        // Gestion de l'onglet Fan Chart
        const tabFan = document.querySelector('[href="#tab1"]');
        if (tabFan) {
            tabFan.addEventListener("shown.bs.tab", () => {
                configStore.handleSettingChange();
            });
        }
    }

    static handleFullscreen = async () => {
        const container = document.getElementById('fanContainer');
        
        if (screenfull.isEnabled) {
            try {
                await screenfull.toggle(container);
            } catch (error) {
                console.error('Error toggling fullscreen:', error);
            }
        }
    }

    static handleFullscreenChange() {
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
            // Créer l'instance SVGPanZoomManager avec les options appropriées
            const instance = new SVGPanZoomManager(svg, {
                minZoom: 0.1,
                maxZoom: 10,
                zoomScaleSensitivity: 0.2,
                fitPadding: 20
            });
            setSvgPanZoomInstance(instance);

            // Animer l'apparition du fan
            requestAnimationFrame(() => {
                svg.style.transition = 'opacity 0.3s ease-in-out';
                svg.style.opacity = '1';
            });

        } catch (error) {
            console.error('Error displaying fan:', error);
        }
    }

    static async redrawFan() {
        if (!configStore.config.gedcomFileName) {
            console.warn("No GEDCOM file loaded. Skipping redraw.");
            return false;
        }

        const fanContainer = document.getElementById("fanContainer");
        if (!fanContainer || fanContainer.offsetParent === null) {
            console.warn("Fan container is not visible");
            return false;
        }

        try {
            // Nettoyer l'instance existante
            await this.cleanupExistingInstance();

            // Dessiner le nouveau fan
            const currentRoot = rootPersonStore.root;
            console.log('Drawing fan with current root:', currentRoot);
            
            const drawResult = draw(currentRoot);
            if (!drawResult) {
                throw new Error("Failed to draw fan");
            }

            // Afficher le nouveau fan
            await this.displayFan();

            // Mettre à jour l'UI
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
        // Nettoyage de l'instance SVGPanZoomManager
        this.cleanupExistingInstance();
        
        // Réinitialiser l'état du fan
        const fanSvg = document.getElementById("fan");
        if (fanSvg) {
            fanSvg.innerHTML = "";
        }

        // Réactiver les écouteurs d'événements
        this.setupEventListeners();
    }
}