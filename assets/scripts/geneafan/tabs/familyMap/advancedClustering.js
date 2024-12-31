import { MarkerClusterer } from "@googlemaps/markerclusterer";

class SpatialIndex {
    constructor() {
        this.grid = new Map();
        this.cellSize = 0.1; // Taille de la cellule en degrés
    }

    getCellKey(lat, lng) {
        const x = Math.floor(lng / this.cellSize);
        const y = Math.floor(lat / this.cellSize);
        return `${x}:${y}`;
    }

    insert(marker) {
        const pos = marker.getPosition();
        const key = this.getCellKey(pos.lat(), pos.lng());
        if (!this.grid.has(key)) {
            this.grid.set(key, new Set());
        }
        this.grid.get(key).add(marker);
    }

    query(bounds) {
        const minKey = this.getCellKey(bounds.getSouthWest().lat(), bounds.getSouthWest().lng());
        const maxKey = this.getCellKey(bounds.getNorthEast().lat(), bounds.getNorthEast().lng());
        const [minX, minY] = minKey.split(':').map(Number);
        const [maxX, maxY] = maxKey.split(':').map(Number);

        const markers = new Set();
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = `${x}:${y}`;
                const cell = this.grid.get(key);
                if (cell) {
                    cell.forEach(marker => markers.add(marker));
                }
            }
        }
        return markers;
    }

    clear() {
        this.grid.clear();
    }
}

class AdvancedClusterer {
    constructor(map) {
        this.map = map;
        this.spatialIndex = new SpatialIndex();
        this.zoomClusters = new Map();
        this.currentClusters = new Set();
        this.markerClusterer = null;
        this.clusterCache = new Map();
        
        this.setupClusterer();
        this.setupZoomListener();
    }

    setupClusterer() {
        this.markerClusterer = new MarkerClusterer({
            map: this.map,
            algorithm: this.customAlgorithm.bind(this)
        });
    }

    setupZoomListener() {
        this.map.addListener('zoom_changed', () => {
            this.updateClustersForZoom();
        });
    }

    customAlgorithm(markers) {
        const zoom = this.map.getZoom();
        const bounds = this.map.getBounds();
        
        if (!bounds) return [];

        // Utiliser le cache si disponible
        const cacheKey = `${zoom}-${bounds.toString()}`;
        if (this.clusterCache.has(cacheKey)) {
            return this.clusterCache.get(cacheKey);
        }

        // Paramètres de clustering adaptés au niveau de zoom
        const radius = this.getRadiusForZoom(zoom);
        const visibleMarkers = Array.from(this.spatialIndex.query(bounds));
        const clusters = this.createClusters(visibleMarkers, radius);

        // Mise en cache des résultats
        this.clusterCache.set(cacheKey, clusters);
        if (this.clusterCache.size > 100) {
            const oldestKey = this.clusterCache.keys().next().value;
            this.clusterCache.delete(oldestKey);
        }

        return clusters;
    }

    getRadiusForZoom(zoom) {
        // Ajuster le rayon de clustering en fonction du zoom
        const baseRadius = 50;
        return baseRadius * Math.pow(2, 16 - zoom);
    }

    createClusters(markers, radius) {
        const clusters = new Map();
        
        markers.forEach(marker => {
            const pos = marker.getPosition();
            let assigned = false;

            // Chercher un cluster existant à proximité
            for (const [center, cluster] of clusters) {
                if (this.distance(pos, center) <= radius) {
                    cluster.markers.push(marker);
                    assigned = true;
                    break;
                }
            }

            // Créer un nouveau cluster si nécessaire
            if (!assigned) {
                clusters.set(pos, {
                    position: pos,
                    markers: [marker]
                });
            }
        });

        // Convertir en format attendu par MarkerClusterer
        return Array.from(clusters.values()).map(cluster => ({
            position: cluster.position,
            markers: cluster.markers,
            count: cluster.markers.length
        }));
    }

    distance(pos1, pos2) {
        const R = 6371; // Rayon de la Terre en km
        const lat1 = pos1.lat() * Math.PI / 180;
        const lat2 = pos2.lat() * Math.PI / 180;
        const dLat = lat2 - lat1;
        const dLon = (pos2.lng() - pos1.lng()) * Math.PI / 180;

        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    updateClustersForZoom() {
        this.clusterCache.clear();
        if (this.markerClusterer) {
            this.markerClusterer.repaint();
        }
    }

    addMarkers(markers) {
        markers.forEach(marker => this.spatialIndex.insert(marker));
        if (this.markerClusterer) {
            this.markerClusterer.addMarkers(markers);
        }
    }

    clearMarkers() {
        this.spatialIndex.clear();
        this.clusterCache.clear();
        if (this.markerClusterer) {
            this.markerClusterer.clearMarkers();
        }
    }
}

export { AdvancedClusterer, SpatialIndex };