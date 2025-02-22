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
                description: 'Vue principale de votre arbre généalogique.',
                position: 'bottom'
            }
        },
        {
            element: '#rootPerson',
            popover: {
                title: 'Personne racine',
                description: 'Par défaut, l\'éventail affiché lors du chargement du fichier Gedcom est celui la personne la plus jeune de la famille.',
                position: 'right'
            }
        },
        {
            element: '#rootAscendant',
            popover: {
                title: 'Navigation dans l\'arbre',
                description: 'Explorez vos ancêtres en cliquant sur leur nom.',
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
                description: 'Cliquez ici pour personnaliser l\'affichage de votre arbre en éventail.',
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
                description: 'Lorem ipsum...',
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
                description: 'Pour commencer, vous devez charger un fichier GEDCOM. Cliquez ici pour importer votre fichier ou essayer notre exemple.',
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
}
