// Import new initialization system
import { initializeApplication } from './scripts/geneafan/core/app.js';

// Styles
import './scss/main.scss'

// Assets contexts
require.context('./other', true);
require.context('./images/icons', true);
require.context('./images', true);

/**
 * Configure l'environnement de l'application, notamment pour gérer le cas
 * où l'application est servie via un proxy reverse
 */
function setupAppEnvironment() {
    // Configuration globale de l'application
    window.APP_CONFIG = window.APP_CONFIG || {};
    
    // Détection automatique si nous sommes servis via proxy
    const currentOrigin = window.location.origin;
    const currentPath = window.location.pathname;
    
    // Déterminer si nous sommes sur familystory.live ou un autre proxy
    const isOnProxyDomain = currentOrigin.includes('familystory.live') || 
                           (currentPath.includes('/genalogie.app/') && !currentPath.startsWith('/genealogie.app/'));
    
    // Trouver le chemin de base de l'application
    let basePath = '/';
    
    if (isOnProxyDomain) {
        // Nous sommes sur un proxy, ajuster les chemins
        const pathSegments = currentPath.split('/');
        const appIndex = pathSegments.findIndex(segment => segment === 'app');
        
        if (appIndex >= 0) {
            // Construire le chemin de base jusqu'à 'app'
            basePath = pathSegments.slice(0, appIndex + 1).join('/') + '/';
        }
        
        console.log(`Application détectée comme servie via proxy sur ${currentOrigin}`);
        console.log(`Chemin de base configuré: ${basePath}`);
    } else {
        console.log('Application détectée comme servie directement (sans proxy)');
    }
    
    // Stocker la configuration
    window.APP_CONFIG.isProxied = isOnProxyDomain;
    window.APP_CONFIG.basePath = basePath;
    window.APP_CONFIG.origin = currentOrigin;
    
    // Patch global pour améliorer la compatibilité des URL en environnement proxifié
    if (isOnProxyDomain) {
        // Monkey patch pour URL et Worker si nécessaire
        const originalURL = window.URL;
        const originalWorker = window.Worker;
        
        // Helper pour ajuster les chemins relatifs pour les Workers
        window.createWorkerWithFallback = function(relativePath, options) {
            try {
                return new originalWorker(relativePath, options);
            } catch (e) {
                console.warn("Fallback pour Worker avec chemin relatif:", e);
                // Essayer avec un chemin corrigé basé sur APP_CONFIG
                const correctedPath = `${window.APP_CONFIG.basePath}${relativePath.replace(/^\.\.\//g, '')}`;
                console.log("Tentative avec chemin corrigé:", correctedPath);
                return new originalWorker(correctedPath, options);
            }
        };
    }
    
    return window.APP_CONFIG;
}

// Initialize with new system, fallback to old if needed
document.addEventListener("DOMContentLoaded", async () => {
    console.log("Application initialization starting...");
    
    // Configurer l'environnement avant initialisation
    const appConfig = setupAppEnvironment();
    console.log("Environnement configuré:", appConfig);
    
    try {
        // Try new initialization system
        await initializeApplication();
        console.log("Application initialized successfully with new system");
    } catch (error) {
        console.error("Error with new initialization system, falling back to old system:", error);
    }
});