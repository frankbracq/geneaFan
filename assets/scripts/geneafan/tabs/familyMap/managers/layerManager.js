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
        console.log(`🏙️ layerManager.setLayerVisibility - Calque: ${layerName}, Visibilité: ${visible}`);

        if (!this.layerConfig[layerName]) {
            console.warn(`⚠️ Calque inconnu: ${layerName}`);
            return;
        }

        // Vérifier si l'état a changé
        const previousState = this.layerStates[layerName];
        if (previousState === visible) {
            console.log(`ℹ️ L'état du calque ${layerName} n'a pas changé (${visible})`);
            return;
        }

        // Mettre à jour l'état interne
        this.layerStates[layerName] = visible;
        console.log(`✅ État du calque ${layerName} mis à jour: ${visible}`);

        // Si c'est le calque des patronymes, vérifier si un patronyme est sélectionné
        if (layerName === 'surnames') {
            const store = this.layerConfig[layerName].storeRef;
            if (visible && store && !store.currentSurname) {
                console.warn(`⚠️ Activation du calque des patronymes sans patronyme sélectionné!`);
            }
        }

        // Émettre l'événement de changement
        console.log(`📣 Émission de l'événement LAYERS.CHANGED pour ${layerName}`);
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
        const isVisible = this.layerStates[layerName] || false;
        console.log(`🔍 layerManager.isLayerVisible - Calque: ${layerName}, État: ${isVisible}`);
        return isVisible;
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
            // Vérifier que l'état du commutateur correspond à l'état interne
            const isVisible = this.isLayerVisible('ancestors');
            elements.ancestorLayerSwitch.checked = isVisible;
            console.log(`📍 Configuration commutateur ancêtres: ${isVisible ? 'activé' : 'désactivé'}`);
            
            elements.ancestorLayerSwitch.addEventListener('change', (e) => {
                console.log(`📍 Changement commutateur ancêtres: ${e.target.checked ? 'activé' : 'désactivé'}`);
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
            
            // MODIFICATION ICI: Ne pas désactiver le menu déroulant quand le calque est visible
            // Le menu doit toujours être actif pour permettre de changer de patronyme
            elements.surnameFilter.disabled = false;
            
            elements.surnamesLayerSwitch.addEventListener('change', (e) => {
                this.setLayerVisibility('surnames', e.target.checked);
                
                // Même ici, ne pas désactiver le menu déroulant
                elements.surnameFilter.disabled = false;
            });
        }
    }
}

// Exporter une instance unique du service
export const layerManager = new LayerManager();