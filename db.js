const dbName = "OvertimeDB";
const storeName = "entries";

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, {keyPath: "id", autoIncrement: true});
            }
        };
        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

async function saveEntry(entry) {
    const db = await openDB();
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).add(entry);
}

async function getAllEntries() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

async function updateEntry(id, updatedData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.oncomplete = () => {
            loadHistory().then(resolve).catch(reject);
        };
        tx.onerror = (event) => reject(event.target.error);

        const store = tx.objectStore(storeName);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const original = getRequest.result;
            if (original) {
                const updated = { ...original, ...updatedData };
                store.put(updated);
            }
        };
    });
}

async function deleteEntry(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.oncomplete = () => {
            loadHistory().then(resolve).catch(reject);
        };
        tx.onerror = (event) => reject(event.target.error);
        tx.objectStore(storeName).delete(id);
    });
}