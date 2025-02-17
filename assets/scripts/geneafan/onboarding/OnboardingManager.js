import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { EVENTS, storeEvents } from '../gedcom/stores/storeEvents.js';

class OnboardingManager {
    constructor() {
        console.log('OnboardingManager: Initialisation...'); // Debug
        
        try {
            this.driver = driver({
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

            console.log('Driver instance created:', this.driver); // Debug

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
                    'tab1': [
                        {
                            element: '#fanParametersDisplay',
                            popover: {
                                title: 'Paramètres de l\'éventail',
                                description: 'Personnalisez l\'affichage de votre arbre.',
                                position: 'right'
                            }
                        }
                    ],
                    'tab2': [
                        {
                            element: '#mapParametersDisplay',
                            popover: {
                                title: 'Carte familiale',
                                description: 'Visualisez la répartition géographique.',
                                position: 'right'
                            }
                        }
                    ]
                }
            };

            // Liaison correcte des méthodes après l'initialisation
            this.isFirstVisit = this.isFirstVisit.bind(this);
            this.startTour = this.startTour.bind(this);
            this.setupEventListeners = this.setupEventListeners.bind(this);

            this.setupEventListeners();
            console.log('OnboardingManager: Event listeners setup complete'); // Debug
        } catch (error) {
            console.error('Error creating Driver instance:', error);
        }
    }

    setupEventListeners() {
        storeEvents.subscribe(EVENTS.ONBOARDING.APP_LOADED, () => {
            console.log('OnboardingManager: APP_LOADED event received'); // Debug
            if (this.isFirstVisit()) {
                console.log('OnboardingManager: First visit detected, starting welcome tour'); // Debug
                this.startTour('welcome');
            }
        });

        storeEvents.subscribe(EVENTS.ONBOARDING.GEDCOM_UPLOADED, () => {
            console.log('OnboardingManager: GEDCOM_UPLOADED event received'); // Debug
            this.startTour('gedcomUploaded');
        });

        storeEvents.subscribe(EVENTS.ONBOARDING.TAB_OPENED, (tabId) => {
            console.log('OnboardingManager: TAB_OPENED event received for tab:', tabId); // Debug
            if (this.tours.tabTours[tabId]) {
                this.startTour(this.tours.tabTours[tabId]);
            }
        });
    }

    startTour(tourType) {
        console.log('OnboardingManager: Starting tour:', tourType); // Debug
        console.log('OnboardingManager: this.driver:', this.driver); // Debug
    
        if (!this.driver) {
            console.error('OnboardingManager: Driver instance is undefined!');
            return;
        }
    
        const steps = typeof tourType === 'string' ? this.tours[tourType] : tourType;
        if (!steps) {
            console.error('OnboardingManager: No steps found for tour:', tourType);
            return;
        }
    
        if (typeof this.driver.defineSteps !== 'function') {
            console.error('OnboardingManager: this.driver.defineSteps is not a function!');
            return;
        }
    
        this.driver.defineSteps(steps);
        this.driver.drive();
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