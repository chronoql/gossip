/**
 * Chronoql Gossip: Data Management Renderer
 * Orchestrates the UI logic for system backups, workspace rollbacks, JSON exports, and factory resets.
 */

(() => {
    let elements = {};

    // ==========================================
    // NATIVE AUDIO SYNTHESIS (No external assets required)
    // ==========================================
    const playCameraShutter = () => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            const createMechanicalClick = (startTime, duration, freq, qValue) => {
                const bufferSize = audioCtx.sampleRate * duration;
                const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                
                // Generate raw white noise
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noiseSource = audioCtx.createBufferSource();
                noiseSource.buffer = buffer;

                // Bandpass filter to create the metallic/plastic mechanical resonance
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = freq;
                filter.Q.value = qValue;

                // Sharp attack and rapid decay for the percussive click
                const gainNode = audioCtx.createGain();
                gainNode.gain.setValueAtTime(0, startTime);
                // Slightly slower attack (0.02) for heavier mechanical parts
                gainNode.gain.linearRampToValueAtTime(1.5, startTime + 0.02);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

                noiseSource.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                noiseSource.start(startTime);
            };

            // Hasselblad medium format mechanical signature (Rolled Overlap)
            createMechanicalClick(audioCtx.currentTime, 0.18, 1200, 1.0);        // "Ker" - Extended tail for blending
            createMechanicalClick(audioCtx.currentTime + 0.14, 0.35, 450, 1.2);  // "Chuck" - Overlaps to roll the mechanics together

        } catch (e) {
            console.warn('[Data Management] Audio context failed to boot for shutter sound:', e);
        }
    };

    window.initDataManagementSystem = async () => {
        console.log('[Data Management] Module registered and awaiting user orchestration.');
    };

    window.loadDataManagement = async () => {
        const dynamicStage = document.getElementById('dynamic-stage');
        const mainStageTitle = document.getElementById('macro-view-title');
        const mount = document.getElementById('data-management-mount');

        mainStageTitle.innerText = 'Data Management & Backups';

        if (mount && mount.innerHTML) {
            dynamicStage.innerHTML = mount.innerHTML;
        } else {
            dynamicStage.innerHTML = `<div class="empty-state-container"><p>Failed to mount Data Management orchestration module.</p></div>`;
            return;
        }

        elements = {
            btnCreateBackup: dynamicStage.querySelector('#btn-create-backup'),
            btnImportData: dynamicStage.querySelector('#btn-import-data'),
            btnExportKanban: dynamicStage.querySelector('#btn-export-kanban'),
            btnImportKanbanCard: dynamicStage.querySelector('#btn-import-kanban-card'),
            btnFactoryReset: dynamicStage.querySelector('#btn-factory-reset'),
            btnImportSnapshot: dynamicStage.querySelector('#btn-import-snapshot'),
            
            backupList: dynamicStage.querySelector('#backup-list'),
            backupEmptyState: dynamicStage.querySelector('#backup-empty-state'),
            
            workspaceBackupList: dynamicStage.querySelector('#workspace-backup-list'),
            workspaceBackupEmptyState: dynamicStage.querySelector('#workspace-backup-empty-state')
        };

        bindDataEvents();
        await refreshSnapshotList();
        await refreshWorkspaceSnapshotList(); 
    };

    function bindDataEvents() {
        
        // --- Header Actions ---
        
        if (elements.btnCreateBackup) {
            elements.btnCreateBackup.addEventListener('click', async () => {
                elements.btnCreateBackup.disabled = true;
                elements.btnCreateBackup.textContent = 'Generating...';
                
                try {
                    const result = await window.api.data.createSnapshot();
                    await refreshSnapshotList();
                    
                    playCameraShutter(); // Trigger the Hasselblad mechanical shutter audio cue
                    
                    // We use a 600ms timeout to let the heavy, slow shutter sound completely finish 
                    // before the native browser alert freezes the main execution thread.
                    setTimeout(() => {
                        alert(`System Snapshot Successfully Generated.\n\nSaved to location:\n${result.filepath}`);
                    }, 600);
                } catch (err) {
                    console.error('[Data Management] Failed to create snapshot:', err);
                    alert('Failed to generate system snapshot. Check Developer Console.');
                } finally {
                    elements.btnCreateBackup.disabled = false;
                    elements.btnCreateBackup.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Create Snapshot`;
                }
            });
        }

        if (elements.btnImportData) {
            elements.btnImportData.addEventListener('click', executeJsonImport);
        }

        // --- Database Card Actions ---

        if (elements.btnImportSnapshot) {
            elements.btnImportSnapshot.addEventListener('click', async () => {
                try {
                    const result = await window.api.data.importSnapshot();
                    if (result && result.success) {
                        await refreshSnapshotList();
                    } else if (result && result.error) {
                        throw new Error(result.error);
                    }
                } catch (err) {
                    console.error('[Data Management] Import external snapshot failed:', err);
                    alert(`Failed to import database snapshot: ${err.message}`);
                }
            });
        }

        // --- JSON Import & Export Actions ---

        if (elements.btnExportKanban) {
            elements.btnExportKanban.addEventListener('click', async () => {
                try {
                    const result = await window.api.data.exportKanbanData();
                    if (result && result.success) {
                        playCameraShutter(); // Trigger the Hasselblad mechanical shutter audio cue
                        
                        // We use a 600ms timeout to let the heavy, slow shutter sound completely finish 
                        // before the native browser alert freezes the main execution thread.
                        setTimeout(() => {
                            alert(`Kanban boards successfully exported to:\n${result.path}`);
                        }, 600);
                    }
                } catch (err) {
                    if (err.message !== 'Export cancelled') {
                        console.error('[Data Management] Export Kanban failed:', err);
                        alert('Failed to export Kanban data.');
                    }
                }
            });
        }

        if (elements.btnImportKanbanCard) {
            elements.btnImportKanbanCard.addEventListener('click', executeJsonImport);
        }

        // --- Danger Zone ---

        if (elements.btnFactoryReset) {
            elements.btnFactoryReset.addEventListener('click', async () => {
                const confirmed1 = confirm('WARNING: You are about to initiate a Database Reset.\n\nThis will permanently destroy all Kanban boards and file attachments across the entire system.\n\nAre you absolutely sure you want to proceed?');
                if (!confirmed1) return;

                const confirmed2 = confirm('FINAL WARNING.\n\nThis action cannot be undone. Type "yes" if you wish to obliterate all data.');
                if (confirmed2) {
                    try {
                        const result = await window.api.data.executeFactoryReset();
                        if (result && result.success) {
                            alert('Factory Reset Complete. The application will now restart.');
                        }
                    } catch (err) {
                        console.error('[Data Management] Factory reset failed:', err);
                        alert('CRITICAL ERROR: Factory Reset failed. See developer console.');
                    }
                }
            });
        }
    }

    async function executeJsonImport() {
        try {
            const result = await window.api.data.importPayload();
            if (result && result.success) {
                alert('Kanban payload successfully imported and appended to your active boards.');
            } else if (result && result.error && result.error !== 'Import cancelled') {
                throw new Error(result.error);
            }
        } catch (err) {
            console.error('[Data Management] Import Payload failed:', err);
            alert(`Failed to import payload: ${err.message}`);
        }
    }

    // ==========================================
    // KANBAN DATABASE SNAPSHOT ORCHESTRATION
    // ==========================================
    async function refreshSnapshotList() {
        if (!elements.backupList || !elements.backupEmptyState) return;
        
        elements.backupList.innerHTML = '';
        
        try {
            const snapshots = await window.api.data.getSnapshots();
            
            if (!snapshots || snapshots.length === 0) {
                elements.backupEmptyState.style.display = 'block';
                elements.backupList.style.display = 'none';
                return;
            }

            elements.backupEmptyState.style.display = 'none';
            elements.backupList.style.display = 'flex';

            snapshots.sort((a, b) => b.timestamp - a.timestamp);

            snapshots.forEach(snap => {
                const li = document.createElement('li');
                li.className = 'data-list-item';
                
                const dateObj = new Date(snap.timestamp);
                
                // ARCHITECTURAL FIX: Dynamic local timezone detection
                const formattedDate = dateObj.toLocaleString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit', second: '2-digit',
                    timeZoneName: 'short'
                });

                const sizeMB = (snap.sizeBytes / (1024 * 1024)).toFixed(2);

                li.innerHTML = `
                    <div class="data-list-item-info">
                        <span class="data-list-item-title" title="${snap.filename}">${snap.filename}</span>
                        <span class="data-list-item-date">${formattedDate} • ${sizeMB} MB</span>
                    </div>
                    <div class="data-list-actions">
                        <button class="btn-secondary btn-small-action btn-restore" data-file="${snap.filename}">Restore</button>
                        <button class="btn-danger btn-small-action btn-delete" data-file="${snap.filename}">Delete</button>
                    </div>
                `;

                li.querySelector('.btn-restore').addEventListener('click', async (e) => {
                    const file = e.target.dataset.file;
                    if (confirm(`Are you sure you want to restore "${file}"?\n\nThis will completely overwrite your current active database and restart the application.`)) {
                        try {
                            await window.api.data.restoreSnapshot(file);
                        } catch (err) {
                            console.error('[Data Management] Restoration failed:', err);
                            alert('Restoration failed. See console for details.');
                        }
                    }
                });

                li.querySelector('.btn-delete').addEventListener('click', async (e) => {
                    const file = e.target.dataset.file;
                    if (confirm(`Delete snapshot "${file}" permanently?`)) {
                        try {
                            await window.api.data.deleteSnapshot(file);
                            await refreshSnapshotList();
                        } catch (err) {
                            console.error('[Data Management] Deletion failed:', err);
                        }
                    }
                });

                elements.backupList.appendChild(li);
            });

        } catch (err) {
            console.error('[Data Management] Failed to fetch snapshot roster:', err);
        }
    }

    // ==========================================
    // WORKSPACE ROLLBACK ORCHESTRATION
    // ==========================================
    async function refreshWorkspaceSnapshotList() {
        if (!elements.workspaceBackupList || !elements.workspaceBackupEmptyState) return;
        
        elements.workspaceBackupList.innerHTML = '';
        
        try {
            const response = await window.api.data.getWorkspaceSnapshots();
            const snapshots = response.success ? response.data : [];
            
            if (!snapshots || snapshots.length === 0) {
                elements.workspaceBackupEmptyState.style.display = 'block';
                elements.workspaceBackupList.style.display = 'none';
                return;
            }

            elements.workspaceBackupEmptyState.style.display = 'none';
            elements.workspaceBackupList.style.display = 'flex';

            snapshots.forEach(snap => {
                const li = document.createElement('li');
                li.className = 'data-list-item';
                
                const dateObj = new Date(snap.timestamp);
                
                // ARCHITECTURAL FIX: Dynamic local timezone detection
                const formattedDate = dateObj.toLocaleString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit', second: '2-digit',
                    timeZoneName: 'short'
                });

                li.innerHTML = `
                    <div class="data-list-item-info">
                        <span class="data-list-item-title" title="${snap.id}">${snap.id}</span>
                        <span class="data-list-item-date">${formattedDate} • ${snap.fileCount} file(s)</span>
                    </div>
                    <div class="data-list-actions">
                        <button class="btn-secondary btn-small-action btn-workspace-restore" data-id="${snap.id}">Restore</button>
                        <button class="btn-danger btn-small-action btn-workspace-delete" data-id="${snap.id}">Delete</button>
                    </div>
                `;

                li.querySelector('.btn-workspace-restore').addEventListener('click', async (e) => {
                    const id = e.target.dataset.id;
                    if (confirm(`Are you sure you want to restore workspace snapshot "${id}"?\n\nThis will instantly overwrite any local files modified by this specific Payload Integration.`)) {
                        try {
                            const res = await window.api.data.restoreWorkspaceSnapshot(id);
                            if (res.success) {
                                alert('Workspace rollback complete. Files safely restored to their original state.');
                            } else {
                                throw new Error(res.error);
                            }
                        } catch (err) {
                            console.error('[Data Management] Workspace restoration failed:', err);
                            alert(`Restoration failed: ${err.message}`);
                        }
                    }
                });

                li.querySelector('.btn-workspace-delete').addEventListener('click', async (e) => {
                    const id = e.target.dataset.id;
                    if (confirm(`Delete workspace snapshot "${id}" permanently?`)) {
                        try {
                            await window.api.data.deleteWorkspaceSnapshot(id);
                            await refreshWorkspaceSnapshotList();
                        } catch (err) {
                            console.error('[Data Management] Workspace deletion failed:', err);
                        }
                    }
                });

                elements.workspaceBackupList.appendChild(li);
            });

        } catch (err) {
            console.error('[Data Management] Failed to fetch workspace snapshot roster:', err);
        }
    }
})();