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
    
            const recentEvents = this.getRecentEvents(events, 3);
            if (recentEvents.length > 0) {
                content += this.#createRecentEventsSection(recentEvents);
            }
    
            if (stats.patronymes?.frequents?.length > 0) {
                content += this.#createPatronymesSection(stats.patronymes);
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

    getRecentEvents(events, count) {
        if (!events || !count) return [];
    
        try {
            return [...(events.birth || []),
                    ...(events.death || []),
                    ...(events.marriage || [])]
                .filter(e => e && e.date)
                .sort((a, b) => {
                    const dateA = new Date(a.date.split('/').reverse().join('-'));
                    const dateB = new Date(b.date.split('/').reverse().join('-'));
                    return dateB - dateA;
                })
                .slice(0, count);
        } catch (error) {
            console.error('Erreur lors de la récupération des événements récents:', error);
            return [];
        }
    }

    #createRecentEventsSection(recentEvents) {
        return `
            <div class="mt-2">
                <h4 class="font-semibold">Derniers événements</h4>
                <ul class="list-inside">
                    ${recentEvents.map(e => `
                        <li>${this.#formatEvent(e)}</li>
                    `).join('')}
                </ul>
            </div>`;
    }

    #createPatronymesSection(patronymesData) {
        let content = `
            <div class="mt-2">
                <h4 class="font-semibold">Patronymes principaux</h4>
                <ul class="list-inside">
                    ${patronymesData.frequents
                        .slice(0, 5)
                        .map(p => `<li>${p.surname} (${p.count})</li>`)
                        .join('')}
                </ul>
            </div>`;
    
        if (patronymesData.evolution?.length > 0) {
            content += `
                <div class="mt-2">
                    <h4 class="font-semibold">Évolution historique</h4>
                    <div class="text-xs">
                        ${patronymesData.evolution
                            .map(e => `
                                <p>${e.period}: ${Object.entries(e)
                                    .filter(([key]) => key !== 'period')
                                    .filter(([, count]) => count > 0)
                                    .map(([surname, count]) => `${surname} (${count})`)
                                    .join(', ')}</p>
                            `).join('')}
                    </div>
                </div>`;
        }
    
        return content;
    }

    #formatEvent(event) {
        if (!event || !event.personDetails) return '';
    
        try {
            const person = event.personDetails;
            const date = event.date;
            let description;
    
            switch (event.type) {
                case 'birth':
                    description = `Naissance de ${person.name} ${person.surname}`;
                    break;
                case 'death':
                    description = `Décès de ${person.name} ${person.surname}`;
                    break;
                case 'marriage':
                    description = `Mariage de ${person.name} ${person.surname}`;
                    break;
                default:
                    description = `Événement: ${person.name} ${person.surname}`;
            }
    
            return `${date} - ${description}`;
        } catch (error) {
            console.error('Erreur lors du formatage de l\'événement:', error);
            return '';
        }
    }

    #pluralize(word, count) {
        // Cas particulier pour "décès"
        if (word === 'décès') return 'Décès';
        
        // Pour les autres mots, ajouter 's' si count > 1
        return count <= 1 ? word : `${word}s`;
    }
}

export const infoWindowContentManager = new InfoWindowContentManager();