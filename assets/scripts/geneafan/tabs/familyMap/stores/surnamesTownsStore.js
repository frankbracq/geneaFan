import { makeObservable, observable, action, reaction, runInAction } from '../../../common/stores/mobx-config.js';
import { infoWindowDisplayManager } from '../managers/infoWindowDisplayManager.js';
import { infoWindowContentManager } from '../managers/infoWindowContentManager.js';
import familyTownsStore from './familyTownsStore.js';
import MarkerDisplayManager from '../managers/markerDisplayManager.js';
import { storeEvents, EVENTS } from '../../../common/stores/storeEvents.js';
import { googleMapsStore } from './googleMapsStore.js'; 

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

        this.isVisible = false; // Toujours désactivé par défaut

        // Configure MobX observables and actions
        makeObservable(this, {
            currentSurname: observable,

            setSurname: action.bound,
            isVisible: observable,
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
                    runInAction(() => {
                        this.isVisible = data.state;
                    });
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
    setSurname(surname) {
        this.currentSurname = surname;
        if (surname) {
            this.updateMarkersForSurname(surname);
        } else {
            this.markerDisplayManager.toggleLayerVisibility('surnames', false, this.map);
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
        return this.markerDisplayManager.getOrCreateMarker(
            'surnames',
            townName,
            townData,
            (data) => this.createMarkerElement(data),
            (marker) => this.handleMarkerClick(marker, townName, townData)
        );
    }

    /**
     * Updates markers for a specific surname
     * @param {string} surname - Surname to filter events by
     */
    updateMarkersForSurname(surname) {
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

        this.updateMarkers(townsWithSurname);
    }

    /**
     * Filters genealogical events by surname
     * @param {Object} events - Object containing birth, death, and marriage events
     * @param {string} surname - Surname to filter by
     * @returns {Array} Filtered events
     */
    filterEventsBySurname(events, surname) {
        const filteredEvents = {
            birth: (events.birth || []).filter(e => e.personDetails?.surname === surname),
            death: (events.death || []).filter(e => e.personDetails?.surname === surname),
            marriage: (events.marriage || []).filter(e =>
                e.personDetails?.surname === surname ||
                e.spouseDetails?.surname === surname
            )
        };

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

        this.markerDisplayManager.toggleLayerVisibility('surnames', true, this.map);
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
        // Mettre à jour la source de vérité
        googleMapsStore.setLayerState('surnames', visible);
    }

    // Nouvelle méthode pour appliquer la visibilité
    applyVisibility(visible) {
        if (this.map) {
            if (visible && this.currentSurname) {
                this.updateMarkersForSurname(this.currentSurname);

                setTimeout(() => {
                    this.markerDisplayManager.addMarkersToCluster(this.map);
                }, 200);
            } else {
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