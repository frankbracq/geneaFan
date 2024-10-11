// src/stores/authStore.js

import { makeAutoObservable, runInAction } from 'mobx';
import { Clerk } from '@clerk/clerk-js';
import { accessProtectedFeature, handleUserAuthentication, showSignInForm } from '../users.js'; // Ajustez le chemin si nécessaire

class AuthStore {
    clerk = null;
    userInfo = null;
    isClerkLoaded = false;

    constructor() {
        makeAutoObservable(this);
    }

    /**
     * Initialise Clerk avec la clé publishable.
     * @param {string} publishableKey - La clé publishable de Clerk.
     */
    async initializeClerk(publishableKey) {
        this.clerk = new Clerk(publishableKey);
        try {
            await this.clerk.load();
            runInAction(() => {
                this.isClerkLoaded = true;
                console.log('Clerk loaded:', this.clerk.loaded);
            });
            this.handleAuthentication();
        } catch (error) {
            console.error("Error loading Clerk:", error);
        }
    }

    /**
     * Gère l'authentification de l'utilisateur en utilisant Clerk.
     */
    handleAuthentication() {
        if (!this.clerk) return;

        handleUserAuthentication(this.clerk, (userInfo) => {
            runInAction(() => {
                this.userInfo = userInfo;
            });
        });
    }

    /**
     * Accède à une fonctionnalité protégée en vérifiant l'authentification.
     * @param {Function} onAuthenticated - Callback exécuté si l'utilisateur est authentifié.
     * @param {Function} onUnauthenticated - Callback exécuté si l'utilisateur n'est pas authentifié.
     */
    accessFeature(onAuthenticated, onUnauthenticated) {
        if (!this.clerk) {
            console.error("Clerk instance is not initialized.");
            return;
        }

        accessProtectedFeature(this.clerk, 
            (userInfo) => {
                runInAction(() => {
                    this.userInfo = userInfo;
                });
                onAuthenticated(userInfo);
            }, 
            () => {
                if (onUnauthenticated) {
                    onUnauthenticated();
                } else {
                    showSignInForm(this.clerk);
                }
            }
        );
    }

    /**
     * Gère la déconnexion de l'utilisateur.
     */
    async logout() {
        if (!this.clerk) return;

        try {
            await this.clerk.signOut();
            runInAction(() => {
                this.userInfo = null;
            });
            console.log("User has been signed out.");
            
            // Actions supplémentaires après la déconnexion, si nécessaire
            this.cleanupData();
            this.redirectToHomePage();
        } catch (error) {
            console.error("Error during sign-out:", error);
        }
    }

    /**
     * Nettoie les données spécifiques après la déconnexion.
     */
    cleanupData() {
        // Implémentez la logique de nettoyage ici
        console.log("Cleaning up user data...");
    }

    /**
     * Redirige l'utilisateur vers la page d'accueil après la déconnexion.
     */
    redirectToHomePage() {
        window.location.href = '/';
    }
}

const authStore = new AuthStore();
export default authStore;
