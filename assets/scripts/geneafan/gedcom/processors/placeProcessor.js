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

    async getAllPlaces(json) {
        try {
            console.group('getAllPlaces - Processing locations');

            // 1. Load geolocation cache
            const geoCache = await this._getAllRecords();
            console.log('Cache loaded:', Object.keys(geoCache).length, 'towns in cache');

            // 2. Reset store for new file
            familyTownsStore.setTownsData({});
            console.log('Store reset');

            // 3. Collect all towns from new GEDCOM file
            const individuals = json.filter(record => record.tag === gedcomConstantsStore.TAGS.INDIVIDUAL);
            for (const individual of individuals) {
                this._processTree(individual.tree, null, individual);
            }

            // 4. Get list of new towns
            const currentTowns = familyTownsStore.getAllTowns();
            console.log('New towns collected:', Object.keys(currentTowns).length, 'towns');

            // 5. Update towns from cache and identify missing ones
            const missingTowns = this._updateTownsFromCache(currentTowns, geoCache);

            // 6. Update missing towns via proxy if needed
            if (missingTowns.length > 0) {
                console.log('Towns requiring geolocation:', missingTowns.length);
                await familyTownsStore.updateTownsViaProxy();
            }

            // 7. Save to localStorage
            familyTownsStore.saveToLocalStorage();

            console.groupEnd();
            return { json };
        } catch (error) {
            console.error("Error in getAllPlaces: ", error);
            console.groupEnd();
            throw error;
        }
    }

    // Private helper methods
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

    _extractGeolocation(placeObj, tree) {
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

    async _getAllRecords() {
        return new Promise((resolve, reject) => {
            console.log('Accessing localStorage...');
            const storedData = localStorage.getItem("townsDB");
            if (storedData) {
                try {
                    const dbTowns = JSON.parse(storedData);
                    console.log('Successfully parsed townsDB, found', Object.keys(dbTowns).length, 'towns');
                    resolve(dbTowns);
                } catch (error) {
                    console.error("Error parsing JSON data:", error);
                    resolve({});
                }
            } else {
                console.log('No data found in townsDB');
                resolve({});
            }
        });
    }

    _processTree(tree, parentNode, individual) {
        for (const node of tree) {
            if (node.tag === "PLAC" && parentNode) {
                let placeInfo = this.processPlace({ data: node.data, tree: node.tree });
                let normalizedKey = normalizeGeoString(placeInfo.town);
                if (!normalizedKey) continue;

                parentNode.key = normalizedKey;
                this._updateTownWithEventData(normalizedKey, placeInfo, parentNode, individual);
            }

            if (node.tree && node.tree.length > 0) {
                this._processTree(
                    node.tree,
                    ["BIRT", "DEAT", "BURI", "MARR", "OCCU", "EVEN"].includes(node.tag) ? node : parentNode,
                    individual
                );
            }
        }
    }

    _updateTownWithEventData(normalizedKey, placeInfo, parentNode, individual) {
        const dateNode = parentNode.tree?.find(n => n.tag === "DATE");
        const eventDate = dateNode ? this.processDate(dateNode.data) : null;
        const personData = extractBasicInfo(individual);

        const eventData = {
            type: parentNode.tag,
            date: eventDate,
            personId: individual.pointer,
            personDetails: {
                name: personData.name,
                surname: personData.surname,
                gender: personData.gender,
                birthDate: '',
                deathDate: '',
                birthPlace: '',
                deathPlace: '',
                occupation: ''
            }
        };

        familyTownsStore.addOrUpdateTown(normalizedKey, placeInfo, eventData);
    }

    _updateTownsFromCache(currentTowns, geoCache) {
        const missingTowns = [];

        Object.entries(currentTowns).forEach(([key, town]) => {
            const cachedTown = geoCache[key];
            if (cachedTown) {
                familyTownsStore.updateTown(key, {
                    ...town,
                    latitude: cachedTown.latitude || town.latitude,
                    longitude: cachedTown.longitude || town.longitude,
                    departement: cachedTown.departement || town.departement,
                    departementColor: cachedTown.departementColor || town.departementColor,
                    country: cachedTown.country || town.country,
                    countryCode: cachedTown.countryCode || town.countryCode,
                    countryColor: cachedTown.countryColor || town.countryColor
                });
            } else {
                missingTowns.push(key);
            }
        });

        return missingTowns;
    }
}

export const placeProcessor = new PlaceProcessor();