import { makeAutoObservable, action, reaction, runInAction, computed, comparer } from '../../common/stores/mobx-config.js';
import 'tom-select/dist/css/tom-select.css';
import { FanChartManager } from "./fanChartManager.js";
import _ from 'lodash';

class ConfigStore {
    config = {
        fanAngle: 270,
        maxGenerations: 8,
        availableGenerations: 8,
        showMarriages: true,
        invertTextArc: true,
        coloringOption: "none",
        showMissing: true,
        dates: {
            showYearsOnly: true,
            showInvalidDates: false,
        },
        places: {
            showPlaces: true,
            showReducedPlaces: true,
        },
        givenThenFamilyName: true,
        showFirstNameOnly: true,
        substituteEvents: false,
        isTimeVisualisationEnabled: false,
        title: "",
        titleSize: 1.0,
        titleMargin: 0.25,
        weights: {
            generations: [1.0, 1.0, 1.7, 1.4],
            strokes: 0.02,
        },
        contemporary: {
            showEvents: true,
            showNames: true,
            trulyAll: false,
            generations: 1,
        },
        fanDimensions: undefined,
        frameDimensions: undefined,
        computeChildrenCount: false,
        filename: "",
        gedcomFileName: "",
    };

    _batchUpdating = false;
    _queueTimeout = null;
    _updateQueued = false;
    _pendingUpdates = new Set();
    _drawInProgress = false;
    _isRootChangeInProgress = false;

    get angle() {
        return (2 * Math.PI * this.config.fanAngle) / 360.0;
    }

    get dimensions() {
        return this.calculateDimensions(
            this.config.fanAngle,
            this.config.maxGenerations,
            this.config.showMarriages
        );
    }

    constructor() {
        const initialDimensions = this.calculateDimensions(
            this.config.fanAngle,
            this.config.maxGenerations,
            this.config.showMarriages
        );

        if (initialDimensions) {
            this.config.fanDimensions = initialDimensions.fanDimensionsInMm;
            this.config.frameDimensions = initialDimensions.frameDimensionsInMm;
        }

        const style = document.createElement('style');
        style.textContent = `
            .btn-outline-primary.disabled,
            .btn-outline-primary:disabled {
                background-color: var(--bg-color-dark);
                border-color: var(--color-light);
                color: var(--color-light);
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .btn-check:disabled + .btn-outline-primary, 
            .btn-check[disabled] + .btn-outline-primary {
                background-color: var(--bg-color-dark);
                border-color: var(--color-light);
                color: var(--color-light);
                opacity: 0.5;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);

        makeAutoObservable(this, {
            batchUpdate: action,
            updateFanParameter: action,
            handleSettingChange: action,
            handleSettingChangeInternal: action,
            setConfig: action,
            setGedcomFileName: action,
            queueSettingChange: action,
            
            angle: computed,
            dimensions: computed,
            
            _queueTimeout: false,
            _updateQueued: false,
            _batchUpdating: false,
            _pendingUpdates: false,
            configHistory: false
        });

        reaction(
            () => ({
                fanAngle: this.config.fanAngle,
                maxGenerations: this.config.maxGenerations,
                showMarriages: this.config.showMarriages,
                invertTextArc: this.config.invertTextArc,
                coloringOption: this.config.coloringOption,
                showMissing: this.config.showMissing
            }),
            (params, previousParams) => {
                if (this._batchUpdating) return;
                
                console.group('🔍 ConfigStore Reaction');
                console.log('Current params:', params);
                console.log('Previous params:', previousParams);
                
                if (previousParams && _.isEqual(params, previousParams)) {
                    console.log('⏭️ Skipping - No real changes');
                    console.groupEnd();
                    return;
                }
        
                runInAction(() => {
                    let needsUpdate = false;
        
                    if (params.fanAngle !== previousParams?.fanAngle) {
                        this.config.titleMargin = params.fanAngle === 360 ? 0.35 : 0.25;
                        this._pendingUpdates.add('fanAngle');
                        needsUpdate = true;
                    }
        
                    if (params.coloringOption !== previousParams?.coloringOption) {
                        this.config.computeChildrenCount = params.coloringOption === "childrencount";
                        this._pendingUpdates.add('coloringOption');
                        needsUpdate = true;
                    }
        
                    if (params.fanAngle !== previousParams?.fanAngle ||
                        params.maxGenerations !== previousParams?.maxGenerations ||
                        params.showMarriages !== previousParams?.showMarriages) {
                        const dimensions = this.dimensions;
                        if (dimensions) {
                            this.config.fanDimensions = dimensions.fanDimensionsInMm;
                            this.config.frameDimensions = dimensions.frameDimensionsInMm;
                        }
                        this._pendingUpdates.add('dimensions');
                        needsUpdate = true;
                    }
        
                    if (params.invertTextArc !== previousParams?.invertTextArc) {
                        this._pendingUpdates.add('invertTextArc');
                        needsUpdate = true;
                    }
                    if (params.showMissing !== previousParams?.showMissing) {
                        this._pendingUpdates.add('showMissing');
                        needsUpdate = true;
                    }
        
                    // Seulement appeler handleSettingChange si des changements réels ont eu lieu
                    if (needsUpdate && this._pendingUpdates.size > 0) {
                        this.handleSettingChange();
                    }
                });
            },
            {
                equals: comparer.structural,
                name: 'ConfigStore-FanParametersReaction'
            }
        );

        reaction(
            () => rootPersonStore.root,
            () => {
                this._isRootChangeInProgress = true;
                try {
                    // Ajout d'un délai minime pour laisser le changement de root se terminer
                    setTimeout(() => {
                        this._isRootChangeInProgress = false;
                    }, 0);
                } catch (error) {
                    this._isRootChangeInProgress = false;
                }
            }
        );

        reaction(
            () => this.config.availableGenerations,
            (availableGens) => {
                runInAction(() => {
                    const gen8Radio = document.getElementById('max-generations-8');
                    const gen8Label = document.querySelector('label[for="max-generations-8"]');
                    const gen7Radio = document.getElementById('max-generations-7');
                    
                    if (gen8Radio && gen8Label && gen7Radio) {
                        if (availableGens < 8) {
                            // Désactiver l'option 8 générations
                            gen8Radio.disabled = true;
                            gen8Label.classList.add('disabled');
                            
                            // Ajouter l'événement click sur le label
                            gen8Label.onclick = (e) => {
                                e.preventDefault();
                                const alertElement = document.getElementById('alert');
                                const alertContent = document.getElementById('alert-content');
                                if (alertElement && alertContent) {
                                    alertContent.textContent = "Votre fichier Gedcom comporte moins de 8 générations";
                                    alertElement.classList.remove('d-none');
                                    alertElement.classList.add('show');
                                    
                                    // Cacher l'alerte après 3 secondes
                                    setTimeout(() => {
                                        alertElement.classList.remove('show');
                                        alertElement.classList.add('d-none');
                                    }, 3000);
                                }
                            };
                            
                            // Toujours passer à 7 générations
                            this.setConfig({ maxGenerations: 7 });
                            gen7Radio.checked = true;
                            gen8Radio.checked = false;
                        } else {
                            // Réactiver l'option 8 générations
                            gen8Radio.disabled = false;
                            gen8Label.classList.remove('disabled');
                            // Retirer l'événement click
                            gen8Label.onclick = null;
                        }
                    }
                });
            },
            {
                name: 'ConfigStore-GenerationButtonsReaction',
                fireImmediately: true
            }
        );
    }

    queueSettingChange = _.debounce(action(() => {
        if (this._batchUpdating) return;
        
        console.log('Processing queued settings changes');
        this._pendingUpdates.clear();
        this.handleSettingChangeInternal();
    }), 50);

    handleSettingChange = action(() => {
        console.log('🎯 handleSettingChange called');
        if (this._batchUpdating) {
            console.log('⏭️ Skipping - batch update in progress');
            return;
        }
        this.queueSettingChange();
    });

    handleSettingChangeInternal = action(() => {
        console.group('🛠️ handleSettingChangeInternal');

        if (this._isRootChangeInProgress) {
            console.log('⏭️ Skipping - Root change in progress');
            console.groupEnd();
            return false;
        }
    
        if (!this.config.gedcomFileName) {
            console.log('⏭️ Skipping config update: No GEDCOM file loaded');
            console.groupEnd();
            return false;
        }
    
        console.log('✨ Applying config changes');
        console.groupEnd();
        return FanChartManager.applyConfigChanges();
    });

    batchUpdate = action((updates) => {
        if (this._batchUpdating) return;
        
        this._batchUpdating = true;
        try {
            updates();
            this.queueSettingChange();
        } finally {
            this._batchUpdating = false;
        }
    });

    setConfig = action((params) => {
        runInAction(() => {
            Object.assign(this.config, params);

            if (params.fanAngle !== undefined) {
                console.log('Angle updated to:', this.angle);
            }
        });

        if (!this._batchUpdating) {
            this.queueSettingChange();
        }
    });

    updateFanParameter = action((paramName, value) => {
        this.setConfig({ [paramName]: value });
    });

    calculateDimensions(fanAngle, maxGenerations, showMarriages) {
        const dimensionsMap = {
            270: {
                8: { fanDimensionsInMm: "301x257", frameDimensionsInMm: "331x287" },
                7: {
                    true: { fanDimensionsInMm: "301x257", frameDimensionsInMm: "331x287" },
                    false: { fanDimensionsInMm: "245x245", frameDimensionsInMm: "260x260" },
                },
            },
            360: {
                8: { fanDimensionsInMm: "297x297", frameDimensionsInMm: "331x331" },
                7: {
                    true: { fanDimensionsInMm: "297x297", frameDimensionsInMm: "331x331" },
                    false: { fanDimensionsInMm: "245x245", frameDimensionsInMm: "260x260" },
                },
            },
        };

        const defaultDimensions = { fanDimensionsInMm: undefined, frameDimensionsInMm: undefined };
        const angleDimensions = dimensionsMap[fanAngle];
        if (!angleDimensions) return defaultDimensions;

        const generationDimensions = angleDimensions[maxGenerations];
        if (!generationDimensions) return defaultDimensions;

        return generationDimensions[showMarriages] || generationDimensions;
    }

    setGedcomFileName = action((fileName) => {
        this.config.gedcomFileName = fileName;
    });

    get getConfig() {
        return this.config;
    }

    // Méthode pour mettre à jour le nombre de générations disponibles
    setAvailableGenerations = action((generations) => {
        this.config.availableGenerations = generations;
        // Logs pour le débogage
        console.log(`Available generations set to: ${generations}`);
    });
}

const configStore = new ConfigStore();
export default configStore;