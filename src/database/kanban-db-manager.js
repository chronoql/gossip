const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app } = require('electron');

/**
 * Chronoql Gossip: Kanban Database Manager
 * Orchestrates all SQLite operations, including Content-Addressable Storage (CAS) 
 * for physical attachments with automatic Reference Counting (Garbage Collection).
 */

const dbPath = path.join(app.getPath('userData'), 'gossip.db');
const attachmentsDir = path.join(app.getPath('userData'), 'attachments');

if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
}

let db;

function initDatabase() {
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            project_id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_name TEXT NOT NULL,
            background_color TEXT DEFAULT '#0f172a',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS columns (
            column_id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            column_name TEXT NOT NULL,
            position_index INTEGER DEFAULT 0,
            FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS cards (
            card_id INTEGER PRIMARY KEY AUTOINCREMENT,
            column_id INTEGER NOT NULL,
            card_title TEXT NOT NULL,
            card_content TEXT,
            card_color TEXT DEFAULT '#ffffff',
            text_color TEXT DEFAULT '#172b4d',
            position_index INTEGER DEFAULT 0,
            last_edited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (column_id) REFERENCES columns (column_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS attachments (
            attachment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (card_id) REFERENCES cards (card_id) ON DELETE CASCADE
        );
    `);
    
    console.log('[DB Manager] SQLite Database & CAS Schema initialized.');
}

initDatabase();

// ==========================================
// CAS: ATTACHMENT GARBAGE COLLECTION
// ==========================================

function garbageCollectHash(fileHash) {
    if (!fileHash) return;
    const stmt = db.prepare('SELECT COUNT(*) AS count FROM attachments WHERE file_hash = ?');
    const result = stmt.get(fileHash);
    
    if (result.count === 0) {
        const physicalPath = path.join(attachmentsDir, fileHash);
        if (fs.existsSync(physicalPath)) {
            fs.unlinkSync(physicalPath);
            console.log(`[CAS Engine] Orphaned binary obliterated: ${fileHash}`);
        }
    }
}

// ==========================================
// PROJECT ORCHESTRATION
// ==========================================

function getProjects() {
    return db.prepare('SELECT * FROM projects ORDER BY created_at ASC').all();
}

function getAllProjects() {
    return getProjects();
}

function createProject(payload) {
    const { projectName, backgroundColor } = payload;
    const stmt = db.prepare('INSERT INTO projects (project_name, background_color) VALUES (?, ?)');
    const result = stmt.run(projectName, backgroundColor || '#0f172a');
    return { success: true, projectId: result.lastInsertRowid };
}

function updateProject(projectId, payload) {
    const { projectName, backgroundColor } = payload;
    const stmt = db.prepare('UPDATE projects SET project_name = ?, background_color = ? WHERE project_id = ?');
    stmt.run(projectName, backgroundColor, projectId);
    return { success: true };
}

function deleteProject(projectId) {
    const attachments = db.prepare(`
        SELECT a.file_hash 
        FROM attachments a
        JOIN cards ca ON a.card_id = ca.card_id
        JOIN columns co ON ca.column_id = co.column_id
        WHERE co.project_id = ?
    `).all(projectId);

    db.prepare('DELETE FROM projects WHERE project_id = ?').run(projectId);

    const uniqueHashes = [...new Set(attachments.map(a => a.file_hash))];
    uniqueHashes.forEach(garbageCollectHash);

    return { success: true };
}

function duplicateProject(sourceProjectId, payload) {
    const { projectName } = payload;
    const sourceProject = db.prepare('SELECT * FROM projects WHERE project_id = ?').get(sourceProjectId);
    if (!sourceProject) return { success: false, error: 'Source project not found' };

    const insertProj = db.prepare('INSERT INTO projects (project_name, background_color) VALUES (?, ?)');
    const newProjId = insertProj.run(projectName, sourceProject.background_color).lastInsertRowid;

    const columns = db.prepare('SELECT * FROM columns WHERE project_id = ?').all(sourceProjectId);
    const insertCol = db.prepare('INSERT INTO columns (project_id, column_name, position_index) VALUES (?, ?, ?)');
    const insertCard = db.prepare('INSERT INTO cards (column_id, card_title, card_content, card_color, text_color, position_index) VALUES (?, ?, ?, ?, ?, ?)');
    const insertAtt = db.prepare('INSERT INTO attachments (card_id, file_name, file_hash) VALUES (?, ?, ?)');

    for (const col of columns) {
        const newColId = insertCol.run(newProjId, col.column_name, col.position_index).lastInsertRowid;
        const cards = db.prepare('SELECT * FROM cards WHERE column_id = ?').all(col.column_id);
        
        for (const card of cards) {
            const newCardId = insertCard.run(newColId, card.card_title, card.card_content, card.card_color, card.text_color, card.position_index).lastInsertRowid;
            
            const atts = db.prepare('SELECT * FROM attachments WHERE card_id = ?').all(card.card_id);
            for (const att of atts) {
                insertAtt.run(newCardId, att.file_name, att.file_hash);
            }
        }
    }
    return { success: true, newProjectId: newProjId };
}

function promoteProject(sourceProjectId, payload) {
    const dupResult = duplicateProject(sourceProjectId, payload);
    if (dupResult.success) {
        const columns = db.prepare('SELECT column_id FROM columns WHERE project_id = ?').all(sourceProjectId);
        for (const col of columns) {
            const cards = db.prepare('SELECT card_id FROM cards WHERE column_id = ?').all(col.column_id);
            for (const c of cards) deleteCard(c.card_id);
        }
    }
    return dupResult;
}

// ==========================================
// COLUMN ORCHESTRATION
// ==========================================

function getColumns(projectId) {
    return db.prepare('SELECT * FROM columns WHERE project_id = ? ORDER BY position_index ASC').all(projectId);
}

function getColumnsByProject(projectId) {
    return getColumns(projectId);
}

function createColumn(payload) {
    const { projectId, columnName, positionIndex } = payload;
    const stmt = db.prepare('INSERT INTO columns (project_id, column_name, position_index) VALUES (?, ?, ?)');
    const result = stmt.run(projectId, columnName, positionIndex || 0);
    return { success: true, columnId: result.lastInsertRowid };
}

function updateColumn(columnId, payload) {
    const { columnName, positionIndex } = payload;
    const stmt = db.prepare('UPDATE columns SET column_name = ?, position_index = ? WHERE column_id = ?');
    stmt.run(columnName, positionIndex, columnId);
    return { success: true };
}

function updateColumnPositions(updates) {
    const stmt = db.prepare('UPDATE columns SET position_index = ? WHERE column_id = ?');
    const transaction = db.transaction((columns) => {
        for (const col of columns) {
            stmt.run(col.positionIndex, col.columnId);
        }
    });
    transaction(updates);
    return { success: true };
}

function deleteColumn(columnId) {
    const attachments = db.prepare(`
        SELECT a.file_hash 
        FROM attachments a
        JOIN cards ca ON a.card_id = ca.card_id
        WHERE ca.column_id = ?
    `).all(columnId);

    db.prepare('DELETE FROM columns WHERE column_id = ?').run(columnId);

    const uniqueHashes = [...new Set(attachments.map(a => a.file_hash))];
    uniqueHashes.forEach(garbageCollectHash);

    return { success: true };
}

// ==========================================
// CARD ORCHESTRATION
// ==========================================

function getCards(columnId) {
    return db.prepare('SELECT * FROM cards WHERE column_id = ? ORDER BY position_index ASC').all(columnId);
}

function getCardsByColumn(columnId) {
    return getCards(columnId);
}

function createCard(payload) {
    const { columnId, cardTitle, cardContent, cardColor, textColor, positionIndex } = payload;
    const stmt = db.prepare('INSERT INTO cards (column_id, card_title, card_content, card_color, text_color, position_index) VALUES (?, ?, ?, ?, ?, ?)');
    const result = stmt.run(columnId, cardTitle, cardContent, cardColor, textColor, positionIndex || 0);
    return { success: true, cardId: result.lastInsertRowid };
}

function updateCard(cardId, payload) {
    const { columnId, cardTitle, cardContent, cardColor, textColor, positionIndex } = payload;
    const stmt = db.prepare(`
        UPDATE cards 
        SET column_id = ?, card_title = ?, card_content = ?, card_color = ?, text_color = ?, position_index = ?, last_edited_at = CURRENT_TIMESTAMP 
        WHERE card_id = ?
    `);
    stmt.run(columnId, cardTitle, cardContent, cardColor, textColor, positionIndex, cardId);
    return { success: true };
}

function updateCardPositions(updates) {
    const stmt = db.prepare('UPDATE cards SET column_id = ?, position_index = ? WHERE card_id = ?');
    const transaction = db.transaction((cards) => {
        for (const card of cards) {
            stmt.run(card.columnId, card.positionIndex, card.cardId);
        }
    });
    transaction(updates);
    return { success: true };
}

function deleteCard(cardId) {
    const attachments = db.prepare('SELECT file_hash FROM attachments WHERE card_id = ?').all(cardId);
    
    db.prepare('DELETE FROM cards WHERE card_id = ?').run(cardId);
    
    const uniqueHashes = [...new Set(attachments.map(a => a.file_hash))];
    uniqueHashes.forEach(garbageCollectHash);
    
    return { success: true };
}

// ==========================================
// CAS: ATTACHMENT ORCHESTRATION
// ==========================================

function getAttachments(cardId) {
    const rows = db.prepare('SELECT attachment_id, card_id, file_name, file_hash FROM attachments WHERE card_id = ?').all(cardId);
    return rows.map(row => ({
        attachment_id: row.attachment_id,
        card_id: row.card_id,
        file_name: row.file_name,
        file_hash: row.file_hash,
        file_path: path.join(attachmentsDir, row.file_hash)
    }));
}

function addAttachment(payload) {
    const { cardId, fileName, filePath } = payload;
    
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const fileHash = hashSum.digest('hex');
        
        const destPath = path.join(attachmentsDir, fileHash);
        
        if (!fs.existsSync(destPath)) {
            fs.copyFileSync(filePath, destPath);
        }
        
        const stmt = db.prepare('INSERT INTO attachments (card_id, file_name, file_hash) VALUES (?, ?, ?)');
        const result = stmt.run(cardId, fileName, fileHash);
        
        return { success: true, attachmentId: result.lastInsertRowid, fileHash: fileHash };
    } catch (err) {
        console.error('[CAS Engine] Failed to process attachment:', err);
        return { success: false, error: err.message };
    }
}

// ARCHITECTURAL FIX: Direct relational linking for payloads (bypasses re-hashing)
function linkExistingAttachment(payload) {
    const { cardId, fileName, fileHash } = payload;
    try {
        const stmt = db.prepare('INSERT INTO attachments (card_id, file_name, file_hash) VALUES (?, ?, ?)');
        const result = stmt.run(cardId, fileName, fileHash);
        return { success: true, attachmentId: result.lastInsertRowid };
    } catch (err) {
        console.error('[CAS Engine] Failed to link existing attachment:', err);
        return { success: false, error: err.message };
    }
}

function removeAttachment(payload) {
    const { attachmentId } = payload;
    
    const att = db.prepare('SELECT file_hash FROM attachments WHERE attachment_id = ?').get(attachmentId);
    if (!att) return { success: false };
    
    db.prepare('DELETE FROM attachments WHERE attachment_id = ?').run(attachmentId);
    garbageCollectHash(att.file_hash);
    
    return { success: true };
}

// ==========================================
// SYSTEM LIFECYCLE
// ==========================================

function closeConnection() {
    if (db) {
        db.close();
        db = null;
        console.log('[DB Manager] SQLite connection safely terminated.');
    }
}

function close() {
    closeConnection();
}

module.exports = {
    getAllProjects,
    getProjects,
    createProject,
    updateProject,
    deleteProject,
    promoteProject,
    duplicateProject,
    getColumns,
    getColumnsByProject,
    createColumn,
    updateColumn,
    updateColumnPositions,
    deleteColumn,
    getCards,
    getCardsByColumn,
    createCard,
    updateCard,
    updateCardPositions,
    deleteCard,
    getAttachments,
    addAttachment,
    linkExistingAttachment,
    removeAttachment,
    closeConnection,
    close
};