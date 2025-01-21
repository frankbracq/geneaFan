import { storeEvents, EVENTS } from '../stores/storeEvents.js';

class FamilyTownsUI {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        storeEvents.subscribe(EVENTS.TOWN.UPDATE_START, () => {
            this.showLoadingAlert();
        });

        storeEvents.subscribe(EVENTS.TOWN.UPDATE_COMPLETE, () => {
            this.showSuccessAlert();
        });

        storeEvents.subscribe(EVENTS.TOWN.UPDATE_ERROR, (error) => {
            this.showErrorAlert(error);
        });
    }

    showLoadingAlert() {
        const alertElement = document.getElementById('alert');
        const alertContent = document.getElementById('alert-content');
        
        alertContent.style.whiteSpace = 'pre-line';
        alertContent.textContent = 'Mise à jour des coordonnées géographiques des communes mentionnées dans votre fichier...\nCela peut prendre une à deux minutes. Veuillez patienter...';
        alertElement.classList.remove('d-none', 'alert-success', 'alert-danger');
        alertElement.classList.add('show', 'alert-primary');
    }

    showSuccessAlert() {
        const alertElement = document.getElementById('alert');
        const alertContent = document.getElementById('alert-content');
        
        alertElement.classList.remove('alert-primary', 'alert-danger');
        alertElement.classList.add('alert-success');
        alertContent.textContent = 'Mise à jour des coordonnées géographiques des communes terminée.';
        
        setTimeout(() => {
            alertElement.classList.add('d-none');
        }, 1800);
    }

    showErrorAlert(error) {
        const alertElement = document.getElementById('alert');
        const alertContent = document.getElementById('alert-content');
        
        alertElement.classList.remove('alert-primary', 'alert-success');
        alertElement.classList.add('alert-danger');
        alertContent.textContent = `Erreur dans la mise à jour des coordonnées géographiques: ${error.message}`;
    }
}

export const familyTownsUI = new FamilyTownsUI();