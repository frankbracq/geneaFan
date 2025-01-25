/*
Gère l'ensemble des villes du fichier GEDCOM
Traite tous types d'événements (naissances, mariages, décès)
Fournit un calque de contexte global pour la carte
*/

import { makeObservable, observable, action, computed, runInAction, autorun, toJS, isObservable } from '../../common/stores/mobx-config.js';
import MarkerDisplayManager from '../../tabs/familyMap/markerDisplayManager.js';
import { infoWindowDisplayManager } from '../../tabs/familyMap/infoWindowDisplayManager.js';
import { storeEvents, EVENTS } from './storeEvents.js';
import { normalizeGeoString } from "../../utils/geo.js";
import { TownStatisticsManager } from './townStatisticsManager';
import { infoWindowContentManager } from './infoWindowContentManager.js';

class FamilyTownsStore {
    constructor() {
        this.eventsData = new Map();

        // Cache system
        this.geoDataCache = null;
        this.markerConfigs = new Map(); // key: normalizedTownName -> {position, options}
        this.infoWindowContentCache = new Map(); // key: normalizedTownName -> content HTML

        // Core data and managers
        this.markerDisplayManager = new MarkerDisplayManager();
        this.townsData = new Map();
        this.disposers = new Map();

        // States
        this.isLoading = false;
        this.isVisible = false;
        this.map = null;

        this.events = observable({
            birth: observable([]),    
            death: observable([]),    
            marriage: observable([]), 
            burial: observable([]),   
            occupation: observable([]),
            event: observable([]) 
        });
    
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
    
        // Important: Keep the autorun for reactive marker updates
        autorun(() => {
            if (this.map && (this.townsData.size > 0 || this.isVisible)) {
                this.updateMarkers();
            }
        });
    
        this.setupEventSubscriptions();
    }

    // Event Management
    setupEventSubscriptions() {
        const bulkIndividualsDisposer = storeEvents.subscribe(
            EVENTS.INDIVIDUALS.BULK_ADDED,
            (individuals) => {
                console.time('processAllTownsEvents');
                runInAction(() => {
                    const townUpdates = new Map();
    
                    // Définir les types d'événements valides
                    const validEventTypes = ['birth', 'death', 'marriage'];
    
                    // Collecter toutes les mises à jour de villes
                    individuals.forEach(([id, individual]) => {
                        individual.individualEvents?.forEach(event => {
                            // Filtrer les événements non pertinents
                            if (!validEventTypes.includes(event.type)) {
                                return;
                            }
    
                            if (!event.town) return;
                            
                            const normalizedTownName = normalizeGeoString(event.town);
                            if (!normalizedTownName) return;
                    
                            if (!townUpdates.has(normalizedTownName)) {
                                townUpdates.set(normalizedTownName, {
                                    townData: { 
                                        town: event.town,
                                        townDisplay: event.town
                                    },
                                    events: []
                                });
                            }
    
                            // Enrichir l'événement avec les détails de la personne
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
    
                    // Appliquer toutes les mises à jour en une seule fois
                    townUpdates.forEach((updateData, normalizedTownName) => {
                        console.log('Mise à jour de la ville:', normalizedTownName);
                        console.log('Données de la ville:', updateData);
                        this.addOrUpdateTown(normalizedTownName, updateData.townData);
                        const town = this.townsData.get(normalizedTownName);
                        if (town) {
                            updateData.events.forEach(event => {
                                this.updateTownEvents(town, event);
                            });
                        }
                    });
                });
                const familyTowns = this.getAllTowns();
                console.log('Family towns:', familyTowns);
                console.timeEnd('processAllTownsEvents');
            }
        );
    
        const cacheDisposer = storeEvents.subscribe(
            EVENTS.CACHE.BUILT,
            () => {
                console.log('🏁 Cache des individus construit, finalisation des données des villes');
                this.finalizeAllTownsData();
            }
        );
    
        const clearDisposer = storeEvents.subscribe(
            EVENTS.CACHE.CLEARED,
            () => {
                console.log('🧹 Nettoyage des données des villes');
                this.clearAllTowns();
            }
        );
    
        // Mettre à jour les disposers
        this.disposers.set('bulkIndividuals', bulkIndividualsDisposer);
        this.disposers.set('cache', cacheDisposer);
        this.disposers.set('clear', clearDisposer);
    }

    // Marker Configuration Management
    createMarkerConfig(normalizedTownName, townData) {
        if (!townData.latitude || !townData.longitude) return null;

        const config = {
            position: new google.maps.LatLng(townData.latitude, townData.longitude),
            options: {
                content: this.createMarkerContent(townData.departementColor),
                title: townData.townDisplay || townData.town
            }
        };
        
        this.markerConfigs.set(normalizedTownName, config);
        return config;
    }

    getOrCreateMarker(normalizedTownName) {
        let config = this.markerConfigs.get(normalizedTownName);
        const townData = this.townsData.get(normalizedTownName);
        
        if (!townData) {
            console.warn(`Données manquantes pour la ville: ${normalizedTownName}`);
            return null;
        }

        if (!config) {
            config = this.createMarkerConfig(normalizedTownName, townData);
            if (!config) return null;
        }

        return this.markerDisplayManager.addMarker(
            'familyTowns',
            normalizedTownName,
            config.position,
            config.options,
            (marker) => this.handleMarkerClick(marker, normalizedTownName)
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
        console.log('📍 addOrUpdateTown - Début', {
            normalizedTownName,
            townData,
            eventData
        });
        
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
                
                console.log('🆕 Création nouvelle ville:', toJS(town));
                this.townsData.set(normalizedTownName, town);
            } else {
                console.log('📝 Mise à jour ville existante:', normalizedTownName);
                
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
            
            console.log('✅ Fin addOrUpdateTown pour', normalizedTownName);
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
        this.markerDisplayManager.clearMarkers('familyTowns');
        
        this.townsData.forEach((townData, normalizedTownName) => {
            if (townData.latitude && townData.longitude) {
                this.getOrCreateMarker(normalizedTownName);
            }
        });

        if (this.isVisible && this.map) {
            this.markerDisplayManager.toggleLayerVisibility('familyTowns', true, this.map);
            this.markerDisplayManager.addMarkersToCluster(this.map);
        }
    }

    // Visibility Management
    toggleVisibility(isVisible) {
        this.isVisible = isVisible;
        if (this.map) {
            this.markerDisplayManager.toggleLayerVisibility('familyTowns', isVisible, this.map);
            if (isVisible) {
                this.markerDisplayManager.addMarkersToCluster(this.map);
            }
        }
    }

    // Stats and Data Management
    recalculateAllTownsStatistics() {
        runInAction(() => {
            this.townsData.forEach((town, normalizedTownName) => {
                try {
                    town.statistics = TownStatisticsManager.createEmptyStatistics();
    
                    ['birth', 'death', 'marriage'].forEach(eventType => {
                        if (Array.isArray(town.events[eventType])) {
                            town.events[eventType].forEach(event => {
                                if (event) {
                                    TownStatisticsManager.updateTownStatistics(town, event);
                                }
                            });
                        }
                    });
                    
                    this.invalidateCache(normalizedTownName);
                } catch (error) {
                    console.error(`Erreur lors du recalcul des statistiques pour la ville ${normalizedTownName}:`, error);
                }
            });
        });
    }

    finalizeAllTownsData() {
        this.recalculateAllTownsStatistics();
        this.clearAllCaches();
        this.updateMarkers();
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
            console.warn("Une mise à jour est déjà en cours");
            return;
        }
    
        try {
            this.setIsLoading(true);
            storeEvents.emit(EVENTS.TOWN.UPDATE_START);
    
            // Utiliser les villes fournies ou collecter celles qui nécessitent une mise à jour
            const updates = townsToUpdate || this._collectTownsNeedingUpdate();
            
            if (Object.keys(updates).length === 0) {
                console.log('Aucune ville ne nécessite de mise à jour');
                storeEvents.emit(EVENTS.TOWN.UPDATE_COMPLETE);
                return;
            }
    
            const response = await fetch('https://opencageproxy.genealogie.workers.dev/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    familyTowns: updates,
                    userId: localStorage.getItem('userId')
                })
            });
    
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
            const updatedTowns = await response.json();
    
            runInAction(() => {
                Object.entries(updatedTowns).forEach(([key, data]) => {
                    this.updateTown(key, data);
                });
                this.saveToLocalStorage();
            });
    
            storeEvents.emit(EVENTS.TOWN.UPDATE_COMPLETE);
        } catch (error) {
            console.error('Error updating towns:', error);
            storeEvents.emit(EVENTS.TOWN.UPDATE_ERROR, error);
            throw error;
        } finally {
            this.setIsLoading(false);
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
                console.log(`Mise à jour de la ville ${key}:`, {
                    avant: { ...town },
                    miseAJour: updates,
                });
                
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
                
                console.log('Après mise à jour:', this.townsData.get(key));
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
        this.map = map;
        this.markerDisplayManager.initializeCluster(map, this.renderCluster.bind(this));

        if (this.townsData.size > 0) {
            this.updateMarkers();
        }
    }

    renderCluster({ count, position }) {
        const element = document.createElement('div');
        element.className = 'cluster-marker';
        element.style.cssText = `
            background: #4B5563;
            border-radius: 50%;
            width: ${Math.min(count * 3, 20) * 2}px;
            height: ${Math.min(count * 3, 20) * 2}px;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
        `;
        element.textContent = String(count);

        return new google.maps.marker.AdvancedMarkerElement({
            position,
            content: element,
            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count
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

    // Event Processing
    updateTownEvents(town, eventData) {
        if (!eventData?.type || !town?.events) {
            console.log('❌ Événement ou structure invalide:', {eventData, town});
            return;
        }
    
        const eventTypeMap = {
            'birth': ['BIRT', 'birth'],
            'death': ['DEAT', 'death'],
            'marriage': ['MARR', 'marriage'],
            'burial': ['BURI', 'burial'],
            'occupation': ['OCCU', 'occupation'],
            'event': ['EVEN', 'event']
        };
    
        const eventTypes = eventTypeMap[eventData.type];
        if (!eventTypes) {
            console.log('❌ Type d\'événement non reconnu:', eventData.type);
            return;
        }
    
        const enrichedEvent = {
            ...eventData,
            personDetails: { ...eventData.personDetails }
        };
    
        eventTypes.forEach(type => {
            if (!Array.isArray(town.events[type])) {
                town.events[type] = observable([]);
            }
    
            const existingIndex = town.events[type].findIndex(
                e => e.personId === enrichedEvent.personId && e.date === enrichedEvent.date
            );
    
            if (existingIndex !== -1) {
                town.events[type][existingIndex] = enrichedEvent;
            } else {
                town.events[type].push(enrichedEvent);
            }
        });
    
        console.log(`✅ Événement ${eventData.type} ajouté/mis à jour pour ${town.town}`);
    }
}

// Export d'une instance unique du store
export default new FamilyTownsStore();