/**
 * responsiveTabHandler.js
 * Gestion du comportement responsive des onglets avec basculement vers dropdown sur mobile
 */

/**
 * Initialise le gestionnaire responsive des onglets
 * @returns {Object} API permettant de rafraîchir le dropdown
 */
function initializeResponsiveTabHandler() {
  const tabNav = document.getElementById('tab-nav');
  const dropdownMenu = document.getElementById('tabs-dropdown-menu');
  const currentTabText = document.getElementById('current-tab-text');
  
  if (!tabNav || !dropdownMenu) {
    console.warn('ResponsiveTabHandler: Éléments requis manquants');
    return { refreshDropdown: () => {} };
  }
  
  // Initialisation: créer les items du dropdown à partir des onglets
  function populateDropdownMenu() {
    // Vider le menu
    dropdownMenu.innerHTML = '';
    
    // Obtenir tous les onglets
    const tabs = tabNav.querySelectorAll('.nav-item .nav-link');
    
    // Créer les items du dropdown
    tabs.forEach(tab => {
      const tabLabel = tab.querySelector('.tab-label');
      const tabName = tabLabel ? tabLabel.textContent.trim() : 'Onglet';
      const tabHref = tab.getAttribute('href');
      const isActive = tab.classList.contains('active');
      const isDisabled = tab.classList.contains('disabled');
      
      // Créer l'élément de liste
      const listItem = document.createElement('li');
      
      // Créer le lien dropdown
      const dropdownItem = document.createElement('a');
      dropdownItem.className = `dropdown-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;
      dropdownItem.href = '#';
      dropdownItem.textContent = tabName;
      dropdownItem.dataset.target = tabHref;
      
      // Si l'onglet a un bouton de paramètres, ajouter un bouton similaire dans le dropdown
      const paramButton = tab.querySelector('button[id$="ParametersDisplay"]');
      if (paramButton) {
        const buttonClone = document.createElement('button');
        buttonClone.className = 'btn btn-sm';
        buttonClone.innerHTML = paramButton.innerHTML;
        buttonClone.disabled = isDisabled;
        
        // Si le bouton a un ID spécifique, conserver cette information
        if (paramButton.id) {
          buttonClone.dataset.originalId = paramButton.id;
        }
        
        // Ajouter le bouton au dropdown item
        dropdownItem.appendChild(buttonClone);
      }
      
      // Gestion du clic sur un item du dropdown
      if (!isDisabled) {
        dropdownItem.addEventListener('click', function(e) {
          e.preventDefault();
          
          // Trouver l'onglet correspondant et le cliquer
          const targetTab = document.querySelector(`a.nav-link[href="${this.dataset.target}"]`);
          if (targetTab) {
            const bsTab = new bootstrap.Tab(targetTab);
            bsTab.show();
            
            // Mettre à jour le texte du dropdown
            if (currentTabText) {
              currentTabText.textContent = tabName;
            }
            
            // Mettre à jour la classe active
            dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
              item.classList.remove('active');
            });
            this.classList.add('active');
          }
        });
      }
      
      listItem.appendChild(dropdownItem);
      dropdownMenu.appendChild(listItem);
    });
    
    // Mettre à jour le texte du bouton dropdown avec l'onglet actif
    const activeTab = tabNav.querySelector('.nav-link.active');
    if (activeTab && currentTabText) {
      const activeTabLabel = activeTab.querySelector('.tab-label');
      currentTabText.textContent = activeTabLabel ? activeTabLabel.textContent.trim() : 'Onglet';
    }
  }
  
  // Écouter les changements d'onglets pour mettre à jour le dropdown
  tabNav.querySelectorAll('.nav-link').forEach(tabLink => {
    tabLink.addEventListener('shown.bs.tab', function(e) {
      const tabLabel = this.querySelector('.tab-label');
      if (tabLabel && currentTabText) {
        currentTabText.textContent = tabLabel.textContent.trim();
      }
      
      // Mettre à jour la classe active dans le dropdown
      dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.target === this.getAttribute('href')) {
          item.classList.add('active');
        }
      });
    });
  });
  
  // Gestion du clic sur les boutons de paramètres dans le dropdown
  document.addEventListener('click', function(e) {
    const buttonElem = e.target.closest('.dropdown-item button');
    if (buttonElem) {
      const originalId = buttonElem.dataset.originalId;
      
      if (originalId) {
        // Simuler un clic sur le bouton d'origine
        const originalButton = document.getElementById(originalId);
        if (originalButton) {
          originalButton.click();
        }
      }
      
      // Empêcher la propagation pour éviter que le dropdown se ferme
      e.stopPropagation();
    }
  });
  
  // Initialisation du dropdown
  populateDropdownMenu();
  
  // Mettre à jour le dropdown si des onglets sont ajoutés ou modifiés
  const observer = new MutationObserver(() => {
    populateDropdownMenu();
  });
  
  observer.observe(tabNav, { 
    childList: true, 
    subtree: true,
    attributes: true, 
    attributeFilter: ['class']
  });
  
  // Retourner l'API publique
  return {
    refreshDropdown: populateDropdownMenu
  };
}

/**
 * Configure le gestionnaire d'onglets responsive après le chargement du DOM
 */
export function setupResponsiveTabHandler() {
  // Si le document est déjà chargé, initialiser immédiatement
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeResponsiveTabHandler);
  } else {
    initializeResponsiveTabHandler();
  }
}

// Export pour utilisation dans d'autres modules
export { initializeResponsiveTabHandler };