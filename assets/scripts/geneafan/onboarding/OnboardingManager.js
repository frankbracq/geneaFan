import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { EVENTS, storeEvents } from '../gedcom/stores/storeEvents.js';

class OnboardingManager {
    constructor(options = {}) {
        console.log('OnboardingManager: Initialisation...');
        
        this.options = {
            forceTour: false,
            ...options
        };
        
        console.log('OnboardingManager: Options:', this.options);
        
        try {
            // Vérifier si driver.js est correctement importé
            console.log('OnboardingManager: driver import:', typeof driver);
            
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

            console.log('Driver instance created:', this.driver);
            console.log('Driver methods available:', Object.keys(this.driver));
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
                fanDrawn: [
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

            this.isFirstVisit = this.isFirstVisit.bind(this);
            this.startTour = this.startTour.bind(this);
            this.setupEventListeners = this.setupEventListeners.bind(this);

            this.setupEventListeners();
            console.log('OnboardingManager: Event listeners setup complete');
        } catch (error) {
            console.error('Error creating Driver instance:', error);
        }
    }

    setupEventListeners() {
        storeEvents.subscribe(EVENTS.ONBOARDING.APP_LOADED, () => {
            console.log('OnboardingManager: APP_LOADED event received');
            // Vérifier la valeur dans localStorage
            console.log('LocalStorage geneafan_has_seen_tour:', localStorage.getItem('geneafan_has_seen_tour'));
            
            if (this.isFirstVisit()) {
                console.log('OnboardingManager: First visit detected, starting welcome tour');
                this.startTour('welcome');
            } else {
                console.log('OnboardingManager: Not first visit, skipping tour');
            }
        });
    }

    verifyDOMElements(steps) {
        console.log('OnboardingManager: Verifying DOM elements...');
        const missingElements = [];
        
        steps.forEach((step, index) => {
            const element = document.querySelector(step.element);
            console.log(`Element ${step.element} exists:`, !!element);
            
            if (!element) {
                missingElements.push({
                    index,
                    selector: step.element,
                    title: step.popover.title
                });
            }
        });
        
        if (missingElements.length > 0) {
            console.error('OnboardingManager: Missing DOM elements:', missingElements);
            return false;
        }
        
        console.log('OnboardingManager: All DOM elements present');
        return true;
    }

    startTour(tourType) {
        console.log('OnboardingManager: Starting tour:', tourType);
        console.log('OnboardingManager: Driver instance state:', {
            driver: this.driver,
            hasMethods: this.driver && typeof this.driver.defineSteps === 'function'
        });
    
        if (!this.driver) {
            console.error('OnboardingManager: Driver instance is undefined!');
            return;
        }
    
        const steps = typeof tourType === 'string' ? this.tours[tourType] : tourType;
        console.log('OnboardingManager: Tour steps:', steps);
        
        if (!steps) {
            console.error('OnboardingManager: No steps found for tour:', tourType);
            return;
        }
    
        if (typeof this.driver.setSteps !== 'function') {
            console.error('OnboardingManager: this.driver.setSteps is not a function!');
            console.log('Available methods:', Object.keys(this.driver));
            return;
        }
    
        try {
            // Vérifier l'existence des éléments du DOM avant de démarrer le tour
            if (!this.verifyDOMElements(steps)) {
                console.error('OnboardingManager: Cannot start tour - missing DOM elements');
                return;
            }
            
            console.log('OnboardingManager: Setting steps...');
            this.driver.setSteps(steps);
            console.log('OnboardingManager: Starting drive...');
            this.driver.drive();
            console.log('OnboardingManager: Tour started successfully');
        } catch (error) {
            console.error('OnboardingManager: Error during tour start:', error);
        }
    }

    isFirstVisit() {
        console.log('OnboardingManager: Checking if first visit...');
        
        // Si l'option forceTour est activée, on considère toujours que c'est une première visite
        if (this.options.forceTour) {
            console.log('OnboardingManager: Tour forcé activé');
            return true;
        }
        
        const hasSeenTour = localStorage.getItem('geneafan_has_seen_tour');
        console.log('OnboardingManager: hasSeenTour value:', hasSeenTour);
        
        if (!hasSeenTour) {
            console.log('OnboardingManager: Setting first visit flag in localStorage');
            localStorage.setItem('geneafan_has_seen_tour', 'true');
            return true;
        }
        return false;
    }

    // Méthode pour réinitialiser le statut du tour
    resetTourStatus() {
        console.log('OnboardingManager: Resetting tour status');
        localStorage.removeItem('geneafan_has_seen_tour');
    }

    // Méthode pour forcer le démarrage du tour
    forceTour(tourType = 'welcome') {
        console.log('OnboardingManager: Forcing tour:', tourType);
        this.options.forceTour = true;
        this.startTour(tourType);
        this.options.forceTour = false; // Désactive l'option après le tour
    }
}

export default OnboardingManager;