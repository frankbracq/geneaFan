import _ from 'lodash';
import gedcomConstantsStore from '../../../gedcom/gedcomConstantsStore.js';
import { extractYear } from '../../../utils/dates.js';  

const { TAGS } = gedcomConstantsStore;

function byTag(tag) {
    return (obj) => obj.tag === tag;
}

function processStatistics(data) {
    const { individuals, families } = data;
    
    const statistics = {
        totalIndividuals: 0,
        genderCount: { male: 0, female: 0 },
        birthYears: [],
        deathYears: [],
        agesAtDeath: [],
        marriages: 0,
        childrenPerCouple: [],
        ageAtFirstChild: {}
    };

    // Pre-compute family statistics
    const familyStatistics = new Map();
families.forEach(family => {
    const childrenCount = family.tree.filter(byTag(TAGS.CHILD)).length;
    const marriageNode = family.tree.find(byTag(TAGS.MARRIAGE));
    const marriageDateNode = marriageNode?.tree.find(byTag(TAGS.DATE));
    const marriageDate = marriageDateNode ? extractYear(marriageDateNode.data) : null;  // ← Modifié ici

    if (marriageDate) {
        familyStatistics.set(family.pointer, {
            childrenCount,
            marriageDate
        });
        
        if (childrenCount > 0) {
            statistics.childrenPerCouple.push(childrenCount);
        }
        
        statistics.marriages++;
    }
    });

    // Process individuals
    individuals.forEach(individual => {
        statistics.totalIndividuals++;

        // Process gender
        const gender = individual.tree.find(byTag(TAGS.SEX))?.data;
        if (gender === 'M') statistics.genderCount.male++;
        if (gender === 'F') statistics.genderCount.female++;

        // Process birth and death dates
        const birthNode = individual.tree.find(node => 
            [TAGS.BIRTH, TAGS.BAPTISM].includes(node.tag));
        const deathNode = individual.tree.find(node => 
            [TAGS.DEATH, TAGS.BURIAL].includes(node.tag));

        const birthDateNode = birthNode?.tree.find(byTag(TAGS.DATE));
        const deathDateNode = deathNode?.tree.find(byTag(TAGS.DATE));

        const birthYear = birthDateNode ? extractYear(birthDateNode.data) : null;
        const deathYear = deathDateNode ? extractYear(deathDateNode.data) : null;

        if (birthYear) statistics.birthYears.push(birthYear);
        if (deathYear) statistics.deathYears.push(deathYear);

        if (birthYear && deathYear) {
            const age = deathYear - birthYear;
            if (age >= 0 && age <= 120) {
                statistics.agesAtDeath.push(age);
            }
        }
    });

    // Report progress periodically
    self.postMessage({
        type: 'progress',
        data: Math.round((statistics.totalIndividuals / individuals.length) * 100)
    });

    self.postMessage({
        type: 'statistics',
        data: statistics
    });
}

self.addEventListener('message', (e) => {
    if (e.data.type === 'process') {
        processStatistics(e.data.data);
    }
});