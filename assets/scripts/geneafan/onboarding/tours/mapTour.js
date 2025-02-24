import { EVENTS } from '../../gedcom/stores/storeEvents.js';
import { rootAncestorTownsStore } from '../../tabs/familyMap/stores/rootAncestorTownsStore.js';
import { infoWindowDisplayManager } from '../../tabs/familyMap/managers/infoWindowDisplayManager.js';
import { Offcanvas } from "bootstrap";

export const mapTour = {
    event: EVENTS.VISUALIZATIONS.MAP.DRAWN,
    condition: (manager) => {
        const isFirstVisit = manager.isFirstVisit();
        const hasSeenTour = manager.hasTourBeenShown('mapView');
        return !isFirstVisit && !hasSeenTour;
    },
    steps: [
        {
            element: '#tab2-label', // step 1
            popover: {
                title: 'Calque des ancêtres',
                description: `
                    <div class="mb-4">
                        Activez ou désactivez l'affichage des lieux de naissance de vos ancêtres.
                    </div>
                    <div class="mb-2">Par défaut, la carte montre :</div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Les lieux de naissance</li>
                        <li>Le nombre d'ancêtres par lieu</li>
                        <li>Les lignées paternelles et maternelles</li>
                    </ul>
                `,
                position: 'right'
            },
            /*
            onHighlight: async () => {
                if (!rootAncestorTownsStore.isVisible) {
                    rootAncestorTownsStore.toggleVisibility(true);
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
                */
        },
        {
            element: '#rootMarkerForTour', // step 2
            popover: {
                title: 'Marqueurs de lieux',
                description: `
                    <div class="mb-4">
                        Les marqueurs indiquent les lieux de naissance de vos ancêtres. La couleur des marqueurs vous permet d'identifier les lignées :
                    </div>
                    <div class="flex items-center mb-2">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #1e40af; margin-right: 8px;"></div>
                        <span>Lignée paternelle (côté père)</span>
                    </div>
                    <div class="flex items-center mb-2">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #be185d; margin-right: 8px;"></div>
                        <span>Lignée maternelle (côté mère)</span>
                    </div>
                    <div class="flex items-center mb-2">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #9333ea; margin-right: 8px;"></div>
                        <span>Lieu partagé par les deux lignées</span>
                    </div>
                `,
                position: 'bottom'
            },
            
        },
        {
            element: '#familyMap', // step 3
            popover: {
                title: 'Informations détaillées',
                description: `
                    <div class="mb-4">
                        En cliquant sur un marqueur, vous découvrirez :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Le nom du lieu</li>
                        <li>Le département</li>
                        <li>La liste des ancêtres nés dans ce lieu</li>
                        <li>Leur répartition par génération</li>
                    </ul>
                    <div class="text-sm text-gray-600 italic">
                        Cliquez sur un marqueur pour essayer !
                    </div>
                `,
                position: 'bottom'
            },
            onHighlight: async () => {
                try {
                    const markerElement = document.getElementById('rootMarkerForTour');
                    if (markerElement) {
                        const markers = rootAncestorTownsStore.markerDisplayManager.layers.get('rootAncestors');
                        if (markers && markers.size > 0) {
                            const firstMarker = Array.from(markers.values())[0];
                            if (firstMarker) {
                                // Accéder directement aux données stockées dans rootAncestorTownsStore
                                const locationData = rootAncestorTownsStore.birthData[0];
                                const content = rootAncestorTownsStore.createInfoWindowContent(
                                    locationData.location,
                                    [locationData],
                                    { [locationData.generation]: [locationData] }
                                );
                                infoWindowDisplayManager.showInfoWindow(firstMarker, content);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erreur lors de l\'affichage de l\'info-window:', error);
                }
            },
            
        },
        {
            element: '#mapParametersDisplay', // step 4
            popover: {
                title: 'Paramètres de la carte',
                description: `
                    <div class="mb-4">
                        Personnalisez l'affichage de votre carte :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Filtrez les lieux affichés</li>
                        <li>Ajustez les couleurs des marqueurs</li>
                        <li>Modifiez le style de la carte</li>
                    </ul>
                    <div class="text-sm text-gray-600 italic">
                        Cliquez pour ouvrir les paramètres
                    </div>
                `,
                position: 'bottom'
            },
            onHighlight: async () => {
                // S'assurer que l'infoWindow est fermée avant d'afficher cette étape
                console.log('Fermeture de l\'info-window avant de passer à l\'étape suivante');
                infoWindowDisplayManager.initialize();
                console.log('Fermeture et réinitialisation effectuées');
            },
            onNextClick: async () => {
                console.log('Opening map parameters offcanvas...');
                const offcanvas = document.getElementById('mapParameters');
                if (offcanvas) {
                    const bsOffcanvas = Offcanvas.getInstance(offcanvas);
                    if (bsOffcanvas) {
                        new Offcanvas(offcanvas).show();
                    }
                }
            }
        },
        {
            element: '#layerControls', // step 5
            popover: {
                title: 'Choix des villes à afficher',
                description: `
                    <div class="mb-4">
                        Personnalisez l'affichage des villes :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Filtrez par génération</li>
                        <li>Sélectionnez les types d'événements</li>
                        <li>Choisissez les lignées à afficher</li>
                    </ul>
                    <div class="text-sm text-blue-600">
                        <strong>Astuce</strong> : Combinez les filtres pour une vue personnalisée !
                    </div>
                `,
                position: 'right',

            },

            onHighlight: async () => {
                const offcanvas = document.getElementById('mapParameters');
                if (offcanvas) {
                    new Offcanvas(offcanvas).show();
                }
            },

            /*
            onNextClick: async (element, step, { driver }) => {
                console.log('Closing map parameters offcanvas...');
                const offcanvas = document.getElementById('mapParameters');
                if (offcanvas) {
                    const bsOffcanvas = Offcanvas.getInstance(offcanvas);
                    if (bsOffcanvas) {
                        bsOffcanvas.hide();
                        await new Promise(resolve => {
                            offcanvas.addEventListener('hidden.bs.offcanvas', resolve, { once: true });
                        });
                    }
                }
            }
                */

        },
        {
            element: '#layerAncestorsContainer', // step 6
            popover: {
                title: 'Choix des villes à afficher',
                description: `
                    <div class="mb-4">
                        Personnalisez l'affichage des villes :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Filtrez par génération</li>
                        <li>Sélectionnez les types d'événements</li>
                        <li>Choisissez les lignées à afficher</li>
                    </ul>
                    <div class="text-sm text-blue-600">
                        <strong>Astuce</strong> : Combinez les filtres pour une vue personnalisée !
                    </div>
                `,
                position: 'right',
            },
        },  
        {
            element: '#layerFamilyContainer', // step 7
            popover: {
                title: 'Choix des villes à afficher',
                description: `
                    <div class="mb-4">
                        Personnalisez l'affichage des villes :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Filtrez par génération</li>
                        <li>Sélectionnez les types d'événements</li>
                        <li>Choisissez les lignées à afficher</li>
                    </ul>
                    <div class="text-sm text-blue-600">
                        <strong>Astuce</strong> : Combinez les filtres pour une vue personnalisée !
                    </div>
                `,
                position: 'right',
            },
        },      
        {
            element: '#layerSurnamesContainer', // step 8
            popover: {
                title: 'Choix des villes à afficher',
                description: `
                    <div class="mb-4">
                        Personnalisez l'affichage des villes :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Filtrez par génération</li>
                        <li>Sélectionnez les types d'événements</li>
                        <li>Choisissez les lignées à afficher</li>
                    </ul>
                    <div class="text-sm text-blue-600">
                        <strong>Astuce</strong> : Combinez les filtres pour une vue personnalisée !
                    </div>
                `,
                position: 'right',
            },
            onDeselected: async () => {
                console.log('Closing map parameters offcanvas...');
                const offcanvas = document.getElementById('mapParameters');
                if (offcanvas) {
                    const bsOffcanvas = Offcanvas.getInstance(offcanvas);
                    if (bsOffcanvas) {
                        bsOffcanvas.hide();
                        await new Promise(resolve => {
                            offcanvas.addEventListener('hidden.bs.offcanvas', resolve, { once: true });
                        });
                    }
                }
            }

        },
        {
            element: '#familyMap', // step 8
            popover: {
                title: 'Navigation sur la carte',
                description: `
                    <div class="mb-4">
                        Pour explorer la carte :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li><strong>Zoom</strong> : Utilisez les boutons + et - ou la molette de la souris</li>
                        <li><strong>Déplacement</strong> : Cliquez et faites glisser la carte</li>
                        <li><strong>Vue d'ensemble</strong> : Une mini-carte apparaît au zoom 9+</li>
                    </ul>
                    <div class="text-sm text-blue-600">
                        <strong>Astuce</strong> : Les marqueurs proches sont regroupés automatiquement. Zoomez pour les voir en détail !
                    </div>
                `,
                position: 'left'
            },

        }
    ]
};