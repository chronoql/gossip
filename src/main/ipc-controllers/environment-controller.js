/**
 * Chronoql Gossip: Environment Controller
 * Orchestrates the retrieval of dynamic environment variables from the SQLite database.
 */

const { ipcMain } = require('electron');
const db = require('../../database/db-connection'); 

function bindEnvironmentEvents() {
    console.log('[IPC] Binding Environment Settings Controller...');

    ipcMain.handle('system:get-environment-variables', async () => {
        try {
            const stmt = db.prepare('SELECT variable_key, variable_value FROM environment_variables');
            const rows = stmt.all();
            
            if (!rows || rows.length === 0) {
                throw new Error("No environment variables found in database.");
            }
            
            return rows;

        } catch (error) {
            console.warn('[Environment Controller] DB fetch failed, using fallback metrics:', error.message);
            // Graceful fallback to ensure the UI HUD does not break
            return [
                { variable_key: 'MAX_CONTEXT_TOKENS', variable_value: '128000' },
                { variable_key: 'CHARS_PER_TOKEN_RATIO', variable_value: '4.0' }
            ];
        }
    });
}

module.exports = { bindEnvironmentEvents };