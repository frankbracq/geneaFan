import { makeObservable, observable, action, reaction, runInAction } from '../../../common/stores/mobx-config.js';
import { infoWindowDisplayManager } from '../managers/infoWindowDisplayManager.js';
import { infoWindowContentManager } from '../managers/infoWindowContentManager.js';
import familyTownsStore from './familyTownsStore.js';
import MarkerDisplayManager from '../managers/markerDisplayManager.js';
import { storeEvents, EVENTS } from '../../../common/stores/storeEvents.js';
import { googleMapsStore } from './googleMapsStore.js';
import { layerManager } from '../managers/layerManager.js';

/**
 * Store that dynamically filters and displays towns on a Google Map based on genealogical events
 * (births, marriages, deaths) associated with a specific surname.
 * 
 * Key features:
 * - Filters towns to show only those with events matching the selected surname
 * - Tracks birth events to identify native locations for each family
 * - Monitors marriage events for both spouses' surnames
 * - Identifies native deaths (people who died in their birth town)
 * - Provides clustering support for better visualization when multiple markers are close
 * - Updates markers and statistics in real-time when surname selection changes
 */
class SurnamesTownsStore {
    constructor() {
        // Manager for handling marker display and clustering
        this.markerDisplayManager = new MarkerDisplayManager();
        // Currently selected surname for filtering
        this.currentSurname = null;
        // Reference to the Google Map instance
        this.map = null;
        // Cache of marker configurations
        this.markerConfigs = new Map();
        // Set of MobX reaction disposers
        this.disposers = new Set();

        // Configure MobX observables and actions
        makeObservable(this, {
            currentSurname: observable,

            setSurname: action.bound,
            toggleVisibility: action,
            applyVisibility: action
        });


        // React to changes in towns data to update surnames list
        const disposer = reaction(
            () => familyTownsStore.townsData.size,
            () => {
                this.updateSurnamesList();
            },
            {
                name: 'SurnamesListUpdate'
            }
        );

        this.disposers.add(disposer);

        // Écouteur pour les changements de calque
        const layerChangeDisposer = storeEvents.subscribe(
            EVENTS.VISUALIZATIONS.MAP.LAYERS.CHANGED,
            (data) => {
                if (data.layer === 'surnames') {
                    this.applyVisibility(data.state);
                }
            }
        );

        this.disposers.add(layerChangeDisposer);
    }


    /**
     * Initializes the store with a Google Map instance
     * @param {google.maps.Map} map - Google Maps instance
     */
    initialize(map) {
        this.map = map;
        this.markerDisplayManager.initializeCluster(map, this.createClusterMarker);
    }

    /**
     * Creates a custom cluster marker for grouped markers
     * @param {Object} param0 - Cluster parameters
     * @param {number} param0.count - Number of markers in cluster
     * @param {google.maps.LatLng} param0.position - Position of cluster
     * @returns {google.maps.marker.AdvancedMarkerElement}
     */
    createClusterMarker({ count, position }) {
        const div = document.createElement('div');
        div.className = 'surname-cluster-marker';
        div.style.cssText = `
            background: #F4B400;
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

    /**
     * Sets the current surname filter and updates markers accordingly
     * @param {string} surname - Surname to filter by
     */
    // Dans la méthode setSurname, confirmez que le patronyme est défini
    setSurname(surname) {
        console.log(`🏁 setSurname appelé avec: "${surname}"`);
        
        // Mémoriser l'ancien patronyme
        const previousSurname = this.currentSurname;
        
        // Mettre à jour le patronyme actuel
        this.currentSurname = surname;
    
        if (surname) {
            console.log(`⚙️ Mise à jour des marqueurs pour le patronyme: ${surname}`);
            
            // 1. Nettoyer les marqueurs existants
            this.clearSurnameMarkers();
            
            // 2. Créer les nouveaux marqueurs
            this.updateMarkersForSurname(surname);
            
            // 3. Si le calque est déjà visible, afficher les nouveaux marqueurs
            if (this.map && layerManager.isLayerVisible('surnames')) {
                console.log('🔄 Calque des patronymes actif, affichage des nouveaux marqueurs');
                
                const layerMarkers = this.markerDisplayManager.layers.get('surnames');
                if (layerMarkers) {
                    layerMarkers.forEach(marker => {
                        marker.map = this.map;
                    });
                    
                    // Ajouter au cluster
                    this.markerDisplayManager.addMarkersToCluster(this.map);
                }
            }
        } else {
            console.log('❌ Pas de patronyme sélectionné, masquage des marqueurs');
            this.clearSurnameMarkers();
        }
    }

    clearSurnameMarkers() {
        console.log('🧹 Nettoyage des marqueurs de patronyme existants');
        
        // 1. Supprimer les marqueurs existants de la carte
        const existingMarkers = this.markerDisplayManager.layers.get('surnames');
        if (existingMarkers) {
            existingMarkers.forEach(marker => {
                marker.map = null;
            });
        }
        
        // 2. Vider la collection de marqueurs
        if (this.markerDisplayManager.layers.has('surnames')) {
            this.markerDisplayManager.layers.set('surnames', new Map());
        }
        
        // 3. Vider le cache des configurations
        this.markerConfigs.clear();
        
        // 4. Vider le cluster s'il existe
        if (this.markerDisplayManager.cluster) {
            this.markerDisplayManager.cluster.clearMarkers();
        }
    }

    /**
     * Creates a marker configuration for a town
     * @param {string} townName - Name of the town
     * @param {Object} townData - Town data including events and coordinates
     * @returns {Object} Marker configuration
     */
    createMarkerConfig(townName, townData) {
        const config = {
            position: new google.maps.LatLng(townData.latitude, townData.longitude),
            options: {
                content: this.createMarkerElement(townData),
                title: townData.townDisplay || townData.town
            }
        };

        this.markerConfigs.set(townName, config);
        return config;
    }

    /**
     * Gets or creates a marker for a town
     * @param {string} townName - Name of the town
     * @param {Object} townData - Town data
     * @returns {google.maps.marker.AdvancedMarkerElement}
     */
    getOrCreateMarker(townName, townData) {
        console.log(`🏙️ Création/récupération du marqueur pour: ${townName}`);
        const marker = this.markerDisplayManager.getOrCreateMarker(
            'surnames',
            townName,
            townData,
            (data) => this.createMarkerElement(data),
            (marker) => this.handleMarkerClick(marker, townName, townData)
        );
        console.log(`🏙️ Marqueur obtenu: ${marker ? 'Oui' : 'Non'}`);
        return marker;
    }

    updateMarkersForSurname(surname) {
        console.log(`🔄 updateMarkersForSurname appelé pour: ${surname}`);
        
        const townsWithSurname = new Map();
    
        // Filter towns to only include those with events matching the surname
        familyTownsStore.townsData.forEach((townData, townName) => {
            const surnameEvents = this.filterEventsBySurname(townData.events, surname);
            if (surnameEvents.length > 0) {
                townsWithSurname.set(townName, {
                    ...townData,
                    events: surnameEvents
                });
            }
        });
    
        console.log(`📍 ${townsWithSurname.size} villes trouvées pour le patronyme ${surname}`);
        
        // Créer les nouveaux marqueurs
        this.updateMarkers(townsWithSurname);
    }

    /**
     * Filters genealogical events by surname
     * @param {Object} events - Object containing birth, death, and marriage events
     * @param {string} surname - Surname to filter by
     * @returns {Array} Filtered events
     */
    filterEventsBySurname(events, surname) {
        console.log(`🔍 Filtrage des événements pour le patronyme: ${surname}`);
        console.log('📊 Événements disponibles:', {
            birth: events.birth?.length || 0,
            death: events.death?.length || 0,
            marriage: events.marriage?.length || 0
        });
        
        const filteredEvents = {
            birth: (events.birth || []).filter(e => e.personDetails?.surname === surname),
            death: (events.death || []).filter(e => e.personDetails?.surname === surname),
            marriage: (events.marriage || []).filter(e =>
                e.personDetails?.surname === surname ||
                e.spouseDetails?.surname === surname
            )
        };
        
        console.log('📊 Événements filtrés:', {
            birth: filteredEvents.birth.length,
            death: filteredEvents.death.length,
            marriage: filteredEvents.marriage.length,
            total: filteredEvents.birth.length + filteredEvents.death.length + filteredEvents.marriage.length
        });
        
        return Object.values(filteredEvents).flat();
    }

    /**
     * Updates map markers based on filtered town data
     * @param {Map} townsData - Map of filtered town data
     */
    updateMarkers(townsData) {
        if (!this.map) return;

        if (!this.markerDisplayManager.isInitialized()) {
            this.markerDisplayManager.initializeCluster(this.map, this.createClusterMarker);
        }

        townsData.forEach((townData, townName) => {
            this.getOrCreateMarker(townName, townData);
        });
    }

    /**
     * Creates a custom marker element for a town
     * @param {Object} townData - Town data including events
     * @returns {HTMLElement} Marker element
     */
    createMarkerElement(townData) {
        const div = document.createElement('div');
        div.className = 'surname-town-marker';
        div.style.cssText = `
            background: #F4B400;
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

    /**
     * Handles marker click events
     * Calculates statistics and displays info window
     * @param {google.maps.marker.AdvancedMarkerElement} marker - Clicked marker
     * @param {string} townName - Name of the town
     * @param {Object} townData - Town data including events
     */
    handleMarkerClick(marker, townName, townData) {
        // Log original town data for debugging
        console.log('🏁 Données originales de la ville:', {
            ...townData,
            events: {
                all: townData.events,
                birth: townData.events.filter(e => e.type === 'birth'),
                death: townData.events.filter(e => e.type === 'death'),
                marriage: townData.events.filter(e => e.type === 'marriage')
            }
        });
        console.log('👉 Patronyme recherché:', this.currentSurname);

        // Group events by type
        const events = townData.events || [];
        const groupedEvents = {
            birth: events.filter(e => e.type === 'birth'),
            death: events.filter(e => e.type === 'death'),
            marriage: events.filter(e => e.type === 'marriage')
        };

        // Filter events by current surname
        const filteredEvents = {
            birth: groupedEvents.birth.filter(e => e.personDetails?.surname === this.currentSurname),
            death: groupedEvents.death.filter(e => e.personDetails?.surname === this.currentSurname),
            marriage: groupedEvents.marriage.filter(e =>
                e.personDetails?.surname === this.currentSurname ||
                e.spouseDetails?.surname === this.currentSurname
            )
        };

        // Calculate native deaths (people born and died in the same town)
        const nativeDeaths = filteredEvents.death.filter(deathEvent => {
            const isNative = filteredEvents.birth.some(birthEvent =>
                birthEvent.personDetails?.id === deathEvent.personDetails?.id
            );
            console.log('👶 Vérification natif décédé:', {
                personId: deathEvent.personDetails?.id,
                surname: deathEvent.personDetails?.surname,
                isNative
            });
            return isNative;
        }).length;

        // Prepare data for info window
        const filteredData = {
            ...townData,
            events: filteredEvents,
            localBirths: filteredEvents.birth.length,
            localDeaths: filteredEvents.death.length,
            nativeDeaths: nativeDeaths,
            localMarriages: filteredEvents.marriage.length,
            filter: `Patronyme : ${this.currentSurname}`
        };

        // Log final statistics
        console.log('📊 Statistiques finales:', {
            patronyme: this.currentSurname,
            naissances: filteredData.localBirths,
            deces: filteredData.localDeaths,
            natifsDecedes: filteredData.nativeDeaths,
            mariages: filteredData.localMarriages
        });

        // Create and display info window
        const content = infoWindowContentManager.createInfoWindowContent(
            townData.townDisplay || townData.town,
            filteredData
        );

        infoWindowDisplayManager.showInfoWindow(marker, content);
    }

    // Modifier toggleVisibility
    toggleVisibility(visible) {
        // Déléguer la gestion de l'état au service centralisé
        layerManager.setLayerVisibility('surnames', visible);
    }

    // Nouvelle méthode pour appliquer la visibilité
    applyVisibility(visible) {
        console.log(`🔄 applyVisibility appelé avec visible=${visible}, surname=${this.currentSurname}`);
        
        if (this.map) {
            if (visible) {
                // Si le calque est activé mais aucun patronyme n'est sélectionné,
                // sélectionner automatiquement le premier
                if (!this.currentSurname) {
                    const select = document.getElementById('surnameFilter');
                    if (select && select.options.length > 1) {  // > 1 car la première option est vide
                        const firstSurname = select.options[1].value;
                        console.log(`🔄 Sélection automatique du patronyme: ${firstSurname}`);
                        
                        // Mettre à jour le menu déroulant
                        select.value = firstSurname;
                        
                        // Mettre à jour le store
                        this.currentSurname = firstSurname;
                        this.updateMarkersForSurname(firstSurname);
                    }
                } else {
                    // S'assurer que le menu déroulant affiche le patronyme actuel
                    const select = document.getElementById('surnameFilter');
                    if (select && select.value !== this.currentSurname) {
                        select.value = this.currentSurname;
                    }
                }
                
                if (this.currentSurname) {
                    console.log('🔍 Activation du calque des patronymes');
                    
                    // Mettre à jour les marqueurs basés sur le patronyme sélectionné
                    this.updateMarkersForSurname(this.currentSurname);
                    
                    // Vérifier si des marqueurs ont été créés
                    const layerMarkers = this.markerDisplayManager.layers.get('surnames');
                    const markerCount = layerMarkers ? layerMarkers.size : 0;
                    console.log(`🔢 Nombre de marqueurs pour ce patronyme: ${markerCount}`);
                    
                    if (layerMarkers && markerCount > 0) {
                        console.log('🔄 Définition de la visibilité des marqueurs');
                        layerMarkers.forEach(marker => {
                            marker.map = this.map;
                        });
                        
                        // Ajouter au cluster
                        console.log('🔄 Ajout des marqueurs au cluster');
                        this.markerDisplayManager.addMarkersToCluster(this.map);
                    } else {
                        console.log('⚠️ Aucun marqueur trouvé pour ce patronyme');
                    }
                } else {
                    console.warn('⚠️ Le calque est activé mais aucun patronyme n\'est disponible');
                }
            } else {
                console.log('🔍 Désactivation du calque des patronymes');
                this.markerDisplayManager.toggleLayerVisibility('surnames', false, this.map);
            }
        }
    }

    /**
     * Cleans up resources and resets store state
     */
    cleanup() {
        this.markerDisplayManager.toggleLayerVisibility('surnames', false, this.map);
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
        this.currentSurname = null;
        this.map = null;
    }

    /**
 * Updates the surnames dropdown list based on birth events
 * Calculates frequency of each surname and sorts by occurrence
 */
updateSurnamesList() {
    const surnamesCount = new Map();

    // Count occurrences of each surname in birth events
    familyTownsStore.townsData.forEach(townData => {
        if (townData.events && townData.events.birth) {
            townData.events.birth.forEach(event => {
                const surname = event.personDetails?.surname;
                if (surname) {
                    surnamesCount.set(surname, (surnamesCount.get(surname) || 0) + 1);
                }
            });
        }
    });

    // Sort surnames by frequency
    const sortedSurnames = [...surnamesCount.entries()]
        .sort((a, b) => b[1] - a[1]);

    // Update dropdown element
    const select = document.getElementById('surnameFilter');
    if (select) {
        select.innerHTML = `
            <option value="">Sélectionner un patronyme...</option>
            ${sortedSurnames.map(([surname, count]) =>
            `<option value="${surname}">${surname.toUpperCase()} (${count})</option>`
        ).join('')}
        `;
        
        // Sélectionner automatiquement le premier patronyme de la liste s'il y en a
        if (sortedSurnames.length > 0) {
            const firstSurname = sortedSurnames[0][0];
            console.log(`🔄 Sélection automatique du patronyme le plus fréquent: ${firstSurname}`);
            
            // Mettre à jour le menu déroulant
            select.value = firstSurname;
            
            // Mettre à jour le store
            this.setSurname(firstSurname);
            
            // Déclencher l'événement change pour que d'autres écouteurs puissent réagir
            const changeEvent = new Event('change');
            select.dispatchEvent(changeEvent);
        }
    }
}

    /**
     * Checks if the store is properly initialized
     * @returns {boolean} Initialization status
     */
    isInitialized() {
        return this.map && this.markerDisplayManager.isInitialized();
    }
}

// Create singleton instance
const surnamesTownsStore = new SurnamesTownsStore();
export default surnamesTownsStore;