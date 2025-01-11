import { makeObservable, observable, action, computed, runInAction, reaction } from '../../common/stores/mobx-config.js';
import _ from 'lodash';
import { buildIndividual } from '../builders/buildIndividual.js';
import { TAGS } from './gedcomConstantsStore.js';

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

        // Ajout d'une réaction pour construire automatiquement le cache
        this.addReactionDisposer(
            'buildCache',
            () => this.sourceData,
            (newSourceData) => {
                if (newSourceData && newSourceData.length > 0) {
                    console.log('🔄 Construction automatique du cache des individus...');
                    this.buildIndividualsCache(newSourceData);
                    
                    // Vider sourceData après construction du cache
                    runInAction(() => {
                        console.log('🗑️ Nettoyage des données source...');
                        this.sourceData = [];
                    });
                }
            },
            {
                name: 'buildCacheReaction'
            }
        );
    }

    // Méthode pour construire le cache
    buildIndividualsCache = async (sourceData) => {
        try {
            console.time('buildIndividualsCache');
            
            const allIndividuals = sourceData.filter(item => item.tag === TAGS.INDIVIDUAL);
            const allFamilies = sourceData.filter(item => item.tag === TAGS.FAMILY);
    
            const newCache = new Map();
            
            // Construire le cache de manière synchrone
            allIndividuals.forEach(individualJson => {
                const individual = buildIndividual(individualJson, allIndividuals, allFamilies);
                newCache.set(individualJson.pointer, individual);
            });
    
            // Mise à jour atomique du cache
            runInAction(() => {
                this.individualsCache = newCache;
                console.log(`Cache construit avec ${newCache.size} individus`);
            });
    
            console.timeEnd('buildIndividualsCache');
            return newCache; // Retourner le cache pour chaîner les opérations
        } catch (error) {
            console.error('Erreur lors de la construction du cache:', error);
            throw error;
        }
    }

    // Source Data Methods
    setSourceData = (newSourceData) => {
        if (!Array.isArray(newSourceData)) {
            console.error('setSourceData: les données doivent être un tableau');
            return;
        }

        console.log('🚀 setSourceData appelé avec', newSourceData?.length, 'éléments');
        runInAction(() => {
            this.sourceData = newSourceData;
            // La réaction se déclenchera automatiquement après cette mise à jour
        });
    }

    clearSourceData = () => {
        runInAction(() => {
            this.sourceData = [];
        });
    }

    clearCache = () => {
        runInAction(() => {
            this.individualsCache.clear();
        });
    }

    // Individuals Cache Methods
    setIndividualsCache = (newCache) => {
        runInAction(() => {
            this.individualsCache = new Map(newCache);
        });
    }

    getIndividualsCache = () => {
        console.log('📚 getIndividualsCache appelé, taille:', this.individualsCache.size);
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
            this.clearReactions(); // Nettoyer aussi les réactions
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