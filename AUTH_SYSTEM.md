# Mémo sur le système d'authentification avec Clerk dans GeneaFan

## Vue d'ensemble

GeneaFan utilise Clerk pour l'authentification des utilisateurs. Clerk est un service tiers qui fournit une solution complète d'identification et de gestion des utilisateurs, permettant l'authentification par différentes méthodes (email/mot de passe, OAuth avec Google, Facebook, etc.).

## Fichiers clés et leur rôle

### Configuration et dépendances
- **package.json** : Contient la dépendance `@clerk/clerk-js` (v5.26.3)
- **webpack.config.js** : Configuration Webpack avec exclusion de Clerk du traitement Babel et chargement des variables d'environnement (dont la clé publique Clerk)

### Core du système d'authentification
- **/assets/scripts/geneafan/core/auth.js** : 
  - Initialise l'authentification via `initializeAuth()`
  - Configure l'interface utilisateur avec `setupAuthUI()`
  - Met en place les observateurs réactifs avec `setupUserControlsObserver()`

### Gestion de l'état d'authentification
- **/assets/scripts/geneafan/common/stores/authStore.js** :
  - Classe `AuthStore` qui gère l'état d'authentification avec MobX
  - Méthodes principales :
    - `initializeClerk()` : Initialise l'instance Clerk
    - `extractUserInfo()` : Extrait les informations utilisateur
    - `setupAuthenticationListener()` : Configure l'écoute des changements d'authentification
    - `accessFeature()` : Contrôle l'accès aux fonctionnalités protégées
    - `showSignInForm()` : Affiche le formulaire de connexion
    - `logout()` : Déconnecte l'utilisateur

### Protection des fonctionnalités
- **/assets/scripts/geneafan/listeners/protectedFeatures.js** :
  - Configure les écouteurs d'événements pour les fonctionnalités protégées
  - Gère l'accès aux fonctionnalités nécessitant une authentification comme :
    - Récupération des fichiers GEDCOM de l'utilisateur
    - Téléchargement de PDF

### Intégration avec les fonctionnalités
- **/assets/scripts/geneafan/gedcom/gedcomFileHandler.js** :
  - Gère le chargement et le traitement des fichiers GEDCOM
  - Intègre l'authentification pour les opérations comme :
    - Sauvegarde des fichiers dans Cloudflare R2
    - Récupération des fichiers GEDCOM de l'utilisateur via `fetchUserGedcomFiles()`

### Initialisation dans l'application
- **/assets/scripts/geneafan/core/setup.js** :
  - Appelle `initializeAuth()` lors du démarrage de l'application dans `setupCore()`

## Flux d'authentification

1. **Initialisation** :
   - L'application charge Clerk au démarrage
   - Récupère la clé publique depuis les variables d'environnement
   - Initialise le composant Clerk

2. **UI et interaction** :
   - Affiche un bouton de connexion pour les utilisateurs non authentifiés
   - Affiche le composant UserButton de Clerk pour les utilisateurs connectés
   - Utilise des observateurs MobX pour réagir aux changements d'état

3. **Authentification** :
   - L'utilisateur clique sur le bouton de connexion
   - Le formulaire Clerk s'affiche (géré par Clerk)
   - Après connexion réussie, un écouteur d'événements est notifié
   - L'état de l'utilisateur est mis à jour dans le store MobX

4. **Accès aux fonctionnalités protégées** :
   - Les éléments HTML avec la classe `protected-feature` sont contrôlés
   - Lors du clic, la méthode `accessFeature()` vérifie l'authentification
   - Si l'utilisateur n'est pas connecté, le formulaire de connexion s'affiche
   - Si l'utilisateur est authentifié, la fonctionnalité est accessible

5. **Enregistrement et récupération des fichiers GEDCOM** :
   - Lors du chargement d'un fichier, l'utilisateur peut choisir de l'enregistrer
   - L'authentification est requise pour cette opération
   - Les fichiers sont stockés dans Cloudflare R2 avec un identifiant utilisateur
   - La récupération des fichiers GEDCOM nécessite également une authentification

## Sécurité et intégration

- Clerk gère les sessions côté client et serveur
- Les identifiants des utilisateurs sont utilisés pour associer les données (fichiers GEDCOM)
- L'interface utilisateur s'adapte dynamiquement à l'état d'authentification
- La réactivité est assurée par MobX qui observe les changements d'état

## Points d'attention

1. La clé publique Clerk est chargée depuis les variables d'environnement
2. Le système utilise un mécanisme d'observateurs pour réagir aux changements d'état d'authentification
3. Les fonctionnalités protégées sont clairement identifiées dans le HTML avec la classe `protected-feature`
4. Clerk est configuré pour gérer la navigation après connexion/déconnexion