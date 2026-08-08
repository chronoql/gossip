/**
 * Project: Chronoql Gossip
 * Module: Workspace Administration Renderer
 * Phase: 8 (Multi-Project Hub & Telemetry)
 */

window.initWorkspaceAdmin = async function() {
    console.log('[Workspace Admin] Booting Administration & Telemetry Hub...');

    let workspaces = [];
    let ledgerData = [];
    let activeChartType = 'grouped';
    let activeFilter = 'production';

    const cardMount = document.getElementById('workspace-card-mount');
    const inputMaxTokens = document.getElementById('env-max-tokens');
    const readoutMaxTokens = document.getElementById('readout-max-tokens');
    const inputTokenRatio = document.getElementById('env-token-ratio');
    const chartTypeSelector = document.getElementById('chart-type-selector');
    const chartFilterSelector = document.getElementById('chart-filter-selector');
    const chartMount = document.getElementById('d3-roi-chart-mount');
    const btnAddWorkspace = document.getElementById('btn-add-workspace');
    const btnFlushLedger = document.getElementById('btn-flush-ledger');

    const colors = { consumed: '#ef4444', payloadSavings: '#38bdf8', sessionSavings: '#10b981' };

    if (chartTypeSelector) {
        chartTypeSelector.value = activeChartType;
    }

    // ==========================================
    // MANUAL TELEMETRY SYNC
    // ==========================================
    async function flushTelemetryToDatabase() {
        const activeId = localStorage.getItem('chronoql-active-workspace-id');
        
        if (!activeId) {
            console.warn("[Workspace Admin] No active workspace selected for telemetry sync.");
            return;
        }

        const consumed = parseInt(localStorage.getItem('chronoql-token-delta-consumed') || '0', 10);
        const payload = parseInt(localStorage.getItem('chronoql-token-delta-payload') || '0', 10);
        const session = parseInt(localStorage.getItem('chronoql-token-delta-session') || '0', 10);

        if (consumed === 0 && payload === 0 && session === 0) {
            if (btnFlushLedger) {
                const originalHtml = btnFlushLedger.innerHTML;
                btnFlushLedger.innerHTML = 'Already up to date';
                setTimeout(() => btnFlushLedger.innerHTML = originalHtml, 2000);
            }
            return;
        }

        try {
            if (btnFlushLedger) {
                btnFlushLedger.disabled = true;
                btnFlushLedger.innerHTML = 'Syncing...';
            }

            const syncTimestamp = new Date().toISOString();
            
            if (window.api && window.api.workspace) {
                await window.api.workspace.flushTokenLedger({
                    workspaceId: activeId,
                    consumed: consumed,
                    payload: payload,
                    session: session,
                    timestamp: syncTimestamp
                });
            }

            localStorage.setItem('chronoql-token-delta-consumed', '0');
            localStorage.setItem('chronoql-token-delta-payload', '0');
            localStorage.setItem('chronoql-token-delta-session', '0');
            localStorage.setItem('chronoql-last-flush-timestamp', syncTimestamp);

            await loadAdminData();

            if (btnFlushLedger) {
                btnFlushLedger.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: -2px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Synced!`;
                setTimeout(() => {
                    btnFlushLedger.disabled = false;
                    btnFlushLedger.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: -2px;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg> Sync Telemetry`;
                }, 2000);
            }
        } catch (err) {
            console.error("[Workspace Admin] Failed to flush telemetry:", err);
            if (btnFlushLedger) {
                btnFlushLedger.disabled = false;
                btnFlushLedger.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: -2px;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg> Sync Telemetry`;
            }
        }
    }

    if (btnFlushLedger) {
        btnFlushLedger.addEventListener('click', flushTelemetryToDatabase);
    }

    async function loadAdminData() {
        workspaces = [];
        ledgerData = [];
        
        if (window.api && window.api.workspace) {
            try {
                const localTimestamp = localStorage.getItem('chronoql-last-flush-timestamp');
                const dbTimestamp = await window.api.workspace.getLastFlushTimestamp();
                if (localTimestamp && dbTimestamp && localTimestamp !== dbTimestamp) {
                    console.warn('[Workspace Admin] Local cache out of sync with DB flush.');
                }
                workspaces = await window.api.workspace.getWorkspaces();
                ledgerData = await window.api.workspace.getTokenLedger();
            } catch (e) {
                console.error('[Workspace Admin] Failed to load DB data:', e);
            }
        } else {
            console.warn('[Workspace Admin] IPC API not found. Running in empty UI mode.');
        }
        
        renderWorkspaceCards();
        initEnvironmentControls();
        renderD3Chart();
    }

    // ==========================================
    // TIER 1: WORKSPACE ORCHESTRATION
    // ==========================================

    function renderWorkspaceCards() {
        cardMount.innerHTML = '';
        
        let renderableWorkspaces = workspaces;
        if (workspaces.length > 1) {
            renderableWorkspaces = workspaces.filter(ws => ws.id !== 'ws-master-01');
        }

        let currentActiveId = localStorage.getItem('chronoql-active-workspace-id');
        if (!currentActiveId || (currentActiveId === 'ws-master-01' && renderableWorkspaces.length > 0 && renderableWorkspaces[0].id !== 'ws-master-01')) {
            if (renderableWorkspaces.length > 0) {
                currentActiveId = renderableWorkspaces[0].id;
                localStorage.setItem('chronoql-active-workspace-id', currentActiveId);
            }
        }

        renderableWorkspaces.forEach(ws => {
            const card = document.createElement('div');
            card.className = `workspace-card ${ws.id === currentActiveId ? 'active-workspace' : ''}`;
            const numFormatter = new Intl.NumberFormat('en-US');
            
            const menuHtml = ws.id !== 'ws-master-01' ? `
                <div class="card-context-trigger" data-id="${ws.id}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                </div>
            ` : '';

            card.innerHTML = `
                <div class="card-badge badge-${ws.class}">${ws.class}</div>
                ${menuHtml}
                <h3>${escapeHtml(ws.name)}</h3>
                <div class="workspace-path">${escapeHtml(ws.path)}</div>
                <div class="workspace-metrics">
                    <span class="metric-label">Total Consumed</span>
                    <span class="metric-value">${numFormatter.format(ws.consumed)}</span>
                </div>
            `;

            // ARCHITECTURAL UPDATE: Ensure the Schema Path is synced when clicking a different workspace card
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-context-trigger') || e.target.closest('.ws-context-menu')) return;

                localStorage.setItem('chronoql-active-workspace-id', ws.id);
                
                // If the backend has returned the schema path for this workspace, update the global local storage key
                if (ws.schemaPath) {
                    localStorage.setItem('chronoql-workspace-schema-path', ws.schemaPath);
                }

                document.querySelectorAll('.workspace-card').forEach(c => c.classList.remove('active-workspace'));
                card.classList.add('active-workspace');
                window.dispatchEvent(new CustomEvent('gossip:workspace-changed', {
                    detail: { workspaceId: ws.id, name: ws.name }
                }));
            });

            const trigger = card.querySelector('.card-context-trigger');
            if (trigger) {
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    document.querySelectorAll('.ws-context-menu').forEach(m => m.remove());

                    const menu = document.createElement('div');
                    menu.className = 'ws-context-menu';
                    menu.innerHTML = `
                        <button class="ws-menu-btn" data-action="edit">Edit Project</button>
                        <button class="ws-menu-btn text-danger" data-action="delete">Delete Project</button>
                    `;

                    menu.style.cssText = `
                        position: absolute; top: 40px; right: 10px; background: var(--surface-color);
                        border: 1px solid var(--border-color); border-radius: 8px; z-index: 100;
                        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); display: flex; flex-direction: column;
                        padding: 4px; min-width: 140px;
                    `;

                    card.appendChild(menu);

                    menu.querySelector('[data-action="edit"]').addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        menu.remove();
                        createWorkspaceModal(ws).then(async (result) => {
                            if (result && window.api && window.api.workspace) {
                                const res = await window.api.workspace.updateWorkspace({ id: ws.id, ...result });
                                if (res.success) {
                                    if (localStorage.getItem('chronoql-active-workspace-id') === ws.id) {
                                        window.dispatchEvent(new CustomEvent('gossip:workspace-changed', {
                                            detail: { workspaceId: ws.id, name: result.name }
                                        }));
                                    }
                                    await loadAdminData();
                                }
                                else alert('Failed to update workspace: ' + res.error);
                            }
                        });
                    });

                    menu.querySelector('[data-action="delete"]').addEventListener('click', async (ev) => {
                        ev.stopPropagation();
                        menu.remove();
                        if (confirm(`Are you sure you want to delete "${ws.name}"?\nThis will permanently destroy its telemetry history. Your files on disk will not be affected.`)) {
                            if (window.api && window.api.workspace) {
                                const res = await window.api.workspace.deleteWorkspace(ws.id);
                                if (res.success) {
                                    if (localStorage.getItem('chronoql-active-workspace-id') === ws.id) {
                                        localStorage.removeItem('chronoql-active-workspace-id');
                                        localStorage.removeItem('chronoql-workspace-schema-path'); // Clean up mapping
                                    }
                                    await loadAdminData();
                                } else {
                                    alert('Failed to delete workspace: ' + res.error);
                                }
                            }
                        }
                    });

                    const closeMenu = () => { menu.remove(); document.removeEventListener('click', closeMenu); };
                    document.addEventListener('click', closeMenu);
                });
            }

            cardMount.appendChild(card);
        });
        
        if (renderableWorkspaces.length === 0) {
            cardMount.innerHTML = `
                <div style="width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; color: var(--text-muted);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.5;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                    <h3 style="margin: 0 0 8px 0; color: var(--text-color); font-size: 16px;">No Projects Initialized</h3>
                    <p style="margin: 0; font-size: 13px; font-style: italic;">Click "Initialize Project" above to create your first workspace.</p>
                </div>
            `;
        }
    }

    if (btnAddWorkspace) {
        btnAddWorkspace.addEventListener('click', () => {
            createWorkspaceModal().then(async (result) => {
                if (result && window.api && window.api.workspace) {
                    const res = await window.api.workspace.createWorkspace(result);
                    if (res.success) {
                        localStorage.setItem('chronoql-active-workspace-id', res.id);
                        window.dispatchEvent(new CustomEvent('gossip:workspace-changed', {
                            detail: { workspaceId: res.id, name: result.name }
                        }));
                        await loadAdminData(); 
                    }
                    else alert('Failed to initialize workspace: ' + res.error);
                }
            });
        });
    }

    function createWorkspaceModal(existingData = null) {
        return new Promise((resolve) => {
            const isEdit = !!existingData;
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background-color: rgba(0, 0, 0, 0.6); backdrop-filter: blur(2px);
                z-index: 9999; display: flex; align-items: center; justify-content: center;
                animation: fadeIn 0.2s ease-out;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background-color: var(--surface-color); padding: 24px; border-radius: 12px;
                width: 480px; border: 1px solid var(--border-color);
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
                display: flex; flex-direction: column; gap: 16px;
                max-height: 90vh; overflow-y: auto;
            `;

            const title = document.createElement('h3');
            title.textContent = isEdit ? 'Edit Workspace' : 'Initialize New Workspace';
            title.style.cssText = 'margin: 0; color: var(--text-color); font-size: 16px;';

            // 1. Project Name Input
            const nameGroup = document.createElement('div');
            nameGroup.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
            const nameLabel = document.createElement('label');
            nameLabel.textContent = 'Project Name';
            nameLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;';
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = isEdit ? existingData.name : '';
            nameInput.placeholder = 'e.g., Quantum Engine Engine';
            nameInput.style.cssText = `
                padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border-color);
                background-color: var(--bg-color); color: var(--text-color); outline: none;
            `;
            nameGroup.appendChild(nameLabel); nameGroup.appendChild(nameInput);

            // Helper to generate consistent path picker groups
            const createPathPicker = (labelText, placeholder, initialValue, isFilePicker) => {
                const group = document.createElement('div');
                group.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
                
                const label = document.createElement('label');
                label.textContent = labelText;
                label.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;';
                
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'display: flex; gap: 8px;';
                
                const input = document.createElement('input');
                input.type = 'text';
                input.value = initialValue || '';
                input.placeholder = placeholder;
                input.style.cssText = `
                    flex: 1; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border-color);
                    background-color: var(--bg-color); color: var(--text-color); outline: none;
                `;
                
                const btn = document.createElement('button');
                btn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    Browse
                `;
                btn.style.cssText = `
                    display: flex; align-items: center; gap: 6px; padding: 0 16px; 
                    background-color: var(--bg-color); border: 1px solid var(--border-color);
                    color: var(--text-color); border-radius: 6px; cursor: pointer; font-weight: 600;
                    transition: background-color 0.2s, border-color 0.2s;
                `;
                
                btn.onmouseover = () => btn.style.borderColor = 'var(--accent-color)';
                btn.onmouseout = () => btn.style.borderColor = 'var(--border-color)';
                
                btn.onclick = async () => {
                    if (isFilePicker) {
                        if (window.api && window.api.system && window.api.system.selectFile) {
                            const resultPath = await window.api.system.selectFile();
                            if (resultPath) input.value = resultPath;
                        }
                    } else {
                        if (window.api && window.api.system && window.api.system.selectDirectory) {
                            const resultPath = await window.api.system.selectDirectory();
                            if (resultPath) input.value = resultPath;
                        }
                    }
                };
                
                wrapper.appendChild(input); 
                wrapper.appendChild(btn);
                group.appendChild(label);
                group.appendChild(wrapper);
                
                return { group, input };
            };

            // 2. Root Directory Picker
            const rootPathGroup = createPathPicker(
                'Open Source Code Folder', 
                'e.g., /Users/dev/project', 
                isEdit ? existingData.path : '',
                false
            );

            // 3. Codebase XML Picker
            const codebasePathGroup = createPathPicker(
                'Codebase Manifest Path (codebase.xml)', 
                'e.g., /Users/dev/project/codebase.xml', 
                isEdit ? existingData.codebasePath : '',
                true
            );

            // 4. Schema SQL Picker
            const schemaPathGroup = createPathPicker(
                'Schema Init Path (master-schema-init.sql)', 
                'e.g., /Users/dev/project/master-schema-init.sql', 
                isEdit ? existingData.schemaPath : '',
                true
            );

            // 5. Classification Dropdown
            const classGroup = document.createElement('div');
            classGroup.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
            const classLabel = document.createElement('label');
            classLabel.textContent = 'Classification';
            classLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;';
            const classSelect = document.createElement('select');
            classSelect.innerHTML = `
                <option value="sandbox">Sandbox (Testing / Exploration)</option>
                <option value="production">Production (Official Project)</option>
            `;
            if (isEdit) classSelect.value = existingData.class || existingData.classification;
            
            classSelect.style.cssText = `
                padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border-color);
                background-color: var(--bg-color); color: var(--text-color); outline: none; cursor: pointer;
            `;
            classGroup.appendChild(classLabel); classGroup.appendChild(classSelect);

            // Action Buttons
            const btnGroup = document.createElement('div');
            btnGroup.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;';
            const btnCancel = document.createElement('button');
            btnCancel.textContent = 'Cancel';
            btnCancel.style.cssText = 'padding: 8px 16px; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-weight: 600;';
            const btnSubmit = document.createElement('button');
            btnSubmit.textContent = isEdit ? 'Save Changes' : 'Initialize';
            btnSubmit.style.cssText = 'padding: 8px 16px; background-color: var(--accent-color); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';

            const closeModal = (val) => { document.body.removeChild(overlay); resolve(val); };
            
            btnCancel.onclick = () => closeModal(null);
            
            // ARCHITECTURAL UPDATE: Save the absolute schema path directly to localStorage
            btnSubmit.onclick = () => {
                if (!nameInput.value.trim() || !rootPathGroup.input.value.trim()) return;
                
                const finalSchemaPath = schemaPathGroup.input.value.trim();
                if (finalSchemaPath) {
                    localStorage.setItem('chronoql-workspace-schema-path', finalSchemaPath);
                }

                closeModal({ 
                    name: nameInput.value.trim(), 
                    path: rootPathGroup.input.value.trim(),
                    codebasePath: codebasePathGroup.input.value.trim(),
                    schemaPath: finalSchemaPath,
                    classification: classSelect.value 
                });
            };

            btnGroup.appendChild(btnCancel); btnGroup.appendChild(btnSubmit);
            
            // Assemble Modal
            modal.append(
                title, 
                nameGroup, 
                rootPathGroup.group, 
                codebasePathGroup.group, 
                schemaPathGroup.group, 
                classGroup, 
                btnGroup
            );
            
            overlay.appendChild(modal); 
            document.body.appendChild(overlay);
            
            setTimeout(() => nameInput.focus(), 50);
        });
    }

    // ==========================================
    // TIER 2: ENVIRONMENT VARIABLES
    // ==========================================
    
    function initEnvironmentControls() {
        const numFormatter = new Intl.NumberFormat('en-US');
        const savedMax = localStorage.getItem('chronoql-env-max-tokens') || '128000';
        inputMaxTokens.value = savedMax;
        readoutMaxTokens.textContent = numFormatter.format(savedMax);

        inputMaxTokens.addEventListener('input', (e) => {
            readoutMaxTokens.textContent = numFormatter.format(e.target.value);
        });

        inputMaxTokens.addEventListener('change', (e) => {
            localStorage.setItem('chronoql-env-max-tokens', e.target.value);
            window.dispatchEvent(new CustomEvent('gossip:environment-updated'));
        });

        const savedRatio = localStorage.getItem('chronoql-env-token-ratio') || '4.0';
        inputTokenRatio.value = savedRatio;

        inputTokenRatio.addEventListener('change', (e) => {
            localStorage.setItem('chronoql-env-token-ratio', e.target.value);
            window.dispatchEvent(new CustomEvent('gossip:environment-updated'));
        });
    }

    // ==========================================
    // TIER 3: D3 CHARTING ENGINE
    // ==========================================

    chartTypeSelector.addEventListener('change', (e) => {
        activeChartType = e.target.value;
        renderD3Chart();
    });

    chartFilterSelector.addEventListener('change', (e) => {
        activeFilter = e.target.value;
        renderD3Chart();
    });

    function renderD3Chart() {
        if (!chartMount) return;
        chartMount.innerHTML = '';
        
        let filteredData = ledgerData;
        if (activeFilter !== 'all') {
            filteredData = ledgerData.filter(d => d.classification === activeFilter);
        }
        
        if (!filteredData || filteredData.length === 0) {
            chartMount.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.5;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    <p style="margin: 0; font-size: 13px; font-style: italic;">No telemetry data available.</p>
                </div>
            `;
            return;
        }

        if (!window.d3) {
            console.error("[Workspace Admin] D3 is not loaded.");
            return;
        }

        const aggregated = Array.from(d3.rollup(
            filteredData,
            v => ({
                consumed: d3.sum(v, d => d.consumed),
                payloadSavings: d3.sum(v, d => d.payloadSavings),
                sessionSavings: d3.sum(v, d => d.sessionSavings)
            }),
            d => d.period
        )).map(([period, data]) => ({ period, ...data }));

        const formattedData = filteredData.map(d => {
            const rawDate = d.timestamp || d.created_at || new Date().toISOString();
            const dObj = new Date(rawDate);
            return {
                ...d,
                sortKey: rawDate.split('T')[0],
                displayDate: dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) 
            };
        });

        const chronologicalData = Array.from(d3.rollup(
            formattedData,
            v => ({
                consumed: d3.sum(v, d => d.consumed),
                payloadSavings: d3.sum(v, d => d.payloadSavings),
                sessionSavings: d3.sum(v, d => d.sessionSavings),
                period: v[0].displayDate
            }),
            d => d.sortKey
        ))
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([sortKey, data]) => ({ ...data })); 

        const subgroups = ['consumed', 'payloadSavings', 'sessionSavings'];
        const labels = { consumed: 'Tokens Consumed', payloadSavings: 'Payload Savings', sessionSavings: 'Session Savings' };
        
        const legendDiv = document.createElement('div');
        legendDiv.style.cssText = 'display: flex; justify-content: center; gap: 24px; margin-bottom: 16px; flex-wrap: wrap; padding-top: 8px;';
        
        subgroups.forEach(key => {
            const item = document.createElement('div');
            item.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-color); font-weight: 500;';
            item.innerHTML = `
                <div style="width: 12px; height: 12px; border-radius: 3px; background-color: ${colors[key]};"></div>
                <span>${labels[key]}</span>
            `;
            legendDiv.appendChild(item);
        });
        
        chartMount.appendChild(legendDiv);

        const boxWidth = chartMount.clientWidth || 600;
        const boxHeight = chartMount.clientHeight || 400;

        const margin = { top: 10, right: 30, bottom: 40, left: 60 };
        const width = Math.max(100, boxWidth - 48 - margin.left - margin.right);
        const height = Math.max(100, boxHeight - 48 - margin.top - margin.bottom - 32);

        const svg = d3.select(chartMount).append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        const x0 = d3.scaleBand()
            .domain(chronologicalData.map(d => d.period))
            .rangeRound([0, width])
            .paddingInner(0.1);

        const yMax = d3.max(chronologicalData, d => activeChartType === 'stacked' 
            ? d.consumed + d.payloadSavings + d.sessionSavings 
            : Math.max(d.consumed, d.payloadSavings, d.sessionSavings));

        const y = d3.scaleLinear()
            .domain([0, yMax || 1]).nice()
            .rangeRound([height, 0]);

        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y)
                .tickSize(-width)
                .tickFormat("")
            );

        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x0));

        svg.append('g')
            .call(d3.axisLeft(y).tickFormat(d3.format(".2s")));

        const tooltip = d3.select(chartMount).append("div").attr("class", "chart-tooltip");
        const numFormatter = new Intl.NumberFormat('en-US');

        if (activeChartType === 'stacked') {
            const stackedData = d3.stack().keys(subgroups)(chronologicalData);
            
            svg.append("g")
                .selectAll("g")
                .data(stackedData)
                .enter().append("g")
                .attr("fill", d => colors[d.key])
                .selectAll("rect")
                .data(d => d)
                .enter().append("rect")
                .attr("x", d => x0(d.data.period))
                .attr("y", height)
                .attr("height", 0)
                .attr("width", x0.bandwidth())
                .on("mouseover", function(event, d) {
                    const key = d3.select(this.parentNode).datum().key;
                    const val = d.data[key];
                    d3.select(this).attr("opacity", 0.8);
                    tooltip.style("opacity", 1)
                        .html(`
                            <div class="tooltip-title">${d.data.period} - ${labels[key]}</div>
                            <div class="tooltip-row"><span>Amount:</span> <strong>${numFormatter.format(val)}</strong></div>
                        `)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    d3.select(this).attr("opacity", 1);
                    tooltip.style("opacity", 0);
                })
                .transition().duration(800)
                .attr("y", d => y(d[1]))
                .attr("height", d => y(d[0]) - y(d[1]));

        } else if (activeChartType === 'grouped') {
            const x1 = d3.scaleBand()
                .domain(subgroups)
                .rangeRound([0, x0.bandwidth()])
                .padding(0.05);

            svg.append("g")
                .selectAll("g")
                .data(chronologicalData)
                .enter().append("g")
                .attr("transform", d => `translate(${x0(d.period)},0)`)
                .selectAll("rect")
                .data(d => subgroups.map(key => ({key, value: d[key], period: d.period})))
                .enter().append("rect")
                .attr("x", d => x1(d.key))
                .attr("y", height)
                .attr("width", x1.bandwidth())
                .attr("height", 0)
                .attr("fill", d => colors[d.key])
                .on("mouseover", function(event, d) {
                    d3.select(this).attr("opacity", 0.8);
                    tooltip.style("opacity", 1)
                        .html(`
                            <div class="tooltip-title">${d.period} - ${labels[d.key]}</div>
                            <div class="tooltip-row"><span>Amount:</span> <strong>${numFormatter.format(d.value)}</strong></div>
                        `)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    d3.select(this).attr("opacity", 1);
                    tooltip.style("opacity", 0);
                })
                .transition().duration(800)
                .attr("y", d => y(d.value))
                .attr("height", d => height - y(d.value));

        } else if (activeChartType === 'line') {
            subgroups.forEach((key, index) => {
                const xOffset = (index - 1) * 6;

                const line = d3.line()
                    .x(d => x0(d.period) + x0.bandwidth() / 2 + xOffset)
                    .y(d => y(d[key]))
                    .curve(d3.curveMonotoneX);

                const path = svg.append("path")
                    .datum(chronologicalData)
                    .attr("fill", "none")
                    .attr("stroke", colors[key])
                    .attr("stroke-width", 3)
                    .attr("d", line);
                    
                const length = path.node().getTotalLength();
                path.attr("stroke-dasharray", length + " " + length)
                    .attr("stroke-dashoffset", length)
                    .transition().duration(800)
                    .attr("stroke-dashoffset", 0);

                svg.selectAll(`.dot-${key}`)
                    .data(chronologicalData)
                    .enter().append("circle")
                    .attr("class", `dot-${key}`)
                    .attr("cx", d => x0(d.period) + x0.bandwidth() / 2 + xOffset)
                    .attr("cy", d => y(d[key]))
                    .attr("r", 5)
                    .attr("fill", colors[key])
                    .attr("stroke", "var(--bg-color)")
                    .attr("stroke-width", 2)
                    .style("opacity", 0)
                    .on("mouseover", function(event, d) {
                        d3.select(this).attr("r", 7);
                        tooltip.style("opacity", 1)
                            .html(`
                                <div class="tooltip-title">${d.period} - ${labels[key]}</div>
                                <div class="tooltip-row"><span>Amount:</span> <strong>${numFormatter.format(d[key])}</strong></div>
                            `)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 28) + "px");
                    })
                    .on("mouseout", function() {
                        d3.select(this).attr("r", 5);
                        tooltip.style("opacity", 0);
                    })
                    .transition().delay(800).duration(200)
                    .style("opacity", 1);
            });
        }
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe).replace(/&/g, "&lt;").replace(/>/g, "&gt;");
    }

    window.addEventListener('gossip:module-resumed', (e) => {
        if (e.detail.viewTarget === 'workspace-admin') {
            loadAdminData();
        }
    });

    if (chartMount) {
        const resizeObserver = new ResizeObserver(() => {
            clearTimeout(window.adminResizeTimer);
            window.adminResizeTimer = setTimeout(renderD3Chart, 100);
        });
        resizeObserver.observe(chartMount);
    }

    // ==========================================
    // LIFECYCLE HANDSHAKE
    // ==========================================
    if (window.api && window.api.system && window.api.system.onAppQuitting) {
        window.api.system.onAppQuitting(async () => {
            console.log('[Workspace Admin] Teardown signal received. Running final flush...');
            
            const consumed = parseInt(localStorage.getItem('chronoql-token-delta-consumed') || '0', 10);
            const payload = parseInt(localStorage.getItem('chronoql-token-delta-payload') || '0', 10);
            const session = parseInt(localStorage.getItem('chronoql-token-delta-session') || '0', 10);
            
            if (consumed > 0 || payload > 0 || session > 0) {
                 await flushTelemetryToDatabase();
            }
            
            window.api.system.confirmTeardown();
        });
    }

    loadAdminData();
};