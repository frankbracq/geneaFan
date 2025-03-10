/**
 * Calcule le pourcentage de padding à appliquer en fonction de la hauteur du conteneur
 * @param {number} containerHeight - Hauteur du conteneur en pixels
 * @returns {number} - Pourcentage de padding (0-0.3)
 */
export function calculatePaddingPercentage(containerHeight) {
    // Plus le conteneur est petit, plus le padding est important
    if (containerHeight < 300) {
        return 0.25; // 25% de padding pour très petits conteneurs
    } else if (containerHeight < 500) {
        return 0.2; // 20% de padding pour petits conteneurs
    } else if (containerHeight < 700) {
        return 0.15; // 15% de padding pour conteneurs moyens
    } else {
        return 0.1; // 10% de padding pour grands conteneurs
    }
}

/**
 * Calcule un niveau de zoom maximal dynamique en fonction de la hauteur du conteneur
 * @param {number} containerHeight - Hauteur du conteneur en pixels
 * @returns {number} - Niveau de zoom maximal calculé
 */
export function calculateDynamicZoom(containerHeight) {
    // Définir les seuils de hauteur et les niveaux de zoom correspondants
    const zoomLevels = [
        { height: 300, zoom: 10 },   // Petit conteneur
        { height: 500, zoom: 11 },   // Conteneur moyen
        { height: 700, zoom: 12 },   // Grand conteneur
        { height: 900, zoom: 13 }    // Très grand conteneur
    ];
    
    // Trouver le niveau de zoom approprié
    for (const level of zoomLevels) {
        if (containerHeight < level.height) {
            return level.zoom;
        }
    }
    
    // Par défaut pour très grands écrans
    return 13;
}

/**
 * Calcule un padding pour fitBounds en fonction de la taille du conteneur
 * @param {HTMLElement} mapDiv - Élément DOM du conteneur de carte
 * @returns {Object} - Configuration de padding pour fitBounds
 */
export function calculatePadding(mapDiv) {
    const containerHeight = mapDiv.offsetHeight;
    const containerWidth = mapDiv.offsetWidth;
    
    const paddingPercentage = calculatePaddingPercentage(containerHeight);
    
    return {
        top: Math.round(containerHeight * paddingPercentage),
        right: Math.round(containerWidth * paddingPercentage),
        bottom: Math.round(containerHeight * paddingPercentage),
        left: Math.round(containerWidth * paddingPercentage)
    };
}