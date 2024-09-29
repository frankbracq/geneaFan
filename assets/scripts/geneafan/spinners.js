// Function to show a global spinner (e.g., for a modal or loading screen)
export function showGlobalSpinner() {
  const spinner = document.getElementById('loadingSpinner');
  const content = document.getElementById('modalContent');
  if (spinner && content) {
    spinner.style.display = 'block';
    content.style.opacity = '0.5'; // Optionally reduce opacity to indicate loading state
  }
}

// Function to hide the global spinner
export function hideGlobalSpinner() {
  const spinner = document.getElementById('loadingSpinner');
  const content = document.getElementById('modalContent');
  if (spinner && content) {
    spinner.style.display = 'none';
    content.style.opacity = '1'; // Restore original opacity when loading is complete
  }
}

// Function to show a button-specific spinner (e.g., for submit buttons)
export function showButtonSpinner(sanitizedFileId) {
  const spinner = document.getElementById(`shareButtonSpinner-${sanitizedFileId}`);
  if (spinner) {
    spinner.style.display = 'inline-block';
  }
}

// Function to hide a button-specific spinner
export function hideButtonSpinner(sanitizedFileId) {
  const spinner = document.getElementById(`shareButtonSpinner-${sanitizedFileId}`);
  if (spinner) {
    spinner.style.display = 'none';
  }
}
