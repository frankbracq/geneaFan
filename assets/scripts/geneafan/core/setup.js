import { initializeAuth } from './auth.js';
import { initializeTabs } from '../tabs/tabManager.js';
import { setupEventListeners } from './events.js';
import { v4 as uuidv4 } from 'uuid';

export async function setupCore() {
    console.log('Core setup started');
    
    try {
        setupBeforeUnload();
        await initializeDOMContent();
        ensureUserId();
        await initializeAuth();

        // Unique call to initializeTabs
        await initializeTabs();
        
        setupEventListeners();
        handleUrlParameters();
        hideOverlay();
    } catch (error) {
        console.error("Error in core setup:", error);
        throw error;
    }
}

function setupBeforeUnload() {
    window.addEventListener("beforeunload", function (e) {
        console.log("La page est sur le point de se recharger ou de se fermer.");
    });
}

async function initializeDOMContent() {
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', () => {
                console.log("DOMContentLoaded fired.");
                resolve();
            });
        });
    }
}

function ensureUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = generateUniqueId();
        localStorage.setItem('userId', userId);
    }
    return userId;
}

function generateUniqueId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return uuidv4();
}

function hideOverlay() {
    const overlay = document.getElementById("overlay");
    if (overlay) {
        overlay.style.display = "none";
        console.log("Overlay hidden.");
    } else {
        console.error("Element with ID 'overlay' not found.");
    }
}

function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const contexte = urlParams.get("contexte");

    if (contexte === "demo") {
        ["#download-svg", "#download-png-transparency", "#download-png-background"].forEach(selector => {
            const element = document.querySelector(selector);
            if (element) element.style.display = "none";
        });

        const showMissing = document.querySelector("#show-missing");
        if (showMissing) showMissing.closest(".col").style.display = "none";
    }
}