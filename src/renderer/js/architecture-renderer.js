/**
 * Chronoql Gossip: Architecture Module Renderer
 * Orchestrates the 3-state Markdown Editor, version ledger, search/replace shades, and document deletion.
 */

window.initArchitectureSystem = async () => {
    console.log('[Architecture Module] Initializing...');

    const container = document.getElementById('architecture-main-container');
    const titleEl = document.getElementById('arch-doc-title');
    const editor = document.getElementById('arch-editor');
    const backdrop = document.getElementById('arch-backdrop');
    const viewer = document.getElementById('arch-viewer');
    const saveStatus = document.getElementById('arch-save-status');
    const segmentBtns = document.querySelectorAll('.segment-btn');
    
    // History, Restore, & Delete UI
    const btnHistory = document.getElementById('btn-arch-history');
    const btnDeleteDoc = document.getElementById('btn-delete-doc');
    const historyMenu = document.getElementById('history-dropdown-menu');
    const historyList = document.getElementById('history-list');
    const restoreBanner = document.getElementById('arch-restore-banner');
    const btnConfirmRestore = document.getElementById('btn-confirm-restore');
    const btnCancelRestore = document.getElementById('btn-cancel-restore');

    // Document Creation & Editor Actions UI
    const btnNewDoc = document.getElementById('btn-new-doc');
    const btnCloseDoc = document.getElementById('btn-close-doc');
    const createModal = document.getElementById('create-doc-modal');
    const inputNewTitle = document.getElementById('new-doc-title');
    const selectNewType = document.getElementById('new-doc-type');
    const btnCancelCreate = document.getElementById('btn-cancel-create');
    const btnConfirmCreate = document.getElementById('btn-confirm-create');

    // Search & Replace UI
    const searchReplaceBar = document.getElementById('arch-search-replace-bar');
    const findInput = document.getElementById('editor-find-input');
    const replaceInput = document.getElementById('editor-replace-input');
    const findCounter = document.getElementById('editor-find-counter');
    const btnToggleRegex = document.getElementById('btn-toggle-regex');
    const btnFindPrev = document.getElementById('btn-find-prev');
    const btnFindNext = document.getElementById('btn-find-next');
    const btnReplaceCurrent = document.getElementById('btn-replace-current');
    const btnReplaceAll = document.getElementById('btn-replace-all');

    let searchMatches = [];
    let currentSearchIndex = -1;
    let isRegexMode = false;

    // Establish Module-Specific Memory
    let currentDocId = localStorage.getItem('chronoql-os-active-module');
    if (currentDocId === 'architecture-workspace') {
        currentDocId = localStorage.getItem('chronoql-os-last-arch-doc') || null;
    } else if (currentDocId && currentDocId.startsWith('doc-')) {
        localStorage.setItem('chronoql-os-last-arch-doc', currentDocId);
    }

    // ==========================================
    // RESTORE VIEW STATE (Edit/Split/Read)
    // ==========================================
    const savedViewState = localStorage.getItem('chronoql-os-arch-view-state') || 'state-view';
    container.classList.remove('state-edit', 'state-split', 'state-view');
    container.classList.add(savedViewState);

    segmentBtns.forEach(btn => {
        if (btn.getAttribute('data-state') === savedViewState) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (savedViewState === 'state-view') {
        searchReplaceBar.style.opacity = '0.4';
        findInput.disabled = true;
        replaceInput.disabled = true;
        btnToggleRegex.disabled = true;
        btnReplaceCurrent.disabled = true;
        btnReplaceAll.disabled = true;
    } else {
        searchReplaceBar.style.opacity = '1';
        findInput.disabled = false;
        replaceInput.disabled = false;
        btnToggleRegex.disabled = false;
        btnReplaceCurrent.disabled = false;
        btnReplaceAll.disabled = false;
    }
    
    let saveTimeout;
    let isViewingHistory = false;
    let masterContentCache = ''; 

    // ==========================================
    // UTILITIES & AUDIO SYNTHESIS
    // ==========================================
    const renderMarkdown = (markdownText) => {
        if (window.compileMarkdownToHTML) {
            return window.compileMarkdownToHTML(markdownText);
        }
        console.warn('[Architecture Module] Global Markdown compiler missing. Falling back to raw text.');
        return `<pre style="white-space: pre-wrap;">${markdownText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
    };

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    const formatPreciseTimestamp = (sqliteTimestamp) => {
        if (!sqliteTimestamp) return 'Unknown Date';
        const utcIso = sqliteTimestamp.replace(' ', 'T') + 'Z';
        const date = new Date(utcIso);
        
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', second: '2-digit',
            timeZoneName: 'short'
        }).format(date);
    };

    const playWindblownSound = () => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const duration = 0.5; 
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
            filter.frequency.setValueAtTime(600, audioCtx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + duration);

            const gainNode = audioCtx.createGain();
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(1.2, audioCtx.currentTime + 0.1); 
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration); 

            noiseSource.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            noiseSource.start();
        } catch (e) {
            console.warn('[Architecture Module] Audio context failed to boot:', e);
        }
    };

    // ==========================================
    // JUMPSTART TEMPLATE ENGINE
    // ==========================================
    const triggerTemplateJumpstart = (sourceDocId) => {
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
        label.textContent = 'Jumpstart from Template';
        label.style.cssText = 'color: var(--text-color); font-weight: 600; font-size: 15px;';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'New document title...';
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

        const typeSelect = document.createElement('select');
        typeSelect.style.cssText = input.style.cssText;
        typeSelect.innerHTML = `
            <option value="Specification">Specification</option>
            <option value="Notes">Notes</option>
            <option value="Template">Template</option>
        `;

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
        btnSubmit.textContent = 'Jumpstart';
        btnSubmit.style.cssText = `
            padding: 8px 16px; background-color: var(--accent-color); color: #fff;
            border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: background-color 0.2s; display: flex; align-items: center; gap: 6px;
        `;
        btnSubmit.onmouseover = () => btnSubmit.style.backgroundColor = '#0284c7'; 
        btnSubmit.onmouseout = () => btnSubmit.style.backgroundColor = 'var(--accent-color)';

        const closeModal = () => document.body.removeChild(overlay);

        btnCancel.onclick = closeModal;
        
        btnSubmit.onclick = async () => {
            const title = input.value.trim();
            if (!title) {
                input.style.borderColor = 'var(--danger-color)';
                return;
            }
            
            if (window.api && window.api.architecture) {
                const res = await window.api.architecture.cloneDoc(sourceDocId, title, typeSelect.value);
                if (res.success) {
                    currentDocId = res.data.doc_id;
                    localStorage.setItem('chronoql-os-active-module', currentDocId);
                    localStorage.setItem('chronoql-os-last-arch-doc', currentDocId);
                    closeModal();
                    loadMasterDocument();
                } else {
                    console.error('[Jumpstart] Clone transaction failed:', res.error);
                }
            }
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') btnSubmit.click();
            if (e.key === 'Escape') btnCancel.click();
        };

        btnContainer.appendChild(btnCancel);
        btnContainer.appendChild(btnSubmit);
        modal.appendChild(label);
        modal.appendChild(input);
        modal.appendChild(typeSelect);
        modal.appendChild(btnContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        setTimeout(() => input.focus(), 50);
    };

    // ==========================================
    // INITIALIZATION & DOM CACHE LISTENER
    // ==========================================
    const loadMasterDocument = async () => {
        // Prepare DOM for dynamic template injection
        let jumpstartContainer = document.getElementById('template-jumpstart-container');
        if (!jumpstartContainer) {
            jumpstartContainer = document.createElement('div');
            jumpstartContainer.id = 'template-jumpstart-container';
            titleEl.parentNode.style.display = 'flex';
            titleEl.parentNode.style.alignItems = 'center';
            titleEl.parentNode.insertBefore(jumpstartContainer, titleEl.nextSibling);
        }

        if (!currentDocId) {
            titleEl.textContent = "Select or Create a Document";
            editor.value = "";
            viewer.innerHTML = "";
            backdrop.innerHTML = "";
            btnDeleteDoc.disabled = true;
            saveStatus.textContent = ''; 
            jumpstartContainer.innerHTML = '';
            
            // ARCHITECTURAL FIX: Lock editor in empty state to prevent data loss
            editor.disabled = true;
            
            searchReplaceBar.style.opacity = '0.4';
            findInput.disabled = true;
            replaceInput.disabled = true;
            btnToggleRegex.disabled = true;
            btnReplaceCurrent.disabled = true;
            btnReplaceAll.disabled = true;
            return;
        }
        
        try {
            if (window.api && window.api.architecture) {
                const doc = await window.api.architecture.getDoc(currentDocId);
                if (doc && doc.success) {
                    titleEl.textContent = doc.data.title;
                    editor.value = doc.data.content;
                    masterContentCache = doc.data.content;
                    viewer.innerHTML = renderMarkdown(editor.value);
                    btnDeleteDoc.disabled = false;
                    saveStatus.textContent = 'Synced'; 
                    
                    // ARCHITECTURAL FIX: Unlock editor for active documents
                    editor.disabled = false;
                    
                    loadHistory(); 

                    // Inject the Jumpstart button if the record is flagged as a Template
                    if (doc.data.doc_type === 'Template') {
                        jumpstartContainer.innerHTML = `
                            <button id="btn-use-template" style="margin-left: 12px; display: flex; align-items: center; gap: 6px; padding: 4px 10px; background-color: var(--accent-color); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px; transition: background-color 0.2s;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5l7 7-7 7"></path></svg>
                                Jumpstart
                            </button>
                        `;
                        document.getElementById('btn-use-template').addEventListener('click', () => {
                            triggerTemplateJumpstart(doc.data.doc_id);
                        });
                    } else {
                        jumpstartContainer.innerHTML = '';
                    }

                    if (!container.classList.contains('state-view')) {
                        searchReplaceBar.style.opacity = '1';
                        findInput.disabled = false;
                        replaceInput.disabled = false;
                        btnToggleRegex.disabled = false;
                        btnReplaceCurrent.disabled = false;
                        btnReplaceAll.disabled = false;
                    }
                    
                    if (findInput.value) performSearch(false);
                } else {
                    titleEl.textContent = "Document Not Found";
                    editor.value = "";
                    viewer.innerHTML = "";
                    backdrop.innerHTML = "";
                    btnDeleteDoc.disabled = true;
                    saveStatus.textContent = ''; 
                    jumpstartContainer.innerHTML = '';
                    
                    // ARCHITECTURAL FIX: Lock editor in empty state to prevent data loss
                    editor.disabled = true;
                    
                    searchReplaceBar.style.opacity = '0.4';
                    findInput.disabled = true;
                    replaceInput.disabled = true;
                    btnToggleRegex.disabled = true;
                    btnReplaceCurrent.disabled = true;
                    btnReplaceAll.disabled = true;
                }
            }
        } catch (err) {
            console.error('[Architecture Module] IPC Error:', err);
            btnDeleteDoc.disabled = true;
        }
    };
    
    await loadMasterDocument();

    window.addEventListener('gossip:module-resumed', (e) => {
        if (e.detail.viewTarget === 'architecture-workspace' || (e.detail.viewTarget && e.detail.viewTarget.startsWith('doc-'))) {
            let newDocId = e.detail.viewTarget;
            
            if (newDocId === 'architecture-workspace') {
                newDocId = localStorage.getItem('chronoql-os-last-arch-doc') || null;
            } else {
                localStorage.setItem('chronoql-os-last-arch-doc', newDocId);
            }

            if (currentDocId !== newDocId) {
                currentDocId = newDocId;
                loadMasterDocument();
            }
        }
    });

    // ==========================================
    // WORKSPACE RESET ORCHESTRATION
    // ==========================================
    if (btnCloseDoc) {
        btnCloseDoc.addEventListener('click', () => {
            currentDocId = null;
            localStorage.removeItem('chronoql-os-last-arch-doc');
            localStorage.setItem('chronoql-os-active-module', 'architecture-workspace');
            loadMasterDocument();
            
            document.querySelectorAll('.node-minor').forEach(n => n.classList.remove('active-node'));
            const workspaceNode = document.querySelector('.node-minor[data-view="architecture-workspace"]');
            if (workspaceNode) workspaceNode.classList.add('active-node');
        });
    }

    // ==========================================
    // TYPEAHEAD SEARCH ORCHESTRATION
    // ==========================================
    const setupTypeaheadShades = () => {
        document.querySelectorAll('.arch-search-icon-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const docType = e.currentTarget.getAttribute('data-doc-type');
                const shade = document.getElementById(`shade-${docType.toLowerCase()}`);
                
                document.querySelectorAll('.search-shade').forEach(s => {
                    if (s !== shade) s.classList.remove('active');
                });

                shade.classList.toggle('active');
                
                if (shade.classList.contains('active')) {
                    const input = shade.querySelector('.typeahead-input');
                    input.focus();
                    executeTypeaheadSearch(docType, input.value || '');
                }
            });
        });

        const handleTypeahead = debounce(async (e) => {
            const searchTerm = e.target.value;
            const docType = e.target.getAttribute('data-target');
            await executeTypeaheadSearch(docType, searchTerm);
        }, 150);

        document.querySelectorAll('.typeahead-input').forEach(input => {
            input.addEventListener('input', handleTypeahead);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.arch-menu-container')) {
                document.querySelectorAll('.search-shade').forEach(s => s.classList.remove('active'));
            }
        });
    };

    const executeTypeaheadSearch = async (docType, searchTerm) => {
        if (window.api && window.api.architecture && window.api.architecture.searchDocs) {
            const result = await window.api.architecture.searchDocs(docType, searchTerm);
            if (result.success) {
                renderShadeResults(docType, result.data);
            } else {
                console.error('[Architecture] Search failed:', result.error);
            }
        }
    };

    const renderShadeResults = (docType, results) => {
        const listContainer = document.getElementById(`results-${docType.toLowerCase()}`);
        listContainer.innerHTML = ''; 

        if (!results || results.length === 0) {
            listContainer.innerHTML = '<li><em style="opacity: 0.5">No documents found.</em></li>';
            return;
        }

        results.forEach(doc => {
            const li = document.createElement('li');
            li.textContent = doc.title;
            li.dataset.docId = doc.doc_id;
            
            li.addEventListener('click', () => {
                currentDocId = doc.doc_id;
                localStorage.setItem('chronoql-os-active-module', currentDocId);
                localStorage.setItem('chronoql-os-last-arch-doc', currentDocId);
                loadMasterDocument();
                
                document.getElementById(`shade-${docType.toLowerCase()}`).classList.remove('active');
            });
            
            listContainer.appendChild(li);
        });
    };

    setupTypeaheadShades();

    // ==========================================
    // SEARCH & REPLACE (BACKDROP ENGINE)
    // ==========================================
    
    editor.addEventListener('scroll', () => {
        backdrop.scrollTop = editor.scrollTop;
        backdrop.scrollLeft = editor.scrollLeft;
    });

    btnToggleRegex.addEventListener('click', () => {
        isRegexMode = !isRegexMode;
        btnToggleRegex.classList.toggle('active', isRegexMode);
        if (findInput.value) performSearch(true);
    });

    function performSearch(keepFocusInSearch = true) {
        if (!currentDocId || isViewingHistory) return;
        
        const text = editor.value;
        const query = findInput.value;
        searchMatches = [];
        currentSearchIndex = -1;

        if (!query) {
            findCounter.textContent = '0/0';
            backdrop.innerHTML = '';
            btnReplaceCurrent.disabled = true;
            btnReplaceAll.disabled = true;
            return;
        }

        const flags = 'gi';
        let regex;
        
        try {
            const pattern = isRegexMode ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(pattern, flags);
        } catch (err) {
            // Fails silently if the user is mid-typing an invalid Regex (e.g. unclosed bracket '[0-')
            findCounter.textContent = '0/0';
            backdrop.innerHTML = escapeHtml(text); 
            btnReplaceCurrent.disabled = true;
            btnReplaceAll.disabled = true;
            return;
        }
        
        let match;
        // Bails out to prevent infinite loops if the user enters a regex that matches empty strings
        while ((match = regex.exec(text)) !== null) {
            if (match[0].length === 0) {
                regex.lastIndex++;
                if (regex.lastIndex > text.length) break;
            } else {
                searchMatches.push({ start: match.index, end: match.index + match[0].length });
            }
        }

        if (searchMatches.length > 0) {
            currentSearchIndex = 0;
            highlightCurrentMatch(keepFocusInSearch);
            btnReplaceCurrent.disabled = false;
            btnReplaceAll.disabled = false;
        } else {
            findCounter.textContent = '0/0';
            backdrop.innerHTML = escapeHtml(text);
            btnReplaceCurrent.disabled = true;
            btnReplaceAll.disabled = true;
        }
    }

    function highlightCurrentMatch(keepFocusInSearch = true) {
        if (searchMatches.length === 0 || currentSearchIndex < 0 || !backdrop) return;
        
        const text = editor.value;
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
        backdrop.innerHTML = highlightedHTML;

        // Auto-scroll the textarea to the active match
        const match = searchMatches[currentSearchIndex];
        const textUpToMatch = text.substring(0, match.start);
        const lines = textUpToMatch.split('\n');
        
        // Approximate line height for Consolas 0.9rem is ~23px
        const lineHeight = 23; 
        editor.scrollTop = Math.max(0, ((lines.length - 1) * lineHeight) - 50);

        findCounter.textContent = `${currentSearchIndex + 1}/${searchMatches.length}`;

        if (!keepFocusInSearch) {
            editor.focus();
        } else if (document.activeElement !== findInput && document.activeElement !== replaceInput) {
            findInput.focus();
        }
    }

    findInput.addEventListener('input', () => performSearch(true));
    
    // ARCHITECTURAL FIX: Auto-select text on focus for rapid re-searching
    findInput.addEventListener('focus', function() {
        this.select();
    });

    findInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (searchMatches.length === 0) return;
            if (e.shiftKey) currentSearchIndex = (currentSearchIndex - 1 + searchMatches.length) % searchMatches.length;
            else currentSearchIndex = (currentSearchIndex + 1) % searchMatches.length;
            highlightCurrentMatch(true);
        }
    });

    // ARCHITECTURAL FIX: Auto-select text on focus for rapid replacing
    replaceInput.addEventListener('focus', function() {
        this.select();
    });

    btnFindPrev.addEventListener('click', () => {
        if (searchMatches.length === 0) return;
        currentSearchIndex = (currentSearchIndex - 1 + searchMatches.length) % searchMatches.length;
        highlightCurrentMatch(true);
    });

    btnFindNext.addEventListener('click', () => {
        if (searchMatches.length === 0) return;
        currentSearchIndex = (currentSearchIndex + 1) % searchMatches.length;
        highlightCurrentMatch(true);
    });

    function executeSaveTransaction() {
        viewer.innerHTML = renderMarkdown(editor.value);
        saveStatus.textContent = 'Saving...';
        
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            if (window.api && window.api.architecture && currentDocId) {
                const result = await window.api.architecture.updateDoc(currentDocId, editor.value);
                if (result.success) {
                    masterContentCache = editor.value;
                    loadHistory(); 
                    saveStatus.textContent = 'Saved to SQLite';
                    setTimeout(() => saveStatus.textContent = 'Synced', 2000);
                } else {
                    saveStatus.textContent = 'Save Failed';
                    saveStatus.style.color = 'var(--danger-color)';
                }
            }
        }, 800);
    }

    btnReplaceCurrent.addEventListener('click', () => {
        if (searchMatches.length === 0 || currentSearchIndex < 0 || !currentDocId) return;
        
        const targetMatch = searchMatches[currentSearchIndex];
        const replacement = replaceInput.value || '';
        const currentText = editor.value;
        
        editor.value = currentText.substring(0, targetMatch.start) + replacement + currentText.substring(targetMatch.end);
        
        executeSaveTransaction();
        performSearch(true); // Re-map the new boundaries
    });

    btnReplaceAll.addEventListener('click', () => {
        if (searchMatches.length === 0 || !currentDocId) return;
        
        const query = findInput.value;
        const replacement = replaceInput.value || '';
        
        if (!query) return;

        let flags = 'gi';
        let regex;
        try {
            const pattern = isRegexMode ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(pattern, flags);
        } catch (e) {
            return; // Safety block
        }

        editor.value = editor.value.replace(regex, replacement);
        
        executeSaveTransaction();
        performSearch(true); // Will instantly drop to 0/0
    });

    // ==========================================
    // DOCUMENT DELETION ORCHESTRATION
    // ==========================================
    btnDeleteDoc.addEventListener('click', async () => {
        if (!currentDocId || btnDeleteDoc.disabled) return;

        const confirmed = confirm('Are you sure you want to permanently delete this master document and all its historical versions? This action cannot be undone.');
        if (!confirmed) return;

        if (window.api && window.api.architecture) {
            const result = await window.api.architecture.deleteDoc(currentDocId);
            if (result.success) {
                playWindblownSound();
                
                currentDocId = null;
                localStorage.removeItem('chronoql-os-last-arch-doc');
                localStorage.setItem('chronoql-os-active-module', 'architecture-workspace');
                
                titleEl.textContent = "Select or Create a Document";
                editor.value = "";
                viewer.innerHTML = "";
                backdrop.innerHTML = "";
                masterContentCache = "";
                historyList.innerHTML = '';
                
                // ARCHITECTURAL FIX: Lock editor after deletion
                editor.disabled = true;
                
                btnDeleteDoc.disabled = true;
                saveStatus.textContent = 'Deleted';
                
                // Hide Jumpstart button if it exists
                const jumpstartContainer = document.getElementById('template-jumpstart-container');
                if (jumpstartContainer) jumpstartContainer.innerHTML = '';
                
                searchReplaceBar.style.opacity = '0.4';
                findInput.disabled = true;
                replaceInput.disabled = true;
                btnToggleRegex.disabled = true;
                btnReplaceCurrent.disabled = true;
                btnReplaceAll.disabled = true;
                
                setTimeout(() => {
                    if (!currentDocId) saveStatus.textContent = '';
                }, 2000);
            } else {
                console.error('[Architecture Module] Error deleting doc:', result.error);
                alert('Failed to delete document. See console for details.');
            }
        }
    });

    // ==========================================
    // DOCUMENT CREATION MODAL ORCHESTRATION
    // ==========================================
    const closeCreateModal = () => {
        createModal.classList.add('hidden');
        inputNewTitle.value = '';
        selectNewType.value = 'Specification'; 
    };

    btnNewDoc.addEventListener('click', () => {
        createModal.classList.remove('hidden');
        setTimeout(() => inputNewTitle.focus(), 100);
    });

    btnCancelCreate.addEventListener('click', closeCreateModal);

    btnConfirmCreate.addEventListener('click', async () => {
        const title = inputNewTitle.value.trim();
        const docType = selectNewType.value;

        if (!title) {
            inputNewTitle.style.borderColor = 'var(--danger-color)';
            setTimeout(() => inputNewTitle.style.borderColor = 'var(--border-color)', 2000);
            inputNewTitle.focus();
            return;
        }

        if (window.api && window.api.architecture) {
            const result = await window.api.architecture.createDoc(title, docType);
            if (result.success) {
                currentDocId = result.data.doc_id;
                localStorage.setItem('chronoql-os-active-module', currentDocId);
                localStorage.setItem('chronoql-os-last-arch-doc', currentDocId);
                closeCreateModal();
                await loadMasterDocument();
            } else {
                console.error('[Architecture Module] Error creating doc:', result.error);
                alert('Failed to create document. See console for details.');
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !createModal.classList.contains('hidden')) {
            closeCreateModal();
        }
    });

    createModal.addEventListener('click', (e) => {
        if (e.target === createModal) closeCreateModal();
    });

    inputNewTitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnConfirmCreate.click();
    });

    // ==========================================
    // HISTORY LEDGER ORCHESTRATION
    // ==========================================
    async function loadHistory() {
        if (!window.api || !window.api.architecture || !currentDocId) return;
        
        const response = await window.api.architecture.getHistory(currentDocId);
        if (!response.success || !response.data) return;

        historyList.innerHTML = '';
        
        if (response.data.length === 0) {
            historyList.innerHTML = '<div style="padding: 16px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">No history found.</div>';
            return;
        }

        response.data.forEach((v, index) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            const statusLabel = index === 0 ? 'Current Master' : 'Historical Snapshot';
            
            item.innerHTML = `
                <div class="history-info" style="flex: 1;" data-id="${v.version_id}">
                    <span class="history-timestamp">${formatPreciseTimestamp(v.saved_at)}</span>
                    <span class="history-meta">${statusLabel}</span>
                </div>
                <button class="btn-purge-version" data-id="${v.version_id}" title="Purge this snapshot">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            `;

            item.querySelector('.history-info').addEventListener('click', async () => {
                const verRes = await window.api.architecture.getVersion(v.version_id);
                if (verRes.success) {
                    editor.value = verRes.data.content;
                    viewer.innerHTML = renderMarkdown(editor.value);
                    
                    if (index === 0) {
                        exitHistoryMode();
                    } else {
                        enterHistoryMode();
                    }
                    historyMenu.classList.remove('active');
                    btnHistory.classList.remove('active');
                }
            });

            item.querySelector('.btn-purge-version').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Permanently purge this historical snapshot? This cannot be undone.')) {
                    if (window.api.architecture.deleteVersion) {
                        await window.api.architecture.deleteVersion(v.version_id);
                        loadHistory();
                    } else {
                        alert('Purge method not bound to backend yet.');
                    }
                }
            });

            historyList.appendChild(item);
        });
    }

    btnHistory.addEventListener('click', (e) => {
        e.stopPropagation();
        historyMenu.classList.toggle('active');
        btnHistory.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.history-dropdown-wrapper')) {
            historyMenu.classList.remove('active');
            btnHistory.classList.remove('active');
        }
    });

    // ==========================================
    // RESTORE MODE LOGIC
    // ==========================================
    function enterHistoryMode() {
        isViewingHistory = true;
        restoreBanner.classList.remove('hidden');
        saveStatus.textContent = 'Viewing Archive';
        editor.disabled = true;
        editor.style.opacity = '0.7';
        btnDeleteDoc.disabled = true; 
        
        searchReplaceBar.style.opacity = '0.4';
        findInput.disabled = true;
        replaceInput.disabled = true;
        btnToggleRegex.disabled = true;
        btnReplaceCurrent.disabled = true;
        btnReplaceAll.disabled = true;
        backdrop.innerHTML = '';
    }

    function exitHistoryMode() {
        isViewingHistory = false;
        restoreBanner.classList.add('hidden');
        editor.value = masterContentCache;
        viewer.innerHTML = renderMarkdown(editor.value);
        saveStatus.textContent = 'Synced';
        editor.disabled = false;
        editor.style.opacity = '1';
        if (currentDocId) {
            btnDeleteDoc.disabled = false;
            if (!container.classList.contains('state-view')) {
                searchReplaceBar.style.opacity = '1';
                findInput.disabled = false;
                replaceInput.disabled = false;
                btnToggleRegex.disabled = false;
                if (searchMatches.length > 0) {
                    btnReplaceCurrent.disabled = false;
                    btnReplaceAll.disabled = false;
                }
            }
        }
        if (findInput.value) performSearch(false);
    }

    btnCancelRestore.addEventListener('click', exitHistoryMode);

    btnConfirmRestore.addEventListener('click', async () => {
        const payloadToRestore = editor.value;
        const result = await window.api.architecture.updateDoc(currentDocId, payloadToRestore);
        
        if (result.success) {
            masterContentCache = payloadToRestore;
            exitHistoryMode();
            loadHistory(); 
            saveStatus.textContent = 'Version Restored';
            setTimeout(() => saveStatus.textContent = 'Synced', 2000);
        }
    });

    // ==========================================
    // 3-STATE UI CONTROLLER
    // ==========================================
    segmentBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            segmentBtns.forEach(b => b.classList.remove('active'));
            const clickedBtn = e.currentTarget;
            clickedBtn.classList.add('active');

            container.classList.remove('state-edit', 'state-split', 'state-view');
            const newState = clickedBtn.getAttribute('data-state');
            container.classList.add(newState);

            localStorage.setItem('chronoql-os-arch-view-state', newState);

            if (newState === 'state-view') {
                searchReplaceBar.style.opacity = '0.4';
                findInput.disabled = true;
                replaceInput.disabled = true;
                btnToggleRegex.disabled = true;
                btnReplaceCurrent.disabled = true;
                btnReplaceAll.disabled = true;
            } else if (!isViewingHistory && currentDocId) {
                searchReplaceBar.style.opacity = '1';
                findInput.disabled = false;
                replaceInput.disabled = false;
                btnToggleRegex.disabled = false;
                if (searchMatches.length > 0) {
                    btnReplaceCurrent.disabled = false;
                    btnReplaceAll.disabled = false;
                }
                setTimeout(() => editor.focus(), 100);
            }
        });
    });

    // ==========================================
    // COMPILATION & PERSISTENCE
    // ==========================================
    editor.addEventListener('input', () => {
        if (isViewingHistory || !currentDocId) return; 
        
        if (findInput.value) performSearch(true);
        executeSaveTransaction();
    });
    
    viewer.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (anchor && anchor.href) {
            e.preventDefault();
            if (window.api && window.api.system && window.api.system.openExternal) {
                window.api.system.openExternal(anchor.href);
            }
        }
    });
};