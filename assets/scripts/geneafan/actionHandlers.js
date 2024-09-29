
import { showGlobalSpinner, hideGlobalSpinner, showButtonSpinner, hideButtonSpinner } from './spinners.js';
import { checkForDuplicateEmails, isValidEmail } from './formValidation.js';
// import { verifyAndCreateUsers, grantAccessToFile } from './api.js';
import { sanitizeFileId } from './utils.js';
import { Collapse } from 'bootstrap';

export async function handleActionClick(e) {
  const actionIcon = e.target.closest('.action-icon');
  if (actionIcon) {
    e.preventDefault();
    const action = actionIcon.getAttribute('data-action');
    const fileId = actionIcon.getAttribute('data-file-id');
    console.log(`Action triggered: ${action} for file ID: ${fileId}`);

    if (action === 'download') {
      const dataLink = actionIcon.getAttribute('data-link');
      console.log(`Download link: ${dataLink}`);
      loadGedcomFile(dataLink);
    } else if (action === 'share') {
      console.log(`Share file ID: ${fileId}`);
      toggleShareForm(fileId);
    } else if (action === 'delete') {
      console.log(`Delete file ID: ${fileId}`);
      deleteFile(fileId);
    }
  }
}

export function toggleShareForm(fileId) {
  const sanitizedFileId = sanitizeFileId(fileId);
  const shareFormRow = document.getElementById(`shareFormRow-${sanitizedFileId}`);
  const collapseElement = document.getElementById(`collapseShare-${sanitizedFileId}`);

  if (shareFormRow && collapseElement) {
    const collapseInstance = new Collapse(collapseElement, { toggle: true });
    shareFormRow.style.display = shareFormRow.style.display === 'none' ? '' : 'none';
    console.log(`Collapse toggled for file ID: ${fileId}`);
    initializeShareForm(sanitizedFileId);
  } else {
    console.error(`Share form elements not found for file ID: ${fileId}`);
  }
}

// Function to initialize the share form for a specific file
export async function initializeShareForm(sanitizedFileId) {
  const shareForm = document.getElementById(`shareForm-${sanitizedFileId}`);
  const emailInputs = shareForm.querySelectorAll('.email-input');
  const shareSubmitButton = document.getElementById(`shareSubmit-${sanitizedFileId}`);
  const shareButtonSpinner = document.getElementById(`shareButtonSpinner-${sanitizedFileId}`);

  if (shareForm) {
    // Attach event listeners for email validation
    emailInputs.forEach(input => {
      input.addEventListener('input', handleEmailInput);
      input.addEventListener('input', () => toggleSubmitButton(sanitizedFileId));
    });

    // Initially check to enable/disable the submit button
    toggleSubmitButton(sanitizedFileId);

    // Attach submit handler to the share form
    shareForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      // Validate the form inputs
      let isFormValid = true;

      // Validate each email field
      emailInputs.forEach(input => {
        const email = input.value.trim();
        const isValid = isValidEmail(email);
        if (!isValid) {
          input.classList.add('is-invalid');
          isFormValid = false;
        } else {
          input.classList.remove('is-invalid');
          input.classList.add('is-valid');
        }
      });

      // Check for duplicate emails
      if (!checkForDuplicateEmails(sanitizedFileId)) {
        isFormValid = false;
      }

      if (!isFormValid) {
        alert('Please correct the errors in the form before submitting.');
        const firstInvalid = shareForm.querySelector('.is-invalid');
        if (firstInvalid) {
          firstInvalid.focus();
        }
        return;
      }

      const emails = Array.from(emailInputs)
        .map(input => input.value.trim())
        .filter(email => email);

      console.log(`Sharing file with emails: ${emails.join(', ')}`);

      try {
        showGlobalSpinner(); // Show global spinner before starting the sharing operation
        shareSubmitButton.disabled = true; // Disable submit button to prevent multiple submissions
        showButtonSpinner(sanitizedFileId); // Show spinner on the submit button

        // Verify and create users via Clerk
        const verifiedUserIds = await verifyAndCreateUsers(emails);
        console.log(`Verified user IDs: ${verifiedUserIds.join(', ')}`);

        if (verifiedUserIds.length === 0) {
          alert('No valid users found to share the file with.');
          console.log('No valid users to share the file.');
          hideGlobalSpinner(); // Hide global spinner as operation is complete
          shareSubmitButton.disabled = false;
          hideButtonSpinner(sanitizedFileId);
          return;
        }

        // Grant access to each verified user
        for (const userId of verifiedUserIds) {
          console.log(`Granting access to user ID: ${userId}`);
          const success = await grantAccessToFile(sanitizedFileId, userId);
          if (!success) {
            throw new Error(`Failed to grant access to user ID: ${userId}`);
          }
        }

        alert('File shared successfully!');
        console.log('File shared successfully.');

        // Optionally close the share form and reset the fields
        const collapseElement = document.getElementById(`collapseShare-${sanitizedFileId}`);
        const collapseInstance = new Collapse(collapseElement, {
          toggle: true
        });
        collapseInstance.hide();
        shareForm.reset();
        console.log('Share form closed and fields reset.');

        hideGlobalSpinner(); // Hide global spinner after operation completion
        shareSubmitButton.disabled = false;
        hideButtonSpinner(sanitizedFileId);

      } catch (error) {
        hideGlobalSpinner(); // Hide global spinner in case of error
        console.error('Error sharing the file:', error);
        alert('An error occurred while sharing the file.');
        shareSubmitButton.disabled = false;
        hideButtonSpinner(sanitizedFileId);
      }
    });

    console.log(`Event listener added to the share form for file ID: ${sanitizedFileId}`);
  } else {
    console.error(`Share form not found for file ID: ${sanitizedFileId}`);
  }
}

// Helper function to validate email input in real-time
function handleEmailInput(event) {
  const input = event.target;
  const isValid = isValidEmail(input.value.trim());

  if (isValid) {
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    // Remove duplicate feedback if it exists
    const duplicateFeedback = input.parentElement.querySelector('.invalid-feedback.duplicate-feedback');
    if (duplicateFeedback) {
      duplicateFeedback.remove();
    }
  } else {
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
  }

  // Check for duplicate emails
  const sanitizedFileId = input.id.split('-')[1]; // Extract file ID from the input ID
  checkForDuplicateEmails(sanitizedFileId);
}

// Function to toggle the submit button's disabled state
function toggleSubmitButton(sanitizedFileId) {
  const shareForm = document.getElementById(`shareForm-${sanitizedFileId}`);
  if (!shareForm) {
    return;
  }

  const emailInputs = shareForm.querySelectorAll('.email-input');
  const submitButton = document.getElementById(`shareSubmit-${sanitizedFileId}`);

  // Enable submit button only if all fields are filled with valid emails and there are no duplicates
  const allFieldsFilled = Array.from(emailInputs).every(input => input.value.trim() !== '' && isValidEmail(input.value.trim()));
  const noDuplicates = checkForDuplicateEmails(sanitizedFileId);

  submitButton.disabled = !(allFieldsFilled && noDuplicates);
}
