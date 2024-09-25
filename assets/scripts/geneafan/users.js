export async function handleUserAuthentication(callback) {
    if (!Clerk.isReady()) {
        await Clerk.load(); // Assurez-vous que Clerk est chargé
    }

    const user = Clerk.user;

    const displaySignInForm = () => {
        console.log("Utilisateur non connecté. Affichage du formulaire de connexion.");

        // Afficher le formulaire de connexion dans 'dynamic-content'
        const dynamicContentDiv = document.getElementById('dynamic-content');
        dynamicContentDiv.innerHTML = '<div id="sign-in"></div>';
        Clerk.mountSignIn(document.getElementById('sign-in'));

        // Écouter les changements d'état d'authentification
        const listener = Clerk.addListener(({ session }) => {
            if (session) {
                const user = Clerk.user;
                const userInfo = {
                    id: user.id,
                    email: user.primaryEmailAddress?.emailAddress,
                    fullName: user.fullName,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    profileImageUrl: user.profileImageUrl,
                };
                dynamicContentDiv.innerHTML = ''; // Nettoyer le contenu dynamique
                callback(userInfo);
                Clerk.removeListener(listener);
            }
        });
    };

    if (user) {
        // L'utilisateur est connecté
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
        displaySignInForm();
    }
}
