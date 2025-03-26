# MÉMO D'IMPLÉMENTATION
# Solution d'intégration de genealogie.app avec authentification simplifiée

## CONTEXTE

Genealogie.app est conçue pour fonctionner principalement comme un composant intégré dans des sites tiers. Cette solution permet une authentification simplifiée via postMessage, où le site hôte transmet l'email de l'utilisateur sans nécessiter de développement backend complexe.

## INFRASTRUCTURE CLOUDFLARE

La solution exploite pleinement l'écosystème Cloudflare :
- **Cloudflare Pages** : Pour l'hébergement de l'application
- **Cloudflare Workers** : Pour la logique d'authentification et génération de scripts
- **Cloudflare KV** : Pour le stockage des informations partenaires

## PHASE 1 : CONFIGURATION DE L'INFRASTRUCTURE

### 1.1 Stockage des données partenaires (KV)
- Créer un namespace KV `genealogie-partners`
- Structure des entrées :
  ```json
  {
    "id": "partenaire123",
    "name": "Site Partenaire",
    "domains": ["partenaire.com"],
    "key": "clé_secrète_générée",
    "createdAt": "2025-03-25T14:30:00Z",
    "status": "active"
  }
  ```
- Stocker également le template du script dans ce KV (clé: `embed-template`)

### 1.2 Configuration des Workers
- Créer un Worker `embed-script-worker` pour la génération des scripts personnalisés
- Créer un Worker `auth-validation-worker` pour la validation des authentifications
- Configurer les bindings KV pour accéder au namespace `genealogie-partners`

### 1.3 Configuration des routes
- `genealogie.app/embed/:partnerId.js` → Worker `embed-script-worker`
- `genealogie.app/api/validate-embed-auth` → Worker `auth-validation-worker`
- `genealogie.app/embed` → Cloudflare Pages (l'application frontend)

## PHASE 2 : DÉVELOPPEMENT DES COMPOSANTS

### 2.1 Template du script d'intégration
Développer le fichier `embed-template.js` avec le contenu suivant :

```javascript
(function () {
  // Variables remplacées lors de la génération
  const PARTNER_ID = "__PARTNER_ID__";
  const PARTNER_KEY = "__PARTNER_KEY__";
  
  // Fonction de génération de signature
  function generateSignature(email, timestamp) {
    const dataToSign = `${email}:${timestamp}:${PARTNER_ID}:${window.location.origin}`;
    
    // Version simplifiée du hachage
    let hash = 0;
    for (let i = 0; i < dataToSign.length; i++) {
      const char = dataToSign.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const simpleHash = (hash >>> 0).toString(16);
    
    return simpleHash + PARTNER_KEY.substring(0, 8);
  }

  function loadEmbed(containerId = "genealogie-app", userEmail = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Récupérer l'email depuis l'attribut data si non fourni
    if (!userEmail) {
      userEmail = container.getAttribute("data-user-email");
    }

    // Créer l'iframe
    const iframe = document.createElement("iframe");
    iframe.src = "https://genealogie.app/embed";
    iframe.style = "width:100%;height:100vh;border:none;";
    iframe.loading = "lazy";
    iframe.setAttribute("allowfullscreen", "");
    container.appendChild(iframe);

    // Envoyer l'email après chargement
    iframe.onload = function() {
      if (userEmail) {
        const timestamp = Date.now();
        const signature = generateSignature(userEmail, timestamp);
        
        iframe.contentWindow.postMessage({
          type: "GENEALOGIE_AUTH",
          email: userEmail,
          timestamp: timestamp,
          partnerId: PARTNER_ID,
          signature: signature
        }, "https://genealogie.app");
      }
    };

    // Gérer le redimensionnement
    window.addEventListener("message", (event) => {
      if (event.origin !== "https://genealogie.app") return;
      if (event.data?.type === "resize" && typeof event.data.height === "number") {
        iframe.style.height = `${event.data.height}px`;
      }
    });
  }

  // Auto-démarrage
  document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("genealogie-app");
    if (container) {
      const userEmail = container.getAttribute("data-user-email");
      loadEmbed("genealogie-app", userEmail);
    }
  });

  // API publique
  window.GenealogieEmbed = { load: loadEmbed };
})();
```

### 2.2 Worker de génération de script

```javascript
// embed-script-worker.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Vérifier si c'est une demande de script d'intégration
    const embedMatch = path.match(/^\/embed\/([a-zA-Z0-9_-]+)\.js$/);
    if (embedMatch) {
      const partnerId = embedMatch[1];
      
      try {
        // Récupérer les infos du partenaire depuis KV
        const partnerData = await env.GENEALOGIE_PARTNERS.get(partnerId, { type: "json" });
        
        if (!partnerData || partnerData.status !== "active") {
          return new Response("// Partner not found or inactive", {
            status: 404,
            headers: { "Content-Type": "application/javascript" }
          });
        }
        
        // Récupérer le template du script
        const scriptTemplate = await env.GENEALOGIE_PARTNERS.get("embed-template", { type: "text" });
        
        // Remplacer les variables
        const customScript = scriptTemplate
          .replace(/__PARTNER_ID__/g, partnerData.id)
          .replace(/__PARTNER_KEY__/g, partnerData.key);
        
        // Retourner le script personnalisé
        return new Response(customScript, {
          headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "max-age=3600"
          }
        });
      } catch (error) {
        return new Response("// Error generating embed script", {
          status: 500,
          headers: { "Content-Type": "application/javascript" }
        });
      }
    }
    
    // Route par défaut
    return new Response("Not found", { status: 404 });
  }
};
```

### 2.3 Worker de validation d'authentification

```javascript
// auth-validation-worker.js
export default {
  async fetch(request, env) {
    // N'accepter que les requêtes POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ valid: false, reason: "method_not_allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    try {
      const { email, timestamp, partnerId, signature, origin } = await request.json();
      
      // Vérifications de base
      if (!email || !timestamp || !partnerId || !signature || !origin) {
        return new Response(JSON.stringify({ valid: false, reason: "missing_parameters" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // Vérifier la fraîcheur du timestamp
      const now = Date.now();
      if (now - timestamp > 5 * 60 * 1000) {
        return new Response(JSON.stringify({ valid: false, reason: "expired_timestamp" }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // Récupérer les infos du partenaire
      const partner = await env.GENEALOGIE_PARTNERS.get(partnerId, { type: "json" });
      if (!partner || partner.status !== "active") {
        return new Response(JSON.stringify({ valid: false, reason: "unknown_partner" }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // Vérifier l'origine
      const originUrl = new URL(origin);
      const isAllowedDomain = partner.domains.some(domain => 
        originUrl.hostname === domain || originUrl.hostname.endsWith('.' + domain)
      );
      
      if (!isAllowedDomain) {
        return new Response(JSON.stringify({ valid: false, reason: "unauthorized_domain" }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // Vérifier la signature
      const dataToSign = `${email}:${timestamp}:${partnerId}:${origin}`;
      const expectedSignature = generateSignature(dataToSign, partner.key);
      
      if (signature !== expectedSignature) {
        return new Response(JSON.stringify({ valid: false, reason: "invalid_signature" }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // Succès
      return new Response(JSON.stringify({ valid: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ valid: false, reason: "server_error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};

// Fonction de validation de signature
function generateSignature(dataToSign, key) {
  // Même algorithme que dans le template
  let hash = 0;
  for (let i = 0; i < dataToSign.length; i++) {
    const char = dataToSign.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const simpleHash = (hash >>> 0).toString(16);
  return simpleHash + key.substring(0, 8);
}
```

### 2.4 Page d'intégration front-end

```javascript
// Code à intégrer dans la page /embed
document.addEventListener('DOMContentLoaded', function() {
  // Montrer l'interface de chargement
  showLoadingUI();
  
  // Écouter les messages d'authentification
  window.addEventListener('message', async function(event) {
    // Vérifier le type de message
    if (event.data?.type !== "GENEALOGIE_AUTH") return;
    
    try {
      // Extraire les données
      const { email, timestamp, partnerId, signature } = event.data;
      
      // Valider l'authentification via notre API
      const response = await fetch('/api/validate-embed-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          timestamp,
          partnerId,
          signature,
          origin: event.origin
        })
      });
      
      const result = await response.json();
      
      if (result.valid) {
        // Authentification réussie
        const userData = await fetchOrCreateUser(email);
        initializeApp(userData);
        
        // Notifier le parent pour ajuster la hauteur
        adjustHeight();
      } else {
        // Authentification échouée
        showPublicUI();
        console.error('Authentification échouée:', result.reason);
      }
    } catch (error) {
      console.error('Erreur de validation:', error);
      showErrorUI();
    }
  });
  
  // Fonction pour ajuster la hauteur
  function adjustHeight() {
    const height = document.body.scrollHeight;
    window.parent.postMessage({
      type: "resize",
      height: height
    }, "*");
  }
  
  // Écouter les changements de taille
  window.addEventListener('resize', adjustHeight);
  
  // Initialiser avec l'interface publique par défaut
  setTimeout(() => {
    showPublicUI();
  }, 5000);
});
```

## PHASE 3 : OUTILS D'ADMINISTRATION

### 3.1 Interface d'administration des partenaires

Développer une interface protégée par authentification pour :
- Lister les partenaires existants
- Ajouter/modifier/supprimer des partenaires
- Générer des clés pour les partenaires
- Visualiser et modifier les domaines autorisés

### 3.2 API d'administration (optionnel)

Créer un Worker pour exposer une API RESTful pour la gestion des partenaires, sécurisée par authentification.

## PHASE 4 : TESTS ET DÉPLOIEMENT

### 4.1 Tests locaux
- Utiliser Wrangler pour tester les Workers localement
- Créer des sites partenaires de test

### 4.2 Tests en staging
- Déployer sur un sous-domaine de test (ex: staging.genealogie.app)
- Valider l'intégration avec quelques partenaires pilotes

### 4.3 Déploiement en production
- Déployer les Workers en production
- Configurer les routes dans Cloudflare
- Mettre à jour la documentation

## PHASE 5 : DOCUMENTATION ET SUPPORT

### 5.1 Documentation pour les partenaires

Fournir une documentation claire pour les partenaires :

```markdown
# Guide d'intégration de Genealogie.app

Pour intégrer Genealogie.app sur votre site :

1. Ajoutez un conteneur où l'application sera chargée :
   ```html
   <div id="genealogie-app" data-user-email="EMAIL_DE_VOTRE_UTILISATEUR"></div>
   ```

2. Ajoutez le script d'intégration avec votre identifiant partenaire :
   ```html
   <script src="https://genealogie.app/embed/VOTRE_ID_PARTENAIRE.js"></script>
   ```

3. Remplacez `EMAIL_DE_VOTRE_UTILISATEUR` par l'adresse email de l'utilisateur actuellement connecté sur votre site.

C'est tout ! L'application se chargera automatiquement avec les permissions appropriées pour l'utilisateur.
```

### 5.2 Monitoring et alertes
- Configurer des alertes sur les erreurs Workers
- Mettre en place des métriques d'usage

## CALENDRIER DE DÉPLOIEMENT

| Semaine | Activités |
|---------|-----------|
| Semaine 1 | - Configuration des namespaces KV<br>- Développement du template embed.js<br>- Développement du Worker de génération de script |
| Semaine 2 | - Développement du Worker de validation<br>- Développement de la page d'intégration<br>- Tests unitaires |
| Semaine 3 | - Développement des outils d'administration<br>- Tests d'intégration<br>- Déploiement en staging |
| Semaine 4 | - Documentation pour les partenaires<br>- Tests avec partenaires pilotes<br>- Configuration monitoring<br>- Déploiement en production |

## POINTS D'ATTENTION

- **Sécurité** : Assurer que les clés des partenaires sont bien protégées
- **Performance** : Optimiser les Workers pour minimiser la latence
- **Compatibilité** : Tester sur différents navigateurs et environnements
- **Documentation** : Fournir des exemples clairs pour faciliter l'intégration
