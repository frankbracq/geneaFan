function processStatistics(data) {
    const { individuals, scope } = data;

    const statistics = {
        // Démographie générale
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
            },
            // Nouvelle structure pour la distribution par décennie
            ageDistributionByDecade: {}
        },

        // Géographie - structure mise à jour
        geography: {
            birthPlaces: new Map(),
            deathPlaces: new Map(),
            migrations: {
                count: 0,
                localCount: 0,
                paths: new Map(),
                distances: [],
                averageDistance: 0
            },
            byGeneration: new Map()
        },

        // Reste des statistiques inchangé
        occupations: {
            total: 0,
            byType: new Map(),
            byGeneration: new Map(),
            evolution: new Map(),
            mobility: {
                parentChild: new Map(),
                count: 0
            }
        },

        family: {
            marriages: {
                total: 0,
                ageAtMarriage: [],
                byDecade: new Map()
            },
            children: {
                average: 0,
                distribution: new Map(),
                byGeneration: new Map()
            },
            siblings: {
                average: 0,
                distribution: new Map()
            }
        },

        names: {
            firstNames: {
                male: new Map(),
                female: new Map()
            },
            transmission: {
                fromParents: 0,
                total: 0
            },
            byDecade: new Map()
        }
    };

    self.postMessage({
        type: 'progress',
        data: 0
    });

    console.log('Initial age distribution:', statistics.demography.ageDistribution);

    individuals.forEach((individual, index) => {
        const { demography: demoStats, family, identity } = individual.stats;

        statistics.demography.total++;
        statistics.demography.gender[identity.gender]++;

        if (demoStats.generation) {
            statistics.demography.generations.set(
                demoStats.generation,
                (statistics.demography.generations.get(demoStats.generation) || 0) + 1
            );
        }

        // Calcul amélioré de l'âge au décès et distribution par décennie
        if (demoStats.birthInfo.year && demoStats.deathInfo.year) {
            const birthDecade = Math.floor(demoStats.birthInfo.year / 10) * 10;
            const age = demoStats.deathInfo.ageAtDeath;
            
            if (age) {
                const ageRange = getAgeRange(age);
                
                // S'assurer que la valeur existe avant l'incrémentation
                if (statistics.demography.ageDistribution[ageRange] === undefined) {
                    statistics.demography.ageDistribution[ageRange] = 0;
                }
                statistics.demography.ageDistribution[ageRange]++;
        
                // Distribution par décennie de naissance
                if (!statistics.demography.ageDistributionByDecade[birthDecade]) {
                    statistics.demography.ageDistributionByDecade[birthDecade] = {
                        "0-10": 0, "11-20": 0, "21-30": 0, "31-40": 0,
                        "41-50": 0, "51-60": 0, "61-70": 0, "71-80": 0,
                        "81-90": 0, "91+": 0
                    };
                }
                statistics.demography.ageDistributionByDecade[birthDecade][ageRange]++;
        
                // Espérance de vie par décennie
                if (!statistics.demography.lifeExpectancy.byDecade[birthDecade]) {
                    statistics.demography.lifeExpectancy.byDecade[birthDecade] = [];
                }
                statistics.demography.lifeExpectancy.byDecade[birthDecade].push(age);
            }
        }

        // Traitement des statistiques géographiques
        processGeographyStats(individual, statistics);

        // Traitement des professions
        if (identity.occupations && identity.occupations.length > 0) {
            statistics.occupations.total++;
            identity.occupations.forEach(occ => {
                statistics.occupations.byType.set(
                    occ.value,
                    (statistics.occupations.byType.get(occ.value) || 0) + 1
                );

                if (occ.year) {
                    const decade = Math.floor(occ.year / 10) * 10;
                    if (!statistics.occupations.evolution.has(decade)) {
                        statistics.occupations.evolution.set(decade, new Map());
                    }
                    const decadeMap = statistics.occupations.evolution.get(decade);
                    decadeMap.set(occ.value, (decadeMap.get(occ.value) || 0) + 1);
                }
            });
        }

        // Statistiques familiales
        if (family.marriages && family.marriages.length > 0) {
            statistics.family.marriages.total++;
            family.marriages.forEach(marriage => {
                if (marriage.date) {
                    const decade = Math.floor(marriage.date.year / 10) * 10;
                    statistics.family.marriages.byDecade.set(
                        decade,
                        (statistics.family.marriages.byDecade.get(decade) || 0) + 1
                    );
                }
            });
        }

        if (family.totalChildren > 0) {
            statistics.family.children.distribution.set(
                family.totalChildren,
                (statistics.family.children.distribution.get(family.totalChildren) || 0) + 1
            );
        }

        if (family.parentalFamily.siblingCount > 0) {
            statistics.family.siblings.distribution.set(
                family.parentalFamily.siblingCount,
                (statistics.family.siblings.distribution.get(family.parentalFamily.siblingCount) || 0) + 1
            );
        }

        // Statistiques des prénoms
        if (identity.firstName) {
            const genderMap = identity.gender === 'male' ?
                statistics.names.firstNames.male :
                statistics.names.firstNames.female;

            genderMap.set(
                identity.firstName,
                (genderMap.get(identity.firstName) || 0) + 1
            );
        }

        if (index % 100 === 0) {
            self.postMessage({
                type: 'progress',
                data: Math.round((index / individuals.length) * 100)
            });
        }
    });

    // Calculs finaux
    finalizeDemographyStats(statistics);
    finalizeGeographyStats(statistics);
    finalizeFamilyStats(statistics);
    finalizeNameStats(statistics);

    console.log('Final age distribution:', statistics.demography.ageDistribution);

    self.postMessage({
        type: 'statistics',
        data: statistics,
        scope: scope
    });
}

function processGeographyStats(individual, statistics) {
    const { demography } = individual.stats;

    if (demography.birthInfo.place.town) {
        const birthPlace = `${demography.birthInfo.place.town}, ${demography.birthInfo.place.departement}`;
        const deathPlace = demography.deathInfo.place.town ?
            `${demography.deathInfo.place.town}, ${demography.deathInfo.place.departement}` : null;

        // Initialiser ou obtenir les stats pour ce lieu de naissance
        let birthStats = statistics.geography.birthPlaces.get(birthPlace) || {
            total: 0,           // Total des naissances
            stayedCount: 0,     // Restés sur place (<10km)
            localMoveCount: 0,  // Déplacement local (10-20km)
            movedCount: 0,      // Migration réelle (>20km)
            unknownCount: 0     // Lieu de décès inconnu
        };

        birthStats.total++;

        if (deathPlace) {
            const distance = calculateDistance(
                demography.birthInfo.place.coordinates,
                demography.deathInfo.place.coordinates
            );

            let moveType = 'unknown';
            if (birthPlace === deathPlace) {
                moveType = 'stayed';
            } else if (distance !== null) {
                if (distance <= 10) {
                    moveType = 'stayed';
                } else if (distance <= 20) {
                    moveType = 'local';
                } else {
                    moveType = 'moved';
                }
            } else {
                // Si pas de coordonnées mais lieux différents
                moveType = 'moved';
            }

            // Mise à jour des statistiques du lieu de décès
            let deathStats = statistics.geography.deathPlaces.get(deathPlace) || {
                total: 0,
                fromHere: 0,        // Nés et décédés ici ou très proche
                fromLocal: 0,       // Venus d'un lieu proche
                fromElsewhere: 0    // Venus de plus loin
            };
            deathStats.total++;

            // Mettre à jour les statistiques selon le type de déplacement
            switch (moveType) {
                case 'stayed':
                    birthStats.stayedCount++;
                    deathStats.fromHere++;
                    break;

                case 'local':
                    birthStats.localMoveCount++;
                    deathStats.fromLocal++;
                    statistics.geography.migrations.localCount =
                        (statistics.geography.migrations.localCount || 0) + 1;
                    break;

                case 'moved':
                    birthStats.movedCount++;
                    deathStats.fromElsewhere++;
                    statistics.geography.migrations.count++;

                    // Enregistrer le chemin de migration
                    const pathKey = `${birthPlace}=>${deathPlace}`;
                    statistics.geography.migrations.paths.set(
                        pathKey,
                        (statistics.geography.migrations.paths.get(pathKey) || 0) + 1
                    );
                    break;
            }

            // Enregistrer la distance si disponible
            if (distance !== null) {
                statistics.geography.migrations.distances.push({
                    distance,
                    type: moveType,
                    birthPlace,
                    deathPlace
                });
            }

            // Mettre à jour les statistiques des lieux de décès
            statistics.geography.deathPlaces.set(deathPlace, deathStats);
        } else {
            // Cas où le lieu de décès est inconnu
            birthStats.unknownCount++;
        }

        // Vérification de l'égalité des totaux
        const computedTotal = birthStats.stayedCount +
            birthStats.localMoveCount +
            birthStats.movedCount +
            birthStats.unknownCount;

        if (computedTotal !== birthStats.total) {
            console.error(`Incohérence dans les totaux pour ${birthPlace}: 
                Total=${birthStats.total}, 
                Somme=${computedTotal} 
                (Stayed=${birthStats.stayedCount}, 
                Local=${birthStats.localMoveCount}, 
                Moved=${birthStats.movedCount}, 
                Unknown=${birthStats.unknownCount})`);
        }

        // Mettre à jour les statistiques des lieux de naissance
        statistics.geography.birthPlaces.set(birthPlace, birthStats);

        // Mettre à jour les statistiques par génération
        if (demography.generation) {
            const genStats = statistics.geography.byGeneration.get(demography.generation) || new Map();
            const genCount = genStats.get(birthPlace) || 0;
            genStats.set(birthPlace, genCount + 1);
            statistics.geography.byGeneration.set(demography.generation, genStats);
        }
    }
}

function getAgeRange(age) {
    // console.log('Getting range for age:', age);
    const ranges = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    for (let range of ranges) {
        if (age <= range) {
            const result = `${range - 10}-${range}`;
            // console.log('Found range:', result);
            return result;
        }
    }
    console.log('Age > 90, returning 91+');
    return "91+";
}

function calculateDistance(coord1, coord2) {
    if (!coord1 || !coord2) return null;

    const R = 6371; // Rayon de la Terre en km
    const lat1 = parseFloat(coord1.latitude) * Math.PI / 180;
    const lat2 = parseFloat(coord2.latitude) * Math.PI / 180;
    const lon1 = parseFloat(coord1.longitude) * Math.PI / 180;
    const lon2 = parseFloat(coord2.longitude) * Math.PI / 180;

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function finalizeDemographyStats(statistics) {
    console.log('Final age distribution:', {
        distribution: { ...statistics.demography.ageDistribution },
        total: Object.values(statistics.demography.ageDistribution)
            .reduce((sum, count) => sum + count, 0)
    });
    // Calculer l'espérance de vie moyenne par décennie
    Object.entries(statistics.demography.lifeExpectancy.byDecade).forEach(([decade, ages]) => {
        statistics.demography.lifeExpectancy.byDecade[decade] =
            ages.reduce((a, b) => a + b, 0) / ages.length;
    });

    // Calculer l'espérance de vie moyenne globale
    const allAges = Object.values(statistics.demography.ageDistribution)
        .reduce((a, b) => a + b, 0);
    statistics.demography.lifeExpectancy.average = allAges /
        statistics.demography.total;
}

function finalizeGeographyStats(statistics) {
    // Convertir les Maps en objets
    statistics.geography.birthPlaces = Object.fromEntries(
        Array.from(statistics.geography.birthPlaces.entries()).map(([place, stats]) => {
            // Ajouter des statistiques sur la répartition
            stats.percentages = {
                stayed: (stats.stayedCount / stats.total * 100).toFixed(1),
                local: (stats.localMoveCount / stats.total * 100).toFixed(1),
                moved: (stats.movedCount / stats.total * 100).toFixed(1),
                unknown: (stats.unknownCount / stats.total * 100).toFixed(1)
            };
            return [place, stats];
        })
    );
    statistics.geography.deathPlaces = Object.fromEntries(statistics.geography.deathPlaces);
    statistics.geography.migrations.paths = Object.fromEntries(statistics.geography.migrations.paths);

    // Calculer la distance moyenne de migration
    if (statistics.geography.migrations.distances.length > 0) {
        statistics.geography.migrations.averageDistance =
            statistics.geography.migrations.distances.reduce((a, b) => a + b, 0) /
            statistics.geography.migrations.distances.length;
    }

    // Convertir les statistiques par génération
    statistics.geography.byGeneration = Object.fromEntries(
        Array.from(statistics.geography.byGeneration.entries())
            .map(([gen, places]) => [gen, Object.fromEntries(places)])
    );
}

function finalizeFamilyStats(statistics) {
    // Calculer la moyenne d'enfants par couple
    let totalChildren = 0;
    let totalFamilies = 0;
    statistics.family.children.distribution.forEach((count, size) => {
        totalChildren += size * count;
        totalFamilies += count;
    });
    statistics.family.children.average =
        totalFamilies > 0 ? totalChildren / totalFamilies : 0;

    // Convertir les Maps en objets
    statistics.family.children.distribution =
        Object.fromEntries(statistics.family.children.distribution);
    statistics.family.siblings.distribution =
        Object.fromEntries(statistics.family.siblings.distribution);
}

function finalizeNameStats(statistics) {
    // Convertir les Maps de prénoms en objets
    statistics.names.firstNames.male =
        Object.fromEntries(statistics.names.firstNames.male);
    statistics.names.firstNames.female =
        Object.fromEntries(statistics.names.firstNames.female);

    // Calculer le taux de transmission des prénoms
    if (statistics.names.transmission.total > 0) {
        statistics.names.transmission.rate =
            statistics.names.transmission.fromParents /
            statistics.names.transmission.total;
    }
}

self.addEventListener('message', (e) => {
    if (e.data.type === 'process') {
        processStatistics(e.data.data);
    }
});
