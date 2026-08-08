/**
 * Project: Chronoql Gossip
 * Module: Schema Visualizer Renderer
 * Phase: 7 (Visualization Modules - State Preservation)
 */

window.initSchemaVisualizer = async function() {
    console.log('[Schema Visualizer] Initializing visualization engine...');

    let currentActiveNode = null;
    let searchableTableNames = [];

    // ==========================================
    // DOM CACHING & RESIZERS
    // ==========================================
    const legendDrawer = document.getElementById('schema-legend-drawer');
    const btnToggleLegend = document.getElementById('btn-toggle-schema-legend');
    const btnCloseLegend = document.getElementById('btn-close-schema-legend');
    
    // Header Buttons
    const btnRefreshSchema = document.getElementById('btn-refresh-schema');
    const btnResetEdges = document.getElementById('btn-reset-schema'); 
    const btnRecenterView = document.getElementById('btn-recenter-schema-view'); 

    // Search Architecture elements
    const searchInput = document.getElementById('schema-search-input');
    const btnRegexToggle = document.getElementById('btn-schema-regex-toggle');
    const searchDropdown = document.getElementById('schema-search-dropdown');
    let dropdownActiveIndex = -1;
    let isRegexMode = false;

    // Restore cached Resizer Dimensions
    const savedLeftWidth = localStorage.getItem('chronoql-schema-left-width');
    if (savedLeftWidth) document.documentElement.style.setProperty('--schema-left-width', savedLeftWidth);
    
    const savedDdlHeight = localStorage.getItem('chronoql-schema-ddl-height');
    if (savedDdlHeight) document.documentElement.style.setProperty('--schema-top-height', savedDdlHeight);

    if (btnToggleLegend && legendDrawer) {
        btnToggleLegend.addEventListener('click', () => legendDrawer.classList.toggle('open'));
    }
    if (btnCloseLegend && legendDrawer) {
        btnCloseLegend.addEventListener('click', () => legendDrawer.classList.remove('open'));
    }
    
    if (btnResetEdges) {
        btnResetEdges.addEventListener('click', () => {
            const svg = d3.select('#d3-schema-tree-mount').select('svg');
            if (!svg.empty()) {
                resetSchemaEngine(svg.selectAll('.node'), svg.selectAll('.link'));
            }
        });
    }

    // ==========================================
    // AUDIO SYNTHESIS (Extracted for DDL Copy & Refresh)
    // ==========================================
    const playSuctionWhoosh = () => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const duration = 0.25;
            const bufferSize = audioCtx.sampleRate * duration;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noiseSource = audioCtx.createBufferSource();
            noiseSource.buffer = buffer;

            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(5000, audioCtx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + duration);

            const gainNode = audioCtx.createGain();
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(1.5, audioCtx.currentTime + 0.05); 
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration); 

            noiseSource.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            noiseSource.start();
        } catch (e) {
            console.warn('[Schema Visualizer] Audio context failed to boot:', e);
        }
    };

    if (btnRefreshSchema) {
        btnRefreshSchema.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
            
            const icon = btn.querySelector('svg');
            if (icon) {
                icon.style.transition = 'transform 0.4s ease-in-out';
                icon.style.transform = 'rotate(180deg)';
            }

            await renderSchemaTree();
            playSuctionWhoosh(); 
            
            if (icon) {
                setTimeout(() => {
                    icon.style.transition = 'none';
                    icon.style.transform = 'rotate(0deg)';
                }, 400);
            }
            
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        });
    }

    // ==========================================
    // SEARCH ARCHITECTURE
    // ==========================================
    
    if (btnRegexToggle) {
        btnRegexToggle.addEventListener('click', (e) => {
            e.preventDefault();
            isRegexMode = !isRegexMode;
            btnRegexToggle.setAttribute('data-active', isRegexMode ? 'true' : 'false');
            if (searchInput && searchInput.value.trim() !== '') {
                renderSearchDropdown(searchInput.value.trim());
            }
            if (searchInput) searchInput.focus();
        });
    }

    function closeSearchDropdown() {
        if (!searchDropdown) return;
        searchDropdown.style.display = 'none';
        searchDropdown.innerHTML = '';
        dropdownActiveIndex = -1;
    }

    function renderSearchDropdown(query) {
        if (!searchDropdown) return;
        
        searchDropdown.innerHTML = '';
        dropdownActiveIndex = -1;
        
        if (!query) {
            closeSearchDropdown();
            return;
        }

        let matches = [];

        if (isRegexMode) {
            try {
                const regex = new RegExp(query, 'i');
                matches = searchableTableNames.filter(name => regex.test(name));
            } catch (e) {
                searchDropdown.innerHTML = '<div class="dropdown-empty" style="color: #ef4444;">Invalid Regular Expression</div>';
                searchDropdown.style.display = 'flex';
                return;
            }
        } else {
            const lowerQuery = query.toLowerCase();
            matches = searchableTableNames.filter(name => name.toLowerCase().includes(lowerQuery));
        }

        if (matches.length === 0) {
            searchDropdown.innerHTML = '<div class="dropdown-empty">No tables found matching query.</div>';
            searchDropdown.style.display = 'flex';
            return;
        }

        matches.forEach((match, index) => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            
            let highlightedText = match;
            if (isRegexMode) {
                try {
                    const regex = new RegExp(`(${query})`, 'gi');
                    highlightedText = match.replace(regex, '<strong>$1</strong>');
                } catch(e) { }
            } else {
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedQuery})`, 'gi');
                highlightedText = match.replace(regex, '<strong>$1</strong>');
            }
            
            item.innerHTML = `<span class="shape-ref shape-circle" style="width: 12px; height: 12px; margin-right: 8px;"></span> <span>${highlightedText}</span>`;
            
            item.addEventListener('mouseenter', () => {
                const items = searchDropdown.querySelectorAll('.dropdown-item');
                items.forEach(el => el.classList.remove('focused'));
                item.classList.add('focused');
                dropdownActiveIndex = index;
            });

            item.addEventListener('click', () => {
                jumpToNodeByName(match);
                searchInput.value = ''; 
                closeSearchDropdown();
            });

            searchDropdown.appendChild(item);
        });

        searchDropdown.style.display = 'flex';
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderSearchDropdown(e.target.value.trim());
        });

        searchInput.addEventListener('focus', function() {
            this.select(); 
            if (this.value.trim().length > 0) {
                renderSearchDropdown(this.value.trim());
            }
        });
        
        document.addEventListener('click', (e) => {
            if (searchInput && searchDropdown && btnRegexToggle) {
                if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target) && !btnRegexToggle.contains(e.target)) {
                    closeSearchDropdown();
                }
            }
        });

        searchInput.addEventListener('keydown', (e) => {
            const items = searchDropdown ? searchDropdown.querySelectorAll('.dropdown-item') : [];
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (items.length > 0 && dropdownActiveIndex < items.length - 1) {
                    if (dropdownActiveIndex >= 0) items[dropdownActiveIndex].classList.remove('focused');
                    dropdownActiveIndex++;
                    items[dropdownActiveIndex].classList.add('focused');
                    items[dropdownActiveIndex].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (items.length > 0 && dropdownActiveIndex > 0) {
                    items[dropdownActiveIndex].classList.remove('focused');
                    dropdownActiveIndex--;
                    items[dropdownActiveIndex].classList.add('focused');
                    items[dropdownActiveIndex].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (dropdownActiveIndex >= 0 && items.length > 0) {
                    const targetSpan = items[dropdownActiveIndex].querySelector('span:not(.shape-ref)');
                    const targetName = targetSpan ? targetSpan.textContent : items[dropdownActiveIndex].textContent;
                    jumpToNodeByName(targetName);
                    searchInput.value = '';
                    closeSearchDropdown();
                    searchInput.blur();
                }
            } else if (e.key === 'Escape') {
                closeSearchDropdown();
                searchInput.blur();
            }
        });
    }

    function jumpToNodeByName(tableName) {
        const svg = d3.select('#d3-schema-tree-mount').select('svg');
        if (svg.empty()) return;
        
        const allNodes = svg.selectAll('.node');
        const allLinks = svg.selectAll('.link');
        
        const targetSelection = allNodes.filter(d => d.data.name === tableName);
        if (targetSelection.empty()) return;
        
        const d3Node = targetSelection.datum();
        const root = d3Node.parent || d3Node; 
        
        let temp = d3Node;
        while (temp.parent) temp = temp.parent;
        const actualRoot = temp;

        handleNodeSelection(null, d3Node, actualRoot, allNodes, allLinks);

        const treeMountEl = document.getElementById('d3-schema-tree-mount');
        const width = treeMountEl.clientWidth;
        const height = treeMountEl.clientHeight;
        
        const currentTransform = d3.zoomTransform(svg.node());
        const k = currentTransform.k;

        const tx = (width / 2) - (d3Node.x * k);
        const ty = (height / 2) - (d3Node.y * k);
        
        const zoom = d3.zoom().on('zoom', (event) => svg.select('g').attr('transform', event.transform));
        
        svg.transition().duration(750).call(
            zoom.transform, 
            d3.zoomIdentity.translate(tx, ty).scale(k)
        );

        setTimeout(() => {
            targetSelection.raise(); 

            // ARCHITECTURAL FIX: Support animating both circles (tables) and rects (views)
            const shape = targetSelection.select('.node-shape');
            if (shape.empty()) return;

            const originalStroke = shape.style('stroke');
            const originalStrokeWidth = shape.style('stroke-width');
            const originalFill = shape.style('fill');
            const isView = shape.node().tagName.toLowerCase() === 'rect';
            const baseTransform = isView ? 'rotate(45)' : '';

            shape.style('stroke', '#ea580c')
                  .style('fill', '#ea580c')
                  .transition()
                  .duration(450)
                  .ease(d3.easeSinInOut)
                  .style('stroke', '#fde047')
                  .style('fill', '#fde047')
                  .style('stroke-width', '8px')
                  .attr('transform', `${baseTransform} scale(2.5)`)
                  .transition()
                  .duration(450)
                  .ease(d3.easeSinInOut)
                  .style('stroke', originalStroke)
                  .style('fill', originalFill)
                  .style('stroke-width', originalStrokeWidth)
                  .attr('transform', `${baseTransform} scale(1)`);
        }, 750);
    }

    // ==========================================
    // CLASSIC TRIED & TRUE RESIZERS
    // ==========================================
    
    // --- Horizontal Resizer (Left/Right Stages) ---
    const resizerX = document.getElementById('schema-stage-resizer');
    let isResizingX = false;
    let containerOffsetLeft = 0;

    if (resizerX) {
        resizerX.addEventListener('mousedown', (e) => {
            isResizingX = true;
            resizerX.classList.add('is-resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none'; 
            
            const container = document.querySelector('.schema-container');
            if(container) {
                containerOffsetLeft = container.getBoundingClientRect().left;
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizingX) return;
            
            let newWidthPx = e.clientX - containerOffsetLeft;
            
            if (newWidthPx < 300) newWidthPx = 300;
            if (newWidthPx > 1200) newWidthPx = 1200;
            
            document.documentElement.style.setProperty('--schema-left-width', `${newWidthPx}px`);
        });

        document.addEventListener('mouseup', () => {
            if (isResizingX) {
                isResizingX = false;
                resizerX.classList.remove('is-resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                localStorage.setItem('chronoql-schema-left-width', document.documentElement.style.getPropertyValue('--schema-left-width'));
                window.dispatchEvent(new CustomEvent('gossip:module-resumed', { detail: { viewTarget: 'schema-visualizer' } }));
            }
        });
    }

    // --- Vertical Resizer (Top/Bottom Panels in Right Stage) ---
    const resizerY = document.getElementById('schema-ddl-resizer');
    let isResizingY = false;
    let containerOffsetTop = 0;

    if (resizerY) {
        resizerY.addEventListener('mousedown', (e) => {
            isResizingY = true;
            resizerY.classList.add('is-resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none'; 
            
            const container = document.querySelector('.schema-stage-right');
            if(container) {
                containerOffsetTop = container.getBoundingClientRect().top;
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizingY) return;
            
            let newHeightPx = e.clientY - containerOffsetTop;
            
            if (newHeightPx < 100) newHeightPx = 100;
            if (newHeightPx > 800) newHeightPx = 800;
            
            document.documentElement.style.setProperty('--schema-top-height', `${newHeightPx}px`);
        });

        document.addEventListener('mouseup', () => {
            if (isResizingY) {
                isResizingY = false;
                resizerY.classList.remove('is-resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                localStorage.setItem('chronoql-schema-ddl-height', document.documentElement.style.getPropertyValue('--schema-top-height'));
            }
        });
    }

    // ==========================================
    // METADATA INSPECTOR WIRING
    // ==========================================
    const metaTableName = document.getElementById('schema-selected-table-name');
    const dictionaryContainer = document.querySelector('.schema-dictionary');
    const rawDdlBlock = document.getElementById('schema-raw-ddl');
    const btnCopyDdl = document.getElementById('btn-copy-ddl');

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function highlightSQL(sqlString) {
        if (!sqlString) return '';
        let html = escapeHtml(sqlString);
        const keywords = [
            'CREATE', 'TABLE', 'VIEW', 'IF', 'NOT', 'EXISTS', 'INTEGER', 'PRIMARY', 'KEY', 'AUTOINCREMENT', 
            'TEXT', 'NULL', 'DEFAULT', 'CURRENT_TIMESTAMP', 'FOREIGN', 'REFERENCES', 'ON', 'DELETE', 
            'CASCADE', 'UNIQUE', 'BOOLEAN', 'DATETIME', 'REAL', 'INSERT', 'INTO', 'VALUES', 'IGNORE', 'AS', 'SELECT', 'FROM'
        ];
        const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
        html = html.replace(keywordRegex, '<span class="sql-keyword">$&</span>');
        html = html.replace(/(--.*)/g, '<span class="sql-comment">$1</span>');
        return html;
    }

    function resetSchemaEngine(allNodes, allLinks) {
        currentActiveNode = null;
        if (btnResetEdges) btnResetEdges.style.display = 'none';
        
        localStorage.removeItem('chronoql-schema-active-node');

        allNodes.classed('dimmed', false).classed('active-lineage', false);
        allLinks.classed('dimmed', false).classed('active-lineage', false);

        metaTableName.textContent = 'No Entity Selected';
        metaTableName.classList.remove('active-badge');
        dictionaryContainer.innerHTML = `
            <div class="meta-group">
                <h4>Columns</h4>
                <div id="schema-columns-list" class="schema-list-container">
                    <p class="empty-state-text">Select a node to view its structural columns.</p>
                </div>
            </div>
            <div class="meta-group">
                <h4>Foreign Keys (Outgoing)</h4>
                <div id="schema-fk-list" class="schema-list-container">
                    <p class="empty-state-text">Select a node to view its architectural dependencies.</p>
                </div>
            </div>
        `;
        rawDdlBlock.innerHTML = highlightSQL('-- Select a table or view from the relational map \n-- to inspect its exact SQL statement.');
        if (btnCopyDdl) btnCopyDdl.disabled = true;
    }

    function updateDataDictionary(nodeData) {
        if (nodeData.data.isDatabaseRoot) {
            metaTableName.textContent = 'Database System';
            metaTableName.classList.remove('active-badge');
            dictionaryContainer.innerHTML = '<p class="empty-state-text" style="padding: 20px;">Database root node. Select a specific table or view to inspect its architecture.</p>';
            rawDdlBlock.innerHTML = highlightSQL('-- Root database entry point.');
            btnCopyDdl.disabled = true;
            return;
        }

        const table = nodeData.data;
        metaTableName.textContent = table.name || 'Unknown Entity';
        metaTableName.classList.add('active-badge');

        const entityType = table.type === 'VIEW' ? 'View' : 'Table';

        let colsHtml = '';
        if (!table.columns || table.columns.length === 0) {
            colsHtml = `<p class="empty-state-text">No structural columns found (or dynamic ${entityType}).</p>`;
        } else {
            colsHtml = table.columns.map(col => `
                <div class="dict-item">
                    <span class="dict-item-name">${escapeHtml(col.name)}</span>
                    <span class="dict-item-type">${escapeHtml(col.definition)}</span>
                </div>
            `).join('');
        }

        let fkHtml = '';
        if (!table.foreignKeys || table.foreignKeys.length === 0) {
            fkHtml = `<p class="empty-state-text">Zero outgoing foreign keys (Root ${entityType}).</p>`;
        } else {
            fkHtml = table.foreignKeys.map(fk => `
                <div class="dict-item">
                    <span class="dict-item-name">${escapeHtml(fk.localColumn)}</span>
                    <span class="dict-item-type" style="margin: 0 8px;">REFERENCES</span>
                    <span class="dict-fk-target">${escapeHtml(fk.targetTable)}(${escapeHtml(fk.targetColumn)})</span>
                </div>
            `).join('');
        }

        dictionaryContainer.innerHTML = `
            <div class="meta-group">
                <h4>Architectural Domain</h4>
                <p class="meta-text" style="font-weight: 600; color: var(--accent-color);">${escapeHtml(table.domain || 'Uncategorized')} <span style="opacity:0.6; font-size: 0.9em; margin-left: 6px;">(${entityType})</span></p>
            </div>
            <div class="meta-group">
                <h4>${entityType} Description</h4>
                <p class="meta-text">${escapeHtml(table.description || 'No architectural description provided in schema.')}</p>
            </div>
            <div class="meta-group">
                <h4>Structural Columns</h4>
                <div class="schema-list-container">
                    ${colsHtml}
                </div>
            </div>
            <div class="meta-group">
                <h4>Foreign Keys (Outgoing Lineage)</h4>
                <div class="schema-list-container">
                    ${fkHtml}
                </div>
            </div>
        `;

        rawDdlBlock.innerHTML = table.ddl ? highlightSQL(table.ddl) : highlightSQL('-- DDL not available for this entity.');
        btnCopyDdl.disabled = false;
        rawDdlBlock.dataset.raw = table.ddl || '';
    }

    if (btnCopyDdl && rawDdlBlock) {
        btnCopyDdl.addEventListener('click', async () => {
            if (btnCopyDdl.disabled) return;
            try {
                const textToCopy = rawDdlBlock.dataset.raw || rawDdlBlock.textContent;
                await navigator.clipboard.writeText(textToCopy);
                
                playSuctionWhoosh(); 
                
                const originalHtml = btnCopyDdl.innerHTML;
                btnCopyDdl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                setTimeout(() => {
                    btnCopyDdl.innerHTML = originalHtml;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy DDL:', err);
            }
        });
    }

    // ==========================================
    // D3 TOP-DOWN TIDY TREE ENGINE
    // ==========================================
    const treeMount = document.getElementById('d3-schema-tree-mount');
    
    const domainColorScale = d3.scaleOrdinal(d3.schemeCategory10);
    
    function buildHierarchy(tables) {
        const tableMap = new Map();
        searchableTableNames = [];
        
        tables.forEach(t => {
            tableMap.set(t.name, { ...t, children: [] });
            searchableTableNames.push(t.name);
        });
        
        searchableTableNames.sort();

        const roots = [];

        tables.forEach(t => {
            const mappedTable = tableMap.get(t.name);
            
            if (t.foreignKeys && t.foreignKeys.length === 0) {
                roots.push(mappedTable);
            } else if (t.foreignKeys && t.foreignKeys.length > 0) {
                const primaryFk = t.foreignKeys[0];
                const parent = tableMap.get(primaryFk.targetTable);
                
                if (parent) {
                    parent.children.push(mappedTable);
                } else {
                    roots.push(mappedTable);
                }
            } else {
                roots.push(mappedTable);
            }
        });

        return {
            name: 'System Schema',
            isDatabaseRoot: true,
            domain: 'Database Schema',
            children: roots
        };
    }

    async function renderSchemaTree() {
        if (!window.api || !window.api.visualizer) {
            treeMount.innerHTML = `<div class="empty-state-container"><h3>IPC Bridge Offline</h3></div>`;
            return;
        }

        treeMount.innerHTML = `<div class="empty-state-container"><span style="color: var(--text-muted); font-style: italic;">Rendering D3 Schema Engine...</span></div>`;

        try {
            const activeId = localStorage.getItem('chronoql-active-workspace-id');
            const response = await window.api.visualizer.fetchSchemaTree(activeId ? { workspaceId: activeId } : undefined);
            
            if (!response.success || !response.data) {
                const errMsg = response.error || 'Invalid SQL payload';
                treeMount.innerHTML = `
                    <div class="empty-state-container" style="padding: 40px; text-align: center;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <h3 style="margin: 0 0 8px 0; color: var(--text-color); font-size: 16px;">Schema Uninitialized</h3>
                        <p style="margin: 0; color: var(--text-muted); font-size: 13px;">${errMsg}</p>
                    </div>`;
                return;
            }

            const flatTables = response.data;
            const hierarchicalData = buildHierarchy(flatTables);

            treeMount.innerHTML = ''; 

            const width = treeMount.clientWidth || 800;
            const height = treeMount.clientHeight || 600;

            const svg = d3.select(treeMount).append('svg')
                .attr('width', '100%')
                .attr('height', '100%');

            const g = svg.append('g');

            const zoom = d3.zoom()
                .scaleExtent([0.3, 3])
                .on('zoom', (event) => g.attr('transform', event.transform))
                .on('end', (event) => {
                    localStorage.setItem('chronoql-schema-transform', JSON.stringify({
                        x: event.transform.x,
                        y: event.transform.y,
                        k: event.transform.k
                    }));
                });
            
            svg.call(zoom);

            if (btnRecenterView) {
                btnRecenterView.addEventListener('click', () => {
                    svg.transition().duration(750).call(
                        zoom.transform, 
                        d3.zoomIdentity.translate(50, 50).scale(1)
                    );
                    localStorage.removeItem('chronoql-schema-transform');
                });
            }

            const root = d3.hierarchy(hierarchicalData);
            
            const treeLayout = d3.tree().size([width - 100, height - 100]);
            treeLayout(root);
            
            // ARCHITECTURAL FIX: Cascading Node Stagger for Horizontal Density (3-Tier Wave)
            root.eachBefore(d => {
                d.yOffset = 0;
                if (d.parent && d.parent.children) {
                    const index = d.parent.children.indexOf(d);
                    const mod = index % 4;
                    
                    if (mod === 1 || mod === 3) {
                        d.yOffset = 45; // Middle tier
                    } else if (mod === 2) {
                        d.yOffset = 90; // Bottom tier
                    }
                    
                    // Sub-children inherit their parent's drop so entire branches shift cleanly
                    d.yOffset += d.parent.yOffset || 0;
                    d.y += d.yOffset;
                }
            });
            
            // --- STATE HYDRATION LOGIC ---
            const savedTransformStr = localStorage.getItem('chronoql-schema-transform');

            if (savedTransformStr) {
                try {
                    const saved = JSON.parse(savedTransformStr);
                    svg.call(zoom.transform, d3.zoomIdentity.translate(saved.x, saved.y).scale(saved.k));
                } catch (e) {
                    console.warn('[Schema Visualizer] Failed to parse cached DAG transform. Falling back to default.');
                    svg.call(zoom.transform, d3.zoomIdentity.translate(50, 50).scale(1));
                }
            } else {
                svg.call(zoom.transform, d3.zoomIdentity.translate(50, 50).scale(1));
            }

            const linkGenerator = d3.linkVertical()
                .x(d => d.x)
                .y(d => d.y);

            const link = g.append('g')
                .attr('class', 'links')
                .selectAll('path')
                .data(root.links())
                .enter().append('path')
                .attr('class', 'link schema-edge')
                .attr('d', linkGenerator);

            const node = g.append('g')
                .attr('class', 'nodes')
                .selectAll('g')
                .data(root.descendants())
                .enter().append('g')
                .attr('class', d => {
                    let c = 'node dag-node';
                    if (d.data.isDatabaseRoot) c += ' root-node';
                    else if (d.depth === 1 && d.data.foreignKeys && d.data.foreignKeys.length === 0) c += ' root-node';
                    else if (d.depth > 1) c += ' child-node';
                    return c;
                })
                .attr('transform', d => `translate(${d.x},${d.y})`)
                .style('cursor', 'pointer')
                .on('click', (event, d) => handleNodeSelection(event, d, root, node, link));

            // ARCHITECTURAL FIX: Conditionally render shapes based on TABLE vs VIEW classification
            node.each(function(d) {
                const el = d3.select(this);
                const isRoot = d.data.isDatabaseRoot || (d.depth === 1 && d.data.foreignKeys && d.data.foreignKeys.length === 0);
                const strokeColor = domainColorScale(d.data.domain || 'Uncategorized');
                const fillColor = isRoot ? strokeColor : 'var(--surface-color)';

                if (d.data.type === 'VIEW') {
                    // Render Views as Diamonds
                    el.append('rect')
                      .attr('x', -8)
                      .attr('y', -8)
                      .attr('width', 16)
                      .attr('height', 16)
                      .attr('rx', 2)
                      .attr('transform', 'rotate(45)')
                      .style('stroke', strokeColor)
                      .style('fill', fillColor)
                      .style('stroke-width', '3px')
                      .attr('class', 'node-shape');
                } else {
                    // Render Standard Tables and Root as Circles
                    el.append('circle')
                      .attr('r', 10)
                      .style('stroke', strokeColor)
                      .style('fill', fillColor)
                      .style('stroke-width', '3px')
                      .attr('class', 'node-shape');
                }
            });

            node.append('text')
                .attr('dy', d => d.children ? -20 : 24)
                .attr('x', 0)
                .style('text-anchor', 'middle')
                .style('font-weight', d => d.data.isDatabaseRoot ? 'bold' : 'normal')
                .text(d => d.data.name);

            // Re-hydrate the active node on boot
            const savedSchemaNode = localStorage.getItem('chronoql-schema-active-node');
            if (savedSchemaNode) {
                const targetSelection = node.filter(d => d.data.name === savedSchemaNode);
                if (!targetSelection.empty()) {
                    handleNodeSelection(null, targetSelection.datum(), root, node, link);
                }
            }

        } catch (error) {
            console.error('Failed to render Schema Tree:', error);
            treeMount.innerHTML = `<div class="empty-state-container"><p style="color:var(--danger-color)">Render Error: ${error.message}</p></div>`;
        }
    }

    // ==========================================
    // LINEAGE HIGHLIGHTING LOGIC
    // ==========================================
    
    function handleNodeSelection(event, selectedNode, root, allNodes, allLinks) {
        if (currentActiveNode === selectedNode) {
            resetSchemaEngine(allNodes, allLinks);
            return;
        }

        currentActiveNode = selectedNode;
        if (btnResetEdges) btnResetEdges.style.display = 'flex';
        
        localStorage.setItem('chronoql-schema-active-node', selectedNode.data.name);

        updateDataDictionary(selectedNode);

        const activeNodes = new Set();
        const activeLinks = new Set();

        let current = selectedNode;
        while (current) {
            activeNodes.add(current);
            if (current.parent) {
                const targetLink = root.links().find(l => l.source === current.parent && l.target === current);
                if (targetLink) activeLinks.add(targetLink);
            }
            current = current.parent;
        }

        const findDescendants = (n) => {
            if (n.children) {
                n.children.forEach(child => {
                    activeNodes.add(child);
                    const targetLink = root.links().find(l => l.source === n && l.target === child);
                    if (targetLink) activeLinks.add(targetLink);
                    findDescendants(child);
                });
            }
        };
        findDescendants(selectedNode);

        allNodes.classed('dimmed', d => !activeNodes.has(d))
                .classed('active-lineage', d => d === selectedNode);

        allLinks.classed('dimmed', d => !activeLinks.has(d))
                .classed('active-lineage', d => activeLinks.has(d));
    }

    // ==========================================
    // EXECUTE MODULE INITIALIZATION
    // ==========================================
    renderSchemaTree();

    window.addEventListener('gossip:module-resumed', (e) => {
        if (e.detail.viewTarget === 'schema-visualizer') {
            const bounds = treeMount.getBoundingClientRect();
            const svg = d3.select(treeMount).select('svg');
            if (!svg.empty()) {
                svg.attr('width', bounds.width).attr('height', bounds.height);
                renderSchemaTree();
            }
        }
    });

    window.addEventListener('gossip:workspace-changed', () => {
        const activeModule = localStorage.getItem('chronoql-os-active-module');
        if (activeModule === 'schema-visualizer') {
            renderSchemaTree();
        }
    });
};