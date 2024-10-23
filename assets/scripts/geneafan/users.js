
import { reaction } from "mobx";
import { Modal } from "bootstrap";

/**
 * Fonction pour accéder à une fonctionnalité protégée au sein de l'application.
 * Elle vérifie si l'utilisateur est authentifié et, si oui, exécute le callback authentifié.
 * Sinon, elle exécute le callback non authentifié.
 *
 * @param {Clerk} clerk - Instance de Clerk initialisée.
 * @param {Function} onAuthenticated - Fonction à exécuter si l'utilisateur est authentifié.
 * @param {Function} [onUnauthenticated] - Fonction à exécuter si l'utilisateur n'est pas authentifié.
 */
export function accessProtectedFeature(clerk, onAuthenticated, onUnauthenticated) {
    handleUserAuthentication(clerk, (userInfo) => {
        if (userInfo) {
            console.log("Access granted to the protected feature.");
            onAuthenticated(userInfo);
        } else {
            console.log("Access denied. User is not authenticated.");
            if (typeof onUnauthenticated === 'function') {
                onUnauthenticated();
            } else {
                // Par défaut, afficher le formulaire de connexion
                showSignInForm(clerk);
            }
        }
    });
}

/**
 * Fonction pour gérer l'authentification de l'utilisateur.
 * Elle vérifie si Clerk est prêt, récupère l'utilisateur actuel et exécute la callback avec les informations utilisateur.
 *
 * @param {Clerk} clerk - Instance de Clerk initialisée.
 * @param {Function} callback - Fonction à exécuter avec les informations de l'utilisateur ou null.
 * @returns {Function} - Fonction de nettoyage pour retirer l'écouteur d'authentification.
 */
let authenticationListener = null;

export async function handleUserAuthentication(clerk, callback) {
    console.log("Handling user authentication.");
    try {
        if (!clerk.loaded) {
            console.log("Clerk not loaded. Attempting to load Clerk...");
            await clerk.load();
            console.log("Clerk loaded successfully.");
        } else {
            console.log("Clerk is already loaded.");
        }

        const user = clerk.user;

        if (user) {
            console.log("User is authenticated:", user);
            const userInfo = {
                id: user.id,
                email: user.primaryEmailAddress?.emailAddress,
                fullName: user.fullName,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImageUrl: user.profileImageUrl,
            };
            callback(userInfo);
        } else {
            console.log("No user is authenticated.");
            callback(null);
        }

        // Prevent multiple listeners
        if (authenticationListener) {
            clerk.removeListener(authenticationListener);
            authenticationListener = null;
        }

        // Add listener for authentication changes
        authenticationListener = clerk.addListener(({ session }) => {
            const currentUser = clerk.user;
            if (currentUser) {
                console.log("User has logged in:", currentUser);
                const userInfo = {
                    id: currentUser.id,
                    email: currentUser.primaryEmailAddress?.emailAddress,
                    fullName: currentUser.fullName,
                    firstName: currentUser.firstName,
                    lastName: currentUser.lastName,
                    profileImageUrl: currentUser.profileImageUrl,
                };
                callback(userInfo);
            } else {
                console.log("User has logged out.");
                callback(null);
            }
        });
    } catch (error) {
        console.error("Error in handleUserAuthentication:", error);
        callback(null);
    }
}

/**
 * Function to display the sign-in form in a Bootstrap modal.
 *
 * @param {Clerk} clerk - Initialized instance of Clerk.
 * @param {Function} [onUnauthenticated] - Callback to execute if the user closes the modal without authenticating.
 */
export function showSignInForm(clerk, onUnauthenticated) {
    console.log("Displaying the sign-in form in the Bootstrap modal.");

    // Mount the Clerk sign-in form in the div with id 'sign-in'
    const signInDiv = document.getElementById('sign-in');
    if (!signInDiv) {
        console.error("Element with ID 'sign-in' not found.");
        return;
    }

    clerk.mountSignIn(signInDiv);

    // Initialize the Bootstrap modal
    const signInModalElement = document.getElementById('signInModal');
    if (!signInModalElement) {
        console.error("Element with ID 'signInModal' not found.");
        return;
    }
    const signInModal = new Modal(signInModalElement, {
        backdrop: 'static', // Prevent closing by clicking outside
        keyboard: false     // Prevent closing with the Escape key
    });

    // Display the modal
    signInModal.show();

    // Add an event listener for when the modal is hidden
    signInModalElement.addEventListener('hidden.bs.modal', () => {
        console.log("Sign-in modal has been closed.");

        // Check if the user is authenticated
        if (!clerk.user && typeof onUnauthenticated === 'function') {
            onUnauthenticated();
        }

        // Optionally, clean up the sign-in form
        clerk.unmountSignIn(signInDiv);
    });

    // Optionally, add a listener for when the modal is fully shown
    signInModalElement.addEventListener('shown.bs.modal', () => {
        console.log("Sign-in modal is now fully shown.");
    });
}

/**
 * Fonction pour gérer la déconnexion de l'utilisateur.
 *
 * @param {Clerk} clerk - Instance de Clerk initialisée.
 */
export async function handleLogout(clerk) {
    try {
        await clerk.signOut();
        console.log("User has been signed out.");
    } catch (error) {
        console.error("Error during sign-out:", error);
    }
}
