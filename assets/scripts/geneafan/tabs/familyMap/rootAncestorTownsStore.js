/*
Se concentre uniquement sur les villes des ancêtres de l'individu racine
Ne traite que les événements de naissance
Fournit le calque principal pour visualiser l'ascendance
*/

import { makeObservable, observable, action, autorun, toJS } from '../../common/stores/mobx-config.js';
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { markerLogger } from './markerLogger.js';
import { infoWindowManager } from './infoWindowManager.js';

class RootAncestorTownsStore {
    #positionCache = new Map();
    #worker = null;
    #pendingData = [];
    #isGoogleMapsReady = false;

    constructor() {
        // Structures principales
        this.activeMarkers = new Map();
        this.markerCluster = null;
        this.map = null;
        this.iconCache = new Map();
        this.visibleMarkers = new Set();
        this.birthData = [];
        this.isVisible = true;

        // Configuration
        this.MARKER_CLEANUP_INTERVAL = 60000;
        this.MARKER_BATCH_SIZE = 50;
        this.BOUNDS_UPDATE_DELAY = 150;
        this.UPDATE_THROTTLE_DELAY = 100;
        this.updateThrottleTimeout = null;

        makeObservable(this, {
            activeMarkers: observable,
            visibleMarkers: observable,
            birthData: observable,
            map: observable.ref,
            markerCluster: observable.ref,
            iconCache: observable,
            isVisible: observable,

            initialize: action,
            updateMarkers: action,
            clearMarkers: action,
            processBirthDataBatch: action,
            createMarker: action,
            loadVisibleMarkers: action,
            updateCluster: action,
            cleanupInvisibleMarkers: action,
            toggleVisibility: action,
        });

        this.#initWorker();

        autorun(() => {
            if (this.markerCluster) {
                if (this.activeMarkers.size && this.isVisible) {
                    this.updateCluster();
                } else {
                    this.markerCluster.clearMarkers();
                }
            }
        });
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
            this.#isGoogleMapsReady = true;
            this.initializeCluster();
            this.setupMapListeners();
            this.startMarkerCleanup();
            
            if (this.#pendingData.length > 0) {
                this.processPendingData();
            }

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
            map: this.isVisible ? this.map : null,
            renderer: {
                render: this.renderCluster.bind(this)
            }
        });
    }

    toggleVisibility = (visible) => {
        this.isVisible = visible;
        if (this.markerCluster) {
            this.markerCluster.setMap(visible ? this.map : null);
        }
        this.activeMarkers.forEach(marker => {
            // Mettre à jour la visibilité du marker
            marker.visible = visible;
            const element = marker.content;
            if (element) {
                element.style.display = visible ? 'flex' : 'none';
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
        console.log('📍 loadVisibleMarkers avec:', {
            hasMap: !!this.map,
            dataCount: this.birthData?.length
        });
    
        if (!this.map || !this.birthData.length) {
            console.log('⚠️ Conditions non remplies pour charger les markers');
            return;
        }
    
        const bounds = this.map.getBounds();
        if (!bounds) {
            console.log('⚠️ Pas de bounds disponibles');
            return;
        }
    
        console.log('✉️ Envoi des données au worker');
        this.#worker.postMessage({
            birthData: toJS(this.birthData),
            bounds: bounds.toJSON()
        });
    }

    processBirthDataBatch(data, startIndex) {
        console.log('📦 Traitement du batch:', {
            dataLength: data?.length,
            startIndex
        });
    
        const endIndex = Math.min(startIndex + this.MARKER_BATCH_SIZE, data.length);
        const batch = data.slice(startIndex, endIndex);
        const batchStartTime = performance.now();

        const locationMap = this.#groupBirthDataByLocation(batch);
    console.log('🗺️ Locations trouvées:', locationMap.size);

    locationMap.forEach((locationData, key) => {
        if (!this.activeMarkers.has(key)) {
            console.log('🎯 Création marker pour:', key);
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
        }
    }

    cleanupInvisibleMarkers() {
        const startTime = performance.now();
        const initialCount = this.activeMarkers.size;

        const bounds = this.map?.getBounds();
        if (!bounds) return;

        this.activeMarkers.forEach((marker, key) => {
            // Utiliser marker.position au lieu de getPosition()
            const position = marker.position;
            if (!bounds.contains(position) && !this.visibleMarkers.has(key)) {
                // Pour AdvancedMarkerElement, on met map à null pour le retirer
                marker.map = null;
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
            console.log('Création d\'un marker:', { location, births });  // Log de débogage
    
            const scale = births.length === 1 ? 8 : Math.min(8 + (births.length * 0.5), 12);
            const color = infoWindowManager.getBranchColor(births);
            const position = this.getMarkerPosition(lat, lng);
    
            const element = document.createElement('div');
            element.className = 'custom-marker';
    
            const marker = new google.maps.marker.AdvancedMarkerElement({
                position,
                map: this.map,
                content: element,
                title: births.map(b => b.name).join(', ')
            });
    
            // Stocker explicitement les données sur le marker lui-même
            marker.locationData = location;
            marker.birthsData = births;
            marker.generationsData = generations;
    
            // Style du marker
            element.style.background = color;
            element.style.borderRadius = '50%';
            element.style.width = `${scale * 2}px`;
            element.style.height = `${scale * 2}px`;
            element.style.border = '1px solid #1e40af';
            element.style.cursor = 'pointer'; // Ajout du curseur pointer
    
            // Ajouter l'événement click explicitement sur l'élément
            element.addEventListener('click', () => {
                console.log('Click sur le marker:', { lat, lng, births }); // Log de débogage
                infoWindowManager.initialize();
                infoWindowManager.showInfoWindow(marker, marker.locationData, marker.birthsData, marker.generationsData);
            });
    
            // Ajouter aussi l'événement sur le marker
            marker.addListener('click', () => {
                console.log('Click sur le marker (via Google Maps):', { lat, lng, births }); // Log de débogage
                infoWindowManager.initialize();
                infoWindowManager.showInfoWindow(marker, marker.locationData, marker.birthsData, marker.generationsData);
            });
    
            markerLogger.logMarkerCreation(
                { location, births, generations },
                performance.now() - startTime
            );
    
            return marker;
        } catch (error) {
            markerLogger.logMarkerError(error, { location, births });
            return null;
        }
    }

    processPendingData() {
        while (this.#pendingData.length > 0) {
            const { birthData, isTimelineActive, currentYear } = this.#pendingData.shift();
            this.#performUpdate(birthData, isTimelineActive, currentYear);
        }
    }

    updateMarkers(birthData, isTimelineActive = true, currentYear = null) {
        console.log('🏁 updateMarkers appelé avec:', { 
            dataCount: birthData?.length,
            isTimelineActive,
            currentYear
        });
    
        if (!this.#isGoogleMapsReady) {
            console.log('⏳ Google Maps pas prêt, mise en attente des données');
            this.#pendingData.push({ birthData, isTimelineActive, currentYear });
            return;
        }
    
        if (this.updateThrottleTimeout) {
            clearTimeout(this.updateThrottleTimeout);
        }
    
        this.updateThrottleTimeout = setTimeout(() => {
            this.#performUpdate(birthData, isTimelineActive, currentYear);
        }, this.UPDATE_THROTTLE_DELAY);
    }
    
    #performUpdate(birthData, isTimelineActive, currentYear) {
        console.log('🔄 Début de performUpdate avec:', {
            dataCount: birthData?.length
        });
    
        this.birthData = birthData;
        this.clearMarkers();
        this.visibleMarkers.clear();
    
        requestAnimationFrame(() => {
            console.log('🎯 Chargement des markers visibles...');
            this.loadVisibleMarkers();
        });
    }

    cleanup() {
        this.clearMarkers();
        this.#positionCache.clear();
        this.#pendingData = [];
        this.#isGoogleMapsReady = false;
        if (this.#worker) {
            this.#worker.terminate();
            this.#worker = null;
        }
        clearTimeout(this.updateThrottleTimeout);
        this.updateThrottleTimeout = null;
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
        const paternalCount = markers.filter(m => {
            const element = m.content;
            return element && element.births &&
                infoWindowManager.determineBranchFromSosa(element.births[0]?.sosa) === 'paternal';
        }).length;

        const color = paternalCount === markers.length ? infoWindowManager.styles.colors.paternal :
            paternalCount === 0 ? infoWindowManager.styles.colors.maternal :
                infoWindowManager.styles.colors.mixed;

        const element = document.createElement('div');
        element.className = 'cluster-marker';
        element.style.background = color;
        element.style.borderRadius = '50%';
        element.style.width = `${Math.min(count * 3, 20) * 2}px`;
        element.style.height = `${Math.min(count * 3, 20) * 2}px`;
        element.style.border = `1px solid ${color}`;
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.style.color = 'white';
        element.style.fontSize = '12px';
        element.textContent = String(count);

        return new google.maps.marker.AdvancedMarkerElement({
            position,
            content: element,
            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count
        });
    }

    getBounds() {
        if (this.activeMarkers.size === 0) return null;

        const bounds = new google.maps.LatLngBounds();
        this.activeMarkers.forEach(marker => {
            if (marker) {
                // Utiliser marker.position au lieu de getPosition()
                bounds.extend(marker.position);
            }
        });
        return bounds;
    }

    hasActiveMarkers() {
        return this.activeMarkers.size > 0;
    }

    #groupBirthDataByLocation(data) {
        return new Map(
            data.reduce((acc, birth) => {
                if (!birth.location?.lat || !birth.location?.lng || !birth.location?.name) {
                    console.warn(`Données de localisation invalides pour ${birth.name}`);
                    return acc;
                }

                const key = `${birth.location.lat}-${birth.location.lng}-${birth.location.name}`;
                const existing = acc.get(key) || {
                    location: birth.location,
                    births: [],
                    generations: {}
                };

                existing.births.push(birth);
                existing.generations[birth.generation] =
                    [...(existing.generations[birth.generation] || []), birth];

                return acc.set(key, existing);
            }, new Map())
        );
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

export const rootAncestorTownsStore = new RootAncestorTownsStore();