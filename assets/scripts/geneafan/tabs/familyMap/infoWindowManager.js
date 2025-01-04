class InfoWindowManager {
    constructor() {
        this.currentInfoWindow = null;
        this.styles = {
            colors: {
                paternal: '#1e40af', // blue-800
                maternal: '#be185d', // pink-800
                mixed: '#9333ea'     // purple-700
            }
        };
    }

    initialize() {
        if (this.currentInfoWindow) {
            this.currentInfoWindow.close();
            this.currentInfoWindow = null;
        }
    }

    groupBirthsByGeneration(births, generations) {
        const grouped = new Map();
        
        births.forEach(birth => {
            const generation = birth.generation;
            if (!grouped.has(generation)) {
                grouped.set(generation, []);
            }
            grouped.get(generation).push(birth);
        });

        // Trier par génération
        return new Map([...grouped.entries()].sort((a, b) => a[0] - b[0]));
    }

    determineBranchFromSosa(sosa) {
        if (!sosa) return 'unknown';
        // Les sosa pairs sont paternels
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
            return branches.has('paternal') ? this.styles.colors.paternal : this.styles.colors.maternal;
        }
        return this.styles.colors.mixed;
    }

    createInfoWindowContent(birthsByGeneration, location) {
        const div = document.createElement('div');
        div.className = 'info-window-content';

        // Titre avec le nom du lieu
        const title = document.createElement('h3');
        title.textContent = location.name;
        title.className = 'font-bold text-lg mb-2';
        div.appendChild(title);

        // Si un département est disponible, l'ajouter
        if (location.departement) {
            const dept = document.createElement('p');
            dept.textContent = `Département: ${location.departement}`;
            dept.className = 'text-sm text-gray-600 mb-2';
            div.appendChild(dept);
        }

        // Conteneur pour les personnes par génération
        const generations = document.createElement('div');
        generations.className = 'generations-list space-y-2';

        birthsByGeneration.forEach((birthsInGen, gen) => {
            const genDiv = document.createElement('div');
            genDiv.className = 'generation-group';

            // Titre de la génération
            const genTitle = document.createElement('h4');
            genTitle.textContent = `Génération ${gen}`;
            genTitle.className = 'font-semibold text-sm text-gray-700';
            genDiv.appendChild(genTitle);

            // Liste des personnes
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
            generations.appendChild(genDiv);
        });

        div.appendChild(generations);
        return div;
    }

    showInfoWindow(marker, location, births, generations) {
        const birthsByGeneration = this.groupBirthsByGeneration(births, generations);
        const content = this.createInfoWindowContent(birthsByGeneration, location);

        if (this.currentInfoWindow) {
            this.currentInfoWindow.close();
        }

        this.currentInfoWindow = new google.maps.InfoWindow({
            content: content,
            maxWidth: 300
        });

        // Pour les AdvancedMarkerElement, on utilise la position du marqueur
        const position = marker.position;
        this.currentInfoWindow.setPosition(position);

        // Afficher l'InfoWindow sur la carte du marqueur
        this.currentInfoWindow.open({
            map: marker.map,
            shouldFocus: false
        });

        // Ajuster la position de l'InfoWindow
        const offset = marker.content ? marker.content.offsetHeight || 0 : 0;
        this.currentInfoWindow.setOptions({
            pixelOffset: new google.maps.Size(0, -(offset / 2))
        });
    }
}

export const infoWindowManager = new InfoWindowManager();