import { Collapse } from "bootstrap";

/**
 * Function to create an HTML element with attributes and classes.
 * @param {string} tag - The HTML tag to create (e.g., 'div', 'button').
 * @param {Object} options - Options to add attributes, classes, or other properties.
 * @returns {HTMLElement} - The newly created DOM element.
 */
export function createElement(tag, options = {}) {
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

/**
 * Function to sanitize file IDs by replacing spaces with underscores.
 * @param {string} fileId - The file ID to sanitize.
 * @returns {string} - The sanitized file ID.
 */
export function sanitizeFileId(fileId) {
  if (fileId == null) {
    throw new TypeError('fileId cannot be null or undefined');
  }
  return fileId.replace(/\s+/g, '_');
}

/**
 * Function to create the HTML structure of the GEDCOM modal.
 * @param {Array} files - List of GEDCOM files to display in the modal.
 * @param {Function} sanitizeFileId - Function to sanitize file IDs.
 * @returns {HTMLElement} - The DOM element of the modal.
 */
export function createGedcomModal(files, sanitizeFileId) {
  const fragment = document.createDocumentFragment();

  const modalDiv = createElement('div', {
    classes: ['modal', 'fade'],
    attributes: {
      id: 'gedcomFilesModal',
      tabindex: '-1',
      'aria-labelledby': 'gedcomFilesModalLabel',
      'aria-hidden': 'true'
    }
  });

  const modalDialog = createElement('div', { classes: ['modal-dialog', 'modal-lg'] });
  const modalContent = createElement('div', { classes: ['modal-content'] });
  const modalHeader = createElement('div', { classes: ['modal-header'] });

  const modalTitle = createElement('h5', {
    classes: ['modal-title'],
    attributes: { id: 'gedcomFilesModalLabel' },
    textContent: 'My GEDCOM Files'
  });

  const closeButton = createElement('button', {
    classes: ['btn-close'],
    attributes: {
      type: 'button',
      'data-bs-dismiss': 'modal',
      'aria-label': 'Close'
    }
  });

  modalHeader.append(modalTitle, closeButton);

  const modalBody = createElement('div', { classes: ['modal-body', 'position-relative'] });

  const loadingSpinner = createElement('div', {
    classes: ['position-absolute', 'top-50', 'start-50', 'translate-middle'],
    attributes: { id: 'loadingSpinner', style: 'display: none; z-index: 1051;' }
  });

  const spinner = createElement('div', { classes: ['spinner-border', 'text-primary'], attributes: { role: 'status' } });
  const spinnerSpan = createElement('span', { classes: ['visually-hidden'], textContent: 'Loading...' });

  spinner.appendChild(spinnerSpan);
  loadingSpinner.appendChild(spinner);
  modalBody.appendChild(loadingSpinner);

  const modalContentContainer = createElement('div', { attributes: { id: 'modalContent' } });

  const table = createElement('table', { classes: ['table'], attributes: { id: 'gedcomFilesTable' } });
  const thead = createElement('thead');
  const headerRow = createElement('tr');

  const headers = ['File Name', 'Status', 'Actions'];
  headers.forEach((headerText) => {
    const th = createElement('th', { attributes: { scope: 'col' }, textContent: headerText });
    if (headerText === 'Actions') th.classList.add('text-end');
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = createElement('tbody');

  files.forEach(({ id, name, status, signedUrl }) => {
    if (!id) {
      console.error('Error: File ID is null or undefined for file:', { id, name, status });
      return;
    }

    const sanitizedFileId = sanitizeFileId(id);
    const fileRow = createElement('tr', { attributes: { 'data-file-id': id } });

    const tdName = createElement('td', { textContent: name });
    const tdStatus = createElement('td', { textContent: status === 'owned' ? 'Owner' : 'Authorized' });
    const tdActions = createElement('td', { classes: ['text-end'] });

    const actions = [
      { 
        action: 'download', 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" style="width: 1.5em; height: 1.5em; fill: currentColor;">
                <path d="M144 160A80 80 0 1 0 144 0a80 80 0 1 0 0 160zm368 0A80 80 0 1 0 512 0a80 80 0 1 0 0 160zM0 298.7C0 310.4 9.6 320 21.3 320l213.3 0c.2 0 .4 0 .7 0c-26.6-23.5-43.3-57.8-43.3-96c0-7.6 .7-15 1.9-22.3c-13.6-6.3-28.7-9.7-44.6-9.7l-42.7 0C47.8 192 0 239.8 0 298.7zM320 320c24 0 45.9-8.8 62.7-23.3c2.5-3.7 5.2-7.3 8-10.7c2.7-3.3 5.7-6.1 9-8.3C410 262.3 416 243.9 416 224c0-53-43-96-96-96s-96 43-96 96s43 96 96 96zm65.4 60.2c-10.3-5.9-18.1-16.2-20.8-28.2l-103.2 0C187.7 352 128 411.7 128 485.3c0 14.7 11.9 26.7 26.7 26.7l300.6 0c-2.1-5.2-3.2-10.9-3.2-16.4l0-3c-1.3-.7-2.7-1.5-4-2.3l-2.6 1.5c-16.8 9.7-40.5 8-54.7-9.7c-4.5-5.6-8.6-11.5-12.4-17.6l-.1-.2-.1-.2-2.4-4.1-.1-.2-.1-.2c-3.4-6.2-6.4-12.6-9-19.3c-8.2-21.2 2.2-42.6 19-52.3l2.7-1.5c0-.8 0-1.5 0-2.3s0-1.5 0-2.3l-2.7-1.5zM533.3 192l-42.7 0c-15.9 0-31 3.5-44.6 9.7c1.3 7.2 1.9 14.7 1.9 22.3c0 17.4-3.5 33.9-9.7 49c2.5 .9 4.9 2 7.1 3.3l2.6 1.5c1.3-.8 2.6-1.6 4-2.3l0-3c0-19.4 13.3-39.1 35.8-42.6c7.9-1.2 16-1.9 24.2-1.9s16.3 .6 24.2 1.9c22.5 3.5 35.8 23.2 35.8 42.6l0 3c1.3 .7 2.7 1.5 4 2.3l2.6-1.5c16.8-9.7 40.5-8 54.7 9.7c2.3 2.8 4.5 5.8 6.6 8.7c-2.1-57.1-49-102.7-106.6-102.7zm91.3 163.9c6.3-3.6 9.5-11.1 6.8-18c-2.1-5.5-4.6-10.8-7.4-15.9l-2.3-4c-3.1-5.1-6.5-9.9-10.2-14.5c-4.6-5.7-12.7-6.7-19-3l-2.9 1.7c-9.2 5.3-20.4 4-29.6-1.3s-16.1-14.5-16.1-25.1l0-3.4c0-7.3-4.9-13.8-12.1-14.9c-6.5-1-13.1-1.5-19.9-1.5s-13.4 .5-19.9 1.5c-7.2 1.1-12.1 7.6-12.1 14.9l0 3.4c0 10.6-6.9 19.8-16.1 25.1s-20.4 6.6-29.6 1.3l-2.9-1.7c-6.3-3.6-14.4-2.6-19 3c-3.7 4.6-7.1 9.5-10.2 14.6l-2.3 3.9c-2.8 5.1-5.3 10.4-7.4 15.9c-2.6 6.8 .5 14.3 6.8 17.9l2.9 1.7c9.2 5.3 13.7 15.8 13.7 26.4s-4.5 21.1-13.7 26.4l-3 1.7c-6.3 3.6-9.5 11.1-6.8 17.9c2.1 5.5 4.6 10.7 7.4 15.8l2.4 4.1c3 5.1 6.4 9.9 10.1 14.5c4.6 5.7 12.7 6.7 19 3l2.9-1.7c9.2-5.3 20.4-4 29.6 1.3s16.1 14.5 16.1 25.1l0 3.4c0 7.3 4.9 13.8 12.1 14.9c6.5 1 13.1 1.5 19.9 1.5s13.4-.5 19.9-1.5c7.2-1.1 12.1-7.6 12.1-14.9l0-3.4c0-10.6 6.9-19.8 16.1-25.1s20.4-6.6 29.6-1.3l2.9 1.7c6.3 3.6 14.4 2.6 19-3c3.7-4.6 7.1-9.4 10.1-14.5l2.4-4.2c2.8-5.1 5.3-10.3 7.4-15.8c2.6-6.8-.5-14.3-6.8-17.9l-3-1.7c-9.2-5.3-13.7-15.8-13.7-26.4s4.5-21.1 13.7-26.4l3-1.7zM472 384a40 40 0 1 1 80 0 40 40 0 1 1 -80 0z"/>
              </svg>`, 
        title: 'Download', 
        link: signedUrl 
      },
      ...(status === 'owned' ? [
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
      ] : [])
    ];

    actions.forEach(({ action, icon, title, link }) => {
      const actionLink = createElement('a', {
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
    
      tdActions.appendChild(actionLink);
    });

    fileRow.append(tdName, tdStatus, tdActions);
    tbody.appendChild(fileRow);
  });

  table.appendChild(tbody);
  modalContentContainer.appendChild(table);
  modalBody.appendChild(modalContentContainer);
  modalContent.append(modalHeader, modalBody);
  modalDialog.appendChild(modalContent);
  modalDiv.appendChild(modalDialog);
  fragment.appendChild(modalDiv);

  return modalDiv;
}


/**
 * Lazy loads the share form when the share button is clicked.
 * @param {String} fileId - The ID of the file for which the share form is needed.
 * @param {Function} sanitizeFileId - Function to sanitize file IDs.
 */
export async function lazyLoadShareForm(fileId, sanitizeFileId) {
  return new Promise((resolve) => {
    const sanitizedFileId = sanitizeFileId(fileId);
    const existingShareFormRow = document.getElementById(`shareFormRow-${sanitizedFileId}`);
  
    if (existingShareFormRow) {
      console.log(`Share form for file ID ${fileId} already exists.`);
      return;
    }
  
    const tbody = document.querySelector('#gedcomFilesTable tbody');
    if (!tbody) return;
  
    // Find the corresponding file row to insert after
    const fileRow = document.querySelector(`#gedcomFilesTable tr[data-file-id="${fileId}"]`);
    if (!fileRow) {
      console.error(`File row not found for file ID: ${fileId}`);
      return;
    }
  
    // Create the share form row
    const shareFormRow = createElement('tr', {
      classes: ['share-form-collapse'],
      attributes: { id: `shareFormRow-${sanitizedFileId}`, style: 'display: none;' }
    });
  
    const shareFormTd = createElement('td', { attributes: { colspan: '3' } });
    const collapseDiv = createElement('div', { classes: ['collapse'], attributes: { id: `collapseShare-${sanitizedFileId}` } });
    const cardDiv = createElement('div', { classes: ['card', 'card-body'] });
    const shareForm = createElement('form', { attributes: { id: `shareForm-${sanitizedFileId}` } });
    const formGroup = createElement('div', { classes: ['mb-3'] });
  
    const label = createElement('label', {
      classes: ['form-label'],
      attributes: { for: `emailTable-${sanitizedFileId}` },
      textContent: 'Enter email addresses to share with:'
    });
  
    const emailTable = createElement('table', { classes: ['table', 'table-bordered'], attributes: { id: `emailTable-${sanitizedFileId}` } });
    const emailTbody = createElement('tbody');
  
    for (let i = 1; i <= 10; i++) {
      const emailRow = createElement('tr');
      const emailTd = createElement('td');
  
      const emailInput = createElement('input', {
        classes: ['form-control', 'email-input'],
        attributes: {
          type: 'email',
          id: `email-${sanitizedFileId}-${i}`,
          name: 'emails',
          placeholder: 'e.g., user@example.com'
        }
      });
  
      const invalidFeedback = createElement('div', { classes: ['invalid-feedback'], textContent: 'Please enter a valid email address.' });
  
      emailTd.append(emailInput, invalidFeedback);
      emailRow.appendChild(emailTd);
      emailTbody.appendChild(emailRow);
    }
  
    emailTable.appendChild(emailTbody);
    formGroup.append(label, emailTable);
  
    const submitButton = createElement('button', {
      classes: ['btn', 'btn-primary'],
      attributes: { 
        type: 'submit', 
        id: `shareSubmit-${sanitizedFileId}`,
        disabled: true // Le bouton est désactivé par défaut
      },
      textContent: 'Share'
    });
    
    const shareButtonSpinner = createElement('span', {
      classes: ['spinner-border', 'spinner-border-sm', 'ms-2'],
      attributes: { role: 'status', 'aria-hidden': 'true', style: 'display: none;', id: `shareButtonSpinner-${sanitizedFileId}` }
    });
  
    submitButton.appendChild(shareButtonSpinner);
    formGroup.appendChild(submitButton);
    const errorContainer = createElement('div', { classes: ['error-container'] });
    formGroup.appendChild(errorContainer);
    shareForm.appendChild(formGroup);
    cardDiv.appendChild(shareForm);
    collapseDiv.appendChild(cardDiv);
    shareFormTd.appendChild(collapseDiv);
    shareFormRow.appendChild(shareFormTd);
  
    // Insert the share form row just after the corresponding file row
    tbody.insertBefore(shareFormRow, fileRow.nextSibling);

    // Résoudre la promesse après l'insertion dans le DOM
    resolve();
  });
}

export async function toggleShareForm(fileId) {
  const sanitizedFileId = sanitizeFileId(fileId);
  let shareFormRow = document.getElementById(`shareFormRow-${sanitizedFileId}`);
  let collapseElement = document.getElementById(`collapseShare-${sanitizedFileId}`);

  // Si le formulaire de partage n'existe pas, le charger paresseusement
  if (!shareFormRow || !collapseElement) {
    console.log(`Share form for file ID ${fileId} not found. Lazy loading the share form.`);
    await lazyLoadShareForm(fileId, sanitizeFileId);

    // Après le chargement, mettre à jour les références
    shareFormRow = document.getElementById(`shareFormRow-${sanitizedFileId}`);
    collapseElement = document.getElementById(`collapseShare-${sanitizedFileId}`);
  }

  if (shareFormRow && collapseElement) {
    const collapseInstance = new Collapse(collapseElement, {
      toggle: true
    });
    shareFormRow.style.display = shareFormRow.style.display === 'none' ? '' : 'none';
    console.log(`Collapse toggled for file ID: ${fileId}`);

    return sanitizedFileId;
  } else {
    console.error(`Share form elements not found for file ID: ${fileId} even after lazy loading.`);
    throw new Error(`Share form elements not found for file ID: ${fileId}`);
  }
}

