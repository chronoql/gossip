/**
 * Chronoql Gossip: Context Compressor Controller
 * Secure backend orchestrator for reading local file systems and generating directory trees.
 */

const { ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');

// ARCHITECTURAL FIX: Expanded ignore list to protect against massive virtual environments and system folders
const IGNORE_LIST = new Set([
    'node_modules', '.git', '.vscode', 'dist', 'build', '.DS_Store', 
    'venv', '.venv', 'env', '.env', 'virtualEnvs', '__pycache__',
    '.Trash', '.Trashes', '.fseventsd', '.Spotlight-V100', '.DocumentRevisions-V100'
]);

// Stateful tracker for the current active workspace path to ensure read-file security
let ACTIVE_WORKSPACE_PATH = null;

module.exports = function bindContextCompressor(mainWindow, db) {
    console.log('[IPC] Binding Context Compressor Controller...');

    /**
     * Recursively builds a structured tree of the workspace directory.
     */
    async function buildDirectoryTree(currentPath) {
        try {
            // ARCHITECTURAL FIX: Use lstat instead of stat to safely read symlinks without following them
            const stats = await fs.lstat(currentPath);
            const name = path.basename(currentPath);

            if (stats.isDirectory()) {
                if (IGNORE_LIST.has(name)) return null;

                const children = await fs.readdir(currentPath);
                const childNodes = [];

                for (const child of children) {
                    const childNode = await buildDirectoryTree(path.join(currentPath, child));
                    if (childNode) {
                        childNodes.push(childNode);
                    }
                }

                // Sort directories first, then files
                childNodes.sort((a, b) => {
                    if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                    return a.isDirectory ? -1 : 1;
                });

                return {
                    name,
                    path: currentPath,
                    isDirectory: true,
                    children: childNodes
                };
            }

            return {
                name,
                path: currentPath,
                isDirectory: false
            };
        } catch (err) {
            // Failsafe for unreadable system files/folders (prevents total tree collapse)
            console.warn(`[Context Compressor] Ignored unreadable path: ${currentPath}`);
            return null;
        }
    }

    /**
     * Handle: Request to fetch the entire workspace tree.
     */
    ipcMain.handle('compressor:get-workspace-tree', async (event, payload) => {
        try {
            if (!db) {
                throw new Error("Database connection not provided to Context Compressor controller.");
            }

            let targetPath = null;

            // Attempt to map using the provided ID
            if (payload && payload.workspaceId) {
                const stmt = db.prepare(`SELECT root_path FROM workspaces WHERE workspace_id = ?`);
                const row = stmt.get(payload.workspaceId);
                if (row) targetPath = row.root_path;
            }

            // If preload.js strips the ID or it's missing, safely fallback to the most recent workspace in the DB
            if (!targetPath) {
                console.warn("[Context Compressor] No workspace ID received. Falling back to primary DB record.");
                const stmt = db.prepare(`SELECT root_path FROM workspaces ORDER BY rowid DESC LIMIT 1`);
                const row = stmt.get();
                if (row) targetPath = row.root_path;
            }

            if (!targetPath || targetPath === 'UNINITIALIZED') {
                ACTIVE_WORKSPACE_PATH = null;
                return { success: false, error: "Workspace path is uninitialized or missing in DB." };
            }

            ACTIVE_WORKSPACE_PATH = targetPath;
            console.log(`[Context Compressor] Mapping tree for dynamic database path: ${ACTIVE_WORKSPACE_PATH}`);
            
            const tree = await buildDirectoryTree(ACTIVE_WORKSPACE_PATH);
            return { success: true, data: tree };
        } catch (error) {
            console.error('[Context Compressor] Tree generation failed:', error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Handle: Request to fetch the raw text content of a specific file.
     */
    ipcMain.handle('compressor:read-file', async (event, targetPath) => {
        try {
            if (!ACTIVE_WORKSPACE_PATH) {
                throw new Error('Access Denied: No active workspace path is currently mapped.');
            }

            // Security Check: Ensure the path is within the target workspace to prevent directory traversal attacks
            const resolvedPath = path.resolve(targetPath);
            if (!resolvedPath.startsWith(path.resolve(ACTIVE_WORKSPACE_PATH))) {
                throw new Error('Access Denied: Path is outside the active workspace boundaries.');
            }

            const content = await fs.readFile(resolvedPath, 'utf8');
            return { success: true, data: content };
        } catch (error) {
            console.error(`[Context Compressor] Failed to read file ${targetPath}:`, error);
            return { success: false, error: error.message };
        }
    });
};