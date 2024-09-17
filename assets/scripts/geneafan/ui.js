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
    setSvgPanZoomInstance,
    getSvgPanZoomInstance,
    gmapApiKey,
    getTomSelectInstance,
    initializeTomSelect,
    setSourceData,
    setIndividualsCache,
    getIndividualsCache,
    clearAllStates
} from "./state.js";
import configStore from './store';
import {
    debounce,
    updateFamilyTownsViaProxy,
    updateIndividualTownsFromFamilyTowns,
} from "./utils.js";
import { toJson, getIndividualsList, getAllPlaces } from "./parse.js";
import { draw } from "./fan.js";
import {
    downloadContent,
    downloadPNG,
    fanAsXml,
    generateFileName,
    generatePdf,
    handleUploadAndPost,
    updateFilename,
} from "./downloads.js";
import {
    setupAllEventListeners,
    setupPersonLinkEventListener,
} from "./eventListeners.js";
import { googleMapManager } from './mapManager.js';
import { initializeAscendantTimeline } from './ascendantTimeline.js';
import { handleUserAuthentication } from './users.js';

let config;
let rootPersonName;

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
        personLink,
        formattedOccupations,
        formattedSiblings,
        individualTowns,
        individualEvents,
        deceased,
    } = personDetails.data;

    const personDetailsLabelElement = document.getElementById('personDetailsLabel');
    const individualTimelineElement = document.getElementById('individualTimeline');

    // Affiche le nom de la personne dans l'en-tête
    personDetailsLabelElement.innerHTML = `<h4>${personLink}</h4>`;

    const eventTypeDescriptions = {
        birth: 'Naissance',
        marriage: 'Mariage',
        death: 'Décès',
        today: "Aujourd'hui",
    };

    // Fonction pour parser les dates au format "dd/mm/yyyy"
    const parseDateString = (dateString) => {
        if (!dateString) return null;
        const [day, month, year] = dateString.split('/');
        return new Date(year, month - 1, day);
    };

    const birthEvent =
        individualEvents.find((event) => event.type === 'birth') || {
            type: 'birth',
            date: '',
            description: 'Date inconnue',
        };
    const deathEvent = individualEvents.find((event) => event.type === 'death');

    const otherEvents = individualEvents
        .filter((event) => event.type !== 'birth' && event.type !== 'death')
        .sort((a, b) => {
            const dateA = parseDateString(a.date);
            const dateB = parseDateString(b.date);

            if (dateA && dateB) {
                return dateA - dateB;
            } else if (dateA) {
                return -1;
            } else if (dateB) {
                return 1;
            } else {
                return 0;
            }
        });

    const timelineEvents = [birthEvent, ...otherEvents];
    if (deceased && deathEvent) {
        timelineEvents.push(deathEvent);
    }

    const timelineFragment = document.createDocumentFragment();
    let childBirthCount = 0;

    const getEventDescription = (event, childBirthOrder) => {
        const ageText = event.ageAtEvent ? ` à ${event.ageAtEvent} ans` : '';
        switch (event.type) {
            case 'child-birth':
                return `${childBirthOrder}${ordinalSuffixOf(childBirthOrder)} enfant${ageText}`;
            case 'death':
                return `Décès${ageText}`;
            case 'marriage':
                return `Mariage${ageText}`;
            default:
                return eventTypeDescriptions[event.type] || _.startCase(event.type);
        }
    };

    timelineEvents.forEach((event) => {
        if (event.type === 'child-birth') {
            childBirthCount++;
        }
        const description = getEventDescription(event, childBirthCount);

        const li = document.createElement('li');
        li.innerHTML = `
            <div class="event-header">
                <h6 class="mt-0">${description}</h6>
                <h6 class="float-end">${event.date || 'Date inconnue'}</h6>
            </div>
            <p class="mt-0">${event.description}</p>
        `;
        timelineFragment.appendChild(li);
    });

    // Création des sections supplémentaires
    const createSection = (title, content) => {
        return `
            <h6>${title}</h6>
            <ul class="list-group">
                <li class="list-group-item">${content}</li>
            </ul>
        `;
    };

    const siblingsSection = formattedSiblings ? createSection('Fratrie', formattedSiblings) : '';
    const occupationsSection = formattedOccupations ? createSection('Profession', formattedOccupations) : '';
    const additionalInfo = `${siblingsSection}${occupationsSection}`;

    // Construction du conteneur principal
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

    // Gestion de la carte Google Maps
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

    let tomSelect = getTomSelectInstance();
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

    configStore.resetConfigHistory();
}

let shouldShowInitialMessage = true;
let filename = "";


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
            8: { fanDimensionsInMm: "301x257", frameDimensionsInMm: "331x287" }, // same dimensions with or without marriages
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

    const dimensions = generationDimensions[showMarriages] || generationDimensions;
    return dimensions || defaultDimensions;
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

export function displayFan() {
    const instance = svgPanZoom("#fan", {
        zoomEnabled: true,
        controlIconsEnabled: true,
        fit: true,
        center: true,
    });

    var mapElement = document.querySelector("#fan");
    if (mapElement) {
        mapElement.addEventListener(
            "dblclick",
            function (event) {
                event.stopImmediatePropagation();
            },
            true
        );

        mapElement.addEventListener(
            "wheel",
            function (event) {
                if (event.ctrlKey) {
                    event.preventDefault();
                }
            },
            { passive: false }
        );
    } else {
        console.error("L'élément SVG '#fan' n'a pas été trouvé dans le DOM.");
    }

    setSvgPanZoomInstance(instance);
    return instance;
}

// MobX action to update the configuration after a parameter change
const updateConfig = action((newConfig) => {
    configStore.setConfig(newConfig);
});

// Function to check if the fan container is visible
const isFanContainerVisible = () => {
    const fanContainer = document.getElementById("fanContainer");
    return fanContainer && fanContainer.offsetParent !== null;
};

// MobX reaction to monitor changes in config.root
reaction(
    () => configStore.config.root,
    (root) => {
        if (!isFanContainerVisible()) {
            console.warn(
                "The fan container is not visible. Skipping svgPanZoom initialization."
            );
            return null;
        }
        // Call onSettingChange only if fanContainer is visible
        console.log("Root changed. Reaction calling onSettingChange with root =", root);
        onSettingChange();
    }
);


/**
 * Handles changes in settings by updating the configuration, 
 * redrawing the fan chart, and managing the SVG instance.
 */
export function onSettingChange() {
    try {
        const selectedValues = getSelectedValues();
        const dimensions = calculateDimensions(
            selectedValues.fanAngle,
            selectedValues.maxGenerations,
            selectedValues.showMarriages
        );

        let config = createConfig(selectedValues);
        updateConfig(config); // Use MobX action

        const hasRootPerson = config.root !== undefined && config.root !== null && config.root !== "";

        let svgElement = document.querySelector('#fan');
        let svgPanZoomInstance = getSvgPanZoomInstance();

        if (svgElement && svgPanZoomInstance) {
            console.log("SVG and svgPanZoomInstance exist, destroying the instance.");
            svgPanZoomInstance.destroy();
            setSvgPanZoomInstance(null);
        } else if (!svgElement) {
            console.warn("SVG not found in the DOM, cannot destroy svgPanZoomInstance.");
        }

        let result;
        result = draw();

        if (!result) {
            console.error("Drawing the fan failed.");
            return false;
        }
        initializeAscendantTimeline();

        displayFan();
        
        if (hasRootPerson) {
            rootPersonName = formatName(result.rootPersonName);
            filename = (
                __("Éventail généalogique de ") +
                formatName(result.rootPersonName) +
                " créé sur genealog.ie"
            ).replace(/[|&;$%@"<>()+,]/g, "");

            config.filename = filename;
            updateConfig(config); // Use MobX action
            updateFilename(config.filename);
        } else {
            filename = __("Éventail vide créé sur genealog.ie").replace(/[|&;$%@"<>()+,]/g, "");
            config.filename = filename;
            updateConfig(config); // Use MobX action
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

function findYoungestIndividual(individuals) {
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

  return _.maxBy(individualsWithBirthDates, "birthDate");
}

export async function onFileChange(data) {
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

        // Utilisation de configStore pour gérer tomSelect
        let tomSelect = getTomSelectInstance();
        if (!tomSelect) {
            initializeTomSelect();
            tomSelect = getTomSelectInstance();
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
        const gedcomFileName = configStore.getConfig.gedcomFileName;
        rootId = (gedcomFileName === "demo.ged") ? "@I111@" : findYoungestIndividual(individuals)?.id;
        configStore.setTomSelectValue(rootId);

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

        configStore.setConfig({ root: rootId });

        // Recherchez l'individu correspondant et mettez à jour config.rootPersonName
        const rootPerson = individuals.find((individual) => individual.id === rootId);
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
        setupPersonLinkEventListener();
    }
}

// Download buttons
document.getElementById('download-pdf').addEventListener('click', function (event) {
    event.preventDefault(); // Prevent default link action

    // Utiliser la fonction handleUserAuthentication
    handleUserAuthentication(async (userInfo) => {
        if (userInfo) {  // Vérifier si les informations de l'utilisateur sont disponibles
            const userEmail = userInfo.email; // Récupère l'email de l'utilisateur
            await handleUploadAndPost(rootPersonName, userEmail); // Appel de la fonction avec l'email de l'utilisateur
        } else {
            console.error("Erreur lors de la connexion de l'utilisateur.");
        }
    });
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