export async function handleUserAuthentication(callback) {
    if (Clerk.user) {
        // Si l'utilisateur est connecté, récupérer les informations de l'utilisateur
        const user = Clerk.user;
        const userInfo = {
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress, // Récupérer l'email principal
            fullName: user.fullName,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            // Ajouter d'autres informations si nécessaires
        };
        await callback(userInfo); // Passer les informations de l'utilisateur au callback
        return userInfo; // Retourner les informations de l'utilisateur
    } else {
        console.log("Clerk n'est pas prêt. Vérification toutes les 100ms.");
        // Utilisation d'un intervalle pour vérifier si Clerk est prêt
        const checkClerkReady = setInterval(() => {
            if (Clerk.isReady()) {
                clearInterval(checkClerkReady); // Stop the interval once Clerk is ready
                document.getElementById('app').innerHTML = `
                    <div id="sign-in"></div>
                `;
                const signInDiv = document.getElementById('sign-in');
                Clerk.mountSignIn(signInDiv);
                
                // Ajouter un écouteur pour la connexion réussie
                Clerk.addListener("signed-in", async () => {
                    const user = Clerk.user;
                    const userInfo = {
                        id: user.id,
                        email: user.primaryEmailAddress?.emailAddress,
                        fullName: user.fullName,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        profileImageUrl: user.profileImageUrl,
                        // Ajouter d'autres informations si nécessaires
                    };
                    await callback(userInfo); // Passer les informations de l'utilisateur au callback après la connexion
                    return userInfo; // Retourner les informations de l'utilisateur après la connexion
                });
            }
        }, 100); // Vérifie toutes les 100ms
    }
}