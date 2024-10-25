import deburr from 'lodash/deburr';
import replace from 'lodash/replace';
import toLower from 'lodash/toLower';

export function normalizeGeoString(inputString) {
    return toLower(replace(deburr(inputString), /\s/g, "_"));
}

export function cleanTownName(str) {
    const cleanPlace = (place) =>
        (place.split(/,|\(.*|\s\d+\s*$/)[0].replace(/\d+$/, "") || "").trim();
    return cleanPlace(str);
}

export function formatTownName(str) {
    if (typeof str !== "string") {
        str = String(str);
    }
    str = cleanTownName(str);

    str = str.toLowerCase().replace(/(^|[-\s])([a-zà-ÿ])/g, function (match) {
        return match.toUpperCase();
    });

    str = str.replace(/(-D'|-d'| D'| d')(\w)/g, function(match, p1, p2) {
        return "-d'" + p2.toUpperCase();
    });

    const replacements = [
        { pattern: /-Sur-| Sur | s\/ /g, replacement: "-s/-" },
        { pattern: /-Sous-| Sous /g, replacement: "-/s-" },
        { pattern: /-La-| La | la /g, replacement: "-la-" },
        { pattern: /-Le-| Le | le /g, replacement: "-le-" },
        { pattern: /-Les-| Les | les /g, replacement: "-les-" },
        { pattern: /-Lès-| Lès | lès /g, replacement: "-lès-" },
        { pattern: /-Au-| Au | au /g, replacement: "-au-" },
        { pattern: /-Du-| Du | du /g, replacement: "-du-" },
        { pattern: /-De-| De | de /g, replacement: "-de-" },
        { pattern: /-Des-| Des | des /g, replacement: "-des-" },
        { pattern: /-Devant-| Devant | devant /g, replacement: "-devant-" },
        { pattern: /-En-| En | en /g, replacement: "-en-" },
        { pattern: /-Et-| Et | et /g, replacement: "-et-" },
        {
            pattern: /(Saint|Sainte)-|(Saint|Sainte) /g,
            replacement: function (match) {
                return match[0] === "S" ? "St-" : "Ste-";
            },
        },
        {
            pattern: /(Mont-|Mont |^-Mont$)/g,
            replacement: function (match) {
                return match === "-Mont" ? "-Mt" : "Mt-";
            },
        },
        { pattern: /-Madame$/g, replacement: "-Mme" },
        { pattern: /-Vieux$/g, replacement: "-Vx" },
        { pattern: /-Grand$/g, replacement: "-Gd" },
        { pattern: /-Petit$/g, replacement: "-Pt" },
        { pattern: /-Moulineaux$/g, replacement: "-Mlx" },
        {
            pattern: /(Paris|Marseille|Lyon)(-|\s)\b(X{0,3}(I{1,3}|IV|VI{0,3}|IX|X{0,3}V?I{0,3})\b)(ème)?/gi,
            replacement: "$1",
        },
        {
            pattern: /(Paris|Marseille|Lyon)(-|\s)\d{5}/gi,
            replacement: "$1",
        },
        {
            pattern: /(Paris|Marseille|Lyon)(-|\s)?(\d{1,2}(er|e|ème)?)/gi,
            replacement: "$1",
        },
    ];

    replacements.forEach(({ pattern, replacement }) => {
        str = str.replace(pattern, replacement);
    });

    return str;
}