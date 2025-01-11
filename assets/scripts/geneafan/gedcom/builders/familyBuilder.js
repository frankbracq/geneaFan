import _ from 'lodash';
import { TAGS } from '../stores/gedcomConstantsStore.js';
import { getRelativeDetails } from './relativeBuilder.js';

export function getIndividualFamily(individualPointer, allFamilies, allIndividuals) {
    const result = {
        spouses: {},
        children: {}
    };

    const parentFamilies = _.filter(allFamilies, family =>
        _.some(family.tree, node =>
            (node.tag === TAGS.HUSBAND || node.tag === TAGS.WIFE) && node.data === individualPointer
        )
    );

    _.forEach(parentFamilies, family => {
        const spouses = _.map(
            _.filter(family.tree, node =>
                (node.tag === TAGS.HUSBAND || node.tag === TAGS.WIFE) && node.data !== individualPointer
            ),
            spouseNode => spouseNode.data
        );

        const children = _.map(
            _.filter(family.tree, node => node.tag === TAGS.CHILD),
            childNode => childNode.data
        );

        const marriageNode = _.find(family.tree, node => node.tag === TAGS.MARRIAGE);
        const marriageInfo = marriageNode ? {
            date: _.get(_.find(marriageNode.tree, { tag: TAGS.DATE }), 'data', ''),
            place: _.get(_.find(marriageNode.tree, { tag: TAGS.PLACE }), 'data', ''),
            key: _.get(marriageNode, 'key', '')
        } : {};

        _.forEach(spouses, spouseId => {
            if (!result.spouses[spouseId]) {
                result.spouses[spouseId] = {
                    details: getRelativeDetails(spouseId, allIndividuals),
                    children: [],
                    marriage: marriageInfo
                };
            }

            _.forEach(children, childId => {
                const childDetails = getRelativeDetails(childId, allIndividuals);
                result.spouses[spouseId].children.push(childDetails);

                if (!result.children[childId]) {
                    result.children[childId] = {
                        details: childDetails,
                        parents: []
                    };
                }
                result.children[childId].parents.push(individualPointer);
            });
        });
    });
    return result;
}

export function getParentalFamily(individualPointer, allFamilies, allIndividuals) {
    const parentFamily = allFamilies.find((family) =>
        family.tree.some(
            (node) => node.tag === TAGS.CHILD && node.data === individualPointer
        )
    );

    if (!parentFamily) {
        return { siblings: [], fatherId: null, motherId: null, siblingIds: [] };
    }

    const husband = parentFamily.tree.find((node) => node.tag === TAGS.HUSBAND)?.data;
    const wife = parentFamily.tree.find((node) => node.tag === TAGS.WIFE)?.data;

    let siblings = parentFamily.tree
        .filter((node) => node.tag === TAGS.CHILD && node.data !== individualPointer)
        .map((siblingNode) =>
            getRelativeDetails(siblingNode.data, allIndividuals)
        )
        .filter((sibling) => sibling !== null);

    let siblingIds = parentFamily.tree
        .filter((node) => node.tag === TAGS.CHILD && node.data !== individualPointer)
        .map((siblingNode) => siblingNode.data);

    siblings = _.orderBy(
        siblings,
        [
            (member) =>
                member.birthDate
                    ? new Date(member.birthDate.split("/").reverse().join("-"))
                    : Infinity,
            "name",
        ],
        ["asc", "asc"]
    );
    return { siblings, fatherId: husband, motherId: wife, siblingIds };
}