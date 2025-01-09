import { makeObservable, observable, action, autorun } from '../../common/stores/mobx-config.js';
import MarkerManager from './markerManager.js';
import { infoWindowManager } from './infoWindowManager.js';

class RootAncestorTownsStore {
    constructor() {
        this.markerManager = new MarkerManager();
        this.map = null;
        this.birthData = [];
        this.isVisible = true;
        this.styles = {
            colors: {
                paternal: '#1e40af', // blue-800
                maternal: '#be185d', // pink-800
                mixed: '#9333ea'     // purple-700
            }
        };

        makeObservable(this, {
            birthData: observable,
            map: observable.ref,
            isVisible: observable,
            initialize: action,
            updateMarkers: action,
            clearMarkers: action,
            toggleVisibility: action
        });
    }

    initialize(map) {
        console.log('Initializing RootAncestorTownsStore with map');
        this.map = map;
        this.markerManager.initializeCluster(map, this.renderCluster.bind(this));

        if (this.birthData.length > 0) {
            this.updateMarkers(this.birthData);
        }
    }

    renderCluster({ count, position }) {
        const element = document.createElement('div');
        element.className = 'cluster-marker';
        element.style.background = '#9333ea';
        element.style.borderRadius = '50%';
        element.style.width = `${Math.min(count * 3, 20) * 2}px`;
        element.style.height = `${Math.min(count * 3, 20) * 2}px`;
        element.style.color = 'white';
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.textContent = count;
        element.style.border = '2px solid white';

        return new google.maps.marker.AdvancedMarkerElement({
            position,
            content: element
        });
    }

    createMarker(location, births, generations) {
        if (!location || !location.lat || !location.lng) {
            console.warn('Invalid location data', location);
            return;
        }

        const key = `${location.lat}-${location.lng}-${location.name}`;
        const position = new google.maps.LatLng(location.lat, location.lng);
        const content = this.renderMarkerContent(location, births);

        return this.markerManager.addMarker(
            'rootAncestors',
            key,
            position,
            { content, title: births.map(b => b.name).join(', ') },
            (marker) => {
                const content = this.createInfoWindowContent(location, births, generations);
                infoWindowManager.showInfoWindow(marker, content);
            }
        );
    }

    renderMarkerContent(location, births) {
        const element = document.createElement('div');
        element.className = 'custom-marker';
        element.style.background = this.getBranchColor(births);
        element.style.borderRadius = '50%';
        element.style.width = '16px';
        element.style.height = '16px';
        element.style.border = '1px solid #1e40af';
        return element;
    }

    updateMarkers(birthData) {
        console.log('Updating markers with:', { dataCount: birthData?.length });
        this.birthData = birthData;
        this.markerManager.clearMarkers('rootAncestors');

        const locationMap = this.groupBirthDataByLocation(birthData);
        locationMap.forEach((locationData) => {
            this.createMarker(locationData.location, locationData.births, locationData.generations);
        });

        if (this.isVisible && this.map) {
            this.markerManager.toggleLayerVisibility('rootAncestors', true, this.map);
        }
    }

    clearMarkers() {
        this.markerManager.clearMarkers('rootAncestors');
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

    createInfoWindowContent(location, births, generations) {
        const div = document.createElement('div');
        div.className = 'info-window-content';

        const title = document.createElement('h3');
        title.textContent = location.name;
        title.className = 'font-bold text-lg mb-2';
        div.appendChild(title);

        if (location.departement) {
            const dept = document.createElement('p');
            dept.textContent = `Département: ${location.departement}`;
            dept.className = 'text-sm text-gray-600 mb-2';
            div.appendChild(dept);
        }

        const birthsByGeneration = this.groupBirthsByGeneration(births);
        birthsByGeneration.forEach((birthsInGen, gen) => {
            const genDiv = document.createElement('div');
            genDiv.className = 'generation-group mb-2';

            const genTitle = document.createElement('h4');
            genTitle.textContent = `Génération ${gen}`;
            genTitle.className = 'font-semibold text-sm text-gray-700';
            genDiv.appendChild(genTitle);

            const list = document.createElement('ul');
            list.className = 'list-disc ml-4';

            birthsInGen.forEach(birth => {
                const li = document.createElement('li');
                li.className = 'text-sm';

                const branch = this.determineBranchFromSosa(birth.sosa);
                const color = branch === 'paternal' ? this.styles.colors.paternal :
                    branch === 'maternal' ? this.styles.colors.maternal :
                        this.styles.colors.mixed;

                li.style.color = color;
                li.textContent = birth.name;
                if (birth.birthYear) {
                    li.textContent += ` (${birth.birthYear})`;
                }

                list.appendChild(li);
            });

            genDiv.appendChild(list);
            div.appendChild(genDiv);
        });

        return div;
    }

    groupBirthsByGeneration(births) {
        const grouped = new Map();

        births.forEach(birth => {
            const generation = birth.generation;
            if (!grouped.has(generation)) {
                grouped.set(generation, []);
            }
            grouped.get(generation).push(birth);
        });

        return new Map([...grouped.entries()].sort((a, b) => a[0] - b[0]));
    }

    determineBranchFromSosa(sosa) {
        if (!sosa) return 'unknown';
        return sosa % 2 === 0 ? 'paternal' : 'maternal';
    }

    getBranchColor(births) {
        if (!births || births.length === 0) return this.styles.colors.mixed;

        const branches = new Set(
            births.map(birth => this.determineBranchFromSosa(birth.sosa))
                .filter(branch => branch !== 'unknown')
        );

        if (branches.size === 0) return this.styles.colors.mixed;
        if (branches.size === 1) {
            return branches.has('paternal') ?
                this.styles.colors.paternal :
                this.styles.colors.maternal;
        }
        return this.styles.colors.mixed;
    }

    cleanup() {
        this.clearMarkers();
        this.map = null;
        this.markerManager.cleanup();
    }
}

export const rootAncestorTownsStore = new RootAncestorTownsStore();