// La classe gère principalement :
    // - l'affichage/masquage des fenêtres d'info
    // - le rendu du contenu
    // - le positionnement à l'écran

class InfoWindowDisplayManager {
    constructor() {
        this.currentInfoWindow = null;
    }

    initialize() {
        if (this.currentInfoWindow) {
            this.currentInfoWindow.close();
            this.currentInfoWindow = null;
        }
    }

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

        const offset = marker.content ? marker.content.offsetHeight || 0 : 0;
        this.currentInfoWindow.setOptions({
            pixelOffset: new google.maps.Size(0, -(offset / 2))
        });
    }
}

export const infoWindowDisplayManager = new InfoWindowDisplayManager();