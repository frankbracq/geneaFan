import { FanChartManager } from './fanChart/fanChartManager.js';
import { googleMapManager } from './familyMap/managers/googleMapManager.js';
import { googleMapsStore } from './familyMap/stores/googleMapsStore.js';
import { storeEvents, EVENTS } from '../common/stores/storeEvents.js';
import { rootAncestorTownsStore } from './familyMap/stores/rootAncestorTownsStore.js';
import familyTownsStore from './familyMap/stores/familyTownsStore.js';

// Map des noms conviviaux pour les tabs
const TAB_NAMES = {
    'tab1': 'Éventail',
    'tab2': 'Carte',
    'tab3': 'Tree',
    'tab4': 'Timeline',
    'tab5': 'Statistiques'
};

function setupTabChangeTracking() {
    document.querySelectorAll('a[data-bs-toggle="tab"]').forEach(tabElement => {
        tabElement.addEventListener('shown.bs.tab', event => {
            const targetElement = document.querySelector(event.target.getAttribute('href'));
            if (!targetElement) {
                console.warn('❌ Élément cible non trouvé pour le tab');
                return;
            }

            const prevTargetElement = event.relatedTarget ? 
                document.querySelector(event.relatedTarget.getAttribute('href')) : 
                null;

            const newTabId = targetElement.id;
            const prevTabId = prevTargetElement?.id;

            const newTabName = TAB_NAMES[newTabId] || newTabId;
            const prevTabName = TAB_NAMES[prevTabId] || prevTabId || 'aucun onglet';

            console.group('📑 Changement d\'onglet');
            console.log(`↪️ ${prevTabName} → ${newTabName}`);
            console.groupEnd();

            // Émission des événements avec la nouvelle structure UI.TABS
            storeEvents.emit(EVENTS.UI.TABS.CHANGED, { 
                newTab: { id: newTabId, name: newTabName }, 
                previousTab: { id: prevTabId, name: prevTabName } 
            });
            storeEvents.emit(EVENTS.UI.TABS.SHOWN, { id: newTabId, name: newTabName });

            if (prevTabId) {
                storeEvents.emit(EVENTS.UI.TABS.HIDDEN, { id: prevTabId, name: prevTabName });
            }

            // Émettre aussi l'événement onboarding si nécessaire
            storeEvents.emit(EVENTS.ONBOARDING.TOUR_STARTED, { tabId: newTabId });
        });
    });
}

// Mise à jour des écouteurs d'événements pour utiliser UI.TABS
storeEvents.subscribe(EVENTS.UI.TABS.SHOWN, async ({ id }) => {
    if (id === "tab2") {
        console.group('🗺️ Activation de la carte');

        try {
            await googleMapsStore.resizeAndMoveMap();
            console.log('✅ Carte déplacée et redimensionnée');

            googleMapManager.setupLayerControls();
            googleMapManager.setupEventListeners();

            if (rootAncestorTownsStore.hasActiveMarkers()) {
                rootAncestorTownsStore.centerMapOnAncestorMarkers();
            }

        } catch (error) {
            console.error('❌ Erreur lors du chargement de la carte:', error);
        }

        console.groupEnd();
    }
});

storeEvents.subscribe(EVENTS.UI.TABS.HIDDEN, ({ id }) => {
    if (id === "tab2") {
        console.log(`🗺️ La carte est masquée, arrêt des mises à jour.`);
        rootAncestorTownsStore.toggleVisibility(false);
        familyTownsStore.toggleVisibility(false);
    }
});

function initializeTabOnVisible(tabSelector, initCallback) {
    console.group(`📑 Configuration de l'initialisation pour ${tabSelector}`);
    
    const tab = document.querySelector(tabSelector);
    if (!tab) {
        console.warn(`⚠️ Onglet ${tabSelector} non trouvé`);
        console.groupEnd();
        return;
    }

    console.log(`✓ Onglet ${tabSelector} trouvé, configuration de l'observer...`);
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                console.log(`📍 Onglet ${tabSelector} visible, démarrage de l'initialisation`);
                try {
                    initCallback();
                } catch (error) {
                    console.error(`❌ Erreur lors de l'initialisation de ${tabSelector}:`, error);
                }
                observer.disconnect();
                console.log(`✅ Observer déconnecté pour ${tabSelector}`);
            }
        });
    });

    observer.observe(tab);
    console.log(`✓ Observer configuré pour ${tabSelector}`);
    console.groupEnd();
}

export async function initializeTabs() {
    console.group('🚀 Initialisation des onglets');

    try {
        setupTabChangeTracking();

        // Initialisation de l'éventail
        initializeTabOnVisible('#tab1', async () => {
            console.group('📊 Initialisation de l\'éventail');
            try {
                await FanChartManager.initialize();
                console.log('✅ Éventail initialisé avec succès');
            } catch (error) {
                console.error('❌ Erreur lors de l\'initialisation de l\'éventail:', error);
            }
            console.groupEnd();
        });

        initializeTabOnVisible('#tab2', async () => {
            console.group('🗺️ Initialisation de la carte');
            try {
                // Initialisation de la carte
                await googleMapManager.initialize();
                
                // Redimensionnement
                await googleMapsStore.resizeAndMoveMap();
                
                // Centrage sur les marqueurs si nécessaire (maintenant géré par rootAncestorTownsStore)
                if (rootAncestorTownsStore.hasActiveMarkers()) {
                    rootAncestorTownsStore.centerMapOnAncestorMarkers();
                }
                
                console.log('✅ Carte initialisée dans tab2');
            } catch (error) {
                console.error('❌ Erreur lors de l\'initialisation de la carte:', error);
            }
            console.groupEnd();
        });
        
        // Initialisation de la Timeline avec import dynamique
        initializeTabOnVisible('#tab4', async () => {
            console.group('⏳ Initialisation de la timeline');
            try {
                const { timelineManager } = await import('./timeline/timelineManager.js');
                console.log('TimelineManager importé avec succès');
                await timelineManager.updateTimelineForRoot();
                console.log('✅ Timeline initialisée avec succès');
            } catch (error) {
                console.error('❌ Erreur lors de l\'initialisation de la timeline:', error);
            }
            console.groupEnd();
        });

        // Initialisation des statistiques avec import dynamique
        initializeTabOnVisible('#tab5', async () => {
            console.group('📈 Initialisation des statistiques');
            try {
                const { statisticsManager } = await import('./statistics/statisticsManager.js');
                await statisticsManager.initialize();
                console.log('✅ Statistiques initialisées avec succès');
            } catch (error) {
                console.error('❌ Erreur lors de l\'initialisation des statistiques:', error);
            }
            console.groupEnd();
        });

        console.log('✅ Configuration de tous les onglets terminée');

    } catch (error) {
        console.error("❌ Erreur critique lors de l'initialisation des onglets:", error);
        throw error;
    }

    console.groupEnd();
}