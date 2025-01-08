import { MarkerClusterer } from "@googlemaps/markerclusterer";

class MarkerManager {
    constructor() {
        this.layers = new Map();
        this.cluster = null;
    }

    initializeCluster(map, renderFn) {
        if (this.cluster) {
            this.cluster.setMap(null);
        }
        
        this.cluster = new MarkerClusterer({
            map,
            markers: [],
            renderer: {
                render: renderFn
            }
        });
    }

    addMarkerToLayer(layerName, key, position, options, onClickCallback = null) {
        if (!this.layers.has(layerName)) {
            this.layers.set(layerName, new Map());
        }

        const layerMarkers = this.layers.get(layerName);
        if (!layerMarkers.has(key)) {
            const marker = new google.maps.marker.AdvancedMarkerElement({
                position,
                map: null,
                ...options
            });

            if (onClickCallback) {
                marker.addListener('click', () => onClickCallback(marker));
            }

            layerMarkers.set(key, marker);
        }

        return layerMarkers.get(key);
    }

    addMarkersToCluster(map) {
        if (!this.cluster || !map) return;

        const markers = [];
        this.layers.forEach(layerMarkers => {
            layerMarkers.forEach(marker => {
                if (marker.map) {
                    markers.push(marker);
                }
            });
        });

        console.log('Markers being clustered:', markers.length);
        
        // Ne créer les clusters que s'il y a des marqueurs visibles
        if (markers.length > 0) {
            this.cluster.setMap(map);
            this.cluster.clearMarkers();
            this.cluster.addMarkers(markers);
        } else {
            // Si aucun marqueur n'est visible, désactiver le clustering
            this.cluster.setMap(null);
        }
    }

    toggleLayerVisibility(layerName, visible, map) {
        const layerMarkers = this.layers.get(layerName);
        if (layerMarkers) {
            layerMarkers.forEach(marker => {
                marker.map = visible ? map : null;
            });
            
            // Mettre à jour les clusters en fonction de la visibilité
            if (visible && map) {
                this.addMarkersToCluster(map);
            } else {
                // Si le layer est masqué, désactiver le clustering
                if (this.cluster) {
                    this.cluster.setMap(null);
                }
            }
        }
    }

    clearMarkers(layerName = null) {
        // Désactiver d'abord le clustering
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
    }

    cleanup() {
        this.clearMarkers();
        if (this.cluster) {
            this.cluster.setMap(null);
        }
        this.cluster = null;
    }
}

export default MarkerManager;