class GedcomConstantsStore {
    constructor() {
        // Tags principaux
        this.TAGS = {
            HEAD: "HEAD",
            ENCODING: "CHAR",
            FORMAT: "FORM",
            INDIVIDUAL: "INDI",
            FAMILY: "FAM",
            CHILD: "CHIL",
            HUSBAND: "HUSB",
            WIFE: "WIFE",
            NAME: "NAME",
            GIVEN_NAME: "GIVN",
            SURNAME: "SURN",
            SURNAME_PREFIX: "SPFX",
            BIRTH: "BIRT",
            BAPTISM: "CHR",
            DEATH: "DEAT",
            BURIAL: "BURI",
            SEX: "SEX",
            DATE: "DATE",
            PLACE: "PLAC",
            MARRIAGE: "MARR",
            SIGNATURE: "SIGN",
            EVENT: "EVEN",
            TYPE: "TYPE",
            NOTE: "NOTE",
            OCCUPATION: "OCCU"
        };

        // Valeurs spéciales
        this.VALUES = {
            YES: "YES",
            ANSI: "ANSI",
            OCCUPATION: "Occupation"
        };

        // Préfixes de date
        this.DATE_PREFIXES = {
            ABOUT: "ABT",
            BEFORE: "BEF",
            AFTER: "AFT"
        };

        // Calendriers
        this.CALENDARS = {
            GREGORIAN: "@#DGREGORIAN@",
            REPUBLICAN: "@#DFRENCH R@"
        };

        // Mois
        this.MONTHS = {
            GREGORIAN: [
                "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
            ],
            REPUBLICAN: [
                "VEND", "BRUM", "FRIM", "NIVO", "PLUV", "VENT",
                "GERM", "FLOR", "PRAI", "MESS", "THER", "FRUC", "COMP"
            ]
        };

        // Conversion années républicaines
        this.REPUBLICAN_YEARS = [
            "I", "II", "III", "IV", "V", "VI", "VII",
            "VIII", "IX", "X", "XI", "XII", "XIII"
        ];

        // Convertir les tableaux de mois en objets pour une recherche plus rapide
        this.MONTHS_MAP = {
            GREGORIAN: this.MONTHS.GREGORIAN.reduce((obj, month, index) => {
                obj[month] = index + 1;
                return obj;
            }, {}),
            REPUBLICAN: this.MONTHS.REPUBLICAN.reduce((obj, month, index) => {
                obj[month] = index + 1;
                return obj;
            }, {})
        };
    }

    // Helpers
    byTag(tag) {
        return (obj) => obj.tag === tag;
    }

    isValidMonth(month, calendar = 'GREGORIAN') {
        return month in this.MONTHS_MAP[calendar];
    }

    getMonthNumber(month, calendar = 'GREGORIAN') {
        return this.MONTHS_MAP[calendar][month] || 0;
    }

    isRepublicanCalendar(dateString) {
        return dateString.startsWith(this.CALENDARS.REPUBLICAN);
    }

    isGregorianCalendar(dateString) {
        return dateString.startsWith(this.CALENDARS.GREGORIAN);
    }
}

// Create instance
const gedcomConstantsStore = new GedcomConstantsStore();

// Export individual elements and the store
export const { TAGS, VALUES, CALENDARS, MONTHS_MAP } = gedcomConstantsStore;
export const { OCCUPATION: VALUE_OCCUPATION } = VALUES;  // Exporter VALUE_OCCUPATION spécifiquement
export const byTag = (tag) => gedcomConstantsStore.byTag(tag);
export const isRepublicanCalendar = (dateString) => gedcomConstantsStore.isRepublicanCalendar(dateString);
export const isGregorianCalendar = (dateString) => gedcomConstantsStore.isGregorianCalendar(dateString);

// Export store as default
export default gedcomConstantsStore;