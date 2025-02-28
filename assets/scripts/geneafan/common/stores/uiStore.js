import {
  makeObservable,
  observable,
  action,
  computed,
  autorun,
} from "./mobx-config.js";
import { EVENTS, storeEvents } from "../../gedcom/stores/storeEvents.js";

class UIStore {
  // États observables
  isDataLoaded = false;
  isFanChartDrawn = false;
  activeTab = "Fan";

  constructor() {
    makeObservable(this, {
      isDataLoaded: observable,
      isFanChartDrawn: observable,
      activeTab: observable,

      setDataLoaded: action,
      setFanChartDrawn: action,
      setActiveTab: action,

      areExportOptionsEnabled: computed,
      areToolsEnabled: computed,
      isFullscreenEnabled: computed,
    });

    // S'abonner aux événements
    this.setupEventListeners();

    // Observer les changements et mettre à jour le DOM
    this.setupAutorun();
  }

  setupEventListeners() {
    storeEvents.subscribe(EVENTS.VISUALIZATIONS.FAN.DRAWN, () => {
      this.setFanChartDrawn(true);
      console.log("🎯 Fan chart drawn, UI store updated");
    });

    storeEvents.subscribe(EVENTS.ONBOARDING.GEDCOM_UPLOADED, () => {
      this.setDataLoaded(true);
      console.log("📂 GEDCOM uploaded, UI store updated");
    });
  }

  setupAutorun() {
    console.log('📋 Setting up autorun for UI controls');
    // Mettre à jour le DOM automatiquement lorsque les états changent
    autorun(() => {
      console.log('🔄 Autorun triggered for UI controls');
      this.updateUIControls();
    });
    
    // Forcer une mise à jour initiale
    this.updateUIControls();
  }

  updateUIControls() {
    // Mise à jour des éléments d'exportation
    const exportItems = [
      "download-pdf-watermark",
      "download-pdf",
      "download-svg",
      "download-png-transparency",
      "download-png-background",
    ].map((id) => document.getElementById(id));

    exportItems.forEach((item) => {
      if (item) {
        if (this.areExportOptionsEnabled) {
          item.classList.remove("disabled");
        } else {
          item.classList.add("disabled");
        }
      }
    });

    // Mise à jour des boutons d'interface
    const toolsButton = document.getElementById("toolsButton");
    const fullscreenButton = document.getElementById("fullscreenButton");

    if (toolsButton) {
      const wasDisabled = toolsButton.disabled;
      toolsButton.disabled = !this.areToolsEnabled;
      if (wasDisabled !== toolsButton.disabled) {
        console.log(
          `🔧 Tools button state changed: ${
            toolsButton.disabled ? "disabled" : "enabled"
          }`
        );
      }
    } else {
      console.warn("⚠️ Tools button not found in DOM");
    }

    if (fullscreenButton) {
      fullscreenButton.disabled = !this.isFullscreenEnabled;
      fullscreenButton.style.pointerEvents = this.isFullscreenEnabled
        ? "auto"
        : "none";
    }

    console.log("🔄 UI controls updated based on state changes");
  }

  // Actions
  setDataLoaded(isLoaded) {
    this.isDataLoaded = isLoaded;
  }

  setFanChartDrawn(isDrawn) {
    this.isFanChartDrawn = isDrawn;
  }

  setActiveTab(tabName) {
    this.activeTab = tabName;
  }

  // Computed properties
  get areExportOptionsEnabled() {
    return this.isFanChartDrawn;
  }

  get areToolsEnabled() {
    return this.isFanChartDrawn;
  }

  get isFullscreenEnabled() {
    return this.isFanChartDrawn;
  }
}

// Singleton instance
const uiStore = new UIStore();
export default uiStore;
