// Core imports
import { reaction } from '../../common/stores/mobx-config.js';
import configStore from "./fanConfigStore.js";
import rootPersonStore from "../../common/stores/rootPersonStore.js";
import { displayPersonDetailsUI } from "./personDetailsUI.js";
import familyTownsStore from '../../gedcom/familyTownsStore.js';

// Utility imports
import svgPanZoom from "svg-pan-zoom";
import { debounce } from "../../utils/utils.js";

// State management
import {
  setSvgPanZoomInstance,
  getSvgPanZoomInstance,
} from "../../common/stores/state.js";

/**
 * Manages the fan chart display and interactions
 */
class FanChartManager {
  constructor() {
      this.panZoomInstance = null;
      this.isInitialized = false;
  }

  initialize() {
      if (this.isInitialized) return;
      this.setupFanContainer();
      this.setupEventListeners();
      this.isInitialized = true;
  }

  display() {
      // Cette méthode est appelée quand on a des données à afficher
      if (!this.panZoomInstance) {
          this.setupSvgPanZoom();
      }
      this.resizeFan();
  }

  setupFanContainer() {
      const fanContainer = document.getElementById("fanContainer");
      if (!fanContainer) {
          console.error("Fan container not found");
          return;
      }

      // Ne pas initialiser svgPanZoom ici
      this.setupResizeHandler(fanContainer);
  }

  setupSvgPanZoom() {
      try {
          const instance = svgPanZoom("#fan", {
              zoomEnabled: true,
              controlIconsEnabled: true,
              fit: true,
              center: true,
          });

          const mapElement = document.querySelector("#fan");
          if (mapElement) {
              mapElement.addEventListener("dblclick", 
                  (event) => event.stopImmediatePropagation(), 
                  true
              );

              mapElement.addEventListener("wheel", 
                  (event) => {
                      if (event.ctrlKey) {
                          event.preventDefault();
                      }
                  },
                  { passive: false }
              );
          }

          this.panZoomInstance = instance;
          setSvgPanZoomInstance(instance);
      } catch (error) {
          console.error("Error setting up svgPanZoom:", error);
      }
  }

  /**
   * Sets up resize handling for the fan container
   */
  setupResizeHandler(fanContainer) {
    const resizeFan = () => {
      const svgElement = document.getElementById("fan");
      if (!svgElement || !this.panZoomInstance) return;

      const containerWidth = fanContainer.clientWidth;
      const containerHeight = fanContainer.clientHeight;

      svgElement.setAttribute("width", containerWidth);
      svgElement.setAttribute("height", containerHeight);

      this.panZoomInstance.resize();
      this.panZoomInstance.fit();
      this.panZoomInstance.center();
    };

    window.addEventListener("resize", debounce(resizeFan, 100));
    resizeFan(); // Initial resize
  }

  /**
   * Sets up event listeners for fan chart interactions
   */
  setupEventListeners() {
    const parametersElements = document.querySelectorAll(".parameter");
    parametersElements.forEach(element => {
      element.addEventListener("change", configStore.handleSettingChange);
    });

    const individualSelectElement = document.getElementById("individual-select");
    if (individualSelectElement) {
      individualSelectElement.addEventListener("change", configStore.handleSettingChange);
    }
  }

  /**
   * Resets the fan chart display and related UI elements
   */
  async resetUI() {
    if (this.panZoomInstance) {
      try {
        this.panZoomInstance.destroy();
      } catch (error) {
        console.error("Error destroying svgPanZoom:", error);
      }
      this.panZoomInstance = null;
      setSvgPanZoomInstance(null);
    }

    const fanSvg = document.getElementById("fan");
    if (fanSvg) {
      fanSvg.innerHTML = "";
    }

    this.resetControls();
    this.resetParameters();
    familyTownsStore.setTownsData({});
    rootPersonStore.resetHistory();
  }

  /**
   * Resets UI controls to their default state
   */
  resetControls() {
    const controlElements = [
      "download-menu",
      "fanParametersDisplay",
      "fullscreenButton"
    ];

    controlElements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.disabled = true;
      }
    });
  }

  /**
   * Resets parameter selections to their default values
   */
  resetParameters() {
    const parametersElements = document.querySelectorAll(".parameter");
    parametersElements.forEach(element => {
      element.removeEventListener("change", configStore.handleSettingChange);
      if (element.dataset.default) {
        element.value = element.dataset.default;
      }
      element.addEventListener("change", configStore.handleSettingChange);
    });
  }

  /**
   * Checks if the fan container is currently visible
   */
  isFanContainerVisible() {
    const fanContainer = document.getElementById("fanContainer");
    return fanContainer && fanContainer.offsetParent !== null;
  }

  /**
   * Cleanup when switching away from fan chart
   */
  cleanup() {
    // Implement if needed
  }
}

const fanChartManager = new FanChartManager();
export default fanChartManager;