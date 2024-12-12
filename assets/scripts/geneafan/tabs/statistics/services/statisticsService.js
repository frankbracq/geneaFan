import statisticsStore from '../statisticsStore.js';

class StatisticsService {
    constructor() {
        this.worker = null;
        this.onProgressCallback = null;  // ✅ Défini dans le constructeur
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
                    this.updateStatisticsStore(e.data.data);
                    break;
                case 'progress':
                    if (this.onProgressCallback) {
                        this.onProgressCallback(e.data.data);
                    }
                    break;
            }
        });
    }

    // La méthode onProgress doit être publique
    onProgress(callback) {  // ✅ Méthode pour définir le callback
        this.onProgressCallback = callback;
    }

    processData(individuals, families) {
        if (!this.worker) {
            this.initialize();
        }
    
        // Préparer les données en conservant la structure nécessaire
        const simplifiedData = {
            individuals: individuals.map(individual => ({
                pointer: individual.pointer,
                tree: individual.tree.map(node => {
                    const result = {
                        tag: node.tag,
                        data: node.data
                    };
                    if (node.tree) {
                        result.tree = node.tree.map(subNode => ({
                            tag: subNode.tag,
                            data: subNode.data,
                            tree: subNode.tree ? subNode.tree.map(leaf => ({
                                tag: leaf.tag,
                                data: leaf.data
                            })) : undefined
                        }));
                    }
                    return result;
                })
            })),
            families: families.map(family => ({
                pointer: family.pointer,
                tree: family.tree.map(node => {
                    const result = {
                        tag: node.tag,
                        data: node.data
                    };
                    if (node.tree) {
                        result.tree = node.tree.map(subNode => ({
                            tag: subNode.tag,
                            data: subNode.data
                        }));
                    }
                    return result;
                })
            }))
        };
    
        statisticsStore.resetStatistics();
        this.worker.postMessage({
            type: 'process',
            data: simplifiedData
        });
    }

    updateStatisticsStore(statistics) {
        statisticsStore.resetStatistics();
        
        // Update all statistics
        statisticsStore.updateTotalIndividuals(statistics.totalIndividuals);
        statisticsStore.updateGenderCount('male', statistics.genderCount.male);
        statisticsStore.updateGenderCount('female', statistics.genderCount.female);
        
        statistics.birthYears.forEach(year => statisticsStore.addBirthYear(year));
        statistics.deathYears.forEach(year => statisticsStore.addDeathYear(year));
        statistics.agesAtDeath.forEach(age => statisticsStore.addAgeAtDeath(age));
        
        statisticsStore.updateMarriages(statistics.marriages);
        statistics.childrenPerCouple.forEach(count => statisticsStore.addChildrenPerCouple(count));
        
        Object.entries(statistics.ageAtFirstChild).forEach(([period, ages]) => {
            ages.forEach(age => statisticsStore.addAgeAtFirstChild(parseInt(period), age));
        });
    
        // Ajouter le log ici après toutes les mises à jour
        console.log('Statistics updated:', statisticsStore.getStatistics());
    }

    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

export const statisticsService = new StatisticsService();