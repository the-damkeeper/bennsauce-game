/**
 * BennSauce Socket Client
 * Handles real-time multiplayer connection to the game server
 * 
 * Phase 1: Player position synchronization
 * Phase 2: Client-Side Prediction with Server Reconciliation
 */

// Socket.io will be loaded from CDN in index.html
let socket = null;
let isConnectedToServer = false;
let hasJoinedServer = false; // Track if we've joined the server
let socketInitialized = false; // Track if socket initialization has completed (success or failure)
let remotePlayers = {}; // { odId: playerData }
let positionUpdateInterval = null;
let lastSentPosition = { x: 0, y: 0 };
let lastJoinedOdId = null; // Track the odId we joined with (for character switching)

// Ping/Latency tracking
let connectionPing = -1; // Current ping in ms (-1 = not measured yet)
let pingInterval = null;
let lastPingTime = 0;

// =============================================
// CLIENT-SIDE PREDICTION SYSTEM
// =============================================
// Pending attacks awaiting server confirmation
let pendingAttacks = {}; // { attackSeq: { timestamp, monsterId, predictedDamage, predictedHp, ... } }
let attackSequence = 0; // Incrementing sequence number for attacks

// Prediction configuration
const PREDICTION_CONFIG = {
    MAX_PENDING_ATTACKS: 20, // Maximum pending attacks before oldest are dropped
    ATTACK_TIMEOUT: 3000, // ms before a pending attack is considered lost
    CORRECTION_THRESHOLD: 50, // HP difference threshold before correction is needed
    POSITION_CORRECTION_THRESHOLD: 100, // Position difference before snap correction
    INTERPOLATION_SPEED: 0.15, // Lerp speed for smooth corrections
    OBSERVER_BUFFER_MS: 100 // Delay buffer for observers watching combat (smoother view)
};

/**
 * Generate a unique attack sequence number
 */
function generateAttackSequence() {
    attackSequence++;
    if (attackSequence > 999999) attackSequence = 1;
    return attackSequence;
}

/**
 * Clean up old pending attacks that timed out
 */
function cleanupPendingAttacks() {
    const now = Date.now();
    for (const seq in pendingAttacks) {
        if (now - pendingAttacks[seq].timestamp > PREDICTION_CONFIG.ATTACK_TIMEOUT) {
            console.log(`[Prediction] Attack ${seq} timed out, removing from pending`);
            delete pendingAttacks[seq];
        }
    }
    
    // Also limit total pending attacks
    const pendingKeys = Object.keys(pendingAttacks);
    while (pendingKeys.length > PREDICTION_CONFIG.MAX_PENDING_ATTACKS) {
        const oldestKey = pendingKeys.shift();
        delete pendingAttacks[oldestKey];
    }
}

// Configuration
const SOCKET_CONFIG = {
    SERVER_URL: 'https://bennsauce-server.onrender.com', // Change this for production
    POSITION_UPDATE_RATE: 33, // Send position every 33ms (~30 times/sec) for smoother movement
    POSITION_THRESHOLD: 1, // Only send if moved more than 1 pixel
    PING_INTERVAL: 5000 // Measure ping every 5 seconds
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
            reconnectionAttempts: 5, // Limit attempts to avoid spam
            reconnectionDelay: 3000, // Wait 3 seconds between attempts
            reconnectionDelayMax: 10000, // Max 10 seconds between attempts
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
        
        // Start ping measurement
        startPingMeasurement();
        
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
        stopPingMeasurement();
        connectionPing = -1;
        
        // Clear remote players and projectiles
        clearRemotePlayers();
        clearRemoteProjectiles();
        
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
    
    // Reconnection failed after all attempts
    socket.io.on('reconnect_failed', () => {
        console.error('[Socket] Reconnection failed after all attempts');
        isConnectedToServer = false;
        socketInitialized = true; // Mark as initialized so we can proceed
        
        // Disconnect and return to landing page
        if (typeof isGameActive !== 'undefined' && isGameActive) {
            if (typeof showNotification === 'function') {
                showNotification('Connection lost - returning to login', 'error');
            }
            // Short delay to show notification before logout
            setTimeout(() => {
                if (socket) {
                    socket.disconnect();
                }
                if (typeof logout === 'function') {
                    logout();
                } else {
                    window.location.reload();
                }
            }, 1500);
        }
    });
    
    // Reconnection attempt
    socket.io.on('reconnect_attempt', (attempt) => {
        console.log(`[Socket] Reconnection attempt ${attempt}`);
        if (typeof showNotification === 'function' && typeof isGameActive !== 'undefined' && isGameActive) {
            showNotification(`Reconnecting... (attempt ${attempt}/5)`, 'warning');
        }
    });
    
    // Successful reconnection
    socket.io.on('reconnect', (attempt) => {
        console.log(`[Socket] Reconnected after ${attempt} attempts`);
    });

    // Ping/Pong for latency measurement (using custom event names to avoid Socket.io reserved names)
    socket.on('latencyPong', () => {
        if (lastPingTime > 0) {
            connectionPing = Date.now() - lastPingTime;
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

    // Attack correction from server (prediction reconciliation)
    socket.on('attackCorrection', (data) => {
        handleAttackCorrection(data);
    });

    // Receive monster positions from server (server runs AI)
    socket.on('monsterPositions', (data) => {
        handleMonsterPositionsFromServer(data.monsters, data.t);
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
    
    // GM authentication result
    socket.on('gmAuthResult', (data) => {
        handleGMAuthResult(data);
    });
    
    // GM authorization status check result
    socket.on('gmAuthStatus', (data) => {
        window.isGMAuthorized = data.authorized;
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
    
    // Remote player projectile (visual only, no damage)
    socket.on('remoteProjectile', (data) => {
        createRemoteProjectile(data);
    });
    
    // Remote player projectile hit (stop/remove projectile)
    socket.on('remoteProjectileHit', (data) => {
        handleRemoteProjectileHit(data);
    });
    
    // Remote player skill VFX (melee attack effects, spell visuals)
    socket.on('remoteSkillVFX', (data) => {
        createRemoteSkillVFX(data);
    });
    
    // ==========================================
    // PARTY QUEST SOCKET HANDLERS
    // ==========================================
    
    // Party Quest started - warp all party members
    socket.on('partyQuestStarted', (data) => {
        handlePartyQuestStarted(data);
    });
    
    // PQ stage cleared - unlock next portal
    socket.on('pqStageCleared', (data) => {
        handlePQStageCleared(data);
    });
    
    // Party Quest completed
    socket.on('partyQuestCompleted', (data) => {
        handlePartyQuestCompleted(data);
    });
    
    // Party member left PQ
    socket.on('pqMemberLeft', (data) => {
        handlePQMemberLeft(data);
    });
    
    // PQ Error
    socket.on('pqError', (data) => {
        if (typeof showNotification === 'function') {
            showNotification(data.message, 'error');
        }
        console.warn('[PQ] Error:', data.message);
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
    lastJoinedOdId = joinData.odId; // Track the odId we joined with
    
    // Initialize monsters for this map after joining
    setTimeout(() => {
        initMapMonstersOnServer();
    }, 500);
}

/**
 * Rejoin the server with a new character (character switch)
 * This tells the server to clean up the old character and register the new one
 */
function rejoinWithNewCharacter() {
    if (!socket || !isConnectedToServer) return;
    if (typeof player === 'undefined' || !player) return;
    if (typeof currentMapId === 'undefined' || !currentMapId) return;

    console.log('[Socket] Rejoining with new character:', player.name);

    // Extract just item names from equipped
    const equippedNames = {};
    if (player.equipped) {
        for (const slot in player.equipped) {
            const item = player.equipped[slot];
            if (item) {
                equippedNames[slot] = typeof item === 'string' ? item : (item.name || null);
            } else {
                equippedNames[slot] = null;
            }
        }
    }
    
    // Also check cosmeticEquipped
    const cosmeticNames = {};
    if (player.cosmeticEquipped) {
        for (const slot in player.cosmeticEquipped) {
            const item = player.cosmeticEquipped[slot];
            cosmeticNames[slot] = item ? (typeof item === 'string' ? item : (item.name || null)) : null;
        }
    }

    // Get party info if available
    let partyId = null;
    if (typeof getPartyInfo === 'function') {
        const partyInfo = getPartyInfo();
        partyId = partyInfo.partyId || null;
    }

    const rejoinData = {
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
        partyId: partyId,
        oldOdId: lastJoinedOdId // Send the old odId so server can clean it up
    };
    
    // Clear remote players from old session
    clearRemotePlayers();
    clearRemoteProjectiles();
    
    // Update tracking
    if (!player.odId) {
        player.odId = rejoinData.odId;
    }
    lastJoinedOdId = rejoinData.odId;

    socket.emit('rejoin', rejoinData);
    hasJoinedServer = true;
    
    console.log('[Socket] Sent rejoin with new character:', player.name, 'odId:', player.odId);
    
    // Re-initialize monsters for this map
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
 * Start measuring ping to the server
 */
function startPingMeasurement() {
    if (pingInterval) {
        clearInterval(pingInterval);
    }
    
    // Measure immediately
    measurePing();
    
    // Then measure periodically
    pingInterval = setInterval(() => {
        measurePing();
    }, SOCKET_CONFIG.PING_INTERVAL);
}

/**
 * Stop measuring ping
 */
function stopPingMeasurement() {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
}

/**
 * Send a ping to measure latency
 */
function measurePing() {
    if (!socket || !isConnectedToServer) return;
    lastPingTime = Date.now();
    socket.emit('latencyPing');
}

/**
 * Get the current connection ping
 * @returns {number} Ping in milliseconds, or -1 if not connected
 */
function getConnectionPing() {
    return connectionPing;
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
    
    // Clear remote projectiles from old map
    clearRemoteProjectiles();
    
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
    console.log('[Socket] initMapMonstersOnServer called - currentMapId:', currentMapId);
    if (!socket || !isConnectedToServer) {
        console.log('[Socket] Skipping init - not connected');
        return;
    }
    if (typeof currentMapId === 'undefined' || !currentMapId) {
        console.log('[Socket] Skipping init - no mapId');
        return;
    }
    if (typeof maps === 'undefined' || !maps[currentMapId]) {
        console.log('[Socket] Skipping init - no map data');
        return;
    }
    
    // Don't re-initialize if already done for this map
    if (serverAuthoritativeMonsters && Object.keys(serverMonsterMapping).length > 0) {
        console.log('[Socket] Skipping init - already have', Object.keys(serverMonsterMapping).length, 'monsters');
        return;
    }
    
    const mapData = maps[currentMapId];
    if (!mapData.monsters || mapData.monsters.length === 0) {
        console.log('[Socket] Skipping init - no monster config');
        return;
    }
    
    console.log('[Socket] Proceeding with monster init...');
    
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
                aiType: mt.aiType || 'patrolling', // Static monsters don't move
                canJump: mt.canJump || false, // Whether monster can jump
                jumpForce: mt.jumpForce || -8 // Jump strength (negative = upward)
            };
        }
    }
    
    // Get map dimensions - use GAME_CONFIG.BASE_GAME_HEIGHT for physics calculations
    // This prevents exploits where players shrink their browser to bypass physics
    const scalingContainer = document.getElementById('scalingContainer');
    const mapWidth = mapData.width || (scalingContainer ? scalingContainer.clientWidth : GAME_CONFIG.BASE_GAME_WIDTH);
    const effectiveHeight = mapData.height || GAME_CONFIG.BASE_GAME_HEIGHT;
    const GROUND_Y = GAME_CONFIG.GROUND_Y;
    const groundY = effectiveHeight - GROUND_Y;
    
    console.log('[Socket] Spawn calc - mapHeight:', mapData.height, 'effectiveHeight:', effectiveHeight, 'groundY:', groundY);
    
    // Calculate spawn positions client-side (uses all the complex platform/slope logic)
    const spawnPositions = calculateMonsterSpawnPositions(mapData, mapWidth, groundY);
    
    console.log(`[Socket] Calculated ${spawnPositions.length} spawn positions for ${mapData.monsters?.length || 0} monster types`);
    console.log('[Socket] Monster config:', mapData.monsters);
    
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
        console.log(`[Socket] Processing spawner: type=${spawner.type}, count=${count}`);
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
            
            // Check if this is a fixed position spawn (like test dummy or boss)
            if (spawner.fixedPosition && spawner.x !== undefined) {
                // Use exact X coordinate provided
                spawnX = spawner.x;
                // Use ground surface for patrol bounds
                spawnSurface = allSpawnSurfaces[0]; // First surface is always ground
                // If Y is provided, use it; otherwise calculate from ground
                if (spawner.y !== undefined) {
                    spawnY = spawner.y;
                } else {
                    spawnY = spawnSurface.y - anchorY;
                }
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
    
    // Create the monster using existing game function, passing server data as initialState
    // CRITICAL: Pass serverMonster as initialState so createMonster() sees serverId
    const initialState = {
        serverId: serverMonster.id,
        hp: serverMonster.hp,
        maxHp: serverMonster.maxHp,
        isMiniBoss: serverMonster.isMiniBoss,
        isEliteMonster: serverMonster.isEliteMonster,
        isTrialBoss: serverMonster.isTrialBoss
    };
    const localMonster = createMonster(serverMonster.type, serverMonster.x, serverMonster.y, initialState);
    
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
    
    // Check if this is a response to our own attack (prediction reconciliation)
    const seq = data.seq;
    const pendingAttack = seq ? pendingAttacks[seq] : null;
    const isOurAttack = (typeof player !== 'undefined' && data.attackerId === player.odId);
    
    if (pendingAttack && isOurAttack) {
        // This is confirmation of our predicted attack
        const hpDifference = Math.abs(localMonster.hp - data.currentHp);
        
        if (hpDifference <= PREDICTION_CONFIG.CORRECTION_THRESHOLD) {
            // Prediction was close enough - just sync HP silently
            console.log(`[Prediction] Attack ${seq} confirmed (HP diff: ${hpDifference})`);
        } else {
            // Significant mismatch - apply correction with smooth transition
            console.log(`[Prediction] Attack ${seq} correction: local=${localMonster.hp} server=${data.currentHp} (diff=${hpDifference})`);
        }
        
        // Remove from pending
        delete pendingAttacks[seq];
        
        // Sync to server HP (authoritative) - we already showed damage number optimistically
        localMonster.hp = data.currentHp;
        
        // Update HP bar to authoritative value
        if (localMonster.hpBar) {
            localMonster.hpBar.style.width = `${Math.max(0, data.currentHp) / data.maxHp * 100}%`;
        }
        
        // For our own attacks, we already applied knockback optimistically
        // DON'T apply server knockback again - it would cause double knockback
        // Server position sync via interpolation will handle any minor corrections
        // (Knockback from OTHER players' attacks is handled in the else branch below)
        
        // Clear pending death visual if monster isn't actually dead
        if (data.currentHp > 0 && localMonster.pendingDeath) {
            localMonster.pendingDeath = false;
            if (localMonster.element) {
                localMonster.element.style.opacity = '1';
            }
        }
        
        return; // Skip redundant visual updates - we did them optimistically
    } else if (isOurAttack) {
        // Our attack but no sequence (legacy compatibility) - still sync HP
        localMonster.hp = data.currentHp;
    } else {
        // Damage from another player - show visual feedback
        localMonster.hp = data.currentHp;
        
        // Show damage number from other player (with slight delay for observer buffer)
        if (typeof showDamageNumber === 'function') {
            showDamageNumber(data.damage, localMonster.x + localMonster.width / 2, localMonster.y, data.isCritical, { isOtherPlayer: true });
        }
        
        // Flash effect for other player's hits
        if (!localMonster.flashTimer || localMonster.flashTimer <= 0) {
            localMonster.flashTimer = 10;
        }
        
        // Apply knockback from other player's attack
        if (data.knockbackVelocityX !== undefined && data.knockbackVelocityX !== 0 && !localMonster.noKnockback) {
            localMonster.velocityX = data.knockbackVelocityX;
            localMonster.knockbackEndTime = Date.now() + 500;
            localMonster.direction = data.knockbackVelocityX > 0 ? -1 : 1;
        }
    }
    
    // Update HP bar
    if (localMonster.hpBar) {
        localMonster.hpBar.style.width = `${Math.max(0, data.currentHp) / data.maxHp * 100}%`;
    }
    
    // Update mini boss HP bar if this is a mini boss
    if (localMonster.isMiniBoss && typeof updateMiniBossHPBar === 'function') {
        updateMiniBossHPBar(localMonster);
    }
    
    // Update elite monster HP bar if this is an elite
    if (localMonster.isEliteMonster && typeof updateEliteMonsterHPBar === 'function') {
        updateEliteMonsterHPBar(localMonster);
    }
    
    // Show HP bar and nameplate on hit
    if (localMonster.hpBarContainer) localMonster.hpBarContainer.style.display = 'block';
    if (localMonster.nameplateElement) localMonster.nameplateElement.style.display = 'block';
}

/**
 * Handle explicit attack correction from server
 * This is sent when the server detects a significant mismatch with client prediction
 */
function handleAttackCorrection(data) {
    console.log('[Prediction] Received attack correction:', data);
    
    const localMonster = serverMonsterMapping[data.monsterId];
    if (!localMonster) return;
    
    // Remove the pending attack if we have it
    if (data.seq && pendingAttacks[data.seq]) {
        delete pendingAttacks[data.seq];
    }
    
    // Check correction type
    if (data.type === 'hp_correction') {
        // HP mismatch - smoothly correct local HP
        const oldHp = localMonster.hp;
        localMonster.hp = data.correctHp;
        console.log(`[Prediction] HP corrected: ${oldHp} -> ${data.correctHp}`);
        
        // Update HP bar
        if (localMonster.hpBar && data.maxHp) {
            localMonster.hpBar.style.width = `${Math.max(0, data.correctHp) / data.maxHp * 100}%`;
        }
        
        // Update boss HP bars
        if (localMonster.isMiniBoss && typeof updateMiniBossHPBar === 'function') {
            updateMiniBossHPBar(localMonster);
        }
        if (localMonster.isEliteMonster && typeof updateEliteMonsterHPBar === 'function') {
            updateEliteMonsterHPBar(localMonster);
        }
    } else if (data.type === 'attack_invalid') {
        // Attack was rejected - restore HP if we predicted damage
        console.log(`[Prediction] Attack rejected by server: ${data.reason}`);
        if (data.correctHp !== undefined) {
            localMonster.hp = data.correctHp;
        }
        // Could show feedback to player that attack didn't register
    } else if (data.type === 'death_rollback') {
        // Monster wasn't actually dead - resurrect it
        console.log('[Prediction] Death rollback - monster not dead');
        localMonster.isDying = false;
        localMonster.pendingDeath = false;
        localMonster.hp = data.correctHp || 1;
        
        // Make sure visual is restored
        if (localMonster.element) {
            localMonster.element.classList.remove('monster-death');
            localMonster.element.style.opacity = '1';
        }
    }
}

/**
 * Handle monster death from server
 * Server is authoritative for death - this triggers loot, exp, and cleanup
 */
function handleMonsterKilledFromServer(data) {
    console.log('[Socket] Monster killed from server:', data);
    
    const localMonster = serverMonsterMapping[data.id];
    if (!localMonster) {
        console.log('[Socket] Local monster not found for id:', data.id);
        return;
    }
    
    // Clear any pending attack tracking for this monster
    for (const seq in pendingAttacks) {
        if (pendingAttacks[seq].monsterId === data.id) {
            delete pendingAttacks[seq];
        }
    }
    
    // Mark as dead (server authoritative)
    localMonster.isDead = true;
    localMonster.pendingDeath = false; // Confirmed by server
    localMonster.hp = 0;
    
    // Only start death animation if we haven't already (optimistic prediction may have started it)
    const alreadyDying = localMonster.isDying;
    localMonster.isDying = true;
    
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
    
    // Handle mini boss death
    if (localMonster.isMiniBoss) {
        if (typeof removeMiniBossHPBar === 'function') {
            removeMiniBossHPBar();
        }
    }
    
    // Play death animation only if not already started from optimistic prediction
    if (localMonster.element && !alreadyDying) {
        localMonster.element.classList.add('monster-death');
        localMonster.velocityY = -5;
        // Use player's facing direction for death knockback if we killed it, otherwise default right
        const weKilledIt = (typeof player !== 'undefined' && data.lootRecipient === player.odId);
        const deathKnockbackDir = weKilledIt && player.facing ? (player.facing === 'right' ? 1 : -1) : 1;
        localMonster.velocityX = deathKnockbackDir * 8;
    }
    
    // Check if we get the loot
    console.log('[Socket] Loot check - lootRecipient:', data.lootRecipient, 'player.odId:', typeof player !== 'undefined' ? player.odId : 'undefined');
    const weGetLoot = (typeof player !== 'undefined' && data.lootRecipient === player.odId);
    console.log('[Socket] weGetLoot:', weGetLoot);
    
    // Get monster data for EXP
    const monsterData = (typeof monsterTypes !== 'undefined' && monsterTypes[data.type]) ? monsterTypes[data.type] : null;
    
    // Create drops from server-provided drop list (same for all clients)
    if (data.drops && data.drops.length > 0 && typeof createItemDrop === 'function') {
        console.log('[Socket] Creating drops:', data.drops.length, 'items');
        let createdCount = 0;
        const beforeCount = typeof droppedItems !== 'undefined' ? droppedItems.length : 0;
        for (const drop of data.drops) {
            if (drop.name === 'Gold') {
                createItemDrop('Gold', drop.x, drop.y, { 
                    id: drop.id, // Use server-provided ID for reliable pickup sync
                    amount: drop.amount,
                    ownerId: data.lootRecipient,
                    ownerTimeout: Date.now() + 60000, // 60 seconds ownership
                    serverVelocityX: drop.velocityX,
                    serverVelocityY: drop.velocityY
                });
                createdCount++;
                // Track bestiary drops if we're the loot recipient
                if (weGetLoot && typeof updateBestiaryDrop === 'function') {
                    updateBestiaryDrop(data.type, 'Gold', drop.amount);
                }
            } else if (drop.name) {
                createItemDrop(drop.name, drop.x, drop.y, {
                    id: drop.id, // Use server-provided ID for reliable pickup sync
                    ownerId: data.lootRecipient,
                    ownerTimeout: Date.now() + 60000, // 60 seconds ownership
                    serverVelocityX: drop.velocityX,
                    serverVelocityY: drop.velocityY
                });
                createdCount++;
                // Track bestiary drops if we're the loot recipient
                if (weGetLoot && typeof updateBestiaryDrop === 'function') {
                    updateBestiaryDrop(data.type, drop.name);
                }
            }
        }
        const afterCount = typeof droppedItems !== 'undefined' ? droppedItems.length : 0;
        console.log(`[Socket] Drop creation complete: requested=${data.drops.length}, attempted=${createdCount}, actual new items=${afterCount - beforeCount}`);
    }
    
    // Check for trial boss kill (both loot recipient and party members can complete trials)
    if (typeof checkTrialBossKill === 'function') {
        checkTrialBossKill(data.type);
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
    
    // Check for Party Quest stage completion (defeat objective)
    checkPQStageCompletion(data.type, localMonster);
    
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
 * Send attack to server with client-side prediction
 * The client immediately applies damage (optimistic update) and waits for server confirmation
 */
function sendMonsterAttack(monsterId, damage, isCritical, attackType) {
    console.log('[Socket] sendMonsterAttack called:', { monsterId, damage, isCritical, serverAuth: serverAuthoritativeMonsters, connected: isConnectedToServer });
    if (!socket || !isConnectedToServer || !serverAuthoritativeMonsters) {
        console.log('[Socket] sendMonsterAttack blocked - socket:', !!socket, 'connected:', isConnectedToServer, 'serverAuth:', serverAuthoritativeMonsters);
        return false;
    }
    
    // Find the server ID for this monster
    let serverId = null;
    let localMonsterRef = null;
    for (const [sid, localMonster] of Object.entries(serverMonsterMapping)) {
        if (localMonster.id === monsterId || localMonster === monsterId || localMonster.serverId === monsterId) {
            serverId = sid;
            localMonsterRef = localMonster;
            break;
        }
    }
    
    if (!serverId) {
        // Monster not found in server mapping - might be a local-only monster
        return false;
    }
    
    // Generate sequence number for this attack
    const seq = generateAttackSequence();
    
    // Get current monster HP for prediction tracking
    const currentHp = localMonsterRef?.hp ?? 0;
    const predictedHp = Math.max(0, currentHp - damage);
    
    // Store pending attack for reconciliation
    pendingAttacks[seq] = {
        timestamp: Date.now(),
        monsterId: serverId,
        localMonsterId: monsterId,
        predictedDamage: damage,
        predictedHp: predictedHp,
        isCritical: isCritical || false,
        attackType: attackType || 'normal'
    };
    
    // Clean up old pending attacks
    cleanupPendingAttacks();
    
    console.log(`[Prediction] Attack seq=${seq} sent: monster=${serverId}, dmg=${damage}, predictedHp=${predictedHp}`);
    
    socket.emit('attackMonster', {
        seq: seq, // Include sequence number for server reconciliation
        monsterId: serverId,
        damage: damage,
        isCritical: isCritical || false,
        attackType: attackType || 'normal',
        playerDirection: typeof player !== 'undefined' && player.facing ? (player.facing === 'right' ? 1 : -1) : 1,
        predictedHp: predictedHp // Tell server what we expect
    });
    
    // OPTIMISTIC UPDATE: Apply damage locally immediately for instant feedback
    // The server will correct us if we're wrong
    applyOptimisticDamage(monsterId, damage, isCritical, attackType, seq);
    
    return true;
}

/**
 * Apply damage locally for immediate feedback (optimistic update)
 * Server will reconcile if there's a mismatch
 * Includes: damage numbers, knockback, flash effect, HP bar update
 */
function applyOptimisticDamage(monsterId, damage, isCritical, attackType, seq) {
    // Find the local monster
    if (typeof monsters === 'undefined' || !Array.isArray(monsters)) return;
    
    const monster = monsters.find(m => m && (m.id === monsterId || m.serverId === monsterId));
    if (!monster || monster.isDying) return;
    
    console.log(`[Prediction] Applying optimistic damage: seq=${seq}, monster=${monsterId}, dmg=${damage}, hp before=${monster.hp}`);
    
    // Apply damage locally
    monster.hp = Math.max(0, monster.hp - damage);
    
    // Show damage number immediately
    if (typeof showDamageNumber === 'function') {
        const monsterCenterX = monster.x + monster.width / 2;
        const monsterCenterY = monster.y + monster.height / 2;
        showDamageNumber(damage, monsterCenterX, monsterCenterY, isCritical);
    }
    
    // Update HP bar immediately for visual feedback
    if (monster.hpBar && monster.maxHp) {
        monster.hpBar.style.width = `${Math.max(0, monster.hp) / monster.maxHp * 100}%`;
    }
    
    // Update boss HP bars if applicable
    if (monster.isMiniBoss && typeof updateMiniBossHPBar === 'function') {
        updateMiniBossHPBar(monster);
    }
    if (monster.isEliteMonster && typeof updateEliteMonsterHPBar === 'function') {
        updateEliteMonsterHPBar(monster);
    }
    
    // Show HP bar and nameplate on hit
    if (monster.hpBarContainer) monster.hpBarContainer.style.display = 'block';
    if (monster.nameplateElement) monster.nameplateElement.style.display = 'block';
    
    // Flash effect for hit feedback
    if (!monster.flashTimer || monster.flashTimer <= 0) {
        monster.flashTimer = 10;
    }
    
    // OPTIMISTIC KNOCKBACK - Apply immediately for fluid feel
    // Server position sync will smoothly correct any mismatch
    if (!monster.noKnockback && typeof player !== 'undefined') {
        const knockbackForce = 6; // Match server KNOCKBACK_FORCE
        // Default to 'right' (1) if facing is not set - matches server fallback
        const knockbackDirection = player.facing ? (player.facing === 'right' ? 1 : -1) : 1;
        
        // Apply knockback velocity
        monster.velocityX = knockbackDirection * knockbackForce;
        
        // Make monster face the player (opposite of knockback)
        monster.direction = -knockbackDirection;
        
        // Set knockback timer to prevent server interpolation from fighting
        monster.knockbackEndTime = Date.now() + 500;
        
        console.log(`[Prediction] Optimistic knockback: dir=${knockbackDirection}, velocityX=${monster.velocityX}`);
    }
    
    // Check for death (optimistic) - start death animation immediately for responsiveness
    // Server will confirm and award loot/exp
    if (monster.hp <= 0 && !monster.isDying) {
        monster.pendingDeath = true;
        monster.pendingDeathSeq = seq;
        monster.isDying = true; // Start dying immediately
        console.log(`[Prediction] Monster ${monsterId} predicted death - starting death animation`);
        
        // Start full death animation immediately (not just fade)
        if (monster.element) {
            monster.element.classList.add('monster-death');
            monster.velocityY = -5; // Death bounce
            // Use player's facing direction for death knockback
            const deathKnockbackDir = player.facing ? (player.facing === 'right' ? 1 : -1) : 1;
            monster.velocityX = deathKnockbackDir * 8;
        }
        
        // Keep HP bar visible briefly showing 0% before fading with monster
        // Hide nameplate but let HP bar fade with the death animation
        if (monster.nameplateElement) monster.nameplateElement.style.display = 'none';
        // HP bar will be cleaned up when monster is fully removed
    }
    
    console.log(`[Prediction] Optimistic damage applied: hp after=${monster.hp}`);
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
 * Uses a pending queue to handle race conditions where pickup events
 * arrive before items are created on remote clients
 */
const pendingPickups = new Map(); // itemId -> { x, y, pickedUpBy, pickedUpByName, timestamp }

function handleItemPickedUp(data) {
    if (typeof droppedItems === 'undefined') return;
    
    const { itemId, x, y, pickedUpBy, pickedUpByName } = data;
    
    // Don't process our own pickups (we already handled it locally)
    if (typeof player !== 'undefined' && pickedUpBy === player.odId) {
        return;
    }
    
    console.log(`[Socket] ${pickedUpByName} picked up item at (${x}, ${y}), itemId: ${itemId}`);
    
    // Try to find and remove the item by ID only (no position fallback - it causes wrong matches)
    let found = false;
    for (let i = droppedItems.length - 1; i >= 0; i--) {
        const item = droppedItems[i];
        
        if (item.id === itemId) {
            // Play pickup VFX at item location
            if (typeof createPixelArtEffect === 'function') {
                createPixelArtEffect('spawnEffect', item.x, item.y, item.width, item.height);
            }
            
            // Remove the item element and from array
            if (item.element) {
                item.element.remove();
            }
            droppedItems.splice(i, 1);
            
            console.log(`[Socket] Removed item from local droppedItems (ID match)`);
            found = true;
            break;
        }
    }
    
    if (!found) {
        // Item not found - add to pending queue (will be removed when created)
        pendingPickups.set(itemId, { x, y, pickedUpBy, pickedUpByName, timestamp: Date.now() });
        console.log(`[Socket] Item not found yet, added to pending pickups queue. Queue size: ${pendingPickups.size}`);
        
        // Clean up old pending pickups after 10 seconds
        setTimeout(() => {
            if (pendingPickups.has(itemId)) {
                pendingPickups.delete(itemId);
                console.log(`[Socket] Cleaned up stale pending pickup: ${itemId}`);
            }
        }, 10000);
    }
}

/**
 * Check if a newly created item should be immediately removed (was already picked up)
 * Call this from createItemDrop after adding item to droppedItems
 */
function checkPendingPickup(itemId) {
    console.log(`[Socket] checkPendingPickup called for: ${itemId}, pending queue size: ${pendingPickups.size}`);
    if (pendingPickups.size > 0) {
        console.log(`[Socket] Pending items: ${Array.from(pendingPickups.keys()).join(', ')}`);
    }
    
    if (pendingPickups.has(itemId)) {
        const pickup = pendingPickups.get(itemId);
        pendingPickups.delete(itemId);
        console.log(`[Socket] ✓ Processing pending pickup for ${itemId} (picked up by ${pickup.pickedUpByName})`);
        
        // Find and remove the item that was just created
        for (let i = droppedItems.length - 1; i >= 0; i--) {
            if (droppedItems[i].id === itemId) {
                if (droppedItems[i].element) {
                    droppedItems[i].element.remove();
                }
                droppedItems.splice(i, 1);
                console.log(`[Socket] ✓ Removed pending pickup item from droppedItems`);
                break;
            }
        }
    }
}

// Export for use by createItemDrop
window.checkPendingPickup = checkPendingPickup;

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
    
    // Check if party has more than just ourselves (need at least 2 members to share)
    if (!partyInfo.members || partyInfo.members.length < 2) {
        return { shouldAddGold: true, amount: totalAmount, isSharing: false };
    }
    
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
window.rejoinWithNewCharacter = rejoinWithNewCharacter; // For character switching

// Expose the socket itself for direct access (needed for PQ events etc.)
window.getSocket = () => socket;

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
 * Server controls X position and AI state only
 * Client handles Y physics (gravity, jumping) locally using original offline logic
 */
function handleMonsterPositionsFromServer(monsterPositions, serverTimestamp) {
    if (!monsterPositions || !Array.isArray(monsterPositions)) return;
    
    const receiveTime = Date.now();
    
    for (const pos of monsterPositions) {
        const localMonster = serverMonsterMapping[pos.id];
        if (!localMonster || localMonster.isDead) continue;
        
        // Store previous position for velocity estimation if server velocity is 0
        localMonster.prevServerX = localMonster.serverTargetX;
        localMonster.prevServerTime = localMonster.serverTimestamp;
        
        // Store server X for interpolation
        localMonster.serverTargetX = pos.x;
        localMonster.serverFacing = pos.facing;
        localMonster.serverDirection = pos.direction;
        localMonster.serverAiState = pos.aiState;
        localMonster.serverVelocityX = pos.velocityX || 0;
        localMonster.serverTimestamp = pos.t || serverTimestamp || receiveTime;
        localMonster.lastServerUpdate = receiveTime;
    }
}

/**
 * Interpolation configuration for smooth monster movement
 * Tuned to prevent snapping while still handling high latency
 */
const INTERP_CONFIG = {
    BASE_LERP: 0.08,           // Slower base interpolation for smoother movement
    MAX_LERP: 0.25,            // Lower max lerp to prevent jitter
    SNAP_THRESHOLD: 400,       // Only snap for major teleports (was 200)
    SOFT_SNAP_THRESHOLD: 150,  // Slightly faster lerp if >150px off (was 100)
    EXTRAPOLATION_MAX: 80,     // Reduced extrapolation to prevent overshooting (was 150)
    STALE_THRESHOLD: 1000,     // Ignore updates older than 1 second
    VELOCITY_SMOOTHING: 0.5    // More smoothing on velocity changes
};

/**
 * Interpolate monster X positions toward server positions
 * Uses extrapolation and adaptive lerp for high-latency compensation
 * Server controls X, client handles all Y physics locally
 */
function interpolateMonsterPositions() {
    if (!serverAuthoritativeMonsters) return;
    
    const now = Date.now();
    const ping = connectionPing > 0 ? connectionPing : 50; // Default 50ms if not measured
    const halfPing = ping / 2; // One-way latency estimate
    
    for (const serverId in serverMonsterMapping) {
        const m = serverMonsterMapping[serverId];
        if (!m || m.isDead) continue;
        if (m.serverTargetX === undefined) continue;
        
        const timeSinceUpdate = now - (m.lastServerUpdate || 0);
        
        // Skip if update is too old (stale data)
        if (timeSinceUpdate > INTERP_CONFIG.STALE_THRESHOLD) continue;
        
        // Skip during active knockback (local physics takes over)
        if (m.knockbackEndTime && now < m.knockbackEndTime) continue;
        
        // After knockback ends, sync client position TO server authoritatively
        // This prevents the "snap back" by trusting the server's knockback result
        if (m.knockbackEndTime && now >= m.knockbackEndTime && now < m.knockbackEndTime + 100) {
            // Just ended knockback - snap to server position to prevent snap-back
            m.x = m.serverTargetX;
            m.knockbackEndTime = null; // Clear so we don't keep snapping
            continue;
        }
        
        // Use server position directly - minimal extrapolation for smooth movement
        let targetX = m.serverTargetX;
        
        // Only extrapolate for high ping (>100ms) and only a small amount
        const serverVelocity = m.serverVelocityX || 0;
        if (ping > 100 && Math.abs(serverVelocity) > 0.5) {
            // Smooth velocity to prevent sudden direction changes
            m.smoothedVelocityX = m.smoothedVelocityX || 0;
            m.smoothedVelocityX += (serverVelocity - m.smoothedVelocityX) * INTERP_CONFIG.VELOCITY_SMOOTHING;
            
            // Conservative extrapolation - only predict a fraction of the ping time
            const extrapolationTime = Math.min(halfPing * 0.5, INTERP_CONFIG.EXTRAPOLATION_MAX);
            const extrapolation = m.smoothedVelocityX * (extrapolationTime / 16.67);
            targetX += extrapolation;
        }
        
        const dx = targetX - m.x;
        const absDx = Math.abs(dx);
        
        // Instant snap for large desyncs (teleports, major lag spikes)
        if (absDx > INTERP_CONFIG.SNAP_THRESHOLD) {
            m.x = targetX;
        } else if (absDx < 0.5) {
            // Close enough, snap to exact position
            m.x = targetX;
        } else {
            // Smooth lerp interpolation
            let lerp = INTERP_CONFIG.BASE_LERP;
            
            // Only slightly increase lerp for high ping (subtle adjustment)
            if (ping > 150) {
                lerp *= 1.2; // 20% faster for high ping
            }
            
            // Gradual speed increase for larger distances (not sudden)
            if (absDx > INTERP_CONFIG.SOFT_SNAP_THRESHOLD) {
                lerp *= 1.3; // 30% faster, not 50%
            } else if (absDx > 50) {
                lerp *= 1.1; // Slight boost for medium distances
            }
            
            // Cap maximum lerp to prevent jitter
            lerp = Math.min(lerp, INTERP_CONFIG.MAX_LERP);
            
            // Apply interpolation
            m.x += dx * lerp;
        }
        
        // Update facing/direction
        if (m.serverDirection !== undefined) {
            m.direction = m.serverDirection;
            m.facing = m.direction === 1 ? 'right' : 'left';
            if (m.element && !m.isPixelArt) {
                m.element.style.transform = m.direction === 1 ? 'scaleX(1)' : 'scaleX(-1)';
            }
        }
        
        // Sync AI state for local jumping logic
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

// =============================================
// REMOTE PROJECTILE SYSTEM
// =============================================

// Store remote projectiles separately (visual only, no damage)
let remoteProjectiles = [];

// Queue of pending projectile hit events (in case hit arrives before projectile)
let pendingProjectileHits = [];

/**
 * Broadcast a projectile event to other players
 * @param {string} spriteName - Name of the projectile sprite
 * @param {number} x - Starting X position
 * @param {number} y - Starting Y position
 * @param {number} velocityX - X velocity
 * @param {number} velocityY - Y velocity
 * @param {number} angle - Angle in degrees
 * @param {boolean} isGrenade - Whether this is a grenade projectile
 * @param {boolean} isHoming - Whether this is a homing projectile
 */
function broadcastProjectile(projectileId, spriteName, x, y, velocityX, velocityY, angle, isGrenade, isHoming) {
    if (!socket || !isConnectedToServer) {
        console.log('[Projectile] Not broadcasting - not connected');
        return;
    }
    
    console.log('[Projectile] Broadcasting:', projectileId, spriteName, 'at', x, y, 'velocity:', velocityX, velocityY);
    
    socket.emit('playerProjectile', {
        projectileId: projectileId,
        spriteName: spriteName,
        x: x,
        y: y,
        velocityX: velocityX,
        velocityY: velocityY,
        angle: angle || 0,
        isGrenade: isGrenade || false,
        isHoming: isHoming || false
    });
}

/**
 * Broadcast when a projectile hits something and should stop
 * @param {number} projectileId - The unique ID of the projectile
 * @param {number} hitX - X position where the projectile hit
 * @param {number} hitY - Y position where the projectile hit
 */
function broadcastProjectileHit(projectileId, hitX, hitY) {
    if (!socket || !isConnectedToServer) return;
    
    console.log('[Projectile] Broadcasting hit:', projectileId, 'at', hitX, hitY);
    
    socket.emit('playerProjectileHit', {
        projectileId: projectileId,
        x: hitX,
        y: hitY
    });
}

/**
 * Create a visual-only projectile from a remote player
 * These projectiles don't deal damage - damage is handled by the originating player
 * @param {Object} data - Projectile data from server
 */
function createRemoteProjectile(data) {
    console.log('[Projectile] Creating remote projectile:', data.spriteName, 'at', data.x, data.y);
    
    // Check if we have sprites available
    if (typeof sprites === 'undefined' || !sprites[data.spriteName]) {
        console.warn('[Projectile] Sprite not found:', data.spriteName);
        return;
    }
    
    const worldContent = document.getElementById('world-content');
    if (!worldContent) {
        console.warn('[Projectile] worldContent not found');
        return;
    }
    
    const el = document.createElement('div');
    el.className = 'projectile remote-projectile';
    el.innerHTML = sprites[data.spriteName];
    const pWidth = 20, pHeight = 20;
    el.style.width = `${pWidth}px`;
    el.style.height = `${pHeight}px`;
    
    // Set initial position
    el.style.left = `${data.x}px`;
    el.style.top = `${data.y}px`;
    
    // Apply initial transform based on direction/angle
    if (data.angle && data.angle !== 0) {
        el.style.transform = `rotate(${data.angle}deg)`;
    } else if (data.velocityX < 0) {
        el.style.transform = 'scaleX(-1)';
    }
    
    const projectile = {
        id: data.projectileId, // Store the projectile ID for hit detection
        odId: data.odId, // Store owner's odId for matching
        x: data.x,
        y: data.y,
        width: pWidth,
        height: pHeight,
        velocityX: data.velocityX,
        velocityY: data.velocityY,
        element: el,
        createdAt: Date.now(),
        isGrenade: data.isGrenade,
        grounded: false
    };
    
    worldContent.appendChild(el);
    remoteProjectiles.push(projectile);
    console.log('[Projectile] Remote projectile created, id:', data.projectileId, 'odId:', data.odId, 'total:', remoteProjectiles.length);
    
    // Process any pending hits that may have arrived before this projectile
    processPendingProjectileHits();
}

/**
 * Handle a remote projectile hit event - stop and remove the projectile
 * @param {Object} data - Hit data from server { odId, projectileId, x, y }
 */
function handleRemoteProjectileHit(data) {
    console.log('[Projectile] Received hit event for projectile:', data.projectileId, 'from player:', data.odId, 'current remotes:', remoteProjectiles.map(p => ({id: p.id, odId: p.odId})));
    
    // Find and remove the matching projectile
    for (let i = remoteProjectiles.length - 1; i >= 0; i--) {
        const p = remoteProjectiles[i];
        if (p.id === data.projectileId && p.odId === data.odId) {
            console.log('[Projectile] Removing hit projectile:', p.id);
            if (p.element) {
                p.element.remove();
            }
            remoteProjectiles.splice(i, 1);
            return;
        }
    }
    
    // Projectile not found - queue the hit for later (may arrive before projectile creation)
    console.log('[Projectile] Hit projectile not found, queueing for later...');
    pendingProjectileHits.push({
        ...data,
        queuedAt: Date.now()
    });
}

/**
 * Process pending projectile hits - called after creating new projectiles
 */
function processPendingProjectileHits() {
    const now = Date.now();
    
    // Process pending hits
    for (let h = pendingProjectileHits.length - 1; h >= 0; h--) {
        const hit = pendingProjectileHits[h];
        
        // Remove stale pending hits (older than 2 seconds)
        if (now - hit.queuedAt > 2000) {
            pendingProjectileHits.splice(h, 1);
            continue;
        }
        
        // Try to find the projectile
        for (let i = remoteProjectiles.length - 1; i >= 0; i--) {
            const p = remoteProjectiles[i];
            if (p.id === hit.projectileId && p.odId === hit.odId) {
                console.log('[Projectile] Processing queued hit for projectile:', p.id);
                if (p.element) {
                    p.element.remove();
                }
                remoteProjectiles.splice(i, 1);
                pendingProjectileHits.splice(h, 1);
                break;
            }
        }
    }
}

/**
 * Update all remote projectiles (called from game loop)
 * Visual updates only - no collision/damage logic
 */
function updateRemoteProjectiles() {
    const now = Date.now();
    const GRAVITY = typeof window.GRAVITY !== 'undefined' ? window.GRAVITY : 0.5;
    
    for (let i = remoteProjectiles.length - 1; i >= 0; i--) {
        const p = remoteProjectiles[i];
        
        // Grenade physics (mimic local grenade behavior)
        if (p.isGrenade) {
            if (p.grounded) {
                p.velocityX *= 0.92;
                if (Math.abs(p.velocityX) < 0.1) p.velocityX = 0;
            } else {
                p.velocityY += GRAVITY;
            }
            
            // Simple ground check using map height
            const mapHeight = typeof maps !== 'undefined' && typeof currentMapId !== 'undefined' && maps[currentMapId] 
                ? (maps[currentMapId].height || 768) 
                : 768;
            const groundY = mapHeight - 110; // Approximate ground level
            
            if (!p.grounded && p.y + p.height >= groundY) {
                p.y = groundY - p.height;
                p.grounded = true;
                p.velocityY *= -0.4;
                if (Math.abs(p.velocityY) < 1) {
                    p.velocityY = 0;
                } else {
                    p.grounded = false;
                }
            }
            
            // Remove grenades after 2.5 seconds (a bit longer than fuse to account for explosion visual)
            if (now - p.createdAt > 2500) {
                p.element.remove();
                remoteProjectiles.splice(i, 1);
                continue;
            }
        } else {
            // Regular projectiles expire after 500ms
            if (now - p.createdAt > 500) {
                p.element.remove();
                remoteProjectiles.splice(i, 1);
                continue;
            }
        }
        
        // Update position
        p.x += p.velocityX;
        p.y += p.velocityY;
        
        // Update visual position
        p.element.style.left = `${p.x}px`;
        p.element.style.top = `${p.y}px`;
        
        // Remove if out of bounds
        const mapWidth = typeof maps !== 'undefined' && typeof currentMapId !== 'undefined' && maps[currentMapId] 
            ? maps[currentMapId].width 
            : 2000;
        const mapHeight = typeof maps !== 'undefined' && typeof currentMapId !== 'undefined' && maps[currentMapId] 
            ? (maps[currentMapId].height || 768) 
            : 768;
            
        if (p.x < -100 || p.x > mapWidth + 100 || p.y < -200 || p.y > mapHeight + 100) {
            p.element.remove();
            remoteProjectiles.splice(i, 1);
        }
    }
}

/**
 * Clear all remote projectiles (called on map change)
 */
function clearRemoteProjectiles() {
    for (const p of remoteProjectiles) {
        if (p.element) {
            p.element.remove();
        }
    }
    remoteProjectiles = [];
}

// =============================================
// REMOTE SKILL VFX SYSTEM
// =============================================

/**
 * Broadcast a skill VFX effect to other players
 * @param {string} effectName - Name of the effect sprite (e.g., 'slashBlastEffect', 'thunderboltEffect')
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width of the effect
 * @param {number} height - Height of the effect
 * @param {string} facing - Direction ('left' or 'right')
 * @param {number} duration - Duration in ms (default 300)
 */
function broadcastSkillVFX(effectName, x, y, width, height, facing, duration) {
    if (!socket || !isConnectedToServer) {
        console.log('[SkillVFX] Not broadcasting - not connected');
        return;
    }
    
    console.log('[SkillVFX] Broadcasting:', effectName, 'at', x, y);
    
    socket.emit('playerSkillVFX', {
        effectName: effectName,
        x: x,
        y: y,
        width: width || 150,
        height: height || 150,
        facing: facing || 'right',
        duration: duration || 300
    });
}

/**
 * Create a skill VFX effect from a remote player
 * These are visual-only effects (melee slashes, spell effects, etc.)
 * @param {Object} data - VFX data from server
 */
function createRemoteSkillVFX(data) {
    console.log('[SkillVFX] Creating remote skill VFX:', data.effectName, 'at', data.x, data.y);
    
    // Check if we have sprites available
    if (typeof sprites === 'undefined' || !sprites[data.effectName]) {
        console.warn('[SkillVFX] Sprite not found:', data.effectName);
        return;
    }
    
    const worldContent = document.getElementById('world-content');
    if (!worldContent) {
        console.warn('[SkillVFX] worldContent not found');
        return;
    }
    
    const el = document.createElement('div');
    el.className = 'attack-box remote-skill-vfx';
    el.innerHTML = sprites[data.effectName];
    el.style.position = 'absolute';
    el.style.left = `${data.x}px`;
    el.style.top = `${data.y}px`;
    el.style.width = `${data.width || 150}px`;
    el.style.height = `${data.height || 150}px`;
    el.style.background = 'none';
    el.style.border = 'none';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '15';
    
    // Apply facing direction
    if (data.facing === 'left') {
        el.style.transform = 'scaleX(-1)';
    }
    
    // Apply fade animation
    el.style.animation = `attack-fade ${(data.duration || 300) / 1000}s forwards`;
    
    worldContent.appendChild(el);
    
    // Remove after animation completes
    setTimeout(() => {
        if (el.parentNode) {
            el.remove();
        }
    }, data.duration || 300);
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
    gravestone.textContent = '';
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

/**
 * Request GM authentication from server
 * Password is verified server-side, not stored in client code
 */
function requestGMAuth(password) {
    if (!socket || !socket.connected) {
        if (typeof addChatMessage === 'function') {
            addChatMessage('Not connected to server!', 'error');
        }
        return;
    }
    
    socket.emit('gmAuth', { password });
}

/**
 * Handle GM authentication result from server
 */
function handleGMAuthResult(data) {
    if (data.success) {
        window.isGMAuthorized = true;
        
        // Grant GM Hat
        const gmHat = {
            name: 'GM Hat',
            type: 'helmet',
            stats: { attack: 999, defense: 999, hp: 99999, mp: 99999, str: 999, dex: 999, int: 999, luk: 999 },
            levelReq: 1,
            rarity: 'legendary',
            enhancement: 0
        };
        
        // Flag player as having used GM privileges
        if (typeof player !== 'undefined') {
            player.hasUsedGMPrivileges = true;
            if (typeof saveCharacter === 'function') saveCharacter();
        }
        
        if (typeof addItemToInventory === 'function' && addItemToInventory(gmHat)) {
            if (typeof addChatMessage === 'function') {
                addChatMessage('✨ GM access granted! GM Hat added to inventory.', 'legendary');
                addChatMessage('⚠️ Note: You are now ineligible for server-first medals.', 'system');
            }
            if (typeof showNotification === 'function') {
                showNotification('GM Access Granted', 'legendary');
            }
            if (typeof updateInventoryUI === 'function') {
                updateInventoryUI();
            }
        } else {
            if (typeof addChatMessage === 'function') {
                addChatMessage('✨ GM access granted! (Inventory full - clear space for GM Hat)', 'legendary');
            }
        }
    } else {
        window.isGMAuthorized = false;
        if (typeof addChatMessage === 'function') {
            addChatMessage(`GM authentication failed: ${data.message}`, 'error');
        }
    }
}

/**
 * Check if current session is GM authorized
 */
function checkGMAuth() {
    if (!socket || !socket.connected) {
        return false;
    }
    socket.emit('checkGmAuth');
}

// ==========================================
// PARTY QUEST HANDLER FUNCTIONS
// ==========================================

/**
 * Handle party quest starting - warp party members to PQ
 */
function handlePartyQuestStarted(data) {
    console.log('[PQ] Party Quest started:', data);
    
    // Check if this affects us
    const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : null;
    console.log('[PQ] My party info:', partyInfo);
    
    if (!partyInfo || !partyInfo.id) {
        console.log('[PQ] Not in a party, ignoring');
        return;
    }
    
    if (partyInfo.id !== data.partyId) {
        console.log('[PQ] Not in this party (' + partyInfo.id + ' vs ' + data.partyId + '), ignoring');
        return;
    }
    
    // Store original map for returning after PQ
    if (typeof player !== 'undefined') {
        player.pqOriginalMap = data.originalMap || currentMapId;
        player.pqOriginalX = data.originalX || 600;
        player.pqOriginalY = data.originalY || 300;
        console.log('[PQ] Stored original map:', player.pqOriginalMap);
    }
    
    // Show notification
    if (typeof showNotification === 'function') {
        showNotification('Party Quest Starting!', 'epic');
    }
    if (typeof addChatMessage === 'function') {
        addChatMessage('🎮 Your party is entering the Kerning Party Quest! Good luck!', 'quest-complete');
    }
    
    // Warp to PQ Stage 1
    console.log('[PQ] Warping to:', data.targetMap);
    if (typeof fadeAndChangeMap === 'function') {
        fadeAndChangeMap(data.targetMap, data.targetX, data.targetY);
    } else if (typeof changeMap === 'function') {
        changeMap(data.targetMap, data.targetX, data.targetY);
    }
}

/**
 * Handle PQ stage cleared notification
 */
function handlePQStageCleared(data) {
    console.log('[PQ] Stage cleared:', data);
    
    // Check if this affects us
    const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : null;
    if (!partyInfo || partyInfo.id !== data.partyId) {
        return;
    }
    
    // Show notification
    if (typeof showNotification === 'function') {
        showNotification(`Stage ${data.stage} Cleared!`, 'epic');
    }
    if (typeof addChatMessage === 'function') {
        addChatMessage(`🎉 Stage ${data.stage} cleared by ${data.clearedBy}!`, 'quest-complete');
    }
    
    // Store cleared stage for portal checking
    if (typeof window !== 'undefined') {
        window.pqClearedStages = window.pqClearedStages || {};
        window.pqClearedStages[data.pqId] = window.pqClearedStages[data.pqId] || [];
        if (!window.pqClearedStages[data.pqId].includes(data.stage)) {
            window.pqClearedStages[data.pqId].push(data.stage);
        }
    }
    
    // Start countdown and auto-warp if next stage exists
    if (data.nextMap && data.countdownSeconds) {
        startPQCountdown(data.countdownSeconds, data.nextMap, data.nextX, data.nextY);
    }
}

/**
 * Start countdown before warping to next PQ stage
 */
function startPQCountdown(seconds, nextMap, nextX, nextY) {
    let remaining = seconds;
    
    // Show initial countdown message
    if (typeof addChatMessage === 'function') {
        addChatMessage(`⏱️ Warping to next stage in ${remaining} seconds...`, 'system');
    }
    
    // Create or update countdown display
    let countdownDisplay = document.getElementById('pq-countdown-display');
    if (!countdownDisplay) {
        countdownDisplay = document.createElement('div');
        countdownDisplay.id = 'pq-countdown-display';
        countdownDisplay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.85);
            color: #ffd700;
            padding: 30px 50px;
            border-radius: 10px;
            font-size: 48px;
            font-weight: bold;
            z-index: 9999;
            text-align: center;
            border: 3px solid #ffd700;
            animation: pulse 1s infinite;
        `;
        document.body.appendChild(countdownDisplay);
        
        // Add pulse animation if not exists
        if (!document.getElementById('pq-countdown-style')) {
            const style = document.createElement('style');
            style.id = 'pq-countdown-style';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { transform: translate(-50%, -50%) scale(1); }
                    50% { transform: translate(-50%, -50%) scale(1.05); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    countdownDisplay.innerHTML = `⏱️ ${remaining}`;
    
    const countdownInterval = setInterval(() => {
        remaining--;
        
        if (remaining > 0) {
            countdownDisplay.innerHTML = `⏱️ ${remaining}`;
        } else {
            // Clear countdown
            clearInterval(countdownInterval);
            countdownDisplay.remove();
            
            // Warp to next stage
            if (typeof addChatMessage === 'function') {
                addChatMessage('🚀 Warping to next stage!', 'quest-complete');
            }
            
            if (typeof fadeAndChangeMap === 'function') {
                fadeAndChangeMap(nextMap, nextX, nextY);
            } else if (typeof changeMap === 'function') {
                changeMap(nextMap, nextX, nextY);
            }
        }
    }, 1000);
}

/**
 * Handle Party Quest completion
 */
function handlePartyQuestCompleted(data) {
    console.log('[PQ] Party Quest completed:', data);
    
    // Check if this affects us
    const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : null;
    if (!partyInfo || partyInfo.id !== data.partyId) {
        return;
    }
    
    // Show big celebration notification
    if (typeof showNotification === 'function') {
        showNotification('Party Quest Complete!', 'legendary');
    }
    if (typeof addChatMessage === 'function') {
        addChatMessage('🎉 Congratulations! Your party has completed the Kerning Party Quest!', 'quest-complete');
    }
    
    // Could add achievement tracking here
    if (typeof updateAchievementProgress === 'function') {
        updateAchievementProgress('action', 'complete_party_quest');
    }
}

/**
 * Handle party member leaving PQ
 */
function handlePQMemberLeft(data) {
    console.log('[PQ] Member left:', data);
    
    // Check if this affects us
    const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : null;
    if (!partyInfo || partyInfo.id !== data.partyId) {
        return;
    }
    
    // Notify remaining party members
    if (typeof addChatMessage === 'function') {
        addChatMessage(`${data.playerName} has left the Party Quest.`, 'system');
    }
}

/**
 * Check if a PQ stage has been cleared (for portal unlocking)
 */
function isPQStageCleared(pqId, stage) {
    if (!window.pqClearedStages || !window.pqClearedStages[pqId]) {
        return false;
    }
    return window.pqClearedStages[pqId].includes(stage);
}

/**
 * Send stage complete notification to server
 */
function sendPQStageComplete(pqId, stage) {
    if (!socket || !socket.connected) return;
    
    const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : null;
    if (!partyInfo) return;
    
    socket.emit('pqStageComplete', {
        pqId,
        partyId: partyInfo.id,
        stage
    });
}

/**
 * Send PQ completion notification to server
 */
function sendPQCompleted(pqId) {
    if (!socket || !socket.connected) return;
    
    const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : null;
    if (!partyInfo) return;
    
    socket.emit('pqCompleted', {
        pqId,
        partyId: partyInfo.id
    });
}

/**
 * Send leave PQ notification to server
 */
function sendLeavePQ(pqId) {
    if (!socket || !socket.connected) return;
    
    const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : null;
    if (!partyInfo) return;
    
    socket.emit('leavePQ', {
        pqId,
        partyId: partyInfo.id
    });
}

/**
 * Check if Party Quest stage is complete (all monsters defeated)
 */
function checkPQStageCompletion(monsterType, deadMonster) {
    // Check if we're in a PQ map
    if (typeof currentMapId === 'undefined' || typeof maps === 'undefined') return;
    
    const mapData = maps[currentMapId];
    if (!mapData || !mapData.isPartyQuest) return;
    
    // Update the PQ objective UI
    if (typeof updatePQObjectiveUI === 'function') {
        setTimeout(() => updatePQObjectiveUI(), 100); // Small delay to let monster be removed
    }
    
    // Only check defeat objectives
    if (mapData.pqObjective !== 'defeat' && mapData.pqObjective !== 'boss') return;
    
    // Count remaining alive monsters on this map
    const aliveMonsters = (typeof monsters !== 'undefined') 
        ? monsters.filter(m => m && !m.isDead && m !== deadMonster)
        : [];
    
    console.log('[PQ] Monsters remaining after kill:', aliveMonsters.length);
    
    // If all monsters are dead, stage is complete!
    if (aliveMonsters.length === 0) {
        console.log('[PQ] All monsters defeated! Stage complete!');
        
        const stage = mapData.pqStage;
        const pqId = mapData.pqId;
        
        // Send stage complete notification
        sendPQStageComplete(pqId, stage);
        
        // If this was the boss stage, send PQ completion
        if (mapData.pqObjective === 'boss') {
            console.log('[PQ] Boss defeated! Party Quest complete!');
            sendPQCompleted(pqId);
        }
    }
}

// Export GM auth functions
window.requestGMAuth = requestGMAuth;
window.checkGMAuth = checkGMAuth;
window.isGMAuthorized = false; // Default to not authorized

// Export broadcast function for other scripts
window.broadcastPlayerVFX = broadcastPlayerVFX;
window.sendPlayerDeath = sendPlayerDeath;
window.sendPlayerRespawn = sendPlayerRespawn;

// Export projectile functions for multiplayer sync
window.broadcastProjectile = broadcastProjectile;
window.broadcastProjectileHit = broadcastProjectileHit;
window.updateRemoteProjectiles = updateRemoteProjectiles;
window.clearRemoteProjectiles = clearRemoteProjectiles;
window.processPendingProjectileHits = processPendingProjectileHits;

// Export skill VFX functions for multiplayer sync
window.broadcastSkillVFX = broadcastSkillVFX;

// Export Party Quest functions
window.sendPQStageComplete = sendPQStageComplete;
window.sendPQCompleted = sendPQCompleted;
window.sendLeavePQ = sendLeavePQ;
window.isPQStageCleared = isPQStageCleared;

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
