/*
Gère l'ensemble des villes du fichier GEDCOM
Traite tous types d'événements (naissances, mariages, décès)
Fournit un calque de contexte global pour la carte
*/

import { makeObservable, observable, action, computed, runInAction, autorun } from '../common/stores/mobx-config.js';
import MarkerManager from '../tabs/familyMap/markerManager.js';
import { infoWindowManager } from '../tabs/familyMap/infoWindowManager.js';

class FamilyTownsStore {
    constructor() {
        this.markerManager = new MarkerManager();
        this.townsData = new Map();
        this.isLoading = false;
        this.isVisible = false;
        this.map = null;

        makeObservable(this, {
            townsData: observable,
            isLoading: observable,
            isVisible: observable,
            setTownsData: action,
            addTown: action,
            updateTown: action,
            toggleVisibility: action,
            totalTowns: computed
        });

        autorun(() => {
            if (this.map && (this.townsData.size > 0 || this.isVisible)) {
                this.updateMarkers();
            }
        });
    }

    initialize(map) {
        this.map = map;
        this.markerManager.initializeCluster(map, this.renderCluster.bind(this));

        if (this.townsData.size > 0) {
            this.updateMarkers();
        }
    }

    setTownsData(towns) {
        runInAction(() => {
            this.townsData = new Map(Object.entries(towns));
        });
    }

    addTown(key, townData, eventData = null) {
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

    updateTown(key, updates) {
        runInAction(() => {
            const town = this.townsData.get(key);
            if (town) {
                this.townsData.set(key, { ...town, ...updates });
            }
        });
    }

    createMarker(townName, townData) {
        const key = `${townData.latitude}-${townData.longitude}-${townName}`;
        const position = new google.maps.LatLng(townData.latitude, townData.longitude);

        const marker = this.markerManager.addMarker(
            'familyTowns',
            key,
            position,
            {
                content: this.createMarkerContent(townData.departementColor),
                title: townName
            },
            (marker) => {
                const content = infoWindowManager.createInfoWindowContent(
                    townData.townDisplay || townName,
                    [
                        { label: 'Département', value: townData.departement },
                        { label: 'Pays', value: townData.country }
                    ]
                );
                infoWindowManager.showInfoWindow(marker, content);
            }
        );

        return marker;
    }

    createMarkerContent(color = '#4B5563') {
        const element = document.createElement('div');
        element.className = 'town-marker';
        element.style.background = color;
        element.style.width = '24px';
        element.style.height = '24px';
        element.style.borderRadius = '50%';
        element.style.border = '2px solid white';
        return element;
    }

    updateMarkers() {
        this.markerManager.clearMarkers('familyTowns');
        this.townsData.forEach((townData, townName) => {
            if (townData.latitude && townData.longitude) {
                this.createMarker(townName, townData);
            }
        });

        if (this.isVisible && this.map) {
            this.markerManager.toggleLayerVisibility('familyTowns', true, this.map);
            this.markerManager.addMarkersToCluster(this.map);
        }
    }

    hasActiveMarkers() {
        if (!this.markerManager) return false;
        let hasMarkers = false;
        this.markerManager.layers.forEach(layerMarkers => {
            layerMarkers.forEach(marker => {
                if (marker.map !== null) {
                    hasMarkers = true;
                }
            });
        });
        return hasMarkers;
    }

    getBounds() {
        if (!this.markerManager) return null;
        
        const bounds = new google.maps.LatLngBounds();
        let hasMarkers = false;

        this.markerManager.layers.forEach(layerMarkers => {
            layerMarkers.forEach(marker => {
                if (marker.map !== null) {
                    bounds.extend(marker.position);
                    hasMarkers = true;
                }
            });
        });

        return hasMarkers ? bounds : null;
    }

    toggleVisibility(isVisible) {
        this.isVisible = isVisible;
        if (this.map) {
            this.markerManager.toggleLayerVisibility('familyTowns', isVisible, this.map);
            if (isVisible) {
                this.markerManager.addMarkersToCluster(this.map);
            }
        }
    }

    renderCluster({ count, position }) {
        const element = document.createElement('div');
        element.className = 'cluster-marker';
        element.style.background = '#4B5563';
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

    cleanData(data) {
        return JSON.parse(JSON.stringify(data));
    }

    getTown(key) {
        const town = this.townsData.get(key);
        return town ? this.cleanData(town) : null;
    }

    getAllTowns() {
        return this.cleanData(Object.fromEntries(this.townsData));
    }

    cleanup() {
        this.markerManager.clearMarkers();
        this.markerManager.cleanup();
        this.map = null;
    }

    get totalTowns() {
        return this.townsData.size;
    }

    updateTownsViaProxy = async () => {
        try {
            const townsToUpdate = {};
            let needsUpdate = false;

            this.townsData.forEach((town, key) => {
                if (!town.latitude || !town.longitude) {
                    townsToUpdate[key] = this.cleanData(town);
                    needsUpdate = true;
                }
            });

            if (!needsUpdate) return;

            const response = await fetch('https://opencageproxy.genealogie.workers.dev/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    familyTowns: townsToUpdate,
                    userId: localStorage.getItem('userId')
                })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const updatedTowns = await response.json();
            runInAction(() => {
                Object.entries(updatedTowns).forEach(([key, data]) => {
                    this.updateTown(key, data);
                });
            });
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

export default new FamilyTownsStore();
