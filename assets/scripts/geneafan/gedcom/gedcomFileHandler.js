import { Modal } from 'bootstrap';
import Uppy from '@uppy/core';
import AwsS3 from '@uppy/aws-s3';
import configStore from '../stores/configStore.js';
import { onFileChange } from "../ui.js";
import authStore from '../stores/authStore.js';

let isLoadingFile = false;
let gedcomFileName = "";

// Initialisation d'une modale unique
const modalContainer = document.createElement('div');
modalContainer.innerHTML = `
<div class="modal fade" id="dynamicModal" tabindex="-1" aria-labelledby="dynamicModalLabel" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="dynamicModalLabel"></h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
      </div>
      <div class="modal-body" id="dynamicModalBody"></div>
      <div class="modal-footer" id="modalFooter">
        <button type="button" class="btn btn-secondary" id="cancelBtn">Non</button>
        <button type="button" class="btn btn-primary" id="confirmBtn">Oui</button>
      </div>
    </div>
  </div>
</div>`;
document.body.appendChild(modalContainer);

const dynamicModalElement = document.getElementById('dynamicModal');
const dynamicModal = new Modal(dynamicModalElement, { backdrop: 'static', keyboard: false });

// Fonction pour afficher la modale avec un contenu spécifique
function showModal(title, bodyHtml, onConfirm = null, onCancel = null) {
  console.log("Affichage de la modale :", title); // Debug pour confirmer l'appel
  document.getElementById('dynamicModalLabel').innerText = title;
  document.getElementById('dynamicModalBody').innerHTML = bodyHtml;

  const modalFooter = document.getElementById('modalFooter');
  
  // Détermine si on affiche les boutons "Oui" et "Non" ou seulement "Fermer"
  if (onConfirm || onCancel) {
      modalFooter.innerHTML = `
          <button type="button" class="btn btn-secondary" id="cancelBtn">Non</button>
          <button type="button" class="btn btn-primary" id="confirmBtn">Oui</button>
      `;

      const confirmBtn = document.getElementById('confirmBtn');
      const cancelBtn = document.getElementById('cancelBtn');

      confirmBtn.onclick = () => {
          console.log("Bouton Oui cliqué dans showModal"); // Debug
          if (onConfirm) onConfirm();
      };

      cancelBtn.onclick = () => {
          console.log("Bouton Non cliqué dans showModal"); // Debug
          if (onCancel) onCancel();
      };
  } else {
      // Pour la dernière étape, afficher uniquement le bouton "Fermer"
      modalFooter.innerHTML = `<button type="button" class="btn btn-primary" data-bs-dismiss="modal">Fermer</button>`;
  }

  // Afficher la modale sans la cacher entre les étapes
  if (!dynamicModalElement.classList.contains('show')) {
      dynamicModal.show();
  }
}


// Gestion du chargement de fichier GEDCOM
export function loadGedcomFile(input) {
    if (isLoadingFile) return;
    isLoadingFile = true;

    if (typeof input === 'string') {
        loadRemoteFile(input);
    } else {
        const file = input[0];
        gedcomFileName = file.name;
        configStore.setGedcomFileName(gedcomFileName);
        showSaveFileModal(file);
    }
}

// Chargement d'un fichier distant
function loadRemoteFile(url) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";

    xhr.onload = () => {
        isLoadingFile = false;
        if (xhr.status === 200) {
            gedcomFileName = url.split("/").pop();
            configStore.setGedcomFileName(gedcomFileName);
            onFileChange(xhr.response);
        } else {
            alert("Erreur lors du chargement du fichier.");
        }
    };

    xhr.onerror = () => {
        isLoadingFile = false;
        alert("Erreur réseau lors du chargement du fichier.");
    };

    xhr.send();
}

// Affichage de la première étape (confirmation de sauvegarde du fichier)
function showSaveFileModal(file) {
    showModal(
        "Enregistrer le fichier",
        "Voulez-vous enregistrer votre fichier pour un usage ultérieur ?",
        () => {
            console.log("Authentification de l'utilisateur..."); // Debug
            authStore.accessFeature(
                (userInfo) => showFamilyNameModal(file, userInfo),
                () => {
                    alert('Vous devez être authentifié pour enregistrer le fichier.');
                    readAndProcessGedcomFile(file);
                }
            );
        },
        () => {
            console.log("L'utilisateur a choisi de ne pas enregistrer le fichier."); // Debug
            readAndProcessGedcomFile(file);
        }
    );
}

// Affichage de la deuxième étape (saisie du nom de famille)
function showFamilyNameModal(file, userInfo) {
  console.log("Appel de showFamilyNameModal avec file et userInfo:", file, userInfo); // Debug
  
  const bodyHtml = `
      <label for="familyNameInput">À quelle famille correspond votre fichier Gedcom ?</label>
      <input type="text" class="form-control" id="familyNameInput" required placeholder="Nom de la famille">`;

  setTimeout(() => {
      showModal(
          "Nom de la famille",
          bodyHtml,
          () => {
              const familyNameInput = document.getElementById('familyNameInput');
              if (!familyNameInput) {
                  console.error("Élément familyNameInput introuvable"); // Debug
                  return;
              }

              const familyName = familyNameInput.value.trim();
              console.log("Nom de famille saisi :", familyName); // Debug
              if (familyName) {
                  saveGedcomFile(file, familyName, userInfo);
              } else {
                  alert('Veuillez entrer le nom de la famille.');
              }
          },
          () => {
              console.log("Annulation dans showFamilyNameModal"); // Debug
              readAndProcessGedcomFile(file);
          }
      );
  }, 300); // Délai pour attendre la transition
}

// Sauvegarde du fichier GEDCOM
async function saveGedcomFile(file, familyName, userInfo) {
  const newFileName = `${userInfo.id}_fam_${familyName}.ged`;
  console.log("Nom du fichier pour l'upload:", newFileName); // Debug

  const uppy = new Uppy({ autoProceed: true });

  uppy.use(AwsS3, {
      async getUploadParameters(file) {
          console.log("Récupération des paramètres de téléchargement"); // Debug
          const response = await fetch('https://generate-signed-url.vercel.app/api/generate-signed-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: newFileName, contentType: file.type, operation: 'upload' })
          });

          if (!response.ok) {
              throw new Error("Erreur lors de la récupération de l'URL signée");
          }

          const data = await response.json();
          console.log("URL signée reçue:", data.url); // Debug
          return { method: 'PUT', url: data.url, headers: { 'Content-Type': file.type } };
      },
  });

  try {
      uppy.addFile({ name: newFileName, type: file.type, data: file });
      console.log("Début de l'upload du fichier"); // Debug
      const uploadResult = await uppy.upload();
      
      if (uploadResult.failed.length > 0) {
          console.error("Échec de l'upload:", uploadResult.failed); // Debug
          alert("Erreur pendant le téléchargement du fichier.");
          return;
      }

      console.log("Upload terminé, enregistrement des métadonnées..."); // Debug
      const workerResponse = await fetch('https://user-file-access.genealogie.app/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: newFileName, userId: userInfo.id })
      });

      if (!workerResponse.ok) {
          throw new Error("Erreur lors de l'enregistrement des métadonnées du fichier");
      }

      console.log("Enregistrement des métadonnées réussi"); // Debug

      // Afficher le message de confirmation après le succès de l'upload
      showConfirmationModal();
  } catch (error) {
      console.error("Erreur pendant l'upload ou l'enregistrement :", error);
      alert("Erreur pendant l'upload ou l'enregistrement du fichier.");
  }
}

// Affichage de la dernière étape (confirmation de l'enregistrement réussi)
function showConfirmationModal() {
  const title = "Enregistrement réussi";
  const bodyHtml = "<p>Votre fichier a été enregistré avec succès dans Cloudflare.</p>";

  // Appel à showModal sans onConfirm ni onCancel pour afficher uniquement "Fermer"
  showModal(title, bodyHtml);
}

function readAndProcessGedcomFile(file) {
    const reader = new FileReader();
    reader.onloadend = () => onFileChange(reader.result);
    reader.readAsArrayBuffer(file);
}

// Function to fetch the list of Gedcom files for the current user
export async function fetchUserGedcomFiles(userId) {
  console.log('Fetching user Gedcom files for user:', userId); // Debug
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
              console.warn("Aucun fichier trouvé pour cet utilisateur."); // Debug
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

      console.log("Fichiers GEDCOM récupérés :", files); // Debug
      return files;
  } catch (error) {
      console.error('Erreur lors de la récupération des fichiers GEDCOM :', error);
      return [];
  }
}
