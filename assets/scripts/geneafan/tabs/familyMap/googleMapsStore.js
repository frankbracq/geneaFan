import { makeObservable, observable, action } from '../../common/stores/mobx-config.js';
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
        
        // Configuration Maps
        this.MAP_ID = 'e998be704b1911eb';

        // Propriétés pour la mini-carte
        this.overviewMapVisible = false;
        this.ZOOM_THRESHOLD = 10;
        this.STATIC_MAP_SIZE = 200;

        // Initialisation de l'historique
        this.history = [];
        this.redoStack = [];

        makeObservable(this, {
            map: observable,
            currentYear: observable,
            birthData: observable,
            isTimelineActive: observable,
            overviewMapVisible: observable,
            processHierarchy: action,
            clearMap: action,
            activateMapMarkers: action
        });
    }

    async initMap(elementId, options = {}) {
        if (this.map) return this.map;

        try {
            console.group('🗺️ Initialisation des cartes');
            
            const mapElement = document.getElementById(elementId);
            if (!mapElement) {
                throw new Error(`Element with id ${elementId} not found`);
            }

            // Configuration de base de la carte avec le mapId
            const defaultOptions = {
                mapId: this.MAP_ID,
                zoom: 6.2,
                center: { lat: 46.2276, lng: 2.2137 },
                streetViewControl: false,
                zoomControl: true,
                zoomControlOptions: {
                    position: google.maps.ControlPosition.TOP_RIGHT
                },
                fullscreenControl: true,
                fullscreenControlOptions: {
                    position: google.maps.ControlPosition.TOP_CENTER
                }
            };

            // Initialisation de la carte principale
            this.map = new google.maps.Map(mapElement, {
                ...defaultOptions,
                ...options
            });

            console.log('🗺️ Carte principale initialisée');

            // Initialisation de la mini-carte avec le même style
            await this.#initializeOverviewMap();

            this.#addMapControls();
            this.#setupMapListeners();
            this.#recordState();

            console.log('✅ Initialisation complète réussie');
            console.groupEnd();
            return this.map;

        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
            console.groupEnd();
            throw error;
        }
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
        if (!this.map) return;

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

    // Gestion de la mini-carte
    async #initializeOverviewMap() {
        console.log('📍 Initialisation de la mini-carte');
    
        const mapContainer = this.map.getDiv().parentElement;
        
        // On ajoute d'abord un conteneur wrapper pour le positionnement
        const wrapper = document.createElement('div');
        wrapper.id = 'overview-map-wrapper';
        wrapper.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
        `;
        mapContainer.appendChild(wrapper);
    
        // Puis le conteneur de la mini-carte
        const container = document.createElement('div');
        container.id = 'overview-map-container';
        container.style.cssText = `
            position: absolute;
            bottom: 24px;
            right: 24px;
            width: 200px;
            height: 200px;
            background-color: #fff;
            border: 2px solid rgba(0, 0, 0, 0.3);
            border-radius: 4px;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            overflow: hidden;
        `;
        wrapper.appendChild(container);
    
        // Image de la carte statique
        const staticMap = document.createElement('img');
        staticMap.id = 'overview-static-map';
        staticMap.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
        `;
        container.appendChild(staticMap);
    
        // Indicateur de la zone visible
        const viewport = document.createElement('div');
        viewport.id = 'overview-viewport';
        viewport.style.cssText = `
            position: absolute;
            border: 2px solid #FF0000;
            background-color: rgba(255, 0, 0, 0.1);
            pointer-events: none;
            transition: all 0.3s ease;
        `;
        container.appendChild(viewport);
    
        // Délai de debounce pour les mises à jour
        let updateTimeout = null;
    
        const updateOverview = () => {
            if (!this.overviewMapVisible) return;
    
            if (updateTimeout) {
                clearTimeout(updateTimeout);
            }
    
            updateTimeout = setTimeout(() => {
                const bounds = this.map.getBounds();
                const center = this.map.getCenter();
                if (!bounds || !center) return;
    
                // Mise à jour de l'image statique
                staticMap.src = `https://maps.googleapis.com/maps/api/staticmap`
                    + `?center=${center.lat()},${center.lng()}`
                    + `&zoom=4`
                    + `&size=200x200`
                    + `&key=${this.apiKey}`
                    + `&map_id=${this.MAP_ID}`;
    
                // Mise à jour du viewport
                const ne = bounds.getNorthEast();
                const sw = bounds.getSouthWest();
                const staticMapSpan = {
                    lat: 360 / Math.pow(2, 4),
                    lng: 360 / Math.pow(2, 4)
                };
                
                const mapSpan = {
                    lat: Math.abs(ne.lat() - sw.lat()),
                    lng: Math.abs(ne.lng() - sw.lng())
                };
                
                const pixelSpan = {
                    lat: mapSpan.lat / staticMapSpan.lat * 200,
                    lng: mapSpan.lng / staticMapSpan.lng * 200
                };
    
                viewport.style.width = `${pixelSpan.lng}px`;
                viewport.style.height = `${pixelSpan.lat}px`;
                viewport.style.left = `${100 - pixelSpan.lng / 2}px`;
                viewport.style.top = `${100 - pixelSpan.lat / 2}px`;
            }, 300); // 300ms de debounce
        };
    
        // Configuration des listeners
        this.map.addListener('zoom_changed', () => {
            const zoom = this.map.getZoom();
            console.log('🔍 Zoom actuel:', zoom);
            
            if (zoom >= this.ZOOM_THRESHOLD) {
                if (!this.overviewMapVisible) {
                    console.log('📍 Affichage de la mini-carte');
                    container.style.opacity = '1';
                    this.overviewMapVisible = true;
                    updateOverview();
                }
            } else {
                if (this.overviewMapVisible) {
                    console.log('📍 Masquage de la mini-carte');
                    container.style.opacity = '0';
                    this.overviewMapVisible = false;
                }
            }
        });
    
        ['bounds_changed', 'center_changed'].forEach(event => {
            this.map.addListener(event, () => {
                if (this.overviewMapVisible) {
                    updateOverview();
                }
            });
        });
    
        // Vérification initiale
        const initialZoom = this.map.getZoom();
        if (initialZoom >= this.ZOOM_THRESHOLD) {
            container.style.opacity = '1';
            this.overviewMapVisible = true;
            updateOverview();
        }
    
        console.log('✅ Mini-carte statique initialisée');
    }
}

export const googleMapsStore = new GoogleMapsStore();