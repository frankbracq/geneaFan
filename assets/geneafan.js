// Import new initialization system
import { initializeApplication } from './scripts/geneafan/core/app.js';

// Keep old system temporarily as fallback
import './scripts/geneafan/ui';

// Styles
import './scss/main.scss'

// Assets contexts
require.context('./other', true);
require.context('./images/icons', true);
require.context('./images', true);

// Initialize with new system, fallback to old if needed
document.addEventListener("DOMContentLoaded", async () => {
    console.log("Application initialization starting...");
    
    try {
        // Try new initialization system
        await initializeApplication();
        console.log("Application initialized successfully with new system");
    } catch (error) {
        console.error("Error with new initialization system, falling back to old system:", error);
        // Old system will take over through the ui import
    }
});