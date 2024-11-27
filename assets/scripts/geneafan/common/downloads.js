import '../../vendor/pdfkitFontRegister.js';
import { mmToPoints, mmToPixels } from '../utils/utils.js';
import { Modal } from 'bootstrap';
import configStore from '../tabs/fanChart/fanConfigStore.js';

class DownloadManager {
    constructor() {
        this.filename = '';
        this.PAGE_DIMENSIONS = {
            WIDTH_MM: 297,
            HEIGHT_MM: 420
        };
    }

    setupDownloadHandlers() {
        document.getElementById('download-pdf-watermark')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.downloadPDF(true);
        });

        document.getElementById('download-pdf')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.handleUploadAndPost(rootPersonName, userEmail);
        });

        document.getElementById('download-svg')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.downloadContent(this.fanAsXml(), this.generateFilename('svg'), 'svg');
        });

        document.getElementById('download-png-transparency')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.downloadPNG(true);
        });

        document.getElementById('download-png-background')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.downloadPNG(false);
        });
    }

    downloadBlob(blob, filename) {
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

    downloadContent(data, filename, type) {
        const file = new Blob([data], { type: type });
        this.downloadBlob(file, filename);
    }

    fanAsXml() {
        const svg = $("#fan")[0];
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

    getFrameDimensions(frameDimensionsInMm) {
        return frameDimensionsInMm.split('x').map(Number);
    }

    async generatePdf(watermark = true) {
        const { default: PDFDocument } = await import('pdfkit');
        const { default: SVGtoPDF } = await import('svg-to-pdfkit');
        const { default: blobStream } = await import('blob-stream');

        return new Promise((resolve, reject) => {
            const frameDimensionsInMm = configStore.getConfig.frameDimensions;
            let [frameWidthInMm, frameHeightInMm] = this.getFrameDimensions(frameDimensionsInMm);

            const pageWidthInPoints = mmToPoints(this.PAGE_DIMENSIONS.WIDTH_MM);
            const pageHeightInPoints = mmToPoints(this.PAGE_DIMENSIONS.HEIGHT_MM);

            const layoutMap = {
                '331x287': 'landscape',
                '260x260': 'landscape',
                '331x331': 'landscape',
            };
            const layout = layoutMap[frameDimensionsInMm];

            const doc = new PDFDocument({
                size: [pageWidthInPoints, pageHeightInPoints],
                margins: { top: 28, bottom: 28, left: 28, right: 28 },
                layout: layout,
                info: {
                    Title: this.filename,
                    Author: 'https://genealog.ie',
                    Subject: __('geneafan.genealogical_fan'),
                    Keywords: 'généalogie;arbre;éventail;genealog.ie',
                },
            });

            const stream = doc.pipe(blobStream());
            stream.on('finish', () => resolve(stream.toBlob('application/pdf')));
            stream.on('error', reject);

            const svgOptions = {
                width: mmToPoints(frameWidthInMm),
                height: mmToPoints(frameHeightInMm),
            };

            const x = pageWidthInPoints > pageHeightInPoints
                ? (pageWidthInPoints - svgOptions.width) / 2
                : (pageHeightInPoints - svgOptions.width) / 2;
            const y = pageWidthInPoints > pageHeightInPoints
                ? (pageHeightInPoints - svgOptions.height) / 2
                : (pageWidthInPoints - svgOptions.height) / 2;

            SVGtoPDF(doc, this.fanAsXml().trim(), x, y, svgOptions);

            if (watermark) {
                this.addWatermark(doc, pageWidthInPoints, pageHeightInPoints);
            }

            doc.end();
        });
    }

    addWatermark(doc, pageWidthInPoints, pageHeightInPoints) {
        const watermarkText = 'Genealog.ie';
        const fontSize = 100;

        doc.font('Helvetica').fontSize(fontSize);
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

    async downloadPDF(watermark = true) {
        try {
            const blob = await this.generatePdf(watermark);
            const pdfFilename = this.filename.endsWith('.pdf') 
                ? this.filename 
                : `${this.filename}.pdf`;
            this.downloadBlob(blob, pdfFilename);
        } catch (error) {
            console.error('Error generating PDF:', error);
        }
    }

    async generatePNG(transparency) {
        return new Promise((resolve, reject) => {
            const svgString = this.fanAsXml();
            const canvas = document.createElement("canvas");
            const fixedWidth = 1200;
            canvas.width = fixedWidth;

            const frameDimensionsInMm = configStore.getConfig.frameDimensions;
            let [frameWidthInMm, frameHeightInMm] = this.getFrameDimensions(frameDimensionsInMm);

            let originalWidthInPixels = mmToPixels(frameWidthInMm);
            let originalHeightInPixels = mmToPixels(frameHeightInMm);
            let aspectRatio = originalHeightInPixels / originalWidthInPixels;
            canvas.height = fixedWidth * aspectRatio;

            const ctx = canvas.getContext("2d");
            if (!transparency) {
                ctx.fillStyle = "#F1F1F1";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            const img = new Image();
            const svg = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(svg);

            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(resolve, 'image/png');
            };
            img.onerror = () => reject(new Error('Image loading error'));
            img.src = url;
        });
    }

    async downloadPNG(transparency) {
        try {
            const blob = await this.generatePNG(transparency);
            this.downloadBlob(blob, this.generateFilename("png"));
        } catch (error) {
            console.error('Error generating or downloading PNG:', error);
        }
    }

    async uploadFilesToUploadcare(userEmail) {
        const publicKey = 'b7514217022177999eaf';
        const uploadFile = async (blob, fileName) => {
            const formData = new FormData();
            formData.append('file', blob, fileName);
            formData.append('UPLOADCARE_PUB_KEY', publicKey);
            formData.append('UPLOADCARE_STORE', '0');

            const response = await fetch('https://upload.uploadcare.com/base/', { 
                method: 'POST', 
                body: formData 
            });
            if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
            
            const data = await response.json();
            return `https://ucarecdn.com/${data.file}/`;
        };

        const [pngBlob, pdfBlob] = await Promise.all([
            this.generatePNG(false),
            this.generatePdf(false)
        ]);

        const [pngUrl, pdfUrl] = await Promise.all([
            uploadFile(pngBlob, `${this.filename} par ${userEmail}.png`),
            uploadFile(pdfBlob, `${this.filename} par ${userEmail}.pdf`)
        ]);

        return { pngUrl, pdfUrl, pdfBlob };
    }

    showConfirmationModal(message) {
        const modalElement = document.getElementById('confirmationModal');
        const modal = new Modal(modalElement);
        const modalBody = modalElement.querySelector('.modal-body');
        if (modalBody) modalBody.innerHTML = message;
        modal.show();
    }

    async postDataToMake(pngUrl, pdfUrl, rootPersonName, userEmail, pdfBlob) {
        const postUrl = 'https://hook.eu1.make.com/ogsm7ah5ftt89p6biph0wd1vt8b50zwy';
        const formData = new FormData();
        
        formData.append('pngUrl', pngUrl);
        formData.append('pdfUrl', pdfUrl);
        formData.append('rootPersonName', rootPersonName);
        formData.append('userEmail', userEmail);
        formData.append('pdfFile', pdfBlob, `${this.filename} by ${userEmail}.pdf`);

        const response = await fetch(postUrl, { method: 'POST', body: formData });
        
        if (response.ok) {
            this.showConfirmationModal(
                `Le fichier PDF de votre éventail sera envoyé dans quelques minutes à l'adresse ${userEmail}.`
            );
        } else {
            this.showConfirmationModal("Erreur lors de l'envoi du PDF.");
        }
    }

    async handleUploadAndPost(rootPersonName, userEmail) {
        const overlay = document.getElementById('overlay');
        try {
            overlay.classList.remove('overlay-hidden');
            overlay.classList.add('overlay-visible');

            const { pngUrl, pdfUrl, pdfBlob } = await this.uploadFilesToUploadcare(userEmail);
            await this.postDataToMake(pngUrl, pdfUrl, rootPersonName, userEmail, pdfBlob);
        } catch (error) {
            console.error('Error:', error);
            this.showConfirmationModal('An error occurred. Please try again.');
        } finally {
            overlay.classList.remove('overlay-visible');
            overlay.classList.add('overlay-hidden');
        }
    }

    generateFilename(extension) {
        return `${this.filename}.${extension}`;
    }

    setFilename(newFilename) {
        this.filename = newFilename;
    }
}

export const downloadManager = new DownloadManager();

// Legacy exports
export const handleUploadAndPost = downloadManager.handleUploadAndPost.bind(downloadManager);
export const downloadPDF = downloadManager.downloadPDF.bind(downloadManager);
export const downloadPNG = downloadManager.downloadPNG.bind(downloadManager);
export const downloadContent = downloadManager.downloadContent.bind(downloadManager);
export const generateFileName = downloadManager.generateFilename.bind(downloadManager);
export const updateFilename = downloadManager.setFilename.bind(downloadManager);