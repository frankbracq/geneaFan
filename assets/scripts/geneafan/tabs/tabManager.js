import TimelineManager from './timeline/timelineManager.js';
import { googleMapManager } from './familyMap/googleMapManager.js';
import { FanChartManager } from './fanChart/fanChartManager.js';
import { statisticsManager } from './statistics/statisticsManager.js';

export async function initializeTabs() {
    console.log('Tab initialization started');

    try {
        // Initialize FanChart
        await FanChartManager.initialize();

        // Initialize Google Maps
        await googleMapManager.initialize();


        // Note: FamilyTree initialization is handled in parse.js after GEDCOM data loading
        // as it requires the rootId and processed genealogical data to be available.
        // The FamilyTree is initialized once:
        // 1. The individuals cache is built
        // 2. Data is formatted for FamilyTree.js
        // 3. A rootId is defined

        // Initialize Timeline
        new TimelineManager();

        // Initialize Statistics
        statisticsManager.initialize();

    } catch (error) {
        console.error("Error initializing tabs:", error);
        throw error;
    }
}