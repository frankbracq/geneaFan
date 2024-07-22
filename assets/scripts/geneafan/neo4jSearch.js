import neo4j from 'neo4j-driver';
import { getIndividualsCache } from './state.js';

// Remplacer par vos informations de connexion Neo4j Aura
const uri = 'neo4j+s://500a4379.databases.neo4j.io';
// const uri = 'bolt://500a4379.databases.neo4j.io'; // Utiliser `bolt://` pour une connexion non sécurisée
const user = 'neo4j';
const password = 'HY-qcObpvwhc-Xbv9oly_0mJAy3WdVTWbh9eKySSJXo';

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
const session = driver.session();

export async function importData() {
    // Charger les données en utilisant getIndividualsCache()
    const data = getIndividualsCache();

    const tx = session.beginTransaction();

    try {
        for (let [id, individual] of data) {
            console.log(`Importing individual ${id}: ${individual.name} ${individual.surname}`);
            /*
            const result = await tx.run(
                `MERGE (p:Person {id: $id})
                 SET p.name = $name, p.surname = $surname, p.birthDate = $birthDate, 
                     p.birthDepartement = $birthDepartement, p.birthCountry = $birthCountry, 
                     p.birthYear = $birthYear, p.deathYear = $deathYear, p.age = $age, 
                     p.deceased = $deceased, p.gender = $gender`,
                {
                    id: individual.id,
                    name: individual.name,
                    surname: individual.surname,
                    birthDate: individual.birthDate,
                    birthDepartement: individual.birthDepartement,
                    birthCountry: individual.birthCountry,
                    birthYear: individual.birthYear,
                    deathYear: individual.deathYear,
                    age: individual.age,
                    deceased: individual.deceased,
                    gender: individual.gender
                }
            );
            */
            const result = await tx.run(
                `MERGE (p:Person {id: $id})
                 SET p.name = $name, p.surname = $surname`,
                {
                    id: individual.id,
                    name: individual.name,
                    surname: individual.surname
                }
            );

            if (result.summary.counters.updates().nodesCreated > 0 || result.summary.counters.updates().nodesMerged > 0) {
                console.log(`Node created/merged: ${result.summary.counters.updates().nodesCreated} nodes created, ${result.summary.counters.updates().nodesMerged} nodes merged`);
            }

            if (individual.fatherId) {
                const fatherResult = await tx.run(
                    `MATCH (p:Person {id: $id}), (f:Person {id: $fatherId})
                     MERGE (f)-[:FATHER_OF]->(p)`,
                    { id: individual.id, fatherId: individual.fatherId }
                );
                if (fatherResult.summary.counters.updates().relationshipsCreated > 0) {
                    console.log(`Father relationship created: ${fatherResult.summary.counters.updates().relationshipsCreated} relationships created`);
                }
            }

            if (individual.motherId) {
                const motherResult = await tx.run(
                    `MATCH (p:Person {id: $id}), (m:Person {id: $motherId})
                     MERGE (m)-[:MOTHER_OF]->(p)`,
                    { id: individual.id, motherId: individual.motherId }
                );
                if (motherResult.summary.counters.updates().relationshipsCreated > 0) {
                    console.log(`Mother relationship created: ${motherResult.summary.counters.updates().relationshipsCreated} relationships created`);
                }
            }

            for (let spouseId of individual.spouseIds) {
                const spouseResult = await tx.run(
                    `MATCH (p:Person {id: $id}), (s:Person {id: $spouseId})
                     MERGE (p)-[:MARRIED_TO]->(s)`,
                    { id: individual.id, spouseId: spouseId }
                );
                if (spouseResult.summary.counters.updates().relationshipsCreated > 0) {
                    console.log(`Marriage relationship created: ${spouseResult.summary.counters.updates().relationshipsCreated} relationships created`);
                }
            }

            for (let siblingId of individual.siblingIds || []) {
                const siblingResult = await tx.run(
                    `MATCH (p:Person {id: $id}), (s:Person {id: $siblingId})
                     MERGE (p)-[:SIBLING_OF]->(s)`,
                    { id: individual.id, siblingId: siblingId }
                );
                if (siblingResult.summary.counters.updates().relationshipsCreated > 0) {
                    console.log(`Sibling relationship created: ${siblingResult.summary.counters.updates().relationshipsCreated} relationships created`);
                }
            }
        }

        await tx.commit();
        console.log('Data imported successfully.');
    } catch (error) {
        console.error('Error importing data:', error);
        await tx.rollback();
    } finally {
        await session.close();
        await driver.close();
    }
}