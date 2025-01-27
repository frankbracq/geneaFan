import { dateProcessor } from '../processors/dateProcessor.js';
import { runInAction } from '../../common/stores/mobx-config.js';

export class TownStatisticsManager {
    static initializePatronymesStructure() {
        return {
            total: new Set(),
            byPeriod: new Map(),
            frequents: [],
            evolution: []
        };
    }

    static createEmptyStatistics() {
        return {
            birthCount: 0,
            deathCount: 0,
            marriageCount: 0,
            localDeaths: 0,
            externalDeaths: 0,
            timespan: {
                firstEvent: null,
                lastEvent: null
            },
            patronymes: this.initializePatronymesStructure()
        };
    }

    static updateTownStatistics(town, event) {
        if (!town?.statistics || !event) return;
    
        try {
            let eventDate = this.parseEventDate(event.date);
            const stats = town.statistics;
            
            this.updateTimespan(stats, eventDate);
            this.updateEventCounters(stats, event, town);
        } catch (error) {
            console.error('Erreur lors de la mise à jour des statistiques:', error);
        }
    }

    static parseEventDate(dateString) {
        if (!dateString) return null;
        
        const [day, month, year] = dateString.split('/').map(Number);
        const potentialDate = new Date(year, month - 1, day);
        return dateProcessor.isValidDate(potentialDate) ? potentialDate : null;
    }

    static updateTimespan(stats, eventDate) {
        if (!eventDate || !dateProcessor.isValidDate(eventDate)) return;

        if (!stats.timespan.firstEvent || eventDate < new Date(stats.timespan.firstEvent)) {
            stats.timespan.firstEvent = eventDate.toISOString();
        }
        if (!stats.timespan.lastEvent || eventDate > new Date(stats.timespan.lastEvent)) {
            stats.timespan.lastEvent = eventDate.toISOString();
        }
    }

    static updateEventCounters(stats, event, town) {
        if (!event?.type || !stats) return;
    
        switch (event.type.toLowerCase()) {
            case 'birth':
            case 'birt':
                stats.birthCount = (stats.birthCount || 0) + 1;
                if (event.personDetails?.surname) {
                    this.updatePatronymeStats(stats, event.personDetails.surname, 
                        this.parseEventDate(event.date)?.getFullYear());
                }
                break;
            case 'death':
            case 'deat':
                stats.deathCount = (stats.deathCount || 0) + 1;
                if (event.personDetails?.birthPlace === town?.town) {
                    stats.localDeaths = (stats.localDeaths || 0) + 1;
                } else {
                    stats.externalDeaths = (stats.externalDeaths || 0) + 1;
                }
                break;
            case 'marriage':
            case 'marr':
                stats.marriageCount = (stats.marriageCount || 0) + 1;
                break;
        }
    }

    static updatePatronymeStats(stats, surname, year) {
        if (!stats || !surname || !year) return;
    
        try {
            this.ensurePatronymesStructure(stats);
            stats.patronymes.total.add(surname);
            
            const periodKey = this.calculatePeriodKey(year);
            const periodMap = this.getOrCreatePeriodMap(stats, periodKey);
            
            this.incrementPatronymeCount(periodMap, surname);
            this.updateFrequentPatronymes(stats);
        } catch (error) {
            console.error('Erreur lors de la mise à jour des patronymes:', error);
        }
    }

    static ensurePatronymesStructure(stats) {
        if (!stats.patronymes || !(stats.patronymes.total instanceof Set)) {
            stats.patronymes = this.initializePatronymesStructure();
        }
    }

    static calculatePeriodKey(year) {
        const period = Math.floor(year / 50) * 50;
        return `${period}-${period + 49}`;
    }

    static getOrCreatePeriodMap(stats, periodKey) {
        if (!stats.patronymes.byPeriod.has(periodKey)) {
            stats.patronymes.byPeriod.set(periodKey, new Map());
        }
        return stats.patronymes.byPeriod.get(periodKey);
    }

    static incrementPatronymeCount(periodMap, surname) {
        const currentCount = periodMap.get(surname) || 0;
        periodMap.set(surname, currentCount + 1);
    }

    static updateFrequentPatronymes(stats) {
        if (!stats?.patronymes?.byPeriod) return;
    
        try {
            const frequency = this.calculatePatronymeFrequency(stats);
            const frequents = this.sortFrequentPatronymes(frequency);

            runInAction(() => {
                stats.patronymes.frequents = frequents;
            });
    
            this.calculatePatronymeEvolution(stats);
        } catch (error) {
            console.error('Erreur lors de la mise à jour des fréquences:', error);
        }
    }

    static calculatePatronymeFrequency(stats) {
        const frequency = new Map();
        
        for (const [, periodMap] of stats.patronymes.byPeriod) {
            if (periodMap instanceof Map) {
                for (const [surname, count] of periodMap) {
                    frequency.set(surname, (frequency.get(surname) || 0) + count);
                }
            }
        }

        return frequency;
    }

    static sortFrequentPatronymes(frequency) {
        return Array.from(frequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([surname, count]) => ({ surname, count }));
    }

    static calculatePatronymeEvolution(stats) {
        if (!stats?.patronymes?.byPeriod || !stats?.patronymes?.frequents) return;
    
        try {
            const topSurnames = stats.patronymes.frequents.map(p => p.surname);
            const evolution = this.buildEvolutionData(stats, topSurnames);

            runInAction(() => {
                stats.patronymes.evolution = evolution;
            });
        } catch (error) {
            console.error('Erreur lors du calcul de l\'évolution:', error);
        }
    }

    static buildEvolutionData(stats, topSurnames) {
        const evolution = [];
        const periods = Array.from(stats.patronymes.byPeriod.keys()).sort();
        
        for (const period of periods) {
            const patronymeMap = stats.patronymes.byPeriod.get(period);
            if (!(patronymeMap instanceof Map)) continue;

            const evolutionEntry = { period };
            topSurnames.forEach(surname => {
                evolutionEntry[surname] = patronymeMap.get(surname) || 0;
            });
            
            evolution.push(evolutionEntry);
        }

        return evolution;
    }
}