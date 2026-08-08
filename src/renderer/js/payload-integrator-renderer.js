/**
 * Chronoql Gossip: Payload Integrator Renderer
 * Frontend logic for validating, parsing, and dispatching JSON payloads.
 * Features IDE-grade error mapping, file truncation heuristics, payload previews, and session persistence.
 */

(() => {
    let elements = {};
    let activePayload = null;

    window.initPayloadIntegrator = async () => {
        console.log('[Payload Integrator] Module registered.');
    };

    window.loadPayloadIntegrator = async () => {
        const dynamicStage = document.getElementById('dynamic-stage');
        const mainStageTitle = document.getElementById('macro-view-title');

        if (mainStageTitle) mainStageTitle.innerText = 'Payload Integrator';

        elements = {
            jsonInputArea: document.getElementById('json-input-area'),
            btnClearPayload: document.getElementById('btn-clear-payload'),
            btnParsePayload: document.getElementById('btn-parse-payload'),
            parseStatusMessage: document.getElementById('parse-status-message'),
            
            btnToggleErrors: document.getElementById('btn-toggle-errors'),
            errorDrawer: document.getElementById('error-drawer'),
            errorList: document.getElementById('error-list'),
            errorEmptyMsg: document.getElementById('error-empty-msg'),
            btnCloseErrors: document.getElementById('btn-close-errors'),
            errorDrawerTitle: document.getElementById('error-drawer-title'),
            errorResizer: document.getElementById('error-resizer'),

            parsedFilesList: document.getElementById('parsed-files-list'),
            integratorEmptyState: document.getElementById('integrator-empty-state'),
            btnExecuteIntegration: document.getElementById('btn-execute-integration'),
            
            btnTogglePreview: document.getElementById('btn-toggle-preview'),
            previewDrawer: document.getElementById('preview-drawer'),
            previewDrawerTitle: document.getElementById('preview-drawer-title'),
            previewCodeBlock: document.getElementById('preview-code-block'),
            previewEmptyMsg: document.getElementById('preview-empty-msg'),
            btnClosePreview: document.getElementById('btn-close-preview'),
            previewResizer: document.getElementById('preview-resizer')
        };

        if (elements.jsonInputArea) {
            bindIntegratorEvents();
            setupDrawerResizers();
            hydratePersistentPayload();
        }
    };

    function hydratePersistentPayload() {
        const savedPayloadStr = localStorage.getItem('chronoql-os-active-payload');
        if (savedPayloadStr) {
            try {
                const parsed = JSON.parse(savedPayloadStr);
                activePayload = parsed;
                elements.jsonInputArea.value = JSON.stringify(parsed, null, 2);
                
                setStatus('success', `Restored ${Object.keys(parsed).length} validated files from previous session.`);
                renderPreFlightReview(Object.keys(parsed));
                console.log('[Payload Integrator] Successfully hydrated staged payload from local storage.');
            } catch (e) {
                console.warn('[Payload Integrator] Failed to parse persistent payload. Purging storage block.');
                localStorage.removeItem('chronoql-os-active-payload');
            }
        }
    }

    function setupDrawerResizers() {
        const setupResizer = (resizerEl, drawerEl, cssVar, storageKey) => {
            if (!resizerEl || !drawerEl) return;
            
            let isResizing = false;
            let container = drawerEl.parentElement; 
            
            resizerEl.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizerEl.classList.add('is-resizing');
                document.body.style.cursor = 'row-resize';
                document.body.style.userSelect = 'none';
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                const containerRect = container.getBoundingClientRect();
                
                let newHeight = containerRect.bottom - e.clientY;
                
                if (newHeight < 100) newHeight = 100;
                if (newHeight > containerRect.height * 0.9) newHeight = containerRect.height * 0.9;
                
                drawerEl.style.setProperty(cssVar, `${newHeight}px`);
            });

            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    resizerEl.classList.remove('is-resizing');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    localStorage.setItem(storageKey, drawerEl.style.getPropertyValue(cssVar));
                }
            });

            const saved = localStorage.getItem(storageKey);
            if (saved) drawerEl.style.setProperty(cssVar, saved);
        };

        setupResizer(elements.errorResizer, elements.errorDrawer, '--error-height', 'chronoql-error-drawer-height');
        setupResizer(elements.previewResizer, elements.previewDrawer, '--preview-height', 'chronoql-preview-drawer-height');
    }

    function getLineAndColumn(text, index) {
        const lines = text.substring(0, index).split('\n');
        return { 
            line: lines.length, 
            col: lines[lines.length - 1].length + 1 
        };
    }

    function bindIntegratorEvents() {
        
        elements.jsonInputArea.addEventListener('input', () => {
            const content = elements.jsonInputArea.value.trim();
            if (content.length > 0) {
                if (activePayload !== null || elements.parsedFilesList.children.length > 0) {
                    activePayload = null;
                    localStorage.removeItem('chronoql-os-active-payload');
                    clearErrorState();
                    resetPreFlightReview();
                }
                setStatus('success', 'Payload captured');
            } else {
                activePayload = null;
                localStorage.removeItem('chronoql-os-active-payload');
                clearErrorState();
                resetPreFlightReview();
            }
        });

        elements.btnClearPayload.addEventListener('click', () => {
            elements.jsonInputArea.value = '';
            activePayload = null;
            localStorage.removeItem('chronoql-os-active-payload');
            clearErrorState();
            resetPreFlightReview();
        });

        // --- Drawer Toggles ---
        if (elements.btnToggleErrors && elements.errorDrawer) {
            elements.btnToggleErrors.addEventListener('click', () => {
                elements.errorDrawer.classList.toggle('open');
            });
        }

        if (elements.btnTogglePreview && elements.previewDrawer) {
            elements.btnTogglePreview.addEventListener('click', () => {
                elements.previewDrawer.classList.toggle('open');
            });
        }

        if (elements.btnCloseErrors) {
            elements.btnCloseErrors.addEventListener('click', () => {
                elements.errorDrawer.classList.remove('open');
            });
        }
        
        if (elements.btnClosePreview) {
            elements.btnClosePreview.addEventListener('click', closePreviewDrawer);
        }

        elements.btnParsePayload.addEventListener('click', () => {
            const rawJson = elements.jsonInputArea.value.trim();
            
            if (!rawJson) {
                setStatus('error', 'Payload is empty.');
                clearErrorState();
                resetPreFlightReview();
                return;
            }

            let parsed;
            let validationErrors = [];

            try {
                parsed = JSON.parse(rawJson);
            } catch (err) {
                let line = 1;
                let col = 1;
                let charIndex = 0;
                
                const indexMatch = err.message.match(/position (\d+)/);
                if (indexMatch) {
                    charIndex = parseInt(indexMatch[1], 10);
                    const pos = getLineAndColumn(rawJson, charIndex);
                    line = pos.line;
                    col = pos.col;
                }
                
                validationErrors.push({ 
                    message: `Invalid JSON Architecture: ${err.message}`, 
                    line: line, 
                    col: col, 
                    index: charIndex,
                    isWarning: false
                });
            }

            if (parsed) {
                if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                    validationErrors.push({ 
                        message: "Payload Architecture Error: Expected a flat JSON object representing file paths.", 
                        line: 1, col: 1, index: 0, isWarning: false 
                    });
                } else {
                    const keys = Object.keys(parsed);
                    if (keys.length === 0) {
                        validationErrors.push({ 
                            message: "Payload empty. No files were declared in the object.", 
                            line: 1, col: 1, index: 0, isWarning: false 
                        });
                    } else {
                        keys.forEach(key => {
                            const content = parsed[key].trim();
                            let isTruncated = false;
                            
                            if (key.endsWith('.html') || key.endsWith('.xml')) {
                                if (!content.endsWith('>')) isTruncated = true;
                            } else if (key.endsWith('.js') || key.endsWith('.json') || key.endsWith('.css')) {
                                const lastChar = content.charAt(content.length - 1);
                                if (lastChar === ',' || lastChar === '=' || lastChar === '+' || lastChar === '\\') {
                                    isTruncated = true;
                                } else {
                                    const openBraces = (content.match(/\{/g) || []).length;
                                    const closeBraces = (content.match(/\}/g) || []).length;
                                    if (openBraces > closeBraces) isTruncated = true;
                                }
                            }

                            if (isTruncated) {
                                const keyIndex = rawJson.indexOf(`"${key}"`);
                                const safeIndex = keyIndex > -1 ? keyIndex : 0;
                                const pos = getLineAndColumn(rawJson, safeIndex);
                                
                                validationErrors.push({ 
                                    message: `Potential LLM Truncation Detected: The payload for [${pathBasename(key)}] appears to end abruptly.`, 
                                    line: pos.line, col: pos.col, index: safeIndex, isWarning: true 
                                });
                            }
                        });
                    }
                }
            }

            if (validationErrors.length > 0) {
                const hasFatal = validationErrors.some(e => !e.isWarning);
                
                if (hasFatal) {
                    activePayload = null;
                    localStorage.removeItem('chronoql-os-active-payload');
                    setStatus('error', 'Validation Failed: Syntax Errors Detected');
                    resetPreFlightReview();
                } else {
                    activePayload = parsed; 
                    localStorage.setItem('chronoql-os-active-payload', JSON.stringify(parsed));
                    setStatus('warning', 'Parsed with Truncation Warnings');
                    renderPreFlightReview(Object.keys(parsed));
                }

                renderErrorDrawer(validationErrors, hasFatal);
                
            } else {
                activePayload = parsed;
                localStorage.setItem('chronoql-os-active-payload', JSON.stringify(parsed));
                clearErrorState();
                setStatus('success', `Parsed ${Object.keys(parsed).length} files successfully.`);
                renderPreFlightReview(Object.keys(parsed));
            }
        });

        elements.btnExecuteIntegration.addEventListener('click', async () => {
            if (!activePayload) return;

            const confirmExecute = confirm("WARNING: This will overwrite local files. A safety snapshot will be created. Proceed?");
            if (!confirmExecute) return;

            elements.btnExecuteIntegration.disabled = true;
            elements.btnExecuteIntegration.innerHTML = 'Integrating...';

            try {
                const response = await window.api.integrator.executePayload(activePayload);
                
                if (response.success) {
                    alert('Payload successfully integrated into the codebase.');
                    elements.jsonInputArea.value = '';
                    activePayload = null;
                    localStorage.removeItem('chronoql-os-active-payload');
                    clearErrorState();
                    resetPreFlightReview();
                    setStatus('success', 'Integration complete.');
                } else {
                    throw new Error(response.error);
                }
            } catch (err) {
                console.error('[Payload Integrator] Execution failed:', err);
                alert(`Integration failed: ${err.message}`);
                setStatus('error', 'Execution failed.');
            } finally {
                elements.btnExecuteIntegration.disabled = false;
                elements.btnExecuteIntegration.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    Integrate to Codebase
                `;
            }
        });
    }

    function openPreviewDrawer(path, content) {
        if (elements.previewDrawer) {
            elements.previewDrawerTitle.textContent = pathBasename(path);
            elements.previewDrawerTitle.title = path;
            
            if (elements.previewCodeBlock && elements.previewEmptyMsg) {
                elements.previewEmptyMsg.style.display = 'none';
                elements.previewCodeBlock.style.display = 'block';
                elements.previewCodeBlock.value = content;
                elements.previewCodeBlock.scrollTop = 0;
            }
            
            elements.previewDrawer.classList.add('open');
        }
    }

    function closePreviewDrawer() {
        if (elements.previewDrawer) {
            elements.previewDrawer.classList.remove('open');
        }
        
        if (elements.parsedFilesList) {
            const allItems = elements.parsedFilesList.querySelectorAll('.parsed-file-item');
            allItems.forEach(el => el.classList.remove('active-preview'));
        }
    }

    function clearPreviewState() {
        if (elements.previewDrawerTitle) {
            elements.previewDrawerTitle.textContent = 'File Preview';
            elements.previewDrawerTitle.title = '';
        }
        if (elements.previewCodeBlock) {
            elements.previewCodeBlock.value = '';
            elements.previewCodeBlock.style.display = 'none';
        }
        if (elements.previewEmptyMsg) {
            elements.previewEmptyMsg.style.display = 'flex';
        }
        
        if (elements.parsedFilesList) {
            const allItems = elements.parsedFilesList.querySelectorAll('.parsed-file-item');
            allItems.forEach(el => el.classList.remove('active-preview'));
        }
    }

    function renderErrorDrawer(errors, hasFatal) {
        elements.errorList.innerHTML = '';
        elements.errorEmptyMsg.style.display = 'none';
        elements.errorList.style.display = 'block';
        
        if (hasFatal) {
            elements.errorDrawer.classList.remove('warning-mode');
            elements.errorDrawerTitle.textContent = "Validation Errors";
        } else {
            elements.errorDrawer.classList.add('warning-mode');
            elements.errorDrawerTitle.textContent = "Validation Warnings";
        }

        errors.forEach(err => {
            const li = document.createElement('li');
            li.className = 'error-item';
            
            li.innerHTML = `
                <span class="error-item-msg">${escapeHtml(err.message)}</span>
                <span class="error-item-loc">Ln ${err.line}, Col ${err.col}</span>
            `;
            
            li.addEventListener('click', () => {
                const rawJson = elements.jsonInputArea.value;
                const lineStart = rawJson.lastIndexOf('\n', err.index - 1) + 1;
                let lineEnd = rawJson.indexOf('\n', err.index);
                if (lineEnd === -1) lineEnd = rawJson.length;

                elements.jsonInputArea.focus();
                elements.jsonInputArea.setSelectionRange(lineStart, lineEnd);

                const lines = rawJson.substring(0, lineStart).split('\n');
                const lineHeight = 21.6; 
                elements.jsonInputArea.scrollTop = Math.max(0, ((lines.length - 1) * lineHeight) - 60);
            });

            elements.errorList.appendChild(li);
        });

        elements.errorDrawer.classList.add('open');
    }

    function clearErrorState() {
        if (elements.errorList && elements.errorEmptyMsg) {
            elements.errorList.innerHTML = '';
            elements.errorList.style.display = 'none';
            elements.errorEmptyMsg.style.display = 'flex';
        }
        if (elements.errorDrawerTitle) {
            elements.errorDrawerTitle.textContent = "Validation Console";
        }
        if (elements.errorDrawer) {
            elements.errorDrawer.classList.remove('warning-mode');
        }
    }

    function pathBasename(fullPath) {
        return fullPath.split(/[\\/]/).pop();
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function setStatus(type, message) {
        elements.parseStatusMessage.className = `status-message ${type}`;
        elements.parseStatusMessage.textContent = message;
    }

    function resetPreFlightReview() {
        elements.integratorEmptyState.style.display = 'flex';
        elements.parsedFilesList.style.display = 'none';
        elements.parsedFilesList.innerHTML = '';
        elements.btnExecuteIntegration.disabled = true;
        closePreviewDrawer();
        clearPreviewState();
        setStatus('', 'Waiting for payload...');
    }

    function renderPreFlightReview(filePaths) {
        elements.integratorEmptyState.style.display = 'none';
        elements.parsedFilesList.style.display = 'flex';
        elements.parsedFilesList.innerHTML = '';

        filePaths.forEach(path => {
            const sizeEstimate = new Blob([activePayload[path]]).size;
            const kbSize = (sizeEstimate / 1024).toFixed(2);

            const li = document.createElement('li');
            li.className = 'parsed-file-item';
            
            li.innerHTML = `
                <div class="file-item-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </div>
                <div class="file-item-details">
                    <span class="file-item-path">${path}</span>
                    <span class="file-item-meta">Payload weight: ${kbSize} KB</span>
                </div>
            `;
            
            li.addEventListener('click', () => {
                const allItems = elements.parsedFilesList.querySelectorAll('.parsed-file-item');
                allItems.forEach(el => el.classList.remove('active-preview'));
                
                li.classList.add('active-preview');
                openPreviewDrawer(path, activePayload[path]);
            });
            
            elements.parsedFilesList.appendChild(li);
        });

        elements.btnExecuteIntegration.disabled = false;
    }
})();