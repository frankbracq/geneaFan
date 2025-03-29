// genealogie.app/embed.js
(function () {
    /**
     * Injects the Genealogie.app embed iframe into a container element.
     * Usage:
     * <div id="genealogie-app"></div>
     * <script src="https://app/embed.js"></script>
     * Optionally, you can call GenealogieEmbed.load('custom-id') manually.
     */
    function loadEmbed(containerId = "genealogie-app") {
      const container = document.getElementById(containerId);
      if (!container) return;
  
      const iframe = document.createElement("iframe");
      iframe.src = "https://app/embed";
      iframe.style = "width:100%;height:100vh;border:none;";
      iframe.loading = "lazy";
      iframe.setAttribute("allowfullscreen", "");
      container.appendChild(iframe);
  
      // Gérer les messages postMessage pour ajuster la hauteur
      window.addEventListener("message", (event) => {
        if (event.origin !== "https://app") return;
        if (event.data?.type === "resize" && typeof event.data.height === "number") {
          iframe.style.height = `${event.data.height}px`;
        }
      });
    }
  
    // Auto-démarrage si un conteneur est présent
    // Permet une intégration simple sans configuration supplémentaire côté intégrateur
    document.addEventListener("DOMContentLoaded", () => loadEmbed());
  
    // Expose une API globale pour usage avancé
    // Les développeurs peuvent appeler GenealogieEmbed.load('custom-id') pour cibler un autre conteneur
    window.GenealogieEmbed = { load: loadEmbed };
  })();
  