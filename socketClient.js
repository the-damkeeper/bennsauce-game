/**
 * BennSauce Socket Client
 * Handles real-time multiplayer connection to the game server
 * 
 * Phase 1: Player position synchronization
 */

// Socket.io will be loaded from CDN in index.html
let socket = null;
let isConnectedToServer = false;
let hasJoinedServer = false; // Track if we've joined the server
let socketInitialized = false; // Track if socket initialization has completed (success or failure)
let remotePlayers = {}; // { odId: playerData }
let positionUpdateInterval = null;
let lastSentPosition = { x: 0, y: 0 };

// Configuration
const SOCKET_CONFIG = {
    SERVER_URL: 'https://bennsauce-server.onrender.com', // Change this for production
    POSITION_UPDATE_RATE: 50, // Send position every 50ms (20 times/sec) for smoother movement
    POSITION_THRESHOLD: 1 // Only send if moved more than 1 pixel
};

/**
 * Simple hash function for generating consistent seeds from strings
 */
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/**
 * Seeded random number generator (0-1 range)
 * Produces consistent results for same seed
 */
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

/**
 * Check if a player (by odId) is in our party
 */
function isPlayerInMyParty(odId) {
    // Don't check ourselves
    if (typeof player !== 'undefined' && player.odId === odId) {
        return false;
    }
    
    // Get our party info
    let myPartyId = null;
    if (typeof getPartyInfo === 'function') {
        const myParty = getPartyInfo();
        myPartyId = myParty.partyId;
    }
    
    if (!myPartyId) return false;
    
    // Check via remote players (socket-based multiplayer)
    for (const remoteOdId in remotePlayers) {
        const remote = remotePlayers[remoteOdId];
        if (remoteOdId === odId && remote.partyId === myPartyId) {
            return true;
        }
    }
    
    // Also check via onlinePlayers (Firebase presence system)
    if (typeof onlinePlayers !== 'undefined') {
        for (const key in onlinePlayers) {
            const onlinePlayer = onlinePlayers[key];
            // onlinePlayers might use playerName or odId
            if ((onlinePlayer.odId === odId || onlinePlayer.odid === odId) && onlinePlayer.partyId === myPartyId) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Initialize the socket connection to the game server
 */
function initializeSocket() {
    // Update loading text
    const serverStatusText = document.getElementById('server-status-text');
    if (serverStatusText) {
        serverStatusText.textContent = 'Connecting to game server...';
        serverStatusText.style.color = '#f39c12';
    }
    
    // Check if Socket.io is loaded
    if (typeof io === 'undefined') {
        console.warn('[Socket] Socket.io not loaded. Real-time multiplayer disabled.');
        if (serverStatusText) {
            serverStatusText.textContent = '❌ Failed to load multiplayer (Socket.io missing)';
            serverStatusText.style.color = '#e74c3c';
        }
        return false;
    }

    try {
        socket = io(SOCKET_CONFIG.SERVER_URL, {
            reconnection: true,
            reconnectionAttempts: 10, // More attempts for server wake-up
            reconnectionDelay: 3000, // Wait 3 seconds between attempts
            timeout: 60000 // 60 second timeout for server wake-up
        });

        setupSocketListeners();
        console.log('[Socket] Attempting to connect to game server...');
        
        // Update message to indicate server might be waking up
        if (serverStatusText) {
            serverStatusText.textContent = 'Connecting to server (may take 30-60 seconds if waking up)...';
        }
        
        return true;
    } catch (error) {
        console.error('[Socket] Failed to initialize socket:', error);
        if (serverStatusText) {
            serverStatusText.textContent = '❌ Failed to connect to server';
            serverStatusText.style.color = '#e74c3c';
        }
        return false;
    }
}

/**
 * Setup all socket event listeners
 */
function setupSocketListeners() {
    // Connection established
    socket.on('connect', () => {
        console.log('[Socket] Connected to game server!');
        isConnectedToServer = true;
        socketInitialized = true;
        
        // Update loading text
        const serverStatusText = document.getElementById('server-status-text');
        if (serverStatusText) {
            serverStatusText.textContent = '✓ Connected to game server';
            serverStatusText.style.color = '#2ecc71';
        }
        
        // Join the game with player data if game is active
        if (typeof player !== 'undefined' && player && typeof currentMapId !== 'undefined' && typeof isGameActive !== 'undefined' && isGameActive) {
            joinGameServer();
        }
        
        // Start sending position updates
        startPositionUpdates();
        
        // Only show notification if game is already running (reconnection)
        if (typeof showNotification === 'function' && typeof isGameActive !== 'undefined' && isGameActive) {
            showNotification('Reconnected to multiplayer server', 'success');
        }
    });

    // Connection lost
    socket.on('disconnect', () => {
        console.log('[Socket] Disconnected from game server');
        isConnectedToServer = false;
        hasJoinedServer = false;
        socketInitialized = false; // Reset so reconnect is required
        stopPositionUpdates();
        
        // Clear remote players
        clearRemotePlayers();
        
        // Only show notification if game was active (not during initial load)
        if (typeof showNotification === 'function' && typeof isGameActive !== 'undefined' && isGameActive) {
            showNotification('Lost connection to server', 'warning');
        }
    });

    // Connection error
    socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error.message);
        isConnectedToServer = false;
        // Don't mark as initialized yet - keep trying during wake-up period
        
        // Update loading text
        const serverStatusText = document.getElementById('server-status-text');
        if (serverStatusText) {
            serverStatusText.textContent = '⏳ Server is waking up, please wait... (this can take 30-60 seconds)';
            serverStatusText.style.color = '#f39c12';
        }
    });

    // Receive current players when joining a map
    socket.on('currentPlayers', (players) => {
        players.forEach(playerData => {
            addRemotePlayer(playerData);
        });
    });

    // New player joined
    socket.on('playerJoined', (playerData) => {
        addRemotePlayer(playerData);
        
        // Show chat message
        if (typeof showNotification === 'function') {
            showNotification(`${playerData.name} appeared`, 'info');
        }
    });

    // Player moved
    socket.on('playerMoved', (data) => {
        updateRemotePlayerPosition(data);
    });

    // Player left
    socket.on('playerLeft', (data) => {
        const player = remotePlayers[data.odId];
        if (player) {
            removeRemotePlayer(data.odId);
        }
    });

    // Player chat
    socket.on('playerChat', (data) => {
        console.log('[Client] Received playerChat:', data);
        const remotePlayer = remotePlayers[data.odId];
        if (remotePlayer && remotePlayer.element) {
            showRemotePlayerChat(remotePlayer, data.message);
            
            // Also add to chat log
            if (typeof addChatMessage === 'function') {
                addChatMessage(`${data.name}: ${data.message}`, 'map');
            }
        } else {
            console.warn('[Client] Could not show chat - remote player not found:', data.odId);
        }
    });

    // Player appearance updated (equipment, cosmetics, guild, medals)
    socket.on('playerAppearanceUpdated', (data) => {
        console.log('[Client] Received playerAppearanceUpdated:', data);
        updateRemotePlayerAppearance(data);
    });

    // =============================================
    // MONSTER EVENTS (Phase 2)
    // =============================================

    // Receive current monsters when joining/changing map
    socket.on('currentMonsters', (serverMonsters) => {
        syncMonstersFromServer(serverMonsters);
    });

    // Monster spawned (respawned) with fade-in effect
    socket.on('monsterSpawned', (monsterData) => {
        // Only create if server is authoritative AND we don't already have this monster
        if (serverAuthoritativeMonsters && !serverMonsterMapping[monsterData.id]) {
            createMonsterFromServer(monsterData);
        }
    });

    // Monster took damage
    socket.on('monsterDamaged', (data) => {
        handleMonsterDamageFromServer(data);
    });

    // Monster killed
    socket.on('monsterKilled', (data) => {
        handleMonsterKilledFromServer(data);
    });

    // Receive monster positions from server (server runs AI)
    socket.on('monsterPositions', (data) => {
        handleMonsterPositionsFromServer(data.monsters);
    });

    // Monster transformed to elite (broadcast from server)
    socket.on('monsterTransformedElite', (data) => {
        console.log('[ELITE DEBUG] Received monsterTransformedElite event from server:', data);
        handleEliteTransformFromServer(data);
    });

    // Player died (show death visual for other players)
    socket.on('playerDied', (data) => {
        handleRemotePlayerDeath(data);
    });

    // Player respawned (remove death visual)
    socket.on('playerRespawned', (data) => {
        handleRemotePlayerRespawn(data);
    });

    // Error from server
    socket.on('error', (data) => {
        console.error('[Socket] Server error:', data.message);
    });
    
    // Item picked up by another player - remove it locally
    socket.on('itemPickedUp', (data) => {
        handleItemPickedUp(data);
    });
    
    // Party member HP/stats update
    socket.on('partyMemberStats', (data) => {
        handlePartyMemberStats(data);
    });
    
    // Received shared gold from party member
    socket.on('partyGoldShare', (data) => {
        handlePartyGoldShare(data);
    });
    
    // Received gold share result (how much we actually keep after sharing)
    socket.on('partyGoldShareResult', (data) => {
        handlePartyGoldShareResult(data);
    });
    
    // Remote player VFX (level up, quest complete, etc.)
    socket.on('remotePlayerVFX', (data) => {
        handleRemotePlayerVFX(data);
    });
}

/**
 * Join the game server with current player data
 */
function joinGameServer() {
    if (!socket || !isConnectedToServer) return;
    if (typeof player === 'undefined' || !player) return;
    if (typeof currentMapId === 'undefined' || !currentMapId) return;

    // Extract just item names from equipped (ghost rendering expects strings, not objects)
    const equippedNames = {};
    if (player.equipped) {
        for (const slot in player.equipped) {
            const item = player.equipped[slot];
            // Handle both string names and item objects
            if (item) {
                equippedNames[slot] = typeof item === 'string' ? item : (item.name || null);
            } else {
                equippedNames[slot] = null;
            }
        }
    }
    
    // Also check cosmeticEquipped (cosmetics override)
    const cosmeticNames = {};
    if (player.cosmeticEquipped) {
        for (const slot in player.cosmeticEquipped) {
            const item = player.cosmeticEquipped[slot];
            cosmeticNames[slot] = item ? (typeof item === 'string' ? item : (item.name || null)) : null;
        }
    }

    // Get party info if available - try both sources
    let partyId = null;
    if (typeof getPartyInfo === 'function') {
        const partyInfo = getPartyInfo();
        partyId = partyInfo.partyId || null;
    }
    // Fallback to player.partyInfo if getPartyInfo returned null
    if (!partyId && typeof player !== 'undefined' && player.partyInfo?.id) {
        partyId = player.partyInfo.id;
        console.log('[Socket] Using partyId from player.partyInfo:', partyId);
    }

    const joinData = {
        odId: player.odId || generateTempOdId(),
        name: player.name || 'Unknown',
        mapId: currentMapId,
        x: player.x,
        y: player.y,
        customization: player.customization || {},
        level: player.level || 1,
        playerClass: player.class || 'Beginner',
        guild: player.guild || null,
        equipped: equippedNames,
        cosmeticEquipped: cosmeticNames,
        equippedMedal: player.equippedMedal || null,
        displayMedals: player.displayMedals || [],
        partyId: partyId
    };
    
    // Store the odId back on player if it wasn't set (important for loot matching)
    if (!player.odId) {
        player.odId = joinData.odId;
        console.log('[Socket] Generated and stored temp odId:', player.odId);
    }

    socket.emit('join', joinData);
    hasJoinedServer = true;
    
    // Initialize monsters for this map after joining
    setTimeout(() => {
        initMapMonstersOnServer();
    }, 500);
}

/**
 * Generate a temporary OdId if player doesn't have one
 */
function generateTempOdId() {
    return 'temp_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Update party info on the server (call this when joining/leaving a party)
 */
function updatePartyOnServer() {
    if (!socket || !socket.connected) return;
    
    let partyId = null;
    if (typeof getPartyInfo === 'function') {
        const partyInfo = getPartyInfo();
        partyId = partyInfo.partyId || null;
    }
    // Fallback to player.partyInfo if getPartyInfo returned null
    if (!partyId && typeof player !== 'undefined' && player.partyInfo?.id) {
        partyId = player.partyInfo.id;
    }
    
    console.log('[Socket] Updating party on server, partyId:', partyId);
    socket.emit('updateParty', { partyId: partyId });
}

// Make updatePartyOnServer available globally
window.updatePartyOnServer = updatePartyOnServer;

/**
 * Start sending position updates to the server
 */
function startPositionUpdates() {
    if (positionUpdateInterval) {
        clearInterval(positionUpdateInterval);
    }

    positionUpdateInterval = setInterval(() => {
        sendPositionUpdate();
    }, SOCKET_CONFIG.POSITION_UPDATE_RATE);
}

/**
 * Stop sending position updates
 */
function stopPositionUpdates() {
    if (positionUpdateInterval) {
        clearInterval(positionUpdateInterval);
        positionUpdateInterval = null;
    }
}

/**
 * Send current position to server (if changed)
 * Note: This continues sending even when tab is not focused so player remains visible to others
 */
function sendPositionUpdate() {
    if (!socket || !isConnectedToServer) return;
    if (typeof player === 'undefined' || !player) return;

    // Only send if position changed significantly
    const dx = Math.abs(player.x - lastSentPosition.x);
    const dy = Math.abs(player.y - lastSentPosition.y);
    
    if (dx > SOCKET_CONFIG.POSITION_THRESHOLD || dy > SOCKET_CONFIG.POSITION_THRESHOLD || player.animationState !== lastSentPosition.animationState) {
        const updateData = {
            x: player.x,
            y: player.y,
            facing: player.facing,
            animationState: player.animationState || 'idle',
            velocityX: player.velocityX || 0,
            velocityY: player.velocityY || 0,
            onLadder: player.onLadder || false
        };

        socket.emit('updatePosition', updateData);
        lastSentPosition = { x: player.x, y: player.y, animationState: player.animationState };
    }
}

/**
 * Notify server when player changes map
 */
function notifyMapChange(newMapId, x, y) {
    if (!socket || !isConnectedToServer) return;

    // If we haven't joined yet, join instead of changing map
    if (!hasJoinedServer) {
        joinGameServer();
        return;
    }

    // Clear remote players from old map
    clearRemotePlayers();
    
    // Clear monster mapping for old map and reset server authority
    serverMonsterMapping = {};
    serverAuthoritativeMonsters = false;

    socket.emit('changeMap', {
        newMapId: newMapId,
        x: x || 400,
        y: y || 300
    });
    
    // Initialize monsters for new map after a short delay
    setTimeout(() => {
        initMapMonstersOnServer();
    }, 500);
}

/**
 * Send chat message to players on same map
 */
function sendMapChat(message) {
    if (!socket || !isConnectedToServer) return;

    socket.emit('chatMessage', { message });
}

// =============================================
// REMOTE PLAYER MANAGEMENT
// =============================================

/**
 * Add a remote player to the game
 * Uses the exact same structure as ghost players for 1:1 rendering
 */
function addRemotePlayer(playerData) {
    if (!playerData || !playerData.odId) return;
    
    // Don't add ourselves
    if (typeof player !== 'undefined' && player && playerData.odId === player.odId) return;
    
    // Already exists - just update
    if (remotePlayers[playerData.odId]) {
        updateRemotePlayerPosition(playerData);
        return;
    }

    // Create DOM element (EXACT same structure as ghost-player)
    const el = document.createElement('div');
    el.className = 'ghost-player'; // Use ghost-player class for same styling
    el.id = `remote-player-${playerData.odId}`;
    el.style.position = 'absolute';
    el.style.width = '60px';
    el.style.height = '60px';
    el.style.pointerEvents = 'auto'; // Enable pointer events for clicking
    el.style.cursor = 'pointer'; // Show pointer cursor on hover
    el.style.zIndex = '10';
    
    // Add double-click event to open inspector
    el.addEventListener('dblclick', () => {
        if (typeof inspectPlayer === 'function') {
            inspectPlayer(playerData.name);
        }
    });

    // Create chat bubble element (hidden by default, same as ghost)
    const chatBubble = document.createElement('div');
    chatBubble.className = 'ghost-chat-bubble';
    el.appendChild(chatBubble);

    // Create nameplate (below, like ghost and player)
    const nameplate = document.createElement('div');
    nameplate.className = 'ghost-nameplate';
    nameplate.textContent = playerData.name || 'Unknown';
    el.appendChild(nameplate);

    // Create remote player object (EXACT same structure as ghost)
    const remotePlayer = {
        id: el.id,
        odId: playerData.odId,
        element: el,
        nameplate: nameplate,
        chatBubble: chatBubble,
        name: playerData.name || 'Unknown',
        class: playerData.playerClass || 'Beginner',
        level: playerData.level || 1,
        customization: playerData.customization || getDefaultCustomization(),
        equipped: playerData.equipped || getDefaultEquipment(),
        cosmeticEquipped: playerData.cosmeticEquipped || getDefaultEquipment(),
        guild: playerData.guild || null,
        equippedMedal: playerData.equippedMedal || null,
        displayMedals: playerData.displayMedals || [],
        x: playerData.x || 400,
        y: playerData.y || 300,
        targetX: playerData.x || 400,
        targetY: playerData.y || 300,
        width: 30,
        height: 60,
        velocityX: 0,
        velocityY: 0,
        facing: playerData.facing || 'right',
        animationState: playerData.animationState || 'idle',
        animationFrame: 0,
        animationTimer: 0, // Timer for animation speed control
        isJumping: false,
        onLadder: false,
        isBlinking: false,
        blinkTimer: Math.floor(Math.random() * 300) + 180,
        blinkDurationTimer: 0,
        lastUpdate: Date.now(),
        isRemotePlayer: true,
        partyId: playerData.partyId || null, // Track party membership for EXP sharing
        // For sprite rendering (same as ghost)
        spriteContainer: null,
        hairTintCanvas: null,
        hairTintCtx: null
    };

    // Add to world content (same as ghosts)
    const worldContent = document.getElementById('world-content');
    if (worldContent) {
        worldContent.appendChild(el);
    }
    
    remotePlayers[playerData.odId] = remotePlayer;
    
    // Update nameplate to show guild and medals
    updateRemotePlayerNameplate(remotePlayer);
}

/**
 * Update remote player position with interpolation
 */
function updateRemotePlayerPosition(data) {
    const remotePlayer = remotePlayers[data.odId];
    if (!remotePlayer) return;

    // Set target position for smooth interpolation
    remotePlayer.targetX = data.x;
    remotePlayer.targetY = data.y;
    remotePlayer.facing = data.facing || remotePlayer.facing;
    
    // Update animation state
    const newAnimState = data.animationState || 'idle';
    if (newAnimState !== remotePlayer.animationState) {
        remotePlayer.animationState = newAnimState;
        remotePlayer.animationFrame = 0;
        remotePlayer.animationTimer = 0;
    }
    
    remotePlayer.velocityX = data.velocityX || 0;
    remotePlayer.velocityY = data.velocityY || 0;
    remotePlayer.onLadder = data.onLadder || false;
    remotePlayer.lastUpdate = Date.now();
}

/**
 * Remove a remote player from the game
 */
function removeRemotePlayer(odId) {
    const remotePlayer = remotePlayers[odId];
    if (!remotePlayer) return;

    // Remove DOM element
    if (remotePlayer.element && remotePlayer.element.parentNode) {
        remotePlayer.element.parentNode.removeChild(remotePlayer.element);
    }

    delete remotePlayers[odId];
}

/**
 * Clear all remote players (when changing maps or disconnecting)
 */
function clearRemotePlayers() {
    for (const odId in remotePlayers) {
        removeRemotePlayer(odId);
    }
    remotePlayers = {};
}

/**
 * Show chat bubble above remote player (same as ghost)
 */
function showRemotePlayerChat(remotePlayer, message) {
    if (!remotePlayer.chatBubble) return;

    remotePlayer.chatBubble.textContent = message;
    remotePlayer.chatBubble.style.display = 'block';

    // Hide after 5 seconds
    setTimeout(() => {
        if (remotePlayer.chatBubble) {
            remotePlayer.chatBubble.style.display = 'none';
        }
    }, 5000);
}

/**
 * Update remote player appearance data (equipment, cosmetics, guild, medals)
 */
function updateRemotePlayerAppearance(data) {
    const remotePlayer = remotePlayers[data.odId];
    if (!remotePlayer) return;

    // Update appearance data
    if (data.equipped !== undefined) remotePlayer.equipped = data.equipped;
    if (data.cosmeticEquipped !== undefined) remotePlayer.cosmeticEquipped = data.cosmeticEquipped;
    if (data.guild !== undefined) remotePlayer.guild = data.guild;
    if (data.equippedMedal !== undefined) remotePlayer.equippedMedal = data.equippedMedal;
    if (data.displayMedals !== undefined) remotePlayer.displayMedals = data.displayMedals;

    console.log(`[Client] Updated appearance for ${remotePlayer.name}:`, {
        equipped: remotePlayer.equipped,
        cosmetics: remotePlayer.cosmeticEquipped,
        guild: remotePlayer.guild,
        medal: remotePlayer.equippedMedal
    });

    // Update nameplate to show guild and medals
    updateRemotePlayerNameplate(remotePlayer);
    
    // If inspector is open for this player, refresh it
    const inspectWindow = document.getElementById('player-inspect-popup');
    const inspectTitle = document.getElementById('inspect-popup-title');
    if (inspectWindow && inspectWindow.style.display !== 'none' && 
        inspectTitle && inspectTitle.textContent.includes(remotePlayer.name)) {
        if (typeof inspectPlayer === 'function') {
            inspectPlayer(remotePlayer.name);
        }
    }
}

/**
 * Send local player appearance update to server
 */
function sendAppearanceUpdate() {
    if (!socket || !hasJoinedServer) return;

    // Convert equipped items to names (server expects names, not full objects)
    const equippedNames = {};
    if (player.equipped) {
        for (const slot in player.equipped) {
            const item = player.equipped[slot];
            equippedNames[slot] = item ? (typeof item === 'string' ? item : (item.name || null)) : null;
        }
    }

    // Convert cosmetic items to names
    const cosmeticNames = {};
    if (player.cosmeticEquipped) {
        for (const slot in player.cosmeticEquipped) {
            const item = player.cosmeticEquipped[slot];
            cosmeticNames[slot] = item ? (typeof item === 'string' ? item : (item.name || null)) : null;
        }
    }

    const appearanceData = {
        equipped: equippedNames,
        cosmeticEquipped: cosmeticNames,
        guild: player.guild,
        equippedMedal: player.equippedMedal,
        displayMedals: player.displayMedals
    };
    
    console.log('[Client] Sending appearance update:', appearanceData);
    socket.emit('updateAppearance', appearanceData);
}

/**
 * Update remote player nameplate to show guild and medals
 */
function updateRemotePlayerNameplate(remotePlayer) {
    if (!remotePlayer || !remotePlayer.element) return;

    // Remove existing guild and medals
    const existingGuild = remotePlayer.element.querySelector('.remote-guild-nameplate');
    const existingMedals = remotePlayer.element.querySelector('.remote-medals-container');
    if (existingGuild) existingGuild.remove();
    if (existingMedals) existingMedals.remove();

    // Add guild nameplate if player has a guild
    if (remotePlayer.guild) {
        const guildNameplate = document.createElement('div');
        guildNameplate.className = 'remote-guild-nameplate';
        guildNameplate.style.cssText = `
            position: absolute;
            bottom: calc(100% + 2px);
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: #FFD700;
            padding: 1px 4px;
            border-radius: 2px;
            font-size: 10px;
            font-family: 'Ari9500';
            font-weight: bold;
            white-space: nowrap;
            pointer-events: none;
            z-index: 1001;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
            backface-visibility: hidden;
        `;
        
        const guildName = typeof remotePlayer.guild === 'string' ? remotePlayer.guild : remotePlayer.guild.name;
        guildNameplate.textContent = `[${guildName}]`;
        remotePlayer.element.appendChild(guildNameplate);
    }

    // Add medals if player has any
    const displayMedals = remotePlayer.displayMedals || [];
    if (remotePlayer.equippedMedal || displayMedals.length > 0) {
        const medalsContainer = document.createElement('div');
        medalsContainer.className = 'remote-medals-container';
        medalsContainer.style.cssText = `
            position: absolute;
            top: 78px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            gap: 1px;
            pointer-events: none;
            z-index: 1000;
        `;

        // Show equipped medal first
        if (remotePlayer.equippedMedal) {
            const medalEl = createRemoteMedalElement(remotePlayer.equippedMedal, true);
            medalsContainer.appendChild(medalEl);
        }

        // Show display medals (excluding equipped medal to avoid duplicates)
        displayMedals.forEach(medal => {
            // Skip if this medal is the same as the equipped medal
            const isEquippedMedal = remotePlayer.equippedMedal && 
                medal.type === remotePlayer.equippedMedal.type && 
                medal.id === remotePlayer.equippedMedal.id;
            
            if (!isEquippedMedal) {
                const medalEl = createRemoteMedalElement(medal, false);
                medalsContainer.appendChild(medalEl);
            }
        });

        remotePlayer.element.appendChild(medalsContainer);
    }
}

/**
 * Create a medal display element for remote players
 */
function createRemoteMedalElement(medal, isStatMedal) {
    const medalTier = medal.tier || 'bronze';
    const medalName = medal.name || 'Medal';

    const medalElement = document.createElement('div');
    medalElement.className = `monster-killer-medal-display ${medalTier}`;
    if (isStatMedal) {
        medalElement.classList.add('stat-medal');
    }
    // Don't override CSS - let the existing styles handle it

    const medalText = document.createElement('span');
    medalText.textContent = medalName;
    medalElement.appendChild(medalText);

    return medalElement;
}

/**
 * Update all remote players (called from game loop)
 * Uses the EXACT same update logic as ghost players
 */
function updateRemotePlayers() {
    for (const odId in remotePlayers) {
        const remotePlayer = remotePlayers[odId];
        
        // Skip updating dead players (gravestone is static)
        if (remotePlayer.isDead) continue;
        
        // Smooth interpolation towards target position (higher = snappier, lower = smoother but laggier)
        const lerpFactor = 0.4;
        remotePlayer.x += (remotePlayer.targetX - remotePlayer.x) * lerpFactor;
        remotePlayer.y += (remotePlayer.targetY - remotePlayer.y) * lerpFactor;

        // Update DOM position - apply same yOffset as player (-6)
        if (remotePlayer.element) {
            remotePlayer.element.style.left = `${Math.round(remotePlayer.x)}px`;
            remotePlayer.element.style.top = `${Math.round(remotePlayer.y +
                 6)}px`;
        }

        // Handle blinking (same as ghost)
        if (!remotePlayer.isBlinking) {
            remotePlayer.blinkTimer--;
            if (remotePlayer.blinkTimer <= 0) {
                remotePlayer.isBlinking = true;
                remotePlayer.blinkDurationTimer = 10;
            }
        } else {
            remotePlayer.blinkDurationTimer--;
            if (remotePlayer.blinkDurationTimer <= 0) {
                remotePlayer.isBlinking = false;
                remotePlayer.blinkTimer = Math.floor(Math.random() * 300) + 180;
            }
        }

        // Update animation frame with timer (EXACT same timing as ghosts - every 13 ticks)
        // For climbing, only animate when actually moving on ladder
        const shouldAnimateClimb = remotePlayer.animationState !== 'climb' || Math.abs(remotePlayer.velocityY) > 0.5;
        
        remotePlayer.animationTimer++;
        if (remotePlayer.animationTimer > 12 && shouldAnimateClimb) {
            remotePlayer.animationTimer = 0;
            
            if (typeof spriteData !== 'undefined' && spriteData.player) {
                const anim = spriteData.player.animations[remotePlayer.animationState];
                if (anim) {
                    remotePlayer.animationFrame = (remotePlayer.animationFrame + 1) % anim.length;
                }
            }
        }

        // Render sprite using ghost rendering function
        if (typeof renderGhostSprite === 'function') {
            renderGhostSprite(remotePlayer);
        }

        // Render level up effect if active
        if (remotePlayer.levelUpEffect && typeof spriteData !== 'undefined' && spriteData.lvlupEffect) {
            const effectData = spriteData.lvlupEffect;
            
            // Update animation
            remotePlayer.levelUpEffect.animationTimer = (remotePlayer.levelUpEffect.animationTimer || 0) + 1;
            const frameDuration = 8;
            
            if (remotePlayer.levelUpEffect.animationTimer > frameDuration) {
                remotePlayer.levelUpEffect.animationTimer = 0;
                remotePlayer.levelUpEffect.animationFrame++;
                
                // Check if animation is complete
                if (remotePlayer.levelUpEffect.animationFrame >= effectData.frameCount) {
                    remotePlayer.levelUpEffect = null;
                    const effectCanvas = remotePlayer.element?.querySelector('.remote-levelup-effect-canvas');
                    if (effectCanvas) {
                        effectCanvas.remove();
                    }
                }
            }
            
            // Render the effect if still active
            if (remotePlayer.levelUpEffect && remotePlayer.spriteContainer) {
                let effectCanvas = remotePlayer.spriteContainer.querySelector('.remote-levelup-effect-canvas');
                if (!effectCanvas) {
                    const PIXEL_ART_SCALE = typeof window.PIXEL_ART_SCALE !== 'undefined' ? window.PIXEL_ART_SCALE : 3;
                    effectCanvas = document.createElement('canvas');
                    effectCanvas.className = 'remote-levelup-effect-canvas';
                    effectCanvas.width = effectData.frameWidth * PIXEL_ART_SCALE;
                    effectCanvas.height = effectData.frameHeight * PIXEL_ART_SCALE;
                    effectCanvas.style.position = 'absolute';
                    effectCanvas.style.pointerEvents = 'none';
                    effectCanvas.style.zIndex = '100';
                    effectCanvas.style.left = `-${(effectCanvas.width - 60) / 2}px`;
                    effectCanvas.style.top = `-${(effectCanvas.height - 60)}px`;
                    remotePlayer.spriteContainer.appendChild(effectCanvas);
                }
                
                const effectCtx = effectCanvas.getContext('2d');
                effectCtx.imageSmoothingEnabled = false;
                effectCtx.clearRect(0, 0, effectCanvas.width, effectCanvas.height);
                
                const frame = effectData.frames[remotePlayer.levelUpEffect.animationFrame];
                if (typeof artAssets !== 'undefined' && artAssets.lvlupEffect) {
                    // Cache the image globally to avoid recreating it every frame
                    if (!window.cachedLvlupImage) {
                        window.cachedLvlupImage = new Image();
                        window.cachedLvlupImage.src = artAssets.lvlupEffect;
                    }
                    
                    const lvlupImage = window.cachedLvlupImage;
                    if (lvlupImage.complete && lvlupImage.naturalWidth > 0) {
                        const PIXEL_ART_SCALE = typeof window.PIXEL_ART_SCALE !== 'undefined' ? window.PIXEL_ART_SCALE : 3;
                        effectCtx.drawImage(
                            lvlupImage,
                            frame.x, frame.y,
                            effectData.frameWidth, effectData.frameHeight,
                            0, 0,
                            effectCanvas.width, effectCanvas.height
                        );
                    }
                }
            }
        }

        // Don't remove stale players on client - let server handle it
        // Server will emit 'playerLeft' when a player disconnects
    }
}

/**
 * Get default customization for remote players without data
 */
function getDefaultCustomization() {
    return {
        skinTone: 0,
        hairStyle: 0,
        hairColor: 0,
        eyeColor: 0
    };
}

/**
 * Get default equipment for remote players without data
 */
function getDefaultEquipment() {
    return {
        weapon: null,
        helmet: null,
        top: null,
        bottom: null,
        shoes: null,
        gloves: null,
        cape: null,
        face: null,
        eye: null,
        earring: null,
        pendant: null
    };
}

// =============================================
// SERVER-AUTHORITATIVE MONSTER MANAGEMENT (Phase 2)
// =============================================

// Track if monsters are managed by server
let serverAuthoritativeMonsters = false;
let serverMonsterMapping = {}; // Maps server monster IDs to local monster objects

/**
 * Initialize map monsters on server (called when entering a new map)
 */
function initMapMonstersOnServer() {
    if (!socket || !isConnectedToServer) return;
    if (typeof currentMapId === 'undefined' || !currentMapId) return;
    if (typeof maps === 'undefined' || !maps[currentMapId]) return;
    
    // Don't re-initialize if already done for this map
    if (serverAuthoritativeMonsters && Object.keys(serverMonsterMapping).length > 0) {
        return;
    }
    
    const mapData = maps[currentMapId];
    if (!mapData.monsters || mapData.monsters.length === 0) return;
    
    // Collect monster type data to send to server
    const monsterTypesData = {};
    for (const spawner of mapData.monsters) {
        if (typeof monsterTypes !== 'undefined' && monsterTypes[spawner.type]) {
            const mt = monsterTypes[spawner.type];
            monsterTypesData[spawner.type] = {
                name: mt.name,
                level: mt.level,
                hp: mt.hp,
                maxHp: mt.hp,
                damage: mt.damage,
                exp: mt.exp || 0,
                width: mt.width || 40,
                height: mt.height || 40,
                speed: mt.speed || 0.8,
                isMiniBoss: mt.isMiniBoss || false,
                isTrialBoss: mt.isTrialBoss || false,
                respawnTime: mt.respawnTime || 8000,
                loot: mt.loot || [], // Include loot table for server-side drop generation
                aiType: mt.aiType || 'patrolling' // Static monsters don't move
            };
        }
    }
    
    // Get map dimensions - match exactly how physics calculates groundLevel:
    // groundLevel = (map.height || scalingContainer.clientHeight) - GAME_CONFIG.GROUND_Y
    const scalingContainer = document.getElementById('scalingContainer');
    const mapWidth = mapData.width || (scalingContainer ? scalingContainer.clientWidth : 1366);
    const containerHeight = scalingContainer ? scalingContainer.clientHeight : 768;
    const effectiveHeight = mapData.height || containerHeight;
    const GROUND_Y = typeof GAME_CONFIG !== 'undefined' ? GAME_CONFIG.GROUND_Y : 281;
    const groundY = effectiveHeight - GROUND_Y;
    
    console.log('[Socket] Spawn calc - mapHeight:', mapData.height, 'containerHeight:', containerHeight, 'effectiveHeight:', effectiveHeight, 'groundY:', groundY);
    
    // Calculate spawn positions client-side (uses all the complex platform/slope logic)
    const spawnPositions = calculateMonsterSpawnPositions(mapData, mapWidth, groundY);
    
    socket.emit('initMapMonsters', {
        mapId: currentMapId,
        monsters: mapData.monsters,
        spawnPositions: spawnPositions, // Pre-calculated positions
        mapWidth: mapWidth,
        groundY: groundY,
        monsterTypes: monsterTypesData
    });
}

/**
 * Calculate spawn positions for all monsters using full game logic
 * This mirrors the logic in game.js respawnMonsterDelayed() and monsters.js spawnInitialMonsters()
 */
function calculateMonsterSpawnPositions(mapData, mapWidth, groundY) {
    const positions = [];
    
    if (!mapData.monsters) return positions;
    
    const PIXEL_ART_SCALE = typeof window.PIXEL_ART_SCALE !== 'undefined' ? window.PIXEL_ART_SCALE : 3;
    const scaledTileSize = 16 * PIXEL_ART_SCALE;
    const GROUND_LEVEL_OFFSET = typeof window.GROUND_LEVEL_OFFSET !== 'undefined' ? window.GROUND_LEVEL_OFFSET : -100;
    
    // Calculate base ground Y the same way the game does
    const baseGroundY = groundY; // This is already calculated as containerHeight - GAME_CONFIG.GROUND_Y
    
    console.log('[Socket] calculateMonsterSpawnPositions - baseGroundY:', baseGroundY, 'GROUND_LEVEL_OFFSET:', GROUND_LEVEL_OFFSET);
    
    // Helper function to check if a point is inside a hill/slope
    function isPointInsideHill(x) {
        if (!mapData.hills && !mapData.slopes) return false;
        
        // Check hills
        for (const hill of (mapData.hills || [])) {
            const hillTiles = hill.tiles || 2;
            const hillCapWidth = hill.width || 0;
            const slopeWidth = hillTiles * scaledTileSize;
            const totalHillWidth = slopeWidth * 2 + hillCapWidth;
            
            if (x >= hill.x && x <= hill.x + totalHillWidth) {
                return true;
            }
        }
        
        // Check individual slopes
        for (const slope of (mapData.slopes || [])) {
            const numTiles = slope.tiles || 1;
            const slopeWidth = numTiles * scaledTileSize;
            const capWidth = slope.width || scaledTileSize;
            
            if (slope.direction === 'left') {
                if (x >= slope.x - capWidth && x <= slope.x + slopeWidth) {
                    return true;
                }
            } else {
                if (x >= slope.x && x <= slope.x + slopeWidth + capWidth) {
                    return true;
                }
            }
        }
        return false;
    }
    
    // Build spawn surfaces list - MUST match game.js exactly
    // ONLY platforms and ground - NOT structures
    const allSpawnSurfaces = [];
    
    // Add ground
    allSpawnSurfaces.push({ 
        x: 0, 
        y: baseGroundY, 
        width: mapWidth, 
        isGround: true,
        surfaceType: 'ground'
    });
    
    // Add platforms - top surface for collision
    if (mapData.platforms) {
        for (const p of mapData.platforms) {
            if (!p.noSpawn && p.width >= 150) {
                allSpawnSurfaces.push({
                    x: p.x,
                    y: p.y + GROUND_LEVEL_OFFSET, // Top surface Y
                    width: p.width,
                    isGround: false,
                    surfaceType: 'platform'
                });
            }
        }
    }
    
    // Add structures - they also function as platforms
    // CRITICAL: Structures need height added to get TOP collision surface
    if (mapData.structures) {
        for (const s of mapData.structures) {
            if (!s.noSpawn && s.width >= 150) {
                // Structure Y in data is where top surface RENDERING starts
                // But the actual walkable surface is one tile (48px) above that
                const structureTopY = s.y + GROUND_LEVEL_OFFSET;
                allSpawnSurfaces.push({
                    x: s.x,
                    y: structureTopY, // Top collision surface
                    width: s.width,
                    isGround: false,
                    surfaceType: 'structure'
                });
                console.log(`[SOCKET SPAWN SURFACE] Structure at data Y=${s.y} → collision Y=${structureTopY}`);
            }
        }
    }
    
    const validSpawnPoints = allSpawnSurfaces;
    
    if (validSpawnPoints.length === 0) {
        console.warn('[Socket] No valid spawn points found');
        return positions;
    }
    
    for (const spawner of mapData.monsters) {
        const count = spawner.count || 5;
        const monsterData = typeof monsterTypes !== 'undefined' ? monsterTypes[spawner.type] : null;
        const monsterWidth = monsterData?.width || 40;
        const monsterHeight = monsterData?.height || 40;
        
        // Calculate anchorY the same way monsters.js does for physics
        // This is where the monster's "feet" are positioned within its sprite
        let anchorY;
        if (monsterData?.usesPlayerSprite) {
            anchorY = 60; // Player sprite anchor
        } else if (monsterData?.isPixelArt && typeof spriteData !== 'undefined' && spriteData[spawner.type]?.anchorPoint) {
            anchorY = spriteData[spawner.type].anchorPoint.y * PIXEL_ART_SCALE;
        } else {
            anchorY = monsterHeight || 55;
        }
        
        for (let i = 0; i < count; i++) {
            let spawnX, spawnY;
            let spawnSurface;
            
            // Check if this is a fixed position spawn (like test dummy)
            if (spawner.fixedPosition && spawner.x !== undefined && spawner.y !== undefined) {
                // Use exact coordinates provided
                spawnX = spawner.x;
                spawnY = spawner.y;
                // Use ground surface for patrol bounds (test dummy should be on ground)
                spawnSurface = allSpawnSurfaces[0]; // First surface is always ground
            } else {
                // Pick a random valid surface (matching game.js style)
                spawnSurface = validSpawnPoints[Math.floor(Math.random() * validSpawnPoints.length)];
                
                const padding = monsterWidth;
                let attempts = 0;
                const maxAttempts = 10;
                
                // Try to find a spawn position that's not inside a hill (only for ground level)
                do {
                    // Ensure proper padding but use full randomization range
                    const minX = spawnSurface.x + padding;
                    const maxX = spawnSurface.x + spawnSurface.width - padding;
                    const randomRange = Math.max(0, maxX - minX);
                    spawnX = minX + (Math.random() * randomRange);
                    // Spawn monsters directly ON the surface
                    // The collision detection will keep them there, no need for offsets
                    spawnY = spawnSurface.y - anchorY;
                    
                    // DEBUG: Log spawn calculation for first few monsters
                    if (positions.length < 3) {
                        console.log(`[SPAWN CALC] Surface type: ${spawnSurface.isGround ? 'ground' : 'platform'}, surfaceY: ${spawnSurface.y}, anchorY: ${anchorY}, spawnY: ${spawnY}`);
                    }
                    attempts++;
                } while (spawnSurface.isGround && isPointInsideHill(spawnX) && attempts < maxAttempts);
            }
            
            // If on ground and inside a hill, adjust Y to the slope surface
            if (spawnSurface.isGround && isPointInsideHill(spawnX) && typeof getSlopeSurfaceY === 'function') {
                const slopeSurfaceY = getSlopeSurfaceY(spawnX, mapData, baseGroundY, scaledTileSize);
                if (slopeSurfaceY !== null && slopeSurfaceY < baseGroundY) {
                    spawnY = slopeSurfaceY - anchorY; // Spawn directly on slope
                }
            }
            
            // Log first spawn for debugging
            if (i === 0 && positions.length === 0) {
                console.log('[Socket] First spawn - surface:', spawnSurface.isGround ? 'ground' : 'platform', 
                    'surfaceY:', spawnSurface.y, 'anchorY:', anchorY, 'spawnY:', spawnY);
            }
            
            positions.push({
                type: spawner.type,
                x: spawnX,
                y: spawnY,
                // Include surface bounds for patrol limits
                surfaceX: spawnSurface.x,
                surfaceWidth: spawnSurface.width
            });
        }
    }
    
    return positions;
}

/**
 * Sync local monsters with server state
 */
function syncMonstersFromServer(serverMonsters) {
    if (!serverMonsters || !Array.isArray(serverMonsters)) return;
    
    // Mark as server-authoritative now that we have server data
    serverAuthoritativeMonsters = true;
    serverMonsterMapping = {};
    
    // Clear existing monsters if this is a fresh sync
    if (typeof monsters !== 'undefined') {
        // Remove all current monsters from DOM and spatial grid
        for (const m of monsters) {
            if (m.element) m.element.remove();
            if (m.hpBarContainer) m.hpBarContainer.remove();
            if (m.hitboxElement) m.hitboxElement.remove();
            if (m.nameplateElement) m.nameplateElement.remove();
            // Remove from spatial grid
            if (typeof spatialGrid !== 'undefined' && m._inGrid) {
                spatialGrid.removeEntity(m);
                m._inGrid = false;
            }
        }
        monsters.length = 0; // Clear the array
    }
    
    // Create monsters from server data
    for (const serverMonster of serverMonsters) {
        createMonsterFromServer(serverMonster);
    }
}

/**
 * Create a local monster from server data
 * @param {Object} serverMonster - Monster data from server
 */
function createMonsterFromServer(serverMonster) {
    if (typeof createMonster !== 'function') {
        console.warn('[Socket] createMonster function not available');
        return null;
    }
    
    // Create the monster using existing game function (fade-in handles spawn effect)
    const localMonster = createMonster(serverMonster.type, serverMonster.x, serverMonster.y);
    
    if (localMonster) {
        // Store server ID mapping
        localMonster.serverId = serverMonster.id;
        serverMonsterMapping[serverMonster.id] = localMonster;
        
        // Sync HP from server
        localMonster.hp = serverMonster.hp;
        localMonster.maxHp = serverMonster.maxHp || localMonster.maxHp;
        
        // Sync special monster flags
        localMonster.isMiniBoss = serverMonster.isMiniBoss || false;
        localMonster.isEliteMonster = serverMonster.isEliteMonster || false;
        localMonster.isTrialBoss = serverMonster.isTrialBoss || false;
        
        // Sync elite monster properties
        if (serverMonster.isEliteMonster) {
            localMonster.originalMaxHp = serverMonster.originalMaxHp;
            localMonster.originalDamage = serverMonster.originalDamage;
            localMonster.damage = serverMonster.damage;
            
            // Add elite visual effects
            if (localMonster.element) {
                localMonster.element.classList.add('elite-monster');
            }
            
            // Create elite HP bar
            if (typeof createEliteMonsterHPBar === 'function') {
                createEliteMonsterHPBar(localMonster);
            }
            
            // Set as current elite
            if (typeof currentEliteMonster !== 'undefined') {
                currentEliteMonster = localMonster;
            }
        }
        
        // Create mini boss HP bar if needed
        if (serverMonster.isMiniBoss && typeof createMiniBossHPBar === 'function') {
            createMiniBossHPBar(localMonster);
        }
        
        // Store patrol bounds from server (used to clamp position during interpolation)
        if (serverMonster.patrolMinX !== undefined) {
            localMonster.patrolMinX = serverMonster.patrolMinX;
        }
        if (serverMonster.patrolMaxX !== undefined) {
            localMonster.patrolMaxX = serverMonster.patrolMaxX;
        }
        
        // Update HP bar if exists
        if (localMonster.hpBar) {
            localMonster.hpBar.style.width = `${Math.max(0, localMonster.hp) / localMonster.maxHp * 100}%`;
        }
        
        // Debug logging
        console.log(`[MONSTER SPAWN] Type: ${serverMonster.type}, ID: ${serverMonster.id}, Spawn Position: (${serverMonster.x.toFixed(1)}, ${serverMonster.y.toFixed(1)}), Elite: ${serverMonster.isEliteMonster}, MiniBoss: ${serverMonster.isMiniBoss}`);
    } else {
        console.error('[Socket] createMonster returned null/undefined for', serverMonster.type);
    }
    
    return localMonster;
}

/**
 * Handle monster damage from server (visual feedback)
 */
function handleMonsterDamageFromServer(data) {
    const localMonster = serverMonsterMapping[data.id];
    if (!localMonster) return;
    
    // Update local HP
    localMonster.hp = data.currentHp;
    
    // Update HP bar
    if (localMonster.hpBar) {
        localMonster.hpBar.style.width = `${Math.max(0, data.currentHp) / data.maxHp * 100}%`;
    }
    
    // Show HP bar and nameplate on hit (same as local damage)
    if (localMonster.hpBarContainer) localMonster.hpBarContainer.style.display = 'block';
    if (localMonster.nameplateElement) localMonster.nameplateElement.style.display = 'block';
    
    // Apply knockback when PLAYER hits monster (not when monster hits player)
    if (data.knockbackVelocityX !== undefined && data.knockbackVelocityX !== 0) {
        localMonster.velocityX = data.knockbackVelocityX;
        // Set knockback timer - prevents server interpolation for 500ms
        localMonster.knockbackEndTime = Date.now() + 500;
        // Make monster face the player (opposite of knockback direction)
        localMonster.direction = data.knockbackVelocityX > 0 ? -1 : 1;
    }
    
    // If this damage wasn't from us, show the damage number
    if (typeof player !== 'undefined' && data.attackerId !== player.odId) {
        // Show damage from other player (could add different color)
        if (typeof showDamageNumber === 'function') {
            showDamageNumber(data.damage, localMonster.x + localMonster.width / 2, localMonster.y, false, { isOtherPlayer: true });
        }
    }
}

/**
 * Handle monster death from server
 */
function handleMonsterKilledFromServer(data) {
    console.log('[Socket] Monster killed from server:', data);
    
    const localMonster = serverMonsterMapping[data.id];
    if (!localMonster) {
        console.log('[Socket] Local monster not found for id:', data.id);
        return;
    }
    
    // Mark as dead
    localMonster.isDead = true;
    localMonster.hp = 0;
    
    // Handle elite monster death
    if (data.isEliteMonster || localMonster.isEliteMonster) {
        if (typeof removeEliteMonsterHPBar === 'function') {
            removeEliteMonsterHPBar();
        }
        if (typeof currentEliteMonster !== 'undefined') {
            currentEliteMonster = null;
        }
        if (typeof addChatMessage === 'function') {
            addChatMessage(`⭐ ELITE ${localMonster.name?.toUpperCase() || data.type.toUpperCase()} DEFEATED! ⭐`, 'legendary');
        }
    }
    
    // Play death animation
    if (localMonster.element) {
        localMonster.element.classList.add('monster-death');
        localMonster.velocityY = -5;
        localMonster.velocityX = 8;
    }
    
    // Check if we get the loot
    console.log('[Socket] Loot check - lootRecipient:', data.lootRecipient, 'player.odId:', typeof player !== 'undefined' ? player.odId : 'undefined');
    const weGetLoot = (typeof player !== 'undefined' && data.lootRecipient === player.odId);
    console.log('[Socket] weGetLoot:', weGetLoot);
    
    // Get monster data for EXP
    const monsterData = (typeof monsterTypes !== 'undefined' && monsterTypes[data.type]) ? monsterTypes[data.type] : null;
    
    // Create drops from server-provided drop list (same for all clients)
    if (data.drops && data.drops.length > 0 && typeof createItemDrop === 'function') {
        console.log('[Socket] Creating drops:', data.drops);
        for (const drop of data.drops) {
            if (drop.name === 'Gold') {
                createItemDrop('Gold', drop.x, drop.y, { 
                    amount: drop.amount,
                    ownerId: data.lootRecipient,
                    ownerTimeout: Date.now() + 60000, // 60 seconds ownership
                    serverVelocityX: drop.velocityX,
                    serverVelocityY: drop.velocityY
                });
                // Track bestiary drops if we're the loot recipient
                if (weGetLoot && typeof updateBestiaryDrop === 'function') {
                    updateBestiaryDrop(data.type, 'Gold', drop.amount);
                }
            } else if (drop.name) {
                createItemDrop(drop.name, drop.x, drop.y, {
                    ownerId: data.lootRecipient,
                    ownerTimeout: Date.now() + 60000, // 60 seconds ownership
                    serverVelocityX: drop.velocityX,
                    serverVelocityY: drop.velocityY
                });
                // Track bestiary drops if we're the loot recipient
                if (weGetLoot && typeof updateBestiaryDrop === 'function') {
                    updateBestiaryDrop(data.type, drop.name);
                }
            }
        }
    }
    
    if (weGetLoot && monsterData) {
        // Loot recipient gains EXP (elite monsters give 10x EXP)
        if (typeof gainExp === 'function') {
            const expMultiplier = data.isEliteMonster ? 10 : 1;
            gainExp((monsterData.exp || 0) * expMultiplier);
        }
        
        // Update quests - SAME MAP PLAYERS GET QUEST CREDIT
        if (typeof updateQuestProgress === 'function') {
            updateQuestProgress(data.type);
        }
        
        // Update achievements
        if (typeof updateAchievementProgress === 'function') {
            updateAchievementProgress('kill', data.type);
        }
        
        // Update bestiary (only killer gets bestiary credit)
        if (typeof updateBestiaryKill === 'function') {
            updateBestiaryKill(data.type);
        }
        
        // Update total kill stats
        if (typeof player !== 'undefined') {
            player.stats = player.stats || {};
            player.stats.totalKills = (player.stats.totalKills || 0) + 1;
            if (typeof updateAchievementProgress === 'function') {
                updateAchievementProgress('action_accumulate', 'total_kills');
            }
        }
    } else if (!weGetLoot && monsterData) {
        // Not the killer - check if we should get quest credit or party EXP
        
        // ALL players on same map get quest progress
        if (typeof updateQuestProgress === 'function') {
            updateQuestProgress(data.type);
        }
        // Party member EXP - check if we're in the partyMembers list from server
        console.log('[Socket] Party check - partyMembers:', data.partyMembers, 'my odId:', player?.odId);
        if (typeof player !== 'undefined' && data.partyMembers && data.partyMembers.length > 0) {
            // Server sent list of party members who should get shared EXP
            const isPartyMember = data.partyMembers.includes(player.odId);
            console.log('[Socket] Am I party member?', isPartyMember);
            if (isPartyMember) {
                // We're a party member - we get shared EXP (50% of base)
                const sharedExp = Math.floor((monsterData.exp || 0) * 0.5);
                console.log('[Socket] Granting party EXP:', sharedExp);
                if (sharedExp > 0) {
                    // Directly add EXP without using gainExp to avoid duplicate notification
                    player.exp += sharedExp;
                    // Check for level up
                    while (player.exp >= player.maxExp) {
                        player.exp -= player.maxExp;
                        if (typeof levelUp === 'function') levelUp();
                    }
                    if (typeof updateUI === 'function') updateUI();
                    // Show only party EXP notification
                    if (typeof showNotification === 'function') {
                        showNotification(`+${sharedExp} Party EXP`, 'partyExp');
                    }
                }
                
                // NOTE: Party members do NOT get bestiary credit
                // Only the actual killer gets bestiary updates
            }
        }
    }
    
    // Remove monster element after death animation
    setTimeout(() => {
        const index = typeof monsters !== 'undefined' ? monsters.indexOf(localMonster) : -1;
        if (index > -1) {
            if (localMonster.element) localMonster.element.remove();
            if (localMonster.hpBarContainer) localMonster.hpBarContainer.remove();
            if (localMonster.hitboxElement) localMonster.hitboxElement.remove();
            
            // Remove from spatial grid
            if (typeof spatialGrid !== 'undefined' && localMonster._inGrid) {
                spatialGrid.removeEntity(localMonster);
                localMonster._inGrid = false;
            }
            
            monsters.splice(index, 1);
        }
        
        // Remove from mapping
        delete serverMonsterMapping[data.id];
    }, 500);
}

/**
 * Send attack to server (instead of applying damage locally)
 */
function sendMonsterAttack(monsterId, damage, isCritical, attackType) {
    console.log('[Socket] sendMonsterAttack called:', { monsterId, damage, isCritical, serverAuth: serverAuthoritativeMonsters, connected: isConnectedToServer });
    if (!socket || !isConnectedToServer || !serverAuthoritativeMonsters) {
        console.log('[Socket] sendMonsterAttack blocked - socket:', !!socket, 'connected:', isConnectedToServer, 'serverAuth:', serverAuthoritativeMonsters);
        return false;
    }
    
    // Find the server ID for this monster
    let serverId = null;
    for (const [sid, localMonster] of Object.entries(serverMonsterMapping)) {
        if (localMonster.id === monsterId || localMonster === monsterId || localMonster.serverId === monsterId) {
            serverId = sid;
            break;
        }
    }
    
    if (!serverId) {
        // Monster not found in server mapping - might be a local-only monster
        return false;
    }
    
    socket.emit('attackMonster', {
        monsterId: serverId,
        damage: damage,
        isCritical: isCritical || false,
        attackType: attackType || 'normal',
        playerDirection: typeof player !== 'undefined' && player.facing ? (player.facing === 'right' ? 1 : -1) : 1
    });
    
    return true;
}

/**
 * Check if monsters are server-authoritative
 */
function isServerAuthoritativeMonsters() {
    return serverAuthoritativeMonsters && isConnectedToServer;
}

/**
 * Send elite monster transformation to server
 */
function sendEliteTransformToServer(serverId, maxHp, damage, originalMaxHp, originalDamage) {
    console.log(`[ELITE DEBUG] sendEliteTransformToServer called:`, {
        hasSocket: !!socket,
        isConnected: isConnectedToServer,
        socketConnected: socket?.connected,
        socketId: socket?.id
    });
    
    if (!socket || !isConnectedToServer) {
        console.error(`[ELITE DEBUG] Cannot send to server - not connected!`);
        return;
    }
    
    if (!socket.connected) {
        console.error(`[ELITE DEBUG] Socket exists but not connected!`);
        return;
    }
    
    console.log(`[ELITE DEBUG] Emitting transformElite to server:`, {
        monsterId: serverId,
        maxHp,
        damage,
        originalMaxHp,
        originalDamage
    });
    
    socket.emit('transformElite', {
        monsterId: serverId,
        maxHp: maxHp,
        damage: damage,
        originalMaxHp: originalMaxHp,
        originalDamage: originalDamage
    });
    
    console.log(`[ELITE DEBUG] Emit complete, waiting for server response...`);
}

/**
 * Handle elite transformation received from server
 */
function handleEliteTransformFromServer(data) {
    console.log(`[ELITE DEBUG] Received transform from server:`, {
        monsterId: data.monsterId,
        maxHp: data.maxHp,
        hp: data.hp,
        damage: data.damage,
        hasMapping: !!serverMonsterMapping[data.monsterId],
        allMappedMonsters: Object.keys(serverMonsterMapping)
    });
    
    const localMonster = serverMonsterMapping[data.monsterId];
    if (!localMonster) {
        console.log('[ELITE DEBUG] Monster not found for elite transform:', data.monsterId);
        console.log('[ELITE DEBUG] Available monsters:', Object.keys(serverMonsterMapping));
        return;
    }
    
    console.log(`[ELITE DEBUG] Found local monster:`, {
        type: localMonster.type,
        isAlreadyElite: localMonster.isEliteMonster,
        hasElement: !!localMonster.element
    });
    
    // Apply elite transformation (visual only if already transformed locally)
    if (!localMonster.isEliteMonster) {
        console.log(`[ELITE DEBUG] Applying transformation...`);
        localMonster.isEliteMonster = true;
        localMonster.originalMaxHp = data.originalMaxHp;
        localMonster.originalDamage = data.originalDamage;
        localMonster.maxHp = data.maxHp;
        localMonster.hp = data.hp;
        localMonster.damage = data.damage;
        
        // Add visual effects
        if (localMonster.element) {
            localMonster.element.classList.add('elite-monster');
            console.log(`[ELITE DEBUG] Added elite-monster class`);
        } else {
            console.log(`[ELITE DEBUG] No element to add class to!`);
        }
        
        // Create elite HP bar if not already created
        if (typeof createEliteMonsterHPBar === 'function' && !localMonster.eliteHPBar) {
            console.log(`[ELITE DEBUG] Creating elite HP bar...`);
            createEliteMonsterHPBar(localMonster);
        } else {
            console.log(`[ELITE DEBUG] HP bar not created:`, {
                hasFunction: typeof createEliteMonsterHPBar === 'function',
                alreadyHasBar: !!localMonster.eliteHPBar
            });
        }
        
        // Update current elite reference
        if (typeof currentEliteMonster !== 'undefined') {
            currentEliteMonster = localMonster;
            console.log(`[ELITE DEBUG] Set currentEliteMonster`);
        }
        
        // Show announcement to all players
        if (typeof addChatMessage === 'function') {
            addChatMessage(`⚠️ A ELITE ${localMonster.name.toUpperCase()} has appeared! ⚠️`, 'boss');
            console.log(`[ELITE DEBUG] Showed announcement`);
        }
        if (typeof playSound === 'function') {
            playSound('quest'); // Dramatic effect
            console.log(`[ELITE DEBUG] Played sound`);
        }
        
        console.log(`[ELITE DEBUG] Transformation complete!`);
    } else {
        console.log(`[ELITE DEBUG] Monster already elite, skipping transformation`);
    }
}

/**
 * Send item pickup to server for sync
 */
function sendItemPickup(item) {
    if (!socket || !isConnectedToServer) return;
    
    socket.emit('itemPickup', {
        itemId: item.id,
        itemName: item.name,
        x: item.x,
        y: item.y
    });
}

/**
 * Handle item picked up notification from server
 */
function handleItemPickedUp(data) {
    if (typeof droppedItems === 'undefined') return;
    
    const { itemId, x, y, pickedUpBy, pickedUpByName } = data;
    
    // Don't process our own pickups (we already handled it locally)
    if (typeof player !== 'undefined' && pickedUpBy === player.odId) {
        return;
    }
    
    console.log(`[Socket] ${pickedUpByName} picked up item at (${x}, ${y})`);
    
    // Find and remove the item by matching id or position (within tolerance)
    for (let i = droppedItems.length - 1; i >= 0; i--) {
        const item = droppedItems[i];
        
        // Match by ID if available, or by approximate position
        const matchesId = item.id === itemId;
        const matchesPosition = Math.abs(item.x - x) < 50 && Math.abs(item.y - y) < 50;
        
        if (matchesId || matchesPosition) {
            // Play pickup VFX at item location
            if (typeof createPixelArtEffect === 'function') {
                createPixelArtEffect('spawnEffect', item.x, item.y, item.width, item.height);
            }
            
            // Remove the item element and from array
            if (item.element) {
                item.element.remove();
            }
            droppedItems.splice(i, 1);
            
            console.log(`[Socket] Removed item from local droppedItems`);
            break;
        }
    }
}

/**
 * Handle party member stats update from server
 */
function handlePartyMemberStats(data) {
    // Store in a global object for the party overlay to use
    if (!window.partyMemberStats) {
        window.partyMemberStats = {};
    }
    
    window.partyMemberStats[data.odId] = {
        name: data.name,
        hp: data.hp,
        maxHp: data.maxHp,
        level: data.level,
        exp: data.exp,
        maxExp: data.maxExp,
        lastUpdate: Date.now()
    };
    
    // Trigger party overlay update if function exists
    if (typeof updatePartyOverlay === 'function') {
        updatePartyOverlay();
    }
}

/**
 * Handle receiving shared gold from a party member
 */
function handlePartyGoldShare(data) {
    if (typeof player === 'undefined' || !player) return;
    
    const { amount, fromName } = data;
    if (amount > 0) {
        player.gold += amount;
        player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + amount;
        
        // Track achievement progress
        if (typeof updateAchievementProgress === 'function') {
            updateAchievementProgress('action_accumulate', 'gold_earned');
        }
        
        if (typeof showNotification === 'function') {
            showNotification(`+${amount.toLocaleString()} Party Gold`, 'partyExp');
        }
        if (typeof updateUI === 'function') {
            updateUI();
        }
        console.log(`[Socket] Received ${amount} shared gold from ${fromName}`);
    }
}

/**
 * Handle gold share result - add our share of gold
 */
function handlePartyGoldShareResult(data) {
    if (typeof player === 'undefined' || !player) return;
    
    const { originalAmount, yourShare, memberCount } = data;
    
    // Add our share of the gold
    player.gold += yourShare;
    player.stats = player.stats || {};
    player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + yourShare;
    
    if (typeof showNotification === 'function') {
        showNotification(`+${yourShare.toLocaleString()} Gold (shared)`, 'exp');
    }
    if (typeof updateUI === 'function') {
        updateUI();
    }
    if (typeof updateAchievementProgress === 'function') {
        updateAchievementProgress('action_accumulate', 'gold_earned');
    }
    console.log(`[Socket] Gold share result: got ${yourShare} of ${originalAmount} (split with ${memberCount} members)`);
}

/**
 * Share gold with party members (call this when looting gold)
 * Returns: { shouldAddGold: boolean, amount: number, isSharing: boolean }
 */
function shareGoldWithParty(totalAmount) {
    if (!socket || !isConnectedToServer) return { shouldAddGold: true, amount: totalAmount, isSharing: false };
    if (typeof player === 'undefined' || !player) return { shouldAddGold: true, amount: totalAmount, isSharing: false };
    
    // Check if in a party
    const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : null;
    if (!partyInfo || !partyInfo.inParty) return { shouldAddGold: true, amount: totalAmount, isSharing: false };
    
    // Send to server to determine party members and distribute
    // Server will figure out how many members are on the map and split accordingly
    socket.emit('sharePartyGold', {
        totalAmount: totalAmount
    });
    console.log(`[Socket] Requesting gold share for ${totalAmount} gold`);
    
    // Return that we're sharing - game.js should NOT add gold yet
    // Server will send partyGoldShareResult with our actual share
    return { shouldAddGold: false, amount: 0, isSharing: true };
}

/**
 * Send party stats update to server (call this when HP/EXP changes)
 */
function sendPartyStatsUpdate() {
    if (!socket || !isConnectedToServer) return;
    if (typeof player === 'undefined' || !player) return;
    
    // Only send if in a party
    const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : null;
    if (!partyInfo || !partyInfo.inParty) return;
    
    socket.emit('updatePartyStats', {
        hp: player.hp || 0,
        maxHp: player.maxHp || 100,
        level: player.level || 1,
        exp: player.exp || 0,
        maxExp: player.maxExp || 100
    });
}

// =============================================
// EXPORTS & INITIALIZATION
// =============================================

// Expose to window for global access
window.initializeSocket = initializeSocket;
window.isConnectedToServer = () => isConnectedToServer;
window.hasJoinedServer = () => hasJoinedServer;
window.notifyMapChange = notifyMapChange;
window.sendMapChat = sendMapChat;
window.updateRemotePlayers = updateRemotePlayers;
window.remotePlayers = remotePlayers;
window.joinGameServer = joinGameServer;

// Monster management exports (Phase 2)
window.initMapMonstersOnServer = initMapMonstersOnServer;
window.sendMonsterAttack = sendMonsterAttack;
window.isServerAuthoritativeMonsters = isServerAuthoritativeMonsters;
window.serverMonsterMapping = serverMonsterMapping;
window.isSocketInitialized = () => socketInitialized;

// Item pickup sync exports
window.sendItemPickup = sendItemPickup;

// Party stats sync exports
window.sendPartyStatsUpdate = sendPartyStatsUpdate;
window.shareGoldWithParty = shareGoldWithParty;
window.partyMemberStats = window.partyMemberStats || {};

// =============================================
// MONSTER POSITION SYNC (Server-Authoritative)
// =============================================

/**
 * Handle monster position updates from server
 * Server runs AI, all clients just receive and interpolate
 * NOTE: Only X position is controlled by server - Y is handled by client physics
 */
function handleMonsterPositionsFromServer(monsterPositions) {
    if (!monsterPositions || !Array.isArray(monsterPositions)) return;
    
    for (const pos of monsterPositions) {
        const localMonster = serverMonsterMapping[pos.id];
        if (!localMonster || localMonster.isDead) continue;
        
        // Store target X position for interpolation
        localMonster.serverTargetX = pos.x;
        // Store server Y - we'll sync if client drifts too far
        localMonster.serverTargetY = pos.y;
        localMonster.serverFacing = pos.facing;
        localMonster.serverDirection = pos.direction;
        localMonster.serverAiState = pos.aiState;
        localMonster.serverVelocityX = pos.velocityX || 0;
        localMonster.lastServerUpdate = Date.now();
    }
}

/**
 * Interpolate monster positions toward server positions
 * Called from game loop - server runs AI for X movement, client handles Y (physics)
 */
function interpolateMonsterPositions() {
    if (!serverAuthoritativeMonsters) return;
    
    const now = Date.now();
    const INTERPOLATION_SPEED = 0.2; // How quickly to move toward server position
    const Y_CORRECTION_THRESHOLD = 30; // Only correct Y if drift exceeds this
    const Y_CORRECTION_SPEED = 0.3; // Faster Y correction to prevent visible drift
    
    for (const serverId in serverMonsterMapping) {
        const m = serverMonsterMapping[serverId];
        if (!m || m.isDead) continue;
        if (m.serverTargetX === undefined) continue;
        
        // Skip if update is too old (>1 second)
        if (now - (m.lastServerUpdate || 0) > 1000) continue;
        
        // Skip interpolation if monster is being knocked back
        if (m.knockbackEndTime && now < m.knockbackEndTime) continue;
        
        // Interpolate X position
        const dx = m.serverTargetX - m.x;
        
        // Snap if very close, otherwise interpolate
        if (Math.abs(dx) < 2) {
            m.x = m.serverTargetX;
        } else {
            m.x += dx * INTERPOLATION_SPEED;
        }
        
        // Clamp X to patrol bounds if available (prevents visual drift off platforms)
        if (m.patrolMinX !== undefined && m.patrolMaxX !== undefined) {
            m.x = Math.max(m.patrolMinX, Math.min(m.patrolMaxX, m.x));
        }
        
        // Correct Y position if drifted too far from server (keeps platform monsters synced)
        if (m.serverTargetY !== undefined) {
            const dy = m.serverTargetY - m.y;
            if (Math.abs(dy) > Y_CORRECTION_THRESHOLD) {
                // Significant drift - correct toward server position
                m.y += dy * Y_CORRECTION_SPEED;
                m.velocityY = 0; // Reset velocity to prevent fighting
            }
        }
        
        // Update facing and direction (direction controls sprite flip: 1=right, -1=left)
        if (m.serverDirection !== undefined) {
            m.direction = m.serverDirection;
            m.facing = m.direction === 1 ? 'right' : 'left';
            
            // Apply sprite flip immediately for non-pixel-art monsters
            if (m.element && !m.isPixelArt) {
                m.element.style.transform = m.direction === 1 ? 'scaleX(1)' : 'scaleX(-1)';
            }
        } else if (m.serverFacing) {
            m.facing = m.serverFacing;
            m.direction = m.serverFacing === 'right' ? 1 : -1;
            
            // Apply sprite flip immediately for non-pixel-art monsters
            if (m.element && !m.isPixelArt) {
                m.element.style.transform = m.direction === 1 ? 'scaleX(1)' : 'scaleX(-1)';
            }
        }
        
        // Update AI state for animations
        if (m.serverAiState) {
            m.aiState = m.serverAiState;
        }
    }
}

/**
 * Broadcast a VFX event to other players
 * @param {string} vfxType - Type of VFX ('levelUp', 'questComplete', etc.)
 * @param {number} x - X position
 * @param {number} y - Y position
 */
function broadcastPlayerVFX(vfxType, x, y) {
    if (!socket || !isConnectedToServer) {
        console.log('[VFX] Not broadcasting - not connected to server');
        return;
    }
    
    console.log('[VFX] Broadcasting', vfxType, 'to other players');
    socket.emit('playerVFX', {
        vfxType: vfxType,
        x: x,
        y: y
    });
}

/**
 * Handle VFX from a remote player
 */
function handleRemotePlayerVFX(data) {
    console.log('[VFX] Received remote player VFX:', data.vfxType, 'from', data.odId);
    
    const remotePlayer = remotePlayers[data.odId];
    if (!remotePlayer) {
        console.log('[VFX] Remote player not found:', data.odId);
        return;
    }
    
    switch (data.vfxType) {
        case 'levelUp':
            console.log('[VFX] Showing level up effect for remote player');
            // Trigger level up effect on remote player
            remotePlayer.levelUpEffect = {
                animationFrame: 0,
                animationTimer: 0
            };
            // Also play the level up sound (quieter for remote players)
            if (typeof playSound === 'function') {
                playSound('levelUp', 0.5); // 50% volume for remote players
            }
            break;
            
        case 'questComplete':
            console.log('[VFX] Showing quest complete effect for remote player');
            // Play quest VFX at remote player's position
            createRemoteQuestVFXFallback(remotePlayer.x, remotePlayer.y);
            break;
            
        default:
            console.log('[VFX] Unknown VFX type:', data.vfxType);
    }
}

/**
 * Create quest complete VFX at a remote player's position
 */
function createRemoteQuestVFXFallback(x, y) {
    if (typeof spriteData === 'undefined' || !spriteData.questVFX) return;
    
    const effectData = spriteData.questVFX;
    const animation = effectData.animations?.play;
    if (!animation || animation.length === 0) return;
    
    const PIXEL_ART_SCALE = typeof window.PIXEL_ART_SCALE !== 'undefined' ? window.PIXEL_ART_SCALE : 3;
    
    const el = document.createElement('div');
    el.className = 'quest-vfx';
    el.style.position = 'absolute';
    el.style.zIndex = '120';
    el.style.pointerEvents = 'none';
    
    const effectWidth = effectData.frameWidth * PIXEL_ART_SCALE;
    const effectHeight = effectData.frameHeight * PIXEL_ART_SCALE;
    
    // Position above remote player
    const anchorOffsetX = effectData.anchorPoint ? effectData.anchorPoint.x * PIXEL_ART_SCALE : effectWidth / 2;
    const playerVisualWidth = 60;
    const topPos = y - effectHeight;
    const leftPos = x + (playerVisualWidth / 2) - anchorOffsetX;
    
    el.style.width = `${effectWidth}px`;
    el.style.height = `${effectHeight}px`;
    el.style.left = `${leftPos}px`;
    el.style.top = `${topPos}px`;
    
    if (typeof artAssets !== 'undefined' && artAssets.questVFX) {
        el.style.backgroundImage = `url(${artAssets.questVFX})`;
        // Calculate background size based on animation frames, not entire sheet
        const sheetWidth = effectData.frameWidth * animation.length * PIXEL_ART_SCALE;
        const sheetHeight = effectData.frameHeight * PIXEL_ART_SCALE;
        el.style.backgroundSize = `${sheetWidth}px ${sheetHeight}px`;
        el.style.imageRendering = 'pixelated';
    }
    
    const worldContent = document.getElementById('world-content');
    if (worldContent) {
        worldContent.appendChild(el);
    }
    
    let frameIndex = 0;
    const frameDuration = 80; // Match local player frame duration
    
    const animateVFX = () => {
        if (frameIndex >= animation.length) {
            el.remove();
            return;
        }
        const frame = animation[frameIndex];
        el.style.backgroundPosition = `-${frame.x * PIXEL_ART_SCALE}px -${frame.y * PIXEL_ART_SCALE}px`;
        frameIndex++;
        setTimeout(animateVFX, frameDuration);
    };
    
    // Start with first frame immediately to avoid showing full sheet
    if (animation.length > 0) {
        const firstFrame = animation[0];
        el.style.backgroundPosition = `-${firstFrame.x * PIXEL_ART_SCALE}px -${firstFrame.y * PIXEL_ART_SCALE}px`;
    }
    
    // Start animation after a frame
    setTimeout(animateVFX, frameDuration);
}

/**
 * Send player death to server (broadcast to other players)
 */
function sendPlayerDeath() {
    if (!socket || !isConnectedToServer) return;
    
    socket.emit('playerDeath', {
        odId: player.odId,
        name: player.name,
        x: player.x,
        y: player.y
    });
}

/**
 * Send player respawn to server
 */
function sendPlayerRespawn() {
    if (!socket || !isConnectedToServer) return;
    
    socket.emit('playerRespawn', {
        odId: player.odId
    });
}

/**
 * Handle remote player death (show gravestone/death visual)
 */
function handleRemotePlayerDeath(data) {
    const remotePlayer = remotePlayers[data.odId];
    if (!remotePlayer) return;
    
    console.log(`[Client] ${data.name} died at (${data.x}, ${data.y})`);
    
    // Mark player as dead
    remotePlayer.isDead = true;
    
    // Hide the entire player element (contains sprite, nameplate, chat bubble)
    if (remotePlayer.element) {
        remotePlayer.element.style.visibility = 'hidden';
    }
    
    // Remove old gravestone if exists
    if (remotePlayer.gravestone) {
        remotePlayer.gravestone.remove();
    }
    
    // Create gravestone
    const gravestone = document.createElement('div');
    gravestone.className = 'remote-player-gravestone';
    gravestone.textContent = '🪦';
    gravestone.style.position = 'absolute';
    gravestone.style.fontSize = '64px';
    gravestone.style.zIndex = '9999';
    gravestone.style.filter = 'drop-shadow(3px 3px 6px rgba(0,0,0,0.7))';
    gravestone.style.pointerEvents = 'none';
    gravestone.style.left = `${data.x}px`;
    gravestone.style.top = `${data.y - 50}px`;
    gravestone.style.display = 'block';
    gravestone.style.transition = 'none';
    
    // Add name label to gravestone
    const nameLabel = document.createElement('div');
    nameLabel.textContent = data.name;
    nameLabel.style.position = 'absolute';
    nameLabel.style.bottom = '-25px';
    nameLabel.style.left = '50%';
    nameLabel.style.transform = 'translateX(-50%)';
    nameLabel.style.color = '#95a5a6';
    nameLabel.style.fontSize = '14px';
    nameLabel.style.fontFamily = "'Ari9500', cursive";
    nameLabel.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    nameLabel.style.whiteSpace = 'nowrap';
    gravestone.appendChild(nameLabel);
    
    document.getElementById('scaling-container').appendChild(gravestone);
    remotePlayer.gravestone = gravestone;
    
    console.log(`[Client] Gravestone created for ${data.name} at (${data.x}, ${data.y - 50})`);
}

/**
 * Handle remote player respawn (remove gravestone, show player)
 */
function handleRemotePlayerRespawn(data) {
    const remotePlayer = remotePlayers[data.odId];
    if (!remotePlayer) return;
    
    console.log(`[Client] ${remotePlayer.name} respawned`);
    
    // Mark player as alive
    remotePlayer.isDead = false;
    
    // Show the entire player element again
    if (remotePlayer.element) {
        remotePlayer.element.style.visibility = 'visible';
    }
    
    // Remove gravestone
    if (remotePlayer.gravestone) {
        remotePlayer.gravestone.remove();
        remotePlayer.gravestone = null;
    }
}

// Export broadcast function for other scripts
window.broadcastPlayerVFX = broadcastPlayerVFX;
window.sendPlayerDeath = sendPlayerDeath;
window.sendPlayerRespawn = sendPlayerRespawn;

// Export interpolation function for game loop
window.interpolateMonsterPositions = interpolateMonsterPositions;

// Auto-initialize when DOM is ready (if socket.io is loaded)
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other scripts to load
    setTimeout(() => {
        if (typeof io !== 'undefined') {
            initializeSocket();
        } else {
            console.log('[Socket] Socket.io not loaded - multiplayer disabled. Add socket.io client to enable.');
            socketInitialized = true; // Mark initialized so game can proceed with local monsters
        }
    }, 1000);
});
