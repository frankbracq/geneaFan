import gedcomConstantsStore from '../stores/gedcomConstantsStore.js';
import { padTwoDigits } from '../../utils/utils.js';  // Ajout de l'import

const { CALENDARS, MONTHS_MAP } = gedcomConstantsStore;

export function processDate(s) {
    if (typeof s !== "string") {
        return "";
    }

    let trimmed = s.trim().toUpperCase();

    const isRepublican = gedcomConstantsStore.isRepublicanCalendar(trimmed);
    if (isRepublican) {
        trimmed = trimmed.substring(CALENDARS.REPUBLICAN.length).trim();
    } else if (gedcomConstantsStore.isGregorianCalendar(trimmed)) {
        trimmed = trimmed.substring(CALENDARS.GREGORIAN.length).trim();
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
            MONTHS_MAP.REPUBLICAN[split[1]] :
            MONTHS_MAP.GREGORIAN[split[1]]) || 0;
        year = parseInt(split[2], 10);
    } else if (split.length === 2) {
        month = (isRepublican ?
            MONTHS_MAP.REPUBLICAN[split[1]] :
            MONTHS_MAP.GREGORIAN[split[1]]) || 0;
        year = parseInt(split[1], 10);
    } else if (split.length === 1) {
        year = parseInt(split[0], 10);
    }

    if (isRepublican) {
        year += 1792; // Conversion de l'année républicaine en grégorienne
    }
    let display = year ? year.toString() : "";
    if (month > 0) {
        display = padTwoDigits(month) + "/" + display;
    }
    if (day > 0) {
        display = padTwoDigits(day) + "/" + display;
    }

    return display;
}