const { ipcMain, app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const kanbanDbManager = require('../../database/kanban-db-manager');

// --- BULLETPROOF CONFIGURATION ---
const SYSTEM_CONSTANTS = {
    PROTECTED_BOARDS: ['my quick tasks', 'active sprint'],
    DIR_ATTACHMENTS: 'attachments',
    DIR_BACKGROUNDS: 'backgrounds'
};

const getSystemPath = (dirName) => {
    const targetPath = path.join(app.getPath('userData'), dirName);
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
    return targetPath;
};

function bindKanbanEvents() {
    
    // ==========================================
    // PROJECT MANAGEMENT ROUTING
    // ==========================================
    
    ipcMain.handle('kanban:get-projects', async (event) => {
        return kanbanDbManager.getAllProjects();
    });

    ipcMain.handle('kanban:create-project', async (event, payload) => {
        const pName = (payload.projectName || '').trim().toLowerCase();
        
        if (SYSTEM_CONSTANTS.PROTECTED_BOARDS.includes(pName)) {
            const rawProjects = await kanbanDbManager.getAllProjects();
            const projects = Array.isArray(rawProjects) ? rawProjects : (rawProjects.data || []);
            const alreadyExists = projects.some(p => SYSTEM_CONSTANTS.PROTECTED_BOARDS.includes((p.project_name || p.projectName || '').toLowerCase()));
            
            if (alreadyExists) {
                console.warn('[Kanban Controller] Security block: Attempted to create a duplicate reserved system board.');
                throw new Error('SYSTEM_BOARD_PROTECTED: Cannot duplicate a reserved system board.');
            }
        }

        return kanbanDbManager.createProject(payload);
    });

    ipcMain.handle('kanban:update-project', async (event, projectId, payload) => {
        if (payload.projectName) {
            const requestedName = payload.projectName.trim().toLowerCase();
            if (SYSTEM_CONSTANTS.PROTECTED_BOARDS.includes(requestedName)) {
                const rawProjects = await kanbanDbManager.getAllProjects();
                const projects = Array.isArray(rawProjects) ? rawProjects : (rawProjects.data || []);
                const targetProject = projects.find(p => String(p.project_id || p.projectId || p.id) === String(projectId));
                
                if (targetProject) {
                    const currentName = (targetProject.project_name || targetProject.projectName || '').toLowerCase();
                    
                    if (!SYSTEM_CONSTANTS.PROTECTED_BOARDS.includes(currentName)) {
                        console.warn('[Kanban Controller] Security block: Attempted to rename a board to a reserved system name.');
                        throw new Error('SYSTEM_BOARD_PROTECTED: Cannot use a reserved system name.');
                    }
                }
            }
        }

        return kanbanDbManager.updateProject(projectId, payload);
    });

    ipcMain.handle('kanban:delete-project', async (event, projectId) => {
        try {
            const rawProjects = await kanbanDbManager.getAllProjects();
            const projects = Array.isArray(rawProjects) ? rawProjects : (rawProjects.data || []);
            
            const projectToDelete = projects.find(p => String(p.project_id || p.projectId || p.id) === String(projectId));
            
            if (projectToDelete) {
                const pName = (projectToDelete.project_name || projectToDelete.projectName || '').toLowerCase();
                if (SYSTEM_CONSTANTS.PROTECTED_BOARDS.includes(pName)) {
                    console.warn('[Kanban Controller] Security block: Attempted to delete protected system board.');
                    throw new Error('SYSTEM_BOARD_PROTECTED: You cannot delete a master system board.');
                }
            }
            
            return await kanbanDbManager.deleteProject(projectId);
        } catch (error) {
            console.error('[Kanban Controller] Deletion failed:', error);
            throw error;
        }
    });

    ipcMain.handle('kanban:promote-project', async (event, sourceProjectId, payload) => {
        const pName = (payload.projectName || '').trim().toLowerCase();
        if (SYSTEM_CONSTANTS.PROTECTED_BOARDS.includes(pName)) {
            console.warn('[Kanban Controller] Security block: Attempted to co-opt a reserved system board during promotion.');
            throw new Error('SYSTEM_BOARD_PROTECTED: Cannot use a reserved system name.');
        }

        return kanbanDbManager.promoteProject(sourceProjectId, payload);
    });

    ipcMain.handle('kanban:duplicate-project', async (event, sourceProjectId, payload) => {
        const pName = (payload.projectName || '').trim().toLowerCase();
        if (SYSTEM_CONSTANTS.PROTECTED_BOARDS.includes(pName)) {
            console.warn('[Kanban Controller] Security block: Attempted to duplicate to a reserved system board name.');
            throw new Error('SYSTEM_BOARD_PROTECTED: Cannot use a reserved system name.');
        }

        return kanbanDbManager.duplicateProject(sourceProjectId, payload);
    });

    // ==========================================
    // COLUMN MANAGEMENT ROUTING
    // ==========================================
    
    ipcMain.handle('kanban:get-columns', async (event, projectId) => {
        return kanbanDbManager.getColumnsByProject(projectId);
    });

    ipcMain.handle('kanban:create-column', async (event, payload) => {
        return kanbanDbManager.createColumn(payload);
    });

    ipcMain.handle('kanban:update-column', async (event, columnId, payload) => {
        return kanbanDbManager.updateColumn(columnId, payload);
    });

    ipcMain.handle('kanban:update-column-positions', async (event, positionUpdates) => {
        return kanbanDbManager.updateColumnPositions(positionUpdates);
    });

    ipcMain.handle('kanban:delete-column', async (event, columnId) => {
        return kanbanDbManager.deleteColumn(columnId);
    });

    // ==========================================
    // CARD MANAGEMENT ROUTING
    // ==========================================
    
    ipcMain.handle('kanban:get-cards', async (event, columnId) => {
        return kanbanDbManager.getCardsByColumn(columnId);
    });

    ipcMain.handle('kanban:create-card', async (event, payload) => {
        return kanbanDbManager.createCard(payload);
    });

    ipcMain.handle('kanban:update-card', async (event, cardId, payload) => {
        return kanbanDbManager.updateCard(cardId, payload);
    });

    ipcMain.handle('kanban:delete-card', async (event, cardId) => {
        try {
            const attachments = await kanbanDbManager.getAttachments(cardId);
            if (attachments && attachments.length > 0) {
                const attachmentsDir = getSystemPath(SYSTEM_CONSTANTS.DIR_ATTACHMENTS);
                
                for (const att of attachments) {
                    if (att.file_path) {
                        const targetFile = path.join(attachmentsDir, att.file_hash || path.basename(att.file_path));
                        if (fs.existsSync(targetFile)) {
                            // Note: We rely on the garbage collector in the DB manager to handle physical unlinks safely 
                            // via reference counting, so we bypass manual fs.unlinkSync here to prevent CAS breaking.
                        }
                    }
                }
            }
            return kanbanDbManager.deleteCard(cardId);
        } catch (error) {
            console.error('[Kanban Controller] Error cascading deletion to physical attachments:', error);
            throw error;
        }
    });

    ipcMain.handle('kanban:update-card-positions', async (event, positionUpdates) => {
        return kanbanDbManager.updateCardPositions(positionUpdates);
    });

    // ==========================================
    // FILE AND ATTACHMENT ROUTING
    // ==========================================
    
    ipcMain.handle('kanban:get-attachments', async (event, cardId) => {
        return kanbanDbManager.getAttachments(cardId);
    });

    ipcMain.handle('kanban:add-attachment', async (event, payload) => {
        try {
            // Note: addAttachment handles physical copying via CAS now
            return kanbanDbManager.addAttachment(payload);
        } catch (error) {
            console.error('[Kanban Controller] Error copying attachment to managed directory:', error);
            throw error;
        }
    });

    ipcMain.handle('kanban:remove-attachment', async (event, payload) => {
        try {
            // DB manager garbage collection handles the physical unlinking
            return kanbanDbManager.removeAttachment(payload);
        } catch (error) {
            console.error('[Kanban Controller] Error removing managed attachment:', error);
            throw error;
        }
    });

    ipcMain.handle('kanban:open-attachment', async (event, payload) => {
        try {
            const { filePath, isAbsolute } = payload;
            let targetFile = filePath;

            if (!isAbsolute) {
                // Ensure we map via hash for the CAS engine
                const attachmentsDir = getSystemPath(SYSTEM_CONSTANTS.DIR_ATTACHMENTS);
                targetFile = path.join(attachmentsDir, path.basename(filePath));
            }

            if (fs.existsSync(targetFile)) {
                await shell.openPath(targetFile);
                return { success: true };
            } else {
                console.warn(`[Kanban Controller] OS Handoff failed. File not found at path: ${targetFile}`);
                return { success: false, message: 'File not found on system.' };
            }
        } catch (error) {
            console.error('[Kanban Controller] Error launching attachment:', error);
            throw error;
        }
    });

    ipcMain.handle('kanban:upload-background', async (event, payload) => {
        try {
            const backgroundsDir = getSystemPath(SYSTEM_CONSTANTS.DIR_BACKGROUNDS);
            const originalPath = payload.filePath;
            const extension = path.extname(originalPath);
            const safeFileName = `board-bg-${Date.now()}${extension}`;
            const destinationPath = path.join(backgroundsDir, safeFileName);

            fs.copyFileSync(originalPath, destinationPath);

            return { success: true, filePath: destinationPath };
        } catch (error) {
            console.error('[Kanban Controller] Error copying background image to managed directory:', error);
            throw error;
        }
    });

    console.log('[IPC] Kanban events orchestrated and securely wired to the database manager.');
}

module.exports = { bindKanbanEvents };