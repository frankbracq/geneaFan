import { makeAutoObservable, runInAction } from './mobx-config';

class AuthStore {
    userInfo = null;
    isClerkLoaded = true; // Toujours true car nous n'utilisons plus Clerk directement
    isLoading = false;
    error = null;

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

    async checkAuthentication() {
        console.log('🔍 Vérification de l\'authentification en cours...');
        try {
            this.setLoading(true);
            
            // Détecter si nous sommes chargés via un proxy
            const isProxied = window.location.hostname !== 'genealogie.app';
            console.log(`🔍 Application chargée ${isProxied ? 'via proxy' : 'directement'}`);
            
            let apiUrl;
            if (isProxied) {
                apiUrl = './proxy-auth-info';
            } else {
                apiUrl = '/api/auth-info';
            }
            
            console.log('📡 Appel de l\'API auth-info à l\'URL:', apiUrl);
            const response = await fetch(apiUrl);
            
            console.log(`📥 Réponse reçue - Status: ${response.status}`);
            
            if (response.ok) {
                try {
                    const authData = await response.json();
                    console.log('📦 Données d\'authentification:', authData);
                    
                    if (authData.isAuthenticated && authData.userId && authData.email) {
                        // Mettre à jour l'état d'authentification
                        runInAction(() => {
                            this.userInfo = {
                                id: authData.userId,
                                email: authData.email,
                                fullName: authData.email.split('@')[0], // Fallback simple pour le nom
                            };
                        });
                        console.log('✅ Utilisateur authentifié:', this.userInfo);
                    } else {
                        console.log('🔒 Utilisateur non authentifié');
                    }
                } catch (parseError) {
                    console.error('❌ Erreur lors du parsing JSON:', parseError);
                    const textContent = await response.clone().text();
                    console.error('Contenu brut reçu:', textContent.substring(0, 500));
                }
            } else {
                console.error('❌ Erreur lors de la récupération des informations d\'authentification:', response.statusText);
            }
        } catch (error) {
            console.error('❌ Exception lors de la vérification de l\'authentification:', error);
            this.setError(error);
        } finally {
            this.setLoading(false);
            console.log('🏁 Vérification de l\'authentification terminée - État actuel:', this.isAuthenticated ? 'Authentifié' : 'Non authentifié');
        }
    }

    // Cette méthode est appelée lorsqu'un utilisateur tente d'accéder à une fonctionnalité protégée
    async accessFeature(onAuthenticated, onUnauthenticated) {
        console.log('🔒 Tentative d\'accès à une fonctionnalité protégée');
        
        if (this.userInfo) {
            console.log('✅ Accès autorisé pour l\'utilisateur:', this.userInfo.email);
            onAuthenticated(this.userInfo);
            return;
        }
    
        console.log('⚠️ Utilisateur non authentifié, affichage de l\'interface de connexion');
        this.showSignInForm(null, onUnauthenticated);
    }

    // Cette méthode montre une interface pour inviter l'utilisateur à s'authentifier
    showSignInForm(clerk, onUnauthenticated) {
        console.log('🔑 Affichage du formulaire de connexion');
        
        // Rediriger vers FamilyStory.live pour l'authentification
        const currentUrl = encodeURIComponent(window.location.href);
        console.log('📌 URL actuelle pour le retour:', currentUrl);
        
        // Afficher une modale d'authentification ou rediriger
        const redirectToAuth = confirm("Cette fonctionnalité nécessite une authentification. Souhaitez-vous vous connecter?");
        
        if (redirectToAuth) {
            console.log('➡️ Redirection vers la page d\'authentification');
            window.location.href = `https://familystory.live/auth?returnUrl=${currentUrl}`;
        } else {
            console.log('❌ Authentification annulée par l\'utilisateur');
            if (onUnauthenticated) {
                onUnauthenticated();
            }
        }
    }

    // Méthode pour vérifier si l'utilisateur est authentifié
    get isAuthenticated() {
        return !!this.userInfo;
    }
}

const authStore = new AuthStore();
export default authStore;