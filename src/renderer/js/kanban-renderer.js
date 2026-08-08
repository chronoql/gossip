/**
 * Chronoql Gossip: Kanban Renderer
 * Orchestrates the vanilla JavaScript UI binding, state management, and DOM manipulation 
 * for the Project Management and Kanban modules.
 */

(() => {
    const KanbanState = {
        currentProjectId: null,
        projects: [], 
        draggedCardId: null,
        sourceColumnId: null,
        draggedColumnId: null, 
        isPickingColor: false,
        colorTarget: 'bg', 
        activeColors: { bg: '#FFFFFF', text: '#172b4d' }
    };

    // Reusable SVG Icons
    const paperclipSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>`;
    const editSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    const paletteSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10c0 1.25-.9 2.5-2 2.5h-1.5c-.55 0-1 .45-1 1 0 .26.1.5.28.7.2.2.32.5.32.8 0 1.1-.9 2-2 2h-1c-2.21 0-4-1.79-4-4z"></path><circle cx="7.5" cy="10.5" r="1.5" fill="currentColor"></circle><circle cx="10.5" cy="6.5" r="1.5" fill="currentColor"></circle><circle cx="14.5" cy="6.5" r="1.5" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r="1.5" fill="currentColor"></circle></svg>`;

    let elements = {};

    window.initKanbanSystem = async () => {
        console.log('[Kanban] Module registered and awaiting user orchestration.');
    };

    window.syncKanbanBoard = () => {
        const canvas = document.getElementById('kanban-board-canvas');
        if (canvas && KanbanState.currentProjectId) {
            loadBoardState(KanbanState.currentProjectId);
        }
    };

    window.loadKanbanBoard = async () => {
        const dynamicStage = document.getElementById('dynamic-stage');
        const mainStageTitle = document.getElementById('macro-view-title');
        const kanbanMount = document.getElementById('kanban-mount');

        if (mainStageTitle) mainStageTitle.innerText = 'Kanban Board';

        if (kanbanMount && kanbanMount.innerHTML) {
            dynamicStage.innerHTML = kanbanMount.innerHTML;
        } else {
            dynamicStage.innerHTML = `<div class="empty-state-container"><p>Failed to mount Kanban orchestration module.</p></div>`;
            return;
        }

        elements = {
            projectSelectorInput: dynamicStage.querySelector('#project-selector-input'),
            courseSelector: dynamicStage.querySelector('#course-link-selector'),
            btnNewProject: dynamicStage.querySelector('#btn-new-project'),
            btnEditProject: dynamicStage.querySelector('#btn-edit-project'),
            btnDeleteProject: dynamicStage.querySelector('#btn-delete-project'),
            btnPromoteBoard: dynamicStage.querySelector('#btn-promote-board'),
            btnDuplicateProject: dynamicStage.querySelector('#btn-duplicate-project'),
            boardCanvas: dynamicStage.querySelector('#kanban-board-canvas'),
            btnAddColumn: dynamicStage.querySelector('#btn-add-column'),
            
            modalDialog: dynamicStage.querySelector('#kanban-input-modal'),
            modalTitle: dynamicStage.querySelector('#kanban-modal-title'),
            modalPrimaryGroup: dynamicStage.querySelector('#kanban-modal-primary-group'),
            modalLabel: dynamicStage.querySelector('#kanban-modal-label'),
            modalInput: dynamicStage.querySelector('#kanban-modal-input'),
            
            modalSecGroup: dynamicStage.querySelector('#kanban-modal-secondary-group'),
            modalSecLabel: dynamicStage.querySelector('#kanban-modal-secondary-label'),
            modalSecInput: dynamicStage.querySelector('#kanban-modal-secondary-input'),
            
            modalAttachmentsGroup: dynamicStage.querySelector('#kanban-modal-attachments-group'),
            btnAttach: dynamicStage.querySelector('#btn-kanban-attach'),
            attachmentInput: dynamicStage.querySelector('#kanban-attachment-input'),
            attachmentList: dynamicStage.querySelector('#kanban-attachment-list'),

            modalColorGroup: dynamicStage.querySelector('#kanban-modal-color-group'),
            modalColorLabel: dynamicStage.querySelector('#kanban-modal-color-label'),
            modalColorInput: dynamicStage.querySelector('#kanban-modal-color-input'),
            modalSwatchesContainer: dynamicStage.querySelector('#kanban-color-swatches'),
            
            modalRecentColorWrapper: dynamicStage.querySelector('#kanban-recent-color-wrapper'),
            modalRecentColorSwatch: dynamicStage.querySelector('#kanban-recent-color-swatch'),
            
            btnBgImage: dynamicStage.querySelector('#btn-kanban-bg-image'),
            bgImageInput: dynamicStage.querySelector('#kanban-bg-image-input'),
            bgImagePreviewWrapper: dynamicStage.querySelector('#kanban-bg-image-preview-wrapper'),
            bgImageName: dynamicStage.querySelector('#kanban-bg-image-name'),
            btnRemoveBgImage: dynamicStage.querySelector('#btn-kanban-remove-bg-image'),

            colorTargetToggle: dynamicStage.querySelector('#color-target-toggle'),
            colorTargetRadios: dynamicStage.querySelectorAll('input[name="colorTarget"]'),
            
            customColorPickerUI: dynamicStage.querySelector('#custom-color-picker'),
            colorWheelCanvas: dynamicStage.querySelector('#color-wheel-canvas'),
            colorPreviewBox: dynamicStage.querySelector('#color-preview-box'),
            sliderR: dynamicStage.querySelector('#slider-r'),
            sliderG: dynamicStage.querySelector('#slider-g'),
            sliderB: dynamicStage.querySelector('#slider-b'),
            valR: dynamicStage.querySelector('#val-r'),
            valG: dynamicStage.querySelector('#val-g'),
            valB: dynamicStage.querySelector('#val-b'),

            modalBtnConfirm: dynamicStage.querySelector('.btn-confirm-modal'),
            modalBtnCancel: dynamicStage.querySelector('.btn-cancel-modal')
        };

        KanbanState.currentProjectId = null;

        bindGlobalOrchestrators();
        await refreshProjectRoster();
    }


    // ==========================================
    // CUSTOM COLOR ENGINE
    // ==========================================

    function drawColorWheel() {
        const canvas = elements.colorWheelCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const radius = canvas.width / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const conicGradient = ctx.createConicGradient(0, radius, radius);
        conicGradient.addColorStop(0, '#f00');
        conicGradient.addColorStop(1/6, '#f0f');
        conicGradient.addColorStop(2/6, '#00f');
        conicGradient.addColorStop(3/6, '#0ff');
        conicGradient.addColorStop(4/6, '#0f0');
        conicGradient.addColorStop(5/6, '#ff0');
        conicGradient.addColorStop(1, '#f00');
        
        ctx.fillStyle = conicGradient;
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, 2 * Math.PI);
        ctx.fill();

        const radialGradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
        radialGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        radialGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = radialGradient;
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, 2 * Math.PI);
        ctx.fill();
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    }

    function rgbToHex(r, g, b) {
        return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
    }

    function updatePreviewBox() {
        elements.colorPreviewBox.style.backgroundColor = KanbanState.activeColors.bg;
        elements.colorPreviewBox.style.color = KanbanState.activeColors.text;
    }

    function syncPickerUIFromRgb(r, g, b) {
        elements.sliderR.value = r;
        elements.sliderG.value = g;
        elements.sliderB.value = b;
        elements.valR.textContent = r;
        elements.valG.textContent = g;
        elements.valB.textContent = b;
        
        const hex = rgbToHex(r, g, b);
        elements.modalColorInput.value = hex;
        
        KanbanState.activeColors[KanbanState.colorTarget] = hex;
        updatePreviewBox();
    }

    function handleCanvasInteraction(e) {
        const rect = elements.colorWheelCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const radius = elements.colorWheelCanvas.width / 2;
        const dist = Math.sqrt(Math.pow(x - radius, 2) + Math.pow(y - radius, 2));
        if (dist > radius) return;

        const ctx = elements.colorWheelCanvas.getContext('2d');
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        
        syncPickerUIFromRgb(pixel[0], pixel[1], pixel[2]);
    }

    // ==========================================
    // CUSTOM PROMPT ORCHESTRATION
    // ==========================================

    function showKanbanPrompt(options) {
        return new Promise((resolve) => {
            elements.modalTitle.textContent = options.title || 'Input Required';
            
            if (options.hidePrimary) {
                elements.modalPrimaryGroup.style.display = 'none';
            } else {
                elements.modalPrimaryGroup.style.display = 'flex';
                elements.modalLabel.textContent = options.label || 'Value:';
                elements.modalInput.value = options.defaultValue || '';
            }

            if (options.secondaryLabel) {
                elements.modalSecGroup.style.display = 'flex';
                elements.modalSecLabel.textContent = options.secondaryLabel;
                elements.modalSecInput.value = options.secondaryDefault || '';
            } else {
                elements.modalSecGroup.style.display = 'none';
            }

            let activeAttachments = options.attachments ? [...options.attachments] : [];
            let newFiles = []; 
            let removedPayloads = []; 
            let backgroundImageOverride = null;

            const renderAttachments = () => {
                elements.attachmentList.innerHTML = '';
                
                activeAttachments.forEach(att => {
                    const attName = att.file_name || att.fileName || 'Unknown File';
                    const attPath = att.file_path || att.filePath || '';
                    const attId = att.attachment_id || att.attachmentId || att.id;

                    const li = document.createElement('li');
                    li.className = 'kanban-attachment-item';
                    li.innerHTML = `
                        <span class="kanban-attachment-name" title="${escapeHtml(attName)}" style="display: flex; align-items: center; gap: 6px;">
                            ${paperclipSvg} ${escapeHtml(attName)}
                        </span>
                        <button type="button" class="btn-remove-attachment" aria-label="Remove Attachment">✖</button>
                    `;
                    
                    li.querySelector('.kanban-attachment-name').onclick = async () => {
                        await window.api.kanban.openAttachment({ filePath: attPath, isAbsolute: false });
                    };

                    li.querySelector('.btn-remove-attachment').onclick = () => {
                        removedPayloads.push({ attachmentId: attId, filePath: attPath });
                        activeAttachments = activeAttachments.filter(a => (a.attachment_id || a.attachmentId || a.id) !== attId);
                        renderAttachments();
                    };
                    elements.attachmentList.appendChild(li);
                });
                
                newFiles.forEach((file, index) => {
                    const li = document.createElement('li');
                    li.className = 'kanban-attachment-item';
                    li.innerHTML = `
                        <span class="kanban-attachment-name" title="${escapeHtml(file.path)}" style="display: flex; align-items: center; gap: 6px;">
                            ${paperclipSvg} ${escapeHtml(file.name)} (New)
                        </span>
                        <button type="button" class="btn-remove-attachment" aria-label="Remove Attachment">✖</button>
                    `;
                    
                    li.querySelector('.kanban-attachment-name').onclick = async () => {
                        await window.api.kanban.openAttachment({ filePath: file.path, isAbsolute: true });
                    };

                    li.querySelector('.btn-remove-attachment').onclick = () => {
                        newFiles.splice(index, 1);
                        renderAttachments();
                    };
                    elements.attachmentList.appendChild(li);
                });
            };

            const onAttachClick = (e) => {
                e.preventDefault();
                elements.attachmentInput.click();
            };

            const onAttachChange = (e) => {
                for (let file of e.target.files) {
                    newFiles.push(file);
                }
                renderAttachments();
                elements.attachmentInput.value = ''; 
            };

            const onBgImageClick = (e) => {
                e.preventDefault();
                elements.bgImageInput.click();
            };

            const onBgImageChange = async (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    try {
                        const result = await window.api.kanban.uploadBackground({ filePath: file.path, fileName: file.name });
                        if (result && result.success) {
                            backgroundImageOverride = `url('file://${result.filePath.replace(/\\/g, '/')}')`;
                            elements.bgImagePreviewWrapper.style.display = 'flex';
                            elements.bgImageName.textContent = file.name;
                        }
                    } catch (error) {
                        console.error('[Kanban] Failed to handle background image upload:', error);
                    }
                }
                elements.bgImageInput.value = '';
            };

            const onRemoveBgImage = () => {
                backgroundImageOverride = null;
                elements.bgImagePreviewWrapper.style.display = 'none';
                elements.bgImageName.textContent = '';
                
                const rgb = hexToRgb(KanbanState.activeColors.bg);
                if (rgb) syncPickerUIFromRgb(rgb.r, rgb.g, rgb.b);
            };

            if (options.showAttachments) {
                elements.modalAttachmentsGroup.style.display = 'flex';
                renderAttachments();
                elements.btnAttach.addEventListener('click', onAttachClick);
                elements.attachmentInput.addEventListener('change', onAttachChange);
            } else {
                elements.modalAttachmentsGroup.style.display = 'none';
            }

            const syncFromSliders = () => {
                const r = parseInt(elements.sliderR.value);
                const g = parseInt(elements.sliderG.value);
                const b = parseInt(elements.sliderB.value);
                syncPickerUIFromRgb(r, g, b);
                backgroundImageOverride = null; 
                elements.bgImagePreviewWrapper.style.display = 'none';
            };

            const syncFromHexInput = (e) => {
                let val = e.target.value;
                if (!val.startsWith('#')) val = '#' + val.replace(/#/g, '');
                val = '#' + val.substring(1).replace(/[^0-9A-Fa-f]/g, '');
                e.target.value = val;

                if (val.length === 7) {
                    const rgb = hexToRgb(val);
                    if (rgb) {
                        KanbanState.activeColors[KanbanState.colorTarget] = val;
                        syncPickerUIFromRgb(rgb.r, rgb.g, rgb.b);
                        updatePreviewBox();
                        backgroundImageOverride = null;
                        elements.bgImagePreviewWrapper.style.display = 'none';
                    }
                }
            };

            const onHexInputFocus = (e) => {
                e.target.setSelectionRange(1, e.target.value.length);
            };

            const updateRecentColorSwatch = () => {
                const recentBg = localStorage.getItem('chronoql-kanban-recent-bg');
                const recentText = localStorage.getItem('chronoql-kanban-recent-text') || '#172b4d';
                
                if (recentBg && !recentBg.includes('url(')) {
                    elements.modalRecentColorWrapper.style.display = 'flex';
                    elements.modalRecentColorSwatch.style.backgroundColor = recentBg;
                    elements.modalRecentColorSwatch.style.color = recentText;

                    elements.modalRecentColorSwatch.onclick = () => {
                        KanbanState.activeColors.bg = recentBg;
                        if (options.showTextToggle) {
                            KanbanState.activeColors.text = recentText;
                        }
                        
                        const currentTargetHex = KanbanState.activeColors[KanbanState.colorTarget];
                        const rgb = hexToRgb(currentTargetHex);
                        if (rgb) {
                            syncPickerUIFromRgb(rgb.r, rgb.g, rgb.b);
                        }
                        
                        updatePreviewBox();
                        backgroundImageOverride = null;
                        elements.bgImagePreviewWrapper.style.display = 'none';
                    };
                } else {
                    elements.modalRecentColorWrapper.style.display = 'none';
                }
            };

            const onTargetToggle = (e) => {
                KanbanState.colorTarget = e.target.value;
                const currentHex = KanbanState.activeColors[KanbanState.colorTarget];
                const rgb = hexToRgb(currentHex);
                if (rgb) syncPickerUIFromRgb(rgb.r, rgb.g, rgb.b);
                elements.modalColorInput.value = currentHex;
            };

            const onCanvasMouseDown = (e) => {
                KanbanState.isPickingColor = true;
                backgroundImageOverride = null;
                elements.bgImagePreviewWrapper.style.display = 'none';
                handleCanvasInteraction(e);
            };
            const onCanvasMouseMove = (e) => {
                if (KanbanState.isPickingColor) handleCanvasInteraction(e);
            };
            const onCanvasMouseUp = () => {
                KanbanState.isPickingColor = false;
            };

            if (options.isColorPicker) {
                elements.modalColorGroup.style.display = 'flex';
                elements.modalColorLabel.textContent = options.colorLabel || 'Color';
                
                KanbanState.colorTarget = 'bg';
                elements.colorTargetRadios[0].checked = true; 
                
                if (options.colorDefault && options.colorDefault.includes('url(')) {
                    KanbanState.activeColors.bg = '#0079BF';
                    backgroundImageOverride = options.colorDefault;
                    elements.bgImagePreviewWrapper.style.display = 'flex';
                    elements.bgImageName.textContent = 'Current Image';
                } else {
                    KanbanState.activeColors.bg = options.colorDefault || '#FFFFFF';
                    backgroundImageOverride = null;
                    elements.bgImagePreviewWrapper.style.display = 'none';
                }
                
                KanbanState.activeColors.text = options.textColorDefault || '#172b4d';
                
                if (options.allowImage) {
                    elements.btnBgImage.style.display = 'inline-block';
                } else {
                    elements.btnBgImage.style.display = 'none';
                    elements.bgImagePreviewWrapper.style.display = 'none';
                }

                if (options.showTextToggle) {
                    elements.colorTargetToggle.style.display = 'flex';
                } else {
                    elements.colorTargetToggle.style.display = 'none';
                }

                updateRecentColorSwatch();

                elements.customColorPickerUI.style.display = 'flex';
                elements.modalSwatchesContainer.style.display = 'flex';
                elements.modalSwatchesContainer.innerHTML = '';
                
                drawColorWheel();

                const initRgb = hexToRgb(KanbanState.activeColors.bg);
                if (initRgb) syncPickerUIFromRgb(initRgb.r, initRgb.g, initRgb.b);
                updatePreviewBox();
                
                const presetColors = [
                    '#FFFFFF', '#0079BF', '#519839', '#D29034', '#B04632', 
                    '#89609E', '#CD5A91', '#00AECC', '#838C91', '#172b4d'
                ];
                
                presetColors.forEach(color => {
                    const swatch = document.createElement('div');
                    swatch.className = 'color-swatch';
                    swatch.style.backgroundColor = color;
                    swatch.title = color;
                    
                    swatch.addEventListener('click', () => {
                        const rgb = hexToRgb(color);
                        if (rgb) {
                            KanbanState.activeColors[KanbanState.colorTarget] = color;
                            syncPickerUIFromRgb(rgb.r, rgb.g, rgb.b);
                            updatePreviewBox();
                            backgroundImageOverride = null;
                            elements.bgImagePreviewWrapper.style.display = 'none';
                        }
                    });
                    
                    elements.modalSwatchesContainer.appendChild(swatch);
                });
                
                elements.sliderR.addEventListener('input', syncFromSliders);
                elements.sliderG.addEventListener('input', syncFromSliders);
                elements.sliderB.addEventListener('input', syncFromSliders);
                elements.modalColorInput.addEventListener('input', syncFromHexInput);
                elements.modalColorInput.addEventListener('focus', onHexInputFocus);
                elements.colorWheelCanvas.addEventListener('mousedown', onCanvasMouseDown);
                elements.colorWheelCanvas.addEventListener('mousemove', onCanvasMouseMove);
                window.addEventListener('mouseup', onCanvasMouseUp);
                elements.colorTargetRadios.forEach(radio => radio.addEventListener('change', onTargetToggle));
                elements.btnBgImage.addEventListener('click', onBgImageClick);
                elements.bgImageInput.addEventListener('change', onBgImageChange);
                elements.btnRemoveBgImage.addEventListener('click', onRemoveBgImage);

            } else {
                elements.modalColorGroup.style.display = 'none';
            }

            const cleanup = () => {
                elements.modalBtnConfirm.removeEventListener('click', onConfirm);
                elements.modalBtnCancel.removeEventListener('click', onCancel);
                elements.modalInput.removeEventListener('keydown', onKeyDown);
                elements.modalSecInput.removeEventListener('keydown', onKeyDown);
                
                if (options.showAttachments) {
                    elements.btnAttach.removeEventListener('click', onAttachClick);
                    elements.attachmentInput.removeEventListener('change', onAttachChange);
                }
                
                if (options.isColorPicker) {
                    elements.sliderR.removeEventListener('input', syncFromSliders);
                    elements.sliderG.removeEventListener('input', syncFromSliders);
                    elements.sliderB.removeEventListener('input', syncFromSliders);
                    elements.modalColorInput.removeEventListener('input', syncFromHexInput);
                    elements.modalColorInput.removeEventListener('focus', onHexInputFocus);
                    elements.colorWheelCanvas.removeEventListener('mousedown', onCanvasMouseDown);
                    elements.colorWheelCanvas.removeEventListener('mousemove', onCanvasMouseMove);
                    window.removeEventListener('mouseup', onCanvasMouseUp);
                    elements.colorTargetRadios.forEach(radio => radio.removeEventListener('change', onTargetToggle));
                    elements.btnBgImage.removeEventListener('click', onBgImageClick);
                    elements.bgImageInput.removeEventListener('change', onBgImageChange);
                    elements.btnRemoveBgImage.removeEventListener('click', onRemoveBgImage);
                }
                
                elements.modalDialog.close();
            };

            const onConfirm = () => {
                const finalColor = backgroundImageOverride || KanbanState.activeColors.bg;

                if (options.isColorPicker && !finalColor.includes('url(')) {
                    localStorage.setItem('chronoql-kanban-recent-bg', finalColor);
                    if (options.showTextToggle) {
                        localStorage.setItem('chronoql-kanban-recent-text', KanbanState.activeColors.text);
                    }
                }
                
                cleanup();
                resolve({
                    primary: options.hidePrimary ? null : elements.modalInput.value.trim(),
                    secondary: options.secondaryLabel ? elements.modalSecInput.value.trim() : null,
                    color: options.isColorPicker ? finalColor : null,
                    textColor: options.isColorPicker && options.showTextToggle ? KanbanState.activeColors.text : null,
                    newAttachments: newFiles.map(f => ({ fileName: f.name, filePath: f.path })),
                    removedAttachments: removedPayloads
                });
            };

            const onCancel = () => {
                cleanup();
                resolve(null);
            };

            const onKeyDown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onConfirm();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancel();
                }
            };

            elements.modalBtnConfirm.addEventListener('click', onConfirm);
            elements.modalBtnCancel.addEventListener('click', onCancel);
            elements.modalInput.addEventListener('keydown', onKeyDown);
            elements.modalSecInput.addEventListener('keydown', onKeyDown);

            elements.modalDialog.showModal();
            
            if (!options.hidePrimary) {
                elements.modalInput.focus();
                elements.modalInput.select();
            }
        });
    }

    // ==========================================
    // DATA FETCHING & RENDERING ORCHESTRATION
    // ==========================================

    async function refreshProjectRoster(selectProjectId = null) {
        elements.projectSelectorInput.innerHTML = '';
        
        try {
            const projects = await window.api.kanban.getProjects();
            KanbanState.projects = projects;
            
            if (projects.length === 0) {
                elements.boardCanvas.style.display = 'none';
                document.body.style.setProperty('--board-bg-color', '#0079bf'); 
                document.getElementById('kanban-main-view').style.backgroundImage = 'none';
                
                elements.projectSelectorInput.disabled = true;
                const opt = document.createElement('option');
                opt.textContent = 'No projects available';
                elements.projectSelectorInput.appendChild(opt);

                if (elements.btnPromoteBoard) elements.btnPromoteBoard.style.display = 'none';
                if (elements.btnDuplicateProject) elements.btnDuplicateProject.style.display = 'none';
                return;
            }

            elements.projectSelectorInput.disabled = false;

            projects.forEach(proj => {
                const pName = proj.project_name || proj.projectName || 'Untitled Project';
                const pId = proj.project_id || proj.projectId || proj.id;
                const option = document.createElement('option');
                option.value = pId;
                option.textContent = pName; 
                elements.projectSelectorInput.appendChild(option);
            });

            elements.boardCanvas.style.display = 'flex';

            let targetId = selectProjectId;
            
            if (!targetId) {
                const savedId = localStorage.getItem('chronoql-kanban-last-project');
                if (savedId && projects.some(p => String(p.project_id || p.projectId || p.id) === String(savedId))) {
                    targetId = savedId;
                } else {
                    targetId = projects[0].project_id || projects[0].projectId || projects[0].id;
                }
            }

            if (targetId) {
                const matched = projects.find(p => String(p.project_id || p.projectId || p.id) === String(targetId));
                if (matched) {
                    elements.projectSelectorInput.value = targetId;
                    KanbanState.currentProjectId = targetId;
                    
                    localStorage.setItem('chronoql-kanban-last-project', targetId);
                    
                    await loadBoardState(targetId);
                }
            }
        } catch (error) {
            console.error('[Kanban] Failed to fetch project roster:', error);
        }
    }

    async function loadBoardState(projectId) {
        if (!projectId) return;
        
        try {
            const projects = await window.api.kanban.getProjects();
            const activeProject = projects.find(p => String(p.project_id || p.projectId || p.id) === String(projectId));
            
            if (activeProject) {
                const pName = activeProject.project_name || activeProject.projectName || 'Untitled Project';
                const bgColor = activeProject.background_color || activeProject.backgroundColor || '#0079BF';

                const mainView = document.getElementById('kanban-main-view');
                if (bgColor.includes('url(')) {
                    mainView.style.backgroundImage = bgColor;
                    document.body.style.setProperty('--board-bg-color', 'transparent');
                } else {
                    mainView.style.backgroundImage = 'none';
                    document.body.style.setProperty('--board-bg-color', bgColor);
                }

                elements.projectSelectorInput.value = projectId; 

                if (pName === 'My Quick Tasks' || pName === 'Active Sprint') {
                    elements.btnDeleteProject.style.display = 'none';
                    elements.btnEditProject.style.display = 'none';
                    if (elements.btnDuplicateProject) elements.btnDuplicateProject.style.display = 'none';
                    if (elements.btnPromoteBoard) elements.btnPromoteBoard.style.display = '';
                } else {
                    elements.btnDeleteProject.style.display = '';
                    elements.btnEditProject.style.display = '';
                    if (elements.btnDuplicateProject) elements.btnDuplicateProject.style.display = '';
                    if (elements.btnPromoteBoard) elements.btnPromoteBoard.style.display = 'none';
                }
            }

            const addColWrapper = elements.boardCanvas.querySelector('.kanban-add-column-wrapper');
            elements.boardCanvas.innerHTML = '';
            
            const columns = await window.api.kanban.getColumns(projectId);
            const columnArray = Array.isArray(columns) ? columns : (columns.data || []);
            
            for (const column of columnArray) {
                const columnDom = await architectColumnDom(column);
                elements.boardCanvas.appendChild(columnDom);
            }
            
            elements.boardCanvas.appendChild(addColWrapper);
            orchestrateDragAndDrop();

        } catch (error) {
            console.error('[Kanban] Failed to load board state:', error);
        }
    }

    // ==========================================
    // DOM ARCHITECTURE
    // ==========================================

    async function architectColumnDom(columnData) {
        const colId = columnData.column_id || columnData.columnId || columnData.id;
        const colName = columnData.column_name || columnData.columnName || 'Untitled';

        const columnWrapper = document.createElement('div');
        columnWrapper.className = 'kanban-column';
        columnWrapper.dataset.columnId = colId;
        columnWrapper.draggable = true;

        columnWrapper.innerHTML = `
            <header class="column-header">
                <h3 class="column-title" contenteditable="true" draggable="false">${escapeHtml(colName)}</h3>
                <button class="btn-icon btn-delete-column" data-tooltip="Remove Column" aria-label="Delete Column">✖</button>
            </header>
            <div class="column-card-container"></div>
            <footer class="column-footer">
                <button class="btn-add-card" data-tooltip="Add a new task to this column">+ Add Card</button>
            </footer>
        `;

        const cardContainer = columnWrapper.querySelector('.column-card-container');
        const cards = await window.api.kanban.getCards(colId);
        const cardArray = Array.isArray(cards) ? cards : (cards.data || []);
        
        for (const card of cardArray) {
            const cardDom = await architectCardDom(card);
            cardContainer.appendChild(cardDom);
        }

        return columnWrapper;
    }

    async function architectCardDom(cardData) {
        const cId = cardData.card_id || cardData.cardId || cardData.id;
        const cTitle = cardData.card_title || cardData.cardTitle || 'Untitled';
        const cContent = cardData.card_content || cardData.cardContent || '';
        const cColor = cardData.card_color || cardData.cardColor;
        const tColor = cardData.text_color || cardData.textColor;

        const cardArticle = document.createElement('article');
        cardArticle.className = 'kanban-card cluster-card';
        cardArticle.dataset.cardId = cId;
        cardArticle.draggable = true;
        
        if (cColor) cardArticle.style.setProperty('--card-bg-color', cColor);
        if (tColor) cardArticle.style.setProperty('--card-text-color', tColor);

        const attachments = await window.api.kanban.getAttachments(cId);
        const hasAttachments = attachments && attachments.length > 0;
        
        const attachmentStyle = hasAttachments ? 'display: flex; align-items: center; justify-content: center;' : 'display: none;';

        let safeDateStr = cardData.last_edited_at || cardData.lastEditedAt || new Date().toISOString();

        const formattedDate = new Date(safeDateStr).toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });

        cardArticle.innerHTML = `
            <div class="card-header">
                <h4 class="card-title" contenteditable="true" draggable="false">${escapeHtml(cTitle)}</h4>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span class="attachment-marker" aria-hidden="true" style="${attachmentStyle}" data-tooltip="This card contains attachments">
                        ${paperclipSvg}
                    </span>
                    <button class="btn-icon btn-delete-card-x" data-tooltip="Delete Card" aria-label="Delete Card">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <p class="card-content">${escapeHtml(cContent)}</p>
            </div>
            <footer class="card-footer">
                <span class="card-timestamp"><time class="last-edited-time">${formattedDate}</time></span>
                <div style="display: flex; gap: 4px;">
                    <button class="btn-icon btn-color-card" data-tooltip="Change Card Color" aria-label="Change Color">${paletteSvg}</button>
                    <button class="btn-icon btn-edit-card" data-tooltip="Edit Card Details" aria-label="Edit Card">${editSvg}</button>
                </div>
            </footer>
        `;

        return cardArticle;
    }

    // ==========================================
    // EVENT ORCHESTRATION
    // ==========================================

    function bindGlobalOrchestrators() {

        // ARCHITECTURAL FIX: Rebind to native 'change' event instead of filtering input
        elements.projectSelectorInput.addEventListener('change', (e) => {
            const matchedId = e.target.value;
            if (matchedId != KanbanState.currentProjectId) {
                KanbanState.currentProjectId = matchedId;
                localStorage.setItem('chronoql-kanban-last-project', matchedId);
                loadBoardState(KanbanState.currentProjectId);
            }
        });

        elements.btnNewProject.addEventListener('click', async () => {
            const result = await showKanbanPrompt({
                title: 'New Kanban Project',
                label: 'Enter Project Name:'
            });
            
            if (!result || !result.primary) return;
            
            const payload = {
                projectName: result.primary,
                backgroundColor: '#0079BF',
                courseId: null
            };
            
            const createResult = await window.api.kanban.createProject(payload);
            
            const newId = createResult ? (createResult.projectId || createResult.project_id || createResult.id) : null;
            if (newId || (createResult && createResult.success)) {
                await refreshProjectRoster(newId || createResult.projectId);
            } else {
                await refreshProjectRoster();
            }
        });

        if (elements.btnDuplicateProject) {
            elements.btnDuplicateProject.addEventListener('click', async () => {
                if (!KanbanState.currentProjectId) return;
                
                const activeProject = KanbanState.projects.find(p => String(p.project_id || p.projectId || p.id) === String(KanbanState.currentProjectId));
                const originalName = activeProject ? (activeProject.project_name || activeProject.projectName || '') : '';
                
                const result = await showKanbanPrompt({
                    title: 'Duplicate Project',
                    label: 'New Project Name:',
                    defaultValue: `${originalName} (Copy)`
                });
                
                if (result && result.primary) {
                    const payload = { projectName: result.primary };
                    const duplicateResult = await window.api.kanban.duplicateProject(KanbanState.currentProjectId, payload);
                    
                    if (duplicateResult && duplicateResult.success) {
                        const newId = duplicateResult.newProjectId || duplicateResult.new_project_id;
                        await refreshProjectRoster(newId);
                        if (window.syncSidebar) window.syncSidebar();
                    }
                }
            });
        }

        elements.btnEditProject.addEventListener('click', async () => {
            if (!KanbanState.currentProjectId) return;
            const activeProject = KanbanState.projects.find(p => String(p.project_id || p.projectId || p.id) === String(KanbanState.currentProjectId));
            if (!activeProject) return;

            const pName = activeProject.project_name || activeProject.projectName || '';
            if (pName === 'My Quick Tasks' || pName === 'Active Sprint') return;
            
            const bgColor = activeProject.background_color || activeProject.backgroundColor || '#0079BF';
            
            const result = await showKanbanPrompt({
                title: 'Project Settings',
                label: 'Rename Project:',
                defaultValue: pName,
                isColorPicker: true,
                allowImage: true,
                showTextToggle: false, 
                colorLabel: 'Background Configuration:',
                colorDefault: bgColor
            });
            
            if (result && (result.primary || result.color)) {
                await window.api.kanban.updateProject(KanbanState.currentProjectId, {
                    projectName: result.primary || pName,
                    backgroundColor: result.color || bgColor,
                    courseId: null
                });
                await refreshProjectRoster(KanbanState.currentProjectId);
            }
        });

        if (elements.btnPromoteBoard) {
            elements.btnPromoteBoard.addEventListener('click', async () => {
                if (!KanbanState.currentProjectId) return;
                
                const result = await showKanbanPrompt({
                    title: 'Promote Quick Tasks',
                    label: 'New Project Name:',
                    defaultValue: 'My Action Plan',
                    isColorPicker: true,
                    allowImage: false,
                    showTextToggle: false, 
                    colorLabel: 'Theme:',
                    colorDefault: '#89609E'
                });
                
                if (result && result.primary) {
                    const payload = {
                        projectName: result.primary,
                        backgroundColor: result.color || '#89609E',
                        courseId: null
                    };
                    
                    const promoteResult = await window.api.kanban.promoteProject(KanbanState.currentProjectId, payload);
                    
                    if (promoteResult && promoteResult.success) {
                        const newId = promoteResult.newProjectId || promoteResult.new_project_id;
                        await refreshProjectRoster(newId);
                        if (window.syncSidebar) window.syncSidebar();
                    }
                }
            });
        }

        elements.btnDeleteProject.addEventListener('click', async () => {
            if (!KanbanState.currentProjectId) return;
            
            const activeProject = KanbanState.projects.find(p => String(p.project_id || p.projectId || p.id) === String(KanbanState.currentProjectId));
            const pName = activeProject ? (activeProject.project_name || activeProject.projectName || '') : '';
            if (pName === 'My Quick Tasks' || pName === 'Active Sprint') {
                return; 
            }
            
            if (confirm('Are you sure you want to orchestrate the deletion of this entire project and all its cards?')) {
                await window.api.kanban.deleteProject(KanbanState.currentProjectId);
                KanbanState.currentProjectId = null;
                await refreshProjectRoster();
            }
        });

        elements.btnAddColumn.addEventListener('click', async () => {
            if (!KanbanState.currentProjectId) return;
            
            const existingColumns = await window.api.kanban.getColumns(KanbanState.currentProjectId);
            const columnsArray = Array.isArray(existingColumns) ? existingColumns : (existingColumns.data || []);
            const nextIndex = columnsArray.length;

            await window.api.kanban.createColumn({
                projectId: KanbanState.currentProjectId,
                columnName: 'New Column',
                positionIndex: nextIndex
            });
            
            await loadBoardState(KanbanState.currentProjectId);
            if (window.syncSidebar) window.syncSidebar();
        });

        elements.boardCanvas.addEventListener('click', async (e) => {
            
            if (e.target.classList.contains('btn-delete-column')) {
                const colWrapper = e.target.closest('.kanban-column');
                const colId = colWrapper.dataset.columnId;
                
                const parentContainer = e.target.closest('.kanban-board-canvas');
                const columns = parentContainer.querySelectorAll('.kanban-column');
                
                if (columns.length <= 1) {
                    alert('Action Denied: A Kanban board must retain at least one column.');
                    return;
                }

                if (confirm('Delete this column and all cards within it?')) {
                    await window.api.kanban.deleteColumn(colId);
                    await loadBoardState(KanbanState.currentProjectId);
                    if (window.syncSidebar) window.syncSidebar();
                }
                return;
            }
            
            if (e.target.classList.contains('btn-delete-card-x') || e.target.closest('.btn-delete-card-x')) {
                const cardArticle = e.target.closest('.kanban-card');
                const cardId = cardArticle.dataset.cardId;
                if (confirm('Are you sure you want to permanently delete this card and its attachments?')) {
                    await window.api.kanban.deleteCard(cardId);
                    await loadBoardState(KanbanState.currentProjectId);
                    if (window.syncSidebar) window.syncSidebar();
                }
                return;
            }

            if (e.target.classList.contains('btn-add-card')) {
                const colWrapper = e.target.closest('.kanban-column');
                const container = colWrapper.querySelector('.column-card-container');
                const colId = colWrapper.dataset.columnId;
                
                e.target.style.display = 'none';

                const composerDiv = document.createElement('div');
                composerDiv.className = 'inline-card-composer';
                composerDiv.innerHTML = `
                    <textarea class="inline-composer-textarea" placeholder="Enter a card name..."></textarea>
                    <div class="inline-composer-actions">
                        <button class="btn-primary btn-composer-add">Add</button>
                        <button class="btn-composer-cancel">Cancel</button>
                    </div>
                `;

                container.appendChild(composerDiv);
                const textarea = composerDiv.querySelector('.inline-composer-textarea');
                textarea.focus();

                textarea.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = (this.scrollHeight) + 'px';
                });

                const cleanupComposer = () => {
                    if (composerDiv.parentNode) {
                        composerDiv.parentNode.removeChild(composerDiv);
                    }
                    e.target.style.display = 'block';
                };

                const executeAdd = async () => {
                    const title = textarea.value.trim();
                    if (!title) {
                        cleanupComposer();
                        return;
                    }

                    const cards = await window.api.kanban.getCards(colId);
                    const cardsArray = Array.isArray(cards) ? cards : (cards.data || []);
                    const nextIndex = cardsArray.length;

                    const recentBg = localStorage.getItem('chronoql-kanban-recent-bg') || '#ffffff';
                    let safeBg = recentBg.includes('url(') ? '#ffffff' : recentBg;
                    const recentText = localStorage.getItem('chronoql-kanban-recent-text') || '#172b4d';

                    await window.api.kanban.createCard({
                        columnId: colId,
                        cardTitle: title,
                        cardContent: '',
                        cardColor: safeBg,
                        textColor: recentText,
                        positionIndex: nextIndex
                    });

                    cleanupComposer();
                    await loadBoardState(KanbanState.currentProjectId);
                    if (window.syncSidebar) window.syncSidebar();
                };

                composerDiv.querySelector('.btn-composer-add').addEventListener('click', executeAdd);
                composerDiv.querySelector('.btn-composer-cancel').addEventListener('click', cleanupComposer);
                
                textarea.addEventListener('keydown', (evt) => {
                    if (evt.key === 'Enter' && !evt.shiftKey) {
                        evt.preventDefault();
                        executeAdd();
                    } else if (evt.key === 'Escape') {
                        evt.preventDefault();
                        cleanupComposer();
                    }
                });

                return;
            }

            if (e.target.classList.contains('btn-edit-card') || e.target.classList.contains('btn-color-card') || e.target.closest('.btn-edit-card') || e.target.closest('.btn-color-card')) {
                const btn = e.target.closest('.btn-icon');
                const isColorOnly = btn.classList.contains('btn-color-card');
                
                const cardArticle = btn.closest('.kanban-card');
                const cardId = cardArticle.dataset.cardId;
                const currentTitle = cardArticle.querySelector('.card-title').textContent;
                const currentContent = cardArticle.querySelector('.card-content').textContent;
                
                const colId = cardArticle.closest('.kanban-column').dataset.columnId;
                
                const allCards = await window.api.kanban.getCards(colId);
                const cardsArray = Array.isArray(allCards) ? allCards : (allCards.data || []);
                const cardData = cardsArray.find(c => String(c.card_id || c.cardId || c.id) === String(cardId));
                
                const attachments = await window.api.kanban.getAttachments(cardId) || [];

                const cardColor = cardData ? (cardData.card_color || cardData.cardColor || '#ffffff') : '#ffffff';
                const textColor = cardData ? (cardData.text_color || cardData.textColor || '#172b4d') : '#172b4d';
                const positionIdx = cardData ? (cardData.position_index || cardData.positionIndex || 0) : 0;

                const result = await showKanbanPrompt({
                    title: isColorOnly ? 'Change Card Color' : 'Edit Task',
                    hidePrimary: isColorOnly,
                    label: 'Task Title:',
                    defaultValue: currentTitle,
                    secondaryLabel: isColorOnly ? null : 'Task Details (Optional):',
                    secondaryDefault: currentContent,
                    showAttachments: !isColorOnly,
                    attachments: attachments,
                    isColorPicker: true,
                    allowImage: false,
                    showTextToggle: true, 
                    colorLabel: 'Theme:',
                    colorDefault: cardColor,
                    textColorDefault: textColor
                });

                if (!result) return;

                if (!isColorOnly) {
                    if (result.primary !== null || result.color !== null) {
                        await window.api.kanban.updateCard(cardId, {
                            columnId: colId,
                            cardTitle: result.primary || currentTitle,
                            cardContent: result.secondary !== null ? result.secondary : currentContent,
                            cardColor: result.color || cardColor,
                            textColor: result.textColor || textColor,
                            positionIndex: positionIdx
                        });
                    }

                    if (result.removedAttachments && result.removedAttachments.length > 0) {
                        for (const payload of result.removedAttachments) {
                            await window.api.kanban.removeAttachment(payload);
                        }
                    }
                    
                    if (result.newAttachments && result.newAttachments.length > 0) {
                        for (const att of result.newAttachments) {
                            await window.api.kanban.addAttachment({
                                cardId: cardId,
                                fileName: att.fileName,
                                filePath: att.filePath
                            });
                        }
                    }
                } else {
                    if (result.color !== null) {
                        await window.api.kanban.updateCard(cardId, {
                            columnId: colId,
                            cardTitle: currentTitle,
                            cardContent: currentContent,
                            cardColor: result.color || cardColor,
                            textColor: result.textColor || textColor,
                            positionIndex: positionIdx
                        });
                    }
                }

                await loadBoardState(KanbanState.currentProjectId);
                if (window.syncSidebar) window.syncSidebar();
                return;
            }
        });

        // INLINE EDIT ORCHESTRATION 
        elements.boardCanvas.addEventListener('focusin', handleInlineFocus);
        elements.boardCanvas.addEventListener('keydown', handleInlineKeydown);
        elements.boardCanvas.addEventListener('blur', handleInlineEdits, true);
    }

    function handleInlineFocus(e) {
        if (e.target.classList.contains('column-title') || e.target.classList.contains('card-title')) {
            const range = document.createRange();
            range.selectNodeContents(e.target);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    function handleInlineKeydown(e) {
        if (e.target.classList.contains('column-title') || e.target.classList.contains('card-title')) {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                window.getSelection().removeAllRanges(); 
                e.target.blur(); 
            } else if (e.key === 'Escape') {
                e.preventDefault();
                window.getSelection().removeAllRanges(); 
                e.target.blur();
            }
        }
    }

    async function handleInlineEdits(e) {
        window.getSelection().removeAllRanges(); 
        
        if (e.target.classList.contains('column-title')) {
            const newName = e.target.textContent.trim();
            const colWrapper = e.target.closest('.kanban-column');
            const colId = colWrapper.dataset.columnId;
            
            const parentContainer = e.target.closest('.kanban-board-canvas');
            const columns = Array.from(parentContainer.querySelectorAll('.kanban-column'));
            const positionIndex = columns.indexOf(colWrapper);

            if (newName && positionIndex !== -1) {
                await window.api.kanban.updateColumn(colId, {
                    columnName: newName,
                    positionIndex: positionIndex
                });
                if (window.syncSidebar) window.syncSidebar();
            } else {
                 await loadBoardState(KanbanState.currentProjectId);
            }
        } else if (e.target.classList.contains('card-title')) {
            const newTitle = e.target.textContent.trim();
            const cardArticle = e.target.closest('.kanban-card');
            const cardId = cardArticle.dataset.cardId;
            const colWrapper = e.target.closest('.kanban-column');
            const colId = colWrapper.dataset.columnId;

            const allCards = await window.api.kanban.getCards(colId);
            const cardsArray = Array.isArray(allCards) ? allCards : (allCards.data || []);
            const cardData = cardsArray.find(c => String(c.card_id || c.cardId || c.id) === String(cardId));

            if (cardData && newTitle && newTitle !== (cardData.card_title || cardData.cardTitle)) {
                await window.api.kanban.updateCard(cardId, {
                    columnId: colId,
                    cardTitle: newTitle,
                    cardContent: cardData.card_content || cardData.cardContent || '',
                    cardColor: cardData.card_color || cardData.cardColor || '#ffffff',
                    textColor: cardData.text_color || cardData.textColor || '#172b4d',
                    positionIndex: cardData.position_index || cardData.positionIndex || 0
                });
                if (window.syncSidebar) window.syncSidebar();
            } else if (!newTitle && cardData) {
                e.target.textContent = cardData.card_title || cardData.cardTitle || 'Untitled';
            }
        }
    }

    // ==========================================
    // DRAG & DROP ORCHESTRATION
    // ==========================================

    function orchestrateDragAndDrop() {
        const cards = elements.boardCanvas.querySelectorAll('.kanban-card');
        const columns = elements.boardCanvas.querySelectorAll('.kanban-column');

        // -----------------------
        // CARD DRAG LOGIC
        // -----------------------
        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                if (e.target.classList.contains('card-title') || document.activeElement === e.target) {
                    e.preventDefault();
                    return;
                }
                
                e.stopPropagation(); 
                card.classList.add('dragging');
                KanbanState.draggedCardId = card.dataset.cardId;
                KanbanState.sourceColumnId = card.closest('.kanban-column').dataset.columnId;
            });

            card.addEventListener('dragend', async (e) => {
                e.stopPropagation(); 
                card.classList.remove('dragging');
                
                const targetColumn = card.closest('.kanban-column');
                if (!targetColumn) return;
                
                const targetColumnId = targetColumn.dataset.columnId;
                const container = targetColumn.querySelector('.column-card-container');
                const siblingCards = [...container.querySelectorAll('.kanban-card')];
                
                const positionUpdates = [];
                
                for (let i = 0; i < siblingCards.length; i++) {
                    const cId = siblingCards[i].dataset.cardId;
                    positionUpdates.push({
                        cardId: cId,
                        columnId: targetColumnId,
                        positionIndex: i
                    });
                }

                if (positionUpdates.length > 0) {
                    await window.api.kanban.updateCardPositions(positionUpdates);
                }

                if (KanbanState.draggedCardId) {
                    try {
                        const rawCards = await window.api.kanban.getCards(targetColumnId);
                        const cardsInCol = Array.isArray(rawCards) ? rawCards : (rawCards.data || []);
                        const draggedData = cardsInCol.find(c => String(c.card_id || c.cardId || c.id) === String(KanbanState.draggedCardId));
                        
                        if (draggedData) {
                            const cTitle = draggedData.card_title || draggedData.cardTitle || 'Untitled';
                            const cContent = draggedData.card_content || draggedData.cardContent || '';
                            const cColor = draggedData.card_color || draggedData.cardColor || '#ffffff';
                            const tColor = draggedData.text_color || draggedData.textColor || '#172b4d';
                            const positionIdx = draggedData.position_index || draggedData.positionIndex || 0;

                            await window.api.kanban.updateCard(KanbanState.draggedCardId, {
                                columnId: targetColumnId,
                                cardTitle: cTitle,
                                cardContent: cContent,
                                cardColor: cColor,
                                textColor: tColor,
                                positionIndex: positionIdx
                            });
                        }
                    } catch (err) {
                        console.error('[Kanban] Failed to update card timestamp on move:', err);
                    }
                }

                KanbanState.draggedCardId = null;
                KanbanState.sourceColumnId = null;
                
                await loadBoardState(KanbanState.currentProjectId);
                if (window.syncSidebar) window.syncSidebar();
            });
        });

        // -----------------------
        // COLUMN DRAG LOGIC & CARD DROP ZONES
        // -----------------------
        columns.forEach(col => {
            col.addEventListener('dragover', (e) => {
                const draggableCard = document.querySelector('.kanban-card.dragging');
                if (!draggableCard) return; 

                e.preventDefault(); 
                e.stopPropagation();
                
                const container = col.querySelector('.column-card-container');
                if (!container) return;

                const afterElement = getDragAfterElement(container, e.clientY);
                if (afterElement == null) {
                    container.appendChild(draggableCard);
                } else {
                    container.insertBefore(draggableCard, afterElement);
                }
            });

            col.addEventListener('dragstart', (e) => {
                if (e.target.classList.contains('column-title') || document.activeElement === e.target) {
                    e.preventDefault();
                    return;
                }
                
                col.classList.add('column-dragging');
                KanbanState.draggedColumnId = col.dataset.columnId;
                e.dataTransfer.effectAllowed = 'move';
            });

            col.addEventListener('dragend', async (e) => {
                col.classList.remove('column-dragging');
                
                const currentCols = [...elements.boardCanvas.querySelectorAll('.kanban-column')];
                const positionUpdates = [];
                
                for (let i = 0; i < currentCols.length; i++) {
                    positionUpdates.push({
                        columnId: currentCols[i].dataset.columnId,
                        positionIndex: i
                    });
                }

                if (positionUpdates.length > 0) {
                    await window.api.kanban.updateColumnPositions(positionUpdates);
                }

                KanbanState.draggedColumnId = null;
                
                await loadBoardState(KanbanState.currentProjectId);
                if (window.syncSidebar) window.syncSidebar();
            });
        });

        elements.boardCanvas.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            
            const canvas = elements.boardCanvas;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const threshold = 80; 
            
            if (x > rect.width - threshold) {
                canvas.scrollLeft += 15;
            } else if (x < threshold) {
                canvas.scrollLeft -= 15;
            }

            const draggingColumn = document.querySelector('.kanban-column.column-dragging');
            if (!draggingColumn) return; 

            const afterElement = getDragAfterColumn(elements.boardCanvas, e.clientX);
            const addColWrapper = elements.boardCanvas.querySelector('.kanban-add-column-wrapper');
            
            if (afterElement == null || afterElement === addColWrapper) {
                elements.boardCanvas.insertBefore(draggingColumn, addColWrapper);
            } else {
                elements.boardCanvas.insertBefore(draggingColumn, afterElement);
            }
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function getDragAfterColumn(container, x) {
        const draggableElements = [...container.querySelectorAll('.kanban-column:not(.column-dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

})();