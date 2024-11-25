import { Modal } from 'bootstrap';
import _ from 'lodash';
import Uppy from '@uppy/core';
import AwsS3 from '@uppy/aws-s3';
import configStore from '../stores/fanConfigStore.js';
import rootPersonStore from '../stores/rootPersonStore.js'; // Nouveau import
import authStore from '../stores/authStore.js';
import gedcomDataStore from '../stores/gedcomDataStore.js';
import familyTownsStore from '../stores/familyTownsStore.js'; // Nouveau import
import {
    clearAllStates,
} from "../stores/state.js";
import {
    updateFamilyTownsViaProxy,
    updateIndividualTownsFromFamilyTowns,
} from "../utils/utils.js";
import { toJson, getAllPlaces, getIndividualsList } from "../parse.js";
import { setupPersonLinkEventListener } from "../listeners/eventListeners.js";
import { googleMapsStore } from '../stores/googleMapsStore.js';
import { resetUI } from '../ui.js';

/* Code to manage the upload of GEDCOM files to Cloudflare R2*/
let isLoadingFile = false;
let gedcomFileName = "";

let currentModal = null;

const MODAL_STEPS = {
    SAVE_REQUEST: {
        title: 'Enregistrer le fichier',
        content: `
            <div class="modal-body">
                Voulez-vous enregistrer votre fichier pour un usage ultérieur ?
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-action="no">Non</button>
                <button type="button" class="btn btn-primary" data-action="yes">Oui</button>
            </div>
        `
    },
    FAMILY_NAME: {
        title: 'Nom de la famille',
        content: `
            <form id="familyNameForm">
                <div class="modal-body">
                    À quelle famille correspond votre fichier Gedcom ?
                    <input type="text" class="form-control" id="familyNameInput" required>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
            </form>
        `
    },
    UPLOAD_SUCCESS: {
        title: 'Téléchargement terminé',
        content: `
            <div class="modal-body">
                Votre fichier a été enregistré avec succès !
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" data-action="close">Fermer</button>
            </div>
        `
    },
    UPLOADING: {
        title: 'Téléchargement en cours',
        content: `
            <div class="modal-body">
                <div class="text-center">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Chargement...</span>
                    </div>
                    <p class="mt-2">Téléchargement de votre fichier en cours...</p>
                </div>
            </div>
        `
    }
};

function showModal(step, handlers = {}) {
    if (!currentModal) {
        const modalContent = document.createElement('div');
        modalContent.innerHTML = `
        <div class="modal fade" id="gedcomModal" tabindex="-1" aria-labelledby="gedcomModalLabel" aria-hidden="true">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
                    </div>
                    <div id="modalStepContent"></div>
                </div>
            </div>
        </div>
        `;
        document.body.appendChild(modalContent);

        const modalElement = document.getElementById('gedcomModal');
        currentModal = new Modal(modalElement, {
            backdrop: 'static',
            keyboard: false
        });
    }

    const modalElement = document.getElementById('gedcomModal');
    const stepConfig = MODAL_STEPS[step];

    modalElement.querySelector('.modal-title').textContent = stepConfig.title;
    modalElement.querySelector('#modalStepContent').innerHTML = stepConfig.content;

    // Détacher les anciens gestionnaires d'événements
    const oldContent = modalElement.querySelector('#modalStepContent');
    const newContent = oldContent.cloneNode(true);
    oldContent.parentNode.replaceChild(newContent, oldContent);

    // Attach handlers
    Object.entries(handlers).forEach(([selector, handler]) => {
        const element = modalElement.querySelector(selector);
        if (element) {
            if (selector === 'form') {
                element.onsubmit = (e) => {
                    e.preventDefault();
                    handler(e);
                };
            } else {
                element.onclick = handler;
            }
        }
    });

    if (!currentModal.isShown) {
        currentModal.show();
    }
}

function closeModal() {
    if (currentModal) {
        currentModal.hide();
        document.getElementById('gedcomModal').remove();
        currentModal = null;
    }
}

export function loadGedcomFile(input) {
    console.log("Chargement du fichier:", input);
    if (isLoadingFile) {
        console.log("Un chargement de fichier est déjà en cours.");
        return;
    }
    isLoadingFile = true;

    if (typeof input === 'string') {
        // Load remote file
        const xhr = new XMLHttpRequest();
        xhr.open("GET", input, true);
        xhr.responseType = "arraybuffer";

        xhr.onload = function (e) {
            isLoadingFile = false;
            if (this.status === 200) {
                const data = xhr.response;

                // Extract the file name from the URL
                gedcomFileName = input.split("/").pop();
                configStore.setGedcomFileName(gedcomFileName); // Update the store

                onFileChange(data);
            } else {
                console.error("Erreur lors du chargement du fichier :", this.status);
                window.alert(__("geneafan.cannot_read_this_file"));
            }
        };

        xhr.onerror = function (e) {
            isLoadingFile = false;
            console.error("Erreur réseau lors du chargement du fichier.");
            window.alert(__("geneafan.cannot_read_this_file"));
        };

        xhr.send();
    } else {
        // Load local file
        const file = input[0];
        console.log("Fichier local:", file);
        gedcomFileName = file.name;
        configStore.setGedcomFileName(gedcomFileName);

        // Show modal to ask if the user wants to save the file
        showSaveFileModal(file);
    }
}

function showSaveFileModal(file) {
    showModal('SAVE_REQUEST', {
        '[data-action="no"]': () => {
            closeModal();
            readAndProcessGedcomFile(file);
        },
        '[data-action="yes"]': () => {
            authStore.accessFeature(
                (userInfo) => {
                    // Ne pas fermer la modale, juste changer son contenu
                    showFamilyNameModal(file, userInfo);
                },
                () => {
                    window.alert('Vous devez être authentifié pour enregistrer le fichier.');
                    closeModal();
                    readAndProcessGedcomFile(file);
                }
            );
        }
    });
}

function showFamilyNameModal(file, userInfo) {
    showModal('FAMILY_NAME', {
        'form': (event) => {
            const familyName = document.getElementById('familyNameInput').value.trim();
            if (familyName) {
                // Afficher l'état "uploading" avant de commencer l'upload
                showModal('UPLOADING');
                saveGedcomFile(file, familyName, userInfo);
            } else {
                alert('Veuillez entrer le nom de la famille.');
            }
        }
    });
}

// Function to save the Gedcom file in the R2 gedcom-files bucket
async function saveGedcomFile(file, familyName, userInfo) {
    const clerkId = userInfo.id;
    if (!clerkId) {
        alert('Impossible de récupérer votre identifiant utilisateur.');
        closeModal();
        readAndProcessGedcomFile(file);
        return;
    }

    const newFileName = `${clerkId}_fam_${familyName}.ged`;
    console.log('New file name:', newFileName);

    try {
        // Initialize Uppy for file upload with a signed URL
        const uppy = new Uppy({
            autoProceed: true,
        });

        uppy.use(AwsS3, {
            async getUploadParameters(file) {
                // Fetch signed URL from Vercel API
                const response = await fetch('https://generate-signed-url.vercel.app/api/generate-signed-url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        filename: newFileName,
                        contentType: file.type,
                        operation: 'upload', // Specify the operation
                    }),
                });

                if (!response.ok) {
                    throw new Error('Error fetching the signed URL.');
                }

                const data = await response.json();
                console.log('Signed URL received:', data.url);

                // Return signed URL for upload
                return {
                    method: 'PUT',
                    url: data.url, // Signed URL obtained from Vercel
                    headers: {
                        'Content-Type': file.type,
                    },
                };
            },
        });

        // Add file to Uppy
        uppy.addFile({
            name: newFileName,
            type: file.type,
            data: file, // Blob/File to upload
        });

        // Wait for the upload to complete
        const uploadResult = await uppy.upload();
        console.log('Upload completed:', uploadResult);

        if (uploadResult.failed.length === 0) {
            console.log('File successfully uploaded.');

            // Prepare the body for the fetch request
            const body = JSON.stringify({
                filename: newFileName,
                userId: clerkId
            });

            // Log the body before making the fetch request
            // console.log('Worker :', body);

            // After upload, store the file metadata in the Cloudflare Worker KV
            const workerResponse = await fetch('https://user-file-access.genealogie.app/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body
            });

            if (!workerResponse.ok) {
                throw new Error('Error saving file metadata to Worker KV.');
            }

            console.log('File metadata saved in Worker KV.');
            showModal('UPLOAD_SUCCESS', {
                '[data-action="close"]': () => {
                    closeModal();
                    readAndProcessGedcomFile(file);
                }
            });

        } else {
            console.error('File upload failed:', uploadResult.failed);
            alert('Error during file upload.');
            closeModal();
        }

    } catch (error) {
        console.error('Error during file saving:', error);
        alert('Error during file upload.');
        closeModal();
    }
}

// Function to fetch the list of Gedcom files for the current user
export async function fetchUserGedcomFiles(userId) {
    console.log('Fetching user Gedcom files for user:', userId);
    try {
        const response = await fetch('https://user-file-access.genealogie.app/list-files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId })
        });

        if (!response.ok) {
            if (response.status === 404) {
                return [];
            } else {
                throw new Error('Erreur lors de la récupération des fichiers.');
            }
        }

        const data = await response.json();
        const files = data.files.map(file => ({
            id: file.id,
            name: file.name,
            signedUrl: file.signedUrl,
            status: file.status // 'owned' ou 'authorized'
        }));
        return files;
    } catch (error) {
        console.error('Erreur lors de la récupération des fichiers GEDCOM :', error);
        return [];
    }
}

function readAndProcessGedcomFile(file) {
    console.log('Reading and processing file:', file);
    isLoadingFile = true;
    const reader = new FileReader();

    reader.addEventListener("loadend", function () {
        isLoadingFile = false;
        const data = reader.result;

        // Continuer avec la logique de l'application
        onFileChange(data);
    });

    reader.readAsArrayBuffer(file);
}

function findYoungestIndividual(individuals) {
    const individualsWithBirthDates = individuals.map((individual) => {
        const birthDate = individual.birthDate;
        let date;
        if (birthDate.includes("/")) {
            const [day, month, year] = birthDate.split("/").reverse();
            date = new Date(year, month - 1, day || 1);
        } else {
            date = new Date(birthDate, 0, 1);
        }

        return {
            id: individual.id,
            birthDate: date,
        };
    });

    return _.maxBy(individualsWithBirthDates, "birthDate");
}

async function onFileChange(data) {
    handleTabsAndOverlay(true);

    clearAllStates();
    gedcomDataStore.clearAllState();

    if (gedcomDataStore.getFileUploaded()) {
        resetUI();
    }
    gedcomDataStore.setFileUploaded(true);

    try {
        // Remplacer setFamilyTowns par
        familyTownsStore.setTownsData({});

        let json = toJson(data);
        let result = await getAllPlaces(json);
        gedcomDataStore.setSourceData(result.json);

        try {
            await updateFamilyTownsViaProxy();
            updateIndividualTownsFromFamilyTowns(gedcomDataStore.getIndividualsCache());
            gedcomDataStore.setIndividualsCache(gedcomDataStore.getIndividualsCache());
        } catch (error) {
            console.error("Error updating geolocation:", error);
        }

        Object.entries(familyTownsStore.getAllTowns()).forEach(([key, town]) => {
            if (googleMapsStore.isValidCoordinate(town.latitude) && googleMapsStore.isValidCoordinate(town.longitude)) {
                googleMapsStore.addMarker(key, town);
            }
        });

        const selectElement = document.getElementById("individual-select");
        selectElement.innerHTML = "";
        const placeholderOption = new Option("", "", true, true);
        placeholderOption.disabled = true;
        selectElement.appendChild(placeholderOption);

        let tomSelect = rootPersonStore.tomSelect; // Utiliser rootPersonStore
        if (!tomSelect) {
            rootPersonStore.initializeTomSelect(); // Utiliser rootPersonStore
            tomSelect = rootPersonStore.tomSelect;
        }

        tomSelect.clearOptions();

        result = getIndividualsList(result.json);
        let individuals = result.individualsList;
        individuals.forEach((individual) => {
            tomSelect.addOption({
                value: individual.id,
                text: `${individual.surname} ${individual.name} ${individual.id} ${individual.birthYear ? individual.birthYear : "?"
                    }-${individual.deathYear ? individual.deathYear : ""}`,
            });
        });

        let rootId;
        const gedcomFileName = configStore.getConfig.gedcomFileName;
        rootId = (gedcomFileName === "demo.ged") ? "@I111@" : findYoungestIndividual(individuals)?.id;

        // Mise à jour du root et du nom
        const rootPerson = individuals.find((individual) => individual.id === rootId);
        if (rootPerson) {
            rootPersonStore.setRoot(rootId); // Utiliser rootPersonStore
            rootPersonStore.setRootPersonName({ // Utiliser rootPersonStore
                name: rootPerson.name,
                surname: rootPerson.surname,
            });
            rootPersonStore.setTomSelectValue(rootId); // Utiliser rootPersonStore
        }

        [
            ...document.querySelectorAll(".parameter"),
            document.getElementById("individual-select"),
            document.getElementById("download-menu"),
            document.getElementById("fanParametersDisplay"),
            document.getElementById("treeParametersDisplay"),
            document.getElementById("fullscreenButton"),
        ].forEach((el) => {
            el.disabled = false;
        });

    } catch (error) {
        console.error("General Error:", error);
    } finally {
        handleTabsAndOverlay(false);
        setupPersonLinkEventListener();
    }
}

function handleTabsAndOverlay(shouldShowLoading) {
    const tabsToDisable = ["tab2", "tab3", "tab4"];
    tabsToDisable.forEach(tabId => {
        const tabLink = document.querySelector(`a[href="#${tabId}"]`);
        if (tabLink) {
            tabLink.classList.toggle('disabled', shouldShowLoading);
            tabLink.setAttribute('aria-disabled', shouldShowLoading ? 'true' : 'false');
            tabLink.setAttribute('tabindex', shouldShowLoading ? '-1' : '0');
        }
    });

    if (shouldShowLoading) {
        document.getElementById('overlay').classList.remove('overlay-hidden');
        document.querySelector('a[href="#tab1"]').click(); // Force l'affichage de tab1
        document.getElementById("loading").style.display = "block";
    } else {
        document.getElementById("loading").style.display = "none";
        document.getElementById("overlay").classList.add("overlay-hidden");
    }
}

export { onFileChange }; // Add this export