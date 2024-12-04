import TimelineManager from './timeline/timelineManager.js';
import { googleMapManager } from './familyMap/googleMapManager.js';

export async function initializeTabs() {
    console.log('Tab initialization started');
    
    try {
        // Initialize Timeline
        new TimelineManager();
        
        // Initialize Google Maps
        await googleMapManager.initialize();
        
        // Les autres initialisations de tabs seront ajoutées progressivement
        // TODO: FanChart
        // TODO: FamilyTree
        
    } catch (error) {
        console.error("Error initializing tabs:", error);
        throw error;
    }
}