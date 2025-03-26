# Plan de refactorisation pour l'adoption du Shadow DOM

Ce document décrit la stratégie de migration progressive vers une architecture utilisant le Shadow DOM pour créer une version intégrable de Genealogie.app, tout en maintenant la compatibilité avec l'application standalone.

## Objectifs

- Permettre l'isolation du contenu et des styles via Shadow DOM pour l'intégration
- Maintenir le fonctionnement standalone de l'application
- Minimiser les risques en adoptant une approche progressive
- Améliorer les performances d'intégration par rapport à l'approche iframe

## État actuel

L'application utilise actuellement une intégration par iframe avec:
- Un script d'intégration (`embed.js`) qui charge l'application dans un iframe
- Communication via postMessage entre iframe et page parente
- Configuration webpack spécifique pour le build d'intégration
- Support pour deux chemins de déploiement (genealogie.app et proxy.genealogie.app)

## Défis identifiés

1. **Manipulation DOM globale**
   - Nombreuses références à `document.querySelector/getElementById`
   - Création d'éléments avec `document.createElement` sans contexte relatif

2. **Architecture CSS**
   - Styles globaux sans encapsulation
   - Utilisation de Bootstrap pour les composants UI
   - Organisation SCSS avec portée globale

3. **Gestion d'état et événements**
   - Système d'événements personnalisé basé sur le DOM global
   - Abonnements aux événements sans contexte relatif

4. **Initialisation de l'application**
   - Processus d'initialisation monolithique via `setupCore()`
   - Dépendance aux éléments DOM avec IDs prédéfinis

## Plan de refactorisation par phases

### Phase 1: Abstraction des accès DOM (Court terme)

- [x] **Créer un service `DOMAccessManager`**
  - Interface d'abstraction pour les opérations DOM
  - Support pour racine contextuelle (document ou shadowRoot)
  - Singleton global pour utilisation immédiate

- **Fichiers prioritaires à refactoriser:**
  - [ ] `/assets/scripts/geneafan/utils/NotificationManager.js`
  - [ ] `/assets/scripts/geneafan/utils/OverlayManager.js`
  - [ ] `/assets/scripts/geneafan/utils/spinners.js`
  - [ ] `/assets/scripts/geneafan/core/setup.js`
  - [ ] `/assets/scripts/geneafan/tabs/tabManager.js`
  - [ ] `/assets/scripts/geneafan/listeners/eventListeners.js`

### Phase 2: Paramétrage des points d'initialisation (Court-moyen terme)

- [ ] **Modifier `setupCore.js`**
  - Accepter un élément racine en paramètre
  - Par défaut utiliser `document.body` pour compatibilité

- [ ] **Créer un wrapper d'initialisation conditionnel**
  - Détecter le mode d'exécution (standalone vs intégré)
  - Initialiser avec la racine appropriée

- **Fichiers prioritaires:**
  - [ ] `/assets/scripts/geneafan/core/setup.js`
  - [ ] `/assets/scripts/geneafan/core/app.js`

### Phase 3: Amélioration de l'organisation CSS (Moyen terme)

- [ ] **Restructurer les styles**
  - Utiliser des classes CSS avec espaces de noms
  - Éviter les modifications style inline
  - Regrouper par composant fonctionnel

- [ ] **Implémenter un système d'injection CSS**
  - Mécanisme pour charger les styles dans le Shadow DOM
  - Support des feuilles de style externes (Bootstrap)

- **Fichiers prioritaires:**
  - [ ] `/assets/scss/main.scss`
  - [ ] `/assets/scripts/geneafan/utils/NotificationManager.js`
  - [ ] Autres composants avec styles injectés

### Phase 4: Système de templates HTML (Moyen terme)

- [ ] **Implémenter des templates HTML modulaires**
  - Remplacer les manipulations directes d'innerHTML
  - Préparer pour l'encapsulation Shadow DOM

- [ ] **Créer une API de template rendering**
  - Support pour insertion dans DOM global ou Shadow DOM
  - Système de composants léger

- **Cibles prioritaires:**
  - [ ] Notifications et alertes
  - [ ] Modales et overlays
  - [ ] Panneaux d'information/détails

### Phase 5: Composant Web pour l'intégration (Long terme)

- [ ] **Créer un Custom Element `<genealogie-app>`**
  - Définir une classe étendant `HTMLElement`
  - Implémenter lifecycle (connectedCallback, etc.)
  - Attacher Shadow DOM avec `attachShadow({mode: 'open'})`

- [ ] **Adapter l'initialisation d'application**
  - Détecter environnement d'exécution
  - Utiliser les abstractions existantes avec racine Shadow DOM

- [ ] **Définir API publique**
  - Méthodes pour charger des données GEDCOM
  - Événements personnalisés pour notifier changements d'état
  - Interface pour contrôler l'affichage

### Phase 6: Construction et déploiement (Long terme)

- [ ] **Modifier la configuration webpack**
  - Support pour deux modes de build (standalone/intégrable)
  - Optimisations pour le chargement des ressources

- [ ] **Documentation d'intégration**
  - Instructions d'utilisation du composant
  - Exemples d'intégration
  - API de référence

## Stratégie de test

- Développer tests unitaires pour les abstractions
- Créer tests d'intégration pour valider fonctionnement en Shadow DOM
- Comparer performances avec l'approche iframe

## Exemples d'utilisation future

### Utilisation en mode standalone
```javascript
// Initialisation standard, inchangée
document.addEventListener('DOMContentLoaded', () => {
  initializeApplication();
});
```

### Utilisation en mode intégrable
```javascript
// Définition du composant
class GenealogieApp extends HTMLElement {
  connectedCallback() {
    // Créer Shadow DOM
    const shadow = this.attachShadow({mode: 'open'});
    
    // Créer DOMManager contextualisé
    const domManager = createDOMManager(shadow);
    
    // Initialiser l'application avec DOM contextualisé
    initializeApplication({
      domManager,
      rootElement: shadow
    });
  }
}

// Enregistrer l'élément personnalisé
customElements.define('genealogie-app', GenealogieApp);
```

### Exemple d'intégration pour sites tiers
```html
<!-- Inclure le script -->
<script src="https://genealogie.app/embed-component.js"></script>

<!-- Utiliser le composant -->
<genealogie-app gedcom-url="https://example.com/my-family.ged"></genealogie-app>
```

## Conclusion

Cette approche de refactorisation progressive permettra d'atteindre l'objectif d'intégration via Shadow DOM tout en maintenant la compatibilité avec l'application standalone existante. Les modifications proposées amélioreront également la modularité et la maintenabilité du code, indépendamment de l'adoption du Shadow DOM.