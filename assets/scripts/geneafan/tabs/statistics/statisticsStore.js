import { makeAutoObservable, runInAction, reaction } from 'mobx';

const AGE_RANGE_ORDER = [
    "0-10", "11-20", "21-30", "31-40", "41-50",
    "51-60", "61-70", "71-80", "81-90", "91+"
];

const CENTURY_LABELS = {
    's18': '18ème siècle et avant',
    's19': '19ème siècle',
    's20': '20ème siècle',
    's21': '21ème siècle'
};

class StatisticsStore {
    familyStatistics = null;
    individualStatistics = null;
    subscribers = new Set();
    disposers = new Set();
    initialized = false;

    constructor() {
        makeAutoObservable(this, {
            subscribers: false,
            disposers: false,
            initialized: false
        });
    }

    async initialize() {
        console.group('📊 Initialisation StatisticsStore');
        if (this.initialized) {
            console.log('Déjà initialisé');
            console.groupEnd();
            return;
        }

        try {
            // Import des dépendances
            console.log('Chargement des dépendances...');
            const [gedcomModule, statisticsServiceModule] = await Promise.all([
                import('../../gedcom/stores/gedcomDataStore.js'),
                import('./services/statisticsService.js')
            ]);

            const gedcomDataStore = gedcomModule.default;
            const { statisticsService } = statisticsServiceModule;

            // Vérification de la disponibilité des données
            console.log('Vérification des données Gedcom...');
            if (!gedcomDataStore.isFileUploaded) {
                console.log('Pas de fichier GEDCOM chargé, attente...');
                // Observateur pour attendre le chargement du fichier
                const fileUploadDisposer = reaction(
                    () => gedcomDataStore.isFileUploaded,
                    (isUploaded) => {
                        if (isUploaded) {
                            this.setupHierarchyReaction(gedcomDataStore, statisticsService);
                            fileUploadDisposer();
                        }
                    },
                    { name: 'StatisticsStore-FileUploadReaction' }
                );
                this.disposers.add(fileUploadDisposer);
            } else {
                // Si le fichier est déjà chargé, on configure directement la réaction
                this.setupHierarchyReaction(gedcomDataStore, statisticsService);
            }

            this.initialized = true;
            console.log('✅ Initialisation réussie');

        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
        console.groupEnd();
    }

    setupHierarchyReaction(gedcomDataStore, statisticsService) {
        const hierarchyDisposer = reaction(
            () => gedcomDataStore.hierarchy,
            (hierarchy) => {
                if (hierarchy) {
                    console.log('Traitement de la nouvelle hiérarchie...');
                    statisticsService.processIndividualData(
                        hierarchy[0]?.id,
                        hierarchy
                    );
                }
            },
            {
                name: 'StatisticsStore-HierarchyReaction',
                fireImmediately: true // Pour traiter la hiérarchie existante s'il y en a une
            }
        );
        this.disposers.add(hierarchyDisposer);
    }

    dispose() {
        console.log('Nettoyage du StatisticsStore');
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
        this.subscribers.clear();
        this.initialized = false;
        this.familyStatistics = null;
        this.individualStatistics = null;
    }

    updateFamilyStatistics = (newStats) => {
        runInAction(() => {
            if (newStats?.demography?.mortality?.byCentury) {
                console.group('Statistiques détaillées par siècle de naissance');
                
                const totalDeathsByCentury = Object.values(newStats.demography.mortality.byCentury)
                    .reduce((sum, century) => sum + century.total, 0);
                
                console.group('Vérification de cohérence des données');
                console.log('Total des individus:', newStats.demography.total);
                console.log('Total des décès par siècle:', totalDeathsByCentury);
                
                const individualsWithKnownDates = Object.values(newStats.demography.mortality.byCentury)
                    .reduce((total, century) => {
                        return total + Object.values(century.ageRanges)
                            .reduce((sum, count) => sum + count, 0);
                    }, 0);
                
                console.log('Total des individus avec dates connues:', individualsWithKnownDates);
                
                if (totalDeathsByCentury !== individualsWithKnownDates) {
                    console.warn('⚠️ Incohérence dans les totaux de la distribution par âge !');
                    console.log('Différence:', Math.abs(totalDeathsByCentury - individualsWithKnownDates));
                }
                
                const percentageWithDates = ((individualsWithKnownDates / newStats.demography.total) * 100).toFixed(1);
                console.log(`Pourcentage d'individus avec dates connues: ${percentageWithDates}%`);
                console.groupEnd();
                
                const totalIndividuals = newStats.demography.total;
                
                Object.entries(newStats.demography.mortality.byCentury)
                    .sort(([a], [b]) => {
                        const order = ['s18', 's19', 's20', 's21'];
                        return order.indexOf(a) - order.indexOf(b);
                    })
                    .forEach(([century, stats]) => {
                        const percentage = ((stats.total / totalIndividuals) * 100).toFixed(1);
                        console.group(`${CENTURY_LABELS[century]} (${stats.total} personnes, ${percentage}%)`);
                        
                        if (stats.ageRanges) {
                            const sortedRanges = Object.entries(stats.ageRanges)
                                .filter(([, count]) => count > 0)
                                .sort((a, b) => {
                                    const getOrder = range => {
                                        if (range === "0-1") return -1;
                                        if (range === "1-5") return -0.5;
                                        if (range === "6-10") return 0;
                                        return parseInt(range.split('-')[0]);
                                    };
                                    return getOrder(a[0]) - getOrder(b[0]);
                                });

                            const totalForCentury = stats.total;
                            const averageAge = stats.ages ? 
                                (stats.ages.reduce((sum, age) => sum + age, 0) / stats.ages.length).toFixed(1) : 
                                'N/A';

                            console.log(`Âge moyen au décès: ${averageAge} ans`);
                            console.log('Distribution des âges au décès:');
                            
                            sortedRanges.forEach(([range, count]) => {
                                const rangePercentage = ((count / totalForCentury) * 100).toFixed(1);
                                console.log(`  ${range} ans: ${count} personnes (${rangePercentage}%)`);
                            });
                        }
                        
                        console.groupEnd();
                    });

                console.groupEnd();
            }

            console.group('Métriques principales');
            console.log({
                'Total des individus': newStats?.demography?.total,
                'Mariages': newStats?.family?.marriages?.total,
                'Moyenne d\'enfants': newStats?.family?.children?.average?.toFixed(1)
            });
            console.groupEnd();
    
            this.familyStatistics = newStats;
            this.notifySubscribers('family');
        });
    }

    updateIndividualStatistics = (rootId, newStats) => {
        runInAction(() => {
            console.group('Updating Individual Statistics');
            console.log('Root ID:', rootId);
            console.log('Individual statistics:', {
                total: newStats?.demography?.total,
                gender: newStats?.demography?.gender,
                ageDistribution: newStats?.demography?.ageDistribution
            });
            console.groupEnd();

            this.individualStatistics = newStats;
            this.notifySubscribers('individual');
        });
    }

    resetStatistics = () => {
        runInAction(() => {
            this.familyStatistics = null;
            this.individualStatistics = null;
        });
    }

    getStatistics = (scope = 'current') => {
        const stats = (() => {
            switch (scope) {
                case 'family':
                    return this.familyStatistics;
                case 'individual':
                    return this.individualStatistics;
                case 'current':
                default:
                    return this.individualStatistics || this.familyStatistics;
            }
        })();
    
        if (scope === 'family' && stats?.demography?.ageDistribution) {
            const orderedRanges = AGE_RANGE_ORDER.map(range => ({
                range,
                count: stats.demography.ageDistribution[range] || 0
            }));
    
            console.group('Age Distribution Summary');
            console.table(orderedRanges);
            console.groupEnd();
        }
    
        return stats;
    }

    getOrderedAgeDistribution = (scope = 'current') => {
        const stats = this.getStatistics(scope);
        if (!stats?.demography?.ageDistribution) return [];
        
        return AGE_RANGE_ORDER.map(range => ({
            range,
            count: stats.demography.ageDistribution[range] || 0
        }));
    }

    getDemographyStats = (scope = 'current') => {
        return this.getStatistics(scope)?.demography;
    }

    getGeographyStats = (scope = 'current') => {
        return this.getStatistics(scope)?.geography;
    }

    getOccupationStats = (scope = 'current') => {
        return this.getStatistics(scope)?.occupations;
    }

    getFamilyStats = (scope = 'current') => {
        return this.getStatistics(scope)?.family;
    }

    getNameStats = (scope = 'current') => {
        return this.getStatistics(scope)?.names;
    }

    getAverageLifespan = (scope = 'current') => {
        return this.getStatistics(scope)?.demography?.lifeExpectancy?.average;
    }

    getGenderDistribution = (scope = 'current') => {
        const gender = this.getStatistics(scope)?.demography?.gender;
        if (!gender) return null;

        const total = Object.values(gender).reduce((a, b) => a + b, 0);
        return {
            male: (gender.male / total * 100).toFixed(1),
            female: (gender.female / total * 100).toFixed(1)
        };
    }

    getAverageChildrenPerCouple = (scope = 'current') => {
        return this.getStatistics(scope)?.family?.children?.average?.toFixed(1);
    }

    getMostCommonBirthPlaces = (limit = 10, scope = 'current') => {
        const birthPlaces = this.getStatistics(scope)?.geography?.birthPlaces;
        if (!birthPlaces) return [];

        return Object.entries(birthPlaces)
            .sort(([,a], [,b]) => b.total - a.total)
            .slice(0, limit);
    }

    getMostCommonOccupations = (limit = 10, scope = 'current') => {
        const occupations = this.getStatistics(scope)?.occupations?.byType;
        if (!occupations) return [];

        return Object.entries(occupations)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit);
    }

    getMostCommonFirstNames = (gender, limit = 10, scope = 'current') => {
        const names = this.getStatistics(scope)?.names?.firstNames?.[gender];
        if (!names) return [];

        return Object.entries(names)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit);
    }

    subscribeToUpdates = (callback) => {
        this.subscribers.add(callback);
    }

    notifySubscribers = (scope) => {
        console.log(`Notifying ${this.subscribers.size} subscribers for scope: ${scope}`);
        this.subscribers.forEach(callback => {
            try {
                callback(this.getStatistics(scope), scope);
            } catch (error) {
                console.error('Error in statistics subscriber:', error);
            }
        });
    }
}

const statisticsStore = new StatisticsStore();
export default statisticsStore;