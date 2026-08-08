/**
 * Chronoql Gossip: Architecture Controller
 * Orchestrates the IPC bridge between the UI and the SQLite database.
 */

const { ipcMain } = require('electron');
const dbManager = require('../../database/architecture-db-manager'); 

function bindArchitectureEvents(mainWindow) {
    console.log('[System Controller] Orchestrating Architecture IPC bridge...');

    ipcMain.handle('architecture:getAllDocs', async () => {
        try {
            const docs = dbManager.getAllArchitectureDocs();
            return { success: true, data: docs };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('architecture:searchDocs', async (event, docType, query) => {
        try {
            const docs = dbManager.searchArchitectureDocs(docType, query);
            return { success: true, data: docs };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('architecture:createDoc', async (event, title, docType) => {
        try {
            const newDoc = dbManager.createArchitectureDoc(title, docType);
            return { success: true, data: newDoc };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // NEW: Bridge for cloning a template or existing document
    ipcMain.handle('architecture:cloneDoc', async (event, sourceDocId, newTitle, targetDocType = 'Specification') => {
        try {
            const newDoc = dbManager.cloneArchitectureDoc(sourceDocId, newTitle, targetDocType);
            return { success: true, data: newDoc };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('architecture:getDoc', async (event, docId) => {
        try {
            const doc = dbManager.getArchitectureDoc(docId);
            if (doc) return { success: true, data: doc };
            return { success: false, error: `Document not found.` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('architecture:updateDoc', async (event, docId, content) => {
        try {
            dbManager.updateArchitectureDoc(docId, content);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('architecture:deleteDoc', async (event, docId) => {
        try {
            dbManager.deleteArchitectureDoc(docId);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('architecture:getHistory', async (event, docId) => {
        try {
            const history = dbManager.getDocHistory(docId);
            return { success: true, data: history };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('architecture:getVersion', async (event, versionId) => {
        try {
            const version = dbManager.getHistoricalVersion(versionId);
            if (version) return { success: true, data: version };
            return { success: false, error: 'Version not found.' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('architecture:deleteVersion', async (event, versionId) => {
        try {
            dbManager.deleteHistoricalVersion(versionId);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    console.log('[IPC] Architecture lifecycle events securely bound.');
}

module.exports = { bindArchitectureEvents };