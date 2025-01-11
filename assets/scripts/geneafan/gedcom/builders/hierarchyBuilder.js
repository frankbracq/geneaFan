import timelineEventsStore from '../../tabs/timeline/timelineEventsStore.js';
import gedcomDataStore from '../stores/gedcomDataStore.js';
import configStore from '../../tabs/fanChart/fanConfigStore.js';

export function buildHierarchy(currentRoot) {
    console.time("buildHierarchy");
    if (!currentRoot) {
        console.warn("Root is undefined in buildHierarchy");
        return null;
    }

    const config = configStore.getConfig;
    const maxHeight = config.maxGenerations - 1;

    timelineEventsStore.clearEvents();

    // Utiliser le cache des individus déjà construit
    const individualsCache = gedcomDataStore.getIndividualsCache()

    function buildRecursive(
        individualPointer,
        parent,
        sosa,
        height,
        individualsCache,
        config
    ) {
        if (!individualsCache.has(individualPointer) && individualPointer !== null) {
            return null;
        }

        const individual =
            individualsCache.get(individualPointer) ||
            createFictiveIndividual(individualPointer, sosa, height);

        // Utiliser les événements individuels si disponibles
        if (individual.individualEvents && individual.individualEvents.length > 0) {
            individual.individualEvents.forEach((event) => {
                const validTypes = ['death', 'birth', 'marriage'];
                if (validTypes.includes(event.type)) {
                    timelineEventsStore.addEvent({
                        ...event,
                        id: individualPointer,
                        sosa,
                    });
                }
            });
        }

        let obj = {
            ...individual,
            sosa: sosa,
            generation: height,
            parent: parent,
        };

        if (height < maxHeight) {
            const parents = [];

            const fatherPointer = individual.fatherId;
            const motherPointer = individual.motherId;

            if (fatherPointer) {
                const fatherObj = individualsCache.get(fatherPointer);
                if (fatherObj) {
                    parents.push(
                        buildRecursive(
                            fatherPointer,
                            obj,
                            sosa * 2,
                            height + 1,
                            individualsCache,
                            config
                        )
                    );
                } else {
                    console.log(`Father not found in cache: ${fatherPointer}`);
                }
            } else if (config.showMissing) {
                parents.push(
                    buildRecursive(
                        null,
                        obj,
                        sosa * 2,
                        height + 1,
                        individualsCache,
                        config
                    )
                );
            }

            if (motherPointer) {
                const motherObj = individualsCache.get(motherPointer);
                if (motherObj) {
                    parents.push(
                        buildRecursive(
                            motherPointer,
                            obj,
                            sosa * 2 + 1,
                            height + 1,
                            individualsCache,
                            config
                        )
                    );
                } else {
                    console.log(`Mother not found in cache: ${motherPointer}`);
                }
            } else if (config.showMissing) {
                parents.push(
                    buildRecursive(
                        null,
                        obj,
                        sosa * 2 + 1,
                        height + 1,
                        individualsCache,
                        config
                    )
                );
            }
            obj.children = parents;
        }

        return obj;
    }

    function createFictiveIndividual(individualPointer, sosa, height) {
        return {
            id: individualPointer,
            name: "",
            surname: "",
            sosa: sosa,
            generation: height,
            gender: sosa % 2 === 0 ? "M" : "F",
            children: [],
            parent: null,
            individualEvents: [],
        };
    }

    // Utiliser currentRoot au lieu de rootIndividualPointer
    const hierarchy = buildRecursive(
        currentRoot,
        null,
        1,
        0,
        individualsCache,
        config
    );

    console.timeEnd("buildHierarchy");
    return hierarchy;
}
