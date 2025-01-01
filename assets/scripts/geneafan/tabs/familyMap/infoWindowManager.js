class InfoWindowManager {
    constructor() {
        this.infoWindow = null;
        this.contentCache = new Map();
        this.currentMarker = null;
        this.MAX_CACHE_SIZE = 50;

        this.styles = {
            colors: {
                paternal: '#3b82f6',
                maternal: '#ec4899',
                mixed: '#8b5cf6'
            },
            generations: {
                0: '#1e3a8a', 1: '#1e40af', 2: '#1d4ed8',
                3: '#2563eb', 4: '#3b82f6', 5: '#60a5fa',
                6: '#93c5fd', 7: '#bfdbfe', 8: '#dbeafe',
                9: '#eff6ff'
            }
        };
    }

    initialize() {
        if (this.infoWindow) return;
        
        this.infoWindow = new google.maps.InfoWindow({ maxWidth: 400 });
        
        this.infoWindow.addListener('closeclick', () => {
            this.currentMarker = null;
        });

        setInterval(() => this.cleanCache(), 300000);
    }

    showInfoWindow(marker, location, births, generations) {
        if (!this.infoWindow) this.initialize();
        
        const cacheKey = this.getCacheKey(location, births);
        
        if (this.currentMarker === marker) return;
        
        let content = this.contentCache.get(cacheKey);
        if (!content) {
            content = this.generateInfoWindowContent({location, births, generations});
            this.cacheContent(cacheKey, content);
        }

        this.infoWindow.setContent(content);
        this.infoWindow.open({
            anchor: marker,
            map: marker.getMap()
        });
        
        this.currentMarker = marker;
    }

    getCacheKey(location, births) {
        return `${location.lat}-${location.lng}-${births.length}`;
    }

    cacheContent(key, content) {
        if (this.contentCache.size >= this.MAX_CACHE_SIZE) {
            // Supprimer l'entrée la plus ancienne
            const firstKey = this.contentCache.keys().next().value;
            this.contentCache.delete(firstKey);
        }
        this.contentCache.set(key, content);
    }

    cleanCache() {
        if (this.contentCache.size > this.MAX_CACHE_SIZE / 2) {
            // Garder seulement les entrées les plus récentes
            const entries = Array.from(this.contentCache.entries());
            const toKeep = entries.slice(-Math.floor(this.MAX_CACHE_SIZE / 2));
            this.contentCache.clear();
            toKeep.forEach(([key, value]) => this.contentCache.set(key, value));
        }
    }

    precomputeStats(births) {
        const total = births.length;
        const paternalCount = births.filter(b => 
            this.determineBranchFromSosa(b.sosa) === 'paternal'
        ).length;
        
        return {
            total,
            paternalCount,
            maternalCount: total - paternalCount
        };
    }

    generateInfoWindowContent({ location, births, generations }) {
        return `
            <div class="info-window">
                <div class="flex flex-col space-y-4">
                    <div class="text-center">
                        <h3 class="text-lg font-semibold">${location.name}</h3>
                        ${location.departement ? 
                            `<p class="text-sm text-gray-600">${location.departement}</p>` : ''}
                        
                        <p class="mt-2 text-sm">
                            <span class="font-medium">${births.length}</span> naissances
                        </p>
                        ${this.getBranchesIndicator(births)} 
                    </div>

                    <div class="flex gap-4 justify-center items-start">
                        <div class="w-32 h-32" style="min-width: 128px;">
                            ${this.createPieChartSVG(generations, births.length)}
                        </div>
                        <div class="flex flex-col gap-2">
                            ${this.generateGenerationsLegend(generations)}
                        </div>
                    </div>

                    <div class="mt-4">
                        <h4 class="font-medium mb-2">Personnes nées dans ce lieu :</h4>
                        <div class="space-y-2 max-h-48 overflow-y-auto">
                            ${this.generatePersonsList(births)}
                        </div>
                    </div>
                </div>
            </div>`;
    }

    generateGenerationsLegend(generations) {
        return Object.entries(generations)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([gen, persons]) => {
                const count = persons ? persons.length : 0;
                return `
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3" style="background-color: ${this.styles.generations[gen]}"></div>
                        <span class="text-sm">
                            Gén. ${gen} 
                            <span class="font-medium">(${count})</span>
                        </span>
                    </div>`;
            }).join('');
    }

    generatePersonsList(births) {
        return births
            .sort((a, b) => a.birthYear - b.birthYear)
            .map(person => `
                <div class="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <div class="w-2 h-full" 
                         style="color: ${this.determineBranchFromSosa(person.sosa) === 'paternal' ? 
                                       this.styles.colors.paternal : this.styles.colors.maternal}">
                            ${person.name}
                        </div>
                        <div class="text-sm text-gray-600">
                            ${person.birthYear} • Sosa ${person.sosa}
                        </div>
                    </div>
                </div>
            `).join('');
    }

    getBranchesIndicator(births) {
        const paternalCount = births.filter(b => 
            this.determineBranchFromSosa(b.sosa) === 'paternal'
        ).length;
        const maternalCount = births.filter(b => 
            this.determineBranchFromSosa(b.sosa) === 'maternal'
        ).length;
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

    createPieChartSVG(generations, total) {
        const size = 128;
        const center = size / 2;
        const radius = (size / 2) - 2;

        if (Object.entries(generations).length === 1) {
            return this.createSingleGenerationPie(Object.entries(generations)[0][0], size, center, radius);
        }

        return this.createMultiGenerationPie(generations, total, size, center, radius);
    }

    createSingleGenerationPie(gen, size, center, radius) {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
                <circle 
                    cx="${center}" 
                    cy="${center}" 
                    r="${radius}"
                    fill="${this.styles.generations[gen]}"
                    stroke="white"
                    stroke-width="1"
                />
            </svg>`;
    }

    createMultiGenerationPie(generations, total, size, center, radius) {
        let startAngle = 0;
        const paths = Object.entries(generations)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([gen, births]) => {
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

                return `
                    <path 
                        d="${path}" 
                        fill="${this.styles.generations[gen]}"
                        stroke="white"
                        stroke-width="1"
                    />`;
            }).join('');

        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
                ${paths}
            </svg>`;
    }

    getBranchColor(births) {
        const paternalCount = births.filter(b => 
            this.determineBranchFromSosa(b.sosa) === 'paternal'
        ).length;
        const total = births.length;

        if (paternalCount === total) return this.styles.colors.paternal;
        if (paternalCount === 0) return this.styles.colors.maternal;
        return this.styles.colors.mixed;
    }

    determineBranchFromSosa(sosa) {
        if (sosa === 1) return null;
        while (sosa > 3) sosa = Math.floor(sosa / 2);
        return sosa === 2 ? 'paternal' : 'maternal';
    }
}

// Usage
export const infoWindowManager = new InfoWindowManager();