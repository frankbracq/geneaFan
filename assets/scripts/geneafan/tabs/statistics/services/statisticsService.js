import statisticsStore from '../statisticsStore.js';
import gedcomDataStore from '../../../gedcom/gedcomDataStore.js';

class StatisticsService {
    constructor() {
        this.worker = null;
        this.onProgressCallback = null;
    }

    initialize() {
        if (this.worker) {
            this.worker.terminate();
        }

        this.worker = new Worker(
            new URL('../workers/statisticsWorker.js', import.meta.url),
            { type: 'module' }
        );
        
        this.worker.addEventListener('message', (e) => {
            switch (e.data.type) {
                case 'statistics':
                    this.updateStatisticsStore(e.data.data, e.data.scope);
                    break;
                case 'progress':
                    if (this.onProgressCallback) {
                        this.onProgressCallback(e.data.data);
                    }
                    break;
            }
        });
    }

    onProgress(callback) {
        this.onProgressCallback = callback;
    }

    processFamilyData() {
        if (!this.worker) {
            this.initialize();
        }
    
        const individuals = Array.from(gedcomDataStore.getIndividualsCache().values());
        const sanitizedData = this.sanitizeIndividuals(individuals);
        
        this.worker.postMessage({
            type: 'process',
            data: { 
                individuals: sanitizedData,
                scope: 'family'
            }
        });
    }

    processIndividualData(rootId, hierarchy) {
        if (!this.worker || !rootId || !hierarchy) {
            return;
        }

        const ancestorIds = new Set(hierarchy.map(person => person.id));
        const relevantIndividuals = Array.from(gedcomDataStore.getIndividualsCache().values())
            .filter(individual => ancestorIds.has(individual.id));
        
        const sanitizedData = this.sanitizeIndividuals(relevantIndividuals);

        this.worker.postMessage({
            type: 'process',
            data: {
                individuals: sanitizedData,
                scope: {
                    type: 'individual',
                    rootId: rootId
                }
            }
        });
    }

    sanitizeIndividuals(individuals) {
        return individuals.map(individual => {
            return {
                stats: {
                    demography: {
                        birthInfo: {
                            date: individual.stats.demography.birthInfo.date,
                            year: individual.stats.demography.birthInfo.year,
                            place: {
                                town: individual.stats.demography.birthInfo.place.town,
                                departement: individual.stats.demography.birthInfo.place.departement,
                                country: individual.stats.demography.birthInfo.place.country,
                                coordinates: {
                                    latitude: individual.stats.demography.birthInfo.place.coordinates?.latitude,
                                    longitude: individual.stats.demography.birthInfo.place.coordinates?.longitude
                                }
                            }
                        },
                        deathInfo: {
                            date: individual.stats.demography.deathInfo.date,
                            year: individual.stats.demography.deathInfo.year,
                            place: {
                                town: individual.stats.demography.deathInfo.place.town,
                                departement: individual.stats.demography.deathInfo.place.departement,
                                country: individual.stats.demography.deathInfo.place.country,
                                coordinates: {
                                    latitude: individual.stats.demography.deathInfo.place.coordinates?.latitude,
                                    longitude: individual.stats.demography.deathInfo.place.coordinates?.longitude
                                }
                            },
                            ageAtDeath: individual.stats.demography.deathInfo.ageAtDeath
                        },
                        generation: individual.stats.demography.generation
                    },
                    family: {
                        parentalFamily: {
                            fatherId: individual.stats.family.parentalFamily.fatherId,
                            motherId: individual.stats.family.parentalFamily.motherId,
                            siblingCount: individual.stats.family.parentalFamily.siblingCount
                        },
                        marriages: individual.stats.family.marriages.map(m => ({
                            date: m.date,
                            place: {
                                town: m.place.town,
                                departement: m.place.departement,
                                country: m.place.country
                            },
                            spouseId: m.spouseId,
                            childrenCount: m.childrenCount
                        })),
                        totalChildren: individual.stats.family.totalChildren
                    },
                    identity: {
                        firstName: individual.stats.identity.firstName,
                        lastName: individual.stats.identity.lastName,
                        gender: individual.stats.identity.gender,
                        occupations: individual.stats.identity.occupations.map(o => ({
                            value: o.value,
                            date: o.date,
                            year: o.year,
                            type: o.type
                        }))
                    }
                }
            };
        });
    }

    updateStatisticsStore(statistics, scope) {
        if (scope === 'family') {
            statisticsStore.updateFamilyStatistics(statistics);
        } else if (scope?.type === 'individual') {
            statisticsStore.updateIndividualStatistics(scope.rootId, statistics);
        }
    }

    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

export const statisticsService = new StatisticsService();