/*
Gère l'ensemble des villes du fichier GEDCOM
Traite tous types d'événements (naissances, mariages, décès)
Fournit un calque de contexte global pour la carte
*/

import { makeObservable, observable, action, computed, runInAction, toJS, autorun } from '../common/stores/mobx-config.js';
import MarkerManager from '../tabs/familyMap/markerManager.js';
import { infoWindowManager } from '../tabs/familyMap/infoWindowManager.js';

class FamilyTownsStore {
    constructor() {
        this.markerManager = new MarkerManager();
        this.townsData = new Map();
        this.isLoading = false;
        this.isVisible = false; // Désactivé par défaut
        this.map = null;

        makeObservable(this, {
            townsData: observable,
            isLoading: observable,
            isVisible: observable,
            setTownsData: action,
            addTown: action,
            updateTown: action,
            toggleVisibility: action,
            hasActiveMarkers: action,
            totalTowns: computed
        });

        autorun(() => {
            if (this.map && (this.townsData.size > 0 || this.isVisible)) {
                console.log('FamilyTownsStore autorun triggered:', {
                    dataSize: this.townsData.size,
                    isVisible: this.isVisible,
                    hasMap: !!this.map
                });
                this.updateMarkers();
            }
        });
    }

    initialize(map) {
        console.log('Initializing FamilyTownsStore with map');
        this.map = map;
        this.markerManager.initializeCluster(map, this.renderCluster.bind(this));

        // Si nous avons déjà des données, mettons à jour les marqueurs
        if (this.townsData.size > 0) {
            this.updateMarkers();
        }
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

    createMarker(townName, townData) {
        console.log('Creating marker for:', {
            townName,
            coordinates: {
                lat: townData.latitude,
                lng: townData.longitude
            },
            departement: townData.departement,
            fullData: townData
        });

        if (!townData.latitude || !townData.longitude) {
            console.warn(`Missing coordinates for town: ${townName}`);
            return;
        }

        const key = `${townData.latitude}-${townData.longitude}-${townName}`;
        console.log(`Generated key: ${key}`);
        
        try {
            const position = new google.maps.LatLng(
                parseFloat(townData.latitude),
                parseFloat(townData.longitude)
            );
            console.log('Position created:', position.toString());

            const element = document.createElement('div');
            element.className = 'town-marker';
            element.style.background = townData.departementColor || '#4B5563';
            element.style.width = '24px';
            element.style.height = '24px';
            element.style.borderRadius = '50%';
            element.style.border = '2px solid white';

            console.log('Marker element created');

            const marker = this.markerManager.addMarkerToLayer(
                'familyTowns',
                key,
                position,
                { content: element, title: townName },
                (marker) => {
                    this.onMarkerClick(marker, townData);
                }
            );

            console.log('Marker added to layer:', !!marker);
            return marker;

        } catch (error) {
            console.error('Error creating marker for town:', townName, error);
            return null;
        }
    }

    onMarkerClick(marker, townData) {
        const content = this.createInfoWindowContent(townData);
        infoWindowManager.showInfoWindow(marker, content);
    }

    createInfoWindowContent(townData) {
        const div = document.createElement('div');
        div.className = 'info-window-content p-4';

        // Ajouter le nom de la ville
        const townName = document.createElement('h3');
        townName.textContent = townData.townDisplay || townData.town;
        townName.className = 'font-bold text-lg mb-2';
        div.appendChild(townName);

        // Ajouter le département s'il existe
        if (townData.departement) {
            const deptDiv = document.createElement('div');
            deptDiv.className = 'text-sm text-gray-600';
            deptDiv.textContent = `Département: ${townData.departement}`;
            div.appendChild(deptDiv);
        }

        // Ajouter le pays s'il existe
        if (townData.country) {
            const countryDiv = document.createElement('div');
            countryDiv.className = 'text-sm text-gray-600';
            countryDiv.textContent = `Pays: ${townData.country}`;
            div.appendChild(countryDiv);
        }

        return div;
    }

    updateMarkers() {
        console.log('Updating family town markers', {
            dataSize: this.townsData.size,
            isVisible: this.isVisible,
            hasMap: !!this.map
        });
        
        this.markerManager.clearMarkers('familyTowns');
        let markersCreated = 0;
        console.log('TownsData:', Array.from(this.townsData.entries()));

        this.townsData.forEach((townData, townName) => {
            console.log('Processing town:', {
                name: townName,
                data: townData,
                hasLatitude: !!townData.latitude,
                hasLongitude: !!townData.longitude
            });
            
            if (townData.latitude && townData.longitude) {
                console.log('Creating marker for location:', {
                    name: townName,
                    lat: townData.latitude,
                    lng: townData.longitude,
                    departement: townData.departement
                });
                const marker = this.createMarker(townName, townData);
                if (marker) {
                    markersCreated++;
                    console.log(`Marker created successfully for ${townName}`);
                } else {
                    console.warn(`Failed to create marker for ${townName}`);
                }
            } else {
                console.warn(`Missing coordinates for town: ${townName}`, {
                    latitude: townData.latitude,
                    longitude: townData.longitude
                });
            }
        });

        console.log(`Created ${markersCreated} markers out of ${this.townsData.size} towns`);

        // Si le layer est visible, afficher les marqueurs
        if (this.isVisible && this.map) {
            console.log('Layer is visible, toggling visibility and updating clusters');
            this.markerManager.toggleLayerVisibility('familyTowns', true, this.map);
            this.markerManager.addMarkersToCluster(this.map);
        } else {
            console.log('Layer is not visible or map not ready', {
                isVisible: this.isVisible,
                hasMap: !!this.map
            });
        }
    }

    toggleVisibility = (isVisible) => {
        console.log(`Toggling family towns visibility: ${isVisible}`);
        this.isVisible = isVisible;
        if (this.map) {
            this.markerManager.toggleLayerVisibility('familyTowns', isVisible, this.map);
            if (isVisible) {
                this.markerManager.addMarkersToCluster(this.map);
            }
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

    cleanup() {
        this.markerManager.clearMarkers();
        this.markerManager.cleanup();
        this.map = null;
    }

    get totalTowns() {
        return this.townsData.size;
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
        console.log('Checking active markers:', hasMarkers);
        return hasMarkers;
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

// On exporte directement une instance de la classe
export default new FamilyTownsStore();