import TimelineManager from './timeline/timelineManager.js';
import { googleMapManager } from './familyMap/googleMapManager.js';
import { FanChartManager } from './fanChart/fanChartManager.js';
import { statisticsManager } from './statistics/statisticsManager.js';

export async function initializeTabs() {
    console.log('Tab initialization started');

    try {
        // Initialisation de l'onglet Éventail
        await FanChartManager.initialize();

        // Initialisation de la carte une fois l'onglet visible
        // Initialisation de la carte une fois l'onglet visible
        initializeTabOnVisible('#tab2', () => {
            console.log('🗺️ Map tab is now visible and ready for initialization');
            console.log('⚙️ Starting Google Maps initialization process...');
            googleMapManager.initialize();
        });

        // Initialisation de la Timeline
        new TimelineManager();

        // Initialisation des statistiques une fois l'onglet visible
        initializeTabOnVisible('#tab5', () => {
            console.log('Statistics tab is visible. Initializing statistics...');
            statisticsManager.initialize();
        });

    } catch (error) {
        console.error("Error initializing tabs:", error);
        throw error;
    }
}

function initializeTabOnVisible(tabSelector, initCallback) {
    const tab = document.querySelector(tabSelector);
    if (tab) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    initCallback();
                    observer.disconnect();
                }
            });
        });
        observer.observe(tab);
    }
}