import { fetchUserGedcomFiles } from '../gedcom/gedcomFileHandler.js'; 
import { handleUploadAndPost } from '../common/downloadManager.js';
import gedcomModalManager from '../gedcom/gedcomModalUtils';

/**
 * Function to set up event listeners for protected features via the MobX store.
 * Temporairement modifié pour permettre l'accès sans authentification.
 *
 * @param {AuthStore} authStoreInstance - Instance of the MobX store for authentication.
 */
export function setupProtectedFeatureEventListeners(authStoreInstance) {
    console.log("Setting up protected feature event listeners (authentication bypass enabled).");

    const protectedFeatureElements = document.querySelectorAll('.protected-feature');

    protectedFeatureElements.forEach(element => {
        element.addEventListener('click', async function (e) {
            e.preventDefault();
            const action = element.getAttribute('data-action');
            console.log(`Protected feature "${action}" clicked - authentication bypassed.`);

            // Créer un utilisateur temporaire pour les tests
            const tempUserInfo = {
                id: 'temp-user-' + Date.now(),
                email: 'temp@example.com',
                fullName: 'Temporary User',
                firstName: 'Temporary',
                lastName: 'User'
            };

            // Exécuter directement les actions sans passer par la vérification d'authentification
            try {
                switch (action) {
                    case 'fetchGedcomFiles':
                        try {
                            console.log('Fetching GEDCOM files with temporary user ID:', tempUserInfo.id);
                            const files = await fetchUserGedcomFiles(tempUserInfo.id);
                            if (files.length === 0) {
                                console.log('No files found for this temporary user.');
                                window.alert('No files found. This is expected in test mode.');
                            } else {
                                gedcomModalManager.showModal(files, tempUserInfo);
                            }
                        } catch (error) {
                            console.error('Error retrieving files:', error);
                            window.alert('An error occurred while retrieving GEDCOM files.');
                        }
                        break;

                    case 'downloadPdf':
                        console.log("Executing PDF download with temporary user:", tempUserInfo);
                        try {
                            const rootPersonName = document.querySelector('#root-person-select')?.value || 'Unknown';
                            handleUploadAndPost(rootPersonName, tempUserInfo.email);
                        } catch (error) {
                            console.error('Error downloading PDF:', error);
                            window.alert('An error occurred while downloading the PDF.');
                        }
                        break;

                    default:
                        console.warn(`Unrecognized action: ${action}`);
                }
            } catch (error) {
                console.error('Error executing protected feature:', error);
                window.alert('An error occurred while executing this feature.');
            }
        });
    });
}