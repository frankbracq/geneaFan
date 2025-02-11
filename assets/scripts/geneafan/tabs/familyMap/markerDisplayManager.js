import { MarkerClusterer, SuperClusterAlgorithm } from "@googlemaps/markerclusterer";
class MarkerDisplayManager {
    constructor() {
        this.layers = new Map();
        this.cluster = null;
        this.activeMarkers = new Set();
    }

    isInitialized() {
        return this.map !== null && this.cluster !== null;
    }

    initializeCluster(map, renderFn) {
        if (this.cluster) {
            this.cluster.setMap(null);
        }
    
        this.cluster = new MarkerClusterer({
            map,
            markers: [],
            algorithm: new SuperClusterAlgorithm({
                radius: 80,
                maxZoom: 16,
                minPoints: 2
            }),
            renderer: {
                render: ({ count, position }) => {
                    return renderFn({ count, position });
                }
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
                map: null, // Important : Initialement, le marker est "invisible"
                ...options
            });
    
            if (onClickCallback) {
                marker.addListener('click', () => onClickCallback(marker));
            }
    
            layerMarkers.set(key, marker);
            console.log(`✅ Marqueur ajouté à ${layerName}:`, key, marker);
        } else {
            console.warn(`⚠️ Marqueur déjà existant : ${key}`);
        }
    
        return layerMarkers.get(key);
    }

    addMarkersToCluster(map) {
        if (!this.isInitialized()) {
            console.warn('⚠️ Cluster ou carte non initialisée');
            return;
        }
    
        let markersToAdd = [];
        this.layers.forEach(layerMarkers => {
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
    
        this.cluster.clearMarkers();
        this.cluster.addMarkers(markersToAdd);
        console.log('✅ Markers ajoutés au cluster');
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

export default MarkerDisplayManager;
