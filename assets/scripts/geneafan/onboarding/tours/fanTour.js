import { EVENTS } from '../../gedcom/stores/storeEvents.js';
import { Offcanvas } from "bootstrap";

export const fanTour = {
    event: EVENTS.VISUALIZATIONS.FAN.DRAWN,
    condition: (manager) => {
        const isFirstVisit = manager.isFirstVisit();
        const isWelcomeTourActive = manager.isWelcomeTourActive();
        const hasSeenTour = manager.hasTourBeenShown('fanDrawn');
        return !isFirstVisit && !isWelcomeTourActive && !hasSeenTour;
    },
    steps: [
        {
            element: '#tab1-label',
            popover: {
                title: 'Ascendance',
                description: `
                    <div class="mb-4">
                        Bienvenue dans la vue principale de votre arbre généalogique. Cette visualisation intuitive vous permet de :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Explorer vos ancêtres de façon interactive</li>
                        <li>Visualiser plusieurs générations d'un coup d'œil</li>
                        <li>Naviguer facilement dans votre histoire familiale</li>
                    </ul>
                `,
                position: 'bottom'
            }
        },
        {
            element: '#rootPerson',
            popover: {
                title: 'Personne racine',
                description: `
                    <div class="mb-4">
                        Le centre de l'éventail est occupé par la personne de référence.
                    </div>
                    <div class="mb-4">
                        Par défaut, il s'agit de la personne la plus jeune de votre famille, mais vous pouvez la changer :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>En cliquant sur n'importe quel autre membre</li>
                        <li>En utilisant la recherche</li>
                        <li>En naviguant dans l'arbre</li>
                    </ul>
                `,
                position: 'right'
            }
        },
        {
            element: '#rootAscendant',
            popover: {
                title: 'Navigation dans l\'arbre',
                description: `
                    <div class="mb-4">
                        Explorez votre arbre généalogique en interagissant avec les personnes :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Cliquez sur un nom pour voir les détails</li>
                        <li>Double-cliquez pour centrer l'éventail sur cette personne</li>
                        <li>Utilisez la molette pour zoomer/dézoomer</li>
                    </ul>
                    <div class="text-sm text-blue-600">
                        <strong>Astuce</strong> : Les couleurs indiquent les lignées paternelles et maternelles !
                    </div>
                `,
                position: 'auto'
            },
            onHighlight: (element) => {
                if (!element || !element.__data__) return;
                const customEvent = new CustomEvent('showPersonDetails', {
                    detail: element.__data__
                });
                document.dispatchEvent(customEvent);
            }
        },
        {
            element: '#fanParametersDisplay',
            popover: {
                title: 'Paramètres de l\'éventail',
                description: `
                    <div class="mb-4">
                        Personnalisez l'affichage selon vos préférences :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Ajustez le nombre de générations affichées</li>
                        <li>Modifiez les couleurs des lignées</li>
                        <li>Changez le style d'affichage des noms</li>
                    </ul>
                    <div class="text-sm text-gray-600 italic">
                        Cliquez pour ouvrir le panneau des paramètres
                    </div>
                `,
                position: 'bottom'
            },
            onHighlight: async (element) => {
                await new Promise((resolve) => {
                    const offcanvas = document.getElementById('personDetails');
                    if (offcanvas) {
                        const bsOffcanvas = Offcanvas.getInstance(offcanvas);
                        if (bsOffcanvas) {
                            const handleOffcanvasHidden = () => {
                                offcanvas.removeEventListener('hidden.bs.offcanvas', handleOffcanvasHidden);
                                resolve();
                            };
                            
                            offcanvas.addEventListener('hidden.bs.offcanvas', handleOffcanvasHidden);
                            bsOffcanvas.hide();
                        } else {
                            resolve();
                        }
                    } else {
                        resolve();
                    }
                });
            },
        },
        {
            element: '#fanParametersBody',
            popover: {
                title: 'Configuration de l\'éventail',
                description: `
                    <div class="mb-4">
                        Découvrez toutes les options de personnalisation :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Profondeur de l'arbre</li>
                        <li>Schéma des couleurs</li>
                        <li>Format d'affichage des données</li>
                        <li>Options visuelles avancées</li>
                    </ul>
                    <div class="text-sm text-blue-600">
                        <strong>Conseil</strong> : Expérimentez avec les différents paramètres pour trouver l'affichage qui vous convient le mieux !
                    </div>
                `,
                position: 'right'
            },
            onHighlight: async (element) => {
                const offcanvas = document.getElementById('fanParameters');
                if (offcanvas) {
                    new Offcanvas(offcanvas).show();
                }
            },
            onNextClick: async (element, step, { driver }) => {
                console.log('Closing fan parameters offcanvas...');
                const offcanvas = document.getElementById('fanParameters');
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
            element: '#download-menu',
            popover: {
                title: 'Export de l\'éventail en PDF',
                description: `
                    <div class="mb-4">
                        Conservez une trace de votre arbre généalogique :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Exportez en haute qualité</li>
                        <li>Choisissez le format qui vous convient</li>
                        <li>Partagez facilement avec votre famille</li>
                    </ul>
                    <div class="text-sm text-gray-600 italic">
                        L'export conserve tous vos paramètres d'affichage personnalisés
                    </div>
                `,
                position: 'bottom'
            },
            onHighlight: async (element) => {
                await new Promise((resolve) => {
                    const offcanvas = document.getElementById('fanParameters');
                    if (offcanvas) {
                        const bsOffcanvas = Offcanvas.getInstance(offcanvas);
                        if (bsOffcanvas) {
                            const handleOffcanvasHidden = () => {
                                offcanvas.removeEventListener('hidden.bs.offcanvas', handleOffcanvasHidden);
                                resolve();
                            };
                            
                            offcanvas.addEventListener('hidden.bs.offcanvas', handleOffcanvasHidden);
                            bsOffcanvas.hide();
                        } else {
                            resolve();
                        }
                    } else {
                        resolve();
                    }
                });
            },
        }
    ]
};