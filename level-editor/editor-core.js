/**
 * BennSauce Level Editor - Core Module
 * Main editor class and state management
 */

class LevelEditor {
    constructor() {
        this.canvas = document.getElementById('editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        
        // Editor state
        this.currentMap = this.createEmptyMap();
        this.selectedTool = 'select';
        this.selectedObject = null;
        this.selectedObjects = [];
        this.clipboard = null;
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;
        
        // View state
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.gridSize = 48;
        this.showGrid = true;
        this.snapToGrid = true;
        
        // Interaction state
        this.isDragging = false;
        this.isPanning = false;
        this.isDrawing = false;
        this.dragStart = { x: 0, y: 0 };
        this.lastMousePos = { x: 0, y: 0 };
        
        // Layer visibility
        this.layerVisibility = {
            background: true,
            platforms: true,
            structures: true,
            terrain: true,
            hills: true,
            slopes: true,
            ladders: true,
            portals: true,
            npcs: true,
            monsters: true,
            collision: false
        };
        
        // Initialize
        this.initCanvas();
        this.initEventListeners();
        this.initUI();
        this.loadExistingMaps();
        
        // Load tileset from game data.js
        EditorData.loadTilesetFromGameData()
            .then(() => {
                console.log('Tileset ready for rendering');
                this.render();
            })
            .catch(err => {
                console.warn('Tileset could not be loaded, using fallback colors:', err);
                this.render();
            });
        
        // Initial render
        this.render();
        
        console.log('BennSauce Level Editor initialized');
    }
    
    createEmptyMap() {
        // Ground Y is calculated as height - 120 (matching game data)
        const height = 720;
        return {
            id: 'untitled',
            name: 'Untitled Map',
            width: 2400,
            height: height,
            groundY: height - 120, // 600 for default 720 height
            backgroundColor: '#87CEEB',
            bgm: 'dewdropIsland',
            groundType: 'grass',
            parallax: [],
            platforms: [],
            structures: [],
            hills: [],
            slopes: [],
            ladders: [],
            portals: [],
            npcs: [],
            monsters: []
        };
    }
    
    initCanvas() {
        // Set canvas size to container
        const container = document.getElementById('canvas-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        // Minimap setup
        this.minimapCanvas.width = 200;
        this.minimapCanvas.height = 120;
        
        // Enable pixel-perfect rendering
        this.ctx.imageSmoothingEnabled = false;
        this.minimapCtx.imageSmoothingEnabled = false;
        
        // Handle resize
        window.addEventListener('resize', () => {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.render();
        });
    }
    
    initEventListeners() {
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
        });
        
        // Tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
        
        // Layer checkboxes
        document.querySelectorAll('.layer-item input').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const layer = e.target.closest('.layer-item').dataset.layer;
                this.layerVisibility[layer] = e.target.checked;
                this.render();
            });
        });
        
        // Object items
        document.querySelectorAll('.object-item').forEach(item => {
            item.addEventListener('click', () => this.selectObjectTemplate(item));
        });
        
        // Toolbar buttons
        document.getElementById('btn-new').addEventListener('click', () => this.showNewMapModal());
        document.getElementById('btn-load').addEventListener('click', () => this.showLoadMapModal());
        document.getElementById('btn-save').addEventListener('click', () => this.saveMap());
        document.getElementById('btn-export').addEventListener('click', () => this.showExportModal());
        
        // Zoom slider
        const zoomSlider = document.getElementById('zoom-slider');
        zoomSlider.addEventListener('input', (e) => {
            this.zoom = e.target.value / 100;
            document.getElementById('zoom-value').textContent = e.target.value + '%';
            this.render();
        });
        
        // Grid controls
        document.getElementById('show-grid').addEventListener('change', (e) => {
            this.showGrid = e.target.checked;
            this.render();
        });
        
        document.getElementById('snap-grid').addEventListener('change', (e) => {
            this.snapToGrid = e.target.checked;
        });
        
        document.getElementById('grid-size').addEventListener('change', (e) => {
            this.gridSize = parseInt(e.target.value);
            this.render();
        });
        
        // Map settings inputs
        document.getElementById('map-id').addEventListener('change', (e) => {
            this.currentMap.id = e.target.value;
            this.updateStatusBar();
        });
        
        document.getElementById('map-width').addEventListener('change', (e) => {
            this.currentMap.width = parseInt(e.target.value);
            this.render();
        });
        
        document.getElementById('map-height').addEventListener('change', (e) => {
            this.currentMap.height = parseInt(e.target.value);
            this.render();
        });
        
        // Ground type selector
        document.getElementById('map-ground-type').addEventListener('change', (e) => {
            this.currentMap.groundType = e.target.value;
            this.render();
        });
        
        // Background color
        document.getElementById('map-bg-color').addEventListener('change', (e) => {
            this.currentMap.backgroundColor = e.target.value;
            this.render();
        });
        
        // BGM selector
        document.getElementById('map-bgm').addEventListener('change', (e) => {
            this.currentMap.bgm = e.target.value;
        });
        
        // Parallax background
        document.getElementById('map-parallax-bg').addEventListener('change', (e) => {
            const bgKey = e.target.value;
            if (bgKey) {
                // Set up parallax with the selected background
                this.currentMap.parallax = [{
                    src: bgKey, // Will be converted to artAssets reference on export
                    speed: 0.01,
                    y: 1400,
                    height: 1600,
                    width: 1000,
                    scale: 3
                }];
            } else {
                this.currentMap.parallax = [];
            }
            this.render();
        });
        
        // Portal add button
        document.getElementById('btn-add-portal').addEventListener('click', () => this.addPortal());
        
        // Modal close buttons
        document.querySelectorAll('.modal .btn-cancel').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });
    }
    
    initUI() {
        // Update UI with default values
        document.getElementById('map-id').value = this.currentMap.id;
        document.getElementById('map-width').value = this.currentMap.width;
        document.getElementById('map-height').value = this.currentMap.height;
        document.getElementById('map-ground-y').value = this.currentMap.groundY;
        document.getElementById('map-ground-type').value = this.currentMap.groundType || 'grass';
        document.getElementById('map-bg-color').value = this.currentMap.backgroundColor || '#87CEEB';
        document.getElementById('map-bgm').value = this.currentMap.bgm || 'dewdropIsland';
        
        // Set parallax background if exists
        if (this.currentMap.parallax && this.currentMap.parallax.length > 0) {
            const parallaxSrc = this.currentMap.parallax[0].src;
            if (typeof parallaxSrc === 'string' && parallaxSrc.startsWith('background')) {
                document.getElementById('map-parallax-bg').value = parallaxSrc;
            }
        }
        
        this.updateStatusBar();
    }
    
    // Mouse event handlers
    onMouseDown(e) {
        const pos = this.screenToWorld(e.offsetX, e.offsetY);
        this.dragStart = { x: e.offsetX, y: e.offsetY };
        this.lastMousePos = pos;
        
        // Middle mouse button for panning
        if (e.button === 1) {
            this.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        
        // Space + left click for panning
        if (this.spaceHeld && e.button === 0) {
            this.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        
        // Left click
        if (e.button === 0) {
            // Check for resize handle first (only in select mode with selected object)
            if (this.selectedTool === 'select' && this.selectedObject) {
                const handle = this.getResizeHandle(pos);
                if (handle) {
                    this.isResizing = true;
                    this.resizeHandle = handle;
                    this.resizeStartPos = { ...pos };
                    this.resizeOriginalBounds = this.getObjectBounds(this.selectedObject);
                    // Store original object position for smooth dragging
                    this.dragOriginalPos = {
                        x: this.selectedObject.x,
                        y: this.selectedObject.y,
                        y1: this.selectedObject.y1,
                        y2: this.selectedObject.y2
                    };
                    this.canvas.style.cursor = this.getCursorForHandle(handle);
                    return;
                }
            }
            
            switch (this.selectedTool) {
                case 'select':
                    this.handleSelectClick(pos);
                    break;
                case 'move':
                    this.handleMoveStart(pos);
                    break;
                case 'draw':
                    this.handleDrawStart(pos);
                    break;
                case 'erase':
                    this.handleEraseStart(pos);
                    break;
                case 'fill':
                    this.handleFill(pos);
                    break;
            }
        }
    }
    
    onMouseMove(e) {
        const pos = this.screenToWorld(e.offsetX, e.offsetY);
        
        // Update status bar
        document.getElementById('status-coords').textContent = 
            `X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}`;
        
        // Handle panning
        if (this.isPanning) {
            const dx = e.offsetX - this.dragStart.x;
            const dy = e.offsetY - this.dragStart.y;
            this.offsetX += dx;
            this.offsetY += dy;
            this.dragStart = { x: e.offsetX, y: e.offsetY };
            this.render();
            return;
        }
        
        // Handle resizing
        if (this.isResizing && this.selectedObject && this.resizeHandle) {
            this.handleResize(pos);
            this.render();
            return;
        }
        
        // Handle dragging selected objects - improved smooth dragging
        if (this.isDragging && this.selectedObject && this.dragOriginalPos) {
            const obj = this.selectedObject;
            const type = obj._type;
            
            // Calculate total delta from drag start
            const totalDx = pos.x - this.dragStartWorldPos.x;
            const totalDy = pos.y - this.dragStartWorldPos.y;
            
            // Calculate new position based on original position + delta
            let newX = this.dragOriginalPos.x + totalDx;
            let newY = this.dragOriginalPos.y !== undefined ? this.dragOriginalPos.y + totalDy : undefined;
            
            // Apply snapping to final position (not to delta)
            if (this.snapToGrid) {
                newX = this.snapValue(newX);
                if (newY !== undefined) {
                    newY = this.snapValue(newY);
                }
            }
            
            // Apply new position
            obj.x = newX;
            if (newY !== undefined) {
                obj.y = newY;
            }
            
            // For ladders, move y1 and y2 together
            if (type === 'ladder' && this.dragOriginalPos.y1 !== undefined) {
                const newY1 = this.dragOriginalPos.y1 + totalDy;
                const newY2 = this.dragOriginalPos.y2 + totalDy;
                if (this.snapToGrid) {
                    obj.y1 = this.snapValue(newY1);
                    obj.y2 = this.snapValue(newY2);
                } else {
                    obj.y1 = newY1;
                    obj.y2 = newY2;
                }
            }
            
            this.canvas.style.cursor = 'move';
            this.render();
            this.updatePropertiesPanel();
            return;
        }
        
        // Update cursor for resize handles when hovering
        if (this.selectedTool === 'select' && this.selectedObject && !this.isDragging) {
            const handle = this.getResizeHandle(pos);
            if (handle) {
                this.canvas.style.cursor = this.getCursorForHandle(handle);
            } else if (this.getObjectAtPoint(pos)) {
                this.canvas.style.cursor = 'move';
            } else {
                this.canvas.style.cursor = this.getCursorForTool();
            }
        }
        
        // Handle drawing
        if (this.isDrawing) {
            this.handleDrawMove(pos);
        }
        
        this.lastMousePos = pos;
    }
    
    onMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = this.getCursorForTool();
        }
        
        if (this.isResizing) {
            this.isResizing = false;
            this.resizeHandle = null;
            this.resizeOriginalBounds = null;
            this.dragOriginalPos = null;
            this.canvas.style.cursor = this.getCursorForTool();
            this.pushUndoState();
            this.updatePropertiesPanel();
        }
        
        if (this.isDragging) {
            this.isDragging = false;
            this.dragOriginalPos = null;
            this.dragStartWorldPos = null;
            this.dragClickOffset = null;
            this.canvas.style.cursor = this.getCursorForTool();
            this.pushUndoState();
            this.updatePropertiesPanel();
        }
        
        if (this.isDrawing) {
            this.isDrawing = false;
            this.handleDrawEnd();
        }
    }
    
    // Resize handle detection
    getResizeHandle(pos) {
        if (!this.selectedObject) return null;
        
        const bounds = this.getObjectBounds(this.selectedObject);
        if (!bounds) return null;
        
        const handleSize = 12 / this.zoom;
        const { x, y, width, height } = bounds;
        
        // Check corners first (they take priority)
        // Southeast (bottom-right)
        if (pos.x >= x + width - handleSize && pos.x <= x + width + handleSize &&
            pos.y >= y + height - handleSize && pos.y <= y + height + handleSize) {
            return 'se';
        }
        // Southwest (bottom-left)
        if (pos.x >= x - handleSize && pos.x <= x + handleSize &&
            pos.y >= y + height - handleSize && pos.y <= y + height + handleSize) {
            return 'sw';
        }
        // Northeast (top-right)
        if (pos.x >= x + width - handleSize && pos.x <= x + width + handleSize &&
            pos.y >= y - handleSize && pos.y <= y + handleSize) {
            return 'ne';
        }
        // Northwest (top-left)
        if (pos.x >= x - handleSize && pos.x <= x + handleSize &&
            pos.y >= y - handleSize && pos.y <= y + handleSize) {
            return 'nw';
        }
        
        // Check edges for resizable objects
        const type = this.selectedObject._type;
        if (type === 'platform' || type === 'structure' || type === 'hill' || type === 'slope') {
            // East (right)
            if (pos.x >= x + width - handleSize && pos.x <= x + width + handleSize &&
                pos.y >= y && pos.y <= y + height) {
                return 'e';
            }
            // West (left)
            if (pos.x >= x - handleSize && pos.x <= x + handleSize &&
                pos.y >= y && pos.y <= y + height) {
                return 'w';
            }
        }
        
        // For hills/slopes, also allow vertical resize
        if (type === 'hill' || type === 'slope') {
            // South (bottom)
            if (pos.y >= y + height - handleSize && pos.y <= y + height + handleSize &&
                pos.x >= x && pos.x <= x + width) {
                return 's';
            }
            // North (top)
            if (pos.y >= y - handleSize && pos.y <= y + handleSize &&
                pos.x >= x && pos.x <= x + width) {
                return 'n';
            }
        }
        
        return null;
    }
    
    getObjectBounds(obj) {
        if (!obj) return null;
        
        const type = obj._type;
        const offset = EditorData.GROUND_LEVEL_OFFSET || -100;
        const scaledTileSize = 48;
        const mapHeight = this.currentMap.height || 720;
        const groundY = mapHeight - 120;
        
        switch (type) {
            case 'platform':
                return {
                    x: obj.x,
                    y: obj.y + offset,
                    width: obj.width,
                    height: scaledTileSize
                };
            case 'structure':
                return {
                    x: obj.x,
                    y: obj.y + offset,
                    width: obj.width,
                    height: scaledTileSize
                };
            case 'hill':
                // Hills are expanded into up-slope + down-slope in game
                const hillTiles = obj.tiles || 2;
                const hillCapWidth = obj.width || 0; // Flat top width
                const hillHeight = hillTiles * scaledTileSize;
                const hillTotalWidth = (hillTiles * scaledTileSize) + hillCapWidth + (hillTiles * scaledTileSize);
                return {
                    x: obj.x,
                    y: groundY - hillHeight,
                    width: hillTotalWidth,
                    height: hillHeight
                };
            case 'slope':
                // Slopes use tiles count - each tile is 48px (scaledTileSize)
                const slopeTiles = obj.tiles || 2;
                const slopeHeight = slopeTiles * scaledTileSize;
                const slopeCapWidth = obj.width || scaledTileSize;
                return {
                    x: obj.x,
                    y: groundY - slopeHeight,
                    width: slopeCapWidth + slopeHeight, // Cap width + slope tiles width
                    height: slopeHeight
                };
            case 'ladder':
                return {
                    x: obj.x - 16,
                    y: obj.y1,
                    width: 32,
                    height: obj.y2 - obj.y1
                };
            case 'portal':
                const py = obj.y !== undefined ? obj.y : groundY;
                return {
                    x: obj.x - 24,
                    y: py - 64,
                    width: 48,
                    height: 64
                };
            case 'npc':
                const ny = obj.y !== undefined ? obj.y : groundY;
                return {
                    x: obj.x - 24,
                    y: ny - 96,
                    width: 48,
                    height: 96
                };
            default:
                return null;
        }
    }
    
    handleResize(pos) {
        const obj = this.selectedObject;
        const handle = this.resizeHandle;
        const orig = this.resizeOriginalBounds;
        const start = this.resizeStartPos;
        
        if (!obj || !handle || !orig || !start) return;
        
        let dx = pos.x - start.x;
        let dy = pos.y - start.y;
        
        if (this.snapToGrid) {
            dx = this.snapValue(dx);
            dy = this.snapValue(dy);
        }
        
        const type = obj._type;
        const minWidth = 48;
        const minHeight = 24;
        const offset = EditorData.GROUND_LEVEL_OFFSET || -100;
        
        switch (handle) {
            case 'e': // Resize right edge
                obj.width = Math.max(minWidth, orig.width + dx);
                break;
            case 'w': // Resize left edge
                const newWidthW = orig.width - dx;
                if (newWidthW >= minWidth) {
                    obj.x = orig.x + dx;
                    obj.width = newWidthW;
                    // Adjust stored Y if it uses offset
                    if (type === 'platform' || type === 'structure') {
                        obj.x = orig.x + dx;
                    }
                }
                break;
            case 'se': // Resize bottom-right (width for slopes, y2 for ladders)
                obj.width = Math.max(minWidth, orig.width + dx);
                if (type === 'ladder') {
                    obj.y2 = Math.max(obj.y1 + minWidth, orig.y + orig.height + dy);
                }
                break;
            case 'sw': // Resize bottom-left
                const newWidthSW = orig.width - dx;
                if (newWidthSW >= minWidth) {
                    obj.x = orig.x + dx;
                    obj.width = newWidthSW;
                }
                break;
            case 'ne': // Resize top-right (adjust tiles for slopes/hills)
                obj.width = Math.max(minWidth, orig.width + dx);
                if (type === 'hill' || type === 'slope') {
                    const scaledTileSizeNE = 48;
                    const origTilesNE = obj.tiles || 2;
                    const tileDeltaNE = Math.round(-dy / scaledTileSizeNE);
                    const newTilesNE = Math.max(1, Math.min(10, origTilesNE + tileDeltaNE));
                    obj.tiles = newTilesNE;
                } else if (type === 'ladder') {
                    obj.y1 = Math.min(obj.y2 - minWidth, orig.y + dy);
                }
                break;
            case 'nw': // Resize top-left (adjust tiles for slopes/hills)
                const newWidthNW = orig.width - dx;
                if (newWidthNW >= minWidth) {
                    obj.x = orig.x + dx;
                    obj.width = newWidthNW;
                }
                if (type === 'hill' || type === 'slope') {
                    const scaledTileSizeNW = 48;
                    const origTilesNW = obj.tiles || 2;
                    const tileDeltaNW = Math.round(-dy / scaledTileSizeNW);
                    const newTilesNW = Math.max(1, Math.min(10, origTilesNW + tileDeltaNW));
                    obj.tiles = newTilesNW;
                }
                break;
            case 'n': // Resize top edge (hills/slopes - adjusts tiles)
                if (type === 'hill' || type === 'slope') {
                    // Calculate new tiles based on vertical drag
                    const scaledTileSizeN = 48;
                    const origTilesN = obj.tiles || 2;
                    const tileDeltaN = Math.round(-dy / scaledTileSizeN);
                    const newTilesN = Math.max(1, Math.min(10, origTilesN + tileDeltaN));
                    obj.tiles = newTilesN;
                } else if (type === 'ladder') {
                    obj.y1 = Math.min(obj.y2 - minWidth, orig.y + dy);
                }
                break;
            case 's': // Resize bottom edge - not used for slopes (they grow from ground)
                if (type === 'ladder') {
                    obj.y2 = Math.max(obj.y1 + minWidth, orig.y + orig.height + dy);
                }
                break;
        }
    }
    
    getCursorForHandle(handle) {
        const cursors = {
            'n': 'ns-resize',
            's': 'ns-resize',
            'e': 'ew-resize',
            'w': 'ew-resize',
            'nw': 'nwse-resize',
            'se': 'nwse-resize',
            'ne': 'nesw-resize',
            'sw': 'nesw-resize'
        };
        return cursors[handle] || 'default';
    }
    
    onWheel(e) {
        e.preventDefault();
        
        const pos = this.screenToWorld(e.offsetX, e.offsetY);
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.25, Math.min(2, this.zoom * zoomFactor));
        
        // Zoom toward mouse position
        this.offsetX = e.offsetX - (pos.x * newZoom);
        this.offsetY = e.offsetY - (pos.y * newZoom);
        this.zoom = newZoom;
        
        // Update zoom slider
        document.getElementById('zoom-slider').value = this.zoom * 100;
        document.getElementById('zoom-value').textContent = Math.round(this.zoom * 100) + '%';
        
        this.render();
    }
    
    onContextMenu(e) {
        e.preventDefault();
        const pos = this.screenToWorld(e.offsetX, e.offsetY);
        const obj = this.getObjectAtPoint(pos);
        
        if (obj) {
            this.selectedObject = obj;
            this.showContextMenu(e.clientX, e.clientY);
        }
    }
    
    onKeyDown(e) {
        // Track space key for panning
        if (e.code === 'Space') {
            this.spaceHeld = true;
            if (!this.isPanning) {
                this.canvas.style.cursor = 'grab';
            }
        }
        
        // Tool shortcuts
        if (e.code === 'KeyV') this.setTool('select');
        if (e.code === 'KeyM') this.setTool('move');
        if (e.code === 'KeyB') this.setTool('draw');
        if (e.code === 'KeyE') this.setTool('erase');
        if (e.code === 'KeyG') this.setTool('fill');
        
        // Delete selected
        if (e.code === 'Delete' && this.selectedObject) {
            this.deleteSelectedObject();
        }
        
        // Undo/Redo
        if (e.ctrlKey && e.code === 'KeyZ') {
            e.preventDefault();
            if (e.shiftKey) {
                this.redo();
            } else {
                this.undo();
            }
        }
        
        // Copy/Paste
        if (e.ctrlKey && e.code === 'KeyC') {
            this.copySelectedObject();
        }
        if (e.ctrlKey && e.code === 'KeyV') {
            this.pasteObject();
        }
        
        // Save
        if (e.ctrlKey && e.code === 'KeyS') {
            e.preventDefault();
            this.saveMap();
        }
        
        // New
        if (e.ctrlKey && e.code === 'KeyN') {
            e.preventDefault();
            this.showNewMapModal();
        }
        
        // Open
        if (e.ctrlKey && e.code === 'KeyO') {
            e.preventDefault();
            this.showLoadMapModal();
        }
    }
    
    onKeyUp(e) {
        if (e.code === 'Space') {
            this.spaceHeld = false;
            this.canvas.style.cursor = this.getCursorForTool();
        }
    }
    
    // Tool management
    setTool(tool) {
        this.selectedTool = tool;
        
        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        
        document.getElementById('status-tool').textContent = `Tool: ${this.capitalizeFirst(tool)}`;
        this.canvas.style.cursor = this.getCursorForTool();
    }
    
    getCursorForTool() {
        switch (this.selectedTool) {
            case 'select': return 'default';
            case 'move': return 'move';
            case 'draw': return 'crosshair';
            case 'erase': return 'crosshair';
            case 'fill': return 'crosshair';
            default: return 'default';
        }
    }
    
    // Coordinate conversion
    screenToWorld(sx, sy) {
        return {
            x: (sx - this.offsetX) / this.zoom,
            y: (sy - this.offsetY) / this.zoom
        };
    }
    
    worldToScreen(wx, wy) {
        return {
            x: wx * this.zoom + this.offsetX,
            y: wy * this.zoom + this.offsetY
        };
    }
    
    snapValue(value) {
        return Math.round(value / this.gridSize) * this.gridSize;
    }
    
    // Tab switching
    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });
    }
    
    // Selection handling
    handleSelectClick(pos) {
        const obj = this.getObjectAtPoint(pos);
        
        if (obj) {
            this.selectedObject = obj;
            this.isDragging = true;
            
            // Store original position and click offset for smooth dragging
            this.dragStartWorldPos = { ...pos };
            this.dragOriginalPos = {
                x: obj.x,
                y: obj.y,
                y1: obj.y1,
                y2: obj.y2
            };
            
            // Calculate click offset from object origin (for more intuitive dragging)
            const bounds = this.getObjectBounds(obj);
            if (bounds) {
                this.dragClickOffset = {
                    x: pos.x - bounds.x,
                    y: pos.y - bounds.y
                };
            } else {
                this.dragClickOffset = { x: 0, y: 0 };
            }
            
            this.canvas.style.cursor = 'move';
            this.updatePropertiesPanel();
            this.updateSelectionInfo();
        } else {
            this.selectedObject = null;
            this.isDragging = false;
            this.dragOriginalPos = null;
            this.dragStartWorldPos = null;
            this.clearPropertiesPanel();
            this.updateSelectionInfo();
        }
        
        this.render();
    }
    
    getObjectAtPoint(pos) {
        // Check all object types - assign _type directly to actual objects (references, not copies)
        // This ensures we can drag and modify the actual map objects
        
        const groundY = this.currentMap.height - 120;
        
        // Check monsters (top layer)
        const monsters = this.currentMap.monsters || [];
        for (let i = monsters.length - 1; i >= 0; i--) {
            const m = monsters[i];
            m._type = 'monster';
            if (this.isPointInObject(pos, m, groundY)) {
                return m;
            }
        }
        
        // Check NPCs
        const npcs = this.currentMap.npcs || [];
        for (let i = npcs.length - 1; i >= 0; i--) {
            const n = npcs[i];
            n._type = 'npc';
            if (this.isPointInObject(pos, n, groundY)) {
                return n;
            }
        }
        
        // Check portals
        const portals = this.currentMap.portals || [];
        for (let i = portals.length - 1; i >= 0; i--) {
            const p = portals[i];
            p._type = 'portal';
            if (this.isPointInObject(pos, p, groundY)) {
                return p;
            }
        }
        
        // Check ladders
        const ladders = this.currentMap.ladders || [];
        for (let i = ladders.length - 1; i >= 0; i--) {
            const l = ladders[i];
            l._type = 'ladder';
            if (this.isPointInObject(pos, l, groundY)) {
                return l;
            }
        }
        
        // Check structures
        const structures = this.currentMap.structures || [];
        for (let i = structures.length - 1; i >= 0; i--) {
            const s = structures[i];
            s._type = 'structure';
            if (this.isPointInObject(pos, s, groundY)) {
                return s;
            }
        }
        
        // Check hills
        const hills = this.currentMap.hills || [];
        for (let i = hills.length - 1; i >= 0; i--) {
            const h = hills[i];
            h._type = 'hill';
            if (this.isPointInObject(pos, h, groundY)) {
                return h;
            }
        }
        
        // Check slopes
        const slopes = this.currentMap.slopes || [];
        for (let i = slopes.length - 1; i >= 0; i--) {
            const sl = slopes[i];
            sl._type = 'slope';
            if (this.isPointInObject(pos, sl, groundY)) {
                return sl;
            }
        }
        
        // Check platforms (bottom layer)
        const platforms = this.currentMap.platforms || [];
        for (let i = platforms.length - 1; i >= 0; i--) {
            const p = platforms[i];
            p._type = 'platform';
            if (this.isPointInObject(pos, p, groundY)) {
                return p;
            }
        }
        
        return null;
    }
    
    isPointInObject(pos, obj, groundY) {
        const type = obj._type;
        // Use scaled tile size (16 * 3 = 48) for platforms and structures
        const scaledTileSize = 48; // EditorData.SPRITE_DATA.ground.tileSize * EditorData.PIXEL_ART_SCALE
        // GROUND_LEVEL_OFFSET is applied when rendering, so we need to apply it to hit testing too
        const offset = EditorData.GROUND_LEVEL_OFFSET || -100;
        
        switch (type) {
            case 'platform':
                // Platform rendered at (y + offset) position with scaledTileSize height
                const platY = obj.y + offset;
                return pos.x >= obj.x && pos.x <= obj.x + obj.width &&
                       pos.y >= platY && pos.y <= platY + scaledTileSize;
            case 'structure':
                // Structure rendered at (y + offset) position
                const structY = obj.y + offset;
                return pos.x >= obj.x && pos.x <= obj.x + obj.width &&
                       pos.y >= structY && pos.y <= structY + scaledTileSize;
            case 'portal':
                // Portal: 24x32 sprite * PIXEL_ART_SCALE = 72x96
                const portalWidth = 24 * EditorData.PIXEL_ART_SCALE;
                const portalHeight = 32 * EditorData.PIXEL_ART_SCALE;
                const portalY = obj.y !== undefined ? obj.y : groundY - portalHeight;
                return pos.x >= obj.x && pos.x <= obj.x + portalWidth &&
                       pos.y >= portalY && pos.y <= portalY + portalHeight;
            case 'npc':
                const nw = 48, nh = 96;
                const npcY = obj.y !== undefined ? obj.y : groundY;
                return pos.x >= obj.x - nw/2 && pos.x <= obj.x + nw/2 &&
                       pos.y >= npcY - nh && pos.y <= npcY;
            case 'monster':
                // Get monster dimensions from MONSTER_TYPES or use defaults
                const monsterInfo = EditorData.MONSTER_TYPES[obj.type] || { width: 48, height: 48 };
                const mw = monsterInfo.width, mh = monsterInfo.height;
                const monsterY = obj.y !== undefined ? obj.y : groundY;
                return pos.x >= obj.x - mw/2 && pos.x <= obj.x + mw/2 &&
                       pos.y >= monsterY - mh && pos.y <= monsterY;
            case 'ladder':
                // Ladder: 16px wide * PIXEL_ART_SCALE = 48px, with vertical overlap adjustment
                const ladderWidth = EditorData.LADDER_TILE_SIZE * EditorData.PIXEL_ART_SCALE;
                const verticalOverlap = 24;
                const ladderY1 = obj.y1 + offset - verticalOverlap;
                const ladderY2 = obj.y2 + offset;
                return pos.x >= obj.x && pos.x <= obj.x + ladderWidth &&
                       pos.y >= ladderY1 && pos.y <= ladderY2;
            case 'hill':
                // Hills expand into up-slope + down-slope
                const hillTiles3 = obj.tiles || 2;
                const scaledTileSize3 = 48;
                const hillCapWidth3 = obj.width || 0;
                const hillHeight3 = hillTiles3 * scaledTileSize3;
                const hillTotalWidth3 = (hillTiles3 * scaledTileSize3) + hillCapWidth3 + (hillTiles3 * scaledTileSize3);
                const hillY = groundY - hillHeight3;
                return pos.x >= obj.x && pos.x <= obj.x + hillTotalWidth3 &&
                       pos.y >= hillY && pos.y <= groundY;
            case 'slope':
                // Slopes use tiles count - calculate visual bounds
                const slopeTiles2 = obj.tiles || 2;
                const scaledTileSize2 = 48;
                const slopeHeight2 = slopeTiles2 * scaledTileSize2;
                const slopeCapWidth2 = obj.width || scaledTileSize2;
                const slopeY = groundY - slopeHeight2;
                return pos.x >= obj.x && pos.x <= obj.x + slopeCapWidth2 + slopeHeight2 &&
                       pos.y >= slopeY && pos.y <= groundY;
            default:
                return false;
        }
    }
    
    // Properties panel
    updatePropertiesPanel() {
        const panel = document.getElementById('properties-panel');
        if (!this.selectedObject) {
            panel.innerHTML = '<p class="hint">Select an object to edit properties</p>';
            return;
        }
        
        const obj = this.selectedObject;
        let html = '';
        
        switch (obj._type) {
            case 'platform':
                html = `
                    <div class="property-row">
                        <label>X:</label>
                        <input type="number" id="prop-x" value="${obj.x}">
                    </div>
                    <div class="property-row">
                        <label>Y:</label>
                        <input type="number" id="prop-y" value="${obj.y}">
                    </div>
                    <div class="property-row">
                        <label>Width:</label>
                        <input type="number" id="prop-width" value="${obj.width}">
                    </div>
                    <div class="property-row">
                        <label>No Spawn:</label>
                        <input type="checkbox" id="prop-nospawn" ${obj.noSpawn ? 'checked' : ''}>
                    </div>
                `;
                break;
            case 'portal':
                html = `
                    <div class="property-row">
                        <label>X:</label>
                        <input type="number" id="prop-x" value="${obj.x}">
                    </div>
                    <div class="property-row">
                        <label>Y:</label>
                        <input type="number" id="prop-y" value="${obj.y || ''}">
                    </div>
                    <div class="property-row">
                        <label>Target Map:</label>
                        <input type="text" id="prop-target-map" value="${obj.targetMap || ''}">
                    </div>
                    <div class="property-row">
                        <label>Target X:</label>
                        <input type="number" id="prop-target-x" value="${obj.targetX || ''}">
                    </div>
                    <div class="property-row">
                        <label>Target Y:</label>
                        <input type="number" id="prop-target-y" value="${obj.targetY || ''}">
                    </div>
                `;
                break;
            case 'npc':
                html = `
                    <div class="property-row">
                        <label>Type:</label>
                        <input type="text" id="prop-type" value="${obj.type}" readonly>
                    </div>
                    <div class="property-row">
                        <label>X:</label>
                        <input type="number" id="prop-x" value="${obj.x}">
                    </div>
                    <div class="property-row">
                        <label>Y:</label>
                        <input type="number" id="prop-y" value="${obj.y || ''}">
                    </div>
                `;
                break;
            case 'structure':
                html = `
                    <div class="property-row">
                        <label>X:</label>
                        <input type="number" id="prop-x" value="${obj.x}">
                    </div>
                    <div class="property-row">
                        <label>Y:</label>
                        <input type="number" id="prop-y" value="${obj.y}">
                    </div>
                    <div class="property-row">
                        <label>Width:</label>
                        <input type="number" id="prop-width" value="${obj.width}">
                    </div>
                    <div class="property-row">
                        <label>Z-Layer:</label>
                        <input type="number" id="prop-z" value="${obj.z || 0}">
                    </div>
                `;
                break;
            case 'monster':
                const monsterInfo2 = EditorData.MONSTER_TYPES[obj.type] || { name: obj.type, level: 1 };
                html = `
                    <div class="property-row">
                        <label>Type:</label>
                        <input type="text" id="prop-type" value="${obj.type}" readonly>
                    </div>
                    <div class="property-row">
                        <label>Name:</label>
                        <span class="prop-value">${monsterInfo2.name}</span>
                    </div>
                    <div class="property-row">
                        <label>Count:</label>
                        <input type="number" id="prop-count" value="${obj.count || 1}" min="1">
                    </div>
                    <div class="property-row">
                        <label>Fixed Position:</label>
                        <input type="checkbox" id="prop-fixedPosition" ${obj.fixedPosition ? 'checked' : ''}>
                    </div>
                    <div class="property-row">
                        <label>X:</label>
                        <input type="number" id="prop-x" value="${obj.x || ''}">
                    </div>
                    <div class="property-row">
                        <label>Y:</label>
                        <input type="number" id="prop-y" value="${obj.y || ''}">
                    </div>
                `;
                break;
            case 'ladder':
                html = `
                    <div class="property-row">
                        <label>Type:</label>
                        <select id="prop-type">
                            <option value="tiles" ${obj.type === 'tiles' || !obj.type ? 'selected' : ''}>Wood Ladder</option>
                            <option value="pipe" ${obj.type === 'pipe' ? 'selected' : ''}>Pipe</option>
                            <option value="yellow" ${obj.type === 'yellow' ? 'selected' : ''}>Yellow Ladder</option>
                            <option value="purple" ${obj.type === 'purple' ? 'selected' : ''}>Purple Ladder</option>
                        </select>
                    </div>
                    <div class="property-row">
                        <label>X:</label>
                        <input type="number" id="prop-x" value="${obj.x}">
                    </div>
                    <div class="property-row">
                        <label>Y1 (Top):</label>
                        <input type="number" id="prop-y1" value="${obj.y1}">
                    </div>
                    <div class="property-row">
                        <label>Y2 (Bottom):</label>
                        <input type="number" id="prop-y2" value="${obj.y2}">
                    </div>
                `;
                break;
            case 'hill':
                html = `
                    <div class="property-row">
                        <label>X:</label>
                        <input type="number" id="prop-x" value="${obj.x}">
                    </div>
                    <div class="property-row">
                        <label>Tiles:</label>
                        <input type="number" id="prop-tiles" value="${obj.tiles || 2}" min="1" max="10">
                    </div>
                    <div class="property-row">
                        <label>Peak Width:</label>
                        <input type="number" id="prop-width" value="${obj.width || 0}">
                    </div>
                `;
                break;
            case 'slope':
                html = `
                    <div class="property-row">
                        <label>X:</label>
                        <input type="number" id="prop-x" value="${obj.x}">
                    </div>
                    <div class="property-row">
                        <label>Tiles:</label>
                        <input type="number" id="prop-tiles" value="${obj.tiles || 2}" min="1" max="10">
                    </div>
                    <div class="property-row">
                        <label>Cap Width:</label>
                        <input type="number" id="prop-width" value="${obj.width || 48}">
                    </div>
                    <div class="property-row">
                        <label>Direction:</label>
                        <select id="prop-direction">
                            <option value="right" ${obj.direction === 'right' ? 'selected' : ''}>Right (↗)</option>
                            <option value="left" ${obj.direction === 'left' ? 'selected' : ''}>Left (↖)</option>
                        </select>
                    </div>
                `;
                break;
        }
        
        panel.innerHTML = html;
        
        // Add change listeners for inputs
        panel.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => this.applyPropertyChange(input));
        });
        
        // Add change listeners for selects
        panel.querySelectorAll('select').forEach(select => {
            select.addEventListener('change', () => this.applyPropertyChange(select));
        });
    }
    
    applyPropertyChange(input) {
        if (!this.selectedObject) return;
        
        const id = input.id.replace('prop-', '');
        let value;
        
        if (input.type === 'checkbox') {
            value = input.checked;
        } else if (input.type === 'number') {
            value = parseFloat(input.value);
        } else if (input.tagName === 'SELECT') {
            value = input.value;
        } else {
            value = input.value;
        }
        
        // Special handling for specific properties
        switch (id) {
            case 'nospawn':
                this.selectedObject.noSpawn = value;
                break;
            case 'fixedPosition':
                this.selectedObject.fixedPosition = value;
                break;
            case 'target-map':
                this.selectedObject.targetMap = value;
                break;
            case 'target-x':
                this.selectedObject.targetX = value;
                break;
            case 'target-y':
                this.selectedObject.targetY = value;
                break;
            default:
                this.selectedObject[id] = value;
        }
        
        this.pushUndoState();
        this.render();
    }
    
    clearPropertiesPanel() {
        document.getElementById('properties-panel').innerHTML = 
            '<p class="hint">Select an object to edit properties</p>';
    }
    
    updateSelectionInfo() {
        const info = this.selectedObject ? 
            `Selected: ${this.selectedObject._type}` : 
            'No selection';
        document.getElementById('status-selection').textContent = info;
    }
    
    updateStatusBar() {
        document.getElementById('status-layer').textContent = `Map: ${this.currentMap.id}`;
    }
    
    // Undo/Redo system
    pushUndoState() {
        // Clone current state
        const state = JSON.parse(JSON.stringify(this.currentMap));
        this.undoStack.push(state);
        
        // Limit stack size
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        
        // Clear redo stack
        this.redoStack = [];
    }
    
    undo() {
        if (this.undoStack.length === 0) return;
        
        // Save current state to redo
        this.redoStack.push(JSON.parse(JSON.stringify(this.currentMap)));
        
        // Restore previous state
        this.currentMap = this.undoStack.pop();
        this.selectedObject = null;
        this.clearPropertiesPanel();
        this.render();
        
        this.showStatusMessage('Undo');
    }
    
    redo() {
        if (this.redoStack.length === 0) return;
        
        // Save current state to undo
        this.undoStack.push(JSON.parse(JSON.stringify(this.currentMap)));
        
        // Restore redo state
        this.currentMap = this.redoStack.pop();
        this.selectedObject = null;
        this.clearPropertiesPanel();
        this.render();
        
        this.showStatusMessage('Redo');
    }
    
    // Copy/Paste
    copySelectedObject() {
        if (!this.selectedObject) return;
        this.clipboard = JSON.parse(JSON.stringify(this.selectedObject));
        this.showStatusMessage('Copied');
    }
    
    pasteObject() {
        if (!this.clipboard) return;
        
        const obj = JSON.parse(JSON.stringify(this.clipboard));
        obj.x += 50; // Offset paste
        obj.y += 50;
        
        // Add to appropriate array
        this.addObjectToMap(obj);
        this.selectedObject = obj;
        
        this.pushUndoState();
        this.render();
        this.showStatusMessage('Pasted');
    }
    
    deleteSelectedObject() {
        if (!this.selectedObject) return;
        
        this.removeObjectFromMap(this.selectedObject);
        this.selectedObject = null;
        this.clearPropertiesPanel();
        
        this.pushUndoState();
        this.render();
        this.showStatusMessage('Deleted');
    }
    
    addObjectToMap(obj) {
        const type = obj._type;
        delete obj._type;
        
        switch (type) {
            case 'platform':
                this.currentMap.platforms.push(obj);
                break;
            case 'structure':
                this.currentMap.structures.push(obj);
                break;
            case 'portal':
                this.currentMap.portals.push(obj);
                break;
            case 'npc':
                this.currentMap.npcs.push(obj);
                break;
            case 'monster':
                if (!this.currentMap.monsters) this.currentMap.monsters = [];
                this.currentMap.monsters.push(obj);
                break;
            case 'ladder':
                if (!this.currentMap.ladders) this.currentMap.ladders = [];
                this.currentMap.ladders.push(obj);
                break;
        }
        
        obj._type = type;
    }
    
    removeObjectFromMap(obj) {
        const type = obj._type;
        const arrays = {
            platform: this.currentMap.platforms,
            structure: this.currentMap.structures,
            hill: this.currentMap.hills,
            slope: this.currentMap.slopes,
            portal: this.currentMap.portals,
            npc: this.currentMap.npcs,
            monster: this.currentMap.monsters || [],
            ladder: this.currentMap.ladders || []
        };
        
        const arr = arrays[type];
        if (!arr) return;
        
        const index = arr.indexOf(obj);
        if (index > -1) {
            arr.splice(index, 1);
        }
    }
    
    // Status messages
    showStatusMessage(msg) {
        const el = document.getElementById('status-message');
        el.textContent = msg;
        setTimeout(() => {
            if (el.textContent === msg) {
                el.textContent = '';
            }
        }, 2000);
    }
    
    // Modal management
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }
    
    showContextMenu(x, y) {
        const menu = document.getElementById('context-menu');
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.remove('hidden');
        
        // Close on click outside
        const closeHandler = (e) => {
            if (!menu.contains(e.target)) {
                menu.classList.add('hidden');
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
        
        // Handle actions
        menu.querySelectorAll('.context-item').forEach(item => {
            item.onclick = () => {
                this.handleContextAction(item.dataset.action);
                menu.classList.add('hidden');
            };
        });
    }
    
    handleContextAction(action) {
        switch (action) {
            case 'duplicate':
                this.copySelectedObject();
                this.pasteObject();
                break;
            case 'delete':
                this.deleteSelectedObject();
                break;
            case 'properties':
                // Focus properties panel
                break;
        }
    }
    
    // Utility
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    // These methods will be implemented in other modules:
    // - render() in editor-render.js
    // - loadNPCList() in editor-data.js
    // - loadExistingMaps() in editor-io.js
    // - showNewMapModal() in editor-ui.js
    // - showLoadMapModal() in editor-ui.js
    // - showExportModal() in editor-io.js
    // - saveMap() in editor-io.js
    // - addPortal() in editor-tools.js
    // - handleDrawStart/Move/End in editor-tools.js
    // - handleMoveStart in editor-tools.js
    // - handleEraseStart in editor-tools.js
    // - handleFill in editor-tools.js
    // - selectObjectTemplate in editor-tools.js
}
