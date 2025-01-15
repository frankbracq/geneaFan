import { makeObservable, observable, action, computed, reaction, runInAction } from '../common/stores/mobx-config.js';
import _ from 'lodash';
import { buildIndividual } from './builders/personBuilder.js';
import configStore from '../tabs/fanChart/fanConfigStore.js';
import { TAGS, byTag } from './gedcomConstantsStore.js';
import { storeEvents, EVENTS } from './storeEvents.js'; 

class GedcomDataStore {
    sourceData = [];
    individualsCache = new Map();
    _hierarchy = null;
    familyEvents = [];
    isFileUploaded = false;
    reactionDisposers = new Map();  // Nouveau: stockage des réactions

    constructor() {
        makeObservable(this, {
            sourceData: observable,
            individualsCache: observable,
            _hierarchy: observable.ref,
            familyEvents: observable,
            isFileUploaded: observable,
            reactionDisposers: observable, // Nouveau
            
            // Actions
            setSourceData: action,
            clearSourceData: action,
            setIndividualsCache: action,
            setHierarchy: action,
            addFamilyEvent: action,
            setFamilyEvents: action,
            setFileUploaded: action,
            clearAllState: action,
            addReactionDisposer: action, // Nouveau
            removeReactionDisposer: action, // Nouveau
            clearReactions: action, // Nouveau
            
            // Computed
            totalIndividuals: computed,
            hasData: computed,
            familyTreeData: computed
        });

        reaction(
            () => this.sourceData,
            (json) => {
                if (json && json.length > 0) {
                    console.group('📥 Source JSON avant traitement');
                    console.log('Nombre d\'entrées:', json.length);
                    // Déconstruire le proxy du JSON source
                    console.log('Contenu:', JSON.parse(JSON.stringify(json)));
                    console.groupEnd();
        
                    this.buildIndividualsCache(json);
                    this.clearSourceData();
        
                    // Log détaillé du cache
                    console.group('🗂️ Cache des individus après construction');
                    console.log('Nombre total d\'individus:', this.individualsCache.size);
                    
                    this.individualsCache.forEach((individual, id) => {
                        // Déconstruire le proxy de chaque individu
                        const cleanIndividual = JSON.parse(JSON.stringify(individual));
                        console.group(`👤 ${cleanIndividual.name} ${cleanIndividual.surname} (${id})`);
                        
                        if (cleanIndividual.individualEvents?.length > 0) {
                            console.group('📅 Événements:');
                            cleanIndividual.individualEvents.forEach(event => {
                                console.log({
                                    type: event.type,
                                    date: event.date,
                                    town: event.town,
                                    formatted: event.formatted || ''
                                });
                            });
                            console.groupEnd();
                        } else {
                            console.log('Aucun événement');
                        }
                        
                        console.groupEnd();
                    });
                    
                    console.groupEnd();
                }
            },
            {
                name: 'sourceDataToCache',
                fireImmediately: false
            }
        );
    }

    addIndividual = (id, data) => {
        runInAction(() => {
            this.individualsCache.set(id, data);
            storeEvents.emit(EVENTS.INDIVIDUAL.ADDED, { id, data });
        });
    }

    buildIndividualsCache(json) {
        console.time("buildIndividualsCache");
        const allIndividuals = _.filter(json, byTag(TAGS.INDIVIDUAL));
        const allFamilies = _.filter(json, byTag(TAGS.FAMILY));

        // Traiter les individus pour le cache
        const newCache = new Map();
        allIndividuals.forEach(individualJson => {
            const individual = buildIndividual(individualJson, allIndividuals, allFamilies);
            newCache.set(individualJson.pointer, individual);
        });

        // Mise à jour atomique du cache
        runInAction(() => {
            this.individualsCache = newCache;
            
            // Émettre les événements individuels après la mise à jour atomique
            newCache.forEach((data, id) => {
                storeEvents.emit(EVENTS.INDIVIDUAL.ADDED, { id, data });
            });
            
            // Émettre l'événement de construction complète
            storeEvents.emit(EVENTS.CACHE.BUILT, this.individualsCache);
        });

        // Calculer le nombre max de générations
        const maxGenerations = this.calculateMaxGenerations(newCache, allFamilies);
        configStore.setConfig({ maxGenerations: Math.min(maxGenerations, 8) });
        configStore.setAvailableGenerations(maxGenerations);

        console.timeEnd("buildIndividualsCache");
    }

    calculateMaxGenerations(individualsCache, allFamilies) {
        let maxGen = 0;
        const generationMap = new Map();
    
        // Initialize with root individuals (those without parents)
        const rootIndividuals = Array.from(individualsCache.keys()).filter(id => {
            const individual = individualsCache.get(id);
            return !individual.fatherId && !individual.motherId;
        });
    
        // Set generation 1 for root individuals
        rootIndividuals.forEach(id => generationMap.set(id, 1));
    
        // Process each family to calculate generations
        let changed = true;
        while (changed) {
            changed = false;
            allFamilies.forEach(family => {
                // Get parents
                const fatherId = family.tree.find(node => node.tag === 'HUSB')?.data;
                const motherId = family.tree.find(node => node.tag === 'WIFE')?.data;
    
                // Get parent generation (max of both parents if they exist)
                const parentGen = Math.max(
                    generationMap.get(fatherId) || 0,
                    generationMap.get(motherId) || 0
                );
    
                if (parentGen > 0) {
                    // Process children
                    const childNodes = family.tree.filter(node => node.tag === 'CHIL');
                    childNodes.forEach(childNode => {
                        const childId = childNode.data;
                        const currentChildGen = generationMap.get(childId) || 0;
                        const newChildGen = parentGen + 1;
    
                        if (newChildGen > currentChildGen) {
                            generationMap.set(childId, newChildGen);
                            maxGen = Math.max(maxGen, newChildGen);
                            changed = true;
                        }
                    });
                }
            });
        }
    
        return maxGen;
    }

    // Source Data Methods
    setSourceData = (newSourceData) => {
        runInAction(() => {
            this.sourceData = newSourceData;
        });
    }

    clearSourceData = () => {
        runInAction(() => {
            this.sourceData = [];
        });
    }

    // Individuals Cache Methods
    setIndividualsCache = (newCache) => {
        runInAction(() => {
            this.individualsCache = new Map(newCache);
        });
    }

    getIndividualsCache = () => {
        return this.individualsCache;
    }

    getIndividualsList = () => {
        return Array.from(this.individualsCache.values());
    }

    getIndividual = (id) => {
        return this.individualsCache.get(id);
    }

    addIndividual = (id, data) => {
        runInAction(() => {
            this.individualsCache.set(id, data);
        });
    }

    // Hierarchy Methods
    setHierarchy = (newHierarchy) => {
        console.log('📊 setHierarchy appelé avec:', newHierarchy);
        runInAction(() => {
            const oldHierarchy = this._hierarchy;
            this._hierarchy = newHierarchy;
            console.log('✨ Hiérarchie mise à jour:', {
                old: oldHierarchy ? 'présent' : 'null',
                new: newHierarchy ? 'présent' : 'null',
                changed: oldHierarchy !== newHierarchy
            });
        });
    }

    getHierarchy = () => {
        const hierarchy = this._hierarchy;
        console.log('🔍 getHierarchy appelé, retourne:', hierarchy ? 'présent' : 'null');
        return hierarchy;
    }

    // Family Events Methods
    addFamilyEvent = (event) => {
        runInAction(() => {
            this.familyEvents.push(event);
        });
    }

    setFamilyEvents = (events) => {
        runInAction(() => {
            this.familyEvents = [...events];
        });
    }

    getFamilyEvents = () => {
        return this.familyEvents;
    }

    clearFamilyEvents = () => {
        runInAction(() => {
            this.familyEvents = [];
        });
    }

    // File Upload Status Methods
    setFileUploaded = (status) => {
        runInAction(() => {
            this.isFileUploaded = status;
        });
    }

    getFileUploaded = () => {
        return this.isFileUploaded;
    }

    // Nouvelles méthodes pour la gestion des réactions
    addReactionDisposer = (id, trackedFn, effectFn, options = {}) => {
        console.log('📝 Ajout d\'une réaction:', id);
        runInAction(() => {
            // Nettoyer une réaction existante
            if (this.reactionDisposers.has(id)) {
                console.log('🧹 Nettoyage de l\'ancienne réaction:', id);
                this.reactionDisposers.get(id)();
                this.reactionDisposers.delete(id);
            }
    
            // Vérifications
            if (typeof trackedFn !== 'function' || typeof effectFn !== 'function') {
                console.error('❌ trackedFn et effectFn doivent être des fonctions');
                return;
            }
    
            try {
                // Wrapper le trackedFn pour le debugging
                const wrappedTrackedFn = () => {
                    const result = trackedFn();
                    console.log(`🔍 trackedFn ${id} retourne:`, result);
                    return result;
                };
    
                // Wrapper le effectFn pour le debugging
                const wrappedEffectFn = (value) => {
                    console.log(`🎯 effectFn ${id} appelé avec:`, value);
                    return effectFn(value);
                };
    
                // Créer la réaction avec les wrappers
                const disposer = reaction(
                    wrappedTrackedFn,
                    wrappedEffectFn,
                    {
                        ...options,
                        onError: (error) => {
                            console.error(`🚨 Erreur dans la réaction ${id}:`, error);
                            if (options.onError) options.onError(error);
                        }
                    }
                );
    
                this.reactionDisposers.set(id, disposer);
                console.log('✅ Réaction ajoutée avec succès:', id);
            } catch (error) {
                console.error('❌ Erreur lors de la création de la réaction:', error);
            }
        });
    }

    removeReactionDisposer = (id) => {
        runInAction(() => {
            if (this.reactionDisposers.has(id)) {
                this.reactionDisposers.get(id)();
                this.reactionDisposers.delete(id);
            }
        });
    }

    clearReactions = () => {
        runInAction(() => {
            this.reactionDisposers.forEach(disposer => disposer());
            this.reactionDisposers.clear();
        });
    }

    // Reset State
    clearAllState = () => {
        runInAction(() => {
            this.sourceData = [];
            this.individualsCache = new Map();
            this._hierarchy = null;
            this.familyEvents = [];
            this.isFileUploaded = false;
            this.clearReactions();
            
            // Émettre l'événement de nettoyage
            storeEvents.emit(EVENTS.CACHE.CLEARED);
        });
    }

    // Computed Properties
    get totalIndividuals() {
        return this.individualsCache.size;
    }

    get hasData() {
        return this.sourceData.length > 0;
    }

    get familyTreeData() {
        return this.getFamilyTreeData();
    }

    // Family Tree Data
    getFamilyTreeData = () => {
        return Array.from(this.individualsCache.values()).map(data => ({
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
}

const gedcomDataStore = new GedcomDataStore();
export default gedcomDataStore;