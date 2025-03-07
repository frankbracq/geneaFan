/**
 * Configuration centralisée pour les cartes Google Maps
 */
export const MAP_CONFIG = {
    // Paramètres par défaut de la carte
    DEFAULT: {
        CENTER: { lat: 46.2276, lng: 2.2137 }, // France
        ZOOM: 6.2,
        MAX_ZOOM: 12,
        MIN_ZOOM: 3
    },
    
    // Paramètres spécifiques à chaque calque
    LAYERS: {
        ancestors: {
            MAX_ZOOM: 12,    // Zoom détaillé pour les ancêtres
            DEFAULT_VISIBLE: true,
            CLUSTER_RADIUS: 60,
            CLUSTER_MIN_POINTS: 2
        },
        family: {
            MAX_ZOOM: 10,    // Zoom plus large pour les villes familiales
            DEFAULT_VISIBLE: false,
            CLUSTER_RADIUS: 60,
            CLUSTER_MIN_POINTS: 3
        },
        surnames: {
            MAX_ZOOM: 11,    // Zoom intermédiaire pour les patronymes
            DEFAULT_VISIBLE: false,
            CLUSTER_RADIUS: 60,
            CLUSTER_MIN_POINTS: 2
        }
    },
    
    // Configuration des marqueurs
    MARKERS: {
        SIZE: {
            DEFAULT: 24,
            SMALL: 16,
            LARGE: 32
        },
        COLORS: {
            ancestors: {
                paternal: '#1e40af',  // Bleu pour la lignée paternelle
                maternal: '#be185d',  // Rose pour la lignée maternelle
                mixed: '#9333ea'      // Violet pour les emplacements mixtes
            },
            family: '#4B5563',       // Gris pour les villes familiales
            surnames: '#F4B400'      // Jaune pour les patronymes
        }
    },
    
    // Configuration des clusters
    CLUSTERS: {
        // Style commun à tous les clusters
        common: {
            BORDER_WIDTH: 2,
            BORDER_COLOR: 'white',
            SHADOW: '0 3px 6px rgba(0,0,0,0.4)',
            BORDER_RADIUS: '15%',  // Forme carrée avec coins arrondis
            MIN_SIZE: 40,
            MAX_SIZE: 70,
            FONT_SIZE: 14
        },
        // Couleurs spécifiques à chaque type de calque (plus intenses que les marqueurs)
        colors: {
            ancestors: '#7C3AED',   // Violet plus intense pour les ancêtres
            family: '#374151',      // Gris plus foncé pour les villes familiales  
            surnames: '#D97706'     // Orange plus foncé pour les patronymes
        }
    },
    
    // Configuration de la mini-carte
    OVERVIEW_MAP: {
        ZOOM_THRESHOLD: 9,   // Niveau de zoom à partir duquel la mini-carte s'affiche
        SIZE: 200            // Taille de la mini-carte en pixels
    },
    
    // Délais pour différentes opérations
    DELAYS: {
        CLUSTER_UPDATE: 300,  // Délai avant mise à jour du clustering après changement
        MARKER_ANIMATION: 200 // Délai pour les animations de marqueurs
    }
};