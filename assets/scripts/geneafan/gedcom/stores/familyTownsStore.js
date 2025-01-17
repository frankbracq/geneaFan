/*
Gère l'ensemble des villes du fichier GEDCOM
Traite tous types d'événements (naissances, mariages, décès)
Fournit un calque de contexte global pour la carte
*/

import { makeObservable, observable, action, computed, runInAction, autorun } from '../../common/stores/mobx-config.js';
import MarkerManager from '../../tabs/familyMap/markerManager.js';
import { infoWindowManager } from '../../tabs/familyMap/infoWindowManager.js';
import { storeEvents, EVENTS } from './storeEvents.js';
import { normalizeGeoString } from "../../utils/geo.js";
import { TownStatisticsManager } from './townStatisticsManager';
import { infoWindowContentManager } from './infoWindowContentManager.js';

class FamilyTownsStore {
    constructor() {
        this.markerManager = new MarkerManager();
        this.townsData = new Map();
        this.disposers = new Map();
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
    
        autorun(() => {
            if (this.map && (this.townsData.size > 0 || this.isVisible)) {
                this.updateMarkers();
            }
        });
    
        this.setupEventSubscriptions();
    }

    setupEventSubscriptions() {
        const individualDisposer = storeEvents.subscribe(
            EVENTS.INDIVIDUAL.ADDED,
            ({id, data}) => {
                this.updateTownEventsForIndividual(data);
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

        this.disposers.set('individual', individualDisposer);
        this.disposers.set('cache', cacheDisposer);
        this.disposers.set('clear', clearDisposer);
    }

    updateTownEventsForIndividual(individual) {
        individual.individualEvents?.forEach(event => {
            if (!event.town) return;
            
            const townKey = normalizeGeoString(event.town);
            if (!townKey) return;
    
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
                townKey,
                event: enrichedEvent
            });
    
            this.addOrUpdateTown(townKey, { 
                town: event.town,
                townDisplay: event.town
            }, enrichedEvent);
        });
    }
    
    addOrUpdateTown(key, townData, eventData = null) {
        if (!key || !townData) {
            console.warn('Clé ou données de ville manquantes');
            return;
        }
    
        runInAction(() => {
            let town = this.townsData.get(key);
    
            if (!town) {
                town = observable({
                    town: townData.town || '',
                    townDisplay: townData.townDisplay || townData.town || '',
                    departement: townData.departement || '',
                    departementColor: townData.departementColor || '',
                    country: townData.country || '',
                    countryCode: townData.countryCode || '',
                    latitude: townData.latitude || '',
                    longitude: townData.longitude || '',
                    events: observable({
                        birth: observable([]),
                        death: observable([]),
                        marriage: observable([]),
                        burial: observable([]),
                        occupation: observable([]),
                        event: observable([])
                    }),
                    statistics: TownStatisticsManager.createEmptyStatistics()
                });
                
                this.townsData.set(key, town);
            } else {
                Object.entries(townData).forEach(([field, value]) => {
                    if (value !== undefined && value !== null) {
                        town[field] = value;
                    }
                });
            }

            if (eventData && eventData.type) {
                try {
                    const eventTypeMap = {
                        'BIRT': 'birth',
                        'birth': 'birth',
                        'DEAT': 'death',
                        'death': 'death',
                        'MARR': 'marriage',
                        'marriage': 'marriage',
                        'BURI': 'burial',
                        'burial': 'burial',
                        'OCCU': 'occupation',
                        'occupation': 'occupation',
                        'EVEN': 'event',
                        'event': 'event'
                    };

                    const internalType = eventTypeMap[eventData.type];
                    if (!internalType) {
                        console.warn(`Type d'événement non reconnu: ${eventData.type}`);
                        return;
                    }

                    if (!town.events.hasOwnProperty(internalType)) {
                        console.warn(`Type d'événement non géré dans la structure: ${internalType}`);
                        return;
                    }

                    if (!Array.isArray(town.events[internalType])) {
                        town.events[internalType] = observable([]);
                    }

                    const enrichedEvent = {
                        ...eventData,
                        type: internalType,
                        personDetails: {
                            name: eventData.personDetails?.name || '',
                            surname: eventData.personDetails?.surname || '',
                            gender: eventData.personDetails?.gender || '',
                            birthDate: eventData.personDetails?.birthDate || '',
                            deathDate: eventData.personDetails?.deathDate || '',
                            birthPlace: eventData.personDetails?.birthPlace || '',
                            deathPlace: eventData.personDetails?.deathPlace || '',
                            occupation: eventData.personDetails?.occupation || ''
                        }
                    };

                    const existingEventIndex = town.events[internalType].findIndex(
                        e => e.personId === enrichedEvent.personId && e.date === enrichedEvent.date
                    );

                    if (existingEventIndex !== -1) {
                        town.events[internalType][existingEventIndex] = enrichedEvent;
                    } else {
                        town.events[internalType].push(enrichedEvent);
                    }

                    TownStatisticsManager.updateTownStatistics(town, enrichedEvent);
                } catch (error) {
                    console.error('Erreur lors du traitement de l\'événement:', error);
                }
            }
        });
    }

    recalculateAllTownsStatistics() {
        runInAction(() => {
            this.townsData.forEach((town, townKey) => {
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
                } catch (error) {
                    console.error(`Erreur lors du recalcul des statistiques pour la ville ${townKey}:`, error);
                }
            });
        });
    }

    finalizeAllTownsData() {
        // Calculs finaux ou mises à jour après que tous les individus ont été traités
        this.recalculateAllTownsStatistics();
        this.saveToLocalStorage();
    }

    initialize(map) {
        this.map = map;
        this.markerManager.initializeCluster(map, this.renderCluster.bind(this));

        if (this.townsData.size > 0) {
            this.updateMarkers();
        }
    }

    clearAllTowns() {
        runInAction(() => {
            this.townsData = new Map();
            if (this.markerManager) {
                this.markerManager.clearMarkers();
            }
        });
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
                this.townsData.set(key, { ...town, ...updates });
            }
        });
    }

    createMarker(townName, townData) {
        const key = `${townData.latitude}-${townData.longitude}-${townName}`;
        const position = new google.maps.LatLng(townData.latitude, townData.longitude);

        const marker = this.markerManager.addMarker(
            'familyTowns',
            key,
            position,
            {
                content: this.createMarkerContent(townData.departementColor),
                title: townName
            },
            (marker) => {
                const content = infoWindowContentManager.createInfoWindowContent(
                    townData.townDisplay || townName,
                    townData
                );
                infoWindowManager.showInfoWindow(marker, content);
            }
        );

        return marker;
    }

    createMarkerContent(color = '#4B5563') {
        const element = document.createElement('div');
        element.className = 'town-marker';
        element.style.background = color;
        element.style.width = '24px';
        element.style.height = '24px';
        element.style.borderRadius = '50%';
        element.style.border = '2px solid white';
        return element;
    }

    updateMarkers() {
        this.markerManager.clearMarkers('familyTowns');
        this.townsData.forEach((townData, townName) => {
            if (townData.latitude && townData.longitude) {
                this.createMarker(townName, townData);
            }
        });

        if (this.isVisible && this.map) {
            this.markerManager.toggleLayerVisibility('familyTowns', true, this.map);
            this.markerManager.addMarkersToCluster(this.map);
        }
    }

    hasActiveMarkers() {
        if (!this.markerManager) return false;
        let hasMarkers = false;
        this.markerManager.layers.forEach(layerMarkers => {
            layerMarkers.forEach(marker => {
                if (marker.map !== null) {
                    hasMarkers = true;
                }
            });
        });
        return hasMarkers;
    }

    getBounds() {
        if (!this.markerManager) return null;
        
        const bounds = new google.maps.LatLngBounds();
        let hasMarkers = false;

        this.markerManager.layers.forEach(layerMarkers => {
            layerMarkers.forEach(marker => {
                if (marker.map !== null) {
                    bounds.extend(marker.position);
                    hasMarkers = true;
                }
            });
        });

        return hasMarkers ? bounds : null;
    }

    toggleVisibility(isVisible) {
        this.isVisible = isVisible;
        if (this.map) {
            this.markerManager.toggleLayerVisibility('familyTowns', isVisible, this.map);
            if (isVisible) {
                this.markerManager.addMarkersToCluster(this.map);
            }
        }
    }

    renderCluster({ count, position }) {
        const element = document.createElement('div');
        element.className = 'cluster-marker';
        element.style.background = '#4B5563';
        element.style.borderRadius = '50%';
        element.style.width = `${Math.min(count * 3, 20) * 2}px`;
        element.style.height = `${Math.min(count * 3, 20) * 2}px`;
        element.style.border = '2px solid white';
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

    cleanData(data) {
        return JSON.parse(JSON.stringify(data));
    }

    getTown(key) {
        const town = this.townsData.get(key);
        return town ? this.cleanData(town) : null;
    }

    getAllTowns() {
        return this.cleanData(Object.fromEntries(this.townsData));
    }

    cleanup() {
        this.markerManager.clearMarkers();
        this.markerManager.cleanup();
        this.map = null;
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
    }

    saveToLocalStorage() {
        try {
            const data = Object.fromEntries(this.townsData);
            localStorage.setItem('townsDB', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    get totalTowns() {
        return this.townsData.size;
    }
    
    updateTownsViaProxy = async () => {
        try {
            const townsToUpdate = {};
            let needsUpdate = false;

            this.townsData.forEach((town, key) => {
                if (!town.latitude || !town.longitude) {
                    townsToUpdate[key] = this.cleanData(town);
                    needsUpdate = true;
                }
            });

            if (!needsUpdate) return;

            const response = await fetch('https://opencageproxy.genealogie.workers.dev/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    familyTowns: townsToUpdate,
                    userId: localStorage.getItem('userId')
                })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const updatedTowns = await response.json();
            runInAction(() => {
                Object.entries(updatedTowns).forEach(([key, data]) => {
                    this.updateTown(key, data);
                });
            });
        } catch (error) {
            console.error('Error updating towns:', error);
        }
    }

    loadFromLocalStorage = () => {
        try {
            const stored = localStorage.getItem('townsDB');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.setTownsData(parsed);
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }

    saveToLocalStorage = () => {
        try {
            const data = this.getAllTowns();
            localStorage.setItem('townsDB', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    get totalTowns() {
        return this.townsData.size;
    }
}

export default new FamilyTownsStore();
