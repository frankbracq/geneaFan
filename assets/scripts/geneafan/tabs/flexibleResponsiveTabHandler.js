/**
 * flexibleResponsiveTabHandler.js
 * Gestion du comportement responsive des onglets basé sur l'espace disponible réel
 * Au lieu d'utiliser des breakpoints fixes de Bootstrap
 */

/**
 * Initialise le gestionnaire responsive dynamique des onglets
 * Bascule entre l'affichage des onglets et du dropdown en fonction de l'espace disponible
 */
export function setupFlexibleResponsiveTabHandler() {
    const leftContainer = document.getElementById('left-container');
    const tabNav = document.getElementById('tab-nav');
    const tabDropdown = document.querySelector('.tab-dropdown');
    
    if (!leftContainer || !tabNav || !tabDropdown) {
      console.warn('Elements required for flexible responsive tabs are missing');
      return;
    }
    
    // Assurons-nous que la fonction populateDropdownMenu est appelée pour remplir le dropdown
    // Cette fonction existe déjà dans votre code responsiveTabHandler.js
    const originalHandler = window.responsiveTabHandler || { refreshDropdown: () => {} };
    
    // Calcul de la largeur nécessaire pour tous les onglets
    function calculateRequiredWidth() {
      let totalWidth = 0;
      
      // Temporairement rendre visible pour mesurer
      const wasHidden = tabNav.classList.contains('d-none');
      if (wasHidden) {
        tabNav.classList.remove('d-none');
        tabNav.style.visibility = 'hidden';
        tabNav.style.position = 'absolute';
        tabNav.style.display = 'flex'; // Assurons-nous qu'il est en flex pour la mesure
      }
      
      // Mesurer chaque élément
      tabNav.querySelectorAll('.nav-item').forEach(item => {
        totalWidth += item.offsetWidth;
      });
      
      // Restaurer l'état précédent
      if (wasHidden) {
        tabNav.classList.add('d-none');
        tabNav.style.visibility = '';
        tabNav.style.position = '';
        tabNav.style.display = '';
      }
      
      // Ajouter une marge de sécurité
      return totalWidth + 20; // 20px de marge pour éviter des basculements trop fréquents
    }
    
    // Fonction pour basculer entre les modes d'affichage
    function adjustTabDisplay() {
      const availableWidth = leftContainer.offsetWidth;
      const requiredWidth = calculateRequiredWidth();
      
      if (requiredWidth > availableWidth) {
        // Pas assez d'espace: passer en mode dropdown
        tabNav.classList.add('d-none');
        tabDropdown.classList.remove('d-none');
      } else {
        // Assez d'espace: afficher les onglets
        tabNav.classList.remove('d-none');
        tabDropdown.classList.add('d-none');
      }
      
      // Rafraîchir le contenu du dropdown au cas où
      if (originalHandler.refreshDropdown) {
        originalHandler.refreshDropdown();
      }
    }
    
    // Observer les changements de taille
    const resizeObserver = new ResizeObserver(() => {
      adjustTabDisplay();
    });
    
    resizeObserver.observe(leftContainer);
    
    // Ajustement initial
    setTimeout(adjustTabDisplay, 100); // Petit délai pour s'assurer que le DOM est bien calculé
    
    // Réajuster lorsque le contenu ou la visibilité change
    const observer = new MutationObserver(() => {
      adjustTabDisplay();
    });
    
    observer.observe(tabNav, { 
      childList: true, 
      subtree: true,
      attributes: true, 
      attributeFilter: ['class', 'style']
    });
    
    // Retourner une méthode pour forcer le recalcul
    return {
      recalculate: adjustTabDisplay
    };
  }
  
  /**
   * Application des modifications HTML nécessaires
   */
  export function prepareFlexibleTabs() {
    // 1. Modifier les classes du dropdown
    const tabDropdown = document.querySelector('.dropdown.d-block.d-md-none.tab-dropdown');
    if (tabDropdown) {
      tabDropdown.classList.remove('d-block', 'd-md-none');
      tabDropdown.classList.add('d-none'); // Caché par défaut, sera affiché par le JavaScript
    }
    
    // 2. Modifier les classes des onglets
    const tabNav = document.getElementById('tab-nav');
    if (tabNav) {
      tabNav.classList.remove('d-none', 'd-md-flex');
      tabNav.classList.add('d-flex'); // Visible par défaut, sera caché par le JavaScript si nécessaire
    }
  }
  
  /**
   * Fonction principale à appeler pour configurer les onglets responsives dynamiques
   */
  export function initializeFlexibleTabs() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        prepareFlexibleTabs();
        window.flexibleTabHandler = setupFlexibleResponsiveTabHandler();
      });
    } else {
      prepareFlexibleTabs();
      window.flexibleTabHandler = setupFlexibleResponsiveTabHandler();
    }
  }
  
  // Export pour utilisation dans d'autres modules
  export default { initializeFlexibleTabs };