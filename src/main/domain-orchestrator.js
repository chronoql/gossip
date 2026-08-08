/**
 * Chronoql Gossip: Domain Orchestrator
 * Centralized registrar that initializes and binds all IPC controllers for the main process.
 */

// Core System & Data
const { bindSystemEvents } = require('./ipc-controllers/system-controller');
const { bindEnvironmentEvents } = require('./ipc-controllers/environment-controller');
const { bindDataManagementEvents } = require('./ipc-controllers/data-management-controller');

// Active Gossip Modules
const { bindDocumentationEvents } = require('./ipc-controllers/documentation-controller');
const { bindKanbanEvents } = require('./ipc-controllers/kanban-controller');
const { bindArchitectureEvents } = require('./ipc-controllers/architecture-controller');

// Workspace & Telemetry (Phase 8)
const { initWorkspaceOrchestrator } = require('./ipc-controllers/workspace-controller');

// LLM Command Center Modules
const bindContextCompressor = require('./ipc-controllers/context-compressor-controller');
const bindPayloadIntegrator = require('./ipc-controllers/payload-integrator-controller');

// System Visualizer Modules (Phase 7)
const { initVisualizerController } = require('./ipc-controllers/visualizer-controller');

// ARCHITECTURAL UPDATE: Added the 'db' parameter to explicitly receive the SQLite connection from main.js
function initDomainOrchestrator(ipcMain, mainWindow, db) {
    console.log('[Chronoql Gossip] Initializing Domain Orchestrator...');

    try {
        // Orchestrate core system, environment, and window controls
        if (typeof bindSystemEvents === 'function') {
            bindSystemEvents(mainWindow);
        }

        if (typeof bindEnvironmentEvents === 'function') {
            bindEnvironmentEvents();
        }
        
        if (typeof bindDataManagementEvents === 'function') {
            bindDataManagementEvents();
        }

        // Orchestrate tactical modules
        if (typeof bindDocumentationEvents === 'function') {
            bindDocumentationEvents();
        }
        
        if (typeof bindKanbanEvents === 'function') {
            bindKanbanEvents();
        }

        if (typeof bindArchitectureEvents === 'function') {
            bindArchitectureEvents(mainWindow);
        }

        // Orchestrate Phase 8 Workspace Administration Hub
        if (typeof initWorkspaceOrchestrator === 'function') {
            initWorkspaceOrchestrator(ipcMain, mainWindow, db);
        }

        // Orchestrate LLM Command Center modules
        if (typeof bindContextCompressor === 'function') {
            bindContextCompressor(mainWindow, db);
        }

        if (typeof bindPayloadIntegrator === 'function') {
            bindPayloadIntegrator(mainWindow);
        }

        // Orchestrate Phase 7 System Visualizers
        if (typeof initVisualizerController === 'function') {
            // ARCHITECTURAL FIX: Pass the SQLite connection down into the Visualizer controller
            initVisualizerController(db);
        }

        console.log('[Chronoql Gossip] All IPC domains successfully orchestrated.');
    } catch (error) {
        console.error('[Chronoql Gossip] Fatal error during domain orchestration:', error);
    }
}

module.exports = { initDomainOrchestrator };