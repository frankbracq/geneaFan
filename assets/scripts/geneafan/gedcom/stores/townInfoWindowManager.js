export class TownInfoWindowManager {
    static createInfoWindowContent(townName, townData) {
        if (!townName || !townData) return '';
    
        try {
            const stats = townData.statistics;
            const events = townData.events;
            
            return `
                <div class="info-window-content">
                    ${this.createHeader(townName, townData)}
                    ${this.createStatisticsSection(events)}
                    ${this.createMobilitySection(stats)}
                    ${this.createRecentEventsSection(events)}
                    ${this.createPatronymesSection(stats.patronymes)}
                </div>
            `;
        } catch (error) {
            console.error('Erreur lors de la création du contenu de l\'infoWindow:', error);
            return '<div class="error">Erreur lors du chargement des données</div>';
        }
    }

    static createHeader(townName, townData) {
        return `
            <h3 class="text-lg font-bold mb-2">${townName}</h3>
            <div class="text-sm">
                <p><strong>Département:</strong> ${townData.departement || ''}</p>
                <p><strong>Pays:</strong> ${townData.country || ''}</p>
            </div>`;
    }

    static createStatisticsSection(events) {
        return `
            <div class="mt-2">
                <h4 class="font-semibold">Statistiques</h4>
                <ul class="list-inside">
                    <li>Naissances: ${events.birth?.length || 0}</li>
                    <li>Décès: ${events.death?.length || 0}</li>
                    <li>Mariages: ${events.marriage?.length || 0}</li>
                </ul>
            </div>`;
    }

    static createMobilitySection(stats) {
        if (stats.localDeaths > 0 || stats.externalDeaths > 0) {
            return `
                <div class="mt-2">
                    <h4 class="font-semibold">Mobilité</h4>
                    <p>Décès de natifs: ${stats.localDeaths}</p>
                    <p>Décès d'extérieurs: ${stats.externalDeaths}</p>
                </div>`;
        }
        return '';
    }

    static createRecentEventsSection(events) {
        const recentEvents = this.getRecentEvents(events, 3);
        if (recentEvents.length > 0) {
            return `
                <div class="mt-2">
                    <h4 class="font-semibold">Derniers événements</h4>
                    <ul class="list-inside">
                        ${recentEvents.map(e => `<li>${this.formatEvent(e)}</li>`).join('')}
                    </ul>
                </div>`;
        }
        return '';
    }

    static createPatronymesSection(patronymesData) {
        if (!patronymesData?.frequents) return '';

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
            content += this.createEvolutionSection(patronymesData.evolution);
        }

        return content;
    }

    static createEvolutionSection(evolution) {
        return `
            <div class="mt-2">
                <h4 class="font-semibold">Évolution historique</h4>
                <div class="text-xs">
                    ${evolution.map(e => this.formatEvolutionPeriod(e)).join('')}
                </div>
            </div>`;
    }

    static formatEvolutionPeriod(periodData) {
        const entries = Object.entries(periodData)
            .filter(([key, count]) => key !== 'period' && count > 0)
            .map(([surname, count]) => `${surname} (${count})`);

        return `<p>${periodData.period}: ${entries.join(', ')}</p>`;
    }

    static getRecentEvents(events, count) {
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

    static formatEvent(event) {
        if (!event || !event.personDetails) return '';
    
        try {
            const person = event.personDetails;
            const date = event.date;
            const descriptions = {
                birth: `Naissance de ${person.name} ${person.surname}`,
                death: `Décès de ${person.name} ${person.surname}`,
                marriage: `Mariage de ${person.name} ${person.surname}`,
                default: `Événement: ${person.name} ${person.surname}`
            };
    
            return `${date} - ${descriptions[event.type] || descriptions.default}`;
        } catch (error) {
            console.error('Erreur lors du formatage de l\'événement:', error);
            return '';
        }
    }
}