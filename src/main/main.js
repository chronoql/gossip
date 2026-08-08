const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Initialize the database singleton to ensure the WAL journal mode and PRAGMA constraints are locked in early
const db = require('../database/db-connection'); 

let mainWindow = null;
let store; // Declare store at the top level so it remains accessible to the window creation function
let isSafeToQuit = false; // Global flag to intercept dirty teardowns
let controllersInitialized = false; // Singleton guard for IPC registration

function createMainWindow() {
    // macOS Guard: Prevent duplicate windows if one already exists from rapid-fire boot events
    if (mainWindow) return;

    // Retrieve cached window bounds from the dynamically imported store
    const { windowBounds, isMaximized } = store.store;

    // Architect the primary Command Center window, injecting persistent coordinates
    mainWindow = new BrowserWindow({
        ...windowBounds,
        minWidth: 1024,
        minHeight: 768,
        title: 'Chronoql Gossip',
        backgroundColor: '#0b1120', // Aligned with the dark theme
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true, // Strict security constraint
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Apply maximized state if previously cached
    if (isMaximized) {
        mainWindow.maximize();
    }

    // Load the primary UI container
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // ==========================================
    // CONTROLLER REGISTRATION (SINGLETON GUARD)
    // ==========================================
    if (!controllersInitialized) {
        // Inject the SQLite 'db' instance into the orchestrator so it can pass it to the controllers
        const { initDomainOrchestrator } = require('./domain-orchestrator');
        initDomainOrchestrator(ipcMain, mainWindow, db);

        // Initialize System Controller for OS-level actions, dialogs, and window management
        const { initSystemController } = require('./ipc-controllers/system-controller');
        initSystemController();
        
        controllersInitialized = true;
    }

    // ==========================================
    // WINDOW STATE PRESERVATION LOGIC
    // ==========================================
    
    // Cache the physical dimensions and coordinates when the window finishes moving or resizing
    const saveWindowState = () => {
        if (!mainWindow) return;
        if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
            store.set('windowBounds', mainWindow.getBounds());
        }
        store.set('isMaximized', mainWindow.isMaximized());
    };

    // Bind listeners to native OS lifecycle hooks
    mainWindow.on('resize', saveWindowState);
    mainWindow.on('move', saveWindowState);
    mainWindow.on('maximize', saveWindowState);
    mainWindow.on('unmaximize', saveWindowState);
    
    // Intercept the close event to enforce the final SQLite ledger flush
    mainWindow.on('close', (e) => {
        if (!isSafeToQuit) {
            e.preventDefault(); // Halt the destruction of the window
            saveWindowState(); // Ensure bounds are preserved even on a delayed exit
            mainWindow.webContents.send('trigger-teardown-flush'); // Signal the renderer
        }
    });

    // Garbage collection optimization
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Intercept clearance from the renderer indicating the DB flush is complete
ipcMain.on('teardown-complete', () => {
    isSafeToQuit = true;
    app.quit(); // Execute the true, safe shutdown
});

// Application Lifecycle Hooks
app.whenReady().then(async () => {
    // Dynamically import electron-store (ESM) during the asynchronous boot sequence
    const { default: Store } = await import('electron-store');
    
    // Initialize persistent OS-level state store
    store = new Store({
        name: 'chronoql-os-window-state',
        defaults: {
            windowBounds: { width: 1440, height: 900 },
            isMaximized: false
        }
    });

    createMainWindow();

    app.on('activate', () => {
        // macOS standard behavior: recreate a window if the dock icon is clicked and no windows are open
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Respect macOS standard behavior of keeping the app in the dock
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    // Ensure the SQLite database closes safely to prevent WAL corruption
    if (db) {
        console.log('[Chronoql Gossip] Safely closing SQLite connection...');
        db.close();
    }
});