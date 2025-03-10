import { makeObservable, observable, action, computed, runInAction, autorun, toJS, isObservable } from '../../../common/stores/mobx-config.js';
import { infoWindowDisplayManager } from '../managers/infoWindowDisplayManager.js';
import { storeEvents, EVENTS } from '../../../common/stores/storeEvents.js';
import { normalizeGeoString } from "../../../utils/geo.js";
import { TownStatisticsManager } from '../../../gedcom/stores/townStatisticsManager.js';
import { infoWindowContentManager } from '../managers/infoWindowContentManager.js';
import { layerManager } from '../managers/layerManager.js';
import BaseLayerStore from '../managers/baseLayerStore.js';
import { calculateDynamicZoom, calculatePadding } from '../utils/mapUtils.js';

/**
 * Manage the display of all towns mentioned in the GEDCOM file
 * 
 * Key responsibilities:
 * - Manages all towns from GEDCOM file
 * - Processes all types of genealogical events (births, marriages, deaths)
 * - Provides a global context layer for the map
 * - Handles geocoding and marker management
 * - Manages caching and data persistence
 */
class FamilyTownsStore extends BaseLayerStore {
    constructor() {
        super('family');
        // Définir explicitement le nom de la couche de marqueurs
        this.markerLayerName = 'familyTowns';

        // Primary data storage
        this.eventsData = new Map();

        // Caching systems for performance optimization
        this.geoDataCache = null;                     // Cache for geographical data
        this.markerConfigs = new Map();               // Stores marker configurations by town
        this.infoWindowContentCache = new Map();      // Caches info window HTML content

        // Primary town data storage
        this.townsData = new Map();

        // State management
        this.isLoading = false;

        // Dans BaseLayerStore, disposers est un Set, mais ici on l'utilisait comme Map
        this.disposers = new Map(); // Pour la compatibilité avec le code existant

        // Propriétés pour le centrage optimisé
        this.calculatedBounds = null;         // Les limites calculées une seule fois
        this.hasTooManyMarkers = false;       // Indique si la carte contient trop de marqueurs espacés
        this.userIsNavigating = false;        // Indique si l'utilisateur navigue manuellement

        // Observable event collections by type
        this.events = observable({
            birth: observable([]),
            death: observable([]),
            marriage: observable([]),
            burial: observable([]),
            occupation: observable([]),
            event: observable([])
        });

        // MobX configuration
        makeObservable(this, {
            townsData: observable,
            isLoading: observable,
            events: observable,
            updateTownsViaProxy: action,
            setIsLoading: action,
            setTownsData: action,
            addOrUpdateTown: action,
            updateTown: action,
            toggleVisibility: action,
            clearAllTowns: action,
            updateTownEventsForIndividual: action,
            finalizeAllTownsData: action,
            recalculateAllTownsStatistics: action,
            totalTowns: computed
        });

        // Automatic marker updates when data changes
        autorun(() => {
            if (this.map && (this.townsData.size > 0 || layerManager.isLayerVisible('family'))) {
                this.updateMarkers();
            }
        });

        this.setupEventSubscriptions();
    }

    /**
     * Sets up event listeners for GEDCOM data processing
     * Handles bulk individual additions, cache events, and cleanup
     */
    setupEventSubscriptions() {
        // Handle bulk addition of individuals
        const bulkIndividualsDisposer = storeEvents.subscribe(
            EVENTS.INDIVIDUALS.BULK_ADDED,

            (individuals) => {
                console.time('processAllTownsEvents');

                runInAction(() => {
                    const townUpdates = new Map();
                    console.time('processIndividuals');

                    const validEventTypes = ['birth', 'death', 'marriage'];

                    // Process each individual's events
                    individuals.forEach(([id, individual]) => {
                        individual.individualEvents?.forEach(event => {
                            if (!validEventTypes.includes(event.type)) return;
                            if (!event.town) return;

                            const normalizedTownName = normalizeGeoString(event.town);
                            if (normalizedTownName === 'lieu_inconnu') return;

                            // Initialize town data if needed
                            if (!townUpdates.has(normalizedTownName)) {
                                townUpdates.set(normalizedTownName, {
                                    townData: {
                                        town: event.town,
                                        townDisplay: event.town
                                    },
                                    events: []
                                });
                            }

                            // Enrich event with individual details
                            const enrichedEvent = {
                                type: event.type,
                                date: event.date,
                                personId: individual.id,
                                personDetails: {
                                    name: individual.name,
                                    surname: individual.surname,
                                    gender: individual.gender,
                                    birthDate: individual.birthDate,
                                    deathDate: individual.deathDate,
                                    birthPlace: individual.fanBirthPlace,
                                    deathPlace: individual.fanDeathPlace,
                                    occupation: individual.occupation
                                }
                            };

                            townUpdates.get(normalizedTownName).events.push(enrichedEvent);
                        });
                    });

                    console.timeEnd('processIndividuals');
                    console.time('applyTownUpdates');

                    // Apply accumulated updates
                    townUpdates.forEach((updateData, normalizedTownName) => {
                        this.addOrUpdateTown(normalizedTownName, updateData.townData);
                        const town = this.townsData.get(normalizedTownName);
                        if (town) {
                            updateData.events.forEach(event => {
                                this.updateTownEvents(town, event);
                            });
                        }
                    });

                    console.timeEnd('applyTownUpdates');
                });

                console.timeEnd('processAllTownsEvents');
            }
        );

        // Handle cache build completion
        const cacheDisposer = storeEvents.subscribe(
            EVENTS.CACHE.BUILT,
            () => {
                console.log('🔄 Cache built received');
                this.finalizeAllTownsData();
            }
        );

        // Handle cache clearing
        const clearDisposer = storeEvents.subscribe(EVENTS.CACHE.CLEARED, () => {
            console.log('🧹 Clearing town data');
            this.clearAllTowns();
        });

        // Store disposers for cleanup
        this.disposers.set('bulkIndividuals', bulkIndividualsDisposer);
        this.disposers.set('cache', cacheDisposer);
        this.disposers.set('clear', clearDisposer);
    }

    /**
     * Creates marker configuration for a town
     * @param {string} townName - Normalized town name
     * @param {Object} townData - Town data including coordinates
     * @returns {Object|null} Marker configuration or null if invalid data
     */
    createMarkerConfig(townName, townData) {
        if (!townData?.latitude || !townData?.longitude) {
            console.warn(`⚠️ Invalid town data for ${townName}`);
            return null;
        }

        const config = {
            position: new google.maps.LatLng(
                Number(townData.latitude),
                Number(townData.longitude)
            ),
            options: {
                content: this.createMarkerElement(townData),
                title: townData.townDisplay || townData.town
            }
        };

        this.markerConfigs.set(townName, config);
        return config;
    }

    createMarkerElement(townData) {
        const div = document.createElement('div');
        div.className = 'family-town-marker';
        div.style.cssText = `
            background: #4B5563;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        div.innerHTML = `<span>${townData.events.length}</span>`;
        return div;
    }

    // Mettre à jour la méthode getOrCreateMarker pour utiliser le bon nom de couche
    getOrCreateMarker(townName, townData) {
        if (!townData) {
            console.warn(`⚠️ Données manquantes pour la ville ${townName}`);
            return null;
        }

        let config = this.markerConfigs.get(townName);

        if (!config) {
            config = this.createMarkerConfig(townName, townData);
            if (!config) return null;
        }

        return this.markerDisplayManager.addMarker(
            this.markerLayerName,
            townName,
            config.position,
            config.options,
            (marker) => this.handleMarkerClick(marker, townName)
        );
    }

    // Event Handling
    updateTownEventsForIndividual(individual) {
        individual.individualEvents?.forEach(event => {
            if (!event.town) return;

            const normalizedTownName = normalizeGeoString(event.town);
            if (!normalizedTownName) return;

            const enrichedEvent = {
                type: event.type,
                date: event.date,
                personId: individual.id,
                personDetails: {
                    name: individual.name,
                    surname: individual.surname,
                    gender: individual.gender,
                    birthDate: individual.birthDate,
                    deathDate: individual.deathDate,
                    birthPlace: individual.fanBirthPlace,
                    deathPlace: individual.fanDeathPlace,
                    occupation: individual.occupation
                }
            };

            storeEvents.emit(EVENTS.TOWN.UPDATED, {
                townKey: normalizedTownName,
                event: enrichedEvent
            });

            this.addOrUpdateTown(normalizedTownName, {
                town: event.town,
                townDisplay: event.town
            }, enrichedEvent);
        });
    }

    /**
 * Ajoute ou met à jour une ville dans la base de données
 * @param {string} normalizedTownName - Nom normalisé de la ville
 * @param {Object} townData - Données de la ville
 * @param {Object} eventData - Données d'événement associées (optionnel)
 * @returns {boolean} - Succès de l'opération
 */
    addOrUpdateTown(normalizedTownName, townData, eventData = null) {
        // Validation des paramètres essentiels
        if (!normalizedTownName) {
            console.warn('⚠️ Nom de ville normalisé manquant');
            return false;
        }

        if (!townData) {
            console.warn('⚠️ Données de ville manquantes pour', normalizedTownName);
            return false;
        }

        runInAction(() => {
            let town = this.townsData.get(normalizedTownName);

            if (!town) {
                // Validation des coordonnées si présentes
                if (townData.latitude !== undefined && townData.longitude !== undefined) {
                    const lat = Number(townData.latitude);
                    const lng = Number(townData.longitude);

                    if (isNaN(lat) || isNaN(lng) ||
                        lat < -90 || lat > 90 ||
                        lng < -180 || lng > 180) {
                        console.warn(`⚠️ Coordonnées invalides ignorées pour ${normalizedTownName}: (${townData.latitude}, ${townData.longitude})`);
                        townData.latitude = '';
                        townData.longitude = '';
                    }
                }

                // Création des collections d'événements avec vérification
                const eventTypes = {
                    BIRT: observable([]),
                    DEAT: observable([]),
                    MARR: observable([]),
                    BURI: observable([]),
                    OCCU: observable([]),
                    EVEN: observable([]),
                    birth: observable([]),
                    death: observable([]),
                    marriage: observable([]),
                    burial: observable([]),
                    occupation: observable([]),
                    event: observable([])
                };

                // Création d'une nouvelle ville avec des valeurs par défaut pour les champs manquants
                town = observable({
                    town: townData.town || '',
                    townDisplay: townData.townDisplay || townData.town || '',
                    departement: townData.departement || '',
                    departementColor: townData.departementColor || '',
                    country: townData.country || '',
                    countryCode: townData.countryCode || '',
                    countryColor: townData.countryColor || '',
                    latitude: townData.latitude || '',
                    longitude: townData.longitude || '',
                    events: eventTypes,
                    statistics: TownStatisticsManager.createEmptyStatistics()
                });

                this.townsData.set(normalizedTownName, town);
            } else {
                // Mise à jour d'une ville existante
                // Vérifier si events existe et est observable
                if (!town.events || !isObservable(town.events)) {
                    town.events = observable({
                        BIRT: observable([]),
                        DEAT: observable([]),
                        MARR: observable([]),
                        BURI: observable([]),
                        OCCU: observable([]),
                        EVEN: observable([]),
                        birth: observable([]),
                        death: observable([]),
                        marriage: observable([]),
                        burial: observable([]),
                        occupation: observable([]),
                        event: observable([])
                    });
                }

                // Validation des coordonnées mises à jour si présentes
                if (townData.latitude !== undefined && townData.longitude !== undefined) {
                    const lat = Number(townData.latitude);
                    const lng = Number(townData.longitude);

                    if (isNaN(lat) || isNaN(lng) ||
                        lat < -90 || lat > 90 ||
                        lng < -180 || lng > 180) {
                        console.warn(`⚠️ Coordonnées de mise à jour invalides ignorées pour ${normalizedTownName}: (${townData.latitude}, ${townData.longitude})`);
                        delete townData.latitude;
                        delete townData.longitude;
                    }
                }

                // Mise à jour des champs avec vérification de validité
                Object.entries(townData).forEach(([field, value]) => {
                    if (value !== undefined && value !== null && field !== 'events') {
                        town[field] = value;
                    }
                });
            }

            // Traiter les données d'événement si fournies
            if (eventData) {
                if (!this.isValidEventData(eventData)) {
                    console.warn('⚠️ Données d\'événement invalides pour', normalizedTownName, eventData);
                } else {
                    this.invalidateCache(normalizedTownName);
                    this.updateTownEvents(town, eventData);
                }
            }
        });

        return true;
    }

    /**
     * Vérifie si les données d'événement sont valides
     * @param {Object} eventData - Données d'événement à valider
     * @returns {boolean} - Validité des données
     */
    isValidEventData(eventData) {
        // L'événement doit avoir un type
        if (!eventData || !eventData.type) {
            return false;
        }

        // Le type doit être valide
        const validEventTypes = ['birth', 'death', 'marriage', 'burial', 'occupation', 'event'];
        if (!validEventTypes.includes(eventData.type)) {
            return false;
        }

        // Vérification des détails de personne
        if (!eventData.personId || !eventData.personDetails) {
            return false;
        }

        return true;
    }

    updateExistingTownData(town, updates) {
        Object.entries(updates).forEach(([field, value]) => {
            if (value !== undefined && value !== null) {
                town[field] = value;
            }
        });
    }

    // Cache Management
    invalidateCache(normalizedTownName) {
        this.infoWindowContentCache.delete(normalizedTownName);
        this.markerConfigs.delete(normalizedTownName);
    }

    clearAllCaches() {
        this.markerConfigs.clear();
        this.infoWindowContentCache.clear();
    }

    // Marker Management
    createMarkerContent(color = '#4B5563') {
        const element = document.createElement('div');
        element.className = 'town-marker';
        element.style.cssText = `
            background: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid white;
        `;
        return element;
    }

    updateMarkers() {
        if (!this.map) return;

        if (!this.markerDisplayManager.isInitialized()) {
            this.markerDisplayManager.initializeCluster(this.map, this.createClusterMarker);
        }

        this.townsData.forEach((townData, townName) => {
            this.getOrCreateMarker(townName, townData);
        });
    }

    // Surcharge de la méthode toggleVisibility de BaseLayerStore pour maintenir
    // la compatibilité avec le code existant
    toggleVisibility(visible) {
        super.toggleVisibility(visible);
    }

    /**
 * Hook: Actions après affichage du calque
 * Centre automatiquement la carte sur les marqueurs de villes familiales
 */
    afterLayerShown() {
        console.log('🔄 Calque des villes familiales affiché, centrage automatique');
        // Vérifier qu'il y a des marqueurs avant de tenter le centrage
        if (this.townsData && this.townsData.size > 0) {
            console.log(`📊 Centrage sur ${this.townsData.size} villes familiales`);
            this.centerMapOnFamilyMarkers();
        } else {
            console.log('⚠️ Pas de données de villes familiales pour le centrage');
        }
    }

    /**
 * Surcharge de la méthode applyVisibility de BaseLayerStore
 * @param {boolean} visible - État de visibilité à appliquer
 */
    applyVisibility(visible) {
        if (!this.map) return;

        // Ne pas appeler super.applyVisibility() car nous avons besoin d'une implémentation complètement personnalisée
        // Mais documenter explicitement cette décision
        // Note: Cette méthode remplace intentionnellement celle de BaseLayerStore avec une logique spécifique

        if (visible) {
            console.log('🔍 Activation du calque des villes familiales');

            // 1. S'assurer que le cluster est bien initialisé
            if (!this.markerDisplayManager.isInitialized()) {
                this.markerDisplayManager.initializeCluster(this.map, this.createClusterMarker);
            }

            // 2. Mettre à jour les marqueurs (crée les marqueurs s'ils n'existent pas)
            this.updateMarkers();

            // 3. Rendre les marqueurs visibles AVANT de les ajouter au cluster (directement sur la carte)
            const layerMarkers = this.markerDisplayManager.layers.get(this.markerLayerName);
            if (layerMarkers) {
                layerMarkers.forEach(marker => {
                    marker.map = this.map;
                });
            }

            // 4. Ajouter les marqueurs au cluster SANS les cacher d'abord
            console.log('📍 Ajout des marqueurs au cluster');
            this.markerDisplayManager.addMarkersToCluster(this.map);

        } else {
            console.log('🔍 Désactivation du calque des villes familiales');
            this.markerDisplayManager.toggleLayerVisibility(this.markerLayerName, false, this.map);
        }
    }

    // Stats and Data Management
    recalculateAllTownsStatistics() {
        runInAction(() => {
            console.log('🏘️ Début du recalcul des statistiques');

            let totalEvents = {
                births: 0,
                deaths: 0,
                marriages: 0
            };

            this.townsData.forEach((town, normalizedTownName) => {
                try {
                    town.statistics = TownStatisticsManager.createEmptyStatistics();
                    ['birth', 'death', 'marriage'].forEach(eventType => {
                        if (!town.events || !Array.isArray(town.events[eventType])) {
                            console.warn(`Données manquantes pour ${eventType} dans ${normalizedTownName}`);
                            return;
                        }

                        const eventCount = town.events[eventType].length;
                        totalEvents[eventType + 's'] += eventCount;

                        town.events[eventType].forEach(event => {
                            if (event) TownStatisticsManager.updateTownStatistics(town, event);
                        });

                        // console.log(`📊 ${normalizedTownName}:`,
                        //    JSON.stringify({
                        //        events: {
                        //            births: town.events.birth?.length || 0,
                        //            deaths: town.events.death?.length || 0,
                        //            marriages: town.events.marriage?.length || 0
                        //        },
                        //        stats: toJS(town.statistics)
                        //    }, null, 2)
                        // );
                    });
                } catch (error) {
                    console.error(`Erreur: ${normalizedTownName}:`, error);
                }
            });

            console.log('📊 Total des événements:', totalEvents);
        });
    }

    finalizeAllTownsData() {
        console.log('🏁 Début finalizeAllTownsData');
        this.recalculateAllTownsStatistics();
        this.clearAllCaches();
        console.log('✅ Fin finalizeAllTownsData');

        // Mettre à jour les marqueurs après la finalisation des données
        if (this.map) {
            console.log('📍 Mise à jour des marqueurs après finalisation');
            this.updateMarkers();

            // Réinitialiser et recalculer les bounds pour le centrage optimisé
            this.calculatedBounds = null;
            this.hasTooManyMarkers = false;
            this.initializeMapBounds();
        }

        this.saveToLocalStorage();
    }

    // Utility Methods
    hasActiveMarkers() {
        if (!this.markerDisplayManager) return false;
        let hasMarkers = false;
        this.markerDisplayManager.layers.forEach(layerMarkers => {
            layerMarkers.forEach(marker => {
                if (marker.map !== null) {
                    hasMarkers = true;
                }
            });
        });
        return hasMarkers;
    }

    /**
     * Obtient les limites géographiques des marqueurs affichés
     * @returns {google.maps.LatLngBounds|null} Limites géographiques ou null
     */
    getBounds() {
        if (!this.markerDisplayManager) return null;

        const bounds = new google.maps.LatLngBounds();
        let hasMarkers = false;

        this.markerDisplayManager.layers.forEach(layerMarkers => {
            layerMarkers.forEach(marker => {
                if (marker.map !== null) {
                    bounds.extend(marker.position);
                    hasMarkers = true;
                }
            });
        });

        return hasMarkers ? bounds : null;
    }

    /**
     * Initialise les limites géographiques du calque pour optimiser le centrage
     * Cette méthode n'est appelée qu'une fois après le chargement complet des données
     */
    initializeMapBounds() {
        if (!this.markerDisplayManager?.layers?.get(this.markerLayerName) || this.calculatedBounds) {
            return; // Bounds déjà calculés ou pas de marqueurs
        }

        console.log('🗺️ Calcul des limites géographiques pour le calque familial');

        const markers = [];
        this.markerDisplayManager.layers.get(this.markerLayerName).forEach(marker => {
            if (marker && marker.position) {
                markers.push(marker);
            }
        });

        if (markers.length === 0) {
            console.log('⚠️ Aucun marqueur pour calculer les limites');
            return;
        }

        const bounds = new google.maps.LatLngBounds();
        markers.forEach(marker => bounds.extend(marker.position));

        // Vérifier si les limites sont trop larges
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const spanLat = Math.abs(ne.lat() - sw.lat());
        const spanLng = Math.abs(ne.lng() - sw.lng());

        this.hasTooManyMarkers = (spanLat > 60 || spanLng > 60);
        this.calculatedBounds = bounds;

        console.log(`✅ Limites calculées pour ${markers.length} marqueurs familiaux (trop étendu: ${this.hasTooManyMarkers})`);
    }

    /**
 * Centers the map on family town markers with cached bounds optimization.
 * Designed for fixed markers that don't change position after initial loading:
 * - Uses pre-calculated and cached bounds for better performance
 * - Respects user navigation when specified to avoid disrupting exploration
 * - Handles special case of widely spread markers with minimum zoom
 * - Applies proportional padding based on container dimensions
 * 
 * @param {number} maxZoom - Maximum zoom level allowed (default: 12)
 * @param {number} minZoom - Minimum zoom level allowed (default: 5)
 * @param {boolean} respectUserView - If true, won't recenter if user is navigating (default: false)
 */
    centerMapOnFamilyMarkers(maxZoom = 12, minZoom = 5, respectUserView = false) {
        if (!this.map) {
            console.warn('❌ Carte non initialisée');
            return;
        }

        // Vérifier si l'utilisateur est en train de naviguer manuellement
        if (respectUserView && this.userIsNavigating) {
            console.log('👆 Navigation utilisateur en cours, centrage ignoré');
            return;
        }

        // Utiliser les méthodes centralisées de googleMapsStore
        const mapDiv = this.map.getDiv();
        const padding = calculatePadding(mapDiv);
        console.log(`📏 Padding calculé: T:${padding.top}, R:${padding.right}, B:${padding.bottom}, L:${padding.left}`);

        // Initialiser les bounds si ce n'est pas déjà fait
        if (!this.calculatedBounds) {
            this.initializeMapBounds();
        }

        if (!this.calculatedBounds) {
            console.warn('⚠️ Impossible de centrer la carte : aucun marqueur familial disponible');
            return;
        }

        // Si limites trop larges, utiliser le zoom minimal et centrer
        if (this.hasTooManyMarkers) {
            console.log(`🔍 Limites trop étendues, utilisation du zoom minimal (${minZoom})`);
            this.map.setCenter(this.calculatedBounds.getCenter());
            this.map.setZoom(minZoom);
            return;
        }

        // Sinon, utiliser fitBounds avec le padding calculé
        console.log('🔍 Ajustement de la carte aux limites des marqueurs familiaux avec padding');
        this.map.fitBounds(this.calculatedBounds, padding);

        google.maps.event.addListenerOnce(this.map, 'idle', () => {
            const currentZoom = this.map.getZoom();
            console.log(`🔍 Zoom après ajustement: ${currentZoom} (limites: ${minZoom}-${maxZoom})`);

            if (currentZoom > maxZoom) {
                console.log(`🔍 Limitation du zoom à ${maxZoom}`);
                this.map.setZoom(maxZoom);
            } else if (currentZoom < minZoom) {
                console.log(`🔍 Augmentation du zoom à ${minZoom}`);
                this.map.setZoom(minZoom);
            }
        });
    }

    cleanData(data) {
        return JSON.parse(JSON.stringify(data));
    }

    // Storage Management
    loadFromLocalStorage = () => {
        try {
            const stored = localStorage.getItem('townsDB');
            if (!stored) return {};

            const parsed = JSON.parse(stored);
            const validTowns = {};
            const invalidKeys = [];

            Object.entries(parsed).forEach(([key, townData]) => {
                if (!this._isValidTownData(townData)) {
                    invalidKeys.push(key);
                    return;
                }
                validTowns[key] = townData;
            });

            if (invalidKeys.length > 0) {
                const newCache = { ...parsed };
                invalidKeys.forEach(key => delete newCache[key]);
                localStorage.setItem('townsDB', JSON.stringify(newCache));
            }

            this.setTownsData(validTowns);
            return validTowns;
        } catch (error) {
            console.error('Erreur lors du chargement depuis localStorage:', error);
            this.setTownsData({});
            return {};
        }
    }

    _isValidTownData(townData) {
        return townData &&
            townData.town &&
            typeof townData.town === 'string' &&
            townData.latitude &&
            !isNaN(townData.latitude) &&
            townData.longitude &&
            !isNaN(townData.longitude);
    }

    getStorageData() {
        const result = {};
        this.townsData.forEach((townData, key) => {
            result[key] = {
                town: townData.town,
                townDisplay: townData.townDisplay,
                departement: townData.departement,
                departementColor: townData.departementColor,
                country: townData.country,
                countryCode: townData.countryCode,
                countryColor: townData.countryColor,
                latitude: townData.latitude,
                longitude: townData.longitude
            };
        });
        return result;
    }

    saveToLocalStorage() {
        try {
            const storageData = {};
            this.townsData.forEach((townData, key) => {
                storageData[key] = {
                    town: townData.town,
                    townDisplay: townData.townDisplay,
                    departement: townData.departement,
                    departementColor: townData.departementColor,
                    country: townData.country,
                    countryCode: townData.countryCode,
                    countryColor: townData.countryColor,
                    latitude: townData.latitude,
                    longitude: townData.longitude
                };
            });
            localStorage.setItem('townsDB', JSON.stringify(storageData));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    // Proxy Update Management
    async updateTownsViaProxy(townsToUpdate = null) {
        if (this.isLoading) {
            console.warn("⚠️ Une mise à jour est déjà en cours");
            return;
        }

        try {
            console.log('🔄 Début de la mise à jour via proxy');
            this.setIsLoading(true);

            console.log('📣 Émission de UPDATE_START');
            storeEvents.emit(EVENTS.TOWN.UPDATE_START);

            const updates = townsToUpdate || this._collectTownsNeedingUpdate();

            if (Object.keys(updates).length === 0) {
                console.log('ℹ️ Aucune ville à mettre à jour');
                console.log('📣 Émission de UPDATE_COMPLETE');
                storeEvents.emit(EVENTS.TOWN.UPDATE_COMPLETE);
                return;
            }

            console.log(`🔄 Mise à jour de ${Object.keys(updates).length} villes`);

            const response = await fetch('https://opencageproxy.genealogie.workers.dev/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    familyTowns: updates,
                    userId: localStorage.getItem('userId')
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const updatedTowns = await response.json();
            console.log('✅ Données reçues du proxy:', Object.keys(updatedTowns).length);

            runInAction(() => {
                Object.entries(updatedTowns).forEach(([key, data]) => {
                    // Ne stocker que les villes avec coordonnées valides
                    if (data.latitude && data.longitude) {
                        this.updateTown(key, data);
                    }
                });
                this.saveToLocalStorage();
            });

            console.log('📣 Émission de UPDATE_COMPLETE');
            storeEvents.emit(EVENTS.TOWN.UPDATE_COMPLETE);

        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour:', error);
            console.log('📣 Émission de UPDATE_ERROR');
            storeEvents.emit(EVENTS.TOWN.UPDATE_ERROR, error);
            throw error;
        } finally {
            this.setIsLoading(false);
            console.log('✅ Fin de updateTownsViaProxy');
        }
    }

    // Nouvelle méthode auxiliaire pour identifier les villes à mettre à jour
    _collectTownsNeedingUpdate() {
        const updates = {};
        this.townsData.forEach((town, key) => {
            if (!town.latitude || !town.longitude || !town.departement || !town.country) {
                updates[key] = this.cleanData(town);
            }
        });
        return updates;
    }

    /**
     * Surcharge de la méthode cleanup de BaseLayerStore
     * Nettoyage des ressources spécifiques à ce calque
     */
    cleanup() {
        this.clearAllCaches();
        super.cleanup();
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
    }

    clearAllTowns() {
        runInAction(() => {
            this.townsData.clear();
            this.geoDataCache = null;
            this.eventsData.clear();
            this.clearAllCaches();

            // Réinitialiser aussi les bounds calculés
            this.calculatedBounds = null;
            this.hasTooManyMarkers = false;

            if (this.markerDisplayManager) {
                this.markerDisplayManager.clearMarkers();
            }
        });
    }

    // Getters and Setters
    setIsLoading(loading) {
        this.isLoading = loading;
    }

    setTownsData(towns) {
        runInAction(() => {
            this.townsData = new Map(Object.entries(towns));
        });
    }

    /**
 * Met à jour les données d'une ville existante
 * @param {string} key - Clé de la ville
 * @param {Object} updates - Mises à jour à appliquer
 * @returns {boolean} - Succès de la mise à jour
 */
    updateTown(key, updates) {
        // Validation des paramètres
        if (!key) {
            console.warn('⚠️ Clé de ville manquante pour updateTown');
            return false;
        }

        if (!updates || typeof updates !== 'object') {
            console.warn(`⚠️ Mises à jour invalides pour la ville ${key}`);
            return false;
        }

        runInAction(() => {
            const town = this.townsData.get(key);
            if (town) {
                // Validation des coordonnées si elles sont mises à jour
                if (updates.latitude !== undefined || updates.longitude !== undefined) {
                    const newLat = updates.latitude !== undefined ? updates.latitude : town.latitude;
                    const newLng = updates.longitude !== undefined ? updates.longitude : town.longitude;

                    if (isNaN(Number(newLat)) || isNaN(Number(newLng)) ||
                        Number(newLat) < -90 || Number(newLat) > 90 ||
                        Number(newLng) < -180 || Number(newLng) > 180) {
                        console.warn(`⚠️ Coordonnées invalides pour ${key}: (${newLat}, ${newLng})`);
                        // Continuer la mise à jour mais ignorer les coordonnées invalides
                        delete updates.latitude;
                        delete updates.longitude;
                    }
                }

                // Mise à jour des propriétés avec vérification
                Object.entries(updates).forEach(([field, value]) => {
                    if (value !== undefined && value !== null) {
                        town[field] = value;
                    }
                });

                // Mise à jour du stockage si nécessaire
                if (updates.latitude || updates.longitude ||
                    updates.departement || updates.country) {
                    this.saveToLocalStorage();
                }

                return true;
            } else {
                console.warn(`⚠️ Tentative de mise à jour d'une ville inexistante: ${key}`);
                return false;
            }
        });

        return false;
    }

    getTown(key) {
        const town = this.townsData.get(key);
        return town ? this.cleanData(town) : null;
    }

    getAllTowns() {
        const result = {};
        this.townsData.forEach((townData, key) => {
            result[key] = {
                town: townData.town,
                townDisplay: townData.townDisplay,
                departement: townData.departement,
                departementColor: townData.departementColor,
                country: townData.country,
                countryColor: townData.countryColor,
                latitude: townData.latitude,
                longitude: townData.longitude,
                events: toJS(townData.events)  // Ajout des événements
            };
        });
        return result;
    }

    // Méthode pour accéder aux données géographiques
    getGeoData(townKey) {
        if (!this.geoDataCache) {
            this.geoDataCache = new Map();
            this.townsData.forEach((townData, key) => {
                this.geoDataCache.set(key, {
                    town: townData.town,
                    townDisplay: townData.townDisplay,
                    departement: townData.departement,
                    departementColor: townData.departementColor,
                    country: townData.country,
                    countryColor: townData.countryColor,
                    latitude: townData.latitude,
                    longitude: townData.longitude
                });
            });
        }
        return townKey ? this.geoDataCache.get(townKey) : Object.fromEntries(this.geoDataCache);
    }

    get totalTowns() {
        return this.townsData.size;
    }

    // Map Initialization and Management
    initialize(map) {
        console.log('🎯 Initialisation de FamilyTownsStore');
        this.map = map;
        this.markerDisplayManager.initializeCluster(map, this.createClusterMarker);

        if (!this.markerDisplayManager.isInitialized()) {
            console.warn('❌ Échec de l’init du clustering');
        }
    }

    createClusterMarker({ count, position }) {
        const div = document.createElement('div');
        div.className = 'family-cluster-marker';
        div.style.cssText = `
            background: #4B5563;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        div.innerHTML = `<span>${count}</span>`;

        return new google.maps.marker.AdvancedMarkerElement({
            position,
            content: div
        });
    }

    // InfoWindow Management
    handleMarkerClick(marker, normalizedTownName) {
        const townData = this.townsData.get(normalizedTownName);
        if (!townData) return;

        let content = this.infoWindowContentCache.get(normalizedTownName);
        if (!content) {
            content = infoWindowContentManager.createInfoWindowContent(
                townData.townDisplay || townData.town,
                townData
            );
            this.infoWindowContentCache.set(normalizedTownName, content);
        }

        infoWindowDisplayManager.showInfoWindow(marker, content);
    }

    /**
     * Processes and adds/updates events for a town
     * Handles event deduplication and standardization
     * @param {Object} town - Town object
     * @param {Object} eventData - Event data to process
     */
    updateTownEvents(town, eventData) {
        if (!eventData?.type || !town?.events) {
            console.log('❌ Invalid event or town structure:', { eventData, town });
            return;
        }

        // Standardize event types to lowercase only
        const validEventTypes = ['birth', 'death', 'marriage', 'burial', 'occupation', 'event'];

        if (!validEventTypes.includes(eventData.type)) {
            console.log('❌ Unrecognized event type:', eventData.type);
            return;
        }

        const enrichedEvent = {
            ...eventData,
            personDetails: { ...eventData.personDetails }
        };

        // Add or update event in standardized type
        if (!Array.isArray(town.events[eventData.type])) {
            town.events[eventData.type] = observable([]);
        }

        const existingIndex = town.events[eventData.type].findIndex(
            e => e.personId === enrichedEvent.personId && e.date === enrichedEvent.date
        );

        if (existingIndex !== -1) {
            town.events[eventData.type][existingIndex] = enrichedEvent;
        } else {
            town.events[eventData.type].push(enrichedEvent);
        }
    }
}

// Export singleton instance
export default new FamilyTownsStore();