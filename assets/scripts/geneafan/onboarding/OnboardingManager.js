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
                
                if (config.condition(this) && !this.hasTourBeenShown(tourType)) {
                    console.log(`OnboardingManager: Starting ${tourType} tour`);
                    setTimeout(() => {
                        this.startTour(tourType);
                    }, 500);
                } else {
                    console.log(`OnboardingManager: Skipping ${tourType} tour`);
                }
            });
        });
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
                onComplete: (element) => {
                    const tourType = this.getCurrentTour(element);
                    if (tourType) {
                        this.markTourAsShown(tourType);
                        storeEvents.emit(EVENTS.ONBOARDING.TOUR_COMPLETED, { tourType });
                    }
                    this.driver = null; // Nettoyer l'instance
                },
                onClose: (element) => {
                    const tourType = this.getCurrentTour(element);
                    if (tourType) {
                        storeEvents.emit(EVENTS.ONBOARDING.TOUR_CANCELLED, { tourType });
                    }
                    this.driver = null; // Nettoyer l'instance
                }
            });

            return driverInstance;
        } catch (error) {
            console.error('Error creating Driver instance:', error);
            return null;
        }
    }

    startTour(tourType) {
        console.log('OnboardingManager: Starting tour:', tourType);
        
        // Si un tour est déjà en cours, on l'arrête
        if (this.driver) {
            console.log('OnboardingManager: Stopping current tour');
            this.driver.destroy();
            this.driver = null;
        }

        // Création d'une nouvelle instance de driver
        this.driver = this.createDriver();
        if (!this.driver) {
            console.error('OnboardingManager: Failed to create driver instance');
            return;
        }

        const config = TOUR_CONFIG[tourType];
        if (!config) {
            console.error('OnboardingManager: No configuration found for tour:', tourType);
            return;
        }

        try {
            if (!this.verifyDOMElements(config.steps)) {
                console.error(`OnboardingManager: Cannot start ${tourType} tour - missing or hidden DOM elements`);
                return;
            }
            
            this.driver.setSteps(config.steps);
            this.driver.drive();
            storeEvents.emit(EVENTS.ONBOARDING.TOUR_STARTED, { tourType });
            console.log(`OnboardingManager: ${tourType} tour started successfully`);
        } catch (error) {
            console.error('OnboardingManager: Error during tour start:', error);
            if (this.driver) {
                this.driver.destroy();
                this.driver = null;
            }
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
        localStorage.setItem(`geneafan_has_seen_${tourType}_tour`, 'true');
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