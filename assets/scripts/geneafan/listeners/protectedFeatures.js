import { fetchUserGedcomFiles } from '../gedcom/gedcomFileHandler.js'; 
import { handleUploadAndPost } from '../common/downloadManager.js';
import gedcomModalManager from '../gedcom/gedcomModalUtils';

/**
 * Function to set up event listeners for protected features via the MobX store.
 *
 * @param {AuthStore} authStoreInstance - Instance of the MobX store for authentication.
 */
export function setupProtectedFeatureEventListeners(authStoreInstance) {
    console.log("Setting up protected feature event listeners.");

    const protectedFeatureElements = document.querySelectorAll('.protected-feature');

    protectedFeatureElements.forEach(element => {
        element.addEventListener('click', async function (e) {
            e.preventDefault();
            const action = element.getAttribute('data-action');
            console.log(`Protected feature "${action}" clicked.`);

            authStoreInstance.accessFeature(
                async (userInfo) => {
                    console.log('User authenticated:', userInfo.id);  
                    switch (action) {
                        case 'fetchGedcomFiles':
                            try {
                                const files = await fetchUserGedcomFiles(userInfo.id);
                                if (files.length === 0) {
                                    window.alert('No files found for this user.');
                                } else {
                                    // Utiliser le nouveau gestionnaire modal
                                    gedcomModalManager.showModal(files, userInfo);
                                }
                            } catch (error) {
                                console.error('Error retrieving files:', error);
                                window.alert('An error occurred while retrieving your GEDCOM files.');
                            }
                            break;

                        case 'downloadPdf':
                            console.log("Accessing protected feature with userInfo:", userInfo);
                            handleUploadAndPost(rootPersonName, userInfo.email);
                            break;

                        default:
                            console.warn(`Unrecognized action: ${action}`);
                    }
                }, 
                () => {
                    // Case where the user is not authenticated
                    // Actions handled by AuthStore
                }
            );
        });
    });
}