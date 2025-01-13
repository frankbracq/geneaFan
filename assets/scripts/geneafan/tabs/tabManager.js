import TimelineManager from './timeline/timelineManager.js';
import { googleMapManager } from './familyMap/googleMapManager.js';
import { FanChartManager } from './fanChart/fanChartManager.js';

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
        // Initialisation de l'onglet Éventail
        console.log('📊 Initialisation de l\'éventail...');
        await FanChartManager.initialize();

        // Initialisation de la carte
        initializeTabOnVisible('#tab2', () => {
            console.group('🗺️ Initialisation de la carte');
            console.log('⚙️ Démarrage du processus d\'initialisation de Google Maps...');
            googleMapManager.initialize()
                .catch(error => {
                    console.error('❌ Erreur lors de l\'initialisation de la carte:', error);
                });
            console.groupEnd();
        });

        // Initialisation de la Timeline
        console.log('⏳ Initialisation de la timeline...');
        new TimelineManager();

        // Initialisation des statistiques avec import dynamique
        initializeTabOnVisible('#tab5', async () => {
            console.group('📈 Initialisation des statistiques');
            console.log('Démarrage de l\'initialisation des statistiques...');
            try {
                const { statisticsManager } = await import('./statistics/statisticsManager.js');
                await statisticsManager.initialize();
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