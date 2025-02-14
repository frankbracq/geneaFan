class InfoWindowContentManager {
    // Creates the content for an info window based on town name and data.
    createInfoWindowContent(townName, townData) {
        if (!townName || !townData) return '';
    
        try {
            const { statistics: stats, events } = townData;
            const counts = this.#getEventCounts(events);
            const baseContent = this.#createBaseContent(townName, townData, counts, stats);
            const sections = this.#createSections(events, counts);
    
            return `${baseContent}${sections.join('')}</div></div>`;
        } catch (error) {
            console.error('Erreur lors de la création de l\'infoWindow:', error);
            return '<div class="error">Erreur lors du chargement des données</div>';
        }
    }

    // Gets the counts of different types of events.
    #getEventCounts(events) {
        return {
            birth: events.birth?.length || 0,
            death: events.death?.length || 0,
            marriage: events.marriage?.length || 0
            };
    }
    
    // Creates the base content for the info window.
    #createBaseContent(townName, townData, counts, stats) {
        return `
            <div class="info-window-content">
                <h3 class="text-lg font-bold mb-0">${townName}</h3>
                <h4 class="text-gray-600 text-sm mb-2">(${townData.departement || '-'})</h4>
                <div class="text-sm">
            <div class="mt-2">
                        <ul class="list-inside">
                            <li>${this.#pluralize('Naissance', counts.birth)} : ${counts.birth}</li>
                            <li>${this.#getDeathLine(counts.death, stats.localDeaths)}</li>
                            <li>${this.#pluralize('Mariage', counts.marriage)} : ${counts.marriage}</li>
                </ul>
            </div>`;
    }

    // Creates sections for the info window based on events and counts.
    #createSections(events, counts) {
        const sections = [];
        const recentEvents = this.getRecentEventsByType(events);
        
        if (Object.values(recentEvents).some(events => events.length > 0)) {
            sections.push(this.#createRecentEventsSection(recentEvents));
        }

        if (counts.birth > 0) {
            const patronymesData = this.#preparePatronymesData(events.birth || []);
            sections.push(this.#createPatronymesSection(patronymesData));
        }

        return sections;
    }

    // Gets the death line content based on death count and local deaths.
    #getDeathLine(deathCount, localDeaths) {
        return localDeaths > 0
            ? `Décès : ${deathCount} (dont ${this.#pluralize('natif', localDeaths)} : ${localDeaths})`
            : `Décès : ${deathCount}`;
    }
    
    // Prepares patronymes data based on birth events.
    #preparePatronymesData(birthEvents) {
        if (!birthEvents?.length) return { frequents: [], evolution: [] };

        const [patronymeCount, evolutionMap] = this.#processEvents(birthEvents);

        return {
            frequents: this.#createFrequentsArray(patronymeCount),
            evolution: this.#createEvolutionArray(evolutionMap)
        };
    }

    // Processes birth events to count patronymes and their evolution over time.
    #processEvents(birthEvents) {
        const patronymeCount = new Map();
        const evolutionMap = new Map();

        birthEvents.forEach(event => {
            const surname = event.personDetails?.surname;
            if (!surname || !event.date) return;

            patronymeCount.set(surname, (patronymeCount.get(surname) || 0) + 1);
            this.#updateEvolutionMap(evolutionMap, surname, event.date);
        });

        return [patronymeCount, evolutionMap];
    }

    // Updates the evolution map with the given surname and date.
    #updateEvolutionMap(evolutionMap, surname, date) {
        const year = parseInt(date.split('/')[2]);
        if (isNaN(year)) return;

        const period = `${Math.floor(year / 50) * 50}-${Math.floor(year / 50) * 50 + 49}`;
        const periodData = evolutionMap.get(period) || new Map();
        periodData.set(surname, (periodData.get(surname) || 0) + 1);
        evolutionMap.set(period, periodData);
    }

    // Creates an array of frequent patronymes from the patronyme count map.
    #createFrequentsArray(patronymeCount) {
        return [...patronymeCount]
            .map(([surname, count]) => ({ surname, count }))
            .sort((a, b) => b.count - a.count);
    }

    // Creates an array of evolution data from the evolution map.
    #createEvolutionArray(evolutionMap) {
        return [...evolutionMap]
            .map(([period, data]) => ({
                period,
                ...Object.fromEntries(data)
            }))
            .sort((a, b) => a.period.localeCompare(b.period));
    }

    // Gets recent events by type from the events object.
    getRecentEventsByType(events) {
        if (!events) return {};
    
        try {
            return ['birth', 'death', 'marriage'].reduce((acc, type) => {
                acc[type] = Array.isArray(events[type]) 
                    ? events[type]
                        .filter(e => e?.date && e?.personDetails)
                        .sort((a, b) => new Date(b.date.split('/').reverse().join('-')) - new Date(a.date.split('/').reverse().join('-')))
                        .slice(0, 1)
                    : [];
                return acc;
            }, {});
        } catch (error) {
            console.error('Erreur lors de la récupération des événements récents:', error);
            return {};
        }
    }

    // Creates the recent events section for the info window.
    #createRecentEventsSection(recentEvents) {
        const eventTypes = {
            birth: 'Naissance',
            death: 'Décès',
            marriage: 'Mariage'
        };

        const eventsList = Object.entries(recentEvents)
            .filter(([, events]) => events.length > 0)
            .map(([type, [event]]) => 
                `<li>${eventTypes[type]} : ${this.#formatPersonName(event)} (${event.date})</li>`
            ).join('');

        return `
            <div class="mt-2">
                <h4 class="font-semibold">Derniers événements</h4>
                <ul class="list-inside">${eventsList}</ul>
                </div>`;
    }
    
    // Formats the person's name from the event data.
    #formatPersonName(event) {
        const firstName = event.personDetails.name.split(' ')[0];
        return `${firstName} ${event.personDetails.surname}`;
    }

    // Creates the patronymes section for the info window.
    #createPatronymesSection(patronymesData) {
        if (!patronymesData.frequents.length) return '';

        const frequentsList = patronymesData.frequents
            .slice(0, 5)
            .map((p, i) => `<li>${i + 1}. ${p.surname} (${p.count} ${this.#pluralize('mention', p.count)})</li>`)
            .join('');

        const evolutionList = patronymesData.evolution
            .map(this.#formatEvolutionPeriod)
            .filter(Boolean)
            .join('');

        return `
            <div class="mt-2 border-t pt-2">
                <h4 class="font-semibold mb-2">Patronymes</h4>
                <div class="mb-3">
                    <div class="text-xs text-gray-600 mb-1">(Les plus fréquents à la naissance)</div>
                    <ul class="list-inside">${frequentsList}</ul>
                    </div>
                ${evolutionList ? `
                <div class="mb-2">
                    <div class="text-xs text-gray-600 mb-1">Répartition par période :</div>
                    <div class="text-xs">${evolutionList}</div>
                </div>` : ''}
            </div>`;
    }

    // Formats the evolution period data for display.
    #formatEvolutionPeriod(period) {
        const entries = Object.entries(period)
            .filter(([key, count]) => key !== 'period' && count > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([surname, count]) => `${surname} (${count})`);

        return entries.length ? `
            <div class="mb-1">
                <span class="font-medium">${period.period}</span> : 
                ${entries.join(', ')}
            </div>` : '';
    }

    // Pluralizes a word based on the count.
    #pluralize(word, count) {
        const specialCases = {
            'décès': 'Décès',
            'mention': count <= 1 ? 'mention' : 'mentions'
        };
        return specialCases[word] || (count <= 1 ? word : `${word}s`);
    }
}
export const infoWindowContentManager = new InfoWindowContentManager();