// stores/core/RootStore.js
import { makeAutoObservable } from 'mobx';
import ViewStore from './ViewStore';
import DataStore from './DataStore';
import FanConfigStore from './FanConfigStore';
import ConfigurationStore from './ConfigurationStore';
import ShareFormStore from './ShareFormStore';
import AuthStore from './AuthStore';  

/**
 * Root store that orchestrates all other stores
 * Provides a central point of access to all application state
 */
class RootStore {
    constructor() {
        this.viewStore = new ViewStore(this);
        this.dataStore = new DataStore(this);
        this.fanConfigStore = new FanConfigStore(this);
        this.configurationStore = new ConfigurationStore(this);
        this.shareFormStore = new ShareFormStore(this);
        this.authStore = new AuthStore(this);  // S'assurer que c'est inclus
        makeAutoObservable(this);
    }

    /**
     * Clean up all stores
     * Should be called when resetting the application state
     */
    cleanup() {
        this.viewStore.cleanup();
        this.dataStore.cleanup();
        this.fanConfigStore.resetConfigHistory();
    }
}

// Create and export a single instance of the root store
const rootStore = new RootStore();
export default rootStore;

// Export individual stores for easier access
export const {
    viewStore,
    dataStore,
    fanConfigStore,
    authStore,
    configurationStore
} = rootStore;