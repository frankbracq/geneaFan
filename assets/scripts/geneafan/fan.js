import { arc, line } from 'd3-shape';
import { select } from 'd3-selection';
import { hierarchy } from 'd3-hierarchy';
import { xml } from 'd3-fetch';
import tinycolor from "tinycolor2";
import _ from "lodash";
import { mmToPixels } from './utils.js';
import { extractYear } from './dates.js';
import configStore from './stores/fanConfigStore.js';
import { buildHierarchy } from './parse.js';
import { SVGPathData } from 'svg-pathdata';

const weightFontFirst = 0.25,
    weightFontOther = 0.22,
    weightFontDate = 0.19,
    weightFontMin = 0.16, // Threshold below which first names are abbreviated
    weightFontFar = 0.1,
    weightFontFurthest = 0.06,
    weightFontMarriage = 0.16;
const thirdLevel = 4,
    fourthLevel = 5,
    fifthLevel = 6,
    sixthLevel = 7,
    seventhLayer = 8,
    eighthLayer = 9;
const weightTextMargin = 0.115;

function between(a, b) {
    return d => d.depth >= a && d.depth < b;
}

const isFirstLayer = between(0, 1);
const isSecondLayer = between(1, thirdLevel);
const isThirdLayer = between(thirdLevel, fourthLevel);
const isFourthLayer = between(fourthLevel, fifthLevel);
const isFifthLayer = between(fifthLevel, sixthLevel);
const isSixthLayer = between(sixthLevel, seventhLayer);
const isSeventhLayer = between(seventhLayer, eighthLayer);
const isEightsLayer = d => d.depth >= eighthLayer;

// Constantes pour la conversion et les marges
const MARGIN = 10;
const LOGO_WIDTH = 188.985;
const LOGO_HEIGHT = 38.831; // Ajouté pour la clarté, même si non utilisé ici
const LOGO_MARGIN_TOP = 10;
const TEXT_MARGIN_X = 10;
const TEXT_MARGIN_Y = 10;
const TEXT_ROTATION = -90;
const FONT_SIZE = '12px';

function generateFrame(svg, frameDimensions) {
    const [frameWidthInMm, frameHeightInMm] = frameDimensions.split('x').map(Number);
    const frameWidth = mmToPixels(frameWidthInMm);
    const frameHeight = mmToPixels(frameHeightInMm);

    svg.append('rect')
        .attr('id', 'frame')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', frameWidth)
        .attr('height', frameHeight)
        .attr('fill', 'none')
        .attr('stroke', 'black')
        .style('stroke', 'hairline'); // Utilisation de .style pour les styles CSS

    const logoSvgContent = `<svg width="188.985" height="38.831" font-family="Helvetica, Arial, serif" xmlns="http://www.w3.org/2000/svg"><g aria-label="Genealogies" style="font-size:40px;line-height:1.25;font-family:Montserrat;-inkscape-font-specification:Montserrat;white-space:pre;shape-inside:url(#rect32540);fill:#32273b;fill-opacity:1;stroke-width:.487243" transform="translate(-89.14 -55.5) scale(.84182)"><path d="M120.649 95.847q-3.2 0-5.92-1.04-2.68-1.08-4.68-3-1.96-1.92-3.08-4.52-1.08-2.6-1.08-5.68 0-3.08 1.08-5.68 1.12-2.6 3.12-4.52 2-1.92 4.68-2.96 2.72-1.08 5.92-1.08 3.2 0 5.84 1 2.68 1 4.56 3.04l-1.84 1.88q-1.76-1.76-3.88-2.52t-4.56-.76q-2.6 0-4.8.88-2.16.84-3.8 2.44-1.6 1.56-2.52 3.68-.88 2.08-.88 4.6 0 2.48.88 4.6.92 2.12 2.52 3.72 1.64 1.56 3.8 2.44 2.2.84 4.76.84 2.4 0 4.52-.72 2.16-.72 3.96-2.44l1.68 2.24q-2 1.76-4.68 2.68-2.68.88-5.6.88zm7.44-3.92v-10.32h2.84v10.68zM147.626 95.807q-3.28 0-5.76-1.36-2.48-1.4-3.88-3.8-1.4-2.44-1.4-5.56 0-3.12 1.32-5.52 1.36-2.4 3.68-3.76 2.36-1.4 5.28-1.4 2.96 0 5.24 1.36 2.32 1.32 3.64 3.76 1.32 2.4 1.32 5.56 0 .2-.04.44v.44h-18.28v-2.12h16.76l-1.12.84q0-2.28-1-4.04-.96-1.8-2.64-2.8-1.68-1-3.88-1-2.16 0-3.88 1-1.72 1-2.68 2.8-.96 1.8-.96 4.12v.44q0 2.4 1.04 4.24 1.08 1.8 2.96 2.84 1.92 1 4.36 1 1.92 0 3.56-.68 1.68-.68 2.88-2.08l1.6 1.84q-1.4 1.68-3.52 2.56-2.08.88-4.6.88zM173.567 74.407q2.56 0 4.48 1 1.96.96 3.04 2.96 1.12 2 1.12 5.04v12.2h-2.84v-11.92q0-3.32-1.68-5-1.64-1.72-4.64-1.72-2.24 0-3.92.92-1.64.88-2.56 2.6-.88 1.68-.88 4.08v11.04h-2.84v-21h2.72v5.76l-.44-1.08q1-2.28 3.2-3.56 2.2-1.32 5.24-1.32zM198.798 95.807q-3.28 0-5.76-1.36-2.48-1.4-3.88-3.8-1.4-2.44-1.4-5.56 0-3.12 1.32-5.52 1.36-2.4 3.68-3.76 2.36-1.4 5.28-1.4 2.96 0 5.24 1.36 2.32 1.32 3.64 3.76 1.32 2.4 1.32 5.56 0 .2-.04.44v.44h-18.28v-2.12h16.76l-1.12.84q0-2.28-1-4.04-.96-1.8-2.64-2.8-1.68-1-3.88-1-2.16 0-3.88 1-1.72 1-2.68 2.8-.96 1.8-.96 4.12v.44q0 2.4 1.04 4.24 1.08 1.8 2.96 2.84 1.92 1 4.36 1 1.92 0 3.56-.68 1.68-.68 2.88-2.08l1.6 1.84q-1.4 1.68-3.52 2.56-2.08.88-4.6.88zM226.554 95.607v-4.64l-.12-.76v-7.76q0-2.68-1.52-4.12-1.48-1.44-4.44-1.44-2.04 0-3.88.68-1.84.68-3.12 1.8l-1.28-2.12q1.6-1.36 3.84-2.08 2.24-.76 4.72-.76 4.08 0 6.28 2.04 2.24 2 2.24 6.12v13.04zm-7.24.2q-2.36 0-4.12-.76-1.72-.8-2.64-2.16-.92-1.4-.92-3.2 0-1.64.76-2.96.8-1.36 2.56-2.16 1.8-.84 4.8-.84h7.24v2.12h-7.16q-3.04 0-4.24 1.08-1.16 1.08-1.16 2.68 0 1.8 1.4 2.88 1.4 1.08 3.92 1.08 2.4 0 4.12-1.08 1.76-1.12 2.56-3.2l.64 1.96q-.8 2.08-2.8 3.32-1.96 1.24-4.96 1.24zM236.987 95.607v-29.68h2.84v29.68zM256.329 95.807q-3.04 0-5.48-1.36-2.4-1.4-3.8-3.8-1.4-2.44-1.4-5.56 0-3.16 1.4-5.56 1.4-2.4 3.8-3.76 2.4-1.36 5.48-1.36 3.12 0 5.52 1.36 2.44 1.36 3.8 3.76 1.4 2.4 1.4 5.56 0 3.12-1.4 5.56-1.36 2.4-3.8 3.8-2.44 1.36-5.52 1.36zm0-2.52q2.28 0 4.04-1 1.76-1.04 2.76-2.88 1.04-1.88 1.04-4.32 0-2.48-1.04-4.32-1-1.84-2.76-2.84-1.76-1.04-4-1.04t-4 1.04q-1.76 1-2.8 2.84-1.04 1.84-1.04 4.32 0 2.44 1.04 4.32 1.04 1.84 2.8 2.88 1.76 1 3.96 1zM281.807 103.567q-2.88 0-5.52-.84-2.64-.84-4.28-2.4l1.44-2.16q1.48 1.32 3.64 2.08 2.2.8 4.64.8 4 0 5.88-1.88 1.88-1.84 1.88-5.76v-5.24l.4-3.6-.28-3.6v-6.36h2.72v18.44q0 5.44-2.68 7.96-2.64 2.56-7.84 2.56zm-.52-8.76q-3 0-5.4-1.28-2.4-1.32-3.8-3.64-1.36-2.32-1.36-5.32 0-3 1.36-5.28 1.4-2.32 3.8-3.6 2.4-1.28 5.4-1.28 2.8 0 5.04 1.16t3.56 3.44q1.32 2.28 1.32 5.56t-1.32 5.56q-1.32 2.28-3.56 3.48-2.24 1.2-5.04 1.2zm.28-2.52q2.32 0 4.12-.96 1.8-1 2.84-2.72 1.04-1.76 1.04-4.04 0-2.28-1.04-4-1.04-1.72-2.84-2.68-1.8-1-4.12-1-2.28 0-4.12 1-1.8.96-2.84 2.68-1 1.72-1 4 0 2.28 1 4.04 1.04 1.72 2.84 2.72 1.84.96 4.12.96z" style="fill:#32273b;fill-opacity:1;stroke-width:.487243"/><path d="M301.729 81.328q1.599 0 2.689 1.123 1.09 1.122 1.09 2.694 0 1.572-1.09 2.62-1.09 1.122-2.69 1.122-1.598 0-2.689-1.048-1.09-1.048-1.09-2.62 0-1.646 1.09-2.768 1.018-1.123 2.69-1.123z" style="fill:#fff;fill-opacity:1;stroke:#32273b;stroke-width:.276232;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"/><path d="M303.149 91.055v21h-2.84v-21zM320.944 95.807q-3.28 0-5.76-1.36-2.48-1.4-3.88-3.8-1.4-2.44-1.4-5.56 0-3.12 1.32-5.52 1.36-2.4 3.68-3.76 2.36-1.4 5.28-1.4 2.96 0 5.24 1.36 2.32 1.32 3.64 3.76 1.32 2.4 1.32 5.56 0 .2-.04.44v.44h-18.28v-2.12h16.76l-1.12.84q0-2.28-1-4.04-.96-1.8-2.64-2.8-1.68-1-3.88-1-2.16 0-3.88 1-1.72 1-2.68 2.8-.96 1.8-.96 4.12v.44q0 2.4 1.04 4.24 1.08 1.8 2.96 2.84 1.92 1 4.36 1 1.92 0 3.56-.68 1.68-.68 2.88-2.08l1.6 1.84q-1.4 1.68-3.52 2.56-2.08.88-4.6.88z" style="fill:#32273b;fill-opacity:1;stroke-width:.487243"/></g></svg>`; // Insérer le code SVG complet ici

    const logoXPosition = frameWidth - LOGO_WIDTH - MARGIN;
    svg.append('g')
        .html(logoSvgContent)
        .attr('id', 'logo')
        .attr('transform', `translate(${logoXPosition}, ${LOGO_MARGIN_TOP})`);

    svg.append('text')
        .attr('id', 'info')
        .attr('x', TEXT_MARGIN_X)
        .attr('y', frameHeight - TEXT_MARGIN_Y)
        .attr('font-size', FONT_SIZE)
        .text(`Visitez le site genealog.ie pour commander cet éventail généalogique gravé sur bois ou sur métal. Dimensions réelles avec le cadre : ${frameWidthInMm}x${frameHeightInMm} (mm). Contact : contact@genealog.ie`)
        .attr('transform', `rotate(${TEXT_ROTATION}, ${TEXT_MARGIN_X}, ${frameHeight - TEXT_MARGIN_Y})`);
}

function createBoxes(g, descendants, showMarriages) {
    const config = configStore.getConfig;
    const weightRadiusMarriage = showMarriages ? 0.27 : 0;

    const individualBoxGenerator = arc()
        .startAngle(d => !isFirstLayer(d) ? d.x0 : 0)
        .endAngle(d => !isFirstLayer(d) ? d.x1 : 2 * Math.PI)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1);

    const marriageBoxGenerator = arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => d.y1)
        .outerRadius(d => d.y1 + weightRadiusMarriage);

    const coloringOption = config.coloringOption;

    function getBoxColor(d) {
        if (coloringOption === 'individual') {
            const text = d.data.name || d.data.surname || '';
            return getBoxColorFromText(text);
        } else if (coloringOption === 'departement') {
            return d.data.bgColor ? d.data.bgColor : '#FFFFFF';
        } else if (coloringOption === 'none') {
            return '#FFFFFF';
        }
    }

    function getBoxColorFromText(text) {
        if (!text) {
            return '#FFFFFF';
        }
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = text.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF)
            .toString(16)
            .toUpperCase();

        return "#" + "00000".substring(0, 6 - c.length) + c;
    }

    function generateAndStyleBoxes(nodeId, filter, boxGenerator, coloringOption) {
        g.selectAll(`.${nodeId}`)
            .data(descendants)
            .enter()
            .filter(filter)
            .append('path')
            .attr('d', boxGenerator)
            .attr('stroke', '#32273B')
            .attr('style', '-inkscape-stroke:hairline')
            .attr('stroke-width', '0.01')
            .attr('fill', d => getBoxColor(d, coloringOption))
            .attr('class', nodeId)
            .attr('data-id', d => d.data.id);
    }

    // Générer les boîtes normalement
    generateAndStyleBoxes('individual-boxes', ignored => true, individualBoxGenerator, coloringOption);

    if (showMarriages) {
        generateAndStyleBoxes('marriage-boxes', d => d.children, marriageBoxGenerator, coloringOption);
    }

    function cleanupDuplicateLines() {
        const EPSILON = 0.0001;
        const lines = new Map();

        function normalizeCoord(coord) {
            return Math.round(coord * 10000) / 10000;
        }

        function isLine(commands) {
            // Vérifier si le chemin est une ligne simple (M + L)
            if (commands.length !== 2) return false;
            return (
                commands[0].type === SVGPathData.MOVE_TO &&
                commands[1].type === SVGPathData.LINE_TO
            );
        }

        function getLineKey(pathElement) {
            try {
                const pathData = new SVGPathData(pathElement.getAttribute('d'));
                const commands = pathData.commands;

                // Ignorer les chemins qui ne sont pas des lignes simples
                if (!isLine(commands)) return null;

                // Extraire les points de début et de fin
                const points = [
                    [normalizeCoord(commands[0].x), normalizeCoord(commands[0].y)],
                    [normalizeCoord(commands[1].x), normalizeCoord(commands[1].y)]
                ];

                // Trier les points pour avoir une clé cohérente quelle que soit la direction
                points.sort((a, b) => {
                    if (Math.abs(a[0] - b[0]) < EPSILON) {
                        return a[1] - b[1];
                    }
                    return a[0] - b[0];
                });

                return points.flat().join(',');

            } catch (error) {
                console.warn('Invalid path data:', pathElement.getAttribute('d'));
                return null;
            }
        }

        function shouldKeepExistingLine(existingPath, newPath) {
            const existingWidth = parseFloat(existingPath.getAttribute('stroke-width') || '0.01');
            const newWidth = parseFloat(newPath.getAttribute('stroke-width') || '0.01');

            if (Math.abs(existingWidth - newWidth) < EPSILON) {
                // Si les largeurs sont égales, préserver la structure d'origine
                return true;
            }
            
            // Garder la ligne avec la plus petite épaisseur
            return existingWidth <= newWidth;
        }

        // Collecter toutes les lignes
        g.selectAll('path').each(function() {
            const path = this;
            const key = getLineKey(path);
            
            if (!key) return; // Ignorer les chemins qui ne sont pas des lignes simples

            if (!lines.has(key)) {
                lines.set(key, path);
            } else {
                const existingPath = lines.get(key);
                if (!shouldKeepExistingLine(existingPath, path)) {
                    // Remplacer l'ancienne ligne par la nouvelle
                    existingPath.remove();
                    lines.set(key, path);
                } else {
                    // Supprimer la nouvelle ligne
                    path.remove();
                }
            }
        });

        // Log des statistiques de nettoyage
        console.log(`Clean-up stats: ${lines.size} unique lines kept`);
    }

    // Nettoyer les lignes en double après la génération
    cleanupDuplicateLines();
}

function createTextElements(g, defs, descendants, showMarriages) {
    const config = configStore.getConfig;
    const weightRadiusMarriage = config.showMarriages ? 0.27 : 0;
    const weightRadiusFirst = config.weights.generations[0];
    const fixOrientations = true;
    const angleInterpolate = config.angle / Math.PI - 1;
    let isMarriageFirst, isMarriageSecond;

    // Fonction auxiliaire pour générer un identifiant de chemin
    function pathId(sosa, line) {
        return "s" + sosa + "l" + line;
    }

    // Fonction auxiliaire pour générer une ligne simple
    function simpleLine(x0, y0, x1, y1) {
        const generator = line();
        return generator([
            [x0, y0],
            [x1, y1]
        ]);
    }

    // Fonction auxiliaire pour fixer un générateur d'arc
    function fixArc(arcGenerator) {
        return d => arcGenerator(d).split('A').slice(0, 2).join("A"); // Small hack to create a pure arc path (not filled)
    }

    function meanAngle(arr) {
        function sum(a, b) {
            return a + b;
        }
        return Math.atan2(
            arr.map(Math.sin).reduce(sum) / arr.length,
            arr.map(Math.cos).reduce(sum) / arr.length
        );
    }

    // Stockez les angles moyens pour éviter de recalculer
    const meanAngles = new Map();
    descendants.forEach(d => {
        meanAngles.set(d, meanAngle([d.x0, d.x1]));
    });

    // config.angle > 6 = fan angle = 360°
    if (config.angle > 6) {
        isMarriageFirst = d => between(0, fifthLevel)(d) && d.children;
        isMarriageSecond = d => d.depth >= fifthLevel && d.children;
    } else {
        isMarriageFirst = d => between(0, fourthLevel)(d) && d.children;
        isMarriageSecond = d => d.depth >= fourthLevel && d.children;
    }

    /** Text paths **/
    // Pré-calcul des descendants par couche
    const descendantsByLayer = {
        firstLayer: descendants.filter(isFirstLayer),
        secondLayer: descendants.filter(isSecondLayer),
        thirdLayer: descendants.filter(isThirdLayer),
        fourthLayer: descendants.filter(isFourthLayer),
        fifthLayer: descendants.filter(isFifthLayer),
        sixthLayer: descendants.filter(isSixthLayer),
        seventhLayer: descendants.filter(isSeventhLayer),
        eighthLayer: descendants.filter(isEightsLayer),
    };

    // Réutilisation des résultats des fonctions coûteuses

    // First node
    //const weightFirstLineSpacing = weightFontFirst 
    const weightFirstLineSpacing = weightFontFirst + 0.05; //FB
    const linesFirst = 4;
    const halfHeightFirst = (linesFirst - 1) * weightFirstLineSpacing / 2;
    for (let i = 0; i < linesFirst; i++) {
        const y = i * weightFirstLineSpacing - halfHeightFirst,
            yabs = Math.abs(y) + weightFirstLineSpacing / 2,
            x = Math.sqrt(Math.max(weightRadiusFirst * weightRadiusFirst - yabs * yabs, 0));
        defs.append('path')
            .attr('id', pathId(1, i))
            .attr('d', simpleLine(-2 * x, y, 2 * x, y));
    }

    // Secondary nodes
    const weightSecondLineSpacing = weightFontOther + 0.03;
    const linesSecond = 3; // Centre 3 lignes dans la boîte (au lieu de 4)
    const halfHeightSecond = (linesSecond - 1) * weightSecondLineSpacing / 2;

    const invert = config.invertTextArc ? d => {
    // Utilisez les angles moyens pré-calculés
        const angle = meanAngles.get(d);
        return angle < -Math.PI / 2 || angle > Math.PI / 2;
    } : ignored => false;

    for (let i = 0; i < linesSecond; i++) {
        const y = d => (invert(d) ? i : (linesSecond - 1 - i)) * weightSecondLineSpacing - halfHeightSecond;
        const radiusF = d => (d.y0 + d.y1) / 2 + y(d);
        const marginAngleF = d => weightTextMargin / radiusF(d) * (d.depth === 1 ? 1.5 : 1);
        const minA = d => Math.min(d.x0, d.x1),
            maxA = d => Math.max(d.x0, d.x1),
            rangeA = d => Math.abs(d.x0 - d.x1) - 2 * marginAngleF(d);
        const start = d => minA(d) + -0.5 * rangeA(d) + marginAngleF(d),
            end = d => maxA(d) + 0.5 * rangeA(d) - marginAngleF(d);

        const arcGenerator = fixArc(arc()
            .startAngle(d => invert(d) ? end(d) : start(d))
            .endAngle(d => invert(d) ? start(d) : end(d))
            .innerRadius(radiusF)
            .outerRadius(radiusF));

        // Utilisez les descendants pré-calculés pour cette couche
        descendantsByLayer.secondLayer.forEach(d => {
            defs.append('path')
                .attr('id', pathId(d.data.sosa, i))
                .attr('d', arcGenerator(d));
        });
    }

    function generateThirdLevelTextPaths(lines, spacing, filter) {
        const filteredDescendants = descendants.filter(filter);
    
        for (let i = 0; i < lines; i++) {
            const trueI = lines - 1 - i;
            
            filteredDescendants.forEach(d => {
                const angleSplitting = 1.35 / (1 << d.depth); // impact line spacing
                const weightThirdLineSpacing = angleSplitting * spacing;
                const halfHeightThird = (lines - 1) * weightThirdLineSpacing / 2;
                const angleMid = (((meanAngle([d.x0, d.x1]) - Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                const inverted = fixOrientations && angleMid >= Math.PI / 2 && angleMid < 3 * Math.PI / 2;
                const adjustedI = inverted ? trueI : i;
                const angle = adjustedI * weightThirdLineSpacing - halfHeightThird;
                const x = Math.cos(angle + angleMid);
                const y = Math.sin(angle + angleMid);
                const halfRange = (d.y1 - d.y0) / 2 - weightTextMargin;
                const y0 = inverted ? (d.y1 - weightTextMargin + halfRange) : (d.y0 + weightTextMargin - halfRange);
                const y1 = inverted ? (d.y0 + weightTextMargin - halfRange) : (d.y1 - weightTextMargin + halfRange);
    
                defs.append('path')
                    .attr('id', pathId(d.data.sosa, i))
                    .attr('d', simpleLine(x * y0, y * y0, x * y1, y * y1));
            });
        }
    }

    function generateTextPaths(linesIfAngleGreaterThan6, linesIfAngleLessThanOrEqual6, spacing, filter) {
        const lines = config.angle > 6 ? linesIfAngleGreaterThan6 : linesIfAngleLessThanOrEqual6;
        generateThirdLevelTextPaths(lines, spacing, filter);
    }

    const PI = Math.PI;

    // Third nodes 
    generateThirdLevelTextPaths(4, PI / 5, isThirdLayer);

    // Fourth nodes (3 or 4 lines depending on fanAngle value)
    generateTextPaths(4, 3, PI / 3.5, isFourthLayer);

    // Fifth nodes (2 or 3 lines depending on fanAngle value)
    generateTextPaths(3, 2, PI / 2.5, isFifthLayer);

    // Sixth nodes (1 or 2 lines depending on fanAngle value)
    generateTextPaths(2, 1, PI / 1.5, isSixthLayer);

    // Seventh nodes
    generateThirdLevelTextPaths(1, 0, d => d.depth >= seventhLayer);

    // Modification des chemins de texte pour les nœuds mariage
    if (showMarriages) {
        descendants.filter(d => d.children).forEach(d => {
            const angle = meanAngle([d.x0, d.x1]);
            let isTextInverted = (angle < -Math.PI / 2 || angle > Math.PI / 2);

            // Ajoutez la vérification pour config.invertTextArc ici
            if (!config.invertTextArc) {
                isTextInverted = false; // Ne pas inverser le texte si config.invertTextArc est faux
            }

            const isParentArc = isFirstLayer(d); // Vérifie si c'est le noeud des parents du rootNode
            const r = d.y1 + weightRadiusMarriage / 2 * 0.96; // Centrage vertical du texte dans l'arc de mariage
            const marginAngle = d.depth < sixthLevel ? weightTextMargin / r : weightTextMargin / (4 * r);
            const min = Math.min(d.x0, d.x1),
                max = Math.max(d.x0, d.x1),
                range = Math.abs(d.x0 - d.x1) - 2 * marginAngle;

            // Assurez-vous que l'arc pour les parents est toujours au sommet
            const startAngle = isParentArc ? -Math.PI / 2 : (isTextInverted ? max + 0.5 * range - marginAngle : min - 0.5 * range + marginAngle);
            const endAngle = isParentArc ? Math.PI / 2 : (isTextInverted ? min - 0.5 * range + marginAngle : max + 0.5 * range - marginAngle);

            // Utilisez startAngle et endAngle pour dessiner l'arc de mariage
            const marriageArcGenerator = fixArc(arc()
                .startAngle(startAngle)
                .endAngle(endAngle)
                .innerRadius(r)
                .outerRadius(r));

            defs.append('path')
                .attr('id', pathId(d.data.sosa, 'm'))
                .attr('fill', 'none')
                .attr('d', marriageArcGenerator(d));
        });

    }

    //Optimized version of generateTexts. Including text overflow check.
    const checkOverflow = (textElem, totalLength) => textElem.getComputedTextLength() > totalLength;

    const handleOverflow = (textPath, initialSize, step, checkOverflow) => {
        let lower = step, upper = initialSize, mid, doesOverflow;
        while (upper - lower > step) {
            mid = (lower + upper) / 2;
            textPath.style('font-size', `${mid}px`);
            doesOverflow = checkOverflow();
            if (doesOverflow) upper = mid;
            else lower = mid;
        }
        return { finalSize: lower, overflowed: doesOverflow };
    };

    const createGroupElement = (anchor, line, alignment, special) => {
        const group = anchor.append('g')
            .on('click', (event, d) => { // Utilisez d3.js pour gérer le clic
                event.stopPropagation(); // Empêche l'événement de se propager
                const customEvent = new CustomEvent('showPersonDetails', { detail: d });
                // console.log('Dispatching showPersonDetails event:', customEvent);
                document.dispatchEvent(customEvent);
            });

        return group;
    };

    const createTextElement = (group, line, alignment, special) => {
        return group.append('text')
            .attr('dominant-baseline', 'middle')
            .attr('alignment-baseline', 'middle')
            .append('textPath')
            .attr('font-size', `${line.size}px`)
            .attr('font-weight', line.bold ? "bold" : "")
            .attr('fill', d => determineTextColor(d))
            .attr('text-anchor', alignment)
            .attr('startOffset', '50%')
            .attr('href', d => `#${pathId(d.data.sosa, special ? 'm' : line.index)}`);
    };

    function determineTextColor(d) {
        // Adjust the selection to use the group 'boxes'
        const boxSelector = `#boxes path.individual-boxes[data-id="${d.data.id}"]`;
        const boxElement = select(boxSelector).node();
        
        if (!boxElement) {
            return 'black'; // Default to black if no box element is found
        }
        
        const boxColor = boxElement.getAttribute('fill');
        if (!boxColor || boxColor === '#FFFFFF') {
            return 'black'; // Return white if the text is empty
        }
        const color = tinycolor(boxColor);
        return color.isLight() ? 'black' : 'white';
    }

    // Handle Text Content: Extract the logic for determining the text content into a separate function.
    const setTextContent = (textPath, line, d, special) => {
        const display = config.contemporary.generations <= (d.depth + (special ? 1 : 0)) || (line.bold ? config.contemporary.showNames : config.contemporary.showEvents);
        textPath.text(display ? line.text(d) : '');
    };

    // Optimize Text Size: Separate the logic for handling overflow and adjusting text size.
    const optimizeTextSize = (textPath, textElem, pathElem, line, d) => {
        let size = parseFloat(textPath.style('font-size'));
        const step = 0.01 * size;
        const totalLength = pathElem.getTotalLength() / 2;
        let result = handleOverflow(textPath, size, step, () => checkOverflow(textElem, totalLength));

        if (shouldAdjustTextSize(result, line)) {
            adjustText(textPath, textElem, d, result, step, totalLength);
        }
    };

    function shouldAdjustTextSize(result, line) {
        return (line.filter === isFifthLayer || line.filter === isSixthLayer || line.filter === isSeventhLayer)
            && line.text === nameInline
            && result.finalSize < weightFontMin;
    }

    function adjustText(textPath, textElem, d, result, step, totalLength) {
        textPath.text(nameFirst(d).charAt(0) + '. ' + nameSecond(d));
        textPath.style('font-size', `${weightFontOther}px`);
        let newResult = handleOverflow(textPath, weightFontOther, step, () => checkOverflow(textElem, totalLength));
        if (newResult.overflowed) {
            textPath.style('font-size', `${newResult.finalSize}px`);
        }
    }

    // Optimized version of generateTexts. 
    const generateTexts = (filter, lines, alignment, special) => {
        const anchor = g.selectAll('path')
            .data(descendants)
            .enter()
            .filter(filter);

        const group = createGroupElement(anchor, lines[0], alignment, special);

        lines.forEach((line, i) => {
            line.index = i;
            line.filter = filter;
            const textPath = createTextElement(group, line, alignment, special);
            textPath.each(function (d) {
                const textElem = this.parentNode;
                const pathHref = select(this).attr('href');
                const pathElem = document.querySelector(pathHref);

                if (!pathElem) {
                    return;
                }

                setTextContent(select(this), line, d, special);
                optimizeTextSize(select(this), textElem, pathElem, line, d);
            });
        });
    };

    // Optimized textBirth and textDeath
    const textBirth = ({ data: { birthYear = '', fanBirthPlace = '' } }) => {
        const place = config.places.showPlaces && fanBirthPlace ? ` ${fanBirthPlace}` : '';
        return `${birthYear}${place}`;
    };

    const textDeath = ({ data: { deathYear = '', fanDeathPlace = '' } }) => {
        const place = config.places.showPlaces && fanDeathPlace ? ` ${fanDeathPlace}` : '';
        return `${deathYear}${place}`;
    };

    const textRange = ({ data: { birthYear = '', deathYear = '' } }) => {
        return birthYear && deathYear ? `${birthYear} - ${deathYear}` : birthYear || deathYear;
    };

    // Optimized givenName, nameInline, nameFirst, nameSecond
    const givenName = d => config.showFirstNameOnly ? d.data.name.split(/\s+/)[0] : d.data.name;
    const nameInline = d => `${nameFirst(d)} ${nameSecond(d)}`;
    const nameFirst = d => config.givenThenFamilyName ? givenName(d) : d.data.surname;
    const nameSecond = d => config.givenThenFamilyName ? d.data.surname : givenName(d);

    const generations = [
        { condition: isFirstLayer, texts: [{ text: nameFirst, size: weightFontFirst, bold: true }, { text: nameSecond, size: weightFontFirst, bold: true }, { text: textBirth, size: weightFontOther }, { text: textDeath, size: weightFontOther }] },
        { condition: isSecondLayer, texts: [{ text: nameInline, size: weightFontOther, bold: true }, { text: textBirth, size: weightFontDate }, { text: textDeath, size: weightFontDate }] },
        { condition: isThirdLayer, texts: [{ text: nameFirst, size: weightFontOther, bold: true }, { text: nameSecond, size: weightFontOther, bold: true }, { text: textBirth, size: weightFontDate }, { text: textDeath, size: weightFontDate }] },
        { condition: isFourthLayer, texts: config.angle > 6 ? [{ text: nameFirst, size: weightFontOther, bold: true }, { text: nameSecond, size: weightFontOther, bold: true }, { text: textBirth, size: weightFontDate }, { text: textDeath, size: weightFontDate }] : [{ text: nameFirst, size: weightFontOther, bold: true }, { text: nameSecond, size: weightFontOther, bold: true }, { text: textRange, size: weightFontDate }] },
        { condition: isFifthLayer, texts: config.angle > 6 ? [{ text: nameInline, size: weightFontOther, bold: true }, { text: textBirth, size: weightFontDate }, { text: textDeath, size: weightFontDate }] : [{ text: nameInline, size: weightFontOther, bold: true }, { text: textRange, size: weightFontDate }] },
        { condition: isSixthLayer, texts: config.angle > 6 ? [{ text: nameInline, size: weightFontOther, bold: true }, { text: textRange, size: weightFontDate }] : [{ text: nameInline, size: weightFontOther, bold: true }] },
        { condition: isSeventhLayer, texts: [{ text: nameInline, size: angleInterpolate * weightFontOther + (1 - angleInterpolate) * weightFontFar, bold: true }] },
        { condition: isEightsLayer, texts: [{ text: nameInline, size: angleInterpolate * weightFontFar + (1 - angleInterpolate) * weightFontFurthest, bold: true }] }
    ];

    generations.forEach(generation => {
        if (generation.condition) {
            generateTexts(generation.condition, generation.texts, "middle", false);
        }
    });

    if (showMarriages) {
        const getMarriageText = (d, includePlace) => {
            // Vérifiez si l'objet mariage n'est pas vide sans jQuery
            if (d.data.marriage && d.data.marriage.date && d.data.marriage.date.display) {
                // Utilisez extractYear pour obtenir seulement l'année de la date
                let text = extractYear(d.data.marriage.date.display);
                if (includePlace && config.places.showPlaces && d.data.marriage.place && d.data.marriage.place.display) {
                    // Ajoutez le lieu de mariage, si nécessaire
                    text += ' ' + d.data.marriage.place.display.split(/,| \(| \s\d/)[0];
                }
                return text;
            }
            return '';
        };

        // Marriage texts first
        generateTexts(isMarriageFirst, [
            { text: d => getMarriageText(d, true), size: weightFontMarriage },
        ], "middle", true);

        // Marriage texts second
        generateTexts(isMarriageSecond, [
            { text: d => getMarriageText(d, false), size: weightFontMarriage },
        ], "middle", true);
    }
}

function adjustFanVerticalPosition(svg, fanHeight, frameHeight, scale) {
    // Calculez le décalage vertical nécessaire pour centrer l'éventail
    let verticalOffset = (frameHeight - fanHeight) / 2;
    // console.log("frameHeightInPixels: ", frameHeight);
    // console.log("fanHeight: ", fanHeight);    
    // console.log("verticalOffset: ", verticalOffset);

    // Sélectionnez vos groupes 'boxes' et 'texts' et ajustez leur position verticale tout en conservant l'échelle
    function applyTransform(elementId) {
        svg.select(`g[id="${elementId}"]`).attr('transform', function () {
            let match = /translate\(([^,]+), ([^\)]+)\)/.exec(select(this).attr('transform'));
            let translateX = match ? parseFloat(match[1]) : 0;
            let translateY = match ? parseFloat(match[2]) : 0;
    
            let newTransform = `translate(${translateX}, ${translateY + verticalOffset}) scale(${scale})`;
            return newTransform;
        });
    }
    
    applyTransform('texts');
    applyTransform('boxes');
}

export function drawFan() {
    console.log('drawFan');
    console.time('drawFan');
    const config = configStore.getConfig;
    const angle = configStore.angle; // Récupérer l'angle via le getter
    const data = buildHierarchy(); // setHierarchy(data);
        
    if (data == null) {
        console.log("Data is null for drawFan. Exiting.");
        window.alert(__('geneafan.cannot_read_this_file'));
        return null;
    }

    if (!config.fanDimensions) {
        console.error("Fan dimensions are undefined");
        return null;
    }
    
    const [fanWidthInMm, fanHeightInMm] = config.fanDimensions.split('x').map(Number);
    if (!fanWidthInMm || !fanHeightInMm) {
        console.error("Invalid fan dimensions:", config.fanDimensions);
        return null;
    }

    const radius = mmToPixels(Math.round((fanWidthInMm / 2)));
    const showMarriages = config.showMarriages;

    const weightRadiusFirst = config.weights.generations[0],
        // weightRadiusClose = config.weights.generations[1],
        // weightRadiusFar = config.weights.generations[2],
        weightRadiusMarriage = showMarriages ? 0.27 : 0; //FB

    function applyNormalWeights(tree) {
        const generationLimits = [1, thirdLevel, seventhLayer, Infinity];

        function computeRecursive(tree, generation) {
            if (!tree) return; // Sortie rapide si tree est null ou undefined

            let i = 0;
            while (generation >= generationLimits[i]) {
                i++;
            }
            tree.weight = config.weights.generations[i];

            // Assurez-vous que tree.children est bien un tableau avant de l'itérer
            if (Array.isArray(tree.children)) {
                tree.children.forEach(child => computeRecursive(child, generation + 1));
            }
        }
        computeRecursive(tree, 0);
    }

    function applyTimeWeights(tree) {
        const defaultAgeForBirth = 22,
            defaultAgeDead = 80,
            maxAgeAlive = 110; // TODO actually use these (for the first ind.)
        const minimumAgeForBirth = 14,
            maximumAgeForBirth = 60;
        let minimums = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];

        function computeRecursive(tree, year, generation) {
            let timeDifference = defaultAgeForBirth;
            const isYearDefined = tree.birth && tree.birth.date && tree.birth.date.year;
            if (isYearDefined) {
                timeDifference = year - tree.birth.date.year;
            }
            if (timeDifference < minimumAgeForBirth || timeDifference > maximumAgeForBirth) {
                timeDifference = defaultAgeForBirth;
            }
            if (generation === 0) { // For now
                timeDifference = defaultAgeForBirth;
            }

            tree.weight = timeDifference;
            let i;
            if (generation < 1) { // (1)
                i = 0;
            } else if (generation < thirdLevel) { // (2)
                i = 1;
            } else if (generation < seventhLayer) { // (3)
                i = 2;
            } else { // (4)
                i = 3;
            }
            minimums[i] = Math.min(timeDifference, minimums[i]);

            if (tree.children) {
                tree.children.map(parent => computeRecursive(parent, isYearDefined ? tree.birth.date.year : year - timeDifference, generation + 1));
            }
        }
        const baseYear = new Date().getFullYear();
        computeRecursive(tree, baseYear, 0);

        let maxScale = 0;
        for (let i = 0; i < minimums.length; i++) {
            const scale = (config.weights.generations[i] + (i > 0 ? weightRadiusMarriage : 0)) / minimums[i];
            maxScale = Math.max(scale, maxScale);
        }

        function normalizeRecursive(tree, generation) {
            if (generation === 0) {
                tree.weight *= maxScale;
            } else {
                tree.weight = tree.weight * maxScale - weightRadiusMarriage;
            }
            if (tree.children) {
                tree.children.map(parent => normalizeRecursive(parent, generation + 1));
            }
        }

        normalizeRecursive(tree, 0);
    }

    if (config.isTimeVisualisationEnabled) {
        applyTimeWeights(data);
    } else {
        applyNormalWeights(data);
    }

    function computeTotalWeight(tree, generation) {
        if (!tree) return 0; 

        let currentWeight = tree.weight || 0; // Fallback sur 0 si tree.weight est indéfini
        if (generation > 0) {
            currentWeight += weightRadiusMarriage;
        }

        // Vérifiez si tree.children est un tableau et non vide avant de réduire
        if (Array.isArray(tree.children) && tree.children.length > 0) {
            return currentWeight + Math.max(...tree.children.map(child => computeTotalWeight(child, generation + 1)));
        } else {
            return currentWeight;
        }
    }

    const totalWeight = computeTotalWeight(data, 0); // Math.min(depth, 1) * weightRadiusFirst + Math.max(Math.min(depth, thirdLevel) - 1, 0) * weightRadiusClose + Math.max(depth - thirdLevel, 0) * weightRadiusFar + (depth - 1) * weightRadiusMarriage;

    // Calculate polar coordinates
    function calculateNodeProperties(node) {
        const space = 2 * Math.PI - angle; // Utiliser angle au lieu de config.angle
        if (node.parent == null) {
            node.x0 = Math.PI - space / 2;
            node.x1 = -Math.PI + space / 2;
            node.y0 = 0;
            node.y1 = node.data.weight;
        } else {
            let p = node.parent;
            let add = (p.x1 - p.x0) / 2;
            node.x0 = p.x0 + (node.data.sosa % 2 === 0 ? add : 0);
            node.x1 = node.x0 + add;
            node.y0 = p.y1 + weightRadiusMarriage;
            node.y1 = node.y0 + node.data.weight;
        }
    }

    let rootNode = hierarchy(data).each(calculateNodeProperties);
    let descendants = rootNode.descendants();

    const fanSvg = document.getElementById("fan");
    if (fanSvg) {
        fanSvg.innerHTML = "";
    }
    
    const width = 2 * radius,
        height = radius + Math.max(radius * Math.cos(Math.PI - angle / 2), radius * weightRadiusFirst / totalWeight); // Utiliser angle ici aussi

    const hasTitle = config.title.length > 0;
    const titleBlock = hasTitle ? titleSize + titleSpace : 0;
    const realHeight = height + titleBlock; // Keep for future use

    // Initialisation du SVG
    if (!config.frameDimensions) {
        console.error("Frame dimensions are undefined");
        return null;
    }

    const [frameWidthInMm, frameHeightInMm] = config.frameDimensions.split('x').map(Number);
    if (!frameWidthInMm || !frameHeightInMm) {
        console.error("Invalid frame dimensions:", config.frameDimensions);
        return null;
    }
    
    const svg = select('svg#fan')
        .attr('width', `${frameWidthInMm}mm`)
        .attr('height', `${frameHeightInMm}mm`)
        .style('overflow', 'visible')
        .attr('font-family', 'Helvetica Neue,Helvetica');

    // Création des définitions réutilisables
    const defs = svg.append('defs');

    // Génération du cadre SVG
    generateFrame(svg, config.frameDimensions); // Supposons que cette fonction est définie ailleurs

    // Création des groupes pour les boîtes et les éléments de texte
    const scale = radius / totalWeight;
    const baseTransform = `translate(${mmToPixels(frameWidthInMm) / 2}, ${mmToPixels(frameHeightInMm) / 2}) scale(${scale})`;

    const boxesGroup = svg.append('g').attr('id', 'boxes').attr('transform', baseTransform);
    const textsGroup = svg.append('g').attr('id', 'texts').attr('transform', baseTransform);

    // Génération des boîtes et des éléments de texte
    createBoxes(boxesGroup, descendants, showMarriages);

    createTextElements(textsGroup, defs, descendants, showMarriages);

    adjustFanVerticalPosition(svg, mmToPixels(fanHeightInMm), mmToPixels(frameHeightInMm), scale);
    
    console.timeEnd('drawFan');
    return {
        data: data,
        rootPersonName: { name: rootNode.data.name, surname: rootNode.data.surname }
    };
}

export function drawEmptyFan() {
    // Initialisation du conteneur SVG
    const fanSvg = document.getElementById("fan");
    if (fanSvg) {
        fanSvg.innerHTML = ""; // Efface le contenu existant
    }

    // Charger le fichier SVG à partir de l'URL
    xml("/dist/images/Fan_270_8GM.svg").then(data => {
        // Ajouter le contenu du fichier SVG à l'élément SVG existant
        select("#fan").node().append(data.documentElement);
    });
}

export { drawFan as draw };