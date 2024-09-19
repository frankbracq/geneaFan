import { f0 } from 'file0';
import { Modal } from 'bootstrap'; 
import configStore from './store';
import { onFileChange } from "./ui.js";
import { handleUserAuthentication } from './users.js';

require('dotenv').config();
const f0SecretKey = process.env.F0_SECRET_KEY;
console.log('F0 Secret Key:', f0SecretKey);

/* Code to manage the upload of GEDCOM files */
let isLoadingFile = false;
let gedcomFileName = "";

export function loadFile(input) {
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
    // Création du contenu de la modale
    const modalContent = document.createElement('div');
    modalContent.innerHTML = `
    <div class="modal fade" id="saveFileModal" tabindex="-1" aria-labelledby="saveFileModalLabel" aria-hidden="true">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Enregistrer le fichier</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
          </div>
          <div class="modal-body">
            Voulez-vous enregistrer votre fichier pour un usage ultérieur ?
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="saveFileNoBtn">Non</button>
            <button type="button" class="btn btn-primary" id="saveFileYesBtn">Oui</button>
          </div>
        </div>
      </div>
    </div>
    `;

    // Ajout de la modale au corps du document
    document.body.appendChild(modalContent);

    // Initialisation de la modale
    const saveFileModalElement = document.getElementById('saveFileModal');
    const saveFileModal = new Modal(saveFileModalElement, {
        backdrop: 'static',
        keyboard: false
    });

    // Affichage de la modale
    saveFileModal.show();

    // Gestion du clic sur le bouton 'Non'
    document.getElementById('saveFileNoBtn').addEventListener('click', function() {
        // Fermeture et suppression de la modale
        saveFileModal.hide();
        saveFileModal.dispose();
        saveFileModalElement.remove();
        // Continuer avec l'application
        readAndProcessFile(file);
    });

    // Gestion du clic sur le bouton 'Oui'
    document.getElementById('saveFileYesBtn').addEventListener('click', function() {
        // Fermeture et suppression de la modale
        saveFileModal.hide();
        saveFileModal.dispose();
        saveFileModalElement.remove();
        // Procéder à l'authentification de l'utilisateur
        handleUserAuthentication(async (userInfo) => {
            if (userInfo) {
                // Afficher la prochaine modale pour demander le nom de la famille
                showFamilyNameModal(file, userInfo);
            } else {
                // L'utilisateur n'est pas authentifié
                window.alert('Vous devez être authentifié pour enregistrer le fichier.');
                // Continuer avec l'application
                readAndProcessFile(file);
            }
        });
    });
}

function showFamilyNameModal(file, userInfo) {
    // Création du contenu de la modale
    const modalContent = document.createElement('div');
    modalContent.innerHTML = `
    <div class="modal fade" id="familyNameModal" tabindex="-1" aria-labelledby="familyNameModalLabel" aria-hidden="true">
      <div class="modal-dialog" role="document">
        <form id="familyNameForm">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Nom de la famille</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
            </div>
            <div class="modal-body">
              À quelle famille correspond votre fichier Gedcom ?
              <input type="text" class="form-control" id="familyNameInput" required>
            </div>
            <div class="modal-footer">
              <button type="submit" class="btn btn-primary">Enregistrer</button>
            </div>
          </div>
        </form>
      </div>
    </div>
    `;

    // Ajout de la modale au corps du document
    document.body.appendChild(modalContent);

    // Initialisation de la modale
    const familyNameModalElement = document.getElementById('familyNameModal');
    const familyNameModal = new Modal(familyNameModalElement, {
        backdrop: 'static',
        keyboard: false
    });

    // Affichage de la modale
    familyNameModal.show();

    // Gestion de la soumission du formulaire
    document.getElementById('familyNameForm').addEventListener('submit', function(event) {
        event.preventDefault();
        const familyName = document.getElementById('familyNameInput').value.trim();
        if (familyName) {
            // Fermeture et suppression de la modale
            familyNameModal.hide();
            familyNameModal.dispose();
            familyNameModalElement.remove();
            // Procéder au renommage et à l'upload du fichier
            saveGedcomFile(file, familyName, userInfo);
        } else {
            // Afficher un message d'erreur
            alert('Veuillez entrer le nom de la famille.');
        }
    });
}

async function saveGedcomFile(file, familyName, userInfo) {
  const clerkId = userInfo.id;
  if (!clerkId) {
      alert('Impossible de récupérer votre identifiant utilisateur.');
      readAndProcessFile(file);
      return;
  }

  const newFileName = `${clerkId}_${familyName}.ged`;
  console.log('Nouveau nom de fichier:', newFileName);

  try {
    const token = await f0.createToken(newFileName, {
      expiresIn: "1h",
    });

      // Uploader le fichier en utilisant le SDK
      await f0.useToken(token).set(file);

      console.log('Fichier enregistré avec succès.');
  } catch (error) {
      console.error('Erreur lors de l\'enregistrement du fichier :', error);
  }

  readAndProcessFile(file);
}

function readAndProcessFile(file) {
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