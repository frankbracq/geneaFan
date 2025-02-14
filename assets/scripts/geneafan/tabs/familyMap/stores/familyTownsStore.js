import { makeObservable, observable, action, computed, runInAction, autorun, toJS, isObservable } from '../../../common/stores/mobx-config.js';
import MarkerDisplayManager from '../managers/markerDisplayManager.js';
import { infoWindowDisplayManager } from '../managers/infoWindowDisplayManager.js';
import { storeEvents, EVENTS } from '../../../gedcom/stores/storeEvents.js';
import { normalizeGeoString } from "../../../utils/geo.js";
import { TownStatisticsManager } from '../../../gedcom/stores/townStatisticsManager.js';
import { infoWindowContentManager } from '../managers/infoWindowContentManager.js';

/**
 * Manage the display of all towns mentioned in the GEDCOM file
 * 
 * Key responsibilities:
 * - Manages all towns from GEDCOM file
 * - Processes all types of genealogical events (births, marriages, deaths)
 * - Provides a global context layer for the map
 * - Handles geocoding and marker management
 * - Manages caching and data persistence
 */
class FamilyTownsStore {
    constructor() {
        // Primary data storage
        this.eventsData = new Map();

        // Caching systems for performance optimization
        this.geoDataCache = null;                     // Cache for geographical data
        this.markerConfigs = new Map();               // Stores marker configurations by town
        this.infoWindowContentCache = new Map();      // Caches info window HTML content

        // Core infrastructure
        this.markerDisplayManager = new MarkerDisplayManager();
        this.townsData = new Map();                   // Primary town data storage
        this.disposers = new Map();                   // Cleanup handlers

        // State management
        this.isLoading = false;
        this.isVisible = false;
        this.map = null;

        // Observable event collections by type
        this.events = observable({
            birth: observable([]),    
            death: observable([]),    
            marriage: observable([]), 
            burial: observable([]),   
            occupation: observable([]),
            event: observable([]) 
        });
    
        // MobX configuration
        makeObservable(this, {
            townsData: observable,
            isLoading: observable,
            isVisible: observable,
            events: observable,
            updateTownsViaProxy: action,
            setIsLoading: action,
            setTownsData: action,
            addOrUpdateTown: action,         
            updateTown: action,
            toggleVisibility: action,
            clearAllTowns: action,
            updateTownEventsForIndividual: action,
            finalizeAllTownsData: action,
            recalculateAllTownsStatistics: action,
            totalTowns: computed
        });
    
        // Automatic marker updates when data changes
        autorun(() => {
            if (this.map && (this.townsData.size > 0 || this.isVisible)) {
                this.updateMarkers();
            }
        });
    
        this.setupEventSubscriptions();
    }

    /**
     * Sets up event listeners for GEDCOM data processing
     * Handles bulk individual additions, cache events, and cleanup
     */
    setupEventSubscriptions() {
        // Handle bulk addition of individuals
        const bulkIndividualsDisposer = storeEvents.subscribe(
            EVENTS.INDIVIDUALS.BULK_ADDED,
            
            (individuals) => {
                console.time('processAllTownsEvents');
    
                runInAction(() => {
                    const townUpdates = new Map();
                    console.time('processIndividuals');
    
                    const validEventTypes = ['birth', 'death', 'marriage'];
    
                    // Process each individual's events
                    individuals.forEach(([id, individual]) => {
                        individual.individualEvents?.forEach(event => {
                            if (!validEventTypes.includes(event.type)) return;
                            if (!event.town) return;
    
                            const normalizedTownName = normalizeGeoString(event.town);
                            if (normalizedTownName === 'lieu_inconnu') return;
    
                            // Initialize town data if needed
                            if (!townUpdates.has(normalizedTownName)) {
                                townUpdates.set(normalizedTownName, {
                                    townData: {
                                        town: event.town,
                                        townDisplay: event.town
                                    },
                                    events: []
                                });
                            }
    
                            // Enrich event with individual details
                            const enrichedEvent = {
                                type: event.type,
                                date: event.date,
                                personId: individual.id,
                                personDetails: {
                                    name: individual.name,
                                    surname: individual.surname,
                                    gender: individual.gender,
                                    birthDate: individual.birthDate,
                                    deathDate: individual.deathDate,
                                    birthPlace: individual.fanBirthPlace,
                                    deathPlace: individual.fanDeathPlace,
                                    occupation: individual.occupation
                                }
                            };
    
                            townUpdates.get(normalizedTownName).events.push(enrichedEvent);
                        });
                    });
    
                    console.timeEnd('processIndividuals');
                    console.time('applyTownUpdates');
    
                    // Apply accumulated updates
                    townUpdates.forEach((updateData, normalizedTownName) => {
                        this.addOrUpdateTown(normalizedTownName, updateData.townData);
                        const town = this.townsData.get(normalizedTownName);
                        if (town) {
                            updateData.events.forEach(event => {
                                this.updateTownEvents(town, event);
                            });
                        }
                    });
    
                    console.timeEnd('applyTownUpdates');
                });
    
                console.timeEnd('processAllTownsEvents');
            }
        );
    
        // Handle cache build completion
        const cacheDisposer = storeEvents.subscribe(
            EVENTS.CACHE.BUILT,
            () => {
                console.log('🔄 Cache built received');
                this.finalizeAllTownsData();
            }
        );
    
        // Handle cache clearing
        const clearDisposer = storeEvents.subscribe(EVENTS.CACHE.CLEARED, () => {
            console.log('🧹 Clearing town data');
            this.clearAllTowns();
        });
    
        // Store disposers for cleanup
        this.disposers.set('bulkIndividuals', bulkIndividualsDisposer);
        this.disposers.set('cache', cacheDisposer);
        this.disposers.set('clear', clearDisposer);
    }    

    /**
     * Creates marker configuration for a town
     * @param {string} townName - Normalized town name
     * @param {Object} townData - Town data including coordinates
     * @returns {Object|null} Marker configuration or null if invalid data
     */
    createMarkerConfig(townName, townData) {
        if (!townData?.latitude || !townData?.longitude) {
            console.warn(`⚠️ Invalid town data for ${townName}`);
            return null;
        }

        const config = {
            position: new google.maps.LatLng(
                Number(townData.latitude), 
                Number(townData.longitude)
            ),
            options: {
                content: this.createMarkerElement(townData),
                title: townData.townDisplay || townData.town
            }
        };
        
        this.markerConfigs.set(townName, config);
        return config;
    }

    createMarkerElement(townData) {
        const div = document.createElement('div');
        div.className = 'family-town-marker';
        div.style.cssText = `
            background: #4B5563;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        div.innerHTML = `<span>${townData.events.length}</span>`;
        return div;
    }

    getOrCreateMarker(townName, townData) {
        if (!townData) {
            console.warn(`⚠️ Données manquantes pour la ville ${townName}`);
            return null;
        }

        let config = this.markerConfigs.get(townName);
    
        if (!config) {
            config = this.createMarkerConfig(townName, townData);
            if (!config) return null;
        }
    
        return this.markerDisplayManager.addMarker(
            'familyTowns',
            townName,
            config.position,
            config.options,
            (marker) => this.handleMarkerClick(marker, townName)
        );
    }

    // Event Handling
    updateTownEventsForIndividual(individual) {
        individual.individualEvents?.forEach(event => {
            if (!event.town) return;
            
            const normalizedTownName = normalizeGeoString(event.town);
            if (!normalizedTownName) return;
    
            const enrichedEvent = {
                type: event.type,
                date: event.date,
                personId: individual.id,
                personDetails: {
                    name: individual.name,
                    surname: individual.surname,
                    gender: individual.gender,
                    birthDate: individual.birthDate,
                    deathDate: individual.deathDate,
                    birthPlace: individual.fanBirthPlace,
                    deathPlace: individual.fanDeathPlace,
                    occupation: individual.occupation
                }
            };
    
            storeEvents.emit(EVENTS.TOWN.UPDATED, {
                townKey: normalizedTownName,
                event: enrichedEvent
            });
    
            this.addOrUpdateTown(normalizedTownName, { 
                town: event.town,
                townDisplay: event.town
            }, enrichedEvent);
        });
    }

    // Town Data Management
    addOrUpdateTown(normalizedTownName, townData, eventData = null) {
        // console.log('📍 addOrUpdateTown - Début', {
        //    normalizedTownName,
        //    townData,
        //    eventData
        //});
        
        if (!normalizedTownName || !townData) {
            console.warn('⚠️ Données manquantes:', { normalizedTownName, townData });
            return;
        }
    
        runInAction(() => {
            let town = this.townsData.get(normalizedTownName);
    
            if (!town) {
                const eventTypes = {
                    BIRT: observable([]),
                    DEAT: observable([]),
                    MARR: observable([]),
                    BURI: observable([]),
                    OCCU: observable([]),
                    EVEN: observable([]),
                    birth: observable([]),
                    death: observable([]),
                    marriage: observable([]),
                    burial: observable([]),
                    occupation: observable([]),
                    event: observable([])
                };
    
                town = observable({
                    town: townData.town || '',
                    townDisplay: townData.townDisplay || townData.town || '',
                    departement: townData.departement || '',
                    departementColor: townData.departementColor || '',
                    country: townData.country || '',
                    countryCode: townData.countryCode || '',
                    countryColor: townData.countryColor || '',
                    latitude: townData.latitude || '',
                    longitude: townData.longitude || '',
                    events: eventTypes,
                    statistics: TownStatisticsManager.createEmptyStatistics()
                });
                
                // console.log('🆕 Création nouvelle ville:', toJS(town));
                this.townsData.set(normalizedTownName, town);
            } else {
                // console.log('📝 Mise à jour ville existante:', normalizedTownName);
                
                if (!town.events || !isObservable(town.events)) {
                    town.events = observable({
                        BIRT: observable([]),
                        DEAT: observable([]),
                        MARR: observable([]),
                        BURI: observable([]),
                        OCCU: observable([]),
                        EVEN: observable([]),
                        birth: observable([]),
                        death: observable([]),
                        marriage: observable([]),
                        burial: observable([]),
                        occupation: observable([]),
                        event: observable([])
                    });
                }
                
                Object.entries(townData).forEach(([field, value]) => {
                    if (value !== undefined && value !== null && field !== 'events') {
                        town[field] = value;
                    }
                });
            }
    
            if (eventData) {
                console.log('🎯 Traitement événement pour', normalizedTownName, eventData);
                this.invalidateCache(normalizedTownName);
                this.updateTownEvents(town, eventData);
            }
            
            // console.log('✅ Fin addOrUpdateTown pour', normalizedTownName);
        });
    }

    updateExistingTownData(town, updates) {
        Object.entries(updates).forEach(([field, value]) => {
            if (value !== undefined && value !== null) {
                town[field] = value;
            }
        });
    }

    // Cache Management
    invalidateCache(normalizedTownName) {
        this.infoWindowContentCache.delete(normalizedTownName);
        this.markerConfigs.delete(normalizedTownName);
    }

    clearAllCaches() {
        this.markerConfigs.clear();
        this.infoWindowContentCache.clear();
    }

    // Marker Management
    createMarkerContent(color = '#4B5563') {
        const element = document.createElement('div');
        element.className = 'town-marker';
        element.style.cssText = `
            background: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid white;
        `;
        return element;
    }

    updateMarkers() {
        if (!this.map) return;

        if (!this.markerDisplayManager.isInitialized()) {
            this.markerDisplayManager.initializeCluster(this.map, this.createClusterMarker);
        }

        this.townsData.forEach((townData, townName) => {
            this.getOrCreateMarker(townName, townData);
        });

        this.markerDisplayManager.toggleLayerVisibility('familyTowns', true, this.map);
    }

    // Visibility Management
    toggleVisibility(visible) {
        if (visible) {
            this.updateMarkers();
        } else {
            this.markerDisplayManager.toggleLayerVisibility('familyTowns', false, this.map);
        }
    }

    // Stats and Data Management
    recalculateAllTownsStatistics() {
        runInAction(() => {
            console.log('🏘️ Début du recalcul des statistiques');
    
            let totalEvents = {
                births: 0,
                deaths: 0,
                marriages: 0
            };
    
            this.townsData.forEach((town, normalizedTownName) => {
                try {
                    town.statistics = TownStatisticsManager.createEmptyStatistics();
                    ['birth', 'death', 'marriage'].forEach(eventType => {
                        if (!town.events || !Array.isArray(town.events[eventType])) {
                            console.warn(`Données manquantes pour ${eventType} dans ${normalizedTownName}`);
                            return;
                        }
    
                        const eventCount = town.events[eventType].length;
                        totalEvents[eventType + 's'] += eventCount;
    
                        town.events[eventType].forEach(event => {
                            if (event) TownStatisticsManager.updateTownStatistics(town, event);
                        });
    
                        // console.log(`📊 ${normalizedTownName}:`,
                        //    JSON.stringify({
                        //        events: {
                        //            births: town.events.birth?.length || 0,
                        //            deaths: town.events.death?.length || 0,
                        //            marriages: town.events.marriage?.length || 0
                        //        },
                        //        stats: toJS(town.statistics)
                        //    }, null, 2)
                        // );
                    });
                } catch (error) {
                    console.error(`Erreur: ${normalizedTownName}:`, error);
                }
            });
    
            console.log('📊 Total des événements:', totalEvents);
        });
    }

    finalizeAllTownsData() {
        console.log('🏁 Début finalizeAllTownsData');
        this.recalculateAllTownsStatistics(); 
        this.clearAllCaches();
        console.log('✅ Fin finalizeAllTownsData'); 
        
        // Mettre à jour les marqueurs après la finalisation des données
        if (this.map) {
            console.log('📍 Mise à jour des marqueurs après finalisation');
            this.updateMarkers();
        }
        
        this.saveToLocalStorage();
    }

    // Utility Methods
    hasActiveMarkers() {
        if (!this.markerDisplayManager) return false;
        let hasMarkers = false;
        this.markerDisplayManager.layers.forEach(layerMarkers => {
            layerMarkers.forEach(marker => {
                if (marker.map !== null) {
                    hasMarkers = true;
                }
            });
        });
        return hasMarkers;
    }

    getBounds() {
        if (!this.markerDisplayManager) return null;
        
        const bounds = new google.maps.LatLngBounds();
        let hasMarkers = false;

        this.markerDisplayManager.layers.forEach(layerMarkers => {
            layerMarkers.forEach(marker => {
                if (marker.map !== null) {
                    bounds.extend(marker.position);
                    hasMarkers = true;
                }
            });
        });

        return hasMarkers ? bounds : null;
    }

    cleanData(data) {
        return JSON.parse(JSON.stringify(data));
    }

    // Storage Management
    loadFromLocalStorage = () => {
        try {
            const stored = localStorage.getItem('townsDB');
            if (!stored) return {};
    
            const parsed = JSON.parse(stored);
            const validTowns = {};
            const invalidKeys = [];
    
            Object.entries(parsed).forEach(([key, townData]) => {
                if (!this._isValidTownData(townData)) {
                    invalidKeys.push(key);
                    return;
                }
                validTowns[key] = townData;
            });
    
            if (invalidKeys.length > 0) {
                const newCache = {...parsed};
                invalidKeys.forEach(key => delete newCache[key]);
                localStorage.setItem('townsDB', JSON.stringify(newCache));
            }
    
            this.setTownsData(validTowns);
            return validTowns;
        } catch (error) {
            console.error('Erreur lors du chargement depuis localStorage:', error);
            this.setTownsData({});
            return {};
        }
    }
    
    _isValidTownData(townData) {
        return townData && 
               townData.town && 
               typeof townData.town === 'string' &&
               townData.latitude && 
               !isNaN(townData.latitude) &&
               townData.longitude && 
               !isNaN(townData.longitude);
    }

    getStorageData() {
        const result = {};
        this.townsData.forEach((townData, key) => {
            result[key] = {
                town: townData.town,
                townDisplay: townData.townDisplay,
                departement: townData.departement,
                departementColor: townData.departementColor,
                country: townData.country,
                countryCode: townData.countryCode,
                countryColor: townData.countryColor,
                latitude: townData.latitude,
                longitude: townData.longitude
            };
        });
        return result;
    }

    saveToLocalStorage() {
        try {
            const storageData = {};
            this.townsData.forEach((townData, key) => {
                storageData[key] = {
                    town: townData.town,
                    townDisplay: townData.townDisplay,
                    departement: townData.departement,
                    departementColor: townData.departementColor,
                    country: townData.country,
                    countryCode: townData.countryCode,
                    countryColor: townData.countryColor,
                    latitude: townData.latitude,
                    longitude: townData.longitude
                };
            });
            localStorage.setItem('townsDB', JSON.stringify(storageData));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    // Proxy Update Management
    async updateTownsViaProxy(townsToUpdate = null) {
        if (this.isLoading) {
            console.warn("⚠️ Une mise à jour est déjà en cours");
            return;
        }
    
        try {
            console.log('🔄 Début de la mise à jour via proxy');
            this.setIsLoading(true);
            
            console.log('📣 Émission de UPDATE_START');
            storeEvents.emit(EVENTS.TOWN.UPDATE_START);
    
            const updates = townsToUpdate || this._collectTownsNeedingUpdate();
            
            if (Object.keys(updates).length === 0) {
                console.log('ℹ️ Aucune ville à mettre à jour');
                console.log('📣 Émission de UPDATE_COMPLETE');
                storeEvents.emit(EVENTS.TOWN.UPDATE_COMPLETE);
                return;
            }
    
            console.log(`🔄 Mise à jour de ${Object.keys(updates).length} villes`);
    
            const response = await fetch('https://opencageproxy.genealogie.workers.dev/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    familyTowns: updates,
                    userId: localStorage.getItem('userId')
                })
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const updatedTowns = await response.json();
            console.log('✅ Données reçues du proxy:', Object.keys(updatedTowns).length);
    
            runInAction(() => {
                Object.entries(updatedTowns).forEach(([key, data]) => {
                    // Ne stocker que les villes avec coordonnées valides
                    if (data.latitude && data.longitude) {
                        this.updateTown(key, data);
                    }
                });
                this.saveToLocalStorage();
            });
    
            console.log('📣 Émission de UPDATE_COMPLETE');
            storeEvents.emit(EVENTS.TOWN.UPDATE_COMPLETE);
            
        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour:', error);
            console.log('📣 Émission de UPDATE_ERROR');
            storeEvents.emit(EVENTS.TOWN.UPDATE_ERROR, error);
            throw error;
        } finally {
            this.setIsLoading(false);
            console.log('✅ Fin de updateTownsViaProxy');
        }
    }

    // Nouvelle méthode auxiliaire pour identifier les villes à mettre à jour
_collectTownsNeedingUpdate() {
    const updates = {};
    this.townsData.forEach((town, key) => {
        if (!town.latitude || !town.longitude || !town.departement || !town.country) {
            updates[key] = this.cleanData(town);
        }
    });
    return updates;
}

    // Cleanup and Reset
    cleanup() {
        this.clearAllCaches();
        this.markerDisplayManager.cleanup();
        this.map = null;
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
    }

    clearAllTowns() {
        runInAction(() => {
            this.townsData.clear();
            this.geoDataCache = null;
            this.eventsData.clear();
            this.clearAllCaches();
            if (this.markerDisplayManager) {
                this.markerDisplayManager.clearMarkers();
            }
        });
    }

    // Getters and Setters
    setIsLoading(loading) {
        this.isLoading = loading;
    }

    setTownsData(towns) {
        runInAction(() => {
            this.townsData = new Map(Object.entries(towns));
        });
    }

    updateTown(key, updates) {
        runInAction(() => {
            const town = this.townsData.get(key);
            if (town) {
                // console.log(`Mise à jour de la ville ${key}:`, {
                //    avant: { ...town },
                //    miseAJour: updates,
                // });
                
                // Mise à jour des propriétés
                Object.entries(updates).forEach(([field, value]) => {
                    if (value !== undefined && value !== null) {
                        town[field] = value;
                    }
                });
        
                // Si les coordonnées ou données géographiques ont été mises à jour
                if (updates.latitude || updates.longitude || 
                    updates.departement || updates.country) {
                    this.saveToLocalStorage();
                }
                
                // console.log('Après mise à jour:', this.townsData.get(key));
            } else {
                console.warn(`Tentative de mise à jour d'une ville inexistante: ${key}`);
            }
        });
    }

    getTown(key) {
        const town = this.townsData.get(key);
        return town ? this.cleanData(town) : null;
    }

    getAllTowns() {
        const result = {};
        this.townsData.forEach((townData, key) => {
            result[key] = {
                town: townData.town,
                townDisplay: townData.townDisplay,
                departement: townData.departement,
                departementColor: townData.departementColor,
                country: townData.country,
                countryColor: townData.countryColor,
                latitude: townData.latitude,
                longitude: townData.longitude,
                events: toJS(townData.events)  // Ajout des événements
            };
        });
        return result;
    }

    // Méthode pour accéder aux données géographiques
    getGeoData(townKey) {
        if (!this.geoDataCache) {
            this.geoDataCache = new Map();
            this.townsData.forEach((townData, key) => {
                this.geoDataCache.set(key, {
                    town: townData.town,
                    townDisplay: townData.townDisplay,
                    departement: townData.departement,
                    departementColor: townData.departementColor,
                    country: townData.country,
                    countryColor: townData.countryColor,
                    latitude: townData.latitude,
                    longitude: townData.longitude
                });
            });
        }
        return townKey ? this.geoDataCache.get(townKey) : Object.fromEntries(this.geoDataCache);
    }

    get totalTowns() {
        return this.townsData.size;
    }

    // Map Initialization and Management
    initialize(map) {
        console.log('🎯 Initialisation de FamilyTownsStore');
        this.map = map;
        this.markerDisplayManager.initializeCluster(map, this.createClusterMarker);

        if (!this.markerDisplayManager.isInitialized()) {
            console.warn('❌ Échec de l’init du clustering');
        }
    }

    createClusterMarker({ count, position }) {
        const div = document.createElement('div');
        div.className = 'family-cluster-marker';
        div.style.cssText = `
            background: #4B5563;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        div.innerHTML = `<span>${count}</span>`;
        
        return new google.maps.marker.AdvancedMarkerElement({
            position,
            content: div
        });
    }

    // InfoWindow Management
    handleMarkerClick(marker, normalizedTownName) {
        const townData = this.townsData.get(normalizedTownName);
        if (!townData) return;

        let content = this.infoWindowContentCache.get(normalizedTownName);
        if (!content) {
            content = infoWindowContentManager.createInfoWindowContent(
                townData.townDisplay || townData.town,
                townData
            );
            this.infoWindowContentCache.set(normalizedTownName, content);
        }

        infoWindowDisplayManager.showInfoWindow(marker, content);
    }

    /**
     * Processes and adds/updates events for a town
     * Handles event deduplication and standardization
     * @param {Object} town - Town object
     * @param {Object} eventData - Event data to process
     */
    updateTownEvents(town, eventData) {
        if (!eventData?.type || !town?.events) {
            console.log('❌ Invalid event or town structure:', { eventData, town });
            return;
        }
    
        // Standardize event types to lowercase only
        const validEventTypes = ['birth', 'death', 'marriage', 'burial', 'occupation', 'event'];
    
        if (!validEventTypes.includes(eventData.type)) {
            console.log('❌ Unrecognized event type:', eventData.type);
            return;
        }
    
        const enrichedEvent = {
            ...eventData,
            personDetails: { ...eventData.personDetails }
        };
    
        // Add or update event in standardized type
        if (!Array.isArray(town.events[eventData.type])) {
            town.events[eventData.type] = observable([]);
        }
    
        const existingIndex = town.events[eventData.type].findIndex(
            e => e.personId === enrichedEvent.personId && e.date === enrichedEvent.date
        );
    
        if (existingIndex !== -1) {
            town.events[eventData.type][existingIndex] = enrichedEvent;
        } else {
            town.events[eventData.type].push(enrichedEvent);
        }
    }
}

// Export singleton instance
export default new FamilyTownsStore();