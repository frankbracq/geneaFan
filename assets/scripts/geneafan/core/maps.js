import { Loader } from "@googlemaps/js-api-loader";
import { googleMapsStore } from '../tabs/familyMap/googleMapsStore.js';

export async function initializeMaps() {
    console.log('Maps initialization started');
    
    const loader = new Loader({
        apiKey: googleMapsStore.apiKey,
        version: "weekly",
        libraries: []
    });

    try {
        await loader.load();
        if (!googleMapsStore.map) {
            googleMapsStore.initMap("familyMap");
        }
        setupOffcanvasMapTrigger();
    } catch (error) {
        console.error("Error loading Google Maps:", error);
        // Continue app initialization even if maps fail to load
    }
}

function setupOffcanvasMapTrigger() {
    const offcanvasElement = document.getElementById("individualMap");
    if (offcanvasElement) {
        offcanvasElement.addEventListener("shown.bs.offcanvas", function () {
            googleMapsStore.initMap("individualMap");
            adjustMapHeight();
        });
    }
}

function adjustMapHeight() {
    const offCanvas = document.getElementById("individualMap");
    const offCanvasHeader = document.querySelector("#individualMap .offcanvas-header");
    const mapId = document.getElementById("mapid");

    if (offCanvas && offCanvasHeader && mapId) {
        const offCanvasHeight = offCanvas.clientHeight;
        const headerHeight = offCanvasHeader.clientHeight;
        const mapHeight = offCanvasHeight - headerHeight;
        mapId.style.height = `${mapHeight}px`;
    }
}