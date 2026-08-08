/**
 * Chronoql Gossip: Documentation Controller
 * Routes IPC calls handling documentation and constraint view states.
 * Manages backend operations for the Document Management system.
 */

const { ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');

// Target the templates directory where Markdown specs and constraints are stored
const TEMPLATES_DIR = path.join(__dirname, '../../templates');

function bindDocumentationEvents() {
    console.log('[IPC] Binding Documentation Controller...');

    /**
     * Handle: Request to load a specific Markdown document template.
     */
    ipcMain.handle('docs:load', async (event, documentType) => {
        try {
            // Sanitize input to prevent directory traversal attacks
            const safeFilename = path.basename(`${documentType}.md`);
            const targetPath = path.join(TEMPLATES_DIR, safeFilename);

            const content = await fs.readFile(targetPath, 'utf8');
            return { success: true, data: content };
        } catch (error) {
            console.error(`[Documentation Controller] Failed to load ${documentType}:`, error);
            // Return empty string on failure (e.g., file doesn't exist yet) to allow the UI to start a fresh draft
            return { success: false, data: '', error: error.message };
        }
    });

    /**
     * Handle: Request to save compiled Markdown content back to the filesystem.
     */
    ipcMain.handle('docs:save', async (event, documentType, content) => {
        try {
            // Sanitize input to prevent directory traversal attacks
            const safeFilename = path.basename(`${documentType}.md`);
            const targetPath = path.join(TEMPLATES_DIR, safeFilename);

            // Ensure the templates directory exists before writing
            await fs.mkdir(TEMPLATES_DIR, { recursive: true });
            
            await fs.writeFile(targetPath, content, 'utf8');
            console.log(`[Documentation Controller] Successfully saved ${safeFilename}`);
            
            return { success: true };
        } catch (error) {
            console.error(`[Documentation Controller] Failed to save ${documentType}:`, error);
            return { success: false, error: error.message };
        }
    });

    console.log('[Orchestrator] Documentation IPC events bound successfully.');
}

module.exports = { bindDocumentationEvents };