import { storeEvents, EVENTS } from '../../../common/stores/storeEvents.js';
import { layerManager } from '../managers/layerManager.js';
import { Offcanvas } from "bootstrap";

/**
 * Classe pour gérer le contrôle dropdown des couches sur Google Maps
 * Complètement séparée de GoogleMapsStore pour une meilleure séparation des préoccupations
 */
export class LayerDropdownControl {
    /**
     * Configuration des couches disponibles
     * Centralisée pour faciliter l'ajout ou la suppression de couches
     */
    static LAYER_CONFIG = [
        { key: 'ancestors', label: 'Ancêtres', icon: 'fa-tree' },
        { key: 'family', label: 'Famille', icon: 'fa-users' },
        { key: 'surnames', label: 'Patronymes', icon: 'fa-font' }
    ];

    /**
     * Constructeur
     * @param {google.maps.Map} map - L'instance de Google Maps
     */
    constructor(map) {
        this.map = map;
        this.controlDiv = null;
        this.dropdownState = { isOpen: false };
        this.rootPersonInfo = { id: null, name: "" };

        // Référence à la fonction de mise à jour du tooltip
        this.updateTooltipCallback = null;

        // Éléments DOM
        this.mainButton = null;
        this.tooltip = null;
        this.dropdownContent = null;

        // Intervalle pour mettre à jour le sélecteur de patronymes
        this.surnameUpdateInterval = null;
    }

    /**
     * Ajoute le contrôle à la carte
     * @returns {HTMLElement} - L'élément DOM du contrôle
     */
    addToMap() {
        if (this.controlDiv) {
            console.warn("Le contrôle est déjà ajouté à la carte");
            return this.controlDiv;
        }

        // Création des éléments DOM
        this.controlDiv = this.createControlContainer();
        const elements = this.createControlElements();
        this.mainButton = elements.mainButton;
        this.tooltip = elements.tooltip;
        this.dropdownContent = elements.dropdownContent;

        // Ajout au conteneur
        this.controlDiv.appendChild(this.mainButton);
        this.controlDiv.appendChild(this.tooltip);
        this.controlDiv.appendChild(this.dropdownContent);

        // Configuration des événements
        this.setupEvents();

        // Ajout à la carte
        this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(this.controlDiv);
        console.log('✅ Contrôle de couches ajouté en position TOP_LEFT');

        // Mettre à jour le sélecteur de patronymes toutes les 5 secondes
        // pour s'assurer qu'il reste synchronisé avec les données
        this.surnameUpdateInterval = setInterval(() => {
            const surnameSelector = document.getElementById('layerDropdownSurnameSelector');
            if (surnameSelector && surnameSelector.style.display !== 'none') {
                this.updateSurnameSelector(surnameSelector);
            }
        }, 5000);

        return this.controlDiv;
    }

    /**
     * Crée le conteneur principal du contrôle
     * @returns {HTMLElement} - L'élément conteneur
     */
    createControlContainer() {
        const controlDiv = document.createElement('div');
        controlDiv.className = 'map-layer-control-container';
        controlDiv.style.margin = '10px';
        controlDiv.style.position = 'relative';
        controlDiv.style.backgroundColor = '#fff';
        controlDiv.style.borderRadius = '4px';
        controlDiv.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
        controlDiv.style.overflow = 'visible';

        return controlDiv;
    }

    /**
     * Crée tous les éléments du contrôle
     * @returns {Object} - Les éléments créés
     */
    createControlElements() {
        // Création du bouton principal
        const mainButton = this.createMainButton();

        // Création du tooltip
        const tooltip = this.createTooltip();

        // Création du contenu du dropdown
        const dropdownContent = this.createDropdownContent();

        return { mainButton, tooltip, dropdownContent };
    }

    /**
     * Crée le bouton principal du contrôle
     * @returns {HTMLButtonElement} - Le bouton
     */
    createMainButton() {
        const button = document.createElement('button');
        button.className = 'map-layer-main-button';
        button.title = 'Couches et options';

        // Style du bouton
        this.styleControlButton(button);
        button.style.padding = '8px 16px';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.gap = '8px';
        button.style.width = '100%';
        button.style.justifyContent = 'space-between';

        // Contenu du bouton
        const labelSpan = document.createElement('span');
        labelSpan.textContent = 'Couches';
        button.appendChild(labelSpan);

        // Icône (si Font Awesome est disponible)
        if (window.FontAwesome) {
            const icon = document.createElement('i');
            icon.className = 'fas fa-layers';
            button.prepend(icon);
        }

        // Flèche pour indiquer le dropdown
        const arrowSpan = document.createElement('span');
        arrowSpan.innerHTML = '▼';
        arrowSpan.style.fontSize = '10px';
        button.appendChild(arrowSpan);

        return button;
    }

    /**
     * Crée le tooltip
     * @returns {HTMLDivElement} - L'élément tooltip
     */
    createTooltip() {
        const tooltip = document.createElement('div');
        tooltip.className = 'map-layer-tooltip';
        tooltip.style.display = 'none';
        tooltip.style.position = 'absolute';
        tooltip.style.top = '-40px';
        tooltip.style.left = '0';
        tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '5px 10px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.fontSize = '12px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.zIndex = '1001';

        return tooltip;
    }

    /**
     * Crée le contenu du dropdown
     * @returns {HTMLDivElement} - L'élément contenant les options
     */
    createDropdownContent() {
        const dropdownContent = document.createElement('div');
        dropdownContent.className = 'map-layer-dropdown-content';
        dropdownContent.style.display = 'none';
        dropdownContent.style.position = 'absolute';
        dropdownContent.style.top = '100%';
        dropdownContent.style.left = '0';
        dropdownContent.style.backgroundColor = '#fff';
        dropdownContent.style.minWidth = '200px';
        dropdownContent.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
        dropdownContent.style.zIndex = '1000';
        dropdownContent.style.borderRadius = '4px';
        dropdownContent.style.marginTop = '5px';

        // Ajouter un en-tête avec le titre et le bouton de fermeture
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.padding = '10px 16px';
        header.style.borderBottom = '1px solid #e0e0e0';

        const title = document.createElement('span');
        title.textContent = 'Couches de la carte';
        title.style.fontWeight = 'bold';

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'btn-close';
        closeButton.style.fontSize = '0.8rem';
        closeButton.setAttribute('aria-label', 'Fermer');

        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dropdownState.isOpen = false;
            this.dropdownContent.style.display = 'none';
        });

        header.appendChild(title);
        header.appendChild(closeButton);
        dropdownContent.appendChild(header);

        // Utiliser un DocumentFragment pour optimiser les performances
        const fragment = document.createDocumentFragment();

        // Ajouter les éléments de couches au fragment
        LayerDropdownControl.LAYER_CONFIG.forEach(layer => {
            fragment.appendChild(this.createLayerItem(layer));
        });

        // Ajouter tous les éléments au dropdown
        dropdownContent.appendChild(fragment);

        return dropdownContent;
    }

    /**
     * Crée un élément pour une couche
     * @param {Object} layer - Configuration de la couche
     * @returns {HTMLDivElement} - L'élément pour la couche
     */
    createLayerItem(layer) {
        const layerItem = document.createElement('div');
        layerItem.className = 'map-layer-item';
        layerItem.dataset.layerKey = layer.key;
        layerItem.style.padding = '10px 16px';
        layerItem.style.cursor = 'pointer';
        layerItem.style.display = 'flex';
        layerItem.style.flexDirection = 'column'; // Modifié pour permettre un affichage vertical
        layerItem.style.transition = 'background-color 0.2s';

        // Créer le conteneur pour le radio et le label (première ligne)
        const radioContainer = document.createElement('div');
        radioContainer.style.display = 'flex';
        radioContainer.style.alignItems = 'center';
        radioContainer.style.gap = '8px';
        radioContainer.style.width = '100%';

        // Créer le bouton radio
        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.name = 'mapLayer';
        radioInput.value = layer.key;
        radioInput.id = `layer-${layer.key}`;
        radioInput.checked = layerManager.isLayerVisible(layer.key);

        // Créer le label
        const label = document.createElement('label');
        label.htmlFor = `layer-${layer.key}`;
        label.textContent = layer.label;
        label.style.margin = '0';
        label.style.cursor = 'pointer';

        // Ajouter les éléments au conteneur de radio
        radioContainer.appendChild(radioInput);
        radioContainer.appendChild(label);

        // Ajouter le conteneur de radio à l'élément de couche
        layerItem.appendChild(radioContainer);

        // Ajouter un sous-menu de sélection pour le calque des patronymes
        if (layer.key === 'surnames') {
            const surnameSelector = document.createElement('select');
            surnameSelector.className = 'form-select form-select-sm mt-2';
            surnameSelector.id = 'layerDropdownSurnameSelector';
            surnameSelector.style.display = layerManager.isLayerVisible('surnames') ? 'block' : 'none';
            surnameSelector.style.width = '100%';

            // Remplir le sélecteur avec les patronymes disponibles
            this.updateSurnameSelector(surnameSelector);

            // Ajouter l'écouteur d'événements
            surnameSelector.addEventListener('change', (e) => {
                e.stopPropagation(); // Empêcher la propagation pour éviter de déclencher le clic sur layerItem
                const selectedSurname = e.target.value;
                // Obtenir la référence au store des patronymes
                const surnamesStore = layerManager.layerConfig.surnames?.storeRef;
                if (surnamesStore) {
                    surnamesStore.setSurname(selectedSurname);
                }
            });

            layerItem.appendChild(surnameSelector);
        }

        return layerItem;
    }

    // Nouvelle méthode pour mettre à jour la liste des patronymes
    updateSurnameSelector(selectorElement) {
        // Obtenir la référence au store des patronymes
        const surnamesStore = layerManager.layerConfig.surnames?.storeRef;
        if (!surnamesStore || !selectorElement) return;

        // Obtenir les données des patronymes depuis familyTownsStore
        const familyStore = layerManager.layerConfig.family?.storeRef;
        if (!familyStore) return;

        const surnamesCount = new Map();

        // Compter les occurrences de chaque patronyme
        familyStore.townsData.forEach(townData => {
            if (townData.events && townData.events.birth) {
                townData.events.birth.forEach(event => {
                    const surname = event.personDetails?.surname;
                    if (surname) {
                        surnamesCount.set(surname, (surnamesCount.get(surname) || 0) + 1);
                    }
                });
            }
        });

        // Trier les patronymes par fréquence
        const sortedSurnames = [...surnamesCount.entries()]
            .sort((a, b) => b[1] - a[1]);

        // Sauvegarder la valeur actuelle pour la restaurer après mise à jour
        const currentValue = selectorElement.value;

        // Mettre à jour l'élément dropdown
        selectorElement.innerHTML = `
        <option value="">Sélectionner un patronyme...</option>
        ${sortedSurnames.map(([surname, count]) =>
            `<option value="${surname}" ${surname === surnamesStore.currentSurname ? 'selected' : ''}>
                ${surname.toUpperCase()} (${count})
            </option>`
        ).join('')}
    `;

        // Restaurer la valeur ou sélectionner le patronyme actuel
        if (currentValue) {
            selectorElement.value = currentValue;
        } else if (surnamesStore.currentSurname) {
            selectorElement.value = surnamesStore.currentSurname;
        }
    }

    /**
     * Configure les styles d'un bouton
     * @param {HTMLButtonElement} button - Le bouton à styliser
     */
    styleControlButton(button) {
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

    /**
     * Configure tous les événements du contrôle
     */
    setupEvents() {
        this.setupDropdownEvents();
        this.setupTooltipEvents();
        this.setupGlobalEvents();
        this.setupLayerChangedListener();

        // Initialiser le tooltip
        this.updateTooltipText();
    }

    /**
     * Configure les événements du dropdown
     */
    setupDropdownEvents() {
        // Délégation d'événements pour les éléments de couche
        this.dropdownContent.addEventListener('click', (e) => {
            // Ne pas réagir aux clics sur le sélecteur de patronymes
            if (e.target.closest('select') || e.target.tagName === 'OPTION') {
                e.stopPropagation();
                return;
            }
            
            const layerItem = e.target.closest('.map-layer-item');
            if (!layerItem) return;
            
            e.stopPropagation();
            
            // Gérer le clic sur une couche
            const layerKey = layerItem.dataset.layerKey;
            if (layerKey) {
                layerManager.setLayerVisibility(layerKey, true);
                
                // Mettre à jour l'état des radios
                document.querySelectorAll('input[name="mapLayer"]').forEach(input => {
                    input.checked = (input.value === layerKey);
                });
                
                // Mettre à jour le tooltip
                this.updateTooltipText();
                
                // NE PAS fermer le dropdown, pour permettre l'interaction avec le sélecteur
                // Le dropdown se fermera uniquement via le bouton de fermeture ou un clic à l'extérieur
            }
        });

        // Gestion du hover pour les éléments de couche (délégation)
        this.dropdownContent.addEventListener('mouseenter', (e) => {
            const layerItem = e.target.closest('.map-layer-item');
            if (layerItem) {
                layerItem.style.backgroundColor = '#f0f0f0';
            }
        }, true);

        this.dropdownContent.addEventListener('mouseleave', (e) => {
            const layerItem = e.target.closest('.map-layer-item');
            if (layerItem) {
                layerItem.style.backgroundColor = '';
            }
        }, true);

        // Événement pour le bouton principal
        this.mainButton.addEventListener('click', (e) => {
            e.stopPropagation();

            this.dropdownState.isOpen = !this.dropdownState.isOpen;
            this.dropdownContent.style.display = this.dropdownState.isOpen ? 'block' : 'none';
        });
    }

    /**
     * Configure les événements du tooltip
     */
    setupTooltipEvents() {
        // Événements pour afficher/masquer le tooltip
        this.controlDiv.addEventListener('mouseenter', () => {
            this.updateTooltipText();
            this.tooltip.style.display = 'block';
        });

        this.controlDiv.addEventListener('mouseleave', () => {
            this.tooltip.style.display = 'none';
        });
    }

    /**
     * Configure les événements globaux
     */
    setupGlobalEvents() {
        // Fermeture du dropdown au clic en dehors
        this.map.addListener('click', () => {
            if (this.dropdownState.isOpen) {
                this.dropdownContent.style.display = 'none';
                this.dropdownState.isOpen = false;
            }
        });

        document.addEventListener('click', (e) => {
            if (this.dropdownState.isOpen && !this.controlDiv.contains(e.target)) {
                this.dropdownContent.style.display = 'none';
                this.dropdownState.isOpen = false;
            }
        });
    }

    /**
     * Configure l'écouteur pour les changements de couches
     */
    setupLayerChangedListener() {
        // Écouter les changements d'état des couches
        storeEvents.subscribe(EVENTS.VISUALIZATIONS.MAP.LAYERS.CHANGED, ({ layer, state }) => {
            const radio = document.getElementById(`layer-${layer}`);
            if (radio) {
                radio.checked = state;
            }

            // Mettre à jour le tooltip si la couche est active
            if (state) {
                this.updateTooltipText();
            }

            // Mettre à jour l'affichage du sélecteur de patronymes
            const surnameSelector = document.getElementById('layerDropdownSurnameSelector');
            if (surnameSelector) {
                if (layer === 'surnames' && state) {
                    surnameSelector.style.display = 'block';
                    this.updateSurnameSelector(surnameSelector);
                } else if (layer === 'surnames' && !state) {
                    surnameSelector.style.display = 'none';
                }
            }
        });

        // S'abonner aux changements de patronymes
        storeEvents.subscribe(EVENTS.VISUALIZATIONS.MAP.SURNAME_CHANGED, (data) => {
            const surnameSelector = document.getElementById('layerDropdownSurnameSelector');
            if (surnameSelector && data && data.surname) {
                surnameSelector.value = data.surname;
            }
        });
    }

    /**
     * Met à jour les informations de la personne racine
     * @param {Object} info - Informations de la personne
     */
    setRootPersonInfo(info) {
        this.rootPersonInfo = info;
        this.updateTooltipText();
    }

    /**
     * Génère le texte du tooltip
     * @returns {string} - Le texte du tooltip
     */
    getTooltipText() {
        const activeLayer = layerManager.activeLayer;
        let tooltipText = '';

        if (activeLayer) {
            // Trouver le nom de la couche dans la configuration
            const layerConfig = LayerDropdownControl.LAYER_CONFIG.find(item => item.key === activeLayer);
            const layerName = layerConfig ? layerConfig.label : activeLayer;

            tooltipText = `Couche active: ${layerName}`;

            // Si c'est la couche ancêtres, ajouter le nom de la personne racine
            if (activeLayer === 'ancestors' && this.rootPersonInfo && this.rootPersonInfo.name) {
                tooltipText += ` (${this.rootPersonInfo.name})`;
            }
        } else {
            tooltipText = 'Aucune couche active';
        }

        return tooltipText;
    }

    /**
     * Met à jour le texte du tooltip
     */
    updateTooltipText() {
        if (!this.tooltip || !this.mainButton) return;

        const tooltipText = this.getTooltipText();
        this.tooltip.textContent = tooltipText;
        this.mainButton.title = tooltipText;

        // Si une fonction de callback est définie, l'appeler
        if (typeof this.updateTooltipCallback === 'function') {
            this.updateTooltipCallback(tooltipText);
        }
    }

    /**
     * Supprime le contrôle de la carte
     */
    remove() {
        if (this.surnameUpdateInterval) {
            clearInterval(this.surnameUpdateInterval);
            this.surnameUpdateInterval = null;
        }

        if (this.controlDiv) {
            const index = this.map.controls[google.maps.ControlPosition.TOP_LEFT]
                .getArray()
                .indexOf(this.controlDiv);

            if (index > -1) {
                this.map.controls[google.maps.ControlPosition.TOP_LEFT].removeAt(index);
                this.controlDiv = null;
            }
        }
    }
}