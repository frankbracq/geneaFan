import _, { set } from 'lodash';
import svgPanZoom from "svg-pan-zoom";
import { Modal, Offcanvas } from "bootstrap";
import 'bootstrap-icons/font/bootstrap-icons.css';
import { Loader } from "@googlemaps/js-api-loader";
import { v4 as uuidv4 } from 'uuid';
import { reaction, action } from 'mobx';
import {
    setGedFileUploaded,
    getGedFileUploaded,
    setFamilyTowns,
    clearFamilyEvents,
    setSvgPanZoomInstance,
    getSvgPanZoomInstance,
    gmapApiKey,
    tomSelect,
    initializeTomSelect,
    setSourceData,
    setIndividualsCache,
    getIndividualsCache,
    clearAllStates
} from "./state.js";
import configStore from './store';
import {
    downloadJSON,
    debounce,
    updateFamilyTownsViaProxy,
    updateIndividualTownsFromFamilyTowns,
} from "./utils.js";
import { toJson, getIndividualsList, getAllPlaces } from "./parse.js";
import { draw } from "./fan.js";
import {
    fanAsXml,
    generateFileName,
    generatePdf,
    downloadContent,
    downloadPNG,
    updateFilename,
} from "./downloads.js";
import {
    setupAllEventListeners,
    handleEmailSubmit,
} from "./eventListeners.js";
import { googleMapManager } from './mapManager.js';
import { initializeAscendantTimeline } from './ascendantTimeline.js';
import { initializeFamilyTree } from './tree.js';
import { importData } from './neo4jSearch.js';

let config;
let rootPersonName;
let isEmailButtonListenerAdded = false;

let previousDimensions = null;

document.addEventListener("DOMContentLoaded", function () {
    setupAllEventListeners();
    initPage();  // Map initialization is handled here
});

/* BS offcanvas elements management */
let offCanvasPersonDetailsInstance = null;
let offCanvasIndividualMapInstance = null;

function getOffCanvasInstance(elementId, options) {
    let instance = Offcanvas.getInstance(document.getElementById(elementId));
    if (!instance) {
        instance = new Offcanvas(document.getElementById(elementId), options);
    }
    return instance;
}

function showOffCanvasDetails() {
    const personDetailsElement = document.getElementById("personDetails");
    const individualMapContainerElement = document.getElementById("individualMapContainer");

    offCanvasPersonDetailsInstance = getOffCanvasInstance("personDetails", {});
    offCanvasIndividualMapInstance = getOffCanvasInstance("individualMapContainer", {
        backdrop: false,
    });

    if (!offCanvasPersonDetailsInstance._isShown) {
        offCanvasPersonDetailsInstance.show();
    }
    if (!offCanvasIndividualMapInstance._isShown) {
        offCanvasIndividualMapInstance.show();
    }

    individualMapContainerElement.removeEventListener("shown.bs.offcanvas", handleMapResize);
    individualMapContainerElement.addEventListener("shown.bs.offcanvas", handleMapResize);

    personDetailsElement.removeEventListener("hidden.bs.offcanvas", handleOffcanvasHide);
    personDetailsElement.addEventListener("hidden.bs.offcanvas", handleOffcanvasHide);
}

function handleMapResize() {
    const offCanvasBody = document.querySelector('#individualMapContainer .offcanvas-body');
    const mapElement = document.getElementById('individualMap');
    mapElement.style.height = `${offCanvasBody.clientHeight}px`;

    googleMapManager.moveMapToContainer('individualMap');
    google.maps.event.trigger(googleMapManager.map, "resize");
    googleMapManager.map.setCenter({ lat: 46.2276, lng: 2.2137 });
}

function handleOffcanvasHide() {
    if (offCanvasIndividualMapInstance) {
        offCanvasIndividualMapInstance.hide();
    }
}

export function displayPersonDetailsUI(personDetails) {
    const {
        name,
        surname,
        formattedOccupations,
        formattedSiblings,
        individualTowns,
        individualEvents,
        deceased
    } = personDetails.data;

    const personDetailsLabelElement = document.getElementById("personDetailsLabel");
    const individualTimelineElement = document.getElementById("individualTimeline");

    personDetailsLabelElement.textContent = `${name} ${surname}`;

    const eventTypeDescriptions = {
        birth: "Naissance",
        marriage: "Mariage",
        death: "Décès",
        today: "Aujourd'hui",
    };

    const birthEvent = individualEvents.find(event => event.type === 'birth') || { type: 'birth', date: '', description: 'Date inconnue' };
    const deathEvent = individualEvents.find(event => event.type === 'death');

    const otherEvents = individualEvents
        .filter(event => event.type !== 'birth' && event.type !== 'death')
        .sort((a, b) => {
            const dateA = a.date ? new Date(a.date.split("/").reverse().join("-")) : new Date();
            const dateB = b.date ? new Date(b.date.split("/").reverse().join("-")) : new Date();
            return dateA - dateB;
        });

    const timelineEvents = [birthEvent, ...otherEvents];
    if (deceased && deathEvent) {
        timelineEvents.push(deathEvent);
    }

    const timelineFragment = document.createDocumentFragment();
    let childBirthCount = 0;

    timelineEvents.forEach(event => {
        let description;
        if (event.type === "child-birth") {
            description = `${++childBirthCount}${ordinalSuffixOf(childBirthCount)} enfant${event.ageAtEvent ? ` à ${event.ageAtEvent} ans` : ''}`;
        } else if (event.type === "death" || event.type === "marriage") {
            const eventTypePrefix = event.type === "death" ? "Décès" : "Mariage";
            description = `${eventTypePrefix}${event.ageAtEvent ? ` à ${event.ageAtEvent} ans` : ''}`;
        } else {
            description = eventTypeDescriptions[event.type] || _.startCase(event.type);
        }
    
        const li = document.createElement('li');
        li.innerHTML = `
            <a href="#!">${description}</a>
            <a href="#!" class="float-end">${event.date || 'Date inconnue'}</a>
            <p class="mt-0">${event.description}</p>
        `;
        timelineFragment.appendChild(li);
    });

    const siblingsSection = formattedSiblings ? `
        <h6>Fratrie</h6>
        <ul class="list-group">
            <li class="list-group-item">${formattedSiblings}</li>
        </ul>` : '';

    const occupationsSection = formattedOccupations ? `
        <h6 class="mt-2">Profession</h6>
        <ul class="list-group">
            <li class="list-group-item">${formattedOccupations}</li>
        </ul>` : '';

    const additionalInfo = `${siblingsSection}${occupationsSection}`;

    const container = document.createElement('div');
    container.classList.add('container');
    container.innerHTML = `
        <div class="row">
            <div class="col-md-12">
                <ul class="timeline-3"></ul>
            </div>
        </div>
        <div class="additional-info">${additionalInfo}</div>
    `;

    container.querySelector('.timeline-3').appendChild(timelineFragment);
    individualTimelineElement.innerHTML = '';
    individualTimelineElement.appendChild(container);

    if (!googleMapManager.map) {
        googleMapManager.initMapIfNeeded();
    }

    const individualTownKeys = Object.keys(individualTowns);
    googleMapManager.activateMapMarkers(individualTownKeys);

    showOffCanvasDetails();
}

function ordinalSuffixOf(i) {
    const j = i % 10;
    const k = i % 100;
    if (j == 1 && k != 11) {
        return "er";
    }
    return "ème";
}

function initializeSvgPanZoom() {
    let instance = getSvgPanZoomInstance();
    if (instance) {
        instance.updateBBox();
        return instance;
    }

    // Check if the fan tab is active before initializing svgPanZoom
    const fanContainer = document.getElementById('fanContainer');
    if (!fanContainer || fanContainer.offsetParent === null) {
        console.warn("The fan container is not visible. Skipping svgPanZoom initialization.");
        return null;
    }

    instance = svgPanZoom('#fan', {
        zoomEnabled: true,
        controlIconsEnabled: true,
        fit: true,
        center: true
    });

    var mapElement = document.querySelector('#fan');
    if (mapElement) {
        mapElement.addEventListener("dblclick", function (event) {
            event.stopImmediatePropagation();
        }, true);

        mapElement.addEventListener("wheel", function (event) {
            if (event.ctrlKey) {
                event.preventDefault();
            }
        }, { passive: false });
    } else {
        console.error("L'élément SVG '#fan' n'a pas été trouvé dans le DOM.");
    }

    setSvgPanZoomInstance(instance);
    return instance;
}

function resizeSvg() {
    const fanContainer = document.getElementById('fanContainer');
    const svgElement = document.getElementById('fan');

    const panZoomInstance = getSvgPanZoomInstance();

    const resize = () => {
        const containerWidth = fanContainer.clientWidth;
        const containerHeight = fanContainer.clientHeight;

        svgElement.setAttribute('width', containerWidth);
        svgElement.setAttribute('height', containerHeight);

        panZoomInstance.resize();
        panZoomInstance.fit();
        panZoomInstance.center();
    };

    const debouncedResize = debounce(resize, 100);

    window.addEventListener('resize', debouncedResize);

    // Redimensionnement initial
    resize();
}

async function resetUI() {
    const parametersElements = document.querySelectorAll(".parameter");
    const individualSelectElement = document.getElementById("individual-select");
    const downloadMenuElement = document.getElementById("download-menu");
    const fanParametersDisplayElement = document.getElementById("fanParametersDisplay");
    const treeParametersDisplayElement = document.getElementById("treeParametersDisplay");
    const fullscreenButtonElement = document.getElementById("fullscreenButton");

    [...parametersElements, individualSelectElement].forEach((element) => {
        if (element) {
            element.removeEventListener('change', onSettingChange);
        }
    });

    if (individualSelectElement) {
        individualSelectElement.innerHTML = "";
    }

    if (tomSelect) {
        tomSelect.clearOptions();
        tomSelect.clear();
    }

    const svgPanZoomInstance = getSvgPanZoomInstance();
    if (svgPanZoomInstance) {
        try {
            svgPanZoomInstance.destroy();
        } catch (error) {
            console.error("Erreur lors de la destruction de svgPanZoom:", error);
        }
        setSvgPanZoomInstance(null);
    }

    const fanSvg = document.getElementById("fan");
    if (fanSvg) {
        fanSvg.innerHTML = "";
    }
    await setFamilyTowns({});

    googleMapManager.clearMap();

    [
        downloadMenuElement,
        fanParametersDisplayElement,
        treeParametersDisplayElement,
        fullscreenButtonElement
    ].forEach(el => {
        if (el) el.disabled = true;
    });

    [...parametersElements, individualSelectElement].forEach((element) => {
        if (element) {
            element.addEventListener('change', onSettingChange);
        }
    });
}

let shouldShowInitialMessage = true;
let filename = "";
let gedcomFileName = "";

// Initialization of selections for static elements at the beginning of the script
const selectDates = document.querySelector("#select-dates") || { value: "1" }; // 0 = yyyy / 1 = ddmmyyyy
const selectPlaces = document.querySelector("#select-places") || { value: "1" }; // Default number
const selectContemporary = document.querySelector(
    "#select-hidden-generations"
) || { value: "0" }; // Default number
const selectNameOrder = document.querySelector("#select-name-order") || {
    value: "0",
}; // Default number
const selectNameDisplay = document.querySelector("#select-name-display") || {
    value: "1",
}; // Default number
const substituteEvents = document.querySelector("#substitute-events") || {
    checked: false,
}; // Default boolean
const showChronology = document.querySelector("#show-chronology") || {
    checked: false,
}; // Default boolean
const title = document.querySelector("#title") || { value: "" }; // Default string
const titleSize = document.querySelector("#title-size") || { value: "100" }; // Default number, assuming 100 as 1.00 after division
const titleMargin = document.querySelector("#title-margin") || { value: "25" }; // Default number
const showInvalidDates = document.querySelector("#show-invalid-dates") || {
    checked: false,
}; // Default boolean
const defaultWeightGenValues = {
    "#weightg1": "100",
    "#weightg2": "100",
    "#weightg3": "170",
    "#weightg4": "140",
};
const weightGenerations = Object.keys(defaultWeightGenValues).map(
    (id) => document.querySelector(id) || { value: defaultWeightGenValues[id] }
);
const strokeWeight = document.querySelector("#stroke-weight") || {
    value: "20",
}; // Default number
const hiddenGenerationsCount = document.querySelector(
    "#hidden-generations-count"
) || { value: "1" }; // Default number

// Function to get the value of a radio button
let getRadioButtonValue = (name, parseJson = false) => {
    let value = document.querySelector(`input[name="${name}"]:checked`).value;
    return parseJson ? JSON.parse(value) : value;
}

// Function to parse integer values
let parseIntegerValue = (value) => parseInt(value, 10);

// Initialization of selections via UI
let invertTextArc = () => getRadioButtonValue("invert-text-arc", true);
let showMarriages = () => getRadioButtonValue("showMarriages", true);
let showMissing = () => getRadioButtonValue("showMissing", true);
let fanAngle = () => getRadioButtonValue("fanAngle");
let maxGenerations = () => getRadioButtonValue("max-generations");
let fanColoring = () => getRadioButtonValue("fanColor");

function getSelectedValues() {
    return {
        selectedDates: parseIntegerValue(selectDates.value),
        selectedPlaces: parseIntegerValue(selectPlaces.value),
        selectedContemporary: parseIntegerValue(selectContemporary.value),
        coloring: fanColoring(),
        fanAngle: parseIntegerValue(fanAngle()),
        maxGenerations: parseIntegerValue(maxGenerations()),
        showMarriages: showMarriages(),
        showMissing: showMissing(),
        givenThenFamilyName: parseIntegerValue(selectNameOrder.value) === 0,
        showFirstNameOnly: parseIntegerValue(selectNameDisplay.value) === 1,
        substituteEvents: substituteEvents.checked,
        invertTextArc: invertTextArc(),
        isTimeVisualisationEnabled: showChronology.checked,
        title: title.value.trim(),
        titleSize: parseIntegerValue(titleSize.value) / 100.0,
        titleMargin: parseIntegerValue(titleMargin.value) / 100.0,
    };
}

function calculateDimensions(fanAngle, maxGenerations, showMarriages) {
    const dimensionsMap = {
        270: {
            8: {
                true: { fanDimensionsInMm: "301x257", frameDimensionsInMm: "331x287" },
                false: { fanDimensionsInMm: "301x257", frameDimensionsInMm: "331x287" },
            },
            7: {
                true: { fanDimensionsInMm: "301x257", frameDimensionsInMm: "331x287" },
                false: { fanDimensionsInMm: "245x245", frameDimensionsInMm: "260x260" },
            },
        },
        360: {
            8: {
                true: { fanDimensionsInMm: "297x297", frameDimensionsInMm: "331x331" },
                false: { fanDimensionsInMm: "297x297", frameDimensionsInMm: "331x331" },
            },
            7: {
                true: { fanDimensionsInMm: "297x297", frameDimensionsInMm: "331x331" },
                false: { fanDimensionsInMm: "245x245", frameDimensionsInMm: "260x260" },
            },
        },
    };

    const dimensions = dimensionsMap[fanAngle][maxGenerations][showMarriages];
    return {
        fanDimensionsInMm: dimensions ? dimensions.fanDimensionsInMm : undefined,
        frameDimensionsInMm: dimensions
            ? dimensions.frameDimensionsInMm
            : undefined,
    };
}

function createConfig(selectedValues, filename) {
    const {
        fanAngle,
        selectedDates,
        selectedPlaces,
        selectedContemporary,
        coloring,
        maxGenerations,
        showMarriages,
        showMissing,
        givenThenFamilyName,
        showFirstNameOnly,
        substituteEvents,
        invertTextArc,
        isTimeVisualisationEnabled,
        title,
        titleSize,
        titleMargin,
    } = selectedValues;

    const dimensions = calculateDimensions(
        fanAngle,
        maxGenerations,
        showMarriages
    ); // TODO à vérifier

    // Utilisation des variables pour les poids de génération et d'autres sélections dynamiques
    return {
        root: $("#individual-select").val(),
        maxGenerations,
        angle: (2 * Math.PI * fanAngle) / 360.0,
        dates: {
            showYearsOnly: selectedDates === 0,
            showInvalidDates,
        },
        places: {
            showPlaces: selectedPlaces !== 2,
            showReducedPlaces: selectedPlaces === 1,
        },
        showMarriages,
        showMissing,
        givenThenFamilyName,
        showFirstNameOnly,
        substituteEvents,
        invertTextArc,
        isTimeVisualisationEnabled,
        title,
        titleSize: titleSize / 100.0,
        titleMargin: titleMargin / 100.0,
        weights: {
            generations: weightGenerations.map((e) => parseInt(e.value, 10) / 100.0),
            strokes: parseInt(strokeWeight.value, 10) / 1000.0,
        },
        contemporary: {
            showEvents: selectedContemporary === 0,
            showNames: selectedContemporary < 2,
            trulyAll: selectedContemporary === 3,
            generations: parseInt(hiddenGenerationsCount.value, 10),
        },
        fanDimensions: dimensions.fanDimensionsInMm,
        frameDimensions: dimensions.frameDimensionsInMm,
        computeChildrenCount: coloring === "childrencount",
        filename: filename,
        coloringOption: coloring,
    };
}

function formatName(rootPersonName) {
    let firstName = rootPersonName?.name?.split(" ")[0] || "";
    let surname = rootPersonName?.surname || "";
    return `${firstName} ${surname}`.trim();
}

// MobX action to update the configuration after a parameter change
const updateConfig = action((newConfig) => {
    configStore.setConfig(newConfig);
});

// Ajout de la réaction MobX pour surveiller les changements de config.root
reaction(
    () => configStore.config.root,
    (root) => {
      console.log('config.root has changed:', root);
      onSettingChange();
    }
  );
  
  // Fonction onSettingChange (existe déjà dans votre fichier)
  export function onSettingChange() {
    console.log("onSettingChange");
    try {
      const selectedValues = getSelectedValues();
      const dimensions = calculateDimensions(
        selectedValues.fanAngle,
        selectedValues.maxGenerations,
        selectedValues.showMarriages
      );
  
      let config = createConfig(selectedValues);
      updateConfig(config); // Utiliser l'action MobX
  
      const hasRootPerson = config.root !== undefined && config.root !== null && config.root !== "";
  
      let svgElement = document.querySelector('#fan');
      let svgPanZoomInstance = getSvgPanZoomInstance();
  
      if (svgElement && svgPanZoomInstance) {
        svgPanZoomInstance.destroy();
        setSvgPanZoomInstance(null);
      } else if (!svgElement) {
        console.warn("SVG not found in the DOM, cannot destroy svgPanZoomInstance.");
      }
  
      let result;
      result = draw();
      initializeAscendantTimeline();
  
      if (!result) {
        console.error("Drawing the fan failed.");
        return false;
      }
  
      if (svgElement) {
        try {
          svgPanZoomInstance = initializeSvgPanZoom();
          setSvgPanZoomInstance(svgPanZoomInstance);
        } catch (error) {
          console.error("Error while resetting svgPanZoom:", error);
        }
      } else {
        console.error("SVG not found in the DOM after drawing.");
      }
  
      if (hasRootPerson) {
        rootPersonName = formatName(result.rootPersonName);
        filename = (
          __("Éventail généalogique de ") +
          formatName(result.rootPersonName) +
          " créé sur genealog.ie"
        ).replace(/[|&;$%@"<>()+,]/g, "");
  
        config.filename = filename;
        updateConfig(config); // Utiliser l'action MobX
        updateFilename(config.filename);
      } else {
        filename = __("Éventail vide créé sur genealog.ie").replace(/[|&;$%@"<>()+,]/g, "");
        config.filename = filename;
        updateConfig(config); // Utiliser l'action MobX
        updateFilename(config.filename);
      }
  
      shouldShowInitialMessage = false;
      document.getElementById('initial-group').style.display = 'none';
      document.getElementById("loading").style.display = "none";
      document.getElementById("overlay").classList.add("overlay-hidden");
  
      if (dimensions !== previousDimensions) {
        previousDimensions = dimensions;
      }
  
      // resizeSvg();
  
      return true;
    } catch (error) {
      console.error("Error in onSettingChange:", error);
      return false;
    }
  }
  

function handleTabsAndOverlay(shouldShowLoading) {
    const tabsToDisable = ["tab2", "tab3", "tab4"];
    tabsToDisable.forEach(tabId => {
        const tabLink = document.querySelector(`a[href="#${tabId}"]`);
        if (tabLink) {
            tabLink.classList.toggle('disabled', shouldShowLoading);
            tabLink.setAttribute('aria-disabled', shouldShowLoading ? 'true' : 'false');
            tabLink.setAttribute('tabindex', shouldShowLoading ? '-1' : '0');
        }
    });

    if (shouldShowLoading) {
        document.getElementById('overlay').classList.remove('overlay-hidden');
        document.getElementById("loading").style.display = "block";
        document.querySelector('a[href="#tab1"]').click(); // Force l'affichage de tab1
    } else {
        document.getElementById("loading").style.display = "none";
        document.getElementById("overlay").classList.add("overlay-hidden");
    }
}

async function onFileChange(data) {
    handleTabsAndOverlay(true); // Activer le chargement et désactiver les onglets

    clearAllStates();

    if (getGedFileUploaded()) {
        resetUI();
    }
    setGedFileUploaded(true);

    try {
      await setFamilyTowns({});

      let json = toJson(data);
      let result = await getAllPlaces(json);
      setSourceData(result.json);

      try {
        await updateFamilyTownsViaProxy();
        updateIndividualTownsFromFamilyTowns(getIndividualsCache());
        setIndividualsCache(getIndividualsCache());
      } catch (error) {
        console.error("Error updating geolocation:", error);
      }

      googleMapManager.loadMarkersData();

      const selectElement = document.getElementById("individual-select");
      selectElement.innerHTML = ""; // Efface tout contenu résiduel
      const placeholderOption = new Option("", "", true, true);
      placeholderOption.disabled = true;
      selectElement.appendChild(placeholderOption);

      if (!tomSelect) {
        initializeTomSelect();
      }

      tomSelect.clearOptions();

      result = getIndividualsList(result.json);
      let individuals = result.individualsList;
      individuals.forEach((individual) => {
        tomSelect.addOption({
          value: individual.id,
          text: `${individual.surname} ${individual.name} ${individual.id} ${
            individual.birthYear ? individual.birthYear : "?"
          }-${individual.deathYear ? individual.deathYear : ""}`,
        });
      });

      let rootId;
      if (gedcomFileName === "demo.ged") {
        rootId = "@I111@";
        tomSelect.setValue(rootId);
      } else {
        const individualsWithBirthDates = individuals.map((individual) => {
          const birthDate = individual.birthDate;
          let date;
          if (birthDate.includes("/")) {
            const [day, month, year] = birthDate.split("/").reverse();
            date = new Date(year, month - 1, day || 1);
          } else {
            date = new Date(birthDate, 0, 1);
          }

          return {
            id: individual.id,
            birthDate: date,
          };
        });

        const latestIndividual = _.maxBy(
          individualsWithBirthDates,
          "birthDate"
        );
        if (latestIndividual) {
          rootId = latestIndividual.id;
          tomSelect.setValue(rootId);
        }
      }

      const event = new Event("change", { bubbles: true });
      tomSelect.dropdown_content.dispatchEvent(event);

      [
        ...document.querySelectorAll(".parameter"),
        document.getElementById("individual-select"),
        document.getElementById("download-menu"),
        document.getElementById("fanParametersDisplay"),
        document.getElementById("treeParametersDisplay"),
        document.getElementById("fullscreenButton"),
      ].forEach((el) => {
        el.disabled = false;
      });

      updateConfig({ root: rootId });

      // Recherchez l'individu correspondant et mettez à jour config.rootPersonName
      const rootPerson = individuals.find(
        (individual) => individual.id === rootId
      );
      if (rootPerson) {
        configStore.setConfig({
          ...configStore.getConfig, // Utilisation correcte du getter
          rootPersonName: {
            name: rootPerson.name,
            surname: rootPerson.surname,
          },
        });
      }
    } catch (error) {
        console.error("General Error:", error);
    } finally {
        handleTabsAndOverlay(false); // Désactiver le chargement et activer les onglets
    }
}

/* Code to manage the upload of GEDCOM files */
let isLoadingFile = false;

function loadFile(input) {
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

                onFileChange(data);
            } else {
                console.error("Erreur lors du chargement du fichier :", this.status);
                window.alert(__("arbreomatic.cannot_read_this_file"));
            }
        };

        xhr.onerror = function (e) {
            isLoadingFile = false;
            console.error("Erreur réseau lors du chargement du fichier.");
            window.alert(__("arbreomatic.cannot_read_this_file"));
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

            onFileChange(data);
        });

        reader.readAsArrayBuffer(file);
    }
}

// Demo file loading
Array.from(document.getElementsByClassName('sample')).forEach(function (element) {
    element.addEventListener('click', function (e) {
        loadFile(e.target.getAttribute('data-link'));
        return false;
    });
});

// User file loading
document.getElementById('file').addEventListener('change', function (e) {
    loadFile(e.target.files);
});

document.getElementById('fanDisplay').addEventListener('click', function () {
    if (shouldShowInitialMessage) {
        document.getElementById('file').click();
    }
});

document.getElementById('fanDisplay').addEventListener('drop', function (e) {
    document.getElementById('preview').classList.remove('preview-drop');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        loadFile(e.dataTransfer.files);
    }
    return false;
});

document.getElementById('fanDisplay').addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
});

document.getElementById('fanDisplay').addEventListener('dragenter', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (shouldShowInitialMessage) {
        document.getElementById('preview').classList.add('preview-drop');
    }
    return false;
});

document.getElementById('fanDisplay').addEventListener('dragleave', function () {
    document.getElementById('preview').classList.remove('preview-drop');
    return false;
});

function handleEmailSubmitWrapper() {
    handleEmailSubmit(rootPersonName);
}


function promptForEmail(rootPersonName) {
    var emailModal = new Modal(document.getElementById("emailModal"));
    emailModal.show();
    var emailButton = document.getElementById("email");
    if (emailButton) {
        if (isEmailButtonListenerAdded) {
            emailButton.removeEventListener("click", handleEmailSubmitWrapper);
            isEmailButtonListenerAdded = false;
        }
        emailButton.addEventListener("click", handleEmailSubmitWrapper);
        isEmailButtonListenerAdded = true;
    } else {
        console.log("Did not find email button");
    }
}

document.getElementById('download-pdf').addEventListener('click', function (event) {
    promptForEmail(rootPersonName);
    event.preventDefault(); // Prevent default link action
});

document.getElementById('download-pdf-watermark').addEventListener('click', function (event) {
    generatePdf(
        config,
        function (blob) {
            downloadContent(blob, generateFileName("pdf"), "pdf");
        },
        true
    );

    event.preventDefault(); // Prevent default link action
});

document.getElementById('download-svg').addEventListener('click', function (event) {
    let elements = document.querySelectorAll("#boxes *");
    elements.forEach(function (element) {
        element.style.stroke = "rgb(0, 0, 255)";
        element.style["-inkscape-stroke"] = "hairline";
        element.setAttribute("stroke-width", "0.01");
    });
    downloadContent(fanAsXml(), generateFileName("svg"), "svg");
    event.preventDefault(); // Prevent default link action
});

document.getElementById('download-png-transparency').addEventListener('click', function (event) {
    downloadPNG(config, true);
    event.preventDefault(); // Prevent default link action
});

document.getElementById('download-png-background').addEventListener('click', function (event) {
    downloadPNG(config, false);
    event.preventDefault(); // Prevent default link action
});

$("#print").click(function () {
    function printPdf(url) {
        const iframe = document.createElement("iframe");
        iframe.className = "pdfIframe";
        document.body.appendChild(iframe);
        iframe.style.position = "absolute";
        iframe.style.left = "-10000px";
        iframe.style.top = "-10000px";
        iframe.onload = function () {
            setTimeout(function () {
                iframe.focus();
                try {
                    iframe.contentWindow.print();
                } catch (e) {
                    // Fallback
                    console.log("Cannot print, downloading instead");
                    $("#download-pdf").click();
                }
                URL.revokeObjectURL(url);
            }, 1);
        };
        iframe.src = url;
    }

    $("#download-pdf").click(); // Workaround (chrome update)

    return false;
});

// Prevent the user from entering invalid quantities
document.querySelectorAll('input[type=number]').forEach(function (input) {
    input.addEventListener('change', function () {
        const min = parseInt(input.getAttribute('min'));
        const max = parseInt(input.getAttribute('max'));
        let val = parseInt(input.value) || min - 1;
        if (val < min) input.value = min;
        if (val > max) input.value = max;
    });
});

function adjustMapHeight() {
    const offCanvas = document.getElementById("individualMap");
    const offCanvasHeader = document.querySelector(
        "#individualMap .offcanvas-header"
    );
    const mapId = document.getElementById("mapid");

    if (offCanvas && offCanvasHeader && mapId) {
        const offCanvasHeight = offCanvas.clientHeight;
        const headerHeight = offCanvasHeader.clientHeight;
        const mapHeight = offCanvasHeight - headerHeight;
        mapId.style.height = `${mapHeight}px`; // Ajuster la hauteur de la carte
    }
}

function setupOffcanvasMapTrigger() {
    var offcanvasElement = document.getElementById("individualMap"); // ID de l'élément offcanvas
    if (offcanvasElement) {
        offcanvasElement.addEventListener("shown.bs.offcanvas", function () {
            googleMapManager.initMapIfNeeded();
            adjustMapHeight(); // Ajuster la hauteur après l'initialisation de la carte
        });
    }
}

export function initPage() {
    if (isReady) {
        document.getElementById('overlay').classList.add('overlay-hidden');
    }

    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = generateUniqueId();
        localStorage.setItem('userId', userId);
    }

    // Load Google Maps
    const loader = new Loader({
        apiKey: gmapApiKey,
        version: "weekly",
        libraries: []
    });

    loader
        .load()
        .then(() => {
            if (!googleMapManager.map) {
                googleMapManager.initMapIfNeeded();
            }
            setupOffcanvasMapTrigger(); // Configuration de déclencheur pour offcanvas si nécessaire
        })
        .catch((e) => {
            console.error("Error loading Google Maps", e);
        });

    handleUrlParameters();
}

function handleUrlParameters() {
    var urlParams = new URLSearchParams(window.location.search);
    var contexte = urlParams.get("contexte");

    if (contexte === "demo") {
        document.querySelector("#download-svg").style.display = "none";
        document.querySelector("#download-png-transparency").style.display = "none";
        document.querySelector("#download-png-background").style.display = "none";
        // document.querySelector("#advanced-parameters").style.display = "none";
        document.querySelector("#show-missing").closest(".col").style.display = "none";
    }
}

function generateUniqueId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    } else {
        return uuidv4();
    }
}