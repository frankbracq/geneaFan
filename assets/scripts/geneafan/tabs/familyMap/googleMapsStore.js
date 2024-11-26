import { Loader } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";

class GoogleMapsStore {
    constructor() {
        this.map = null;
        this.allMarkers = {};
        this.activeMarkers = {};
        this.markerCluster = null;
        this.history = [];
        this.redoStack = [];
        this.apiKey = "AIzaSyDu9Qz5YXRF6CTJ4vf-0s89BaVq_eh13YE";
    }

    // Public Methods
    async initMap(elementId, options = {}) {
        if (this.map) return;

        try {
            const loader = new Loader({
                apiKey: this.apiKey,
                version: "weekly",
                libraries: []
            });

            await loader.load();

            const defaultOptions = {
                zoom: 6.2,
                center: { lat: 46.2276, lng: 2.2137 },
                styles: this.#getMapStyle(),
                streetViewControl: false,
                zoomControl: true,
                zoomControlOptions: { 
                    position: google.maps.ControlPosition.TOP_RIGHT 
                },
                fullscreenControl: true,
                fullscreenControlOptions: {
                    position: google.maps.ControlPosition.TOP_CENTER,
                }
            };

            const mapElement = document.getElementById(elementId);
            this.map = new google.maps.Map(mapElement, { ...defaultOptions, ...options });
            this.markerCluster = new MarkerClusterer({ map: this.map });
            
            this.#addMapControls();
            this.#setupMapListeners();
            this.#recordState();
        } catch (error) {
            console.error("Error initializing Google Maps:", error);
        }
    }

    moveMapToContainer(containerId) {
        const mapContainer = document.getElementById(containerId);
        if (mapContainer && this.map) {
            const mapDiv = this.map.getDiv();
            if (mapContainer !== mapDiv.parentNode) {
                mapContainer.appendChild(mapDiv);
                google.maps.event.trigger(this.map, "resize");
            }
        }
    }

    addMarker(key, town) {
        const latitude = parseFloat(town.latitude);
        const longitude = parseFloat(town.longitude);

        if (this.isValidCoordinate(latitude) && this.isValidCoordinate(longitude)) {
            const marker = new google.maps.Marker({
                position: { lat: latitude, lng: longitude },
                title: `${town.townDisplay || town.town || "Unknown"}, ${town.country || "Unknown"}`,
            });

            marker.addListener('click', () => {
                this.map.setZoom(9);
                this.map.setCenter(marker.getPosition());
            });

            this.allMarkers[key] = marker;
            marker.location = town;
        }
    }

    activateMapMarkers(individualTownKeys = null) {
        if (!this.map) return;

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
    }

    clearMap() {
        this.clearMarkers();
        if (this.map) {
            this.map.setCenter({ lat: 46.2276, lng: 2.2137 });
            this.map.setZoom(6.2);
            google.maps.event.trigger(this.map, 'resize');
        }
    }

    clearMarkers() {
        Object.values(this.activeMarkers).forEach(marker => marker.setMap(null));
        this.activeMarkers = {};
        this.allMarkers = {};
        if (this.markerCluster) {
            this.markerCluster.clearMarkers();
        }
    }

    isValidCoordinate(coordinate) {
        const num = Number(coordinate);
        return !isNaN(num) && num.toString().trim() !== "";
    }

    centerMapOnMarkers() {
        if (this.map && Object.keys(this.activeMarkers).length > 0) {
            const bounds = new google.maps.LatLngBounds();
            Object.values(this.activeMarkers).forEach(marker => {
                bounds.extend(marker.getPosition());
            });
            this.map.fitBounds(bounds);
        }
    }

    undo() {
        if (this.history.length > 1) {
            const lastState = this.history.pop();
            this.redoStack.push(lastState);
            const previousState = this.history[this.history.length - 1];
            this.#applyState(previousState);
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            const stateToRestore = this.redoStack.pop();
            this.history.push(stateToRestore);
            this.#applyState(stateToRestore);
        }
    }

    // Private Methods
    #setupMapListeners() {
        this.map.addListener('zoom_changed', () => this.#recordState());
        this.map.addListener('center_changed', () => this.#recordState());
    }

    #recordState() {
        const currentState = {
            zoom: this.map.getZoom(),
            center: this.map.getCenter().toJSON()
        };

        const lastState = this.history[this.history.length - 1];
        if (!this.#isSameState(lastState, currentState)) {
            this.history.push(currentState);
            this.redoStack = [];
        }
    }

    #isSameState(state1, state2) {
        if (!state1) return false;
        return state1.zoom === state2.zoom && 
               state1.center.lat === state2.center.lat && 
               state1.center.lng === state2.center.lng;
    }

    #addMapControls() {
        this.#addResetControl();
        this.#addUndoRedoControls();
    }

    #addResetControl() {
        const controlDiv = document.createElement('div');
        controlDiv.style.margin = '10px';

        const button = document.createElement('button');
        this.#styleControlButton(button);
        button.title = 'Reset map';
        button.innerText = 'Reset Map';
        button.addEventListener('click', () => this.clearMap());

        controlDiv.appendChild(button);
        this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
    }

    #addUndoRedoControls() {
        const controlDiv = document.createElement('div');
        controlDiv.style.margin = '10px';

        const undoButton = document.createElement('button');
        this.#styleControlButton(undoButton);
        undoButton.title = 'Undo';
        undoButton.innerText = 'Undo';
        undoButton.addEventListener('click', () => this.undo());

        const redoButton = document.createElement('button');
        this.#styleControlButton(redoButton);
        redoButton.title = 'Redo';
        redoButton.innerText = 'Redo';
        redoButton.addEventListener('click', () => this.redo());

        controlDiv.appendChild(undoButton);
        controlDiv.appendChild(redoButton);
        this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
    }

    #styleControlButton(button) {
        Object.assign(button.style, {
            backgroundColor: '#fff',
            border: '2px solid #fff',
            borderRadius: '3px',
            boxShadow: '0 2px 6px rgba(0,0,0,.3)',
            cursor: 'pointer',
            marginRight: '5px',
            textAlign: 'center'
        });
    }

    #applyState(state) {
        this.map.setZoom(state.zoom);
        this.map.setCenter(state.center);
    }

    #getMapStyle() {
        return [
            {
                "featureType": "all",
                "elementType": "labels",
                "stylers": [
                    {
                        "visibility": "off"
                    },
                    {
                        "color": "#f49f53"
                    }
                ]
            },
            {
                "featureType": "all",
                "elementType": "labels.text",
                "stylers": [
                    {
                        "visibility": "simplified"
                    }
                ]
            },
            {
                "featureType": "landscape",
                "elementType": "all",
                "stylers": [
                    {
                        "color": "#f9ddc5"
                    },
                    {
                        "lightness": -7
                    }
                ]
            },
            {
                "featureType": "poi.business",
                "elementType": "all",
                "stylers": [
                    {
                        "color": "#645c20"
                    },
                    {
                        "lightness": 38
                    }
                ]
            },
            {
                "featureType": "poi.government",
                "elementType": "all",
                "stylers": [
                    {
                        "color": "#9e5916"
                    },
                    {
                        "lightness": 46
                    }
                ]
            },
            {
                "featureType": "poi.medical",
                "elementType": "geometry.fill",
                "stylers": [
                    {
                        "color": "#813033"
                    },
                    {
                        "lightness": 38
                    },
                    {
                        "visibility": "off"
                    }
                ]
            },
            {
                "featureType": "poi.park",
                "elementType": "all",
                "stylers": [
                    {
                        "color": "#645c20"
                    },
                    {
                        "lightness": 39
                    }
                ]
            },
            {
                "featureType": "poi.school",
                "elementType": "all",
                "stylers": [
                    {
                        "color": "#a95521"
                    },
                    {
                        "lightness": 35
                    }
                ]
            },
            {
                "featureType": "poi.sports_complex",
                "elementType": "all",
                "stylers": [
                    {
                        "color": "#9e5916"
                    },
                    {
                        "lightness": 32
                    }
                ]
            },
            {
                "featureType": "road",
                "elementType": "all",
                "stylers": [
                    {
                        "color": "#813033"
                    },
                    {
                        "lightness": 43
                    }
                ]
            },
            {
                "featureType": "road.local",
                "elementType": "geometry.fill",
                "stylers": [
                    {
                        "color": "#f19f53"
                    },
                    {
                        "weight": 1.3
                    },
                    {
                        "visibility": "on"
                    },
                    {
                        "lightness": 16
                    }
                ]
            },
            {
                "featureType": "road.local",
                "elementType": "geometry.stroke",
                "stylers": [
                    {
                        "color": "#f19f53"
                    },
                    {
                        "lightness": -10
                    }
                ]
            },
            {
                "featureType": "transit",
                "elementType": "all",
                "stylers": [
                    {
                        "lightness": 38
                    }
                ]
            },
            {
                "featureType": "transit.line",
                "elementType": "all",
                "stylers": [
                    {
                        "color": "#813033"
                    },
                    {
                        "lightness": 22
                    }
                ]
            },
            {
                "featureType": "transit.station",
                "elementType": "all",
                "stylers": [
                    {
                        "visibility": "off"
                    }
                ]
            },
            {
                "featureType": "water",
                "elementType": "all",
                "stylers": [
                    {
                        "color": "#1994bf"
                    },
                    {
                        "saturation": -69
                    },
                    {
                        "gamma": 0.99
                    },
                    {
                        "lightness": 43
                    }
                ]
            }
        ];
    }
}

export const googleMapsStore = new GoogleMapsStore();