import { makeObservable, observable, action, computed, reaction } from 'mobx';
import gedcomDataStore from './gedcomDataStore';

class FamilyTreeDataStore {
    familyTreeData = [];

    constructor() {
        makeObservable(this, {
            familyTreeData: observable,
            setFamilyTreeData: action,
            updateFromIndividualsCache: action,
            clearFamilyTreeData: action,
            getFamilyTreeData: computed
        });

        // Réagir aux changements dans individualsCache
        reaction(
            () => gedcomDataStore.getIndividualsList(),
            (individuals) => {
                this.updateFromIndividualsCache(individuals);
            },
            {
                name: 'FamilyTreeDataStore-IndividualsCacheReaction'
            }
        );
    }

    setFamilyTreeData = (newData) => {
        this.familyTreeData = newData;
    }

    updateFromIndividualsCache = (individuals) => {
        this.familyTreeData = individuals.map(data => ({
            id: data.id,
            fid: data.fatherId,
            mid: data.motherId,
            pids: data.spouseIds,
            name: `${data.name} ${data.surname}`,
            birthDate: data.birthDate,
            deathDate: data.deathYear,
            gender: data.gender,
            display: true
        }));
    }

    clearFamilyTreeData = () => {
        this.familyTreeData = [];
    }

    get getFamilyTreeData() {
        return this.familyTreeData;
    }
}

const familyTreeDataStore = new FamilyTreeDataStore();
export default familyTreeDataStore;