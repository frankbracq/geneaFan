/**
 * Formate un nom ou un prénom selon les règles de capitalisation
 * @param {string} str - Le nom à formater
 * @param {boolean} isSurname - Indique si c'est un nom de famille
 * @returns {string} Le nom formaté
 */
export function formatName(str, isSurname = false) {
    if (typeof str !== "string") {
        str = String(str);
    }

    // Capitalize only the first letter of each word and after "-"
    str = str.toLowerCase().replace(/(^|\s|-)([a-zà-ÿ])/g, function (match) {
        return match.toUpperCase();
    });

    // Replace occurrences of " De " with " de "
    str = str.replace(/ De /g, " de ");

    // If the string starts with "De ", replace it with "de "
    if (str.startsWith("De ")) {
        str = "de " + str.slice(3);
    }

    // If the string is a surname, replace "xxx ou xxy" with "xxx"
    if (isSurname) {
        str = str.replace(/(\S+)\s+[oO]u\s+\S+/gi, "$1");
    }

    return str;
}

/**
 * Formate un nom complet avec nom et prénom
 * @param {string} firstName - Le prénom
 * @param {string} lastName - Le nom de famille
 * @returns {string} Le nom complet formaté
 */
export function formatFullName(firstName, lastName) {
    return `${formatName(firstName, false)} ${formatName(lastName, true)}`.trim();
}

/**
 * Normalise un nom pour la comparaison
 * @param {string} name - Le nom à normaliser
 * @returns {string} Le nom normalisé
 */
export function normalizeName(name) {
    return name
        .toLowerCase()
        .normalize("NFD")  // Décompose les caractères accentués
        .replace(/[\u0300-\u036f]/g, "")  // Supprime les accents
        .replace(/[^a-z0-9]/g, "");  // Garde uniquement les lettres et chiffres
}