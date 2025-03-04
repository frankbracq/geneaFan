import { makeObservable, observable, action, runInAction } from '../../../common/stores/mobx-config.js';
import { infoWindowDisplayManager } from '../managers/infoWindowDisplayManager.js';
import { storeEvents, EVENTS } from '../../../common/stores/storeEvents.js';
import { layerManager } from '../managers/layerManager.js';
import BaseLayerStore from '../managers/baseLayerStore.js';

/**
 * Manages the display of ancestor birth locations on the map for the current root person
 * Each time a new person is selected as root, this store processes their ancestor tree
 * to display birth locations with different colors for paternal and maternal lines
 * 
 * Key features:
 * - Processes birth locations from the root person's ancestor tree
 * - Colors markers based on lineage (blue for paternal, pink for maternal, purple for mixed)
 * - Handles marker clustering for dense areas
 * - Updates dynamically when root person changes
 */
class RootAncestorTownsStore extends BaseLayerStore {
    constructor() {
        super('ancestors');
        
        // Core data
        this.birthData = [];

        // Style configuration for different branches
        this.styles = {
            colors: {
                paternal: '#1e40af',  // Blue for paternal line
                maternal: '#be185d',  // Pink for maternal line
                mixed: '#9333ea'      // Purple for mixed locations
            }
        };

        makeObservable(this, {
            birthData: observable,
            map: observable.ref,
            updateMarkers: action,
            clearMarkers: action,
            processHierarchy: action
        });
    }

    /**
     * Process the entire genealogical hierarchy
     * @param {Object} hierarchy - Family tree hierarchy
     * @returns {Array} Processed birth locations
     */
    async processHierarchy(hierarchy) {
        try {
            console.group('📍 Processing ancestor towns hierarchy');

            if (!hierarchy) {
                console.warn('⚠️ Invalid or missing hierarchy');
                return;
            }

            const birthData = [];

            // Recursive function to process each node in the hierarchy
            const processNode = (node, depth = 0) => {
                const birthInfo = node.stats?.demography?.birthInfo;

                if (birthInfo?.place?.coordinates?.latitude) {
                    birthData.push({
                        id: node.id,
                        name: `${node.name} ${node.surname}`,
                        birthYear: node.birthYear,
                        generation: node.generation || 0,
                        sosa: node.sosa || 1,
                        location: {
                            lat: birthInfo.place.coordinates.latitude,
                            lng: birthInfo.place.coordinates.longitude,
                            name: node.fanBirthPlace,
                            departement: birthInfo.place.departement
                        }
                    });
                }

                // Process children recursively
                if (node.children && Array.isArray(node.children)) {
                    node.children.forEach(child => processNode(child, depth + 1));
                }
            };

            processNode(hierarchy);
            this.birthData = birthData;

            if (birthData.length > 0) {
                console.log('✅ Birth data extracted for', birthData.length, 'locations');
            } else {
                console.warn('⚠️ No birth locations found in hierarchy');
            }

            console.groupEnd();
            return birthData;

        } catch (error) {
            console.error('❌ Error processing hierarchy:', error);
            console.groupEnd();
            throw error;
        }
    }

    /**
     * Create a cluster marker for grouped locations
     * @param {Object} param0 - Cluster parameters
     * @param {number} param0.count - Number of markers in cluster
     * @param {google.maps.LatLng} param0.position - Cluster position
     */
    createClusterMarker({ count, position }) {
        const div = document.createElement('div');
        div.className = 'cluster-marker';
        div.style.cssText = `
            background: ${this.styles.colors.mixed};
            border-radius: 50%;
            width: ${Math.min(count * 3, 20) * 2}px;
            height: ${Math.min(count * 3, 20) * 2}px;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        div.textContent = count;

        return new google.maps.marker.AdvancedMarkerElement({
            position,
            content: div,
            zIndex: 1000
        });
    }

    /**
     * Center the map on all visible markers
     */
    centerMapOnMarkers() {
        if (!this.map) return;

        const bounds = this.getBounds();
        if (bounds) {
            this.map.fitBounds(bounds);
        }
    }

    /**
     * Create a single marker for a location
     * @param {Object} location - Location data
     * @param {Array} births - Birth events at this location
     * @param {Object} generations - Generation information
     */
    createMarker(location, births, generations) {
        if (!location || !location.lat || !location.lng) {
            console.warn('❌ Données de localisation invalides', location);
            return;
        }

        const key = `${location.lat}-${location.lng}-${location.name}`;
        const position = new google.maps.LatLng(location.lat, location.lng);
        const content = this.renderMarkerContent(location, births);

        // console.log(`📍 Création du marqueur: ${location.name}`);
        // console.log(`   ➝ Coordonnées: (${location.lat}, ${location.lng})`);
        // console.log(`   ➝ Nombre de personnes associées: ${births.length}`);
        // console.log(`   ➝ Générations concernées:`, Object.keys(generations));

        return this.markerDisplayManager.addMarker(
            'rootAncestors',
            key,
            position,
            { content, title: births.map(b => b.name).join(', ') },
            (marker) => {
                const content = this.createInfoWindowContent(location, births, generations);
                infoWindowDisplayManager.showInfoWindow(marker, content);
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

    /**
     * Update all markers on the map
     * @param {Array} birthData - Array of birth location data
     */
    async updateMarkers(birthData) {
        if (!this.map || !birthData?.length) {
            console.warn('⚠️ Carte ou données absentes');
            return;
        }

        console.log(`🔄 Mise à jour des marqueurs pour ${birthData.length} lieux.`);
        this.birthData = birthData;
        this.markerDisplayManager.clearMarkers('rootAncestors');

        const locationMap = this.groupBirthDataByLocation(birthData);
        console.log(`📍 Nombre de lieux uniques: ${locationMap.size}`);

        locationMap.forEach((locationData) => {
            if (!this.isValidLocationData(locationData)) return;

            // Utiliser getOrCreateMarker au lieu de addMarker
            this.markerDisplayManager.getOrCreateMarker(
                'rootAncestors',
                locationData.location.name,
                {
                    latitude: locationData.location.lat,
                    longitude: locationData.location.lng,
                    townDisplay: locationData.location.name
                },
                (data) => this.createMarkerElement(locationData),
                (marker) => {
                    const content = this.createInfoWindowContent(
                        locationData.location,
                        locationData.births,
                        locationData.generations
                    );
                    infoWindowDisplayManager.showInfoWindow(marker, content);
                }
            );
        });

        if (layerManager.isLayerVisible('ancestors')) {
            this.markerDisplayManager.toggleLayerVisibility('rootAncestors', true, this.map);
        }
    }

    isValidLocationData(locationData) {
        return locationData?.location?.lat && locationData?.location?.lng;
    }

    getOrCreateMarker(locationData) {
        const key = `${locationData.location.lat}-${locationData.location.lng}-${locationData.location.name}`;
        const position = new google.maps.LatLng(locationData.location.lat, locationData.location.lng);

        return this.markerDisplayManager.addMarker(
            'rootAncestors',
            key,
            position,
            {
                content: this.createMarkerElement(locationData),
                title: locationData.births.map(b => b.name).join(', ')
            },
            (marker) => {
                const content = this.createInfoWindowContent(locationData.location, locationData.births, locationData.generations);
                infoWindowDisplayManager.showInfoWindow(marker, content);
            }
        );
    }

    handleMarkerClick(marker, locationData) {
        const content = this.createInfoWindowContent(locationData.location, locationData.births, locationData.generations);
        infoWindowDisplayManager.showInfoWindow(marker, content);
    }

    createMarkerElement(locationData) {
        const div = document.createElement('div');
        div.className = 'custom-marker';

        // Ajouter un ID au premier marqueur pour le tour
        if (!document.getElementById('rootMarkerForTour')) {
            div.id = 'rootMarkerForTour';
        }

        div.style.cssText = `
            background: ${this.getBranchColor(locationData.births)};
            border-radius: 50%;
            width: 16px;
            height: 16px;
            border: 1px solid white;
            transition: transform 0.3s ease;
        `;
        return div;
    }

    clearMarkers() {
        this.birthData = [];
        this.markerDisplayManager.clearMarkers('rootAncestors');
    }

    hasActiveMarkers() {
        if (!this.markerDisplayManager) return false;
        let hasMarkers = false;
        this.markerDisplayManager.layers.forEach(layerMarkers => {
            layerMarkers.forEach(marker => {
                if (marker.map !== null) {
                    hasMarkers = true;
                }
            });
        });
        return hasMarkers;
    }

    getBounds() {
        if (!this.markerDisplayManager) return null;

        const bounds = new google.maps.LatLngBounds();
        let hasMarkers = false;

        this.markerDisplayManager.layers.forEach(layerMarkers => {
            layerMarkers.forEach(marker => {
                if (marker.map !== null) {
                    bounds.extend(marker.position);
                    hasMarkers = true;
                }
            });
        });

        return hasMarkers ? bounds : null;
    }

    /**
     * Surcharge de la méthode applyVisibility de BaseLayerStore
     * @param {boolean} visible - État de visibilité à appliquer
     */
    applyVisibility(visible) {
        if (this.map) {
            this.markerDisplayManager.toggleLayerVisibility('rootAncestors', visible, this.map);
    
            if (visible && this.birthData && this.birthData.length > 0) {
                this.updateMarkers(this.birthData);
    
                // Utiliser le délai configuré dans le service
                const config = layerManager.getLayerConfig('ancestors');
                const delay = config ? config.clusterDelay : 200;
                
                setTimeout(() => {
                    console.log('📍 Ajout des marqueurs au cluster après délai');
                    this.markerDisplayManager.addMarkersToCluster(this.map);
                }, delay);
            }
        }
    }

    /**
     * Group birth data by location
     * @param {Array} data - Birth data array
     * @returns {Map} Grouped data by location
     */
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

    /**
     * Determine branch type from SOSA number
     * @param {number} sosa - SOSA-Stradonitz number
     * @returns {string} Branch type ('paternal', 'maternal', or 'unknown')
     */
    determineBranchFromSosa(sosa) {
        if (!sosa) return 'unknown';
        return sosa % 2 === 0 ? 'paternal' : 'maternal';
    }

    /**
     * Get color based on branch types in a location
     * @param {Array} births - Birth events at location
     * @returns {string} Color code for marker
     */
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

    // Surcharge la méthode cleanup pour effectuer des nettoyages spécifiques
    cleanup() {
        this.clearMarkers();
        super.cleanup(); // Appel à la méthode cleanup de la classe parente
    }
}

export const rootAncestorTownsStore = new RootAncestorTownsStore();