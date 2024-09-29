import { Tooltip } from 'bootstrap';

// Function to initialize tooltips for a given container element
export function initializeTooltips(containerElement) {
  if (!containerElement) {
    console.error('Container element is required to initialize tooltips.');
    return;
  }

  // Find all elements with data-bs-toggle="tooltip" inside the container
  const tooltipTriggerList = containerElement.querySelectorAll('[data-bs-toggle="tooltip"]');

  // Initialize Bootstrap tooltips for each element
  tooltipTriggerList.forEach(tooltipTriggerEl => {
    new Tooltip(tooltipTriggerEl);
    // console.log('Tooltip initialized for:', tooltipTriggerEl);
  });
}