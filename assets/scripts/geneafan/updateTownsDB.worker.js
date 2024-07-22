console.log("updateTownsDB worker loaded and running.");

let db; // Variable to store the database connection

function openDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }
        const request = indexedDB.open("PlacesDatabase", 1);
        request.onupgradeneeded = event => {
            // Gestion de la mise à jour du schéma ici, si nécessaire
            const db = event.target.result;
            if (!db.objectStoreNames.contains('Places')) {
                db.createObjectStore('Places', { keyPath: 'id' });
            }
        };
        request.onsuccess = event => {
            // console.log('Database opened successfully.'); 
            db = event.target.result; // Store the database connection
            resolve(db);
        };
        request.onerror = event => {
            // console.error('Database error during open:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

self.addEventListener('message', async event => {
    try {
        // console.log('Worker received message:', event.data); // Log the received message
        if (event.data.action === 'updateIndexedDB') {
            const { updatedFamilyTowns } = event.data;
            await updateIndexedDB(updatedFamilyTowns);
            self.postMessage({result: 'Update successful'});
        }
    } catch (error) {
        // console.error('Error handling message:', error);
        self.postMessage({error: error.toString()});
    }
});

async function updateIndexedDB(updatedFamilyTowns) {
    try {
        const db = await openDB();
        const transaction = db.transaction(["Places"], "readwrite");
        const store = transaction.objectStore("Places");
        for (const [key, updatedTown] of Object.entries(updatedFamilyTowns)) {
            store.put({...updatedTown, id: key});
        }
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        });
    } catch (error) {
        console.error('Error in updateIndexedDB:', error);
        throw error;
    }
}
