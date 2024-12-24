import gedcomDataStore from '../../gedcom/gedcomDataStore';
import { reaction } from '../../common/stores/mobx-config.js';

export class AncestorsMapManager {
    constructor() {
        this.map = null;
        this.markers = [];
        this.birthData = [];
        this.filters = {
            paternal: true,
            maternal: true
        };
        this.isPlaying = false;
        this.playInterval = null;
        
        this.generationColors = {
            0: '#1e40af',
            1: '#3b82f6',
            2: '#60a5fa',
            3: '#93c5fd',
            4: '#bfdbfe'
        };
    }

    createPieChart(generations, total, currentYear) {
        const size = 100;
        const center = size / 2;
        const radius = (size / 2) - 2;
        
        // Pour les lieux avec une seule personne
        const singleGeneration = Object.entries(generations).length === 1;
        if (singleGeneration) {
            const [[gen, births]] = Object.entries(generations);
            const count = births.filter(b => b.birthYear <= currentYear).length;
            const isFuture = count === 0;

            return `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" class="birth-pie-chart">
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

        // Pour les lieux avec plusieurs personnes
        let startAngle = 0;
        const paths = Object.entries(generations)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([gen, births]) => {
                const count = births.filter(b => b.birthYear <= currentYear).length;
                const percentage = births.length / total;
                const angle = percentage * 360;
                const endAngle = startAngle + angle;
                
                // Convertir les angles en radians pour les calculs
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
                    Z
                `;

                startAngle += angle;
                const isFuture = count === 0;

                return `
                    <path 
                        d="${path}" 
                        fill="${this.generationColors[gen]}"
                        opacity="${isFuture ? 0.2 : 1}"
                        stroke="white"
                        stroke-width="1"
                    >
                        <title>Génération ${gen}: ${count}/${births.length} personne(s)</title>
                    </path>`;
            }).join('');

        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" class="birth-pie-chart">
                ${paths}
            </svg>`;
    }

    static async initialize() {
        console.log('Initializing AncestorsMapManager');
        
        const manager = new AncestorsMapManager();
        
        // Initialisation de la carte une fois que l'onglet est visible
        const tab = document.getElementById('tab6');
        if (tab) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(async entry => {
                    if (entry.isIntersecting) {
                        console.log('Ancestors map tab is visible, initializing map...');
                        
                        // D'abord charger Leaflet
                        await manager.loadLeaflet();
                        
                        // Puis initialiser la carte
                        await manager.initializeMap();
                        manager.setupEventListeners();
    
                        // Ajouter la réaction après l'initialisation de la carte
                        gedcomDataStore.addReactionDisposer(
                            'AncestorsMapManager-HierarchyReaction',
                            () => gedcomDataStore.getHierarchy(),
                            (hierarchy) => {
                                console.log("Réaction à la hiérarchie", hierarchy);
                                if (hierarchy) {
                                    manager.processHierarchy(hierarchy);
                                }
                            },
                            { fireImmediately: true }
                        );
                        
                        observer.disconnect();
                    }
                });
            });
            observer.observe(tab);
        }
    
        return manager;
    }

    async loadLeaflet() {
        // Ne charger Leaflet qu'une seule fois
        if (window.L) return;

        // Charger le CSS de Leaflet
        const linkElement = document.createElement('link');
        linkElement.rel = 'stylesheet';
        linkElement.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
        document.head.appendChild(linkElement);

        // Charger le JavaScript de Leaflet
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async initializeMap() {
        // Initialiser la carte Leaflet
        this.map = L.map('ancestors-map').setView([46.603354, 1.888334], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        this.addLegend();
    }

    processHierarchy(hierarchy) {
        if (!hierarchy) {
            console.log('Pas de hiérarchie disponible');
            return;
        }
        console.log('Traitement de la hiérarchie:', hierarchy);
        
        this.birthData = [];
        const processNode = (node) => {
            if (!node) return;
            
            console.log('Traitement du nœud:', node);
            
            // Déterminer la ligne (paternelle/maternelle)
            const sosaNumber = node.sosa;
            const isPaternal = sosaNumber % 2 === 0;
            const line = isPaternal ? 'paternal' : 'maternal';
            
            // Si on a un lieu de naissance avec des coordonnées
            const birthPlace = node.stats?.demography?.birthInfo?.place;
            if (birthPlace?.coordinates?.latitude) {
                console.log('Ajout du lieu de naissance:', birthPlace);
                
                this.birthData.push({
                    id: node.id,
                    name: `${node.name} ${node.surname}`,
                    birthYear: parseInt(node.birthYear),
                    generation: node.generation,
                    sosa: sosaNumber,
                    line: line,
                    location: {
                        lat: birthPlace.coordinates.latitude,
                        lng: birthPlace.coordinates.longitude,
                        name: node.fanBirthPlace,
                        departement: birthPlace.departement
                    }
                });
            } else {
                console.log('Pas de coordonnées pour:', node.name, node.surname);
            }
            
            // Traiter récursivement les parents
            if (node.children) {
                node.children.forEach(processNode);
            }
        };
        
        processNode(hierarchy);
        
        console.log('Données de naissance traitées:', this.birthData);
        
        // Mettre à jour la plage temporelle et la carte
        this.updateTimeRange();
        this.updateMap(parseInt(document.getElementById('year-slider').value));
    }

    updateTimeRange() {
        const years = this.birthData.map(d => d.birthYear).filter(y => !isNaN(y));
        if (years.length > 0) {
            const minYear = Math.min(...years);
            const maxYear = Math.max(...years);

            const slider = document.getElementById('year-slider');
            slider.min = minYear;
            slider.max = maxYear;
            slider.value = minYear;

            document.getElementById('current-year').textContent = minYear;
            document.getElementById('max-year').textContent = maxYear;
        }
    }

    setupEventListeners() {
        // Filtres des lignes paternelle/maternelle
        document.getElementById('paternal-line')?.addEventListener('change', (e) => {
            this.filters.paternal = e.target.checked;
            this.updateMap(parseInt(document.getElementById('year-slider').value));
        });

        document.getElementById('maternal-line')?.addEventListener('change', (e) => {
            this.filters.maternal = e.target.checked;
            this.updateMap(parseInt(document.getElementById('year-slider').value));
        });

        // Contrôles temporels
        const slider = document.getElementById('year-slider');
        slider?.addEventListener('input', (e) => {
            const year = parseInt(e.target.value);
            document.getElementById('current-year').textContent = year;
            this.updateMap(year);
        });

        // Boutons de contrôle
        document.getElementById('play-button')?.addEventListener('click', () => this.togglePlay());
        document.getElementById('reset-button')?.addEventListener('click', () => this.reset());
    }

    updateMap(year) {
        // Nettoyer les marqueurs existants
        this.markers.forEach(marker => marker.remove());
        this.markers = [];

        // Filtrer les données selon les lignes sélectionnées
        const filteredData = this.birthData.filter(person => {
            if (person.line === 'paternal' && !this.filters.paternal) return false;
            if (person.line === 'maternal' && !this.filters.maternal) return false;
            return true;
        });

        // Regrouper par lieu
        const birthsByLocation = new Map();
        filteredData.forEach(person => {
            const key = `${person.location.lat}-${person.location.lng}`;
            if (!birthsByLocation.has(key)) {
                birthsByLocation.set(key, {
                    location: person.location,
                    births: [],
                    generations: {}
                });
            }

            const locationData = birthsByLocation.get(key);
            locationData.births.push(person);

            if (!locationData.generations[person.generation]) {
                locationData.generations[person.generation] = [];
            }
            locationData.generations[person.generation].push(person);
        });

        // Créer les marqueurs
        birthsByLocation.forEach((data, key) => {
            const { location, births, generations } = data;
            const iconSize = births.length === 1 ? 40 : Math.min(40 + (births.length * 10), 80);

            const svgString = this.createPieChart(generations, births.length, year);
            const icon = L.divIcon({
                html: svgString,
                className: 'custom-div-icon',
                iconSize: [iconSize, iconSize],
                iconAnchor: [iconSize/2, iconSize/2]
            });

            const marker = L.marker([location.lat, location.lng], { icon });
            
            // Ajouter le contenu de la popup
            const popupContent = `
                <div class="map-popup">
                    <h3>${location.name}</h3>
                    ${location.departement ? `<p>(${location.departement})</p>` : ''}
                    <p>${births.filter(p => p.birthYear <= year).length}/${births.length} personne(s)</p>
                    ${Object.entries(generations)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([gen, persons]) => `
                            <div style="color: ${this.generationColors[gen]}">
                                Génération ${gen}: ${persons.filter(p => p.birthYear <= year).length}/${persons.length} personne(s)
                            </div>
                        `).join('')}
                    <hr>
                    ${births
                        .sort((a, b) => a.birthYear - b.birthYear)
                        .map(person => `
                            <div style="color: ${this.generationColors[person.generation]}; opacity: ${person.birthYear <= year ? 1 : 0.5}">
                                ${person.name} (${person.birthYear})
                                - Sosa ${person.sosa}
                                ${person.birthYear > year ? ' - à venir' : ''}
                            </div>
                        `).join('')}
                </div>
            `;

            marker.bindPopup(popupContent);
            marker.addTo(this.map);
            this.markers.push(marker);
        });
    }

    addLegend() {
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend');
            div.style.background = 'white';
            div.style.padding = '10px';
            div.style.borderRadius = '4px';
            div.style.border = '1px solid #ccc';
            div.innerHTML = `
                <h4 style="margin: 0 0 8px 0">Générations</h4>
                ${Object.entries(this.generationColors)
                    .map(([gen, color]) => `
                        <div style="margin: 4px 0">
                            <span style="display: inline-block; width: 12px; height: 12px; background: ${color}; border-radius: 50%; margin-right: 5px"></span>
                            Génération ${gen}
                        </div>
                    `).join('')}
                <hr>
                <div style="font-size: 0.8em">
                    <div>Sosa pairs : ligne paternelle</div>
                    <div>Sosa impairs : ligne maternelle</div>
                </div>
            `;
            return div;
        };
        legend.addTo(this.map);
    }

    togglePlay() {
        const button = document.getElementById('play-button');
        const slider = document.getElementById('year-slider');

        if (this.isPlaying) {
            clearInterval(this.playInterval);
            button.textContent = '▶️ Lecture';
        } else {
            this.playInterval = setInterval(() => {
                const currentValue = parseInt(slider.value);
                if (currentValue >= parseInt(slider.max)) {
                    clearInterval(this.playInterval);
                    button.textContent = '▶️ Lecture';
                    this.isPlaying = false;
                    return;
                }
                slider.value = currentValue + 1;
                document.getElementById('current-year').textContent = slider.value;
                this.updateMap(parseInt(slider.value));
            }, 1000);
            button.textContent = '⏸️ Pause';
        }
        this.isPlaying = !this.isPlaying;
    }

    reset() {
        if (this.isPlaying) {
            clearInterval(this.playInterval);
            document.getElementById('play-button').textContent = '▶️ Lecture';
            this.isPlaying = false;
        }
        const slider = document.getElementById('year-slider');
        slider.value = slider.min;
        document.getElementById('current-year').textContent = slider.min;
        this.updateMap(parseInt(slider.min));
    }
}

export default AncestorsMapManager;