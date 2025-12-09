// ghostPlayers.js - Ghost NPCs that simulate player activity

let ghostPlayers = [];

// Debug logging system
const ghostDebug = {
    enabled: false, // Set to true to enable debug logging
    logs: [],
    maxLogs: 200,
    
    log(ghostId, message, data = {}) {
        if (!this.enabled) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            time: timestamp,
            ghostId,
            message,
            data,
            fullMessage: `[${timestamp}] Ghost ${ghostId}: ${message} ${JSON.stringify(data)}`
        };
        
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        console.log(`%c[GHOST ${ghostId}]%c ${message}`, 
            'color: #00ff00; font-weight: bold', 
            'color: #ffffff', 
            data);
    },
    
    getRecentLogs(count = 50) {
        return this.logs.slice(-count).map(l => l.fullMessage).join('\n');
    },
    
    copyLogsToClipboard() {
        const logText = this.getRecentLogs(100);
        navigator.clipboard.writeText(logText).then(() => {
            console.log('%cGhost debug logs copied to clipboard!', 'color: #00ff00; font-weight: bold; font-size: var(--font-small);');
        });
    },
    
    clear() {
        this.logs = [];
        console.log('%cGhost debug logs cleared!', 'color: #ffaa00; font-weight: bold');
    }
};

// Expose to console for easy access
window.ghostDebug = ghostDebug;

// Random phrases that ghosts can say
const ghostPhrases = [
    "Welcome to BennSauce!",
    "This game is amazing!",
    "Anyone up for boss hunting?",
    "Love the retro vibes!",
    "Just hit level 30!",
    "Where can I find enhancement scrolls?",
    "This music is fire 🔥",
    "Grinding for that sweet loot!",
    "This brings back memories!",
    "Epic game!",
    "Time to farm some slimes!",
    "Pro tip: enhance your gear!",
    "The nostalgia is real!",
    "Just found a rare drop!",
    "LFG boss run!",
    "GG everyone!",
    "This is so addicting!",
    "Who wants to party?",
    "Check out my gear!",
    "Level up hype!",
    "I love jump quests!",
    "Grinding never felt so good!",
    "Best game ever!",
    "Can't stop playing!",
    "When's the patch coming out?",
    "Patch Check",
    "Beta Check",
    "Alpha Check",
    "SAUUUUUUUUUCE!",
    "I hear there's a secret boss...",
    "Anyone want to trade items?",
    "Looking for a guild!",
    "I heard that Yeti has some powerful loot.",
    "My bestiary is filling up fast!",
];

// Random names for ghost players
const ghostNames = [
    "xXShadowXx", "l33tN00b", "DarkSlayer420",
    "llDarkKnightll", "Xx_Pro_xX", "SilentAssassin", "D3m0nb0i",
    "MagicGirl", "LuckyThief", "NinjaWarrior", "HolyPriest",
    "DragonSlayer", "IceWizard", "FireMage", "ThunderBolt",
    "SwiftArcher", "SneakyRogue", "BraveHero", "CutiePatootie",
    "GamerGod", "PixelHunter", "RetroGamer",
    "xXxDarkxXx", "ProPlayer123", "N00bMaster",
    "Tiger","Suuushi","curryishott","Bushido", "Pizza", "neophyte",
    "OldAndLame", "Herb", "Bane", "MrSalami", "Kromp", "FangBlade",
    "ShadowWalker", "LunarEclipse", "StarGazer", "NightStalker",
    "GhostRider", "PhantomThief", "SilverArrow", "CrimsonMage",
    "Panda", "Dragonfly", "WolfPack", "IronFist", "GoldenEye",

];

// Random classes
const ghostClasses = ['warrior', 'magician', 'bowman', 'thief', 'pirate'];

/**
 * Creates a new ghost player NPC
 */
function createGhostPlayer(x, y, mapId) {
    const ghostClass = ghostClasses[Math.floor(Math.random() * ghostClasses.length)];
    const ghostName = ghostNames[Math.floor(Math.random() * ghostNames.length)] + Math.floor(Math.random() * 100);
    
    // Random appearance
    const appearance = {
        hairStyle: Math.floor(Math.random() * 6),
        hairColor: Math.floor(Math.random() * 8),
        eyeColor: Math.floor(Math.random() * 6),
        skinTone: Math.floor(Math.random() * 4)
    };

    // Random equipment (varied items)
    const shirts = ['White T-shirt', 'Yellow T-shirt', 'Grey T-shirt', 'Red T-shirt'];
    const pants = ['Blue Jeans', 'Blue Jean Shorts', 'Brown Pants', 'Brown Shorts'];
    const shoes = ['Red Sneakers', 'Pink Sneakers', 'Black Leather Boots', 'Brown Leather Boots'];
    const helmets = [null, null, 'Leather Cap', 'Purple Bandana', 'Pink Bandana'];
    const weapons = [null, 'Dull Sword', 'Iron Sword', 'Iron Dagger', 'Wooden Bow'];
    const gloves = [null, null, 'Work Gloves', 'Red Work Gloves'];
    const capes = [null, null, null, 'Old Raggedy Cape'];
    
    const equippedItems = {
        weapon: weapons[Math.floor(Math.random() * weapons.length)],
        helmet: helmets[Math.floor(Math.random() * helmets.length)],
        top: shirts[Math.floor(Math.random() * shirts.length)],
        bottom: pants[Math.floor(Math.random() * pants.length)],
        shoes: shoes[Math.floor(Math.random() * shoes.length)],
        gloves: gloves[Math.floor(Math.random() * gloves.length)],
        cape: capes[Math.floor(Math.random() * capes.length)],
        face: null,
        eye: null
    };

    // Create DOM element
    const el = document.createElement('div');
    el.className = 'ghost-player';
    el.id = `ghost-${Date.now()}-${Math.random()}`;
    el.style.position = 'absolute';
    el.style.width = '60px';
    el.style.height = '60px';
    el.style.pointerEvents = 'none'; // Don't interfere with clicks
    el.style.zIndex = '9';

    // Create chat bubble element (hidden by default, same as player)
    const chatBubble = document.createElement('div');
    chatBubble.className = 'ghost-chat-bubble';
    el.appendChild(chatBubble);

    // Create nameplate (below, like player)
    const nameplate = document.createElement('div');
    nameplate.className = 'ghost-nameplate';
    nameplate.textContent = ghostName;
    el.appendChild(nameplate);

    const ghost = {
        id: el.id,
        element: el,
        nameplate: nameplate,
        chatBubble: chatBubble,
        name: ghostName,
        class: ghostClass,
        appearance: appearance,
        customization: appearance, // Also set as customization for compatibility
        equipped: equippedItems,
        x: x,
        y: y,
        width: 30,
        height: 60,
        velocityX: 0,
        velocityY: 0,
        direction: Math.random() < 0.5 ? 1 : -1,
        facing: Math.random() < 0.5 ? 'left' : 'right',
        state: 'idle',
        animationState: 'idle',
        stateTimer: Math.random() * 180 + 120,
        animationFrame: 0,
        animationTimer: 0,
        onPlatform: null,
        isJumping: false,
        onLadder: false,
        currentLadder: null,
        mapId: mapId,
        lastChatTime: Date.now(), // Start with current time so they don't chat immediately
        nextChatTime: Math.random() * 30000 + 30000, // Chat every 30-60 seconds
        targetMonster: null,
        attackCooldown: 0,
        lootCooldown: 0,
        isBlinking: false,
        blinkTimer: Math.floor(Math.random() * 300) + 180, // Random initial blink timer
        blinkDurationTimer: 0
    };

    worldContent.appendChild(el);
    ghostPlayers.push(ghost);
    
    if (ghostDebug.enabled) {
        ghostDebug.log(ghost.id, 'Ghost created', {
            name: ghostName,
            x: x.toFixed(0),
            y: y.toFixed(0)
        });
    }
    
    return ghost;
}

/**
 * Checks if ghost players are enabled
 */
function areGhostPlayersEnabled() {
    const savedPref = localStorage.getItem('evergreenRPG_ghostPlayersEnabled');
    return savedPref === 'true'; // Default to disabled
}

// Trial maps where ghost players should not spawn (solo content)
const noGhostMaps = [
    'trialFighter', 'trialSpearman', 'trialCleric', 'trialWizard',
    'trialHunter', 'trialCrossbowman', 'trialAssassin', 'trialBandit',
    'trialBrawler', 'trialGunslinger'
];

/**
 * Spawns ghost players on the current map
 */
function spawnGhostPlayersOnMap() {
    if (!areGhostPlayersEnabled()) return;
    
    const map = maps[currentMapId];
    if (!map) return;
    
    // Don't spawn ghosts in trial maps (solo content)
    if (noGhostMaps.includes(currentMapId)) return;

    // Spawn 1-3 ghosts per map
    const ghostCount = Math.floor(Math.random() * 3) + 1;
    const scaledTileSize = 16 * PIXEL_ART_SCALE;
    
    for (let i = 0; i < ghostCount; i++) {
        // Random spawn position
        const spawnX = Math.random() * (map.width - 100) + 50;
        const baseGroundLevel = (map.height || scalingContainer.clientHeight) - GAME_CONFIG.GROUND_Y;
        
        // Check for slope/hill at spawn position and adjust Y accordingly
        const slopeSurfaceY = typeof getSlopeSurfaceY === 'function' 
            ? getSlopeSurfaceY(spawnX, map, baseGroundLevel, scaledTileSize) 
            : null;
        
        const groundLevel = slopeSurfaceY !== null ? slopeSurfaceY : baseGroundLevel;
        const spawnY = groundLevel - 60;
        
        createGhostPlayer(spawnX, spawnY, currentMapId);
    }
}

/**
 * Updates all ghost players
 */
function updateGhostPlayers() {
    if (!areGhostPlayersEnabled()) {
        // If disabled, cleanup any remaining ghosts
        if (ghostPlayers.length > 0) {
            cleanupGhostPlayers();
        }
        return;
    }
    
    const map = maps[currentMapId];
    const now = Date.now();

    // Remove ghosts that have traveled to other maps
    ghostPlayers = ghostPlayers.filter(ghost => {
        if (ghost.mapId !== currentMapId) {
            if (ghost.el && ghost.el.parentNode) {
                ghost.el.parentNode.removeChild(ghost.el);
            }
            return false;
        }
        return true;
    });

    ghostPlayers.forEach(ghost => {
        // Update blink animation
        const BLINK_INTERVAL_MIN = 180, BLINK_INTERVAL_MAX = 480, BLINK_DURATION = 8;
        if (ghost.isBlinking) {
            if (--ghost.blinkDurationTimer <= 0) ghost.isBlinking = false;
        } else {
            if (--ghost.blinkTimer <= 0) {
                ghost.isBlinking = true;
                ghost.blinkDurationTimer = BLINK_DURATION;
                ghost.blinkTimer = Math.floor(Math.random() * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN + 1)) + BLINK_INTERVAL_MIN;
            }
        }
        
        // Update AI state
        ghost.stateTimer--;
        
        if (ghost.stateTimer <= 0) {
            // Simple state changes - mostly idle, occasionally walk
            const rand = Math.random();
            
            if (rand < 0.6) {
                // Mostly stay idle
                ghost.state = 'idle';
                ghost.stateTimer = Math.random() * 300 + 180; // Longer idle times
            } else {
                // Occasionally walk a bit
                ghost.state = 'walking';
                ghost.direction = Math.random() < 0.5 ? 1 : -1;
                // Update facing immediately to prevent single-frame flicker
                ghost.facing = ghost.direction === 1 ? 'right' : 'left';
                ghost.stateTimer = Math.random() * 60 + 30; // Short walk times
            }
        }

        // Execute state behavior
        switch (ghost.state) {
            case 'walking':
                // Just walk slowly
                ghost.velocityX = ghost.direction * 1.5;
                break;
            case 'idle':
                // Explicitly stop horizontal movement to prevent drift/flicker
                ghost.velocityX = 0;
                break;
        }

        // Apply physics
        ghost.x += ghost.velocityX;
        ghost.velocityX *= 0.85; // Friction
        ghost.velocityY += GRAVITY;
        ghost.y += ghost.velocityY;

        // Map boundaries
        if (ghost.x < 0) {
            ghost.x = 0;
            ghost.direction = 1;
            ghost.facing = 'right';
        }
        if (ghost.x + ghost.width > map.width) {
            ghost.x = map.width - ghost.width;
            ghost.direction = -1;
            ghost.facing = 'left';
        }

        // Ground collision
        const groundLevel = (map.height || scalingContainer.clientHeight) - GAME_CONFIG.GROUND_Y;
        let onAnySurface = false;
        
        // Use anchor point like monsters do (feet position)
        const anchorY = 55; // Player height when standing (matching monsters' anchorY system)

        // Platform collision
        platforms.forEach(p => {
            if (p.isLadder || p.y === undefined) return;
            if (isColliding(ghost, p) && ghost.velocityY >= 0 && (ghost.y - ghost.velocityY + anchorY) <= p.y) {
                ghost.y = p.y - anchorY;
                ghost.velocityY = 0;
                ghost.isJumping = false;
                onAnySurface = true;
            }
        });

        // Ground collision with slope support
        const ghostCenterX = ghost.x + ghost.width / 2;
        const slopeSurfaceY = getSlopeSurfaceY(ghostCenterX, map, groundLevel, 48);
        const ghostBottom = ghost.y + anchorY;
        const distanceToSlope = ghostBottom - slopeSurfaceY;
        // Snap to slope if close enough (above or below)
        if (!onAnySurface && distanceToSlope >= -50 && distanceToSlope <= 100) {
            ghost.y = slopeSurfaceY - anchorY;
            ghost.velocityY = 0;
            ghost.isJumping = false;
        }

        // Occasional small jump (very rare)
        if (!ghost.isJumping && Math.random() < 0.002) {
            ghost.velocityY = -8;
            ghost.isJumping = true;
        }

        // Random chatting (very rare)
        if (now - ghost.lastChatTime > ghost.nextChatTime) {
            showGhostChat(ghost);
            ghost.lastChatTime = now;
            ghost.nextChatTime = Math.random() * 60000 + 60000; // 60-120 seconds (less frequent)
        }

        // Update animation
        updateGhostAnimation(ghost);

        // Update visual position (don't flip the entire element, let canvas handle flipping)
        ghost.element.style.left = `${ghost.x}px`;
        ghost.element.style.top = `${ghost.y}px`;
    });
}

/**
 * Finds the nearest monster to a ghost
 */
function findNearestMonster(ghost) {
    let nearest = null;
    let minDist = Infinity;
    let checkedCount = 0;
    let aliveCount = 0;

    monsters.forEach(m => {
        checkedCount++;
        if (m.isDead) return;
        aliveCount++;
        
        const dist = Math.hypot(m.x - ghost.x, m.y - ghost.y);
        if (dist < minDist && dist < 200) {
            minDist = dist;
            nearest = m;
        }
    });

    if (checkedCount > 0 && !nearest) {
        ghostDebug.log(ghost.id, 'No monster found in range', {
            totalMonsters: checkedCount,
            aliveMonsters: aliveCount,
            searchRange: 200
        });
    }

    return nearest;
}

/**
 * Finds a nearby ladder for the ghost to climb
 */
function findNearbyLadder(ghost) {
    let closestLadder = null;
    let minDist = Infinity;

    platforms.forEach(p => {
        if (!p.isLadder) return;
        
        // Check if ghost is horizontally close to ladder
        const ghostCenterX = ghost.x + ghost.width / 2;
        const ladderCenterX = p.x + (p.width || 30) / 2;
        const horizontalDist = Math.abs(ghostCenterX - ladderCenterX);
        
        // Check if ghost is within ladder's vertical range
        const ghostBottomY = ghost.y + ghost.height;
        const isInVerticalRange = ghostBottomY >= p.y1 - 50 && ghost.y <= p.y2 + 50;
        
        if (horizontalDist < 40 && isInVerticalRange) {
            const dist = horizontalDist + Math.abs(ghost.y - p.y1);
            if (dist < minDist) {
                minDist = dist;
                closestLadder = p;
            }
        }
    });

    return closestLadder;
}

/**
 * Creates a visual attack effect for ghost players
 */
function createGhostAttackEffect(ghost) {
    const attackEl = document.createElement('div');
    attackEl.className = 'ghost-attack-effect';
    attackEl.style.position = 'absolute';
    attackEl.style.left = `${ghost.x + (ghost.direction === 1 ? ghost.width : -20)}px`;
    attackEl.style.top = `${ghost.y + 20}px`;
    attackEl.style.width = '20px';
    attackEl.style.height = '20px';
    attackEl.style.background = 'radial-gradient(circle, rgba(255,255,100,0.8), transparent)';
    attackEl.style.borderRadius = '50%';
    attackEl.style.pointerEvents = 'none';
    attackEl.style.zIndex = '15';
    
    worldContent.appendChild(attackEl);
    
    setTimeout(() => {
        attackEl.remove();
    }, 200);
}

/**
 * Creates a visual loot effect for ghost players
 */
function createGhostLootEffect(ghost, item) {
    const lootEl = document.createElement('div');
    lootEl.textContent = '+';
    lootEl.style.position = 'absolute';
    lootEl.style.left = `${item.x}px`;
    lootEl.style.top = `${item.y}px`;
    lootEl.style.color = '#00ff00';
    lootEl.style.fontSize = '16px';
    lootEl.style.fontWeight = 'bold';
    lootEl.style.pointerEvents = 'none';
    lootEl.style.zIndex = '20';
    lootEl.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    
    worldContent.appendChild(lootEl);
    
    // Animate upward
    let y = item.y;
    const interval = setInterval(() => {
        y -= 2;
        lootEl.style.top = `${y}px`;
        lootEl.style.opacity = parseFloat(lootEl.style.opacity || 1) - 0.05;
    }, 16);
    
    setTimeout(() => {
        clearInterval(interval);
        lootEl.remove();
    }, 500);
}

/**
 * Shows a chat bubble above a ghost player and adds to chat log
 */
function showGhostChat(ghost, message = null) {
    const phrase = message || ghostPhrases[Math.floor(Math.random() * ghostPhrases.length)];
    // Replace any newlines/breaks with spaces to ensure single-line text
    const cleanPhrase = phrase.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    ghost.chatBubble.innerHTML = `<span style="white-space: nowrap; display: inline;">${cleanPhrase}</span>`;
    ghost.chatBubble.style.display = 'block';
    ghost.chatMessage = cleanPhrase;
    
    // Add to chat log
    if (typeof addChatMessage === 'function') {
        addChatMessage(`${ghost.name}: ${cleanPhrase}`, 'ghost');
    }
    
    setTimeout(() => {
        ghost.chatBubble.style.display = 'none';
        ghost.chatMessage = null;
    }, 3000);
}

/**
 * Makes ghosts on the current map say "Gz!" or "Grats!" when player levels up
 */
function ghostsCongratsPlayer() {
    if (!ghostPlayers || ghostPlayers.length === 0) return;
    
    // Filter ghosts on current map
    const currentMapGhosts = ghostPlayers.filter(ghost => ghost.mapId === currentMapId);
    
    // Each ghost has a 50% chance to congratulate
    currentMapGhosts.forEach(ghost => {
        if (Math.random() < 0.5) {
            const message = Math.random() < 0.5 ? 'Gz!' : 'Grats!';
            // Slight delay so they don't all say it at once
            setTimeout(() => {
                showGhostChat(ghost, message);
            }, Math.random() * 1000);
        }
    });
}

/**
 * Updates ghost player animation (exact same as player)
 */
function updateGhostAnimation(ghost) {
    // Store previous animation state to detect changes
    const prevAnimationState = ghost.animationState;
    
    // Determine animation state based on movement
    // Use higher thresholds to prevent flickering from physics adjustments
    if (ghost.onLadder) {
        ghost.animationState = 'climb';
    } else if (Math.abs(ghost.velocityX) > 0.5) {
        ghost.animationState = 'walk';
        // Update facing direction ONLY when moving
        if (ghost.velocityX > 0) {
            ghost.facing = 'right';
            ghost.direction = 1;
        } else if (ghost.velocityX < 0) {
            ghost.facing = 'left';
            ghost.direction = -1;
        }
    } else if (ghost.isJumping && ghost.velocityY < -2) {
        // Only show jump animation if actively jumping upward
        ghost.animationState = 'jump';
    } else if (ghost.isJumping && ghost.velocityY > 2) {
        // Only show fall animation if actively falling and was jumping
        ghost.animationState = 'fall';
    } else {
        ghost.animationState = 'idle';
    }
    
    // Reset animation frame when state changes to prevent visual jumping
    if (prevAnimationState !== ghost.animationState) {
        ghost.animationFrame = 0;
        ghost.animationTimer = 0;
    }

    // Frame animation timing (same as player - every 12 game ticks)
    // For climbing, only animate when actually moving on ladder
    const shouldAnimateClimb = ghost.animationState !== 'climb' || Math.abs(ghost.velocityY) > 0.5;
    
    ghost.animationTimer++;
    if (ghost.animationTimer > 12 && shouldAnimateClimb) {
        ghost.animationTimer = 0;
        const anim = spriteData.player.animations[ghost.animationState];
        if (anim) {
            ghost.animationFrame = (ghost.animationFrame + 1) % anim.length;
        }
    }

    // Render ghost using player sprite system
    renderGhostSprite(ghost);
}

/**
 * Renders a ghost player using the EXACT same player sprite system with draw queue
 */
function renderGhostSprite(ghost) {
    // Create sprite container if it doesn't exist
    if (!ghost.spriteContainer) {
        ghost.spriteContainer = document.createElement('div');
        ghost.spriteContainer.style.position = 'absolute';
        ghost.spriteContainer.style.width = '60px';
        ghost.spriteContainer.style.height = '60px';
        ghost.spriteContainer.style.top = '0';
        ghost.spriteContainer.style.left = '0';
        ghost.element.appendChild(ghost.spriteContainer);
    }

    // Create canvas if it doesn't exist
    let canvas = ghost.spriteContainer.querySelector('canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        const pData = spriteData.player;
        canvas.width = pData.frameWidth * PIXEL_ART_SCALE;
        canvas.height = pData.frameHeight * PIXEL_ART_SCALE;
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`;
        canvas.style.position = 'absolute';
        canvas.style.left = `-${(canvas.width - 60) / 2}px`;
        canvas.style.top = `-${(canvas.height - 60)}px`;
        ghost.spriteContainer.appendChild(canvas);
    }

    // Create hair tint canvas if needed
    if (!ghost.hairTintCanvas) {
        ghost.hairTintCanvas = document.createElement('canvas');
        ghost.hairTintCanvas.width = canvas.width;
        ghost.hairTintCanvas.height = canvas.height;
        ghost.hairTintCtx = ghost.hairTintCanvas.getContext('2d', { willReadFrequently: true });
        ghost.hairTintCtx.imageSmoothingEnabled = false;
    }

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pData = spriteData.player;
    const anim = pData.animations[ghost.animationState] || pData.animations.idle;
    const frameIndex = ghost.animationFrame % anim.length;
    const frame = anim[frameIndex];

    ctx.save();
    if (ghost.facing === 'left') {
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
    }

    // Use draw queue system (EXACT same as player)
    const drawQueue = [];

    // Add body layers
    const skinY = pData.frameHeight * (ghost.customization.skinTone + 1);
    drawQueue.push({ type: 'body', zLevel: 1, source: playerSheetImage, sx: frame.x, sy: skinY, sWidth: pData.frameWidth, sHeight: pData.frameHeight });
    drawQueue.push({ type: 'body', zLevel: 5, source: playerSheetImage, sx: frame.x, sy: 0, sWidth: pData.frameWidth, sHeight: pData.frameHeight });

    // Add eyes
    if (ghost.animationState !== 'climb' && frame.attachments?.eyes) {
        const faceItem = ghost.equipped.face;
        const shouldHideEyes = faceItem && itemData[faceItem] && itemData[faceItem].hideEyes;

        if (!shouldHideEyes) {
            const eyeData = spriteData.playerEyes;
            const eyeSourceX = ghost.isBlinking ? eyeData.frameWidth : 0;
            const eyeSourceY = eyeData.frameHeight * ghost.customization.eyeColor;
            drawQueue.push({ type: 'eyes', zLevel: 10, source: playerEyesSheet, sx: eyeSourceX, sy: eyeSourceY, sWidth: eyeData.frameWidth, sHeight: eyeData.frameHeight, attachment: frame.attachments.eyes });
        }
    }

    // Add equipment (EXACT same as player)
    const equipmentSheetData = spriteData.playerEquipment;
    const allSlots = ['cape', 'bottom', 'shoes', 'top', 'pendant', 'earring', 'gloves', 'helmet', 'weapon', 'face', 'eye'];
    allSlots.forEach(slot => {
        const itemName = ghost.equipped[slot];
        if (itemName && equipmentSheetData.coords[itemName]) {
            const itemInfo = itemData[itemName];
            const itemCoords = equipmentSheetData.coords[itemName];
            const sourceX = itemCoords.x + frame.x;
            const sourceY = itemCoords.y;
            let zLevel = itemInfo.zLevel;
            if (itemInfo.zLevelOverrides && itemInfo.zLevelOverrides[ghost.animationState]) {
                zLevel = itemInfo.zLevelOverrides[ghost.animationState];
            }
            
            // When climbing, render gloves behind hair
            if (ghost.onLadder && slot === 'gloves') {
                zLevel = 5;
            }
            
            drawQueue.push({ type: 'equip', zLevel: zLevel, source: playerEquipmentSheet, sx: sourceX, sy: sourceY, sWidth: pData.frameWidth, sHeight: pData.frameHeight });
        }
    });

    // Add hair (EXACT same as player) - check if helmet hides hair
    const helmet = ghost.equipped?.helmet;
    const helmetHidesHair = helmet && itemData[helmet]?.hidesHair;
    const hairStyleIndex = ghost.customization.hairStyle || 0;
    const hairInfo = spriteData.playerHair[hairStyleIndex];
    const hairWorksWithHats = hairInfo?.worksWithHats;
    
    if (ghost.customization && playerHairSheet && playerHairSheet.complete && (!helmetHidesHair || hairWorksWithHats)) {
        if (hairInfo && hairInfo.name !== 'Bald') {
            const hairColor = customizationOptions.hairColors[ghost.customization.hairColor || 0];
            drawQueue.push({
                type: 'hair',
                zLevel: 6,
                source: playerHairSheet,
                sx: hairInfo.x + frame.x,
                sy: hairInfo.y,
                sWidth: pData.frameWidth,
                sHeight: pData.frameHeight,
                hairColor: hairColor
            });
        }
    }

    // Sort and render (EXACT same as player)
    drawQueue.sort((a, b) => a.zLevel - b.zLevel);

    drawQueue.forEach(item => {
        let destWidth = canvas.width;
        let destHeight = canvas.height;
        let destX = 0;
        let destY = 0;

        if (item.type === 'eyes') {
            destWidth = item.sWidth * PIXEL_ART_SCALE;
            destHeight = item.sHeight * PIXEL_ART_SCALE;
            destX = item.attachment.x * PIXEL_ART_SCALE;
            destY = item.attachment.y * PIXEL_ART_SCALE;
        }

        if (item.type === 'hair' && item.hairColor) {
            ghost.hairTintCtx.clearRect(0, 0, canvas.width, canvas.height);
            ghost.hairTintCtx.drawImage(item.source, item.sx, item.sy, item.sWidth, item.sHeight, destX, destY, destWidth, destHeight);

            const imageData = ghost.hairTintCtx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const tintColor = hexToRgb(item.hairColor);

            const outlineR = 34;
            const outlineG = 32;
            const outlineB = 52;

            if (tintColor) {
                for (let i = 0; i < data.length; i += 4) {
                    const isOutlineColor = data[i] === outlineR && data[i + 1] === outlineG && data[i + 2] === outlineB;
                    if (data[i + 3] > 0 && !isOutlineColor) {
                        data[i] = (data[i] / 255) * tintColor.r;
                        data[i + 1] = (data[i + 1] / 255) * tintColor.g;
                        data[i + 2] = (data[i + 2] / 255) * tintColor.b;
                    }
                }
            }
            ghost.hairTintCtx.putImageData(imageData, 0, 0);
            ctx.drawImage(ghost.hairTintCanvas, 0, 0);
        } else {
            ctx.drawImage(item.source, item.sx, item.sy, item.sWidth, item.sHeight, destX, destY, destWidth, destHeight);
        }
    });

    ctx.restore();
}

/**
 * Cleans up ghost players when leaving a map
 */
function cleanupGhostPlayers() {
    ghostPlayers.forEach(ghost => {
        if (ghost.element && ghost.element.parentElement) {
            ghost.element.remove();
        }
    });
    ghostPlayers = [];
}

/**
 * Removes ghosts from other maps when player changes maps
 */
function updateGhostPlayersForMap(mapId) {
    // Remove ghosts from different maps
    ghostPlayers = ghostPlayers.filter(ghost => {
        if (ghost.mapId !== mapId) {
            if (ghost.element && ghost.element.parentElement) {
                ghost.element.remove();
            }
            return false;
        }
        return true;
    });

    // Don't spawn ghosts in trial maps (solo content)
    if (noGhostMaps.includes(mapId)) return;

    // Spawn new ghosts if there aren't enough
    if (ghostPlayers.length < 2) {
        const needed = 2 - ghostPlayers.length;
        for (let i = 0; i < needed; i++) {
            const map = maps[mapId];
            if (!map) continue;
            
            const spawnX = Math.random() * (map.width - 100) + 50;
            const groundLevel = (map.height || scalingContainer.clientHeight) - GAME_CONFIG.GROUND_Y;
            const spawnY = groundLevel - 60;
            
            createGhostPlayer(spawnX, spawnY, mapId);
        }
    }
}

// Console helper functions
window.copyGhostLogs = () => ghostDebug.copyLogsToClipboard();
window.clearGhostLogs = () => ghostDebug.clear();
window.getGhostLogs = (count = 50) => console.log(ghostDebug.getRecentLogs(count));
window.showGhostInfo = () => {
    console.log(`%c=== GHOST PLAYER INFO ===`, 'color: #00ffff; font-weight: bold; font-size: var(--font-standard);');
    console.log(`%cTotal ghosts: ${ghostPlayers.length}`, 'color: #ffaa00');
    console.log('');
    
    ghostPlayers.forEach((ghost, i) => {
        console.log(`%c${ghost.name}`, 'color: #00ff00; font-weight: bold');
        console.log(`  State: ${ghost.state}`);
        console.log(`  Position: (${ghost.x.toFixed(0)}, ${ghost.y.toFixed(0)})`);
        if (ghost.chatMessage) console.log(`  Chat: "${ghost.chatMessage}"`);
        console.log('');
    });
    
    console.log(`%cCommands:`, 'color: #00ffff; font-weight: bold');
    console.log(`  ghostDebug.enabled = true - Enable detailed logging`);
    console.log(`  ghostsCongratsPlayer() - Test level-up congratulations`);
    console.log(`  showGhostInfo() - Show this info again`);
};

// Update visual debug overlay
function updateGhostDebugOverlay() {
    const overlay = document.getElementById('ghost-debug-content');
    if (!overlay || overlay.parentElement.style.display === 'none') return;
    
    let html = `<div style="color: #ffaa00; margin-bottom: 5px;">`;
    html += `Ghosts: ${ghostPlayers.length} | `;
    html += `Monsters: ${monsters.length} | `;
    html += `Items: ${droppedItems.length} | `;
    html += `Ladders: ${platforms.filter(p => p.isLadder).length}`;
    html += `</div>`;
    
    ghostPlayers.forEach((ghost, i) => {
        const stateColor = ghost.state === 'walking' ? '#00ff00' : '#aaaaaa';
        html += `<div style="border-top: 1px solid #333; padding-top: 3px; margin-top: 3px;">`;
        html += `<strong style="color: ${stateColor};">Ghost ${i + 1}</strong> `;
        html += `<span style="color: #666;">${ghost.name}</span><br>`;
        html += `State: <strong style="color: ${stateColor};">${ghost.state.toUpperCase()}</strong><br>`;
        html += `Pos: (${ghost.x.toFixed(0)}, ${ghost.y.toFixed(0)})<br>`;
        if (ghost.chatMessage) html += `💬 "${ghost.chatMessage}"<br>`;
        html += `</div>`;
    });
    
    html += `<div style="border-top: 2px solid #00ff00; margin-top: 8px; padding-top: 5px; color: #aaa; font-size: 9px;">`;
    html += `Last ${Math.min(3, ghostDebug.logs.length)} events:<br>`;
    ghostDebug.logs.slice(-3).forEach(log => {
        html += `<div style="color: #0ff;">${log.message}</div>`;
    });
    html += `</div>`;
    
    overlay.innerHTML = html;
}

// Toggle debug overlay with F3
window.addEventListener('keydown', (e) => {
    if (e.key === 'F3') {
        e.preventDefault();
        const overlay = document.getElementById('ghost-debug-overlay');
        if (overlay) {
            overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
            if (overlay.style.display === 'block') {
                updateGhostDebugOverlay();
            }
        }
    }
});

// Update overlay periodically
setInterval(updateGhostDebugOverlay, 100);

console.log(`%c👻 Ghost Players Loaded!`, 'color: #00ff00; font-weight: bold; font-size: var(--font-small);');
console.log(`%cGhosts will walk around, jump occasionally, and say "Gz!" when you level up!`, 'color: #aaaaaa');
console.log(`%cPress F3 for debug overlay | Type showGhostInfo() for more info`, 'color: #ffaa00');
