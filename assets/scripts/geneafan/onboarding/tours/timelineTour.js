import { EVENTS } from '../../common/stores/storeEvents.js';

/**
 * Tour d'introduction pour la fonctionnalité timeline
 */
export const timelineTour = {
    event: EVENTS.UI.TABS.TIMELINE_SHOWN, // Événement émis quand l'onglet timeline est affiché
    
    // Fonction de condition qui détermine si le tour doit être affiché automatiquement
    condition: (manager) => {
        // Vérifier si l'utilisateur a déjà vu ce tour
        const hasSeenTour = manager.hasTourBeenShown('timelineView');
        
        // Si l'utilisateur n'a jamais vu ce tour, on l'affiche automatiquement
        // mais uniquement si ce n'est pas une première visite (pour éviter de 
        // surcharger l'utilisateur avec trop de tours en même temps)
        const isFirstVisit = manager.isFirstVisit ? manager.isFirstVisit() : false;
        const isWelcomeTourActive = manager.isWelcomeTourActive ? manager.isWelcomeTourActive() : false;
        
        // On affiche le tour automatiquement seulement si :
        // - L'utilisateur n'a jamais vu ce tour
        // - Ce n'est pas sa première visite
        // - Le tour de bienvenue n'est pas actif
        return !hasSeenTour && !isFirstVisit && !isWelcomeTourActive;
    },
    
    // Étapes du tour
    steps: [
        {
            element: '#timeline-container',
            popover: {
                title: 'Frise chronologique',
                description: 'Cette frise chronologique présente les événements de votre généalogie organisés par période.',
                position: 'bottom'
            }
        },
        {
            element: '#timeline-events-wrapper',
            popover: {
                title: 'Navigation temporelle',
                description: 'Cette ligne représente les périodes de temps. Chaque point correspond à une période pour laquelle des événements ont été trouvés.',
                position: 'bottom'
            }
        },
        {
            element: '#timeline-filling-line',
            popover: {
                title: 'Progression temporelle',
                description: 'Cette ligne de remplissage indique votre position dans la chronologie.',
                position: 'bottom'
            }
        },
        {
            element: '#timeline-selected-date',
            popover: {
                title: 'Période sélectionnée',
                description: 'Le point en surbrillance indique la période actuellement sélectionnée. Cliquez sur un autre point pour naviguer vers une autre période.',
                position: 'bottom'
            }
        },
        {
            element: '#leftNav',
            popover: {
                title: 'Navigation gauche',
                description: 'Utilisez ces boutons pour naviguer vers les événements précédents ou faire défiler la chronologie vers la gauche.',
                position: 'right'
            }
        },
        {
            element: '#rightNav',
            popover: {
                title: 'Navigation droite',
                description: 'Utilisez ces boutons pour naviguer vers les événements suivants ou faire défiler la chronologie vers la droite.',
                position: 'left'
            }
        },
        {
            element: '#timeline-selected-content',
            popover: {
                title: 'Contenu des événements',
                description: 'Cette section affiche les événements (naissances, mariages, décès) qui se sont produits pendant la période sélectionnée.',
                position: 'top'
            }
        }
    ]
};