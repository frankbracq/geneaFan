import MarkerDisplayManager from './markerDisplayManager.js';
import { layerManager } from './layerManager.js';
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
 * @returns {boolean} - Statut de l'initialisation
 */
    initialize(map) {
        // Vérifier que la carte est valide
        if (!map || !(map instanceof google.maps.Map)) {
            console.error(`❌ Instance de carte invalide pour ${this.layerName}Store`);
            return false;
        }

        console.log(`🚀 Initialisation de ${this.layerName}Store`);
        this.map = map;

        try {
            // Initialiser le cluster s'il ne l'est pas déjà
            if (!this.markerDisplayManager.isInitialized()) {
                if (!this.createClusterMarker || typeof this.createClusterMarker !== 'function') {
                    console.error(`❌ Méthode createClusterMarker manquante dans ${this.constructor.name}`);
                    return false;
                }

                this.markerDisplayManager.initializeCluster(map, this.createClusterMarker.bind(this));
            }

            return true;
        } catch (error) {
            console.error(`❌ Erreur lors de l'initialisation de ${this.layerName}Store:`, error);
            return false;
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

        if (visible) {
            // 1. Préparation du calque avant affichage (hook pour la classe dérivée)
            this.prepareLayerBeforeShow();

            // 2. S'assurer que le cluster est bien initialisé
            if (!this.markerDisplayManager.isInitialized()) {
                this.markerDisplayManager.initializeCluster(this.map, this.createClusterMarker.bind(this));
            }

            // 3. Préparer/rafraîchir les marqueurs si nécessaire (hook pour la classe dérivée)
            this.updateLayerMarkers();

            // 4. Rendre les marqueurs visibles
            const layerMarkers = this.markerDisplayManager.layers.get(this.markerLayerName);
            if (layerMarkers) {
                layerMarkers.forEach(marker => {
                    marker.map = this.map;
                });
            }

            // 5. Ajouter les marqueurs au cluster avec délai configurable
            const config = layerManager.getLayerConfig(this.layerName);
            const delay = config ? config.clusterDelay : 0;

            if (delay > 0) {
                setTimeout(() => {
                    console.log(`📍 Ajout des marqueurs au cluster après délai (${delay}ms)`);
                    this.markerDisplayManager.addMarkersToCluster(this.map);
                }, delay);
            } else {
                console.log('📍 Ajout des marqueurs au cluster sans délai');
                this.markerDisplayManager.addMarkersToCluster(this.map);
            }

            // 6. Actions post-affichage (hook pour la classe dérivée)
            this.afterLayerShown();
        } else {
            console.log(`🔍 Désactivation du calque ${this.layerName}`);
            this.markerDisplayManager.toggleLayerVisibility(this.markerLayerName, false, this.map);

            // 7. Actions après masquage (hook pour la classe dérivée)
            this.afterLayerHidden();
        }
    }

    /**
     * Hook: Préparations avant affichage du calque
     * À surcharger par les classes dérivées si nécessaire
     */
    prepareLayerBeforeShow() {
        // Implémentation par défaut vide
    }

    /**
     * Hook: Mise à jour des marqueurs du calque
     * À surcharger par les classes dérivées si nécessaire
     */
    updateLayerMarkers() {
        // Implémentation par défaut vide
    }

    /**
     * Hook: Actions après affichage du calque
     * À surcharger par les classes dérivées si nécessaire
     */
    afterLayerShown() {
        // Implémentation par défaut vide
    }

    /**
     * Hook: Actions après masquage du calque
     * À surcharger par les classes dérivées si nécessaire
     */
    afterLayerHidden() {
        // Implémentation par défaut vide
    }

    /**
     * Méthode par défaut pour créer un marqueur de cluster
     * Peut être surchargée par les classes dérivées
     */
    createClusterMarker({ count, position }) {
        throw new Error('createClusterMarker doit être implémenté par les classes dérivées');
    }

    /**
 * Nettoie les ressources utilisées par le store
 */
    cleanup() {
        console.log(`🧹 Nettoyage des ressources pour ${this.layerName}Store`);

        // 1. Nettoyage des marqueurs et de leurs écouteurs
        if (this.markerDisplayManager) {
            const layerMarkers = this.markerDisplayManager.layers.get(this.markerLayerName);
            if (layerMarkers) {
                layerMarkers.forEach((marker, key) => {
                    // Supprimer tous les écouteurs d'événements Google Maps
                    if (marker) {
                        google.maps.event.clearInstanceListeners(marker);
                        marker.map = null;
                    }
                });
            }

            // Nettoyer les marqueurs après avoir supprimé les écouteurs
            this.markerDisplayManager.clearMarkers(this.markerLayerName);
        }

        // 2. Nettoyage des disposers MobX pour éviter les fuites mémoire
        this.disposers.forEach(disposer => {
            if (typeof disposer === 'function') {
                disposer();
            }
        });
        this.disposers.clear();

        // 3. Réinitialisation des références
        this.map = null;

        console.log(`✅ Nettoyage terminé pour ${this.layerName}Store`);
    }
}

export default BaseLayerStore;