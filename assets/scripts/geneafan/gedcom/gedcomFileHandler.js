import { Modal } from 'bootstrap';
import _ from 'lodash';  // Added lodash import
import { runInAction } from 'mobx';
import Uppy from '@uppy/core';
import AwsS3 from '@uppy/aws-s3';
import configStore from '../tabs/fanChart/fanConfigStore.js';
import rootPersonStore from '../common/stores/rootPersonStore.js';
import authStore from '../common/stores/authStore.js';
import gedcomDataStore from './gedcomDataStore.js';
import familyTownsStore from './familyTownsStore.js';
import { clearAllStates } from "../common/stores/state.js";
import { updateFamilyTownsViaProxy, updateIndividualTownsFromFamilyTowns } from "../utils/utils.js";
import { toJson, getAllPlaces, getIndividualsList } from "./parse.js";
import { setupPersonLinkEventListener } from "../listeners/eventListeners.js";
import { googleMapsStore } from '../tabs/familyMap/googleMapsStore.js';
import fanChartManager from '../tabs/fanChart/fanChartManager.js';

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
    UPLOADING: {
        title: 'Téléchargement en cours',
        content: `
            <div class="modal-body text-center">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Chargement...</span>
                </div>
                <p class="mt-2">Téléchargement de votre fichier en cours...</p>
            </div>
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
    }
};

export function loadGedcomFile(input) {
    if (isLoadingFile) return;
    isLoadingFile = true;

    if (typeof input === 'string') {
        loadRemoteFile(input);
    } else {
        loadLocalFile(input[0]);
    }
}

function loadRemoteFile(url) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    
    xhr.onload = function() {
        isLoadingFile = false;
        if (this.status === 200) {
            gedcomFileName = url.split("/").pop();
            configStore.setGedcomFileName(gedcomFileName);
            processGedcomData(xhr.response);
        } else {
            handleError("Cannot read remote file");
        }
    };
    
    xhr.onerror = () => handleError("Network error loading file");
    xhr.send();
}

function loadLocalFile(file) {
    gedcomFileName = file.name;
    configStore.setGedcomFileName(gedcomFileName);
    showSaveFileModal(file);
}

function handleError(message) {
    isLoadingFile = false;
    console.error(message);
    window.alert(__("geneafan.cannot_read_this_file"));
}

async function processGedcomData(data) {
    handleTabsAndOverlay(true);

    try {
        await runInAction(async () => {
            // Clear all states in a single transaction
            clearAllStates();
            gedcomDataStore.clearAllState();
            familyTownsStore.setTownsData({});

            if (gedcomDataStore.getFileUploaded()) {
                fanChartManager.resetUI();
            }

            // Process GEDCOM data
            const json = toJson(data);
            const result = await getAllPlaces(json);
            gedcomDataStore.setSourceData(result.json);
            gedcomDataStore.setFileUploaded(true);

            // Update geolocation data
            await updateFamilyTownsViaProxy();
            const updatedCache = new Map(gedcomDataStore.getIndividualsCache());
            updateIndividualTownsFromFamilyTowns(updatedCache);
            gedcomDataStore.setIndividualsCache(updatedCache);

            // Update maps
            const towns = familyTownsStore.getAllTowns();
            Object.entries(towns).forEach(([key, town]) => {
                if (isValidTownLocation(town)) {
                    googleMapsStore.addMarker(key, town);
                }
            });

            // Initialize individual selector
            const individuals = getIndividualsList(result.json).individualsList;
            await initializeIndividualSelector(individuals);

            // Set root person
            const rootId = determineRootId(individuals);
            await setRootPerson(rootId, individuals);
        });

        enableUIElements();
    } catch (error) {
        console.error("Processing error:", error);
    } finally {
        handleTabsAndOverlay(false);
        setupPersonLinkEventListener();
    }
}

// Modal Management
function showModal(step, handlers = {}) {
    if (!currentModal) {
        createModalElement();
    }

    const modalElement = document.getElementById('gedcomModal');
    updateModalContent(modalElement, MODAL_STEPS[step]);
    attachModalHandlers(modalElement, handlers);

    if (!currentModal.isShown) {
        currentModal.show();
    }
}

function createModalElement() {
    const modalContent = document.createElement('div');
    modalContent.innerHTML = `
        <div class="modal fade" id="gedcomModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div id="modalStepContent"></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalContent);
    currentModal = new Modal(document.getElementById('gedcomModal'), {
        backdrop: 'static',
        keyboard: false
    });
}

function updateModalContent(modalElement, stepConfig) {
    modalElement.querySelector('.modal-title').textContent = stepConfig.title;
    const contentContainer = modalElement.querySelector('#modalStepContent');
    const newContent = contentContainer.cloneNode(true);
    newContent.innerHTML = stepConfig.content;
    contentContainer.parentNode.replaceChild(newContent, contentContainer);
}

function attachModalHandlers(modalElement, handlers) {
    Object.entries(handlers).forEach(([selector, handler]) => {
        const element = modalElement.querySelector(selector);
        if (!element) return;

        if (selector === 'form') {
            element.onsubmit = (e) => {
                e.preventDefault();
                handler(e);
            };
        } else {
            element.onclick = handler;
        }
    });
}

function closeModal() {
    if (!currentModal) return;
    currentModal.hide();
    document.getElementById('gedcomModal').remove();
    currentModal = null;
}

// Helper Functions
function isValidTownLocation(town) {
    return googleMapsStore.isValidCoordinate(town.latitude) && 
           googleMapsStore.isValidCoordinate(town.longitude);
}

async function initializeIndividualSelector(individuals) {
    if (!individuals || !Array.isArray(individuals)) {
        console.error('Invalid individuals data provided to selector initialization');
        return;
    }

    // Get or initialize the TomSelect instance
    let tomSelect = rootPersonStore.getTomSelect();
    if (!tomSelect) {
        try {
            rootPersonStore.initializeTomSelect();
            tomSelect = rootPersonStore.getTomSelect();
            if (!tomSelect) {
                throw new Error('Failed to initialize TomSelect');
            }
        } catch (error) {
            console.error('Error initializing TomSelect:', error);
            return;
        }
    }

    try {
        // Clear existing options
        tomSelect.clear();
        
        // Add default empty option
        tomSelect.addOption({
            value: '',
            text: __("geneafan.choose_root_placeholder"),
            disabled: true
        });
        
        // Add individual options
        individuals.forEach(individual => {
            if (individual && individual.id) {
                tomSelect.addOption({
                    value: individual.id,
                    text: formatIndividualLabel(individual)
                });
            }
        });

        // Select default empty option
        tomSelect.addItem('', true);
        
    } catch (error) {
        console.error('Error updating TomSelect options:', error);
    }
}

function formatIndividualLabel(individual) {
    return `${individual.surname} ${individual.name} ${individual.id} ${
        individual.birthYear || "?"}-${individual.deathYear || ""}`;
}

function determineRootId(individuals) {
    return gedcomFileName === "demo.ged" ? 
           "@I111@" : 
           findYoungestIndividual(individuals)?.id;
}

function showSaveFileModal(file) {
    showModal('SAVE_REQUEST', {
        '[data-action="no"]': () => {
            closeModal();
            readAndProcessGedcomFile(file);
        },
        '[data-action="yes"]': () => handleSaveRequest(file)
    });
}

function handleSaveRequest(file) {
    authStore.accessFeature(
        userInfo => showFamilyNameModal(file, userInfo),
        () => {
            window.alert('Vous devez être authentifié pour enregistrer le fichier.');
            closeModal();
            readAndProcessGedcomFile(file);
        }
    );
}

function showFamilyNameModal(file, userInfo) {
    showModal('FAMILY_NAME', {
        'form': () => {
            const familyName = document.getElementById('familyNameInput').value.trim();
            if (!familyName) {
                alert('Veuillez entrer le nom de la famille.');
                return;
            }
            showModal('UPLOADING');
            saveGedcomFile(file, familyName, userInfo);
        }
    });
}

async function saveGedcomFile(file, familyName, userInfo) {
    if (!userInfo.id) {
        handleSaveError('ID utilisateur manquant');
        return;
    }

    const newFileName = `${userInfo.id}_fam_${familyName}.ged`;
    
    try {
        await uploadFileToR2(file, newFileName);
        await saveFileMetadata(newFileName, userInfo.id);
        
        showModal('UPLOAD_SUCCESS', {
            '[data-action="close"]': () => {
                closeModal();
                readAndProcessGedcomFile(file);
            }
        });
    } catch (error) {
        handleSaveError('Erreur lors de l\'enregistrement');
    }
}

async function uploadFileToR2(file, newFileName) {
    const uppy = new Uppy({ autoProceed: true });
    uppy.use(AwsS3, {
        getUploadParameters: async file => {
            const response = await fetch('https://generate-signed-url.vercel.app/api/generate-signed-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: newFileName,
                    contentType: file.type,
                    operation: 'upload'
                })
            });

            if (!response.ok) throw new Error('Erreur de génération URL');
            
            const data = await response.json();
            return {
                method: 'PUT',
                url: data.url,
                headers: { 'Content-Type': file.type }
            };
        }
    });

    uppy.addFile({
        name: newFileName,
        type: file.type,
        data: file
    });

    const result = await uppy.upload();
    if (result.failed.length > 0) {
        throw new Error('Échec upload');
    }
}

async function saveFileMetadata(filename, userId) {
    const response = await fetch('https://user-file-access.genealogie.app/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, userId })
    });

    if (!response.ok) {
        throw new Error('Erreur sauvegarde métadonnées');
    }
}

async function setRootPerson(rootId, individuals) {
    const rootPerson = individuals.find(i => i.id === rootId);
    if (!rootPerson) return;

    rootPersonStore.setRoot(rootId);
    rootPersonStore.setRootPersonName({
        name: rootPerson.name,
        surname: rootPerson.surname,
    });
    rootPersonStore.setTomSelectValue(rootId);
}

function enableUIElements() {
    const elements = [
        ...document.querySelectorAll(".parameter"),
        document.getElementById("individual-select"),
        document.getElementById("download-menu"),
        document.getElementById("fanParametersDisplay"),
        document.getElementById("treeParametersDisplay"),
        document.getElementById("fullscreenButton"),
    ];
    elements.forEach(el => el.disabled = false);
}

function handleTabsAndOverlay(showLoading) {
    const tabsToDisable = ["tab2", "tab3", "tab4"];
    tabsToDisable.forEach(tabId => {
        const tabLink = document.querySelector(`a[href="#${tabId}"]`);
        if (tabLink) {
            tabLink.classList.toggle('disabled', showLoading);
            tabLink.setAttribute('aria-disabled', showLoading.toString());
            tabLink.setAttribute('tabindex', showLoading ? '-1' : '0');
        }
    });

    const overlay = document.getElementById('overlay');
    const loading = document.getElementById("loading");
    
    if (showLoading) {
        overlay.classList.remove('overlay-hidden');
        document.querySelector('a[href="#tab1"]').click();
        loading.style.display = "block";
    } else {
        loading.style.display = "none";
        overlay.classList.add("overlay-hidden");
    }
}

function findYoungestIndividual(individuals) {
    return _.maxBy(
        individuals
            .filter(i => i.birthDate)
            .map(i => ({
                id: i.id,
                birthDate: parseBirthDate(i.birthDate)
            })),
        "birthDate"
    );
}

function parseBirthDate(birthDate) {
    if (birthDate.includes("/")) {
        const [day, month, year] = birthDate.split("/").reverse();
        return new Date(year, month - 1, day || 1);
    }
    return new Date(birthDate, 0, 1);
}

function readAndProcessGedcomFile(file) {
    isLoadingFile = true;
    const reader = new FileReader();

    reader.addEventListener("loadend", () => {
        isLoadingFile = false;
        processGedcomData(reader.result);
    });

    reader.readAsArrayBuffer(file);
}

async function fetchUserGedcomFiles(userId) {
    try {
        const response = await fetch('https://user-file-access.genealogie.app/list-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        if (response.status === 404) return [];
        if (!response.ok) throw new Error('Erreur récupération fichiers');

        const data = await response.json();
        return data.files.map(file => ({
            id: file.id,
            name: file.name,
            signedUrl: file.signedUrl,
            status: file.status
        }));
    } catch (error) {
        console.error('Erreur liste fichiers GEDCOM:', error);
        return [];
    }
}

export { processGedcomData, fetchUserGedcomFiles };