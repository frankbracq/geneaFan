import { makeObservable, observable, action, computed, runInAction, toJS } from './mobx-config.js';

class FamilyTownsStore {
    townsData = new Map();
    isLoading = false;

    constructor() {
        makeObservable(this, {
            townsData: observable,
            isLoading: observable,
            setTownsData: action,
            addTown: action,
            updateTown: action,
            totalTowns: computed
        });
        
        if (typeof document !== 'undefined') {
            document.addEventListener('DOMContentLoaded', () => {
                const button = document.createElement('button');
                button.textContent = 'Debug Store';
                button.style.position = 'fixed';
                button.style.top = '10px';
                button.style.right = '10px';
                button.onclick = this.runBasicTests.bind(this);

                const geocodeButton = document.createElement('button');
                geocodeButton.textContent = 'Test Geocoding';
                geocodeButton.style.position = 'fixed';
                geocodeButton.style.top = '40px';
                geocodeButton.style.right = '10px';
                geocodeButton.onclick = this.testGeocoding.bind(this);

                document.body.appendChild(button);
                document.body.appendChild(geocodeButton);
            });
        }
    }

    // Helper pour nettoyer les données proxy
    cleanData = (data) => {
        return toJS(data);
    }

    // Méthodes existantes avec nettoyage des données
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
            // Identifier les villes à mettre à jour
            const townsToUpdate = {};
            this.townsData.forEach((town, key) => {
                if (((town.country === 'France' || town.country === 'FR' || town.country === '') &&
                    ((town.departement && town.departement.length === 2) || !town.departement || !town.latitude || !town.longitude)) ||
                    ((town.country !== 'France' && town.country !== 'FR' && town.country !== '') && (!town.latitude || !town.longitude))) {
                    townsToUpdate[key] = this.cleanData(town);
                }
            });

            console.log('Towns to update:', townsToUpdate);

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
            console.log('Received updated towns:', updatedTowns);
            
            runInAction(() => {
                Object.entries(updatedTowns).forEach(([key, data]) => {
                    this.updateTown(key, data);
                });
                this.saveToLocalStorage();
            });

            console.log('Geocoding completed successfully');

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

    // Test du géocodage
    testGeocoding = async () => {
        console.clear();
        console.log('=== Testing Geocoding ===');

        // Clear existing data
        localStorage.removeItem('townsDB');
        this.setTownsData({});

        // Add test town
        console.log('\n1. Adding test town...');
        this.addTown('bordeaux', {
            town: 'Bordeaux',
            departement: '33',
            country: 'France'
        });
        console.log('Initial Bordeaux data:', this.getTown('bordeaux'));

        // Run geocoding
        console.log('\n2. Running geocoding...');
        await this.updateTownsViaProxy();
        console.log('Bordeaux after geocoding:', this.getTown('bordeaux'));

        console.log('\n=== Geocoding Test Complete ===');
    }

    // Méthode de test améliorée
    runBasicTests = () => {
        console.clear();
        console.log('=== Starting Basic Store Tests ===');

        // Test 0: Clear initial state
        localStorage.removeItem('townsDB');
        this.setTownsData({});
        console.log('\n0. État initial après nettoyage:');
        console.log('Total towns:', this.totalTowns);

        // Test 1: Ajout de ville
        console.log('\n1. Test d\'ajout:');
        this.addTown('paris', {
            town: 'Paris',
            townDisplay: 'Paris (75)',
            departement: '75',
            country: 'France'
        });
        console.log('After adding Paris - Total towns:', this.totalTowns);
        console.log('Paris data:', this.getTown('paris'));

        // Test 2: Mise à jour
        console.log('\n2. Test de mise à jour:');
        this.updateTown('paris', {
            latitude: '48.8566',
            longitude: '2.3522'
        });
        console.log('Updated Paris data:', this.getTown('paris'));

        // Test 3: Persistence
        console.log('\n3. Test de persistence:');
        console.log('Saving to localStorage...');
        this.saveToLocalStorage();
        console.log('localStorage content:', localStorage.getItem('townsDB'));
        
        console.log('\nClearing memory data...');
        this.setTownsData({});
        console.log('After clear - Total towns:', this.totalTowns);
        
        console.log('\nLoading from localStorage...');
        this.loadFromLocalStorage();
        console.log('After load - Total towns:', this.totalTowns);
        console.log('Loaded data:', this.getTown('paris'));

        console.log('\n=== Tests Complete ===');
    }
}

const familyTownsStore = new FamilyTownsStore();
export default familyTownsStore;