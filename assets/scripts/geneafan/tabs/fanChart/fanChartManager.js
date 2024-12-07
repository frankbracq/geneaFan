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

    // Redessin complet du fan chart
    static async redrawFan() {
        try {
            // Validation des prérequis
            if (!configStore.config.gedcomFileName) {
                throw new Error('No GEDCOM file loaded');
            }

            const fanContainer = document.getElementById('fanContainer');
            if (!fanContainer || fanContainer.offsetParent === null) {
                throw new Error('Fan container not visible');
            }

            // Nettoyage de l'instance existante
            await this.cleanupExistingInstance();

            // Dessin du nouveau fan
            const currentRoot = rootPersonStore.root;
            console.log('Drawing fan with current root:', currentRoot);
            
            const drawResult = draw(currentRoot);
            if (!drawResult) {
                throw new Error('Failed to draw fan');
            }

            // Affichage et mise à jour de l'UI
            await this.displayFan();
            this.updateUIAfterRedraw();

            return true;

        } catch (error) {
            this.handleError(error, 'redraw');
            return false;
        }
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