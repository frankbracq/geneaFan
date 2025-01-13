import { makeAutoObservable, action, reaction, runInAction } from 'mobx';
import TomSelect from 'tom-select';
import { updateFilename } from "../downloadManager.js";
import { FanChartManager } from "../../tabs/fanChart/fanChartManager.js";
import { draw } from "../../tabs/fanChart/fan.js";
import gedcomDataStore from '../../gedcom/gedcomDataStore.js';
import { DownloadManager } from "../downloadManager.js"; 
import configStore from '../../tabs/fanChart/fanConfigStore.js';
import timelineEventsStore from '../../tabs/timeline/timelineEventsStore.js';

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

        // Réagir aux changements de root
        // Reaction pour le changement de root
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
                    
                    // 1. Mettre à jour la hiérarchie
                    const newHierarchy = this.buildHierarchy(root);
                    console.log('✅ Hierarchy built and stored');
                    console.groupEnd();
                    
                    gedcomDataStore.setHierarchy(newHierarchy);
        
                    // 2. Mettre à jour l'affichage si nécessaire
                    if (!this._skipNextDraw) {
                        const drawResult = await FanChartManager.drawFanForRoot(root, false);
                        if (drawResult?.rootPersonName) {
                            const formattedName = this.formatName(drawResult.rootPersonName);
                            runInAction(() => {
                                this.rootPersonName = formattedName;
                            });
                        }
                    }
        
                    // 3. Mettre à jour l'historique
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

        // Reaction pour le DownloadManager
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

                    // Mettre à jour le nom de fichier
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

    }

    setRoot = action((newRoot, options = {}) => {
        if (options.skipDraw) {
            this._skipNextDraw = true;
        }
        this.root = newRoot;
        this.updateHistory(newRoot);
        
        // Émettre l'événement de changement de root
        document.dispatchEvent(new Event('rootChange'));
    });

    setRootPersonName = action((name) => {
        this.rootPersonName = name;
    });

    handleRootChange = action(async (newRoot) => {
        if (!newRoot) {
            console.warn("Attempting to handle root change with undefined root");
            return false;
        }

        try {
            console.log('Starting fan drawing process with new root:', newRoot);

            // S'assurer que le root est mis à jour avant d'appeler draw
            this.root = newRoot;

            const svgElement = document.querySelector('#fan');
            if (svgElement && FanChartManager.panZoomInstance) {
                FanChartManager.panZoomInstance.destroy();
                FanChartManager.panZoomInstance = null;
            }

            // Passer le root en paramètre à draw()
            const drawResult = draw(this.root);
            if (!drawResult) {
                console.error("Failed to draw fan");
                return false;
            }

            console.log('Fan drawn successfully, displaying');
            await FanChartManager.displayFan();

            if (drawResult.rootPersonName) {
                // Mise à jour du nom de fichier
                const rootPersonName = this.formatName(drawResult.rootPersonName);
                const filename = (__("Éventail généalogique de ") +
                    rootPersonName +
                    " créé sur genealog.ie"
                ).replace(/[|&;$%@"<>()+,]/g, "");

                updateFilename(filename);
                this.setRootPersonName(rootPersonName);
            }

            // Mise à jour de l'interface
            document.getElementById('initial-group').style.display = 'none';
            document.getElementById("loading").style.display = "none";
            document.getElementById("overlay").classList.add("overlay-hidden");

            return true;
        } catch (error) {
            console.error("Error in handleRootChange:", error);
            return false;
        }
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

        // Utiliser le cache des individus déjà construit
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

            // Utiliser les événements individuels si disponibles
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

        // Méthode privée déplacée dans la classe
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