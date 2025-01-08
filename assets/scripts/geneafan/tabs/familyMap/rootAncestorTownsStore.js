import { makeObservable, observable, action, autorun } from '../../common/stores/mobx-config.js';
import MarkerManager from './markerManager.js';
import { infoWindowManager } from './infoWindowManager.js';
import { markerLogger } from './markerLogger.js';

class RootAncestorTownsStore {
    constructor() {
        this.markerManager = new MarkerManager();
        this.map = null;
        this.birthData = [];
        this.isVisible = true;

        makeObservable(this, {
            birthData: observable,
            map: observable.ref,
            isVisible: observable,
            initialize: action,
            updateMarkers: action,
            clearMarkers: action,
            toggleVisibility: action,
        });
    }

    initialize(map) {
        console.log('Initializing RootAncestorTownsStore with map');
        this.map = map;
        this.markerManager.initializeCluster(map, this.renderCluster.bind(this));
        
        // Si nous avons déjà des données, mettons à jour les marqueurs
        if (this.birthData.length > 0) {
            this.updateMarkers(this.birthData);
        }
    }

    createMarker(location, births, generations) {
        if (!location || !location.lat || !location.lng) {
            console.warn('Invalid location data', location);
            return;
        }

        const key = `${location.lat}-${location.lng}-${location.name}`;
        const position = new google.maps.LatLng(location.lat, location.lng);
        const content = this.renderMarkerContent(location, births);

        return this.markerManager.addMarkerToLayer(
            'rootAncestors',
            key,
            position,
            { content, title: births.map(b => b.name).join(', ') },
            (marker) => {
                infoWindowManager.showInfoWindow(marker, location, births, generations);
            }
        );
    }

    renderMarkerContent(location, births) {
        const element = document.createElement('div');
        element.className = 'custom-marker';
        element.style.background = infoWindowManager.getBranchColor(births);
        element.style.borderRadius = '50%';
        element.style.width = '16px';
        element.style.height = '16px';
        element.style.border = '1px solid #1e40af';
        return element;
    }

    updateMarkers(birthData) {
        console.log('Updating markers with:', { dataCount: birthData?.length });
        this.birthData = birthData;
        this.clearMarkers();
    
        const locationMap = this.groupBirthDataByLocation(birthData);
        console.log('Processed locations for markers:', locationMap);
    
        locationMap.forEach((locationData) => {
            console.log('Creating marker for location:', locationData.location);
            this.createMarker(locationData.location, locationData.births, locationData.generations);
        });
    
        // Si le layer est visible, afficher les marqueurs
        if (this.isVisible && this.map) {
            this.markerManager.toggleLayerVisibility('rootAncestors', true, this.map);
        }
    }

    clearMarkers() {
        this.markerManager.clearMarkers();
    }

    toggleVisibility(visible) {
        this.isVisible = visible;
        if (this.map) {
            this.markerManager.toggleLayerVisibility('rootAncestors', visible, this.map);
        }
    }

    groupBirthDataByLocation(data) {
        return new Map(
            data.reduce((acc, birth) => {
                if (!birth.location?.lat || !birth.location?.lng || !birth.location?.name) {
                    console.warn(`Invalid location data for ${birth.name}`);
                    return acc;
                }

                const key = `${birth.location.lat}-${birth.location.lng}-${birth.location.name}`;
                const existing = acc.get(key) || {
                    location: birth.location,
                    births: [],
                    generations: {}
                };

                existing.births.push(birth);
                existing.generations[birth.generation] = [...(existing.generations[birth.generation] || []), birth];

                return acc.set(key, existing);
            }, new Map())
        );
    }

    renderCluster({ count, position }) {
        const element = document.createElement('div');
        element.className = 'cluster-marker';
        element.style.background = '#1e40af';
        element.style.borderRadius = '50%';
        element.style.width = `${Math.min(count * 3, 20) * 2}px`;
        element.style.height = `${Math.min(count * 3, 20) * 2}px`;
        element.style.color = 'white';
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.textContent = count;

        return new google.maps.marker.AdvancedMarkerElement({
            position,
            content: element
        });
    }

    cleanup() {
        this.clearMarkers();
        this.map = null;
        this.markerManager.cleanup();
    }
}

export const rootAncestorTownsStore = new RootAncestorTownsStore();
