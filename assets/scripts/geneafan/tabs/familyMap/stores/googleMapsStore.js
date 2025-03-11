import { Offcanvas } from "bootstrap";
import { makeObservable, observable, action, runInAction } from '../../../common/stores/mobx-config.js';
import { Loader } from "@googlemaps/js-api-loader";
import { rootAncestorTownsStore } from './rootAncestorTownsStore.js';
import { storeEvents, EVENTS } from '../../../common/stores/storeEvents.js';
import { layerManager } from '../managers/layerManager.js';
import { calculateDynamicZoom, calculatePadding } from '../utils/mapUtils.js';

class GoogleMapsStore {
    constructor() {
        this.map = null;
        this.isApiLoaded = false;
        this.apiLoadPromise = null;
        this.isTimelineActive = true;

        // Propriété pour stocker les infos de la personne racine
        this.rootPersonInfo = {
            id: null,
            name: ""
        };

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

        makeObservable(this, {
            map: observable,
            isTimelineActive: observable,
            overviewMapVisible: observable,
            isApiLoaded: observable,
            rootPersonInfo: observable,

            // Actions existantes
            initializeApi: action,
            initMap: action,
            centerMapOnMarkers: action,
            setLayerState: action,
            setRootPersonInfo: action
        });

        // Écouter uniquement l'événement ROOT.CHANGED
        storeEvents.subscribe(EVENTS.ROOT.CHANGED, (data) => {
            if (data && data.root) {
                // Utiliser rootPersonName s'il est fourni dans l'événement
                this.handleRootPersonChanged(data.root, data.skipDraw, data.rootPersonName);
            }
        });
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
            libraries: ['marker', 'geometry'] // Ajout de 'geometry'
        });

        this.apiLoadPromise = loader.load()
            .then(() => {
                runInAction(() => {
                    this.isApiLoaded = true;
                });
                console.log('✅ API Google Maps chargée avec succès');
                storeEvents.emit(EVENTS.VISUALIZATIONS.MAP.API_READY)
            })
            .catch((error) => {
                console.error('❌ Failed to load Google Maps API:', error);
                this.apiLoadPromise = null;
                storeEvents.emit(EVENTS.VISUALIZATIONS.MAP.API_ERROR, { error });
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
                zoomControl: false,
                zoomControlOptions: {
                    position: google.maps.ControlPosition.RIGHT_BOTTOM
                },
                fullscreenControl: true,
                fullscreenControlOptions: {
                    position: google.maps.ControlPosition.TOP_RIGHT
                },
                cameraControl: true,
                cameraControlOptions: {
                    position: google.maps.ControlPosition.TOP_RIGHT
                },
                mapTypeControl: true,
                mapTypeControlOptions: {
                    position: google.maps.ControlPosition.TOP_CENTER
                },
                rotateControl: false,
                gestureHandling: "greedy",
                tilt: 45
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
        this.#addLayerControlDropdown();
        await this.#initializeInsetMap();
    }

    /**
     * Calcule le pourcentage de padding à appliquer en fonction de la hauteur du conteneur
     * Méthode centralisée pour remplacer les implémentations dans chaque store
     * @param {number} containerHeight - Hauteur du conteneur en pixels
     * @returns {number} - Pourcentage de padding (0-0.3)
     */
    calculatePaddingPercentage(containerHeight) {
        // Plus le conteneur est petit, plus le padding est important
        if (containerHeight < 300) {
            return 0.25; // 25% de padding pour très petits conteneurs
        } else if (containerHeight < 500) {
            return 0.2; // 20% de padding pour petits conteneurs
        } else if (containerHeight < 700) {
            return 0.15; // 15% de padding pour conteneurs moyens
        } else {
            return 0.1; // 10% de padding pour grands conteneurs
        }
    }

    calculateDynamicZoom(containerHeight) {
        return calculateDynamicZoom(containerHeight);
    }

    calculatePadding(mapDiv) {
        return calculatePadding(mapDiv);
    }

    /**
     * Version améliorée de centerMapOnMarkers pour déléguer à tous les stores
     * et centraliser la logique commune
     */
    centerMapOnMarkers() {
        if (!this.map) {
            console.warn('❌ Carte non initialisée');
            return;
        }

        // Récupérer les dimensions actuelles du conteneur
        const mapDiv = this.map.getDiv();
        const containerHeight = mapDiv.offsetHeight;
        console.log(`📏 Hauteur du conteneur de carte: ${containerHeight}px`);

        // Définir un zoom maximal en fonction de la hauteur du conteneur
        const dynamicMaxZoom = calculateDynamicZoom(containerHeight);
        const padding = calculatePadding(mapDiv);
        console.log(`🔍 Zoom maximal dynamique calculé: ${dynamicMaxZoom}`);

        // Récupérer le calque actif depuis le layerManager et utiliser le store associé
        const activeLayerName = layerManager.activeLayer;

        if (activeLayerName) {
            // Récupérer la référence du store à partir du layerManager
            const activeStore = layerManager.layerConfig[activeLayerName]?.storeRef;

            if (activeStore) {
                console.log(`🔍 Délégation du centrage au calque actif: ${activeLayerName}`);

                // Mettre à jour cette section pour utiliser le nouveau nom de méthode
                if (activeLayerName === 'family') {
                    activeStore.centerMapOnFamilyMarkers(dynamicMaxZoom, 5);
                } else if (activeLayerName === 'ancestors') {
                    activeStore.centerMapOnAncestorMarkers(); // Nom mis à jour ici
                } else if (activeLayerName === 'surnames') {
                    activeStore.centerMapOnSurnameMarkers(dynamicMaxZoom, 5);
                }

                return;
            }
        }

        // Logique de repli si aucun calque actif ou si le store n'est pas disponible
        const bounds = new google.maps.LatLngBounds();
        let hasMarkers = false;

        // Recherche de marqueurs visibles à travers les stores
        layerManager.layerConfig.ancestors?.storeRef?.markerDisplayManager.layers.forEach(layerMarkers => {
            layerMarkers.forEach(marker => {
                if (marker.map !== null) {
                    bounds.extend(marker.position);
                    hasMarkers = true;
                }
            });
        });

        if (hasMarkers) {
            this.map.fitBounds(bounds, padding);

            // Ajuster le zoom si nécessaire
            const listener = google.maps.event.addListenerOnce(this.map, 'idle', () => {
                if (this.map.getZoom() > dynamicMaxZoom) {
                    this.map.setZoom(dynamicMaxZoom);
                }
            });

            console.log(`✅ Carte centrée sur les marqueurs avec zoom max ${dynamicMaxZoom}`);
        } else {
            // Si aucun marqueur, revenir à la vue par défaut de la France
            this.map.setCenter({ lat: 46.2276, lng: 2.2137 });
            this.map.setZoom(6.2);
            console.log('ℹ️ Aucun marqueur visible, retour à la vue par défaut');
        }
    }

    // Méthode pour modifier l'état d'un calque
    setLayerState(layer, state) {
        layerManager.setLayerVisibility(layer, state);
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

    // Méthode pour définir les infos de la personne racine
    setRootPersonInfo = action((info) => {
        this.rootPersonInfo = info;
        console.log('Infos de personne racine mises à jour:', info);
    });

    // Méthode pour gérer le changement de personne racine
    handleRootPersonChanged = action(async (rootId, skipDraw, rootPersonName) => {
        try {
            console.log(`Changement de personne racine détecté: ${rootId} (skipDraw: ${skipDraw})`);

            // Mettre à jour l'ID de la personne racine
            this.setRootPersonInfo({ ...this.rootPersonInfo, id: rootId });

            // Si le nom est fourni dans l'événement, l'utiliser directement
            if (rootPersonName) {
                this.setRootPersonInfo({ ...this.rootPersonInfo, name: rootPersonName });
                console.log(`Nom de la personne racine fourni par l'événement: ${rootPersonName}`);
            }
            // Sinon, essayer de le récupérer de window.rootPersonStore
            else if (window.rootPersonStore && window.rootPersonStore.rootPersonName) {
                const name = window.rootPersonStore.rootPersonName;
                this.setRootPersonInfo({ ...this.rootPersonInfo, name: name });
                console.log(`Nom de la personne racine récupéré de rootPersonStore: ${name}`);
            }

            // Si le contrôle de couches est déjà créé, mettre à jour son tooltip
            if (this.layerControlDiv && this.updateLayerControlTooltip) {
                this.updateLayerControlTooltip();
            }
        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour de la personne racine:', error);
        }
    });

    #addLayerControlDropdown() {
        // Création du div de contrôle principal
        const controlDiv = document.createElement('div');
        controlDiv.className = 'map-layer-control-container';
        controlDiv.style.margin = '10px';
        controlDiv.style.position = 'relative';

        // Style du conteneur de contrôle
        controlDiv.style.backgroundColor = '#fff';
        controlDiv.style.borderRadius = '4px';
        controlDiv.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
        controlDiv.style.overflow = 'visible';

        // Création du bouton principal qui déclenche le dropdown
        const mainButton = document.createElement('button');
        mainButton.className = 'map-layer-main-button';
        mainButton.title = 'Couches et options';
        mainButton.innerHTML = '<i class="fa fa-layers"></i> Couches';

        // Style du bouton principal
        this.#styleControlButton(mainButton);
        mainButton.style.padding = '8px 16px';
        mainButton.style.display = 'flex';
        mainButton.style.alignItems = 'center';
        mainButton.style.gap = '8px';
        mainButton.style.width = '100%';
        mainButton.style.justifyContent = 'space-between';

        // Ajout d'une icône (si Font Awesome est disponible)
        if (window.FontAwesome) {
            const icon = document.createElement('i');
            icon.className = 'fas fa-layers';
            mainButton.prepend(icon);
        }

        // Ajout de l'icône de flèche pour indiquer le dropdown
        const arrowSpan = document.createElement('span');
        arrowSpan.innerHTML = '▼';
        arrowSpan.style.fontSize = '10px';
        mainButton.appendChild(arrowSpan);

        // Création du tooltip qui affichera dynamiquement la couche active
        const tooltip = document.createElement('div');
        tooltip.className = 'map-layer-tooltip';
        tooltip.style.display = 'none';
        tooltip.style.position = 'absolute';
        tooltip.style.top = '-40px';
        tooltip.style.left = '0';
        tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '5px 10px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.fontSize = '12px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.zIndex = '1001';

        // Création du contenu du dropdown
        const dropdownContent = document.createElement('div');
        dropdownContent.className = 'map-layer-dropdown-content';
        dropdownContent.style.display = 'none';
        dropdownContent.style.position = 'absolute';
        dropdownContent.style.top = '100%';
        dropdownContent.style.left = '0';
        dropdownContent.style.backgroundColor = '#fff';
        dropdownContent.style.minWidth = '200px';
        dropdownContent.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
        dropdownContent.style.zIndex = '1000';
        dropdownContent.style.borderRadius = '4px';
        dropdownContent.style.marginTop = '5px';

        // Création des éléments du dropdown pour les couches
        const layerItems = [
            { key: 'ancestors', label: 'Ancêtres' },
            { key: 'family', label: 'Famille' },
            { key: 'surnames', label: 'Patronymes' }
        ];

        layerItems.forEach(layer => {
            const layerItem = document.createElement('div');
            layerItem.className = 'map-layer-item';
            layerItem.style.padding = '10px 16px';
            layerItem.style.cursor = 'pointer';
            layerItem.style.display = 'flex';
            layerItem.style.alignItems = 'center';
            layerItem.style.gap = '8px';
            layerItem.style.transition = 'background-color 0.2s';

            // Hover effect
            layerItem.addEventListener('mouseenter', () => {
                layerItem.style.backgroundColor = '#f0f0f0';
            });
            layerItem.addEventListener('mouseleave', () => {
                layerItem.style.backgroundColor = '';
            });

            // Créer le bouton radio pour la couche
            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.name = 'mapLayer';
            radioInput.value = layer.key;
            radioInput.id = `layer-${layer.key}`;

            // Vérifier si cette couche est actuellement active
            const isActive = layerManager.isLayerVisible(layer.key);
            radioInput.checked = isActive;

            // Label pour le radio button
            const label = document.createElement('label');
            label.htmlFor = `layer-${layer.key}`;
            label.textContent = layer.label;
            label.style.margin = '0';
            label.style.cursor = 'pointer';

            // Ajouter les éléments au conteneur de couche
            layerItem.appendChild(radioInput);
            layerItem.appendChild(label);

            // Événement au clic pour activer/désactiver la couche
            layerItem.addEventListener('click', (e) => {
                e.stopPropagation();

                // Activer cette couche
                layerManager.setLayerVisibility(layer.key, true);

                // Mettre à jour l'état des radios
                document.querySelectorAll('input[name="mapLayer"]').forEach(input => {
                    input.checked = (input.value === layer.key);
                });

                // Mettre à jour le texte du tooltip
                updateTooltipText();

                // Fermer le dropdown
                dropdownContent.style.display = 'none';
                isDropdownOpen = false;
            });

            // Ajouter l'élément de couche au dropdown
            dropdownContent.appendChild(layerItem);
        });

        // Ajouter un séparateur
        const separator = document.createElement('hr');
        separator.style.margin = '5px 0';
        separator.style.border = '0';
        separator.style.borderTop = '1px solid #e0e0e0';
        dropdownContent.appendChild(separator);

        // Ajouter un élément pour les options avancées
        const optionsItem = document.createElement('div');
        optionsItem.className = 'map-layer-item';
        optionsItem.style.padding = '10px 16px';
        optionsItem.style.cursor = 'pointer';
        optionsItem.style.display = 'flex';
        optionsItem.style.alignItems = 'center';
        optionsItem.style.gap = '8px';
        optionsItem.textContent = '⚙️ Options avancées';

        // Hover effect pour options
        optionsItem.addEventListener('mouseenter', () => {
            optionsItem.style.backgroundColor = '#f0f0f0';
        });
        optionsItem.addEventListener('mouseleave', () => {
            optionsItem.style.backgroundColor = '';
        });

        // Événement au clic pour les options
        optionsItem.addEventListener('click', (e) => {
            e.stopPropagation();

            // Ouvrir l'offcanvas mapParameters standard
            const mapParameters = document.getElementById("mapParameters");
            if (mapParameters) {
                const offcanvas = new Offcanvas(mapParameters, {
                    backdrop: true,
                    keyboard: true,
                    scroll: false,
                });
                offcanvas.show();
            } else {
                console.warn("L'élément mapParameters n'a pas été trouvé");
            }

            // Fermer le dropdown
            dropdownContent.style.display = 'none';
            isDropdownOpen = false;
        });

        dropdownContent.appendChild(optionsItem);

        // Variable pour suivre l'état du dropdown
        let isDropdownOpen = false;

        // Événement au clic pour le bouton principal
        mainButton.addEventListener('click', (e) => {
            e.stopPropagation();

            if (isDropdownOpen) {
                dropdownContent.style.display = 'none';
            } else {
                dropdownContent.style.display = 'block';
            }
            isDropdownOpen = !isDropdownOpen;
        });

        // Fonction pour obtenir le texte du tooltip
        const getTooltipText = () => {
            const activeLayer = layerManager.activeLayer;
            let tooltipText = '';

            if (activeLayer) {
                // Titre de base avec le nom de la couche
                const layerName = layerItems.find(item => item.key === activeLayer)?.label || activeLayer;
                tooltipText = `Couche active: ${layerName}`;

                // Si c'est la couche ancêtres, ajouter le nom de la personne racine
                if (activeLayer === 'ancestors' && this.rootPersonInfo && this.rootPersonInfo.name) {
                    tooltipText += ` (${this.rootPersonInfo.name})`;
                    console.log('Ajout du nom de la personne racine au tooltip:', this.rootPersonInfo.name);
                }
            } else {
                tooltipText = 'Aucune couche active';
            }

            return tooltipText;
        };

        // Fonction pour mettre à jour le contenu du tooltip
        const updateTooltipText = () => {
            const tooltipText = getTooltipText();
            tooltip.textContent = tooltipText;

            // Mettre à jour aussi le titre du bouton principal
            mainButton.title = tooltipText;

            console.log('Tooltip mis à jour:', tooltipText);
        };

        // Exposer cette fonction pour permettre des mises à jour externes
        this.updateLayerControlTooltip = updateTooltipText;

        // Événements pour afficher/masquer le tooltip
        controlDiv.addEventListener('mouseenter', () => {
            // Mettre à jour le texte du tooltip avant de l'afficher
            updateTooltipText();
            tooltip.style.display = 'block';
        });

        controlDiv.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });

        // Initialiser le tooltip
        updateTooltipText();

        // Fermer le dropdown si on clique ailleurs sur la carte ou le document
        this.map.addListener('click', () => {
            if (isDropdownOpen) {
                dropdownContent.style.display = 'none';
                isDropdownOpen = false;
            }
        });

        // Ajouter un écouteur global pour fermer le dropdown
        document.addEventListener('click', (e) => {
            if (isDropdownOpen && !controlDiv.contains(e.target)) {
                dropdownContent.style.display = 'none';
                isDropdownOpen = false;
            }
        });

        // Écouter les changements d'état des couches pour mettre à jour les radios et le tooltip
        const layerChangedHandler = ({ layer, state }) => {
            const radio = document.getElementById(`layer-${layer}`);
            if (radio) {
                radio.checked = state;
            }

            // Mettre à jour le tooltip si la couche est active
            if (state) {
                updateTooltipText();
            }
        };

        storeEvents.subscribe(EVENTS.VISUALIZATIONS.MAP.LAYERS.CHANGED, layerChangedHandler);

        // Ajouter le bouton, le tooltip et le dropdown au div de contrôle
        controlDiv.appendChild(mainButton);
        controlDiv.appendChild(tooltip);
        controlDiv.appendChild(dropdownContent);

        // Ajouter le contrôle à la carte
        this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(controlDiv);

        console.log('✅ Contrôle de couches ajouté en position TOP_LEFT');

        // Stocker une référence pour pouvoir le supprimer plus tard
        this.layerControlDiv = controlDiv;

        return controlDiv;
    }

    // Gestion de la mini-carte
    async #initializeInsetMap() {
        console.group('📍 Initialisation de l\'Inset Overview Map');

        try {
            // Constantes pour la mini-carte
            const OVERVIEW_DIFFERENCE = 5;
            const OVERVIEW_MIN_ZOOM = 3;
            const OVERVIEW_MAX_ZOOM = 10;

            // Créer l'élément pour l'Inset Map
            const insetMapDiv = document.createElement('div');
            insetMapDiv.id = 'overview';
            insetMapDiv.style.cssText = `
                width: 175x;
                height: 175px;
                margin: 10px;
                border-radius: 4px;
                border: 2px solid rgba(0, 0, 0, 0.3);
                overflow: hidden;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            `;

            // Ajouter l'élément à l'angle inférieur droit de la carte
            this.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(insetMapDiv);

            // Créer l'Inset Map avec des options personnalisées
            const insetMapOptions = {
                center: this.map.getCenter(),
                zoom: Math.max(this.map.getZoom() - OVERVIEW_DIFFERENCE, OVERVIEW_MIN_ZOOM),
                mapId: this.MAP_ID,
                disableDefaultUI: true,
                gestureHandling: "none",
                zoomControl: false,
            };

            const insetMap = new google.maps.Map(insetMapDiv, insetMapOptions);

            // Fonction utilitaire pour limiter la valeur entre min et max
            function clamp(num, min, max) {
                return Math.min(Math.max(num, min), max);
            }

            // Mise à jour de la mini-carte basée sur les changements de la carte principale
            this.map.addListener("bounds_changed", () => {
                insetMap.setCenter(this.map.getCenter());
                insetMap.setZoom(
                    clamp(
                        this.map.getZoom() - OVERVIEW_DIFFERENCE,
                        OVERVIEW_MIN_ZOOM,
                        OVERVIEW_MAX_ZOOM
                    )
                );
            });

            // Afficher ou masquer l'inset map en fonction du niveau de zoom
            const updateVisibility = () => {
                if (this.map.getZoom() >= this.ZOOM_THRESHOLD) {
                    insetMapDiv.style.display = 'block';
                    this.overviewMapVisible = true;
                } else {
                    insetMapDiv.style.display = 'none';
                    this.overviewMapVisible = false;
                }
            };

            // Écouter les changements de zoom pour gérer la visibilité
            this.map.addListener("zoom_changed", updateVisibility);

            // Définir l'état initial de visibilité
            updateVisibility();

            // Ajouter un indicateur visuel du viewport actuel (rectangle)
            const viewportRect = new google.maps.Rectangle({
                strokeColor: '#FF0000',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#FF0000',
                fillOpacity: 0.1,
                map: insetMap
            });

            // Mettre à jour le rectangle quand la carte principale change
            this.map.addListener("bounds_changed", () => {
                if (this.map.getBounds()) {
                    viewportRect.setBounds(this.map.getBounds());
                }
            });

            // Faire un resize observer pour redimensionner l'inset map si nécessaire
            const resizeObserver = new ResizeObserver(() => {
                const mapContainer = this.map.getDiv().parentElement;
                const containerWidth = mapContainer.offsetWidth;

                // Ajuster la taille de l'inset map en fonction de la taille du conteneur
                const size = Math.min(Math.max(Math.round(containerWidth * 0.2), 150), 300);
                insetMapDiv.style.width = `${size}px`;
                insetMapDiv.style.height = `${size}px`;

                // Déclencher un redimensionnement pour que Google Maps mette à jour l'affichage
                google.maps.event.trigger(insetMap, 'resize');
            });

            resizeObserver.observe(this.map.getDiv().parentElement);

            console.log('✅ Inset Overview Map initialisée avec succès');
            console.groupEnd();

            return resizeObserver;
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation de l\'Inset Overview Map:', error);
            console.groupEnd();
            throw error;
        }
    }

    cleanup() {
        console.log('🧹 Nettoyage de GoogleMapsStore');

        if (this.map) {
            // Supprimer tous les écouteurs de la carte
            google.maps.event.clearInstanceListeners(this.map);

            // Récupérer et supprimer l'élément de la mini-carte des contrôles
            const overviewElement = document.getElementById('overview');
            if (overviewElement) {
                // S'il a été ajouté aux contrôles, il sera automatiquement supprimé
                // lorsque la carte est détruite
                overviewElement.remove();
            }

            // Supprimer le contrôle de couches s'il existe
            if (this.layerControlDiv) {
                const index = this.map.controls[google.maps.ControlPosition.TOP_LEFT]
                    .getArray()
                    .indexOf(this.layerControlDiv);

                if (index > -1) {
                    this.map.controls[google.maps.ControlPosition.TOP_LEFT].removeAt(index);
                }

                this.layerControlDiv = null;
            }
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Réinitialiser les états
        this.overviewMapVisible = false;
        this.history = [];
        this.redoStack = [];

        console.log('✅ Nettoyage de GoogleMapsStore terminé');
    }

    // Méthodes publiques pour la gestion des contrôles (pour compatibilité avec le code existant)
    addLayerControlDropdown() {
        if (this.map && !this.layerControlDiv) {
            this.#addLayerControlDropdown();
            return true;
        }
        return false;
    }

    removeLayerControlDropdown() {
        if (this.map && this.layerControlDiv) {
            const index = this.map.controls[google.maps.ControlPosition.TOP_LEFT]
                .getArray()
                .indexOf(this.layerControlDiv);

            if (index > -1) {
                this.map.controls[google.maps.ControlPosition.TOP_LEFT].removeAt(index);
                this.layerControlDiv = null;
                return true;
            }
        }
        return false;
    }
}

export const googleMapsStore = new GoogleMapsStore();