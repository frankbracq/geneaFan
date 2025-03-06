/**
 * Gestionnaire de notifications pour l'application
 * Permet d'afficher des messages temporaires à l'utilisateur
 */
class NotificationManager {
    /**
     * Crée et retourne une instance du gestionnaire de notifications
     * @returns {NotificationManager} L'instance singleton
     */
    static getInstance() {
        if (!NotificationManager.instance) {
            NotificationManager.instance = new NotificationManager();
        }
        return NotificationManager.instance;
    }

    constructor() {
        // Créer le conteneur de notifications s'il n'existe pas déjà
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }

        // Ajouter les styles CSS nécessaires
        this.addStyles();
    }

    /**
     * Ajoute les styles CSS nécessaires pour les notifications
     */
    addStyles() {
        if (document.getElementById('notification-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 350px;
            }

            .notification {
                padding: 15px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                opacity: 0;
                transform: translateY(-20px);
                transition: opacity 0.3s ease, transform 0.3s ease;
                background-color: white;
                border-left: 4px solid #3498db;
            }

            .notification.show {
                opacity: 1;
                transform: translateY(0);
            }

            .notification.info {
                border-left-color: #3498db;
            }

            .notification.success {
                border-left-color: #2ecc71;
            }

            .notification.warning {
                border-left-color: #f39c12;
            }

            .notification.error {
                border-left-color: #e74c3c;
            }

            .notification-content {
                flex: 1;
                margin-right: 10px;
            }

            .notification-close {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 16px;
                padding: 0;
                color: #7f8c8d;
            }

            @media (max-width: 480px) {
                .notification-container {
                    left: 20px;
                    right: 20px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Affiche une notification à l'utilisateur
     * @param {string} message - Message à afficher
     * @param {Object} options - Options de configuration
     * @param {string} options.type - Type de notification ('info', 'success', 'warning', 'error')
     * @param {number} options.duration - Durée d'affichage en ms (0 pour ne pas disparaître automatiquement)
     * @returns {HTMLElement} L'élément de notification créé
     */
    show(message, options = {}) {
        const { 
            type = 'info', 
            duration = 3000 
        } = options;
        
        // Créer l'élément de notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">${message}</div>
            <button type="button" class="notification-close" aria-label="Fermer">&times;</button>
        `;
        
        // Ajouter au conteneur
        this.container.appendChild(notification);
        
        // Force un reflow pour que l'animation fonctionne
        void notification.offsetWidth;
        
        // Déclencher l'animation d'entrée
        notification.classList.add('show');
        
        // Configurer le bouton de fermeture
        const closeButton = notification.querySelector('.notification-close');
        closeButton.addEventListener('click', () => {
            this.hide(notification);
        });
        
        // Disparition automatique après la durée spécifiée
        if (duration > 0) {
            setTimeout(() => {
                this.hide(notification);
            }, duration);
        }
        
        return notification;
    }

    /**
     * Masque une notification
     * @param {HTMLElement} notification - Élément notification à masquer
     */
    hide(notification) {
        notification.classList.remove('show');
        
        // Attendre la fin de l'animation avant de supprimer l'élément
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    /**
     * Affiche une notification de type information
     * @param {string} message - Message à afficher
     * @param {number} duration - Durée d'affichage en ms
     */
    info(message, duration = 3000) {
        return this.show(message, { type: 'info', duration });
    }

    /**
     * Affiche une notification de type succès
     * @param {string} message - Message à afficher
     * @param {number} duration - Durée d'affichage en ms
     */
    success(message, duration = 3000) {
        return this.show(message, { type: 'success', duration });
    }

    /**
     * Affiche une notification de type avertissement
     * @param {string} message - Message à afficher
     * @param {number} duration - Durée d'affichage en ms
     */
    warning(message, duration = 3000) {
        return this.show(message, { type: 'warning', duration });
    }

    /**
     * Affiche une notification de type erreur
     * @param {string} message - Message à afficher
     * @param {number} duration - Durée d'affichage en ms
     */
    error(message, duration = 4000) {
        return this.show(message, { type: 'error', duration });
    }
}

// Export de l'instance singleton
export default NotificationManager.getInstance();