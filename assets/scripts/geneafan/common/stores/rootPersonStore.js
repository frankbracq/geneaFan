import { makeAutoObservable, action, reaction, runInAction } from './mobx-config.js';
import TomSelect from 'tom-select';
import { updateFilename } from "../../downloads.js";
import { draw } from "../../fanChart/fan.js";
import { displayFan } from "../../ui.js";
import { getSvgPanZoomInstance, setSvgPanZoomInstance } from "./state.js";

class RootPersonStore {
    root = null;
    rootPersonName = "";
    tomSelect = null;
    configHistory = [];
    currentConfigIndex = -1;

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
            configHistory: false
        });

        // Réagir aux changements de root
        // Reaction pour les changements de root
        reaction(
            () => this.root,
            async (newRoot, previousRoot) => {
                if (newRoot === previousRoot) return;
                
                try {
                    // Mise à jour de la visualisation
                    await this.handleRootChange(newRoot);

                    // Si le changement de root s'est bien passé, mettre à jour l'historique
                    this.updateHistory(newRoot);

                    // Mettre à jour l'interface
                    document.getElementById('initial-group').style.display = 'none';
                } catch (error) {
                    console.error("Error handling root change:", error);
                }
            },
            {
                name: 'RootPersonStore-RootChangeReaction'
            }
        );
    }

    setRoot = action((newRoot) => {
        this.root = newRoot;
        this.updateHistory(newRoot);
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

            let svgElement = document.querySelector('#fan');
            let svgPanZoomInstance = getSvgPanZoomInstance();
            if (svgElement && svgPanZoomInstance) {
                svgPanZoomInstance.destroy();
                setSvgPanZoomInstance(null);
            }

            // Passer le root en paramètre à draw()
            const drawResult = draw(this.root);
            if (!drawResult) {
                console.error("Failed to draw fan");
                return false;
            }

            console.log('Fan drawn successfully, displaying');
            displayFan();

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