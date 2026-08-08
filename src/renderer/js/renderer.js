/**
 * Project: Chronoql Gossip
 * Feature: Core OS Shell & View Router
 * Phase: Stage 7 (DOM Caching & State Preservation)
 */

// ==========================================
// GLOBAL EVENT DELEGATION
// ==========================================
document.addEventListener('click', (e) => {
    const btnQuitApp = e.target.closest('#btn-quit-app');
    if (btnQuitApp && window.api && window.api.system) {
        window.api.system.closeWindow();
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Renderer] Booting Gossip OS Router...');

    const mainStageTitle = document.getElementById('macro-view-title');
    const dynamicStage = document.getElementById('dynamic-stage');
    const macroHeaderIcon = document.getElementById('macro-header-icon');

    // ==========================================
    // GLOBAL SIDEBAR ORCHESTRATION (HAMBURGER)
    // ==========================================
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    const sidebarResizer = document.getElementById('sidebar-resizer');

    if (btnToggleSidebar && sidebar) {
        btnToggleSidebar.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            document.body.classList.toggle('sidebar-collapsed');
            
            const isCollapsed = sidebar.classList.contains('collapsed');

            if (sidebarResizer) {
                sidebarResizer.style.pointerEvents = isCollapsed ? 'none' : 'auto';
                sidebarResizer.style.opacity = isCollapsed ? '0' : '1';
            }

            setTimeout(() => {
                const activeNavNode = document.querySelector('.node-minor.active-node');
                
                if (activeNavNode && activeNavNode.dataset.view) {
                    const targetView = activeNavNode.dataset.view;
                    window.dispatchEvent(new CustomEvent('gossip:module-resumed', { 
                        detail: { viewTarget: targetView } 
                    }));
                } else {
                    const fallbackView = localStorage.getItem('chronoql-os-active-module');
                    if (fallbackView) {
                        window.dispatchEvent(new CustomEvent('gossip:module-resumed', { 
                            detail: { viewTarget: fallbackView } 
                        }));
                    }
                }
            }, 310);
        });
    }

    // ==========================================
    // CUSTOM PROMPT MODAL (Bypasses Electron Limitation)
    // ==========================================
    const customPrompt = (titleText, placeholderText) => {
        return new Promise((resolve) => {
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
                width: 420px; border: 1px solid var(--border-color);
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
                display: flex; flex-direction: column; gap: 16px;
            `;

            const label = document.createElement('label');
            label.textContent = titleText;
            label.style.cssText = 'color: var(--text-color); font-weight: 600; font-size: 15px;';

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = placeholderText;
            input.style.cssText = `
                padding: 12px 14px; border-radius: 6px; border: 1px solid var(--border-color);
                background-color: var(--bg-color); color: var(--text-color); font-size: 14px; outline: none;
                transition: border-color 0.2s ease, box-shadow 0.2s ease;
            `;
            input.onfocus = () => {
                input.style.borderColor = 'var(--accent-color)';
                input.style.boxShadow = '0 0 0 3px rgba(56, 189, 248, 0.2)';
            };
            input.onblur = () => {
                input.style.borderColor = 'var(--border-color)';
                input.style.boxShadow = 'none';
            };

            const btnContainer = document.createElement('div');
            btnContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;';

            const btnCancel = document.createElement('button');
            btnCancel.textContent = 'Cancel';
            btnCancel.style.cssText = `
                padding: 8px 16px; background: transparent; border: none;
                color: var(--text-muted); cursor: pointer; font-weight: 600; transition: color 0.2s;
            `;
            btnCancel.onmouseover = () => btnCancel.style.color = 'var(--text-color)';
            btnCancel.onmouseout = () => btnCancel.style.color = 'var(--text-muted)';

            const btnSubmit = document.createElement('button');
            btnSubmit.textContent = 'Create Document';
            btnSubmit.style.cssText = `
                padding: 8px 16px; background-color: var(--accent-color); color: #fff;
                border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: background-color 0.2s;
            `;
            btnSubmit.onmouseover = () => btnSubmit.style.backgroundColor = '#0284c7'; 
            btnSubmit.onmouseout = () => btnSubmit.style.backgroundColor = 'var(--accent-color)';

            const closeModal = (value) => {
                document.body.removeChild(overlay);
                resolve(value);
            };

            btnCancel.onclick = () => closeModal(null);
            btnSubmit.onclick = () => closeModal(input.value);
            input.onkeydown = (e) => {
                if (e.key === 'Enter') btnSubmit.click();
                if (e.key === 'Escape') btnCancel.click();
            };

            btnContainer.appendChild(btnCancel);
            btnContainer.appendChild(btnSubmit);
            modal.appendChild(label);
            modal.appendChild(input);
            modal.appendChild(btnContainer);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            setTimeout(() => input.focus(), 50);
        });
    };

    // ==========================================
    // COMPONENT INJECTION ARCHITECTURE
    // ==========================================

    const fetchComponent = async (url, mountId, initCallback) => {
        try {
            console.log(`[Gossip Core] Orchestrating component fetch: ${url}`);
            const response = await fetch(url);
            if (response.ok) {
                const html = await response.text();
                document.getElementById(mountId).innerHTML = html;
                if (initCallback) await initCallback();
            } else {
                console.warn(`[Gossip Core] Module offline or missing: ${url}`);
            }
        } catch (err) {
            console.error(`[Gossip Core] Exception during component mount (${url}):`, err);
        }
    };

    await fetchComponent('kanban.html', 'kanban-mount', window.initKanbanSystem);
    await fetchComponent('data-management.html', 'data-management-mount', window.initDataManagementSystem);

    // ==========================================
    // GLOBAL SCRATCHPAD ORCHESTRATION & COMPILER
    // ==========================================

    const scratchpadPanel = document.getElementById('global-scratchpad-panel');
    const scratchpadResizer = document.getElementById('scratchpad-resizer');
    const scratchpadTextarea = document.getElementById('scratchpad-textarea');
    const scratchpadPreview = document.getElementById('scratchpad-preview');
    const scratchpadBackdrop = document.getElementById('scratchpad-backdrop');
    
    const scratchpadBodyContainer = document.getElementById('scratchpad-body-container');
    const scratchpadViewButtons = document.querySelectorAll('#scratchpad-view-toggle .segment-btn');
    
    const btnCloseScratchpad = document.getElementById('btn-close-scratchpad');
    const btnClearScratchpad = document.getElementById('btn-clear-scratchpad');
    const btnCopyScratchpad = document.getElementById('btn-copy-scratchpad');
    const scratchpadStatus = document.getElementById('scratchpad-status');
    
    const btnToggleMdGuide = document.getElementById('btn-toggle-md-guide');
    const markdownDrawer = document.getElementById('markdown-drawer');

    let isResizingScratchpad = false;

    // --- Search Bar Engine ---
    const searchBar = document.getElementById('scratchpad-search-bar');
    const searchInput = document.getElementById('scratchpad-search-input');
    const btnSearchPrev = document.getElementById('btn-search-prev');
    const btnSearchNext = document.getElementById('btn-search-next');
    const btnSearchClose = document.getElementById('btn-search-close');
    const searchCounter = document.getElementById('scratchpad-search-counter');
    const btnScratchpadSearch = document.getElementById('btn-scratchpad-search');
    const btnSearchCase = document.getElementById('btn-search-case');

    let searchMatches = [];
    let currentSearchIndex = -1;
    let isCaseSensitive = false;

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

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
            console.warn('[Scratchpad] Audio context failed to boot:', e);
        }
    };

    function compileMarkdownToHTML(markdown) {
        if (!markdown) return '';
        
        let html = markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

        html = html.replace(/^((?:&gt;\s*)*)---+\s*$/gim, '$1<hr>');
        html = html.replace(/^((?:&gt;\s*)*)###### (.*$)/gim, '$1<h6>$2</h6>');
        html = html.replace(/^((?:&gt;\s*)*)##### (.*$)/gim, '$1<h5>$2</h5>');
        html = html.replace(/^((?:&gt;\s*)*)#### (.*$)/gim, '$1<h4>$2</h4>');
        html = html.replace(/^((?:&gt;\s*)*)### (.*$)/gim, '$1<h3>$2</h3>');
        html = html.replace(/^((?:&gt;\s*)*)## (.*$)/gim, '$1<h2>$2</h2>');
        html = html.replace(/^((?:&gt;\s*)*)# (.*$)/gim, '$1<h1>$2</h1>');
        
        html = html.replace(/^((?:&gt;\s*)*)\s*\-\s+(.*$)/gim, '$1<ul><li>$2</li></ul>');
        
        let previousHtml;
        do {
            previousHtml = html;
            html = html.replace(/<\/ul>\n((?:&gt;\s*)*)<ul>/g, '\n$1');
        } while (html !== previousHtml);
        
        const lines = html.split('\n');
        let parsedLines = [];
        let currentDepth = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/^((?:&gt;\s*)+)(.*)/i);

            if (match) {
                const depth = (match[1].match(/&gt;/g) || []).length;
                const content = match[2];

                if (depth > currentDepth) {
                    const diff = depth - currentDepth;
                    parsedLines.push('<blockquote>'.repeat(diff) + content);
                } else if (depth < currentDepth) {
                    const diff = currentDepth - depth;
                    parsedLines.push('</blockquote>'.repeat(diff) + '<br>' + content);
                } else {
                    parsedLines.push('<br>' + content);
                }
                currentDepth = depth;
            } else {
                if (currentDepth > 0) {
                    parsedLines.push('</blockquote>'.repeat(currentDepth));
                    currentDepth = 0;
                }
                parsedLines.push(line);
            }
        }
        
        if (currentDepth > 0) {
            parsedLines.push('</blockquote>'.repeat(currentDepth));
        }

        html = parsedLines.join('\n');
        
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        html = html.replace(/\[([^\]]+)\]\s*\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        const paragraphs = html.split(/\n\n+/);
        html = paragraphs.map(p => {
            const trimmed = p.trim();
            if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<ul') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<hr')) {
                return p;
            }
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('\n');

        html = html.replace(/<blockquote><br>/g, '<blockquote>');
        html = html.replace(/(?:<br>\s*)+(<h[1-6]>|<hr>|<ul>|<pre>|<blockquote>)/g, '$1');
        html = html.replace(/(<\/h[1-6]>|<hr>|<\/ul>|<\/pre>|<\/blockquote>)\s*(?:<br>\s*)+/g, '$1');

        return html;
    }
    
    window.compileMarkdownToHTML = compileMarkdownToHTML;

    const savedScratchpadData = localStorage.getItem('chronoql-os-scratchpad-data');
    if (savedScratchpadData && scratchpadTextarea) {
        scratchpadTextarea.value = savedScratchpadData;
    }

    const savedScratchpadHeight = localStorage.getItem('chronoql-os-scratchpad-height');
    if (savedScratchpadHeight) {
        document.documentElement.style.setProperty('--scratchpad-height', savedScratchpadHeight);
    }

    // --- 3-State Toggle Orchestration ---
    if (scratchpadBodyContainer && scratchpadViewButtons.length > 0) {
        const savedViewState = localStorage.getItem('chronoql-os-scratchpad-view-state') || 'state-edit';
        scratchpadBodyContainer.className = `scratchpad-body ${savedViewState}`;

        if (savedViewState === 'state-split' || savedViewState === 'state-view') {
            if (scratchpadPreview && scratchpadTextarea) {
                scratchpadPreview.innerHTML = compileMarkdownToHTML(scratchpadTextarea.value);
            }
        }

        scratchpadViewButtons.forEach(btn => {
            if (btn.dataset.state === savedViewState) btn.classList.add('active');
            else btn.classList.remove('active');

            btn.addEventListener('click', () => {
                scratchpadViewButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const newState = btn.dataset.state;
                scratchpadBodyContainer.className = `scratchpad-body ${newState}`;
                localStorage.setItem('chronoql-os-scratchpad-view-state', newState);

                if (newState === 'state-split' || newState === 'state-view') {
                    if (scratchpadPreview && scratchpadTextarea) {
                        scratchpadPreview.innerHTML = compileMarkdownToHTML(scratchpadTextarea.value);
                    }
                }

                if ((newState === 'state-edit' || newState === 'state-split') && scratchpadTextarea) {
                    scratchpadTextarea.focus();
                }
            });
        });
    }

    const toggleScratchpad = () => {
        if (!scratchpadPanel) return;
        scratchpadPanel.classList.toggle('collapsed');
        const isOpen = !scratchpadPanel.classList.contains('collapsed');
        localStorage.setItem('chronoql-os-scratchpad-state', isOpen ? 'open' : 'closed');
        
        if (isOpen && scratchpadTextarea && scratchpadBodyContainer) {
            const currentState = scratchpadBodyContainer.classList.contains('state-view') ? 'state-view' : 'state-edit';
            if (currentState !== 'state-view') {
                setTimeout(() => scratchpadTextarea.focus(), 150);
            }
        }
    };

    if (btnToggleMdGuide && markdownDrawer) {
        btnToggleMdGuide.addEventListener('click', () => {
            markdownDrawer.classList.toggle('open');
        });
    }

    // ==========================================
    // SEARCH ENGINE ORCHESTRATION 
    // ==========================================

    if (scratchpadTextarea && scratchpadBackdrop) {
        scratchpadTextarea.addEventListener('scroll', () => {
            scratchpadBackdrop.scrollTop = scratchpadTextarea.scrollTop;
            scratchpadBackdrop.scrollLeft = scratchpadTextarea.scrollLeft;
        });
    }

    if (btnSearchCase) {
        btnSearchCase.addEventListener('click', () => {
            isCaseSensitive = !isCaseSensitive;
            btnSearchCase.classList.toggle('active', isCaseSensitive);
            if (searchInput && searchInput.value) performSearch(true);
        });
    }

    function toggleSearchBar() {
        if (!searchBar) return;
        if (searchBar.style.display === 'none') {
            
            // Steer focus back to an editable mode if searching while locked in Read-Only
            if (scratchpadBodyContainer && scratchpadBodyContainer.classList.contains('state-view')) {
                 const editBtn = document.querySelector('#scratchpad-view-toggle .segment-btn[data-state="state-edit"]');
                 if (editBtn) editBtn.click();
            }
            
            searchBar.style.display = 'flex';
            searchInput.focus();
            if (searchInput.value) performSearch(true);
        } else {
            searchBar.style.display = 'none';
            searchMatches = [];
            currentSearchIndex = -1;
            if (scratchpadBackdrop) scratchpadBackdrop.innerHTML = '';
            scratchpadTextarea.focus();
        }
    }

    function performSearch(keepFocusInSearch = true) {
        const text = scratchpadTextarea.value;
        const query = searchInput.value;
        searchMatches = [];
        currentSearchIndex = -1;

        if (!query || !scratchpadBackdrop) {
            searchCounter.textContent = '0/0';
            if (scratchpadBackdrop) scratchpadBackdrop.innerHTML = '';
            return;
        }

        const flags = isCaseSensitive ? 'g' : 'gi';
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        
        let match;
        while ((match = regex.exec(text)) !== null) {
            searchMatches.push({ start: match.index, end: match.index + match[0].length });
            if (match[0].length === 0) regex.lastIndex++; 
        }

        if (searchMatches.length > 0) {
            currentSearchIndex = 0;
            highlightCurrentMatch(keepFocusInSearch);
        } else {
            searchCounter.textContent = '0/0';
            scratchpadBackdrop.innerHTML = '';
        }
    }

    function highlightCurrentMatch(keepFocusInSearch = true) {
        if (searchMatches.length === 0 || currentSearchIndex < 0 || !scratchpadBackdrop) return;
        
        const text = scratchpadTextarea.value;
        let highlightedHTML = '';
        let lastIndex = 0;

        searchMatches.forEach((match, i) => {
            const isTarget = i === currentSearchIndex;
            const className = isTarget ? 'search-highlight active-match' : 'search-highlight';
            highlightedHTML += escapeHtml(text.substring(lastIndex, match.start));
            const matchText = text.substring(match.start, match.end);
            highlightedHTML += `<span class="${className}">${escapeHtml(matchText)}</span>`;
            lastIndex = match.end;
        });

        highlightedHTML += escapeHtml(text.substring(lastIndex));
        scratchpadBackdrop.innerHTML = highlightedHTML;

        const match = searchMatches[currentSearchIndex];
        const textUpToMatch = text.substring(0, match.start);
        const lines = textUpToMatch.split('\n');
        
        const lineHeight = 20.8; 
        scratchpadTextarea.scrollTop = Math.max(0, ((lines.length - 1) * lineHeight) - 50);

        searchCounter.textContent = `${currentSearchIndex + 1}/${searchMatches.length}`;

        if (!keepFocusInSearch) {
            scratchpadTextarea.focus();
        } else if (document.activeElement !== searchInput) {
            searchInput.focus();
        }
    }

    if (btnScratchpadSearch) btnScratchpadSearch.addEventListener('click', toggleSearchBar);
    if (btnSearchClose) btnSearchClose.addEventListener('click', toggleSearchBar);

    if (searchInput) {
        searchInput.addEventListener('input', () => performSearch(true));
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (searchMatches.length === 0) return;
                if (e.shiftKey) currentSearchIndex = (currentSearchIndex - 1 + searchMatches.length) % searchMatches.length;
                else currentSearchIndex = (currentSearchIndex + 1) % searchMatches.length;
                highlightCurrentMatch(true);
            } else if (e.key === 'Escape') {
                toggleSearchBar();
            }
        });
    }

    if (btnSearchPrev) {
        btnSearchPrev.addEventListener('click', () => {
            if (searchMatches.length === 0) return;
            currentSearchIndex = (currentSearchIndex - 1 + searchMatches.length) % searchMatches.length;
            highlightCurrentMatch(true);
        });
    }

    if (btnSearchNext) {
        btnSearchNext.addEventListener('click', () => {
            if (searchMatches.length === 0) return;
            currentSearchIndex = (currentSearchIndex + 1) % searchMatches.length;
            highlightCurrentMatch(true);
        });
    }

    if (scratchpadPreview) {
        scratchpadPreview.addEventListener('click', (e) => {
            const anchor = e.target.closest('a');
            if (anchor && anchor.href) {
                e.preventDefault();
                if (window.api && window.api.system && window.api.system.openExternal) {
                    window.api.system.openExternal(anchor.href);
                }
            }
        });
    }

    if (btnCopyScratchpad) {
        btnCopyScratchpad.addEventListener('click', async () => {
            if (!scratchpadTextarea) return;
            try {
                await navigator.clipboard.writeText(scratchpadTextarea.value);
                playSuctionWhoosh(); 
                
                if (scratchpadStatus) {
                    const originalText = scratchpadStatus.textContent;
                    scratchpadStatus.textContent = 'Copied to clipboard!';
                    setTimeout(() => {
                        if (scratchpadStatus.textContent === 'Copied to clipboard!') {
                            scratchpadStatus.textContent = originalText;
                        }
                    }, 2000);
                }
            } catch (err) {
                console.error('[Scratchpad] Failed to copy text: ', err);
            }
        });
    }

    if (scratchpadResizer) {
        scratchpadResizer.addEventListener('mousedown', (e) => {
            isResizingScratchpad = true;
            scratchpadResizer.classList.add('is-resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizingScratchpad) return;
            const bottomPanel = document.getElementById('panel-2-bottom');
            const bottomOffset = bottomPanel ? bottomPanel.offsetHeight : 40;
            let newHeight = window.innerHeight - e.clientY - bottomOffset;
            if (newHeight < 100) newHeight = 100;
            if (newHeight > window.innerHeight * 0.8) newHeight = window.innerHeight * 0.8;
            document.documentElement.style.setProperty('--scratchpad-height', `${newHeight}px`);
        });

        document.addEventListener('mouseup', () => {
            if (isResizingScratchpad) {
                isResizingScratchpad = false;
                scratchpadResizer.classList.remove('is-resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem('chronoql-os-scratchpad-height', document.documentElement.style.getPropertyValue('--scratchpad-height'));
            }
        });
    }

    let saveTimeout;
    if (scratchpadTextarea) {
        scratchpadTextarea.addEventListener('input', () => {
            if (scratchpadStatus) scratchpadStatus.textContent = 'Saving...';
            if (searchBar && searchBar.style.display !== 'none' && searchInput && searchInput.value) performSearch(true);

            // Execute Live Compilation if Split View is active
            if (scratchpadBodyContainer && scratchpadBodyContainer.classList.contains('state-split')) {
                 scratchpadPreview.innerHTML = compileMarkdownToHTML(scratchpadTextarea.value);
            }

            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                localStorage.setItem('chronoql-os-scratchpad-data', scratchpadTextarea.value);
                if (scratchpadStatus) scratchpadStatus.textContent = 'Saved locally';
            }, 500);
        });
    }

    if (btnCloseScratchpad) btnCloseScratchpad.addEventListener('click', toggleScratchpad);

    if (btnClearScratchpad) {
        btnClearScratchpad.addEventListener('click', () => {
            if (confirm('Clear the global scratchpad? This cannot be undone.')) {
                if (scratchpadTextarea) scratchpadTextarea.value = '';
                localStorage.setItem('chronoql-os-scratchpad-data', '');
                if (scratchpadStatus) scratchpadStatus.textContent = 'Cleared';
                
                const currentState = localStorage.getItem('chronoql-os-scratchpad-view-state');
                if (currentState === 'state-split' || currentState === 'state-view') {
                     scratchpadPreview.innerHTML = '';
                }
                
                if (searchBar && searchBar.style.display !== 'none') performSearch(true);
            }
        });
    }

    // ==========================================
    // GLOBAL COMMAND PALETTE ENGINE
    // ==========================================
    
    const paletteOverlay = document.getElementById('omni-palette-overlay');
    const paletteInput = document.getElementById('omni-palette-input');
    const paletteResults = document.getElementById('omni-palette-results');
    const btnTriggerPalette = document.getElementById('btn-trigger-palette');

    let searchDebounceTimeout;
    let paletteActiveIndex = -1;
    let currentPaletteDocs = [];

    const closePalette = () => {
        if (!paletteOverlay) return;
        paletteOverlay.style.display = 'none';
        if (paletteInput) paletteInput.value = '';
        if (paletteResults) paletteResults.innerHTML = '';
        paletteActiveIndex = -1;
    };

    const openPalette = () => {
        if (!paletteOverlay) return;
        paletteOverlay.style.display = 'flex';
        if (paletteInput) paletteInput.focus();
        executePaletteSearch(''); // Initial hydration
    };

    if (btnTriggerPalette) {
        btnTriggerPalette.addEventListener('click', openPalette);
    }

    const executePaletteSearch = async (query) => {
        if (!window.api || !window.api.architecture || !paletteResults) return;
        
        try {
            const res = await window.api.architecture.searchDocs(null, query); 
            
            paletteResults.innerHTML = '';
            currentPaletteDocs = [];
            paletteActiveIndex = -1;

            if (res.success && res.data && res.data.length > 0) {
                currentPaletteDocs = res.data;
                
                res.data.forEach((doc, idx) => {
                    const item = document.createElement('div');
                    item.className = 'omni-result-item';
                    
                    if (idx === 0) {
                        item.classList.add('active');
                        paletteActiveIndex = 0;
                    }
                    
                    item.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        <span>${escapeHtml(doc.title)}</span>
                    `;
                    
                    item.addEventListener('mouseenter', () => {
                        document.querySelectorAll('.omni-result-item').forEach(el => el.classList.remove('active'));
                        item.classList.add('active');
                        paletteActiveIndex = idx;
                    });

                    item.addEventListener('click', () => {
                        closePalette();
                        
                        // ARCHITECTURAL FIX: Route to Architecture Workspace, not the doc_id directly
                        localStorage.setItem('chronoql-os-last-arch-doc', doc.doc_id);
                        
                        clearActiveMinorNodes();
                        const archNode = document.querySelector('[data-view="architecture-workspace"]');
                        if (archNode) {
                            archNode.classList.add('active-node');
                            const parentList = archNode.closest('.node-minor-list');
                            if (parentList) {
                                parentList.classList.add('expanded');
                                saveNavState();
                            }
                        }
                        
                        routeToView('architecture-workspace', 'Architecture Workspace');
                    });

                    paletteResults.appendChild(item);
                });
            } else {
                paletteResults.innerHTML = `
                    <div style="padding: 16px 20px; color: var(--text-muted); font-size: 14px; font-style: italic;">
                        No documents found.
                    </div>
                `;
            }
        } catch (error) {
            console.error('[Command Palette] Search failed:', error);
        }
    };

    if (paletteInput) {
        paletteInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimeout);
            searchDebounceTimeout = setTimeout(() => executePaletteSearch(e.target.value), 150);
        });

        paletteInput.addEventListener('keydown', (e) => {
            const items = document.querySelectorAll('.omni-result-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (paletteActiveIndex < items.length - 1) {
                    if (paletteActiveIndex >= 0) items[paletteActiveIndex].classList.remove('active');
                    paletteActiveIndex++;
                    items[paletteActiveIndex].classList.add('active');
                    items[paletteActiveIndex].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (paletteActiveIndex > 0) {
                    items[paletteActiveIndex].classList.remove('active');
                    paletteActiveIndex--;
                    items[paletteActiveIndex].classList.add('active');
                    items[paletteActiveIndex].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (paletteActiveIndex >= 0 && currentPaletteDocs[paletteActiveIndex]) {
                    const doc = currentPaletteDocs[paletteActiveIndex];
                    closePalette();
                    
                    // ARCHITECTURAL FIX: Route to Architecture Workspace, not the doc_id directly
                    localStorage.setItem('chronoql-os-last-arch-doc', doc.doc_id);
                    
                    clearActiveMinorNodes();
                    const archNode = document.querySelector('[data-view="architecture-workspace"]');
                    if (archNode) {
                        archNode.classList.add('active-node');
                        const parentList = archNode.closest('.node-minor-list');
                        if (parentList) {
                            parentList.classList.add('expanded');
                            saveNavState();
                        }
                    }
                    
                    routeToView('architecture-workspace', 'Architecture Workspace');
                }
            }
        });
    }

    if (paletteOverlay) {
        paletteOverlay.addEventListener('click', (e) => {
            if (e.target === paletteOverlay) closePalette();
        });
    }

    // ==========================================
    // GLOBAL KEYBOARD ORCHESTRATION
    // ==========================================

    document.addEventListener('keydown', (e) => {
        const isMac = navigator.userAgent.toLowerCase().includes('mac');
        const modifierKey = isMac ? e.metaKey : e.ctrlKey;
        
        const isQuickTasksShortcut = modifierKey && !e.shiftKey && e.key.toLowerCase() === 't';
        const isScratchpadShortcut = modifierKey && e.shiftKey && e.key.toLowerCase() === 's';
        
        const isMdGuideShortcut = modifierKey && !e.shiftKey && e.key === '/';
        
        const isSearchShortcut = modifierKey && !e.shiftKey && e.key.toLowerCase() === 'f';
        const isFindNextShortcut = modifierKey && !e.shiftKey && e.key.toLowerCase() === 'g';
        const isFindPrevShortcut = modifierKey && e.shiftKey && e.key.toLowerCase() === 'g';
        const isMatchCaseShortcut = e.altKey && e.key.toLowerCase() === 'c';
        
        const isPaletteShortcut = modifierKey && !e.shiftKey && e.key.toLowerCase() === 'p';
        const isLegendShortcut = modifierKey && !e.shiftKey && e.key.toLowerCase() === 'l';
        
        if (isPaletteShortcut) {
            e.preventDefault(); 
            if (paletteOverlay && paletteOverlay.style.display === 'none') {
                openPalette();
            } else {
                closePalette();
            }
        }

        if (isLegendShortcut) {
            e.preventDefault();
            const activeModule = localStorage.getItem('chronoql-os-active-module');
            
            if (activeModule === 'codebase-explorer') {
                const btnCb = document.getElementById('btn-toggle-cb-legend');
                if (btnCb) btnCb.click();
            } else if (activeModule === 'schema-visualizer') {
                const btnSchema = document.getElementById('btn-toggle-schema-legend');
                if (btnSchema) btnSchema.click();
            }
        }

        if (e.key === 'Escape') {
            if (paletteOverlay && paletteOverlay.style.display !== 'none') {
                closePalette();
            } else if (markdownDrawer && markdownDrawer.classList.contains('open')) {
                markdownDrawer.classList.remove('open');
            }
        }

        if (isQuickTasksShortcut) {
            e.preventDefault(); 
            const qtPanel = document.getElementById('todo-sidebar-panel');
            const qtInput = document.getElementById('todo-quick-input');
            if (qtPanel) {
                qtPanel.classList.toggle('collapsed');
                const isOpen = !qtPanel.classList.contains('collapsed');
                localStorage.setItem('chronoql-os-qt-state', isOpen ? 'open' : 'closed');
                if (isOpen && qtInput) setTimeout(() => qtInput.focus(), 100);
            }
        }

        if (isScratchpadShortcut) {
            e.preventDefault();
            toggleScratchpad();
        }

        if (isMdGuideShortcut) {
            e.preventDefault();
            if (markdownDrawer) markdownDrawer.classList.toggle('open');
        }

        if (isSearchShortcut && scratchpadPanel && !scratchpadPanel.classList.contains('collapsed')) {
            e.preventDefault();
            if (searchBar && searchBar.style.display === 'none') {
                toggleSearchBar();
            } else if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }

        if (isMatchCaseShortcut && searchBar && searchBar.style.display !== 'none') {
            e.preventDefault();
            if (btnSearchCase) btnSearchCase.click();
        }

        if (isFindNextShortcut && searchBar && searchBar.style.display !== 'none') {
            e.preventDefault();
            if (btnSearchNext) btnSearchNext.click();
        }

        if (isFindPrevShortcut && searchBar && searchBar.style.display !== 'none') {
            e.preventDefault();
            if (btnSearchPrev) btnSearchPrev.click();
        }
    });

    // ==========================================
    // DOM CACHE ROUTER & ORCHESTRATION
    // ==========================================

    function clearActiveMinorNodes() {
        document.querySelectorAll('.node-minor').forEach(n => {
            n.classList.remove('active-node');
        });
    }

    function saveNavState() {
        const expandedCategories = [];
        document.querySelectorAll('.node-minor-list.expanded').forEach(list => {
            const majorNode = list.previousElementSibling;
            if (majorNode) {
                const titleSpan = majorNode.querySelector('span');
                if (titleSpan) expandedCategories.push(titleSpan.innerText.trim());
            }
        });
        localStorage.setItem('chronoql-os-nav-state', JSON.stringify(expandedCategories));
    }

    const savedNavState = localStorage.getItem('chronoql-os-nav-state');
    if (savedNavState) {
        try {
            const expandedCategories = JSON.parse(savedNavState);
            document.querySelectorAll('.node-major').forEach(node => {
                const titleSpan = node.querySelector('span');
                const minorList = node.nextElementSibling;
                if (titleSpan && minorList && minorList.classList.contains('node-minor-list')) {
                    if (expandedCategories.includes(titleSpan.innerText.trim())) {
                        minorList.classList.add('expanded');
                    } else {
                        minorList.classList.remove('expanded');
                    }
                }
            });
        } catch(e) {
            console.warn('[Router] Failed to parse nav state', e);
        }
    }

    document.querySelectorAll('.node-major').forEach(node => {
        node.addEventListener('click', (e) => {
            const minorList = e.currentTarget.nextElementSibling;
            if (minorList && minorList.classList.contains('node-minor-list')) {
                minorList.classList.toggle('expanded');
                saveNavState();
            }
        });
    });

    const routeToView = (viewTarget, nodeText) => {
        localStorage.setItem('chronoql-os-active-module', viewTarget);
        localStorage.setItem('chronoql-os-active-module-title', nodeText || 'Architecture Workspace');

        if (macroHeaderIcon) macroHeaderIcon.innerHTML = ''; 

        // Hide all current children in dynamic-stage to cache their state
        Array.from(dynamicStage.children).forEach(child => {
            child.style.display = 'none';
        });

        // 1. External/Legacy Handlers
        if (viewTarget === 'kanban-board') {
            mainStageTitle.innerText = 'Kanban Orchestration';
            if (window.loadKanbanBoard) window.loadKanbanBoard();
            return;
        } 
        if (viewTarget === 'data-management') {
            mainStageTitle.innerText = 'Data Management';
            if (window.loadDataManagement) window.loadDataManagement();
            return;
        }

        // 2. Identify Internal Module
        let moduleName = '';
        if (viewTarget === 'architecture-workspace' || (viewTarget && viewTarget.startsWith('doc-'))) {
            moduleName = 'architecture';
            mainStageTitle.innerText = 'Architecture Workspace';
        } else if (viewTarget === 'context-compressor') {
            moduleName = 'context-compressor';
            mainStageTitle.innerText = 'Context Compressor';
            if (macroHeaderIcon) macroHeaderIcon.innerHTML = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.9; margin-left: 8px;"><circle cx="5" cy="4" r="2"></circle><circle cx="5" cy="9" r="2"></circle><circle cx="5" cy="14" r="2"></circle><rect x="17" y="7" width="4" height="4" rx="1"></rect><path d="M 7 4 C 11 4, 12 9, 17 9"></path><path d="M 7 14 C 11 14, 12 9, 17 9"></path><path d="M 7 9 L 17 9"></path><line x1="5" y1="20" x2="19" y2="20"></line><polyline points="16 17 19 20 16 23"></polyline></svg>`;
        } else if (viewTarget === 'payload-integrator') {
            moduleName = 'payload-integrator';
            mainStageTitle.innerText = 'Payload Integrator';
            if (macroHeaderIcon) macroHeaderIcon.innerHTML = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.9; margin-left: 8px; overflow: visible;"><rect x="17" y="7" width="4" height="4" rx="1"></rect><circle cx="5" cy="4" r="2"></circle><circle cx="5" cy="9" r="2"></circle><circle cx="5" cy="14" r="2"></circle><path d="M 17 9 C 13 9, 12 4, 7 4"></path><path d="M 17 9 C 13 9, 12 14, 7 14"></path><path d="M 17 9 L 7 9"></path><line x1="19" y1="21" x2="5" y2="21"></line><polyline points="8 18 5 21 8 24"></polyline></svg>`;
        } else if (viewTarget === 'codebase-explorer') {
            moduleName = 'codebase-explorer';
            mainStageTitle.innerText = 'Codebase Explorer';
            if (macroHeaderIcon) macroHeaderIcon.innerHTML = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.9; margin-left: 8px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
        } else if (viewTarget === 'schema-visualizer') {
            moduleName = 'schema-visualizer';
            mainStageTitle.innerText = 'Schema Visualizer';
            if (macroHeaderIcon) macroHeaderIcon.innerHTML = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.9; margin-left: 8px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`;
        } else if (viewTarget === 'workspace-admin') {
            moduleName = 'workspace-admin';
            mainStageTitle.innerText = 'Workspace Hub';
            if (macroHeaderIcon) macroHeaderIcon.innerHTML = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.9; margin-left: 8px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
        } else {
            mainStageTitle.innerText = nodeText;
            let fallbackNode = document.getElementById('mount-offline-fallback');
            if (!fallbackNode) {
                fallbackNode = document.createElement('div');
                fallbackNode.id = 'mount-offline-fallback';
                fallbackNode.className = 'empty-state-container';
                dynamicStage.appendChild(fallbackNode);
            }
            fallbackNode.innerHTML = `<svg class="empty-state-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <h3>${nodeText}</h3><p class="empty-state-desc">This module is currently offline.</p>`;
            fallbackNode.style.display = 'flex';
            return;
        }

        // 3. Mount or Resume via Cache
        const mountId = `mount-cache-${moduleName}`;
        let targetMount = document.getElementById(mountId);

        if (targetMount) {
            targetMount.style.display = 'block';
            window.dispatchEvent(new CustomEvent('gossip:module-resumed', { detail: { viewTarget, nodeText } }));
        } else {
            targetMount = document.createElement('div');
            targetMount.id = mountId;
            targetMount.style.width = '100%';
            targetMount.style.height = '100%';
            dynamicStage.appendChild(targetMount);

            targetMount.innerHTML = `<div class="empty-state-container"><span class="loading-text" style="color: var(--text-muted); font-style: italic;">Mounting ${mainStageTitle.innerText}...</span></div>`;

            let fetchUrl = `${moduleName}.html`;
            
            fetch(fetchUrl)
                .then(res => res.text())
                .then(html => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    
                    let containerClass = '.integrator-container';
                    if (moduleName === 'context-compressor') containerClass = '.compressor-container';
                    if (moduleName === 'architecture') containerClass = '.architecture-container';
                    if (moduleName === 'codebase-explorer') containerClass = '.explorer-container';
                    if (moduleName === 'schema-visualizer') containerClass = '.schema-container';
                    if (moduleName === 'workspace-admin') containerClass = '.admin-container';
                    
                    const container = doc.querySelector(containerClass);
                    targetMount.innerHTML = '';
                    if (container) targetMount.appendChild(container);
                    else targetMount.innerHTML = html;

                    const scriptName = `js/${moduleName}-renderer.js`;
                    if (!document.querySelector(`script[src="${scriptName}"]`)) {
                        const script = document.createElement('script');
                        script.src = scriptName;
                        script.onload = () => { 
                            if (moduleName === 'context-compressor' && window.initContextCompressor) window.initContextCompressor();
                            if (moduleName === 'payload-integrator' && window.loadPayloadIntegrator) window.loadPayloadIntegrator();
                            if (moduleName === 'architecture' && window.initArchitectureSystem) window.initArchitectureSystem();
                            if (moduleName === 'codebase-explorer' && window.initCodebaseExplorer) window.initCodebaseExplorer();
                            if (moduleName === 'schema-visualizer' && window.initSchemaVisualizer) window.initSchemaVisualizer();
                            if (moduleName === 'workspace-admin' && window.initWorkspaceAdmin) window.initWorkspaceAdmin();
                        };
                        document.body.appendChild(script);
                    } else {
                        if (moduleName === 'context-compressor' && window.initContextCompressor) window.initContextCompressor();
                        if (moduleName === 'payload-integrator' && window.loadPayloadIntegrator) window.loadPayloadIntegrator();
                        if (moduleName === 'architecture' && window.initArchitectureSystem) window.initArchitectureSystem();
                        if (moduleName === 'codebase-explorer' && window.initCodebaseExplorer) window.initCodebaseExplorer();
                        if (moduleName === 'schema-visualizer' && window.initSchemaVisualizer) window.initSchemaVisualizer();
                        if (moduleName === 'workspace-admin' && window.initWorkspaceAdmin) window.initWorkspaceAdmin();
                    }
                })
                .catch(err => { 
                    targetMount.innerHTML = `<div class="empty-state-container"><h3>Load Error</h3><p class="empty-state-desc">Failed to mount module.</p></div>`; 
                });
        }

        console.log(`[Gossip Router] Navigated to: ${viewTarget}`);
    };

    document.querySelectorAll('.node-minor').forEach(node => {
        node.addEventListener('click', (e) => {
            clearActiveMinorNodes();
            node.classList.add('active-node');
            routeToView(node.getAttribute('data-view'), node.innerText);
        });
    });

    const btnDataManagement = document.getElementById('btn-data-management');
    if (btnDataManagement) {
        btnDataManagement.addEventListener('click', () => {
            clearActiveMinorNodes();
            routeToView('data-management', 'Data & Exports');
        });
    }

    // ==========================================
    // MULTI-WINDOW DOCUMENTATION & ABOUT
    // ==========================================
    
    const btnDocumentation = document.getElementById('btn-documentation');
    if (btnDocumentation) {
        btnDocumentation.addEventListener('click', () => {
            if (window.api && window.api.system) {
                window.api.system.openChildWindow({ url: 'documentation.html', width: 1050, height: 800 });
            }
        });
    }

    const btnAbout = document.getElementById('btn-about');
    if (btnAbout) {
        btnAbout.addEventListener('click', () => {
            if (window.api && window.api.system) {
                window.api.system.openChildWindow({ url: 'about.html', width: 540, height: 680 });
            }
        });
    }
    
    const btnMore = document.getElementById('btn-more');
    if (btnMore) {
        btnMore.addEventListener('click', () => {
            if (window.api && window.api.system) {
                window.api.system.openChildWindow({ url: 'license.html', width: 600, height: 750 });
            }
        });
    }

    // ==========================================
    // OMNI BUTTON ORCHESTRATION
    // ==========================================
    const omniBtn = document.getElementById('omni-add-btn');
    const omniMenu = document.getElementById('omni-dropdown-menu');
    const omniWrapper = document.querySelector('.omni-dropdown-wrapper');

    if (omniBtn && omniMenu && omniWrapper) {
        omniBtn.addEventListener('click', (e) => {
            omniMenu.classList.toggle('active');
            e.stopPropagation(); 
        });

        document.addEventListener('click', (e) => {
            if (!omniWrapper.contains(e.target)) omniMenu.classList.remove('active');
        });

        document.querySelectorAll('.omni-menu-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                const action = e.currentTarget.getAttribute('data-action');
                omniMenu.classList.remove('active');

                if (action === 'new-kanban-card') {
                    if (window.api && window.api.kanban) {
                        try {
                            const projects = await window.api.kanban.getProjects();
                            if (!projects || projects.length === 0) return;
                            const projectId = projects[0].project_id || projects[0].projectId || projects[0].id;
                            const cols = await window.api.kanban.getColumns(projectId);
                            const colArray = Array.isArray(cols) ? cols : (cols.data || []);
                            
                            if (colArray.length > 0) {
                                colArray.sort((a, b) => (a.position_index || a.positionIndex || 0) - (b.position_index || b.positionIndex || 0));
                                const targetColId = colArray[0].column_id || colArray[0].columnId || colArray[0].id;
                                
                                await window.api.kanban.createCard({
                                    columnId: targetColId, cardTitle: 'New Task', cardContent: '', cardColor: '#ffffff', textColor: '#172b4d', positionIndex: 0
                                });
                                
                                clearActiveMinorNodes();
                                const kanbanNode = document.querySelector('[data-view="kanban-board"]');
                                if (kanbanNode) kanbanNode.classList.add('active-node');
                                routeToView('kanban-board', 'Kanban Orchestration');
                                if (window.loadKanbanBoard) window.loadKanbanBoard();
                            }
                        } catch (err) { console.error('[Omni Router] Failed to orchestrate new Kanban card:', err); }
                    }
                } else if (action === 'open-scratchpad') {
                    toggleScratchpad();
                } else if (action === 'new-architecture-doc') {
                    if (window.api && window.api.architecture) {
                        const title = await customPrompt('Document Title', 'Enter a title (e.g., GSAR Migration Spec)...');
                        if (title && title.trim() !== '') {
                            const res = await window.api.architecture.createDoc(title.trim(), 'Specification');
                            if (res.success) {
                                clearActiveMinorNodes();
                                const newNode = document.querySelector(`[data-view="architecture-workspace"]`);
                                if (newNode) {
                                    newNode.classList.add('active-node');
                                    const parentList = newNode.closest('.node-minor-list');
                                    if (parentList) {
                                        parentList.classList.add('expanded');
                                        saveNavState();
                                    }
                                }
                                routeToView(res.data.doc_id, res.data.title);
                            }
                        }
                    }
                }
            });
        });
    }

    // ==========================================
    // QUICK TASKS ORCHESTRATION
    // ==========================================

    const qtPanel = document.getElementById('todo-sidebar-panel');
    const qtBtnToggle = document.getElementById('btn-toggle-todos');
    const qtBtnClose = document.getElementById('btn-close-todos');
    const qtBtnOpenKanban = document.getElementById('btn-open-kanban-board');
    const qtInput = document.getElementById('todo-quick-input');
    const qtBtnAdd = document.getElementById('todo-add-btn');
    const qtList = document.getElementById('todo-list-container');

    let quickTasksProjectId = null;
    let quickTasksColumnId = null;

    async function setupQuickTasksSystem() {
        try {
            if (!window.api || !window.api.kanban) return;
            const projects = await window.api.kanban.getProjects();
            let qtProject = projects.find(p => (p.project_name || p.projectName || '').toLowerCase() === 'my quick tasks');
            
            if (!qtProject) {
                const res = await window.api.kanban.createProject({ projectName: 'My Quick Tasks', backgroundColor: '#0f172a' });
                quickTasksProjectId = res.projectId || res.project_id || res.id;
                const colRes = await window.api.kanban.createColumn({ projectId: quickTasksProjectId, columnName: 'To Do', positionIndex: 0 });
                quickTasksColumnId = colRes.columnId || colRes.column_id || colRes.id;
            } else {
                quickTasksProjectId = qtProject.project_id || qtProject.projectId || qtProject.id;
                const cols = await window.api.kanban.getColumns(quickTasksProjectId);
                const colArray = Array.isArray(cols) ? cols : (cols.data || []);
                if (colArray.length === 0) {
                    const colRes = await window.api.kanban.createColumn({ projectId: quickTasksProjectId, columnName: 'To Do', positionIndex: 0 });
                    quickTasksColumnId = colRes.columnId || colRes.column_id || colRes.id;
                } else {
                    colArray.sort((a, b) => (a.position_index || a.positionIndex || 0) - (b.position_index || b.positionIndex || 0));
                    quickTasksColumnId = colArray[0].column_id || colArray[0].columnId || colArray[0].id;
                }
            }
            await loadQuickTasks();
        } catch (err) { console.error('[Quick Tasks] Initialization failed:', err); }
    }

    async function loadQuickTasks() {
        if (!quickTasksColumnId) return;
        qtList.innerHTML = '';
        const cards = await window.api.kanban.getCards(quickTasksColumnId);
        const cardArray = Array.isArray(cards) ? cards : (cards.data || []);
        
        cardArray.forEach(card => {
            const id = card.card_id || card.cardId || card.id;
            const title = card.card_title || card.cardTitle || 'Untitled';
            const item = document.createElement('div');
            item.className = 'todo-item';
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                    <button class="btn-todo-action btn-delete-task" data-id="${id}" title="Delete Task" style="color: var(--danger-color); padding: 2px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <span class="todo-text" contenteditable="true" spellcheck="false" title="Click to rename task">${escapeHtml(title)}</span>
            `;
            
            item.querySelector('.btn-delete-task').addEventListener('click', async () => {
                item.classList.add('completing');
                setTimeout(async () => {
                    await window.api.kanban.deleteCard(id);
                    await loadQuickTasks();
                    if (window.syncKanbanBoard) window.syncKanbanBoard();
                }, 200);
            });

            const textSpan = item.querySelector('.todo-text');
            textSpan.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); textSpan.blur(); } 
                else if (e.key === 'Escape') { e.preventDefault(); textSpan.textContent = title; textSpan.blur(); }
            });

            textSpan.addEventListener('blur', async (e) => {
                const newTitle = e.target.textContent.trim();
                if (newTitle && newTitle !== title) {
                    const fetchedCards = await window.api.kanban.getCards(quickTasksColumnId);
                    const fetchedArray = Array.isArray(fetchedCards) ? fetchedCards : (fetchedCards.data || []);
                    const cardData = fetchedArray.find(c => String(c.card_id || c.cardId || c.id) === String(id));

                    if (cardData) {
                        await window.api.kanban.updateCard(id, {
                            columnId: quickTasksColumnId, cardTitle: newTitle,
                            cardContent: cardData.card_content || cardData.cardContent || '',
                            cardColor: cardData.card_color || cardData.cardColor || '#ffffff',
                            textColor: cardData.text_color || cardData.textColor || '#172b4d',
                            positionIndex: cardData.position_index || cardData.positionIndex || 0
                        });
                        if (window.syncKanbanBoard) window.syncKanbanBoard();
                    }
                } else if (!newTitle) { e.target.textContent = title; }
            });
            qtList.appendChild(item);
        });
    }

    async function addQuickTask() {
        const text = qtInput.value.trim();
        if (!text || !quickTasksColumnId) return;
        qtInput.disabled = true; qtBtnAdd.disabled = true;
        const cards = await window.api.kanban.getCards(quickTasksColumnId);
        const cardArray = Array.isArray(cards) ? cards : (cards.data || []);
        
        await window.api.kanban.createCard({
            columnId: quickTasksColumnId, cardTitle: text, cardContent: '',
            cardColor: '#ffffff', textColor: '#172b4d', positionIndex: cardArray.length
        });
        
        qtInput.value = ''; qtInput.disabled = false; qtBtnAdd.disabled = false; qtInput.focus();
        await loadQuickTasks();
        if (window.syncKanbanBoard) window.syncKanbanBoard();
    }

    qtBtnToggle.addEventListener('click', () => {
        qtPanel.classList.toggle('collapsed');
        const isOpen = !qtPanel.classList.contains('collapsed');
        localStorage.setItem('chronoql-os-qt-state', isOpen ? 'open' : 'closed');
        if (isOpen) setTimeout(() => qtInput.focus(), 100);
    });

    qtBtnClose.addEventListener('click', () => {
        qtPanel.classList.add('collapsed');
        localStorage.setItem('chronoql-os-qt-state', 'closed');
    });
    
    qtBtnOpenKanban.addEventListener('click', () => {
        clearActiveMinorNodes();
        const kanbanNode = document.querySelector('[data-view="kanban-board"]');
        if (kanbanNode) kanbanNode.classList.add('active-node');
        routeToView('kanban-board', 'Kanban Orchestration');
        
        setTimeout(() => {
            const selector = document.getElementById('project-selector-input');
            if (selector) {
                if (selector.tagName.toLowerCase() === 'select') {
                    const option = Array.from(selector.options).find(opt => opt.text === 'My Quick Tasks');
                    if (option) { selector.value = option.value; selector.dispatchEvent(new Event('change')); }
                } else {
                    selector.value = 'My Quick Tasks'; selector.dispatchEvent(new Event('input'));
                }
            }
        }, 100);
    });

    qtBtnAdd.addEventListener('click', addQuickTask);
    qtInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addQuickTask(); });
    window.syncSidebar = setupQuickTasksSystem;

    // ==========================================
    // SIDEBAR RESIZER ORCHESTRATION
    // ==========================================
    const resizer = document.getElementById('sidebar-resizer');
    let isResizing = false;

    if (resizer) {
        const savedWidth = localStorage.getItem('chronoql-sidebar-width');
        if (savedWidth) document.documentElement.style.setProperty('--sidebar-width', savedWidth);

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizer.classList.add('is-resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none'; 
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            let newWidth = e.clientX;
            if (newWidth < 200) newWidth = 200; 
            if (newWidth > 600) newWidth = 600;
            document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('is-resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem('chronoql-sidebar-width', document.documentElement.style.getPropertyValue('--sidebar-width'));
            }
        });
    }

    // ==========================================
    // SYSTEM BOOT SEQUENCE
    // ==========================================
    setupQuickTasksSystem();

    setTimeout(() => {
        // ARCHITECTURAL FIX: Default launch module changed to Kanban Board
        const activeModule = localStorage.getItem('chronoql-os-active-module') || 'kanban-board';
        const activeTitle = localStorage.getItem('chronoql-os-active-module-title') || 'Kanban Orchestration';

        routeToView(activeModule, activeTitle);

        clearActiveMinorNodes();
        
        let targetNode = document.querySelector(`.node-minor[data-view="${activeModule}"]`);
        if (!targetNode && activeModule && activeModule.startsWith('doc-')) {
            targetNode = document.querySelector(`.node-minor[data-view="architecture-workspace"]`);
        }
        
        if (targetNode) {
            targetNode.classList.add('active-node');
            const parentList = targetNode.closest('.node-minor-list');
            if (parentList) {
                parentList.classList.add('expanded');
                saveNavState();
            }
        }

        const qtState = localStorage.getItem('chronoql-os-qt-state');
        if (qtState === 'open') qtPanel.classList.remove('collapsed');

        const scratchpadState = localStorage.getItem('chronoql-os-scratchpad-state');
        if (scratchpadState === 'open' && scratchpadPanel) scratchpadPanel.classList.remove('collapsed');
    }, 150); 

    // ==========================================
    // GLOBAL TEARDOWN INTERCEPTOR
    // ==========================================
    if (window.api && window.api.system && window.api.system.onAppQuitting) {
        window.api.system.onAppQuitting(() => {
            window.api.system.confirmTeardown();
        });
    }
});