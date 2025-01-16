import _ from 'lodash';
import moment from 'moment';

export function parseDate(date) {
    if (!date || date.toLowerCase() === 'date inconnue') return moment.invalid(); // Handle undefined or unknown dates

    if (date.match(/^\d{2}\/\d{2}\/\d{4}$/)) { // "DD/MM/YYYY"
        return moment(date, "DD/MM/YYYY", true); // Strict parsing
    } else if (date.match(/^\d{2}\/\d{4}$/)) { // "MM/YYYY"
        return moment(date, "MM/YYYY", true);
    } else if (date.match(/^\d{4}$/)) { // "YYYY"
        return moment(date, "YYYY", true);
    }
    return moment.invalid(); // Return invalid moment if format is not recognized
}

export function extractYear(dateString) {
    // Check if dateString is null or not a string
    if (dateString === null || typeof dateString !== 'string') {
        return null;
    }

    // Split the date string by '/'
    const parts = dateString.split('/');
    // Check the number of parts
    switch (parts.length) {
    case 1:
        // If dateString is in 'yyyy' format
        return parts[0];
    case 2:
        // If dateString is in 'mm/yyyy' format
        return parts[1];
    case 3:
        // If dateString is in 'dd/mm/yyyy' format
        return parts[2];
    default:
        // If dateString is not in a recognized format
        throw new Error('Invalid date format');
    }
}

export function prefixedDate(date) {
    const mmYYYY = /^\d{2}\/\d{4}$/;
    const YYYY = /^\d{4}$/;
    const ddMMYYYY = /^\d{2}\/\d{2}\/\d{4}$/;

    let prefix = '';

    if (mmYYYY.test(date) || YYYY.test(date)) {
        prefix = 'en';
    } else if (ddMMYYYY.test(date)) {
        prefix = 'le';
    }

    return `${prefix} ${date}`;
}

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function calculateAge(birthdate, deathdate = null) {
    if (!birthdate) {
        return "";
    }

    const birthFormat = detectDateFormat(birthdate);
    const birthdateMoment = moment(birthdate, birthFormat);

    if (!birthdateMoment.isValid()) {
        return ""; // Invalid birthdate
    }

    let referenceDate = deathdate ? moment(deathdate, detectDateFormat(deathdate)) : moment();

    if (!referenceDate.isValid()) {
        return ""; // Invalid deathdate
    }

    const birthDay = birthdateMoment.date();
    const birthMonth = birthdateMoment.month() + 1; // Month is 0-indexed in moment.js
    const birthYear = birthdateMoment.year();

    const referenceDay = referenceDate.date();
    const referenceMonth = referenceDate.month() + 1;
    const referenceYear = referenceDate.year();

    let month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (isLeapYear(birthYear)) {
        month[1] = 29; // Update February days to 29 if it's a leap year
    }

    let adjustedReferenceDay = referenceDay;
    let adjustedReferenceMonth = referenceMonth;
    let adjustedReferenceYear = referenceYear;

    if (birthDay > referenceDay) {
        adjustedReferenceDay += month[referenceMonth - 1];
        adjustedReferenceMonth -= 1;
    }

    if (birthMonth > adjustedReferenceMonth) {
        adjustedReferenceMonth += 12;
        adjustedReferenceYear -= 1;
    }

    let dayDifference = adjustedReferenceDay - birthDay;
    let monthDifference = adjustedReferenceMonth - birthMonth;
    let yearDifference = adjustedReferenceYear - birthYear;

    return yearDifference;
}

export function detectDateFormat(date) {
    // Cette fonction détecte le format de la date en comptant les parties séparées par '/'
    const parts = date.split('/').length;
    switch (parts) {
        case 1: return "YYYY";   // Année seulement
        case 2: return "MM/YYYY"; // Mois et année
        case 3: return "DD/MM/YYYY"; // Jour, mois et année
        default: return "DD/MM/YYYY"; // Format par défaut
    }
}

export function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}
