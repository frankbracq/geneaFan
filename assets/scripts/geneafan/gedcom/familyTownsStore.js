import { makeObservable, observable, action, computed, runInAction, toJS, autorun } from '../common/stores/mobx-config.js';
import { eventBus } from '../tabs/familyMap/eventBus.js';

class FamilyTownsStore {
    #pendingTowns = [];
    #isGoogleMapsReady = false;
    #map = null;

    constructor() {
        this.townsData = new Map();
        this.isLoading = false;
        this.townMarkers = new Map();

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
                eventBus.emit('familyTownsUpdated', this.townsData);
            }
        });
    }

    initialize(map) {
        this.#map = map;
        this.#isGoogleMapsReady = true;
        
        if (this.#pendingTowns.length > 0) {
            this.processPendingTowns();
        }
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

    addTown = (key, townData) => {
        runInAction(() => {
            this.townsData.set(key, {
                town: townData.town || '',
                townDisplay: townData.townDisplay || townData.town || '',
                departement: townData.departement || '',
                departementColor: townData.departementColor || '',
                country: townData.country || '',
                countryCode: townData.countryCode || '',
                countryColor: townData.countryColor || '',
                latitude: townData.latitude || '',
                longitude: townData.longitude || ''
            });
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
        townsData.forEach((townData, townName) => {
            if (townData.latitude && townData.longitude) {
                this.createTownMarker(townName, townData);
            }
        });
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
            map: this.#map,
            title: townName,
            content: element
        });

        this.townMarkers.set(townName, marker);
    }

    processPendingTowns() {
        while (this.#pendingTowns.length > 0) {
            const townsData = this.#pendingTowns.shift();
            this.createMarkers(townsData);
        }
    }

    clearMarkers() {
        this.townMarkers.forEach(marker => marker.map = null);
        this.townMarkers.clear();
    }

    cleanup() {
        this.clearMarkers();
        this.#pendingTowns = [];
        this.#isGoogleMapsReady = false;
        this.#map = null;
    }

    updateTownsViaProxy = async () => {
        console.log('Starting geocoding process...');
        runInAction(() => {
            this.isLoading = true;
        });

        try {
            const townsToUpdate = {};
            this.townsData.forEach((town, key) => {
                if (((town.country === 'France' || town.country === 'FR' || town.country === '') &&
                    ((town.departement && town.departement.length === 2) || !town.departement || !town.latitude || !town.longitude)) ||
                    ((town.country !== 'France' && town.country !== 'FR' && town.country !== '') && (!town.latitude || !town.longitude))) {
                    townsToUpdate[key] = this.cleanData(town);
                }
            });

            if (Object.keys(townsToUpdate).length === 0) {
                console.log('No towns need updating');
                return;
            }

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

        } catch (error) {
            console.error('Error updating towns:', error);
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });
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

    // Toggle visibility of all family town markers on the map
    toggleVisibility = (isVisible) => {
        this.townMarkers.forEach(marker => {
            marker.map = isVisible ? this.#map : null;
        });
    }

    get totalTowns() {
        return this.townsData.size;
    }
}

const familyTownsStore = new FamilyTownsStore();
export default familyTownsStore;