class StatisticsStore {
    constructor() {
        this.resetStatistics();
    }

    resetStatistics() {
        this.statistics = {
            demography: {
                total: 0,
                gender: { male: 0, female: 0, unknown: 0 },
                generations: new Map(),
                lifeExpectancy: {
                    byDecade: {},
                    average: 0
                },
                ageDistribution: {
                    "0-10": 0, "11-20": 0, "21-30": 0, "31-40": 0,
                    "41-50": 0, "51-60": 0, "61-70": 0, "71-80": 0,
                    "81-90": 0, "91+": 0
                }
            },
            geography: {
                birthPlaces: {},
                deathPlaces: {},
                migrations: {
                    count: 0,
                    paths: {},
                    distances: [],
                    averageDistance: 0
                },
                byGeneration: {}
            },
            occupations: {
                total: 0,
                byType: {},
                byGeneration: {},
                evolution: {},
                mobility: {
                    parentChild: {},
                    count: 0
                }
            },
            family: {
                marriages: {
                    total: 0,
                    ageAtMarriage: [],
                    byDecade: {}
                },
                children: {
                    average: 0,
                    distribution: {},
                    byGeneration: {}
                },
                siblings: {
                    average: 0,
                    distribution: {}
                }
            },
            names: {
                firstNames: {
                    male: {},
                    female: {}
                },
                transmission: {
                    fromParents: 0,
                    total: 0,
                    rate: 0
                },
                byDecade: {}
            }
        };
    }

    updateStatistics(newStats) {
        // Mise à jour simple de toutes les statistiques
        Object.assign(this.statistics, newStats);
    }

    // Getters existants
    getStatistics() {
        return this.statistics;
    }

    // Méthodes spécifiques pour accéder aux différentes catégories
    getDemographyStats() {
        return this.statistics.demography;
    }

    getGeographyStats() {
        return this.statistics.geography;
    }

    getOccupationStats() {
        return this.statistics.occupations;
    }

    getFamilyStats() {
        return this.statistics.family;
    }

    getNameStats() {
        return this.statistics.names;
    }

    // Méthodes utilitaires pour obtenir des statistiques spécifiques
    getAverageLifespan() {
        return this.statistics.demography.lifeExpectancy.average;
    }

    getGenderDistribution() {
        const total = Object.values(this.statistics.demography.gender).reduce((a, b) => a + b, 0);
        return {
            male: (this.statistics.demography.gender.male / total * 100).toFixed(1),
            female: (this.statistics.demography.gender.female / total * 100).toFixed(1)
        };
    }

    getAverageChildrenPerCouple() {
        return this.statistics.family.children.average.toFixed(1);
    }

    getMostCommonBirthPlaces(limit = 10) {
        return Object.entries(this.statistics.geography.birthPlaces)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit);
    }

    getMostCommonOccupations(limit = 10) {
        return Object.entries(this.statistics.occupations.byType)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit);
    }

    getMostCommonFirstNames(gender, limit = 10) {
        return Object.entries(this.statistics.names.firstNames[gender])
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit);
    }
}

const statisticsStore = new StatisticsStore();
export default statisticsStore;