import { MarkerClusterer, SuperClusterAlgorithm } from "@googlemaps/markerclusterer";

/**
 * Manages the display and clustering of markers on a Google Map
 */
class MarkerDisplayManager {
    constructor() {
        // Map of layers containing markers (key: layerName, value: Map of markers)
        this.layers = new Map();
        // Cluster instance for grouping markers
        this.cluster = null;
        // Set of currently active markers
        this.activeMarkers = new Set();
        // Cache for marker configurations
        this.markerConfigs = new Map();
    }

    /**
     * Check if the manager is properly initialized
     */
    isInitialized() {
        return this.map !== null && this.cluster !== null;
    }

    /**
     * Initialize the marker clusterer with specific configuration
     * @param {google.maps.Map} map - Google Maps instance
     * @param {Function} renderFn - Function to render cluster markers
     */
    initializeCluster(map, renderFn) {
        if (this.cluster) {
            console.warn("⚠️ Cluster already exists, clearing markers...");
            this.cluster.clearMarkers();
        } else {
            console.log("🚀 Creating new Google Maps cluster");
            this.cluster = new MarkerClusterer({
                map,
                markers: [],
                algorithm: new SuperClusterAlgorithm({
                    radius: 60,
                    maxZoom: 15,
                    minPoints: 2,
                    minZoom: 1,
                }),
                onClusterClick: (event, cluster, map) => {
                    const zoom = map.getZoom() || 0;
                    map.setZoom(zoom + 1);
                    map.setCenter(cluster.position);
                },
                renderer: {
                    render: ({ count, position }) => {
                        return renderFn({ count, position });
                    }
                }
            });
        }

        console.log("🚀 Google Maps cluster initialized");
    }

    /**
     * Add a new layer to manage markers
     * @param {string} layerName - Name of the layer
     */
    addLayer(layerName) {
        if (!this.layers.has(layerName)) {
            this.layers.set(layerName, new Map());
            console.log(`Created new layer: ${layerName}`);
        }
    }

    /**
 * Add a marker to a specific layer with improved validation
 * @param {string} layerName - Target layer
 * @param {string} key - Unique identifier for the marker
 * @param {google.maps.LatLng} position - Marker position
 * @param {Object} options - Marker options
 * @param {Function} onClickCallback - Click event handler
 * @returns {google.maps.marker.AdvancedMarkerElement|null} - Created marker or null if invalid
 */
    addMarker(layerName, key, position, options, onClickCallback = null) {
        // Validation des paramètres essentiels
        if (!layerName) {
            console.warn('⚠️ Nom de calque manquant pour addMarker');
            return null;
        }

        if (!key) {
            console.warn('⚠️ Clé d\'identifiant manquante pour addMarker');
            return null;
        }

        // Vérifier que la position est une instance valide de LatLng
        if (!position || !(position instanceof google.maps.LatLng)) {
            console.warn(`⚠️ Position invalide pour le marqueur ${key}`, position);
            return null;
        }

        // Vérifier que les options contiennent au moins le contenu ou le titre
        if (!options || (!options.content && !options.title)) {
            console.warn(`⚠️ Options invalides pour le marqueur ${key}`);
            return null;
        }

        // Créer la couche si elle n'existe pas
        this.addLayer(layerName);
        const layerMarkers = this.layers.get(layerName);

        // Vérifier si le marqueur existe déjà
        if (layerMarkers.has(key)) {
            return layerMarkers.get(key);
        }

        try {
            // Créer le marqueur avec gestion des erreurs
            const marker = new google.maps.marker.AdvancedMarkerElement({
                position,
                map: null, // Initialement invisible
                ...options
            });

            // Ajouter l'écouteur de clic si fourni
            if (onClickCallback && typeof onClickCallback === 'function') {
                marker.addListener('click', () => onClickCallback(marker));
            }

            layerMarkers.set(key, marker);
            return marker;
        } catch (error) {
            console.error(`❌ Erreur lors de la création du marqueur ${key}:`, error);
            return null;
        }
    }

    /**
 * Add markers to the cluster with improved validation
 * @param {google.maps.Map} map - Google Maps instance
 * @returns {boolean} Success status
 */
    addMarkersToCluster(map) {
        // Vérifier l'initialisation
        if (!this.isInitialized()) {
            console.warn('⚠️ Cluster ou map non initialisé');
            return false;
        }

        // Vérifier que la carte est valide
        if (!map || !(map instanceof google.maps.Map)) {
            console.warn('⚠️ Instance de carte invalide');
            return false;
        }

        // Récupérer tous les marqueurs visibles
        let markersToAdd = [];
        this.layers.forEach((layerMarkers) => {
            layerMarkers.forEach(marker => {
                // Vérifier que le marqueur est valide et visible
                if (marker && marker.map !== null) {
                    markersToAdd.push(marker);
                }
            });
        });

        console.log(`📊 Tentative d'ajout de ${markersToAdd.length} marqueurs au cluster`);

        if (markersToAdd.length === 0) {
            console.warn('⚠️ Aucun marqueur à afficher dans le cluster');
            return false;
        }

        try {
            // Vider le cluster existant avec gestion des erreurs
            this.cluster.clearMarkers();

            // Ajouter les marqueurs au cluster
            this.cluster.addMarkers(markersToAdd);

            // Forcer un rafraîchissement du clustering
            google.maps.event.trigger(map, 'zoom_changed');

            console.log('✅ Marqueurs ajoutés au cluster');
            return true;
        } catch (error) {
            console.error('❌ Erreur lors de l\'ajout des marqueurs au cluster:', error);
            return false;
        }
    }

    /**
     * Toggle visibility of a layer
     * @param {string} layerName - Target layer
     * @param {boolean} visible - Visibility state
     * @param {google.maps.Map} map - Google Maps instance
     */
    toggleLayerVisibility(layerName, visible, map) {
        console.log(`Toggling visibility for layer ${layerName} to ${visible}`);
        const layerMarkers = this.layers.get(layerName);
        if (layerMarkers) {
            if (this.cluster && !visible) {
                this.cluster.clearMarkers();
            }

            layerMarkers.forEach(marker => {
                marker.map = visible ? map : null;
            });

            if (visible && map) {
                console.log(`🔄 Mise à jour du clustering pour ${layerName}`);
                this.addMarkersToCluster(map);
                // Forcer un rafraîchissement du clustering
                google.maps.event.trigger(map, 'zoom_changed');
            }
        }
    }

    /**
 * Clear markers from specific layer or all layers with proper event cleanup
 * @param {string} layerName - Target layer (optional)
 */
    clearMarkers(layerName = null) {
        console.log(`🧹 Nettoyage des marqueurs${layerName ? ` pour la couche ${layerName}` : ' pour toutes les couches'}`);

        if (this.cluster) {
            this.cluster.clearMarkers();
            this.cluster.setMap(null);
        }

        if (layerName) {
            const layerMarkers = this.layers.get(layerName);
            if (layerMarkers) {
                layerMarkers.forEach(marker => {
                    // Supprimer tous les écouteurs avant de retirer de la carte
                    google.maps.event.clearInstanceListeners(marker);
                    marker.map = null;
                });
                this.layers.delete(layerName);
            }
        } else {
            this.layers.forEach(layerMarkers => {
                layerMarkers.forEach(marker => {
                    // Supprimer tous les écouteurs avant de retirer de la carte
                    google.maps.event.clearInstanceListeners(marker);
                    marker.map = null;
                });
            });
            this.layers.clear();
        }

        this.activeMarkers.clear();
        this.markerConfigs.clear();
    }

    /**
 * Create marker configuration with improved validation
 * @param {string} townName - Name of the town
 * @param {Object} townData - Town data
 * @param {Function} createMarkerElementFn - Function to create marker element
 * @returns {Object|null} Marker configuration or null if invalid data
 */
    createMarkerConfig(townName, townData, createMarkerElementFn) {
        // Validation complète des données d'entrée
        if (!townData) {
            console.warn(`⚠️ Données manquantes pour la ville ${townName}`);
            return null;
        }

        // Vérification que les coordonnées existent et sont numériques
        if (!townData.latitude || !townData.longitude ||
            isNaN(Number(townData.latitude)) || isNaN(Number(townData.longitude))) {
            console.warn(`⚠️ Coordonnées invalides pour ${townName}: (${townData.latitude}, ${townData.longitude})`);
            return null;
        }

        // Vérification des limites des coordonnées (valeurs plausibles)
        const lat = Number(townData.latitude);
        const lng = Number(townData.longitude);

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            console.warn(`⚠️ Coordonnées hors limites pour ${townName}: (${lat}, ${lng})`);
            return null;
        }

        // Création de la configuration avec les coordonnées validées
        const config = {
            position: new google.maps.LatLng(lat, lng),
            options: {
                content: createMarkerElementFn(townData),
                title: townData.townDisplay || townData.town || townName
            }
        };

        this.markerConfigs.set(townName, config);
        return config;
    }

    /**
 * Get existing marker or create new one with improved validation
 * @param {string} layerName - Target layer
 * @param {string} townName - Name of the town
 * @param {Object} townData - Town data
 * @param {Function} createMarkerElementFn - Function to create marker element
 * @param {Function} onClickCallback - Click event handler
 * @returns {google.maps.marker.AdvancedMarkerElement|null} - The marker or null if invalid
 */
    getOrCreateMarker(layerName, townName, townData, createMarkerElementFn, onClickCallback) {
        // Validation des paramètres essentiels
        if (!layerName) {
            console.warn('⚠️ Nom de calque manquant pour getOrCreateMarker');
            return null;
        }

        if (!townName) {
            console.warn('⚠️ Identifiant de ville manquant pour getOrCreateMarker');
            return null;
        }

        if (!createMarkerElementFn || typeof createMarkerElementFn !== 'function') {
            console.warn(`⚠️ Fonction de création d'élément invalide pour ${townName}`);
            return null;
        }

        // Vérifier que les données de ville existent
        if (!townData) {
            console.warn(`⚠️ Données manquantes pour la ville ${townName}`);
            return null;
        }

        // Utiliser la configuration existante ou en créer une nouvelle
        let config = this.markerConfigs.get(townName);

        if (!config) {
            config = this.createMarkerConfig(townName, townData, createMarkerElementFn);
            if (!config) {
                console.warn(`⚠️ Impossible de créer la configuration pour ${townName}`);
                return null;
            }
        }

        // Ajouter le marqueur avec la configuration validée
        return this.addMarker(
            layerName,
            townName,
            config.position,
            config.options,
            onClickCallback
        );
    }

    /**
 * Cleanup resources with proper event handling
 */
    cleanup() {
        this.layers.forEach((layerMarkers, layerName) => {
            layerMarkers.forEach(marker => {
                // Supprimer les écouteurs d'événements
                google.maps.event.clearInstanceListeners(marker);
                marker.map = null;
            });
        });

        this.clearMarkers();

        if (this.cluster) {
            // Supprimer les écouteurs du cluster également
            if (this.cluster.onClusterClick) {
                google.maps.event.clearListeners(this.cluster, 'click');
            }
            this.cluster.setMap(null);
        }

        this.cluster = null;
        this.activeMarkers.clear();
        this.markerConfigs.clear();
    }
}

export default MarkerDisplayManager;
