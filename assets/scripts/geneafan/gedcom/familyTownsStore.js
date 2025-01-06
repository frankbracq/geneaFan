import { makeObservable, observable, action, computed, runInAction, toJS, autorun } from '../common/stores/mobx-config.js';
import { eventBus } from '../tabs/familyMap/eventBus.js';

class FamilyTownsStore {
    constructor() {
        this.townsData = new Map();
        this.isLoading = false;

        makeObservable(this, {
            townsData: observable,
            isLoading: observable,
            setTownsData: action,
            addTown: action,
            updateTown: action,
            totalTowns: computed
        });

        // Émettre un événement quand les données changent
        autorun(() => {
            if (this.townsData.size > 0) {
                eventBus.emit('familyTownsUpdated', this.townsData);
            }
        });
    }

    cleanData = (data) => {
        return toJS(data);
    }

    getTown = (key) => {
        const town = this.townsData.get(key);
        return town ? this.cleanData(town) : null;
    }

    getAllTowns = () => {
        return this.cleanData(Object.fromEntries(this.townsData));
    }

    setTownsData = (towns) => {
        runInAction(() => {
            this.townsData = new Map(Object.entries(towns));
        });
    }

    addTown = (key, townData) => {
        runInAction(() => {
            this.townsData.set(key, {
                town: townData.town || '',
                townDisplay: townData.townDisplay || townData.town || '',
                departement: townData.departement || '',
                departementColor: townData.departementColor || '',
                country: townData.country || '',
                countryCode: townData.countryCode || '',
                countryColor: townData.countryColor || '',
                latitude: townData.latitude || '',
                longitude: townData.longitude || ''
            });
        });
    }

    updateTown = (key, updates) => {
        runInAction(() => {
            const town = this.townsData.get(key);
            if (town) {
                this.townsData.set(key, { ...town, ...updates });
            }
        });
    }

    updateTownsViaProxy = async () => {
        console.log('Starting geocoding process...');
        runInAction(() => {
            this.isLoading = true;
        });

        try {
            const townsToUpdate = {};
            this.townsData.forEach((town, key) => {
                if (((town.country === 'France' || town.country === 'FR' || town.country === '') &&
                    ((town.departement && town.departement.length === 2) || !town.departement || !town.latitude || !town.longitude)) ||
                    ((town.country !== 'France' && town.country !== 'FR' && town.country !== '') && (!town.latitude || !town.longitude))) {
                    townsToUpdate[key] = this.cleanData(town);
                }
            });

            if (Object.keys(townsToUpdate).length === 0) {
                console.log('No towns need updating');
                return;
            }

            const response = await fetch('https://opencageproxy.genealogie.workers.dev/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    familyTowns: townsToUpdate,
                    userId: localStorage.getItem('userId')
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const updatedTowns = await response.json();
            
            runInAction(() => {
                Object.entries(updatedTowns).forEach(([key, data]) => {
                    this.updateTown(key, data);
                });
                this.saveToLocalStorage();
            });

        } catch (error) {
            console.error('Error updating towns:', error);
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });
        }
    }

    loadFromLocalStorage = () => {
        try {
            const stored = localStorage.getItem('townsDB');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.setTownsData(parsed);
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }

    saveToLocalStorage = () => {
        try {
            const data = this.getAllTowns();
            localStorage.setItem('townsDB', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    get totalTowns() {
        return this.townsData.size;
    }
}

const familyTownsStore = new FamilyTownsStore();
export default familyTownsStore;