import { makeObservable, observable, action, runInAction } from '../common/stores/mobx-config.js';
import _ from 'lodash';
import { TAGS } from './gedcomConstantsStore.js';

class TownCacheStore {
    townsCache = new Map();

    constructor() {
        makeObservable(this, {
            townsCache: observable,
            setTownsCache: action,
            addTown: action,
            clearTownsCache: action
        });
    }

    buildTownsCache(allIndividuals) {
        console.time("buildTownsCache");
        const newCache = new Map();

        // Fonction utilitaire pour extraire les événements d'un individu
        const extractEvents = (individual) => {
            const events = [];
            const addEvent = (type, node) => {
                const dateNode = node.tree?.find(n => n.tag === TAGS.DATE);
                const placeNode = node.tree?.find(n => n.tag === TAGS.PLAC);
                if (placeNode) {
                    events.push({
                        type,
                        date: dateNode?.data || null,
                        personId: individual.pointer,
                        personDetails: {
                            name: individual.tree.find(n => n.tag === TAGS.GIVN)?.data || '',
                            surname: individual.tree.find(n => n.tag === TAGS.SURN)?.data || '',
                            gender: individual.tree.find(n => n.tag === TAGS.SEX)?.data || '',
                            birthDate: '',
                            deathDate: '',
                            birthPlace: '',
                            deathPlace: '',
                            occupation: ''
                        }
                    });
                }
            };

            // Extraire les événements principaux
            individual.tree?.forEach(node => {
                switch(node.tag) {
                    case TAGS.BIRTH:
                        addEvent('BIRT', node);
                        break;
                    case TAGS.DEATH:
                        addEvent('DEAT', node);
                        break;
                    case TAGS.MARRIAGE:
                        addEvent('MARR', node);
                        break;
                    case TAGS.BURIAL:
                        addEvent('BURI', node);
                        break;
                    case TAGS.OCCUPATION:
                        addEvent('OCCU', node);
                        break;
                }
            });

            return events;
        };

        // Traiter chaque individu
        allIndividuals.forEach(individual => {
            const events = extractEvents(individual);
            
            events.forEach(event => {
                // Trouver ou créer l'entrée de la ville
                const placeNode = individual.tree?.find(node => 
                    node.tag === event.type)?.tree?.find(n => n.tag === TAGS.PLAC);
                
                if (!placeNode?.data) return;

                const townKey = placeNode.key || placeNode.data;
                let townData = newCache.get(townKey) || {
                    town: placeNode.data,
                    townDisplay: placeNode.data,
                    departement: '',
                    departementColor: '',
                    country: '',
                    countryCode: '',
                    latitude: '',
                    longitude: '',
                    events: {
                        BIRT: [],
                        DEAT: [],
                        MARR: [],
                        BURI: [],
                        OCCU: [],
                        EVEN: []
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
                            total: new Set(),
                            byPeriod: new Map(),
                            frequents: [],
                            evolution: []
                        }
                    }
                };

                // Ajouter l'événement
                if (event.type in townData.events) {
                    townData.events[event.type].push(event);
                }

                // Mettre à jour les statistiques
                this.updateTownStatistics(townData, event);

                newCache.set(townKey, townData);
            });
        });

        // Mise à jour atomique du cache
        runInAction(() => {
            this.townsCache = newCache;
        });

        console.timeEnd("buildTownsCache");
        
        // Log du contenu du cache pour debugging
        this.debugCache();
    }

    updateTownStatistics(townData, event) {
        // Mettre à jour les compteurs
        switch(event.type) {
            case 'BIRT':
                townData.statistics.birthCount++;
                townData.statistics.patronymes.total.add(event.personDetails.surname);
                break;
            case 'DEAT':
                townData.statistics.deathCount++;
                break;
            case 'MARR':
                townData.statistics.marriageCount++;
                break;
        }

        // Mettre à jour la période
        if (event.date) {
            const eventDate = new Date(event.date.split('/').reverse().join('-'));
            if (!townData.statistics.timespan.firstEvent || eventDate < new Date(townData.statistics.timespan.firstEvent)) {
                townData.statistics.timespan.firstEvent = eventDate.toISOString();
            }
            if (!townData.statistics.timespan.lastEvent || eventDate > new Date(townData.statistics.timespan.lastEvent)) {
                townData.statistics.timespan.lastEvent = eventDate.toISOString();
            }
        }
    }

    // Méthodes d'accès au cache
    getTown(townKey) {
        return this.townsCache.get(townKey);
    }

    getTownsList() {
        return Array.from(this.townsCache.values());
    }

    setTownsCache(newCache) {
        this.townsCache = new Map(newCache);
    }

    addTown(townKey, townData) {
        this.townsCache.set(townKey, townData);
    }

    clearTownsCache() {
        this.townsCache.clear();
    }

    // Méthode de debugging pour afficher le contenu du cache
    debugCache() {
        console.group('🏘️ Towns Cache Content:');
        console.log(`Total towns: ${this.townsCache.size}`);
        
        this.townsCache.forEach((value, key) => {
            console.group(`📍 Town: ${key}`);
            console.log('Town details:', {
                name: value.town,
                display: value.townDisplay,
                location: {
                    departement: value.departement,
                    country: value.country,
                    coordinates: `${value.latitude}, ${value.longitude}`
                }
            });
            
            console.log('Events summary:', {
                births: value.events.BIRT.length,
                deaths: value.events.DEAT.length,
                marriages: value.events.MARR.length,
                burials: value.events.BURI.length,
                occupations: value.events.OCCU.length
            });
            
            console.log('Statistics:', {
                birthCount: value.statistics.birthCount,
                deathCount: value.statistics.deathCount,
                marriageCount: value.statistics.marriageCount,
                timespan: {
                    first: value.statistics.timespan.firstEvent,
                    last: value.statistics.timespan.lastEvent
                }
            });
            console.groupEnd();
        });
        
        console.groupEnd();
    }
}

const townCacheStore = new TownCacheStore();
export default townCacheStore;