import { fetchUserGedcomFiles } from '../gedcom/gedcomFileHandler.js'; 
import { handleUploadAndPost } from '../downloads.js';
import { showGedcomFilesModal } from '../ui.js'
import authStore from '../stores/authStore.js'; // Centralized import of the authentication store

/**
 * Function to set up event listeners for protected features via the MobX store.
 *
 * @param {AuthStore} authStoreInstance - Instance of the MobX store for authentication.
 */
export function setupProtectedFeatureEventListeners(authStoreInstance) {
    console.log("Setting up protected feature event listeners.");

    // Select all elements with the class 'protected-feature'
    const protectedFeatureElements = document.querySelectorAll('.protected-feature');

    protectedFeatureElements.forEach(element => {
        element.addEventListener('click', async function (e) {
            e.preventDefault();
            const action = element.getAttribute('data-action');
            console.log(`Protected feature "${action}" clicked.`);

            // Use accessFeature via the MobX store to handle authentication
            authStoreInstance.accessFeature(
                async (userInfo) => {
                    // Case where the user is authenticated
                    console.log('User authenticated:', userInfo.id);  
                    switch (action) {
                        case 'fetchGedcomFiles':
                            try {
                                // Retrieve the list of files for the authenticated user
                                const files = await fetchUserGedcomFiles(userInfo.id);
                                if (files.length === 0) {
                                    window.alert('No files found for this user.');
                                } else {
                                    // Display the modal with the list of files
                                    showGedcomFilesModal(files, userInfo);
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

                        // Add other cases for other protected actions
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