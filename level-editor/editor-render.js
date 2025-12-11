/**
 * BennSauce Level Editor - Render Module
 * Canvas rendering - simplified to match actual game data
 */

// Extend LevelEditor with render methods
Object.assign(LevelEditor.prototype, {
    render() {
        if (!this.ctx || !this.currentMap) return;
        
        const ctx = this.ctx;
        const map = this.currentMap;
        
        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context state
        ctx.save();
        
        // Apply zoom and pan
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.zoom, this.zoom);
        
        // Render layers with visibility check
        if (this.layerVisibility.background) {
            this.renderBackground(ctx, map);
        }
        
        if (this.showGrid) {
            this.renderGrid(ctx, map);
        }
        
        // Render ground line
        this.renderGround(ctx, map);
        
        // Render map elements with visibility check
        // Hills and slopes render first (background terrain)
        if (this.layerVisibility.hills !== false) {
            this.renderHills(ctx, map);
        }
        
        if (this.layerVisibility.slopes !== false) {
            this.renderSlopes(ctx, map);
        }
        
        if (this.layerVisibility.structures) {
            this.renderStructures(ctx, map);
        }
        
        if (this.layerVisibility.platforms) {
            this.renderPlatforms(ctx, map);
        }
        
        if (this.layerVisibility.ladders) {
            this.renderLadders(ctx, map);
        }
        
        if (this.layerVisibility.portals) {
            this.renderPortals(ctx, map);
        }
        
        if (this.layerVisibility.npcs) {
            this.renderNPCs(ctx, map);
        }
        
        if (this.layerVisibility.monsters) {
            this.renderMonsters(ctx, map);
        }
        
        // Render selection
        if (this.selectedObject) {
            this.renderSelection(ctx);
        }
        
        // Render ladder preview (two-click mode)
        if (this.ladderMode === 'waitingForY2' && this.ladderTempX !== null) {
            this.renderLadderPreview(ctx);
        }
        
        // Restore context
        ctx.restore();
        
        // Render minimap
        this.renderMinimap();
    },
    
    renderLadderPreview(ctx) {
        const x = this.ladderTempX;
        const y1 = this.ladderTempY1;
        const currentY = this.lastMousePos ? this.lastMousePos.y : y1;
        
        // Draw preview ladder from y1 to current mouse position
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(x - 16, Math.min(y1, currentY), 32, Math.abs(currentY - y1));
        
        // Ladder rungs preview
        ctx.strokeStyle = '#D2691E';
        ctx.lineWidth = 3 / this.zoom;
        const rungSpacing = 20;
        const startY = Math.min(y1, currentY);
        const endY = Math.max(y1, currentY);
        for (let ry = startY; ry <= endY; ry += rungSpacing) {
            ctx.beginPath();
            ctx.moveTo(x - 14, ry);
            ctx.lineTo(x + 14, ry);
            ctx.stroke();
        }
        
        ctx.globalAlpha = 1;
        
        // Draw Y1 marker
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(x, y1, 6 / this.zoom, 0, Math.PI * 2);
        ctx.fill();
        
        // Label
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${12 / this.zoom}px Arial`;
        ctx.fillText('Y1 (Top)', x + 20, y1 + 4);
        ctx.fillText('Click to set Y2 (Bottom)', x + 20, y1 + 20);
    },
    
    renderBackground(ctx, map) {
        // Fill with background color
        ctx.fillStyle = map.backgroundColor || '#87CEEB';
        ctx.fillRect(0, 0, map.width, map.height || 720);
    },
    
    renderGrid(ctx, map) {
        const gridSize = EditorData.GRID_SIZE;
        const width = map.width;
        const height = map.height || 720;
        
        ctx.strokeStyle = EditorData.EDITOR_COLORS.grid;
        ctx.lineWidth = 1 / this.zoom;
        
        // Vertical lines
        for (let x = 0; x <= width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Major grid lines (every 5 cells)
        ctx.strokeStyle = EditorData.EDITOR_COLORS.gridMajor;
        for (let x = 0; x <= width; x += gridSize * 5) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += gridSize * 5) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    },
    
    renderGround(ctx, map) {
        const height = map.height || 720;
        const groundY = height - 120; // Standard ground position
        const tilesetImage = EditorData.getTilesetImage();
        const groundType = map.groundType || 'grass';
        const tileSet = EditorData.TILE_SETS[groundType] || EditorData.TILE_SETS.grass;
        const tileSize = EditorData.SPRITE_DATA.ground.tileSize;
        const scale = EditorData.PIXEL_ART_SCALE;
        const scaledTileSize = tileSize * scale;
        
        if (tilesetImage && EditorData.isTilesetLoaded()) {
            // Render using actual tileset - ground surface
            const tilesAcross = Math.ceil(map.width / scaledTileSize);
            
            for (let col = 0; col < tilesAcross; col++) {
                const destX = col * scaledTileSize;
                // Draw ground surface tile
                ctx.drawImage(
                    tilesetImage,
                    tileSet.ground.x, tileSet.ground.y,
                    tileSize, tileSize,
                    destX, groundY,
                    scaledTileSize, scaledTileSize
                );
                
                // Draw background fill below ground
                const maxRows = Math.ceil((height - groundY - scaledTileSize) / scaledTileSize) + 2;
                for (let row = 1; row <= maxRows; row++) {
                    const destY = groundY + (row * scaledTileSize);
                    ctx.drawImage(
                        tilesetImage,
                        tileSet.background.x, tileSet.background.y,
                        tileSize, tileSize,
                        destX, destY,
                        scaledTileSize, scaledTileSize
                    );
                }
            }
        } else {
            // Fallback: Draw simple colored ground
            ctx.fillStyle = EditorData.EDITOR_COLORS.ground;
            ctx.fillRect(0, groundY, map.width, height - groundY);
        }
        
        // Ground line indicator (always show)
        ctx.strokeStyle = '#2E7D32';
        ctx.lineWidth = 2 / this.zoom;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(map.width, groundY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Label
        ctx.fillStyle = '#fff';
        ctx.font = `${12 / this.zoom}px Arial`;
        ctx.fillText(`Ground Y: ${groundY}`, 10, groundY - 5);
    },
    
    renderHills(ctx, map) {
        const hills = map.hills || [];
        const tilesetImage = EditorData.getTilesetImage();
        const groundType = map.groundType || 'grass';
        const tileSet = EditorData.TILE_SETS[groundType] || EditorData.TILE_SETS.grass;
        const tileSize = EditorData.SPRITE_DATA.ground.tileSize;
        const scale = EditorData.PIXEL_ART_SCALE;
        const scaledTileSize = tileSize * scale;
        const mapHeight = map.height || 720;
        const groundSurfaceY = mapHeight - 120; // Same as game.js
        
        // Convert hills to pairs of slopes and render them
        const allSlopes = [];
        hills.forEach(hill => {
            const hillTiles = hill.tiles || 2;
            const hillCapWidth = hill.width || 0;
            const slopeWidth = hillTiles * scaledTileSize;
            
            // Up-slope (right direction)
            allSlopes.push({
                x: hill.x,
                tiles: hillTiles,
                direction: 'right',
                width: hillCapWidth,
                isHillPart: true
            });
            
            // Down-slope (left direction)
            const downSlopeX = hill.x + slopeWidth + hillCapWidth;
            allSlopes.push({
                x: downSlopeX,
                tiles: hillTiles,
                direction: 'left',
                width: 0,
                isHillDownSlope: true
            });
        });
        
        // Render all slopes (including hill slopes)
        allSlopes.forEach((slope, slopeIndex) => {
            const sX = slope.x;
            const baseY = groundSurfaceY;
            const numTiles = slope.tiles || 2;
            const capWidth = slope.isHillDownSlope ? 0 : (slope.width || scaledTileSize);
            const numCapTiles = Math.ceil(capWidth / scaledTileSize);
            
            const slopeTile = tileSet.slope;
            const slopeEdgeTile = tileSet.slopeEdge;
            const groundTile = tileSet.ground;
            const groundEdgeTile = tileSet.groundEdge;
            const backgroundTile = tileSet.background;
            const backgroundEdgeTile = tileSet.backgroundEdge;
            
            if (tilesetImage && EditorData.isTilesetLoaded() && slopeTile) {
                // Render using tileset (matching game.js for hill slopes)
                if (slope.direction === 'left') {
                    if (slope.isHillDownSlope) {
                        // Hill down-slope: starts at peak, goes down to the right
                        for (let i = 0; i < numTiles; i++) {
                            const tileX = sX + (i * scaledTileSize);
                            const tileY = baseY - ((numTiles - i) * scaledTileSize);
                            
                            ctx.save();
                            ctx.translate(tileX + scaledTileSize, tileY);
                            ctx.scale(-1, 1);
                            ctx.drawImage(tilesetImage, slopeTile.x, slopeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                            ctx.restore();
                            
                            for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, tileX, fillY, scaledTileSize, scaledTileSize);
                            }
                            
                            if (i > 0) {
                                const edgeX = tileX - scaledTileSize;
                                ctx.save();
                                ctx.translate(edgeX + scaledTileSize, tileY);
                                ctx.scale(-1, 1);
                                ctx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                                ctx.restore();
                                
                                for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                    ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, edgeX, fillY, scaledTileSize, scaledTileSize);
                                }
                            }
                        }
                        
                        const bottomEdgeX = sX + ((numTiles - 1) * scaledTileSize);
                        ctx.save();
                        ctx.translate(bottomEdgeX + scaledTileSize, baseY);
                        ctx.scale(-1, 1);
                        ctx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                        ctx.restore();
                        for (let fillY = baseY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                            ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, bottomEdgeX, fillY, scaledTileSize, scaledTileSize);
                        }
                    } else {
                        // Regular left slope - cap on left
                        for (let i = 0; i < numTiles; i++) {
                            const tileX = sX + ((numTiles - 1 - i) * scaledTileSize);
                            const tileY = baseY - ((i + 1) * scaledTileSize);
                            
                            ctx.save();
                            ctx.translate(tileX + scaledTileSize, tileY);
                            ctx.scale(-1, 1);
                            ctx.drawImage(tilesetImage, slopeTile.x, slopeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                            ctx.restore();
                            
                            for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, tileX, fillY, scaledTileSize, scaledTileSize);
                            }
                            
                            if (i === numTiles - 1) {
                                const topY = tileY;
                                for (let c = 0; c < numCapTiles; c++) {
                                    const capX = tileX - ((c + 1) * scaledTileSize);
                                    if (c === 0 && groundEdgeTile) {
                                        ctx.save();
                                        ctx.translate(capX + scaledTileSize, topY);
                                        ctx.scale(-1, 1);
                                        ctx.drawImage(tilesetImage, groundEdgeTile.x, groundEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                                        ctx.restore();
                                    } else {
                                        ctx.drawImage(tilesetImage, groundTile.x, groundTile.y, tileSize, tileSize, capX, topY, scaledTileSize, scaledTileSize);
                                    }
                                    for (let fillY = topY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                        ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, capX, fillY, scaledTileSize, scaledTileSize);
                                    }
                                }
                            } else {
                                const edgeX = tileX + scaledTileSize;
                                ctx.save();
                                ctx.translate(edgeX + scaledTileSize, tileY);
                                ctx.scale(-1, 1);
                                ctx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                                ctx.restore();
                                
                                for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                    ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, edgeX, fillY, scaledTileSize, scaledTileSize);
                                }
                            }
                        }
                        
                        const bottomEdgeX = sX + ((numTiles - 1) * scaledTileSize);
                        ctx.save();
                        ctx.translate(bottomEdgeX + scaledTileSize, baseY);
                        ctx.scale(-1, 1);
                        ctx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                        ctx.restore();
                        for (let fillY = baseY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                            ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, bottomEdgeX, fillY, scaledTileSize, scaledTileSize);
                        }
                    }
                } else {
                    // Right slope
                    for (let i = 0; i < numTiles; i++) {
                        const tileX = sX + (i * scaledTileSize);
                        const tileY = baseY - ((i + 1) * scaledTileSize);
                        
                        ctx.drawImage(tilesetImage, slopeTile.x, slopeTile.y, tileSize, tileSize, tileX, tileY, scaledTileSize, scaledTileSize);
                        
                        for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                            ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, tileX, fillY, scaledTileSize, scaledTileSize);
                        }
                        
                        if (i === numTiles - 1) {
                            const topY = tileY;
                            const capStartX = tileX + scaledTileSize;
                            for (let c = 0; c < numCapTiles; c++) {
                                const capX = capStartX + (c * scaledTileSize);
                                const isLastCapTile = (c === numCapTiles - 1);
                                
                                if (isLastCapTile && groundEdgeTile && !slope.isHillPart) {
                                    ctx.save();
                                    ctx.translate(capX + scaledTileSize, topY);
                                    ctx.scale(-1, 1);
                                    ctx.drawImage(tilesetImage, groundEdgeTile.x, groundEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                                    ctx.restore();
                                    for (let fillY = topY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                        ctx.save();
                                        ctx.translate(capX + scaledTileSize, fillY);
                                        ctx.scale(-1, 1);
                                        ctx.drawImage(tilesetImage, backgroundEdgeTile.x, backgroundEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                                        ctx.restore();
                                    }
                                } else {
                                    ctx.drawImage(tilesetImage, groundTile.x, groundTile.y, tileSize, tileSize, capX, topY, scaledTileSize, scaledTileSize);
                                    for (let fillY = topY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                        ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, capX, fillY, scaledTileSize, scaledTileSize);
                                    }
                                }
                            }
                        } else {
                            const edgeX = tileX + scaledTileSize;
                            ctx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, edgeX, tileY, scaledTileSize, scaledTileSize);
                            
                            for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, edgeX, fillY, scaledTileSize, scaledTileSize);
                            }
                        }
                    }
                    
                    const bottomEdgeX = sX;
                    ctx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, bottomEdgeX, baseY, scaledTileSize, scaledTileSize);
                    for (let fillY = baseY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                        ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, bottomEdgeX, fillY, scaledTileSize, scaledTileSize);
                    }
                }
            } else {
                // Fallback
                const height = numTiles * scaledTileSize;
                const slopeWidth = numTiles * scaledTileSize + capWidth;
                
                ctx.fillStyle = '#5a8f5a';
                ctx.beginPath();
                if (slope.direction === 'right') {
                    ctx.moveTo(sX, baseY);
                    ctx.lineTo(sX + slopeWidth, baseY);
                    ctx.lineTo(sX + slopeWidth, baseY - height);
                } else {
                    ctx.moveTo(sX - capWidth, baseY - height);
                    ctx.lineTo(sX - capWidth, baseY);
                    ctx.lineTo(sX + (numTiles * scaledTileSize), baseY);
                }
                ctx.closePath();
                ctx.fill();
                
                ctx.strokeStyle = '#3d6b3d';
                ctx.lineWidth = 2 / this.zoom;
                ctx.stroke();
            }
        });
        
        // Show hill labels
        hills.forEach((hill, index) => {
            const hillTiles = hill.tiles || 2;
            const hillCapWidth = hill.width || 0;
            const slopeWidth = hillTiles * scaledTileSize;
            const totalWidth = slopeWidth + hillCapWidth + slopeWidth;
            const hillHeight = hillTiles * scaledTileSize;
            const peakX = hill.x + slopeWidth + hillCapWidth / 2;
            const peakY = groundSurfaceY - hillHeight;
            
            ctx.fillStyle = '#fff';
            ctx.font = `${10 / this.zoom}px Arial`;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3 / this.zoom;
            ctx.strokeText(`Hill ${index}`, peakX - 20, peakY - 5);
            ctx.fillText(`Hill ${index}`, peakX - 20, peakY - 5);
        });
    },
    
    renderSlopes(ctx, map) {
        const slopes = map.slopes || [];
        const tilesetImage = EditorData.getTilesetImage();
        const groundType = map.groundType || 'grass';
        const tileSet = EditorData.TILE_SETS[groundType] || EditorData.TILE_SETS.grass;
        const tileSize = EditorData.SPRITE_DATA.ground.tileSize;
        const scale = EditorData.PIXEL_ART_SCALE;
        const scaledTileSize = tileSize * scale;
        const mapHeight = map.height || 720;
        const groundSurfaceY = mapHeight - 120; // Same as game.js
        
        slopes.forEach((slope, index) => {
            const sX = slope.x;
            const baseY = groundSurfaceY;
            const numTiles = slope.tiles || 2;
            const capWidth = slope.width || scaledTileSize;
            const numCapTiles = Math.ceil(capWidth / scaledTileSize);
            
            const slopeTile = tileSet.slope;
            const slopeEdgeTile = tileSet.slopeEdge;
            const groundTile = tileSet.ground;
            const groundEdgeTile = tileSet.groundEdge;
            const backgroundTile = tileSet.background;
            const backgroundEdgeTile = tileSet.backgroundEdge;
            
            if (tilesetImage && EditorData.isTilesetLoaded() && slopeTile) {
                // Render using tileset (matching game.js exactly)
                if (slope.direction === 'left') {
                    // Regular left slope - cap on left, slope goes up to the left
                    //  G  G  G  S          <- ground cap + top slope
                    //           SE  S      <- edge + slope
                    //  G  G  G  G  SE  G   <- ground level
                    for (let i = 0; i < numTiles; i++) {
                        const tileX = sX + ((numTiles - 1 - i) * scaledTileSize);
                        const tileY = baseY - ((i + 1) * scaledTileSize);
                        
                        // Draw slope tile (flipped)
                        ctx.save();
                        ctx.translate(tileX + scaledTileSize, tileY);
                        ctx.scale(-1, 1);
                        ctx.drawImage(tilesetImage, slopeTile.x, slopeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                        ctx.restore();
                        
                        // Fill background below slope
                        for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                            ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, tileX, fillY, scaledTileSize, scaledTileSize);
                        }
                        
                        if (i === numTiles - 1) {
                            // Top slope: draw ground cap tiles to the LEFT
                            const topY = tileY;
                            for (let c = 0; c < numCapTiles; c++) {
                                const capX = tileX - ((c + 1) * scaledTileSize);
                                // Use edge tile for rightmost cap tile (connects to slope), ground for rest
                                if (c === 0 && groundEdgeTile) {
                                    // Flip the edge tile for left-facing slope
                                    ctx.save();
                                    ctx.translate(capX + scaledTileSize, topY);
                                    ctx.scale(-1, 1);
                                    ctx.drawImage(tilesetImage, groundEdgeTile.x, groundEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                                    ctx.restore();
                                } else {
                                    ctx.drawImage(tilesetImage, groundTile.x, groundTile.y, tileSize, tileSize, capX, topY, scaledTileSize, scaledTileSize);
                                }
                                for (let fillY = topY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                    ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, capX, fillY, scaledTileSize, scaledTileSize);
                                }
                            }
                        } else {
                            // Not top: draw slopeEdge to the RIGHT (flipped)
                            const edgeX = tileX + scaledTileSize;
                            ctx.save();
                            ctx.translate(edgeX + scaledTileSize, tileY);
                            ctx.scale(-1, 1);
                            ctx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                            ctx.restore();
                            
                            for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, edgeX, fillY, scaledTileSize, scaledTileSize);
                            }
                        }
                    }
                    
                    // Draw slopeEdge at ground level under the bottom slope (flipped)
                    const bottomEdgeX = sX + ((numTiles - 1) * scaledTileSize);
                    ctx.save();
                    ctx.translate(bottomEdgeX + scaledTileSize, baseY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                    ctx.restore();
                    for (let fillY = baseY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                        ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, bottomEdgeX, fillY, scaledTileSize, scaledTileSize);
                    }
                } else {
                    // Direction 'right' - slope goes up to the right
                    //     S  G  G  GE      <- top slope + ground tiles + groundEdge at end
                    //  S  SE               <- slope + slopeEdge
                    //  SE                  <- slopeEdge at ground level
                    for (let i = 0; i < numTiles; i++) {
                        const tileX = sX + (i * scaledTileSize);
                        const tileY = baseY - ((i + 1) * scaledTileSize);
                        
                        // Draw slope tile
                        ctx.drawImage(tilesetImage, slopeTile.x, slopeTile.y, tileSize, tileSize, tileX, tileY, scaledTileSize, scaledTileSize);
                        
                        // Fill background below slope
                        for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                            ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, tileX, fillY, scaledTileSize, scaledTileSize);
                        }
                        
                        if (i === numTiles - 1) {
                            // Top slope: draw ground cap tiles directly to the RIGHT
                            const topY = tileY;
                            const capStartX = tileX + scaledTileSize;
                            for (let c = 0; c < numCapTiles; c++) {
                                const capX = capStartX + (c * scaledTileSize);
                                const isLastCapTile = (c === numCapTiles - 1);
                                
                                if (isLastCapTile && groundEdgeTile) {
                                    // Last cap tile: use groundEdge (flipped)
                                    ctx.save();
                                    ctx.translate(capX + scaledTileSize, topY);
                                    ctx.scale(-1, 1);
                                    ctx.drawImage(tilesetImage, groundEdgeTile.x, groundEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                                    ctx.restore();
                                    // backgroundEdge below it (flipped)
                                    for (let fillY = topY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                        ctx.save();
                                        ctx.translate(capX + scaledTileSize, fillY);
                                        ctx.scale(-1, 1);
                                        ctx.drawImage(tilesetImage, backgroundEdgeTile.x, backgroundEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                                        ctx.restore();
                                    }
                                } else {
                                    // Regular ground tile
                                    ctx.drawImage(tilesetImage, groundTile.x, groundTile.y, tileSize, tileSize, capX, topY, scaledTileSize, scaledTileSize);
                                    for (let fillY = topY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                        ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, capX, fillY, scaledTileSize, scaledTileSize);
                                    }
                                }
                            }
                        } else {
                            // Not top: draw slopeEdge to the RIGHT
                            const edgeX = tileX + scaledTileSize;
                            ctx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, edgeX, tileY, scaledTileSize, scaledTileSize);
                            
                            for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, edgeX, fillY, scaledTileSize, scaledTileSize);
                            }
                        }
                    }
                    
                    // Draw slopeEdge at ground level directly under the bottom slope
                    const bottomEdgeX = sX;
                    ctx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, bottomEdgeX, baseY, scaledTileSize, scaledTileSize);
                    for (let fillY = baseY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                        ctx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, bottomEdgeX, fillY, scaledTileSize, scaledTileSize);
                    }
                }
            } else {
                // Fallback: Draw simple triangle
                const height = numTiles * scaledTileSize;
                const slopeWidth = numTiles * scaledTileSize + capWidth;
                
                ctx.fillStyle = '#5a8f5a';
                ctx.beginPath();
                if (slope.direction === 'right') {
                    ctx.moveTo(sX, baseY);
                    ctx.lineTo(sX + slopeWidth, baseY);
                    ctx.lineTo(sX + slopeWidth, baseY - height);
                } else {
                    ctx.moveTo(sX - capWidth, baseY - height);
                    ctx.lineTo(sX - capWidth, baseY);
                    ctx.lineTo(sX + (numTiles * scaledTileSize), baseY);
                }
                ctx.closePath();
                ctx.fill();
                
                ctx.strokeStyle = '#3d6b3d';
                ctx.lineWidth = 2 / this.zoom;
                ctx.stroke();
            }
            
            // Label
            ctx.fillStyle = '#fff';
            ctx.font = `${10 / this.zoom}px Arial`;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3 / this.zoom;
            const arrow = slope.direction === 'right' ? '↗' : '↖';
            ctx.strokeText(`Slope ${index} ${arrow} (${numTiles} tiles)`, sX + 5, baseY - 5);
            ctx.fillText(`Slope ${index} ${arrow} (${numTiles} tiles)`, sX + 5, baseY - 5);
        });
    },
    
    renderPlatforms(ctx, map) {
        const platforms = map.platforms || [];
        const tilesetImage = EditorData.getTilesetImage();
        const groundType = map.groundType || 'grass';
        const tileSet = EditorData.TILE_SETS[groundType] || EditorData.TILE_SETS.grass;
        const tileSize = EditorData.SPRITE_DATA.ground.tileSize;
        const scale = EditorData.PIXEL_ART_SCALE;
        const scaledTileSize = tileSize * scale;
        const offset = EditorData.GROUND_LEVEL_OFFSET; // -100
        
        platforms.forEach((platform, index) => {
            const x = platform.x;
            // Apply GROUND_LEVEL_OFFSET when rendering (same as game.js)
            const y = platform.y + offset;
            const width = platform.width;
            const numTilesWide = Math.max(1, Math.round(width / scaledTileSize));
            
            if (tilesetImage && EditorData.isTilesetLoaded()) {
                // Render using actual tileset
                if (numTilesWide === 1) {
                    // Single tile - just draw center
                    ctx.drawImage(
                        tilesetImage,
                        tileSet.platformCenter.x, tileSet.platformCenter.y,
                        tileSize, tileSize,
                        x, y,
                        scaledTileSize, scaledTileSize
                    );
                } else if (numTilesWide === 2) {
                    // Two tiles - left and right edges
                    ctx.drawImage(
                        tilesetImage,
                        tileSet.platformLeft.x, tileSet.platformLeft.y,
                        tileSize, tileSize,
                        x, y,
                        scaledTileSize, scaledTileSize
                    );
                    ctx.drawImage(
                        tilesetImage,
                        tileSet.platformRight.x, tileSet.platformRight.y,
                        tileSize, tileSize,
                        x + scaledTileSize, y,
                        scaledTileSize, scaledTileSize
                    );
                } else {
                    // Three or more tiles - left edge, centers, right edge
                    // Left edge
                    ctx.drawImage(
                        tilesetImage,
                        tileSet.platformLeft.x, tileSet.platformLeft.y,
                        tileSize, tileSize,
                        x, y,
                        scaledTileSize, scaledTileSize
                    );
                    // Center tiles
                    for (let i = 1; i < numTilesWide - 1; i++) {
                        ctx.drawImage(
                            tilesetImage,
                            tileSet.platformCenter.x, tileSet.platformCenter.y,
                            tileSize, tileSize,
                            x + (i * scaledTileSize), y,
                            scaledTileSize, scaledTileSize
                        );
                    }
                    // Right edge
                    ctx.drawImage(
                        tilesetImage,
                        tileSet.platformRight.x, tileSet.platformRight.y,
                        tileSize, tileSize,
                        x + ((numTilesWide - 1) * scaledTileSize), y,
                        scaledTileSize, scaledTileSize
                    );
                }
            } else {
                // Fallback: Simple rectangle (use scaledTileSize for consistency)
                ctx.fillStyle = platform.noSpawn ? 
                    EditorData.EDITOR_COLORS.platformNoSpawn : 
                    EditorData.EDITOR_COLORS.platform;
                ctx.fillRect(x, y, width, scaledTileSize);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1 / this.zoom;
                ctx.strokeRect(x, y, width, scaledTileSize);
            }
            
            // NoSpawn indicator
            if (platform.noSpawn) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                ctx.fillRect(x, y, width, scaledTileSize);
            }
            
            // Label
            ctx.fillStyle = '#fff';
            ctx.font = `${10 / this.zoom}px Arial`;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3 / this.zoom;
            const label = platform.noSpawn ? `P${index} (noSpawn)` : `P${index}`;
            ctx.strokeText(label, x + 2, y + 14);
            ctx.fillText(label, x + 2, y + 14);
        });
    },
    
    renderStructures(ctx, map) {
        const structures = map.structures || [];
        const tilesetImage = EditorData.getTilesetImage();
        const groundType = map.groundType || 'grass';
        const tileSet = EditorData.TILE_SETS[groundType] || EditorData.TILE_SETS.grass;
        const tileSize = EditorData.SPRITE_DATA.ground.tileSize;
        const scale = EditorData.PIXEL_ART_SCALE;
        const scaledTileSize = tileSize * scale;
        const mapHeight = map.height || 720;
        const offset = EditorData.GROUND_LEVEL_OFFSET; // -100
        
        // Sort structures by z-layer (background first, then normal, then foreground)
        const sortedStructures = [...structures].map((s, i) => ({ ...s, _index: i }));
        sortedStructures.sort((a, b) => (a.z || 0) - (b.z || 0));
        
        sortedStructures.forEach((structure) => {
            const index = structure._index;
            const x = Math.round(structure.x);
            // Apply GROUND_LEVEL_OFFSET when rendering (same as game.js)
            const y = Math.round(structure.y + offset);
            const width = structure.width;
            const numTilesWide = Math.max(1, Math.round(width / scaledTileSize));
            
            if (tilesetImage && EditorData.isTilesetLoaded()) {
                // Draw background column fill (like game does)
                const columnTopY = y + scaledTileSize;
                const columnBottomY = mapHeight;
                
                for (let currentY = columnTopY; currentY < columnBottomY; currentY += scaledTileSize) {
                    if (numTilesWide > 1) {
                        // Left edge
                        ctx.drawImage(
                            tilesetImage,
                            tileSet.backgroundEdge.x, tileSet.backgroundEdge.y,
                            tileSize, tileSize,
                            x, currentY,
                            scaledTileSize, scaledTileSize
                        );
                        // Center fill
                        for (let col = 1; col < numTilesWide - 1; col++) {
                            ctx.drawImage(
                                tilesetImage,
                                tileSet.background.x, tileSet.background.y,
                                tileSize, tileSize,
                                x + (col * scaledTileSize), currentY,
                                scaledTileSize, scaledTileSize
                            );
                        }
                        // Right edge (mirrored)
                        ctx.save();
                        ctx.translate(x + numTilesWide * scaledTileSize, currentY);
                        ctx.scale(-1, 1);
                        ctx.drawImage(
                            tilesetImage,
                            tileSet.backgroundEdge.x, tileSet.backgroundEdge.y,
                            tileSize, tileSize,
                            0, 0,
                            scaledTileSize, scaledTileSize
                        );
                        ctx.restore();
                    } else {
                        ctx.drawImage(
                            tilesetImage,
                            tileSet.background.x, tileSet.background.y,
                            tileSize, tileSize,
                            x, currentY,
                            scaledTileSize, scaledTileSize
                        );
                    }
                }
                
                // Draw top surface (like game does)
                if (numTilesWide > 1) {
                    // Left edge
                    ctx.drawImage(
                        tilesetImage,
                        tileSet.groundEdge.x, tileSet.groundEdge.y,
                        tileSize, tileSize,
                        x, y,
                        scaledTileSize, scaledTileSize
                    );
                    // Center fill
                    for (let i = 1; i < numTilesWide - 1; i++) {
                        ctx.drawImage(
                            tilesetImage,
                            tileSet.ground.x, tileSet.ground.y,
                            tileSize, tileSize,
                            x + (i * scaledTileSize), y,
                            scaledTileSize, scaledTileSize
                        );
                    }
                    // Right edge (mirrored)
                    ctx.save();
                    ctx.translate(x + numTilesWide * scaledTileSize, y);
                    ctx.scale(-1, 1);
                    ctx.drawImage(
                        tilesetImage,
                        tileSet.groundEdge.x, tileSet.groundEdge.y,
                        tileSize, tileSize,
                        0, 0,
                        scaledTileSize, scaledTileSize
                    );
                    ctx.restore();
                } else {
                    ctx.drawImage(
                        tilesetImage,
                        tileSet.ground.x, tileSet.ground.y,
                        tileSize, tileSize,
                        x, y,
                        scaledTileSize, scaledTileSize
                    );
                }
            } else {
                // Fallback: Simple rectangle
                ctx.fillStyle = EditorData.EDITOR_COLORS.structure;
                ctx.fillRect(x, y, width, EditorData.STRUCTURE_HEIGHT);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1 / this.zoom;
                ctx.strokeRect(x, y, width, EditorData.STRUCTURE_HEIGHT);
            }
            
            // Z-layer visual indicator
            const zLayer = structure.z || 0;
            if (zLayer !== 0) {
                // Draw z-layer badge
                const badgeX = x + width - 24;
                const badgeY = y + 4;
                const badgeColor = zLayer > 0 ? '#00aa00' : '#aa0000';
                const badgeText = zLayer > 0 ? 'FG' : 'BG';
                
                ctx.fillStyle = badgeColor;
                ctx.globalAlpha = 0.8;
                ctx.fillRect(badgeX, badgeY, 20, 14);
                ctx.globalAlpha = 1;
                
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${9 / this.zoom}px Arial`;
                ctx.fillText(badgeText, badgeX + 2, badgeY + 10);
                
                // Draw border tint based on z-layer
                ctx.strokeStyle = badgeColor;
                ctx.lineWidth = 3 / this.zoom;
                ctx.setLineDash([5, 3]);
                ctx.strokeRect(x, y, width, scaledTileSize);
                ctx.setLineDash([]);
            }
            
            // Label
            ctx.fillStyle = '#fff';
            ctx.font = `${10 / this.zoom}px Arial`;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3 / this.zoom;
            const zText = zLayer !== 0 ? ` z:${zLayer}` : '';
            ctx.strokeText(`S${index}${zText}`, x + 2, y + 14);
            ctx.fillText(`S${index}${zText}`, x + 2, y + 14);
        });
    },
    
    renderLadders(ctx, map) {
        const ladders = map.ladders || [];
        const ladderImage = EditorData.getLadderImage();
        const scale = EditorData.PIXEL_ART_SCALE;
        const tileSize = EditorData.LADDER_TILE_SIZE;
        const scaledTileSize = tileSize * scale;
        const offset = EditorData.GROUND_LEVEL_OFFSET;
        
        ladders.forEach((ladder, index) => {
            const x = ladder.x;
            // Apply vertical overlap like game.js does
            const verticalOverlap = 24;
            const y1 = ladder.y1 + offset - verticalOverlap;
            const y2 = ladder.y2 + offset;
            
            const ladderType = ladder.type || 'tiles';
            const ladderTiles = EditorData.LADDER_TYPES[ladderType] || EditorData.LADDER_TYPES.tiles;
            
            const useTileset = ladderImage && EditorData.isLadderLoaded() && ladderImage.complete && ladderImage.naturalWidth > 0;
            
            if (useTileset) {
                // Render using actual ladder tileset (like game.js)
                let isFirstPiece = true;
                for (let currentY = y1; currentY < y2; currentY += scaledTileSize) {
                    let tileToDraw;
                    let sourceTileHeight = tileSize;
                    let destTileHeight = scaledTileSize;
                    
                    if (currentY + scaledTileSize > y2) {
                        destTileHeight = y2 - currentY;
                        sourceTileHeight = (destTileHeight / scaledTileSize) * tileSize;
                        tileToDraw = ladderTiles.bottom;
                    } else if (isFirstPiece) {
                        tileToDraw = ladderTiles.top;
                        isFirstPiece = false;
                    } else {
                        tileToDraw = ladderTiles.middle;
                    }
                    
                    if (destTileHeight <= 0) continue;
                    
                    ctx.drawImage(
                        ladderImage,
                        tileToDraw.x, tileToDraw.y,
                        tileSize, sourceTileHeight,
                        x, currentY,
                        scaledTileSize, destTileHeight
                    );
                }
            } else {
                // Fallback rendering
                const width = scaledTileSize;
                ctx.fillStyle = EditorData.EDITOR_COLORS.ladder;
                ctx.globalAlpha = 0.5;
                ctx.fillRect(x, y1, width, y2 - y1);
                ctx.globalAlpha = 1;
                
                ctx.strokeStyle = '#B8860B';
                ctx.lineWidth = 2 / this.zoom;
                ctx.strokeRect(x, y1, width, y2 - y1);
                
                const rungSpacing = 20;
                ctx.strokeStyle = '#8B6914';
                for (let y = y1 + rungSpacing; y < y2; y += rungSpacing) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + width, y);
                    ctx.stroke();
                }
            }
            
            // Label with ladder type
            ctx.fillStyle = '#fff';
            ctx.font = `${10 / this.zoom}px Arial`;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3 / this.zoom;
            const typeName = ladderTiles.name || ladderType;
            ctx.strokeText(`L${index} (${typeName})`, x + 2, y1 - 5);
            ctx.fillText(`L${index} (${typeName})`, x + 2, y1 - 5);
        });
    },
    
    renderPortals(ctx, map) {
        const portals = map.portals || [];
        const height = map.height || 720;
        const groundY = height - 120;
        
        const portalImage = EditorData.getPortalImage();
        const portalLoaded = EditorData.isPortalLoaded();
        
        // Portal sprite data from data.js
        const portalSpriteData = {
            frameWidth: 24,
            frameHeight: 32,
            yOffset: -5
        };
        
        const scaledWidth = portalSpriteData.frameWidth * EditorData.PIXEL_ART_SCALE;
        const scaledHeight = portalSpriteData.frameHeight * EditorData.PIXEL_ART_SCALE;
        
        portals.forEach((portal, index) => {
            const x = portal.x;
            // Portal Y: if specified use it, otherwise place on ground
            const y = portal.y !== undefined ? portal.y : groundY - scaledHeight;
            
            if (portalImage && portalLoaded) {
                // Draw portal sprite (first frame)
                ctx.drawImage(
                    portalImage,
                    0, 0,  // Source x, y (first frame)
                    portalSpriteData.frameWidth, portalSpriteData.frameHeight,  // Source size
                    x, y,  // Destination x, y
                    scaledWidth, scaledHeight  // Scaled destination size
                );
            } else {
                // Fallback: Draw placeholder ellipse
                const width = EditorData.PORTAL_WIDTH;
                const portalHeight = EditorData.PORTAL_HEIGHT;
                
                // Portal glow
                ctx.fillStyle = EditorData.EDITOR_COLORS.portal;
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.ellipse(x + width/2, y + portalHeight/2, width/2 + 10, portalHeight/2 + 10, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                
                // Portal body
                ctx.fillStyle = EditorData.EDITOR_COLORS.portal;
                ctx.beginPath();
                ctx.ellipse(x + width/2, y + portalHeight/2, width/2, portalHeight/2, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Portal border
                ctx.strokeStyle = '#0080FF';
                ctx.lineWidth = 2 / this.zoom;
                ctx.beginPath();
                ctx.ellipse(x + width/2, y + portalHeight/2, width/2, portalHeight/2, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            // Label with target
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${10 / this.zoom}px Arial`;
            ctx.fillText(`→ ${portal.targetMap}`, x, y - 5);
        });
        
        // Draw connection lines between portals
        this.renderPortalConnections(ctx, map, portals, groundY);
    },
    
    renderPortalConnections(ctx, map, portals, groundY) {
        ctx.strokeStyle = EditorData.EDITOR_COLORS.portalConnection;
        ctx.lineWidth = 2 / this.zoom;
        ctx.setLineDash([5, 5]);
        
        portals.forEach((portal) => {
            // Find matching portal in target map (if it's the same map)
            if (portal.targetMap === this.currentMapId) {
                const targetX = portal.targetX;
                const startX = portal.x + EditorData.PORTAL_WIDTH / 2;
                const startY = (portal.y !== undefined ? portal.y : groundY - EditorData.PORTAL_HEIGHT) + EditorData.PORTAL_HEIGHT / 2;
                
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(targetX, startY);
                ctx.stroke();
            }
        });
        
        ctx.setLineDash([]);
    },
    
    renderNPCs(ctx, map) {
        const npcs = map.npcs || [];
        const height = map.height || 720;
        const groundY = height - 120;
        
        npcs.forEach((npc, index) => {
            const x = npc.x;
            // NPC Y: if specified use it, otherwise place on ground
            const y = npc.y !== undefined ? npc.y : groundY - EditorData.NPC_HEIGHT;
            const width = EditorData.NPC_WIDTH;
            const npcHeight = EditorData.NPC_HEIGHT;
            
            // NPC body
            ctx.fillStyle = EditorData.EDITOR_COLORS.npc;
            ctx.fillRect(x, y, width, npcHeight);
            
            // NPC border
            ctx.strokeStyle = '#B8860B';
            ctx.lineWidth = 2 / this.zoom;
            ctx.strokeRect(x, y, width, npcHeight);
            
            // NPC name
            const npcData = EditorData.NPC_TYPES[npc.type];
            const name = npcData ? npcData.name : npc.type;
            
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${10 / this.zoom}px Arial`;
            ctx.fillText(name, x, y - 5);
        });
    },
    
    renderMonsters(ctx, map) {
        const monsters = map.monsters || [];
        const height = map.height || 720;
        const groundY = height - 120;
        
        monsters.forEach((spawn, index) => {
            const monsterData = EditorData.MONSTER_TYPES[spawn.type];
            if (!monsterData) return;
            
            // If fixedPosition, show at specified location
            // Otherwise show a spawn zone indicator
            if (spawn.fixedPosition && spawn.x !== undefined) {
                const x = spawn.x;
                const y = groundY - monsterData.height;
                
                // Monster body
                ctx.fillStyle = monsterData.isMiniBoss ? '#FF0000' : EditorData.EDITOR_COLORS.monster;
                ctx.fillRect(x, y, monsterData.width, monsterData.height);
                
                // Monster border
                ctx.strokeStyle = '#8B0000';
                ctx.lineWidth = 2 / this.zoom;
                ctx.strokeRect(x, y, monsterData.width, monsterData.height);
                
                // Label
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${10 / this.zoom}px Arial`;
                ctx.fillText(`${monsterData.name} x${spawn.count || 1}`, x, y - 5);
            } else {
                // Show as spawn zone (full width indicator at top)
                ctx.fillStyle = EditorData.EDITOR_COLORS.monster;
                ctx.globalAlpha = 0.2;
                ctx.fillRect(0, 10 + index * 25, map.width, 20);
                ctx.globalAlpha = 1;
                
                // Label
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${12 / this.zoom}px Arial`;
                ctx.fillText(`🔴 ${monsterData.name} x${spawn.count || 1} (Lv.${monsterData.level})`, 10, 25 + index * 25);
            }
        });
    },
    
    renderSelection(ctx) {
        if (!this.selectedObject) return;
        
        const obj = this.selectedObject;
        const mapHeight = this.currentMap.height || 720;
        const groundY = mapHeight - 120;
        const offset = EditorData.GROUND_LEVEL_OFFSET;
        const scaledTileSize = EditorData.SPRITE_DATA.ground.tileSize * EditorData.PIXEL_ART_SCALE;
        let x, y, width, height;
        
        // Determine bounds based on object type (uses _type from getObjectAtPoint)
        // NOTE: platforms and structures use GROUND_LEVEL_OFFSET for rendering
        switch (obj._type) {
            case 'platform':
                x = obj.x;
                y = obj.y + offset;  // Apply offset to match render position
                width = obj.width;
                height = scaledTileSize;
                break;
            case 'structure':
                x = obj.x;
                y = obj.y + offset;  // Apply offset to match render position
                width = obj.width;
                height = scaledTileSize;  // Use tile size for structure height too
                break;
            case 'portal':
                // Portal sprite dimensions: 24x32 * PIXEL_ART_SCALE
                const portalW = 24 * EditorData.PIXEL_ART_SCALE;
                const portalH = 32 * EditorData.PIXEL_ART_SCALE;
                x = obj.x;
                y = obj.y !== undefined ? obj.y : groundY - portalH;
                width = portalW;
                height = portalH;
                break;
            case 'npc':
                x = obj.x;
                y = obj.y !== undefined ? obj.y : groundY - EditorData.NPC_HEIGHT;
                width = EditorData.NPC_WIDTH;
                height = EditorData.NPC_HEIGHT;
                break;
            case 'monster':
                const monsterInfo = EditorData.MONSTER_TYPES[obj.type] || { width: 48, height: 48 };
                x = obj.x - monsterInfo.width / 2;
                y = (obj.y !== undefined ? obj.y : groundY) - monsterInfo.height;
                width = monsterInfo.width;
                height = monsterInfo.height;
                break;
            case 'ladder':
                // Ladder width is 16px * PIXEL_ART_SCALE = 48
                const ladderWidth = EditorData.LADDER_TILE_SIZE * EditorData.PIXEL_ART_SCALE;
                const verticalOverlap = 24;
                x = obj.x;
                y = obj.y1 + offset - verticalOverlap;
                width = ladderWidth;
                height = (obj.y2 + offset) - y;
                break;
            case 'hill':
                // Hills use tiles count - calculate visual bounds
                const hillTiles2 = obj.tiles || 2;
                const hillCapWidth2 = obj.width || 0;
                const hillHeight2 = hillTiles2 * scaledTileSize;
                const hillTotalWidth2 = (hillTiles2 * scaledTileSize) + hillCapWidth2 + (hillTiles2 * scaledTileSize);
                x = obj.x;
                y = groundY - hillHeight2;
                width = hillTotalWidth2;
                height = hillHeight2;
                break;
            case 'slope':
                // Slopes use tiles count - calculate visual bounds
                const slopeTiles = obj.tiles || 2;
                const slopeHeight = slopeTiles * scaledTileSize;
                const slopeCapWidth = obj.width || scaledTileSize;
                x = obj.x;
                y = groundY - slopeHeight;
                // Total width = cap width + slope tiles width
                width = slopeCapWidth + slopeTiles * scaledTileSize;
                height = slopeHeight;
                break;
            default:
                return;
        }
        
        // Selection highlight
        ctx.strokeStyle = EditorData.EDITOR_COLORS.selection;
        ctx.lineWidth = 3 / this.zoom;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
        ctx.setLineDash([]);
        
        // Selection fill
        ctx.fillStyle = EditorData.EDITOR_COLORS.selectionFill;
        ctx.fillRect(x, y, width, height);
        
        // Selection handles for resizing (corners) - show for resizable objects
        const handleSize = 10 / this.zoom;
        const type = obj._type;
        const isResizable = type === 'platform' || type === 'structure' || type === 'hill' || type === 'slope' || type === 'ladder';
        
        if (isResizable) {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = EditorData.EDITOR_COLORS.selection;
            ctx.lineWidth = 2 / this.zoom;
            
            // Corner handles
            // Top-left
            ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
            ctx.strokeRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
            // Top-right
            ctx.fillRect(x + width - handleSize/2, y - handleSize/2, handleSize, handleSize);
            ctx.strokeRect(x + width - handleSize/2, y - handleSize/2, handleSize, handleSize);
            // Bottom-left
            ctx.fillRect(x - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
            ctx.strokeRect(x - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
            // Bottom-right
            ctx.fillRect(x + width - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
            ctx.strokeRect(x + width - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
            
            // Edge handles for width resize (platforms, structures)
            if (type === 'platform' || type === 'structure' || type === 'hill' || type === 'slope') {
                // Left edge
                ctx.fillRect(x - handleSize/2, y + height/2 - handleSize/2, handleSize, handleSize);
                ctx.strokeRect(x - handleSize/2, y + height/2 - handleSize/2, handleSize, handleSize);
                // Right edge
                ctx.fillRect(x + width - handleSize/2, y + height/2 - handleSize/2, handleSize, handleSize);
                ctx.strokeRect(x + width - handleSize/2, y + height/2 - handleSize/2, handleSize, handleSize);
            }
            
            // Top/bottom edge handles for hills and slopes
            if (type === 'hill' || type === 'slope') {
                // Top edge
                ctx.fillRect(x + width/2 - handleSize/2, y - handleSize/2, handleSize, handleSize);
                ctx.strokeRect(x + width/2 - handleSize/2, y - handleSize/2, handleSize, handleSize);
                // Bottom edge
                ctx.fillRect(x + width/2 - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
                ctx.strokeRect(x + width/2 - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
            }
        }
    },
    
    renderMinimap() {
        if (!this.minimapCtx || !this.currentMap) return;
        
        const ctx = this.minimapCtx;
        const map = this.currentMap;
        const canvas = this.minimapCanvas;
        
        // Clear
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate scale to fit map in minimap
        const scaleX = canvas.width / map.width;
        const scaleY = canvas.height / (map.height || 720);
        const scale = Math.min(scaleX, scaleY);
        
        // Draw map background
        ctx.fillStyle = map.backgroundColor || '#87CEEB';
        ctx.fillRect(0, 0, map.width * scale, (map.height || 720) * scale);
        
        // Draw ground
        const groundY = (map.height || 720) - 120;
        ctx.fillStyle = '#4a8c4a';
        ctx.fillRect(0, groundY * scale, map.width * scale, 120 * scale);
        
        // Draw platforms
        ctx.fillStyle = '#7d6a5a';
        (map.platforms || []).forEach(p => {
            ctx.fillRect(p.x * scale, p.y * scale, p.width * scale, 4);
        });
        
        // Draw structures
        ctx.fillStyle = '#8B4513';
        (map.structures || []).forEach(s => {
            ctx.fillRect(s.x * scale, s.y * scale, s.width * scale, 8);
        });
        
        // Draw viewport rectangle
        const viewLeft = -this.offsetX / this.zoom;
        const viewTop = -this.offsetY / this.zoom;
        const viewWidth = this.canvas.width / this.zoom;
        const viewHeight = this.canvas.height / this.zoom;
        
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            viewLeft * scale,
            viewTop * scale,
            viewWidth * scale,
            viewHeight * scale
        );
    }
});
