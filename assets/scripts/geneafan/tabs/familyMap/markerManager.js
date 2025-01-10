import { MarkerClusterer } from "@googlemaps/markerclusterer";

class MarkerManager {
    constructor() {
        this.layers = new Map();
        this.cluster = null;
        this.activeMarkers = new Set();
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

    addLayer(layerName) {
        if (!this.layers.has(layerName)) {
            this.layers.set(layerName, new Map());
            console.log(`Created new layer: ${layerName}`);
        }
    }

    addMarker(layerName, key, position, options, onClickCallback = null) {
        this.addLayer(layerName);
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
            // console.log(`Added marker to layer ${layerName}, total markers in layer: ${layerMarkers.size}`);
        }

        return layerMarkers.get(key);
    }

    addMarkersToCluster(map) {
        if (!this.cluster || !map) {
            console.warn('Cluster or map not initialized');
            return;
        }

        const visibleMarkers = new Set();
        this.layers.forEach((layerMarkers) => {
            layerMarkers.forEach(marker => {
                if (marker.map) {
                    visibleMarkers.add(marker);
                }
            });
        });

        const markers = Array.from(visibleMarkers);
        console.log('Total unique markers to be clustered:', markers.length);

        if (this.cluster) {
            this.cluster.setMap(null);
            this.cluster.clearMarkers();
        }

        if (markers.length > 0) {
            this.cluster.addMarkers(markers);
            this.cluster.setMap(map);
            console.log(`Cluster updated with ${markers.length} markers`);
        }

        this.activeMarkers = new Set(markers);
    }

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
                this.addMarkersToCluster(map);
            }
        }
    }

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

    cleanup() {
        this.clearMarkers();
        if (this.cluster) {
            this.cluster.setMap(null);
        }
        this.cluster = null;
        this.activeMarkers.clear();
    }
}

export default MarkerManager;
