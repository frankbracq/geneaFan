class InfoWindowManager {
    constructor() {
        this.currentInfoWindow = null;
    }

    initialize() {
        if (this.currentInfoWindow) {
            this.currentInfoWindow.close();
            this.currentInfoWindow = null;
        }
    }

    showInfoWindow(marker, content, options = {}) {
        if (this.currentInfoWindow) {
            this.currentInfoWindow.close();
        }

        this.currentInfoWindow = new google.maps.InfoWindow({
            content,
            maxWidth: options.maxWidth || 300,
            ...options
        });

        const position = marker.position;
        this.currentInfoWindow.setPosition(position);

        this.currentInfoWindow.open({
            map: marker.map,
            shouldFocus: false
        });

        // Ajuster la position si le marqueur a un contenu personnalisé
        const offset = marker.content ? marker.content.offsetHeight || 0 : 0;
        this.currentInfoWindow.setOptions({
            pixelOffset: new google.maps.Size(0, -(offset / 2))
        });
    }
}

export const infoWindowManager = new InfoWindowManager();