/**
 * Manages the display of info windows on the map
 * Main responsibilities:
 * - Show/hide info windows
 * - Content rendering
 * - Screen positioning
 */
class InfoWindowDisplayManager {
    constructor() {
        // Current active info window
        this.currentInfoWindow = null;
    }

    /**
     * Initialize or reset the info window manager
     */
    initialize() {
        if (this.currentInfoWindow) {
            this.currentInfoWindow.close();
            this.currentInfoWindow = null;
        }
    }

    /**
     * Creates the content for an info window
     * @param {string} title - Title to display
     * @param {Array} details - Array of {label, value} objects for content
     * @returns {HTMLElement} Formatted content div
     */
    createInfoWindowContent(title, details = []) {
        const div = document.createElement('div');
        div.className = 'info-window-content';

        const titleElement = document.createElement('h3');
        titleElement.textContent = title;
        titleElement.className = 'font-bold text-lg mb-2';
        div.appendChild(titleElement);

        details.forEach(({ label, value }) => {
            if (value) {
                const detailElement = document.createElement('p');
                detailElement.textContent = `${label}: ${value}`;
                detailElement.className = 'text-sm text-gray-600';
                div.appendChild(detailElement);
            }
        });

        return div;
    }

    /**
     * Shows an info window for a marker
     * @param {google.maps.Marker} marker - Target marker
     * @param {HTMLElement} content - Content to display
     * @param {Object} options - Additional options for the info window
     */
    showInfoWindow(marker, content, options = {}) {
        // Close any existing info window
        if (this.currentInfoWindow) {
            this.currentInfoWindow.close();
        }

        // Create new info window with content
        this.currentInfoWindow = new google.maps.InfoWindow({
            content,
            maxWidth: options.maxWidth || 300,
            ...options
        });

        // Set position based on marker
        const position = marker.position;
        this.currentInfoWindow.setPosition(position);

        // Open the info window
        this.currentInfoWindow.open({
            map: marker.map,
            shouldFocus: false
        });

        // Adjust position based on marker content height
        const offset = marker.content ? marker.content.offsetHeight || 0 : 0;
        this.currentInfoWindow.setOptions({
            pixelOffset: new google.maps.Size(0, -(offset / 2))
        });
    }
}

// Export a singleton instance
export const infoWindowDisplayManager = new InfoWindowDisplayManager();