const { app, ipcMain, BrowserWindow, dialog, nativeTheme, shell } = require('electron');
const path = require('path');

// ==========================================
// SINGLETON WINDOW LEDGER
// ==========================================
const activeChildWindows = new Map();

/**
 * Orchestrates native OS interactions, window management, 
 * and generic system dialogs for the Electron main process.
 */
function initSystemController() {
    
    // ==========================================
    // HOT-RELOAD / SINGLETON SAFETY GUARDS
    // ==========================================
    ipcMain.removeAllListeners('system:close');
    ipcMain.removeAllListeners('system:minimize');
    ipcMain.removeAllListeners('system:maximize');
    ipcMain.removeAllListeners('system:open-external');
    
    ipcMain.removeHandler('system:toggle-theme');
    ipcMain.removeHandler('system:get-version');
    ipcMain.removeHandler('system:get-environment-variables');
    ipcMain.removeHandler('system:open-child');
    ipcMain.removeHandler('system:select-directory');
    ipcMain.removeHandler('system:select-file');

    // ==========================================
    // WINDOW MANAGEMENT
    // ==========================================
    
    ipcMain.on('system:close', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.close();
    });

    ipcMain.on('system:minimize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.minimize();
    });

    ipcMain.on('system:maximize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
        }
    });

    // ==========================================
    // SYSTEM PREFERENCES & METADATA
    // ==========================================

    ipcMain.handle('system:toggle-theme', () => {
        if (nativeTheme.shouldUseDarkColors) {
            nativeTheme.themeSource = 'light';
        } else {
            nativeTheme.themeSource = 'dark';
        }
        return nativeTheme.shouldUseDarkColors;
    });

    ipcMain.handle('system:get-version', () => {
        return app.getVersion();
    });

    ipcMain.handle('system:get-environment-variables', () => {
        return {
            platform: process.platform,
            arch: process.arch,
            version: process.version,
            userDataPath: app.getPath('userData')
        };
    });

    // ==========================================
    // EXTERNAL NAVIGATION & CHILD WINDOWS
    // ==========================================

    ipcMain.on('system:open-external', (event, url) => {
        if (url) {
            shell.openExternal(url);
        }
    });

    ipcMain.handle('system:open-child', (event, config) => {
        const target = config.url || config.file;
        if (!target) return false;

        // 1. Check the Singleton Ledger
        if (activeChildWindows.has(target)) {
            const existingWin = activeChildWindows.get(target);
            if (existingWin && !existingWin.isDestroyed()) {
                if (existingWin.isMinimized()) existingWin.restore();
                existingWin.focus();
                return true;
            }
        }

        // 2. Configure the Independent Window
        const winOptions = {
            width: config.width || 800,
            height: config.height || 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload.js') 
            }
        };

        // ARCHITECTURAL FIX: Only attach to the parent if explicitly configured as a modal.
        // This prevents the OS from forcing independent windows to stay on top indefinitely.
        if (config.modal) {
            winOptions.parent = BrowserWindow.fromWebContents(event.sender);
            winOptions.modal = true;
        }

        let childWin = new BrowserWindow(winOptions);

        if (target.startsWith('http')) {
            childWin.loadURL(target);
        } else {
            childWin.loadFile(path.join(__dirname, '../../renderer', target));
        }

        // 3. Register the window in the Ledger
        activeChildWindows.set(target, childWin);

        childWin.once('ready-to-show', () => {
            childWin.show();
        });

        // 4. Deregister autonomously on close
        childWin.on('closed', () => {
            activeChildWindows.delete(target);
        });

        return true;
    });

    // ==========================================
    // NATIVE DIALOGS (File & Directory Pickers)
    // ==========================================

    ipcMain.handle('system:select-directory', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        
        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
            title: 'Select Directory',
            buttonLabel: 'Select Folder',
            properties: ['openDirectory', 'createDirectory']
        });
        
        if (canceled || filePaths.length === 0) {
            return null;
        }
        return filePaths[0];
    });

    ipcMain.handle('system:select-file', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        
        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
            title: 'Select File',
            buttonLabel: 'Select File',
            properties: ['openFile'],
            filters: [
                { name: 'All Files', extensions: ['*'] },
                { name: 'XML Manifests', extensions: ['xml'] },
                { name: 'SQL Scripts', extensions: ['sql'] },
                { name: 'JSON Data', extensions: ['json'] },
                { name: 'Markdown', extensions: ['md'] }
            ]
        });
        
        if (canceled || filePaths.length === 0) {
            return null;
        }
        return filePaths[0];
    });
}

module.exports = { initSystemController };