import { makeAutoObservable, action, reaction, runInAction } from 'mobx';
import TomSelect from 'tom-select';
import { updateFilename } from "../downloadManager.js";
import { FanChartManager } from "../../tabs/fanChart/fanChartManager.js";
import gedcomDataStore from '../../gedcom/stores/gedcomDataStore.js';
import { DownloadManager } from "../downloadManager.js";
import configStore from '../../tabs/fanChart/fanConfigStore.js';
import timelineEventsStore from '../../tabs/timeline/timelineEventsStore.js';
import { storeEvents, EVENTS } from '../../gedcom/stores/storeEvents.js';

class RootPersonStore {
    root = null;
    rootPersonName = "";
    tomSelect = null;
    configHistory = [];
    currentConfigIndex = -1;
    downloadManager = null;
    _skipNextDraw = false;

    constructor() {
        makeAutoObservable(this, {
            setRoot: action,
            setRootPersonName: action,
            initializeTomSelect: action,
            setTomSelectValue: action,
            undo: action,
            redo: action,
            resetHistory: action,
            handleRootChange: action,

            // Non-observables
            tomSelect: false,
            configHistory: false,
            downloadManager: false
        });

        reaction(
            () => ({
                root: this.root,
                hasCache: gedcomDataStore.individualsCache.size > 0
            }),
            async ({ root, hasCache }) => {
                if (!root || !hasCache) return;
        
                try {
                    console.group('🔄 Root Change Reaction');
                    console.log('👉 Triggering buildHierarchy for root:', root);
        
                    const newHierarchy = this.buildHierarchy(root);
                    console.log('✅ Hierarchy built and stored');
                    console.groupEnd();
        
                    gedcomDataStore.setHierarchy(newHierarchy);
        
                    if (!this._skipNextDraw) {
                        const drawResult = await FanChartManager.drawFanForRoot(root, false);
                        if (drawResult?.rootPersonName) {
                            const formattedName = this.formatName(drawResult.rootPersonName);
                            runInAction(() => {
                                this.rootPersonName = formattedName;
                            });
                            // Émettre l'événement après que l'éventail est dessiné
                            console.log('🎯 Fan chart drawn, emitting event');
                            storeEvents.emit(EVENTS.FAN.DRAWN);
                        }
                    }
        
                    this.updateHistory(root);
                    document.getElementById('initial-group').style.display = 'none';
        
                } catch (error) {
                    console.error("Error handling root change:", error);
                    console.groupEnd();
                } finally {
                    this._skipNextDraw = false;
                }
            },
            {
                name: 'RootPersonStore-MainReaction'
            }
        );

        reaction(
            () => this.rootPersonName,
            (newRootPersonName) => {
                if (!newRootPersonName) return;

                runInAction(() => {
                    if (this.downloadManager) {
                        this.downloadManager.updateRootPersonName(newRootPersonName);
                    } else {
                        this.downloadManager = new DownloadManager(newRootPersonName);
                    }

                    const filename = (__("Éventail généalogique de ") +
                        newRootPersonName +
                        " créé sur genealog.ie"
                    ).replace(/[|&;$%@"<>()+,]/g, "");
                    updateFilename(filename);
                });
            },
            {
                name: 'RootPersonStore-DownloadManagerUpdate'
            }
        );

        // Écouter les événements de construction du cache
        storeEvents.subscribe(EVENTS.CACHE.BUILT, () => {
            console.log('Cache built, updating root if necessary');
            if (this.root) {
                this.setRoot(this.root, { skipDraw: true });
            }
        });
    }

    setRoot = action((newRoot, options = {}) => {
        if (options.skipDraw) {
            this._skipNextDraw = true;
        }
        this.root = newRoot;
        this.updateHistory(newRoot);

        document.dispatchEvent(new Event('rootChange'));
    });

    setRootPersonName = action((name) => {
        this.rootPersonName = name;
    });

    buildHierarchy(currentRoot) {
        console.time("buildHierarchy");
        if (!currentRoot) {
            console.warn("Root is undefined in buildHierarchy");
            return null;
        }

        const config = configStore.getConfig;
        const maxHeight = config.maxGenerations - 1;

        timelineEventsStore.clearEvents();

        const individualsCache = gedcomDataStore.getIndividualsCache()

        const buildRecursive = (
            individualPointer,
            parent,
            sosa,
            height,
            individualsCache,
            config
        ) => {
            if (!individualsCache.has(individualPointer) && individualPointer !== null) {
                return null;
            }

            const individual =
                individualsCache.get(individualPointer) ||
                this.createFictiveIndividual(individualPointer, sosa, height);

            if (individual.individualEvents && individual.individualEvents.length > 0) {
                individual.individualEvents.forEach((event) => {
                    const validTypes = ['death', 'birth', 'marriage'];
                    if (validTypes.includes(event.type)) {
                        timelineEventsStore.addEvent({
                            ...event,
                            id: individualPointer,
                            sosa,
                        });
                    }
                });
            }

            let obj = {
                ...individual,
                sosa: sosa,
                generation: height,
                parent: parent,
            };

            if (height < maxHeight) {
                const parents = [];

                const fatherPointer = individual.fatherId;
                const motherPointer = individual.motherId;

                if (fatherPointer) {
                    const fatherObj = individualsCache.get(fatherPointer);
                    if (fatherObj) {
                        parents.push(
                            buildRecursive(
                                fatherPointer,
                                obj,
                                sosa * 2,
                                height + 1,
                                individualsCache,
                                config
                            )
                        );
                    } else {
                        console.log(`Father not found in cache: ${fatherPointer}`);
                    }
                } else if (config.showMissing) {
                    parents.push(
                        buildRecursive(
                            null,
                            obj,
                            sosa * 2,
                            height + 1,
                            individualsCache,
                            config
                        )
                    );
                }

                if (motherPointer) {
                    const motherObj = individualsCache.get(motherPointer);
                    if (motherObj) {
                        parents.push(
                            buildRecursive(
                                motherPointer,
                                obj,
                                sosa * 2 + 1,
                                height + 1,
                                individualsCache,
                                config
                            )
                        );
                    } else {
                        console.log(`Mother not found in cache: ${motherPointer}`);
                    }
                } else if (config.showMissing) {
                    parents.push(
                        buildRecursive(
                            null,
                            obj,
                            sosa * 2 + 1,
                            height + 1,
                            individualsCache,
                            config
                        )
                    );
                }
                obj.children = parents;
            }

            return obj;
        };

        const hierarchy = buildRecursive(
            currentRoot,
            null,
            1,
            0,
            individualsCache,
            config
        );

        console.timeEnd("buildHierarchy");
        return hierarchy;
    }

    createFictiveIndividual(individualPointer, sosa, height) {
        return {
            id: individualPointer,
            name: "",
            surname: "",
            sosa: sosa,
            generation: height,
            gender: sosa % 2 === 0 ? "M" : "F",
            children: [],
            parent: null,
            individualEvents: [],
        };
    }

    initializeTomSelect() {
        this.tomSelect = new TomSelect("#individual-select", {
            create: false,
            sortField: {
                field: "text",
                direction: "asc"
            },
            dropdownParent: "body",
            placeholder: __("geneafan.choose_root_placeholder"),
            allowClear: true,
            maxItems: 1,
            closeAfterSelect: true,
            dropdownContentClass: 'ts-dropdown-content dropdown-content-modifiers',
            plugins: ['dropdown_input', 'clear_button']
        });

        this.tomSelect.addOption({ value: "", text: __("geneafan.choose_root_placeholder"), disabled: true });
        this.tomSelect.addItem("", true);
    }

    setTomSelectValue = action((value) => {
        if (this.tomSelect) {
            this.tomSelect.setValue(value);
        } else {
            console.error("TomSelect instance is not available.");
        }
    });

    formatName(rootPersonName) {
        if (!rootPersonName) return "";
        let firstName = rootPersonName?.name?.split(" ")[0] || "";
        let surname = rootPersonName?.surname || "";
        return `${firstName} ${surname}`.trim();
    }

    updateHistory = action((newRoot) => {
        if (this.currentConfigIndex < this.configHistory.length - 1) {
            this.configHistory = this.configHistory.slice(0, this.currentConfigIndex + 1);
        }
        this.configHistory.push({ root: newRoot });
        this.currentConfigIndex = this.configHistory.length - 1;
    });

    undo = action(() => {
        if (this.currentConfigIndex > 0) {
            this.currentConfigIndex--;
            const previousRoot = this.configHistory[this.currentConfigIndex].root;
            this.setRoot(previousRoot);
            this.setTomSelectValue(previousRoot);
        }
    });

    redo = action(() => {
        if (this.currentConfigIndex < this.configHistory.length - 1) {
            this.currentConfigIndex++;
            const nextRoot = this.configHistory[this.currentConfigIndex].root;
            this.setRoot(nextRoot);
            this.setTomSelectValue(nextRoot);
        }
    });

    resetHistory = action(() => {
        this.configHistory = [];
        this.currentConfigIndex = -1;
    });
}

const rootPersonStore = new RootPersonStore();
export default rootPersonStore;