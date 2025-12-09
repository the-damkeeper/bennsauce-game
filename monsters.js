/**
 * Elite Monster Event System
 */
let currentEliteMonster = null;
let eliteMonsterCheckInterval = null;

// Start checking for elite monster spawns
function startEliteMonsterSystem() {
    // Check every 2-7 minutes for a elite monster spawn
    const checkInterval = (2 + Math.random() * 5) * 60 * 1000; // 2-7 minutes
    
    eliteMonsterCheckInterval = setInterval(() => {
        attemptEliteMonsterSpawn();
    }, checkInterval);
}

function attemptEliteMonsterSpawn() {
    // Don't spawn if there's already a elite monster or no regular monsters
    if (currentEliteMonster || monsters.length === 0) return;
    
    // Don't spawn elite monsters on Dewdrop Island (tutorial area)
    const dewdropMaps = ['dewdropBeach', 'dewdropTraining', 'dewdropTraining2', 'dewdropTraining3', 
                         'dewdropVillage', 'dewdropForest', 'dewdropCave', 'dewdropJumpQuest', 'dewdropDocks'];
    if (dewdropMaps.includes(currentMapId)) return;
    
    // Don't spawn elite monsters in trial maps
    const currentMap = maps[currentMapId];
    if (currentMap && currentMap.isTrialMap) return;
    
    // 30% chance to spawn when check occurs
    if (Math.random() > 0.3) return;
    
    // Get eligible monsters (exclude bosses, test dummies, and elite monsters)
    const eligibleMonsters = monsters.filter(m => 
        !m.isMiniBoss && 
        !m.isEliteMonster && 
        m.type !== 'testDummy' &&
        !m.isDead
    );
    
    if (eligibleMonsters.length === 0) return;
    
    // Pick a random monster to transform
    const targetMonster = eligibleMonsters[Math.floor(Math.random() * eligibleMonsters.length)];
    transformToEliteMonster(targetMonster);
}

function transformToEliteMonster(monster) {
    // Mark as elite monster
    monster.isEliteMonster = true;
    monster.originalMaxHp = monster.maxHp;
    monster.originalDamage = monster.damage;
    
    // Boost stats
    monster.maxHp = monster.maxHp * 100;
    monster.hp = monster.maxHp;
    monster.damage = monster.damage * 3;
    
    // Add glowing effect (no size scaling to preserve anchor points)
    monster.element.classList.add('elite-monster');
    
    // Create elite monster HP bar at top of screen
    createEliteMonsterHPBar(monster);
    
    // Announce the elite monster
    addChatMessage(`⚠️ A ELITE ${monster.name.toUpperCase()} has appeared! ⚠️`, 'boss');
    playSound('quest'); // Use quest sound for dramatic effect
    
    currentEliteMonster = monster;
}

function createEliteMonsterHPBar(monster) {
    // Remove existing elite HP bar if any
    const existingBar = document.getElementById('elite-monster-hp-bar');
    if (existingBar) existingBar.remove();
    
    // Check if mini boss HP bar exists to adjust position
    const miniBossBarExists = document.getElementById('mini-boss-hp-bar') !== null;
    const topPosition = miniBossBarExists ? '140px' : '80px';
    
    // Create HP bar container
    const hpBarContainer = document.createElement('div');
    hpBarContainer.id = 'elite-monster-hp-bar';
    hpBarContainer.style.top = topPosition; // Dynamic positioning based on mini boss bar
    hpBarContainer.innerHTML = `
        <div class="elite-monster-name">ELITE ${monster.name.toUpperCase()}</div>
        <div class="elite-monster-hp-bar-container">
            <div class="elite-monster-hp-bar-fill" style="width: 100%"></div>
        </div>
        <div class="elite-monster-hp-text">${monster.hp.toLocaleString()} / ${monster.maxHp.toLocaleString()}</div>
    `;
    
    document.body.appendChild(hpBarContainer);
    monster.eliteHPBar = hpBarContainer.querySelector('.elite-monster-hp-bar-fill');
    monster.eliteHPText = hpBarContainer.querySelector('.elite-monster-hp-text');
}

function updateEliteMonsterHPBar(monster) {
    const hpBar = document.getElementById('elite-monster-hp-bar');
    
    // Recreate HP bar if it doesn't exist (happens after map change)
    if (!monster.eliteHPBar || !monster.eliteHPText || !hpBar) {
        createEliteMonsterHPBar(monster);
        return;
    }
    
    // Update position dynamically in case mini boss bar appears/disappears
    const miniBossBarExists = document.getElementById('mini-boss-hp-bar') !== null;
    hpBar.style.top = miniBossBarExists ? '140px' : '80px';
    
    const hpPercent = (monster.hp / monster.maxHp) * 100;
    monster.eliteHPBar.style.width = `${hpPercent}%`;
    monster.eliteHPText.textContent = `${Math.max(0, Math.floor(monster.hp)).toLocaleString()} / ${monster.maxHp.toLocaleString()}`;
}

function removeEliteMonsterHPBar() {
    const hpBar = document.getElementById('elite-monster-hp-bar');
    if (hpBar) hpBar.remove();
}

// ============================================
// WORLD BOSS EVENT SYSTEM (ARENA-BASED)
// ============================================
let worldBoss = null;
let worldBossTimer = null;
let worldBossDamageContribution = {};
let worldBossEventActive = false;
let worldBossMonster = null; // The actual monster entity in the arena
let playerOriginalMap = null; // Store player's location before warp
let playerOriginalX = null;
let worldBossAoeTimer = null; // Timer for AoE attacks
let activeAoeZones = []; // Track active AoE warning zones

// World boss definitions
const WORLD_BOSS_TYPES = {
    ancientDragon: {
        name: 'Ancient Dragon',
        icon: '🐉',
        baseHp: 1000000, // 1 million HP
        damage: 500,
        defense: 200,
        rewards: {
            gold: 50000,
            exp: 100000,
            items: ['dragonScale', 'legendaryBox']
        },
        abilities: ['fireBreath', 'tailSwipe', 'wingGust'],
        sprite: 'mushroom', // Use existing sprite
        scale: 3 // Make it big
    },
    voidTitan: {
        name: 'Void Titan',
        icon: '👁️',
        baseHp: 5000000, // 5 million HP
        damage: 750,
        defense: 250,
        rewards: {
            gold: 75000,
            exp: 150000,
            items: ['voidEssence', 'legendaryBox']
        },
        abilities: ['voidPulse', 'darkMatter', 'dimensionRip'],
        sprite: 'mushroom',
        scale: 4
    },
    stormColossus: {
        name: 'Storm Colossus',
        icon: '⚡',
        baseHp: 2500000, // 2.5 million HP
        damage: 600,
        defense: 220,
        rewards: {
            gold: 60000,
            exp: 120000,
            items: ['stormCore', 'legendaryBox']
        },
        abilities: ['thunderStrike', 'chainLightning', 'stormSurge'],
        sprite: 'mushroom',
        scale: 3.5
    }
};

// Initialize world boss event listener from Firebase
let worldBossPromptShown = false; // Track if we've shown the prompt for current event
let lastWorldBossEventId = null; // Track the event we've already seen

function initWorldBossSystem() {
    if (typeof db === 'undefined') {
        console.warn('Firebase not available for World Boss system');
        return;
    }
    
    // Listen for world boss events
    db.collection('events').doc('worldBoss').onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const eventId = data.startTime?.toMillis?.() || data.triggeredBy || 'unknown';
            
            if (data.active && !worldBossEventActive && !worldBossPromptShown) {
                // New world boss event started - show warp prompt (only once)
                if (lastWorldBossEventId !== eventId) {
                    lastWorldBossEventId = eventId;
                    worldBossPromptShown = true;
                    showWorldBossWarpPrompt(data);
                }
            } else if (!data.active && worldBossEventActive) {
                // World boss event ended - check if boss was defeated (has winner) or escaped
                const wasDefeated = !!data.winner;
                endWorldBossEvent(data.winner, wasDefeated);
                worldBossPromptShown = false; // Reset for next event
            } else if (data.active && worldBossEventActive) {
                // Update world boss HP from server
                updateWorldBossFromServer(data);
            } else if (!data.active) {
                // Event is not active, reset prompt flag for next event
                worldBossPromptShown = false;
            }
        }
    });
}

// Show prompt to warp to world boss arena
function showWorldBossWarpPrompt(data) {
    // Don't show if prompt already exists
    if (document.getElementById('world-boss-warp-prompt')) {
        return;
    }
    
    const bossType = WORLD_BOSS_TYPES[data.bossType] || WORLD_BOSS_TYPES.ancientDragon;
    
    // Create prompt overlay
    const prompt = document.createElement('div');
    prompt.id = 'world-boss-warp-prompt';
    prompt.innerHTML = `
        <div class="world-boss-prompt-content">
            <div class="world-boss-prompt-icon">${bossType.icon}</div>
            <div class="world-boss-prompt-title">⚠️ WORLD BOSS ALERT ⚠️</div>
            <div class="world-boss-prompt-name">${bossType.name}</div>
            <div class="world-boss-prompt-desc">A powerful world boss has appeared! Join forces with other players to defeat it!</div>
            <div class="world-boss-prompt-warning">You will be warped to a special arena and automatically join a party with all participants.</div>
            <div class="world-boss-prompt-buttons">
                <button class="world-boss-join-btn" onclick="joinWorldBossEvent('${data.bossType}')">Join Battle</button>
                <button class="world-boss-decline-btn" onclick="declineWorldBossEvent()">Not Now</button>
            </div>
            <div class="world-boss-prompt-timer">Event starts in: <span id="warp-countdown">30</span>s</div>
        </div>
    `;
    
    document.body.appendChild(prompt);
    
    // Play alert sound
    if (typeof playSound === 'function') playSound('quest');
    
    // Countdown - auto-decline after 30 seconds
    let countdown = 30;
    const countdownTimer = setInterval(() => {
        countdown--;
        const countdownEl = document.getElementById('warp-countdown');
        if (countdownEl) countdownEl.textContent = countdown;
        
        if (countdown <= 0) {
            clearInterval(countdownTimer);
            declineWorldBossEvent();
        }
    }, 1000);
    
    // Store timer ref for cleanup
    prompt.dataset.countdownTimer = countdownTimer;
}

// Player chooses to join world boss event
function joinWorldBossEvent(bossTypeKey) {
    // Remove prompt
    const prompt = document.getElementById('world-boss-warp-prompt');
    if (prompt) {
        clearInterval(parseInt(prompt.dataset.countdownTimer));
        prompt.remove();
    }
    
    // Store original location
    playerOriginalMap = currentMapId;
    playerOriginalX = player.x;
    
    // Spawn on left or right side of arena (not on boss in center)
    // Arena is 2000px wide, boss is at center (~1000px)
    // Left spawn: 150-350, Right spawn: 1650-1850
    const spawnOnLeft = Math.random() < 0.5;
    const spawnX = spawnOnLeft 
        ? 150 + Math.random() * 200  // Left side: 150-350
        : 1650 + Math.random() * 200; // Right side: 1650-1850
    
    // Warp to world boss arena
    if (typeof changeMap === 'function') {
        changeMap('worldBossArena', spawnX);
    }
    
    // Force join world boss party
    joinWorldBossParty();
    
    // Start the event for this player
    const bossType = WORLD_BOSS_TYPES[bossTypeKey] || WORLD_BOSS_TYPES.ancientDragon;
    startWorldBossEvent({ bossType: bossTypeKey, currentHp: bossType.baseHp });
    
    addChatMessage(`🌍 You have joined the World Boss battle!`, 'boss');
}

// Player declines world boss event
function declineWorldBossEvent() {
    const prompt = document.getElementById('world-boss-warp-prompt');
    if (prompt) {
        clearInterval(parseInt(prompt.dataset.countdownTimer));
        prompt.remove();
    }
    
    // Don't reset worldBossPromptShown - we don't want to show the prompt again for this event
    addChatMessage(`You declined the World Boss event.`, 'system');
}

// Force join a special world boss party with all participants
function joinWorldBossParty() {
    // Create or join the world boss party
    if (typeof player === 'undefined' || !player) return;
    
    // Set player's party to special world boss party
    player.party = {
        id: 'worldBossParty',
        name: 'World Boss Raid',
        leader: 'SYSTEM',
        members: [], // Will be populated by other players in arena
        isWorldBossParty: true
    };
    
    addChatMessage(`You joined the World Boss Raid party!`, 'party');
    
    // Update party UI if available
    if (typeof updatePartyUI === 'function') {
        updatePartyUI();
    }
}

function startWorldBossEvent(data) {
    worldBossEventActive = true;
    const bossTypeKey = data.bossType || 'ancientDragon';
    const bossType = WORLD_BOSS_TYPES[bossTypeKey] || WORLD_BOSS_TYPES.ancientDragon;
    
    // Use actual HP values (no scaling)
    const bossHp = bossType.baseHp;
    
    worldBoss = {
        type: bossTypeKey,
        name: bossType.name,
        icon: bossType.icon,
        hp: data.currentHp || bossHp,
        maxHp: bossHp,
        damage: bossType.damage,
        defense: bossType.defense || 100,
        rewards: bossType.rewards,
        startTime: data.startTime?.toDate() || new Date(),
        duration: typeof WORLD_BOSS_DURATION !== 'undefined' ? WORLD_BOSS_DURATION : 600000
    };
    
    worldBossDamageContribution = data.damageContribution || {};
    
    // Spawn the world boss monster in the arena
    spawnWorldBossMonster(bossTypeKey);
    
    // Create world boss UI (HP bar at top of screen)
    createWorldBossUI();
    
    // Show announcement
    addChatMessage(`🌍 WORLD BOSS: ${bossType.icon} ${bossType.name} - FIGHT!`, 'boss');
    showNotification(`World Boss Battle Started!`, 'boss');
    
    // Play dramatic sound
    if (typeof playSound === 'function') playSound('quest');
    
    // Start timer
    updateWorldBossTimer();
}

// Spawn the actual world boss monster entity in the arena
function spawnWorldBossMonster(bossTypeKey) {
    const bossType = WORLD_BOSS_TYPES[bossTypeKey] || WORLD_BOSS_TYPES.ancientDragon;
    const scale = bossType.scale || 3;
    const bossWidth = 64 * scale;
    const bossHeight = 64 * scale;
    
    // Create DOM element for the world boss
    const el = document.createElement('div');
    el.className = 'monster world-boss-monster';
    el.style.position = 'absolute';
    el.style.width = `${bossWidth}px`;
    el.style.height = `${bossHeight}px`;
    el.style.fontSize = `${48 * scale}px`;
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.zIndex = '100';
    el.style.filter = 'drop-shadow(0 0 20px rgba(255, 50, 50, 0.8))';
    el.innerHTML = `<span style="text-shadow: 0 0 30px #ff0000;">${bossType.icon}</span>`;
    
    // Create nameplate
    const nameplateEl = document.createElement('div');
    nameplateEl.className = 'monster-nameplate world-boss-nameplate';
    nameplateEl.innerHTML = `${bossType.name}`;
    nameplateEl.style.position = 'absolute';
    nameplateEl.style.bottom = `${bossHeight + 10}px`;
    nameplateEl.style.left = '50%';
    nameplateEl.style.transform = 'translateX(-50%)';
    nameplateEl.style.fontSize = '18px';
    nameplateEl.style.fontWeight = 'bold';
    nameplateEl.style.color = '#ff4444';
    nameplateEl.style.textShadow = '0 0 10px #000';
    nameplateEl.style.whiteSpace = 'nowrap';
    el.appendChild(nameplateEl);
    
    // Create hitbox element (for debugging)
    const monsterHitbox = document.createElement('div');
    monsterHitbox.className = 'debug-hitbox';
    el.appendChild(monsterHitbox);
    
    // Create monster entity for the world boss
    worldBossMonster = {
        id: 'world_boss_' + Date.now(),
        name: bossType.name,
        type: 'worldBoss',
        x: 950, // Center of arena
        y: 500, // Ground level
        previousY: 500,
        hp: worldBoss.hp,
        maxHp: worldBoss.maxHp,
        damage: bossType.damage,
        atk: bossType.damage,
        def: bossType.defense || 100,
        defense: bossType.defense || 100,
        isWorldBoss: true,
        sprite: bossType.sprite,
        scale: scale,
        icon: bossType.icon,
        direction: -1, // Face left by default
        facingLeft: true,
        width: bossWidth,
        height: bossHeight,
        element: el,
        hitboxElement: monsterHitbox,
        nameplateElement: nameplateEl,
        // Required properties for the game loop
        velocityX: 0,
        velocityY: 0,
        onPlatform: null,
        aiState: 'idle',
        previousAiState: 'idle',
        aiStateTimer: 9999, // Don't change state
        lastAttackTime: 0,
        attackCooldown: 3000,
        isJumping: false,
        isDead: false,
        isPixelArt: false,
        level: 999
    };
    
    // Add to world content
    if (typeof worldContent !== 'undefined') {
        worldContent.appendChild(el);
        
        // Position the element
        el.style.left = `${worldBossMonster.x}px`;
        el.style.top = `${worldBossMonster.y}px`;
    }
    
    // Add to monsters array if it exists
    if (typeof monsters !== 'undefined' && Array.isArray(monsters)) {
        monsters.push(worldBossMonster);
    }
    
    // Start AoE attack pattern
    startWorldBossAoeAttacks();
    
    console.log('World Boss monster spawned:', worldBossMonster);
}

// ============================================
// WORLD BOSS AOE ATTACK SYSTEM
// ============================================

function startWorldBossAoeAttacks() {
    if (worldBossAoeTimer) clearInterval(worldBossAoeTimer);
    
    // Create AoE attacks every 3-5 seconds
    const scheduleNextAoe = () => {
        if (!worldBossEventActive) return;
        
        const delay = 3000 + Math.random() * 2000; // 3-5 seconds
        worldBossAoeTimer = setTimeout(() => {
            if (worldBossEventActive && worldBoss) {
                createWorldBossAoeAttack();
                scheduleNextAoe();
            }
        }, delay);
    };
    
    // Start after 2 seconds
    setTimeout(scheduleNextAoe, 2000);
}

function createWorldBossAoeAttack() {
    if (!worldBossEventActive || !worldBoss) return;
    
    // Create 2-4 AoE zones at random positions
    const numZones = 2 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numZones; i++) {
        // Random position in the arena (avoiding edges)
        const x = 200 + Math.random() * 1600; // Arena is roughly 2000 wide
        const y = 300 + Math.random() * 400; // Ground area
        const radius = 80 + Math.random() * 60; // 80-140 pixel radius
        
        createAoeWarningZone(x, y, radius);
    }
}

function createAoeWarningZone(x, y, radius) {
    if (typeof worldContent === 'undefined') return;
    
    // Create warning reticle element
    const zone = document.createElement('div');
    zone.className = 'world-boss-aoe-zone';
    zone.style.cssText = `
        position: absolute;
        left: ${x - radius}px;
        top: ${y - radius}px;
        width: ${radius * 2}px;
        height: ${radius * 2}px;
        border-radius: 50%;
        border: 3px solid rgba(255, 0, 0, 0.8);
        background: radial-gradient(circle, rgba(255, 0, 0, 0.3) 0%, rgba(255, 0, 0, 0.1) 70%, transparent 100%);
        pointer-events: none;
        z-index: 50;
        animation: aoeWarningPulse 0.3s ease-in-out infinite;
    `;
    
    // Add reticle crosshairs
    zone.innerHTML = `
        <div style="position: absolute; top: 50%; left: 0; right: 0; height: 2px; background: rgba(255, 0, 0, 0.6); transform: translateY(-50%);"></div>
        <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: rgba(255, 0, 0, 0.6); transform: translateX(-50%);"></div>
        <div style="position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; border: 2px solid red; border-radius: 50%; transform: translate(-50%, -50%);"></div>
    `;
    
    worldContent.appendChild(zone);
    
    // Track zone data
    const zoneData = { element: zone, x, y, radius };
    activeAoeZones.push(zoneData);
    
    // Warning period (1.5 seconds), then damage
    setTimeout(() => {
        if (!worldBossEventActive) {
            zone.remove();
            return;
        }
        
        // Flash intensify before damage
        zone.style.background = 'radial-gradient(circle, rgba(255, 0, 0, 0.6) 0%, rgba(255, 50, 0, 0.4) 70%, transparent 100%)';
        zone.style.borderColor = 'rgba(255, 100, 0, 1)';
        
        // Deal damage after brief flash
        setTimeout(() => {
            dealAoeDamage(x, y, radius);
            
            // Create explosion effect
            createAoeExplosion(x, y, radius);
            
            // Remove zone
            zone.remove();
            const idx = activeAoeZones.indexOf(zoneData);
            if (idx > -1) activeAoeZones.splice(idx, 1);
        }, 300);
    }, 1500);
}

function dealAoeDamage(x, y, radius) {
    if (!player || !worldBoss) return;
    
    // Don't damage if player is invincible or dead
    if (player.isInvincible || player.isDead) return;
    
    // Check if player is in the zone
    const playerCenterX = player.x + (player.width || 40) / 2;
    const playerCenterY = player.y + (player.height || 80) / 2;
    
    const dx = playerCenterX - x;
    const dy = playerCenterY - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= radius + 30) { // +30 for player hitbox
        // Player is in the blast zone!
        const baseDamage = worldBoss.damage * (0.3 + Math.random() * 0.2); // 30-50% of boss damage
        const finalStats = typeof calculatePlayerStats === 'function' ? calculatePlayerStats() : { totalDefense: 0 };
        const damage = Math.max(1, Math.floor(baseDamage - (finalStats.totalDefense * 0.25)));
        
        // Check GM mode
        if (typeof isGmMode !== 'undefined' && isGmMode.infiniteStats) return;
        
        // Apply damage to player
        player.hp = Math.max(0, player.hp - damage);
        
        // Play hit sound
        if (typeof playSound === 'function') playSound('playerHit');
        
        // Visual feedback
        showFloatingDamage(player.x, player.y - 50, damage, true);
        
        // Update UI
        if (typeof updateUI === 'function') updateUI();
        
        // Brief invincibility after AoE hit
        player.isInvincible = true;
        if (typeof playerElement !== 'undefined' && playerElement) {
            playerElement.style.opacity = 0.5;
        }
        setTimeout(() => {
            if (!player.isDead) {
                player.isInvincible = false;
                if (typeof playerElement !== 'undefined' && playerElement) {
                    playerElement.style.opacity = 1;
                }
            }
        }, 1000);
        
        // Check for death
        if (player.hp <= 0 && typeof handlePlayerDeath === 'function') {
            handlePlayerDeath();
        }
    }
}

function createAoeExplosion(x, y, radius) {
    if (typeof worldContent === 'undefined') return;
    
    const explosion = document.createElement('div');
    explosion.className = 'world-boss-aoe-explosion';
    explosion.style.cssText = `
        position: absolute;
        left: ${x - radius}px;
        top: ${y - radius}px;
        width: ${radius * 2}px;
        height: ${radius * 2}px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 200, 0, 0.8) 0%, rgba(255, 100, 0, 0.6) 40%, rgba(255, 0, 0, 0.3) 70%, transparent 100%);
        pointer-events: none;
        z-index: 55;
        animation: aoeExplosion 0.5s ease-out forwards;
    `;
    
    worldContent.appendChild(explosion);
    
    // Remove after animation
    setTimeout(() => explosion.remove(), 500);
}

function showFloatingDamage(x, y, damage, isPlayerDamage = false) {
    if (typeof worldContent === 'undefined') return;
    
    const floater = document.createElement('div');
    floater.className = 'floating-damage';
    floater.textContent = `-${damage}`;
    floater.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        color: ${isPlayerDamage ? '#ff4444' : '#ffff00'};
        font-size: ${isPlayerDamage ? '24px' : '20px'};
        font-weight: bold;
        text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000;
        pointer-events: none;
        z-index: 100;
        animation: floatUp 1s ease-out forwards;
    `;
    
    worldContent.appendChild(floater);
    setTimeout(() => floater.remove(), 1000);
}

function stopWorldBossAoeAttacks() {
    if (worldBossAoeTimer) {
        clearTimeout(worldBossAoeTimer);
        worldBossAoeTimer = null;
    }
    
    // Clean up any active zones
    activeAoeZones.forEach(zone => {
        if (zone.element && zone.element.parentNode) {
            zone.element.remove();
        }
    });
    activeAoeZones = [];
}

function createWorldBossUI() {
    // Remove existing UI
    const existing = document.getElementById('world-boss-ui');
    if (existing) existing.remove();
    
    const ui = document.createElement('div');
    ui.id = 'world-boss-ui';
    ui.innerHTML = `
        <div class="world-boss-header">
            <span class="world-boss-icon">${worldBoss.icon}</span>
            <span class="world-boss-name">${worldBoss.name}</span>
            <span class="world-boss-timer" id="world-boss-timer">10:00</span>
        </div>
        <div class="world-boss-hp-container">
            <div class="world-boss-hp-bar" id="world-boss-hp-bar" style="width: ${(worldBoss.hp / worldBoss.maxHp) * 100}%"></div>
        </div>
        <div class="world-boss-hp-text" id="world-boss-hp-text">${formatNumber(worldBoss.hp)} / ${formatNumber(worldBoss.maxHp)}</div>
        <div class="world-boss-contribution">
            Your Damage: <span id="world-boss-your-damage">0</span>
        </div>
        <div class="world-boss-instructions">Attack the boss with your attacks!</div>
    `;
    
    document.body.appendChild(ui);
}

function updateWorldBossUI() {
    if (!worldBoss) return;
    
    const hpBar = document.getElementById('world-boss-hp-bar');
    const hpText = document.getElementById('world-boss-hp-text');
    const yourDamage = document.getElementById('world-boss-your-damage');
    
    if (hpBar) {
        hpBar.style.width = `${Math.max(0, (worldBoss.hp / worldBoss.maxHp) * 100)}%`;
    }
    if (hpText) {
        hpText.textContent = `${formatNumber(Math.max(0, worldBoss.hp))} / ${formatNumber(worldBoss.maxHp)}`;
    }
    if (yourDamage && player) {
        const myDamage = worldBossDamageContribution[player.name] || 0;
        yourDamage.textContent = formatNumber(myDamage);
    }
    
    // Also update monster HP
    if (worldBossMonster) {
        worldBossMonster.hp = worldBoss.hp;
    }
}

function updateWorldBossTimer() {
    if (!worldBoss || !worldBossEventActive) return;
    
    const timerEl = document.getElementById('world-boss-timer');
    if (!timerEl) return;
    
    const elapsed = Date.now() - worldBoss.startTime.getTime();
    const remaining = Math.max(0, worldBoss.duration - elapsed);
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (remaining > 0) {
        worldBossTimer = setTimeout(updateWorldBossTimer, 1000);
    } else {
        // Time's up - boss escapes
        endWorldBossEvent(null);
    }
}

// Throttle variables for batched Firebase writes
let worldBossSyncPending = false;
let worldBossLastSyncTime = 0;
const WORLD_BOSS_SYNC_INTERVAL = 2000; // Sync every 2 seconds max

// Called when player deals damage to world boss (from combat system)
function damageWorldBoss(damage, playerName) {
    if (!worldBoss || !worldBossEventActive) return;
    
    // Don't process damage if boss is already dead
    if (worldBoss.hp <= 0) return;
    
    // Round damage to integer
    damage = Math.floor(damage);
    
    // Debug logging
    if (window.worldBossDebug) {
        console.log(`[WB Debug] Damage received: ${damage.toLocaleString()}, From: ${playerName}`);
        console.log(`[WB Debug] HP before: ${worldBoss.hp.toLocaleString()}`);
    }
    
    // Apply damage locally
    worldBoss.hp = Math.max(0, worldBoss.hp - damage);
    
    // Track contribution
    if (!worldBossDamageContribution[playerName]) {
        worldBossDamageContribution[playerName] = 0;
    }
    worldBossDamageContribution[playerName] += damage;
    
    // Debug logging
    if (window.worldBossDebug) {
        console.log(`[WB Debug] HP after: ${worldBoss.hp.toLocaleString()}`);
        console.log(`[WB Debug] Total contribution by ${playerName}: ${worldBossDamageContribution[playerName].toLocaleString()}`);
    }
    
    // Update local UI immediately
    updateWorldBossUI();
    
    // Check if boss defeated
    if (worldBoss.hp <= 0) {
        // IMMEDIATELY sync boss death to Firebase - this is critical!
        if (typeof db !== 'undefined') {
            // Cancel any pending syncs
            worldBossSyncPending = false;
            
            // Force sync the death state right now
            db.collection('events').doc('worldBoss').update({
                currentHp: 0,
                active: false,
                winner: playerName,
                damageContribution: worldBossDamageContribution,
                deathTime: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                console.log('World Boss death synced to Firebase');
            }).catch(err => {
                console.warn('Failed to sync world boss death:', err);
            });
        }
        
        // End event locally
        endWorldBossEvent(playerName, true);
        return;
    }
    
    // Batch Firebase writes - only sync every 2 seconds to reduce costs (for non-death updates)
    const now = Date.now();
    if (typeof db !== 'undefined' && !worldBossSyncPending) {
        if (now - worldBossLastSyncTime >= WORLD_BOSS_SYNC_INTERVAL) {
            syncWorldBossToFirebase(playerName);
        } else {
            // Schedule a sync
            worldBossSyncPending = true;
            setTimeout(() => {
                if (worldBossEventActive && worldBoss && worldBoss.hp > 0) {
                    syncWorldBossToFirebase(playerName);
                }
                worldBossSyncPending = false;
            }, WORLD_BOSS_SYNC_INTERVAL - (now - worldBossLastSyncTime));
        }
    }
}

// Sync world boss state to Firebase
function syncWorldBossToFirebase(lastDamageBy) {
    if (typeof db === 'undefined' || !worldBoss) return;
    
    worldBossLastSyncTime = Date.now();
    
    const updateData = {
        currentHp: worldBoss.hp, // No scaling needed
        damageContribution: worldBossDamageContribution
    };
    
    // If boss is dead, mark the winner
    if (worldBoss.hp <= 0) {
        updateData.active = false;
        updateData.winner = lastDamageBy;
    }
    
    db.collection('events').doc('worldBoss').update(updateData)
        .catch(err => console.warn('Failed to sync world boss:', err));
}

function updateWorldBossFromServer(data) {
    if (!worldBoss || !worldBossEventActive) return;
    
    // Don't update if boss is already dead locally
    if (worldBoss.hp <= 0) return;
    
    worldBoss.hp = data.currentHp; // No scaling needed
    worldBossDamageContribution = data.damageContribution || {};
    updateWorldBossUI();
    
    // Check if boss is dead from another player
    if (worldBoss.hp <= 0 && worldBossEventActive) {
        endWorldBossEvent(data.winner, true); // true = boss was defeated
    }
}

function endWorldBossEvent(finalBlowPlayer, wasDefeated = false) {
    if (!worldBossEventActive) return;
    
    worldBossEventActive = false;
    
    if (worldBossTimer) {
        clearTimeout(worldBossTimer);
        worldBossTimer = null;
    }
    
    // Stop AoE attacks
    stopWorldBossAoeAttacks();
    
    // Remove world boss monster (both from array and DOM)
    if (worldBossMonster) {
        if (worldBossMonster.element && worldBossMonster.element.parentNode) {
            worldBossMonster.element.remove();
        }
        if (typeof monsters !== 'undefined') {
            const idx = monsters.indexOf(worldBossMonster);
            if (idx > -1) monsters.splice(idx, 1);
        }
    }
    worldBossMonster = null;
    
    // Calculate rewards - use wasDefeated flag instead of checking HP
    // (HP might not be synced yet on other players' clients)
    if (wasDefeated) {
        // Boss defeated!
        addChatMessage(`${worldBoss?.name || 'World Boss'} HAS BEEN DEFEATED!`, 'boss');
        if (finalBlowPlayer) {
            addChatMessage(`Final blow by: ${finalBlowPlayer}`, 'system');
        }
        
        // Give rewards based on contribution
        distributeWorldBossRewards();
    } else {
        // Boss escaped (timer ran out)
        addChatMessage(`${worldBoss?.name || 'World Boss'} has escaped...`, 'boss');
        showNotification('World Boss escaped! Better luck next time.', 'warning');
    }
    
    // Clean up UI
    const ui = document.getElementById('world-boss-ui');
    if (ui) {
        ui.classList.add('ending');
        setTimeout(() => ui.remove(), 2000);
    }
    
    // Leave world boss party
    if (player && player.party && player.party.isWorldBossParty) {
        player.party = null;
        if (typeof updatePartyUI === 'function') updatePartyUI();
    }
    
    // Warp player back to original location after 5 seconds
    warpBackFromArena(5000);
    
    // Reset sync variables
    worldBossSyncPending = false;
    worldBossLastSyncTime = 0;
    
    worldBoss = null;
    worldBossDamageContribution = {};
}

// Warp player back from world boss arena to their original location
function warpBackFromArena(delay = 0) {
    if (currentMapId !== 'worldBossArena') return;
    
    const doWarp = () => {
        if (currentMapId === 'worldBossArena' && playerOriginalMap) {
            addChatMessage(`📍 Returning to ${playerOriginalMap}...`, 'system');
            if (typeof changeMap === 'function') {
                changeMap(playerOriginalMap, playerOriginalX || 500);
            }
            playerOriginalMap = null;
            playerOriginalX = null;
        } else if (currentMapId === 'worldBossArena') {
            // Fallback if original map not set
            if (typeof changeMap === 'function') {
                changeMap('ironHaven', 500);
            }
        }
    };
    
    if (delay > 0) {
        setTimeout(doWarp, delay);
    } else {
        doWarp();
    }
}

// Check if player should be warped out of arena (called from handlePlayerDeath)
function checkWorldBossArenaOnDeath() {
    if (currentMapId === 'worldBossArena') {
        addChatMessage(`💀 You died in the World Boss arena! Warping back...`, 'system');
        
        // Force warp back - don't rely on event state
        const targetMap = playerOriginalMap || 'ironHaven';
        const targetX = playerOriginalX || 500;
        
        setTimeout(() => {
            if (currentMapId === 'worldBossArena' && typeof changeMap === 'function') {
                // Set bypass flag to allow leaving during death
                window.bypassWorldBossLeaveCheck = true;
                changeMap(targetMap, targetX);
                window.bypassWorldBossLeaveCheck = false;
                playerOriginalMap = null;
                playerOriginalX = null;
                // --- World Boss event cleanup for this player ---
                // Remove all AoE zones
                if (typeof activeAoeZones !== 'undefined') {
                    activeAoeZones.forEach(zone => {
                        if (zone.element && zone.element.parentNode) {
                            zone.element.remove();
                        }
                    });
                    activeAoeZones = [];
                }
                // Stop AoE timer
                if (typeof worldBossAoeTimer !== 'undefined' && worldBossAoeTimer) {
                    clearTimeout(worldBossAoeTimer);
                    worldBossAoeTimer = null;
                }
                // Do NOT remove damage contribution; boss HP should reflect all damage dealt
                // Mark player as not eligible for rewards
                window.worldBossEventLeft = true;
            }
        }, 2000);
        
        return true; // Indicate we're handling respawn differently
    }
    return false;
}

function distributeWorldBossRewards() {
    if (!worldBoss || !player) return;
    
    const myDamage = worldBossDamageContribution[player.name] || 0;
    const totalDamage = Object.values(worldBossDamageContribution).reduce((sum, d) => sum + d, 0);
    // If player left event, do not give rewards
    if (window.worldBossEventLeft) return;
    // Everyone who participated in the arena gets rewards!
    // Even 0 damage = participation rewards (they were there helping distract the boss)
    if (currentMapId !== 'worldBossArena' && myDamage === 0) {
        // Player wasn't in arena and didn't contribute
        return;
    }
    
    // Calculate contribution percentage (default to small amount if no damage)
    const contributionPercent = totalDamage > 0 ? (myDamage / totalDamage) * 100 : 0;
    
    // ============================================
    // SCALE REWARDS BASED ON PLAYER LEVEL
    // ============================================
    // EXP reward = percentage of player's maxExp (EXP needed to level)
    // Base: 15% of maxExp for participation
    // Bonus: Up to 35% more based on contribution (max 50% of maxExp for top contributor)
    // Gold scales similarly based on level
    
    const playerMaxExp = player.maxExp || 1000; // Fallback if not set
    const playerLevel = player.level || 1;
    
    // EXP: 15% base + up to 35% bonus = max 50% of a level for top contributor
    const baseExpPercent = 0.15;
    const bonusExpPercent = totalDamage > 0 ? 0.35 * (myDamage / totalDamage) : 0;
    const expReward = Math.floor(playerMaxExp * (baseExpPercent + bonusExpPercent));
    
    // Gold: Scale based on level (higher level = more gold needed)
    // Base gold = level * 500, scales with contribution
    const baseGoldAmount = playerLevel * 500;
    const baseGoldPercent = 0.20;
    const bonusGoldPercent = totalDamage > 0 ? 0.80 * (myDamage / totalDamage) : 0;
    const goldReward = Math.floor(baseGoldAmount * (baseGoldPercent + bonusGoldPercent));
    
    // Apply guild buffs if applicable
    let finalGold = goldReward;
    let finalExp = expReward;
    
    if (player.guild && player.guild.buffs) {
        if (player.guild.buffs.includes('goldBoost1')) finalGold *= 1.05;
        if (player.guild.buffs.includes('goldBoost2')) finalGold *= 1.05;
        if (player.guild.buffs.includes('goldBoost3')) finalGold *= 1.05;
        if (player.guild.buffs.includes('expBoost1')) finalExp *= 1.02;
        if (player.guild.buffs.includes('expBoost2')) finalExp *= 1.03;
        if (player.guild.buffs.includes('expBoost3')) finalExp *= 1.05;
    }
    
    finalGold = Math.floor(finalGold);
    finalExp = Math.floor(finalExp);
    
    // Actually give the rewards!
    player.gold += finalGold;
    
    // Use gainExp if available, otherwise add directly
    if (typeof gainExp === 'function') {
        gainExp(finalExp);
    } else {
        player.exp += finalExp;
        // Check for level up
        while (player.exp >= player.maxExp) {
            player.exp -= player.maxExp;
            if (typeof levelUp === 'function') levelUp();
        }
    }
    
    // Update UI
    if (typeof updateUI === 'function') updateUI();
    
    const contributionText = contributionPercent > 0 ? ` (${contributionPercent.toFixed(1)}% damage)` : ' (participation)';
    showNotification(`World Boss Rewards: ${formatNumber(finalGold)} Gold, ${formatNumber(finalExp)} EXP${contributionText}`, 'success');
    addChatMessage(`[World Boss] You received ${formatNumber(finalGold)} gold and ${formatNumber(finalExp)} EXP!`, 'guild');
}

// Helper for formatting large numbers
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
}

// Trigger a world boss event for ALL online players via Firebase
function triggerWorldBossEvent(bossType = 'ancientDragon') {
    if (worldBossEventActive) {
        addChatMessage('A World Boss event is already active!', 'error');
        return;
    }
    
    if (typeof db === 'undefined') {
        addChatMessage('Firebase not available - using local test mode', 'system');
        testWorldBoss(bossType);
        return;
    }
    
    const bossData = WORLD_BOSS_TYPES[bossType] || WORLD_BOSS_TYPES.ancientDragon;
    
    // Broadcast to all players via Firebase
    db.collection('events').doc('worldBoss').set({
        active: true,
        bossType: bossType,
        currentHp: bossData.baseHp,
        startTime: firebase.firestore.FieldValue.serverTimestamp(),
        damageContribution: {},
        triggeredBy: player?.name || 'System'
    }).then(() => {
        addChatMessage(`🌍 World Boss Event triggered! All online players will receive a notification.`, 'boss');
    }).catch(err => {
        console.error('Failed to trigger world boss event:', err);
        addChatMessage('Failed to trigger world boss event. Using local test mode.', 'error');
        testWorldBoss(bossType);
    });
}

// Test function - shows the prompt locally without Firebase broadcast
function testWorldBoss(bossType = 'ancientDragon') {
    if (worldBossEventActive) {
        console.log('World boss event already active!');
        return;
    }
    
    // Show the warp prompt like a real event would
    const testData = {
        bossType: bossType,
        active: true
    };
    
    showWorldBossWarpPrompt(testData);
    console.log(`World Boss Test: Showing prompt for ${bossType}`);
}

// Force start (skip prompt) - for debugging only
function forceStartWorldBoss(bossType = 'ancientDragon') {
    if (worldBossEventActive) {
        console.log('World boss event already active!');
        return;
    }
    
    // Skip the prompt and directly join
    playerOriginalMap = currentMapId;
    playerOriginalX = player?.x || 500;
    
    // Spawn on left or right side (not on boss)
    const spawnOnLeft = Math.random() < 0.5;
    const spawnX = spawnOnLeft ? 250 : 1750;
    
    if (typeof changeMap === 'function') {
        changeMap('worldBossArena', spawnX);
    }
    
    joinWorldBossParty();
    
    const testData = {
        active: true,
        bossType: bossType,
        currentHp: WORLD_BOSS_TYPES[bossType]?.baseHp || 10000000,
        startTime: { toDate: () => new Date() },
        damageContribution: {}
    };
    
    // Small delay to let map load
    setTimeout(() => {
        startWorldBossEvent(testData);
        console.log(`World Boss Force Start: ${bossType} spawned in arena!`);
    }, 500);
}

// End current world boss event (for testing)
function endWorldBossTest() {
    if (worldBossEventActive && worldBoss) {
        worldBoss.hp = 0;
        endWorldBossEvent(player?.name || 'Tester');
    }
}

// Expose functions
window.joinWorldBossEvent = joinWorldBossEvent;
window.declineWorldBossEvent = declineWorldBossEvent;
window.damageWorldBoss = damageWorldBoss;
window.initWorldBossSystem = initWorldBossSystem;
window.testWorldBoss = testWorldBoss;
window.triggerWorldBossEvent = triggerWorldBossEvent;
window.forceStartWorldBoss = forceStartWorldBoss;
window.endWorldBossTest = endWorldBossTest;
window.checkWorldBossArenaOnDeath = checkWorldBossArenaOnDeath;
window.warpBackFromArena = warpBackFromArena;

/**
 * Mini Boss HP Bar System
 */
function createMiniBossHPBar(monster) {
    // Remove existing mini boss HP bar if any
    const existingBar = document.getElementById('mini-boss-hp-bar');
    if (existingBar) existingBar.remove();
    
    // Create HP bar container
    const hpBarContainer = document.createElement('div');
    hpBarContainer.id = 'mini-boss-hp-bar';
    hpBarContainer.innerHTML = `
        <div class="mini-boss-name">${monster.name.toUpperCase()}</div>
        <div class="mini-boss-hp-bar-container">
            <div class="mini-boss-hp-bar-fill" style="width: 100%"></div>
        </div>
        <div class="mini-boss-hp-text">${monster.hp.toLocaleString()} / ${monster.maxHp.toLocaleString()}</div>
    `;
    
    document.body.appendChild(hpBarContainer);
    monster.miniBossHPBar = hpBarContainer.querySelector('.mini-boss-hp-bar-fill');
    monster.miniBossHPText = hpBarContainer.querySelector('.mini-boss-hp-text');
}

function updateMiniBossHPBar(monster) {
    // Recreate HP bar if it doesn't exist (happens after map change)
    if (!monster.miniBossHPBar || !monster.miniBossHPText || !document.getElementById('mini-boss-hp-bar')) {
        createMiniBossHPBar(monster);
    }
    
    const hpPercent = (monster.hp / monster.maxHp) * 100;
    monster.miniBossHPBar.style.width = `${hpPercent}%`;
    monster.miniBossHPText.textContent = `${Math.max(0, Math.floor(monster.hp)).toLocaleString()} / ${monster.maxHp.toLocaleString()}`;
}

function removeMiniBossHPBar() {
    const hpBar = document.getElementById('mini-boss-hp-bar');
    if (hpBar) hpBar.remove();
}

/**
 * Trial Boss Player Sprite Rendering System
 * Renders trial bosses as player characters with equipment
 */
function renderTrialBossSprite(monster) {
    if (!monster.customization || !monster.equipped) return;
    
    // Create sprite container if it doesn't exist
    if (!monster.spriteContainer) {
        monster.spriteContainer = document.createElement('div');
        monster.spriteContainer.style.position = 'absolute';
        monster.spriteContainer.style.width = '60px';
        monster.spriteContainer.style.height = '60px';
        monster.spriteContainer.style.top = '0';
        monster.spriteContainer.style.left = '0';
        monster.element.insertBefore(monster.spriteContainer, monster.element.firstChild);
    }

    // Create canvas if it doesn't exist
    let canvas = monster.spriteContainer.querySelector('canvas');
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
        canvas.style.imageRendering = 'pixelated';
        monster.spriteContainer.appendChild(canvas);
    }

    // Create hair tint canvas if needed
    if (!monster.hairTintCanvas) {
        monster.hairTintCanvas = document.createElement('canvas');
        monster.hairTintCanvas.width = canvas.width;
        monster.hairTintCanvas.height = canvas.height;
        monster.hairTintCtx = monster.hairTintCanvas.getContext('2d', { willReadFrequently: true });
        monster.hairTintCtx.imageSmoothingEnabled = false;
    }

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pData = spriteData.player;
    const anim = pData.animations[monster.animationState] || pData.animations.idle;
    const frameIndex = monster.animationFrame % anim.length;
    const frame = anim[frameIndex];

    ctx.save();
    if (monster.facing === 'left') {
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
    }

    // Use draw queue system (same as player/NPC)
    const drawQueue = [];

    // Add body layers
    const skinY = pData.frameHeight * (monster.customization.skinTone + 1);
    drawQueue.push({ type: 'body', zLevel: 1, source: playerSheetImage, sx: frame.x, sy: skinY, sWidth: pData.frameWidth, sHeight: pData.frameHeight });
    drawQueue.push({ type: 'body', zLevel: 5, source: playerSheetImage, sx: frame.x, sy: 0, sWidth: pData.frameWidth, sHeight: pData.frameHeight });

    // Add eyes
    if (monster.animationState !== 'climb' && frame.attachments?.eyes) {
        const faceItem = monster.equipped.face;
        const shouldHideEyes = faceItem && itemData[faceItem] && itemData[faceItem].hideEyes;

        if (!shouldHideEyes) {
            const eyeData = spriteData.playerEyes;
            const eyeSourceX = monster.isBlinking ? eyeData.frameWidth : 0;
            const eyeSourceY = eyeData.frameHeight * monster.customization.eyeColor;
            drawQueue.push({ type: 'eyes', zLevel: 10, source: playerEyesSheet, sx: eyeSourceX, sy: eyeSourceY, sWidth: eyeData.frameWidth, sHeight: eyeData.frameHeight, attachment: frame.attachments.eyes });
        }
    }

    // Add equipment
    const equipmentSheetData = spriteData.playerEquipment;
    const allSlots = ['cape', 'bottom', 'shoes', 'top', 'pendant', 'earring', 'gloves', 'helmet', 'weapon', 'face', 'eye'];
    allSlots.forEach(slot => {
        const itemName = monster.equipped[slot];
        if (itemName && equipmentSheetData.coords[itemName]) {
            const itemInfo = itemData[itemName];
            if (!itemInfo) return;
            const itemCoords = equipmentSheetData.coords[itemName];
            const sourceX = itemCoords.x + frame.x;
            const sourceY = itemCoords.y;
            let zLevel = itemInfo.zLevel;
            if (itemInfo.zLevelOverrides && itemInfo.zLevelOverrides[monster.animationState]) {
                zLevel = itemInfo.zLevelOverrides[monster.animationState];
            }
            
            drawQueue.push({ type: 'equip', zLevel: zLevel, source: playerEquipmentSheet, sx: sourceX, sy: sourceY, sWidth: pData.frameWidth, sHeight: pData.frameHeight });
        }
    });

    // Add hair - check if helmet hides hair
    const helmet = monster.equipped?.helmet;
    const helmetHidesHair = helmet && itemData[helmet]?.hidesHair;
    const hairStyleIndex = monster.customization.hairStyle || 0;
    const hairInfo = spriteData.playerHair[hairStyleIndex];
    const hairWorksWithHats = hairInfo?.worksWithHats;
    
    if (monster.customization && playerHairSheet && playerHairSheet.complete && (!helmetHidesHair || hairWorksWithHats)) {
        if (hairInfo && hairInfo.name !== 'Bald') {
            const hairColor = customizationOptions.hairColors[monster.customization.hairColor || 0];
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

    // Sort and render
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
            monster.hairTintCtx.clearRect(0, 0, canvas.width, canvas.height);
            monster.hairTintCtx.drawImage(item.source, item.sx, item.sy, item.sWidth, item.sHeight, destX, destY, destWidth, destHeight);

            const imageData = monster.hairTintCtx.getImageData(0, 0, canvas.width, canvas.height);
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
            monster.hairTintCtx.putImageData(imageData, 0, 0);
            ctx.drawImage(monster.hairTintCanvas, 0, 0);
        } else {
            ctx.drawImage(item.source, item.sx, item.sy, item.sWidth, item.sHeight, destX, destY, destWidth, destHeight);
        }
    });

    ctx.restore();
}

/**
 * Updates trial boss animation state and blinking (same system as ghost players)
 */
function updateTrialBossAnimation(monster) {
    if (!monster.usesPlayerSprite) return;
    
    // Update blink animation
    const BLINK_INTERVAL_MIN = 180, BLINK_INTERVAL_MAX = 480, BLINK_DURATION = 8;
    if (monster.isBlinking) {
        if (--monster.blinkDurationTimer <= 0) monster.isBlinking = false;
    } else {
        if (--monster.blinkTimer <= 0) {
            monster.isBlinking = true;
            monster.blinkDurationTimer = BLINK_DURATION;
            monster.blinkTimer = Math.floor(Math.random() * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN + 1)) + BLINK_INTERVAL_MIN;
        }
    }
    
    // Store previous animation state to detect changes
    const prevAnimationState = monster.animationState;
    
    // Determine animation state based on movement (same logic as ghost players)
    if (monster.isAttacking) {
        // Attack animation takes priority
        monster.animationState = 'attack';
    } else if (Math.abs(monster.velocityX) > 0.3 || (monster.aiState === 'chasing' && !monster.isJumping) || monster.aiState === 'patrolling') {
        // Walking when moving horizontally or patrolling/chasing on ground
        if (!monster.isJumping) {
            monster.animationState = 'walk';
        } else if (monster.velocityY < -1) {
            // Jumping upward
            monster.animationState = 'jump';
        } else if (monster.velocityY > 1) {
            // Falling
            monster.animationState = 'fall';
        }
    } else if (monster.isJumping && monster.velocityY < -1) {
        // Jumping upward
        monster.animationState = 'jump';
    } else if (monster.isJumping && monster.velocityY > 1) {
        // Falling
        monster.animationState = 'fall';
    } else {
        monster.animationState = 'idle';
    }
    
    // Update facing based on direction
    if (monster.direction === 1) {
        monster.facing = 'right';
    } else {
        monster.facing = 'left';
    }
    
    // Reset animation frame when state changes to prevent visual jumping
    if (prevAnimationState !== monster.animationState) {
        monster.animationFrame = 0;
        monster.animationTimer = 0;
    }
    
    // Frame animation timing (same as player/ghost - every 12 game ticks)
    monster.animationTimer++;
    if (monster.animationTimer > 12) {
        monster.animationTimer = 0;
        const anim = spriteData.player.animations[monster.animationState];
        if (anim) {
            monster.animationFrame = (monster.animationFrame + 1) % anim.length;
            
            // Clear attack state after animation completes
            if (monster.isAttacking && monster.animationFrame === 0) {
                monster.isAttacking = false;
            }
        }
    }
    
    // Render the monster sprite
    renderTrialBossSprite(monster);
}

/**
 * Creates a new monster and adds it to the game world.
 * @param {string} type - The type of monster to create (e.g., 'slime', 'mano').
 * @param {number} x - The initial X coordinate.
 * @param {number} y - The initial Y coordinate.
 * @param {object} [initialState=null] - Pre-defined state for loading a monster (e.g., saved HP).
 */

// in monsters.js

function createMonster(type, x, y, initialState = null) {
    const monsterData = monsterTypes[type];
    
    // Guard against invalid monster types (e.g., world boss which uses separate system)
    if (!monsterData) {
        console.warn(`createMonster: Unknown monster type "${type}"`);
        return null;
    }
    
    const el = document.createElement('div');
    el.className = 'monster';

    const newMonster = {
        ...monsterData,
        id: Math.random(),
        type, x, y, previousY: y,
        velocityX: 0, velocityY: 0,
        onPlatform: null,
        spawnFrameCount: 15, // Skip gravity for 15 frames to ensure stable spawn positioning
        spawnFadeFrames: -1, // -1 means fade hasn't started yet (starts after physics grace period)
        isSpawning: true, // Flag to prevent damage during spawn
        deathFadeFrames: 30, // For death fade-out animation (initialized to 30)
        element: el,
        direction: Math.random() < 0.5 ? 1 : -1,
        aiState: 'idle',
        previousAiState: 'idle',
        aiStateTimer: Math.random() * 120 + 60,
        lastAttackTime: 0,
        attackCooldown: 2000,
        isJumping: false,
        isDead: false,
        chaseStartTime: 0, // Track when chase started
        lastInteractionTime: 0 // Track last damage dealt/received
    };

    const monsterHitbox = document.createElement('div');
    monsterHitbox.className = 'debug-hitbox';
    el.appendChild(monsterHitbox);
    newMonster.hitboxElement = monsterHitbox;

    // Check if this is a trial boss with player-sprite appearance
    const trialBossAppearance = typeof trialBossAppearances !== 'undefined' ? trialBossAppearances[type] : null;
    
    if (monsterData.isTrialBoss && trialBossAppearance) {
        // Trial bosses use player sprite system - look like players with equipment!
        newMonster.usesPlayerSprite = true;
        newMonster.isPixelArt = true;
        newMonster.customization = trialBossAppearance.customization;
        newMonster.equipped = trialBossAppearance.equipped;
        newMonster.animationFrame = 0;
        newMonster.animationTimer = 0;
        newMonster.animationState = 'idle';
        newMonster.facing = newMonster.direction === 1 ? 'right' : 'left';
        newMonster.isBlinking = false;
        newMonster.blinkTimer = Math.floor(Math.random() * 300) + 180;
        newMonster.blinkDurationTimer = 0;
        newMonster.isAttacking = false; // Track attack animation state
        
        // Use player sprite dimensions
        const pData = spriteData.player;
        el.classList.add('pixel-art');
        el.classList.add('player-sprite');
        el.classList.add('trial-boss-player');
        el.style.width = '60px';
        el.style.height = '60px';
        
        // Set monster hitbox to match the intended collision size
        newMonster.width = 40; // Collision width
        newMonster.height = 60; // Collision height
    } else if (type === 'snail' || type === 'blueSnail' || type === 'redSnail' || type === 'slime' || type === 'babySlime' || type === 'babyRedSlime' || type === 'babyBlueSlime' || type === 'orangeMushroom' || type === 'stump' || type === 'darkStump' || type === 'axeStump' || type === 'redSlime' || type === 'blueSlime' || type === 'testDummy' || type === 'mano' || type === 'mushmom') {
        const sData = spriteData[type];
        newMonster.isPixelArt = true;
        el.classList.add('pixel-art'); // Add pixel-art class for crisp rendering
        el.style.width = `${sData.frameWidth * PIXEL_ART_SCALE}px`;
        el.style.height = `${sData.frameHeight * PIXEL_ART_SCALE}px`;
        el.style.backgroundImage = `url(${artAssets[type]})`;
        
        // For testDummy, use total frames (idle + hit), otherwise use idle animation length
        let totalFrames = sData.animations.idle.length;
        if (type === 'testDummy') {
            totalFrames = sData.animations.idle.length + (sData.animations.hit ? sData.animations.hit.length : 0);
        }
        const sheetWidth = sData.frameWidth * totalFrames * PIXEL_ART_SCALE;
        el.style.backgroundSize = `${sheetWidth}px ${sData.frameHeight * PIXEL_ART_SCALE}px`;
    } else {
        newMonster.isPixelArt = false;
        if (monsterData.isMiniBoss) el.classList.add('mini-boss');
        el.innerHTML = monsterData.sprite;
        el.style.width = `${monsterData.width}px`;
        el.style.height = `${monsterData.height}px`;
    }

    // --- THIS IS THE FIX ---
    // The nameplate and HP bar are now created AFTER the monster's visuals are set,
    // ensuring they are never overwritten and exist on all monster types.
    const nameplateEl = document.createElement('div');
    nameplateEl.className = 'monster-nameplate';
    nameplateEl.innerHTML = `Lvl.${newMonster.level} ${newMonster.name}`;
    el.appendChild(nameplateEl);
    newMonster.nameplateElement = nameplateEl;

    const hpBarContainer = document.createElement('div');
    hpBarContainer.className = 'monster-hp-bar-container';
    const hpBarFill = document.createElement('div');
    hpBarFill.className = 'monster-hp-bar-fill';
    hpBarContainer.appendChild(hpBarFill);
    el.appendChild(hpBarContainer);
    newMonster.hpBar = hpBarFill;
    newMonster.hpBarContainer = hpBarContainer;
    
    // Special adjustments for test dummies and pixel art bosses
    if (type === 'testDummy') {
        hpBarContainer.style.display = 'none';
        // Position nameplate below the sprite (96px height + a few pixels)
        nameplateEl.style.top = '100px';
    } else if (newMonster.usesPlayerSprite) {
        // Trial boss with player sprite - nameplate positioned via CSS
        // But hide the individual HP bar since trial bosses use the mini boss HP bar
        hpBarContainer.style.display = 'none';
    } else if (monsterData.isPixelArt && spriteData[type]) {
        // For pixel art monsters, position nameplate based on actual sprite height
        const scale = 3;
        const spriteHeight = spriteData[type].frameHeight * scale;
        nameplateEl.style.top = `${spriteHeight + 8}px`;
    }
    // --- END OF FIX ---

    worldContent.appendChild(el);
    
    // Start invisible for spawn fade-in effect
    el.style.opacity = '0';

    if (initialState) {
        newMonster.id = initialState.id;
        newMonster.hp = initialState.hp;
        newMonster.direction = initialState.direction;
        
        // Restore elite monster state if this was a elite monster
        if (initialState.isEliteMonster) {
            newMonster.isEliteMonster = true;
            newMonster.maxHp = initialState.maxHp;
            newMonster.originalMaxHp = initialState.originalMaxHp;
            newMonster.originalDamage = initialState.originalDamage;
            newMonster.damage = initialState.damage;
            el.classList.add('elite-monster');
            currentEliteMonster = newMonster;
            createEliteMonsterHPBar(newMonster);
        } else {
            newMonster.maxHp = monsterData.hp;
        }
    } else {
        newMonster.hp = monsterData.hp;
        newMonster.maxHp = monsterData.hp;
    }
    
    // Create mini boss HP bar if this is a mini boss or trial boss
    if ((monsterData.isMiniBoss || monsterData.isTrialBoss) && !newMonster.isEliteMonster) {
        createMiniBossHPBar(newMonster);
    }

    monsters.push(newMonster);
    
    // Initial render for player-sprite trial bosses
    if (newMonster.usesPlayerSprite) {
        renderTrialBossSprite(newMonster);
    }
    
    // Add to spatial grid for optimized collision detection
    if (typeof spatialGrid !== 'undefined') {
        spatialGrid.addEntity(newMonster);
        newMonster._inGrid = true;
    }
    
    // Return the created monster for server sync
    return newMonster;
}

/**
 * Validates that all monsters in the current map belong there.
 * Removes any monsters that shouldn't be on this map (e.g., followed from previous map).
 * @param {string} mapId - The current map ID
 */
function validateMonstersForMap(mapId) {
    const map = maps[mapId];
    if (!map) return;
    
    // Build a set of valid monster types for this map
    const validTypes = new Set();
    if (map.monsters) {
        map.monsters.forEach(m => validTypes.add(m.type));
    }
    
    // Check each monster and remove invalid ones
    const invalidMonsters = [];
    monsters = monsters.filter(m => {
        // If this map has no monsters defined, remove all monsters
        if (validTypes.size === 0) {
            invalidMonsters.push(m);
            return false;
        }
        
        // Check if this monster type belongs on this map
        if (!validTypes.has(m.type)) {
            console.warn(`[Monster Validation] Removing invalid monster "${m.type}" from map "${mapId}"`);
            invalidMonsters.push(m);
            return false;
        }
        
        return true;
    });
    
    // Clean up removed monsters
    invalidMonsters.forEach(m => {
        if (m.element && m.element.parentElement) {
            m.element.remove();
        }
        if (typeof spatialGrid !== 'undefined' && m._inGrid) {
            spatialGrid.removeEntity(m);
        }
    });
    
    if (invalidMonsters.length > 0) {
        console.log(`[Monster Validation] Removed ${invalidMonsters.length} invalid monster(s) from "${mapId}"`);
    }
}


function updateMonsters() {
    const map = maps[currentMapId];
    
    // Filter out any monsters that shouldn't exist (safety check for portal transitions)
    monsters = monsters.filter(m => {
        // If monster has no element or element is not in DOM, remove it
        if (!m.element || !m.element.parentElement) {
            if (typeof spatialGrid !== 'undefined' && m._inGrid) {
                spatialGrid.removeEntity(m);
            }
            return false;
        }
        return true;
    });

    monsters.forEach(m => {
        // --- NEW LOGIC FOR DEAD MONSTERS ---
        // This block now handles physics AND collision for dying monsters.
        if (m.isDead) {
            // Death fade-out effect (30 frames = ~300ms)
            if (m.deathFadeFrames > 0) {
                m.deathFadeFrames--;
                const fadeProgress = m.deathFadeFrames / 30; // Fade from 1 to 0
                m.element.style.setProperty('opacity', String(fadeProgress), 'important');
            }
            
            // Apply physics
            m.x += m.velocityX;
            m.velocityX *= 0.85; // Slower friction for a better knockback feel
            m.velocityY += GRAVITY;
            m.y += m.velocityY;

            // Apply collision detection
            // For trial bosses with player sprites, use player sprite anchor
            let anchorY;
            if (m.usesPlayerSprite && spriteData?.player?.anchorPoint) {
                anchorY = spriteData.player.anchorPoint.y * PIXEL_ART_SCALE;
            } else if (m.isPixelArt && spriteData[m.type]?.anchorPoint) {
                anchorY = spriteData[m.type].anchorPoint.y * PIXEL_ART_SCALE;
            } else {
                anchorY = m.height || 55;
            }
            let onAnySurface = false;

            platforms.forEach(p => {
                if (p.isLadder || p.y === undefined) return;
                if (isColliding(m, p) && m.velocityY >= 0 && (m.y - m.velocityY + anchorY) <= p.y) {
                    m.y = p.y - anchorY;
                    m.velocityY = 0; // Stop vertical movement
                    m.velocityX *= 0.7; // Add friction when hitting a surface
                    onAnySurface = true;
                }
            });

            const groundLevel = (map.height || scalingContainer.clientHeight) - GAME_CONFIG.GROUND_Y;
            const monsterCenterX = m.x + m.width / 2;
            const slopeSurfaceY = getSlopeSurfaceY(monsterCenterX, map, groundLevel, 48);
            const monsterBottom = m.y + anchorY;
            const distanceToSlope = monsterBottom - slopeSurfaceY;
            // Snap to slope if close enough (above or below)
            if (!onAnySurface && distanceToSlope >= -50 && distanceToSlope <= 100) {
                m.y = slopeSurfaceY - anchorY;
                m.velocityY = 0;
                m.velocityX *= 0.7;
            }
            return;
        };

        // --- LOGIC FOR LIVING MONSTERS ---
        // For multiplayer: Server runs AI for X movement, client handles Y (physics/gravity)
        const serverRunsAI = typeof window.isServerAuthoritativeMonsters === 'function' && window.isServerAuthoritativeMonsters();
        
        if (!serverRunsAI) {
            // Single-player mode: run local AI
            updateMonsterAI(m);
            
            // Apply physics
            m.x += m.velocityX;
            m.velocityX *= 0.85; // Friction
        } else {
            // Multiplayer mode: X position comes from server via interpolation
            // Still apply local knockback physics for responsiveness
            if (Math.abs(m.velocityX) > 0.1) {
                m.x += m.velocityX;
                m.velocityX *= 0.85; // Friction
                
                // Update server target to new position after knockback
                if (m.serverTargetX !== undefined && m.knockbackEndTime && Date.now() < m.knockbackEndTime) {
                    m.serverTargetX = m.x;
                }
            }
        }
        
        // Always apply gravity and vertical physics (both single and multiplayer)
        // Skip gravity for 15 frames to prevent spawned monsters from falling through platforms
        const isSpawnGracePeriod = m.spawnFrameCount !== undefined && m.spawnFrameCount > 0;
        if (isSpawnGracePeriod) {
            m.spawnFrameCount--;
            // Keep monster invisible during physics settling
            m.element.style.setProperty('opacity', '0', 'important');
        } else {
            m.velocityY += GRAVITY;
            m.y += m.velocityY;
            
            // Start fade-in AFTER physics grace period ends
            if (m.spawnFadeFrames === -1) {
                m.spawnFadeFrames = 30; // Start 30 frame fade-in now
            }
        }
        
        // Fade-in effect (only runs after physics grace period)
        if (m.spawnFadeFrames !== undefined && m.spawnFadeFrames > 0) {
            m.spawnFadeFrames--;
            const fadeProgress = 1 - (m.spawnFadeFrames / 30); // 30 frames total
            m.element.style.setProperty('opacity', String(fadeProgress), 'important');
        } else if (m.spawnFadeFrames === 0) {
            // Fully visible - clear spawning flag and ensure opacity is 1
            m.isSpawning = false;
            if (m.element && m.element.style.opacity !== '1') {
                m.element.style.setProperty('opacity', '1', 'important');
            }
        }

        // Map boundary collision
        if (m.x < 0) { m.x = 0; if (m.aiState === 'patrolling') m.direction = 1; }
        if (m.x + m.width > map.width) { m.x = map.width - m.width; if (m.aiState === 'patrolling') m.direction = -1; }

        // Flip sprite based on direction
        if (!m.isPixelArt) {
            m.element.style.transform = m.direction === 1 ? 'scaleX(1)' : 'scaleX(-1)';
        }

        // Vertical collision with platforms and ground
        // For trial bosses with player sprites, use player sprite anchor, otherwise use normal calculation
        let anchorY;
        if (m.usesPlayerSprite && spriteData?.player?.anchorPoint) {
            anchorY = spriteData.player.anchorPoint.y * PIXEL_ART_SCALE;
        } else if (m.isPixelArt && spriteData[m.type]?.anchorPoint) {
            anchorY = spriteData[m.type].anchorPoint.y * PIXEL_ART_SCALE;
        } else {
            anchorY = m.height || 55;
        }
        let onAnySurface = false;

        // Skip platform collision during spawn grace period to prevent ejection on spawn
        const isSpawning = m.spawnFrameCount > 0;

        platforms.forEach(p => {
            if (p.isLadder || p.y === undefined) return;
            
            // Skip collision check during spawn grace
            if (isSpawning) return;
            
            // Check if monster is colliding with platform
            if (isColliding(m, p)) {
                const monsterBottom = m.y + anchorY;
                const monsterTop = m.y;
                const platformTop = p.y;
                const platformBottom = p.y + (p.height || 20);
                
                // If monster is falling down and was above platform, land on it
                if (m.velocityY >= 0 && (m.y - m.velocityY + anchorY) <= p.y) {
                    const oldY = m.y;
                    const deltaY = Math.abs(oldY - (p.y - anchorY));
                    m.y = p.y - anchorY;
                    m.velocityY = 0;
                    m.isJumping = false;
                    onAnySurface = true;
                    // Only log large snaps (potential teleportation issues)
                    if (deltaY > 10) {
                        console.log(`%c[COLLISION SNAP] ${m.type} | Before: ${oldY.toFixed(1)} → After: ${m.y.toFixed(1)} | ΔY: ${deltaY.toFixed(1)}px | Platform: ${p.y.toFixed(1)} | Anchor: ${anchorY.toFixed(1)}`, 'color: #f00; font-weight: bold;');
                    }
                }
                // CRITICAL FIX: If monster somehow got stuck INSIDE or BELOW platform, eject it upward
                else if (monsterBottom > platformTop && monsterTop < platformBottom) {
                    const oldY = m.y;
                    m.y = p.y - anchorY;
                    m.velocityY = 0;
                    m.isJumping = false;
                    onAnySurface = true;
                }
            }
        });

        // Skip slope snapping during spawn grace period to prevent interference with spawn positioning
        if (!isSpawnGracePeriod) {
            const groundLevel = (map.height || scalingContainer.clientHeight) - GAME_CONFIG.GROUND_Y;
            const monsterCenterX = m.x + m.width / 2;
            const slopeSurfaceY = getSlopeSurfaceY(monsterCenterX, map, groundLevel, 48);
            const monsterBottom = m.y + anchorY;
            const distanceToSlope = monsterBottom - slopeSurfaceY;
            // Snap to slope if close enough (above or below)
            // Use larger tolerance for walking up slopes, and always snap when on ground
            if (!onAnySurface && distanceToSlope >= -50 && distanceToSlope <= 100) {
                m.y = slopeSurfaceY - anchorY;
                m.velocityY = 0;
                m.isJumping = false;
            }
        }

        // Update animations
        if (m.usesPlayerSprite) {
            // Trial bosses with player sprites
            updateTrialBossAnimation(m);
        } else {
            updatePixelArtAnimation(m);
        }
        m.previousY = m.y;
    });
}

function updateMonsterAI(m) {
    // If monster is dead, casting, or static, skip normal AI
    const monsterData = monsterTypes[m.type];
    
    // Skip AI for world bosses or monsters without defined type data
    if (!monsterData || m.isWorldBoss) return;
    
    if (m.isDead || m.aiState === 'casting' || monsterData.aiType === 'static') return;

    const distanceToPlayer = Math.hypot(m.x - player.x, m.y - player.y);
    const leashRange = 500;
    const isPlayerVisible = !player.isDead && !player.isInvisible;
    const now = Date.now();

    // (Special ability logic remains the same...)
    if (m.isMiniBoss && m.specialAbility && isPlayerVisible && now - (m.lastSpecialTime || 0) > m.specialAbility.cooldown) {
        m.aiState = 'casting';
        m.aiStateTimer = 60;
        m.lastSpecialTime = now;
        m.element.style.filter = 'drop-shadow(0 0 8px yellow)';

        setTimeout(() => {
            if (m.isDead) return;
            m.element.style.filter = '';

            switch (m.specialAbility.type) {
                case 'slam':
                    if (Math.hypot(m.x - player.x, m.y - player.y) < m.specialAbility.range) {
                        if (!isGmMode.infiniteStats) {
                            player.hp -= m.specialAbility.damage;
                        }
                        showDamageNumber(m.specialAbility.damage, player.x, player.y, true);
                    }
                    break;
                case 'spawn':
                    for (let i = 0; i < m.specialAbility.count; i++) {
                        spawnMonster(m.specialAbility.monster);
                    }
                    break;
            }

            // Resume chasing and reset chase timer
            if (m.aiState !== 'chasing') {
                m.chaseStartTime = now;
            }
            m.aiState = 'chasing';
        }, 1000);
        return;
    }


    m.aiStateTimer--;

    if (m.aiState === 'recoiling' && m.aiStateTimer <= 0) {
        m.aiState = m.previousAiState;
    }
    else if (m.aiState === 'chasing') {
        // Check if monster should lose aggro
        const chasingTooLong = (now - m.chaseStartTime) > 3000; // 3 seconds
        const noRecentInteraction = (now - m.lastInteractionTime) > 3000; // 3 seconds
        
        if (!isPlayerVisible || distanceToPlayer > leashRange || (chasingTooLong && noRecentInteraction)) {
            m.aiState = 'idle';
            m.aiStateTimer = Math.random() * 120 + 60;
            m.chaseStartTime = 0;
        }
    }
    else if (m.aiStateTimer <= 0 && m.aiState !== 'chasing' && m.aiState !== 'recoiling') {
        if (m.aiState === 'idle') {
            m.aiState = 'patrolling';
            if (Math.random() < 0.5) {
                m.direction *= -1;
            }
            m.aiStateTimer = Math.random() * 180 + 120;
        } else {
            m.aiState = 'idle';
            m.aiStateTimer = Math.random() * 120 + 60;
        }
    }

    const probeX = m.direction === 1 ? m.x + m.width + 1 : m.x - 1;
    const probeY = m.y + m.height + 5;
    let isCliffAhead = false;
    if (m.aiState !== 'chasing') {
        isCliffAhead = !isGroundAt(probeX, probeY);
    }

    switch (m.aiState) {
        case 'idle':
            break;
        case 'patrolling':
            if (!m.isJumping) {
                if (isCliffAhead) {
                    m.direction *= -1;
                }
            }

            m.x += m.speed * 0.7 * m.direction;

            // --- THIS IS THE FIX ---
            // Use the monster's specific jump force if it exists, otherwise default to -6.
            // Mini bosses jump more frequently (1% vs 0.5%)
            const jumpChance = m.isMiniBoss ? 0.01 : 0.005;
            if (m.canJump && Math.random() < jumpChance && !m.isJumping) {
                m.velocityY = m.jumpForce || -6;
                m.isJumping = true;
            }
            break;
        case 'chasing':
            // --- FIX --- 
            // Only allow the monster to change direction if it's on the ground.
            if (!m.isJumping) {
                m.direction = (player.x > m.x) ? 1 : -1;
            }

            const attackRange = m.width / 2;
            if (distanceToPlayer > attackRange) {
                m.x += m.speed * 1.2 * m.direction;
                
                // Trial bosses and mini bosses jump while chasing (more aggressive)
                // Jump if player is above or randomly while moving
                const playerAbove = player.y < m.y - 30;
                const shouldJump = playerAbove ? 0.03 : 0.015; // 3% if player above, 1.5% otherwise
                if ((m.isTrialBoss || m.isMiniBoss) && m.canJump && Math.random() < shouldJump && !m.isJumping) {
                    m.velocityY = m.jumpForce || -8;
                    m.isJumping = true;
                }
            }
            break;
        case 'recoiling':
            break;
    }
}

/**
 * Manages monster respawn timers and initiates spawning.
 */
function updateSpawners() {
    const now = Date.now();
    const map = maps[currentMapId];

    // Skip local spawning if server handles monsters OR if we're connected (waiting for server data)
    if (typeof window.isServerAuthoritativeMonsters === 'function' && window.isServerAuthoritativeMonsters()) {
        return;
    }
    // Also skip if connected to server - server will send monsters
    if (typeof window.isConnectedToServer === 'function' && window.isConnectedToServer()) {
        return;
    }

    monsterSpawners.forEach(spawner => {
        const monsterData = monsterTypes[spawner.type];
        const currentLiveCount = monsters.filter(m => m.type === spawner.type).length;

        // Don't respawn trial bosses - they only spawn once per trial
        if (monsterData.isTrialBoss && map && map.isTrialMap) {
            return; // Skip this spawner entirely
        }

        if (monsterData.isMiniBoss) {
            if (currentLiveCount < 1 && now - (spawner.lastDefeatTime || 0) > monsterData.respawnTime) {
                // If the spawner has a fixed position, use it
                if (spawner.spawnX !== undefined) {
                    const groundLevel = (map.height || scalingContainer.clientHeight) - GAME_CONFIG.GROUND_Y;
                    const spawnY = groundLevel - monsterData.height;
                    createMonster(spawner.type, spawner.spawnX, spawnY);
                    addChatMessage(`${monsterData.name || spawner.type} has appeared!`, 'boss');
                } else {
                    spawnMonster(spawner.type);
                }
                spawner.lastDefeatTime = now;
            }
        } else {
            // Logic for regular monsters
            if (currentLiveCount < spawner.maxCount && now - (spawner.lastSpawnTime || 0) > RESPAWN_TIME) {
                spawnMonster(spawner.type);
                spawner.lastSpawnTime = now;
            }
        }
    });
}

function spawnMonster(type) {
    const monsterData = monsterTypes[type];
    const map = maps[currentMapId];

    if (monsterData.isMiniBoss) {
        // REPLACED: showMajorNotification with addChatMessage
        addChatMessage(`${monsterData.name || type} has appeared!`, 'boss');
    }

    const scaledTileSize = 16 * PIXEL_ART_SCALE;
    const baseGroundY = scalingContainer.clientHeight - GAME_CONFIG.GROUND_Y;

    // Helper function to check if a point is inside a hill/slope
    function isPointInsideHill(x, map) {
        if (!map.hills && !map.slopes) return false;
        
        // Check hills
        for (const hill of (map.hills || [])) {
            const hillTiles = hill.tiles || 2;
            const hillCapWidth = hill.width || 0;
            const slopeWidth = hillTiles * scaledTileSize;
            const totalHillWidth = slopeWidth * 2 + hillCapWidth;
            
            if (x >= hill.x && x <= hill.x + totalHillWidth) {
                return true;
            }
        }
        
        // Check individual slopes
        for (const slope of (map.slopes || [])) {
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

    const allSpawnSurfaces = [
        { x: 0, y: baseGroundY, width: map.width, isGround: true },
        ...(map.platforms || []).map(p => ({ ...p, y: p.y + GROUND_LEVEL_OFFSET })),
        ...(map.structures || []).map(s => ({ ...s, y: s.y + GROUND_LEVEL_OFFSET }))
    ];
    const MIN_SPAWN_WIDTH = 150;
    const validSpawnPoints = allSpawnSurfaces.filter(p => !p.noSpawn && p.width >= MIN_SPAWN_WIDTH);

    if (validSpawnPoints.length === 0) {
        console.warn(`No valid spawn points found for monsters in map: ${currentMapId}`);
        return;
    }

    // --- THIS IS THE FIX ---
    // Instead of picking a random platform, we pick a random point along the total width of all valid platforms.
    // This weights the selection by platform size, ensuring a more even distribution of monsters.
    const totalSpawnableWidth = validSpawnPoints.reduce((sum, p) => sum + p.width, 0);
    let randomPoint = Math.random() * totalSpawnableWidth;

    let spawnPoint = null;
    for (const point of validSpawnPoints) {
        randomPoint -= point.width;
        if (randomPoint <= 0) {
            spawnPoint = point;
            break;
        }
    }

    // Fallback in case something goes wrong with the loop
    if (!spawnPoint) {
        spawnPoint = validSpawnPoints[validSpawnPoints.length - 1];
    }
    // --- END OF FIX ---

    let spawnX, spawnY;
    let attempts = 0;
    const maxAttempts = 10;

    // Try to find a spawn position that's not inside a hill (only for ground level)
    do {
        spawnX = Math.random() * (spawnPoint.width - monsterData.width) + spawnPoint.x;
        spawnY = spawnPoint.y - monsterData.height;
        attempts++;
    } while (spawnPoint.isGround && isPointInsideHill(spawnX, map) && attempts < maxAttempts);

    // If we're on the ground and still inside a hill, adjust Y to the slope surface
    if (spawnPoint.isGround && isPointInsideHill(spawnX, map)) {
        if (typeof getSlopeSurfaceY === 'function') {
            const slopeSurfaceY = getSlopeSurfaceY(spawnX, map, baseGroundY, scaledTileSize);
            if (slopeSurfaceY !== null && slopeSurfaceY < baseGroundY) {
                spawnY = slopeSurfaceY - monsterData.height;
            }
        }
    }

    // Spawn immediately with fade-in effect (no VFX needed)
    createMonster(type, spawnX, spawnY);
}

// in monsters.js

function createPixelArtEffect(effectName, x, y, targetWidth, targetHeight) {
    const effectData = spriteData[effectName];
    if (!effectData) return;

    const animation = effectData.animations.play;
    if (!animation || animation.length === 0) return;

    const el = document.createElement('div');
    el.className = 'game-effect';
    el.style.position = 'absolute';
    el.style.zIndex = 110;
    el.style.pointerEvents = 'none';

    const effectWidth = effectData.frameWidth * PIXEL_ART_SCALE;
    const effectHeight = effectData.frameHeight * PIXEL_ART_SCALE;

    // --- THIS IS THE FIX ---
    // The original logic centered the effect on the target's center.
    // This new logic aligns the BOTTOM of the effect with the BOTTOM of the target area (e.g., the item's feet).
    // It keeps the horizontal centering.
    const topPos = y + targetHeight - effectHeight;
    const leftPos = x + (targetWidth / 2) - (effectWidth / 2);

    // Set the size of the effect's container to match the effect's sprite size, not the target's size.
    el.style.width = `${effectWidth}px`;
    el.style.height = `${effectHeight}px`;
    el.style.left = `${leftPos}px`;
    el.style.top = `${topPos}px`;
    // --- END OF FIX ---

    el.style.backgroundImage = `url(${artAssets[effectName]})`;
    const sheetWidth = effectData.frameWidth * animation.length * PIXEL_ART_SCALE;
    const sheetHeight = effectData.frameHeight * PIXEL_ART_SCALE;
    el.style.backgroundSize = `${sheetWidth}px ${sheetHeight}px`;

    worldContent.appendChild(el);

    let currentFrame = 0;
    const frameDuration = 80;

    const animationInterval = setInterval(() => {
        if (currentFrame >= animation.length) {
            clearInterval(animationInterval);
            el.remove();
            return;
        }
        const frame = animation[currentFrame];
        el.style.backgroundPosition = `-${frame.x * PIXEL_ART_SCALE}px -${frame.y * PIXEL_ART_SCALE}px`;
        currentFrame++;
    }, frameDuration);
}

function createItemDrop(name, x, y, initialState = null, bypassLevelCheck = false) {
    let newItem;
    const el = document.createElement('div');
    el.className = 'item-drop';

    if (name === 'Gold') {
        newItem = { 
            name: 'Gold', 
            id: Math.random(), 
            amount: initialState?.amount || 1, 
            rarity: 'exp',
            // Preserve multiplayer ownership info if provided
            ownerId: initialState?.ownerId || null,
            ownerTimeout: initialState?.ownerTimeout || null
        };
        el.classList.add('pixel-art');
        el.style.width = `24px`; el.style.height = `24px`;
        el.style.backgroundImage = `url(${artAssets.coin})`;
        el.style.backgroundSize = `${24 * 4}px 24px`;
    } else {
        // Always start by looking up the base item to ensure name is valid
        const baseItem = itemData[name];
        if (!baseItem) {
            console.error(`Attempted to drop an item that does not exist in itemData: "${name}"`);
            return;
        }
        
        if (initialState && initialState.stats) {
            // Full item state provided (e.g., from crafting or specific drops)
            newItem = { name, ...initialState };
        } else {
            // Generate item properties (for single player OR multiplayer with partial state)
            if (!bypassLevelCheck && baseItem.category === 'Equip' && player.level < baseItem.levelReq) return;

            newItem = { 
                name, 
                id: Math.random(), 
                rarity: baseItem.isQuestItem ? 'quest' : 'common', 
                levelReq: baseItem.levelReq, 
                isQuestItem: baseItem.isQuestItem || false, 
                enhancement: 0,
                // Preserve multiplayer ownership info if provided
                ownerId: initialState?.ownerId || null,
                ownerTimeout: initialState?.ownerTimeout || null
            };

            if (baseItem.category === 'Use' || baseItem.category === 'Etc') {
                newItem.quantity = 1;
            }
            if (baseItem.category === 'Equip') {
                newItem.stats = {};
                const qualityRoll = Math.random();

                // --- THIS IS THE FIX ---
                // We use the item's actual final name ('name' variable) for the rarity check,
                // not an old, potentially incorrect name.
                const itemVariance = baseItem.variance || 1; // Default variance to 1 if not specified
                for (const stat in baseItem.stats) {
                    const baseStat = baseItem.stats[stat];
                    let bonus = 0;
                    if (qualityRoll > 0.98 || name === 'Iron Sword' && baseItem.cost === 10000) { // Check for Stumpy's Axe by cost
                        newItem.rarity = 'legendary';
                        bonus = itemVariance * 2 + 2;
                        if (stat === 'attack') bonus = Math.max(10, bonus);
                    } else if (qualityRoll > 0.85) {
                        newItem.rarity = 'epic';
                        bonus = itemVariance + 1;
                    } else if (qualityRoll > 0.60) {
                        newItem.rarity = 'rare';
                        bonus = Math.ceil(Math.random() * itemVariance);
                    }
                    newItem.stats[stat] = baseStat + bonus;
                }
                // --- END OF FIX ---
            } else if (baseItem.category === 'Cosmetic') {
                newItem.rarity = 'cosmetic';
                newItem.stats = {}; // Ensure cosmetic items never have stats
            }
        }

        const iconData = spriteData.dropIcons.icons[newItem.name];
        if (iconData) {
            // --- THIS IS THE FIX ---
            // This logic was refactored to match the superior rendering method used by the inventory UI.
            // It uses transform: scale() instead of manually calculating background sizes, which is more reliable for pixel art.
            const iconSize = spriteData.dropIcons.frameWidth; // The original sprite size (e.g., 8px)
            el.classList.add('pixel-art');
            el.style.width = `${iconSize}px`;
            el.style.height = `${iconSize}px`;
            el.style.backgroundImage = `url(${artAssets.dropIcons})`;
            el.style.backgroundPosition = `-${iconData.x}px -${iconData.y}px`; // Use unscaled coordinates
            el.style.transform = `scale(${PIXEL_ART_SCALE})`; // Scale the element itself
            el.style.transformOrigin = 'center';
            // Note: background-size is intentionally not set to use the native image size.
            // --- END OF FIX ---

            // Apply special tinting for quest items
            if (newItem.name === 'Rusty Iron Sword') {
                el.style.filter = 'brightness(0.6) sepia(0.3) hue-rotate(15deg)';
            } else if (newItem.name === 'Dull Sword') {
                el.style.filter = 'brightness(0.8) saturate(0.5)';
            }
        } else {
            console.error(`Icon not found for item: ${newItem.name}`);
        }
    }

    worldContent.appendChild(el);

    // Use server-provided velocities for multiplayer consistency, otherwise random
    const velX = initialState?.serverVelocityX !== undefined ? initialState.serverVelocityX : (Math.random() * 4) - 2;
    const velY = initialState?.serverVelocityY !== undefined ? initialState.serverVelocityY : -7 - (Math.random() * 3);
    
    const droppedItemObject = {
        ...newItem, x, y,
        width: 8 * PIXEL_ART_SCALE, height: 8 * PIXEL_ART_SCALE,
        anchorPoint: { x: 12, y: 18 }, element: el,
        velocityX: velX,
        velocityY: velY,
        bobTimer: Math.random() * Math.PI * 2,
        visualYOffset: 0,
        // Loot ownership for multiplayer - only owner can pick up until timeout
        ownerId: newItem.ownerId || null,
        ownerTimeout: newItem.ownerTimeout || null
    };

    if (name === 'Gold') {
        droppedItemObject.animationFrame = 0;
        droppedItemObject.animationTimer = 0;
    }
    droppedItems.push(droppedItemObject);
}