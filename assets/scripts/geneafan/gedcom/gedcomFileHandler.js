import { Modal } from 'bootstrap';
import _ from 'lodash';
import Uppy from '@uppy/core';
import AwsS3 from '@uppy/aws-s3';
import configStore from '../tabs/fanChart/fanConfigStore.js';
import rootPersonStore from '../common/stores/rootPersonStore.js';
import authStore from '../common/stores/authStore.js';
import gedcomDataStore from './stores/gedcomDataStore.js';
import familyTownsStore from '../tabs/familyMap/stores/familyTownsStore.js';
import { FanChartManager } from '../tabs/fanChart/fanChartManager.js';
import {
    clearAllStates,
} from "../common/stores/state.js";
import {
    updateIndividualTownsFromFamilyTowns,
} from "../utils/utils.js";
import { toJson, getIndividualsList } from "./parse.js";
import { placeProcessor } from './processors/placeProcessor.js';
import { setupPersonLinkEventListener } from "../listeners/eventListeners.js";
import { googleMapsStore } from '../tabs/familyMap/stores/googleMapsStore.js';
import { storeEvents, EVENTS } from '../common/stores/storeEvents.js';
import overlayManager from '../utils/OverlayManager.js';

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

    // Afficher l'overlay global pendant le chargement du fichier
    overlayManager.showGlobal("Chargement du fichier GEDCOM...");

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
                overlayManager.hideGlobal();
                window.alert(__("geneafan.cannot_read_this_file"));
            }
        };

        xhr.onerror = function (e) {
            isLoadingFile = false;
            overlayManager.hideGlobal();
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

        // Masquer l'overlay global avant d'afficher la modale
        overlayManager.hideGlobal(300);
        
        // Show modal to ask if the user wants to save the file
        setTimeout(() => {
            showSaveFileModal(file);
        }, 300);
    }
}

// Modification de la fonction showSaveFileModal pour contourner l'authentification
function showSaveFileModal(file) {
    showModal('SAVE_REQUEST', {
        '[data-action="no"]': () => {
            closeModal();
            readAndProcessGedcomFile(file);
        },
        '[data-action="yes"]': () => {
            // Créer un utilisateur factice pour les tests
            const mockUserInfo = {
                id: 'mock-user-' + Date.now(),
                email: 'test@example.com',
                fullName: 'Test User',
                firstName: 'Test',
                lastName: 'User'
            };
            
            // Continuer directement avec l'utilisateur factice
            showFamilyNameModal(file, mockUserInfo);
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
// Modification de la fonction saveGedcomFile pour simuler la sauvegarde
async function saveGedcomFile(file, familyName, userInfo) {
    // Afficher une modale "Uploading" pour simulation
    showModal('UPLOADING');
    
    // Simuler un délai d'upload
    setTimeout(() => {
        console.log('Mock file save:', {
            fileName: `${userInfo.id}_fam_${familyName}.ged`,
            familyName: familyName,
            userId: userInfo.id
        });
        
        // Afficher un message de succès
        showModal('UPLOAD_SUCCESS', {
            '[data-action="close"]': () => {
                closeModal();
                readAndProcessGedcomFile(file);
            }
        });
    }, 1500); // Simuler un délai de 1.5s pour l'upload
    
    /* Décommentez pour utiliser le code réel avec l'utilisateur factice
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
        // ... reste du code original ...
    } catch (error) {
        console.error('Error during file saving:', error);
        alert('Error during file upload.');
        closeModal();
    }
    */
}

// Function to fetch the list of Gedcom files for the current user
// Modification de la fonction fetchUserGedcomFiles pour utiliser un ID fixe ou retourner des données factices
export async function fetchUserGedcomFiles(userId) {
    console.log('Fetching user Gedcom files with test userId:', userId);
    
    // Option 1: Retourner des données factices pour les tests
    return [
        {
            id: 'mock-file-1',
            name: 'Exemple_Famille_Martin.ged',
            signedUrl: '#', // URL factice, sera remplacée par l'implémentation réelle
            status: 'owned'
        },
        {
            id: 'mock-file-2',
            name: 'Exemple_Famille_Durand.ged',
            signedUrl: '#',
            status: 'owned'
        }
    ];
    
    /* Décommentez ce bloc pour tester avec l'API réelle (en utilisant un ID fixe)
    try {
        // Utiliser un ID utilisateur fixe pour les tests
        const testUserId = 'test-user-123'; // ID de test fixe
        
        const response = await fetch('https://user-file-access.genealogie.app/list-files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: testUserId })
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
            status: file.status
        }));
        return files;
    } catch (error) {
        console.error('Erreur lors de la récupération des fichiers GEDCOM :', error);
        return [];
    }
    */
}

function readAndProcessGedcomFile(file) {
    console.log('Reading and processing file:', file);
    isLoadingFile = true;
    
    // Afficher l'overlay global avec un message explicite
    overlayManager.showGlobal("Lecture du fichier GEDCOM...");
    
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
    // Filter out individuals without birth dates first
    const individualsWithBirthDates = individuals
        .filter(individual => individual && individual.birthDate)
        .map((individual) => {
            const birthDate = individual.birthDate;
            let date;

            try {
                if (birthDate.includes("/")) {
                    const [day, month, year] = birthDate.split("/").reverse();
                    // Ensure we have valid numbers for the date
                    if (year && !isNaN(year)) {
                        date = new Date(parseInt(year), (month ? parseInt(month) - 1 : 0), day ? parseInt(day) : 1);
                    } else {
                        return null;
                    }
                } else if (birthDate && !isNaN(birthDate)) {
                    // If birthDate is just a year
                    date = new Date(parseInt(birthDate), 0, 1);
                } else {
                    return null;
                }

                // Validate that we got a valid date
                if (isNaN(date.getTime())) {
                    return null;
                }

                return {
                    id: individual.id,
                    birthDate: date,
                };
            } catch (error) {
                console.warn(`Error processing birth date for individual ${individual.id}:`, error);
                return null;
            }
        })
        .filter(Boolean); // Remove any null entries

    // If no valid individuals found, return null
    if (individualsWithBirthDates.length === 0) {
        return null;
    }

    return _.maxBy(individualsWithBirthDates, "birthDate");
}

async function resetUIForNewGedcom() {
    console.log("Resetting UI for new GEDCOM file.");
    const parametersElements = document.querySelectorAll(".parameter");
    const individualSelectElement = document.getElementById("individual-select");
    const downloadMenuElement = document.getElementById("download-menu");
    const fanParametersDisplayElement = document.getElementById("fanParametersDisplay");
    const treeParametersDisplayElement = document.getElementById("treeParametersDisplay");
    const fullscreenButtonElement = document.getElementById("fullscreenButton");

    // Remove event listeners
    [...parametersElements, individualSelectElement].forEach((element) => {
        if (element) {
            element.removeEventListener("change", configStore.handleSettingChange);
        }
    });

    // Reset select elements
    if (individualSelectElement) {
        individualSelectElement.innerHTML = "";
    }

    let tomSelect = rootPersonStore.tomSelect;
    if (tomSelect) {
        tomSelect.clearOptions();
        tomSelect.clear();
    }

    // Reset fan chart
    await FanChartManager.reset();

    // Reset stores
    familyTownsStore.setTownsData({});
    googleMapsStore.clearMap();

    // Disable UI elements
    [
        downloadMenuElement,
        fanParametersDisplayElement,
        treeParametersDisplayElement,
        fullscreenButtonElement,
    ].forEach((el) => {
        if (el) el.disabled = true;
    });

    // Re-add event listeners
    [...parametersElements, individualSelectElement].forEach((element) => {
        if (element) {
            element.addEventListener("change", configStore.handleSettingChange);
        }
    });

    rootPersonStore.resetHistory();
}

async function onFileChange(data) {
    // Utiliser l'overlay global pour indiquer le début du traitement
    overlayManager.showGlobal('Lecture du fichier GEDCOM...');
    
    // Informer les autres composants du début du traitement
    storeEvents.emit(EVENTS.PROCESS.START, 'Lecture du fichier GEDCOM...');
    
    // Désactiver les onglets et ajuster l'UI
    handleTabsAndOverlay(true);
    
    // Nettoyer les états
    clearAllStates();
    gedcomDataStore.clearAllState();

    try {
        // Réinitialiser l'UI
        await resetUIForNewGedcom();
        gedcomDataStore.setFileUploaded(true);

        // Réinitialiser les données des villes
        familyTownsStore.setTownsData({});

        // Mise à jour du message de l'overlay
        overlayManager.showGlobal('Analyse du fichier...');
        storeEvents.emit(EVENTS.PROCESS.START, 'Analyse du fichier...');
        
        // Traiter le fichier GEDCOM
        let json = toJson(data);

        // Mise à jour du message pour le géocodage
        overlayManager.showGlobal('Validation du géocodage des villes...');
        storeEvents.emit(EVENTS.PROCESS.START, 'Validation du géocodage des villes...');
        
        // Processus de géocodage
        let sourceData = await placeProcessor.processGedcomTowns(json);

        // Mise à jour du message pour la construction des données
        overlayManager.showGlobal('Construction des données...');
        storeEvents.emit(EVENTS.PROCESS.START, 'Construction des données...');
        
        // Enregistrer les données source
        gedcomDataStore.setSourceData(sourceData.json);

        // Finalisation
        overlayManager.showGlobal('Finalisation...');
        storeEvents.emit(EVENTS.PROCESS.START, 'Finalisation...');
        
        // Mettre à jour les données des individus
        updateIndividualTownsFromFamilyTowns(gedcomDataStore.getIndividualsCache());

        console.log("Individuals cache updated:", gedcomDataStore.getIndividualsCache());

        const selectElement = document.getElementById("individual-select");
        selectElement.innerHTML = "";
        const placeholderOption = new Option("", "", true, true);
        placeholderOption.disabled = true;
        selectElement.appendChild(placeholderOption);

        let tomSelect = rootPersonStore.tomSelect;
        if (!tomSelect) {
            // Initialiser seulement si ce n'est pas déjà fait (cas de secours)
            rootPersonStore.initializeTomSelect();
            tomSelect = rootPersonStore.tomSelect;
        } else {
            // Si déjà initialisé, nettoyer les options existantes
            tomSelect.clearOptions();
        }

        tomSelect.clearOptions();

        // Modifier cette partie pour gérer l'appel asynchrone
        let { individualsList } = await getIndividualsList();
        let individuals = individualsList;

        individuals.forEach((individual) => {
            tomSelect.addOption({
                value: individual.id,
                text: `${individual.surname} ${individual.name} ${individual.id} ${individual.birthYear ? individual.birthYear : "?"}-${individual.deathYear ? individual.deathYear : ""}`
            });
        });

        let rootId;
        const gedcomFileName = configStore.getConfig.gedcomFileName;
        if (gedcomFileName === "Arbre_Robin_Keller_7G_25-10-2023.ged") {
            rootId = "@I124@"; //@I111@"; 
        } else {
            const youngestPerson = findYoungestIndividual(individuals);
            rootId = youngestPerson ? youngestPerson.id : individuals[0]?.id;
        }

        // Mise à jour du root et du nom
        const rootPerson = individuals.find((individual) => individual.id === rootId);
        if (rootId) {
            const rootPerson = individuals.find((individual) => individual.id === rootId);
            if (rootPerson) {
                rootPersonStore.setRoot(rootId, { skipDraw: true });
                rootPersonStore.setRootPersonName({
                    name: rootPerson.name,
                    surname: rootPerson.surname,
                });
                rootPersonStore.setTomSelectValue(rootId);
            }
        }

        // Traitement terminé avec succès
        storeEvents.emit(EVENTS.PROCESS.COMPLETE);
        
        // Masquer l'overlay global
        overlayManager.hideGlobal();

    } catch (error) {
        console.error("General Error:", error);
        storeEvents.emit(EVENTS.PROCESS.ERROR, error);
        
        // En cas d'erreur, masquer l'overlay et afficher un message d'erreur
        overlayManager.hideGlobal();
        window.alert("Une erreur est survenue lors du traitement du fichier GEDCOM.");
    } finally {
        handleTabsAndOverlay(false);
        setupPersonLinkEventListener();
    }
}

function handleTabsAndOverlay(shouldShowLoading) {
    const tabsToDisable = ["tab2", "tab3", "tab4", "tab5", "tab6"];
    tabsToDisable.forEach(tabId => {
        const tabLink = document.querySelector(`a[href="#${tabId}"]`);
        if (tabLink) {
            tabLink.classList.toggle('disabled', shouldShowLoading);
            tabLink.setAttribute('aria-disabled', shouldShowLoading ? 'true' : 'false');
            tabLink.setAttribute('tabindex', shouldShowLoading ? '-1' : '0');
        }
    });

    // Utiliser l'overlayManager pour gérer l'overlay plutôt que la manipulation directe du DOM
    if (shouldShowLoading) {
        // Force l'affichage de tab1
        document.querySelector('a[href="#tab1"]').click();
    }
}

export { onFileChange };