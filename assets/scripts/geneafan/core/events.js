import { setupAllEventListeners } from '../listeners/eventListeners.js';
import authStore from '../common/stores/authStore.js';

export function setupEventListeners() {
    console.log('Event listeners setup started');
    
    try {
        // Setup main event listeners
        setupAllEventListeners(authStore);
        
        // Setup window unload warning
        setupUnloadWarning();
        
        // Setup quantity input validators
        setupQuantityInputValidators();
        
    } catch (error) {
        console.error("Error setting up event listeners:", error);
        throw error;
    }
}

function setupUnloadWarning() {
    window.addEventListener('beforeunload', function (e) {
        console.log('La page est sur le point de se recharger ou de se fermer.');
    });
}

function setupQuantityInputValidators() {
    document.querySelectorAll('input[type=number]').forEach(function (input) {
        input.addEventListener('change', function () {
            const min = parseInt(input.getAttribute('min'));
            const max = parseInt(input.getAttribute('max'));
            let val = parseInt(input.value) || min - 1;
            if (val < min) input.value = min;
            if (val > max) input.value = max;
        });
    });
}