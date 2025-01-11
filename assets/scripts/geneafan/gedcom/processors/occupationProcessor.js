import _ from 'lodash';
import jsonpointer from 'jsonpointer';
import { TAGS, VALUE_OCCUPATION } from '../stores/gedcomConstantsStore.js';
import { byTag } from '../stores/gedcomConstantsStore.js';
import { extractYear } from "../../utils/dates.js";
import { processDate } from './dateProcessor.js';

export function formatOccupation(occupation) {
    if (!occupation) return null;
    return occupation.charAt(0).toUpperCase() + occupation.slice(1).toLowerCase();
}

export function processOccupations(individualJson) {
    // Direct retrieval of occupations
    const directOccupations = jsonpointer.get(individualJson, '/tree').filter(byTag(TAGS.OCCUPATION))
        .map((occ) => ({
            occupation: formatOccupation(occ.data),
        }));

    // Retrieval of occupation details in marked events
    const detailOccupations = jsonpointer.get(individualJson, '/tree').filter(
        (node) => node.tag === TAGS.EVENT &&
            jsonpointer.get(node, '/tree').some(
                (subNode) => subNode.tag === TAGS.TYPE && subNode.data === VALUE_OCCUPATION
            )
    ).flatMap((node) => jsonpointer.get(node, '/tree').filter((subNode) => subNode.tag === TAGS.NOTE))
        .map((note) => ({
            occupation: note.data, // Assume these details as additional occupations
        }));

    // Combine direct occupations and details
    const allOccupations = [...directOccupations, ...detailOccupations];

    // Construct the formatted list of occupations
    let formattedOccupations =
        allOccupations.length > 0
            ? `<ul class='list-group'>${allOccupations
                .map((occ) => `<li class='list-group-item'>${occ.occupation}</li>`)
                .join("")}</ul>`
            : "";

    return formattedOccupations;
}

export function processDetailedOccupations(individualJson) {
    const occupations = [];

    // Traiter les occupations directes
    individualJson.tree
        .filter(node => node.tag === TAGS.OCCUPATION)
        .forEach(occNode => {
            const dateNode = occNode.tree?.find(node => node.tag === TAGS.DATE);
            occupations.push({
                value: formatOccupation(occNode.data),
                date: dateNode ? processDate(dateNode.data) : null,
                year: dateNode ? extractYear(processDate(dateNode.data)) : null,
                type: 'direct'
            });
        });

    // Ajouter les occupations des événements
    individualJson.tree
        .filter(node =>
            node.tag === TAGS.EVENT &&
            node.tree.some(subNode =>
                subNode.tag === TAGS.TYPE &&
                subNode.data === VALUE_OCCUPATION
            )
        )
        .forEach(eventNode => {
            const dateNode = eventNode.tree?.find(node => node.tag === TAGS.DATE);
            const noteNode = eventNode.tree?.find(node => node.tag === TAGS.NOTE);

            if (noteNode) {
                occupations.push({
                    value: formatOccupation(noteNode.data),
                    date: dateNode ? processDate(dateNode.data) : null,
                    year: dateNode ? extractYear(processDate(dateNode.data)) : null,
                    type: 'event'
                });
            }
        });

    return _.orderBy(occupations, ['year', 'date'], ['asc', 'asc']);
}