/*
Gère l'ensemble des villes du fichier GEDCOM
Traite tous types d'événements (naissances, mariages, décès)
Fournit un calque de contexte global pour la carte
*/

import { makeObservable, observable, action, computed, runInAction, toJS, autorun } from '../common/stores/mobx-config.js';
import { MarkerClusterer } from "@googlemaps/markerclusterer";

class FamilyTownsStore {
    #pendingTowns = [];
    #isGoogleMapsReady = false;
    #map = null;
    #markerCluster = null;

    constructor() {
        this.townsData = new Map();
        this.isLoading = false;
        this.townMarkers = new Map();
        this.isVisible = false; // Désactivé par défaut

        makeObservable(this, {
            townsData: observable,
            isLoading: observable,
            townMarkers: observable,
            setTownsData: action,
            addTown: action,
            updateTown: action,
            totalTowns: computed
        });

        autorun(() => {
            if (this.townsData.size > 0) {
                this.createMarkers(this.townsData);
            }
        });
    }

    initialize(map) {
        this.#map = map;
        this.#isGoogleMapsReady = true;
        this.initializeCluster();
        
        if (this.#pendingTowns.length > 0) {
            this.processPendingTowns();
        }
    }

    initializeCluster() {
        this.#markerCluster = new MarkerClusterer({
            map: this.isVisible ? this.#map : null, // Ne pas afficher si isVisible est false
            renderer: {
                render: this.renderCluster.bind(this)
            }
        });
    }

    renderCluster({ count, position }) {
        const element = document.createElement('div');
        element.className = 'cluster-marker';
        element.style.background = '#4B5563';  // Couleur par défaut pour les clusters
        element.style.borderRadius = '50%';
        element.style.width = `${Math.min(count * 3, 20) * 2}px`;
        element.style.height = `${Math.min(count * 3, 20) * 2}px`;
        element.style.border = '2px solid white';
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.style.color = 'white';
        element.style.fontSize = '12px';
        element.textContent = String(count);

        return new google.maps.marker.AdvancedMarkerElement({
            position,
            content: element,
            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count
        });
    }

    cleanData = (data) => {
        return toJS(data);
    }

    getTown = (key) => {
        const town = this.townsData.get(key);
        return town ? this.cleanData(town) : null;
    }

    getAllTowns = () => {
        return this.cleanData(Object.fromEntries(this.townsData));
    }

    setTownsData = (towns) => {
        runInAction(() => {
            this.townsData = new Map(Object.entries(towns));
        });
    }

    addTown = (key, townData, eventData = null) => {
        runInAction(() => {
            let town = this.townsData.get(key);
            
            if (!town) {
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
                    events: observable({
                        BIRT: observable([]),
                        DEAT: observable([]),
                        MARR: observable([]),
                        BURI: observable([]),
                        OCCU: observable([]),
                        EVEN: observable([])
                    })
                });
                this.townsData.set(key, town);
            }
    
            if (eventData && eventData.type && town.events[eventData.type]) {
                town.events[eventData.type] = observable([...town.events[eventData.type], eventData]);
            }
        });
    }

    updateTown = (key, updates) => {
        runInAction(() => {
            const town = this.townsData.get(key);
            if (town) {
                this.townsData.set(key, { ...town, ...updates });
            }
        });
    }

    createMarkers(townsData) {
        if (!this.#isGoogleMapsReady) {
            this.#pendingTowns.push(townsData);
            return;
        }

        this.clearMarkers();
        const markers = [];

        townsData.forEach((townData, townName) => {
            if (townData.latitude && townData.longitude) {
                const marker = this.createTownMarker(townName, townData);
                if (marker) {
                    this.townMarkers.set(townName, marker);
                    markers.push(marker);
                }
            }
        });

        if (this.#markerCluster) {
            this.#markerCluster.clearMarkers();
            this.#markerCluster.addMarkers(markers);
        }
    }

    createTownMarker(townName, townData) {
        if (!townData.latitude || !townData.longitude || !window.google?.maps || !this.#map) return;

        const position = new google.maps.LatLng(
            parseFloat(townData.latitude),
            parseFloat(townData.longitude)
        );

        const element = document.createElement('div');
        element.className = 'town-marker';
        element.style.background = townData.departementColor || '#4B5563';
        element.style.width = '24px';
        element.style.height = '24px';
        element.style.borderRadius = '50%';
        element.style.border = '2px solid white';

        const marker = new google.maps.marker.AdvancedMarkerElement({
            position,
            title: townName,
            content: element,
            map: this.isVisible ? this.#map : null // Ne pas afficher si isVisible est false
        });

        return marker;
    }

    processPendingTowns() {
        while (this.#pendingTowns.length > 0) {
            const townsData = this.#pendingTowns.shift();
            this.createMarkers(townsData);
        }
    }

    clearMarkers() {
        if (this.#markerCluster) {
            this.#markerCluster.clearMarkers();
        }
        this.townMarkers.forEach(marker => marker.map = null);
        this.townMarkers.clear();
    }

    cleanup() {
        this.clearMarkers();
        if (this.#markerCluster) {
            this.#markerCluster.clearMarkers();
            this.#markerCluster = null;
        }
        this.#pendingTowns = [];
        this.#isGoogleMapsReady = false;
        this.#map = null;
    }

    toggleVisibility = (isVisible) => {
        this.isVisible = isVisible;
        if (this.#markerCluster) {
            this.#markerCluster.setMap(isVisible ? this.#map : null);
        }
        // Mettre à jour la visibilité de tous les marqueurs individuels
        this.townMarkers.forEach(marker => {
            marker.map = isVisible ? this.#map : null;
        });
    }

    get totalTowns() {
        return this.townsData.size;
    }

    updateTownsViaProxy = async () => {
        console.log('Checking for towns needing geocoding...');
        try {
            // Identifier les villes qui ont besoin d'une mise à jour
            const townsToUpdate = {};
            let needsUpdate = false;
    
            this.townsData.forEach((town, key) => {
                if (!town.latitude || !town.longitude) {
                    townsToUpdate[key] = this.cleanData(town);
                    needsUpdate = true;
                }
            });
    
            if (!needsUpdate) {
                console.log('No towns need updating');
                return;
            }
    
            console.log(`Updating geocoding for ${Object.keys(townsToUpdate).length} towns...`);
            
            const response = await fetch('https://opencageproxy.genealogie.workers.dev/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    familyTowns: townsToUpdate,
                    userId: localStorage.getItem('userId')
                })
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const updatedTowns = await response.json();
            
            runInAction(() => {
                Object.entries(updatedTowns).forEach(([key, data]) => {
                    this.updateTown(key, data);
                });
                this.saveToLocalStorage();
            });
    
            console.log('Geocoding update completed');
    
        } catch (error) {
            console.error('Error updating towns:', error);
        }
    }

    loadFromLocalStorage = () => {
        try {
            const stored = localStorage.getItem('townsDB');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.setTownsData(parsed);
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }

    saveToLocalStorage = () => {
        try {
            const data = this.getAllTowns();
            localStorage.setItem('townsDB', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }
}

const familyTownsStore = new FamilyTownsStore();
export default familyTownsStore;