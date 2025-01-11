import _ from 'lodash';
import { TAGS } from '../stores/gedcomConstantsStore.js';
import { getIndividualFamily } from '../builders/familyBuilder.js';
import { processEventDatePlace } from './eventProcessor.js';
import { generateEventDescription } from './eventProcessor.js';

export function processMarriages(individualPointer, allIndividuals, allFamilies, individualTowns) {
    if (!individualPointer || !_.isArray(allFamilies)) {
        return [];
    }

    // Collect marriage information using getIndividualFamily
    const individualFamilyInfo = getIndividualFamily(individualPointer, allFamilies, allIndividuals);

    const marriages = _.map(individualFamilyInfo.spouses, (spouseInfo, spouseId) => {
        const { details: spouseDetails, children, marriage } = spouseInfo;

        // Process the details of the marriage event
        const event = {
            tree: [
                { tag: 'DATE', data: marriage.date }, 
                { tag: 'PLAC', data: marriage.place }
            ],
            key: marriage.key // Add the town key (townKey)
        };
        
        const { eventDetails: rawEventDetails, updatedIndividualTowns } = processEventDatePlace(
            event,
            individualTowns
        );

        // Add the family ID to the event details
        const eventDetails = { 
            ...rawEventDetails, 
            eventId: '', 
            spouseId 
        };

        // Get the spouse's name
        const spouseName = spouseDetails.name;

        // Generate the formatted marriage description
        const formattedMarriage = generateEventDescription(
            "MARR",
            {
                ...eventDetails,
                spouseName: spouseName,
                spouseId: spouseId 
            },
            "",  // gender
            ""   // age
        );

        // Get the couple's details
        const couple = {
            husband: individualPointer,
            wife: spouseId
        };

        return { 
            formattedMarriage, 
            children, 
            spouseName, 
            eventDetails, 
            couple 
        };
    });

    return marriages;
}