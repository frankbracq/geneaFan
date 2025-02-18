import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { EVENTS, storeEvents } from '../gedcom/stores/storeEvents.js';

// Configuration centralisée des tours
const TOUR_CONFIG = {
    welcome: {
        event: EVENTS.ONBOARDING.APP_LOADED,
        condition: (manager) => manager.isFirstVisit(),
        steps: [
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
        ]
    },
    fanDrawn: {
        event: EVENTS.VISUALIZATIONS.FAN.DRAWN,
        condition: (manager) => {
            console.group('OnboardingManager: Checking fanDrawn tour condition');
            const isFirstVisit = manager.isFirstVisit();
            const isWelcomeTourActive = manager.isWelcomeTourActive();
            const hasSeenTour = manager.hasTourBeenShown('fanDrawn');

            console.log({
                isFirstVisit,
                isWelcomeTourActive,
                hasSeenTour,
                hasDriver: !!manager.driver
            });

            // Montrer le tour si :
            // - Ce n'est PAS la première visite (tour de bienvenue déjà vu)
            // - Le tour de bienvenue n'est PAS actif
            // - Le tour fanDrawn n'a PAS encore été vu
            const shouldShowTour = !isFirstVisit && !isWelcomeTourActive && !hasSeenTour;

            console.log('Should show tour:', shouldShowTour);
            console.groupEnd();

            return shouldShowTour;
        },
        steps: [
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
        ]
    },
    mapView: {
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
            },
            // ... autres étapes
        ]
    }
    // Ajouter facilement d'autres tours ici
};

class OnboardingManager {
    constructor(options = {}) {
        console.log('OnboardingManager: Initialisation...');

        this.options = {
            forceTour: false,
            ...options
        };

        this.driverOptions = {
            animate: true,
            opacity: 0.7,
            padding: 5,
            showProgress: true,
            allowClose: true,
            stagePadding: 5,
            nextBtnText: 'Suivant',
            prevBtnText: 'Précédent',
            doneBtnText: 'Terminer'
        };

        this.setupTours();
    }

    setupTours() {
        Object.entries(TOUR_CONFIG).forEach(([tourType, config]) => {
            storeEvents.subscribe(config.event, () => {
                console.log(`OnboardingManager: ${tourType} event received`);
                
                // Vérification plus stricte des conditions
                const shouldStartTour = this.shouldStartTour(tourType);
                console.log(`OnboardingManager: Should start ${tourType}?`, shouldStartTour);
                
                if (shouldStartTour) {
                    // Pas de setTimeout pour éviter les race conditions
                    this.startTour(tourType);
                }
            });
        });
    }

    shouldStartTour(tourType) {
        if (this.options.forceTour) return true;
        
        const config = TOUR_CONFIG[tourType];
        if (!config) return false;

        // Vérifie si le tour a déjà été montré
        const hasBeenShown = this.hasTourBeenShown(tourType);
        if (hasBeenShown && !this.options.forceTour) {
            console.log(`OnboardingManager: ${tourType} already shown`);
            return false;
        }

        return config.condition(this);
    }

    getCurrentTour(element) {
        // Détermine le type de tour en cours à partir de l'élément actuel
        return Object.entries(TOUR_CONFIG).find(([, config]) =>
            config.steps.some(step => step.element === element)
        )?.[0];
    }

    verifyDOMElements(steps) {
        console.log('OnboardingManager: Verifying DOM elements...');
        const missingElements = [];

        steps.forEach((step, index) => {
            const element = document.querySelector(step.element);
            console.log(`Element ${step.element} exists:`, !!element, {
                index,
                title: step.popover.title,
                visible: element ? this.isElementVisible(element) : false
            });

            if (!element || !this.isElementVisible(element)) {
                missingElements.push({
                    index,
                    selector: step.element,
                    title: step.popover.title,
                    exists: !!element,
                    visible: element ? this.isElementVisible(element) : false
                });
            }
        });

        if (missingElements.length > 0) {
            console.error('OnboardingManager: Missing or hidden DOM elements:', missingElements);
            return false;
        }

        console.log('OnboardingManager: All DOM elements present and visible');
        return true;
    }

    isElementVisible(element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.display !== 'none'
            && style.visibility !== 'hidden'
            && style.opacity !== '0'
            && rect.width > 0
            && rect.height > 0;
    }

    createDriver() {
        try {
            const driverInstance = driver({
                ...this.driverOptions,
                onHighlightStarted: (element) => {
                    console.log('OnboardingManager: Step started', { 
                        element, 
                        tourType: this.activeTourType 
                    });
                },
                onDeselected: (element) => {
                    console.log('OnboardingManager: Step completed', { 
                        element, 
                        tourType: this.activeTourType 
                    });
                },
                onComplete: () => {
                    console.log('OnboardingManager: Tour completed!', this.activeTourType);
                    if (this.activeTourType) {
                        this.markTourAsShown(this.activeTourType);
                        storeEvents.emit(EVENTS.ONBOARDING.TOUR_COMPLETED, { 
                            tourType: this.activeTourType 
                        });
                    }
                    this.cleanup();
                },
                onClose: () => {
                    console.log('OnboardingManager: Tour closed manually', this.activeTourType);
                    if (this.activeTourType) {
                        storeEvents.emit(EVENTS.ONBOARDING.TOUR_CANCELLED, { 
                            tourType: this.activeTourType 
                        });
                    }
                    this.cleanup();
                }
            });

            return driverInstance;
        } catch (error) {
            console.error('Error creating Driver instance:', error);
            return null;
        }
    }

    cleanup() {
        this.driver = null;
        this.activeTourType = null;
    }

    async waitForElements(steps, maxAttempts = 5, interval = 1000) {
        console.log('OnboardingManager: Waiting for elements to be visible...');
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`OnboardingManager: Attempt ${attempt}/${maxAttempts}`);
            
            if (this.verifyDOMElements(steps)) {
                console.log('OnboardingManager: All elements are now visible');
                return true;
            }
            
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        console.error('OnboardingManager: Elements not visible after all attempts');
        return false;
    }

    async startTour(tourType) {
        console.log('OnboardingManager: Starting tour:', tourType);

        if (this.driver) {
            console.log('OnboardingManager: Stopping current tour');
            this.driver.destroy();
            this.driver = null;
        }

        const config = TOUR_CONFIG[tourType];
        if (!config) {
            console.error('OnboardingManager: No configuration found for tour:', tourType);
            return;
        }

        try {
            const elementsReady = await this.waitForElements(config.steps);
            if (!elementsReady) {
                console.error(`OnboardingManager: Cannot start ${tourType} tour - elements not ready`);
                return;
            }

            this.driver = this.createDriver();
            if (!this.driver) {
                console.error('OnboardingManager: Failed to create driver instance');
                return;
            }

            // Stocke le type de tour actif
            this.activeTourType = tourType;
            
            // Pas besoin d'ajouter onNext car on utilise onHighlightStarted/onDeselected
            this.driver.setSteps(config.steps);
            this.driver.drive();

            storeEvents.emit(EVENTS.ONBOARDING.TOUR_STARTED, { tourType });
            console.log(`OnboardingManager: ${tourType} tour started successfully`);
        } catch (error) {
            console.error('OnboardingManager: Error during tour start:', error);
            this.cleanup();
        }
    }

    isFirstVisit() {
        // On vérifie uniquement si le tour de bienvenue a été montré
        return !localStorage.getItem('geneafan_has_seen_welcome_tour');
    }

    isWelcomeTourActive() {
        // Vérifie si le tour de bienvenue est actuellement en cours
        return this.driver &&
            this.getCurrentActiveTour() === 'welcome';
    }

    getCurrentActiveTour() {
        if (!this.driver) return null;

        // Trouve le tour actif en comparant les étapes actuelles avec les configs
        const currentSteps = this.driver.steps;
        for (const [tourType, config] of Object.entries(TOUR_CONFIG)) {
            if (JSON.stringify(config.steps) === JSON.stringify(currentSteps)) {
                return tourType;
            }
        }
        return null;
    }

    hasTourBeenShown(tourType) {
        return localStorage.getItem(`geneafan_has_seen_${tourType}_tour`) === 'true';
    }

    markTourAsShown(tourType) {
        if (!tourType) {
            console.error('OnboardingManager: Cannot mark tour as shown - no tourType provided');
            return;
        }

        const key = `geneafan_has_seen_${tourType}_tour`;
        try {
            localStorage.setItem(key, 'true');
            const storedValue = localStorage.getItem(key);
            
            if (storedValue !== 'true') {
                throw new Error('Storage verification failed');
            }
            
            console.log(`OnboardingManager: ${tourType} tour marked as shown`);
        } catch (error) {
            console.error('OnboardingManager: Failed to mark tour as shown:', error);
            // Tentative de récupération
            try {
                sessionStorage.setItem(key, 'true');
                console.log('OnboardingManager: Fallback to sessionStorage successful');
            } catch (sessionError) {
                console.error('OnboardingManager: Complete storage failure:', sessionError);
            }
        }
    }

    resetTour(tourType) {
        localStorage.removeItem(`geneafan_has_seen_${tourType}_tour`);
        console.log(`OnboardingManager: ${tourType} tour has been reset`);
    }

    resetAllTours() {
        Object.keys(TOUR_CONFIG).forEach(tourType => {
            this.resetTour(tourType);
        });
        console.log('OnboardingManager: All tours have been reset');
    }

    forceTour(tourType) {
        if (!TOUR_CONFIG[tourType]) {
            console.error('OnboardingManager: Invalid tour type:', tourType);
            return;
        }

        console.log('OnboardingManager: Forcing tour:', tourType);
        this.options.forceTour = true;
        this.startTour(tourType);
        this.options.forceTour = false;
    }
}

export default OnboardingManager;