// Function to validate email format using regex
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function checkForDuplicateEmails(sanitizedFileId) {
    const shareForm = document.getElementById(`shareForm-${sanitizedFileId}`);
    if (!shareForm) return false;

    const emailInputs = shareForm.querySelectorAll('.email-input');
    const emailValues = Array.from(emailInputs)
        .map(input => input.value.trim().toLowerCase())
        .filter(email => email);

    const duplicates = emailValues.filter((email, index) => emailValues.indexOf(email) !== index);

    // Highlight duplicate inputs
    emailInputs.forEach(input => {
        if (duplicates.includes(input.value.trim().toLowerCase())) {
            input.classList.add('is-invalid');
            if (!input.parentElement.querySelector('.invalid-feedback.duplicate-feedback')) {
                const feedback = document.createElement('div');
                feedback.classList.add('invalid-feedback', 'duplicate-feedback');
                feedback.textContent = 'This email address is duplicated.';
                input.parentElement.appendChild(feedback);
            }
        } else {
            input.classList.remove('is-invalid');
            const feedback = input.parentElement.querySelector('.invalid-feedback.duplicate-feedback');
            if (feedback) {
                feedback.remove();
            }
        }
    });

    return duplicates.length === 0;
}

// Function to handle real-time email validation
export function handleEmailInput(event) {
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

    // Check for duplicates
    const sanitizedFileId = input.id.split('-')[1];
    checkForDuplicateEmails(sanitizedFileId);
}

// Toggle the share submit button based on form validity
export function toggleSubmitButton(sanitizedFileId) {
    const shareForm = document.getElementById(`shareForm-${sanitizedFileId}`);
    const shareSubmitButton = document.getElementById(`shareSubmit-${sanitizedFileId}`);
    const emailInputs = shareForm.querySelectorAll('.email-input');
    const isAnyInputValid = Array.from(emailInputs).some(input => isValidEmail(input.value.trim()));
    const isNoDuplicate = checkForDuplicateEmails(sanitizedFileId);

    shareSubmitButton.disabled = !(isAnyInputValid && isNoDuplicate);
}
