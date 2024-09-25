import { Modal } from 'bootstrap'; 
import Uppy from '@uppy/core';
import AwsS3 from '@uppy/aws-s3';
import configStore from './store';
import { onFileChange } from "./ui.js";
import { handleUserAuthentication } from './users.js';

/* Code to manage the upload of GEDCOM files */
let isLoadingFile = false;
let gedcomFileName = "";

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

// Function to save the Gedcom file in the R2 gedcom-files bucket
async function saveGedcomFile(file, familyName, userInfo) {
  const clerkId = userInfo.id;
  if (!clerkId) {
    alert('Impossible de récupérer votre identifiant utilisateur.');
    readAndProcessFile(file);
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
      const workerResponse = await fetch('https://user-file-access-worker.genealogie.workers.dev/upload', {
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
      readAndProcessFile(file); // Process the file after upload
    
    } else {
      console.error('File upload failed:', uploadResult.failed);
      alert('Error during file upload.');
    }
    
    } catch (error) {
    console.error('Error during file saving:', error);
    alert('Error during file upload.');
  }
}

// Function to fetch the list of Gedcom files for the current user
export async function fetchUserGedcomFiles(userId) {
  try {
      const response = await fetch('https://user-file-access-worker.genealogie.workers.dev/list-files', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              // Ajoutez ici les en-têtes nécessaires pour l'authentification si requis
          },
          body: JSON.stringify({ userId })
      });

      if (!response.ok) {
          if (response.status === 404) {
              // Aucun fichier trouvé pour cet utilisateur
              return [];
          } else {
              throw new Error('Erreur lors de la récupération des fichiers.');
          }
      }

      const data = await response.json();
      const files = data.files.map(file => ({
          id: file.filename,
          name: file.filename,
          signedUrl: file.signedUrl,
          status: file.status // 'owned' ou 'authorized'
      }));
      console.log('Fichiers GEDCOM récupérés :', files);
      return files;
  } catch (error) {
      console.error('Erreur lors de la récupération des fichiers GEDCOM :', error);
      return [];
  }
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