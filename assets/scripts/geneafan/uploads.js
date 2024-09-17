import configStore from './store';
import { onFileChange } from "./ui.js";

/* Code to manage the upload of GEDCOM files */
let isLoadingFile = false;
let gedcomFileName = "";

export function loadFile(input) {
    console.log("Chargement du fichier:", input);
    if (isLoadingFile) {
        console.log("Un chargement de fichier est déjà en cours.");
        return;
    }
    isLoadingFile = true;

    if (typeof input === 'string') {
        // Load remote file
        const xhr = new XMLHttpRequest();
        xhr.open("GET", input, true);
        xhr.responseType = "arraybuffer";

        xhr.onload = function (e) {
            isLoadingFile = false;
            if (this.status === 200) {
                const data = xhr.response;

                // Extract the file name from the URL
                gedcomFileName = input.split("/").pop();
                configStore.setGedcomFileName(gedcomFileName); // Update the store

                onFileChange(data);
            } else {
                console.error("Erreur lors du chargement du fichier :", this.status);
                window.alert(__("geneafan.cannot_read_this_file"));
            }
        };

        xhr.onerror = function (e) {
            isLoadingFile = false;
            console.error("Erreur réseau lors du chargement du fichier.");
            window.alert(__("geneafan.cannot_read_this_file"));
        };

        xhr.send();
    } else {
        // Load local file
        const file = input[0];
        // console.log("File loaded:", file);
        const reader = new FileReader();

        reader.addEventListener("loadend", function () {
            isLoadingFile = false;
            const data = reader.result;

            // Set the gedcomFileName from the local file name
            gedcomFileName = file.name;
            configStore.setGedcomFileName(gedcomFileName);

            onFileChange(data);
        });

        reader.readAsArrayBuffer(file);
    }
}