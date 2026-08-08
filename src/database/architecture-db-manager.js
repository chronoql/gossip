/**
 * Chronoql Gossip: Architecture Database Manager
 * Handles all SQLite transactions and the Append-Only Version Ledger.
 */

const db = require('./db-connection');
const crypto = require('crypto');

module.exports = {
    getAllArchitectureDocs: () => {
        try {
            const stmt = db.prepare('SELECT doc_id, project_id, doc_type, title, last_updated FROM architecture_docs ORDER BY last_updated DESC');
            return stmt.all();
        } catch (error) {
            console.error('[DB Manager] Error fetching architecture docs:', error);
            throw error;
        }
    },

    searchArchitectureDocs: (docType, query) => {
        try {
            // ARCHITECTURAL FIX: Dynamically drop the doc_type clause if we are performing a global omni-search
            if (docType) {
                const stmt = db.prepare('SELECT doc_id, title FROM architecture_docs WHERE doc_type = ? AND title LIKE ? ORDER BY last_updated DESC LIMIT 10');
                return stmt.all(docType, `%${query}%`);
            } else {
                const stmt = db.prepare('SELECT doc_id, title FROM architecture_docs WHERE title LIKE ? ORDER BY last_updated DESC LIMIT 15');
                return stmt.all(`%${query}%`);
            }
        } catch (error) {
            console.error('[DB Manager] Error searching docs:', error);
            throw error;
        }
    },

    createArchitectureDoc: (title, docType = 'Specification', projectId = 1) => {
        try {
            // Using crypto.randomUUID for stronger collision resistance moving forward
            const docId = `doc-${crypto.randomUUID()}`;
            const stmt = db.prepare('INSERT INTO architecture_docs (doc_id, project_id, doc_type, title, content) VALUES (?, ?, ?, ?, ?)');
            const initialContent = `# ${title}\n\nStart defining your architectural rules here...`;
            stmt.run(docId, projectId, docType, title, initialContent);
            return { doc_id: docId, project_id: projectId, doc_type: docType, title: title };
        } catch (error) {
            console.error('[DB Manager] Error creating document:', error);
            throw error;
        }
    },

    // NEW: Jumpstart Template Engine - ACID Compliant Clone Transaction
    cloneArchitectureDoc: (sourceDocId, newTitle, targetDocType = 'Specification') => {
        try {
            // 1. Fetch the source payload
            const fetchStmt = db.prepare('SELECT content, project_id FROM architecture_docs WHERE doc_id = ?');
            const sourceDoc = fetchStmt.get(sourceDocId);

            if (!sourceDoc) {
                throw new Error(`Source document [${sourceDocId}] not found.`);
            }

            // 2. Generate a guaranteed unique ID
            const newDocId = `doc-${crypto.randomUUID()}`;
            
            const insertMaster = db.prepare('INSERT INTO architecture_docs (doc_id, project_id, doc_type, title, content) VALUES (?, ?, ?, ?, ?)');
            const insertLedger = db.prepare('INSERT INTO architecture_doc_versions (doc_id, content) VALUES (?, ?)');

            // 3. Orchestrate the ACID transaction
            const transaction = db.transaction(() => {
                insertMaster.run(newDocId, sourceDoc.project_id, targetDocType, newTitle, sourceDoc.content);
                insertLedger.run(newDocId, sourceDoc.content);
            });

            transaction();

            return { doc_id: newDocId, project_id: sourceDoc.project_id, doc_type: targetDocType, title: newTitle };
        } catch (error) {
            console.error(`[DB Manager] Error cloning document [${sourceDocId}]:`, error);
            throw error;
        }
    },

    getArchitectureDoc: (docId) => {
        try {
            const stmt = db.prepare('SELECT doc_id, project_id, doc_type, title, content, last_updated FROM architecture_docs WHERE doc_id = ?');
            return stmt.get(docId);
        } catch (error) {
            console.error(`[DB Manager] Error fetching architecture doc [${docId}]:`, error);
            throw error;
        }
    },
    
    updateArchitectureDoc: (docId, content) => {
        try {
            const updateMaster = db.prepare(`
                UPDATE architecture_docs 
                SET content = ?, last_updated = CURRENT_TIMESTAMP 
                WHERE doc_id = ?
            `);
            
            const appendLedger = db.prepare(`
                INSERT INTO architecture_doc_versions (doc_id, content) 
                VALUES (?, ?)
            `);

            const transaction = db.transaction(() => {
                updateMaster.run(content, docId);
                appendLedger.run(docId, content);
            });

            transaction();
            return { success: true };
        } catch (error) {
            console.error(`[DB Manager] Error updating architecture doc [${docId}]:`, error);
            throw error;
        }
    },

    // Atomic deletion of master document and its ledger history
    deleteArchitectureDoc: (docId) => {
        try {
            const deleteLedger = db.prepare('DELETE FROM architecture_doc_versions WHERE doc_id = ?');
            const deleteMaster = db.prepare('DELETE FROM architecture_docs WHERE doc_id = ?');
            
            const transaction = db.transaction(() => {
                deleteLedger.run(docId);
                deleteMaster.run(docId);
            });

            transaction();
            return { success: true };
        } catch (error) {
            console.error(`[DB Manager] Error deleting architecture doc [${docId}]:`, error);
            throw error;
        }
    },

    getDocHistory: (docId) => {
        try {
            const stmt = db.prepare(`
                SELECT version_id, saved_at 
                FROM architecture_doc_versions 
                WHERE doc_id = ? 
                ORDER BY saved_at DESC 
                LIMIT 50
            `);
            return stmt.all(docId);
        } catch (error) {
            console.error(`[DB Manager] Error fetching history for [${docId}]:`, error);
            throw error;
        }
    },

    getHistoricalVersion: (versionId) => {
        try {
            const stmt = db.prepare('SELECT * FROM architecture_doc_versions WHERE version_id = ?');
            return stmt.get(versionId);
        } catch (error) {
            console.error(`[DB Manager] Error fetching version [${versionId}]:`, error);
            throw error;
        }
    },

    deleteHistoricalVersion: (versionId) => {
        try {
            const stmt = db.prepare('DELETE FROM architecture_doc_versions WHERE version_id = ?');
            return stmt.run(versionId);
        } catch (error) {
            console.error(`[DB Manager] Error deleting version [${versionId}]:`, error);
            throw error;
        }
    }
};