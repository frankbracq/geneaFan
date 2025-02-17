import { Offcanvas } from "bootstrap";
import { makeObservable, observable, action, runInAction } from '../../../common/stores/mobx-config.js';
import { Loader } from "@googlemaps/js-api-loader";
import { mapStatisticsStore } from '../mapStatisticsStore.js';
import { rootAncestorTownsStore } from './rootAncestorTownsStore.js';
import { storeEvents, EVENTS } from '../../../gedcom/stores/storeEvents.js';

class GoogleMapsStore {
    constructor() {
        this.map = null;
        this.isApiLoaded = false;
        this.apiLoadPromise = null;
        this.isTimelineActive = true;

        // Deux clés API distinctes
        this.mapsApiKey = "AIzaSyDu9Qz5YXRF6CTJ4vf-0s89BaVq_eh13YE";  // Pour la carte principale
        this.staticApiKey = "AIzaSyBRVXqhnDSF5B6JhiAGkWmBDJ11dBok-zg";    // Pour la carte statique

        // Configuration Maps
        this.MAP_ID = 'e998be704b1911eb';

        // Propriétés pour la mini-carte
        this.overviewMapVisible = false;
        this.ZOOM_THRESHOLD = 9;
        this.STATIC_MAP_SIZE = 200;

        // Initialisation explicite de l'historique
        this.history = [];
        this.redoStack = [];

        // État des calques avec valeurs par défaut
        this.layerStates = observable({
            ancestors: true,    // Calque des ancêtres activé par défaut
            family: false,      // Calque des villes familiales désactivé par défaut
            surnames: false     // Calque des patronymes désactivé par défaut
        });

        makeObservable(this, {
            map: observable,
            isTimelineActive: observable,
            overviewMapVisible: observable,
            isApiLoaded: observable,
            layerStates: observable,
            
            // Actions existantes
            initializeApi: action,
            initMap: action,
            centerMapOnMarkers: action,
            setLayerState: action
        });

        // Charger l'état sauvegardé des calques
        this.loadLayerStates();
    }

    async initializeApi() {
        if (this.isApiLoaded) {
            return Promise.resolve();
        }

        if (this.apiLoadPromise) {
            return this.apiLoadPromise;
        }

        console.group('🚀 Initialisation de l\'API Google Maps');
        
        const loader = new Loader({
            apiKey: this.mapsApiKey,
            version: "weekly",
            libraries: ['marker']
        });

        this.apiLoadPromise = loader.load()
            .then(() => {
                runInAction(() => {
                    this.isApiLoaded = true;
                });
                console.log('✅ API Google Maps chargée avec succès');
                storeEvents.emit(EVENTS.MAPS.API_READY);
            })
            .catch((error) => {
                console.error('❌ Failed to load Google Maps API:', error);
                this.apiLoadPromise = null;
                storeEvents.emit(EVENTS.MAPS.API_ERROR, { error });
                throw error;
            })
            .finally(() => {
                console.groupEnd();
            });

        return this.apiLoadPromise;
    }

    async initMap(elementId, options = {}) {
        if (!this.isApiLoaded) {
            throw new Error('Google Maps API not initialized');
        }
    
        try {
            console.group('🗺️ Initialisation de la carte');
    
            const mapElement = document.getElementById(elementId);
            if (!mapElement) {
                throw new Error(`Element with id ${elementId} not found`);
            }
    
            // Nettoyage de la carte existante si elle existe
            if (this.map) {
                await this.cleanup();
                this.map = null;
            }
    
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
    
            this.map = new google.maps.Map(mapElement, {
                ...defaultOptions,
                ...options
            });
    
            await this.#initializeMapComponents();
    
            console.log('✅ Carte initialisée avec succès');
            return this.map;
    
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation de la carte:', error);
            throw error;
        } finally {
            console.groupEnd();
        }
    }
    
    async #initializeMapComponents() {
        this.#addMapControls();
        this.#setupMapListeners();
        this.#recordState();
        this.resizeObserver = await this.#initializeOverviewMap();
    }

    centerMapOnMarkers() {
        if (!this.map) {
            console.warn('❌ Carte non initialisée');
            return;
        }
    
        const bounds = new google.maps.LatLngBounds();
        let hasMarkers = false;
    
        // Collecter tous les marqueurs visibles
        if (rootAncestorTownsStore.markers) {
            rootAncestorTownsStore.markers.forEach(marker => {
                if (marker.getVisible()) {
                    bounds.extend(marker.getPosition());
                    hasMarkers = true;
                }
            });
        }
    
        if (hasMarkers) {
            this.map.fitBounds(bounds);
            
            // Ajuster le zoom si nécessaire
            const listener = google.maps.event.addListenerOnce(this.map, 'idle', () => {
                if (this.map.getZoom() > 12) {
                    this.map.setZoom(12);
                }
            });
            
            console.log('✅ Carte centrée sur les marqueurs');
        } else {
            // Si aucun marqueur, revenir à la vue par défaut de la France
            this.map.setCenter({ lat: 46.2276, lng: 2.2137 });
            this.map.setZoom(6.2);
            console.log('ℹ️ Aucun marqueur visible, retour à la vue par défaut');
        }
    }

    // Gestion de l'état des calques
    loadLayerStates() {
        try {
            const saved = localStorage.getItem('mapLayerStates');
            if (saved) {
                const states = JSON.parse(saved);
                runInAction(() => {
                    // Fusionner avec les valeurs par défaut
                    this.layerStates = {
                        ...this.layerStates,
                        ...states
                    };
                });
            }
        } catch (error) {
            console.error('Erreur lors du chargement des états des calques:', error);
        }
    }
    
    saveLayerStates() {
        try {
            localStorage.setItem('mapLayerStates', JSON.stringify(this.layerStates));
        } catch (error) {
            console.error('Erreur lors de la sauvegarde des états des calques:', error);
        }
    }
    
    setLayerState(layer, state) {
        this.layerStates[layer] = state;
        this.saveLayerStates();
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
        rootAncestorTownsStore.birthData.forEach(birth => {
            if (!birth.location) return;
            
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
        rootAncestorTownsStore.clearMarkers();
        if (this.map) {
            this.map.setCenter({ lat: 46.2276, lng: 2.2137 });
            this.map.setZoom(6.2);
            google.maps.event.trigger(this.map, 'resize');
        }
    }

    async resizeAndMoveMap() {
        if (this.map) {
            google.maps.event.trigger(this.map, "resize");
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

        // Initialiser this.history s'il n'existe pas
        if (!this.history) {
            this.history = [];
        }

        // Initialiser this.redoStack s'il n'existe pas
        if (!this.redoStack) {
            this.redoStack = [];
        }

        const lastState = this.history.length > 0 ? this.history[this.history.length - 1] : null;
        if (!this.#isSameState(lastState, currentState)) {
            this.history.push(currentState);
            this.redoStack = [];
        }
    }

    #isSameState(state1, state2) {
        if (!state1 || !state2) return false;
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
        console.group('📍 Initialisation de la mini-carte');
    
        try {
            const mapContainer = this.map.getDiv().parentElement;
    
            // Fonction pour calculer la taille de la mini-carte avec des dimensions entières
            const calculateMinimapSize = () => {
                const containerWidth = mapContainer.offsetWidth;
                // Arrondir à l'entier le plus proche
                return Math.min(Math.max(Math.round(containerWidth * 0.2), 150), 300);
            };
    
            // Suppression de l'ancienne mini-carte si elle existe
            const existingWrapper = document.getElementById('overview-map-wrapper');
            if (existingWrapper) {
                existingWrapper.remove();
            }
    
            // Création du wrapper
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
    
            const initialSize = calculateMinimapSize();
            const container = document.createElement('div');
            container.id = 'overview-map-container';
            container.style.cssText = `
                position: absolute;
                bottom: 24px;
                right: 24px;
                width: ${initialSize}px;
                height: ${initialSize}px;
                background-color: #fff;
                border: 2px solid rgba(0, 0, 0, 0.3);
                border-radius: 4px;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                overflow: hidden;
                display: block;
            `;
            wrapper.appendChild(container);
    
            // Image statique
            const staticMap = document.createElement('img');
            staticMap.id = 'overview-static-map';
            staticMap.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            `;
    
            staticMap.onerror = (error) => {
                console.error('❌ Erreur lors du chargement de la carte statique:', error);
                container.style.display = 'none';
            };
    
            staticMap.onload = () => {
                container.style.opacity = '1';
                container.style.display = 'block';
                console.log('✅ Image de la carte statique chargée');
            };
    
            container.appendChild(staticMap);
    
            // Viewport
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
    
            // Debounce pour les mises à jour
            let updateTimeout = null;
    
            // Fonction de mise à jour
            const updateOverview = () => {
                if (!this.overviewMapVisible) return;
    
                if (updateTimeout) {
                    clearTimeout(updateTimeout);
                }
    
                updateTimeout = setTimeout(() => {
                    const bounds = this.map.getBounds();
                    const center = this.map.getCenter();
                    if (!bounds || !center) return;
    
                    const size = calculateMinimapSize();
                    container.style.width = `${size}px`;
                    container.style.height = `${size}px`;
    
                    const mapParams = new URLSearchParams({
                        center: `${center.lat()},${center.lng()}`,
                        zoom: '5',
                        size: `${size}x${size}`,
                        key: this.staticApiKey,
                        map_id: this.MAP_ID,
                        scale: '2',
                        language: 'fr',
                        region: 'FR'
                    });
    
                    console.log('🔄 Mise à jour de la mini-carte');
                    staticMap.src = `https://maps.googleapis.com/maps/api/staticmap?${mapParams}`;
    
                    const ne = bounds.getNorthEast();
                    const sw = bounds.getSouthWest();
                    const staticMapSpan = {
                        lat: 360 / Math.pow(2, 6),
                        lng: 360 / Math.pow(2, 6)
                    };
                    
                    const mapSpan = {
                        lat: Math.abs(ne.lat() - sw.lat()),
                        lng: Math.abs(ne.lng() - sw.lng())
                    };
                    
                    const pixelSpan = {
                        lat: Math.round(mapSpan.lat / staticMapSpan.lat * size),
                        lng: Math.round(mapSpan.lng / staticMapSpan.lng * size)
                    };
    
                    viewport.style.width = `${pixelSpan.lng}px`;
                    viewport.style.height = `${pixelSpan.lat}px`;
                    viewport.style.left = `${Math.round(size/2 - pixelSpan.lng/2)}px`;
                    viewport.style.top = `${Math.round(size/2 - pixelSpan.lat/2)}px`;
                }, 300);
            };
    
            // Observer de redimensionnement
            const resizeObserver = new ResizeObserver(() => {
                if (this.overviewMapVisible) {
                    updateOverview();
                }
            });
            
            resizeObserver.observe(mapContainer);
    
            // Gestion du zoom
            this.map.addListener('zoom_changed', () => {
                const zoom = this.map.getZoom();
                console.log('🔍 Niveau de zoom:', zoom);
                
                if (zoom >= this.ZOOM_THRESHOLD && !this.overviewMapVisible) {
                    console.log('📍 Affichage de la mini-carte');
                    this.overviewMapVisible = true;
                    container.style.display = 'block';
                    requestAnimationFrame(() => {
                        container.style.opacity = '1';
                        updateOverview();
                    });
                } else if (zoom < this.ZOOM_THRESHOLD && this.overviewMapVisible) {
                    console.log('📍 Masquage de la mini-carte');
                    this.overviewMapVisible = false;
                    container.style.opacity = '0';
                    container.style.display = 'none';
                }
            });
    
            // Écouteurs pour les changements de position
            ['bounds_changed', 'center_changed'].forEach(event => {
                this.map.addListener(event, () => {
                    if (this.overviewMapVisible) {
                        updateOverview();
                    }
                });
            });
    
            // Vérification initiale du zoom
            const initialZoom = this.map.getZoom();
            if (initialZoom >= this.ZOOM_THRESHOLD) {
                this.overviewMapVisible = true;
                container.style.opacity = '1';
                container.style.display = 'block';
                updateOverview();
            }
    
            console.log('✅ Mini-carte initialisée avec succès');
            console.groupEnd();
            return resizeObserver;
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation de la mini-carte:', error);
            console.groupEnd();
            throw error;
        }
    }

    cleanup() {
        if (this.map) {
            google.maps.event.clearInstanceListeners(this.map);
        }
    
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    
        const wrapper = document.getElementById('overview-map-wrapper');
        if (wrapper) {
            wrapper.remove();
        }
    
        this.overviewMapVisible = false;
        this.history = [];
        this.redoStack = [];
    }
}

export const googleMapsStore = new GoogleMapsStore();