import { fetchUserGedcomFiles } from '../gedcom/gedcomFileHandler.js'; 
import { handleUploadAndPost } from '../downloads.js';
import { showGedcomFilesModal } from '../ui.js'

/**
 * Fonction pour configurer les écouteurs d'événements pour les fonctionnalités protégées via le store MobX.
 *
 * @param {AuthStore} authStore - Instance du store MobX pour l'authentification.
 */
export function setupProtectedFeatureEventListeners(authStore) {
    console.log("Setting up protected feature event listeners.");

    // Sélectionne tous les éléments avec la classe 'protected-feature'
    const protectedFeatureElements = document.querySelectorAll('.protected-feature');

    protectedFeatureElements.forEach(element => {
        element.addEventListener('click', async function (e) {
            e.preventDefault();
            const action = element.getAttribute('data-action');
            console.log(`Protected feature "${action}" clicked.`);

            // Utilise accessFeature via le store MobX pour gérer l'authentification
            authStore.accessFeature(
                async (userInfo) => {
                    // Cas où l'utilisateur est authentifié
                    console.log('Utilisateur authentifié:', userInfo.id);  
                    switch (action) {
                        case 'fetchGedcomFiles':
                            try {
                                // Récupère la liste des fichiers pour l'utilisateur authentifié
                                const files = await fetchUserGedcomFiles(userInfo.id);
                                if (files.length === 0) {
                                    window.alert('Aucun fichier trouvé pour cet utilisateur.');
                                } else {
                                    // Affiche la modal avec la liste des fichiers
                                    showGedcomFilesModal(files, userInfo);
                                }
                            } catch (error) {
                                console.error('Erreur lors de la récupération des fichiers:', error);
                                window.alert('Une erreur est survenue lors de la récupération de vos fichiers GEDCOM.');
                            }
                            break;

                        case 'downloadPdf':
                            console.log("Accessing protected feature with userInfo:", userInfo);
                            handleUploadAndPost(rootPersonName, userInfo.email);
                            break;

                        // Ajoutez d'autres cas pour d'autres actions protégées
                        default:
                            console.warn(`Action non reconnue: ${action}`);
                    }
                }, 
                () => {
                    // Cas où l'utilisateur n'est pas authentifié
                    // Vous pouvez ajouter des actions spécifiques si nécessaire
                    // Par défaut, le formulaire de connexion est déjà affiché via accessFeature
                }
            );
        });
    });
}