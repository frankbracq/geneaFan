import { setupCore } from './setup.js';
import { handleInitializationError } from './errorHandler.js';
import overlayManager from '../utils/OverlayManager.js';

export async function initializeApplication() {
    // Set up global error handler
    window.onerror = handleInitializationError;
    
    try {
        // Utiliser le gestionnaire d'overlay pour afficher l'overlay global
        overlayManager.showGlobal('Initialisation de l\'application...');
        
        // Core initialization
        await setupCore();
        
        // Mark as ready and hide overlay
        window.isReady = true;
        overlayManager.hideGlobal();
        
    } catch (error) {
        console.error("Failed to initialize application:", error);
        window.isReady = false;
        handleInitializationError(error.message);
    }
}