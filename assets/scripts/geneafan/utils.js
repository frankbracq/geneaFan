import _ from 'lodash';
import { getFamilyTowns } from './state.js';
import { parseDate } from './dates.js';

export const memoize = (fn) => {
    const cache = new Map();
    return (...args) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = fn(...args);
        cache.set(key, result);
        return result;
    };
};

export function groupEvents(events, yearsGroup = 10) {
    // Parse and filter valid dates
    const validEvents = _.filter(events, event => {
        const parsedDate = parseDate(event.date);
        if (parsedDate.isValid()) {
            event.parsedDate = parsedDate; // Attach parsed date to the event object
            return true;
        }
        return false;
    });

    // Sort events by date
    const sortedEvents = _.sortBy(validEvents, event => event.parsedDate.toISOString());

    // Group events by the specified number of years
    const groupedByYears = _.groupBy(sortedEvents, event => {
        const yearStart = Math.floor(event.parsedDate.year() / yearsGroup) * yearsGroup;
        // Format the start of the interval as "01/01/YYYY"
        return `01/01/${yearStart}`;
    });

    // Further group by event type within each year group
    return _.mapValues(groupedByYears, eventsByDate => _.groupBy(eventsByDate, 'type'));
}

function calculateLocalStorageSize() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += (localStorage[key].length + key.length) * 2;  // Each character uses 2 bytes
        }
    }
    console.log('Total localStorage size in KB:', total / 1024);
}

// Function to update family towns via a proxy
export async function updateFamilyTownsViaProxy() {
    console.time('updateFamilyTownsViaProxy');  // Début de la mesure du temps
    const familyTowns = getFamilyTowns();
    // console.log(`familyTowns`, familyTowns);
    const townsToUpdate = {};
    for (const [key, town] of Object.entries(familyTowns)) {
        if (
            ((town.country === 'France' || town.country === 'FR' || town.country === '') &&
                ((town.departement && town.departement.length === 2) || !town.departement || !town.latitude || !town.longitude)) ||
            ((town.country !== 'France' && town.country !== 'FR' && town.country !== '') && (!town.latitude || !town.longitude))
        ) {
            townsToUpdate[key] = town;
        }
    }
    console.log(`Number of items in townsToUpdate: ${Object.keys(townsToUpdate).length}`);
    console.log(`Number of items in familyTowns: ${Object.keys(familyTowns).length}`);

    if (Object.keys(townsToUpdate).length === 0) {
        console.log("No towns need updating.");
        return;
    }

    var alertElement = document.getElementById('alert');
    var alertContent = document.getElementById('alert-content');

    alertContent.style.whiteSpace = 'pre-line';
    alertContent.textContent = 'Mise à jour des coordonnées géographiques des communes mentionnées dans votre fichier...\nCela peut prendre une à deux minutes. Veuillez patienter...';
    alertElement.classList.remove('d-none');
    alertElement.classList.add('show');

    // Récupérer l'ID utilisateur à partir du localStorage
    const userId = localStorage.getItem('userId');

    const response = await fetch('https://opencageproxy.genealogie.workers.dev/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyTowns: townsToUpdate, userId })  // Ajouter l'ID utilisateur au corps de la requête
    });

    if (response.ok) {
        const updatedFamilyTowns = await response.json();
        const currentFamilyTowns = getFamilyTowns();
        Object.entries(updatedFamilyTowns).forEach(([key, updatedTown]) => {
            currentFamilyTowns[key] = { ...currentFamilyTowns[key], ...updatedTown };
        });

        let townsDB = JSON.parse(localStorage.getItem('townsDB')) || {};

        // Fusionner les données existantes avec currentFamilyTowns
        for (let key in currentFamilyTowns) {
            if (currentFamilyTowns.hasOwnProperty(key)) {
                townsDB[key] = { ...townsDB[key], ...currentFamilyTowns[key] };
            }
        }

        // Enregistrer les données fusionnées
        localStorage.setItem('townsDB', JSON.stringify(townsDB));

        calculateLocalStorageSize();

        alertElement.classList.remove('alert-primary');
        alertElement.classList.add('alert-success');
        alertContent.textContent = 'Mise à jour des coordonnées géographiques des communes terminée.';
        setTimeout(function () {
            alertElement.classList.add('d-none');
        }, 1800);
        console.timeEnd('updateFamilyTownsViaProxy');  // Fin de la mesure du temps

    } else {
        alertElement.classList.remove('alert-primary');
        alertElement.classList.add('alert-danger');
        alertContent.textContent = `Erreur dans la mise à jour des coordonnées géographiques: ${response.statusText}`;
        throw new Error(`Error during request: ${response.statusText}`);
    }
}

// Function to update individual towns from family towns
export function updateIndividualTownsFromFamilyTowns(individualsCache) {
    const familyTowns = getFamilyTowns();
    // Iterate over each individual in the map
    individualsCache.forEach((individual) => {
        // Ensure individualTowns is an object with properties
        const individualTownKeys = Object.keys(individual.individualTowns || {});
        if (individualTownKeys.length > 0) {
            individualTownKeys.forEach(townKey => {
                // Look up updated info in familyTowns
                const updatedTownInfo = familyTowns[townKey];

                if (updatedTownInfo) {
                    // If updated info is found, replace in individualTowns
                    individual.individualTowns[townKey] = {
                        ...individual.individualTowns[townKey], // Preserve existing properties
                        ...updatedTownInfo // Apply updates
                    };
                }
            });
        }
    });
}

export function downloadJSON(data, filename) {
    // Convertir data en une chaîne JSON
    let dataStr = JSON.stringify(data);

    // Créer un objet Blob à partir de la chaîne JSON
    let dataBlob = new Blob([dataStr], {type: 'application/json'});

    // Créer une URL pour l'objet Blob
    let url = URL.createObjectURL(dataBlob);

    // Créer un élément de lien avec l'URL comme href
    let downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.textContent = `Download ${filename}`;

    // Styliser le lien
    downloadLink.style.position = 'absolute';
    downloadLink.style.top = '10px';
    downloadLink.style.left = '10px';
    downloadLink.style.backgroundColor = 'red';
    downloadLink.style.color = 'white';
    downloadLink.style.padding = '10px';

    // Ajouter l'élément de lien au document
    document.body.appendChild(downloadLink);
}

export function padTwoDigits(number) {
    return number.toString().padStart(2, '0');
}

export function mmToPoints(mm) {
    return mm * 72 / 25.4;
}

export function mmToPixels(mm) {
    return Math.round(mm * 96 / 25.4);
}

export function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

export function getActionWord(eventType, gender) {
    const eventWords = {
        'BIRT': 'Né',
        'DEAT': 'Décédé',
        'MARR': 'Marié'
    };
    const baseWord = eventWords[eventType] || '';

    // Simplification du traitement du sexe
    if (gender === true || gender === 'M') { // Masculin
        return baseWord;
    } else if (gender === false || gender === 'F') { // Féminin
        return baseWord + 'e';
    } else { // Sexe non spécifié
        return baseWord + '(e)';
    }
}

/**
 * Sanitize a file ID by replacing spaces with underscores.
 *
 * @param {string} fileId - The file ID to sanitize.
 * @returns {string} The sanitized file ID.
 */
export function sanitizeFileId(fileId) {
    if (typeof fileId !== 'string') {
      console.error('File ID must be a string.');
      return '';
    }
    return fileId.replace(/\s+/g, '_');
  }
  
 /**
     * Function to validate email format using a regex.
     * @param {string} email - The email to validate.
     * @returns {boolean} - Returns true if the email is valid, otherwise false.
     */
 export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
} 



