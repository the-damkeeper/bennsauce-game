/**
 * BennSauce Level Editor - UI Module
 * User interface interactions - simplified and accurate to game data
 */

// Extend LevelEditor with UI methods
Object.assign(LevelEditor.prototype, {
    
    // Populate NPC list from EditorData.NPC_TYPES
    loadNPCList() {
        const container = document.getElementById('npc-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        Object.entries(EditorData.NPC_TYPES).forEach(([type, data]) => {
            const item = document.createElement('div');
            item.className = 'npc-item';
            item.dataset.type = type;
            item.innerHTML = `
                <span class="npc-name">${data.name}</span>
                <span class="npc-type">(${type})</span>
                <button class="add-btn" title="Add to map">+</button>
            `;
            
            item.querySelector('.add-btn').onclick = (e) => {
                e.stopPropagation();
                this.addNPCToMap(type);
            };
            
            container.appendChild(item);
        });
    },
    
    // Populate Monster list from EditorData.MONSTER_TYPES
    loadMonsterList() {
        const container = document.getElementById('monster-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        Object.entries(EditorData.MONSTER_TYPES).forEach(([type, data]) => {
            const item = document.createElement('div');
            item.className = 'monster-item';
            item.dataset.type = type;
            
            const bossTag = data.isMiniBoss ? ' <span class="boss-tag">BOSS</span>' : '';
            
            item.innerHTML = `
                <span class="monster-name">${data.name}${bossTag}</span>
                <span class="monster-level">Lv.${data.level}</span>
                <button class="add-btn" title="Add spawn to map">+</button>
            `;
            
            item.querySelector('.add-btn').onclick = (e) => {
                e.stopPropagation();
                this.showMonsterSpawnDialog(type, data);
            };
            
            container.appendChild(item);
        });
    },
    
    // Show dialog to configure monster spawn
    showMonsterSpawnDialog(type, monsterData) {
        const dialog = document.createElement('div');
        dialog.className = 'editor-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>Add Monster Spawn: ${monsterData.name}</h3>
                <div class="form-group">
                    <label>Count:</label>
                    <input type="number" id="spawn-count" value="5" min="1" max="50">
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="spawn-fixed"> Fixed Position
                    </label>
                </div>
                <div class="form-group" id="position-group" style="display:none;">
                    <label>X Position:</label>
                    <input type="number" id="spawn-x" value="400" min="0">
                </div>
                <div class="dialog-buttons">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-confirm">Add</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Toggle position input
        dialog.querySelector('#spawn-fixed').onchange = (e) => {
            document.getElementById('position-group').style.display = 
                e.target.checked ? 'block' : 'none';
        };
        
        dialog.querySelector('.btn-cancel').onclick = () => dialog.remove();
        dialog.querySelector('.btn-confirm').onclick = () => {
            const count = parseInt(document.getElementById('spawn-count').value) || 1;
            const fixed = document.getElementById('spawn-fixed').checked;
            const x = parseInt(document.getElementById('spawn-x').value) || 400;
            
            const spawn = { type, count };
            if (fixed) {
                spawn.x = x;
                spawn.fixedPosition = true;
            }
            
            this.addMonsterSpawn(spawn);
            dialog.remove();
        };
    },
    
    // Add NPC to current map
    addNPCToMap(type) {
        if (!this.currentMap) return;
        
        if (!this.currentMap.npcs) {
            this.currentMap.npcs = [];
        }
        
        this.currentMap.npcs.push({
            type: type,
            x: 400 // Default position
        });
        
        this.render();
        this.showNotification(`Added ${EditorData.NPC_TYPES[type].name} to map`);
    },
    
    // Add monster spawn to current map
    addMonsterSpawn(spawn) {
        if (!this.currentMap) return;
        
        if (!this.currentMap.monsters) {
            this.currentMap.monsters = [];
        }
        
        this.currentMap.monsters.push(spawn);
        
        this.render();
        const monsterData = EditorData.MONSTER_TYPES[spawn.type];
        this.showNotification(`Added ${monsterData.name} spawn (x${spawn.count}) to map`);
    },
    
    // Show notification toast
    showNotification(message, duration = 2000) {
        const existing = document.querySelector('.editor-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = 'editor-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), duration);
    },
    
    // Update property panel for selected object
    updatePropertyPanel() {
        const panel = document.getElementById('properties-panel');
        if (!panel || !this.selectedObject) {
            if (panel) panel.innerHTML = '<p>Select an object to edit properties</p>';
            return;
        }
        
        const obj = this.selectedObject;
        const objType = obj._type || 'unknown';
        let html = `<h4>${objType.charAt(0).toUpperCase() + objType.slice(1)} Properties</h4>`;
        
        switch (objType) {
            case 'platform':
                html += `
                    <div class="prop-row">
                        <label>X:</label>
                        <input type="number" data-prop="x" value="${obj.x}">
                    </div>
                    <div class="prop-row">
                        <label>Y:</label>
                        <input type="number" data-prop="y" value="${obj.y}">
                    </div>
                    <div class="prop-row">
                        <label>Width:</label>
                        <input type="number" data-prop="width" value="${obj.width}">
                    </div>
                    <div class="prop-row">
                        <label>
                            <input type="checkbox" data-prop="noSpawn" ${obj.noSpawn ? 'checked' : ''}>
                            No Monster Spawn
                        </label>
                    </div>
                `;
                break;
                
            case 'structure':
                html += `
                    <div class="prop-row">
                        <label>X:</label>
                        <input type="number" data-prop="x" value="${obj.x}">
                    </div>
                    <div class="prop-row">
                        <label>Y:</label>
                        <input type="number" data-prop="y" value="${obj.y}">
                    </div>
                    <div class="prop-row">
                        <label>Width:</label>
                        <input type="number" data-prop="width" value="${obj.width}">
                    </div>
                `;
                break;
                
            case 'portal':
                html += `
                    <div class="prop-row">
                        <label>X:</label>
                        <input type="number" data-prop="x" value="${obj.x}">
                    </div>
                    <div class="prop-row">
                        <label>Y (optional):</label>
                        <input type="number" data-prop="y" value="${obj.y || ''}">
                    </div>
                    <div class="prop-row">
                        <label>Target Map:</label>
                        <input type="text" data-prop="targetMap" value="${obj.targetMap}">
                    </div>
                    <div class="prop-row">
                        <label>Target X:</label>
                        <input type="number" data-prop="targetX" value="${obj.targetX}">
                    </div>
                    <div class="prop-row">
                        <label>Target Y (optional):</label>
                        <input type="number" data-prop="targetY" value="${obj.targetY || ''}">
                    </div>
                `;
                break;
                
            case 'npc':
                html += `
                    <div class="prop-row">
                        <label>Type:</label>
                        <select data-prop="type">
                            ${Object.entries(EditorData.NPC_TYPES).map(([t, d]) => 
                                `<option value="${t}" ${t === obj.type ? 'selected' : ''}>${d.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="prop-row">
                        <label>X:</label>
                        <input type="number" data-prop="x" value="${obj.x}">
                    </div>
                    <div class="prop-row">
                        <label>Y (optional):</label>
                        <input type="number" data-prop="y" value="${obj.y || ''}">
                    </div>
                `;
                break;
                
            case 'ladder':
                html += `
                    <div class="prop-row">
                        <label>X:</label>
                        <input type="number" data-prop="x" value="${obj.x}">
                    </div>
                    <div class="prop-row">
                        <label>Y1 (top):</label>
                        <input type="number" data-prop="y1" value="${obj.y1}">
                    </div>
                    <div class="prop-row">
                        <label>Y2 (bottom):</label>
                        <input type="number" data-prop="y2" value="${obj.y2}">
                    </div>
                `;
                break;
        }
        
        html += `<button class="btn-delete" onclick="levelEditor.deleteSelectedObject()">Delete</button>`;
        
        panel.innerHTML = html;
        
        // Add change listeners
        panel.querySelectorAll('input, select').forEach(input => {
            input.onchange = () => this.updateObjectProperty(input);
        });
    },
    
    // Update object property from input
    updateObjectProperty(input) {
        if (!this.selectedObject) return;
        
        const prop = input.dataset.prop;
        let value;
        
        if (input.type === 'checkbox') {
            value = input.checked;
        } else if (input.type === 'number') {
            value = input.value ? parseInt(input.value) : undefined;
        } else {
            value = input.value;
        }
        
        if (value !== undefined) {
            this.selectedObject[prop] = value;
        } else {
            delete this.selectedObject[prop];
        }
        
        this.render();
    },
    
    // Delete selected object
    deleteSelectedObject() {
        if (!this.selectedObject || !this.currentMap) return;
        
        const obj = this.selectedObject;
        const objType = obj._type;
        const array = this.currentMap[objType + 's'];
        
        if (array) {
            const index = array.indexOf(obj);
            if (index > -1) {
                array.splice(index, 1);
            }
        }
        
        this.selectedObject = null;
        this.updatePropertyPanel();
        this.render();
        this.showNotification('Object deleted');
    },
    
    // Show help overlay
    showHelpOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'help-overlay';
        overlay.innerHTML = `
            <div class="help-content">
                <h2>Level Editor Help</h2>
                <div class="help-section">
                    <h3>Mouse Controls</h3>
                    <p><b>Left Click</b> - Select object</p>
                    <p><b>Left Drag</b> - Move selected object</p>
                    <p><b>Middle Drag / Space+Drag</b> - Pan view</p>
                    <p><b>Scroll</b> - Zoom in/out</p>
                </div>
                <div class="help-section">
                    <h3>Keyboard Shortcuts</h3>
                    <p><b>Delete</b> - Delete selected object</p>
                    <p><b>Ctrl+S</b> - Save map</p>
                    <p><b>Ctrl+Z</b> - Undo</p>
                    <p><b>G</b> - Toggle grid</p>
                </div>
                <div class="help-section">
                    <h3>Map Elements</h3>
                    <p><b>Platforms</b> - Surfaces players can stand on (brown)</p>
                    <p><b>Structures</b> - Solid blocks (darker brown)</p>
                    <p><b>Ladders</b> - Climbable areas (gold)</p>
                    <p><b>Portals</b> - Map transitions (blue)</p>
                    <p><b>NPCs</b> - Non-player characters (yellow)</p>
                    <p><b>Monsters</b> - Enemy spawns (red)</p>
                </div>
                <button class="close-help">Close</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        overlay.querySelector('.close-help').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }
});

// Initialize UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for editor to initialize
    setTimeout(() => {
        if (window.levelEditor) {
            window.levelEditor.loadNPCList();
            window.levelEditor.loadMonsterList();
        }
    }, 100);
});
