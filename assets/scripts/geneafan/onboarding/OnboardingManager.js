import { Offcanvas } from "bootstrap";
import { Dropdown } from "bootstrap/js/dist/dropdown";
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../../../scss/pages/driverjs-custom.scss';
import { EVENTS, storeEvents } from '../common/stores/storeEvents.js';
import { TOUR_CONFIG } from './tours';
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
        this.activeDropdown = null; // Add this to store the dropdown instance
        this.setupTours();
    }

    setupTours() {
        Object.entries(TOUR_CONFIG).forEach(([tourType, config]) => {
            storeEvents.subscribe(config.event, async () => {  // Ajout de async ici
                console.log(`OnboardingManager: ${tourType} event received`);

                const shouldStartTour = this.shouldStartTour(tourType);
                console.log(`OnboardingManager: Should start ${tourType}?`, shouldStartTour);

                if (shouldStartTour) {
                    try {
                        await this.startTour(tourType);  // Utilisation de await
                    } catch (error) {
                        console.error(`OnboardingManager: Failed to start ${tourType} tour:`, error);
                    }
                }
            });
        });
    }

    shouldStartTour(tourType) {
        if (this.options.forceTour) return true;

        const config = TOUR_CONFIG[tourType];
        if (!config) return false;

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
        const navLink = element.closest('.nav-link');
        if (navLink) {
            const isDisabled = navLink.classList.contains('disabled') ||
                navLink.getAttribute('aria-disabled') === 'true' ||
                navLink.getAttribute('aria-selected') === 'false';

            if (isDisabled) {
                console.log(`Tab ${element.id || navLink.id || navLink.getAttribute('href')} is disabled/not selected`);
                return false;
            }
        }

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

        if (this.activeDropdown) {
            try {
                this.activeDropdown.hide();
            } catch (error) {
                console.error('Error hiding dropdown during cleanup:', error);
            }
            this.activeDropdown = null;
        }

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

    async startTour(tourType) {  // Ajout de async ici
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
                onHighlightStarted: async (element) => {
                    const currentStep = this.currentStepIndex + 1;
                    console.log(`OnboardingManager: Highlighting step ${currentStep}/${steps.length}`, {
                        element: element.id || element.className,
                        title: steps[this.currentStepIndex].popover.title
                    });

                    const stepConfig = steps[this.currentStepIndex];
                    if (stepConfig?.onHighlight) {
                        try {
                            await stepConfig.onHighlight(element);
                        } catch (error) {
                            console.error(`Error in onHighlight for step ${currentStep}:`, error);
                        }
                    }
                },
                onDeselected: async (element) => {
                    const currentStep = this.currentStepIndex + 1;
                    console.log(`OnboardingManager: Step ${currentStep}/${steps.length} deselected`, {
                        element: element.id || element.className,
                        title: steps[this.currentStepIndex].popover.title
                    });

                    const stepConfig = steps[this.currentStepIndex];
                    if (stepConfig?.onDeselected) {
                        try {
                            await stepConfig.onDeselected(element);
                        } catch (error) {
                            console.error(`Error in onDeselected for step ${currentStep}:`, error);
                        }
                    }

                    if (currentStep === steps.length) {
                        console.log('OnboardingManager: Tour completed');
                        if (this.activeTourType) {
                            this.markTourAsShown(this.activeTourType);
                            storeEvents.emit(EVENTS.ONBOARDING.TOUR_COMPLETED, {
                                tourType: this.activeTourType
                            });
                        }
                        this.cleanup();
                    } else {
                        this.currentStepIndex++;
                        console.log(`OnboardingManager: Moving to step ${this.currentStepIndex + 1}/${steps.length}`);
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

    isFirstVisit() {
        return !localStorage.getItem('geneafan_has_seen_welcome_tour');
    }

    isWelcomeTourActive() {
        return this.driver && this.activeTourType === 'welcome';
    }

    getCurrentActiveTour() {
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