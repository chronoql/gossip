/**
 * Project: Chronoql Gossip
 * Module: Workspace & Telemetry Orchestrator
 * Maps directly to IPC channels: 'workspace:*'
 */

function initWorkspaceOrchestrator(ipcMain, mainWindow, db) {
    
    // ---------------------------------------------------------
    // 1. Get All Workspaces (Tier 1 Cards)
    // ---------------------------------------------------------
    ipcMain.handle('workspace:get-workspaces', (event) => {
        try {
            const stmt = db.prepare(`
                SELECT 
                    workspace_id as id, 
                    name, 
                    root_path as path,
                    codebase_path as codebasePath,
                    schema_path as schemaPath, 
                    classification as class, 
                    cumulative_consumed as consumed
                FROM workspaces 
                ORDER BY last_accessed DESC
            `);
            return stmt.all();
        } catch (err) {
            console.error('[Workspace Controller] Error fetching workspaces:', err);
            return [];
        }
    });

    // ---------------------------------------------------------
    // 2. Create New Workspace
    // ---------------------------------------------------------
    ipcMain.handle('workspace:create-workspace', (event, payload) => {
        const { name, path, codebasePath, schemaPath, classification } = payload;
        const id = `ws-${Date.now()}`;
        
        try {
            const stmt = db.prepare(`
                INSERT INTO workspaces (workspace_id, name, root_path, codebase_path, schema_path, classification, cumulative_consumed)
                VALUES (?, ?, ?, ?, ?, ?, 0)
            `);
            stmt.run(id, name, path, codebasePath, schemaPath, classification);
            return { success: true, id };
        } catch(err) {
            console.error('[Workspace Controller] Error creating workspace:', err);
            return { success: false, error: err.message };
        }
    });

    // ---------------------------------------------------------
    // 3. Update Existing Workspace
    // ---------------------------------------------------------
    ipcMain.handle('workspace:update-workspace', (event, payload) => {
        const { id, name, path, codebasePath, schemaPath, classification } = payload;
        
        try {
            const stmt = db.prepare(`
                UPDATE workspaces 
                SET name = ?, root_path = ?, codebase_path = ?, schema_path = ?, classification = ?
                WHERE workspace_id = ?
            `);
            stmt.run(name, path, codebasePath, schemaPath, classification, id);
            return { success: true };
        } catch(err) {
            console.error('[Workspace Controller] Error updating workspace:', err);
            return { success: false, error: err.message };
        }
    });

    // ---------------------------------------------------------
    // 4. Delete Workspace
    // ---------------------------------------------------------
    ipcMain.handle('workspace:delete-workspace', (event, workspaceId) => {
        // SYSTEM GUARDRAIL: Protect the master fallback row
        if (workspaceId === 'ws-master-01') {
            return { success: false, error: 'System constraint: The root fallback workspace cannot be deleted.' };
        }

        try {
            // Note: Because of ON DELETE CASCADE in the schema, 
            // deleting this row will automatically wipe all associated token_ledger records.
            const stmt = db.prepare(`DELETE FROM workspaces WHERE workspace_id = ?`);
            stmt.run(workspaceId);
            return { success: true };
        } catch(err) {
            console.error('[Workspace Controller] Error deleting workspace:', err);
            return { success: false, error: err.message };
        }
    });

    // ---------------------------------------------------------
    // 5. Get Token Ledger (Tier 3 D3 Charts)
    // ---------------------------------------------------------
    ipcMain.handle('workspace:get-token-ledger', (event) => {
        try {
            const stmt = db.prepare(`
                SELECT 
                    strftime('%b %Y', t.session_end) as period,
                    w.classification,
                    t.tokens_consumed as consumed,
                    t.payload_savings as payloadSavings,
                    t.session_savings as sessionSavings
                FROM token_ledger t
                JOIN workspaces w ON t.workspace_id = w.workspace_id
                ORDER BY t.session_end ASC
            `);
            return stmt.all();
        } catch (err) {
            console.error('[Workspace Controller] Error fetching token ledger:', err);
            return [];
        }
    });

    // ---------------------------------------------------------
    // 6. The Teardown Flush (The Transactional Hybrid)
    // ---------------------------------------------------------
    ipcMain.handle('workspace:flush-token-ledger', (event, payload) => {
        const { workspaceId, consumed, payload: payloadSav, session, timestamp } = payload;
        
        try {
            const insertLedger = db.prepare(`
                INSERT INTO token_ledger (workspace_id, session_start, session_end, tokens_consumed, payload_savings, session_savings)
                VALUES (?, datetime('now', '-1 hours'), datetime('now'), ?, ?, ?)
            `);
            
            const updateCumulative = db.prepare(`
                UPDATE workspaces 
                SET cumulative_consumed = cumulative_consumed + ?,
                    last_accessed = datetime('now')
                WHERE workspace_id = ?
            `);
            
            const updateHeartbeat = db.prepare(`
                INSERT INTO environment_variables (variable_key, variable_value, description, updated_at)
                VALUES ('LAST_FLUSH_TIMESTAMP', ?, 'Cryptographic heartbeat for safe teardown validation', datetime('now'))
                ON CONFLICT(variable_key) DO UPDATE SET 
                    variable_value = excluded.variable_value,
                    updated_at = excluded.updated_at
            `);

            const flushTransaction = db.transaction(() => {
                if (consumed > 0 || payloadSav > 0 || session > 0) {
                    insertLedger.run(workspaceId, consumed, payloadSav, session);
                    updateCumulative.run(consumed, workspaceId);
                }
                updateHeartbeat.run(timestamp);
            });

            flushTransaction();
            return { success: true };

        } catch (err) {
            console.error('[Workspace Controller] Error executing teardown flush:', err);
            return { success: false, error: err.message };
        }
    });

    // ---------------------------------------------------------
    // 7. Heartbeat Validation
    // ---------------------------------------------------------
    ipcMain.handle('workspace:get-last-flush-timestamp', (event) => {
        try {
            const stmt = db.prepare(`SELECT variable_value FROM environment_variables WHERE variable_key = 'LAST_FLUSH_TIMESTAMP'`);
            const row = stmt.get();
            return row ? row.variable_value : null;
        } catch (err) {
            console.error('[Workspace Controller] Error fetching heartbeat:', err);
            return null;
        }
    });
}

module.exports = { initWorkspaceOrchestrator };