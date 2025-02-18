import { storeEvents, EVENTS } from '../stores/storeEvents.js';

export class FamilyTownsUI {
    constructor() {
        console.log('🏗️ Initialisation de FamilyTownsUI');
        this.setupEventListeners();
    }

    setupEventListeners() {
        console.log('🎧 Configuration des écouteurs d\'événements FamilyTownsUI');
        
        const TOWNS_EVENTS = EVENTS.VISUALIZATIONS.MAP.TOWNS;
        
        storeEvents.subscribe(TOWNS_EVENTS.UPDATE_START, () => {
            console.log('📣 Événement towns:update:start reçu dans UI');
            this.showLoadingAlert();
        });

        storeEvents.subscribe(TOWNS_EVENTS.UPDATE_COMPLETE, () => {
            console.log('📣 Événement towns:update:complete reçu dans UI');
            this.showSuccessAlert();
        });

        storeEvents.subscribe(TOWNS_EVENTS.UPDATE_ERROR, (error) => {
            console.log('📣 Événement towns:update:error reçu dans UI', error);
            this.showErrorAlert(error);
        });

        // Ces événements sont toujours valides car ils font partie du processus global
        storeEvents.subscribe(EVENTS.PROCESS.START, (message) => {
            this.showProcessingAlert(message);
        });

        storeEvents.subscribe(EVENTS.PROCESS.COMPLETE, () => {
            this.hideAlert();
        });
        
        // Garder temporairement les anciens événements pour la rétrocompatibilité
        storeEvents.subscribe(EVENTS.TOWN.UPDATE_START, () => this.showLoadingAlert());
        storeEvents.subscribe(EVENTS.TOWN.UPDATE_COMPLETE, () => this.showSuccessAlert());
        storeEvents.subscribe(EVENTS.TOWN.UPDATE_ERROR, (error) => this.showErrorAlert(error));
        
        console.log('✅ Écouteurs configurés avec nouveaux événements:', {
            newEvents: TOWNS_EVENTS,
            legacyEvents: EVENTS.TOWN
        });
    }

    showLoadingAlert() {
        console.log('🔄 Affichage alerte de chargement');
        const alertElement = document.getElementById('alert');
        const alertContent = document.getElementById('alert-content');
        
        if (!alertElement || !alertContent) {
            console.error('❌ Éléments DOM manquants:', {
                alert: alertElement,
                content: alertContent
            });
            return;
        }
        
        alertContent.style.whiteSpace = 'pre-line';
        alertContent.textContent = 'Validation du géocodage des villes mentionnées dans votre fichier Gedcom...';
        alertElement.classList.remove('d-none', 'alert-success', 'alert-danger');
        alertElement.classList.add('show', 'alert-primary');
        console.log('✅ Alerte de chargement affichée');
    }

    showSuccessAlert() {
        console.log('✨ Affichage alerte de succès');
        const alertElement = document.getElementById('alert');
        const alertContent = document.getElementById('alert-content');
        
        if (!alertElement || !alertContent) {
            console.error('❌ Éléments DOM manquants:', {
                alert: alertElement,
                content: alertContent
            });
            return;
        }
        
        alertElement.classList.remove('alert-primary', 'alert-danger');
        alertElement.classList.add('alert-success');
        alertContent.textContent = 'Validation terminée.';
        
        setTimeout(() => {
            console.log('🔄 Masquage de l\'alerte de succès');
            alertElement.classList.add('d-none');
        }, 1800);
    }

    showErrorAlert(error) {
        console.log('⚠️ Affichage alerte d\'erreur', error);
        const alertElement = document.getElementById('alert');
        const alertContent = document.getElementById('alert-content');
        
        if (!alertElement || !alertContent) {
            console.error('❌ Éléments DOM manquants:', {
                alert: alertElement,
                content: alertContent
            });
            return;
        }
        
        alertElement.classList.remove('alert-primary', 'alert-success');
        alertElement.classList.add('alert-danger');
        alertContent.textContent = `Erreur: ${error.message}`;
        console.log('✅ Alerte d\'erreur affichée');
    }

    showProcessingAlert(message) {
        const alertElement = document.getElementById('alert');
        const alertContent = document.getElementById('alert-content');
        
        if (!alertElement || !alertContent) return;
        
        alertContent.textContent = message;
        alertElement.classList.remove('d-none', 'alert-success', 'alert-danger');
        alertElement.classList.add('show', 'alert-info');
    }

    hideAlert() {
        const alertElement = document.getElementById('alert');
        if (alertElement) {
            alertElement.classList.add('d-none');
        }
    }
}