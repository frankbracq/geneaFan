// stores/core/ConfigurationStore.js
import { makeAutoObservable } from 'mobx';

/**
 * Manages global application configuration and constants
 */
class ConfigurationStore {
    // API Keys
    gmapApiKey = process.env.GMAP_API_KEY || '';
    clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY || '';

    // Other global configurations can be added here
    config = {
        apiEndpoints: {
            fileSharingOrchestrator: 'https://file-sharing-orchestrator.genealogie.app'
        },
        defaultMapCenter: {
            lat: 46.2276,
            lng: 2.2137
        }
    };

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
    }

    /**
     * Get an API key by name
     * @param {string} keyName - The name of the API key
     * @returns {string} The API key value
     */
    getApiKey(keyName) {
        switch (keyName) {
            case 'gmap':
                return this.gmapApiKey;
            case 'clerk':
                return this.clerkPublishableKey;
            default:
                console.warn(`Unknown API key requested: ${keyName}`);
                return '';
        }
    }

    /**
     * Get a configuration value by path
     * @param {string} path - Dot-notation path to the config value
     * @returns {any} The configuration value
     */
    getConfig(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.config);
    }
}

export default ConfigurationStore;