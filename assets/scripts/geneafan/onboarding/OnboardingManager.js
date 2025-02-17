import Driver from 'driver.js';
import 'driver.js/dist/driver.min.css';
import { EVENTS, storeEvents } from '../gedcom/stores/storeEvents.js';

class OnboardingManager {
    constructor() {
        console.log('OnboardingManager: Initialisation...'); // Debug

        this.driver = new Driver({
            animate: true,
            opacity: 0.7,
            padding: 5,
            showProgress: true,
            allowClose: true,
            stagePadding: 5,
            nextBtnText: 'Suivant',
            prevBtnText: 'Précédent',
            doneBtnText: 'Terminer'
        });

        this.tours = {
            welcome: [
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
                },
                {
                    element: '#tab-nav',
                    popover: {
                        title: 'Navigation',
                        description: 'Une fois votre fichier chargé, vous pourrez explorer vos données avec différentes visualisations.',
                        position: 'bottom'
                    }
                }
            ],
            gedcomUploaded: [
                {
                    element: '#individual-select',
                    popover: {
                        title: 'Sélection de l\'individu',
                        description: 'Recherchez et sélectionnez un individu.',
                        position: 'bottom'
                    }
                },
                {
                    element: '#tab-nav',
                    popover: {
                        title: 'Navigation',
                        description: 'Explorez les différentes visualisations.',
                        position: 'bottom'
                    }
                }
            ],
            tabTours: {
                'tab1': [ // Fan view
                    {
                        element: '#fanParametersDisplay',
                        popover: {
                            title: 'Paramètres de l\'éventail',
                            description: 'Personnalisez l\'affichage de votre arbre.',
                            position: 'right'
                        }
                    }
                ],
                'tab2': [ // Map view
                    {
                        element: '#mapParametersDisplay',
                        popover: {
                            title: 'Carte familiale',
                            description: 'Visualisez la répartition géographique.',
                            position: 'right'
                        }
                    }
                ],
                // ... autres onglets ...
            }
        };

        this.setupEventListeners();
        console.log('OnboardingManager: Event listeners setup complete'); // Debug
    }

    setupEventListeners() {
        // Tour initial au chargement de l'app
        storeEvents.subscribe(EVENTS.ONBOARDING.APP_LOADED, () => {
            console.log('OnboardingManager: APP_LOADED event received'); // Debug
            if (this.isFirstVisit()) {
                console.log('OnboardingManager: First visit detected, starting welcome tour'); // Debug
                this.startTour('welcome');
            }
        });

        // Tour après upload GEDCOM
        storeEvents.subscribe(EVENTS.ONBOARDING.GEDCOM_UPLOADED, () => {
            this.startTour('gedcomUploaded');
        });

        // Tours spécifiques aux onglets
        storeEvents.subscribe(EVENTS.ONBOARDING.TAB_OPENED, (tabId) => {
            if (this.tours.tabTours[tabId]) {
                this.startTour(this.tours.tabTours[tabId]);
            }
        });
    }

    startTour(tourType) {
        console.log('OnboardingManager: Starting tour:', tourType); // Debug
        const steps = typeof tourType === 'string' ? this.tours[tourType] : tourType;
        if (!steps) {
            console.error('OnboardingManager: No steps found for tour:', tourType);
            return;
        }

        this.driver.defineSteps(steps);
        this.driver.start();
    }

    isFirstVisit() {
        const hasSeenTour = localStorage.getItem('geneafan_has_seen_tour');
        if (!hasSeenTour) {
            localStorage.setItem('geneafan_has_seen_tour', 'true');
            return true;
        }
        return false;
    }
}

export default OnboardingManager; 