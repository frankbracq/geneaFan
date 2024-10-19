
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
export async function handleUserAuthentication(clerk, callback) {
    console.log("Handling user authentication."); // Log pour vérifier l'appel
    try {
        // Vérifie si Clerk est prêt
        if (!clerk.loaded) {
            console.log("Clerk not loaded. Attempting to load Clerk...");
            await clerk.load();
            console.log("Clerk loaded successfully.");
        } else {
            console.log("Clerk is already loaded.");
        }

        // Récupère l'utilisateur actuel depuis Clerk
        const user = clerk.user;

        if (user) {
            console.log("User is authenticated:", user);
            // Si un utilisateur est authentifié, crée un objet userInfo avec les détails pertinents
            const userInfo = {
                id: user.id,
                email: user.primaryEmailAddress?.emailAddress,
                fullName: user.fullName,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImageUrl: user.profileImageUrl,
            };
            // Exécute la fonction callback avec l'objet userInfo
            callback(userInfo);
        } else {
            console.log("No user is authenticated.");
            // Si aucun utilisateur n'est authentifié, exécute la callback avec null
            callback(null);
        }

        // Ajoute un écouteur pour détecter les changements d'état d'authentification (connexion, déconnexion)
        const listener = clerk.addListener(({ session }) => {
            const currentUser = clerk.user;
            if (currentUser) {
                console.log("User has logged in:", currentUser);
                // Si un utilisateur devient authentifié, crée un nouvel objet userInfo
                const userInfo = {
                    id: currentUser.id,
                    email: currentUser.primaryEmailAddress?.emailAddress,
                    fullName: currentUser.fullName,
                    firstName: currentUser.firstName,
                    lastName: currentUser.lastName,
                    profileImageUrl: currentUser.profileImageUrl,
                };
                // Exécute la fonction callback avec le nouvel objet userInfo
                callback(userInfo);
            } else {
                console.log("User has logged out.");
                // Si l'utilisateur se déconnecte, exécute la callback avec null
                callback(null);
            }
        });

        // Retourne une fonction de nettoyage pour retirer l'écouteur quand il n'est plus nécessaire
        return () => clerk.removeListener(listener);
    } catch (error) {
        console.error("Error in handleUserAuthentication:", error);
        callback(null);
    }
}

/**
 * Fonction pour afficher le formulaire de connexion dans la modal Bootstrap.
 *
 * @param {Clerk} clerk - Instance de Clerk initialisée.
 */
export function showSignInForm(clerk) {
    console.log("Affichage du formulaire de connexion dans la modal Bootstrap.");

    // Monter le formulaire de connexion de Clerk dans le div avec id 'sign-in'
    const signInDiv = document.getElementById('sign-in');
    if (!signInDiv) {
        console.error("Element with ID 'sign-in' not found.");
        return;
    }

    clerk.mountSignIn(signInDiv);

    // Initialiser la modal Bootstrap
    const signInModalElement = document.getElementById('signInModal');
    if (!signInModalElement) {
        console.error("Element with ID 'signInModal' not found.");
        return;
    }
    const signInModal = new Modal(signInModalElement, {
        backdrop: 'static', // Empêche la fermeture en cliquant en dehors
        keyboard: false     // Empêche la fermeture avec la touche Échap
    });

    // Afficher la modal
    signInModal.show();

    // Utiliser une réaction MobX pour fermer et nettoyer la modal après connexion
    const disposer = reaction(
        () => clerk.session && clerk.session.userId, // Surveiller les changements de session utilisateur
        (userId) => {
            if (userId) {
                // Si l'utilisateur est authentifié, cacher la modal
                signInModal.hide();

                // Nettoyer en supprimant le conteneur de la modal du DOM si nécessaire
                disposer(); // Arrêter la réaction
            }
        }
    );

    // Ajouter un écouteur pour supprimer la modal du DOM lorsqu'elle est cachée
    signInModalElement.addEventListener('hidden.bs.modal', () => {
        // Optionnel : Vous pouvez nettoyer le contenu si nécessaire
        // signInDiv.innerHTML = '';
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
