import _ from "lodash";
import gedcomConstantsStore from '../stores/gedcomConstantsStore.js';

class DateProcessor {
    constructor() {
        const { CALENDARS, MONTHS_MAP } = gedcomConstantsStore;
        this.CALENDARS = CALENDARS;
        this.MONTHS_MAP = MONTHS_MAP;
    }

    processDate(s) {
        if (typeof s !== "string") {
            return "";
        }

        let trimmed = s.trim().toUpperCase();

        const isRepublican = gedcomConstantsStore.isRepublicanCalendar(trimmed);
        if (isRepublican) {
            trimmed = trimmed.substring(this.CALENDARS.REPUBLICAN.length).trim();
        } else if (gedcomConstantsStore.isGregorianCalendar(trimmed)) {
            trimmed = trimmed.substring(this.CALENDARS.GREGORIAN.length).trim();
        }

        const split = trimmed.split(/\s+/);
        if (split.length === 0) {
            console.error("Error: No date parts found after trimming", trimmed);
            return "";
        }

        let day, month, year;
        if (split.length === 3) {
            day = parseInt(split[0], 10);
            month = (isRepublican ?
                this.MONTHS_MAP.REPUBLICAN[split[1]] :
                this.MONTHS_MAP.GREGORIAN[split[1]]) || 0;
            year = parseInt(split[2], 10);
        } else if (split.length === 2) {
            month = (isRepublican ?
                this.MONTHS_MAP.REPUBLICAN[split[1]] :
                this.MONTHS_MAP.GREGORIAN[split[1]]) || 0;
            year = parseInt(split[1], 10);
        } else if (split.length === 1) {
            year = parseInt(split[0], 10);
        }

        if (isRepublican) {
            year += 1792;
        }
        let display = year ? year.toString() : "";
        if (month > 0) {
            display = this.padTwoDigits(month) + "/" + display;
        }
        if (day > 0) {
            display = this.padTwoDigits(day) + "/" + display;
        }

        return display;
    }

    parseDate(dateStr) {
        if (!dateStr || dateStr.toLowerCase() === 'date inconnue') {
            return { isValid: false };
        }

        // Parse DD/MM/YYYY
        if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            const [day, month, year] = dateStr.split('/').map(Number);
            return {
                isValid: true,
                day,
                month,
                year,
                date: new Date(year, month - 1, day)
            };
        }

        // Parse MM/YYYY
        if (dateStr.match(/^\d{2}\/\d{4}$/)) {
            const [month, year] = dateStr.split('/').map(Number);
            return {
                isValid: true,
                month,
                year,
                date: new Date(year, month - 1, 1)
            };
        }

        // Parse YYYY
        if (dateStr.match(/^\d{4}$/)) {
            const year = parseInt(dateStr);
            return {
                isValid: true,
                year,
                date: new Date(year, 0, 1)
            };
        }

        return { isValid: false };
    }

    extractYear(dateString) {
        if (dateString === null || typeof dateString !== 'string') {
            return null;
        }

        const parts = dateString.split('/');
        switch (parts.length) {
            case 1: return parts[0];
            case 2: return parts[1];
            case 3: return parts[2];
            default: throw new Error('Invalid date format');
        }
    }

    formatToday() {
        const today = new Date();
        const day = this.padTwoDigits(today.getDate());
        const month = this.padTwoDigits(today.getMonth() + 1);
        const year = today.getFullYear();
        return `${day}/${month}/${year}`;
    }

    prefixedDate(date) {
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

    isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    calculateAge(birthdate, deathdate = null) {
        if (!birthdate) {
            return "";
        }

        const birth = this.parseDate(birthdate);
        if (!birth.isValid) {
            return "";
        }

        const death = deathdate ? this.parseDate(deathdate) : { date: new Date() };
        if (!death.date) {
            return "";
        }

        const referenceDate = death.date;

        let yearDifference = referenceDate.getFullYear() - birth.year;

        // Ajustement si l'anniversaire n'est pas encore passé dans l'année
        const hasBirthdayOccurred = (
            referenceDate.getMonth() > birth.month - 1 ||
            (referenceDate.getMonth() === birth.month - 1 &&
                referenceDate.getDate() >= (birth.day || 1))
        );

        if (!hasBirthdayOccurred) {
            yearDifference--;
        }

        return yearDifference;
    }

    detectDateFormat(date) {
        const parts = date.split('/').length;
        switch (parts) {
            case 1: return "YYYY";
            case 2: return "MM/YYYY";
            case 3: return "DD/MM/YYYY";
            default: return "DD/MM/YYYY";
        }
    }

    padTwoDigits(number) {
        return number.toString().padStart(2, '0');
    }

    isValidDate(date) {
        return date instanceof Date && !isNaN(date.getTime());
    }
}

export const dateProcessor = new DateProcessor();