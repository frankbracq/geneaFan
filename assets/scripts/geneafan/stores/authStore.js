// authStore.js

import { makeAutoObservable, runInAction } from './mobx-config';
import { Clerk } from '@clerk/clerk-js';

class AuthStore {
    clerk = null;
    userInfo = null;
    isClerkLoaded = false;
    isLoading = false;
    error = null;
    authenticationListener = null;

    constructor() {
        makeAutoObservable(this, {
            clerk: false // Do not observe clerk directly
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
        if (this.clerk) return; // Avoid double initialization

        try {
            this.setLoading(true);
            this.clerk = new Clerk(publishableKey);
            this.clerk.navigate = () => {};
            
            await this.clerk.load();
            
            runInAction(() => {
                this.isClerkLoaded = true;
                if (this.clerk.user) {
                    this.userInfo = this.extractUserInfo(this.clerk.user);
                }
            });
        } catch (error) {
            this.setError(error);
            console.error("Error loading Clerk:", error);
        } finally {
            this.setLoading(false);
        }
    }

    // Extract user info into a separate method
    extractUserInfo(user) {
        if (!user) return null;
        return {
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            fullName: user.fullName,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
        };
    }

    setupAuthenticationListener(onAuthChange) {
        this.removeAuthenticationListener(); // Clean up previous listener

        this.authenticationListener = this.clerk.addListener(({ session }) => {
            const userInfo = this.clerk.user ? this.extractUserInfo(this.clerk.user) : null;
            runInAction(() => {
                this.userInfo = userInfo;
            });
            if (onAuthChange) onAuthChange(userInfo);
        });
    }

    removeAuthenticationListener() {
        if (this.authenticationListener) {
            this.authenticationListener();
            this.authenticationListener = null;
        }
    }

    async accessFeature(onAuthenticated, onUnauthenticated) {
        if (!this.clerk) {
            this.setError(new Error("Clerk not initialized"));
            return;
        }

        try {
            if (this.userInfo) {
                onAuthenticated(this.userInfo);
                return;
            }

            if (this.clerk.user) {
                const userInfo = this.extractUserInfo(this.clerk.user);
                runInAction(() => {
                    this.userInfo = userInfo;
                });
                onAuthenticated(userInfo);
                return;
            }

            this.showSignInForm(this.clerk, onUnauthenticated);
            this.setupAuthenticationListener((userInfo) => {
                if (userInfo) onAuthenticated(userInfo);
            });
        } catch (error) {
            this.setError(error);
            onUnauthenticated?.();
        }
    }

    async handleUserAuthentication(clerk, callback) {
        if (!clerk?.loaded) {
            try {
                await clerk.load();
            } catch (error) {
                this.setError(error);
                callback(null);
                return;
            }
        }

        const userInfo = clerk.user ? this.extractUserInfo(clerk.user) : null;
        callback(userInfo);
        
        this.setupAuthenticationListener(callback);
    }

    showSignInForm(clerk, onUnauthenticated) {
        if (!clerk) return;

        const handleClose = () => {
            if (!clerk.user && onUnauthenticated) {
                onUnauthenticated();
            }
            this.removeAuthenticationListener();
        };

        clerk.navigate = () => {
            const signInButton = document.getElementById('sign-in-button');
            const userButtonDiv = document.getElementById('user-button');

            if (signInButton) signInButton.style.display = 'none';
            if (userButtonDiv) {
                userButtonDiv.style.display = 'block';
                if (!userButtonDiv.hasChildNodes()) {
                    clerk.mountUserButton(userButtonDiv);
                    clerk.navigate = () => {
                        onUnauthenticated?.();
                        if (signInButton) signInButton.style.display = 'block';
                        userButtonDiv.style.display = 'none';
                    };
                }
            }
        };

        clerk.openSignIn();
    }

    async logout() {
        if (!this.clerk) return;

        try {
            this.setLoading(true);
            await this.clerk.signOut();
            this.removeAuthenticationListener();
            
            runInAction(() => {
                this.userInfo = null;
            });

            this.cleanupData();
        } catch (error) {
            this.setError(error);
        } finally {
            this.setLoading(false);
        }
    }

    cleanupData() {
        // Clean up data
        runInAction(() => {
            this.userInfo = null;
            this.error = null;
        });
    }

    get isAuthenticated() {
        return !!this.userInfo;
    }
}

const authStore = new AuthStore();
export default authStore;
