/**
 * Gestionnaire d'overlays pour l'application
 * Permet de créer, afficher et masquer des overlays de chargement
 * avec une API cohérente dans toute l'application
 */
class OverlayManager {
    /**
     * Crée et retourne une instance du gestionnaire d'overlay
     * @returns {OverlayManager} L'instance singleton
     */
    static getInstance() {
        if (!OverlayManager.instance) {
            OverlayManager.instance = new OverlayManager();
        }
        return OverlayManager.instance;
    }

    constructor() {
        // Référence à l'overlay global de l'application
        this.globalOverlay = document.getElementById('overlay');
        
        // Map pour stocker les références aux overlays spécifiques
        this.overlays = new Map();
    }

    /**
     * Affiche l'overlay global de l'application
     * @param {string} message - Message à afficher (optionnel)
     */
    showGlobal(message = 'Chargement en cours...') {
        if (!this.globalOverlay) {
            console.error("L'overlay global n'a pas été trouvé");
            return;
        }
        
        // Mettre à jour le message si nécessaire
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
        
        // S'assurer que l'overlay est visible et opaque
        this.globalOverlay.classList.remove('fade-out');
        this.globalOverlay.style.display = 'flex';
        this.globalOverlay.style.opacity = '1';
    }

    /**
     * Masque l'overlay global avec une animation de transition
     * @param {number} delay - Délai avant de masquer complètement l'overlay (en ms)
     */
    hideGlobal(delay = 500) {
        if (!this.globalOverlay) {
            return;
        }
        
        // Ajouter la classe pour l'animation de disparition
        this.globalOverlay.classList.add('fade-out');
        
        // Masquer complètement après la transition
        setTimeout(() => {
            this.globalOverlay.style.display = 'none';
        }, delay);
    }

    /**
     * Crée et affiche un overlay pour un élément spécifique
     * @param {string} targetId - ID de l'élément cible
     * @param {Object} options - Options de configuration
     * @param {string} options.message - Message à afficher
     * @param {boolean} options.spinner - Afficher un spinner ou non
     * @param {string} options.customClass - Classe CSS supplémentaire à ajouter
     * @returns {HTMLElement} L'élément overlay créé
     */
    show(targetId, options = {}) {
        const { 
            message = 'Chargement...', 
            spinner = true,
            customClass = '' 
        } = options;
        
        // Récupérer l'élément cible
        const targetElement = document.getElementById(targetId);
        if (!targetElement) {
            console.error(`L'élément cible ${targetId} n'a pas été trouvé`);
            return null;
        }
        
        // S'assurer que le parent a une position relative pour le positionnement absolu de l'overlay
        if (targetElement.style.position !== 'relative') {
            targetElement.style.position = 'relative';
        }
        
        // Vérifier si un overlay existe déjà pour cet élément
        let overlay = this.overlays.get(targetId);
        
        // S'il existe déjà, le mettre à jour et l'afficher
        if (overlay) {
            const messageElement = overlay.querySelector('.overlay-message');
            if (messageElement) {
                messageElement.textContent = message;
            }
            
            overlay.classList.remove('fade-out');
            overlay.style.display = 'flex';
            return overlay;
        }
        
        // Créer un nouvel overlay
        overlay = document.createElement('div');
        overlay.className = `tab-overlay ${customClass}`.trim();
        overlay.id = `overlay-${targetId}`;
        
        // Créer le contenu de l'overlay
        let contentHTML = '<div class="overlay-content">';
        
        if (spinner) {
            contentHTML += `
                <div class="spinner-container">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Chargement</span>
                    </div>
                </div>
            `;
        }
        
        if (message) {
            contentHTML += `<div class="overlay-message">${message}</div>`;
        }
        
        contentHTML += '</div>';
        
        overlay.innerHTML = contentHTML;
        
        // Ajouter l'overlay à l'élément cible
        targetElement.appendChild(overlay);
        
        // Stocker la référence
        this.overlays.set(targetId, overlay);
        
        return overlay;
    }

    /**
     * Masque l'overlay d'un élément spécifique
     * @param {string} targetId - ID de l'élément cible
     * @param {number} delay - Délai avant de masquer complètement l'overlay (en ms)
     */
    hide(targetId, delay = 300) {
        const overlay = this.overlays.get(targetId);
        if (!overlay) {
            return;
        }
        
        // Ajouter la classe pour l'animation de disparition
        overlay.classList.add('fade-out');
        
        // Masquer complètement après la transition
        setTimeout(() => {
            overlay.style.display = 'none';
        }, delay);
    }

    /**
     * Supprime définitivement l'overlay d'un élément
     * @param {string} targetId - ID de l'élément cible
     */
    remove(targetId) {
        const overlay = this.overlays.get(targetId);
        if (!overlay) {
            return;
        }
        
        // Supprimer l'élément du DOM
        overlay.remove();
        
        // Supprimer la référence
        this.overlays.delete(targetId);
    }
}

// Export de l'instance singleton
export default OverlayManager.getInstance();