import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { markerLogger } from './markerLogger.js';
import { infoWindowManager } from './infoWindowManager.js'; 

class MapMarkerStore {
    #positionCache = new Map();
    #worker = null;

    constructor() {
        // Structures de données principales
        this.activeMarkers = new Map();
        this.markerCluster = null;
        this.map = null;
        this.iconCache = new Map();
        this.visibleMarkers = new Set();
        this.birthData = [];

        // Configuration
        this.MARKER_CLEANUP_INTERVAL = 60000;
        this.MARKER_BATCH_SIZE = 50;
        this.BOUNDS_UPDATE_DELAY = 150;
        this.UPDATE_THROTTLE_DELAY = 100;
        this.updateThrottleTimeout = null;

        this.#initWorker();
    }

    #initWorker() {
        const workerCode = `
            self.onmessage = function(e) {
                const { birthData, bounds } = e.data;
                const visibleData = birthData.filter(birth => {
                    const pos = { lat: birth.location.lat, lng: birth.location.lng };
                    return bounds.south <= pos.lat && pos.lat <= bounds.north &&
                           bounds.west <= pos.lng && pos.lng <= bounds.east;
                });
                self.postMessage(visibleData);
            };
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.#worker = new Worker(URL.createObjectURL(blob));
        
        this.#worker.onmessage = (e) => {
            this.processBirthDataBatch(e.data, 0);
        };
    }

    initialize(map) {
        const startTime = performance.now();
        try {
            this.map = map;
            this.initializeCluster();
            this.setupMapListeners();
            this.startMarkerCleanup();

            markerLogger.logPerformance('initialization', {
                duration: performance.now() - startTime,
                status: 'success'
            });
        } catch (error) {
            markerLogger.logMarkerError(error, { context: 'initialization' });
        }
    }

    initializeCluster() {
        this.markerCluster = new MarkerClusterer({
            map: this.map,
            renderer: {
                render: this.renderCluster.bind(this)
            }
        });
    }

    setupMapListeners() {
        if (!this.map) return;

        let boundsChangedTimeout;
        this.map.addListener('bounds_changed', () => {
            clearTimeout(boundsChangedTimeout);
            boundsChangedTimeout = setTimeout(() => this.loadVisibleMarkers(), this.BOUNDS_UPDATE_DELAY);
        });
    }

    startMarkerCleanup() {
        setInterval(() => this.cleanupInvisibleMarkers(), this.MARKER_CLEANUP_INTERVAL);
    }

    loadVisibleMarkers() {
        if (!this.map || !this.birthData.length) return;

        const bounds = this.map.getBounds();
        if (!bounds) return;

        this.#worker.postMessage({
            birthData: this.birthData,
            bounds: bounds.toJSON()
        });
    }

    processBirthDataBatch(data, startIndex) {
        const endIndex = Math.min(startIndex + this.MARKER_BATCH_SIZE, data.length);
        const batch = data.slice(startIndex, endIndex);
        const batchStartTime = performance.now();
    
        const locationMap = this.#groupBirthDataByLocation(batch);
    
        locationMap.forEach((locationData, key) => {
            if (!this.activeMarkers.has(key)) {
                const marker = this.createMarker(
                    locationData.location,
                    locationData.births,
                    locationData.generations
                );
                if (marker) {
                    this.activeMarkers.set(key, marker);
                }
            }
            this.visibleMarkers.add(key);
        });
    
        markerLogger.logPerformance('processBatch', {
            duration: performance.now() - batchStartTime,
            batchSize: batch.length,
            uniqueLocations: locationMap.size,
            startIndex,
            endIndex
        });
    
        if (endIndex < data.length) {
            requestAnimationFrame(() => {
                this.processBirthDataBatch(data, endIndex);
            });
        } else {
            this.updateCluster();
        }
    }

    cleanupInvisibleMarkers() {
        const startTime = performance.now();
        const initialCount = this.activeMarkers.size;
        
        const bounds = this.map?.getBounds();
        if (!bounds) return;

        this.activeMarkers.forEach((marker, key) => {
            const position = marker.getPosition();
            if (!bounds.contains(position) && !this.visibleMarkers.has(key)) {
                marker.setMap(null);
                this.activeMarkers.delete(key);
            }
        });

        markerLogger.logPerformance('cleanup', {
            duration: performance.now() - startTime,
            removedMarkers: initialCount - this.activeMarkers.size,
            remainingMarkers: this.activeMarkers.size
        });
    }

    getMarkerPosition(lat, lng) {
        const key = `${lat}-${lng}`;
        if (!this.#positionCache.has(key)) {
            this.#positionCache.set(key, new google.maps.LatLng(lat, lng));
        }
        return this.#positionCache.get(key);
    }

    createMarker(location, births, generations) {
        const startTime = performance.now();
        const lat = parseFloat(location.lat);
        const lng = parseFloat(location.lng);
    
        if (isNaN(lat) || isNaN(lng)) {
            markerLogger.logMarkerError(new Error('Coordonnées invalides'), { location });
            return null;
        }

        try {
            const scale = births.length === 1 ? 8 : Math.min(8 + (births.length * 0.5), 12);
            const color = infoWindowManager.getBranchColor(births);
            const position = this.getMarkerPosition(lat, lng);
            
            const marker = new google.maps.Marker({
                position,
                map: this.map,
                birthData: births,
                icon: this.getCachedIcon(color, scale)
            });

            marker.addListener('click', () => {
                infoWindowManager.initialize(); 
                infoWindowManager.showInfoWindow(marker, location, births, generations);
            });

            markerLogger.logMarkerCreation({ location, births, generations }, 
                performance.now() - startTime);

            return marker;
        } catch (error) {
            markerLogger.logMarkerError(error, { location, births });
            return null;
        }
    }

    updateMarkers(birthData, isTimelineActive = true, currentYear = null) {
        if (this.updateThrottleTimeout) {
            clearTimeout(this.updateThrottleTimeout);
        }

        this.updateThrottleTimeout = setTimeout(() => {
            this.#performUpdate(birthData, isTimelineActive, currentYear);
        }, this.UPDATE_THROTTLE_DELAY);
    }

    #performUpdate(birthData, isTimelineActive, currentYear) {
        const startTime = performance.now();
        
        this.birthData = birthData;
        this.clearMarkers();
        this.visibleMarkers.clear();
        
        requestAnimationFrame(() => {
            this.loadVisibleMarkers();
        });

        markerLogger.logPerformance('updateMarkers', {
            duration: performance.now() - startTime,
            dataSize: birthData.length,
            timelineActive: isTimelineActive,
            year: currentYear
        });
    }

    clearMarkers() {
        const startTime = performance.now();
        const count = this.activeMarkers.size;

        this.activeMarkers.forEach(marker => marker.setMap(null));
        this.activeMarkers.clear();
        
        if (this.markerCluster) {
            this.markerCluster.clearMarkers();
        }

        markerLogger.logPerformance('clearMarkers', {
            duration: performance.now() - startTime,
            clearedCount: count
        });
    }

    updateCluster() {
        const startTime = performance.now();
        const markers = Array.from(this.activeMarkers.values()).filter(Boolean);
        
        if (this.markerCluster) {
            this.markerCluster.clearMarkers();
            this.markerCluster.addMarkers(markers);
        }

        markerLogger.logPerformance('updateCluster', {
            duration: performance.now() - startTime,
            markerCount: markers.length
        });
    }

    // Méthodes utilitaires
    getMarkerKey(location) {
        return `${location.lat}-${location.lng}-${location.name}`;
    }

    getCachedIcon(color, scale) {
        const key = `${color}-${scale}`;
        if (!this.iconCache.has(key)) {
            this.iconCache.set(key, {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 1,
                strokeWeight: 1,
                strokeColor: '#1e40af',
                scale: scale
            });
        }
        return this.iconCache.get(key);
    }

    renderCluster({ count, position, markers }) {
        const paternalCount = markers.filter(m => 
            infoWindowManager.determineBranchFromSosa(m.birthData?.[0]?.sosa) === 'paternal'
        ).length;
        
        const color = paternalCount === markers.length ? infoWindowManager.styles.colors.paternal : 
                     paternalCount === 0 ? infoWindowManager.styles.colors.maternal : 
                     infoWindowManager.styles.colors.mixed;

        return new google.maps.Marker({
            position,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 0.9,
                strokeWeight: 1,
                strokeColor: color,
                scale: Math.min(count * 3, 20)
            },
            label: {
                text: String(count),
                color: 'white',
                fontSize: '12px'
            },
            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
        });
    }

    getBounds() {
        if (this.activeMarkers.size === 0) return null;

        const bounds = new google.maps.LatLngBounds();
        this.activeMarkers.forEach(marker => {
            if (marker) {
                bounds.extend(marker.getPosition());
            }
        });
        return bounds;
    }

    hasActiveMarkers() {
        return this.activeMarkers.size > 0;
    }

    #groupBirthDataByLocation(data) {
        const groups = new Map();
        
        data.forEach(birth => {
            if (!birth.location?.lat || !birth.location?.lng || !birth.location?.name) {
                console.warn(`Données de localisation invalides pour ${birth.name}`);
                return;
            }
            
            const key = `${birth.location.lat}-${birth.location.lng}-${birth.location.name}`;
            
            if (!groups.has(key)) {
                groups.set(key, {
                    location: birth.location,
                    births: [],
                    generations: {}
                });
            }
            
            const group = groups.get(key);
            group.births.push(birth);
            
            if (!group.generations[birth.generation]) {
                group.generations[birth.generation] = [];
            }
            group.generations[birth.generation].push(birth);
        });
        
        return groups;
    }

    cleanup() {
        this.clearMarkers();
        this.#positionCache.clear();
        if (this.#worker) {
            this.#worker.terminate();
            this.#worker = null;
        }
        clearTimeout(this.updateThrottleTimeout);
        this.updateThrottleTimeout = null;
    }

    // Debug methods
    getDebugInfo() {
        return {
            activeMarkersCount: this.activeMarkers.size,
            visibleMarkersCount: this.visibleMarkers.size,
            iconCacheSize: this.iconCache.size,
            positionCacheSize: this.#positionCache.size,
            birthDataCount: this.birthData.length,
            hasMap: !!this.map,
            hasClusterer: !!this.markerCluster,
            hasWorker: !!this.#worker,
            memoryUsage: markerLogger.getMemoryUsage()
        };
    }
}

export const mapMarkerStore = new MapMarkerStore()