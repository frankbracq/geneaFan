import { accessProtectedFeature } from './users.js'; 
import { fetchUserGedcomFiles } from './uploads.js'; 
import { handleUploadAndPost } from './downloads.js';
import { showGedcomFilesModal } from './ui.js'
/**
 * Fonction pour configurer l'écouteur d'événements via Event Delegation pour les fonctionnalités protégées.
 *
 * @param {Clerk} clerk - Instance de Clerk initialisée.
 * @param {HTMLElement} parentElement - Élément parent pour déléguer les événements (par exemple, '#menu').
 */
export function setupProtectedFeatureEventListeners(clerk, parentElement = document) {
    console.log("Setting up protected feature event listeners via Event Delegation.");

    parentElement.addEventListener('click', async function (e) {
        // Utilisez closest pour trouver l'élément avec la classe 'protected-feature'
        const target = e.target.closest('.protected-feature');
        if (!target) return; // Si ce n'est pas un élément protégé, ignorer

        e.preventDefault();
        const action = target.getAttribute('data-action');
        console.log(`Protected feature "${action}" clicked.`);

        // Utilise accessProtectedFeature pour gérer l'authentification
        accessProtectedFeature(clerk, async (userInfo) => {
            if (!userInfo) {
                // L'utilisateur n'est pas authentifié et le formulaire de connexion est affiché
                return;
            }

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
        });
    });
}
