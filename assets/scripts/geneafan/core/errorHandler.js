export function handleInitializationError(msg, url, line) {
    console.error(`Error during initialization: ${msg}${url ? ` at ${url}:${line}` : ''}`);
    showErrorState();
    return false;
}

function showErrorState() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.innerHTML = `
            <h2>
                <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                Une erreur s'est produite
            </h2>
            <p>Impossible d'initialiser l'application.</p>
        `;
    }
}