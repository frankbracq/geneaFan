import '../../vendor/pdfkitFontRegister.js';
import { mmToPoints, mmToPixels } from '../utils/utils.js';
import { Modal } from 'bootstrap';
import configStore from '../tabs/fanChart/fanConfigStore.js';
import authStore from './stores/authStore.js';

const PAGE_WIDTH_IN_MM = 297; // Largeur en millimètres
const PAGE_HEIGHT_IN_MM = 420; // Hauteur en millimètres

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
    const file = new Blob([data], { type: type });
    downloadBlob(file, filename);
}

export function fanAsXml() {
    const svg = $("#fan")[0];
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);

    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+"http:\/\/www\.w3\.org\/1999\/xlink"/)) {
        source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }
    source = source.replace(/href/g, 'xlink:href'); // Compatibility

    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

    return source;
}

function getFrameDimensions(frameDimensionsInMm) {
    return frameDimensionsInMm.split('x').map(Number);
}

export async function generatePdf(watermark = true) {
    // Dynamically import PDFKit and related libraries
    const { default: PDFDocument } = await import('pdfkit');
    const { default: SVGtoPDF } = await import('svg-to-pdfkit');
    const { default: blobStream } = await import('blob-stream'); // Dynamic import of blob-stream

    return new Promise((resolve, reject) => {
        const frameDimensionsInMm = configStore.getConfig.frameDimensions;
        let frameWidthInMm, frameHeightInMm;
        [frameWidthInMm, frameHeightInMm] = getFrameDimensions(frameDimensionsInMm);

        const pageWidthInPoints = mmToPoints(PAGE_WIDTH_IN_MM);
        const pageHeightInPoints = mmToPoints(PAGE_HEIGHT_IN_MM);

        const layoutMap = {
            '331x287': 'landscape',
            '260x260': 'landscape',
            '331x331': 'landscape',
        };
        const layout = layoutMap[frameDimensionsInMm];

        const doc = new PDFDocument({
            size: [pageWidthInPoints, pageHeightInPoints],
            margins: {
                top: 28,
                bottom: 28,
                left: 28,
                right: 28,
            },
            layout: layout,
            info: {
                Title: filename,
                Author: 'https://genealog.ie',
                Subject: __('geneafan.genealogical_fan'),
                Keywords: 'généalogie;arbre;éventail;genealog.ie',
            },
        });

        // Use blob-stream to handle the PDF data
        const stream = doc.pipe(blobStream());

        stream.on('finish', function () {
            const blob = stream.toBlob('application/pdf');
            resolve(blob); // Resolve the promise with the generated blob
        });

        stream.on('error', function (error) {
            reject(error); // Reject the promise if there's an error
        });

        const svgOptions = {
            width: mmToPoints(frameWidthInMm),
            height: mmToPoints(frameHeightInMm),
        };

        let x, y;

        if (pageWidthInPoints > pageHeightInPoints) {
            x = (pageWidthInPoints - svgOptions.width) / 2;
            y = (pageHeightInPoints - svgOptions.height) / 2;
        } else {
            x = (pageHeightInPoints - svgOptions.width) / 2;
            y = (pageWidthInPoints - svgOptions.height) / 2;
        }

        // First, add the SVG content
        SVGtoPDF(doc, fanAsXml().trim(), x, y, svgOptions);

        // Add watermark if enabled, after the content
        if (watermark) {
            const watermarkText = 'Genealog.ie';
            const fontSize = 100;

            doc.font('Helvetica');
            doc.fontSize(fontSize);
            doc.font('Helvetica');

            const textWidth = doc.widthOfString(watermarkText);
            const isLandscape = doc.options.layout === 'landscape';
            const textY = isLandscape
                ? pageWidthInPoints * 2 / 3
                : pageHeightInPoints * 2 / 3;
            const textX = isLandscape
                ? (pageHeightInPoints - textWidth) / 2
                : (pageWidthInPoints - textWidth) / 2;

            doc.fillColor('grey').opacity(0.5).text(watermarkText, textX, textY);
        }

        doc.end(); // Finalize the document
    });
}

export function downloadPDF() {
    generatePdf().then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        // Vérifiez si le nom de fichier contient déjà l'extension ".pdf"
        const pdfFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

        a.href = url;
        a.download = pdfFilename; // Utilisation du nom de fichier avec l'extension ".pdf"
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
                downloadPDF(configStore.getConfig, function (blob) {
                    downloadContent(blob, generateFileName("pdf"), "pdf");
                }, true);
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
