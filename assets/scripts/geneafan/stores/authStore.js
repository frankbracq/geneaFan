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
            await this.clerk.load();
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
            this.clerk.removeListener(this.authenticationListener);
        }

        this.authenticationListener = this.clerk.addListener(({ user }) => {
            runInAction(() => {
                this.userInfo = this.transformUserInfo(user);
            });
        });
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

        this.clerk.openSignIn({
            routing: 'virtual',
            afterSignInUrl: null,
            redirectUrl: null,
            appearance: {
                elements: {
                    formButtonPrimary: 'cursor-pointer',
                    card: 'rounded-lg shadow-md'
                }
            }
        });

        const authListener = ({ user, session }) => {
            if (user && session) {
                onAuthenticated(this.transformUserInfo(user));
                this.clerk.removeListener(authListener);
            }
        };

        const closeListener = ({ openSignIn }) => {
            if (!openSignIn && !this.clerk.user && typeof onUnauthenticated === 'function') {
                onUnauthenticated();
                this.clerk.removeListener(closeListener);
            }
        };

        this.clerk.addListener(authListener);
        this.clerk.addListener(closeListener);
    }

    async logout() {
        if (!this.clerk) return;

        try {
            await this.clerk.signOut();
            
            if (this.authenticationListener) {
                this.clerk.removeListener(this.authenticationListener);
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