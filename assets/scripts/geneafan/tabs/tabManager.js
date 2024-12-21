import TimelineManager from './timeline/timelineManager.js';
import { googleMapManager } from './familyMap/googleMapManager.js';
import { FanChartManager } from './fanChart/fanChartManager.js';
import { statisticsManager } from './statistics/statisticsManager.js';

export async function initializeTabs() {
    console.log('Tab initialization started');

    try {
        // Initialisation de l'onglet Éventail
        await FanChartManager.initialize();

        // Initialisation de Google Maps
        await googleMapManager.initialize();

        // Initialisation de la Timeline
        new TimelineManager();

        // Initialisation des statistiques une fois l'onglet visible
        const statisticsTab = document.querySelector('#tab5'); // Sélecteur de l'onglet des statistiques
        if (statisticsTab) {
            // Utilisation d'IntersectionObserver pour détecter la visibilité de l'onglet
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        console.log('Statistics tab is visible. Initializing statistics...');
                        statisticsManager.initialize(); // Initialisation des statistiques
                        observer.disconnect(); // Arrêter l'observation une fois initialisé
                    }
                });
            });

            // Commence à observer l'onglet des statistiques
            observer.observe(statisticsTab);
        }

    } catch (error) {
        console.error("Error initializing tabs:", error);
        throw error;
    }
}