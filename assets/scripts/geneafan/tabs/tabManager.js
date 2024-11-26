import TimelineManager from './timeline/timelineManager.js';

export async function initializeTabs() {
    console.log('Tab initialization started');
    
    try {
        // Pour l'instant, on initialise juste le TimelineManager comme dans l'ancien système
        new TimelineManager();
        
        // Les autres initialisations de tabs seront ajoutées progressivement
        // TODO: FanChart
        // TODO: FamilyMap
        // TODO: FamilyTree
        
    } catch (error) {
        console.error("Error initializing tabs:", error);
        throw error;
    }
}