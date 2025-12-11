/**
 * BennSauce Level Editor - I/O Module
 * Save, Load, and Export functionality
 */

// Extend LevelEditor with I/O methods
Object.assign(LevelEditor.prototype, {
    loadExistingMaps() {
        // This will be populated from data.js when loaded
        this.existingMaps = {};
        
        // Try to load maps from parent directory's data.js
        // For now, we'll provide a manual way to load
        this.showStatusMessage('Use Load to import maps from data.js');
    },
    
    showLoadMapModal() {
        const modal = document.getElementById('modal-load');
        const container = document.getElementById('existing-maps');
        
        // Check if maps global exists
        if (typeof maps !== 'undefined') {
            const mapIds = Object.keys(maps);
            container.innerHTML = mapIds.map(id => `
                <div class="map-list-item" data-id="${id}">
                    <span class="map-id">${id}</span>
                    <span class="map-details">${maps[id].width}x${maps[id].height || 720}</span>
                </div>
            `).join('');
            
            container.querySelectorAll('.map-list-item').forEach(item => {
                item.onclick = () => {
                    container.querySelectorAll('.map-list-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                };
            });
        } else {
            container.innerHTML = `
                <p class="hint">No maps found. Load data.js first or paste map data below:</p>
                <textarea id="paste-map-data" placeholder="Paste map JSON here..."></textarea>
            `;
        }
        
        modal.classList.remove('hidden');
        
        // Setup load confirm button
        document.getElementById('btn-load-confirm').onclick = () => {
            const selected = container.querySelector('.map-list-item.selected');
            if (selected) {
                this.loadMap(selected.dataset.id);
            } else {
                const textarea = document.getElementById('paste-map-data');
                if (textarea && textarea.value) {
                    try {
                        const mapData = JSON.parse(textarea.value);
                        this.loadMapData(mapData);
                    } catch (e) {
                        this.showStatusMessage('Invalid JSON data');
                    }
                }
            }
            modal.classList.add('hidden');
        };
        
        // File input handler
        document.getElementById('btn-load-file').onclick = () => {
            document.getElementById('file-input').click();
        };
        
        document.getElementById('file-input').onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const mapData = JSON.parse(event.target.result);
                        this.loadMapData(mapData);
                        modal.classList.add('hidden');
                    } catch (err) {
                        this.showStatusMessage('Error reading file');
                    }
                };
                reader.readAsText(file);
            }
        };
    },
    
    loadMap(mapId) {
        if (typeof maps === 'undefined' || !maps[mapId]) {
            this.showStatusMessage('Map not found');
            return;
        }
        
        const mapData = maps[mapId];
        this.loadMapData({ ...mapData, id: mapId });
    },
    
    loadMapData(mapData) {
        // Convert from game format to editor format
        // Ground Y is calculated as height - 120 (matching game data)
        const height = mapData.height || 720;
        
        this.currentMap = {
            id: mapData.id || 'imported',
            name: mapData.name || mapData.id,
            width: mapData.width || 2400,
            height: height,
            groundY: height - 120, // Correct calculation
            backgroundColor: mapData.backgroundColor || '#87CEEB',
            bgm: mapData.bgm || 'field',
            groundType: mapData.groundType || 'grass',
            parallax: mapData.parallax || [],
            platforms: (mapData.platforms || []).map(p => ({ ...p, _type: 'platform' })),
            structures: (mapData.structures || []).map(s => ({ ...s, _type: 'structure' })),
            ladders: (mapData.ladders || []).map(l => ({ ...l, _type: 'ladder' })),
            portals: (mapData.portals || []).map(p => ({ ...p, _type: 'portal' })),
            npcs: (mapData.npcs || []).map(n => ({ ...n, _type: 'npc' })),
            monsters: mapData.monsters || []
        };
        
        // Update UI
        document.getElementById('map-id').value = this.currentMap.id;
        document.getElementById('map-width').value = this.currentMap.width;
        document.getElementById('map-height').value = this.currentMap.height;
        document.getElementById('map-ground-y').value = this.currentMap.groundY;
        
        // Clear selection
        this.selectedObject = null;
        this.clearPropertiesPanel();
        
        // Reset view
        this.offsetX = 50;
        this.offsetY = 50;
        this.zoom = 0.75;
        document.getElementById('zoom-slider').value = 75;
        document.getElementById('zoom-value').textContent = '75%';
        
        // Update UI
        this.updatePortalList();
        this.updateStatusBar();
        this.render();
        
        this.showStatusMessage(`Loaded: ${this.currentMap.id}`);
    },
    
    saveMap() {
        // Save to localStorage
        const mapData = this.exportMapData();
        const saveKey = `levelEditor_${this.currentMap.id}`;
        
        try {
            localStorage.setItem(saveKey, JSON.stringify(mapData));
            this.showStatusMessage('Saved to browser storage');
        } catch (e) {
            this.showStatusMessage('Error saving map');
        }
    },
    
    showExportModal() {
        const modal = document.getElementById('modal-export');
        const codeArea = document.getElementById('export-code');
        
        // Generate export code
        const exportCode = this.generateExportCode();
        codeArea.value = exportCode;
        
        modal.classList.remove('hidden');
        
        // Copy button
        document.getElementById('btn-copy-code').onclick = () => {
            navigator.clipboard.writeText(exportCode).then(() => {
                this.showStatusMessage('Copied to clipboard');
            });
        };
        
        // Download button
        document.getElementById('btn-download-json').onclick = () => {
            const mapData = this.exportMapData();
            const blob = new Blob([JSON.stringify(mapData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.currentMap.id}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };
    },
    
    exportMapData() {
        // Clean up the map data for export (remove _type markers)
        const clean = (arr) => arr.map(obj => {
            const cleaned = { ...obj };
            delete cleaned._type;
            return cleaned;
        });
        
        return {
            id: this.currentMap.id,
            width: this.currentMap.width,
            height: this.currentMap.height,
            backgroundColor: this.currentMap.backgroundColor,
            bgm: this.currentMap.bgm,
            groundType: this.currentMap.groundType,
            parallax: this.currentMap.parallax,
            platforms: clean(this.currentMap.platforms),
            structures: clean(this.currentMap.structures),
            ladders: clean(this.currentMap.ladders || []),
            portals: clean(this.currentMap.portals),
            npcs: clean(this.currentMap.npcs),
            monsters: this.currentMap.monsters
        };
    },
    
    generateExportCode() {
        const mapData = this.exportMapData();
        const includeComments = document.getElementById('export-include-comments')?.checked ?? true;
        const minify = document.getElementById('export-minify')?.checked ?? false;
        
        let code = '';
        
        if (includeComments) {
            code += `    // ${this.currentMap.id} - Generated by BennSauce Level Editor\n`;
        }
        
        code += `    ${this.currentMap.id}: {\n`;
        code += `        width: ${mapData.width},\n`;
        
        if (mapData.height && mapData.height !== 720) {
            code += `        height: ${mapData.height},\n`;
        }
        
        code += `        backgroundColor: '${mapData.backgroundColor}',\n`;
        code += `        bgm: '${mapData.bgm}',\n`;
        code += `        groundType: '${mapData.groundType}',\n`;
        
        // Parallax
        if (mapData.parallax && mapData.parallax.length > 0) {
            code += `        parallax: [\n`;
            mapData.parallax.forEach(p => {
                code += `            {\n`;
                code += `                src: artAssets.${p.src || 'backgroundBluesky'},\n`;
                code += `                speed: ${p.speed || 0.01},\n`;
                code += `                y: ${p.y || 1400},\n`;
                code += `                height: ${p.height || 1600},\n`;
                code += `                width: ${p.width || 1200},\n`;
                code += `                scale: ${p.scale || 3}\n`;
                code += `            }\n`;
            });
            code += `        ],\n`;
        } else {
            code += `        parallax: [],\n`;
        }
        
        // NPCs
        if (mapData.npcs.length > 0) {
            code += `        npcs: [\n`;
            mapData.npcs.forEach(npc => {
                const parts = [`type: '${npc.type}'`, `x: ${npc.x}`];
                if (npc.y) parts.push(`y: ${npc.y}`);
                code += `            { ${parts.join(', ')} },\n`;
            });
            code = code.slice(0, -2) + '\n'; // Remove trailing comma
            code += `        ],\n`;
        } else {
            code += `        npcs: [],\n`;
        }
        
        // Ladders
        if (mapData.ladders && mapData.ladders.length > 0) {
            code += `        ladders: [\n`;
            mapData.ladders.forEach(l => {
                code += `            { x: ${l.x}, y1: ${l.y1}, y2: ${l.y2} },\n`;
            });
            code = code.slice(0, -2) + '\n';
            code += `        ],\n`;
        }
        
        // Monsters
        if (mapData.monsters.length > 0) {
            code += `        monsters: [\n`;
            mapData.monsters.forEach(m => {
                const parts = [`type: '${m.type}'`, `count: ${m.count}`];
                if (m.x) parts.push(`x: ${m.x}`);
                if (m.fixedPosition) parts.push(`fixedPosition: true`);
                code += `            { ${parts.join(', ')} },\n`;
            });
            code = code.slice(0, -2) + '\n';
            code += `        ],\n`;
        } else {
            code += `        monsters: [],\n`;
        }
        
        // Portals
        if (mapData.portals.length > 0) {
            code += `        portals: [\n`;
            mapData.portals.forEach(p => {
                const parts = [`x: ${p.x}`];
                if (p.y) parts.push(`y: ${p.y}`);
                parts.push(`targetMap: '${p.targetMap}'`);
                parts.push(`targetX: ${p.targetX}`);
                if (p.targetY) parts.push(`targetY: ${p.targetY}`);
                code += `            { ${parts.join(', ')} },\n`;
            });
            code = code.slice(0, -2) + '\n';
            code += `        ],\n`;
        } else {
            code += `        portals: [],\n`;
        }
        
        // Platforms
        if (mapData.platforms.length > 0) {
            code += `        platforms: [\n`;
            mapData.platforms.forEach(p => {
                const parts = [`x: ${p.x}`, `y: ${p.y}`, `width: ${p.width}`];
                if (p.noSpawn) parts.push(`noSpawn: true`);
                code += `            { ${parts.join(', ')} },\n`;
            });
            code = code.slice(0, -2) + '\n';
            code += `        ],\n`;
        } else {
            code += `        platforms: [],\n`;
        }
        
        // Structures
        if (mapData.structures.length > 0) {
            code += `        structures: [\n`;
            mapData.structures.forEach(s => {
                code += `            { x: ${s.x}, y: ${s.y}, width: ${s.width} },\n`;
            });
            code = code.slice(0, -2) + '\n';
            code += `        ]\n`;
        } else {
            code += `        structures: []\n`;
        }
        
        code += `    },`;
        
        if (minify) {
            // Remove whitespace and newlines
            code = code.replace(/\s+/g, ' ').replace(/\s*([{}\[\]:,])\s*/g, '$1');
        }
        
        return code;
    },
    
    showNewMapModal() {
        const modal = document.getElementById('modal-new');
        modal.classList.remove('hidden');
        
        document.getElementById('btn-create-map').onclick = () => {
            const id = document.getElementById('new-map-id').value || 'newMap';
            const name = document.getElementById('new-map-name').value || id;
            const width = parseInt(document.getElementById('new-map-width').value) || 2400;
            const height = parseInt(document.getElementById('new-map-height').value) || 720;
            const template = document.getElementById('new-map-template').value;
            
            this.createNewMap(id, name, width, height, template);
            modal.classList.add('hidden');
        };
    },
    
    createNewMap(id, name, width, height, template) {
        this.currentMap = this.createEmptyMap();
        this.currentMap.id = id;
        this.currentMap.name = name;
        this.currentMap.width = width;
        this.currentMap.height = height;
        this.currentMap.groundY = height - 120; // Correct: height - 120
        
        // Apply template
        switch (template) {
            case 'field':
                this.currentMap.backgroundColor = '#98D8C8';
                this.currentMap.groundType = 'grass';
                this.currentMap.platforms = [
                    { x: 200, y: height - 200, width: 200, _type: 'platform' },
                    { x: 500, y: height - 350, width: 150, _type: 'platform' },
                    { x: 800, y: height - 200, width: 200, _type: 'platform' }
                ];
                break;
            case 'town':
                this.currentMap.backgroundColor = '#F4E4C1';
                this.currentMap.groundType = 'grass';
                this.currentMap.structures = [
                    { x: 300, y: height - 120, width: 200, _type: 'structure' },
                    { x: 700, y: height - 120, width: 200, _type: 'structure' }
                ];
                break;
            case 'dungeon':
                this.currentMap.backgroundColor = '#4a4a4a';
                this.currentMap.groundType = 'stone';
                break;
        }
        
        // Update UI
        document.getElementById('map-id').value = id;
        document.getElementById('map-width').value = width;
        document.getElementById('map-height').value = height;
        document.getElementById('map-ground-y').value = this.currentMap.groundY;
        
        // Clear selection
        this.selectedObject = null;
        this.clearPropertiesPanel();
        this.undoStack = [];
        this.redoStack = [];
        
        // Reset view
        this.offsetX = 50;
        this.offsetY = 50;
        
        this.updateStatusBar();
        this.render();
        
        this.showStatusMessage(`Created: ${id}`);
    }
});
