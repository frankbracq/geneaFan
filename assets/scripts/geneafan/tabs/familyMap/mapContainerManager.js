class MapContainerManager {
    constructor() {
        this.currentContainer = null;
    }

    moveMapToContainer(containerId, map) {
        console.group('🗺️ Déplacement de la carte vers le conteneur:', containerId);
    
        if (!map) {
            console.error('❌ Aucun instance de carte trouvée');
            console.groupEnd();
            return false;
        }
    
        const targetContainer = document.getElementById(containerId);
        if (!targetContainer) {
            console.error(`❌ Conteneur cible "${containerId}" introuvable`);
            console.groupEnd();
            return false;
        }
    
        try {
            const mapDiv = map.getDiv();
    
            console.log('Structure DOM actuelle:', {
                mapDivId: mapDiv.id,
                mapDivParentId: mapDiv.parentNode?.id,
                targetContainerId: targetContainer.id
            });
    
            // Vérifier si la carte est déjà dans le conteneur cible
            if (mapDiv.parentNode === targetContainer) {
                console.log('ℹ️ La carte est déjà dans le bon conteneur.');
                console.groupEnd();
                return true; // Aucun déplacement nécessaire
            }
    
            // Nettoyer le conteneur cible
            console.log('🧹 Nettoyage du conteneur cible');
            targetContainer.innerHTML = '';
    
            // Déplacer la carte
            console.log('📥 Déplacement de la carte');
            mapDiv.style.width = '100%';
            mapDiv.style.height = '100%';
            targetContainer.appendChild(mapDiv);
    
            // Déclencher un redimensionnement
            console.log('📐 Redimensionnement de la carte');
            google.maps.event.trigger(map, 'resize');
    
            console.log('✅ Carte déplacée avec succès');
            console.groupEnd();
            return true;
    
        } catch (error) {
            console.error('❌ Erreur lors du déplacement de la carte:', error);
            console.groupEnd();
            return false;
        }
    }
    

    reset() {
        this.currentContainer = null;
    }
}

export const mapContainerManager = new MapContainerManager();