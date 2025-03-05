import MarkerDisplayManager from './markerDisplayManager.js';
import { storeEvents, EVENTS } from '../../../common/stores/storeEvents.js';

/**
 * Classe de base pour les stores de calques cartographiques
 * Abstrait les fonctionnalités communes à tous les calques
 */
class BaseLayerStore {
    constructor(layerName) {
        this.layerName = layerName;
        // Standardisation : par défaut, le nom de la couche de marqueurs est identique au nom du calque
        this.markerLayerName = layerName;
        this.markerDisplayManager = new MarkerDisplayManager();
        this.map = null;
        this.disposers = new Set();
        
        // Écouter les changements de visibilité du calque
        const layerChangeDisposer = storeEvents.subscribe(
            EVENTS.VISUALIZATIONS.MAP.LAYERS.CHANGED,
            (data) => {
                if (data.layer === this.layerName) {
                    this.applyVisibility(data.state);
                }
            }
        );
        
        this.disposers.add(layerChangeDisposer);
    }
    
    /**
     * Initialise le store avec une instance de Google Maps
     * @param {google.maps.Map} map - Instance Google Maps
     */
    initialize(map) {
        console.log(`🚀 Initialisation de ${this.layerName}Store`);
        this.map = map;
        
        if (!this.markerDisplayManager.isInitialized()) {
            this.markerDisplayManager.initializeCluster(map, this.createClusterMarker.bind(this));
        }
    }
    
    /**
     * Méthode abstraite pour créer un marqueur de cluster
     * @param {Object} params - Paramètres du cluster
     */
    createClusterMarker(params) {
        throw new Error('createClusterMarker doit être implémenté par les classes dérivées');
    }
    
    /**
     * Change la visibilité du calque
     * @param {boolean} visible - État de visibilité
     */
    toggleVisibility(visible) {
        storeEvents.emit(EVENTS.VISUALIZATIONS.MAP.LAYERS.CHANGED, {
            layer: this.layerName,
            state: visible
        });
    }
    
    /**
     * Applique l'état de visibilité aux marqueurs
     * @param {boolean} visible - État de visibilité
     */
    applyVisibility(visible) {
        if (!this.map) return;
        
        // Utiliser markerLayerName au lieu de layerName pour la gestion des marqueurs
        this.markerDisplayManager.toggleLayerVisibility(
            this.markerLayerName,
            visible,
            this.map
        );
    }
    
    /**
     * Nettoie les ressources utilisées par le store
     */
    cleanup() {
        this.markerDisplayManager.clearMarkers(this.layerName);
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
        this.map = null;
    }
}

export default BaseLayerStore;