const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');
const { XMLParser } = require('fast-xml-parser');

/**
 * Orchestrates backend parsing of structural manifests (XML/SQL) 
 * into hierarchical JSON objects required by D3.js visualizers.
 */
function initVisualizerController(db) {
    
    // ==========================================
    // TASK 1.1: Codebase Explorer XML Parser
    // ==========================================
    ipcMain.handle('gossip:fetch-codebase-tree', async (event, payload) => {
        try {
            if (!db) {
                throw new Error("Database connection not provided to Visualizer Controller.");
            }

            let codebasePath = null;
            let rootPath = null;

            // Attempt to map using the provided workspace ID
            if (payload && payload.workspaceId) {
                const stmt = db.prepare(`SELECT codebase_path, root_path FROM workspaces WHERE workspace_id = ?`);
                const row = stmt.get(payload.workspaceId);
                if (row) {
                    codebasePath = row.codebase_path;
                    rootPath = row.root_path;
                }
            }

            // Safely fallback to the most recent workspace in the DB
            if (!codebasePath && !rootPath) {
                console.warn("[Visualizer Controller] No workspace ID received. Falling back to primary DB record.");
                const stmt = db.prepare(`SELECT codebase_path, root_path FROM workspaces ORDER BY last_accessed DESC LIMIT 1`);
                const row = stmt.get();
                if (row) {
                    codebasePath = row.codebase_path;
                    rootPath = row.root_path;
                }
            }

            let finalXmlPath = null;

            // 1. Primary Route: Use the explicit codebase_path defined in the DB
            if (codebasePath && fs.existsSync(codebasePath)) {
                finalXmlPath = codebasePath;
            } 
            // 2. Fallback Route: Heuristic search within the assigned root_path
            else if (rootPath && rootPath !== 'UNINITIALIZED') {
                const rootXmlPath = path.join(rootPath, 'codebase.xml');
                const dataXmlPath = path.join(rootPath, 'data', 'codebase.xml');
                
                if (fs.existsSync(rootXmlPath)) {
                    finalXmlPath = rootXmlPath;
                } else if (fs.existsSync(dataXmlPath)) {
                    finalXmlPath = dataXmlPath;
                }
            }

            if (!finalXmlPath) {
                return { success: false, error: "codebase.xml path is missing or file not found. Ensure it is mapped in the Workspace Hub." };
            }

            const xmlData = fs.readFileSync(finalXmlPath, 'utf8');

            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "@_"
            });

            const parsedObj = parser.parse(xmlData);
            
            const d3Data = transformCodebaseToD3(parsedObj.codebase, rootPath);
            
            return { success: true, data: d3Data };
        } catch (error) {
            console.error('Failed to parse codebase.xml:', error);
            return { success: false, error: error.message };
        }
    });

    // ==========================================
    // TASK 1.2: Schema Visualizer SQL Parser
    // ==========================================
    ipcMain.handle('gossip:fetch-schema-tree', async (event, payload) => {
        try {
            if (!db) {
                throw new Error("Database connection not provided to Visualizer Controller.");
            }

            let schemaPath = null;

            // Attempt to map using the provided workspace ID
            if (payload && payload.workspaceId) {
                const stmt = db.prepare(`SELECT schema_path FROM workspaces WHERE workspace_id = ?`);
                const row = stmt.get(payload.workspaceId);
                if (row) schemaPath = row.schema_path;
            }

            // Safely fallback to the most recent workspace in the DB
            if (!schemaPath) {
                console.warn("[Visualizer Controller] No workspace ID received. Falling back to primary DB record.");
                const stmt = db.prepare(`SELECT schema_path FROM workspaces ORDER BY last_accessed DESC LIMIT 1`);
                const row = stmt.get();
                if (row) schemaPath = row.schema_path;
            }

            if (!schemaPath) {
                return { success: false, error: "No schema path mapped for this workspace. Initialize it in the Workspace Hub." };
            }

            if (!fs.existsSync(schemaPath)) {
                return { success: false, error: `Mapped schema file not found at: ${schemaPath}` };
            }

            // Read the dynamically mapped schema file from the user's OS
            const sqlData = fs.readFileSync(schemaPath, 'utf8');
            
            const relationalData = parseSQLToRelationalJSON(sqlData);
            
            return { success: true, data: relationalData };
        } catch (error) {
            console.error('Failed to parse schema file:', error);
            return { success: false, error: error.message };
        }
    });
}

// ---------------------------------------------------------
// Helper: XML to D3.js Hierarchical Transformation
// ---------------------------------------------------------
function transformCodebaseToD3(codebaseObj, targetPath) {
    
    // Force the root node to match the physical directory name
    let rootName = 'Chronoql Gossip';
    if (targetPath && targetPath !== 'UNINITIALIZED') {
        rootName = path.basename(targetPath);
    } else if (codebaseObj.project && codebaseObj.project['@_name']) {
        rootName = codebaseObj.project['@_name'];
    }

    const rootNode = {
        name: rootName,
        type: 'project',
        description: codebaseObj.description || '',
        children: []
    };

    if (codebaseObj.structure) {
        rootNode.children = parseStructure(codebaseObj.structure);
    }

    return rootNode;
}

function parseStructure(structureObj) {
    let children = [];

    if (structureObj.directory) {
        const dirs = Array.isArray(structureObj.directory) ? structureObj.directory : [structureObj.directory];
        dirs.forEach(dir => {
            const dirNode = {
                name: dir['@_name'],
                type: 'directory',
                description: dir.description || '',
                visualizerDescription: dir['visualizer-description'] || '',
                children: parseStructure(dir) 
            };
            children.push(dirNode);
        });
    }

    if (structureObj.file) {
        const files = Array.isArray(structureObj.file) ? structureObj.file : [structureObj.file];
        files.forEach(file => {
            children.push({
                name: file['@_name'],
                type: 'file',
                status: file['@_status'],
                description: file.description || '',
                visualizerDescription: file['visualizer-description'] || '',
                inputs: file.inputs || 'None',
                outputs: file.outputs || 'None'
            });
        });
    }

    return children;
}

// ---------------------------------------------------------
// Helper: SQL DDL to Relational JSON (Semicolon Terminated)
// ---------------------------------------------------------
function parseSQLToRelationalJSON(sqlString) {
    const tables = [];
    const lines = sqlString.split('\n');

    let currentDomain = 'Uncategorized';
    let currentDescription = '';
    let inBlock = false;
    let blockType = null; // 'TABLE' or 'VIEW'
    let currentName = '';
    let currentDDL = '';

    const saveBlock = () => {
        let foreignKeys = [];
        let columns = [];
        
        // We only extract internal column/FK definitions for Tables
        if (blockType === 'TABLE') {
            const ddlLines = currentDDL.split('\n');
            for (let dLine of ddlLines) {
                dLine = dLine.trim();
                
                // Extract structural FK mappings for D3 Edges
                const fkMatch = dLine.match(/FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s*[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i);
                if (fkMatch) {
                    foreignKeys.push({
                        localColumn: fkMatch[1].trim(),
                        targetTable: fkMatch[2].trim(),
                        targetColumn: fkMatch[3].trim()
                    });
                } else {
                    // Basic heuristic for column definition
                    if (!dLine.match(/CREATE\s+.*TABLE/i) && 
                        !dLine.startsWith('--') && 
                        !dLine.match(/^(PRIMARY KEY|KEY|UNIQUE|CONSTRAINT|INDEX|FULLTEXT|\))/i) &&
                        dLine.length > 0) {
                        
                        let colDef = dLine;
                        if (colDef.endsWith(',')) colDef = colDef.slice(0, -1);
                        
                        const parts = colDef.split(/\s+/);
                        if (parts.length >= 2) {
                            // Strip quotes/backticks from column name
                            const colName = parts[0].replace(/[`"']/g, ''); 
                            const colTypeAndConstraints = parts.slice(1).join(' ');
                            columns.push({
                                name: colName,
                                definition: colTypeAndConstraints
                            });
                        }
                    }
                }
            }
        }

        tables.push({
            name: currentName,
            type: blockType,
            domain: currentDomain,
            description: currentDescription,
            ddl: currentDDL.trim(),
            columns: columns,
            foreignKeys: foreignKeys
        });
        
        // Reset state machine
        inBlock = false;
        blockType = null;
        currentName = '';
        currentDDL = '';
        currentDomain = 'Uncategorized';
        currentDescription = '';
    };

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();
        const cleanLine = line.replace(/--.*$/, '').trim(); // Remove inline comments for the semicolon check

        if (!inBlock) {
            // 1. Capture Metadata tags outside of table definitions
            if (line.startsWith('-- @domain:')) {
                currentDomain = line.replace('-- @domain:', '').trim();
                continue;
            }
            if (line.startsWith('--') && !line.startsWith('-- =') && !line.startsWith('-- @')) {
                const descLine = line.replace('--', '').trim();
                if (descLine) {
                    currentDescription = currentDescription ? `${currentDescription} ${descLine}` : descLine;
                }
                continue;
            }

            if (cleanLine.length === 0) continue;

            // 2. Detect Block Start (Table or View)
            const match = cleanLine.match(/CREATE\s+(?:.*?\s+)?(TABLE|VIEW)(?:\s+IF\s+NOT\s+EXISTS)?\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i);
            if (match) {
                inBlock = true;
                blockType = match[1].toUpperCase();
                currentName = match[2];
                currentDDL = rawLine + '\n';
                
                // If it's a single-line block ending with ';'
                if (cleanLine.endsWith(';')) {
                    saveBlock();
                }
            }
        } else {
            // 3. Process Inside Block Body
            currentDDL += rawLine + '\n';
            
            // 4. Detect Universal Block End
            if (cleanLine.endsWith(';')) {
                saveBlock();
            }
        }
    }

    return tables;
}

module.exports = { initVisualizerController };