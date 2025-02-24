import { readGedcom } from 'read-gedcom';
import fs from 'fs';

const filePath = './test_utf8.ged'; // Change le chemin si nécessaire
const outputFile = './gedcom_output.txt'; // Fichier de sortie

fs.readFile(filePath, null, async (err, data) => {
    if (err) {
        console.error('❌ Erreur lors de la lecture du fichier:', err);
        return;
    }

    try {
        const gedcomData = await readGedcom(data.buffer); // Lire en ArrayBuffer

        let output = '';
        output += '📜 GEDCOM Header:\n' + gedcomData.getHeader().toString() + '\n\n';

        // Test de getIndividualRecord()
        const individuals = gedcomData.getIndividualRecord();

        output += `👤 Nombre d'individus trouvés: ${individuals.length}\n`;
        output += JSON.stringify(individuals, null, 2) + '\n';

        // Écriture dans le fichier de sortie
        fs.writeFileSync(outputFile, output, 'utf-8');

        console.log(`✅ Résultats enregistrés dans ${outputFile}`);

    } catch (error) {
        console.error('❌ Erreur lors du parsing:', error);
    }
});
