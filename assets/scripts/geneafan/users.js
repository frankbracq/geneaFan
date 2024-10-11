import { Clerk } from '@clerk/clerk-js'; // Import nommé correct

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
 * Fonction pour afficher le formulaire de connexion.
 * Elle insère un div dans le DOM et monte le formulaire de connexion de Clerk dedans.
 *
 * @param {Clerk} clerk - Instance de Clerk initialisée.
 */
export function showSignInForm(clerk) {
    console.log("Displaying the sign-in form.");
    const dynamicContentDiv = document.getElementById('dynamic-content');

    if (!dynamicContentDiv) {
        console.error("Element with ID 'dynamic-content' not found.");
        return;
    }

    // Insère un div où le formulaire de connexion sera monté
    dynamicContentDiv.innerHTML = '<div id="sign-in"></div>';
    // Monte le formulaire de connexion de Clerk dans le div nouvellement créé
    clerk.mountSignIn(document.getElementById('sign-in'));
}

/**
 * Fonction pour initialiser l'interface utilisateur en fonction de l'état d'authentification.
 * Elle met à jour le DOM pour afficher les informations de l'utilisateur ou les options de connexion en conséquence.
 *
 * @param {Clerk} clerk - Instance de Clerk initialisée.
 * @param {Object|null} userInfo - Informations sur l'utilisateur authentifié ou null.
 */
export function initializeAuthUI(clerk, userInfo) {
    const userControlsElement = document.getElementById('user-controls');

    if (!userControlsElement) {
        console.error("Element with ID 'user-controls' not found.");
        return;
    }

    if (userInfo) {
        // Si l'utilisateur est authentifié, affiche le bouton utilisateur de Clerk
        userControlsElement.innerHTML = `
            <div id="user-button"></div>
        `;
        const userButtonDiv = document.getElementById('user-button');
        if (!userButtonDiv) {
            console.error("Element with ID 'user-button' not found.");
            return;
        }
        // Monte le bouton utilisateur de Clerk (par exemple, avatar avec un menu déroulant) dans le div
        clerk.mountUserButton(userButtonDiv);
    } else {
        // Si l'utilisateur n'est pas authentifié, affiche un bouton "Se Connecter"
        userControlsElement.innerHTML = `<button id="sign-in-button">Se Connecter</button>`;
        const signInButton = document.getElementById('sign-in-button');

        if (!signInButton) {
            console.error("Element with ID 'sign-in-button' not found.");
            return;
        }

        // Ajoute un écouteur d'événement au bouton "Se Connecter" pour afficher le formulaire de connexion lorsqu'il est cliqué
        signInButton.addEventListener('click', () => {
            showSignInForm(clerk);
        });
    }

    // Cacher l'overlay maintenant que l'initialisation est terminée
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.style.display = 'none';
        console.log("Overlay hidden.");
    } else {
        console.error("Element with ID 'overlay' not found.");
    }
}

/**
 * Fonction pour accéder à une fonctionnalité protégée au sein de l'application.
 * Elle vérifie si l'utilisateur est authentifié et, si oui, exécute la fonction callback fournie.
 * Si l'utilisateur n'est pas authentifié, elle affiche le formulaire de connexion.
 *
 * @param {Clerk} clerk - Instance de Clerk initialisée.
 * @param {Function} callback - La fonction à exécuter si l'utilisateur est authentifié.
 */
export function accessProtectedFeature(clerk, callback) {
    handleUserAuthentication(clerk, (userInfo) => {
        if (userInfo) {
            console.log("Access granted to the protected feature.");
            // Exécute la fonction callback avec les informations de l'utilisateur
            callback(userInfo);
        } else {
            // Si non authentifié, affiche le formulaire de connexion
            showSignInForm(clerk);
        }
    });
}

/**
 * Fonction pour gérer la déconnexion de l'utilisateur.
 * Elle appelle la méthode signOut de Clerk et met à jour l'interface utilisateur après une déconnexion réussie.
 *
 * @param {Clerk} clerk - Instance de Clerk initialisée.
 */
export function handleLogout(clerk) {
    // Appelle la méthode signOut de Clerk pour déconnecter l'utilisateur
    clerk.signOut().then(() => {
        console.log("User has been signed out.");
        // Met à jour l'interface utilisateur pour refléter l'état de déconnexion
        updateUIOnLogout();
    }).catch((error) => {
        // Journalise toute erreur survenue pendant le processus de déconnexion
        console.error("Error during sign-out:", error);
    });
}

/**
 * Fonction pour mettre à jour l'interface utilisateur après la déconnexion de l'utilisateur.
 * Elle efface les informations de l'utilisateur et affiche le bouton "Se Connecter".
 */
export function updateUIOnLogout() {
    const userControlsElement = document.getElementById('user-controls');

    if (!userControlsElement) {
        console.error("Element with ID 'user-controls' not found.");
        return;
    }

    // Remplace le contenu des contrôles utilisateur par le bouton "Se Connecter"
    userControlsElement.innerHTML = `<button id="sign-in-button">Se Connecter</button>`;
    const signInButton = document.getElementById('sign-in-button');

    if (!signInButton) {
        console.error("Element with ID 'sign-in-button' not found.");
        return;
    }

    // Ajoute un écouteur d'événement au bouton "Se Connecter" pour afficher le formulaire de connexion lorsqu'il est cliqué
    signInButton.addEventListener('click', () => {
        showSignInForm(clerk);
    });

    // Efface tout contenu dynamique, comme le formulaire de connexion, si affiché
    const dynamicContentDiv = document.getElementById('dynamic-content');
    if (dynamicContentDiv) {
        dynamicContentDiv.innerHTML = '';
    }
}
