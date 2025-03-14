import _ from 'lodash';
import familyTownsStore from '../tabs/familyMap/stores/familyTownsStore.js';

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

function calculateLocalStorageSize() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += (localStorage[key].length + key.length) * 2;  // Each character uses 2 bytes
        }
    }
    console.log('Total localStorage size in KB:', total / 1024);
}

// Function to update individual towns from family towns
export function updateIndividualTownsFromFamilyTowns(individualsCache) {
    // console.log('Updating individual towns from family towns...', JSON.stringify(JSON.parse(JSON.stringify(individualsCache)), null, 2));
    const familyTowns = familyTownsStore.getAllTowns();
    console.log('Family towns:', familyTowns);

    individualsCache.forEach((individual) => {
        const individualTownKeys = Object.keys(individual.individualTowns || {});
        if (individualTownKeys.length > 0) {
            individualTownKeys.forEach(townKey => {
                const updatedTownInfo = familyTowns[townKey];
                if (updatedTownInfo) {
                    individual.individualTowns[townKey] = {
                        ...individual.individualTowns[townKey],
                        ...updatedTownInfo
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
     * Function to validate email format using a regex.
     * @param {string} email - The email to validate.
     * @returns {boolean} - Returns true if the email is valid, otherwise false.
     */
 export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}



