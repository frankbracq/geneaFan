export class FamilyIndices {
    constructor() {
        this.clear();
    }

    clear() {
        console.log('FamilyIndices.clear called');
        this.byChild = new Map();
        this.byParent = new Map();
        this.byCouple = new Map();
    }

    initialize(families) {
        console.log('Initializing indices with families:', families.length);
        this.clear();

        families.forEach(family => {
            // Indexer par enfant
            family.tree
                .filter(node => node.tag === "CHIL")
                .forEach(node => {
                    if (!this.byChild.has(node.data)) {
                        this.byChild.set(node.data, []);
                    }
                    this.byChild.get(node.data).push(family);
                });

            // Récupérer les ID des parents
            const husbandNode = family.tree.find(node => node.tag === "HUSB");
            const wifeNode = family.tree.find(node => node.tag === "WIFE");

            // Indexer par parent
            [husbandNode, wifeNode].forEach(parentNode => {
                if (parentNode) {
                    if (!this.byParent.has(parentNode.data)) {
                        this.byParent.set(parentNode.data, []);
                    }
                    this.byParent.get(parentNode.data).push(family);
                }
            });

            // Indexer par couple
            if (husbandNode && wifeNode) {
                const coupleKey = `${husbandNode.data}:${wifeNode.data}`;
                this.byCouple.set(coupleKey, family);
            }
        });

        console.log('Indices initialized:', {
            children: this.byChild.size,
            parents: this.byParent.size,
            couples: this.byCouple.size
        });
    }

    getParentalFamily(individualId) {
        return this.byChild.get(individualId)?.[0] || null;
    }

    getFamiliesAsParent(individualId) {
        return this.byParent.get(individualId) || [];
    }

    getFamilyByCouple(husband, wife) {
        return this.byCouple.get(`${husband}:${wife}`);
    }

    logIndexStats() {
        console.log('Index Statistics:', {
            childrenIndexed: this.byChild.size,
            parentsIndexed: this.byParent.size,
            couplesIndexed: this.byCouple.size
        });
    }
}

export default FamilyIndices;