import { storeEvents, EVENTS } from '../../../common/stores/storeEvents.js';

/**
 * Service centralisé pour la gestion des calques cartographiques
 * Améliore la cohérence et réduit la duplication de code entre les stores
 */
class LayerManager {
    constructor() {
        // Configuration des calques avec valeurs par défaut
        this.layerConfig = {
            ancestors: {
                defaultVisible: true,
                clusterDelay: 200,
                storeRef: null // À définir lors de l'initialisation
            },
            family: {
                defaultVisible: false,
                clusterDelay: 200,
                storeRef: null
            },
            surnames: {
                defaultVisible: false,
                clusterDelay: 200,
                storeRef: null
            }
        };
        
        // État actuel des calques
        this.layerStates = {};
        
        // Initialiser les états par défaut
        Object.keys(this.layerConfig).forEach(layerName => {
            this.layerStates[layerName] = this.layerConfig[layerName].defaultVisible;
        });
    }
    
    /**
     * Initialise le service avec les références aux stores
     * @param {Object} storeRefs - Références aux stores gérant les calques
     */
    initialize(storeRefs) {
        // Enregistrer les références aux stores
        Object.keys(storeRefs).forEach(layerName => {
            if (this.layerConfig[layerName]) {
                this.layerConfig[layerName].storeRef = storeRefs[layerName];
            }
        });
        
        // Appliquer les états par défaut
        this.applyDefaultVisibility();
    }
    
    /**
     * Applique les états de visibilité par défaut
     */
    applyDefaultVisibility() {
        Object.keys(this.layerConfig).forEach(layerName => {
            this.setLayerVisibility(
                layerName, 
                this.layerConfig[layerName].defaultVisible
            );
        });
    }
    
    /**
     * Définit la visibilité d'un calque et notifie tous les composants
     * @param {string} layerName - Nom du calque
     * @param {boolean} visible - État de visibilité
     */
    setLayerVisibility(layerName, visible) {
        if (!this.layerConfig[layerName]) {
            console.warn(`Calque inconnu: ${layerName}`);
            return;
        }
        
        // Mettre à jour l'état interne
        this.layerStates[layerName] = visible;
        
        // Émettre l'événement de changement
        storeEvents.emit(EVENTS.VISUALIZATIONS.MAP.LAYERS.CHANGED, {
            layer: layerName,
            state: visible
        });
    }
    
    /**
     * Récupère l'état de visibilité actuel d'un calque
     * @param {string} layerName - Nom du calque
     * @returns {boolean} État de visibilité
     */
    isLayerVisible(layerName) {
        return this.layerStates[layerName] || false;
    }
    
    /**
     * Récupère la configuration d'un calque
     * @param {string} layerName - Nom du calque
     * @returns {Object} Configuration du calque
     */
    getLayerConfig(layerName) {
        return this.layerConfig[layerName] || null;
    }
    
    /**
     * Configure les éléments d'interface pour les calques
     * @param {Object} elements - Éléments d'interface à configurer
     */
    setupLayerControls(elements) {
        if (elements.ancestorLayerSwitch) {
            elements.ancestorLayerSwitch.checked = this.isLayerVisible('ancestors');
            elements.ancestorLayerSwitch.addEventListener('change', (e) => {
                this.setLayerVisibility('ancestors', e.target.checked);
            });
        }
        
        if (elements.familyTownsSwitch) {
            elements.familyTownsSwitch.checked = this.isLayerVisible('family');
            elements.familyTownsSwitch.addEventListener('change', (e) => {
                this.setLayerVisibility('family', e.target.checked);
            });
        }
        
        if (elements.surnamesLayerSwitch && elements.surnameFilter) {
            elements.surnamesLayerSwitch.checked = this.isLayerVisible('surnames');
            elements.surnameFilter.disabled = !this.isLayerVisible('surnames');
            
            elements.surnamesLayerSwitch.addEventListener('change', (e) => {
                this.setLayerVisibility('surnames', e.target.checked);
                elements.surnameFilter.disabled = !e.target.checked;
            });
        }
    }
}

// Exporter une instance unique du service
export const layerManager = new LayerManager();