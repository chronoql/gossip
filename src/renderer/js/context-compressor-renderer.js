/**
 * Chronoql Gossip: Context Compressor Renderer
 * Orchestrates file staging, rule toggling, dynamic token estimation via SQLite,
 * payload compilation, D3.js Indented Tree visualizations, and session token tracking.
 * Features persistent payload staging across application restarts.
 */

window.initContextCompressor = async () => {
    if (!localStorage.getItem('chronoql-cache-nuked-v1')) {
        console.warn('[Context Compressor] Executing one-time surgical cache purge to unlock UI...');
        localStorage.removeItem('chronoql-compressor-staged-files');
        localStorage.setItem('chronoql-cache-nuked-v1', 'true');
    }

    console.log('[Context Compressor] Renderer initialized.');

    // DOM Elements
    const treeContainer = document.getElementById('workspace-file-tree');
    const stagedContainer = document.getElementById('staged-files-container');
    const stagedCountLabel = document.getElementById('staged-file-count');
    const tokenCountLabel = document.getElementById('total-token-count');
    const payloadPreview = document.getElementById('payload-preview-area');
    
    const payloadSavingsLabel = document.getElementById('payload-savings-count');
    const sessionSavingsLabel = document.getElementById('session-savings-count');
    
    const btnRefreshTree = document.getElementById('btn-refresh-tree');
    const btnClearStage = document.getElementById('btn-clear-stage');
    const btnCopyPayload = document.getElementById('btn-copy-payload');
    const btnCopyInstructions = document.getElementById('btn-copy-instructions');
    const btnResetSession = document.getElementById('btn-reset-session');
    
    const folderSelect = document.getElementById('highlight-folder-select');
    const contextSelect = document.getElementById('llm-context-select');

    // LLM Macros
    const btnMacroCodebase = document.getElementById('btn-macro-codebase');
    const btnMacroSchema = document.getElementById('btn-macro-schema');

    // Syntax Legend Elements
    const legendDrawer = document.getElementById('cc-legend-drawer');
    const btnToggleLegend = document.getElementById('btn-toggle-cc-legend');
    const btnCloseLegend = document.getElementById('btn-close-cc-legend');

    // Search Elements
    const searchInput = document.getElementById('cc-tree-search-input');
    const customDropdown = document.getElementById('cc-tree-search-dropdown');
    const btnRegexToggle = document.getElementById('btn-cc-regex-toggle');
    
    let dropdownActiveIndex = -1;
    let isRegexMode = false;
    let searchableFileNames = [];
    let currentTreeRoot = null;

    // Rule Toggles
    const rules = {
        stripWhitespace: document.getElementById('rule-strip-whitespace'),
        removeComments: document.getElementById('rule-remove-comments'),
        minifyJson: document.getElementById('rule-minify-json'),
        xmlTags: document.getElementById('rule-xml-tags')
    };

    // State Management
    let stagedFiles = new Map(); 
    let highlightedFolder = localStorage.getItem('chronoql-compressor-highlight') || '';
    
    // Persistent Session Tracking
    let sessionTokens = parseInt(localStorage.getItem('chronoql-os-session-tokens') || '0', 10);
    let sessionSavedTokens = parseInt(localStorage.getItem('chronoql-os-session-savings') || '0', 10);
    
    let currentSelectionTokens = 0;
    let currentPayloadSavings = 0;

    // ==========================================
    // NATIVE AUDIO SYNTHESIS
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
            console.warn('[Context Compressor] Audio context failed to boot:', e);
        }
    };

    // ==========================================
    // DYNAMIC ENVIRONMENT VARIABLES
    // ==========================================
    
    let maxContextTokens = parseInt(localStorage.getItem('chronoql-os-target-context') || '128000', 10);
    let charsPerToken = 4.0;

    async function loadEnvironmentSettings() {
        if (window.api && window.api.system && window.api.system.getEnvironmentVariables) {
            try {
                const vars = await window.api.system.getEnvironmentVariables();
                if (vars && vars.length > 0) {
                    const charRatioVar = vars.find(v => v.variable_key === 'CHARS_PER_TOKEN_RATIO');
                    if (charRatioVar) charsPerToken = parseFloat(charRatioVar.variable_value);
                    
                    if (!localStorage.getItem('chronoql-os-target-context')) {
                        const maxTokensVar = vars.find(v => v.variable_key === 'MAX_CONTEXT_TOKENS');
                        if (maxTokensVar) {
                            maxContextTokens = parseInt(maxTokensVar.variable_value, 10);
                            if (contextSelect) contextSelect.value = maxContextTokens.toString();
                        }
                    }
                }
            } catch (err) {
                console.error('[Context Compressor] Failed to fetch environment settings from DB:', err);
            }
        }
        updateMaxTokenDisplay(maxContextTokens);
    }

    function updateMaxTokenDisplay(val) {
        const displaySpan = document.getElementById('max-token-display');
        if (!displaySpan) return;
        if (val >= 1000000) {
            displaySpan.textContent = (val / 1000000) + 'M';
        } else {
            displaySpan.textContent = (val / 1000) + 'k';
        }
    }

    if (contextSelect) {
        contextSelect.value = maxContextTokens.toString();
        
        contextSelect.addEventListener('change', (e) => {
            maxContextTokens = parseInt(e.target.value, 10);
            localStorage.setItem('chronoql-os-target-context', maxContextTokens.toString());
            updateMaxTokenDisplay(maxContextTokens);
            orchestrateTokenHUD(); 
        });
    }

    function sanitizeTreeData(node) {
        if (!node) return null;
        if (node.children) {
            node.children = node.children.filter(child => child.name !== '.DS_Store');
            node.children.forEach(sanitizeTreeData);
        }
        return node;
    }

    // ==========================================
    // VU METER ORCHESTRATION
    // ==========================================
    
    const VU_SEGMENTS = 40; 

    function initializeVUMeter() {
        const vuMeter = document.getElementById('vu-meter');
        if (!vuMeter) return;
        
        vuMeter.innerHTML = '';
        for (let i = 0; i < VU_SEGMENTS; i++) {
            const seg = document.createElement('div');
            seg.className = 'vu-segment';
            
            const pct = (i / VU_SEGMENTS) * 100;
            if (pct < 60) seg.classList.add('safe');
            else if (pct < 80) seg.classList.add('warn');
            else seg.classList.add('danger');
            
            vuMeter.appendChild(seg);
        }
    }

    function orchestrateTokenHUD() {
        const totalTokens = sessionTokens + currentSelectionTokens;
        tokenCountLabel.textContent = totalTokens.toLocaleString();

        let percentage = (totalTokens / maxContextTokens) * 100;
        if (percentage > 100) percentage = 100;

        const percentLabel = document.getElementById('token-percentage-label');
        if (percentLabel) {
            percentLabel.textContent = `${percentage.toFixed(1)}% Capacity`;
        }
        
        if (payloadSavingsLabel) {
            payloadSavingsLabel.textContent = `+${currentPayloadSavings.toLocaleString()}`;
        }
        
        if (sessionSavingsLabel) {
            sessionSavingsLabel.textContent = `+${sessionSavedTokens.toLocaleString()}`;
        }

        const vuMeter = document.getElementById('vu-meter');
        if (vuMeter) {
            const segments = vuMeter.children;
            const activeCount = Math.round((percentage / 100) * VU_SEGMENTS);

            for (let i = 0; i < VU_SEGMENTS; i++) {
                if (i < activeCount) {
                    segments[i].classList.add('active');
                } else {
                    segments[i].classList.remove('active');
                }
            }
        }
    }

    // ==========================================
    // UI SETTINGS LOGIC & LEGEND TOGGLE
    // ==========================================

    if (folderSelect) {
        folderSelect.addEventListener('change', (e) => {
            highlightedFolder = e.target.value;
            localStorage.setItem('chronoql-compressor-highlight', highlightedFolder);
            
            if (highlightedFolder && currentTreeRoot) {
                let targetNode = null;
                function findNodeDeep(node) {
                    if (node.data.path === highlightedFolder) targetNode = node;
                    if (targetNode) return;
                    const kids = node._children || node.children;
                    if (kids) kids.forEach(findNodeDeep);
                }

                findNodeDeep(currentTreeRoot);

                if (targetNode) {
                    let current = targetNode.parent;
                    let expandedFolders = JSON.parse(localStorage.getItem('chronoql-compressor-expanded-folders') || '[]');

                    while (current) {
                        if (current._children && !current.children) {
                            current.children = current._children;
                            if (!expandedFolders.includes(current.data.path)) expandedFolders.push(current.data.path);
                        }
                        current = current.parent;
                    }
                    
                    localStorage.setItem('chronoql-compressor-expanded-folders', JSON.stringify(expandedFolders));
                }
            }

            if (typeof window.updateCompressorTree === 'function') {
                window.updateCompressorTree();
                
                setTimeout(() => {
                    if (!highlightedFolder || !currentTreeRoot) return;
                    
                    let targetNode = null;
                    function findNodeDeep(node) {
                        if (node.data.path === highlightedFolder) targetNode = node;
                        if (targetNode) return;
                        const kids = node._children || node.children;
                        if (kids) kids.forEach(findNodeDeep);
                    }
                    findNodeDeep(currentTreeRoot);

                    if (targetNode && treeContainer) {
                        const containerHeight = treeContainer.clientHeight;
                        const physicalY = targetNode.y + 40; 
                        
                        treeContainer.scrollTo({
                            top: Math.max(0, physicalY - (containerHeight / 2)),
                            behavior: 'smooth'
                        });
                    }
                }, 100);
            }
        });
    }

    if (btnToggleLegend && legendDrawer) {
        btnToggleLegend.addEventListener('click', () => {
            legendDrawer.classList.toggle('open');
        });
    }

    if (btnCloseLegend && legendDrawer) {
        btnCloseLegend.addEventListener('click', () => {
            legendDrawer.classList.remove('open');
        });
    }

    function populateFolderSelect(treeData) {
        if (!folderSelect) return;
        
        let folders = [];
        
        function traverse(node) {
            if (node.isDirectory) {
                const isNoisy = node.name.startsWith('.') || /\.(framework|lproj|asar|app|plugin|bundle)/i.test(node.name);
                
                if (!isNoisy) {
                    folders.push({ name: node.name, path: node.path });
                    if (node.children) node.children.forEach(traverse);
                }
            }
        }
        traverse(treeData);
        
        folders.sort((a, b) => a.path.localeCompare(b.path));
        
        folderSelect.innerHTML = '<option value="">None</option>';
        folders.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.path;
            
            const parts = f.path.split(/[\\/]/);
            const displayName = parts.length > 1 ? parts[parts.length - 2] + '/' + parts[parts.length - 1] : f.name;
            
            opt.textContent = displayName + '/';
            if (f.path === highlightedFolder) {
                opt.selected = true;
            }
            folderSelect.appendChild(opt);
        });
    }

    // ==========================================
    // SEARCH ARCHITECTURE
    // ==========================================

    function populateSearchDataArray(rootNode) {
        searchableFileNames = [];
        currentTreeRoot = rootNode;
        function traverseForFiles(node) {
            if (!node.data.isDirectory) {
                searchableFileNames.push({ name: node.data.name, path: node.data.path });
            }
            const kids = node._children || node.children;
            if (kids) kids.forEach(traverseForFiles);
        }
        traverseForFiles(rootNode);
        searchableFileNames.sort((a, b) => a.name.localeCompare(b.name));
    }

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
                matches = searchableFileNames.filter(file => regex.test(file.name));
            } catch (e) {
                customDropdown.innerHTML = '<div class="dropdown-empty" style="color: #ef4444;">Invalid Regular Expression</div>';
                customDropdown.style.display = 'flex';
                return;
            }
        } else {
            const lowerQuery = query.toLowerCase();
            matches = searchableFileNames.filter(file => file.name.toLowerCase().includes(lowerQuery));
        }

        if (matches.length === 0) {
            customDropdown.innerHTML = '<div class="dropdown-empty">No files found matching query.</div>';
            customDropdown.style.display = 'flex';
            return;
        }

        matches.forEach((match, index) => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            
            const shapeClass = getShapeType(match.name, false);
            
            let highlightedText = match.name;
            if (isRegexMode) {
                try {
                    const regex = new RegExp(`(${query})`, 'gi');
                    highlightedText = match.name.replace(regex, '<strong>$1</strong>');
                } catch(e) { }
            } else {
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedQuery})`, 'gi');
                highlightedText = match.name.replace(regex, '<strong>$1</strong>');
            }
            
            item.innerHTML = `<span class="shape-ref shape-${shapeClass}"></span> <span>${highlightedText}</span>`;
            
            item.addEventListener('mouseenter', () => {
                const items = customDropdown.querySelectorAll('.dropdown-item');
                items.forEach(el => el.classList.remove('focused'));
                item.classList.add('focused');
                dropdownActiveIndex = index;
            });

            item.addEventListener('click', () => {
                selectNodeByPath(match.path);
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
                    const targetSpan = items[dropdownActiveIndex].querySelector('span:not(.shape-ref)');
                    const targetName = targetSpan ? targetSpan.textContent : items[dropdownActiveIndex].textContent;
                    
                    const targetFile = searchableFileNames.find(f => f.name === targetName);
                    if (targetFile) selectNodeByPath(targetFile.path);
                    
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

    function selectNodeByPath(targetPath) {
        if (!currentTreeRoot) return;
        
        let targetNode = null;
        function findNodeDeep(node) {
            if (node.data.path === targetPath) targetNode = node;
            if (targetNode) return;
            const kids = node._children || node.children; 
            if (kids) kids.forEach(findNodeDeep);
        }
        
        findNodeDeep(currentTreeRoot);

        if (targetNode) {
            let current = targetNode.parent;
            let needsTreeUpdate = false;
            let expandedFolders = JSON.parse(localStorage.getItem('chronoql-compressor-expanded-folders') || '[]');
            
            while (current) {
                if (current._children && !current.children) {
                    current.children = current._children;
                    if (!expandedFolders.includes(current.data.path)) expandedFolders.push(current.data.path);
                    needsTreeUpdate = true;
                }
                current = current.parent;
            }
            
            if (needsTreeUpdate) {
                localStorage.setItem('chronoql-compressor-expanded-folders', JSON.stringify(expandedFolders));
                if (typeof window.updateCompressorTree === 'function') window.updateCompressorTree();
            }

            setTimeout(() => {
                const targetSelection = d3.selectAll('#workspace-file-tree .node.file')
                  .filter(d => d.data.path === targetPath);
                  
                if (targetNode && treeContainer) {
                    const containerHeight = treeContainer.clientHeight;
                    const physicalY = targetNode.y + 40; 
                    
                    treeContainer.scrollTo({
                        top: Math.max(0, physicalY - (containerHeight / 2)),
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
                    
                    stageSelectedFile(targetPath, targetNode.data.name);
                    
                }, 450); 
                
            }, 100); 
        }
    }


    // ==========================================
    // UNIVERSAL GEOMETRIC SYNTAX ENGINE
    // ==========================================
    function getShapeType(filename, isDirectory) {
        if (isDirectory) return 'rect'; 
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
            const sType = d.shapeType || getShapeType(d.data.name, d.data.isDirectory);
            const colors = getShapeColor(sType);

            if (sType === 'rect') {
                el.append('rect')
                  .attr('width', 16).attr('height', 16)
                  .attr('x', -8).attr('y', -8).attr('rx', 2)
                  .attr('class', 'geometry-node')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'circle') {
                el.append('circle')
                  .attr('r', 8)
                  .attr('class', 'geometry-node')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'pill') {
                el.append('rect')
                  .attr('width', 20).attr('height', 12)
                  .attr('x', -10).attr('y', -6).attr('rx', 6)
                  .attr('class', 'geometry-node')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'diamond') {
                el.append('polygon')
                  .attr('points', '0,-8 8,0 0,8 -8,0')
                  .attr('class', 'geometry-node')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'hex') {
                el.append('polygon')
                  .attr('points', '0,-9 8,-5 8,5 0,9 -8,5 -8,-5')
                  .attr('class', 'geometry-node')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'octagon') {
                el.append('polygon')
                  .attr('points', '3,-8 8,-3 8,3 3,8 -3,8 -8,3 -8,-3 -3,-8')
                  .attr('class', 'geometry-node')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'triangle') {
                 el.append('polygon')
                  .attr('points', '0,-8 8,8 -8,8')
                  .attr('class', 'geometry-node')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else if (sType === 'pentagon') {
                 el.append('polygon')
                  .attr('points', '0,-8 8,-3 5,8 -5,8 -8,-3')
                  .attr('class', 'geometry-node')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            } else {
                el.append('rect')
                  .attr('width', 12).attr('height', 12)
                  .attr('x', -6).attr('y', -6).attr('rx', 1)
                  .attr('class', 'geometry-node')
                  .attr('fill', colors.bg).attr('stroke', colors.border).attr('stroke-width', 2);
            }
        });
    }

    // ==========================================
    // DIRECTORY MAPPING (IPC & D3.js)
    // ==========================================
    
    const loadDirectoryTree = async () => {
        if(!treeContainer) return;
        
        try {
            if (window.api && window.api.compressor) {
                const activeId = localStorage.getItem('chronoql-active-workspace-id');
                const response = await window.api.compressor.getWorkspaceTree(activeId ? { workspaceId: activeId } : undefined);
                
                if (response && response.success && response.data) {
                    const sanitizedData = sanitizeTreeData(response.data);
                    treeContainer.innerHTML = ''; 
                    populateFolderSelect(sanitizedData);
                    renderD3IndentedTree(sanitizedData);
                } else {
                    console.error("[Context Compressor] Tree mapping failed:", response?.error);
                    treeContainer.innerHTML = `
                        <div class="empty-state-container" style="padding: 40px 20px; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                            <svg class="empty-state-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <h3 style="margin: 0 0 8px 0; color: var(--text-color); font-size: 16px;">No Directory Mapped</h3>
                            <p class="empty-state-desc" style="margin: 0;">Navigate to the Workspace Hub to map your source code directory.</p>
                        </div>
                    `;
                }
            } else {
                console.warn('[Context Compressor] IPC bridge offline. Unable to map physical directory.');
            }
        } catch (err) {
            console.error('[Context Compressor]', err);
        }
    };

    function renderD3IndentedTree(treeData) {
        if (!window.d3) {
            console.error("[Context Compressor] D3.js is not loaded.");
            return;
        }

        const container = d3.select("#workspace-file-tree");
        container.selectAll("*").remove();

        const nodeSize = 28;
        
        const svg = container.append("svg")
            .attr("width", "100%")
            .attr("height", 800) 
            .style("font-family", "inherit");

        const g = svg.append("g").attr("transform", "translate(15, 20)");

        const root = d3.hierarchy(treeData);
        let i = 0;

        let expandedFolders = JSON.parse(localStorage.getItem('chronoql-compressor-expanded-folders') || '[]');

        root.eachBefore(d => {
            d.id = ++i;
            d.shapeType = getShapeType(d.data.name, d.data.isDirectory);
            if (d.data.isDirectory && d.children) {
                d._children = d.children;
            }
        });

        root.descendants().forEach(d => {
            if (d.depth > 0 && d.data.isDirectory && d._children) {
                if (!expandedFolders.includes(d.data.path)) {
                    d.children = null; 
                }
            }
        });
        
        populateSearchDataArray(root);

        window.updateCompressorTree = function update(source = root) {
            let index = -1;
            
            root.eachBefore(n => {
                n.x = n.depth * 24;
                n.y = ++index * nodeSize;
            });

            const nodes = root.descendants();
            const links = root.links();
            
            const height = Math.max(500, nodes.length * nodeSize + 40);
            svg.transition().duration(250).attr("height", height);

            const node = g.selectAll("g.node")
                .data(nodes, d => d.id);

            const nodeEnter = node.enter().append("g")
                .attr("class", d => `node ${d.data.isDirectory ? "folder" : "file"}`)
                .attr("transform", d => `translate(${source.x0 || 0},${source.y0 || 0})`)
                .style("opacity", 0)
                .on("click", (event, d) => {
                    if (d.data.isDirectory) {
                        
                        if (d._children) {
                            if (d.children) {
                                d.children = null;
                                expandedFolders = expandedFolders.filter(p => p !== d.data.path);
                            } else {
                                d.children = d._children;
                                if (!expandedFolders.includes(d.data.path)) {
                                    expandedFolders.push(d.data.path);
                                }
                            }
                            localStorage.setItem('chronoql-compressor-expanded-folders', JSON.stringify(expandedFolders));
                            window.updateCompressorTree(d);
                        }
                    } else {
                        stageSelectedFile(d.data.path, d.data.name);
                    }
                });

            nodeEnter.call(appendGeometricShape);

            nodeEnter.append("text")
                .attr("dy", "4px")
                .attr("x", 16)
                .style("font-size", "0.85rem")
                .style("font-weight", d => d.data.isDirectory ? "600" : "400")
                .style("fill", "var(--text-color)")
                .text(d => d.data.name);

            const nodeUpdate = nodeEnter.merge(node);

            nodeUpdate.each(function(d) {
                const isHighlighted = d.data && d.data.isDirectory && d.data.path === highlightedFolder;
                const el = d3.select(this).select('.geometry-node');
                
                if (!el.empty()) {
                    if (isHighlighted) {
                        el.attr('fill', '#ef4444')
                          .attr('stroke', '#991b1b')
                          .attr('stroke-width', 3);
                    } else {
                        const colors = getShapeColor(d.shapeType || getShapeType(d.data.name, d.data.isDirectory));
                        el.attr('fill', colors.bg)
                          .attr('stroke', colors.border)
                          .attr('stroke-width', 2);
                    }
                }
            });

            nodeUpdate.transition()
                .duration(250)
                .attr("transform", d => `translate(${d.x},${d.y})`)
                .style("opacity", 1);

            const nodeExit = node.exit().transition()
                .duration(250)
                .attr("transform", d => `translate(${source.x},${source.y})`)
                .style("opacity", 0)
                .remove();

            const link = g.selectAll("path.link")
                .data(links, d => d.target.id);

            function diagonal({source, target}) {
                return `M ${source.x} ${source.y} V ${target.y} H ${target.x - 8}`;
            }

            const linkEnter = link.enter().insert("path", "g")
                .attr("class", "link")
                .attr("d", d => {
                    const o = {x: source.x0 || 0, y: source.y0 || 0};
                    return diagonal({source: o, target: o});
                });

            const linkUpdate = linkEnter.merge(link);

            linkUpdate.transition()
                .duration(250)
                .attr("d", diagonal);

            link.exit().transition()
                .duration(250)
                .attr("d", d => {
                    const o = {x: source.x, y: source.y};
                    return diagonal({source: o, target: o});
                })
                .remove();

            nodes.forEach(d => {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }

        root.x0 = 0;
        root.y0 = 0;
        window.updateCompressorTree();
    }

    // ==========================================
    // PAYLOAD STAGING LOGIC & FAIL-SAFE HYDRATION
    // ==========================================

    function saveStagedState() {
        const stagedArray = Array.from(stagedFiles.entries()).map(([path, data]) => ({ path, name: data.name }));
        localStorage.setItem('chronoql-compressor-staged-files', JSON.stringify(stagedArray));
    }

    async function hydrateStagedFiles() {
        const savedStr = localStorage.getItem('chronoql-compressor-staged-files');
        if (savedStr) {
            try {
                const savedFiles = JSON.parse(savedStr);
                if (savedFiles.length > 0) {
                    if (payloadPreview) payloadPreview.value = 'Hydrating payload from previous session...';
                    
                    for (const file of savedFiles) {
                        try {
                            const response = await window.api.compressor.readFile(file.path);
                            if (response && response.success) {
                                stagedFiles.set(file.path, { name: file.name, rawContent: response.data });
                            } else {
                                console.warn(`[Context Compressor] Hydration ignored for missing file: ${file.name}`);
                            }
                        } catch (err) {
                            console.warn(`[Context Compressor] IPC Hydration failed for: ${file.name}`);
                        }
                    }
                    updateStageUI();
                } else {
                    updateStageUI();
                }
            } catch (e) {
                console.warn('[Context Compressor] Failed to parse staging data. Purging cache to unlock UI.');
                localStorage.removeItem('chronoql-compressor-staged-files');
                updateStageUI();
            }
        } else {
            updateStageUI();
        }
    }

    async function stageSelectedFile(path, name) {
        if (!stagedFiles.has(path)) {
            try {
                const response = await window.api.compressor.readFile(path);
                if (response.success) {
                    stagedFiles.set(path, { name, rawContent: response.data });
                    saveStagedState();
                    updateStageUI();
                } else {
                    console.error(`[Context Compressor] Failed to read ${name}:`, response.error);
                }
            } catch (err) {
                console.error(`[Context Compressor] IPC read failed:`, err);
            }
        }
    }

    function removeStagedFile(path) {
        stagedFiles.delete(path);
        saveStagedState();
        updateStageUI();
    }

    // ==========================================
    // EVENT LISTENERS & RULE PERSISTENCE
    // ==========================================

    Object.keys(rules).forEach(key => {
        const checkbox = rules[key];
        if (checkbox) {
            const savedState = localStorage.getItem(`chronoql-compressor-rule-${key}`);
            if (savedState !== null) {
                checkbox.checked = (savedState === 'true');
            }
            checkbox.addEventListener('change', (e) => {
                localStorage.setItem(`chronoql-compressor-rule-${key}`, e.target.checked);
                updateStageUI();
            });
        }
    });

    if(btnRefreshTree) btnRefreshTree.addEventListener('click', () => {
        treeContainer.innerHTML = `<div class="tree-loading-state"><span class="loading-text">Mapping workspace tree...</span></div>`;
        loadDirectoryTree();
    });

    if(btnResetSession) {
        btnResetSession.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset the session token counter?')) {
                sessionTokens = 0;
                sessionSavedTokens = 0;
                localStorage.setItem('chronoql-os-session-tokens', '0');
                localStorage.setItem('chronoql-os-session-savings', '0');
                orchestrateTokenHUD();
            }
        });
    }

    if(btnClearStage) btnClearStage.addEventListener('click', () => {
        stagedFiles.clear();
        saveStagedState();
        updateStageUI();
    });

    if(btnCopyInstructions) {
        btnCopyInstructions.addEventListener('click', async () => {
            const instructions = "I am providing one or more files wrapped in XML tags. You must return your entire answer as a single, valid JSON object where the keys are the file paths and the values are the complete, un-truncated updated file contents.";
            try {
                await navigator.clipboard.writeText(instructions);
                playSuctionWhoosh(); 
                const originalText = btnCopyInstructions.innerHTML;
                btnCopyInstructions.innerHTML = 'Copied constraints!';
                setTimeout(() => { btnCopyInstructions.innerHTML = originalText; }, 2000);
            } catch (err) {
                console.error('Failed to copy instructions: ', err);
            }
        });
    }

    if(btnCopyPayload) {
        btnCopyPayload.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(payloadPreview.value);
                playSuctionWhoosh(); 
                
                // Update UI Session State
                sessionTokens += currentSelectionTokens;
                sessionSavedTokens += currentPayloadSavings;
                
                localStorage.setItem('chronoql-os-session-tokens', sessionTokens.toString());
                localStorage.setItem('chronoql-os-session-savings', sessionSavedTokens.toString());
                
                // Accumulate the pending deltas for the SQLite global teardown flush
                let deltaConsumed = parseInt(localStorage.getItem('chronoql-token-delta-consumed') || '0', 10);
                let deltaPayload = parseInt(localStorage.getItem('chronoql-token-delta-payload') || '0', 10);
                let deltaSession = parseInt(localStorage.getItem('chronoql-token-delta-session') || '0', 10);

                deltaConsumed += currentSelectionTokens;
                deltaPayload += currentPayloadSavings; 
                deltaSession += currentPayloadSavings; 

                localStorage.setItem('chronoql-token-delta-consumed', deltaConsumed.toString());
                localStorage.setItem('chronoql-token-delta-payload', deltaPayload.toString());
                localStorage.setItem('chronoql-token-delta-session', deltaSession.toString());

                // ARCHITECTURAL FIX: Auto-clear the stage after successful payload copy
                stagedFiles.clear();
                saveStagedState();
                updateStageUI();

                const originalText = btnCopyPayload.innerHTML;
                btnCopyPayload.innerHTML = 'Payload Copied!';
                setTimeout(() => { btnCopyPayload.innerHTML = originalText; }, 2000);
            } catch (err) {
                console.error('Failed to copy payload: ', err);
            }
        });
    }

    // ==========================================
    // LLM MACRO ENGINE (ONE-CLICK PROMPTS)
    // ==========================================

    function generateTextTree(node, prefix = "") {
        if (!node) return "";
        let result = "";
        const children = node.children || node._children || [];
        
        if (node.depth > 0) {
            const parentChildren = node.parent.children || node.parent._children;
            const isLast = parentChildren.indexOf(node) === parentChildren.length - 1;
            result += prefix + (isLast ? "└── " : "├── ") + node.data.name + "\n";
            prefix += isLast ? "    " : "│   ";
        } else {
            result += node.data.name + "\n";
        }
        
        children.forEach(child => {
            result += generateTextTree(child, prefix);
        });
        return result;
    }

    if (btnMacroCodebase) {
        btnMacroCodebase.addEventListener('click', async () => {
            if (!currentTreeRoot) {
                alert('Please wait for the workspace tree to finish mapping before generating a manifest.');
                return;
            }
            
            const treeText = generateTextTree(currentTreeRoot);
            const prompt = `I am providing my physical directory tree. I need you to orchestrate an enhanced \`codebase.xml\` manifest for my architectural visualizer.\n\nFollow these strict rules:\n1. Wrap the entire output in a root \`<codebase>\` tag.\n2. Mirror my exact directory structure using nested \`<directory name="...">\` and \`<file name="..." status="active">\` tags.\n3. For every file, write a \`<description>\` (its standard purpose) and a \`<visualizer-description>\` (its architectural significance).\n4. Map the execution flow by listing comma-separated dependencies in \`<inputs>\` and downstream consumers in \`<outputs>\`. Use exact filenames. If none, write "None".\n5. Do NOT output markdown formatting around the XML block. Give me the raw XML only.\n\n---\n\n${treeText}`;
            
            try {
                await navigator.clipboard.writeText(prompt);
                playSuctionWhoosh();
                const originalHTML = btnMacroCodebase.innerHTML;
                btnMacroCodebase.innerHTML = 'Copied to Clipboard!';
                setTimeout(() => { btnMacroCodebase.innerHTML = originalHTML; }, 2000);
            } catch (err) {
                console.error('Failed to copy codebase macro:', err);
            }
        });
    }

    // ARCHITECTURAL FIX: Fully Autonomous Schema Fetch
    if (btnMacroSchema) {
        btnMacroSchema.addEventListener('click', async () => {
            let schemaContent = '';
            
            // 1. Attempt to autonomously fetch the schema mapped in the Workspace Hub
            const mappedSchemaPath = localStorage.getItem('chronoql-workspace-schema-path');
            
            if (mappedSchemaPath && window.api && window.api.compressor) {
                try {
                    const res = await window.api.compressor.readFile(mappedSchemaPath);
                    if (res && res.success) {
                        const fileName = mappedSchemaPath.split(/[\\/]/).pop();
                        schemaContent = `--- FILE: ${fileName} ---\n${res.data}\n\n`;
                    }
                } catch (err) {
                    console.warn('[Context Compressor] Failed to read mapped schema. Falling back to stage.', err);
                }
            }

            // 2. Fallback to Staged Files if mapping is missing or failed
            if (!schemaContent) {
                for (const [path, data] of stagedFiles.entries()) {
                    if (data.name.toLowerCase().endsWith('.sql')) {
                        schemaContent += `--- FILE: ${data.name} ---\n${data.rawContent}\n\n`;
                    }
                }
            }
            
            if (!schemaContent) {
                alert('No database schema mapped to this workspace. Please define it in the Workspace Hub, or manually stage your .sql files from the sidebar.');
                return;
            }
            
            const prompt = `I am providing my master database schema(s). I need you to enhance them with specific metadata tags for my architectural visualizer.\n\nFollow these strict rules:\n1. Add an \`-- @domain: [Domain Name]\` tag immediately above every CREATE TABLE statement to logically group related tables (e.g., User Management, Billing, Core System).\n2. Add a standard SQL comment (\`--\`) immediately below the domain tag and above the CREATE TABLE statement explaining the architectural purpose of the table.\n3. CRITICAL: Do NOT leave blank lines between the domain tag, the description comment, and the CREATE TABLE statement. They must be a single contiguous block.\n4. Do NOT alter the actual SQL logic, data types, constraints, or foreign keys. Only inject the comment blocks.\n5. Return the updated SQL files.\n\nExample of the required format:\n\n-- @domain: Authentication\n-- Stores encrypted user credentials and active session states.\nCREATE TABLE IF NOT EXISTS system_users (\n    ...\n\n---\n\n${schemaContent}`;
            
            try {
                await navigator.clipboard.writeText(prompt);
                playSuctionWhoosh();
                const originalHTML = btnMacroSchema.innerHTML;
                btnMacroSchema.innerHTML = 'Copied to Clipboard!';
                setTimeout(() => { btnMacroSchema.innerHTML = originalHTML; }, 2000);
            } catch (err) {
                console.error('Failed to copy schema macro:', err);
            }
        });
    }

    // ==========================================
    // UI UPDATES & COMPILATION
    // ==========================================

    function updateStageUI() {
        if(!stagedContainer) return;
        
        stagedContainer.innerHTML = '';
        stagedCountLabel.textContent = stagedFiles.size;

        if (stagedFiles.size === 0) {
            stagedContainer.innerHTML = `
                <div class="empty-stage-hint">
                    <span>Click files in the sidebar to stage them for the LLM payload.</span>
                </div>
            `;
            payloadPreview.value = '';
            btnCopyPayload.disabled = true;
            
            currentSelectionTokens = 0;
            currentPayloadSavings = 0;
            orchestrateTokenHUD();
            return;
        }

        stagedFiles.forEach((data, path) => {
            const chip = document.createElement('div');
            chip.className = 'token-chip'; 
            chip.innerHTML = `
                <span>${data.name}</span>
                <button type="button" class="btn-remove-token" data-target="${path}">×</button>
            `;
            stagedContainer.appendChild(chip);
        });

        document.querySelectorAll('.btn-remove-token').forEach(btn => {
            btn.addEventListener('click', (e) => {
                removeStagedFile(e.target.getAttribute('data-target'));
            });
        });

        compilePayload();
    }

    function compilePayload() {
        const systemPrompt = "I am providing one or more files wrapped in XML tags. You must return your entire answer as a single, valid JSON object where the keys are the file paths and the values are the complete, un-truncated updated file contents.\n\n";
        
        let finalPayload = systemPrompt;
        let rawBaselinePayload = systemPrompt;

        stagedFiles.forEach((data, path) => {
            
            if (rules.xmlTags.checked) {
                rawBaselinePayload += `<file name="${data.name}" path="${path}">\n${data.rawContent}\n</file>\n\n`;
            } else {
                rawBaselinePayload += `--- FILE: ${path} ---\n${data.rawContent}\n\n`;
            }

            let content = data.rawContent;

            if (rules.removeComments.checked) {
                content = content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
            }
            if (rules.stripWhitespace.checked) {
                content = content.replace(/^\s+|\s+$/gm, ''); 
                content = content.replace(/\n{3,}/g, '\n\n');  
            }
            if (rules.minifyJson.checked && path.endsWith('.json')) {
                try {
                    content = JSON.stringify(JSON.parse(content));
                } catch (e) {
                    console.warn(`Could not minify ${path}: Invalid JSON`);
                }
            }

            if (rules.xmlTags.checked) {
                finalPayload += `<file name="${data.name}" path="${path}">\n${content}\n</file>\n\n`;
            } else {
                finalPayload += `--- FILE: ${path} ---\n${content}\n\n`;
            }
        });

        payloadPreview.value = finalPayload.trim();
        
        const rawTokens = Math.ceil(rawBaselinePayload.length / charsPerToken);
        currentSelectionTokens = Math.ceil(finalPayload.length / charsPerToken);
        
        currentPayloadSavings = rawTokens - currentSelectionTokens;
        if (currentPayloadSavings < 0) currentPayloadSavings = 0;
        
        orchestrateTokenHUD();
        btnCopyPayload.disabled = false;
    }

    // ==========================================
    // ABSOLUTE RESIZERS ORCHESTRATION 
    // ==========================================
    
    // Sidebar Vertical Drag Handle
    const paneResizer = document.getElementById('compressor-pane-resizer');
    let isPaneResizing = false;
    let startX = 0;
    let startWidth = 0;
    let sidebarNode = null;
    let stageNode = null;

    if (paneResizer) {
        const savedWidth = localStorage.getItem('chronoql-compressor-sidebar-width');
        if (savedWidth) {
            document.documentElement.style.setProperty('--compressor-sidebar-width', savedWidth);
        }

        paneResizer.addEventListener('mousedown', (e) => {
            isPaneResizing = true;
            paneResizer.classList.add('is-resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none'; 
            
            startX = e.clientX;
            sidebarNode = document.querySelector('.compressor-sidebar');
            stageNode = document.querySelector('.compressor-stage');
            
            if (sidebarNode) {
                startWidth = sidebarNode.getBoundingClientRect().width;
                sidebarNode.style.setProperty('transition', 'none', 'important');
            }
            if (stageNode) {
                stageNode.style.setProperty('transition', 'none', 'important');
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!isPaneResizing) return;
            
            const deltaX = e.clientX - startX;
            let newWidth = startWidth + deltaX;
            
            if (newWidth < 200) newWidth = 200;
            if (newWidth > 800) newWidth = 800;
            
            document.documentElement.style.setProperty('--compressor-sidebar-width', `${newWidth}px`);
        });

        document.addEventListener('mouseup', () => {
            if (!isPaneResizing) return;
            isPaneResizing = false;
            paneResizer.classList.remove('is-resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            if (sidebarNode) sidebarNode.style.removeProperty('transition');
            if (stageNode) stageNode.style.removeProperty('transition');

            localStorage.setItem('chronoql-compressor-sidebar-width', document.documentElement.style.getPropertyValue('--compressor-sidebar-width'));
        });
    }

    // ARCHITECTURAL UPDATE: Editor Horizontal Drag Handle
    const editorResizer = document.getElementById('editor-horizontal-resizer');
    const editorContainer = document.querySelector('.payload-preview-container');
    let isEditorResizing = false;
    let startEditorY = 0;
    let startEditorHeight = 0;

    if (editorResizer && editorContainer) {
        const savedHeight = localStorage.getItem('chronoql-compressor-editor-height');
        if (savedHeight) {
            editorContainer.style.height = savedHeight;
            editorContainer.style.flex = 'none'; 
        }

        editorResizer.addEventListener('mousedown', (e) => {
            isEditorResizing = true;
            editorResizer.classList.add('is-resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';

            startEditorY = e.clientY;
            startEditorHeight = editorContainer.getBoundingClientRect().height;
            editorContainer.style.setProperty('transition', 'none', 'important');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isEditorResizing) return;
            
            const deltaY = startEditorY - e.clientY; 
            let newHeight = startEditorHeight + deltaY;

            if (newHeight < 100) newHeight = 100; 
            if (newHeight > window.innerHeight * 0.8) newHeight = window.innerHeight * 0.8;

            editorContainer.style.height = `${newHeight}px`;
            editorContainer.style.flex = 'none'; 
        });

        document.addEventListener('mouseup', () => {
            if (!isEditorResizing) return;
            isEditorResizing = false;
            editorResizer.classList.remove('is-resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            editorContainer.style.removeProperty('transition');
            localStorage.setItem('chronoql-compressor-editor-height', editorContainer.style.height);
        });
    }

    // Boot Orchestration Sequence
    (async function boot() {
        await loadEnvironmentSettings();
        initializeVUMeter();
        orchestrateTokenHUD(); 
        await loadDirectoryTree();
        await hydrateStagedFiles();
    })();

    // Listen for cross-module workspace updates
    window.addEventListener('gossip:workspace-changed', () => {
        const activeModule = localStorage.getItem('chronoql-os-active-module');
        if (activeModule === 'context-compressor') {
            treeContainer.innerHTML = `<div class="tree-loading-state"><span class="loading-text">Mapping new workspace tree...</span></div>`;
            stagedFiles.clear();
            saveStagedState();
            updateStageUI();
            loadDirectoryTree();
        }
    });

    window.addEventListener('gossip:module-resumed', (e) => {
        if (e.detail.viewTarget === 'context-compressor') {
            loadDirectoryTree();
        }
    });
};