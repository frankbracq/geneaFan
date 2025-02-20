import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../../../scss/pages/driverjs-custom.scss';

import { Offcanvas } from "bootstrap";
import { EVENTS, storeEvents } from '../gedcom/stores/storeEvents.js';

// Configuration centralisée des tours
const TOUR_CONFIG = {
    welcome: {
        event: EVENTS.ONBOARDING.APP_LOADED,
        condition: (manager) => manager.isFirstVisit(),
        steps: [
            {
                element: '#tab-nav',
                popover: {
                    title: 'Navigation',
                    description: 'Une fois votre fichier chargé, vous pourrez explorer vos données avec différentes visualisations.',
                    position: 'bottom'
                }
            },
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
    
            const shouldShowTour = !isFirstVisit && !isWelcomeTourActive && !hasSeenTour;
            console.log('Should show tour:', shouldShowTour);
            console.groupEnd();
    
            return shouldShowTour;
        },
        steps: [
            {
                //element: '#tab-nav .nav-link[href="#tab1"]',
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
                },
                
            },
            {
                element: '#middle-container',
                popover: {
                    title: 'Sélection de l\'individu',
                    description: 'Recherchez et sélectionnez un individu.',
                    position: 'bottom'
                },
                
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
                    // Simuler un clic pour montrer l'offcanvas des détails
                    const customEvent = new CustomEvent('showPersonDetails', { 
                        detail: element.__data__ 
                    });
                    document.dispatchEvent(customEvent);
                },
                onDeselected: (element) => {
                    // D'abord fermer l'offcanvas
                    const offcanvas = document.getElementById('personDetails');
                    if (offcanvas) {
                        const bsOffcanvas = Offcanvas.getInstance(offcanvas);
                        if (bsOffcanvas) {
                            try {
                                bsOffcanvas.hide();
                            } catch (error) {
                                console.error('Error closing offcanvas:', error);
                            }
                        }
                    }
            
                    // Attendre que l'offcanvas soit fermé avant de continuer
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve();
                        }, 300); // Délai pour laisser l'animation se terminer
                    });
                }
            },
            {
                element: '#fanParametersDisplay',
                popover: {
                    title: 'Paramètres de l\'éventail',
                    description: 'Cliquez ici pour personnaliser l\'affichage de votre arbre en éventail.',
                    position: 'bottom'
                },
                onDeselected: (element) => {
                    console.log('Opening fan parameters offcanvas...');
                    const offcanvas = document.getElementById('fanParameters');
                    if (offcanvas) {
                        try {
                            new Offcanvas(offcanvas).show();
                        } catch (error) {
                            console.error('Error opening offcanvas:', error);
                        }
                    }
                }
            },
            {
                element: '#fanParametersBody',
                popover: {
                    title: 'Configuration de l\'éventail',
                    description: 'Lorem ipsum...',
                    position: 'right'
                },
                onDeselected: (element) => {
                    console.log('Closing fan parameters offcanvas...');
                    const offcanvas = document.getElementById('fanParameters');
                    if (offcanvas) {
                        const bsOffcanvas = Offcanvas.getInstance(offcanvas);
                        if (bsOffcanvas) {
                            try {
                                bsOffcanvas.hide();
                            } catch (error) {
                                console.error('Error closing offcanvas:', error);
                            }
                        }
                    }
                }
            },
            {
                element: '#download-menu',
                popover: {
                    title: 'Export de l\éventail en PDF',
                    description: 'Pour commencer, vous devez charger un fichier GEDCOM. Cliquez ici pour importer votre fichier ou essayer notre exemple.',
                    position: 'bottom'
                }
            },

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
            }
        ]
    }
};

class OnboardingManager {
    constructor(options = {}) {
        this.options = {
            forceTour: false,
            ...options
        };

        this.driverOptions = {
            animate: true,
            opacity: 0.7,
            padding: 5,
            showProgress: true,
            allowClose: false,
            stagePadding: 5,
            nextBtnText: 'Suivant',
            prevBtnText: 'Précédent',
            doneBtnText: 'Terminer'
        };

        this.activeTourType = null;
        this.currentStepIndex = 0;
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
                    // On attend que le tour démarre
                    this.startTour(tourType).catch(error => {
                        console.error(`OnboardingManager: Failed to start ${tourType} tour:`, error);
                    });
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
        // Obtenir l'élément nav-link le plus proche si on est sur un tab
        const navLink = element.closest('.nav-link');
        if (navLink) {
            // Pour les onglets, vérifier s'ils sont actifs et visibles
            const isDisabled = navLink.classList.contains('disabled') || 
                             navLink.getAttribute('aria-disabled') === 'true' ||
                             navLink.getAttribute('aria-selected') === 'false';
            
            if (isDisabled) {
                console.log(`Tab ${element.id || navLink.id || navLink.getAttribute('href')} is disabled/not selected`);
                return false;
            }
        }

        // Vérification standard de la visibilité
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        const isVisible = style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0;

        if (!isVisible) {
            console.log(`Element ${element.id || element.className} is not visible:`, {
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                dimensions: { width: rect.width, height: rect.height }
            });
        }

        return isVisible;
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
                    console.log('OnboardingManager: Tour completion triggered!', {
                        tourType: this.activeTourType,
                        hasDriver: !!this.driver,
                        currentStep: this.driver ? this.driver.currentStep : null
                    });
                    
                    if (this.activeTourType) {
                        this.markTourAsShown(this.activeTourType);
                        storeEvents.emit(EVENTS.ONBOARDING.TOUR_COMPLETED, { 
                            tourType: this.activeTourType 
                        });
                        console.log('OnboardingManager: Tour marked as shown and event emitted');
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
        const tourType = this.activeTourType;
        const finalStepIndex = this.currentStepIndex;
        
        this.driver = null;
        this.activeTourType = null;
        this.currentStepIndex = 0;

        console.log('OnboardingManager: Cleaned up tour:', {
            tourType,
            finalStep: finalStepIndex,
            hasSeenTour: tourType ? this.hasTourBeenShown(tourType) : null
        });
    }

    async waitForElements(steps, maxAttempts = 10, interval = 500) {
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

    getFanDrawnSteps() {
        // Base steps that are always present
        const steps = [
            {
                element: '#tab1',
                popover: {
                    title: 'Ascendance',
                    description: 'Vue principale de votre arbre généalogique.',
                    position: 'bottom'
                }
            },
            {
                element: '#individual-select',
                popover: {
                    title: 'Sélection de l\'individu',
                    description: 'Recherchez et sélectionnez un individu.',
                    position: 'bottom'
                }
            }
        ];

        return steps;
    }

    async startTour(tourType) {
        console.log('OnboardingManager: Starting tour:', tourType);

        if (this.driver) {
            console.log('OnboardingManager: Stopping current tour');
            this.driver.destroy();
            this.driver = null;
        }

        try {
            const config = TOUR_CONFIG[tourType];
            let steps = config.steps || [];
            this.currentStepIndex = 0;

            // Debug log pour vérifier l'ordre des étapes
            console.log('Steps before enhancement:', steps.map(s => s.popover.title));

            // Configuration des étapes
            const enhancedSteps = steps.map((step, index) => {
                const isLastStep = index === steps.length - 1;
                const stepConfig = {
                    ...step,
                    popover: {
                        ...step.popover,
                        buttons: isLastStep 
                            ? {
                                text: {
                                    done: 'Terminer'
                                },
                                show: ['previous', 'done']
                            }
                            : {
                                text: {
                                    next: 'Suivant'
                                },
                                show: ['previous', 'next']
                            }
                    }
                };

                // Debug log pour chaque étape
                console.log(`Step ${index + 1} configuration:`, {
                    title: stepConfig.popover.title,
                    buttons: stepConfig.popover.buttons,
                    isLastStep
                });

                return stepConfig;
            });

            this.driver = driver({
                ...this.driverOptions,
                onHighlightStarted: (element) => {
                    console.log('OnboardingManager: Step highlight started', { 
                        element,
                        currentStep: this.currentStepIndex + 1,
                        totalSteps: steps.length,
                        stepTitle: steps[this.currentStepIndex].popover.title
                    });

                    const currentStep = steps[this.currentStepIndex];
                    if (currentStep?.onHighlight) {
                        try {
                            currentStep.onHighlight(element);
                        } catch (error) {
                            console.error('Error in onHighlight:', error);
                        }
                    }
                },
                onDeselected: (element) => {
                    console.log(`OnboardingManager: Step ${this.currentStepIndex + 1}/${steps.length} deselected`);
                    
                    const currentStep = steps[this.currentStepIndex];
                    if (currentStep?.onDeselected) {
                        try {
                            currentStep.onDeselected(element);
                        } catch (error) {
                            console.error('Error in onDeselected:', error);
                        }
                    }

                    if (this.currentStepIndex === steps.length - 1) {
                        if (this.activeTourType) {
                            this.markTourAsShown(this.activeTourType);
                            storeEvents.emit(EVENTS.ONBOARDING.TOUR_COMPLETED, { 
                                tourType: this.activeTourType 
                            });
                        }
                        this.cleanup();
                    } else {
                        this.currentStepIndex++;
                    }
                }
            });

            this.activeTourType = tourType;
            
            this.driver.setSteps(enhancedSteps);
            this.driver.drive();

            storeEvents.emit(EVENTS.ONBOARDING.TOUR_STARTED, { tourType });
            console.log(`OnboardingManager: ${tourType} tour started successfully`);
        } catch (error) {
            console.error('OnboardingManager: Error during tour start:', error);
            this.cleanup();
        }
    }

    async startTour1(tourType) {
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
            // Utiliser les steps statiques par défaut
            let steps = config.steps || [];
    
            // Log pour debug
            console.log('OnboardingManager: Tour steps:', {
                tourType,
                numberOfSteps: steps.length,
                steps: steps.map(s => ({
                    element: s.element,
                    title: s.popover.title
                }))
            });
    
            if (!steps || steps.length === 0) {
                console.log('OnboardingManager: No steps available for tour:', tourType);
                return;
            }
    
            const elementsReady = await this.waitForElements(steps);
            if (!elementsReady) {
                console.error(`OnboardingManager: Cannot start ${tourType} tour - elements not ready`);
                return;
            }
    
            this.driver = this.createDriver();
            if (!this.driver) {
                console.error('OnboardingManager: Failed to create driver instance');
                return;
            }
    
            this.activeTourType = tourType;
            
            // Préparer les steps avec le bouton Terminer sur le dernier
            const lastStepIndex = steps.length - 1;
            const enhancedSteps = steps.map((step, index) => ({
                ...step,
                popover: {
                    ...step.popover,
                    doneBtnText: index === lastStepIndex ? 'Terminer' : undefined,
                },
                onDeselected: () => {
                    console.log(`OnboardingManager: Step ${index + 1}/${steps.length} deselected`);
                    
                    if (index === lastStepIndex) {
                        setTimeout(() => {
                            if (this.activeTourType && this.driver) {
                                console.log('OnboardingManager: Last step completed, ending tour');
                                this.markTourAsShown(this.activeTourType);
                                storeEvents.emit(EVENTS.ONBOARDING.TOUR_COMPLETED, { 
                                    tourType: this.activeTourType 
                                });
                                this.driver.destroy();
                                this.cleanup();
                            }
                        }, 100);
                    }
                }
            }));
            
            this.driver.setSteps(enhancedSteps);
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
        // Version simplifiée utilisant directement activeTourType
        return this.driver && this.activeTourType === 'welcome';
    }

    getCurrentActiveTour() {
        // Utilise directement activeTourType s'il est défini
        return this.activeTourType;
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