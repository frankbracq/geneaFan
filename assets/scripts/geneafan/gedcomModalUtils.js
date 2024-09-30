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
export function createModal(files, sanitizeFileId) {
  const createElement = (tag, options = {}) => {
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
  };

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

  const thName = createElement('th', { attributes: { scope: 'col' }, textContent: 'File Name' });
  const thStatus = createElement('th', { attributes: { scope: 'col' }, textContent: 'Status' });
  const thActions = createElement('th', { classes: ['text-end'], attributes: { scope: 'col' }, textContent: 'Actions' });

  headerRow.append(thName, thStatus, thActions);
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = createElement('tbody');

  files.forEach(file => {
    if (!file.id) {
      console.error('Error: File ID is null or undefined for file:', file);
      return;
    }

    const sanitizedFileId = sanitizeFileId(file.id);
    const fileRow = createElement('tr');

    const tdName = createElement('td', { textContent: file.name });
    const tdStatus = createElement('td', { textContent: file.status === 'owned' ? 'Owner' : 'Authorized' });
    const tdActions = createElement('td', { classes: ['text-end'] });

    const createActionLink = (action, iconClass, title, link) => {
      const actionLink = createElement('a', {
        classes: ['text-decoration-none', 'me-2', 'action-icon'],
        attributes: {
          href: '#',
          'data-action': action,
          'data-file-id': file.id,
          'data-bs-toggle': 'tooltip',
          title: title
        }
      });
      if (link) actionLink.setAttribute('data-link', link);
      const actionIcon = createElement('i', { classes: ['bi', iconClass] });
      actionLink.appendChild(actionIcon);
      return actionLink;
    };

    tdActions.appendChild(createActionLink('download', 'bi-download', 'Download', file.signedUrl));

    if (file.status === 'owned') {
      tdActions.appendChild(createActionLink('share', 'bi-share', 'Share'));
      tdActions.appendChild(createActionLink('delete', 'bi-trash', 'Delete'));
    }

    fileRow.append(tdName, tdStatus, tdActions);
    tbody.appendChild(fileRow);

    if (file.status === 'owned') {
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
            placeholder: 'e.g., user@example.com',
            required: true
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
        attributes: { type: 'submit', id: `shareSubmit-${sanitizedFileId}` },
        textContent: 'Share'
      });

      const shareButtonSpinner = createElement('span', {
        classes: ['spinner-border', 'spinner-border-sm', 'ms-2'],
        attributes: { role: 'status', 'aria-hidden': 'true', style: 'display: none;', id: `shareButtonSpinner-${sanitizedFileId}` }
      });

      submitButton.appendChild(shareButtonSpinner);
      formGroup.appendChild(submitButton);

      shareForm.appendChild(formGroup);
      cardDiv.appendChild(shareForm);
      collapseDiv.appendChild(cardDiv);
      shareFormTd.appendChild(collapseDiv);
      shareFormRow.appendChild(shareFormTd);
      tbody.appendChild(shareFormRow);
    }
  });

  table.append(tbody);
  modalContentContainer.appendChild(table);
  modalBody.appendChild(modalContentContainer);
  modalContent.append(modalHeader, modalBody);
  modalDialog.appendChild(modalContent);
  modalDiv.appendChild(modalDialog);
  fragment.appendChild(modalDiv);

  return modalDiv;
}