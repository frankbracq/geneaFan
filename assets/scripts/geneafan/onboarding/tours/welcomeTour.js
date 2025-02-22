import { EVENTS } from '../../gedcom/stores/storeEvents.js';

export const welcomeTour = {
    event: EVENTS.ONBOARDING.APP_LOADED,
    condition: (manager) => manager.isFirstVisit(),
    steps: [
        {
            element: '#tab-nav',
            popover: {
                title: 'Navigation',
                description: 'Une fois votre fichier chargé, vous pourrez explorer vos données avec différentes visualisations.',
                position: 'bottom'
            }
        },
        {
            element: '#gedcomMenu',
            popover: {
                title: 'Bienvenue sur GeneaFan !',
                description: 'Pour commencer, vous devez charger un fichier GEDCOM. Cliquez ici pour importer votre fichier ou essayer notre exemple.',
                position: 'bottom'
            }
        },
        {
            element: '#sample-toggle',
            popover: {
                title: 'Fichier exemple',
                description: 'Pas de fichier GEDCOM ? Essayez notre exemple pour découvrir les fonctionnalités.',
                position: 'bottom'
            }
        }
    ]
};