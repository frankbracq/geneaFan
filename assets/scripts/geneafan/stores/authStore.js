// authStore.js

import { makeAutoObservable, runInAction } from 'mobx';
import { Clerk } from '@clerk/clerk-js';
import { showSignInForm } from '../users.js';

class AuthStore {
    clerk = null;
    userInfo = null;
    isClerkLoaded = false;
    authenticationListener = null;

    constructor() {
        makeAutoObservable(this);
    }

    /**
     * Initializes Clerk with the publishable key.
     * @param {string} publishableKey - The publishable key from Clerk.
     */
    async initializeClerk(publishableKey) {
        this.clerk = new Clerk(publishableKey);
        try {
            await this.clerk.load();
            runInAction(() => {
                this.isClerkLoaded = true;
                console.log('Clerk loaded:', this.clerk.loaded);

                // Check if the user is already authenticated
                if (this.clerk.user) {
                    console.log('User is already authenticated at startup.');
                    const userInfo = this.clerk.user;
                    this.userInfo = userInfo;
                }
            });
        } catch (error) {
            console.error("Error loading Clerk:", error);
        }
    }

    /**
     * Accesses a protected feature by checking authentication.
     * @param {Function} onAuthenticated - Callback executed if the user is authenticated.
     * @param {Function} onUnauthenticated - Callback executed if the user is not authenticated.
     */
    accessFeature(onAuthenticated, onUnauthenticated) {
        if (!this.clerk) {
            console.error("Clerk instance is not initialized.");
            return;
        }

        if (this.userInfo) {
            console.log('User is already authenticated in the store.');
            onAuthenticated(this.userInfo);
            return;
        }

        if (this.clerk.user) {
            console.log('Clerk already has an authenticated user.');
            const userInfo = this.clerk.user;
            runInAction(() => {
                this.userInfo = userInfo;
            });
            onAuthenticated(userInfo);
            return;
        }

        // Pass onUnauthenticated to showSignInForm
        showSignInForm(this.clerk, onUnauthenticated);

        // Prevent multiple listeners
        if (this.authenticationListener) {
            this.clerk.removeListener(this.authenticationListener);
            this.authenticationListener = null;
        }

        // Add listener for authentication changes
        this.authenticationListener = this.clerk.addListener(({ session }) => {
            if (session) {
                console.log('User has logged in:', this.clerk.user);
                const userInfo = this.clerk.user;
                runInAction(() => {
                    this.userInfo = userInfo;
                });
                onAuthenticated(userInfo);

                // Remove listener after use
                this.clerk.removeListener(this.authenticationListener);
                this.authenticationListener = null;
            }
        });
    }

    async logout() {
        if (!this.clerk) return;

        try {
            await this.clerk.signOut();

            // Remove authentication listener if it exists
            if (this.authenticationListener) {
                this.clerk.removeListener(this.authenticationListener);
                this.authenticationListener = null;
                console.log("Authentication listener has been removed.");
            }

            runInAction(() => {
                this.userInfo = null;
            });

            console.log("User has been signed out.");

            // Additional actions after logout, if necessary
            this.cleanupData();
            this.redirectToHomePage();
        } catch (error) {
            console.error("Error during sign-out:", error);
        }
    }

    cleanupData() {
        // Implement your cleanup logic here
        console.log("Cleaning up user data...");
    }

    // redirectToHomePage() {
    //    window.location.href = '/';
    // }
}

const authStore = new AuthStore();
export default authStore;