import { makeObservable, observable, action, autorun } from '../../common/stores/mobx-config.js';
import MarkerDisplayManager from './markerDisplayManager.js';
import { infoWindowDisplayManager } from './infoWindowDisplayManager.js';

class RootAncestorTownsStore {
    constructor() {
        this.markerDisplayManager = new MarkerDisplayManager();
        this.map = null;
        this.birthData = [];
        this.isVisible = true;
        this.styles = {
            colors: {
                paternal: '#1e40af',
                maternal: '#be185d',
                mixed: '#9333ea'
            }
        };
    
        makeObservable(this, {
            birthData: observable,
            map: observable.ref,
            isVisible: observable,
            initialize: action,
            updateMarkers: action,
            clearMarkers: action,
            toggleVisibility: action,
            processHierarchy: action  // Ajout de la nouvelle méthode
        });
    }

    async processHierarchy(hierarchy) {
        try {
            console.group('📍 Traitement de la hiérarchie pour les villes des ancêtres');
            
            if (!hierarchy) {
                console.warn('⚠️ Hiérarchie invalide ou manquante');
                return;
            }

            const birthData = [];
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
    
                if (node.children && Array.isArray(node.children)) {
                    node.children.forEach(child => processNode(child, depth + 1));
                }
            };
    
            processNode(hierarchy);
            
            if (birthData.length > 0) {
                await this.updateMarkers(birthData);
                console.log('✅ Marqueurs mis à jour avec', birthData.length, 'lieux de naissance');
            } else {
                console.warn('⚠️ Aucun lieu de naissance trouvé dans la hiérarchie');
            }
    
            console.groupEnd();
            return birthData;

        } catch (error) {
            console.error('❌ Erreur lors du traitement de la hiérarchie:', error);
            console.groupEnd();
            throw error;
        }
    }

    initialize(map) {
        console.log('✅ Initialisation de RootAncestorTownsStore');
        this.map = map;
        this.markerDisplayManager.initializeCluster(map, this.createClusterMarker.bind(this));
    }

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

    centerMapOnMarkers() {
        if (!this.map) return;
        
        const bounds = this.getBounds();
        if (bounds) {
            this.map.fitBounds(bounds);
        }
    }

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
    
        if (this.isVisible) {
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
        div.style.cssText = `
            background: ${this.getBranchColor(locationData.births)};
            border-radius: 50%;
            width: 16px;
            height: 16px;
            border: 1px solid white;
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

    // Uniformisation avec FamilyTownsStore pour la méthode toggleVisibility
    toggleVisibility(visible) {
        this.isVisible = visible;
        if (this.map) {
            this.markerDisplayManager.toggleLayerVisibility('rootAncestors', visible, this.map);
            if (visible) {
                this.markerDisplayManager.addMarkersToCluster(this.map);
            }
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
        this.markerDisplayManager.cleanup();
    }
}

export const rootAncestorTownsStore = new RootAncestorTownsStore();