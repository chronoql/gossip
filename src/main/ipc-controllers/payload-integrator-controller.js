const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');

/**
 * Chronoql Gossip: Payload Integrator Controller
 * Orchestrates the secure ingestion, backup, and writing of LLM-generated code payloads.
 */

// ARCHITECTURAL FIX: Define the absolute boundary of the workspace.
// For Chronoql, we lock this to the current working directory of the application environment.
const PROJECT_ROOT = process.cwd(); 

function bindPayloadIntegrator(mainWindow) {
    console.log('[Integrator Controller] Binding Payload Integrator IPC channels...');

    ipcMain.handle('integrator:execute-payload', async (event, payload) => {
        try {
            console.log('[Integrator Controller] Intercepted execution request. Initiating safety protocols...');
            
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                throw new Error("Invalid payload architecture. Expected a flat JSON object.");
            }

            const filePaths = Object.keys(payload);
            if (filePaths.length === 0) {
                throw new Error("Payload is empty. No execution required.");
            }

            // ==========================================
            // PHASE 1 & 2: SECURITY VALIDATION & ATOMIC SNAPSHOTS
            // ==========================================
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupBaseDir = path.join(PROJECT_ROOT, '.chronoql_backups', `snapshot_${timestamp}`);
            let snapshotCreated = false;

            const validatedRoster = [];

            for (const relativePath of filePaths) {
                // Strict Path Resolution & Anti-Traversal Lockdown
                const absoluteTarget = path.resolve(PROJECT_ROOT, relativePath);
                
                if (!absoluteTarget.startsWith(PROJECT_ROOT)) {
                    throw new Error(`Security Violation: Path traversal detected on target [${relativePath}]. Execution aborted.`);
                }

                validatedRoster.push({
                    relativePath: relativePath,
                    absoluteTarget: absoluteTarget,
                    content: payload[relativePath]
                });

                // Pre-Flight Snapshot Orchestration
                try {
                    await fs.access(absoluteTarget);
                    // If the file exists, we must back it up
                    if (!snapshotCreated) {
                        await fs.mkdir(backupBaseDir, { recursive: true });
                        snapshotCreated = true;
                    }
                    
                    const backupFilePath = path.join(backupBaseDir, relativePath);
                    const backupFileDir = path.dirname(backupFilePath);
                    
                    await fs.mkdir(backupFileDir, { recursive: true });
                    await fs.copyFile(absoluteTarget, backupFilePath);
                    console.log(`[Integrator Controller] Snapshot secured for existing file: ${relativePath}`);
                } catch (err) {
                    // File does not exist yet; safe to proceed without backing it up
                    if (err.code !== 'ENOENT') {
                        throw err; 
                    }
                }
            }

            // ==========================================
            // PHASE 3: DIRECTORY ORCHESTRATION & EXECUTION
            // ==========================================
            
            console.log('[Integrator Controller] Safety protocols passed. Executing payload write...');

            for (const fileDef of validatedRoster) {
                const targetDir = path.dirname(fileDef.absoluteTarget);
                
                // Ensure the required folder tree exists before writing
                await fs.mkdir(targetDir, { recursive: true });
                
                // Stream the LLM payload to the physical disk
                await fs.writeFile(fileDef.absoluteTarget, fileDef.content, 'utf8');
                console.log(`[Integrator Controller] Successfully wrote payload to: ${fileDef.relativePath}`);
            }

            console.log('[Integrator Controller] Execution complete.');
            return { success: true };

        } catch (error) {
            console.error('[Integrator Controller] Fatal execution error:', error);
            return { success: false, error: error.message };
        }
    });

    console.log('[IPC] Payload Integrator securely bound.');
}

module.exports = bindPayloadIntegrator;