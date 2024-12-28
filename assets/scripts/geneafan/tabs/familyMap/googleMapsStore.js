class GoogleMapsStore {
    constructor() {
        this.map = null;
        this.activeMarkers = {};
        this.markerCluster = null;
        this.infoWindow = null;
        this.currentYear = null;
        this.birthData = [];
        // La timeline est activée par défaut et ne sera pas redéfinie plus tard
        this.isTimelineActive = true;

        this.apiKey = "AIzaSyDu9Qz5YXRF6CTJ4vf-0s89BaVq_eh13YE";

        this.statistics = {
            total: 0,
            withLocation: 0,
            withoutLocation: 0,
            generations: {},
            categories: {
                withCoordinates: 0,
                noPlace: 0,
                noCoordinates: 0,
                emptyName: 0,
                unknownParent: 0
            }
        };

        // Propriétés pour les fonctionnalités ancestrales
        this.generationColors = {
            0: '#1e40af',
            1: '#3b82f6',
            2: '#60a5fa',
            3: '#93c5fd',
            4: '#bfdbfe'
        };

        // Collection de logs pour le debug
        this.logsCollection = {
            markers: [],
            errors: [],
            warnings: [],
            stats: {
                totalMarkers: 0,
                successfulMarkers: 0,
                failedMarkers: 0,
                generationCounts: {}
            }
        };
    }

    async initMap(elementId, options = {}) {
        if (this.map) return;
    
        try {
            const defaultOptions = {
                zoom: 6.2,
                center: { lat: 46.2276, lng: 2.2137 },
                styles: this.getMapStyle(),
                streetViewControl: false,
                zoomControl: true,
                zoomControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
                fullscreenControl: true,
                fullscreenControlOptions: { position: google.maps.ControlPosition.TOP_CENTER }
            };
    
            const mapElement = document.getElementById(elementId);
            if (!mapElement) {
                throw new Error(`Element with id ${elementId} not found`);
            }
    
            // Initialiser la carte
            this.map = new google.maps.Map(mapElement, { ...defaultOptions, ...options });
    
            // Initialiser l'InfoWindow maintenant que Google Maps est chargé
            this.infoWindow = new google.maps.InfoWindow({
                maxWidth: 300
            });
    
            // Initialiser le cluster
            this.markerCluster = new google.maps.MarkerClusterer({ 
                map: this.map,
                renderer: {
                    render: ({ count, position, markers }) => {
                        const paternalCount = markers.filter(m => 
                            this.#determineBranchFromSosa(m.birthData?.[0]?.sosa) === 'paternal'
                        ).length;
                        const maternalCount = markers.filter(m => 
                            this.#determineBranchFromSosa(m.birthData?.[0]?.sosa) === 'maternal'
                        ).length;
                        
                        let color = paternalCount === markers.length ? '#3b82f6' : 
                                   maternalCount === markers.length ? '#ec4899' : 
                                   '#8b5cf6';
            
                        return new google.maps.Marker({
                            position,
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                fillColor: color,
                                fillOpacity: 0.9,
                                strokeWeight: 1,
                                strokeColor: color,
                                scale: Math.min(count * 3, 20)
                            },
                            label: {
                                text: String(count),
                                color: 'white',
                                fontSize: '12px'
                            },
                            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
                        });
                    }
                }
            });
    
            this.#addMapControls();
            this.#setupMapListeners();
            this.#recordState();
    
            console.log('✅ Map and components initialized successfully');
            return this.map;
        } catch (error) {
            console.error('❌ Error initializing map:', error);
            throw error;
        }
    }

    processHierarchy(hierarchy) {
        if (!hierarchy) {
            console.error('❌ Pas de hiérarchie disponible');
            return;
        }
    
        // Réinitialiser les données
        this.birthData = [];
        this.statistics = {
            total: 0,
            withLocation: 0,
            withoutLocation: 0,
            generations: {},
            categories: {
                withCoordinates: 0,
                noPlace: 0,
                noCoordinates: 0,
                emptyName: 0,
                unknownParent: 0
            }
        };
    
        const processNode = (node, depth = 0) => {
            if (!node) {
                console.warn(`⚠️ Nœud invalide au niveau ${depth}`);
                return;
            }
    
            const indent = '  '.repeat(depth);
            const demography = node.stats?.demography;
            const birthInfo = demography?.birthInfo;
    
            this.statistics.total++;
    
            if (birthInfo?.place?.coordinates?.latitude) {
                this.birthData.push({
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
    
                this.statistics.withLocation++;
                this.statistics.categories.withCoordinates++;
    
                // Mise à jour des statistiques par génération
                const generation = node.generation || 0;
                this.statistics.generations[generation] = (this.statistics.generations[generation] || 0) + 1;
            } else {
                if (!birthInfo?.place) {
                    this.statistics.categories.noPlace++;
                } else if (!birthInfo.place.coordinates) {
                    this.statistics.categories.noCoordinates++;
                }
                console.warn(`${indent}⚠️ Pas de coordonnées pour:`, {
                    name: `${node.name} ${node.surname}`,
                    birthPlace: node.fanBirthPlace,
                    birthInfo: birthInfo
                });
            }
    
            // Traiter récursivement les enfants
            if (node.children && Array.isArray(node.children)) {
                node.children.forEach(child => processNode(child, depth + 1));
            }
        };
    
        // Traiter la hiérarchie
        processNode(hierarchy);
        this.statistics.withoutLocation = this.statistics.total - this.statistics.withLocation;
    
        // Afficher les statistiques
        this.displayProcessingLogs();
        
        // Mettre à jour et afficher les marqueurs
        this.activateMapMarkers();
        
        // Centrer la carte sur les nouveaux marqueurs
        this.centerMapOnMarkers();
    }  

// Gestion des marqueurs standard
addMarker(key, town) {
    const latitude = parseFloat(town.latitude);
    const longitude = parseFloat(town.longitude);

    if (this.isValidCoordinate(latitude) && this.isValidCoordinate(longitude)) {
        const marker = new google.maps.Marker({
            position: { lat: latitude, lng: longitude },
            title: `${town.townDisplay || town.town || "Unknown"}, ${town.country || "Unknown"}`,
        });

        marker.addListener('click', () => {
            this.map.setZoom(9);
            this.map.setCenter(marker.getPosition());
        });

        this.allMarkers[key] = marker;
        marker.location = town;
    }
}

// Méthode pour créer un marqueur d'ancêtre
createAncestorMarker(location, births, generations) {
    this.collectLog('marker', { location, births, generations });

    const lat = parseFloat(location.lat);
    const lng = parseFloat(location.lng);

    if (isNaN(lat) || isNaN(lng)) {
        this.collectLog('error', {
            isMarker: true,
            message: 'Coordonnées invalides',
            details: { lat, lng, location }
        });
        return null;
    }

    try {
        const marker = new google.maps.Marker({
            position: { lat, lng },
            map: this.map,
            birthData: births, // Important : stocker les données de naissance
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: this.#getBranchColor(births),
                fillOpacity: 1,
                strokeWeight: 1,
                strokeColor: '#1e40af',
                scale: births.length === 1 ? 8 : Math.min(8 + (births.length * 0.5), 12)
            }
        });

        marker.addListener('click', () => {
            if (!this.infoWindow) {
                this.infoWindow = new google.maps.InfoWindow({
                    maxWidth: 400
                });
            }
            this.showAncestorInfoWindow(marker, location, births, generations);
        });

        return marker;
    } catch (error) {
        this.collectLog('error', {
            isMarker: true,
            message: 'Erreur création marqueur',
            details: error.toString()
        });
        return null;
    }
}

generateInfoWindowContent(data) {
    const { location, births, generations } = data;
    return `
            <div class="info-window">
                <h3>${location.name}</h3>
                ${location.departement ? `<p class="departement">${location.departement}</p>` : ''}
                
                <div class="generations-summary">
                    ${Object.entries(generations)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([gen, persons]) => {
                const count = this.isTimelineActive ?
                    persons.filter(p => p.birthYear <= this.currentYear).length :
                    persons.length;
                return `
                                <div class="generation-row" style="border-left: 3px solid ${this.generationColors[gen]}">
                                    <span>Génération ${gen}</span>
                                    <strong>${count}</strong>
                                </div>`;
            }).join('')}
                </div>

                <div class="persons-list">
                    ${births
            .sort((a, b) => a.birthYear - b.birthYear)
            .filter(person => !this.isTimelineActive || person.birthYear <= this.currentYear)
            .map(person => `
                            <div class="person-item" 
                                style="border-left: 3px solid ${this.generationColors[person.generation]}">
                                <strong>${person.name}</strong>
                                <span>${person.birthYear} • Sosa ${person.sosa}</span>
                            </div>
                        `).join('')}
                </div>
            </div>`;
}

showAncestorInfoWindow(marker, location, births, generations) {
    console.log('💡 Debug showAncestorInfoWindow:', {
        location,
        births,
        generations,
        timelineActive: this.isTimelineActive,
        currentYear: this.currentYear
    });

    const pieChartSvg = this.createPieChartSVG(generations, births.length);

    const filteredBirths = births.filter(person => 
        !this.isTimelineActive || person.birthYear <= this.currentYear
    );

    const content = `
        <div class="info-window">
            <div class="flex flex-col space-y-4">
                <div class="text-center">
                    <h3 class="text-lg font-semibold">${location.name}</h3>
                    ${location.departement ? 
                        `<p class="text-sm text-gray-600">${location.departement}</p>` : ''}
                    
                    <p class="mt-2 text-sm">
                        <span class="font-medium">${births.length}</span> naissances dans ce lieu
                    </p>
                    ${this.#getBranchesIndicator(births)} 
                </div>

                <!-- Piechart et légende côte à côte -->
                <div class="flex gap-4 justify-center items-start">
                    <div class="w-32 h-32" style="min-width: 128px;">
                        ${pieChartSvg}
                    </div>
                    
                    <div class="flex flex-col gap-2">
                        ${Object.entries(generations)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([gen, persons]) => {
                                // Important : persons est un tableau
                                const count = persons ? persons.length : 0;
                                return `
                                    <div class="flex items-center gap-2">
                                        <div class="w-3 h-3" style="background-color: ${this.generationColors[gen]}"></div>
                                        <span class="text-sm">
                                            Gén. ${gen} 
                                            <span class="font-medium">(${count})</span>
                                        </span>
                                    </div>`;
                            }).join('')}
                    </div>
                </div>

                <!-- Liste des personnes -->
                <div class="mt-4">
                    <h4 class="font-medium mb-2">Personnes nées dans ce lieu :</h4>
                    <div class="space-y-2 max-h-48 overflow-y-auto">
                        ${births
                            .sort((a, b) => a.birthYear - b.birthYear)
                            .map(person => `
                                <div class="flex items-center gap-2 p-2 bg-gray-50 rounded">
                                    <div class="w-2 h-full" 
                                         style="background-color: ${this.generationColors[person.generation]}">
                                    </div>
                                    <div class="flex-grow">
                                        <div class="font-medium" 
                                             style="color: ${this.#determineBranchFromSosa(person.sosa) === 'paternal' ? 
                                                           '#3b82f6' : '#ec4899'}">
                                            ${person.name}
                                        </div>
                                        <div class="text-sm text-gray-600">
                                            ${person.birthYear} • Sosa ${person.sosa}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                    </div>
                </div>
            </div>
        </div>`;

    if (this.infoWindow) {
        this.infoWindow.setContent(content);
        this.infoWindow.open({
            anchor: marker,
            map: this.map
        });
    }
}

// Activer les marqueurs sur la carte
activateMapMarkers(individualTownKeys = null) {
    if (!this.map) {
        console.log('Pas de carte disponible');
        return;
    }

    // Nettoyer les marqueurs existants d'abord
    this.clearCurrentMarkers();

    if (this.isTimelineActive) {
        const locationGroups = new Map();

        // Grouper les données par localisation
        this.birthData.forEach(birth => {
            if (!birth.location?.lat || !birth.location?.lng) {
                console.warn('⚠️ Birth location missing coordinates:', birth);
                return;
            }

            const key = `${birth.location.lat}-${birth.location.lng}`;
            if (!locationGroups.has(key)) {
                locationGroups.set(key, {
                    location: birth.location,
                    births: [],
                    generations: {}
                });
            }

            const group = locationGroups.get(key);
            group.births.push(birth);

            // S'assurer que le tableau pour cette génération existe
            if (!group.generations[birth.generation]) {
                group.generations[birth.generation] = [];
            }
            // Ajouter la naissance à sa génération
            group.generations[birth.generation].push(birth);
        });

        // Créer les marqueurs
        locationGroups.forEach((data, key) => {
            console.log('📍 Création marqueur pour', key, 'avec données:', {
                location: data.location,
                totalBirths: data.births.length,
                generations: Object.entries(data.generations)
                    .reduce((acc, [gen, births]) => ({
                        ...acc,
                        [gen]: births.length
                    }), {})
            });

            const marker = this.createAncestorMarker(
                data.location,
                data.births,
                data.generations
            );
            if (marker) {
                this.activeMarkers[key] = marker;
            }
        });
    }

    // Mettre à jour le cluster
    const validMarkers = Object.values(this.activeMarkers).filter(Boolean);
    if (this.markerCluster && validMarkers.length > 0) {
        this.markerCluster.clearMarkers();
        this.markerCluster.addMarkers(validMarkers);
    }

    // Centrer la carte sur les marqueurs actifs
    this.centerMapOnMarkers();
}

clearCurrentMarkers() {
    // Retirer tous les marqueurs actifs de la carte
    Object.values(this.activeMarkers).forEach(marker => {
        if (marker) {
            marker.setMap(null);
        }
    });
    this.activeMarkers = {};

    // Vider le cluster si présent
    if (this.markerCluster) {
        this.markerCluster.clearMarkers();
    }
}

createPieChartSVG(generations, total) {
    const size = 128; // Taille fixe pour l'infoWindow
    const center = size / 2;
    const radius = (size / 2) - 2;

    // Cas particulier : une seule génération
    if (Object.entries(generations).length === 1) {
        const [[gen, births]] = Object.entries(generations);
        const count = this.isTimelineActive ?
            births.filter(b => b.birthYear <= this.currentYear).length :
            births.length;
        const isFuture = this.isTimelineActive && count === 0;

        return `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
                    <circle 
                        cx="${center}" 
                        cy="${center}" 
                        r="${radius}"
                        fill="${this.generationColors[gen]}"
                        opacity="${isFuture ? 0.2 : 1}"
                        stroke="white"
                        stroke-width="1"
                    />
                </svg>`;
    }

    // Cas général : plusieurs générations
    let startAngle = 0;
    const paths = Object.entries(generations)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([gen, births]) => {
            const count = this.isTimelineActive ?
                births.filter(b => b.birthYear <= this.currentYear).length :
                births.length;
            const percentage = births.length / total;
            const angle = percentage * 360;
            const endAngle = startAngle + angle;

            const startRad = (startAngle - 90) * Math.PI / 180;
            const endRad = (endAngle - 90) * Math.PI / 180;

            const x1 = center + radius * Math.cos(startRad);
            const y1 = center + radius * Math.sin(startRad);
            const x2 = center + radius * Math.cos(endRad);
            const y2 = center + radius * Math.sin(endRad);

            const largeArcFlag = angle > 180 ? 1 : 0;
            const path = `
                    M ${center},${center}
                    L ${x1},${y1}
                    A ${radius},${radius} 0 ${largeArcFlag},1 ${x2},${y2}
                    Z`;

            startAngle += angle;
            const isFuture = this.isTimelineActive && count === 0;

            return `
                    <path 
                        d="${path}" 
                        fill="${this.generationColors[gen]}"
                        opacity="${isFuture ? 0.2 : 1}"
                        stroke="white"
                        stroke-width="1"
                    />`;
        }).join('');

    return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
                ${paths}
            </svg>`;
}

// Gestion de la timeline
initializeAncestorsMap() {
    if (!this.currentYear && this.birthData.length > 0) {
        this.currentYear = Math.max(...this.birthData
            .filter(b => b.birthYear)
            .map(b => parseInt(b.birthYear, 10)));
        console.log('Initialisation année courante:', this.currentYear);
    }

    if (this.birthData.length > 0) {
        // Mettre à jour les statistiques
        this.statistics = {
            total: this.birthData.length,
            withLocation: this.birthData.length,
            withoutLocation: 0,
            generations: {},
            categories: {
                withCoordinates: this.birthData.length,
                noPlace: 0,
                noCoordinates: 0,
                emptyName: 0,
                unknownParent: 0
            }
        };

        // Calculer les statistiques par génération
        this.birthData.forEach(birth => {
            if (birth.generation !== undefined) {
                this.statistics.generations[birth.generation] = 
                    (this.statistics.generations[birth.generation] || 0) + 1;
            }
        });
    }

    console.log('Année courante:', this.currentYear);
    this.displayProcessingLogs();
    this.activateMapMarkers();
}

updateMarkers() {
    // À implémenter selon les besoins spécifiques
    console.log("Updating markers with timeline:", this.isTimelineActive);
}

// Méthodes utilitaires
moveMapToContainer(containerId) {
    const mapContainer = document.getElementById(containerId);
    if (!mapContainer || !this.map) return;

    const mapDiv = this.map.getDiv();
    // Si la carte est déjà dans le bon conteneur, ne rien faire
    if (mapContainer === mapDiv.parentNode) {
        return;
    }

    try {
        mapContainer.appendChild(mapDiv);
        google.maps.event.trigger(this.map, "resize");
    } catch (error) {
        console.error(`Failed to move map to container ${containerId}:`, error);
        // Si nécessaire, on pourrait essayer de réinitialiser la carte ici
    }
}

clearMap() {
    this.clearMarkers();
    if (this.map) {
        this.map.setCenter({ lat: 46.2276, lng: 2.2137 });
        this.map.setZoom(6.2);
        google.maps.event.trigger(this.map, 'resize');
    }
}

clearMarkers() {
    Object.values(this.activeMarkers).forEach(marker => marker.setMap(null));
    this.activeMarkers = {};
    this.allMarkers = {};
    if (this.markerCluster) {
        this.markerCluster.clearMarkers();
    }
}

isValidCoordinate(coordinate) {
    const num = Number(coordinate);
    return !isNaN(num) && num.toString().trim() !== "";
}

centerMapOnMarkers() {
    if (this.map && Object.keys(this.activeMarkers).length > 0) {
        const bounds = new google.maps.LatLngBounds();
        Object.values(this.activeMarkers).forEach(marker => {
            bounds.extend(marker.getPosition());
        });
        this.map.fitBounds(bounds);
    }
}

analyzeNodeStructure(node, path = '') {
    const seen = new Set();

    function analyze(obj, currentPath) {
        if (!obj || seen.has(obj)) return {};
        if (typeof obj !== 'object') return obj;

        seen.add(obj);
        const structure = {};

        for (const [key, value] of Object.entries(obj)) {
            const newPath = currentPath ? `${currentPath}.${key}` : key;

            if (Array.isArray(value)) {
                structure[key] = `Array(${value.length})`;
            } else if (typeof value === 'object' && value !== null) {
                structure[key] = analyze(value, newPath);
            } else {
                structure[key] = typeof value;
            }
        }

        return structure;
    }

    return analyze(node, path);
}

collectLog(type, data) {
    switch (type) {
        case 'marker':
            this.logsCollection.markers.push({
                timestamp: new Date().toISOString(),
                location: data.location,
                births: data.births,
                generations: data.generations,
                status: 'created'
            });
            this.logsCollection.stats.totalMarkers++;
            break;

        case 'error':
            this.logsCollection.errors.push({
                timestamp: new Date().toISOString(),
                message: data.message,
                details: data.details
            });
            if (data.isMarker) {
                this.logsCollection.stats.failedMarkers++;
            }
            break;

        case 'warning':
            this.logsCollection.warnings.push({
                timestamp: new Date().toISOString(),
                message: data.message,
                details: data.details
            });
            break;

        case 'success':
            if (data.isMarker) {
                this.logsCollection.stats.successfulMarkers++;
            }
            break;
    }
}

displayProcessingLogs() {
    const styles = {
        header: 'color: white; background: #3b82f6; padding: 4px 8px; border-radius: 4px;',
        subheader: 'color: #3b82f6; font-weight: bold;',
        success: 'color: #10b981;',
        error: 'color: #ef4444;',
        warning: 'color: #f59e0b;'
    };

    // S'assurer que les statistiques sont initialisées
    if (!this.statistics) {
        this.statistics = {
            total: this.birthData.length,
            withLocation: this.birthData.length,
            withoutLocation: 0,
            emptyNames: 0,
            generations: {},
            reasons: {
                noData: 0,
                noCoordinates: 0,
                emptyLocation: 0,
                invalidData: 0
            }
        };

        // Calculer les générations à partir des données disponibles
        this.birthData.forEach(birth => {
            if (birth.generation !== undefined) {
                this.statistics.generations[birth.generation] =
                    (this.statistics.generations[birth.generation] || 0) + 1;
            }
        });
    }

    console.group('%c📍 Analyse géographique des individus', styles.header);

    // Statistiques générales
    console.group('Statistiques globales');
    console.table({
        'Total des individus': this.birthData.length,
        'Lieux identifiés': this.birthData.length,
        'Lieux manquants': this.statistics.withoutLocation || 0
    });
    console.groupEnd();

    // Répartition par génération
    if (Object.keys(this.statistics.generations).length > 0) {
        console.group('%cRépartition par génération', styles.subheader);
        console.table(
            Object.entries(this.statistics.generations)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .reduce((acc, [gen, count]) => {
                    acc[`Génération ${gen}`] = count;
                    return acc;
                }, {})
        );
        console.groupEnd();
    }

    // Liste des individus
    if (this.birthData.length > 0) {
        console.group('%cLocalisation des individus', styles.subheader);
        console.table(
            this.birthData.map(birth => ({
                'Nom': birth.name,
                'Lieu': birth.location.name,
                'Département': birth.location.departement || 'Non spécifié',
                'Génération': birth.generation,
                'N° Sosa': birth.sosa,
                'Année': birth.birthYear
            }))
        );
        console.groupEnd();
    }

    console.groupEnd();
}

// Méthode privée pour déterminer la raison de l'absence de coordonnées
#getLocationIssueReason(birth) {
    if (!birth.location) return 'Aucune information de lieu';
    if (!birth.location.name || birth.location.name.trim() === '') return 'Nom du lieu manquant';
    if (!birth.location.lat || !birth.location.lng) return 'Coordonnées manquantes';
    return 'Autre problème';
}

// Gestion de l'historique
undo() {
    if (this.history.length > 1) {
        const lastState = this.history.pop();
        this.redoStack.push(lastState);
        const previousState = this.history[this.history.length - 1];
        this.#applyState(previousState);
    }
}

redo() {
    if (this.redoStack.length > 0) {
        const stateToRestore = this.redoStack.pop();
        this.history.push(stateToRestore);
        this.#applyState(stateToRestore);
    }
}

// Méthodes privées
#setupMapListeners() {
    this.map.addListener('zoom_changed', () => this.#recordState());
    this.map.addListener('center_changed', () => this.#recordState());
}

#recordState() {
    const currentState = {
        zoom: this.map.getZoom(),
        center: this.map.getCenter().toJSON()
    };

    const lastState = this.history[this.history.length - 1];
    if (!this.#isSameState(lastState, currentState)) {
        this.history.push(currentState);
        this.redoStack = [];
    }
}

#isSameState(state1, state2) {
    if (!state1) return false;
    return state1.zoom === state2.zoom &&
        state1.center.lat === state2.center.lat &&
        state1.center.lng === state2.center.lng;
}

#addMapControls() {
    this.#addResetControl();
    this.#addUndoRedoControls();
}

#addResetControl() {
    const controlDiv = document.createElement('div');
    controlDiv.style.margin = '10px';

    const button = document.createElement('button');
    this.#styleControlButton(button);
    button.title = 'Reset map';
    button.innerText = 'Reset Map';
    button.addEventListener('click', () => this.clearMap());

    controlDiv.appendChild(button);
    this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
}

#addUndoRedoControls() {
    const controlDiv = document.createElement('div');
    controlDiv.style.margin = '10px';

    const undoButton = document.createElement('button');
    this.#styleControlButton(undoButton);
    undoButton.title = 'Undo';
    undoButton.innerText = 'Undo';
    undoButton.addEventListener('click', () => this.undo());

    const redoButton = document.createElement('button');
    this.#styleControlButton(redoButton);
    redoButton.title = 'Redo';
    redoButton.innerText = 'Redo';
    redoButton.addEventListener('click', () => this.redo());

    controlDiv.appendChild(undoButton);
    controlDiv.appendChild(redoButton);
    this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
}

#styleControlButton(button) {
    Object.assign(button.style, {
        backgroundColor: '#fff',
        border: '2px solid #fff',
        borderRadius: '3px',
        boxShadow: '0 2px 6px rgba(0,0,0,.3)',
        cursor: 'pointer',
        marginRight: '5px',
        textAlign: 'center'
    });
}

#applyState(state) {
    this.map.setZoom(state.zoom);
    this.map.setCenter(state.center);
}

#getBranchColor(births) {
    const paternalCount = births.filter(b => this.#determineBranchFromSosa(b.sosa) === 'paternal').length;
    const maternalCount = births.filter(b => this.#determineBranchFromSosa(b.sosa) === 'maternal').length;
    const total = births.length;

    if (paternalCount === total) {
        return '#3b82f6';  // Bleu
    }
    if (maternalCount === total) {
        return '#ec4899';  // Rose
    }
    return '#8b5cf6';  // Violet
}

#getBranchesIndicator(births) {
    const paternalCount = births.filter(b => b.line === 'paternal').length;
    const maternalCount = births.filter(b => b.line === 'maternal').length;
    const total = births.length;

    const paternalWidth = (paternalCount / total) * 100;
    const maternalWidth = (maternalCount / total) * 100;

    return `
            <div class="mt-2">
                <div class="flex h-2 w-full rounded-full overflow-hidden">
                    ${paternalCount > 0 ?
            `<div class="bg-blue-500" style="width: ${paternalWidth}%"></div>` : ''}
                    ${maternalCount > 0 ?
            `<div class="bg-pink-500" style="width: ${maternalWidth}%"></div>` : ''}
                </div>
                <div class="flex justify-between text-xs mt-1">
                    <span class="text-blue-500">Branche paternelle: ${paternalCount}</span>
                    <span class="text-pink-500">Branche maternelle: ${maternalCount}</span>
                </div>
            </div>`;
}

#determineBranchFromSosa(sosa) {
    if (sosa === 1) return null;
    // On détermine l'ancêtre direct (2 = père, 3 = mère)
    while (sosa > 3) {
        sosa = Math.floor(sosa / 2);
    }
    return sosa === 2 ? 'paternal' : 'maternal';
}

getMapStyle() {
    return [
        {
            "featureType": "all",
            "elementType": "labels",
            "stylers": [
                {
                    "visibility": "off"
                },
                {
                    "color": "#f49f53"
                }
            ]
        },
        {
            "featureType": "all",
            "elementType": "labels.text",
            "stylers": [
                {
                    "visibility": "simplified"
                }
            ]
        },
        {
            "featureType": "landscape",
            "elementType": "all",
            "stylers": [
                {
                    "color": "#f9ddc5"
                },
                {
                    "lightness": -7
                }
            ]
        },
        {
            "featureType": "poi.business",
            "elementType": "all",
            "stylers": [
                {
                    "color": "#645c20"
                },
                {
                    "lightness": 38
                }
            ]
        },
        {
            "featureType": "poi.government",
            "elementType": "all",
            "stylers": [
                {
                    "color": "#9e5916"
                },
                {
                    "lightness": 46
                }
            ]
        },
        {
            "featureType": "poi.medical",
            "elementType": "geometry.fill",
            "stylers": [
                {
                    "color": "#813033"
                },
                {
                    "lightness": 38
                },
                {
                    "visibility": "off"
                }
            ]
        },
        {
            "featureType": "poi.park",
            "elementType": "all",
            "stylers": [
                {
                    "color": "#645c20"
                },
                {
                    "lightness": 39
                }
            ]
        },
        {
            "featureType": "poi.school",
            "elementType": "all",
            "stylers": [
                {
                    "color": "#a95521"
                },
                {
                    "lightness": 35
                }
            ]
        },
        {
            "featureType": "poi.sports_complex",
            "elementType": "all",
            "stylers": [
                {
                    "color": "#9e5916"
                },
                {
                    "lightness": 32
                }
            ]
        },
        {
            "featureType": "road",
            "elementType": "all",
            "stylers": [
                {
                    "color": "#813033"
                },
                {
                    "lightness": 43
                }
            ]
        },
        {
            "featureType": "road.local",
            "elementType": "geometry.fill",
            "stylers": [
                {
                    "color": "#f19f53"
                },
                {
                    "weight": 1.3
                },
                {
                    "visibility": "on"
                },
                {
                    "lightness": 16
                }
            ]
        },
        {
            "featureType": "road.local",
            "elementType": "geometry.stroke",
            "stylers": [
                {
                    "color": "#f19f53"
                },
                {
                    "lightness": -10
                }
            ]
        },
        {
            "featureType": "transit",
            "elementType": "all",
            "stylers": [
                {
                    "lightness": 38
                }
            ]
        },
        {
            "featureType": "transit.line",
            "elementType": "all",
            "stylers": [
                {
                    "color": "#813033"
                },
                {
                    "lightness": 22
                }
            ]
        },
        {
            "featureType": "transit.station",
            "elementType": "all",
            "stylers": [
                {
                    "visibility": "off"
                }
            ]
        },
        {
            "featureType": "water",
            "elementType": "all",
            "stylers": [
                {
                    "color": "#1994bf"
                },
                {
                    "saturation": -69
                },
                {
                    "gamma": 0.99
                },
                {
                    "lightness": 43
                }
            ]
        }
    ];
}
}

export const googleMapsStore = new GoogleMapsStore();