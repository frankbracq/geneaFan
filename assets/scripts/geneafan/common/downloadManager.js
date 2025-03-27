// ✅ downloadManager.js — version mise à jour avec `pdfmake` natif et SVG inline vectoriel

import { mmToPoints, mmToPixels } from '../utils/utils.js';
import { Modal } from 'bootstrap';
import configStore from '../tabs/fanChart/fanConfigStore.js';
import authStore from './stores/authStore.js';

const PAGE_WIDTH_IN_MM = 297;
const PAGE_HEIGHT_IN_MM = 420;

export let filename;

export function updateFilename(newFilename) {
    filename = newFilename;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
}

export function downloadContent(data, type) {
    const file = new Blob([data], { type });
    downloadBlob(file, filename);
}

export function fanAsXml() {
    const svg = document.getElementById("fan");
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);

    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+"http:\/\/www\.w3\.org\/1999\/xlink"/)) {
        source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }
    source = source.replace(/href/g, 'xlink:href');
    return '<?xml version="1.0" standalone="no"?>\r\n' + source;
}

function getFrameDimensions(frameDimensionsInMm) {
    return frameDimensionsInMm.split('x').map(Number);
}

export async function generatePdf(watermark = true) {
    const { default: pdfMake } = await import('pdfmake/build/pdfmake');
    const { default: pdfFonts } = await import('pdfmake/build/vfs_fonts');
    pdfMake.vfs = pdfFonts.pdfMake.vfs;

    const frameDimensionsInMm = configStore.getConfig.frameDimensions;
    const [frameWidthInMm, frameHeightInMm] = getFrameDimensions(frameDimensionsInMm);

    const pageWidthInPoints = mmToPoints(PAGE_WIDTH_IN_MM);
    const pageHeightInPoints = mmToPoints(PAGE_HEIGHT_IN_MM);
    const svgWidthInPoints = mmToPoints(frameWidthInMm);
    const svgHeightInPoints = mmToPoints(frameHeightInMm);

    const svgString = fanAsXml().trim();

    const docDefinition = {
        pageSize: {
            width: pageWidthInPoints,
            height: pageHeightInPoints
        },
        pageMargins: [28, 28, 28, 28],
        info: {
            title: filename,
            author: 'https://genealog.ie',
            subject: 'Éventail généalogique',
            keywords: 'généalogie;arbre;éventail;genealog.ie',
        },
        content: [
            {
                svg: svgString,
                width: svgWidthInPoints,
                height: svgHeightInPoints,
                alignment: 'center'
            }
        ]
    };

    if (watermark) {
        docDefinition.watermark = {
            text: 'Genealog.ie',
            color: 'grey',
            opacity: 0.5,
            fontSize: 100,
            bold: false
        };
    }

    return new Promise((resolve, reject) => {
        try {
            pdfMake.createPdf(docDefinition).getBlob((blob) => {
                resolve(blob);
            });
        } catch (error) {
            console.error('Error in generatePdf:', error);
            reject(error);
        }
    });
}

export function downloadPDF() {
    generatePdf().then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const pdfFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

        a.href = url;
        a.download = pdfFilename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }).catch(error => {
        console.error('Error generating PDF:', error);
    });
}

export function generateFileName(extension) {
    return filename + '.' + extension;
}

async function uploadFilesToUploadcare(config, userEmail) {
    const pngBlob = await generatePNG(config, false);
    const pdfBlob = await generatePdf(config, false);
    const publicKey = 'b7514217022177999eaf';

    const uploadFile = async (blob, fileName) => {
        let formData = new FormData();
        formData.append('file', blob, fileName);
        formData.append('UPLOADCARE_PUB_KEY', publicKey);
        formData.append('UPLOADCARE_STORE', '0');

        const response = await fetch('https://upload.uploadcare.com/base/', { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
        const data = await response.json();
        return `https://ucarecdn.com/${data.file}/`;
    };

    const [pngUrl, pdfUrl] = await Promise.all([
        uploadFile(pngBlob, `${config.filename} par ${userEmail}.png`),
        uploadFile(pdfBlob, `${config.filename} par ${userEmail}.pdf`)
    ]);

    return { pngUrl, pdfUrl, pdfBlob }; // Retourner les URLs et le blob PDF pour une utilisation ultérieure
}

// Utility function to show the confirmation modal
function showConfirmationModal(message) {
    const confirmationModalElement = document.getElementById('confirmationModal');
    const confirmationModal = new Modal(confirmationModalElement);

    // Get the modal body element where the message will be inserted
    const modalBodyElement = confirmationModalElement.querySelector('.modal-body');

    // Insert the dynamic message into the modal body
    modalBodyElement.innerHTML = message;

    confirmationModal.show();
}

async function postDataToMake(config, pngUrl, pdfUrl, rootPersonName, userEmail, pdfBlob) {
    const postUrl = 'https://hook.eu1.make.com/ogsm7ah5ftt89p6biph0wd1vt8b50zwy';
    let formData = new FormData();
    formData.append('pngUrl', pngUrl);
    formData.append('pdfUrl', pdfUrl);
    formData.append('rootPersonName', rootPersonName);
    formData.append('userEmail', userEmail);
    formData.append('pdfFile', pdfBlob, `${config.filename} by ${userEmail}.pdf`);

    const response = await fetch(postUrl, { method: 'POST', body: formData });
    if (response.ok) {
        // Success
        showConfirmationModal(`Le fichier PDF de votre éventail sera envoyé dans quelques minutes à l'adresse ${userEmail}.`);
    } else {
        // Failure
        showConfirmationModal("Erreur lors de l'envoi du PDF.");
    }
}

export async function handleUploadAndPost(rootPersonName, userEmail) {
    const config = configStore.getConfig; // Get the current configuration state
    const overlay = document.getElementById('overlay'); 
    try {
        // Show the overlay
        overlay.classList.remove('overlay-hidden');
        overlay.classList.add('overlay-visible');

        const { pngUrl, pdfUrl, pdfBlob } = await uploadFilesToUploadcare(config, userEmail);
        await postDataToMake(config, pngUrl, pdfUrl, rootPersonName, userEmail, pdfBlob);

        // Hide the overlay
        overlay.classList.remove('overlay-visible');
        overlay.classList.add('overlay-hidden');
    } catch (error) {
        console.error('Error:', error);
        showConfirmationModal('An error occurred. Please try again.');

        // Hide the overlay
        overlay.classList.remove('overlay-visible');
        overlay.classList.add('overlay-hidden');
    }
}

function generatePNG(config, transparency) {
    return new Promise((resolve, reject) => {
        const svgString = fanAsXml();
        const canvas = document.createElement("canvas");

        // Set the canvas width to 600px
        const fixedWidth = 1200;
        canvas.width = fixedWidth;

        // Calculate the height to maintain the aspect ratio, if necessary
        const frameDimensionsInMm = config.frameDimensions;
        let frameWidthInMm, frameHeightInMm;
        [frameWidthInMm, frameHeightInMm] = getFrameDimensions(frameDimensionsInMm);

        // Convert mm to pixels assuming 96 DPI (may require adjustment for other DPIs)
        let originalWidthInPixels = mmToPixels(frameWidthInMm);
        let originalHeightInPixels = mmToPixels(frameHeightInMm)

        // Maintain the aspect ratio based on the new fixed width
        let aspectRatio = originalHeightInPixels / originalWidthInPixels;
        let fixedHeight = fixedWidth * aspectRatio;
        canvas.height = fixedHeight;
        const ctx = canvas.getContext("2d");

        if (!transparency) {
            ctx.fillStyle = "#F1F1F1";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const DOMURL = self.URL || self.webkitURL || self;
        const img = new Image();
        const svg = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });

        const url = URL.createObjectURL(svg);

        img.onload = function() {
            // Adjust the image scale to match the target width
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(function(blob) {
                resolve(blob);
            }, 'image/png');
        };
        
        img.onerror = function() {
            reject(new Error('Image loading error'));
        };

        img.src = url;
    });
}

export function downloadPNG(config, transparency) {
    generatePNG(config, transparency).then(blob => {
        downloadBlob(blob, generateFileName("png"));
    }).catch(error => {
        console.error('Error generating or downloading PNG:', error);
    });
}

export class DownloadManager {
    constructor(rootPersonName) {
        this.rootPersonName = rootPersonName;
        this.setupEventListeners();
    }

    updateRootPersonName(newRootPersonName) {
        this.rootPersonName = newRootPersonName;
    }

    setupEventListeners() {
        document.getElementById("download-pdf")
            .addEventListener("click", (event) => {
                event.preventDefault();
                authStore.handleUserAuthentication(authStore.clerk, async (userInfo) => {
                    if (userInfo) {
                        const userEmail = userInfo.email;
                        await handleUploadAndPost(this.rootPersonName, userEmail);
                    } else {
                        console.error("Erreur lors de la connexion de l'utilisateur.");
                    }
                });
            });

        document.getElementById("download-pdf-watermark")
            .addEventListener("click", (event) => {
                event.preventDefault();
                downloadPDF();
            });

        document.getElementById("download-svg")
            .addEventListener("click", (event) => {
                event.preventDefault();
                let elements = document.querySelectorAll("#boxes *");
                elements.forEach(function (element) {
                    element.style.stroke = "rgb(0, 0, 255)";
                    element.style["-inkscape-stroke"] = "hairline";
                    element.setAttribute("stroke-width", "0.01");
                });
                downloadContent(fanAsXml(), generateFileName("svg"), "svg");
            });

        document.getElementById("download-png-transparency")
            .addEventListener("click", (event) => {
                event.preventDefault();
                downloadPNG(configStore.getConfig, true);
            });

        document.getElementById("download-png-background")
            .addEventListener("click", (event) => {
                event.preventDefault();
                downloadPNG(configStore.getConfig, false);
            });
    }
}