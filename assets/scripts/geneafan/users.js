import authStore from "./stores/authStore";

/**
 * Function to access a protected feature within the application.
 * It checks if the user is authenticated and, if so, executes the authenticated callback.
 * Otherwise, it executes the unauthenticated callback.
 *
 * @param {Clerk} clerk - Initialized Clerk instance.
 * @param {Function} onAuthenticated - Function to execute if the user is authenticated.
 * @param {Function} [onUnauthenticated] - Function to execute if the user is not authenticated.
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
                // By default, display the sign-in form
                showSignInForm(clerk);
            }
        }
    });
}

/**
 * Function to handle user authentication.
 * It checks if Clerk is ready, retrieves the current user, and executes the callback with user information.
 *
 * @param {Clerk} clerk - Initialized Clerk instance.
 * @param {Function} callback - Function to execute with user information or null.
 * @returns {Function} - Cleanup function to remove the authentication listener.
 */
let authenticationListener = null;

export async function handleUserAuthentication(clerk, callback) {
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
        if (authenticationListener) {
            clerk.removeListener(authenticationListener);
            authenticationListener = null;
        }

        // Add listener for authentication changes
        authenticationListener = clerk.addListener(({ session }) => {
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
 * Function to display the sign-in form
 *
 * @param {Clerk} clerk - Initialized Clerk instance.
 * @param {Function} [onUnauthenticated] - Callback to execute if the user closes the modal without authenticating.
 */
export function showSignInForm(clerk, onUnauthenticated) {
    console.log("Displaying the sign-in form with clerk.openSignIn().");

    // Variable to store the unsubscribe function
    let unsubscribe;

    // Function to handle the overlay close event (function declaration)
    function handleOverlayClose(event) {
        console.log("The sign-in component has been closed.");
        if (!clerk.user && typeof onUnauthenticated === 'function') {
            console.log("The user is not authenticated. Executing onUnauthenticated.");
            onUnauthenticated();
        } else {
            console.log("The user is authenticated.");
        }
        // Remove the listener by calling unsubscribe()
        if (unsubscribe) {
            unsubscribe();
        }
    }

    // Assign the unsubscribe function
    unsubscribe = clerk.addListener(({ openSignIn, ...arg }) => {
        if (!openSignIn) {
            handleOverlayClose();
        }
    });

    // We need to override the `clerk.navigate` for skip refresh with `/` path,
    // routing: 'virtual' doesn't work in plain JS implementation, because
    // `virtual` need for sending path to react-route (for example) and react-router skip
    // re-render, if this re-render unnecessary
    clerk.navigate = () => {
        const signInButton = document.getElementById('sign-in-button');
        const userButtonDiv = document.getElementById('user-button');

        signInButton.style.display = 'none';
        userButtonDiv.style.display = 'block';

        // Mount the Clerk UserButton if not already mounted
        if (!userButtonDiv.hasChildNodes()) {
            clerk.mountUserButton(userButtonDiv);

            clerk.navigate = () => {
                onUnauthenticated?.()
                signInButton.style.display = 'block';
                userButtonDiv.style.display = 'none';
            }
        }
    }

    clerk.openSignIn();
}

/**
 * Function to handle user logout.
 *
 * @param {Clerk} clerk - Initialized Clerk instance.
 */
export async function handleLogout(clerk) {
    try {
        await clerk.signOut();
        console.log("User has been signed out.");
    } catch (error) {
        console.error("Error during sign-out:", error);
    }
}
