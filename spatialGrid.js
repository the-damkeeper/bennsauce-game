// Spatial Grid for optimized collision detection
class SpatialGrid {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.grid = new Map(); // Map<string, Set<Entity>>
        this.entities = new Set(); // All tracked entities
    }
    
    /**
     * Get grid cell key for coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {string} Cell key
     */
    getCellKey(x, y) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    }
    
    /**
     * Get all cell keys an entity occupies
     * @param {Object} entity - Entity with x, y, width, height
     * @returns {Array<string>} Array of cell keys
     */
    getEntityCells(entity) {
        const cells = [];
        const minX = Math.floor(entity.x / this.cellSize);
        const maxX = Math.floor((entity.x + entity.width) / this.cellSize);
        const minY = Math.floor(entity.y / this.cellSize);
        const maxY = Math.floor((entity.y + entity.height) / this.cellSize);
        
        for (let cellX = minX; cellX <= maxX; cellX++) {
            for (let cellY = minY; cellY <= maxY; cellY++) {
                cells.push(`${cellX},${cellY}`);
            }
        }
        
        return cells;
    }
    
    /**
     * Add entity to the spatial grid
     * @param {Object} entity - Entity to add
     */
    addEntity(entity) {
        if (!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number') {
            console.warn('[SpatialGrid] Invalid entity', entity);
            return;
        }
        
        this.entities.add(entity);
        const cells = this.getEntityCells(entity);
        
        for (const cellKey of cells) {
            if (!this.grid.has(cellKey)) {
                this.grid.set(cellKey, new Set());
            }
            this.grid.get(cellKey).add(entity);
        }
    }
    
    /**
     * Remove entity from the spatial grid
     * @param {Object} entity - Entity to remove
     */
    removeEntity(entity) {
        if (!entity || !entity._gridCells) {
            return;
        }
        
        this.entities.delete(entity);
        
        for (const cellKey of entity._gridCells) {
            const cell = this.grid.get(cellKey);
            if (cell) {
                cell.delete(entity);
                if (cell.size === 0) {
                    this.grid.delete(cellKey);
                }
            }
        }
        
        delete entity._gridCells;
    }
    
    /**
     * Update entity position in grid
     * @param {Object} entity - Entity to update
     */
    updateEntity(entity) {
        if (!entity) return;
        
        const newCells = this.getEntityCells(entity);
        const oldCells = entity._gridCells || [];
        
        // Check if cells changed
        if (oldCells.length === newCells.length && 
            oldCells.every((cell, i) => cell === newCells[i])) {
            return; // No change
        }
        
        // Remove from old cells
        for (const cellKey of oldCells) {
            const cell = this.grid.get(cellKey);
            if (cell) {
                cell.delete(entity);
                if (cell.size === 0) {
                    this.grid.delete(cellKey);
                }
            }
        }
        
        // Add to new cells
        for (const cellKey of newCells) {
            if (!this.grid.has(cellKey)) {
                this.grid.set(cellKey, new Set());
            }
            this.grid.get(cellKey).add(entity);
        }
        
        entity._gridCells = newCells;
    }
    
    /**
     * Get nearby entities for collision checking
     * @param {Object} entity - Entity to check around
     * @returns {Set<Object>} Set of nearby entities
     */
    getNearbyEntities(entity) {
        const nearby = new Set();
        const cells = this.getEntityCells(entity);
        
        for (const cellKey of cells) {
            const cell = this.grid.get(cellKey);
            if (cell) {
                for (const other of cell) {
                    if (other !== entity) {
                        nearby.add(other);
                    }
                }
            }
        }
        
        return nearby;
    }
    
    /**
     * Get entities in a specific area
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} width - Width of area
     * @param {number} height - Height of area
     * @returns {Set<Object>} Set of entities in area
     */
    getEntitiesInArea(x, y, width, height) {
        const nearby = new Set();
        const minX = Math.floor(x / this.cellSize);
        const maxX = Math.floor((x + width) / this.cellSize);
        const minY = Math.floor(y / this.cellSize);
        const maxY = Math.floor((y + height) / this.cellSize);
        
        for (let cellX = minX; cellX <= maxX; cellX++) {
            for (let cellY = minY; cellY <= maxY; cellY++) {
                const cellKey = `${cellX},${cellY}`;
                const cell = this.grid.get(cellKey);
                if (cell) {
                    for (const entity of cell) {
                        nearby.add(entity);
                    }
                }
            }
        }
        
        return nearby;
    }
    
    /**
     * Clear the entire grid
     */
    clear() {
        this.grid.clear();
        this.entities.clear();
    }
    
    /**
     * Rebuild the entire grid (useful after major changes)
     */
    rebuild() {
        const allEntities = Array.from(this.entities);
        this.clear();
        
        for (const entity of allEntities) {
            this.addEntity(entity);
        }
    }
    
    /**
     * Get grid statistics
     * @returns {Object} Stats about the grid
     */
    getStats() {
        return {
            cells: this.grid.size,
            entities: this.entities.size,
            avgEntitiesPerCell: this.grid.size > 0 
                ? Array.from(this.grid.values()).reduce((sum, cell) => sum + cell.size, 0) / this.grid.size 
                : 0
        };
    }
}

// Global spatial grid instance
const spatialGrid = new SpatialGrid(150); // 150px cells for good balance

// Helper function to update all monsters in the spatial grid
function updateSpatialGridForMonsters() {
    if (typeof monsters === 'undefined') return;
    
    for (const monster of monsters) {
        if (monster._inGrid) {
            spatialGrid.updateEntity(monster);
        } else {
            spatialGrid.addEntity(monster);
            monster._inGrid = true;
        }
    }
}

// Helper function to add attacks to spatial grid
function addAttackToSpatialGrid(attack) {
    if (!attack._inGrid) {
        spatialGrid.addEntity(attack);
        attack._inGrid = true;
    }
}

// Helper function to remove attacks from spatial grid
function removeAttackFromSpatialGrid(attack) {
    if (attack._inGrid) {
        spatialGrid.removeEntity(attack);
        attack._inGrid = false;
    }
}