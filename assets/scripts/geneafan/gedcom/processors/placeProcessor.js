// External libraries
import _ from "lodash";

// Utility functions
import {
    normalizeGeoString,
    formatTownName
} from "../../utils/geo.js";

// Stores
import familyTownsStore from '../../tabs/familyMap/stores/familyTownsStore.js';
import gedcomConstantsStore from '../stores/gedcomConstantsStore.js';

// Data
import { departementData } from '../departementData.js';
import { countryData } from '../countryData.js';

class PlaceProcessor {
    constructor() {
        this.departementData = departementData;
        this.countryData = countryData;
        const { CALENDARS, MONTHS_MAP } = gedcomConstantsStore;
        this.CALENDARS = CALENDARS;
        this.MONTHS_MAP = MONTHS_MAP;
    }

    processPlace({ data: original, tree } = {}) {
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

        const normalizedSegments = _.map(segments, (segment) => normalizeGeoString(segment));
        const countryMatch = this._findCountry(normalizedSegments);
        if (countryMatch) {
            this._applyCountryData(placeObj, countryMatch);
        }

        if (!placeObj.country || placeObj.country === "France") {
            this._processFrenchDepartement(placeObj, original);
        }

        this._processSubdivisionAndDepartement(placeObj, segments);
        this._extractGeolocation(placeObj, tree);
        placeObj.display = this._formatDisplayString(placeObj);

        return placeObj;
    }

    async processGedcomTowns(json) {
        try {
            console.group('processGedcomTowns - Processing locations');

            // 1. Chargement du cache et initialisation des structures
            const geoCache = await familyTownsStore.loadFromLocalStorage();
            const gedcomTowns = new Map();
            const validGedcomTowns = new Map(); // Stocke les villes bien renseignées (pour le cache)
            const townsToUpdate = new Map(); // Stocke les villes à géocoder via proxy

            // 2. Collecte des villes du GEDCOM
            const individuals = json.filter(record => record.tag === gedcomConstantsStore.TAGS.INDIVIDUAL);
            for (const individual of individuals) {
                this._collectTownsFromTree(individual.tree, gedcomTowns);
                this._addPlaceKeysToEvents(individual.tree);
            }

            familyTownsStore.clearAllTowns();

            // 3. Traitement de chaque ville
            for (const [normalizedKey, placeInfo] of gedcomTowns) {
                const cachedTown = geoCache[normalizedKey];
                const townData = cachedTown ? {
                    ...placeInfo,
                    latitude: placeInfo.latitude || cachedTown.latitude,
                    longitude: placeInfo.longitude || cachedTown.longitude,
                    departement: placeInfo.departement || cachedTown.departement,
                    departementColor: placeInfo.departementColor || cachedTown.departementColor,
                    country: placeInfo.country || cachedTown.country,
                    countryCode: placeInfo.countryCode || cachedTown.countryCode,
                    countryColor: placeInfo.countryColor || cachedTown.countryColor
                } : placeInfo;

                familyTownsStore.addOrUpdateTown(normalizedKey, townData);

                // Vérification de la validité des données
                const isValidFrenchTown = townData.country === "France" &&
                    townData.latitude &&
                    townData.longitude &&
                    townData.departement;

                const isValidForeignTown = townData.country &&
                    townData.country !== "France" &&
                    townData.latitude &&
                    townData.longitude;

                // Répartition entre villes valides et à mettre à jour
                if (isValidFrenchTown || isValidForeignTown) {
                    validGedcomTowns.set(normalizedKey, townData);
                } else if (!this._hasTownCompleteGeoData(townData, cachedTown)) {
                    townsToUpdate.set(normalizedKey, townData);
                }
            }
            console.log("Villes valides:", validGedcomTowns);
            console.log("Villes à mettre à jour:", townsToUpdate);

            // 4. Mise à jour du cache local avec les villes valides
            if (validGedcomTowns.size > 0) {
                familyTownsStore.saveToLocalStorage();
            }

            // 5. Géocodage des villes incomplètes via le proxy
            if (townsToUpdate.size > 0) {
                await familyTownsStore.updateTownsViaProxy(Object.fromEntries(townsToUpdate));
            }

            return { json };
        } catch (error) {
            console.error("Error in getAllPlaces:", error);
            throw error;
        }
    }

    // Private helper methods
    _addPlaceKeysToEvents(tree) {
        const EVENT_TAGS = ['BIRT', 'DEAT', 'BURI', 'OCCU'];

        for (const node of tree) {
            if (EVENT_TAGS.includes(node.tag) && node.tree) {
                const placeNode = node.tree.find(child => child.tag === 'PLAC');
                if (placeNode) {
                    const placeInfo = this.processPlace({ data: placeNode.data, tree: placeNode.tree });
                    node.placeKey = normalizeGeoString(placeInfo.town);
                }
            }

            if (node.tree?.length > 0) {
                this._addPlaceKeysToEvents(node.tree);
            }
        }
    }

    _findCountry(normalizedSegments) {
        for (const continent of this.countryData.continents) {
            for (const country of continent.countries) {
                if (_.some(normalizedSegments, segment => segment === country.key.FR)) {
                    return country;
                }
            }
        }
        return null;
    }

    _applyCountryData(placeObj, countryMatch) {
        placeObj.country = countryMatch.name.FR;
        placeObj.countryCode = countryMatch.code;
        placeObj.countryColor = countryMatch.color;
    }

    _processFrenchDepartement(placeObj, original) {
        const codeRegex = /\b\d{5}\b|\(\d{2}\)/;
        const codeMatch = original.match(codeRegex);
        if (codeMatch) {
            this._extractAndSetDepartement(placeObj, codeMatch[0]);
        }
    }

    _extractAndSetDepartement(placeObj, code) {
        let departementCode = code.startsWith('(') ?
            code.replace(/[()]/g, "") :
            code.substring(0, 2);

        if (!isNaN(departementCode)) {
            const departement = _.find(this.departementData, { 'code': departementCode });
            if (departement) {
                placeObj.departement = departement.name;
                placeObj.departementColor = departement.departementColor;
            }
        } else if (typeof departementCode === 'string') {
            const departement = _.find(this.departementData, { 'name': departementCode });
            if (departement) {
                placeObj.departementColor = departement.departementColor;
            }
        }
    }

    _processSubdivisionAndDepartement(placeObj, segments) {
        if (segments.length >= 2) {
            if (segments.length >= 3) {
                placeObj.subdivision = _.initial(segments).join(", ");
                if (!placeObj.departement) {
                    placeObj.departement = segments[segments.length - 2];
                }
            } else if (!placeObj.departement) {
                placeObj.departement = segments[0];
            }
        }
    }


    // Vérifier l'intérêt de cette fonction
    _extractGeolocation(placeObj, tree) {
        if (_.isArray(tree)) {
            const mapNode = _.find(tree, { tag: "MAP" });
            if (mapNode && _.isArray(mapNode.tree)) {
                const latiNode = _.find(mapNode.tree, { tag: "LATI" });
                const longNode = _.find(mapNode.tree, { tag: "LONG" });
                if (latiNode && longNode) {
                    placeObj.latitude = parseFloat(latiNode.data.trim());
                    placeObj.longitude = parseFloat(longNode.data.trim());

                    // Si les coordonnées sont valides, on met à jour le localStorage
                    if (!isNaN(placeObj.latitude) && !isNaN(placeObj.longitude)) {
                        this._updateLocalStorage(placeObj);
                    }
                }
            }
        }
    }

    _formatDisplayString(placeObj) {
        const parts = _.filter([
            placeObj.subdivision,
            placeObj.town,
            placeObj.departement,
            placeObj.country,
        ]);
        return parts.join(", ");
    }

    // Fonction pour récupérer les villes à partir d'un individu
    _collectTownsFromTree(tree, townsMap) {

        for (const node of tree) {
            if (node.tag === "PLAC") {
                const placeInfo = this.processPlace({ data: node.data, tree: node.tree });
                const normalizedKey = normalizeGeoString(placeInfo.town);
                if (normalizedKey) {
                    townsMap.set(normalizedKey, placeInfo);
                }
            }

            if (node.tree?.length > 0) {
                this._collectTownsFromTree(node.tree, townsMap);
            }
        }
    }

    _hasTownCompleteGeoData(town, cachedTown) {
        const hasOwnData = town.latitude && town.longitude && town.departement && town.country;
        const hasCachedData = cachedTown?.latitude && cachedTown?.longitude &&
            cachedTown?.departement && cachedTown?.country;
        return hasOwnData || hasCachedData;
    }

}

export const placeProcessor = new PlaceProcessor();