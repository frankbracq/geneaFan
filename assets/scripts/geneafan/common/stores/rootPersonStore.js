import { makeAutoObservable, action, reaction, runInAction } from 'mobx';
import TomSelect from 'tom-select';
import { updateFilename } from "../downloadManager.js";
import { FanChartManager } from "../../tabs/fanChart/fanChartManager.js";
import { draw } from "../../tabs/fanChart/fan.js";
import { buildHierarchy } from '../../gedcom/parse.js';
import gedcomDataStore from '../../gedcom/gedcomDataStore.js';
import { DownloadManager } from "../downloadManager.js"; 

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
                    const newHierarchy = buildHierarchy(root);
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