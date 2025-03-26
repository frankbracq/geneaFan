# Mémo sur le système d'authentification de GeneaFan

## État actuel

GeneaFan fonctionnait précédemment avec Clerk pour l'authentification des utilisateurs. Cette intégration a été désactivée en préparation pour une migration vers Cloudflare Access comme solution d'authentification centralisée.

## Modifications effectuées

### Suppression des dépendances
- Retrait de `@clerk/clerk-js` du `package.json`
- Nettoyage de `webpack.config.js` pour supprimer les références à Clerk
- Suppression des variables d'environnement liées à Clerk

### Désactivation du core d'authentification
- Suppression complète de `/assets/scripts/geneafan/core/auth.js`
- Retrait de l'appel à `initializeAuth()` dans `/assets/scripts/geneafan/core/setup.js`

### Adaptation du store d'authentification
- Modification de `/assets/scripts/geneafan/common/stores/authStore.js` pour:
  - Retirer les dépendances Clerk
  - Simplifier toutes les méthodes d'authentification
  - Simuler un état non authentifié par défaut

### Protection des fonctionnalités
- Adaptation de `/assets/scripts/geneafan/listeners/protectedFeatures.js` pour:
  - Contourner les vérifications d'authentification
  - Utiliser un utilisateur factice pour les tests

### Gestion des fichiers GEDCOM
- Modification de `/assets/scripts/geneafan/gedcom/gedcomFileHandler.js` pour:
  - Simuler l'upload et la récupération de fichiers
  - Utiliser des données factices pour les tests
  - Maintenir l'expérience utilisateur sans authentification réelle

## Préparation pour Cloudflare Access

Le système est maintenant prêt pour l'implémentation de Cloudflare Access. Les prochaines étapes incluent:

1. **Configuration de Cloudflare Access**:
   - Création de politiques d'accès pour les domaines
   - Choix d'un fournisseur d'identité
   - Définition des règles d'accès appropriées

2. **Adaptation future**:
   - Les fonctions factices actuelles pourront être remplacées par des intégrations avec Cloudflare Access
   - Les vérifications d'authentification pourront être rétablies en utilisant les informations d'utilisateur de Cloudflare Access
   - L'interface utilisateur pourra être adaptée pour refléter la nouvelle méthode d'authentification

## Architecture cible

Dans la nouvelle architecture:
- Cloudflare Access gérera l'authentification au niveau de l'infrastructure
- Le site A servira de point d'entrée et d'authentification centralisée
- Le site B (GeneaFan) recevra les informations d'authentification via le reverse proxy (Worker Cloudflare)
- Les données utilisateur seront toujours associées à un identifiant unique, mais géré par Cloudflare Access plutôt que par Clerk