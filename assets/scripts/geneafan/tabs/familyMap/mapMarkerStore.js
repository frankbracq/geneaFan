import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { markerLogger } from './markerLogger.js';

class MapMarkerStore {
    #positionCache = new Map();
    #worker = null;

    constructor() {
        // Structures de données principales
        this.activeMarkers = new Map();
        this.markerCluster = null;
        this.map = null;
        this.infoWindow = null;
        this.iconCache = new Map();
        this.visibleMarkers = new Set();
        this.birthData = [];

        // Configuration
        this.MARKER_CLEANUP_INTERVAL = 60000;
        this.MARKER_BATCH_SIZE = 50;
        this.BOUNDS_UPDATE_DELAY = 150;
        this.UPDATE_THROTTLE_DELAY = 100;
        this.updateThrottleTimeout = null;

        // Styles
        this.styles = {
            colors: {
                paternal: '#3b82f6',
                maternal: '#ec4899',
                mixed: '#8b5cf6'
            },
            generations: {
                0: '#1e3a8a', 1: '#1e40af', 2: '#1d4ed8',
                3: '#2563eb', 4: '#3b82f6', 5: '#60a5fa',
                6: '#93c5fd', 7: '#bfdbfe', 8: '#dbeafe',
                9: '#eff6ff'
            }
        };

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
            this.infoWindow = new google.maps.InfoWindow({ maxWidth: 400 });
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
            const color = this.getBranchColor(births);
            const position = this.getMarkerPosition(lat, lng);
            
            const marker = new google.maps.Marker({
                position,
                map: this.map,
                birthData: births,
                icon: this.getCachedIcon(color, scale)
            });

            marker.addListener('click', () => {
                this.showInfoWindow(marker, location, births, generations);
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

    showInfoWindow(marker, location, births, generations) {
        const content = this.generateInfoWindowContent({
            location,
            births,
            generations
        });

        this.infoWindow.setContent(content);
        this.infoWindow.open({
            anchor: marker,
            map: this.map
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

    getBranchColor(births) {
        const paternalCount = births.filter(b => 
            this.determineBranchFromSosa(b.sosa) === 'paternal'
        ).length;
        const total = births.length;

        if (paternalCount === total) return this.styles.colors.paternal;
        if (paternalCount === 0) return this.styles.colors.maternal;
        return this.styles.colors.mixed;
    }

    determineBranchFromSosa(sosa) {
        if (sosa === 1) return null;
        while (sosa > 3) sosa = Math.floor(sosa / 2);
        return sosa === 2 ? 'paternal' : 'maternal';
    }

    renderCluster({ count, position, markers }) {
        const paternalCount = markers.filter(m => 
            this.determineBranchFromSosa(m.birthData?.[0]?.sosa) === 'paternal'
        ).length;
        
        const color = paternalCount === markers.length ? this.styles.colors.paternal : 
                     paternalCount === 0 ? this.styles.colors.maternal : 
                     this.styles.colors.mixed;

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

    generateInfoWindowContent({ location, births, generations }) {
        return `
            <div class="info-window">
                <div class="flex flex-col space-y-4">
                    <div class="text-center">
                        <h3 class="text-lg font-semibold">${location.name}</h3>
                        ${location.departement ? 
                            `<p class="text-sm text-gray-600">${location.departement}</p>` : ''}
                        
                        <p class="mt-2 text-sm">
                            <span class="font-medium">${births.length}</span> naissances
                        </p>
                        ${this.getBranchesIndicator(births)} 
                    </div>

                    <div class="flex gap-4 justify-center items-start">
                        <div class="w-32 h-32" style="min-width: 128px;">
                            ${this.createPieChartSVG(generations, births.length)}
                        </div>
                        <div class="flex flex-col gap-2">
                            ${this.generateGenerationsLegend(generations)}
                        </div>
                    </div>

                    <div class="mt-4">
                        <h4 class="font-medium mb-2">Personnes nées dans ce lieu :</h4>
                        <div class="space-y-2 max-h-48 overflow-y-auto">
                            ${this.generatePersonsList(births)}
                        </div>
                    </div>
                </div>
            </div>`;
    }

    generateGenerationsLegend(generations) {
        return Object.entries(generations)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([gen, persons]) => {
                const count = persons ? persons.length : 0;
                return `
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3" style="background-color: ${this.styles.generations[gen]}"></div>
                        <span class="text-sm">
                            Gén. ${gen} 
                            <span class="font-medium">(${count})</span>
                        </span>
                    </div>`;
            }).join('');
    }

    generatePersonsList(births) {
        return births
            .sort((a, b) => a.birthYear - b.birthYear)
            .map(person => `
                <div class="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <div class="w-2 h-full" 
                         style="color: ${this.determineBranchFromSosa(person.sosa) === 'paternal' ? 
                                       this.styles.colors.paternal : this.styles.colors.maternal}">
                            ${person.name}
                        </div>
                        <div class="text-sm text-gray-600">
                            ${person.birthYear} • Sosa ${person.sosa}
                        </div>
                    </div>
                </div>
            `).join('');
    }

    getBranchesIndicator(births) {
        const paternalCount = births.filter(b => 
            this.determineBranchFromSosa(b.sosa) === 'paternal'
        ).length;
        const maternalCount = births.filter(b => 
            this.determineBranchFromSosa(b.sosa) === 'maternal'
        ).length;
        const total = births.length;

        const paternalWidth = (paternalCount / total) * 100;
        const maternalWidth = (maternalCount / total) * 100;

        return `
            <div class="mt-2">
                <div class="flex h-2 w-full rounded-full overflow-hidden">
                    ${paternalCount > 0 ?
                        `<div class="bg-blue-500" style="width: ${paternalWidth}%"></div>` : ''}
                    ${maternalCount > 0 ?
                        `<div class="bg-pink-500" style="width: ${maternalWidth}%"></div>` : ''}
                </div>
                <div class="flex justify-between text-xs mt-1">
                    <span class="text-blue-500">Branche paternelle: ${paternalCount}</span>
                    <span class="text-pink-500">Branche maternelle: ${maternalCount}</span>
                </div>
            </div>`;
    }

    createPieChartSVG(generations, total) {
        const size = 128;
        const center = size / 2;
        const radius = (size / 2) - 2;

        if (Object.entries(generations).length === 1) {
            return this.createSingleGenerationPie(Object.entries(generations)[0][0], size, center, radius);
        }

        return this.createMultiGenerationPie(generations, total, size, center, radius);
    }

    createSingleGenerationPie(gen, size, center, radius) {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
                <circle 
                    cx="${center}" 
                    cy="${center}" 
                    r="${radius}"
                    fill="${this.styles.generations[gen]}"
                    stroke="white"
                    stroke-width="1"
                />
            </svg>`;
    }

    createMultiGenerationPie(generations, total, size, center, radius) {
        let startAngle = 0;
        const paths = Object.entries(generations)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([gen, births]) => {
                const percentage = births.length / total;
                const angle = percentage * 360;
                const endAngle = startAngle + angle;

                const startRad = (startAngle - 90) * Math.PI / 180;
                const endRad = (endAngle - 90) * Math.PI / 180;

                const x1 = center + radius * Math.cos(startRad);
                const y1 = center + radius * Math.sin(startRad);
                const x2 = center + radius * Math.cos(endRad);
                const y2 = center + radius * Math.sin(endRad);

                const largeArcFlag = angle > 180 ? 1 : 0;
                const path = `
                    M ${center},${center}
                    L ${x1},${y1}
                    A ${radius},${radius} 0 ${largeArcFlag},1 ${x2},${y2}
                    Z`;

                startAngle += angle;

                return `
                    <path 
                        d="${path}" 
                        fill="${this.styles.generations[gen]}"
                        stroke="white"
                        stroke-width="1"
                    />`;
            }).join('');

        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
                ${paths}
            </svg>`;
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