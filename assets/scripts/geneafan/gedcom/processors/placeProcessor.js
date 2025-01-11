import _ from 'lodash';
import { normalizeGeoString, formatTownName } from "../../utils/geo.js";
import { processDate } from "./dateProcessor.js";
import gedcomDataStore from '../stores/gedcomDataStore.js';
import familyTownsStore from '../stores/familyTownsStore.js';
import { byTag, TAGS } from '../stores/gedcomConstantsStore.js';

let cachedDepartementData = null;
let cachedCountryData = null;

async function getDepartementData() {
    if (!cachedDepartementData) {
        const { departementData } = await import('../data/departementData.js');
        cachedDepartementData = departementData;
    }
    return cachedDepartementData;
}

async function getCountryData() {
    if (!cachedCountryData) {
        const { countryData } = await import('../data/countryData.js');
        cachedCountryData = countryData;
    }
    return cachedCountryData;
}

/**
 * Traite et formate les données d'un lieu
 * @param {Object} params - Les paramètres
 * @param {string} params.data - Les données brutes du lieu
 * @param {Array} [params.tree] - L'arbre des données supplémentaires (optionnel)
 * @returns {Object} - Les données du lieu formatées
 */
export async function processPlace({ data: original, tree } = {}) {
    const departementData = await getDepartementData();
    const countryData = await getCountryData();

    const segments = original.split(/\s*,\s*/);
    let placeObj = {
        latitude: "",
        longitude: "",
        town: formatTownName(segments[0]),
        townDisplay: segments[0],
        subdivision: "",
        departement: "",
        departementColor: "",
        region: "",
        country: "",
        countryCode: "",
        countryColor: "",
    };

    // Normalisation pour la recherche du pays
    const normalizedSegments = _.map(segments, (segment) => normalizeGeoString(segment));

    // Recherche du pays dans les données de pays
    const findCountry = () => {
        for (const continent of countryData.continents) {
            for (const country of continent.countries) {
                if (_.some(normalizedSegments, segment => segment === country.key.FR)) {
                    return country;
                }
            }
        }
        return null;
    };

    const countryMatch = findCountry();

    if (countryMatch) {
        placeObj.country = countryMatch.name.FR;
        placeObj.countryCode = countryMatch.code;
        placeObj.countryColor = countryMatch.color;
    }

    // If the country is empty or equal to France, search for postal or departmental codes
    if (!placeObj.country || placeObj.country === "France") {
        const codeRegex = /\b\d{5}\b|\(\d{2}\)/;
        const codeMatch = original.match(codeRegex);

        if (codeMatch) {
            const code = codeMatch[0];
            if (code.startsWith("(")) {
                placeObj.departement = code.replace(/[()]/g, "");
            } else if (code.length === 5) {
                placeObj.departement = code.substring(0, 2);
            }

            // Check if placeObj.departement is a number
            if (!isNaN(placeObj.departement)) {
                // Use Lodash's find method to find the departement
                const departement = _.find(departementData, { 'code': placeObj.departement });

                // If the departement is found, replace placeObj.departement with the departement name
                if (departement) {
                    placeObj.departement = departement.name;
                    placeObj.departementColor = departement.departementColor;
                }
            } else if (typeof placeObj.departement === 'string') {
                // If placeObj.departement is a string, find the departement by name
                const departement = _.find(departementData, { 'name': placeObj.departement });

                // If the departement is found, set placeObj.departementColor to the departement color
                if (departement) {
                    placeObj.departementColor = departement.departementColor;
                }
            }
        }
    }

    // Traitement pour subdivision, departement
    if (segments.length >= 2) {
        if (segments.length >= 3) {
            placeObj.subdivision = _.initial(segments).join(", ");
            // S'assure de ne pas écraser le département si déjà défini par un code postal
            if (!placeObj.departement) {
                placeObj.departement = segments[segments.length - 2];
            }
        } else {
            if (!placeObj.departement) {
                placeObj.departement = segments[0];
            }
        }
    }

    // Extraction of geolocation data if available
    if (_.isArray(tree)) {
        const mapNode = _.find(tree, { tag: "MAP" });
        if (mapNode && _.isArray(mapNode.tree)) {
            const latiNode = _.find(mapNode.tree, { tag: "LATI" });
            const longNode = _.find(mapNode.tree, { tag: "LONG" });
            if (latiNode) {
                placeObj.latitude = parseFloat(latiNode.data.trim());
            }
            if (longNode) {
                placeObj.longitude = parseFloat(longNode.data.trim());
            }
        }
    }

    // Formatage final de la chaîne de lieu pour l'affichage
    const parts = _.filter([
        placeObj.subdivision,
        placeObj.town,
        placeObj.departement,
        placeObj.country,
    ]);
    placeObj.display = parts.join(", ");

    return placeObj;
}

// Function to store all family locations in memory
export async function getAllPlaces(json) {
    try {
        console.group('getAllPlaces - Traitement des lieux');

        // 1. Construire d'abord le cache des individus
        await gedcomDataStore.buildIndividualsCache(json);
        console.log('Cache des individus construit');

        // 2. Charger le cache de géolocalisation
        const geoCache = await getAllRecords();
        console.log('Cache géo chargé:', Object.keys(geoCache).length, 'villes en cache');

        // 3. Réinitialiser le store des villes
        familyTownsStore.setTownsData({});
        console.log('Store réinitialisé');

        // 4. Maintenant traiter les lieux avec le cache disponible
        const individuals = json.filter(byTag(TAGS.INDIVIDUAL));
        for (const individual of individuals) {
            await processTree(individual.tree, null, individual);
        }

        // Le reste du code reste inchangé...
        return { json };
    } catch (error) {
        console.error("Error in getAllPlaces: ", error);
        console.groupEnd();
        throw error;
    }
}

function getAllRecords() {
    return new Promise((resolve, reject) => {
        console.log('Accessing localStorage...');
        const storedData = localStorage.getItem("townsDB");
        if (storedData) {
            console.log('Found data in townsDB:', storedData.slice(0, 100) + '...');
            try {
                const dbTowns = JSON.parse(storedData);
                console.log('Successfully parsed townsDB, found', Object.keys(dbTowns).length, 'towns');
                resolve(dbTowns);
            } catch (error) {
                console.error("Erreur lors de la conversion des données JSON :", error);
                console.log('Raw data causing error:', storedData);
                resolve({});  // En cas d'erreur, on renvoie un objet vide
            }
        } else {
            console.log('No data found in townsDB');
            resolve({});  // Si pas de données, on renvoie un objet vide
        }
    });
}

async function processTree(tree, parentNode, individual) {
    // Extraire d'abord les détails de la personne du cache
    const individualFromCache = gedcomDataStore.getIndividual(individual.pointer);
    if (!individualFromCache) {
        console.warn(`Individual ${individual.pointer} not found in cache`);
        return; // Ne pas traiter cet individu si pas dans le cache
    }

    // Construire les détails complets de la personne
    const personDetails = {
        name: individualFromCache.name,
        surname: individualFromCache.surname,
        gender: individualFromCache.gender,
        birthDate: individualFromCache.birthDate,
        deathDate: individualFromCache.deathYear ? individualFromCache.deathYear.toString() : "",
        birthPlace: individualFromCache.fanBirthPlace || "",
        deathPlace: individualFromCache.fanDeathPlace || "",
        occupation: individualFromCache.formattedOccupations || ""
    };

    for (const node of tree) {
        if (node.tag === "PLAC" && parentNode) {
            let placeInfo = await processPlace({ data: node.data, tree: node.tree });
            let normalizedKey = normalizeGeoString(placeInfo.town);
            if (!normalizedKey) continue;

            parentNode.key = normalizedKey;

            const dateNode = parentNode.tree?.find(n => n.tag === "DATE");
            const eventDate = dateNode ? processDate(dateNode.data) : null;

            const eventData = {
                type: parentNode.tag,
                date: eventDate,
                personId: individual.pointer,
                personDetails: personDetails
            };

            familyTownsStore.addTown(normalizedKey, placeInfo, eventData);
        }

        if (node.tree && node.tree.length > 0) {
            await processTree(
                node.tree,
                ["BIRT", "DEAT", "BURI", "MARR", "OCCU", "EVEN"].includes(node.tag) ? node : parentNode,
                individual
            );
        }
    }
}

