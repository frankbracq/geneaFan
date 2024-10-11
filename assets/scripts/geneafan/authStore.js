import { makeAutoObservable, runInAction } from 'mobx';
import { Clerk } from '@clerk/clerk-js';
import { accessProtectedFeature, handleUserAuthentication, showSignInForm } from './users.js';

class AuthStore {
    clerk = null;
    userInfo = null;
    isClerkLoaded = false;

    constructor() {
        makeAutoObservable(this);
    }

    // Initialiser Clerk
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

    // Gérer l'authentification de l'utilisateur
    handleAuthentication() {
        if (!this.clerk) return;

        handleUserAuthentication(this.clerk, (userInfo) => {
            runInAction(() => {
                this.userInfo = userInfo;
            });
        });
    }

    // Accéder à une fonctionnalité protégée
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

    // Gérer la déconnexion
    async logout() {
        if (!this.clerk) return;

        try {
            await this.clerk.signOut();
            runInAction(() => {
                this.userInfo = null;
            });
            console.log("User has been signed out.");
        } catch (error) {
            console.error("Error during sign-out:", error);
        }
    }
}

const authStore = new AuthStore();
export default authStore;
