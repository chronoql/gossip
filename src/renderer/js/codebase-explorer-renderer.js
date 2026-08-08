/**
 * Project: Chronoql Gossip
 * Module: Codebase Explorer Renderer
 * Phase: 7 (Visualization Modules - DAG Graph Walking & Pulse Polish)
 */

window.initCodebaseExplorer = async function() {
    console.log('[Codebase Explorer] Initializing visualization engine...');

    let currentDagState = null;
    
    // Global references for DAG-to-Tree communication
    let codebaseRoot = null;
    let updateIndentedTree = null;
    let expandedNodes = JSON.parse(localStorage.getItem('chronoql-cb-expanded-nodes') || '[]');
    let searchableFileNames = [];

    // ==========================================
    // DOM CACHING & EVENT LISTENERS
    // ==========================================
    const legendDrawer = document.getElementById('cb-legend-drawer');
    const btnToggleLegend = document.getElementById('btn-toggle-cb-legend');
    const btnCloseLegend = document.getElementById('btn-close-cb-legend');
    const treeMount = document.getElementById('d3-codebase-tree-mount');
    const btnRefreshTree = document.getElementById('btn-refresh-cb-tree');
    
    // Search Bar Elements
    const searchInput = document.getElementById('cb-tree-search-input');
    const customDropdown = document.getElementById('cb-tree-search-dropdown');
    const btnRegexToggle = document.getElementById('btn-cb-regex-toggle');
    
    let dropdownActiveIndex = -1;
    let isRegexMode = false;

    // Restore cached Resizer Dimensions
    const savedLeftWidth = localStorage.getItem('chronoql-cb-left-width');
    if (savedLeftWidth) document.documentElement.style.setProperty('--cb-left-width', savedLeftWidth);
    
    const savedTopHeight = localStorage.getItem('chronoql-cb-dag-height');
    if (savedTopHeight) document.documentElement.style.setProperty('--cb-top-height', savedTopHeight);

    if (btnToggleLegend && legendDrawer) {
        btnToggleLegend.addEventListener('click', () => legendDrawer.classList.toggle('open'));
    }
    if (btnCloseLegend && legendDrawer) {
        btnCloseLegend.addEventListener('click', () => legendDrawer.classList.remove('open'));
    }
    if (btnRefreshTree) {
        btnRefreshTree.addEventListener('click', renderIndentedTree);
    }
    
    // ==========================================
    // CUSTOM AUTOCOMPLETE DROPDOWN ENGINE
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
        if (!customDropdown) return;
        customDropdown.style.display = 'none';
        customDropdown.innerHTML = '';
        dropdownActiveIndex = -1;
    }

    function renderSearchDropdown(query) {
        if (!customDropdown) return;
        
        customDropdown.innerHTML = '';
        dropdownActiveIndex = -1;
        
        if (!query) {
            closeSearchDropdown();
            return;
        }

        let matches = [];

        if (isRegexMode) {
            try {
                const regex = new RegExp(query, 'i'); 
                matches = searchableFileNames.filter(name => regex.test(name));
            } catch (e) {
                customDropdown.innerHTML = '<div class="dropdown-empty" style="color: #ef4444;">Invalid Regular Expression</div>';
                customDropdown.style.display = 'flex';
                return;
            }
        } else {
            const lowerQuery = query.toLowerCase();
            matches = searchableFileNames.filter(name => name.toLowerCase().includes(lowerQuery));
        }

        if (matches.length === 0) {
            customDropdown.innerHTML = '<div class="dropdown-empty">No files found matching query.</div>';
            customDropdown.style.display = 'flex';
            return;
        }

        matches.forEach((match, index) => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            
            if (isRegexMode) {
                try {
                    const regex = new RegExp(`(${query})`, 'gi');
                    item.innerHTML = match.replace(regex, '<strong>$1</strong>');
                } catch(e) {
                    item.textContent = match; 
                }
            } else {
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedQuery})`, 'gi');
                item.innerHTML = match.replace(regex, '<strong>$1</strong>');
            }
            
            item.addEventListener('mouseenter', () => {
                const items = customDropdown.querySelectorAll('.dropdown-item');
                items.forEach(el => el.classList.remove('focused'));
                item.classList.add('focused');
                dropdownActiveIndex = index;
            });

            item.addEventListener('click', () => {
                selectNodeByName(match);
                searchInput.value = ''; 
                closeSearchDropdown();
            });

            customDropdown.appendChild(item);
        });

        customDropdown.style.display = 'flex';
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
            if (searchInput && customDropdown && btnRegexToggle) {
                if (!searchInput.contains(e.target) && !customDropdown.contains(e.target) && !btnRegexToggle.contains(e.target)) {
                    closeSearchDropdown();
                }
            }
        });

        searchInput.addEventListener('keydown', (e) => {
            const items = customDropdown ? customDropdown.querySelectorAll('.dropdown-item') : [];
            
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
                    const targetName = items[dropdownActiveIndex].textContent;
                    selectNodeByName(targetName);
                    searchInput.value = '';
                    closeSearchDropdown();
                    searchInput.blur();
                } else if (searchInput.value.trim() && !isRegexMode) {
                    selectNodeByName(searchInput.value.trim());
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

    // ==========================================
    // CLASSIC TRIED & TRUE RESIZERS
    // ==========================================
    
    // --- Horizontal Resizer (Left/Right Stages) ---
    const resizerX = document.getElementById('cb-stage-resizer');
    let isResizingX = false;
    let containerOffsetLeftX = 0;

    if (resizerX) {
        resizerX.addEventListener('mousedown', (e) => {
            isResizingX = true;
            document.body.classList.add('is-resizing');
            resizerX.classList.add('is-resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none'; 
            
            const container = document.querySelector('.explorer-container') || document.body;
            containerOffsetLeftX = container.getBoundingClientRect().left;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizingX) return;
            
            let newWidthPx = e.clientX - containerOffsetLeftX;
            
            if (newWidthPx < 300) newWidthPx = 300;
            if (newWidthPx > 1200) newWidthPx = 1200;
            
            document.documentElement.style.setProperty('--cb-left-width', `${newWidthPx}px`);
        });

        document.addEventListener('mouseup', () => {
            if (isResizingX) {
                isResizingX = false;
                document.body.classList.remove('is-resizing');
                resizerX.classList.remove('is-resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                localStorage.setItem('chronoql-cb-left-width', document.documentElement.style.getPropertyValue('--cb-left-width'));
                window.dispatchEvent(new CustomEvent('gossip:module-resumed', { detail: { viewTarget: 'codebase-explorer' } }));
            }
        });
    }

    // --- Vertical Resizer (Top/Bottom Panels in Right Stage) ---
    const resizerY = document.getElementById('cb-dag-resizer');
    let isResizingY = false;
    let containerOffsetTopY = 0;

    if (resizerY) {
        resizerY.addEventListener('mousedown', (e) => {
            isResizingY = true;
            document.body.classList.add('is-resizing');
            resizerY.classList.add('is-resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none'; 
            
            const rightStage = document.querySelector('.codebase-stage-right') || document.body;
            containerOffsetTopY = rightStage.getBoundingClientRect().top;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizingY) return;
            
            let newHeightPx = e.clientY - containerOffsetTopY;
            
            if (newHeightPx < 150) newHeightPx = 150;
            if (newHeightPx > 800) newHeightPx = 800;
            
            document.documentElement.style.setProperty('--cb-top-height', `${newHeightPx}px`);
        });

        document.addEventListener('mouseup', () => {
            if (isResizingY) {
                isResizingY = false;
                document.body.classList.remove('is-resizing');
                resizerY.classList.remove('is-resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                localStorage.setItem('chronoql-cb-dag-height', document.documentElement.style.getPropertyValue('--cb-top-height'));
                window.dispatchEvent(new CustomEvent('gossip:module-resumed', { detail: { viewTarget: 'codebase-explorer' } }));
            }
        });
    }

    // ==========================================
    // METADATA INSPECTOR WIRING
    // ==========================================
    const metaNodeName = document.getElementById('cb-selected-node-name');
    const metaDesc = document.getElementById('cb-meta-desc');
    const metaVisDesc = document.getElementById('cb-meta-vis-desc');
    const metaInputs = document.getElementById('cb-meta-inputs');
    const metaOutputs = document.getElementById('cb-meta-outputs');
    const dagMount = document.getElementById('d3-codebase-dag-mount');

    function clearMetadataInspector() {
        if (metaNodeName) {
            metaNodeName.textContent = '--';
            metaNodeName.classList.remove('active-badge');
        }
        if (metaDesc) {
            metaDesc.textContent = 'Select a node in the codebase tree to inspect its architectural metadata.';
            metaDesc.classList.add('empty-state-text');
        }
        if (metaVisDesc) {
            metaVisDesc.textContent = '';
            metaVisDesc.classList.add('empty-state-text');
        }
        if (metaInputs) metaInputs.innerHTML = '<span class="meta-tag empty-tag">None</span>';
        if (metaOutputs) metaOutputs.innerHTML = '<span class="meta-tag empty-tag">None</span>';
        
        currentDagState = null;
        if (dagMount) dagMount.innerHTML = '';
    }

    function updateMetadataInspector(nodeData) {
        const d = nodeData.data || nodeData;

        metaNodeName.textContent = d.name || 'Unknown File';
        metaNodeName.classList.add('active-badge');

        metaDesc.textContent = d.description && d.description.trim() !== '' ? d.description : 'No standard description available.';
        metaDesc.classList.remove('empty-state-text');
        
        metaVisDesc.textContent = d.visualizerDescription && d.visualizerDescription.trim() !== '' ? d.visualizerDescription : 'No visualizer metadata available.';
        metaVisDesc.classList.remove('empty-state-text');

        const parseTags = (str) => {
            if (!str || str.toLowerCase() === 'none' || str.trim() === '') return [];
            return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
        };

        const inputs = parseTags(d.inputs);
        const outputs = parseTags(d.outputs);

        metaInputs.innerHTML = '';
        if (inputs.length === 0) {
            metaInputs.innerHTML = '<span class="meta-tag empty-tag">None</span>';
        } else {
            inputs.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'meta-tag';
                span.textContent = tag;
                metaInputs.appendChild(span);
            });
        }

        metaOutputs.innerHTML = '';
        if (outputs.length === 0) {
            metaOutputs.innerHTML = '<span class="meta-tag empty-tag">None</span>';
        } else {
            outputs.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'meta-tag';
                span.textContent = tag;
                metaOutputs.appendChild(span);
            });
        }

        currentDagState = { targetName: d.name, inputs, outputs, nodeType: d.type };
        renderLocalizedDAG(d.name, inputs, outputs, d.type);
    }

    // --- Graph Walking Navigator ---
    function selectNodeByName(targetName) {
        if (!codebaseRoot) return;
        
        const cleanTargetName = targetName.replace(/\s*\(.*?\)\s*/g, '').trim();

        let targetNode = null;
        
        function findNodeDeep(node) {
            if (node.data.name === cleanTargetName) targetNode = node;
            if (targetNode) return;
            const kids = node._children || node.children; 
            if (kids) kids.forEach(findNodeDeep);
        }
        
        findNodeDeep(codebaseRoot);

        if (targetNode) {
            let current = targetNode.parent;
            let needsTreeUpdate = false;
            
            while (current) {
                if (current._children && !current.children) {
                    current.children = current._children;
                    if (!expandedNodes.includes(current.data.name)) expandedNodes.push(current.data.name);
                    needsTreeUpdate = true;
                }
                current = current.parent;
            }
            
            if (needsTreeUpdate) {
                localStorage.setItem('chronoql-cb-expanded-nodes', JSON.stringify(expandedNodes));
                if (typeof updateIndentedTree === 'function') updateIndentedTree();
            }

            d3.selectAll('#d3-codebase-tree-mount .node').classed('selected', false);
            
            setTimeout(() => {
                const targetSelection = d3.selectAll('#d3-codebase-tree-mount .node')
                  .filter(d => d.data.name === cleanTargetName);
                  
                targetSelection.classed('selected', true);
                  
                if (targetNode && treeMount) {
                    const offsetPadding = 40; 
                    const physicalY = targetNode.y + offsetPadding;
                    const viewCenter = treeMount.clientHeight / 2;
                    
                    treeMount.scrollTo({
                        top: Math.max(0, physicalY - viewCenter),
                        behavior: 'smooth'
                    });
                }

                setTimeout(() => {
                    const shapes = targetSelection.selectAll('rect, circle, polygon, path');
                    shapes.each(function() {
                        const el = d3.select(this);
                        const originalFill = el.attr('fill'); 
                        
                        el.attr('fill', '#ea580c') 
                          .transition()
                          .duration(2625).ease(d3.easeSinInOut)
                          .attr('fill', '#fde047') 
                          .attr('transform', 'scale(2)') 
                          .transition()
                          .duration(2625).ease(d3.easeSinInOut)
                          .attr('fill', originalFill) 
                          .attr('transform', 'scale(1)');
                    });
                }, 450); 
                
            }, 100); 
            
            localStorage.setItem('chronoql-cb-active-node', cleanTargetName);
            updateMetadataInspector(targetNode);
        } else {
            console.warn(`[Codebase Explorer] Attempted to jump to '${cleanTargetName}', but it was not found in the manifest.`);
        }
    }

    // ==========================================
    // GEOMETRIC SYNTAX ENGINE
    // ==========================================
    function getShapeType(filename, type) {
        if (type === 'directory' || type === 'project') return 'rect'; 
        if (!filename) return 'generic';
        
        const lowerName = filename.toLowerCase();
        const parts = lowerName.split('.');
        const ext = parts.length > 1 ? parts.pop() : lowerName;
        
        if (ext === 'md') return 'pentagon';
        if (['pdf', 'doc', 'docx'].includes(ext)) return 'triangle';
        
        if (['html', 'htm', 'jsx', 'tsx', 'vue', 'svelte'].includes(ext)) return 'hex';
        if (['css', 'scss', 'less', 'sass'].includes(ext)) return 'pill';
        if (['sql', 'db', 'sqlite', 'sqlite3', 'csv', 'tsv', 'parquet'].includes(ext)) return 'circle';
        if (['json', 'xml', 'yml', 'yaml', 'ini', 'env', 'toml', 'dockerfile', 'dockerignore', 'gitignore'].includes(ext) || ['dockerfile', '.gitignore', '.env', '.dockerignore'].includes(lowerName)) return 'octagon';
        if (['js', 'ts', 'py', 'java', 'go', 'rb', 'sh', 'bash', 'php'].includes(ext)) return 'diamond';
        
        return 'generic'; 
    }

    function getShapeColor(shapeType) {
        switch (shapeType) {
            case 'rect': return { bg: '#38bdf8', border: '#0284c7' };      
            case 'pentagon': return { bg: '#14b8a6', border: '#0f766e' };  
            case 'triangle': return { bg: '#ef4444', border: '#b91c1c' };  
            case 'diamond': return { bg: '#facc15', border: '#ca8a04' };   
            case 'circle': return { bg: '#f59e0b', border: '#b45309' };    
            case 'hex': return { bg: '#a855f7', border: '#7e22ce' };       
            case 'pill': return { bg: '#ec4899', border: '#be185d' };      
            case 'octagon': return { bg: '#10b981', border: '#047857' };   
            case 'generic':
            default: return { bg: '#94a3b8', border: '#475569' };          
        }
    }

    function appendGeometricShape(selection) {
        selection.each(function(d) {
            const el = d3.select(this);
            const sType = d.shapeType || getShapeType(d.data ? d.data.name : d.id, d.data ? d.data.type : 'file');
            const colors = getShapeColor(sType);

            if (sType === 'rect') {
                el.append('rect')
                  .attr('width', 16).attr('height', 16)
                  .attr('x', -8).attr('y', -8).attr('rx', 2)
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'circle') {
                el.append('circle')
                  .attr('r', 8)
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'pill') {
                el.append('rect')
                  .attr('width', 20).attr('height', 12)
                  .attr('x', -10).attr('y', -6).attr('rx', 6)
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'diamond') {
                el.append('polygon')
                  .attr('points', '0,-8 8,0 0,8 -8,0')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'hex') {
                el.append('polygon')
                  .attr('points', '0,-9 8,-5 8,5 0,9 -8,5 -8,-5')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'octagon') {
                el.append('polygon')
                  .attr('points', '3,-8 8,-3 8,3 3,8 -3,8 -8,3 -8,-3 -3,-8')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'triangle') {
                 el.append('polygon')
                  .attr('points', '0,-8 8,8 -8,8')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'pentagon') {
                 el.append('polygon')
                  .attr('points', '0,-8 8,-3 5,8 -5,8 -8,-3')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else {
                el.append('rect')
                  .attr('width', 12).attr('height', 12)
                  .attr('x', -6).attr('y', -6).attr('rx', 1)
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            }
        });
    }

    // ==========================================
    // PRIMARY D3 INDENTED TREE
    // ==========================================
    
    function populateSearchDataArray(rootNode) {
        searchableFileNames = [];
        function traverseForFiles(node) {
            if (node.data.type !== 'directory' && node.data.type !== 'project') {
                searchableFileNames.push(node.data.name);
            }
            const kids = node._children || node.children;
            if (kids) kids.forEach(traverseForFiles);
        }
        traverseForFiles(rootNode);
        searchableFileNames.sort();
    }
    
    async function renderIndentedTree() {
        if (!window.api || !window.api.visualizer) {
            treeMount.innerHTML = `<div class="empty-state-container"><h3>IPC Bridge Offline</h3></div>`;
            return;
        }

        treeMount.innerHTML = `<div class="empty-state-container"><span class="loading-text" style="color: var(--text-muted); font-style: italic;">Parsing codebase.xml...</span></div>`;

        try {
            const activeId = localStorage.getItem('chronoql-active-workspace-id');
            const response = await window.api.visualizer.fetchCodebaseTree(activeId ? { workspaceId: activeId } : undefined);
            
            if (!response || !response.success || !response.data) {
                throw new Error(response?.error || 'Invalid payload or missing codebase.xml');
            }

            const data = response.data;
            treeMount.innerHTML = ''; 
            
            treeMount.style.overflow = 'auto';
            treeMount.style.cursor = 'default';

            const nodeSize = 26; 
            let i = 0;

            codebaseRoot = d3.hierarchy(data);
            
            codebaseRoot.eachBefore(d => {
                d.id = (i++).toString();
                d.shapeType = getShapeType(d.data.name, d.data.type);
                if (d.children) {
                    d._children = d.children; 
                }
            });

            codebaseRoot.descendants().forEach(d => {
                if (d.depth > 0 && d._children && !expandedNodes.includes(d.data.name)) {
                    d.children = null;
                }
            });
            
            populateSearchDataArray(codebaseRoot);

            const svg = d3.select(treeMount).append('svg')
                .attr('width', '100%')
                .style('font', '12px sans-serif');

            const g = svg.append('g').attr('transform', 'translate(40, 40)');

            updateIndentedTree = function update() {
                let index = -1;
                
                codebaseRoot.eachBefore(d => {
                    d.x = d.depth * 24; 
                    d.y = ++index * nodeSize; 
                });

                const nodes = codebaseRoot.descendants();
                const links = nodes.slice(1);

                const height = Math.max(500, nodes.length * nodeSize + 40);
                svg.transition().duration(250).attr("height", height);
                
                const link = g.selectAll('path.link')
                    .data(links, d => d.id);

                link.enter().insert('path', 'g')
                    .attr('class', 'link')
                    .attr('d', d => `M ${d.parent.x},${d.parent.y} V ${d.y} H ${d.x}`)
                    .merge(link)
                    .transition().duration(250)
                    .attr('d', d => `M ${d.parent.x},${d.parent.y} V ${d.y} H ${d.x}`);

                link.exit().remove();

                const node = g.selectAll('g.node')
                    .data(nodes, d => d.id);

                const nodeEnter = node.enter().append('g')
                    .attr('class', 'node')
                    .attr('transform', d => `translate(${d.x},${d.y})`)
                    .on('click', (event, d) => {
                        d3.selectAll('.node').classed('selected', false);
                        d3.select(event.currentTarget).classed('selected', true);
                        
                        localStorage.setItem('chronoql-cb-active-node', d.data.name);
                        
                        // Toggle Logic
                        if (d._children) { 
                            if (d.children) {
                                d.children = null; 
                                expandedNodes = expandedNodes.filter(n => n !== d.data.name);
                            } else {
                                d.children = d._children; 
                                if (!expandedNodes.includes(d.data.name)) expandedNodes.push(d.data.name);
                            }
                            localStorage.setItem('chronoql-cb-expanded-nodes', JSON.stringify(expandedNodes));
                            updateIndentedTree();
                        }
                        
                        updateMetadataInspector(d);
                    });

                nodeEnter.call(appendGeometricShape);

                nodeEnter.append('text')
                    .attr('dy', 4)
                    .attr('x', 16)
                    .style('cursor', 'pointer')
                    .text(d => d.data.name);

                node.merge(nodeEnter)
                    .transition().duration(250)
                    .attr('transform', d => `translate(${d.x},${d.y})`);

                node.exit().remove();

                if (i === codebaseRoot.descendants().length) {
                   const savedCbNode = localStorage.getItem('chronoql-cb-active-node');
                   if (savedCbNode) {
                       selectNodeByName(savedCbNode);
                   }
                }
            };

            updateIndentedTree(); 

        } catch (error) {
            console.error('Failed to render Codebase Tree:', error);
            
            // ARCHITECTURAL FIX: Graceful Empty State for missing manifests
            if (error.message.includes('codebase.xml not found')) {
                treeMount.innerHTML = `
                    <div class="empty-state-container" style="padding: 40px 20px; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                        <svg class="empty-state-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        <h3 style="margin: 0 0 8px 0; color: var(--text-color); font-size: 16px;">No Architecture Manifest</h3>
                        <p class="empty-state-desc" style="margin: 0;">A <code>codebase.xml</code> file was not found in this project's root or data directory.</p>
                    </div>
                `;
            } else {
                treeMount.innerHTML = `<div class="empty-state-container"><p style="color:var(--danger-color)">Render Error: ${error.message}</p></div>`;
            }
        }
    }

    // ==========================================
    // LOCALIZED DAG ENGINE (Execution Flow)
    // ==========================================
    function renderLocalizedDAG(targetName, inputs, outputs, nodeType) {
        if (!dagMount) return;
        dagMount.innerHTML = '';

        if (!inputs?.length && !outputs?.length) {
            dagMount.innerHTML = `
                <div id="dag-empty-state" class="empty-state-local">
                    <svg class="empty-state-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    <p>No isolated flow data available for ${escapeHtml(targetName)}.</p>
                </div>`;
            return;
        }

        const width = dagMount.clientWidth || 600;
        const height = dagMount.clientHeight || 400;
        const centerY = height / 2;

        const nodes = [{ id: targetName, group: 'center', fx: width / 2, fy: centerY }];
        const links = [];

        (inputs || []).forEach((i, idx) => {
            const src = i.source || i;
            nodes.push({ id: src, group: 'input', fx: width / 6, fy: centerY + ((idx - ((inputs.length-1)/2)) * 60) });
            links.push({ source: src, target: targetName, type: i.type || 'sync' });
        });

        (outputs || []).forEach((o, idx) => {
            const tgt = o.target || o;
            nodes.push({ id: tgt, group: 'output', fx: (width / 6) * 5, fy: centerY + ((idx - ((outputs.length-1)/2)) * 60) });
            links.push({ source: targetName, target: tgt, type: o.type || 'sync' });
        });

        const svg = d3.select(dagMount).append('svg')
            .attr('width', '100%')
            .attr('height', '100%');

        const defs = svg.append('defs');
        
        defs.append('marker')
            .attr('id', 'arrow-solid')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 28) 
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('fill', 'var(--text-color)')
            .attr('stroke', 'none')
            .attr('d', 'M0,-5L10,0L0,5');

        defs.append('marker')
            .attr('id', 'arrow-async')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 28)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('fill', 'none')
            .attr('stroke', 'var(--text-color)')
            .attr('stroke-width', 1.5)
            .attr('d', 'M0,-5L10,0L0,5');

        const g = svg.append('g');
        const zoom = d3.zoom()
            .scaleExtent([0.2, 3]) 
            .on('zoom', (event) => g.attr('transform', event.transform))
            .on('end', (event) => {
                localStorage.setItem(`chronoql-cb-dag-${targetName}-transform`, JSON.stringify({
                    x: event.transform.x,
                    y: event.transform.y,
                    k: event.transform.k
                }));
            });
            
        svg.call(zoom);

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2));

        const link = g.selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', 'var(--text-color)')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', d => d.type === 'async' ? '4,4' : 'none')
            .attr('marker-end', d => `url(#arrow-${d.type})`);

        const nodeGroup = g.selectAll('g')
            .data(nodes)
            .join('g')
            .call(drag(simulation));

        nodeGroup.each(function(d) {
            const el = d3.select(this);
            const iconInfo = getShapeColor(getShapeType(d.id, 'file'));
            const isCenter = d.group === 'center';
            
            el.append('circle')
                .attr('r', 18)
                .attr('fill', 'var(--surface-color)')
                .attr('stroke', isCenter ? '#38bdf8' : iconInfo.border)
                .attr('stroke-width', 3);
            
            el.append('text')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('fill', isCenter ? '#38bdf8' : iconInfo.bg)
                .style('font-family', 'monospace')
                .style('font-weight', 'bold')
                .style('font-size', '14px')
                .text(d.id.split('.').pop().substring(0,2).toUpperCase());
        });

        nodeGroup.append('text')
            .attr('dy', 32)
            .attr('text-anchor', 'middle')
            .attr('fill', 'var(--text-color)')
            .style('font-size', '12px')
            .style('font-family', 'monospace')
            .text(d => d.id);

        simulation.on('tick', () => {
            link.attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        function drag(sim) {
            function dragstarted(event) {
                if (!event.active) sim.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }
            function dragged(event) {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }
            function dragended(event) {
                if (!event.active) sim.alphaTarget(0);
                if (event.subject.group !== 'center') {
                    event.subject.fx = null;
                    event.subject.fy = null;
                }
            }
            return d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended);
        }

        const savedDagTransformStr = localStorage.getItem(`chronoql-cb-dag-${targetName}-transform`);

        if (savedDagTransformStr) {
            try {
                const saved = JSON.parse(savedDagTransformStr);
                svg.call(zoom.transform, d3.zoomIdentity.translate(saved.x, saved.y).scale(saved.k));
            } catch (e) {
                runAutoFraming();
            }
        } else {
            runAutoFraming();
        }

        function runAutoFraming() {
            setTimeout(() => {
                if (!g.node()) return;
                const bounds = g.node().getBBox();
                if (bounds.width === 0 || bounds.height === 0) return;

                const padding = 60; 
                const scaleX = (width - padding) / bounds.width;
                const scaleY = (height - padding) / bounds.height;
                const scale = Math.max(0.2, Math.min(1, scaleX, scaleY)); 

                const midX = bounds.x + (bounds.width / 2);
                const midY = bounds.y + (bounds.height / 2);

                const translateX = (width / 2) - (midX * scale);
                const translateY = (height / 2) - (midY * scale);

                svg.transition().duration(400).call(
                    zoom.transform, 
                    d3.zoomIdentity.translate(translateX, translateY).scale(scale)
                );
            }, 10);
        }
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // ==========================================
    // EXECUTE MODULE INITIALIZATION
    // ==========================================
    renderIndentedTree();

    window.addEventListener('gossip:workspace-changed', () => {
        localStorage.removeItem('chronoql-cb-active-node');
        clearMetadataInspector();
        
        const activeModule = localStorage.getItem('chronoql-os-active-module');
        if (activeModule === 'codebase-explorer') {
            renderIndentedTree();
        }
    });

    window.addEventListener('gossip:module-resumed', (e) => {
        if (e.detail.viewTarget === 'codebase-explorer') {
            renderIndentedTree();
            if (currentDagState) {
                renderLocalizedDAG(currentDagState.targetName, currentDagState.inputs, currentDagState.outputs, currentDagState.nodeType);
            }
        }
    });
};