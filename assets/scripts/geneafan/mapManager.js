import { getFamilyTowns, gmapStyle, gmapApiKey } from "./stores/state.js";
import { Loader } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer"; 


export const googleMapManager = {
    map: null,
    allMarkers: {},  // Contient tous les marqueurs
    activeMarkers: {},  // Marqueurs actuellement affichés sur la carte
    markerCluster: null,
    history: [], // Historique des états de la carte
    redoStack: [], // Pile pour les opérations de rétablissement

    initMapIfNeeded: function () {
        const mapElement = document.getElementById("familyMap");

        if (!this.map && mapElement) {
            const loader = new Loader({
                apiKey: gmapApiKey,
                version: "weekly",
                libraries: []
            });

            loader.load().then(() => {
                this.map = new google.maps.Map(mapElement, {
                    zoom: 6.2,
                    center: { lat: 46.2276, lng: 2.2137 },
                    styles: gmapStyle,
                    streetViewControl: false,
                    zoomControl: true,
                    zoomControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
                    fullscreenControl: true,
                    fullscreenControlOptions: {
                        position: google.maps.ControlPosition.TOP_CENTER,
                    },
                });

                // Add initial state to history
                this.history.push({
                    zoom: this.map.getZoom(),
                    center: this.map.getCenter().toJSON()
                });

                this.addResetButton();
                this.addUndoRedoButtons();

                // Initialize the marker clusterer
                this.markerCluster = new MarkerClusterer({ map: this.map });

                this.map.addListener('zoom_changed', () => {
                    this.recordState();
                });

                this.map.addListener('center_changed', () => {
                    this.recordState();
                });
            });
        }
    },

    addResetButton: function() {
        const controlDiv = document.createElement('div');
        controlDiv.style.margin = '10px';

        const controlUI = document.createElement('button');
        controlUI.style.backgroundColor = '#fff';
        controlUI.style.border = '2px solid #fff';
        controlUI.style.borderRadius = '3px';
        controlUI.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
        controlUI.style.cursor = 'pointer';
        controlUI.style.marginRight = '22px';
        controlUI.style.textAlign = 'center';
        controlUI.title = 'Click to reset the map';
        controlUI.innerText = 'Reset Map';

        controlDiv.appendChild(controlUI);

        controlUI.addEventListener('click', () => {
            this.clearMap();
        });

        this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
    },

    addUndoRedoButtons: function() {
        const undoButton = document.createElement('button');
        undoButton.style.backgroundColor = '#fff';
        undoButton.style.border = '2px solid #fff';
        undoButton.style.borderRadius = '3px';
        undoButton.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
        undoButton.style.cursor = 'pointer';
        undoButton.style.marginRight = '5px';
        undoButton.style.textAlign = 'center';
        undoButton.title = 'Click to undo the last action';
        undoButton.innerText = 'Undo';

        undoButton.addEventListener('click', () => {
            this.undo();
        });

        const redoButton = document.createElement('button');
        redoButton.style.backgroundColor = '#fff';
        redoButton.style.border = '2px solid #fff';
        redoButton.style.borderRadius = '3px';
        redoButton.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
        redoButton.style.cursor = 'pointer';
        redoButton.style.marginRight = '22px';
        redoButton.style.textAlign = 'center';
        redoButton.title = 'Click to redo the last undone action';
        redoButton.innerText = 'Redo';

        redoButton.addEventListener('click', () => {
            this.redo();
        });

        const controlDiv = document.createElement('div');
        controlDiv.style.margin = '10px';
        controlDiv.appendChild(undoButton);
        controlDiv.appendChild(redoButton);

        this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
    },

    recordState: function() {
        const currentState = {
            zoom: this.map.getZoom(),
            center: this.map.getCenter().toJSON()
        };

        // Check if the last state is different from the current state
        const lastState = this.history[this.history.length - 1];
        if (!lastState || lastState.zoom !== currentState.zoom || lastState.center.lat !== currentState.center.lat || lastState.center.lng !== currentState.center.lng) {
            this.history.push(currentState);
            this.redoStack = [];
        }
    },

    undo: function() {
        if (this.history.length > 1) {
            const lastState = this.history.pop();
            this.redoStack.push(lastState);

            const previousState = this.history[this.history.length - 1];
            this.map.setZoom(previousState.zoom);
            this.map.setCenter(previousState.center);
        }
    },

    redo: function() {
        if (this.redoStack.length > 0) {
            const stateToRestore = this.redoStack.pop();
            this.history.push(stateToRestore);

            this.map.setZoom(stateToRestore.zoom);
            this.map.setCenter(stateToRestore.center);
        }
    },

    isValidCoordinate: function (coordinate) {
        const numberCoordinate = Number(coordinate);
        return !(
            isNaN(numberCoordinate) ||
            numberCoordinate.toString().trim() === ""
        );
    },

    loadMarkersData: function() {
        const familyTowns = getFamilyTowns();
        Object.entries(familyTowns).forEach(([key, town]) => {
            if (this.isValidCoordinate(town.latitude) && this.isValidCoordinate(town.longitude)) {
                this.addMarker(key, town);
            }
        });
        // console.log("Markers loaded:", this.allMarkers); // Vérifie que les marqueurs sont bien ajoutés
    },

    activateMapMarkers: function (individualTownKeys = null) {
        if (!this.map) this.initMapIfNeeded();

        Object.entries(this.allMarkers).forEach(([townKey, marker]) => {
            if (individualTownKeys === null || individualTownKeys.includes(townKey)) {
                this.activeMarkers[townKey] = marker;
                marker.setMap(this.map);
            } else {
                marker.setMap(null);
            }
        });

        this.markerCluster.clearMarkers();
        this.markerCluster.addMarkers(Object.values(this.activeMarkers));

        this.centerMapOnMarkers();
    },

    clearMarkers: function() {
        Object.values(this.activeMarkers).forEach((marker) => marker.setMap(null));
        this.activeMarkers = {};
        this.allMarkers = {}; // Réinitialise allMarkers ici
        if (this.markerCluster) {
            this.markerCluster.clearMarkers();
            console.log("markerCluster cleared");
        }
    },

    addMarker: function (townKey, town) {
        const latitude = parseFloat(town.latitude);
        const longitude = parseFloat(town.longitude);

        const marker = new google.maps.Marker({
            position: { lat: latitude, lng: longitude },
            title: `${town.townDisplay || town.town || "Unknown"}, ${town.country || "Unknown"}`,
        });

        google.maps.event.addListener(marker, 'click', () => {
            this.map.setZoom(9);
            this.map.setCenter(marker.getPosition());
        });

        this.allMarkers[townKey] = marker;
        marker.location = town;
    },

    moveMapToContainer: function (containerId) {
        const mapContainer = document.getElementById(containerId);
        const mapDiv = this.map.getDiv();

        if (mapContainer && this.map && mapContainer !== mapDiv.parentNode) {
            mapContainer.appendChild(mapDiv);
            google.maps.event.trigger(this.map, "resize");
        }
    },

    clearMap: function() {
        console.log("clearMap");
        if (this.map) {
            this.clearMarkers(); // Efface tous les marqueurs
            console.log("All markers after reset:", this.allMarkers); // Vérifie que allMarkers est bien vidé
            this.map.setCenter({ lat: 46.2276, lng: 2.2137 }); // Centre sur la France
            this.map.setZoom(6.2); // Réinitialise le zoom
            google.maps.event.trigger(this.map, 'resize');
        }
    },

    centerMapOnMarkers: function() {
        if (this.map && Object.keys(this.activeMarkers).length > 0) {
            const bounds = new google.maps.LatLngBounds();
            Object.values(this.activeMarkers).forEach(marker => {
                bounds.extend(marker.getPosition());
            });
            this.map.fitBounds(bounds);
        }
    },
};
