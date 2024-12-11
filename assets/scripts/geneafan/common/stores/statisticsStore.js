import _ from 'lodash';

class StatisticsStore {
    constructor() {
        this.resetStatistics();
    }

    resetStatistics() {
        this.statistics = {
            totalIndividuals: 0,
            genderCount: { male: 0, female: 0 },
            birthYears: [],
            deathYears: [],
            agesAtDeath: [],
            marriages: 0,
            childrenPerCouple: [],
            ageAtFirstChild: {}
        };
    }

    // Getters
    getStatistics() {
        return this.statistics;
    }

    getAverageLifespan() {
        return this.statistics.agesAtDeath.length > 0
            ? _.mean(this.statistics.agesAtDeath).toFixed(1)
            : 0;
    }

    getAverageChildrenPerCouple() {
        return this.statistics.childrenPerCouple.length > 0
            ? _.mean(this.statistics.childrenPerCouple).toFixed(1)
            : 0;
    }

    getAverageAgeAtFirstChildByPeriod(period) {
        const ages = this.statistics.ageAtFirstChild[period];
        return ages && ages.length > 0 ? _.mean(ages).toFixed(1) : 0;
    }

    getDateRange() {
        const earliestBirth = _.min(this.statistics.birthYears);
        const latestDeath = _.max(this.statistics.deathYears);
        return {
            start: earliestBirth || 0,
            end: latestDeath || new Date().getFullYear()
        };
    }

    getGenderDistribution() {
        const total = this.statistics.genderCount.male + this.statistics.genderCount.female;
        return {
            male: total > 0 ? (this.statistics.genderCount.male / total * 100).toFixed(1) : 0,
            female: total > 0 ? (this.statistics.genderCount.female / total * 100).toFixed(1) : 0
        };
    }

    // Setters and updaters
    updateTotalIndividuals(count) {
        this.statistics.totalIndividuals += count;
    }

    updateGenderCount(gender, count) {
        if (gender === 'male' || gender === 'female') {
            this.statistics.genderCount[gender] += count;
        }
    }

    addBirthYear(year) {
        if (year && !isNaN(year)) {
            this.statistics.birthYears.push(parseInt(year));
        }
    }

    addDeathYear(year) {
        if (year && !isNaN(year)) {
            this.statistics.deathYears.push(parseInt(year));
        }
    }

    addAgeAtDeath(age) {
        if (age && !isNaN(age)) {
            this.statistics.agesAtDeath.push(parseInt(age));
        }
    }

    updateMarriages(count) {
        this.statistics.marriages += count;
    }

    addChildrenPerCouple(count) {
        if (!isNaN(count)) {
            this.statistics.childrenPerCouple.push(parseInt(count));
        }
    }

    addAgeAtFirstChild(period, age) {
        if (!isNaN(period) && !isNaN(age)) {
            if (!this.statistics.ageAtFirstChild[period]) {
                this.statistics.ageAtFirstChild[period] = [];
            }
            this.statistics.ageAtFirstChild[period].push(parseInt(age));
        }
    }

    // Analytics methods
    getAgeDistribution() {
        return {
            under20: this.statistics.agesAtDeath.filter(age => age < 20).length,
            '20to40': this.statistics.agesAtDeath.filter(age => age >= 20 && age < 40).length,
            '40to60': this.statistics.agesAtDeath.filter(age => age >= 40 && age < 60).length,
            '60to80': this.statistics.agesAtDeath.filter(age => age >= 60 && age < 80).length,
            over80: this.statistics.agesAtDeath.filter(age => age >= 80).length
        };
    }

    getBirthDistributionByPeriod(periodLength = 50) {
        const birthYears = _.compact(this.statistics.birthYears);
        if (birthYears.length === 0) return {};

        const minYear = _.min(birthYears);
        const maxYear = _.max(birthYears);
        const distribution = {};

        for (let year = minYear; year <= maxYear; year += periodLength) {
            const periodEnd = year + periodLength - 1;
            const count = birthYears.filter(y => y >= year && y <= periodEnd).length;
            distribution[`${year}-${periodEnd}`] = count;
        }

        return distribution;
    }
}

// Create and export a singleton instance
const statisticsStore = new StatisticsStore();
export default statisticsStore;