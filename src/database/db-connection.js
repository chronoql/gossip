const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * Determines the correct application support directory based on the operating system.
 * Enforces the strict constraint for the macOS database path while maintaining
 * compatibility for Windows 11 and Linux build targets.
 */
const getBasePath = () => {
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'chronoql-gossip');
    } else if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'chronoql-gossip');
    } else {
        // Linux desktop fallback
        return path.join(os.homedir(), '.config', 'chronoql-gossip');
    }
};

const dbDir = getBasePath();
const dbPath = path.join(dbDir, 'gossip.db');

// Ensure the directory exists before attempting to initialize the database
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

let db;

try {
    // Initialize the better-sqlite3 singleton
    db = new Database(dbPath);
    
    // Enforce required Master Schema PRAGMA constraints
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    
    // ORCHESTRATION FIX: Execute the master schema to ensure tables exist on a fresh boot
    const schemaPath = path.join(__dirname, 'master-schema-init.sql');
    if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        db.exec(schema);
        console.log('[Chronoql Gossip] Master schema verified and initialized.');
    } else {
        console.warn('[Chronoql Gossip] WARNING: master-schema-init.sql not found. Database is empty.');
    }
    
    console.log(`[Chronoql Gossip] Database connected successfully at: ${dbPath}`);
} catch (error) {
    console.error('[Chronoql Gossip] Failed to connect to the local SQLite database:', error);
    throw error;
}

module.exports = db;