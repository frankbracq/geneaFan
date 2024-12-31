class MapStatisticsStore {
    constructor() {
        this.resetStatistics();
        this._missingLocationsLog = [];
    }

    resetStatistics() {
        this.statistics = {
            total: 0,
            withLocation: 0,
            withoutLocation: 0,
            generations: {},
            categories: {
                withCoordinates: 0,
                noPlace: 0,
                noCoordinates: 0,
                emptyName: 0,
                unknownParent: 0
            }
        };
    }

    processNodeStatistics(node) {
        if (!node) {
            return;
        }

        this.statistics.total++;
        const birthInfo = node.stats?.demography?.birthInfo;

        if (this.hasValidCoordinates(birthInfo)) {
            this.processValidLocation(node);
        } else {
            this.processInvalidLocation(node, birthInfo);
        }
    }

    hasValidCoordinates(birthInfo) {
        return birthInfo?.place?.coordinates?.latitude;
    }

    processValidLocation(node) {
        this.statistics.withLocation++;
        this.statistics.categories.withCoordinates++;
        
        // Mise à jour des statistiques par génération
        const generation = node.generation || 0;
        this.statistics.generations[generation] = (this.statistics.generations[generation] || 0) + 1;
    }

    processInvalidLocation(node, birthInfo) {
        if (!this.hasValidName(node)) {
            this.statistics.categories.emptyName++;
            return;
        }

        if (!birthInfo?.place) {
            this.statistics.categories.noPlace++;
        } else if (!birthInfo.place.coordinates) {
            this.statistics.categories.noCoordinates++;
        }

        this.addToMissingLocationsLog(node);
    }

    hasValidName(node) {
        return node.name?.trim() || node.surname?.trim();
    }

    addToMissingLocationsLog(node) {
        this._missingLocationsLog.push({
            'Nom': `${node.name || ''} ${node.surname || ''}`.trim(),
            'Génération': node.generation || 0,
            'N° Sosa': node.sosa || '',
            'Année': node.birthYear || '',
            'Statut': this.getMissingLocationStatus(node)
        });
    }

    getMissingLocationStatus(node) {
        const birthInfo = node.stats?.demography?.birthInfo;
        if (!birthInfo?.place) return 'Lieu manquant';
        if (!birthInfo.place.coordinates) return 'Coordonnées manquantes';
        return 'Autre problème';
    }

    displayStatistics() {
        const styles = {
            header: 'color: white; background: #3b82f6; padding: 4px 8px; border-radius: 4px;',
            subheader: 'color: #3b82f6; font-weight: bold;',
            success: 'color: #10b981;',
            error: 'color: #ef4444;',
            warning: 'color: #f59e0b;'
        };

        console.group('%c📍 Analyse géographique des individus', styles.header);

        // Statistiques générales
        console.group('Statistiques globales');
        console.table({
            'Total des individus': this.statistics.total,
            'Lieux identifiés': this.statistics.withLocation,
            'Lieux manquants': this.statistics.withoutLocation
        });
        console.groupEnd();

        // Répartition par génération
        if (Object.keys(this.statistics.generations).length > 0) {
            console.group('%cRépartition par génération', styles.subheader);
            console.table(
                Object.entries(this.statistics.generations)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .reduce((acc, [gen, count]) => {
                        acc[`Génération ${gen}`] = count;
                        return acc;
                    }, {})
            );
            console.groupEnd();
        }

        // Afficher les lieux manquants
        if (this._missingLocationsLog.length > 0) {
            console.group('%cLieux manquants', styles.warning);
            console.table(this._missingLocationsLog);
            this._missingLocationsLog = []; // Réinitialiser pour le prochain traitement
            console.groupEnd();
        }

        console.groupEnd();
    }

    // Getters pour accéder aux statistiques
    get totalIndividuals() {
        return this.statistics.total;
    }

    get individualsWithLocation() {
        return this.statistics.withLocation;
    }

    get individualsWithoutLocation() {
        return this.statistics.withoutLocation;
    }

    get generationStats() {
        return this.statistics.generations;
    }

    get categoryStats() {
        return this.statistics.categories;
    }
}

export const mapStatisticsStore = new MapStatisticsStore();