class InfoWindowContentManager {
    createInfoWindowContent(townName, townData) {
        if (!townName || !townData) return '';
    
        try {
            const stats = townData.statistics;
            const events = townData.events;
            const birthCount = events.birth?.length || 0;
            const deathCount = events.death?.length || 0;
            const marriageCount = events.marriage?.length || 0;
            
            let content = `
                <div class="info-window-content">
                    <h3 class="text-lg font-bold mb-0">${townName}</h3>
                    <h4 class="text-gray-600 text-sm mb-2">(${townData.departement || '-'})</h4>
                    <div class="text-sm">
                        <div class="mt-2">
                            <ul class="list-inside">
                                <li>${this.#pluralize('Naissance', birthCount)} : ${birthCount}</li>
                                <li>Décès : ${deathCount}</li>
                                <li>${this.#pluralize('Mariage', marriageCount)} : ${marriageCount}</li>
                            </ul>
                        </div>`;
    
            // Modifier le compteur de décès s'il y a des décès de natifs
            if (stats.localDeaths > 0) {
                content = content.replace(
                    `Décès : ${deathCount}`,
                    `Décès : ${deathCount} (dont ${this.#pluralize('natif', stats.localDeaths)} : ${stats.localDeaths})`
                );
            }
    
            // Section des derniers événements
            const recentEventsByType = this.getRecentEventsByType(events);
            if (Object.values(recentEventsByType).some(events => events.length > 0)) {
                content += this.#createRecentEventsSection(recentEventsByType);
            }

            // Section des patronymes (toujours l'inclure si des naissances existent)
            if (birthCount > 0) {
                const patronymesData = this.#preparePatronymesData(events.birth || []);
                content += this.#createPatronymesSection(patronymesData);
            }
    
            content += `
                    </div>
                </div>`;
    
            return content;
        } catch (error) {
            console.error('Erreur lors de la création du contenu de l\'infoWindow:', error);
            return '<div class="error">Erreur lors du chargement des données</div>';
        }
    }

    #preparePatronymesData(birthEvents) {
        // Compter les occurrences de chaque patronyme
        const patronymeCount = new Map();
        birthEvents.forEach(event => {
            if (event.personDetails?.surname) {
                const count = patronymeCount.get(event.personDetails.surname) || 0;
                patronymeCount.set(event.personDetails.surname, count + 1);
            }
        });

        // Créer le tableau des patronymes fréquents
        const frequents = Array.from(patronymeCount.entries())
            .map(([surname, count]) => ({ surname, count }))
            .sort((a, b) => b.count - a.count);

        // Préparer les données d'évolution par période
        const evolutionMap = new Map();
        birthEvents.forEach(event => {
            if (event.date && event.personDetails?.surname) {
                const year = parseInt(event.date.split('/')[2]);
                if (!isNaN(year)) {
                    const period = `${Math.floor(year / 50) * 50}-${Math.floor(year / 50) * 50 + 49}`;
                    if (!evolutionMap.has(period)) {
                        evolutionMap.set(period, new Map());
                    }
                    const periodData = evolutionMap.get(period);
                    const count = periodData.get(event.personDetails.surname) || 0;
                    periodData.set(event.personDetails.surname, count + 1);
                }
            }
        });

        // Convertir l'évolution en tableau
        const evolution = Array.from(evolutionMap.entries())
            .map(([period, data]) => {
                const periodEntry = { period };
                data.forEach((count, surname) => {
                    periodEntry[surname] = count;
                });
                return periodEntry;
            })
            .sort((a, b) => a.period.localeCompare(b.period));

        return { frequents, evolution };
    }

    getRecentEventsByType(events) {
        if (!events) return {};
    
        try {
            const recentEvents = {
                birth: [],
                death: [],
                marriage: []
            };
    
            // Traiter chaque type d'événement séparément
            for (const type of ['birth', 'death', 'marriage']) {
                if (Array.isArray(events[type])) {
                    recentEvents[type] = events[type]
                        .filter(e => e && e.date && e.personDetails)
                        .sort((a, b) => {
                            const dateA = new Date(a.date.split('/').reverse().join('-'));
                            const dateB = new Date(b.date.split('/').reverse().join('-'));
                            return dateB - dateA;
                        })
                        .slice(0, 1);
                }
            }
    
            return recentEvents;
        } catch (error) {
            console.error('Erreur lors de la récupération des événements récents:', error);
            return {};
        }
    }

    #getFirstName(fullName) {
        if (!fullName) return '';
        return fullName.split(' ')[0];
    }

    #createRecentEventsSection(recentEventsByType) {
        let content = `
            <div class="mt-2">
                <h4 class="font-semibold">Derniers événements</h4>
                <ul class="list-inside">`;
    
        if (recentEventsByType.birth.length > 0) {
            const birth = recentEventsByType.birth[0];
            content += `<li>Naissance : ${this.#getFirstName(birth.personDetails.name)} ${birth.personDetails.surname} (${birth.date})</li>`;
        }
    
        if (recentEventsByType.death.length > 0) {
            const death = recentEventsByType.death[0];
            content += `<li>Décès : ${this.#getFirstName(death.personDetails.name)} ${death.personDetails.surname} (${death.date})</li>`;
        }
    
        if (recentEventsByType.marriage.length > 0) {
            const marriage = recentEventsByType.marriage[0];
            content += `<li>Mariage : ${this.#getFirstName(marriage.personDetails.name)} ${marriage.personDetails.surname} (${marriage.date})</li>`;
        }
    
        content += `
                </ul>
            </div>`;
    
        return content;
    }

    #createPatronymesSection(patronymesData) {
        if (!patronymesData.frequents.length) return '';

        let content = `
            <div class="mt-2 border-t pt-2">
                <h4 class="font-semibold mb-2">Patronymes</h4>
                <div class="mb-3">
                    <div class="text-xs text-gray-600 mb-1">Patronymes les plus fréquents à la naissance :</div>
                    <ul class="list-inside">
                        ${patronymesData.frequents
                            .slice(0, 5)
                            .map((p, index) => `<li>${index + 1}. ${p.surname} (${p.count} ${this.#pluralize('mention', p.count)})</li>`)
                            .join('')}
                    </ul>
                </div>`;
    
        if (patronymesData.evolution?.length > 0) {
            content += `
                <div class="mb-2">
                    <div class="text-xs text-gray-600 mb-1">Répartition par période :</div>
                    <div class="text-xs">
                        ${patronymesData.evolution
                            .map(e => {
                                const entries = Object.entries(e)
                                    .filter(([key]) => key !== 'period')
                                    .filter(([, count]) => count > 0)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([surname, count]) => `${surname} (${count})`);
                                
                                if (entries.length === 0) return '';
                                
                                return `<div class="mb-1">
                                    <span class="font-medium">${e.period}</span> : 
                                    ${entries.join(', ')}
                                </div>`;
                            })
                            .filter(content => content !== '')
                            .join('')}
                    </div>
                </div>`;
        }

        content += `</div>`;
        return content;
    }

    #pluralize(word, count) {
        // Cas particuliers
        if (word === 'décès') return 'Décès';
        if (word === 'mention' && count <= 1) return 'mention';
        if (word === 'mention' && count > 1) return 'mentions';
        
        // Pour les autres mots, ajouter 's' si count > 1
        return count <= 1 ? word : `${word}s`;
    }
}

export const infoWindowContentManager = new InfoWindowContentManager();