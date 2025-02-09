import { makeObservable, observable, action, reaction } from '../../common/stores/mobx-config.js';
import { infoWindowDisplayManager } from './infoWindowDisplayManager.js';
import familyTownsStore from '../../gedcom/stores/familyTownsStore.js';
import MarkerDisplayManager from './markerDisplayManager.js';

class SurnamesTownsStore {
    constructor() {
        this.markerDisplayManager = new MarkerDisplayManager();
        this.currentSurname = null;
        this.map = null;
        this.markerConfigs = new Map();
        this.disposers = new Set();

        makeObservable(this, {
            currentSurname: observable,
            toggleVisibility: action,
            setSurname: action.bound
        });

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
    }

    initialize(map) {
        this.map = map;
    }

    setSurname(surname) {
        this.currentSurname = surname;
        if (surname) {
            this.updateMarkersForSurname(surname);
        } else {
            this.markerDisplayManager.toggleLayerVisibility('surnames', false, this.map);
        }
    }

    createMarkerConfig(townName, townData) {
        if (!townData.coordinates) return null;

        const config = {
            position: new google.maps.LatLng(townData.coordinates.lat, townData.coordinates.lng),
            options: {
                content: this.createMarkerElement(townData),
                title: townName
            }
        };
        
        this.markerConfigs.set(townName, config);
        return config;
    }

    getOrCreateMarker(townName, townData) {
        let config = this.markerConfigs.get(townName);
        
        if (!config) {
            config = this.createMarkerConfig(townName, townData);
            if (!config) return null;
        }

        return this.markerDisplayManager.addMarker(
            'surnames',
            townName,
            config.position,
            {
                content: this.createMarkerElement(townData),
                title: townName
            },
            (marker) => this.handleMarkerClick(marker, townName, townData)
        );
    }

    updateMarkersForSurname(surname) {
        const townsWithSurname = new Map();

        familyTownsStore.townsData.forEach((townData, townName) => {
            const surnameEvents = this.filterEventsBySurname(townData.events, surname);
            if (surnameEvents.length > 0) {
                townsWithSurname.set(townName, {
                    ...townData,
                    events: surnameEvents,
                    coordinates: {
                        lat: townData.latitude,
                        lng: townData.longitude
                    }
                });
            }
        });

        this.updateMarkers(townsWithSurname);
    }

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

    updateMarkers(townsData) {
        this.markerDisplayManager.toggleLayerVisibility('surnames', false, this.map);
        this.markerConfigs.clear();

        townsData.forEach((townData, townName) => {
            this.getOrCreateMarker(townName, townData);
        });

        this.markerDisplayManager.toggleLayerVisibility('surnames', true, this.map);
    }

    createMarkerElement(townData) {
        const div = document.createElement('div');
        div.className = 'surname-town-marker';
        div.innerHTML = `<span>${townData.events.length}</span>`;
        return div;
    }

    handleMarkerClick(marker, townName, townData) {
        const content = infoWindowDisplayManager.createInfoWindowContent(
            townName,
            [
                { label: "Événements", value: townData.events.length },
                { label: "Patronyme", value: this.currentSurname }
            ]
        );

        infoWindowDisplayManager.showInfoWindow(marker, content);
    }

    toggleVisibility(visible) {
        if (visible && this.currentSurname) {
            this.updateMarkersForSurname(this.currentSurname);
        } else {
            this.markerDisplayManager.toggleLayerVisibility('surnames', false, this.map);
        }
    }

    cleanup() {
        this.markerDisplayManager.toggleLayerVisibility('surnames', false, this.map);
        this.disposers.forEach(disposer => disposer());
        this.disposers.clear();
        this.currentSurname = null;
        this.map = null;
    }

    updateSurnamesList() {
        const surnamesCount = new Map();
        
        familyTownsStore.townsData.forEach(townData => {
            townData.events.birth?.forEach(event => {
                const surname = event.personDetails?.surname;
                if (surname) {
                    surnamesCount.set(surname, (surnamesCount.get(surname) || 0) + 1);
                }
            });
        });

        const sortedSurnames = [...surnamesCount.entries()]
            .sort((a, b) => b[1] - a[1]);

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
}

const surnamesTownsStore = new SurnamesTownsStore();
export default surnamesTownsStore;