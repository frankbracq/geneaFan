// External libraries
import _ from "lodash";

// Utility functions
import {
    normalizeGeoString,
    formatTownName
} from "../../utils/geo.js";
import { padTwoDigits } from "../../utils/utils.js";
import { extractBasicInfo } from '../builders/personBuilder.js';

// Stores
import familyTownsStore from '../stores/familyTownsStore.js';
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
            display = padTwoDigits(month) + "/" + display;
        }
        if (day > 0) {
            display = padTwoDigits(day) + "/" + display;
        }

        return display;
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

        // Normalize segments for country search
        const normalizedSegments = _.map(segments, (segment) => normalizeGeoString(segment));

        // Find country in country data
        const countryMatch = this._findCountry(normalizedSegments);
        if (countryMatch) {
            this._applyCountryData(placeObj, countryMatch);
        }

        // Process department data for France
        if (!placeObj.country || placeObj.country === "France") {
            this._processFrenchDepartement(placeObj, original);
        }

        // Process subdivision and department
        this._processSubdivisionAndDepartement(placeObj, segments);

        // Extract geolocation data if available
        this._extractGeolocation(placeObj, tree);

        // Format final display string
        placeObj.display = this._formatDisplayString(placeObj);

        return placeObj;
    }

    async processGedcomTowns(json) {
        try {
            console.group('processGedcomTowns - Processing locations');

            // 1. Load cache to use for enriching GEDCOM towns
            const geoCache = await familyTownsStore.loadFromLocalStorage();
            console.log('geoCache:', geoCache); 
            const gedcomTowns = new Map();

            // 2. Extract GEDCOM towns basic info
            const individuals = json.filter(record => record.tag === gedcomConstantsStore.TAGS.INDIVIDUAL);
            for (const individual of individuals) {
                this._collectTownsFromTree(individual.tree, gedcomTowns);
                this._addPlaceKeysToEvents(individual.tree);
            }

            // 3. For each GEDCOM town, enrich with cache data if available before creating
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
            }

            const familyTowns = familyTownsStore.getAllTowns();
            console.log('familyTowns:', familyTowns);

            // 4. Update incomplete GEDCOM towns via proxy
            const townsToUpdate = new Map();
            gedcomTowns.forEach((town, key) => {
                if (!this._hasTownCompleteGeoData(town, geoCache[key])) {
                    townsToUpdate.set(key, town);
                }
            });

            if (townsToUpdate.size > 0) {
                console.log("Updating incomplete GEDCOM towns via proxy:", townsToUpdate);
                await familyTownsStore.updateTownsViaProxy(Object.fromEntries(townsToUpdate));
            }

            console.groupEnd();
            return { json };
        } catch (error) {
            console.error("Error in getAllPlaces:", error);
            console.groupEnd();
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

    _updateLocalStorage(placeObj) {
        const stored = localStorage.getItem('townsDB') || '{}';
        try {
            const townsDB = JSON.parse(stored);
            const normalizedKey = normalizeGeoString(placeObj.town);

            // Ne pas écraser les données existantes si déjà présentes
            if (!townsDB[normalizedKey]) {
                townsDB[normalizedKey] = {
                    town: placeObj.town,
                    townDisplay: placeObj.townDisplay,
                    departement: placeObj.departement,
                    departementColor: placeObj.departementColor,
                    country: placeObj.country,
                    countryCode: placeObj.countryCode,
                    countryColor: placeObj.countryColor,
                    latitude: placeObj.latitude,
                    longitude: placeObj.longitude
                };
                localStorage.setItem('townsDB', JSON.stringify(townsDB));
                console.log(`Coordonnées GEDCOM pour ${placeObj.town} ajoutées au cache`);
            }
        } catch (error) {
            console.error('Error updating localStorage with GEDCOM coordinates:', error);
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