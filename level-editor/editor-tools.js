/**
 * BennSauce Level Editor - Tools Module
 * Drawing, erasing, and object manipulation tools
 */

// Extend LevelEditor with tool methods
Object.assign(LevelEditor.prototype, {
    selectedObjectTemplate: null,
    drawStartPos: null,
    tempDrawObject: null,
    
    // Ladder two-click mode
    ladderMode: null, // null, 'waitingForY1', 'waitingForY2'
    ladderTempX: null,
    ladderTempY1: null,
    
    // Resize handles
    resizeHandle: null, // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
    isResizing: false,
    resizeStartPos: null,
    resizeOriginalBounds: null,
    
    selectObjectTemplate(item) {
        // Clear previous selection
        document.querySelectorAll('.object-item').forEach(i => i.classList.remove('selected'));
        
        // Select new item
        item.classList.add('selected');
        this.selectedObjectTemplate = {
            type: item.dataset.type,
            subtype: item.dataset.subtype
        };
        
        // Cancel any ladder mode
        this.ladderMode = null;
        
        // Switch to appropriate tool
        if (this.selectedTool === 'select') {
            this.setTool('draw');
        }
    },
    
    handleDrawStart(pos) {
        if (!this.selectedObjectTemplate) {
            this.showStatusMessage('Select an object type first');
            return;
        }
        
        // Special handling for ladders - two-click mode
        if (this.selectedObjectTemplate.type === 'ladder') {
            this.handleLadderClick(pos);
            return;
        }
        
        this.isDrawing = true;
        this.drawStartPos = this.snapToGrid ? 
            { x: this.snapValue(pos.x), y: this.snapValue(pos.y) } : 
            { ...pos };
        
        // Create temporary object for preview
        this.tempDrawObject = this.createObjectFromTemplate(
            this.selectedObjectTemplate,
            this.drawStartPos.x,
            this.drawStartPos.y
        );
    },
    
    handleLadderClick(pos) {
        const snappedPos = this.snapToGrid ? 
            { x: this.snapValue(pos.x), y: this.snapValue(pos.y) } : pos;
        
        if (!this.ladderMode || this.ladderMode === 'waitingForY1') {
            // First click - set X and Y1
            this.ladderTempX = snappedPos.x;
            this.ladderTempY1 = snappedPos.y;
            this.ladderMode = 'waitingForY2';
            this.showStatusMessage('Click again to set ladder bottom (Y2)');
            this.render();
        } else if (this.ladderMode === 'waitingForY2') {
            // Second click - complete the ladder
            const y2 = snappedPos.y;
            const y1 = Math.min(this.ladderTempY1, y2);
            const finalY2 = Math.max(this.ladderTempY1, y2);
            
            if (Math.abs(finalY2 - y1) < 48) {
                this.showStatusMessage('Ladder too short - try again');
                this.ladderMode = null;
                return;
            }
            
            if (!this.currentMap.ladders) {
                this.currentMap.ladders = [];
            }
            
            const ladder = {
                x: this.ladderTempX,
                y1: y1,
                y2: finalY2,
                _type: 'ladder'
            };
            
            this.currentMap.ladders.push(ladder);
            this.selectedObject = ladder;
            
            this.ladderMode = null;
            this.ladderTempX = null;
            this.ladderTempY1 = null;
            
            this.pushUndoState();
            this.updatePropertiesPanel();
            this.render();
            this.showStatusMessage('Ladder created');
        }
    },
    
    handleDrawMove(pos) {
        if (!this.isDrawing || !this.tempDrawObject) return;
        
        const snappedPos = this.snapToGrid ? 
            { x: this.snapValue(pos.x), y: this.snapValue(pos.y) } : 
            pos;
        
        // Update temporary object dimensions based on type
        switch (this.tempDrawObject._type) {
            case 'platform':
                const platWidth = snappedPos.x - this.tempDrawObject.x;
                this.tempDrawObject.width = Math.max(48, Math.abs(platWidth));
                if (platWidth < 0) {
                    this.tempDrawObject.x = snappedPos.x;
                }
                break;
            case 'structure':
                const structWidth = snappedPos.x - this.tempDrawObject.x;
                this.tempDrawObject.width = Math.max(48, Math.abs(structWidth));
                if (structWidth < 0) {
                    this.tempDrawObject.x = snappedPos.x;
                }
                break;
            case 'hill':
                // Hills can be resized in both dimensions
                const hillWidth = snappedPos.x - this.drawStartPos.x;
                const hillHeight = snappedPos.y - this.drawStartPos.y;
                this.tempDrawObject.width = Math.max(48, Math.abs(hillWidth));
                this.tempDrawObject.height = Math.max(24, Math.abs(hillHeight));
                if (hillWidth < 0) {
                    this.tempDrawObject.x = snappedPos.x;
                }
                if (hillHeight < 0) {
                    this.tempDrawObject.y = snappedPos.y;
                }
                break;
            case 'slope':
                // Slopes can be resized in both dimensions
                const slopeWidth = snappedPos.x - this.drawStartPos.x;
                const slopeHeight = snappedPos.y - this.drawStartPos.y;
                this.tempDrawObject.width = Math.max(48, Math.abs(slopeWidth));
                this.tempDrawObject.height = Math.max(24, Math.abs(slopeHeight));
                // Determine direction based on drag direction
                this.tempDrawObject.direction = slopeWidth >= 0 ? 'right' : 'left';
                if (slopeWidth < 0) {
                    this.tempDrawObject.x = snappedPos.x;
                }
                if (slopeHeight < 0) {
                    this.tempDrawObject.y = snappedPos.y;
                }
                break;
            case 'spawner':
                this.tempDrawObject.width = Math.max(48, snappedPos.x - this.tempDrawObject.x);
                this.tempDrawObject.height = Math.max(48, snappedPos.y - this.tempDrawObject.y);
                break;
        }
        
        this.render();
        
        // Draw temp object on top
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.zoom, this.zoom);
        this.drawTempObject();
        this.ctx.restore();
    },
    
    handleDrawEnd() {
        if (!this.tempDrawObject) return;
        
        // Validate minimum dimensions
        const minSize = 48;
        if (this.tempDrawObject.width && this.tempDrawObject.width < minSize) {
            this.tempDrawObject.width = minSize;
        }
        if (this.tempDrawObject.height && this.tempDrawObject.height < 24) {
            this.tempDrawObject.height = 24;
        }
        
        // Add object to map
        this.addObjectToMap(this.tempDrawObject);
        this.selectedObject = this.tempDrawObject;
        this.tempDrawObject = null;
        
        this.pushUndoState();
        this.updatePropertiesPanel();
        this.render();
        
        this.showStatusMessage('Object created');
    },
    
    drawTempObject() {
        if (!this.tempDrawObject) return;
        
        const obj = this.tempDrawObject;
        const offset = EditorData.GROUND_LEVEL_OFFSET || -100;
        
        this.ctx.globalAlpha = 0.6;
        
        switch (obj._type) {
            case 'platform':
                this.ctx.fillStyle = '#7d6a5a';
                this.ctx.fillRect(obj.x, obj.y + offset, obj.width, 48);
                break;
            case 'structure':
                this.ctx.fillStyle = '#8B4513';
                this.ctx.fillRect(obj.x, obj.y + offset, obj.width, 48);
                break;
            case 'hill':
                // Draw hill as curved mound
                this.ctx.fillStyle = '#5a8f5a';
                this.ctx.beginPath();
                this.ctx.moveTo(obj.x, obj.y + obj.height);
                this.ctx.quadraticCurveTo(
                    obj.x + obj.width / 2, obj.y - obj.height * 0.3,
                    obj.x + obj.width, obj.y + obj.height
                );
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.strokeStyle = '#3d6b3d';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                break;
            case 'slope':
                // Draw slope as triangle
                this.ctx.fillStyle = '#7d6a5a';
                this.ctx.beginPath();
                if (obj.direction === 'right' || obj.direction === 'left') {
                    if (obj.direction === 'right') {
                        this.ctx.moveTo(obj.x, obj.y + obj.height);
                        this.ctx.lineTo(obj.x + obj.width, obj.y + obj.height);
                        this.ctx.lineTo(obj.x + obj.width, obj.y);
                    } else {
                        this.ctx.moveTo(obj.x, obj.y);
                        this.ctx.lineTo(obj.x, obj.y + obj.height);
                        this.ctx.lineTo(obj.x + obj.width, obj.y + obj.height);
                    }
                }
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.strokeStyle = '#5a4a3a';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                break;
            case 'spawner':
                this.ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
                this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                this.ctx.strokeStyle = '#ff6b6b';
                this.ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);
                this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
                this.ctx.setLineDash([]);
                break;
        }
        
        this.ctx.globalAlpha = 1;
    },
    
    createObjectFromTemplate(template, x, y) {
        const obj = { x, y, _type: template.type };
        
        switch (template.type) {
            case 'platform':
                obj.width = 96;
                obj.style = template.subtype || 'wood';
                break;
            case 'structure':
                obj.width = 192;
                obj.z = 0; // Default z-layer
                break;
            case 'hill':
                // Hills use 'tiles' count like game.js
                obj.tiles = template.subtype === 'small' ? 2 : 3; // Number of slope tiles
                obj.width = template.subtype === 'small' ? 48 : 96; // Flat top width (0 = pointed peak)
                break;
            case 'slope':
                // Slopes use 'tiles' count like game.js
                obj.tiles = 2; // Number of slope tiles
                obj.width = 48; // Cap width
                obj.direction = template.subtype || 'right';
                break;
            case 'spawner':
                obj.width = 200;
                obj.height = 100;
                obj.monsterType = '';
                obj.count = 5;
                break;
            case 'ladder':
                // Ladders use two-click mode
                obj.y1 = y;
                obj.y2 = y + 200;
                obj.type = 'tiles'; // Default ladder type
                break;
        }
        
        return obj;
    },
    
    addObjectToMap(obj) {
        const type = obj._type;
        delete obj._type; // Remove internal property before adding to map
        
        switch (type) {
            case 'platform':
                if (!this.currentMap.platforms) this.currentMap.platforms = [];
                obj._type = 'platform'; // Re-add for selection tracking
                this.currentMap.platforms.push(obj);
                break;
            case 'structure':
                if (!this.currentMap.structures) this.currentMap.structures = [];
                obj._type = 'structure';
                this.currentMap.structures.push(obj);
                break;
            case 'hill':
                if (!this.currentMap.hills) this.currentMap.hills = [];
                obj._type = 'hill';
                this.currentMap.hills.push(obj);
                break;
            case 'slope':
                if (!this.currentMap.slopes) this.currentMap.slopes = [];
                obj._type = 'slope';
                this.currentMap.slopes.push(obj);
                break;
            case 'ladder':
                if (!this.currentMap.ladders) this.currentMap.ladders = [];
                obj._type = 'ladder';
                this.currentMap.ladders.push(obj);
                break;
        }
    },
    
    removeObjectFromMap(obj) {
        const type = obj._type;
        let array;
        
        switch (type) {
            case 'platform': array = this.currentMap.platforms; break;
            case 'structure': array = this.currentMap.structures; break;
            case 'hill': array = this.currentMap.hills; break;
            case 'slope': array = this.currentMap.slopes; break;
            case 'portal': array = this.currentMap.portals; break;
            case 'npc': array = this.currentMap.npcs; break;
            case 'monster': array = this.currentMap.monsters; break;
            case 'ladder': array = this.currentMap.ladders; break;
        }
        
        if (array) {
            const index = array.indexOf(obj);
            if (index > -1) {
                array.splice(index, 1);
            }
        }
    },
    
    handleMoveStart(pos) {
        const obj = this.getObjectAtPoint(pos);
        if (obj) {
            this.selectedObject = obj;
            this.isDragging = true;
            this.updatePropertiesPanel();
            this.updateSelectionInfo();
        }
    },
    
    handleEraseStart(pos) {
        const obj = this.getObjectAtPoint(pos);
        if (obj) {
            this.removeObjectFromMap(obj);
            if (this.selectedObject === obj) {
                this.selectedObject = null;
                this.clearPropertiesPanel();
            }
            this.pushUndoState();
            this.render();
            this.showStatusMessage('Deleted');
        }
    },
    
    handleFill(pos) {
        // Fill tool - could be used for flood-filling tiles or areas
        this.showStatusMessage('Fill tool - select a tile first');
    },
    
    addPortal() {
        const portal = {
            x: this.currentMap.width / 2,
            y: this.currentMap.groundY,
            targetMap: '',
            targetX: 100,
            _type: 'portal'
        };
        
        this.currentMap.portals.push(portal);
        this.selectedObject = portal;
        
        this.pushUndoState();
        this.updatePropertiesPanel();
        this.updatePortalList();
        this.render();
        
        this.showStatusMessage('Portal added');
    },
    
    updatePortalList() {
        const container = document.getElementById('portal-list');
        const portals = this.currentMap.portals || [];
        
        if (portals.length === 0) {
            container.innerHTML = '<p class="hint">No portals on this map</p>';
            return;
        }
        
        container.innerHTML = portals.map((portal, i) => `
            <div class="portal-item" data-index="${i}">
                <span>Portal ${i + 1}</span>
                <span>${portal.targetMap || 'Not linked'}</span>
                <button class="portal-edit" title="Edit">✏️</button>
                <button class="portal-delete" title="Delete">🗑️</button>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.portal-item').forEach(item => {
            const index = parseInt(item.dataset.index);
            
            item.querySelector('.portal-edit').onclick = (e) => {
                e.stopPropagation();
                this.editPortal(index);
            };
            
            item.querySelector('.portal-delete').onclick = (e) => {
                e.stopPropagation();
                this.deletePortal(index);
            };
            
            item.onclick = () => {
                this.selectedObject = this.currentMap.portals[index];
                this.selectedObject._type = 'portal';
                this.centerOnObject(this.selectedObject);
                this.updatePropertiesPanel();
                this.render();
            };
        });
        
        // Update portal graph
        this.updatePortalGraph();
    },
    
    editPortal(index) {
        const portal = this.currentMap.portals[index];
        // Show portal edit modal
        // For now, just select it
        this.selectedObject = portal;
        this.selectedObject._type = 'portal';
        this.updatePropertiesPanel();
        this.render();
    },
    
    deletePortal(index) {
        this.currentMap.portals.splice(index, 1);
        this.selectedObject = null;
        this.clearPropertiesPanel();
        this.pushUndoState();
        this.updatePortalList();
        this.render();
        this.showStatusMessage('Portal deleted');
    },
    
    centerOnObject(obj) {
        const x = obj.x;
        const y = obj.y || this.currentMap.groundY;
        
        this.offsetX = this.canvas.width / 2 - x * this.zoom;
        this.offsetY = this.canvas.height / 2 - y * this.zoom;
    },
    
    updatePortalGraph() {
        const canvas = document.getElementById('portal-graph-canvas');
        const ctx = canvas.getContext('2d');
        const portals = this.currentMap.portals || [];
        
        // Clear
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (portals.length === 0) return;
        
        // Group portals by target map
        const mapGroups = {};
        portals.forEach((portal, i) => {
            const target = portal.targetMap || 'unlinked';
            if (!mapGroups[target]) mapGroups[target] = [];
            mapGroups[target].push({ portal, index: i });
        });
        
        // Draw nodes for this map
        const thisMapX = canvas.width / 2;
        const thisMapY = canvas.height / 2;
        
        ctx.fillStyle = '#e94560';
        ctx.beginPath();
        ctx.arc(thisMapX, thisMapY, 20, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.currentMap.id || 'This Map', thisMapX, thisMapY + 4);
        
        // Draw target map nodes
        const targets = Object.keys(mapGroups).filter(t => t !== 'unlinked');
        const angleStep = (Math.PI * 2) / Math.max(targets.length, 1);
        
        targets.forEach((target, i) => {
            const angle = angleStep * i - Math.PI / 2;
            const x = thisMapX + Math.cos(angle) * 60;
            const y = thisMapY + Math.sin(angle) * 50;
            
            // Draw connection line
            ctx.strokeStyle = 'rgba(100, 150, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(thisMapX, thisMapY);
            ctx.lineTo(x, y);
            ctx.stroke();
            
            // Draw target node
            ctx.fillStyle = '#66f';
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.font = '8px Arial';
            ctx.fillText(target, x, y + 3);
        });
    },
    
    addNPC(type) {
        const npc = {
            type: type,
            x: this.currentMap.width / 2,
            _type: 'npc'
        };
        
        this.currentMap.npcs.push(npc);
        this.selectedObject = npc;
        
        this.pushUndoState();
        this.updatePropertiesPanel();
        this.render();
        
        this.showStatusMessage(`NPC ${type} added`);
    },
    
    addLadder() {
        if (!this.currentMap.ladders) {
            this.currentMap.ladders = [];
        }
        
        const ladder = {
            x: this.currentMap.width / 2,
            y1: this.currentMap.groundY - 200,
            y2: this.currentMap.groundY,
            _type: 'ladder'
        };
        
        this.currentMap.ladders.push(ladder);
        this.selectedObject = ladder;
        
        this.pushUndoState();
        this.updatePropertiesPanel();
        this.render();
        
        this.showStatusMessage('Ladder added');
    },
    
    addMonsterSpawn(type, count) {
        const monster = {
            type: type,
            count: count || 5,
            _type: 'monster'
        };
        
        if (!this.currentMap.monsters) {
            this.currentMap.monsters = [];
        }
        
        this.currentMap.monsters.push(monster);
        this.pushUndoState();
        this.render();
        
        this.showStatusMessage(`Monster spawn ${type} x${count} added`);
    }
});
