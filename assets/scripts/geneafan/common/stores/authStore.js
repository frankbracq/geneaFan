// authStore.js - Version démontée sans Clerk

import { makeAutoObservable, runInAction } from './mobx-config';
// Import de Clerk supprimé

class AuthStore {
    clerk = null;
    userInfo = null;
    isClerkLoaded = true; // Toujours true pour éviter les vérifications
    isLoading = false;
    error = null;
    authenticationListener = null;

    constructor() {
        makeAutoObservable(this, {
            clerk: false
        });
    }

    setError(error) {
        runInAction(() => {
            this.error = error;
        });
    }

    setLoading(status) {
        runInAction(() => {
            this.isLoading = status;
        });
    }

    async initializeClerk(publishableKey) {
        console.log('Clerk initialization bypassed');
        // Ne fait plus rien, simule juste un succès
        return Promise.resolve();
    }

    // Retourne un objet utilisateur factice si nécessaire pour les tests
    extractUserInfo(user) {
        return null; // Aucun utilisateur authentifié
    }

    setupAuthenticationListener(onAuthChange) {
        // Ne fait plus rien
        console.log('Authentication listener setup bypassed');
    }

    removeAuthenticationListener() {
        // Ne fait plus rien
        console.log('Authentication listener removal bypassed');
    }

    async accessFeature(onAuthenticated, onUnauthenticated) {
        // Durant la phase de test, permettre l'accès à toutes les fonctionnalités
        // Pour simuler un utilisateur connecté, décommentez les lignes suivantes:
        /*
        const mockUser = {
            id: 'temp-user-id',
            email: 'test@example.com',
            fullName: 'Test User',
            firstName: 'Test',
            lastName: 'User',
            profileImageUrl: '',
        };
        onAuthenticated(mockUser);
        */
        
        // Pour la phase initiale, simuler un utilisateur non authentifié :
        if (onUnauthenticated) {
            onUnauthenticated();
        }
    }

    async handleUserAuthentication(clerk, callback) {
        // Ne fait plus rien
        callback(null);
    }

    showSignInForm(clerk, onUnauthenticated) {
        console.log('Sign in form display bypassed');
        // Appelle directement onUnauthenticated puisqu'il n'y a plus d'authentification
        if (onUnauthenticated) {
            onUnauthenticated();
        }
    }

    async logout() {
        console.log('Logout bypassed');
        return Promise.resolve();
    }

    cleanupData() {
        // Ne fait plus rien
        console.log('Data cleanup bypassed');
    }

    get isAuthenticated() {
        return false; // Toujours retourner false (non authentifié)
    }
}

const authStore = new AuthStore();
export default authStore;