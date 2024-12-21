import { setupCore } from './setup.js';
import { handleInitializationError } from './errorHandler.js';

export async function initializeApplication() {
    // Set up global error handler
    window.onerror = handleInitializationError;
    
    try {
        // Core initialization
        await setupCore();
        
        // Mark as ready and hide overlay
        window.isReady = true;
        hideLoadingOverlay();
        
    } catch (error) {
        console.error("Failed to initialize application:", error);
        window.isReady = false;
        handleInitializationError(error.message);
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.style.display = 'none';
        console.log("Loading overlay hidden.");
    }
}