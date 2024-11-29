import { makeAutoObservable, action } from './mobx-config.js';
import TomSelect from 'tom-select';

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
            setTomSelectValue: action,
            undo: action,
            redo: action,
            resetHistory: action,
            
            // Non-observables
            configHistory: false,
            getTomSelect: false
        });
    }

    setRoot = action((newRoot) => {
        this.root = newRoot;
        this.updateHistory(newRoot);
    });

    setRootPersonName = action((name) => {
        this.rootPersonName = name;
    });

    initializeTomSelect() {
        this.tomSelect = new TomSelect("#individual-select", {
            create: false,
            sortField: { field: "text", direction: "asc" },
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

    getTomSelect() {
        return this.tomSelect;
    }

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