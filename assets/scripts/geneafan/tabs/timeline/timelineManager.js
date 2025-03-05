import timelineStore from './timelineStore.js';
import rootPersonStore from '../../common/stores/rootPersonStore.js';
import { reaction } from '../../common/stores/mobx-config.js';
import { EVENTS, storeEvents } from '../../common/stores/storeEvents.js';

class TimelineManager {
    constructor() {
        console.group('🔄 Initializing TimelineManager');
        
        // Sélection des éléments DOM
        this.timelineTab = document.querySelector('a[href="#tab4"]');
        console.log('Timeline tab selector:', 'a[href="#tab4"]');
        console.log('Timeline tab element found:', !!this.timelineTab);
        if (this.timelineTab) {
            console.log('Timeline tab element:', this.timelineTab.outerHTML);
        }
        
        this.timelineContainer = document.getElementById('ascendantTimeline');
        console.log('Timeline container found:', !!this.timelineContainer);
        
        // Configuration des réactions et écouteurs
        this.setupReactions();
        this.setupTabListeners();
        
        console.groupEnd();
    }

    setupReactions() {
        console.group('⚡ Setting up timeline reactions');
        
        // React to root person changes
        reaction(
            () => rootPersonStore.root,
            (root) => {
                console.log('Root changed:', root);
                if (root) {
                    this.enableTimelineTab();
                } else {
                    this.disableTimelineTab();
                }
            }
        );

        // React to timeline status changes
        reaction(
            () => timelineStore.status,
            (status) => {
                console.log('Timeline status changed:', status);
                if (status === 'success') {
                    this.enableTimelineTab();
                } else if (status === 'error') {
                    this.disableTimelineTab();
                }
            }
        );
        
        console.log('✅ Timeline reactions setup complete');
        console.groupEnd();
    }

    setupTabListeners() {
        console.group('🎧 Setting up timeline tab listeners');
        
        // Vérification de l'élément tab
        if (!this.timelineTab) {
            console.error('❌ Cannot setup listeners - Timeline tab element not found!');
            console.groupEnd();
            return;
        }

        // Ajout de l'écouteur d'événement
        this.timelineTab.addEventListener('shown.bs.tab', async (event) => {
            console.group('📊 Timeline tab shown event triggered');
            console.log('Event details:', event);
            console.log('Current timeline status:', timelineStore.status);
            
            try {
                if (timelineStore.status !== 'success') {
                    console.log('🔄 Initiating timeline update');
                    await timelineStore.updateTimelineForRoot();
                    console.log('✅ Timeline update completed');
                } else {
                    console.log('ℹ️ Timeline already in success state');
                }
                
                if (timelineStore.horizontalTimelineInstance) {
                    console.log('📏 Triggering resize event');
                    window.dispatchEvent(new Event('resize'));
                }
                
                // Ajouter un bouton d'aide avec un petit délai pour s'assurer que le DOM est prêt
                // Désactivé provisoirement pour éviter les problèmes de positionnement
                /*
                setTimeout(() => {
                    this.addHelpButton();
                    console.log('Help button added with delay');
                }, 500);
                */
                
                // Émettre l'événement pour indiquer que l'onglet timeline est affiché
                storeEvents.emit(EVENTS.UI.TABS.TIMELINE_SHOWN);
            } catch (error) {
                console.error('❌ Error updating timeline:', error);
            }
            
            console.groupEnd();
        });
        
        console.log('✅ Timeline tab listeners setup complete');
        console.groupEnd();
    }
    
    addHelpButton() {
        // Vérifier si le bouton existe déjà
        if (document.getElementById('timeline-help-button')) {
            console.log('Help button already exists');
            return;
        }
        
        console.log('➕ Adding timeline help button');
        
        // Debuggons les éléments disponibles
        console.group('🔍 Timeline Container Debug');
        console.log('tab4 exists:', !!document.getElementById('tab4'));
        console.log('tab4-label exists:', !!document.getElementById('tab4-label'));
        console.log('ascendantTimeline exists:', !!document.getElementById('ascendantTimeline'));
        console.log('Tab panes:', document.querySelectorAll('.tab-pane').length);
        const allIds = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
        console.log('All IDs on page:', allIds);
        console.groupEnd();
        
        // Créer le bouton d'aide
        const helpButton = document.createElement('button');
        helpButton.id = 'timeline-help-button';
        helpButton.className = 'btn btn-primary position-absolute';
        helpButton.style = 'top: 10px; right: 10px; z-index: 9999; padding: 8px 15px; font-size: 16px; box-shadow: 0 3px 5px rgba(0,0,0,0.2);';
        helpButton.innerHTML = '<i class="fas fa-question-circle"></i> Aide';
        
        // Essayons une approche plus directe pour trouver le conteneur de la timeline
        const allTabPanes = document.querySelectorAll('.tab-pane');
        console.log('Tab panes found:', allTabPanes.length);
        
        // Cherchons spécifiquement le conteneur de la timeline
        const activeTab = document.querySelector('.tab-pane.active');
        console.log('Active tab found:', !!activeTab);
        
        // Le conteneur qui contient #ascendantTimeline
        const timelineParent = document.getElementById('ascendantTimeline')?.parentElement;
        console.log('Timeline parent found:', !!timelineParent);
        
        // Utilisons la meilleure option disponible
        let container = timelineParent || activeTab;
        
        // Si rien ne fonctionne, utilisons le body comme fallback
        if (!container) {
            container = document.body;
            helpButton.style = 'position: fixed; top: 70px; right: 20px; z-index: 9999; padding: 8px 15px; font-size: 16px; box-shadow: 0 3px 5px rgba(0,0,0,0.2);';
        }
        
        console.log('Container for help button:', container);
        
        if (container) {
            if (container !== document.body) {
                container.style.position = 'relative';
            }
            container.appendChild(helpButton);
            
            console.log('Help button added to container');
            
            // Ajouter un écouteur d'événement pour démarrer le tour via l'OnboardingManager
            helpButton.addEventListener('click', async () => {
                console.log('🚀 Starting timeline tour');
                
                try {
                    // Essayer d'utiliser l'OnboardingManager pour une expérience cohérente
                    const { default: OnboardingManager } = await import('../../onboarding/OnboardingManager.js');
                    
                    // Démarrer le tour en forçant l'affichage (même si déjà vu)
                    await OnboardingManager.startTour('timelineView', { forceTour: true });
                    console.log('Tour démarré via OnboardingManager');
                } catch (error) {
                    console.error('Erreur lors du démarrage du tour via OnboardingManager:', error);
                    
                    // Fallback en cas d'erreur : utiliser driver.js directement
                    const { driver } = await import('driver.js');
                    await import('driver.js/dist/driver.css');
                    const { TOUR_CONFIG } = await import('../../onboarding/tours/index.js');
                    
                    const driverObj = driver({
                        showProgress: true,
                        nextBtnText: 'Suivant',
                        prevBtnText: 'Précédent',
                        doneBtnText: 'Terminer',
                        animate: true,
                        allowClose: true,
                        stagePadding: 10
                    });
                    
                    driverObj.setSteps(TOUR_CONFIG.timelineView.steps);
                    driverObj.drive();
                }
            });
        } else {
            console.error('❌ No container found for help button');
        }
    }

    enableTimelineTab() {
        console.log('🔓 Enabling timeline tab');
        if (this.timelineTab) {
            this.timelineTab.classList.remove('disabled');
        }
    }

    disableTimelineTab() {
        console.log('🔒 Disabling timeline tab');
        if (this.timelineTab) {
            this.timelineTab.classList.add('disabled');
        }
    }

    async updateTimelineForRoot() {
        return timelineStore.updateTimelineForRoot();
    }
    
    // Méthode publique pour ajouter le bouton d'aide (peut être appelée manuellement)
    addHelpButtonManually() {
        console.log('🔄 Adding help button manually');
        // Force la suppression du bouton existant s'il y en a un
        const existingButton = document.getElementById('timeline-help-button');
        if (existingButton) {
            existingButton.remove();
        }
        
        // Ajout du bouton directement au body (méthode sûre)
        const helpButton = document.createElement('button');
        helpButton.id = 'timeline-help-button';
        helpButton.className = 'btn btn-danger';
        helpButton.style = 'position: fixed; top: 120px; right: 20px; z-index: 9999; padding: 10px 20px; font-size: 16px; box-shadow: 0 4px 8px rgba(0,0,0,0.3);';
        helpButton.innerHTML = '<i class="fas fa-question-circle"></i> Aide Timeline';
        
        document.body.appendChild(helpButton);
        console.log('Help button manually added to body');
        
        // Ajouter l'écouteur d'événement pour démarrer le tour via l'OnboardingManager
        helpButton.addEventListener('click', async () => {
            console.log('🚀 Starting timeline tour (manually added button)');
            
            try {
                // Essayer d'utiliser l'OnboardingManager pour une expérience cohérente
                const { default: OnboardingManager } = await import('../../onboarding/OnboardingManager.js');
                
                // Démarrer le tour en forçant l'affichage (même si déjà vu)
                await OnboardingManager.startTour('timelineView', { forceTour: true });
                console.log('Tour démarré via OnboardingManager');
            } catch (error) {
                console.error('Erreur lors du démarrage du tour via OnboardingManager:', error);
                
                // Fallback en cas d'erreur : utiliser driver.js directement
                const { driver } = await import('driver.js');
                await import('driver.js/dist/driver.css');
                const { TOUR_CONFIG } = await import('../../onboarding/tours/index.js');
                
                const driverObj = driver({
                    showProgress: true,
                    nextBtnText: 'Suivant',
                    prevBtnText: 'Précédent',
                    doneBtnText: 'Terminer',
                    animate: true,
                    allowClose: true,
                    stagePadding: 10
                });
                
                driverObj.setSteps(TOUR_CONFIG.timelineView.steps);
                driverObj.drive();
            }
        });
        
        return helpButton;
    }

    // Clean up method
    destroy() {
        console.log('🧹 Cleaning up TimelineManager');
        timelineStore.dispose();
        if (this.timelineTab) {
            this.timelineTab.removeEventListener('shown.bs.tab');
        }
    }
}

// Export instance
const timelineManager = new TimelineManager();
export { timelineManager, TimelineManager };