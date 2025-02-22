import { EVENTS } from '../../gedcom/stores/storeEvents.js';

export const mapTour = {
    event: EVENTS.VISUALIZATIONS.MAP.DRAWN,
    condition: (manager) => !manager.hasTourBeenShown('mapView'),
    steps: [
        {
            element: '#layerAncestors',
            popover: {
                title: 'Calque des ancêtres',
                description: 'Activez ou désactivez l\'affichage des lieux des ancêtres.',
                position: 'right'
            }
        }
    ]
};