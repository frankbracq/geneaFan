# Mécanisme d'authentification entre FamilyStory.live et GeneaFan

## Vue d'ensemble

L'architecture mise en place permet une authentification fluide entre deux sites distincts :
- **FamilyStory.live** : Site vitrine principal avec authentification Clerk
- **GeneaFan** (genealogie.app) : Application de généalogie accessible via un proxy depuis FamilyStory.live/app

L'authentification est centralisée sur FamilyStory.live avec transmission transparente des informations d'identité vers GeneaFan, tout en permettant un mode anonyme.

## Flux d'authentification

### 1. Authentification sur FamilyStory.live

- L'utilisateur peut s'authentifier via Clerk sur FamilyStory.live
- Les informations d'authentification (ID utilisateur, email) sont stockées par Clerk
- L'interface utilisateur affiche un bouton de connexion ou le profil utilisateur selon l'état d'authentification

### 2. Navigation vers l'application

- L'utilisateur clique sur "Accéder à l'app" pour naviguer vers GeneaFan via FamilyStory.live/app
- Que l'utilisateur soit authentifié ou non, la navigation est autorisée (mode anonyme possible)
- Si l'utilisateur est authentifié, les informations d'identité sont préparées pour la transmission

### 3. Transmission via le Worker

- Un Worker Cloudflare sert de reverse proxy entre les deux sites
- Le Worker :
  - Capture la requête vers FamilyStory.live/app
  - Vérifie la présence d'informations d'authentification (en-têtes, localStorage)
  - Si présentes, les ajoute comme en-têtes personnalisés à la requête transmise : `X-User-Id`, `X-User-Email`, `X-Auth-Token`
  - Redirige la requête vers GeneaFan (proxy.genealogie.app)

### 4. Réception dans GeneaFan

- GeneaFan reçoit la requête avec les en-têtes d'authentification
- L'application vérifie la présence de ces en-têtes
- Si présents, elle initialise une session authentifiée
- Si absents, elle fonctionne en mode anonyme

### 5. Accès aux fonctionnalités protégées

- L'utilisateur navigue dans GeneaFan normalement
- Lorsqu'il tente d'accéder à une fonctionnalité protégée :
  - Si déjà authentifié (informations transmises par FamilyStory.live), l'accès est immédiatement accordé
  - Si en mode anonyme, l'invitation à s'authentifier s'affiche
  - L'authentification peut alors se faire via redirection vers FamilyStory.live puis retour à GeneaFan

## Diagramme de séquence

```
┌─────────────┐      ┌──────────────┐      ┌───────────────┐      ┌───────────┐
│ Utilisateur │      │FamilyStory.live│      │ Worker Proxy  │      │  GeneaFan  │
└──────┬──────┘      └───────┬──────┘      └───────┬───────┘      └─────┬─────┘
       │                     │                     │                     │
       │   Visite site       │                     │                     │
       │─────────────────────>                     │                     │
       │                     │                     │                     │
       │ (Option) Connexion  │                     │                     │
       │─────────────────────>                     │                     │
       │                     │                     │                     │
       │                     │ Stocke infos auth   │                     │
       │                     │───────────────┐     │                     │
       │                     │               │     │                     │
       │                     │<──────────────┘     │                     │
       │                     │                     │                     │
       │ Clique "Accéder app"│                     │                     │
       │─────────────────────>                     │                     │
       │                     │                     │                     │
       │                     │ Requête /app        │                     │
       │                     │────────────────────>│                     │
       │                     │                     │                     │
       │                     │                     │ Ajoute en-têtes X-* │
       │                     │                     │────────────┐        │
       │                     │                     │            │        │
       │                     │                     │<───────────┘        │
       │                     │                     │                     │
       │                     │                     │ Requête transmise   │
       │                     │                     │────────────────────>│
       │                     │                     │                     │
       │                     │                     │                     │ Vérifie en-têtes
       │                     │                     │                     │──────────┐
       │                     │                     │                     │          │
       │                     │                     │                     │<─────────┘
       │                     │                     │                     │
       │                     │                     │ Réponse HTML        │
       │                     │                     │<────────────────────│
       │                     │                     │                     │
       │                     │ Réponse transmise   │                     │
       │                     │<────────────────────│                     │
       │                     │                     │                     │
       │ Affichage GeneaFan  │                     │                     │
       │<─────────────────────                     │                     │
       │                     │                     │                     │
       │ Utilise fonction    │                     │                     │
       │ protégée            │                     │                     │
       │───────────────────────────────────────────────────────────────>│
       │                     │                     │                     │
       │                     │                     │                     │ Vérifie auth
       │                     │                     │                     │──────────┐
       │                     │                     │                     │          │
       │                     │                     │                     │<─────────┘
       │                     │                     │                     │
       │ Accès autorisé ou   │                     │                     │
       │ demande d'auth      │                     │                     │
       │<───────────────────────────────────────────────────────────────│
       │                     │                     │                     │
```

## Avantages de cette approche

1. **Expérience utilisateur fluide** : Pas d'obligation de s'authentifier pour explorer l'application
2. **Authentification centralisée** : Un seul système d'authentification à gérer (Clerk sur FamilyStory.live)
3. **Mode progressif** : Possibilité de commencer en anonyme et s'authentifier à la demande
4. **Sécurité préservée** : Les fonctionnalités sensibles restent protégées
5. **Facilité de maintenance** : Une seule source de vérité pour l'identité des utilisateurs