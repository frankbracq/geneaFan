import fs from 'fs';

/**
 * Function to register binary files in the context.
 * @param {Object} ctx - The context containing the binary files.
 */
function registerBinaryFiles(ctx) {
    ctx.keys().forEach(key => {
        // Extracts "./" from the beginning of the key
        fs.writeFileSync(key.substring(2), ctx(key));
    });
}

/**
 * Function to register AFM fonts in the context.
 * @param {Object} ctx - The context containing the AFM font files.
 */
function registerAFMFonts(ctx) {
    ctx.keys().forEach(key => {
        const match = key.match(/([^/]*\.afm$)/);
        if (match) {
            // AFM files must be stored in the data path
            fs.writeFileSync(`data/${match[0]}`, ctx(key).default);
        }
    });
}

// Individually register Helvetica AFM fonts
registerAFMFonts(require.context('pdfkit/js/data', false, /Helvetica.*\.afm$/));