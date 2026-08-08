const { ipcMain, app, dialog } = require('electron');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip'); // ARCHITECTURAL FIX: Required for payload packaging
const kanbanDbManager = require('../../database/kanban-db-manager');

// --- BULLETPROOF CONFIGURATION ---
const SYSTEM_CONSTANTS = {
    DB_FILENAME: 'gossip.db',
    DIR_BACKUPS: 'backups',
    DIR_ATTACHMENTS: 'attachments',
    DIR_BACKGROUNDS: 'backgrounds'
};

const PROJECT_ROOT = process.cwd();
const WORKSPACE_BACKUP_DIR = path.join(PROJECT_ROOT, '.chronoql_backups');

const getSystemPath = (dirName) => {
    const targetPath = path.join(app.getPath('userData'), dirName);
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
    return targetPath;
};

const getLocalTimestamp = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    
    return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
};

async function getFilesRecursively(dir) {
    let results = [];
    const list = await fsPromises.readdir(dir, { withFileTypes: true });
    for (const file of list) {
        const fullPath = path.resolve(dir, file.name);
        if (file.isDirectory()) {
            results = results.concat(await getFilesRecursively(fullPath));
        } else {
            results.push(fullPath);
        }
    }
    return results;
}

function bindDataManagementEvents() {
    console.log('[Data Controller] Binding Data Management IPC channels...');

    // ==========================================
    // DATABASE BACKUP & RESTORE ORCHESTRATION
    // ==========================================

    ipcMain.handle('data:create-snapshot', async () => {
        try {
            const userDataPath = app.getPath('userData');
            const sourceDbPath = path.join(userDataPath, SYSTEM_CONSTANTS.DB_FILENAME);
            const backupsDir = getSystemPath(SYSTEM_CONSTANTS.DIR_BACKUPS);

            if (!fs.existsSync(sourceDbPath)) {
                throw new Error('Active database file not found.');
            }

            const timestamp = getLocalTimestamp();
            const backupFilename = `chronoql_snapshot_${timestamp}.db`;
            const destPath = path.join(backupsDir, backupFilename);

            fs.copyFileSync(sourceDbPath, destPath);

            return { success: true, filename: backupFilename, filepath: destPath };
        } catch (error) {
            console.error('[Data Controller] Failed to create snapshot:', error);
            throw error;
        }
    });

    ipcMain.handle('data:get-snapshots', async () => {
        try {
            const backupsDir = getSystemPath(SYSTEM_CONSTANTS.DIR_BACKUPS);
            const files = fs.readdirSync(backupsDir);
            
            const snapshots = files
                .filter(file => file.endsWith('.db'))
                .map(file => {
                    const filePath = path.join(backupsDir, file);
                    const stats = fs.statSync(filePath);
                    
                    let timestamp = stats.birthtimeMs || stats.mtimeMs;
                    
                    const match = file.match(/_(\d+)\.db$/);
                    if (match && match[1]) {
                        timestamp = parseInt(match[1], 10);
                    }

                    return {
                        filename: file,
                        timestamp: timestamp,
                        sizeBytes: stats.size
                    };
                });

            return snapshots;
        } catch (error) {
            console.error('[Data Controller] Failed to read snapshots:', error);
            throw error;
        }
    });

    ipcMain.handle('data:delete-snapshot', async (event, filename) => {
        try {
            const backupsDir = getSystemPath(SYSTEM_CONSTANTS.DIR_BACKUPS);
            const targetPath = path.join(backupsDir, filename);

            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
                return { success: true };
            } else {
                throw new Error('Snapshot file not found.');
            }
        } catch (error) {
            console.error('[Data Controller] Failed to delete snapshot:', error);
            throw error;
        }
    });

    ipcMain.handle('data:restore-snapshot', async (event, filename) => {
        try {
            const userDataPath = app.getPath('userData');
            const targetDbPath = path.join(userDataPath, SYSTEM_CONSTANTS.DB_FILENAME);
            const backupsDir = getSystemPath(SYSTEM_CONSTANTS.DIR_BACKUPS);
            const sourcePath = path.join(backupsDir, filename);

            if (!fs.existsSync(sourcePath)) {
                throw new Error('Snapshot file not found.');
            }

            if (kanbanDbManager && typeof kanbanDbManager.closeConnection === 'function') {
                kanbanDbManager.closeConnection();
            } else if (kanbanDbManager && typeof kanbanDbManager.close === 'function') {
                kanbanDbManager.close();
            } else {
                console.warn('[Data Controller] Warning: kanbanDbManager does not explicitly expose a close method. Relying on OS file lock release.');
            }

            fs.copyFileSync(sourcePath, targetDbPath);
            app.relaunch();
            app.exit(0);

            return { success: true };
        } catch (error) {
            console.error('[Data Controller] Failed to restore snapshot:', error);
            throw error;
        }
    });

    ipcMain.handle('data:import-snapshot', async () => {
        try {
            const { canceled, filePaths } = await dialog.showOpenDialog({
                title: 'Import Database Snapshot',
                properties: ['openFile'],
                filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
            });

            if (canceled || filePaths.length === 0) return { success: false };

            const sourcePath = filePaths[0];
            const backupsDir = getSystemPath(SYSTEM_CONSTANTS.DIR_BACKUPS);
            
            const timestamp = getLocalTimestamp();
            const destPath = path.join(backupsDir, `chronoql_snapshot_imported_${timestamp}.db`);

            fs.copyFileSync(sourcePath, destPath);
            return { success: true };
        } catch (error) {
            console.error('[Data Controller] Failed to import external snapshot:', error);
            return { success: false, error: error.message };
        }
    });

    // ==========================================
    // WORKSPACE / PAYLOAD INTEGRATOR ROLLBACKS
    // ==========================================

    ipcMain.handle('data:get-workspace-snapshots', async () => {
        try {
            await fsPromises.access(WORKSPACE_BACKUP_DIR);
        } catch {
            return { success: true, data: [] }; 
        }

        try {
            const entries = await fsPromises.readdir(WORKSPACE_BACKUP_DIR, { withFileTypes: true });
            const snapshots = [];

            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('snapshot_')) {
                    const snapshotPath = path.join(WORKSPACE_BACKUP_DIR, entry.name);
                    const stats = await fsPromises.stat(snapshotPath);
                    const files = await getFilesRecursively(snapshotPath);
                    
                    snapshots.push({
                        id: entry.name,
                        timestamp: stats.birthtimeMs || stats.mtimeMs, 
                        fileCount: files.length
                    });
                }
            }

            snapshots.sort((a, b) => b.timestamp - a.timestamp);
            return { success: true, data: snapshots };

        } catch (error) {
            console.error('[Data Controller] Failed to fetch workspace snapshots:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('data:restore-workspace-snapshot', async (event, snapshotId) => {
        console.log(`[Data Controller] Initiating workspace rollback for snapshot: ${snapshotId}`);
        try {
            if (!snapshotId || typeof snapshotId !== 'string' || snapshotId.includes('..')) {
                throw new Error("Invalid or malicious snapshot ID.");
            }

            const snapshotDir = path.resolve(WORKSPACE_BACKUP_DIR, snapshotId);
            if (!snapshotDir.startsWith(WORKSPACE_BACKUP_DIR)) {
                throw new Error("Security Violation: Path traversal detected during restoration.");
            }

            await fsPromises.access(snapshotDir);
            const filesToRestore = await getFilesRecursively(snapshotDir);

            for (const backupFilePath of filesToRestore) {
                const relativeWorkspacePath = path.relative(snapshotDir, backupFilePath);
                const targetActivePath = path.resolve(PROJECT_ROOT, relativeWorkspacePath);

                if (!targetActivePath.startsWith(PROJECT_ROOT)) {
                    throw new Error(`Security Violation: Attempted to restore file outside project bounds [${relativeWorkspacePath}].`);
                }

                await fsPromises.mkdir(path.dirname(targetActivePath), { recursive: true });
                await fsPromises.copyFile(backupFilePath, targetActivePath);
            }

            console.log(`[Data Controller] Workspace rollback complete for ${snapshotId}.`);
            return { success: true };

        } catch (error) {
            console.error('[Data Controller] Workspace rollback failed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('data:delete-workspace-snapshot', async (event, snapshotId) => {
        try {
            if (!snapshotId || typeof snapshotId !== 'string' || snapshotId.includes('..')) {
                throw new Error("Invalid or malicious snapshot ID.");
            }

            const snapshotDir = path.resolve(WORKSPACE_BACKUP_DIR, snapshotId);
            if (!snapshotDir.startsWith(WORKSPACE_BACKUP_DIR)) {
                throw new Error("Security Violation: Path traversal detected during deletion.");
            }

            await fsPromises.rm(snapshotDir, { recursive: true, force: true });
            return { success: true };
        } catch (error) {
            console.error('[Data Controller] Failed to delete workspace snapshot:', error);
            return { success: false, error: error.message };
        }
    });

    // ==========================================
    // JSON EXPORT & IMPORT ORCHESTRATION (ZIPPED PAYLOADS)
    // ==========================================

    ipcMain.handle('data:export-kanban', async () => {
        try {
            const timestamp = getLocalTimestamp();
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'Export Kanban Payload',
                defaultPath: `chronoql_kanban_payload_${timestamp}.zip`,
                filters: [{ name: 'Chronoql Archive', extensions: ['zip'] }]
            });

            if (canceled || !filePath) {
                throw new Error('Export cancelled');
            }

            const rawProjects = await kanbanDbManager.getAllProjects();
            const projects = Array.isArray(rawProjects) ? rawProjects : (rawProjects.data || []);
            
            const exportPayload = {
                export_date: new Date().toISOString(),
                type: 'kanban_full_dump',
                projects: []
            };

            const uniqueHashes = new Set();
            const attachmentsDir = getSystemPath(SYSTEM_CONSTANTS.DIR_ATTACHMENTS);

            for (const proj of projects) {
                const pName = (proj.project_name || proj.projectName || '').toLowerCase();
                if (pName === 'my quick tasks' || pName === 'active sprint') continue;

                const projectId = proj.project_id || proj.projectId || proj.id;
                const rawColumns = await kanbanDbManager.getColumnsByProject(projectId);
                const columns = Array.isArray(rawColumns) ? rawColumns : (rawColumns.data || []);
                
                const projData = { ...proj, columns: [] };

                for (const col of columns) {
                    const colId = col.column_id || col.columnId || col.id;
                    const rawCards = await kanbanDbManager.getCardsByColumn(colId);
                    const cards = Array.isArray(rawCards) ? rawCards : (rawCards.data || []);
                    
                    const enrichedCards = [];
                    for (const card of cards) {
                        const cardId = card.card_id || card.cardId || card.id;
                        const attachments = await kanbanDbManager.getAttachments(cardId) || [];
                        
                        attachments.forEach(att => uniqueHashes.add(att.file_hash));
                        
                        enrichedCards.push({
                            ...card,
                            attachments: attachments.map(a => ({
                                fileName: a.file_name,
                                fileHash: a.file_hash
                            }))
                        });
                    }
                    
                    projData.columns.push({ ...col, cards: enrichedCards });
                }
                exportPayload.projects.push(projData);
            }

            // ARCHITECTURAL FIX: Construct the .zip archive payload
            const zip = new AdmZip();
            zip.addFile("database.json", Buffer.from(JSON.stringify(exportPayload, null, 2), "utf8"));

            for (const hash of uniqueHashes) {
                const physicalPath = path.join(attachmentsDir, hash);
                if (fs.existsSync(physicalPath)) {
                    zip.addLocalFile(physicalPath, "attachments", hash);
                }
            }

            zip.writeZip(filePath);

            return { success: true, path: filePath };

        } catch (error) {
            console.error('[Data Controller] Export Kanban failed:', error);
            throw error;
        }
    });

    ipcMain.handle('data:import-payload', async () => {
        try {
            const { canceled, filePaths } = await dialog.showOpenDialog({
                title: 'Import Kanban Payload',
                properties: ['openFile'],
                filters: [{ name: 'Chronoql Archive', extensions: ['zip'] }]
            });

            if (canceled || filePaths.length === 0) {
                return { success: false, error: 'Import cancelled' };
            }

            const archivePath = filePaths[0];
            const zip = new AdmZip(archivePath);
            
            const dbEntry = zip.getEntry("database.json");
            if (!dbEntry) {
                throw new Error("Invalid archive format. Missing database.json.");
            }

            const payloadData = zip.readAsText(dbEntry);
            const payload = JSON.parse(payloadData);

            if (payload.type !== 'kanban_full_dump' || !Array.isArray(payload.projects)) {
                throw new Error("Invalid payload format. Expected Chronoql Kanban JSON dump.");
            }

            // ARCHITECTURAL FIX: Extract binary files if they don't already exist (CAS)
            const attachmentsDir = getSystemPath(SYSTEM_CONSTANTS.DIR_ATTACHMENTS);
            const zipEntries = zip.getEntries();

            for (const entry of zipEntries) {
                if (entry.entryName.startsWith("attachments/") && !entry.isDirectory) {
                    const hashName = entry.name;
                    const destPath = path.join(attachmentsDir, hashName);
                    if (!fs.existsSync(destPath)) {
                        zip.extractEntryTo(entry, attachmentsDir, false, true);
                    }
                }
            }

            for (const proj of payload.projects) {
                const pName = (proj.project_name || proj.projectName || '').toLowerCase();
                if (pName === 'my quick tasks' || pName === 'active sprint') continue;

                const newProj = await kanbanDbManager.createProject({
                    projectName: proj.project_name || proj.projectName,
                    backgroundColor: proj.background_color || proj.backgroundColor || '#0f172a'
                });
                const newProjId = newProj.projectId || newProj.project_id || newProj.id;

                for (const col of (proj.columns || [])) {
                    const newCol = await kanbanDbManager.createColumn({
                        projectId: newProjId,
                        columnName: col.column_name || col.columnName,
                        positionIndex: col.position_index || col.positionIndex || 0
                    });
                    const newColId = newCol.columnId || newCol.column_id || newCol.id;

                    for (const card of (col.cards || [])) {
                        const newCard = await kanbanDbManager.createCard({
                            columnId: newColId,
                            cardTitle: card.card_title || card.cardTitle,
                            cardContent: card.card_content || card.cardContent || '',
                            cardColor: card.card_color || card.cardColor || '#ffffff',
                            textColor: card.text_color || card.textColor || '#172b4d',
                            positionIndex: card.position_index || card.positionIndex || 0
                        });
                        const newCardId = newCard.cardId || newCard.card_id || newCard.id;

                        // ARCHITECTURAL FIX: Map imported attachments to the new card
                        for (const att of (card.attachments || [])) {
                            if (att.fileName && att.fileHash) {
                                await kanbanDbManager.linkExistingAttachment({
                                    cardId: newCardId,
                                    fileName: att.fileName,
                                    fileHash: att.fileHash
                                });
                            }
                        }
                    }
                }
            }

            return { success: true };
        } catch (error) {
            console.error('[Data Controller] Payload import failed:', error);
            return { success: false, error: error.message };
        }
    });

    // ==========================================
    // DESTRUCTIVE (FACTORY RESET)
    // ==========================================

    ipcMain.handle('data:factory-reset', async () => {
        try {
            const userDataPath = app.getPath('userData');
            const targetDbPath = path.join(userDataPath, SYSTEM_CONSTANTS.DB_FILENAME);
            const attachmentsDir = getSystemPath(SYSTEM_CONSTANTS.DIR_ATTACHMENTS);
            const backgroundsDir = getSystemPath(SYSTEM_CONSTANTS.DIR_BACKGROUNDS);

            if (kanbanDbManager && typeof kanbanDbManager.closeConnection === 'function') {
                kanbanDbManager.closeConnection();
            } else if (kanbanDbManager && typeof kanbanDbManager.close === 'function') {
                kanbanDbManager.close();
            }

            if (fs.existsSync(targetDbPath)) {
                fs.unlinkSync(targetDbPath);
            }

            if (fs.existsSync(attachmentsDir)) {
                const attFiles = fs.readdirSync(attachmentsDir);
                for (const file of attFiles) fs.unlinkSync(path.join(attachmentsDir, file));
            }

            if (fs.existsSync(backgroundsDir)) {
                const bgFiles = fs.readdirSync(backgroundsDir);
                for (const file of bgFiles) fs.unlinkSync(path.join(backgroundsDir, file));
            }

            app.relaunch();
            app.exit(0);

            return { success: true };
        } catch (error) {
            console.error('[Data Controller] CRITICAL: Factory reset failed:', error);
            throw error;
        }
    });

    console.log('[IPC] Data Management events orchestrated and securely wired.');
}

module.exports = { bindDataManagementEvents };