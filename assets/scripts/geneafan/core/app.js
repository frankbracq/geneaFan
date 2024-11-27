import { setupCore } from './setup.js';
import { handleInitializationError } from './errorHandler.js';
import { initializeTabs, tabManager } from '../tabs/tabManager.js';
import { downloadManager } from '../common/downloads.js';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded fired.");
    await initializeApplication();
});

// Warn before unload
window.addEventListener('beforeunload', (e) => {
    console.log('Page is about to reload or close.');
});

/**
 * Main application initialization
 */
export async function initializeApplication() {
    // Set up global error handler
    window.onerror = handleInitializationError;
    
    try {
        // Core initialization (includes auth)
        await setupCore();
        
        // Initialize common functionality
        await initializeCommonFeatures();
        
        // Initialize tabs
        await initializeTabs();
        
        // Mark as ready and hide overlay
        window.isReady = true;
        hideLoadingOverlay();
        
        console.log("Application initialization completed.");
    } catch (error) {
        console.error("Failed to initialize application:", error);
        window.isReady = false;
        handleInitializationError(error.message);
    }
}

/**
 * Initialize common features used across tabs
 */
async function initializeCommonFeatures() {
    try {
        // Initialize download functionality
        downloadManager.setupDownloadHandlers();
        
        console.log("Common features initialized successfully.");
    } catch (error) {
        console.error("Error initializing common features:", error);
        throw error;
    }
}

/**
 * Hide the loading overlay
 */
function hideLoadingOverlay() {
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.style.display = 'none';
        console.log("Loading overlay hidden.");
    } else {
        console.error("Element with ID 'overlay' not found.");
    }
}