import { TAGS } from '../stores/gedcomConstantsStore.js';
import { extractBasicInfo } from './personBuilder.js';
import { processDate } from '../processors/dateProcessor.js';

export function getRelativeDetails(individualID, allIndividuals) {
    const individual = allIndividuals.find((ind) => ind.pointer === individualID);
    if (!individual) return null;

    const { name, surname } = extractBasicInfo(individual);
    const firstName = name ? name.split(" ")[0] : "";
    const fullName =
        firstName || surname
            ? `${firstName || ""} ${surname || ""}`.trim()
            : "Nom inconnu";

    const birthEventNode = individual.tree.find((node) => node.tag === TAGS.BIRTH);
    const deathEventNode = individual.tree.find((node) => node.tag === TAGS.DEATH);

    const birthDateNode = birthEventNode
        ? birthEventNode.tree.find((node) => node.tag === TAGS.DATE)
        : null;
    const birthDate = birthDateNode ? processDate(birthDateNode.data) : "";
    const deathDateNode = deathEventNode
        ? deathEventNode.tree.find((node) => node.tag === TAGS.DATE)
        : null;
    const deathDate = deathDateNode ? processDate(deathDateNode.data) : "";

    return {
        id: individualID,
        name: fullName,
        birthDate: birthDate,
        deathDate: deathDate,
    };
}