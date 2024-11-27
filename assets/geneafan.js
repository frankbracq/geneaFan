import { initializeApplication } from './scripts/geneafan/core/app.js';
import './scss/main.scss';

// Assets contexts
require.context('./other', true);
require.context('./images/icons', true);
require.context('./images', true);

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Application initialization starting...");
    await initializeApplication();
});