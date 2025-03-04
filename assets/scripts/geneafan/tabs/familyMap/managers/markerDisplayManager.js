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
     * Add a marker to a specific layer
     * @param {string} layerName - Target layer
     * @param {string} key - Unique identifier for the marker
     * @param {google.maps.LatLng} position - Marker position
     * @param {Object} options - Marker options
     * @param {Function} onClickCallback - Click event handler
     */
    addMarker(layerName, key, position, options, onClickCallback = null) {
        this.addLayer(layerName);
        const layerMarkers = this.layers.get(layerName);
    
        if (!layerMarkers.has(key)) {
            const marker = new google.maps.marker.AdvancedMarkerElement({
                position,
                map: null, // Initially invisible
                ...options
            });
    
            if (onClickCallback) {
                marker.addListener('click', () => onClickCallback(marker));
            }
    
            layerMarkers.set(key, marker);
            // console.log(`✅ Added marker to ${layerName}:`, key, marker);
        }
    
        return layerMarkers.get(key);
    }

    /**
     * Add markers to the cluster
     * @param {google.maps.Map} map - Google Maps instance
     */
    addMarkersToCluster(map) {
        if (!this.isInitialized()) {
            console.warn('⚠️ Cluster ou map non initialisé');
            return;
        }
        
        // 1. Récupérer tous les marqueurs visibles
        let markersToAdd = [];
        this.layers.forEach((layerMarkers) => {
            layerMarkers.forEach(marker => {
                if (marker.map !== null) {
                    markersToAdd.push(marker);
                }
            });
        });
        
        console.log(`📊 Tentative d'ajout de ${markersToAdd.length} marqueurs au cluster`);
        
        if (markersToAdd.length === 0) {
            console.warn('⚠️ Aucun marqueur à afficher dans le cluster');
            return;
        }
        
        // 2. Vider le cluster existant
        this.cluster.clearMarkers();
        
        // 3. Ajouter les marqueurs au cluster SANS les retirer de la carte
        this.cluster.addMarkers(markersToAdd);
        
        // 4. Forcer un rafraîchissement du clustering
        google.maps.event.trigger(map, 'zoom_changed');
        
        console.log('✅ Marqueurs ajoutés au cluster');
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
     * Clear markers from specific layer or all layers
     * @param {string} layerName - Target layer (optional)
     */
    clearMarkers(layerName = null) {
        console.log(`Clearing markers${layerName ? ` for layer ${layerName}` : ' for all layers'}`);

        if (this.cluster) {
            this.cluster.clearMarkers();
            this.cluster.setMap(null);
        }

        if (layerName) {
            const layerMarkers = this.layers.get(layerName);
            if (layerMarkers) {
                layerMarkers.forEach(marker => marker.map = null);
                this.layers.delete(layerName);
            }
        } else {
            this.layers.forEach(layerMarkers => {
                layerMarkers.forEach(marker => marker.map = null);
            });
            this.layers.clear();
        }

        this.activeMarkers.clear();
    }

    /**
     * Create marker configuration
     * @param {string} townName - Name of the town
     * @param {Object} townData - Town data
     * @param {Function} createMarkerElementFn - Function to create marker element
     */
    createMarkerConfig(townName, townData, createMarkerElementFn) {
        if (!townData?.latitude || !townData?.longitude) {
            console.warn(`⚠️ Données de ville invalides pour ${townName}`);
            return null;
        }

        const config = {
            position: new google.maps.LatLng(
                Number(townData.latitude),
                Number(townData.longitude)
            ),
            options: {
                content: createMarkerElementFn(townData),
                title: townData.townDisplay || townData.town
            }
        };
        
        this.markerConfigs.set(townName, config);
        return config;
    }

    /**
     * Get existing marker or create new one
     * @param {string} layerName - Target layer
     * @param {string} townName - Name of the town
     * @param {Object} townData - Town data
     * @param {Function} createMarkerElementFn - Function to create marker element
     * @param {Function} onClickCallback - Click event handler
     */
    getOrCreateMarker(layerName, townName, townData, createMarkerElementFn, onClickCallback) {
        let config = this.markerConfigs.get(townName);
        
        if (!config) {
            config = this.createMarkerConfig(townName, townData, createMarkerElementFn);
            if (!config) return null;
        }

        const marker = this.addMarker(
            layerName,
            townName,
            config.position,
            config.options,
            onClickCallback
        );
        
        // console.log(`🔍 Ajout du marqueur dans layers['rootAncestors']:`, layerName, marker);
        return marker;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.clearMarkers();
        if (this.cluster) {
            this.cluster.setMap(null);
        }
        this.cluster = null;
        this.activeMarkers.clear();
        this.markerConfigs.clear();
    }
}

export default MarkerDisplayManager;
