function processStatistics(data) {
    const { individuals } = data;
    
    const statistics = {
        // Démographie générale
        demography: {
            total: 0,
            gender: { male: 0, female: 0, unknown: 0 },
            generations: new Map(), // Distribution par génération
            lifeExpectancy: {
                byDecade: {}, // {1800: 45.5, 1810: 48.2, ...}
                average: 0
            },
            ageDistribution: {
                "0-10": 0, "11-20": 0, "21-30": 0, "31-40": 0,
                "41-50": 0, "51-60": 0, "61-70": 0, "71-80": 0,
                "81-90": 0, "91+": 0
            }
        },

        // Géographie
        geography: {
            birthPlaces: new Map(), // Sera un Map de {total, stayedCount, movedCount}
            deathPlaces: new Map(), // Sera un Map de {total, fromHere, fromElsewhere}
            migrations: {
                count: 0,
                paths: new Map(), // De -> Vers avec comptage
                distances: [], // Pour moyenne/médiane
                averageDistance: 0
            },
            byGeneration: new Map() // Distribution géographique par génération
        },
        
        // Professions
        occupations: {
            total: 0,
            byType: new Map(),
            byGeneration: new Map(),
            evolution: new Map(), // Par décennie
            mobility: {
                parentChild: new Map(), // Mobilité intergénérationnelle
                count: 0
            }
        },

        // Structure familiale
        family: {
            marriages: {
                total: 0,
                ageAtMarriage: [], // Pour moyenne/médiane
                byDecade: new Map()
            },
            children: {
                average: 0,
                distribution: new Map(), // Nombre d'enfants par famille
                byGeneration: new Map()
            },
            siblings: {
                average: 0,
                distribution: new Map() // Taille des fratries
            }
        },

        // Prénoms
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

    // Parcourir tous les individus avec leurs stats enrichies
    individuals.forEach(individual => {
        const { demography, family, identity } = individual.stats;
        
        statistics.demography.total++;
        
        // Genre
        statistics.demography.gender[identity.gender]++;
        
        // Génération
        const generation = demography.generation;
        statistics.demography.generations.set(
            generation,
            (statistics.demography.generations.get(generation) || 0) + 1
        );

        // Calcul âge au décès et espérance de vie
        if (demography.birthInfo.year && demography.deathInfo.year) {
            const decade = Math.floor(demography.birthInfo.year / 10) * 10;
            const age = demography.deathInfo.ageAtDeath;
            
            if (age) {
                // Distribution des âges
                const ageRange = getAgeRange(age);
                statistics.demography.ageDistribution[ageRange]++;

                // Espérance de vie par décennie
                if (!statistics.demography.lifeExpectancy.byDecade[decade]) {
                    statistics.demography.lifeExpectancy.byDecade[decade] = [];
                }
                statistics.demography.lifeExpectancy.byDecade[decade].push(age);
            }
        }

        // Géographie
        if (demography.birthInfo.place.town) {
            const birthPlace = `${demography.birthInfo.place.town}, ${demography.birthInfo.place.departement}`;
            const deathPlace = demography.deathInfo.place.town ? 
                `${demography.deathInfo.place.town}, ${demography.deathInfo.place.departement}` : null;

            // Obtenir ou initialiser les compteurs pour ce lieu de naissance
            let birthStats = statistics.geography.birthPlaces.get(birthPlace) || {
                total: 0,     // Nombre total de naissances
                stayedCount: 0, // Nombre de personnes nées et décédées ici
                movedCount: 0   // Nombre de personnes nées ici mais décédées ailleurs
            };

            birthStats.total++;

            if (deathPlace) {
                // Mettre à jour le compteur des lieux de décès
                let deathStats = statistics.geography.deathPlaces.get(deathPlace) || {
                    total: 0,  // Nombre total de décès dans ce lieu
                    fromHere: 0, // Nombre de personnes nées et décédées ici
                    fromElsewhere: 0 // Nombre de personnes nées ailleurs mais décédées ici
                };
                deathStats.total++;

                if (birthPlace === deathPlace) {
                    // Personne décédée dans sa ville de naissance
                    birthStats.stayedCount++;
                    deathStats.fromHere++;
                } else {
                    // Migration
                    birthStats.movedCount++;
                    deathStats.fromElsewhere++;
                    statistics.geography.migrations.count++;

                    // Enregistrer le chemin de migration
                    const pathKey = `${birthPlace}=>${deathPlace}`;
                    statistics.geography.migrations.paths.set(
                        pathKey,
                        (statistics.geography.migrations.paths.get(pathKey) || 0) + 1
                    );

                    // Calculer la distance si les coordonnées sont disponibles
                    if (demography.birthInfo.place.coordinates.latitude && 
                        demography.deathInfo.place.coordinates.latitude) {
                        const distance = calculateDistance(
                            demography.birthInfo.place.coordinates,
                            demography.deathInfo.place.coordinates
                        );
                        if (distance) {
                            statistics.geography.migrations.distances.push(distance);
                        }
                    }
                }

                // Mettre à jour les statistiques des lieux de décès
                statistics.geography.deathPlaces.set(deathPlace, deathStats);
            } else {
                // Cas où le lieu de décès est inconnu
                birthStats.movedCount++;  // On considère que la personne n'est pas décédée dans sa ville de naissance
            }

            // Mettre à jour les statistiques des lieux de naissance
            statistics.geography.birthPlaces.set(birthPlace, birthStats);

            // Mettre à jour les statistiques par génération si nécessaire
            if (generation) {
                const genStats = statistics.geography.byGeneration.get(generation) || new Map();
                const genCount = genStats.get(birthPlace) || 0;
                genStats.set(birthPlace, genCount + 1);
                statistics.geography.byGeneration.set(generation, genStats);
            }
        }

        // Migration
        if (demography.birthInfo.place.town && demography.deathInfo.place.town &&
            demography.birthInfo.place.town !== demography.deathInfo.place.town) {
            statistics.geography.migrations.count++;
            
            // Calcul distance si coordonnées disponibles
            if (demography.birthInfo.place.coordinates.latitude) {
                const distance = calculateDistance(
                    demography.birthInfo.place.coordinates,
                    demography.deathInfo.place.coordinates
                );
                if (distance) {
                    statistics.geography.migrations.distances.push(distance);
                }
            }
        }

        // Professions
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

        // Structure familiale
        if (family.marriages && family.marriages.length > 0) {
            statistics.family.marriages.total++;
            // TODO: Ajouter l'âge au mariage si disponible
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

        // Prénoms
        if (identity.firstName) {
            const genderMap = identity.gender === 'male' ? 
                statistics.names.firstNames.male : 
                statistics.names.firstNames.female;
            
            genderMap.set(
                identity.firstName,
                (genderMap.get(identity.firstName) || 0) + 1
            );
        }

        // Signaler la progression
        if (individuals.indexOf(individual) % 100 === 0) {
            self.postMessage({
                type: 'progress',
                data: Math.round((individuals.indexOf(individual) / individuals.length) * 100)
            });
        }
    });

    // Calculs finaux
    finalizeDemographyStats(statistics);
    finalizeGeographyStats(statistics);
    finalizeFamilyStats(statistics);
    finalizeNameStats(statistics);

    self.postMessage({
        type: 'statistics',
        data: statistics
    });
}

function getAgeRange(age) {
    const ranges = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    for (let range of ranges) {
        if (age <= range) return `${range-10}-${range}`;
    }
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

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

function finalizeDemographyStats(statistics) {
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
    // Convertir les Maps en objets pour la sérialisation
    statistics.geography.birthPlaces = Object.fromEntries(statistics.geography.birthPlaces);
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