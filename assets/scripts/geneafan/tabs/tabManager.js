import TimelineManager from './timeline/timelineManager.js';
import { googleMapManager } from './familyMap/googleMapManager.js';
import { FanChartManager } from './fanChart/fanChartManager.js';

export async function initializeTabs() {
    console.log('Tab initialization started');
    
    try {
        // Initialize Timeline
        new TimelineManager();
        
        // Initialize Google Maps
        await googleMapManager.initialize();
        
        // Initialize FanChart
        await FanChartManager.initialize();
        
        // TODO: FamilyTree
        
    } catch (error) {
        console.error("Error initializing tabs:", error);
        throw error;
    }
}