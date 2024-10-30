import { makeAutoObservable, runInAction } from './mobx-config';
import { Clerk } from '@clerk/clerk-js';

class AuthStore {
    clerk = null;
    userInfo = null;
    isClerkLoaded = false;
    authenticationListener = null;

    constructor() {
        makeAutoObservable(this);
    }

    async initializeClerk(publishableKey) {
        if (this.clerk) return;
        
        this.clerk = new Clerk(publishableKey);
        try {
            await this.clerk.load({
                // Ajouter la configuration globale de Clerk
                navigate: (to) => false, // Empêcher la navigation automatique
                appearanceBrowser: {
                    baseTheme: undefined,
                    variables: {},
                    elements: {
                        formButtonPrimary: 'cursor-pointer',
                        card: 'rounded-lg shadow-md'
                    }
                }
            });
            
            runInAction(() => {
                this.isClerkLoaded = true;
                
                if (this.clerk.user) {
                    this.userInfo = this.transformUserInfo(this.clerk.user);
                }
            });
            
            this.setupAuthListener();
        } catch (error) {
            console.error("Error loading Clerk:", error);
        }
    }

    transformUserInfo(user) {
        if (!user) return null;
        return {
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            fullName: user.fullName,
            firstName: user.firstName,
            lastName: user.lastName
        };
    }

    setupAuthListener() {
        if (this.authenticationListener) {
            this.clerk.removeEventListener(this.authenticationListener);
        }

        this.authenticationListener = (event) => {
            runInAction(() => {
                this.userInfo = event.user ? this.transformUserInfo(event.user) : null;
            });
        };

        this.clerk.addListener(this.authenticationListener);
    }

    accessFeature(onAuthenticated, onUnauthenticated) {
        if (!this.clerk || !this.isClerkLoaded) {
            console.error("Clerk is not initialized");
            return;
        }

        if (this.userInfo) {
            onAuthenticated(this.userInfo);
            return;
        }

        if (this.clerk.user) {
            const userInfo = this.transformUserInfo(this.clerk.user);
            runInAction(() => {
                this.userInfo = userInfo;
            });
            onAuthenticated(userInfo);
            return;
        }

        let signInListener;
        let closeListener;

        const cleanup = () => {
            if (signInListener) {
                this.clerk.removeEventListener(signInListener);
            }
            if (closeListener) {
                this.clerk.removeEventListener(closeListener);
            }
        };

        signInListener = ({ user, session }) => {
            if (user && session) {
                const userInfo = this.transformUserInfo(user);
                runInAction(() => {
                    this.userInfo = userInfo;
                });
                onAuthenticated(userInfo);
                cleanup();
            }
        };

        closeListener = ({ status }) => {
            if (status === 'closed' && !this.clerk.user && typeof onUnauthenticated === 'function') {
                onUnauthenticated();
                cleanup();
            }
        };

        this.clerk.addListener(signInListener);
        this.clerk.addListener(closeListener);

        this.clerk.openSignIn({
            routing: 'virtual',
            afterSignInUrl: window.location.href,
            redirectUrl: window.location.href,
            appearance: {
                elements: {
                    formButtonPrimary: 'cursor-pointer',
                    card: 'rounded-lg shadow-md'
                }
            },
            signUpUrl: null,
            afterSignUpUrl: null,
            signInUrl: null,
            catchCallbackError: true,
            redirectUrlComplete: window.location.href,
            handleMagicLinkVerification: true,
            memorizeLastUsed: true,
            preventRedirect: true
        });
    }

    async logout() {
        if (!this.clerk) return;

        try {
            await this.clerk.signOut();
            
            if (this.authenticationListener) {
                this.clerk.removeEventListener(this.authenticationListener);
                this.authenticationListener = null;
            }

            runInAction(() => {
                this.userInfo = null;
            });

            this.cleanupData();
        } catch (error) {
            console.error("Error during sign-out:", error);
        }
    }

    cleanupData() {
        console.log("Cleaning up user data...");
    }
}

const authStore = new AuthStore();
export default authStore;