const fs = require('fs');
const { DOMParser, XMLSerializer } = require('xmldom');
const tinycolor = require('tinycolor2');

// Open Color Palette (subset for example)
const openColorPalette = [
    "#f44336", "#e91e63", "#9c27b0", "#673ab7",
    "#3f51b5", "#2196f3", "#03a9f4", "#00bcd4",
    "#009688", "#4caf50", "#8bc34a", "#cddc39",
    "#ffeb3b", "#ffc107", "#ff9800", "#ff5722"
];

// Fonction pour générer une palette de couleurs distinctes
function generateBaseColors(count) {
    // Use Open Color palette for base colors
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(openColorPalette[i % openColorPalette.length]);
    }
    return colors;
}

// Fonction pour mélanger deux couleurs
function generateColorMix(color1, color2) {
    return tinycolor.mix(color1, color2, 50).toHexString();
}

// Fonction pour générer la palette de couleurs
function generateColorPalette(generations) {
    if (generations <= 0) return [];

    const palette = [];
    const baseColors = generateBaseColors(Math.pow(2, generations - 1));

    // S'assure qu'il y a assez de couleurs de base pour la génération la plus ancienne
    const lastGeneration = baseColors;
    palette.push(lastGeneration);

    for (let gen = generations - 2; gen >= 0; gen--) {
        const currentGeneration = [];
        const parentGen = palette[0];

        for (let i = 0; i < Math.pow(2, gen); i++) {
            const color1 = parentGen[i * 2];
            const color2 = parentGen[i * 2 + 1];
            const mixedColor = generateColorMix(color1, color2);

            currentGeneration.push(mixedColor);
        }

        palette.unshift(currentGeneration);
    }

    return palette.flat();
}

// Génération de la palette pour 8 générations
const generations = 8;
const colors = generateColorPalette(generations);

// Chemin du fichier SVG
const svgFilePath = './test.svg';
const svgContent = fs.readFileSync(svgFilePath, 'utf8');

// Analyse du SVG
const parser = new DOMParser();
const serializer = new XMLSerializer();
const svgDoc = parser.parseFromString(svgContent, 'application/xml');

// Fonction pour colorier les éléments SVG
function colorizeSVG(svgDoc, colors) {
    const elements = svgDoc.getElementsByTagName('path');
    for (let i = 0; i < elements.length; i++) {
        const color = colors[i % colors.length];
        elements[i].setAttribute('fill', color);
    }
}

// Colorier le SVG
colorizeSVG(svgDoc, colors);

// Sauvegarde du fichier SVG colorié
const coloredSvgContent = serializer.serializeToString(svgDoc);
const outputFilePath = './colored_test.svg';
fs.writeFileSync(outputFilePath, coloredSvgContent);

console.log(`SVG colorié sauvegardé sous : ${outputFilePath}`);
