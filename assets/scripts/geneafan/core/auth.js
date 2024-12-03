import authStore from '../common/stores/authStore.js';
import { reaction } from '../common/stores/mobx-config.js';

export async function initializeAuth() {
    console.log('Auth initialization started');
    
    try {
        // Initialize Clerk
        const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
        await authStore.initializeClerk(publishableKey);
        
        // Setup auth UI
        setupAuthUI();
        
        // Setup user controls observer
        setupUserControlsObserver();
        
    } catch (error) {
        console.error("Error initializing auth:", error);
        throw error;
    }
}

function setupAuthUI() {
    const signInButton = document.getElementById('sign-in-button');
    const userButtonDiv = document.getElementById('user-button');

    // Configuration initiale des boutons en fonction de l'état de connexion
    if (authStore.userInfo) {
        if (signInButton) signInButton.style.display = 'none';
        if (userButtonDiv) {
            userButtonDiv.style.display = 'block';
            if (!userButtonDiv.hasChildNodes()) {
                authStore.clerk.mountUserButton(userButtonDiv);
            }
        }
    }

    // Setup du click handler
    if (signInButton) {
        signInButton.addEventListener('click', () => {
            if (!authStore.userInfo) {
                authStore.showSignInForm(authStore.clerk);
            }
        });
    }
}

function setupUserControlsObserver() {
    // Correctly configure reaction with two functions
    reaction(
        // First function: returns the data we want to track
        () => authStore.userInfo,
        // Second function: handles the changes
        (userInfo) => {
            const signInButton = document.getElementById('sign-in-button');
            const userButtonDiv = document.getElementById('user-button');

            if (!signInButton || !userButtonDiv) {
                console.error("User controls elements not found.");
                return;
            }

            if (userInfo) {
                // User is authenticated
                signInButton.style.display = 'none';
                userButtonDiv.style.display = 'block';

                // Mount the Clerk UserButton if not already mounted
                if (!userButtonDiv.hasChildNodes()) {
                    authStore.clerk.mountUserButton(userButtonDiv);
                    authStore.clerk.navigate = () => {
                        signInButton.style.display = 'block';
                        userButtonDiv.style.display = 'none';
                    }
                }
            } else {
                // User is not authenticated
                userButtonDiv.style.display = 'none';
                signInButton.style.display = 'block';
            }
        }
    );
}