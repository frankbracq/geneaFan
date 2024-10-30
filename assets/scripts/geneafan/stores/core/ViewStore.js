// stores/core/ViewStore.js
import { makeAutoObservable } from 'mobx';

/**
 * Manages UI-related state and instances
 */
class ViewStore {
    svgPanZoomInstance = null;
    tomSelectInstance = null;
    isLoading = false;
    
    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
    }

    /**
     * Set the global loading state
     * @param {boolean} value - The loading state
     */
    setLoading(value) {
        this.isLoading = value;
    }

    /**
     * Set the SVG Pan Zoom instance, cleaning up the previous one if it exists
     * @param {Object} instance - The SVG Pan Zoom instance
     */
    setSvgPanZoomInstance(instance) {
        if (this.svgPanZoomInstance) {
            this.svgPanZoomInstance.destroy();
        }
        this.svgPanZoomInstance = instance;
    }

    /**
     * Set the TomSelect instance, cleaning up the previous one if it exists
     * @param {Object} instance - The TomSelect instance
     */
    setTomSelectInstance(instance) {
        if (this.tomSelectInstance) {
            this.tomSelectInstance.destroy();
        }
        this.tomSelectInstance = instance;
    }

    /**
     * Clean up all UI-related instances
     */
    cleanup() {
        if (this.svgPanZoomInstance) {
            this.svgPanZoomInstance.destroy();
            this.svgPanZoomInstance = null;
        }
        if (this.tomSelectInstance) {
            this.tomSelectInstance.destroy();
            this.tomSelectInstance = null;
        }
    }
}

export default ViewStore;