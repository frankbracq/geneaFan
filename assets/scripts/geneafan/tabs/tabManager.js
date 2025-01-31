import { FanChartManager } from './fanChart/fanChartManager.js';
import { googleMapManager } from './familyMap/googleMapManager.js';
import { googleMapsStore } from './familyMap/googleMapsStore.js';
import { offcanvasManager } from './fanChart/offcanvasManager.js';
import { storeEvents, EVENTS } from '../gedcom/stores/storeEvents.js';

// Map des noms conviviaux pour les tabs
const TAB_NAMES = {
    'tab1': 'Éventail',
    'tab2': 'Carte',
    'tab3': 'Timeline',
    'tab4': 'Documents',
    'tab5': 'Statistiques'
};

function setupTabChangeTracking() {
    // Écouter tous les événements de changement d'onglet
    document.querySelectorAll('a[data-bs-toggle="tab"]').forEach(tabElement => {
        tabElement.addEventListener('shown.bs.tab', event => {
            // Récupérer l'ID du contenu du tab (le div target) plutôt que l'href
            const targetElement = document.querySelector(event.target.getAttribute('href'));
            if (!targetElement) {
                console.warn('❌ Element cible non trouvé pour le tab');
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
            console.log('🔍 Événement détaillé:', event);
            console.groupEnd();

            const tabChangeEvent = {
                newTab: { id: newTabId, name: newTabName },
                previousTab: { id: prevTabId, name: prevTabName }
            };

            console.log('📡 Emission de l\'événement EVENTS.TABS.CHANGED:', tabChangeEvent);
            storeEvents.emit(EVENTS.TABS.CHANGED, tabChangeEvent);

            const tabShownEvent = { id: newTabId, name: newTabName };
            console.log('📡 Emission de l\'événement EVENTS.TABS.SHOWN:', tabShownEvent);
            storeEvents.emit(EVENTS.TABS.SHOWN, tabShownEvent);

            if (prevTabId) {
                const tabHiddenEvent = { id: prevTabId, name: prevTabName };
                console.log('📡 Emission de l\'événement EVENTS.TABS.HIDDEN:', tabHiddenEvent);
                storeEvents.emit(EVENTS.TABS.HIDDEN, tabHiddenEvent);
            }

            // 🎯 Ajout de la gestion spécifique pour la carte et l'Offcanvas
            handleTabSpecificActions(newTabId, prevTabId);
        });
    });
}

storeEvents.subscribe(EVENTS.TABS.SHOWN, async ({ id }) => {
    if (id === "tab2") {
        console.group('🗺️ Activation de la carte');

        try {
            await googleMapsStore.resizeAndMoveMap("familyMap");
            console.log('✅ Carte déplacée et redimensionnée');

            googleMapManager.setupLayerControls();
            googleMapManager.setupEventListeners();

        } catch (error) {
            console.error('❌ Erreur lors du chargement de la carte:', error);
        }

        console.groupEnd();
    }
});

storeEvents.subscribe(EVENTS.TABS.HIDDEN, ({ id }) => {
    if (id === "tab2") {
        console.log(`🗺️ La carte est masquée, arrêt des mises à jour.`);
        googleMapsStore.clearCurrentMarkers();
    }
});

/**
 * Gère les actions spécifiques lors du passage d'un onglet à un autre
 */
function handleTabSpecificActions(newTabId, prevTabId) {
    if (newTabId === "tab2") {
        console.log(`🗺️ Onglet "Carte" activé : déplacement et redimensionnement de la carte.`);
        // googleMapsStore.resizeAndMoveMap("familyMap");
    }

    if (prevTabId === "tab2") {
        console.log(`🔽 Onglet "Carte" masqué : suppression éventuelle des marqueurs.`);
        googleMapsStore.clearCurrentMarkers();
    }

    if (newTabId === "tab1") {
        const offcanvasElement = document.getElementById("individualMapContainer");

        // ❌ Suppression du code qui forçait l'ouverture de l'Offcanvas
        console.log("🔹 Retour sur l'onglet Éventail, mais pas d'ouverture automatique du Offcanvas.");
    }
}

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
        
        // Initialisation de la Timeline avec import dynamique
        initializeTabOnVisible('#tab3', async () => {
            console.group('⏳ Initialisation de la timeline');
            try {
                const { TimelineManager } = await import('./timeline/timelineManager.js');
                new TimelineManager();
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