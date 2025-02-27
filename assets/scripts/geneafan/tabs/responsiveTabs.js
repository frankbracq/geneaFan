/**
 * ResponsiveTabs.js
 * Module pour gérer la transformation des onglets en dropdown sur petits écrans
 */

class ResponsiveTabs {
    /**
     * Initialise la gestion responsive des onglets
     * @param {Object} options - Options de configuration
     */
    constructor(options = {}) {
      // Options par défaut
      this.options = {
        tabNavSelector: '#tab-nav',
        containerSelector: '#left-container',
        breakpoint: 768,
        ...options
      };
      
      // Éléments du DOM
      this.tabNav = document.querySelector(this.options.tabNavSelector);
      this.container = document.querySelector(this.options.containerSelector);
      
      // État
      this.dropdownContainer = null;
      this.isInDropdownMode = false;
      
      // Vérification des éléments requis
      if (!this.tabNav || !this.container) {
        console.warn('ResponsiveTabs: Éléments de navigation introuvables', 
          this.options.tabNavSelector, 
          this.options.containerSelector);
        return;
      }
      
      // Initialisation
      this.init();
    }
    
    /**
     * Initialise les événements et exécute la première transformation
     */
    init() {
      // Observer les changements de taille d'écran avec un debounce pour éviter les appels excessifs
      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          this.transformNavigation();
        }, 100);
      });
      
      // Observer les changements d'onglet
      this.observeTabChanges();
      
      // Exécuter une fois au chargement
      this.transformNavigation();
    }
    
    /**
     * Transforme la navigation selon la taille d'écran
     */
    transformNavigation() {
      const isMobile = window.innerWidth < this.options.breakpoint;
      
      if (isMobile && !this.isInDropdownMode) {
        // Passer au mode dropdown
        this.tabNav.style.display = 'none';
        if (!this.dropdownContainer) {
          this.dropdownContainer = this.createDropdown();
        } else {
          this.dropdownContainer.style.display = 'block';
        }
        this.isInDropdownMode = true;
      } else if (!isMobile && this.isInDropdownMode) {
        // Revenir aux onglets
        this.tabNav.style.display = 'flex';
        if (this.dropdownContainer) {
          this.dropdownContainer.style.display = 'none';
        }
        this.isInDropdownMode = false;
      }
    }
    
    /**
     * Crée le dropdown de navigation
     * @return {HTMLElement} L'élément DOM du dropdown
     */
    createDropdown() {
      // Créer la structure du dropdown
      const dropdownContainer = document.createElement('div');
      dropdownContainer.className = 'dropdown tab-dropdown';
      
      // Créer le bouton toggle
      const button = document.createElement('button');
      button.className = 'btn dropdown-toggle';
      button.setAttribute('type', 'button');
      button.setAttribute('data-bs-toggle', 'dropdown');
      button.setAttribute('aria-expanded', 'false');
      button.id = 'tabsDropdownMenu';
      
      // Créer le texte du bouton
      const buttonText = document.createElement('span');
      buttonText.id = 'current-tab-text';
      
      // Trouver l'onglet actif pour le texte initial du dropdown
      const activeTab = this.tabNav.querySelector('.nav-link.active .tab-label');
      buttonText.textContent = activeTab ? activeTab.textContent : 'Navigation';
      
      button.appendChild(buttonText);
      
      // Créer le menu dropdown
      const dropdownMenu = document.createElement('ul');
      dropdownMenu.className = 'dropdown-menu';
      dropdownMenu.setAttribute('aria-labelledby', 'tabsDropdownMenu');
      dropdownMenu.id = 'tabs-dropdown-menu';
      
      // Ajouter des éléments au dropdown à partir des onglets existants
      this.populateDropdownMenu(dropdownMenu, buttonText);
      
      // Assembler le dropdown
      dropdownContainer.appendChild(button);
      dropdownContainer.appendChild(dropdownMenu);
      
      // Insérer le dropdown dans le DOM
      this.container.insertBefore(dropdownContainer, this.tabNav);
      
      // SOLUTION MANUELLE: Ajouter un écouteur d'événement pour gérer l'ouverture/fermeture du dropdown
      button.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        
        const dropdownMenu = document.getElementById("tabs-dropdown-menu");
        const isVisible = dropdownMenu.classList.contains("show");
  
        if (isVisible) {
          dropdownMenu.classList.remove("show");
          dropdownMenu.style.display = "none";
          this.setAttribute("aria-expanded", "false");
        } else {
          dropdownMenu.classList.add("show");
          dropdownMenu.style.display = "block";
          this.setAttribute("aria-expanded", "true");
        }
      });
      
      // Fermer au clic en dehors
      document.addEventListener('click', (e) => {
        const dropdownMenu = document.getElementById("tabs-dropdown-menu");
        if (dropdownMenu && !button.contains(e.target) && !dropdownMenu.contains(e.target)) {
          dropdownMenu.classList.remove('show');
          dropdownMenu.style.display = "none";
          button.setAttribute('aria-expanded', 'false');
        }
      });
      
      // Essayer également d'initialiser avec Bootstrap (belt and suspenders)
      try {
        if (typeof bootstrap !== 'undefined') {
          new bootstrap.Dropdown(button);
        }
      } catch (error) {
        console.warn('ResponsiveTabs: Erreur lors de l\'initialisation du dropdown avec Bootstrap:', error);
      }
      
      return dropdownContainer;
    }
    
    /**
     * Remplit le menu dropdown avec les éléments des onglets
     * @param {HTMLElement} dropdownMenu - L'élément menu à remplir
     * @param {HTMLElement} buttonText - L'élément de texte du bouton dropdown
     */
    populateDropdownMenu(dropdownMenu, buttonText) {
      // Vider le menu existant
      dropdownMenu.innerHTML = '';
      
      // Obtenir tous les éléments d'onglet
      const tabItems = this.tabNav.querySelectorAll('.nav-item');
      
      if (tabItems.length === 0) {
        // Si pas d'items, essayer de récupérer directement les liens
        const tabLinks = this.tabNav.querySelectorAll('.nav-link');
        if (tabLinks.length > 0) {
          this.createDropdownItemsFromLinks(tabLinks, dropdownMenu, buttonText);
        } else {
          console.warn('ResponsiveTabs: Aucun onglet trouvé dans la navigation');
        }
        return;
      }
      
      // Créer un élément de dropdown pour chaque onglet
      tabItems.forEach(item => {
        const link = item.querySelector('.nav-link');
        if (!link) return;
        
        let label;
        const labelElement = link.querySelector('.tab-label');
        if (labelElement) {
          label = labelElement.textContent;
        } else {
          // Si pas d'élément .tab-label, utiliser le texte du lien
          label = link.textContent.trim();
        }
        
        const isActive = link.classList.contains('active');
        const isDisabled = link.classList.contains('disabled');
        const href = link.getAttribute('href') || '#';
        
        // Créer l'élément de dropdown
        const listItem = document.createElement('li');
        const anchor = document.createElement('a');
        anchor.className = `dropdown-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;
        anchor.textContent = label;
        anchor.href = href;
        
        // Gérer le clic sur un élément du dropdown
        if (!isDisabled) {
          anchor.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Activer l'onglet correspondant
            try {
              if (typeof bootstrap !== 'undefined') {
                const bsTab = new bootstrap.Tab(link);
                bsTab.show();
              } else {
                // Fallback: cliquer directement sur le lien
                link.click();
              }
              
              // Mettre à jour le texte du dropdown
              buttonText.textContent = label;
              
              // Mettre à jour la classe active dans le dropdown
              dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
                item.classList.remove('active');
              });
              anchor.classList.add('active');
              
              // Fermer le dropdown manuellement (toujours le faire, peu importe si Bootstrap est disponible)
              const dropdownToggle = document.getElementById('tabsDropdownMenu');
              if (dropdownToggle) {
                dropdownToggle.setAttribute('aria-expanded', 'false');
                dropdownMenu.classList.remove('show');
                dropdownMenu.style.display = 'none';
              }
            } catch (error) {
              console.warn('ResponsiveTabs: Erreur lors de l\'activation de l\'onglet:', error);
              // Fallback: naviguer vers l'URL directement
              window.location.href = href;
            }
          });
        }
        
        listItem.appendChild(anchor);
        dropdownMenu.appendChild(listItem);
      });
    }
    
    /**
     * Crée des éléments de dropdown à partir des liens directement
     * @param {NodeList} tabLinks - Liste des liens d'onglet
     * @param {HTMLElement} dropdownMenu - L'élément menu à remplir
     * @param {HTMLElement} buttonText - L'élément de texte du bouton dropdown
     */
    createDropdownItemsFromLinks(tabLinks, dropdownMenu, buttonText) {
      tabLinks.forEach(link => {
        let label;
        const labelElement = link.querySelector('.tab-label');
        if (labelElement) {
          label = labelElement.textContent;
        } else {
          // Si pas d'élément .tab-label, utiliser le texte du lien
          label = link.textContent.trim();
        }
        
        const isActive = link.classList.contains('active');
        const isDisabled = link.classList.contains('disabled');
        const href = link.getAttribute('href') || '#';
        
        // Créer l'élément de dropdown
        const listItem = document.createElement('li');
        const anchor = document.createElement('a');
        anchor.className = `dropdown-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;
        anchor.textContent = label;
        anchor.href = href;
        
        // Gérer le clic (même logique que ci-dessus)
        if (!isDisabled) {
          anchor.addEventListener('click', (e) => {
            e.preventDefault();
            
            try {
              if (typeof bootstrap !== 'undefined') {
                const bsTab = new bootstrap.Tab(link);
                bsTab.show();
              } else {
                link.click();
              }
              
              buttonText.textContent = label;
              
              dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
                item.classList.remove('active');
              });
              anchor.classList.add('active');
              
              // Fermer le dropdown manuellement
              const dropdownToggle = document.getElementById('tabsDropdownMenu');
              if (dropdownToggle) {
                dropdownToggle.setAttribute('aria-expanded', 'false');
                dropdownMenu.classList.remove('show');
                dropdownMenu.style.display = 'none';
              }
            } catch (error) {
              console.warn('ResponsiveTabs: Erreur lors de l\'activation de l\'onglet:', error);
              window.location.href = href;
            }
          });
        }
        
        listItem.appendChild(anchor);
        dropdownMenu.appendChild(listItem);
      });
    }
    
    /**
     * Observe les changements d'onglets actifs pour mettre à jour le dropdown
     */
    observeTabChanges() {
      document.querySelectorAll('.nav-link').forEach(tab => {
        tab.addEventListener('shown.bs.tab', () => {
          if (this.isInDropdownMode && this.dropdownContainer) {
            const labelElement = tab.querySelector('.tab-label');
            if (!labelElement) return;
            
            const label = labelElement.textContent;
            const buttonText = document.getElementById('current-tab-text');
            if (buttonText) {
              buttonText.textContent = label;
            }
            
            const dropdownMenu = document.getElementById('tabs-dropdown-menu');
            if (dropdownMenu) {
              dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
                item.classList.remove('active');
              });
              
              const href = tab.getAttribute('href');
              const activeItem = dropdownMenu.querySelector(`a[href="${href}"]`);
              if (activeItem) {
                activeItem.classList.add('active');
              }
            }
          }
        });
      });
    }
  }
  
  // Exporter la classe
  export default ResponsiveTabs;