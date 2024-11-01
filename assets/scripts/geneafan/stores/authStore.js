// authStore.js

import { makeAutoObservable, runInAction } from './mobx-config';
import { Clerk } from '@clerk/clerk-js';

class AuthStore {
    clerk = null;
    userInfo = null;
    isClerkLoaded = false;
    authenticationListener = null;

    constructor() {
        makeAutoObservable(this);
        // Initialize authentication listener
        this.authenticationListener = null;
    }

    /**
     * Initializes Clerk with the publishable key.
     * @param {string} publishableKey - The publishable key from Clerk.
     */
    async initializeClerk(publishableKey) {
        this.clerk = new Clerk(publishableKey);
        this.clerk.navigate = () => {}
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
        this.showSignInForm(this.clerk, onUnauthenticated);

        // Prevent multiple listeners
        if (this.authenticationListener) {
            this.authenticationListener();
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
                this.authenticationListener();
                this.authenticationListener = null;
            }
        });
    }

    /**
     * Handles user authentication.
     * @param {Clerk} clerk - Initialized Clerk instance.
     * @param {Function} callback - Function to execute with user information or null.
     */
    async handleUserAuthentication(clerk, callback) {
        // Moved from users.js
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
            if (this.authenticationListener) {
                this.authenticationListener();
                this.authenticationListener = null;
            }

            // Add listener for authentication changes
            this.authenticationListener = clerk.addListener(({ session }) => {
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
     * Displays the sign-in form.
     * @param {Clerk} clerk - Initialized Clerk instance.
     * @param {Function} [onUnauthenticated] - Callback if the user closes the modal without authenticating.
     */
    showSignInForm(clerk, onUnauthenticated) {
        // Moved from users.js
        console.log("Displaying the sign-in form with clerk.openSignIn().");

        let unsubscribe;

        const handleOverlayClose = (event) => {
            console.log("The sign-in component has been closed.");
            if (!clerk.user && typeof onUnauthenticated === 'function') {
                console.log("The user is not authenticated. Executing onUnauthenticated.");
                onUnauthenticated();
            } else {
                console.log("The user is authenticated.");
            }
            if (unsubscribe) {
                unsubscribe();
            }
        };

        unsubscribe = clerk.addListener(({ openSignIn, ...arg }) => {
            if (!openSignIn) {
                handleOverlayClose();
            }
        });

        clerk.navigate = () => {
            const signInButton = document.getElementById('sign-in-button');
            const userButtonDiv = document.getElementById('user-button');

            signInButton.style.display = 'none';
            userButtonDiv.style.display = 'block';

            if (!userButtonDiv.hasChildNodes()) {
                clerk.mountUserButton(userButtonDiv);

                clerk.navigate = () => {
                    onUnauthenticated?.();
                    signInButton.style.display = 'block';
                    userButtonDiv.style.display = 'none';
                };
            }
        };

        clerk.openSignIn();
    }

    /**
     * Handles user logout.
     * @param {Clerk} clerk - Initialized Clerk instance.
     */
    async handleLogout(clerk) {
        // Moved from users.js
        try {
            await clerk.signOut();
            console.log("User has been signed out.");
        } catch (error) {
            console.error("Error during sign-out:", error);
        }
    }

    async logout() {
        if (!this.clerk) return;

        try {
            await this.clerk.signOut();

            // Remove authentication listener if it exists
            if (this.authenticationListener) {
                this.authenticationListener();
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

    /**
     * Function to access a protected feature within the application.
     * It checks if the user is authenticated and, if so, executes the authenticated callback.
     * Otherwise, it executes the unauthenticated callback.
     *
     * @param {Function} onAuthenticated - Function to execute if the user is authenticated.
     * @param {Function} [onUnauthenticated] - Function to execute if the user is not authenticated.
     */
    accessProtectedFeature(onAuthenticated, onUnauthenticated) {
        if (!this.userInfo) {
            console.log("Access denied. User is not authenticated.");
            if (typeof onUnauthenticated === 'function') {
                onUnauthenticated();
            } else {
                // By default, display the sign-in form
                this.showSignInForm(this.clerk);
            }
            return;
        }

        console.log("Access granted to the protected feature.");
        onAuthenticated(this.userInfo);
    }
}

const authStore = new AuthStore();
export default authStore;
