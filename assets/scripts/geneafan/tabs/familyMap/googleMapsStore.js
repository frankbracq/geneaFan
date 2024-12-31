import { Offcanvas } from "bootstrap";
import { mapStatisticsStore } from './mapStatisticsStore.js';
import { mapMarkerStore } from './mapMarkerStore.js';

class GoogleMapsStore {
    constructor() {
        this.map = null;
        this.currentYear = null;
        this.birthData = [];
        this.isTimelineActive = true;
        this.apiKey = "AIzaSyDu9Qz5YXRF6CTJ4vf-0s89BaVq_eh13YE";
        this.placesListOffcanvas = null;

        // Référence à l'offcanvas
        this.placesListOffcanvas = null;
        this.searchInput = null;
        this.departementSelect = null;

        // Propriétés pour l'historique
        this.history = [];
        this.redoStack = [];
        
        // Nous gardons seulement les couleurs des générations pour la génération des listes
        this.generationColors = {
            0: '#1e3a8a', // blue-900
            1: '#1e40af', // blue-800
            2: '#1d4ed8', // blue-700
            3: '#2563eb', // blue-600
            4: '#3b82f6', // blue-500
            5: '#60a5fa', // blue-400
            6: '#93c5fd', // blue-300
            7: '#bfdbfe', // blue-200
            8: '#dbeafe', // blue-100
            9: '#eff6ff'  // blue-50
        };
    }

    async initMap(elementId, options = {}) {
        if (this.map) return;
    
        try {
            const defaultOptions = {
                zoom: 6.2,
                center: { lat: 46.2276, lng: 2.2137 },
                styles: this.getMapStyle(),
                streetViewControl: false,
                zoomControl: true,
                zoomControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
                fullscreenControl: true,
                fullscreenControlOptions: { position: google.maps.ControlPosition.TOP_CENTER }
            };
    
            const mapElement = document.getElementById(elementId);
            if (!mapElement) {
                throw new Error(`Element with id ${elementId} not found`);
            }
    
            this.map = new google.maps.Map(mapElement, { ...defaultOptions, ...options });
            mapMarkerStore.initialize(this.map);
    
            this.#addMapControls();
            this.#setupMapListeners();
            this.#recordState();
    
            console.log('✅ Map and components initialized successfully');
            return this.map;
        } catch (error) {
            console.error('❌ Error initializing map:', error);
            throw error;
        }
    }

    // Méthode d'initialisation de la carte
    initializeMap() {
        if (!this.map) {
            console.error('Carte non disponible');
            return;
        }

        this.#addMapControls();
        this.#setupMapListeners();
        this.#recordState();
        
        console.log('✅ Map and components initialized successfully');
    }

    processHierarchy(hierarchy) {
        if (!hierarchy) {
            console.error('❌ Pas de hiérarchie disponible');
            return;
        }
    
        // Réinitialiser les données
        this.birthData = [];
        mapStatisticsStore.resetStatistics();
        mapMarkerStore.clearMarkers();
    
        const processNode = (node, depth = 0) => {
            if (!node) {
                console.warn(`⚠️ Nœud invalide au niveau ${depth}`);
                return;
            }
    
            mapStatisticsStore.processNodeStatistics(node);
            const birthInfo = node.stats?.demography?.birthInfo;
    
            if (birthInfo?.place?.coordinates?.latitude) {
                this.birthData.push({
                    id: node.id,
                    name: `${node.name} ${node.surname}`,
                    birthYear: node.birthYear,
                    generation: node.generation || 0,
                    sosa: node.sosa || 1,
                    location: {
                        lat: birthInfo.place.coordinates.latitude,
                        lng: birthInfo.place.coordinates.longitude,
                        name: node.fanBirthPlace,
                        departement: birthInfo.place.departement
                    }
                });
            }
    
            if (node.children && Array.isArray(node.children)) {
                node.children.forEach(child => processNode(child, depth + 1));
            }
        };
    
        processNode(hierarchy);
        mapStatisticsStore.displayStatistics();
        this.activateMapMarkers();
        this.centerMapOnMarkers();
    }

    activateMapMarkers() {
        if (!this.map) {
            console.log('Pas de carte disponible');
            return;
        }

        mapMarkerStore.updateMarkers(this.birthData, this.isTimelineActive, this.currentYear);
        this.centerMapOnMarkers();
    }

    clearCurrentMarkers() {
        mapMarkerStore.clearMarkers();
    }

    centerMapOnMarkers() {
        if (this.map && mapMarkerStore.hasActiveMarkers()) {
            const bounds = mapMarkerStore.getBounds();
            if (bounds) {
                this.map.fitBounds(bounds);
            }
        }
    }

    // Gestion de la liste des lieux
    initializePlacesList() {
        this.placesListOffcanvas = new Offcanvas(document.getElementById('placesListOffcanvas'));
        this.searchInput = document.getElementById('searchPlace');
        this.departementSelect = document.getElementById('departementFilter');
        this.setupPlacesListeners();
        this.updatePlacesList();
    }

    getUniquePlaces() {
        const places = new Map();
        this.birthData.forEach(birth => {
            const key = `${birth.location.lat}-${birth.location.lng}`;
            if (!places.has(key)) {
                places.set(key, {
                    name: birth.location.name,
                    departement: birth.location.departement,
                    position: {
                        lat: birth.location.lat,
                        lng: birth.location.lng
                    },
                    count: 1
                });
            } else {
                places.get(key).count++;
            }
        });
        return Array.from(places.values())
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    updatePlacesList(searchTerm = '', selectedDepartement = '') {
        const places = this.getUniquePlaces();
        const placesList = document.getElementById('placesList');
        const counter = document.getElementById('placesCounter');

        const filteredPlaces = places.filter(place => {
            const matchesSearch = place.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesDepartement = !selectedDepartement || place.departement === selectedDepartement;
            return matchesSearch && matchesDepartement;
        });

        const departements = [...new Set(places.map(p => p.departement))].sort();
        this.departementSelect.innerHTML = '<option value="">Tous les départements</option>' +
            departements.map(dept => `<option value="${dept}">${dept}</option>`).join('');

        placesList.innerHTML = filteredPlaces.map(place => `
            <button class="list-group-item list-group-item-action" 
                    data-lat="${place.position.lat}" 
                    data-lng="${place.position.lng}">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${place.name}</h6>
                        <small class="text-muted">${place.departement || ''}</small>
                    </div>
                    <span class="badge bg-primary rounded-pill">${place.count}</span>
                </div>
            </button>
        `).join('');

        counter.textContent = `${filteredPlaces.length} lieux sur ${places.length}`;
    }

    setupPlacesListeners() {
        this.searchInput.addEventListener('input', (e) => {
            this.updatePlacesList(
                e.target.value,
                this.departementSelect.value
            );
        });

        this.departementSelect.addEventListener('change', (e) => {
            this.updatePlacesList(
                this.searchInput.value,
                e.target.value
            );
        });

        document.getElementById('placesList').addEventListener('click', (e) => {
            const item = e.target.closest('.list-group-item');
            if (!item) return;

            const lat = parseFloat(item.dataset.lat);
            const lng = parseFloat(item.dataset.lng);
            this.centerMapOnPlace(lat, lng);
        });
    }

    centerMapOnPlace(lat, lng, zoom = 12) {
        this.map.setZoom(zoom);
        this.map.setCenter({ lat, lng });
    }

    // Méthodes utilitaires
    clearMap() {
        mapMarkerStore.clearMarkers();
        if (this.map) {
            this.map.setCenter({ lat: 46.2276, lng: 2.2137 });
            this.map.setZoom(6.2);
            google.maps.event.trigger(this.map, 'resize');
        }
    }

    moveMapToContainer(containerId) {
        const mapContainer = document.getElementById(containerId);
        if (!mapContainer || !this.map) return;

        const mapDiv = this.map.getDiv();
        if (mapContainer === mapDiv.parentNode) {
            return;
        }

        try {
            mapContainer.appendChild(mapDiv);
            google.maps.event.trigger(this.map, "resize");
        } catch (error) {
            console.error(`Failed to move map to container ${containerId}:`, error);
        }
    }

    // Gestion de l'historique
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

    #applyState(state) {
        this.map.setZoom(state.zoom);
        this.map.setCenter(state.center);
    }

    // Style de la carte
    getMapStyle() {
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