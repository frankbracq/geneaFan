/*
Gère l'ensemble des villes du fichier GEDCOM
Traite tous types d'événements (naissances, mariages, décès)
Fournit un calque de contexte global pour la carte
*/

import { makeObservable, observable, action, computed, runInAction, autorun } from '../common/stores/mobx-config.js';
import MarkerManager from '../tabs/familyMap/markerManager.js';
import { infoWindowManager } from '../tabs/familyMap/infoWindowManager.js';
import { storeEvents, EVENTS } from './storeEvents.js';
import { normalizeGeoString } from "../utils/geo.js";

class FamilyTownsStore {
    constructor() {
        this.markerManager = new MarkerManager();
        this.townsData = new Map();
        this.disposers = new Map();
        this.isLoading = false;
        this.isVisible = false;
        this.map = null;

        makeObservable(this, {
            townsData: observable,
            isLoading: observable,
            isVisible: observable,
            setTownsData: action,
            addTown: action,
            updateTown: action,
            toggleVisibility: action,
            clearAllTowns: action,
            updateTownEventsForIndividual: action,
            finalizeAllTownsData: action,
            addOrUpdateTownEvent: action,
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
        // Écouter les ajouts d'individus
        const individualDisposer = storeEvents.subscribe(
            EVENTS.INDIVIDUAL.ADDED,
            ({id, data}) => {
                this.updateTownEventsForIndividual(data);
            }
        );

        // Écouter la construction complète du cache
        const cacheDisposer = storeEvents.subscribe(
            EVENTS.CACHE.BUILT,
            () => {
                console.log('🏁 Cache des individus construit, finalisation des données des villes');
                this.finalizeAllTownsData();
            }
        );

        // Écouter le nettoyage du cache
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

            // Enrichir l'événement avec les données complètes de l'individu
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

            // Notifier de la mise à jour de la ville
            storeEvents.emit(EVENTS.TOWN.UPDATED, {
                townKey,
                event: enrichedEvent
            });

            this.addOrUpdateTownEvent(townKey, enrichedEvent);
        });
    }

    addOrUpdateTownEvent(townKey, eventData) {
        runInAction(() => {
            let town = this.townsData.get(townKey);
            
            if (!town) {
                // Initialisation complète d'une nouvelle ville
                town = {
                    events: {
                        BIRT: [],  // Naissances
                        DEAT: [],  // Décès
                        MARR: [],  // Mariages
                        BURI: [],  // Inhumations
                        OCCU: [],  // Occupations
                        EVEN: []   // Autres événements
                    },
                    statistics: {
                        birthCount: 0,
                        deathCount: 0,
                        marriageCount: 0,
                        localDeaths: 0,      
                        externalDeaths: 0,   
                        timespan: {
                            firstEvent: null,
                            lastEvent: null
                        },
                        patronymes: {
                            total: new Set(),              // Ensemble de tous les patronymes
                            byPeriod: new Map(),           // Map des patronymes par période
                            frequents: [],                 // Top des patronymes les plus fréquents
                            evolution: []                  // Évolution des patronymes dans le temps
                        }
                    }
                };
                this.townsData.set(townKey, town);
            }

            // S'assurer que le tableau d'événements existe pour ce type
            if (!town.events[eventData.type]) {
                town.events[eventData.type] = [];
            }

            // Vérifier si l'événement existe déjà
            const existingEventIndex = town.events[eventData.type].findIndex(
                e => e.personId === eventData.personId && e.date === eventData.date
            );

            if (existingEventIndex !== -1) {
                // Mettre à jour l'événement existant
                town.events[eventData.type][existingEventIndex] = {
                    ...town.events[eventData.type][existingEventIndex],
                    ...eventData
                };
            } else {
                // Ajouter le nouvel événement
                town.events[eventData.type].push(eventData);
            }

            // Mise à jour des statistiques de la ville
            this.updateTownStatistics(town, eventData);
        });
    }

    recalculateAllTownsStatistics() {
        runInAction(() => {
            this.townsData.forEach((town, townKey) => {
                // Réinitialiser les compteurs
                town.statistics = {
                    birthCount: 0,
                    deathCount: 0,
                    marriageCount: 0,
                    localDeaths: 0,
                    externalDeaths: 0,
                    timespan: {
                        firstEvent: null,
                        lastEvent: null
                    },
                    patronymes: {
                        total: new Set(),
                        byPeriod: new Map(),
                        frequents: [],
                        evolution: []
                    }
                };

                // Recalculer les statistiques pour chaque type d'événement
                Object.entries(town.events).forEach(([eventType, events]) => {
                    events.forEach(event => {
                        const eventDate = event.date ? new Date(event.date.split('/').reverse().join('-')) : null;
                        
                        // Mise à jour du timespan
                        if (eventDate) {
                            if (!town.statistics.timespan.firstEvent || 
                                eventDate < new Date(town.statistics.timespan.firstEvent)) {
                                town.statistics.timespan.firstEvent = eventDate.toISOString();
                            }
                            if (!town.statistics.timespan.lastEvent || 
                                eventDate > new Date(town.statistics.timespan.lastEvent)) {
                                town.statistics.timespan.lastEvent = eventDate.toISOString();
                            }
                        }

                        // Mise à jour des compteurs selon le type d'événement
                        switch (eventType) {
                            case 'BIRT':
                                town.statistics.birthCount++;
                                if (event.personDetails?.surname) {
                                    town.statistics.patronymes.total.add(event.personDetails.surname);
                                    if (eventDate) {
                                        const year = eventDate.getFullYear();
                                        const period = Math.floor(year / 50) * 50;
                                        const periodKey = `${period}-${period + 49}`;
                                        
                                        if (!town.statistics.patronymes.byPeriod.has(periodKey)) {
                                            town.statistics.patronymes.byPeriod.set(periodKey, new Map());
                                        }
                                        
                                        const periodStats = town.statistics.patronymes.byPeriod.get(periodKey);
                                        periodStats.set(
                                            event.personDetails.surname,
                                            (periodStats.get(event.personDetails.surname) || 0) + 1
                                        );
                                    }
                                }
                                break;
                            case 'DEAT':
                                town.statistics.deathCount++;
                                if (event.personDetails?.birthPlace === town.town) {
                                    town.statistics.localDeaths++;
                                } else {
                                    town.statistics.externalDeaths++;
                                }
                                break;
                            case 'MARR':
                                town.statistics.marriageCount++;
                                break;
                        }
                    });
                });

                // Recalculer les patronymes fréquents
                if (town.statistics.patronymes.total.size > 0) {
                    // Compter la fréquence totale de chaque patronyme
                    const frequency = new Map();
                    town.statistics.patronymes.byPeriod.forEach(periodMap => {
                        periodMap.forEach((count, surname) => {
                            frequency.set(surname, (frequency.get(surname) || 0) + count);
                        });
                    });
                    
                    // Trier et garder les 10 plus fréquents
                    town.statistics.patronymes.frequents = Array.from(frequency.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([surname, count]) => ({ surname, count }));

                    // Calculer l'évolution dans le temps
                    const topSurnames = new Set(town.statistics.patronymes.frequents.map(p => p.surname));
                    town.statistics.patronymes.evolution = Array.from(town.statistics.patronymes.byPeriod.entries())
                        .map(([period, patronymes]) => {
                            const evolutionEntry = { period };
                            topSurnames.forEach(surname => {
                                evolutionEntry[surname] = patronymes.get(surname) || 0;
                            });
                            return evolutionEntry;
                        })
                        .sort((a, b) => a.period.localeCompare(b.period));
                }
            });
        });
    }

    updateTownStatistics(town, event) {
        const eventDate = event.date ? new Date(event.date.split('/').reverse().join('-')) : null;
        
        // Mise à jour du timespan
        if (eventDate) {
            if (!town.statistics.timespan.firstEvent || 
                eventDate < new Date(town.statistics.timespan.firstEvent)) {
                town.statistics.timespan.firstEvent = eventDate.toISOString();
            }
            if (!town.statistics.timespan.lastEvent || 
                eventDate > new Date(town.statistics.timespan.lastEvent)) {
                town.statistics.timespan.lastEvent = eventDate.toISOString();
            }
        }

        // Mise à jour des compteurs selon le type d'événement
        switch (event.type) {
            case 'BIRT':
                town.statistics.birthCount++;
                if (event.personDetails?.surname) {
                    town.statistics.patronymes.total.add(event.personDetails.surname);
                    if (eventDate) {
                        const year = eventDate.getFullYear();
                        const period = Math.floor(year / 50) * 50;
                        const periodKey = `${period}-${period + 49}`;
                        
                        if (!town.statistics.patronymes.byPeriod.has(periodKey)) {
                            town.statistics.patronymes.byPeriod.set(periodKey, new Map());
                        }
                        
                        const periodStats = town.statistics.patronymes.byPeriod.get(periodKey);
                        periodStats.set(
                            event.personDetails.surname,
                            (periodStats.get(event.personDetails.surname) || 0) + 1
                        );
                    }
                }
                break;
            case 'DEAT':
                town.statistics.deathCount++;
                if (event.personDetails?.birthPlace === town.town) {
                    town.statistics.localDeaths++;
                } else {
                    town.statistics.externalDeaths++;
                }
                break;
            case 'MARR':
                town.statistics.marriageCount++;
                break;
        }
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

    addTown(key, townData, eventData = null) {
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
                        BIRT: observable([]), // Naissances
                        DEAT: observable([]), // Décès
                        MARR: observable([]), // Mariages
                        BURI: observable([]), // Inhumations
                        OCCU: observable([]), // Occupations
                        EVEN: observable([])  // Autres événements
                    }),
                    statistics: observable({
                        birthCount: 0,
                        deathCount: 0,
                        marriageCount: 0,
                        localDeaths: 0,      
                        externalDeaths: 0,   
                        timespan: {
                            firstEvent: null,
                            lastEvent: null
                        },
                        patronymes: observable({
                            total: new Set(),              // Ensemble de tous les patronymes
                            byPeriod: new Map(),           // Map des patronymes par période
                            frequents: [],                 // Top des patronymes les plus fréquents
                            evolution: []                  // Évolution des patronymes dans le temps
                        })
                    })
                });
                this.townsData.set(key, town);
            }
    
            if (eventData && eventData.type && town.events[eventData.type]) {
                const enrichedEvent = {
                    ...eventData,
                    personDetails: {
                        name: eventData.personDetails.name || '',
                        surname: eventData.personDetails.surname || '',
                        gender: eventData.personDetails.gender || '',
                        birthDate: eventData.personDetails.birthDate || '',
                        deathDate: eventData.personDetails.deathDate || '',
                        birthPlace: eventData.personDetails.birthPlace || '',
                        deathPlace: eventData.personDetails.deathPlace || '',
                        occupation: eventData.personDetails.occupation || ''
                    }
                };
                
                this.updateTownStatistics(town, enrichedEvent);
                town.events[eventData.type].push(enrichedEvent);
            }
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
                const content = infoWindowManager.createInfoWindowContent(
                    townData.townDisplay || townName,
                    [
                        { label: 'Département', value: townData.departement },
                        { label: 'Pays', value: townData.country }
                    ]
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

    // Info window
    createInfoWindowContent(townName, townData) {
        const stats = townData.statistics;
        const events = townData.events;
        
        let content = `
            <div class="info-window-content">
                <h3 class="text-lg font-bold mb-2">${townName}</h3>
                <div class="text-sm">
                    <p><strong>Département:</strong> ${townData.departement}</p>
                    <p><strong>Pays:</strong> ${townData.country}</p>
                    
                    <div class="mt-2">
                        <h4 class="font-semibold">Statistiques</h4>
                        <ul class="list-inside">
                            <li>Naissances: ${stats.birthCount}</li>
                            <li>Décès: ${stats.deathCount}</li>
                            <li>Mariages: ${stats.marriageCount}</li>
                        </ul>
                    </div>

                    <div class="mt-2">
                        <h4 class="font-semibold">Mobilité</h4>
                        <p>Décès de natifs: ${stats.localDeaths}</p>
                        <p>Décès d'extérieurs: ${stats.externalDeaths}</p>
                    </div>`;

        // Ajouter les derniers événements s'ils existent
        const recentEvents = this.getRecentEvents(events, 3);
        if (recentEvents.length > 0) {
            content += `
                    <div class="mt-2">
                        <h4 class="font-semibold">Derniers événements</h4>
                        <ul class="list-inside">
                            ${recentEvents.map(e => `
                                <li>${this.formatEvent(e)}</li>
                            `).join('')}
                        </ul>
                    </div>`;
        }

        // Ajouter la section des patronymes
        if (townData.statistics.patronymes.frequents.length > 0) {
            content += `
                    <div class="mt-2">
                        <h4 class="font-semibold">Patronymes principaux</h4>
                        <ul class="list-inside">
                            ${townData.statistics.patronymes.frequents
                                .slice(0, 5)  // Afficher les 5 premiers
                                .map(p => `
                                    <li>${p.surname} (${p.count})</li>
                                `).join('')}
                        </ul>
                    </div>`;

            // Ajouter des informations sur l'évolution si disponibles
            if (townData.statistics.patronymes.evolution.length > 0) {
                content += `
                    <div class="mt-2">
                        <h4 class="font-semibold">Évolution historique</h4>
                        <div class="text-xs">
                            ${townData.statistics.patronymes.evolution
                                .map(e => `
                                    <p>${e.period}: ${Object.entries(e)
                                        .filter(([key]) => key !== 'period')
                                        .filter(([, count]) => count > 0)
                                        .map(([surname, count]) => `${surname} (${count})`)
                                        .join(', ')}</p>
                                `).join('')}
                        </div>
                    </div>`;
            }
        }

        content += `
                </div>
            </div>`;

        return content;
    }

    getRecentEvents(events, count) {
        // Combine et trie tous les événements par date
        const allEvents = [
            ...events.BIRT,
            ...events.DEAT,
            ...events.MARR
        ].filter(e => e.date)
         .sort((a, b) => {
             const dateA = new Date(a.date.split('/').reverse().join('-'));
             const dateB = new Date(b.date.split('/').reverse().join('-'));
             return dateB - dateA;
         })
         .slice(0, count);

        return allEvents;
    }

    formatEvent(event) {
        const person = event.personDetails;
        const date = event.date;
        let description;

        switch (event.type) {
            case 'BIRT':
                description = `Naissance de ${person.name} ${person.surname}`;
                break;
            case 'DEAT':
                description = `Décès de ${person.name} ${person.surname}`;
                break;
            case 'MARR':
                description = `Mariage de ${person.name} ${person.surname}`;
                break;
            default:
                description = `Événement: ${person.name} ${person.surname}`;
        }

        return `${date} - ${description}`;
    }


    // Statistics
    updateTownStatistics(town, event) {
        const stats = town.statistics;
        const date = event.date ? new Date(event.date.split('/').reverse().join('-')) : null;
        const year = date ? date.getFullYear() : null;

        // Mise à jour du timespan
        if (date) {
            if (!stats.timespan.firstEvent || date < new Date(stats.timespan.firstEvent)) {
                stats.timespan.firstEvent = date.toISOString();
            }
            if (!stats.timespan.lastEvent || date > new Date(stats.timespan.lastEvent)) {
                stats.timespan.lastEvent = date.toISOString();
            }
        }

        // Mise à jour des compteurs selon le type d'événement
        switch (event.type) {
            case 'BIRT':
                stats.birthCount++;
                this.updatePatronymeStats(stats, event.personDetails.surname, year);
                break;
            case 'DEAT':
                stats.deathCount++;
                if (event.personDetails.birthPlace === town.town) {
                    stats.localDeaths++;
                } else {
                    stats.externalDeaths++;
                }
                break;
            case 'MARR':
                stats.marriageCount++;
                break;
        }
    }

    // Modification du contenu de l'infoWindow pour inclure les nouvelles données
    updatePatronymeStats(stats, surname, year) {
        if (!surname) return;
        
        // Ajouter au Set total des patronymes
        stats.patronymes.total.add(surname);
        
        // Mise à jour des patronymes par période
        if (year) {
            const period = Math.floor(year / 50) * 50; // Périodes de 50 ans
            const periodKey = `${period}-${period + 49}`;
            
            if (!stats.patronymes.byPeriod.has(periodKey)) {
                stats.patronymes.byPeriod.set(periodKey, new Map());
            }
            
            const periodStats = stats.patronymes.byPeriod.get(periodKey);
            periodStats.set(surname, (periodStats.get(surname) || 0) + 1);
        }
        
        // Mettre à jour le top des patronymes les plus fréquents
        this.updateFrequentPatronymes(stats);
    }

    updateFrequentPatronymes(stats) {
        // Compter la fréquence totale de chaque patronyme
        const frequency = new Map();
        for (const [, periodMap] of stats.patronymes.byPeriod) {
            for (const [surname, count] of periodMap) {
                frequency.set(surname, (frequency.get(surname) || 0) + count);
            }
        }
        
        // Trier et garder les 10 plus fréquents
        stats.patronymes.frequents = Array.from(frequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([surname, count]) => ({ surname, count }));
        
        // Calculer l'évolution dans le temps
        this.calculatePatronymeEvolution(stats);
    }

    calculatePatronymeEvolution(stats) {
        const topSurnames = new Set(stats.patronymes.frequents.map(p => p.surname));
        stats.patronymes.evolution = [];
        
        // Pour chaque période
        for (const [period, patronymes] of stats.patronymes.byPeriod) {
            const evolutionEntry = { period };
            
            // Pour chaque patronyme principal
            for (const surname of topSurnames) {
                evolutionEntry[surname] = patronymes.get(surname) || 0;
            }
            
            stats.patronymes.evolution.push(evolutionEntry);
        }
        
        // Trier par période
        stats.patronymes.evolution.sort((a, b) => 
            parseInt(a.period) - parseInt(b.period));
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
}

export default new FamilyTownsStore();
