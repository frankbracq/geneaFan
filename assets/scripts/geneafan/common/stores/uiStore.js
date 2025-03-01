// common/stores/uiStore.js
import { makeObservable, observable, action, computed, autorun } from "mobx";
import { EVENTS, storeEvents } from "./storeEvents.js";

class UIStore {
  // États observables
  isDataLoaded = false;
  isFanChartDrawn = false;
  activeTab = "Fan";
  
  constructor() {
    console.log('🚀 UIStore initializing');
    console.log('📌 EVENTS.VISUALIZATIONS.FAN.DRAWN =', EVENTS.VISUALIZATIONS.FAN.DRAWN);
    
    makeObservable(this, {
      isDataLoaded: observable,
      isFanChartDrawn: observable,
      activeTab: observable,
      
      setDataLoaded: action,
      setFanChartDrawn: action,
      setActiveTab: action,
      
      areExportOptionsEnabled: computed,
      areToolsEnabled: computed,
      isFullscreenEnabled: computed
    });
    
    // S'abonner aux événements
    this.setupEventListeners();
    
    // Observer les changements et mettre à jour le DOM
    this.setupAutorun();
  }
  
  setupEventListeners() {
    console.log('📌 Setting up event listeners in UIStore');
    
    // Utilisation de la chaîne directe plutôt que la constante pour debug
    const subscriberFanDrawn = storeEvents.subscribe('visualization:fan:drawn', (data) => {
      console.log('🎯 UIStore: Fan chart drawn event received', data);
      this.setFanChartDrawn(true);
    });
    
    const subscriberGedcomUploaded = storeEvents.subscribe(EVENTS.ONBOARDING.GEDCOM_UPLOADED, (data) => {
      console.log('📂 UIStore: GEDCOM uploaded event received', data);
      this.setDataLoaded(true);
    });
    
    // Pour débogage, vérifier le nombre d'écouteurs après souscription
    console.log('Écouteurs après souscription:', storeEvents.countListeners('visualization:fan:drawn'));
  }
  
  setupAutorun() {
    // Mettre à jour le DOM automatiquement lorsque les états changent
    autorun(() => {
      console.log('🔄 Autorun triggered for UI controls');
      this.updateUIControls();
    });
  }
  
  updateUIControls() {
    // Mise à jour des éléments d'exportation
    console.log(`🔍 Current state in updateUIControls - isFanChartDrawn: ${this.isFanChartDrawn}, isDataLoaded: ${this.isDataLoaded}`);
    
    const exportItems = [
      'download-pdf-watermark',
      'download-pdf',
      'download-svg',
      'download-png-transparency',
      'download-png-background'
    ].map(id => document.getElementById(id));
    
    exportItems.forEach(item => {
      if (item) {
        if (this.areExportOptionsEnabled) {
          item.classList.remove('disabled');
        } else {
          item.classList.add('disabled');
        }
      }
    });
    
    // Mise à jour des boutons d'interface
    const toolsButton = document.getElementById('toolsButton');
    const fullscreenButton = document.getElementById('fullscreenButton');
    
    if (toolsButton) {
      const wasDisabled = toolsButton.disabled;
      toolsButton.disabled = !this.areToolsEnabled;
      if (wasDisabled !== toolsButton.disabled) {
        console.log(`🛠️ Tools button state changed: ${toolsButton.disabled ? 'disabled' : 'enabled'}`);
      }
    }
    
    if (fullscreenButton) {
      const wasDisabled = fullscreenButton.disabled;
      fullscreenButton.disabled = !this.isFullscreenEnabled;
      fullscreenButton.style.pointerEvents = this.isFullscreenEnabled ? 'auto' : 'none';
      if (wasDisabled !== fullscreenButton.disabled) {
        console.log(`🖥️ Fullscreen button state changed: ${fullscreenButton.disabled ? 'disabled' : 'enabled'}`);
      }
    }
    
    console.log('🔄 UI controls updated based on state changes');
  }
  
  // Actions
  setDataLoaded(isLoaded) {
    console.log(`📊 UIStore: Setting isDataLoaded to ${isLoaded}`);
    this.isDataLoaded = isLoaded;
  }
  
  setFanChartDrawn(isDrawn) {
    console.log(`🎨 UIStore: Setting isFanChartDrawn to ${isDrawn}`);
    this.isFanChartDrawn = isDrawn;
  }
  
  setActiveTab(tabName) {
    console.log(`📑 UIStore: Setting activeTab to ${tabName}`);
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

// Débogage pour vérifier l'état initial
console.log('UIStore créé:', uiStore);

// Pour permettre une utilisation immédiate même si l'import se fait tardivement
if (typeof window !== 'undefined') {
  window.__DEBUG_UI_STORE = uiStore;
}

export default uiStore;