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
import { isValidDate } from "../../utils/dates.js";

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
    
            // Utiliser la nouvelle fonction unifiée
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
    
            // Si la ville n'existe pas, on l'initialise
            if (!town) {
                const nativePatronymeStruct = {
                    total: new Set(),
                    byPeriod: new Map(),
                    frequents: [],
                    evolution: []
                };
                
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
                    statistics: {
                        birthCount: 0,
                        deathCount: 0,
                        marriageCount: 0,
                        localDeaths: 0,
                        externalDeaths: 0,
                        timespan: {
                            firstEvent: null,
                            lastEvent: null
                        }
                    }
                });
                
                // Ajout manuel des structures natives pour éviter leur transformation en observables
                town.statistics.patronymes = nativePatronymeStruct;
                
                this.townsData.set(key, town);
            } else {
                // Mise à jour des données de la ville si elles existent
                Object.entries(townData).forEach(([field, value]) => {
                    if (value !== undefined && value !== null) {
                        town[field] = value;
                    }
                });
            }

            // Traitement de l'événement si fourni
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

                    // S'assurer que le tableau d'événements est observable
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

                    this.updateTownStatistics(town, enrichedEvent);
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
                    const nativePatronymeStruct = this.initializePatronymesStructure();
                    
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
                        patronymes: nativePatronymeStruct
                    };
    
                    ['birth', 'death', 'marriage'].forEach(eventType => {
                        if (Array.isArray(town.events[eventType])) {
                            town.events[eventType].forEach(event => {
                                if (event) {
                                    this.updateTownStatistics(town, event);
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
    

    updateTownStatistics(town, event) {
        if (!town || !event) return;
    
        try {
            const eventDate = event.date ? new Date(event.date.split('/').reverse().join('-')) : null;
            const stats = town.statistics;
            
            // Mise à jour du timespan
            if (eventDate) {
                if (!stats.timespan.firstEvent || eventDate < new Date(stats.timespan.firstEvent)) {
                    stats.timespan.firstEvent = eventDate.toISOString();
                }
                if (!stats.timespan.lastEvent || eventDate > new Date(stats.timespan.lastEvent)) {
                    stats.timespan.lastEvent = eventDate.toISOString();
                }
            }
    
            // Mise à jour des compteurs selon le type d'événement
            switch (event.type) {
                case 'birth':
                    stats.birthCount++;
                    if (event.personDetails?.surname) {
                        this.updatePatronymeStats(stats, event.personDetails.surname, eventDate?.getFullYear());
                    }
                    break;
                case 'death':
                    stats.deathCount++;
                    if (event.personDetails?.birthPlace === town.town) {
                        stats.localDeaths++;
                    } else {
                        stats.externalDeaths++;
                    }
                    break;
                case 'marriage':
                    stats.marriageCount++;
                    break;
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour des statistiques:', error);
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
        if (!townName || !townData) return '';
    
        try {
            const stats = townData.statistics;
            const events = townData.events;
            
            let content = `
                <div class="info-window-content">
                    <h3 class="text-lg font-bold mb-2">${townName}</h3>
                    <div class="text-sm">
                        <p><strong>Département:</strong> ${townData.departement || ''}</p>
                        <p><strong>Pays:</strong> ${townData.country || ''}</p>
                        
                        <div class="mt-2">
                            <h4 class="font-semibold">Statistiques</h4>
                            <ul class="list-inside">
                                <li>Naissances: ${events.birth?.length || 0}</li>
                                <li>Décès: ${events.death?.length || 0}</li>
                                <li>Mariages: ${events.marriage?.length || 0}</li>
                            </ul>
                        </div>`;
    
            if (stats.localDeaths > 0 || stats.externalDeaths > 0) {
                content += `
                        <div class="mt-2">
                            <h4 class="font-semibold">Mobilité</h4>
                            <p>Décès de natifs: ${stats.localDeaths}</p>
                            <p>Décès d'extérieurs: ${stats.externalDeaths}</p>
                        </div>`;
            }
    
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
    
            // Ajouter les patronymes si disponibles
            if (stats.patronymes?.frequents?.length > 0) {
                content += this.createPatronymesSection(stats.patronymes);
            }
    
            content += `
                    </div>
                </div>`;
    
            return content;
        } catch (error) {
            console.error('Erreur lors de la création du contenu de l\'infoWindow:', error);
            return '<div class="error">Erreur lors du chargement des données</div>';
        }
    }

    getRecentEvents(events, count) {
        if (!events || !count) return [];
    
        try {
            // Combine et trie tous les événements par date
            const allEvents = [
                ...(events.birth || []),
                ...(events.death || []),
                ...(events.marriage || [])
            ].filter(e => e && e.date)
             .sort((a, b) => {
                 const dateA = new Date(a.date.split('/').reverse().join('-'));
                 const dateB = new Date(b.date.split('/').reverse().join('-'));
                 return dateB - dateA;
             })
             .slice(0, count);
    
            return allEvents;
        } catch (error) {
            console.error('Erreur lors de la récupération des événements récents:', error);
            return [];
        }
    }

    createPatronymesSection(patronymesData) {
        if (!patronymesData?.frequents) return '';
    
        let content = `
            <div class="mt-2">
                <h4 class="font-semibold">Patronymes principaux</h4>
                <ul class="list-inside">
                    ${patronymesData.frequents
                        .slice(0, 5)
                        .map(p => `<li>${p.surname} (${p.count})</li>`)
                        .join('')}
                </ul>
            </div>`;
    
        if (patronymesData.evolution?.length > 0) {
            content += `
                <div class="mt-2">
                    <h4 class="font-semibold">Évolution historique</h4>
                    <div class="text-xs">
                        ${patronymesData.evolution
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
    
        return content;
    }

    formatEvent(event) {
        if (!event || !event.personDetails) return '';
    
        try {
            const person = event.personDetails;
            const date = event.date;
            let description;
    
            switch (event.type) {
                case 'birth':
                    description = `Naissance de ${person.name} ${person.surname}`;
                    break;
                case 'death':
                    description = `Décès de ${person.name} ${person.surname}`;
                    break;
                case 'marriage':
                    description = `Mariage de ${person.name} ${person.surname}`;
                    break;
                default:
                    description = `Événement: ${person.name} ${person.surname}`;
            }
    
            return `${date} - ${description}`;
        } catch (error) {
            console.error('Erreur lors du formatage de l\'événement:', error);
            return '';
        }
    }


    // Statistic functions
    updateTownStatistics(town, event) {
        if (!town?.statistics || !event) return;
    
        try {
            let eventDate = null;
            if (event.date) {
                const [day, month, year] = event.date.split('/').map(Number);
                const potentialDate = new Date(year, month - 1, day);
                if (isValidDate(potentialDate)) {
                    eventDate = potentialDate;
                }
            }
            
            const stats = town.statistics;
            
            // Mise à jour du timespan
            if (eventDate && isValidDate(eventDate)) {
                if (!stats.timespan.firstEvent || eventDate < new Date(stats.timespan.firstEvent)) {
                    stats.timespan.firstEvent = eventDate.toISOString();
                }
                if (!stats.timespan.lastEvent || eventDate > new Date(stats.timespan.lastEvent)) {
                    stats.timespan.lastEvent = eventDate.toISOString();
                }
            }
    
            // Mise à jour des compteurs selon le type d'événement
            switch (event.type) {
                case 'birth':
                    stats.birthCount++;
                    if (event.personDetails?.surname) {
                        this.updatePatronymeStats(stats, event.personDetails.surname, eventDate?.getFullYear());
                    }
                    break;
                case 'death':
                    stats.deathCount++;
                    if (event.personDetails?.birthPlace === town.town) {
                        stats.localDeaths++;
                    } else {
                        stats.externalDeaths++;
                    }
                    break;
                case 'marriage':
                    stats.marriageCount++;
                    break;
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour des statistiques:', error);
        }
    }

    // Modification du contenu de l'infoWindow pour inclure les nouvelles données
    updatePatronymeStats(stats, surname, year) {
        if (!stats || !surname || !year) return;
    
        try {
            // Vérifier et initialiser la structure patronymes si nécessaire
            if (!stats.patronymes) {
                stats.patronymes = {
                    total: new Set(),
                    byPeriod: new Map(),
                    frequents: [],
                    evolution: []
                };
            }
            
            // Vérifier et recréer total si nécessaire
            if (!(stats.patronymes.total instanceof Set)) {
                stats.patronymes.total = new Set();
            }
    
            // Ajouter le patronyme
            stats.patronymes.total.add(surname);
    
            // Vérifier et recréer byPeriod si nécessaire
            if (!(stats.patronymes.byPeriod instanceof Map)) {
                stats.patronymes.byPeriod = new Map();
            }
    
            // Calculer la période
            const period = Math.floor(year / 50) * 50;
            const periodKey = `${period}-${period + 49}`;
    
            // Récupérer ou créer la Map pour la période
            let periodMap;
            if (!stats.patronymes.byPeriod.has(periodKey)) {
                periodMap = new Map();
                stats.patronymes.byPeriod.set(periodKey, periodMap);
            } else {
                periodMap = stats.patronymes.byPeriod.get(periodKey);
                if (!(periodMap instanceof Map)) {
                    periodMap = new Map();
                    stats.patronymes.byPeriod.set(periodKey, periodMap);
                }
            }
    
            // Mettre à jour le compteur
            const currentCount = periodMap.get(surname) || 0;
            periodMap.set(surname, currentCount + 1);
    
            // Mettre à jour les fréquences
            this.updateFrequentPatronymes(stats);
        } catch (error) {
            console.error('Erreur lors de la mise à jour des patronymes:', error);
            console.error('État actuel des patronymes:', stats.patronymes);
        }
    }

    updateFrequentPatronymes(stats) {
        if (!stats?.patronymes?.byPeriod) return;
    
        try {
            // S'assurer que byPeriod est une Map
            if (!(stats.patronymes.byPeriod instanceof Map)) {
                stats.patronymes.byPeriod = new Map();
            }
    
            const frequency = new Map();
            
            for (const [, periodMap] of stats.patronymes.byPeriod) {
                if (periodMap instanceof Map) {
                    for (const [surname, count] of periodMap) {
                        frequency.set(surname, (frequency.get(surname) || 0) + count);
                    }
                }
            }
    
            const frequents = Array.from(frequency.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([surname, count]) => ({ surname, count }));
    
            runInAction(() => {
                stats.patronymes.frequents = frequents;
            });
    
            this.calculatePatronymeEvolution(stats);
        } catch (error) {
            console.error('Erreur lors de la mise à jour des fréquences:', error);
        }
    }    
    
    calculatePatronymeEvolution(stats) {
        if (!stats?.patronymes?.byPeriod || !stats?.patronymes?.frequents) return;
    
        try {
            // Obtenir la liste des patronymes les plus fréquents
            const topSurnames = stats.patronymes.frequents.map(p => p.surname);
            const evolution = [];
    
            // Traitement de chaque période
            const periods = Array.from(stats.patronymes.byPeriod.keys()).sort();
            
            for (const period of periods) {
                const patronymeMap = stats.patronymes.byPeriod.get(period);
                if (!(patronymeMap instanceof Map)) continue;
    
                const evolutionEntry = { period };
                
                // Pour chaque patronyme principal
                topSurnames.forEach(surname => {
                    evolutionEntry[surname] = patronymeMap.get(surname) || 0;
                });
    
                evolution.push(evolutionEntry);
            }
    
            // Mise à jour observable de l'évolution
            runInAction(() => {
                stats.patronymes.evolution = evolution;
            });
        } catch (error) {
            console.error('Erreur lors du calcul de l\'évolution:', error);
        }
    }

    initializePatronymesStructure() {
        return {
            total: new Set(),
            byPeriod: new Map(),
            frequents: [],
            evolution: []
        };
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
