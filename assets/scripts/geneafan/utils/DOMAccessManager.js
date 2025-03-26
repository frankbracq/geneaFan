/**
 * DOMAccessManager
 * 
 * Service d'abstraction pour les accès au DOM, permettant de faciliter
 * la migration future vers une architecture Shadow DOM.
 * 
 * Fournit une couche d'abstraction au-dessus des API DOM standards
 * qui permet de cibler soit le document global, soit un Shadow DOM.
 */

class DOMAccessManager {
    /**
     * Crée une nouvelle instance du gestionnaire DOM
     * @param {Document|ShadowRoot} root - L'élément racine à utiliser pour les requêtes DOM (document par défaut)
     */
    constructor(root = document) {
        this.root = root;
        this.isShadowDom = root !== document;
    }

    /**
     * Sélectionne le premier élément qui correspond au sélecteur
     * @param {string} selector - Le sélecteur CSS
     * @returns {Element|null} - L'élément trouvé ou null
     */
    querySelector(selector) {
        return this.root.querySelector(selector);
    }
    
    /**
     * Sélectionne tous les éléments qui correspondent au sélecteur
     * @param {string} selector - Le sélecteur CSS
     * @returns {NodeList} - Liste des éléments trouvés
     */
    querySelectorAll(selector) {
        return this.root.querySelectorAll(selector);
    }
    
    /**
     * Recherche un élément par son ID
     * @param {string} id - L'identifiant de l'élément
     * @returns {Element|null} - L'élément trouvé ou null
     */
    getElementById(id) {
        if (this.isShadowDom) {
            return this.root.querySelector(`#${id}`);
        }
        return document.getElementById(id);
    }
    
    /**
     * Crée un nouvel élément DOM
     * @param {string} tagName - Le type d'élément à créer
     * @returns {Element} - L'élément créé
     */
    createElement(tagName) {
        return document.createElement(tagName);
    }
    
    /**
     * Ajoute un nœud enfant à un élément parent
     * @param {Element} parent - L'élément parent
     * @param {Element} child - L'élément enfant à ajouter
     */
    appendChild(parent, child) {
        parent.appendChild(child);
    }
    
    /**
     * Insère un nœud avant un nœud de référence
     * @param {Element} parent - L'élément parent
     * @param {Element} newNode - Le nœud à insérer
     * @param {Element} referenceNode - Le nœud de référence
     */
    insertBefore(parent, newNode, referenceNode) {
        parent.insertBefore(newNode, referenceNode);
    }
    
    /**
     * Supprime un nœud enfant d'un élément parent
     * @param {Element} parent - L'élément parent
     * @param {Element} child - L'élément enfant à supprimer
     */
    removeChild(parent, child) {
        parent.removeChild(child);
    }
    
    /**
     * Ajoute une classe CSS à un élément
     * @param {Element} element - L'élément cible
     * @param {string} className - La classe à ajouter
     */
    addClass(element, className) {
        element.classList.add(className);
    }
    
    /**
     * Supprime une classe CSS d'un élément
     * @param {Element} element - L'élément cible
     * @param {string} className - La classe à supprimer
     */
    removeClass(element, className) {
        element.classList.remove(className);
    }
    
    /**
     * Ajoute ou supprime une classe CSS d'un élément
     * @param {Element} element - L'élément cible
     * @param {string} className - La classe à basculer
     * @param {boolean} [force] - Si présent, ajoute la classe si true, la supprime si false
     */
    toggleClass(element, className, force) {
        element.classList.toggle(className, force);
    }
    
    /**
     * Définit une propriété de style CSS sur un élément
     * @param {Element} element - L'élément cible
     * @param {string} property - La propriété CSS à définir
     * @param {string} value - La valeur à attribuer
     */
    setStyle(element, property, value) {
        element.style[property] = value;
    }
    
    /**
     * Ajoute un écouteur d'événement à un élément
     * @param {Element} element - L'élément cible
     * @param {string} event - Le type d'événement
     * @param {Function} handler - La fonction de traitement
     * @param {Object|boolean} [options] - Options du listener ou useCapture
     */
    addEventListener(element, event, handler, options) {
        element.addEventListener(event, handler, options);
    }
    
    /**
     * Supprime un écouteur d'événement d'un élément
     * @param {Element} element - L'élément cible
     * @param {string} event - Le type d'événement
     * @param {Function} handler - La fonction de traitement
     * @param {Object|boolean} [options] - Options du listener ou useCapture
     */
    removeEventListener(element, event, handler, options) {
        element.removeEventListener(event, handler, options);
    }
    
    /**
     * Crée ou récupère un conteneur pour un composant
     * @param {string} id - L'ID du conteneur
     * @param {string} [containerClass=''] - La classe CSS du conteneur
     * @returns {Element} - L'élément conteneur
     */
    createComponentContainer(id, containerClass = '') {
        const container = this.getElementById(id);
        if (container) return container;
        
        const newContainer = this.createElement('div');
        newContainer.id = id;
        if (containerClass) {
            newContainer.className = containerClass;
        }
        
        // Ajouter au body si dans le document principal, sinon à la racine Shadow
        if (!this.isShadowDom) {
            document.body.appendChild(newContainer);
        } else {
            this.root.appendChild(newContainer);
        }
        
        return newContainer;
    }
    
    /**
     * Définit le contenu HTML d'un élément
     * @param {Element} element - L'élément cible
     * @param {string} html - Le contenu HTML
     */
    setInnerHTML(element, html) {
        element.innerHTML = html;
    }
    
    /**
     * Définit le contenu textuel d'un élément
     * @param {Element} element - L'élément cible
     * @param {string} text - Le contenu textuel
     */
    setTextContent(element, text) {
        element.textContent = text;
    }
}

// Instance singleton pour l'utilisation globale
const domManager = new DOMAccessManager();

// Exporte l'instance par défaut
export default domManager;

// Fonction factory pour créer une instance pour une racine spécifique (ex. Shadow DOM)
export function createDOMManager(root) {
    return new DOMAccessManager(root);
}