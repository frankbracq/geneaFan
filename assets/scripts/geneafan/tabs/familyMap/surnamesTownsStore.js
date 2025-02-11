import { makeObservable, observable, action, reaction } from '../../common/stores/mobx-config.js';
import { infoWindowDisplayManager } from './infoWindowDisplayManager.js';
import { infoWindowContentManager } from '../../gedcom/stores/infoWindowContentManager.js';
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
        this.markerDisplayManager.initializeCluster(map, this.createClusterMarker);
    }

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

    setSurname(surname) {
        this.currentSurname = surname;
        if (surname) {
            this.updateMarkersForSurname(surname);
        } else {
            this.markerDisplayManager.toggleLayerVisibility('surnames', false, this.map);
        }
    }

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

    getOrCreateMarker(townName, townData) {
        return this.markerDisplayManager.getOrCreateMarker(
            'surnames',
            townName,
            townData,
            (data) => this.createMarkerElement(data),
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
                    events: surnameEvents
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
        if (!this.map) return;

        if (!this.markerDisplayManager.isInitialized()) {
            this.markerDisplayManager.initializeCluster(this.map, this.createClusterMarker);
        }

        townsData.forEach((townData, townName) => {
            this.getOrCreateMarker(townName, townData);
        });

        this.markerDisplayManager.toggleLayerVisibility('surnames', true, this.map);
    }

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

    handleMarkerClick(marker, townName, townData) {
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

        const events = townData.events || [];
        const groupedEvents = {
            birth: events.filter(e => e.type === 'birth'),
            death: events.filter(e => e.type === 'death'),
            marriage: events.filter(e => e.type === 'marriage')
        };

        const filteredEvents = {
            birth: groupedEvents.birth.filter(e => e.personDetails?.surname === this.currentSurname),
            death: groupedEvents.death.filter(e => e.personDetails?.surname === this.currentSurname),
            marriage: groupedEvents.marriage.filter(e => 
                e.personDetails?.surname === this.currentSurname || 
                e.spouseDetails?.surname === this.currentSurname
            )
        };

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

        const filteredData = {
            ...townData,
            events: filteredEvents,
            localBirths: filteredEvents.birth.length,
            localDeaths: filteredEvents.death.length,
            nativeDeaths: nativeDeaths,
            localMarriages: filteredEvents.marriage.length,
            filter: `Patronyme : ${this.currentSurname}`
        };

        console.log('📊 Statistiques finales:', {
            patronyme: this.currentSurname,
            naissances: filteredData.localBirths,
            deces: filteredData.localDeaths,
            natifsDecedes: filteredData.nativeDeaths,
            mariages: filteredData.localMarriages
        });

        const content = infoWindowContentManager.createInfoWindowContent(
            townData.townDisplay || townData.town,
            filteredData
        );

        infoWindowDisplayManager.showInfoWindow(marker, content);
    }

    toggleVisibility(visible) {
        const layerName = 'surnames';
        
        if (visible && this.currentSurname) {
            this.updateMarkersForSurname(this.currentSurname);
        } else {
            this.markerDisplayManager.toggleLayerVisibility(layerName, false, this.map);
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
            if (townData.events && townData.events.birth) {
                townData.events.birth.forEach(event => {
                    const surname = event.personDetails?.surname;
                    if (surname) {
                        surnamesCount.set(surname, (surnamesCount.get(surname) || 0) + 1);
                    }
                });
            }
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

    isInitialized() {
        return this.map && this.markerDisplayManager.isInitialized();
    }
}

const surnamesTownsStore = new SurnamesTownsStore();
export default surnamesTownsStore;