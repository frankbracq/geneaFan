import { Modal, Tooltip, Collapse } from 'bootstrap';
import ShareFormStore from './stores/shareFormStore';
import { reaction } from '../common/stores/mobx-config';
import { loadGedcomFile } from './gedcomFileHandler';

class GedcomModalManager {
  // Class properties
  currentModal = null;
  activeShareForms = new Set();

  // Private helper methods
  createElement = (tag, options = {}) => {
    const element = document.createElement(tag);
    Object.entries(options).forEach(([key, value]) => {
      if (key === 'classes') {
        element.classList.add(...value);
      } else if (key === 'attributes') {
        Object.entries(value).forEach(([attr, val]) => element.setAttribute(attr, val));
      } else {
        element[key] = value;
      }
    });
    return element;
  }

  sanitizeFileId = (fileId) => {
    if (fileId == null) {
      throw new TypeError('fileId cannot be null or undefined');
    }
    return fileId.replace(/\s+/g, '_');
  }

  // Public methods
  showModal = (files, userInfo) => {
    this.cleanupExistingModal();
    
    const modalDiv = this.createGedcomModal(files);
    document.body.appendChild(modalDiv);
    
    this.initializeTooltips(modalDiv);
    
    const modalElement = document.getElementById('gedcomFilesModal');
    this.currentModal = new Modal(modalElement);
    this.setupEventDelegation(modalElement, userInfo);
    this.currentModal.show();
  }

  cleanupExistingModal = () => {
    const existingModal = document.getElementById('gedcomFilesModal');
    if (existingModal) {
      const existingModalInstance = Modal.getInstance(existingModal);
      if (existingModalInstance) {
        existingModalInstance.dispose();
      }
      existingModal.remove();
    }
  }

  // Modal creation methods
  createGedcomModal = (files) => {
    const modalDiv = this.createElement('div', {
      classes: ['modal', 'fade'],
      attributes: {
        id: 'gedcomFilesModal',
        tabindex: '-1',
        'aria-labelledby': 'gedcomFilesModalLabel',
        'aria-hidden': 'true'
      }
    });

    const modalDialog = this.createElement('div', { classes: ['modal-dialog', 'modal-lg'] });
    const modalContent = this.createElement('div', { classes: ['modal-content'] });
    
    const modalHeader = this.createModalHeader();
    const modalBody = this.createModalBody(files);
    
    modalContent.append(modalHeader, modalBody);
    modalDialog.appendChild(modalContent);
    modalDiv.appendChild(modalDialog);

    return modalDiv;
  }

  createModalHeader = () => {
    const modalHeader = this.createElement('div', { classes: ['modal-header'] });
    
    const modalTitle = this.createElement('h5', {
      classes: ['modal-title'],
      attributes: { id: 'gedcomFilesModalLabel' },
      textContent: 'My GEDCOM Files'
    });

    const closeButton = this.createElement('button', {
      classes: ['btn-close'],
      attributes: {
        type: 'button',
        'data-bs-dismiss': 'modal',
        'aria-label': 'Close'
      }
    });

    modalHeader.append(modalTitle, closeButton);
    return modalHeader;
  }

  createModalBody = (files) => {
    const modalBody = this.createElement('div', { classes: ['modal-body', 'position-relative'] });
    
    const loadingSpinner = this.createLoadingSpinner();
    modalBody.appendChild(loadingSpinner);

    const modalContentContainer = this.createElement('div', { attributes: { id: 'modalContent' } });
    const table = this.createFilesTable(files);
    modalContentContainer.appendChild(table);
    modalBody.appendChild(modalContentContainer);

    return modalBody;
  }

  createLoadingSpinner = () => {
    const loadingSpinner = this.createElement('div', {
      classes: ['position-absolute', 'top-50', 'start-50', 'translate-middle'],
      attributes: { 
        id: 'loadingSpinner', 
        style: 'display: none; z-index: 1051;' 
      }
    });

    const spinner = this.createElement('div', { 
      classes: ['spinner-border', 'text-primary'], 
      attributes: { role: 'status' } 
    });
    
    const spinnerText = this.createElement('span', { 
      classes: ['visually-hidden'], 
      textContent: 'Loading...' 
    });

    spinner.appendChild(spinnerText);
    loadingSpinner.appendChild(spinner);
    return loadingSpinner;
  }

  createFilesTable = (files) => {
    const table = this.createElement('table', { 
      classes: ['table'], 
      attributes: { id: 'gedcomFilesTable' } 
    });

    const thead = this.createElement('thead');
    const headerRow = this.createElement('tr');

    ['File Name', 'Status', 'Actions'].forEach(headerText => {
      const th = this.createElement('th', { 
        attributes: { scope: 'col' }, 
        textContent: headerText 
      });
      if (headerText === 'Actions') th.classList.add('text-end');
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = this.createTableBody(files);
    table.appendChild(tbody);

    return table;
  }

  createTableBody = (files) => {
    const tbody = this.createElement('tbody');

    files.forEach(file => {
      if (!file.id) {
        console.error('Error: File ID is null or undefined for file:', file);
        return;
      }

      const row = this.createFileRow(file);
      tbody.appendChild(row);
    });

    return tbody;
  }

  createFileRow = ({ id, name, status, signedUrl }) => {
    const fileRow = this.createElement('tr', { attributes: { 'data-file-id': id } });

    const tdName = this.createElement('td', { textContent: name });
    const tdStatus = this.createElement('td', { textContent: status === 'owned' ? 'Owner' : 'Authorized' });
    const tdActions = this.createElement('td', { classes: ['text-end'] });

    const actions = this.createActionButtons(id, status, signedUrl);
    actions.forEach(action => tdActions.appendChild(action));

    fileRow.append(tdName, tdStatus, tdActions);
    return fileRow;
  }

  createActionButtons = (id, status, signedUrl) => {
    const actions = [
      { 
        action: 'download', 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" style="width: 1.5em; height: 1.5em; fill: currentColor;">
                <path d="M144 160A80 80 0 1 0 144 0a80 80 0 1 0 0 160zm368 0A80 80 0 1 0 512 0a80 80 0 1 0 0 160zM0 298.7C0 310.4 9.6 320 21.3 320l213.3 0c.2 0 .4 0 .7 0c-26.6-23.5-43.3-57.8-43.3-96c0-7.6 .7-15 1.9-22.3c-13.6-6.3-28.7-9.7-44.6-9.7l-42.7 0C47.8 192 0 239.8 0 298.7zM320 320c24 0 45.9-8.8 62.7-23.3c2.5-3.7 5.2-7.3 8-10.7c2.7-3.3 5.7-6.1 9-8.3C410 262.3 416 243.9 416 224c0-53-43-96-96-96s-96 43-96 96s43 96 96 96zm65.4 60.2c-10.3-5.9-18.1-16.2-20.8-28.2l-103.2 0C187.7 352 128 411.7 128 485.3c0 14.7 11.9 26.7 26.7 26.7l300.6 0c-2.1-5.2-3.2-10.9-3.2-16.4l0-3c-1.3-.7-2.7-1.5-4-2.3l-2.6 1.5c-16.8 9.7-40.5 8-54.7-9.7c-4.5-5.6-8.6-11.5-12.4-17.6l-.1-.2-.1-.2-2.4-4.1-.1-.2-.1-.2c-3.4-6.2-6.4-12.6-9-19.3c-8.2-21.2 2.2-42.6 19-52.3l2.7-1.5c0-.8 0-1.5 0-2.3s0-1.5 0-2.3l-2.7-1.5z"/>
              </svg>`, 
        title: 'Download', 
        link: signedUrl 
      }
    ];

    if (status === 'owned') {
      actions.push(
        { 
          action: 'share', 
          icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="width: 1.5em; height: 1.5em; fill: currentColor;">
                  <path d="M352 224c53 0 96-43 96-96s-43-96-96-96s-96 43-96 96c0 4 .2 8 .7 11.9l-94.1 47C145.4 170.2 121.9 160 96 160c-53 0-96 43-96 96s43 96 96 96c25.9 0 49.4-10.2 66.6-26.9l94.1 47c-.5 3.9-.7 7.8-.7 11.9c0 53 43 96 96 96s96-43 96-96s-43-96-96-96c-25.9 0-49.4 10.2-66.6 26.9l-94.1-47c.5-3.9 .7-7.8 .7-11.9s-.2-8-.7-11.9l94.1-47C302.6 213.8 326.1 224 352 224z"/>
                </svg>`, 
          title: 'Share' 
        },
        { 
          action: 'delete', 
          icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="width: 1.5em; height: 1.5em; fill: currentColor;">
                  <path d="M135.2 17.7C140.6 6.8 151.7 0 163.8 0L284.2 0c12.1 0 23.2 6.8 28.6 17.7L320 32l96 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l96 0 7.2-14.3zM32 128l384 0 0 320c0 35.3-28.7 64-64 64L96 512c-35.3 0-64-28.7-64-64l0-320zm96 64c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16z"/>
                </svg>`, 
          title: 'Delete' 
        }
      );
    }

    return actions.map(({ action, icon, title, link }) => {
      return this.createElement('a', {
        classes: ['text-decoration-none', 'me-3', 'action-icon'],
        attributes: {
          href: '#',
          'data-action': action,
          'data-file-id': id,
          'data-bs-toggle': 'tooltip',
          title: title,
          ...(link ? { 'data-link': link } : {})
        },
        innerHTML: icon
      });
    });
  }

  // Event handling
  initializeTooltips = (modalDiv) => {
    const tooltipTriggerList = modalDiv.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(tooltipTriggerEl => {
      new Tooltip(tooltipTriggerEl);
    });
  }

  setupEventDelegation = (modalElement, userInfo) => {
    modalElement.addEventListener('click', async (e) => {
      const actionIcon = e.target.closest('.action-icon');
      if (!actionIcon) return;

      e.preventDefault();
      
      const action = actionIcon.getAttribute('data-action');
      const fileId = actionIcon.getAttribute('data-file-id');
      const dataLink = actionIcon.getAttribute('data-link');

      try {
        await this.handleAction(action, fileId, dataLink, userInfo);
      } catch (error) {
        console.error(`Error handling action ${action}:`, error);
        this.showErrorMessage(fileId, error.message);
      }
    });
  }

  handleAction = async (action, fileId, dataLink, userInfo) => {
    switch (action) {
      case 'download':
        await this.handleDownload(dataLink);
        break;
      case 'share':
        await this.handleShare(fileId, userInfo);
        break;
      case 'delete':
        await this.handleDelete(fileId);
        break;
      default:
        console.warn(`Unknown action: ${action}`);
    }
  }

  handleDownload = async (dataLink) => {
    try {
      this.showGlobalSpinner();
      await loadGedcomFile(dataLink);
    } finally {
      this.hideGlobalSpinner();
    }
  }

  handleShare = async (fileId, userInfo) => {
    const sanitizedFileId = this.sanitizeFileId(fileId);
    await this.toggleShareForm(fileId);
    await this.initializeShareForm(sanitizedFileId, userInfo);
  }

  handleDelete = async (fileId) => {
    // Implement file deletion logic
    console.log('Delete functionality to be implemented');
  }

  // Share form handling
  toggleShareForm = async (fileId) => {
    const sanitizedFileId = this.sanitizeFileId(fileId);
    
    await this.lazyLoadShareForm(fileId);

    const shareFormRow = document.getElementById(`shareFormRow-${sanitizedFileId}`);
    const collapseElement = document.getElementById(`collapseShare-${sanitizedFileId}`);

    if (shareFormRow && collapseElement) {
      const collapseInstance = new Collapse(collapseElement, {
        toggle: true
      });
      
      shareFormRow.style.display = 
        shareFormRow.style.display === 'none' ? '' : 'none';
      
      return sanitizedFileId;
    }

    throw new Error(`Share form elements not found for file ID: ${fileId}`);
  }

  lazyLoadShareForm = async (fileId) => {
    const sanitizedFileId = this.sanitizeFileId(fileId);
    const existingShareFormRow = document.getElementById(`shareFormRow-${sanitizedFileId}`);
    
    if (existingShareFormRow) {
      console.log(`Share form for file ID ${fileId} already exists.`);
      return;
    }

    const tbody = document.querySelector('#gedcomFilesTable tbody');
    if (!tbody) return;

    const fileRow = document.querySelector(`#gedcomFilesTable tr[data-file-id="${fileId}"]`);
    if (!fileRow) {
      console.error(`File row not found for file ID: ${fileId}`);
      return;
    }

    const shareFormRow = this.createShareFormRow(sanitizedFileId);
    tbody.insertBefore(shareFormRow, fileRow.nextSibling);
  }

  createShareFormRow = (sanitizedFileId) => {
    const shareFormRow = this.createElement('tr', {
      classes: ['share-form-collapse'],
      attributes: { 
        id: `shareFormRow-${sanitizedFileId}`, 
        style: 'display: none;' 
      }
    });

    const shareFormTd = this.createElement('td', { 
      attributes: { colspan: '3' } 
    });

    const collapseDiv = this.createElement('div', { 
      classes: ['collapse'], 
      attributes: { id: `collapseShare-${sanitizedFileId}` } 
    });

    const cardDiv = this.createElement('div', { 
      classes: ['card', 'card-body'] 
    });

    const shareForm = this.createShareForm(sanitizedFileId);
    
    cardDiv.appendChild(shareForm);
    collapseDiv.appendChild(cardDiv);
    shareFormTd.appendChild(collapseDiv);
    shareFormRow.appendChild(shareFormTd);

    return shareFormRow;
  }

  createShareForm = (sanitizedFileId) => {
    const shareForm = this.createElement('form', { 
      attributes: { id: `shareForm-${sanitizedFileId}` } 
    });

    const formGroup = this.createElement('div', { 
      classes: ['mb-3'] 
    });

    // Label
    const label = this.createElement('label', {
      classes: ['form-label'],
      textContent: 'Enter email addresses to share with:'
    });

    // Email table
    const emailTable = this.createElement('table', { 
      classes: ['table', 'table-bordered'],
      attributes: { id: `emailTable-${sanitizedFileId}` }
    });
    const emailTbody = this.createElement('tbody');

    // Create 10 email input rows
    for (let i = 0; i < 10; i++) {
      const tr = this.createElement('tr');
      const td = this.createElement('td');
      
      const inputContainer = this.createElement('div', {
        classes: ['form-group']
      });

      const input = this.createElement('input', {
        classes: ['form-control', 'email-input'],
        attributes: {
          type: 'email',
          id: `email-${sanitizedFileId}-${i}`,
          name: 'emails',
          placeholder: 'e.g., user@example.com'
        }
      });

      const invalidFeedback = this.createElement('div', {
        classes: ['invalid-feedback'],
        textContent: 'Please enter a valid email address.'
      });

      inputContainer.append(input, invalidFeedback);
      td.appendChild(inputContainer);
      tr.appendChild(td);
      emailTbody.appendChild(tr);
    }

    emailTable.appendChild(emailTbody);

    // Submit button with spinner
    const submitButton = this.createElement('button', {
      classes: ['btn', 'btn-primary'],
      attributes: {
        type: 'submit',
        id: `shareSubmit-${sanitizedFileId}`,
        disabled: 'true'
      },
      textContent: 'Share'
    });

    // Spinner for the submit button
    const spinner = this.createElement('span', {
      classes: ['spinner-border', 'spinner-border-sm', 'ms-2'],
      attributes: {
        role: 'status',
        'aria-hidden': 'true',
        id: `shareButtonSpinner-${sanitizedFileId}`,
        style: 'display: none;'
      }
    });

    submitButton.appendChild(spinner);

    // Error container
    const errorContainer = this.createElement('div', {
      classes: ['error-container']
    });

    // Add no-valid-email error message container
    const noValidEmailError = this.createElement('div', {
      classes: ['no-valid-email-error', 'text-danger'],
      attributes: { style: 'display: none;' },
      textContent: 'Please enter at least one valid email address.'
    });

    errorContainer.appendChild(noValidEmailError);

    // Assemble the form
    formGroup.append(label, emailTable, submitButton, errorContainer);
    shareForm.appendChild(formGroup);

    return shareForm;
  }

  initializeShareForm = async (sanitizedFileId, userInfo) => {
    const shareForm = document.getElementById(`shareForm-${sanitizedFileId}`);
    if (!shareForm || shareForm.dataset.initialized) return;

    const shareFormStore = new ShareFormStore();
    this.activeShareForms.add(shareFormStore);

    this.setupEmailValidation(shareForm, shareFormStore);
    this.setupFormSubmission(shareForm, sanitizedFileId, shareFormStore, userInfo);

    shareForm.dataset.initialized = 'true';
  }

  setupEmailValidation = (shareForm, shareFormStore) => {
    const emailInputs = shareForm.querySelectorAll('.email-input');
    emailInputs.forEach((input, index) => {
      input.addEventListener('input', (event) => {
        const email = event.target.value.trim();
        const isValid = shareFormStore.isValidEmail(email) || email === '';
        
        input.classList.toggle('is-invalid', !isValid);
        input.classList.toggle('is-valid', isValid && email !== '');
        
        shareFormStore.setEmail(index, email);
      });
    });

    reaction(
      () => shareFormStore.isValid,
      (isValid) => {
        const submitButton = document.getElementById(`shareSubmit-${sanitizedFileId}`);
        const errorMessage = shareForm.querySelector('.no-valid-email-error');
        
        submitButton.disabled = !isValid;
        if (errorMessage) {
          errorMessage.style.display = isValid ? 'none' : 'block';
        }
      },
      { fireImmediately: true }
    );
  }

  setupFormSubmission = (shareForm, sanitizedFileId, shareFormStore, userInfo) => {
    shareForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const validEmails = shareFormStore.emails.filter(email => 
        shareFormStore.isValidEmail(email.trim())
      );

      if (validEmails.length === 0) return;

      shareForm.style.display = 'none';
      await this.showConfirmationMessage(sanitizedFileId, validEmails, shareForm, userInfo);
    });
  }

  showConfirmationMessage = async (sanitizedFileId, emails, shareForm, userInfo) => {
    const confirmationContainer = this.createElement('div', {
      attributes: { 
        id: `confirmationContainer-${sanitizedFileId}`,
        class: 'confirmation-container'
      }
    });

    confirmationContainer.innerHTML = `
      <p>Confirmez-vous le partage du fichier avec les adresses suivantes :</p>
      <ul>${emails.map(email => `<li>${email}</li>`).join('')}</ul>
      <button class="btn btn-success me-2">Oui</button>
      <button class="btn btn-secondary">Non</button>
    `;

    shareForm.parentNode.appendChild(confirmationContainer);

    confirmationContainer.addEventListener('click', (event) => {
      if (event.target.matches('.btn-success')) {
        this.proceedWithSharing(sanitizedFileId, emails, userInfo);
        confirmationContainer.remove();
      } else if (event.target.matches('.btn-secondary')) {
        confirmationContainer.remove();
        shareForm.style.display = 'block';
      }
    });
  }

  proceedWithSharing = async (sanitizedFileId, emails, userInfo) => {
    const workerEndpoint = "https://file-sharing-orchestrator.genealogie.app";
    this.showButtonSpinner(sanitizedFileId);

    try {
      const response = await fetch(workerEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: sanitizedFileId,
          emails,
          ownerUserId: userInfo.id,
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      this.showSuccessMessage(sanitizedFileId, result);
    } catch (error) {
      this.showErrorMessage(sanitizedFileId, error.message);
    } finally {
      this.hideButtonSpinner(sanitizedFileId);
    }
  }

  // UI feedback methods
  showSuccessMessage = (sanitizedFileId, result) => {
    const message = this.createElement('div', {
      classes: ['alert', 'alert-success', 'mt-3'],
      innerHTML: `Le fichier a été partagé avec succès avec les adresses suivantes :
        <ul>${result.results?.map(item => `<li>${item.email}: ${item.result}</li>`).join('') || 
        '<li>Aucune adresse trouvée.</li>'}</ul>`
    });

    const container = document.getElementById(`shareForm-${sanitizedFileId}`).parentNode;
    container.appendChild(message);
  }

  showErrorMessage = (sanitizedFileId, errorMessage) => {
    const container = this.createElement('div', {
      classes: ['alert', 'alert-danger', 'mt-3'],
      textContent: `Une erreur s'est produite : ${errorMessage}`
    });

    const formContainer = document.getElementById(`shareForm-${sanitizedFileId}`).parentNode;
    formContainer.appendChild(container);
  }

  showGlobalSpinner = () => {
    const spinner = document.getElementById('loadingSpinner');
    const content = document.getElementById('modalContent');
    if (spinner && content) {
      spinner.style.display = 'block';
      content.style.opacity = '0.5';
    }
  }

  hideGlobalSpinner = () => {
    const spinner = document.getElementById('loadingSpinner');
    const content = document.getElementById('modalContent');
    if (spinner && content) {
      spinner.style.display = 'none';
      content.style.opacity = '1';
    }
  }

  showButtonSpinner = (sanitizedFileId) => {
    const spinner = document.getElementById(`shareButtonSpinner-${sanitizedFileId}`);
    if (spinner) {
      spinner.style.display = 'inline-block';
    }
  }

  hideButtonSpinner = (sanitizedFileId) => {
    const spinner = document.getElementById(`shareButtonSpinner-${sanitizedFileId}`);
    if (spinner) {
      spinner.style.display = 'none';
    }
  }

  cleanup = () => {
    this.activeShareForms.clear();
    if (this.currentModal) {
      this.currentModal.dispose();
      this.currentModal = null;
    }
  }
}

// Create and export singleton instance
const gedcomModalManager = new GedcomModalManager();
export default gedcomModalManager;