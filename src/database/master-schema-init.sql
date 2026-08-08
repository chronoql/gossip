-- Chronoql Gossip: Master Database Schema Initialization

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ==========================================
-- SYSTEM ORCHESTRATION & ENVIRONMENT
-- ==========================================

-- @domain: System Orchestration
-- The foundational configuration table managing global, multi-tenant system variables and state.
CREATE TABLE IF NOT EXISTS environment_variables (
    variable_key TEXT PRIMARY KEY,
    variable_value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- WORKSPACE & TELEMETRY ORCHESTRATION
-- ==========================================

-- @domain: Workspace Orchestration
-- Central hub for managing isolated multi-project environments and their fiscal status.
CREATE TABLE IF NOT EXISTS workspaces (
    workspace_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    root_path TEXT NOT NULL,
    codebase_path TEXT,
    schema_path TEXT,
    classification TEXT DEFAULT 'sandbox' CHECK(classification IN ('production', 'sandbox', 'archived')),
    cumulative_consumed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- @domain: Workspace Orchestration
-- The time-series ledger for D3 ROI visualization and telemetry auditing.
CREATE TABLE IF NOT EXISTS token_ledger (
    ledger_id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL,
    session_start DATETIME NOT NULL,
    session_end DATETIME NOT NULL,
    tokens_consumed INTEGER DEFAULT 0,
    payload_savings INTEGER DEFAULT 0,
    session_savings INTEGER DEFAULT 0,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(workspace_id) ON DELETE CASCADE
);

-- ==========================================
-- KANBAN ORCHESTRATION & PROJECT MANAGEMENT
-- ==========================================

-- @domain: Kanban Orchestration
-- The top-level wrapper defining an isolated project workspace and its global styles.
CREATE TABLE IF NOT EXISTS kanban_project (
    project_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    background_color TEXT, 
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- @domain: Kanban Orchestration
-- Represents vertical workflow stages within a specific Kanban project.
CREATE TABLE IF NOT EXISTS kanban_column (
    column_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    column_name TEXT NOT NULL,
    position_index INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES kanban_project(project_id) ON DELETE CASCADE
);

-- @domain: Kanban Orchestration
-- The atomic unit of work, containing task details, positional logic, and UI styling constraints.
CREATE TABLE IF NOT EXISTS kanban_card (
    card_id INTEGER PRIMARY KEY AUTOINCREMENT,
    column_id INTEGER NOT NULL,
    card_title TEXT NOT NULL,
    card_content TEXT,
    card_color TEXT,
    text_color TEXT,
    position_index INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_edited_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (column_id) REFERENCES kanban_column(column_id) ON DELETE CASCADE
);

-- @domain: Kanban Orchestration
-- Tracks physical file associations and metadata linked to specific Kanban cards.
CREATE TABLE IF NOT EXISTS kanban_attachment (
    attachment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES kanban_card(card_id) ON DELETE CASCADE
);

-- ==========================================
-- ARCHITECTURE & CONSTRAINTS SCHEMA
-- ==========================================

-- @domain: Architecture & Constraints
-- Stores structural markdown documents (Specifications, Notes, Templates) defining system boundaries.
CREATE TABLE IF NOT EXISTS architecture_docs (
    doc_id TEXT PRIMARY KEY,
    project_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES kanban_project(project_id) ON DELETE CASCADE
);

-- @domain: Architecture & Constraints
-- An append-only version ledger preserving historical snapshots of architecture documents.
CREATE TABLE IF NOT EXISTS architecture_doc_versions (
    version_id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id TEXT NOT NULL,
    content TEXT,
    saved_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doc_id) REFERENCES architecture_docs(doc_id) ON DELETE CASCADE
);

-- ==========================================
-- UNIVERSAL SEED DATA (INSERT OR IGNORE)
-- ==========================================

-- Seed Environment Variables
INSERT OR IGNORE INTO environment_variables (variable_key, variable_value, description) VALUES 
('MAX_CONTEXT_TOKENS', '128000', 'The maximum token limit for the current LLM context window.'),
('CHARS_PER_TOKEN_RATIO', '4.0', 'The estimated number of characters per token (default is ~4).'),
('DATABASE_PATH', 'DYNAMIC_SYSTEM_MANAGED', 'The absolute OS path to the primary SQLite database serving the ecosystem.');

-- Seed Default Master Project
INSERT OR IGNORE INTO kanban_project (project_id, project_name, background_color) VALUES 
(1, 'Default Project', '#2D2D2D');

-- Seed Default Workspace
INSERT OR IGNORE INTO workspaces (workspace_id, name, root_path, classification) VALUES
('ws-master-01', 'Chronoql Core', 'UNINITIALIZED', 'production');

-- Seed Living Jumpstart Templates
INSERT OR IGNORE INTO architecture_docs (doc_id, project_id, doc_type, title, content) VALUES
('tmpl-codebase-xml', 1, 'Template', 'codebase.xml (Template)', 
'```xml
<?xml version="1.0" encoding="UTF-8"?>
<codebase>
    <project>
        <name>Project Name</name>
        <description>Brief description of the software architecture and purpose.</description>
        <version>1.0.0</version>
    </project>

    <constraints>
        <rule>Strict separation of concerns.</rule>
        <rule>No inline CSS or JS.</rule>
    </constraints>

    <structure>
        <directory name="src" status="active">
            <description>Source code directory.</description>
            
            <file name="main.js" status="active">
                <description>Main process entry point.</description>
                <visualizer-description>Bootstraps the application, orchestrates IPC bridges, and spawns the primary window.</visualizer-description>
                <inputs>package.json</inputs>
                <outputs>Renderer Process</outputs>
            </file>
            
            <file name="package-lock.json" status="active">
                <description>Exact dependency version locks.</description>
                <visualizer-description>Cryptographic lockfile ensuring deterministic builds across environments by pinning exact dependency graph versions.</visualizer-description>
                <inputs>package.json</inputs>
                <outputs>Node Environment</outputs>
            </file>
        </directory>
    </structure>
</codebase>
```');