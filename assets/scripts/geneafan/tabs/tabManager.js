import { FanChartManager } from './fanChart/fanChartManager.js';
import { googleMapManager } from './familyMap/googleMapManager.js';
import { googleMapsStore } from './familyMap/googleMapsStore.js';
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
    let currentTab = null;

    // Écouter tous les événements de changement d'onglet
    document.querySelectorAll('a[data-bs-toggle="tab"]').forEach(tabElement => {
        tabElement.addEventListener('shown.bs.tab', event => {
            const newTabId = event.target.getAttribute('href').substring(1); // Enlever le #
            const prevTabId = event.relatedTarget?.getAttribute('href')?.substring(1);
            
            const newTabName = TAB_NAMES[newTabId] || newTabId;
            const prevTabName = TAB_NAMES[prevTabId] || prevTabId || 'aucun onglet';

            console.group('📑 Changement d\'onglet');
            console.log(`↪️ ${prevTabName} → ${newTabName}`);
            console.groupEnd();
        });
    });
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

        // Initialisation de la carte - Modifié pour utiliser la nouvelle structure
        initializeTabOnVisible('#tab2', async () => {
            console.group('🗺️ Initialisation de la carte');
            try {
                // L'API sera déjà chargée grâce à l'événement FAN.DRAWN
                // On initialise juste la carte principale ici
                if (googleMapsStore.isApiLoaded) {
                    await googleMapsStore.initMap("familyMap");
                    googleMapManager.setupLayerControls();
                    googleMapManager.setupEventListeners();
                    console.log('✅ Carte initialisée avec succès');
                } else {
                    console.log('⏳ En attente du chargement de l\'API Google Maps');
                    // On attend que l'API soit prête
                    const apiReadyPromise = new Promise(resolve => {
                        const disposer = storeEvents.subscribe(EVENTS.MAPS.API_READY, () => {
                            resolve();
                            disposer();
                        });
                    });
                    await apiReadyPromise;
                    await googleMapsStore.initMap("familyMap");
                    googleMapManager.setupLayerControls();
                    googleMapManager.setupEventListeners();
                    console.log('✅ Carte initialisée avec succès après chargement de l\'API');
                }
            } catch (error) {
                console.error('❌ Erreur lors de l\'initialisation de la carte:', error);
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