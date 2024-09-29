export function createModal(files) {
    const modalDiv = document.createElement('div');
    modalDiv.classList.add('modal', 'fade');
    modalDiv.id = 'gedcomFilesModal';
    modalDiv.setAttribute('tabindex', '-1');
    modalDiv.setAttribute('aria-labelledby', 'gedcomFilesModalLabel');
    modalDiv.setAttribute('aria-hidden', 'true');
  
    const modalDialog = document.createElement('div');
    modalDialog.classList.add('modal-dialog', 'modal-lg');
  
    const modalContent = document.createElement('div');
    modalContent.classList.add('modal-content');
  
    const modalHeader = createModalHeader();
    const modalBody = createModalBody(files);
  
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalDialog.appendChild(modalContent);
    modalDiv.appendChild(modalDialog);
  
    return modalDiv;
  }
  
  function createModalHeader() {
    const modalHeader = document.createElement('div');
    modalHeader.classList.add('modal-header');
  
    const modalTitle = document.createElement('h5');
    modalTitle.classList.add('modal-title');
    modalTitle.id = 'gedcomFilesModalLabel';
    modalTitle.textContent = 'My GEDCOM Files';
  
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.classList.add('btn-close');
    closeButton.setAttribute('data-bs-dismiss', 'modal');
    closeButton.setAttribute('aria-label', 'Close');
  
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    return modalHeader;
  }
  
  function createModalBody(files) {
    const modalBody = document.createElement('div');
    modalBody.classList.add('modal-body', 'position-relative');
  
    // Spinner global
    modalBody.appendChild(createGlobalSpinner());
  
    // Modal content container
    const modalContentContainer = document.createElement('div');
    modalContentContainer.id = 'modalContent';
    modalContentContainer.appendChild(createFilesTable(files));
  
    modalBody.appendChild(modalContentContainer);
    return modalBody;
  }
  
  function createGlobalSpinner() {
    const loadingSpinner = document.createElement('div');
    loadingSpinner.id = 'loadingSpinner';
    loadingSpinner.classList.add('position-absolute', 'top-50', 'start-50', 'translate-middle');
    loadingSpinner.style.display = 'none';
    loadingSpinner.style.zIndex = '1051';
  
    const spinner = document.createElement('div');
    spinner.classList.add('spinner-border', 'text-primary');
    spinner.setAttribute('role', 'status');
  
    const spinnerSpan = document.createElement('span');
    spinnerSpan.classList.add('visually-hidden');
    spinnerSpan.textContent = 'Loading...';
  
    spinner.appendChild(spinnerSpan);
    loadingSpinner.appendChild(spinner);
    return loadingSpinner;
  }
  
  export function initializeModal(modalElement) {
    const gedcomFilesModal = new Modal(modalElement);
    gedcomFilesModal.show();
  }
  
  export function removeExistingModal(modalId) {
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
      existingModal.remove();
      console.log('Existing modal removed.');
    }
  }
  
  // Function to create the table containing the list of files
  export function createFilesTable(files) {
    const table = document.createElement('table');
    table.classList.add('table');
    table.id = 'gedcomFilesTable';
  
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
  
    const thName = document.createElement('th');
    thName.setAttribute('scope', 'col');
    thName.textContent = 'File Name';
  
    const thStatus = document.createElement('th');
    thStatus.setAttribute('scope', 'col');
    thStatus.textContent = 'Status';
  
    const thActions = document.createElement('th');
    thActions.setAttribute('scope', 'col');
    thActions.classList.add('text-end');
    thActions.textContent = 'Actions';
  
    headerRow.appendChild(thName);
    headerRow.appendChild(thStatus);
    headerRow.appendChild(thActions);
    thead.appendChild(headerRow);
    table.appendChild(thead);
  
    const tbody = document.createElement('tbody');
  
    files.forEach(file => {
      const sanitizedFileId = file.id.replace(/\s+/g, '_');
      const fileRow = document.createElement('tr');
  
      const tdName = document.createElement('td');
      tdName.textContent = file.name;
  
      const tdStatus = document.createElement('td');
      tdStatus.textContent = file.status === 'owned' ? 'Owner' : 'Authorized';
  
      const tdActions = document.createElement('td');
      tdActions.classList.add('text-end');
  
      // Download icon
      const downloadLink = createActionIcon('download', file.id, 'Download', 'bi-download', file.signedUrl);
      tdActions.appendChild(downloadLink);
  
      if (file.status === 'owned') {
        // Share icon
        const shareLink = createActionIcon('share', file.id, 'Share', 'bi-share');
        tdActions.appendChild(shareLink);
  
        // Delete icon
        const deleteLink = createActionIcon('delete', file.id, 'Delete', 'bi-trash');
        tdActions.appendChild(deleteLink);
      }
  
      fileRow.appendChild(tdName);
      fileRow.appendChild(tdStatus);
      fileRow.appendChild(tdActions);
      tbody.appendChild(fileRow);
  
      // If the file is owned, add the share form row
      if (file.status === 'owned') {
        const shareFormRow = createShareFormRow(sanitizedFileId);
        tbody.appendChild(shareFormRow);
      }
    });
  
    table.appendChild(tbody);
    return table;
  }
  
  function createActionIcon(action, fileId, title, iconClass, linkHref = '#') {
    const actionLink = document.createElement('a');
    actionLink.href = linkHref;
    actionLink.classList.add('text-decoration-none', 'me-2', 'action-icon');
    actionLink.setAttribute('data-action', action);
    actionLink.setAttribute('data-file-id', fileId);
    actionLink.setAttribute('data-bs-toggle', 'tooltip');
    actionLink.setAttribute('title', title);
  
    const icon = document.createElement('i');
    icon.classList.add('bi', iconClass);
    actionLink.appendChild(icon);
  
    return actionLink;
  }
  
  function createShareFormRow(sanitizedFileId) {
    const shareFormRow = document.createElement('tr');
    shareFormRow.classList.add('share-form-collapse');
    shareFormRow.id = `shareFormRow-${sanitizedFileId}`;
    shareFormRow.style.display = 'none';
  
    const shareFormTd = document.createElement('td');
    shareFormTd.setAttribute('colspan', '3');
  
    const collapseDiv = document.createElement('div');
    collapseDiv.classList.add('collapse');
    collapseDiv.id = `collapseShare-${sanitizedFileId}`;
  
    const cardDiv = document.createElement('div');
    cardDiv.classList.add('card', 'card-body');
  
    const shareForm = document.createElement('form');
    shareForm.id = `shareForm-${sanitizedFileId}`;
  
    const formGroup = document.createElement('div');
    formGroup.classList.add('mb-3');
  
    const label = document.createElement('label');
    label.classList.add('form-label');
    label.setAttribute('for', `emailTable-${sanitizedFileId}`);
    label.textContent = 'Enter email addresses to share with:';
  
    const emailTable = document.createElement('table');
    emailTable.classList.add('table', 'table-bordered');
    emailTable.id = `emailTable-${sanitizedFileId}`;
  
    const emailTbody = document.createElement('tbody');
    for (let i = 1; i <= 10; i++) {
      const emailRow = document.createElement('tr');
      const emailTd = document.createElement('td');
  
      const emailInput = document.createElement('input');
      emailInput.type = 'email';
      emailInput.classList.add('form-control', 'email-input');
      emailInput.id = `email-${sanitizedFileId}-${i}`;
      emailInput.name = 'emails';
      emailInput.placeholder = 'e.g., user@example.com';
      emailInput.required = true;
  
      // Add invalid feedback element
      const invalidFeedback = document.createElement('div');
      invalidFeedback.classList.add('invalid-feedback');
      invalidFeedback.textContent = 'Please enter a valid email address.';
  
      emailTd.appendChild(emailInput);
      emailTd.appendChild(invalidFeedback);
      emailRow.appendChild(emailTd);
      emailTbody.appendChild(emailRow);
    }
    emailTable.appendChild(emailTbody);
    formGroup.appendChild(label);
    formGroup.appendChild(emailTable);
  
    // Share button with inline spinner
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.classList.add('btn', 'btn-primary');
    submitButton.id = `shareSubmit-${sanitizedFileId}`;
    submitButton.textContent = 'Share';
  
    const shareButtonSpinner = document.createElement('span');
    shareButtonSpinner.classList.add('spinner-border', 'spinner-border-sm', 'ms-2');
    shareButtonSpinner.setAttribute('role', 'status');
    shareButtonSpinner.setAttribute('aria-hidden', 'true');
    shareButtonSpinner.style.display = 'none';
    shareButtonSpinner.id = `shareButtonSpinner-${sanitizedFileId}`;
  
    submitButton.appendChild(shareButtonSpinner);
    formGroup.appendChild(submitButton);
  
    shareForm.appendChild(formGroup);
    cardDiv.appendChild(shareForm);
    collapseDiv.appendChild(cardDiv);
    shareFormTd.appendChild(collapseDiv);
    shareFormRow.appendChild(shareFormTd);
    return shareFormRow;
  }
  