import statisticsStore from '../statisticsStore.js';
import gedcomDataStore from '../../../gedcom/stores/gedcomDataStore.js';

class StatisticsService {
    constructor() {
        this.worker = null;
        this.onProgressCallback = null;
    }

    initialize() {
        if (this.worker) {
            this.worker.terminate();
        }

        try {
            const workerRelativePath = '../workers/statisticsWorker.js';
            
            // Vérifier si nous avons notre fonction de fallback pour les Workers
            if (window.createWorkerWithFallback) {
                // Utiliser notre fonction de fallback qui gère les chemins en environnement proxifié
                this.worker = window.createWorkerWithFallback(workerRelativePath, { type: 'module' });
                console.log('Worker créé avec helper de proxy');
            } else {
                // Approche standard avec gestion des erreurs
                try {
                    // Essayer d'abord avec import.meta si disponible
                    if (typeof import.meta !== 'undefined' && import.meta.url) {
                        const workerUrl = new URL(workerRelativePath, import.meta.url);
                        this.worker = new Worker(workerUrl, { type: 'module' });
                        console.log('Worker créé avec import.meta.url');
                    } else {
                        // Sinon, utiliser directement le chemin relatif
                        this.worker = new Worker(workerRelativePath, { type: 'module' });
                        console.log('Worker créé avec chemin relatif standard');
                    }
                } catch (e) {
                    console.warn('Erreur lors de la création du worker, essai avec chemins alternatifs:', e);
                    
                    // Si nous avons une configuration d'application, utiliser le chemin de base
                    if (window.APP_CONFIG && window.APP_CONFIG.basePath) {
                        const fullPath = `${window.APP_CONFIG.basePath}tabs/statistics/workers/statisticsWorker.js`;
                        this.worker = new Worker(fullPath, { type: 'module' });
                        console.log('Worker créé avec chemin basé sur APP_CONFIG:', fullPath);
                    } else {
                        // Dernier recours : essayer juste avec le chemin relatif sans URL
                        this.worker = new Worker(workerRelativePath, { type: 'module' });
                        console.log('Worker créé avec chemin relatif (dernier recours)');
                    }
                }
            }
            
            // Configurer les gestionnaires d'événements pour le worker
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
            
            // Ajouter un gestionnaire d'erreurs pour le débogage
            this.worker.addEventListener('error', (error) => {
                console.error('Erreur du worker:', error);
            });
            
        } catch (error) {
            console.error('Échec de l\'initialisation du worker:', error);
            // On pourrait implémenter une solution de secours sans worker ici
        }
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
                id: individual.id, // S'assurer que l'ID est inclus
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