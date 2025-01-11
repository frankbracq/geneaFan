import { TAGS } from '../stores/gedcomConstantsStore.js';
import { formatName } from '../processors/nameProcessor.js';
import { formatPersonLink } from '../utils/linkFormatter.js';

/**
 * Extrait et formate les informations de base d'un individu
 * @param {Object} individualJson - Les données brutes de l'individu
 * @returns {Object} Les informations de base formatées
 */
export function extractBasicInfo(individualJson) {
    const names = individualJson.tree.filter(node => node.tag === TAGS.NAME);
    const nameInfo = names.map(o => 
        o.data.split("/").map(s => s.trim().replace(/_/, " "))
    );

    let name = formatName(
        nameInfo.map(info => info[0]).find(n => n) || "",
        false
    );
    let surname = formatName(
        nameInfo.map(info => info[1]).find(s => s) || "",
        true
    );

    let fullName = `${name.split(" ")[0]} ${surname}`;
    let personLink = formatPersonLink(individualJson.pointer, fullName);

    const genderMap = { 'M': 'male', 'F': 'female' };

    const result = individualJson.tree.reduce((acc, curr) => {
        if (curr.tag === TAGS.SEX) {
            acc.gender = genderMap[curr.data] || 'unknown';
        } else if (curr.tag === TAGS.SIGNATURE) {
            acc.canSign = curr.data === 'YES';
        }
        return acc;
    }, { gender: 'male', canSign: false });

    return { 
        name, 
        surname, 
        gender: result.gender, 
        canSign: result.canSign, 
        personLink 
    };
}