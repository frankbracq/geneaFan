import { initializeAuth } from './auth.js';
import { initializeTabs } from '../tabs/tabManager.js';
import { setupEventListeners } from './events.js';
import { v4 as uuidv4 } from 'uuid';

export async function setupCore() {
    console.log('Core setup started');
    
    try {
        ensureUserId();
        await initializeAuth();
        await initializeTabs(); // Initialize tabs including Google Maps
        setupEventListeners();
        handleUrlParameters();
    } catch (error) {
        console.error("Error in core setup:", error);
        throw error;
    }
}

function ensureUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = typeof crypto !== 'undefined' && crypto.randomUUID ? 
            crypto.randomUUID() : 
            uuidv4();
        localStorage.setItem('userId', userId);
    }
    return userId;
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