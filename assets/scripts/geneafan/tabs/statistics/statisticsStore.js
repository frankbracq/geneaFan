import { makeAutoObservable, runInAction, reaction } from 'mobx';
import gedcomDataStore from '../../gedcom/gedcomDataStore';
import { statisticsService } from './services/statisticsService';

class StatisticsStore {
    familyStatistics = null;
    individualStatistics = null;
    subscribers = new Set();

    constructor() {
        makeAutoObservable(this, {
            updateFamilyStatistics: true,
            updateIndividualStatistics: true,
            resetStatistics: true,
            subscribers: false
        });

        // Réagir aux changements de hiérarchie
        reaction(
            () => gedcomDataStore.hierarchy,
            (hierarchy) => {
                if (hierarchy) {
                    statisticsService.processIndividualData(
                        hierarchy[0]?.id,
                        hierarchy
                    );
                }
            },
            {
                name: 'StatisticsStore-HierarchyReaction'
            }
        );
    }

    updateFamilyStatistics(newStats) {
        runInAction(() => {
            // Log unique lors de la mise à jour
            console.group('Updating Family Statistics');
            console.log('Main metrics:', {
                total: newStats?.demography?.total,
                marriages: newStats?.family?.marriages?.total,
                averageChildren: newStats?.family?.children?.average
            });
            console.groupEnd();
    
            this.familyStatistics = newStats;
            this.notifySubscribers('family');
        });
    }

    updateIndividualStatistics(rootId, newStats) {
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

    resetStatistics() {
        runInAction(() => {
            this.familyStatistics = null;
            this.individualStatistics = null;
        });
    }

    // Obtenir les statistiques selon le scope désiré
    getStatistics(scope = 'current') {
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
    
        // Ne logger que lors des mises à jour majeures
        if (scope === 'family' && stats?.demography?.ageDistribution) {
            const nonEmptyRanges = Object.entries(stats.demography.ageDistribution)
                .filter(([, count]) => count > 0)
                .map(([range, count]) => ({range, count}));
    
            if (nonEmptyRanges.length > 0) {
                console.group('Age Distribution Summary');
                console.table(nonEmptyRanges);
                console.groupEnd();
            }
        }
    
        return stats;
    }

    getDemographyStats(scope = 'current') {
        return this.getStatistics(scope)?.demography;
    }

    getGeographyStats(scope = 'current') {
        return this.getStatistics(scope)?.geography;
    }

    getOccupationStats(scope = 'current') {
        return this.getStatistics(scope)?.occupations;
    }

    getFamilyStats(scope = 'current') {
        return this.getStatistics(scope)?.family;
    }

    getNameStats(scope = 'current') {
        return this.getStatistics(scope)?.names;
    }

    getAverageLifespan(scope = 'current') {
        return this.getStatistics(scope)?.demography?.lifeExpectancy?.average;
    }

    getGenderDistribution(scope = 'current') {
        const gender = this.getStatistics(scope)?.demography?.gender;
        if (!gender) return null;

        const total = Object.values(gender).reduce((a, b) => a + b, 0);
        return {
            male: (gender.male / total * 100).toFixed(1),
            female: (gender.female / total * 100).toFixed(1)
        };
    }

    getAverageChildrenPerCouple(scope = 'current') {
        return this.getStatistics(scope)?.family?.children?.average?.toFixed(1);
    }

    getMostCommonBirthPlaces(limit = 10, scope = 'current') {
        const birthPlaces = this.getStatistics(scope)?.geography?.birthPlaces;
        if (!birthPlaces) return [];

        return Object.entries(birthPlaces)
            .sort(([,a], [,b]) => b.total - a.total)
            .slice(0, limit);
    }

    getMostCommonOccupations(limit = 10, scope = 'current') {
        const occupations = this.getStatistics(scope)?.occupations?.byType;
        if (!occupations) return [];

        return Object.entries(occupations)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit);
    }

    getMostCommonFirstNames(gender, limit = 10, scope = 'current') {
        const names = this.getStatistics(scope)?.names?.firstNames?.[gender];
        if (!names) return [];

        return Object.entries(names)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit);
    }

    subscribeToUpdates(callback) {
        this.subscribers.add(callback);
    }

    notifySubscribers(scope) {
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