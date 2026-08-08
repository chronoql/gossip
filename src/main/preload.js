const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    system: {
        closeWindow: () => ipcRenderer.send('system:close'),
        minimizeWindow: () => ipcRenderer.send('system:minimize'),
        maximizeWindow: () => ipcRenderer.send('system:maximize'),
        toggleTheme: () => ipcRenderer.invoke('system:toggle-theme'),
        getAppVersion: () => ipcRenderer.invoke('system:get-version'),
        getEnvironmentVariables: () => ipcRenderer.invoke('system:get-environment-variables'),
        openChildWindow: (config) => ipcRenderer.invoke('system:open-child', config),
        openExternal: (url) => ipcRenderer.send('system:open-external', url),
        selectDirectory: () => ipcRenderer.invoke('system:select-directory'),
        selectFile: () => ipcRenderer.invoke('system:select-file'),
        onAppQuitting: (callback) => ipcRenderer.on('trigger-teardown-flush', (_event) => callback()),
        confirmTeardown: () => ipcRenderer.send('teardown-complete')
    },
    data: {
        createSnapshot: () => ipcRenderer.invoke('data:create-snapshot'),
        getSnapshots: () => ipcRenderer.invoke('data:get-snapshots'),
        deleteSnapshot: (filename) => ipcRenderer.invoke('data:delete-snapshot', filename),
        restoreSnapshot: (filename) => ipcRenderer.invoke('data:restore-snapshot', filename),
        importSnapshot: () => ipcRenderer.invoke('data:import-snapshot'),
        getWorkspaceSnapshots: () => ipcRenderer.invoke('data:get-workspace-snapshots'),
        restoreWorkspaceSnapshot: (snapshotId) => ipcRenderer.invoke('data:restore-workspace-snapshot', snapshotId),
        deleteWorkspaceSnapshot: (snapshotId) => ipcRenderer.invoke('data:delete-workspace-snapshot', snapshotId),
        exportKanbanData: () => ipcRenderer.invoke('data:export-kanban'),
        importPayload: () => ipcRenderer.invoke('data:import-payload'),
        executeFactoryReset: () => ipcRenderer.invoke('data:factory-reset')
    },
    kanban: {
        getProjects: () => ipcRenderer.invoke('kanban:get-projects'),
        createProject: (payload) => ipcRenderer.invoke('kanban:create-project', payload),
        updateProject: (projectId, payload) => ipcRenderer.invoke('kanban:update-project', projectId, payload),
        deleteProject: (projectId) => ipcRenderer.invoke('kanban:delete-project', projectId),
        promoteProject: (sourceProjectId, payload) => ipcRenderer.invoke('kanban:promote-project', sourceProjectId, payload),
        duplicateProject: (sourceProjectId, payload) => ipcRenderer.invoke('kanban:duplicate-project', sourceProjectId, payload),
        uploadBackground: (payload) => ipcRenderer.invoke('kanban:upload-background', payload),
        getColumns: (projectId) => ipcRenderer.invoke('kanban:get-columns', projectId),
        createColumn: (payload) => ipcRenderer.invoke('kanban:create-column', payload),
        updateColumn: (columnId, payload) => ipcRenderer.invoke('kanban:update-column', columnId, payload),
        updateColumnPositions: (positionUpdates) => ipcRenderer.invoke('kanban:update-column-positions', positionUpdates),
        deleteColumn: (columnId) => ipcRenderer.invoke('kanban:delete-column', columnId),
        getCards: (columnId) => ipcRenderer.invoke('kanban:get-cards', columnId),
        createCard: (payload) => ipcRenderer.invoke('kanban:create-card', payload),
        updateCard: (cardId, payload) => ipcRenderer.invoke('kanban:update-card', cardId, payload),
        deleteCard: (cardId) => ipcRenderer.invoke('kanban:delete-card', cardId),
        updateCardPositions: (positionUpdates) => ipcRenderer.invoke('kanban:update-card-positions', positionUpdates),
        getAttachments: (cardId) => ipcRenderer.invoke('kanban:get-attachments', cardId),
        addAttachment: (payload) => ipcRenderer.invoke('kanban:add-attachment', payload),
        removeAttachment: (payload) => ipcRenderer.invoke('kanban:remove-attachment', payload),
        openAttachment: (payload) => ipcRenderer.invoke('kanban:open-attachment', payload)
    },
    workspace: {
        getWorkspaces: () => ipcRenderer.invoke('workspace:get-workspaces'),
        createWorkspace: (payload) => ipcRenderer.invoke('workspace:create-workspace', payload),
        updateWorkspace: (payload) => ipcRenderer.invoke('workspace:update-workspace', payload),
        deleteWorkspace: (id) => ipcRenderer.invoke('workspace:delete-workspace', id),
        getTokenLedger: () => ipcRenderer.invoke('workspace:get-token-ledger'),
        flushTokenLedger: (payload) => ipcRenderer.invoke('workspace:flush-token-ledger', payload),
        getLastFlushTimestamp: () => ipcRenderer.invoke('workspace:get-last-flush-timestamp')
    },
    architecture: {
        getAllDocs: () => ipcRenderer.invoke('architecture:getAllDocs'),
        searchDocs: (docType, query) => ipcRenderer.invoke('architecture:searchDocs', docType, query), 
        createDoc: (title, docType) => ipcRenderer.invoke('architecture:createDoc', title, docType),
        cloneDoc: (sourceDocId, newTitle, newDocType) => ipcRenderer.invoke('architecture:cloneDoc', sourceDocId, newTitle, newDocType),   
        getDoc: (docId) => ipcRenderer.invoke('architecture:getDoc', docId),
        updateDoc: (docId, content) => ipcRenderer.invoke('architecture:updateDoc', docId, content),
        deleteDoc: (docId) => ipcRenderer.invoke('architecture:deleteDoc', docId), 
        getHistory: (docId) => ipcRenderer.invoke('architecture:getHistory', docId),
        getVersion: (versionId) => ipcRenderer.invoke('architecture:getVersion', versionId),
        deleteVersion: (versionId) => ipcRenderer.invoke('architecture:deleteVersion', versionId)
    },
    compressor: {
        getWorkspaceTree: (payload) => ipcRenderer.invoke('compressor:get-workspace-tree', payload),
        readFile: (targetPath) => ipcRenderer.invoke('compressor:read-file', targetPath)
    },
    integrator: {
        executePayload: (payload) => ipcRenderer.invoke('integrator:execute-payload', payload)
    },
    visualizer: {
        fetchCodebaseTree: (payload) => ipcRenderer.invoke('gossip:fetch-codebase-tree', payload),
        fetchSchemaTree: (payload) => ipcRenderer.invoke('gossip:fetch-schema-tree', payload)
    }
});