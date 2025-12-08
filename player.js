// in player.js (at the top)

// --- Migration Code for Old items

// in player.js (add this to the top of the file)

const itemNameMigrationMap = {
    'Rusty Sword': 'Iron Sword',
    'Steel Sword': 'Iron Sword',
    "Stumpy's Golden Axe": 'Iron Sword',
    'War Hammer': 'Iron Sword',
    'Wizard Staff': 'Sapphire Staff',
    'Hunters Bow': 'Wooden Bow',
    'Steel Dagger': 'Iron Sword',
    'Fruit Knife': 'Iron Sword',
    'Pistol': 'Iron Pistol',
    'Musket': 'Iron Pistol',
    'Dragon Revolver': 'Iron Pistol',
    'Zweihander': 'Iron Sword',
    'Arcane Staff': 'Sapphire Staff',
    'Composite Bow': 'Wooden Bow',
    'Katar': 'Iron Sword',
    "Boss Slayer's Greatsword": 'Iron Sword',
    'Wooden Shield': 'Iron Earrings',
    'Mano Shell': 'Iron Earrings',
    'Leather Hat': 'Leather Cap',
    'Pirate Bandana': 'Purple Bandana',
    'Viking Helm': 'Leather Cap',
    'Wizard Hat': 'Slime Hat',
    'Red Headband': 'Pink Bandana',
    'Blue Headband': 'Purple Bandana',
    'Iron Armor Top': 'Grey T-shirt',
    'Leather Vest': 'Yellow T-shirt',
    'Iron Armor Bottom': 'Blue Jean Shorts',
    'Canvas Pants': 'Brown Pants',
    'Slime Earrings': 'Leaf Earrings',
    'Silver Ring': 'Iron Earrings',
    'Mushmom Spore Pendant': 'Mushmom Pendant',
    'Perion Pendant': 'King Slime Pendant',
    "Golem's Heart": 'Golem Pendant',
    "Balrog's Amulet": 'Balrog Pendant',
    'All-Cure Potion': 'Red Potion',
    "Lumberjacks Axe": 'Iron Sword',
    'Stirge Wing': 'Blue Potion',
    'Cat Ears': 'Slime Hat',
    'Transparent Claw': 'Enhancement Scroll',
    'Floating Crown': 'Slime Hat',
    'Golden Crown': 'Slime Hat',
    'Paper Bag': 'Leather Cap',
    'Monocle': 'Sunglasses'
};

function migratePlayerItems(playerData) {
    const migrate = (item) => {
        if (item && itemNameMigrationMap[item.name]) {
            item.name = itemNameMigrationMap[item.name];
        }
    };

    // Migrate equipped items
    for (const slot in playerData.equipped) {
        migrate(playerData.equipped[slot]);
    }
    for (const slot in playerData.cosmeticEquipped) {
        migrate(playerData.cosmeticEquipped[slot]);
    }

    // Migrate inventory
    for (const category in playerData.inventory) {
        playerData.inventory[category].forEach(migrate);
    }

    return playerData;
}

// =============================================
// EXP CURVE - Single Source of Truth
// =============================================

/**
 * Calculate the EXP required to level up from a given level
 * Uses the formula: BASE_EXP * (GROWTH_RATE ^ (level - 1))
 * 
 * @param {number} level - The current level
 * @returns {number} - EXP needed to reach the next level
 */
function getExpForLevel(level) {
    const baseExp = GAME_CONFIG?.BASE_EXP || 100;
    const growthRate = GAME_CONFIG?.EXP_GROWTH_RATE || 1.13;
    
    // Level 1 needs BASE_EXP to reach level 2
    // Level 2 needs BASE_EXP * 1.10 to reach level 3
    // Level 3 needs BASE_EXP * 1.10^2 to reach level 4
    // etc.
    return Math.floor(baseExp * Math.pow(growthRate, level - 1));
}

/**
 * Calculate total EXP needed to reach a specific level from level 1
 * 
 * @param {number} targetLevel - The level to calculate total EXP for
 * @returns {number} - Total EXP needed from level 1 to targetLevel
 */
function getTotalExpForLevel(targetLevel) {
    let totalExp = 0;
    for (let lvl = 1; lvl < targetLevel; lvl++) {
        totalExp += getExpForLevel(lvl);
    }
    return totalExp;
}

/**
 * Recalculate and fix player's maxExp based on their current level
 * This ensures all characters use the same EXP curve regardless of when they were created
 * 
 * @returns {boolean} - True if maxExp was adjusted
 */
function recalculateMaxExp() {
    if (!player || !player.level) return false;
    
    const correctMaxExp = getExpForLevel(player.level);
    const oldMaxExp = player.maxExp;
    
    if (player.maxExp !== correctMaxExp) {
        player.maxExp = correctMaxExp;
        
        // If current EXP exceeds new maxExp, handle potential level ups
        if (player.exp >= player.maxExp) {
            // Cap at maxExp - 1 to prevent immediate level up
            // (they should still need to earn that last point)
            player.exp = Math.min(player.exp, player.maxExp - 1);
        }
        
        console.log(`EXP curve adjusted for level ${player.level}: ${oldMaxExp} → ${correctMaxExp}`);
        return true;
    }
    
    return false;
}

// Make EXP functions globally available
window.getExpForLevel = getExpForLevel;
window.getTotalExpForLevel = getTotalExpForLevel;
window.recalculateMaxExp = recalculateMaxExp;

// --- Global Player Assets & State ---
// These are now at the top level, making them accessible to other scripts like ui.js
const playerSheetImage = new Image();
window.playerSheetImage = playerSheetImage; // Make it globally accessible
const playerEyesSheet = new Image();
window.playerEyesSheet = playerEyesSheet; // Make it globally accessible
const playerHairSheet = new Image();
window.playerHairSheet = playerHairSheet; // Make it globally accessible
// Note: src will be set by the loading manager

// --- Player Creation State Variables ---
// These are needed by createCharacter and are controlled by the UI

let creationStats = { str: 5, dex: 5, int: 5, luk: 5 };

// --- Player Creation & Save/Load ---

// Helper function to render a guild icon sprite into a DOM element
function renderGuildIconToElement(element, iconId, scale = 2) {
    if (!element || typeof spriteData === 'undefined' || !spriteData.guildIcons ||
        typeof artAssets === 'undefined' || !artAssets.guildIcons) return;
    
    const iconData = spriteData.guildIcons;
    const iconPos = iconData.icons[iconId] || iconData.icons[1];
    if (!iconPos) return;
    
    const width = iconData.frameWidth * scale;
    const height = iconData.frameHeight * scale;
    const bgX = iconPos.x * scale;
    const bgY = iconPos.y * scale;
    const bgWidth = iconData.sheetWidth * scale;
    const bgHeight = iconData.sheetHeight * scale;
    
    element.textContent = ''; // Clear any text
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.backgroundImage = `url(${artAssets.guildIcons})`;
    element.style.backgroundPosition = `-${bgX}px -${bgY}px`;
    element.style.backgroundSize = `${bgWidth}px ${bgHeight}px`;
    element.style.imageRendering = 'pixelated';
    element.style.imageRendering = 'crisp-edges';
    element.style.verticalAlign = 'middle';
}

function updatePlayerNameplate() {
    const guildNameplate = document.getElementById('guild-nameplate');
    const guildNameElement = document.getElementById('guild-name');
    const guildIconElement = document.getElementById('guild-icon');

    // Handle guild display - support both old string format and new object format
    if (player.guild) {
        if (typeof player.guild === 'string') {
            // Old format - just a string name
            guildNameElement.textContent = player.guild;
            // Render default guild icon sprite
            renderGuildIconToElement(guildIconElement, 1, 1);
        } else if (player.guild.name) {
            // New format - object with name, icon, role
            guildNameElement.textContent = player.guild.name;
            const iconId = player.guild.icon || 1;
            renderGuildIconToElement(guildIconElement, iconId, 1);
        }
        guildNameplate.style.display = 'flex';
    } else {
        guildNameplate.style.display = 'none';
    }
    
    // Update Monster Killer medals display
    updateMonsterKillerMedalsDisplay();
}

function updateMonsterKillerMedalsDisplay() {
    // Remove existing medals container if it exists
    const existingMedalsContainer = document.getElementById('monster-killer-medals-container');
    if (existingMedalsContainer) {
        existingMedalsContainer.remove();
    }
    
    // Initialize displayMedals if it doesn't exist
    if (!player.displayMedals) player.displayMedals = [];
    
    // Check if there's an equipped medal or display medals to show
    if (!player.equippedMedal && player.displayMedals.length === 0) return;
    
    // Create medals container
    const medalsContainer = document.createElement('div');
    medalsContainer.id = 'monster-killer-medals-container';
    medalsContainer.style.cssText = `
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        gap: 1px;
        margin-top: 2px;
        z-index: 1000;
        pointer-events: none;
    `;
    
    // Helper function to create medal element
    function createMedalElement(medal, isStatMedal) {
        let medalTier = medal.tier || 'bronze';
        let medalName = medal.name;
        
        if (medal.type === 'monster') {
            const monsterType = medal.id;
            const killCount = player.bestiary.monsterKills[monsterType] || 0;
            
            if (killCount >= 1000) medalTier = 'diamond';
            else if (killCount >= 500) medalTier = 'gold';
            else if (killCount >= 150) medalTier = 'silver';
            else medalTier = 'bronze';
        } else if (medal.type === 'special') {
            if (typeof specialMedals !== 'undefined' && specialMedals[medal.id]) {
                medalTier = specialMedals[medal.id].tier || 'gold';
            }
        }
        
        const medalElement = document.createElement('div');
        medalElement.className = `monster-killer-medal-display ${medalTier}`;
        if (isStatMedal) {
            medalElement.classList.add('stat-medal');
        }
        
        const medalText = document.createElement('span');
        medalText.textContent = medalName;
        
        medalElement.appendChild(medalText);
        return medalElement;
    }
    
    // First, show the equipped stat medal (if any)
    if (player.equippedMedal) {
        medalsContainer.appendChild(createMedalElement(player.equippedMedal, true));
    }
    
    // Then show display medals (excluding the stat medal if it's also in displayMedals)
    player.displayMedals.forEach(medal => {
        // Skip if this medal is also the equipped stat medal
        if (player.equippedMedal && 
            player.equippedMedal.type === medal.type && 
            player.equippedMedal.id === medal.id) {
            return;
        }
        medalsContainer.appendChild(createMedalElement(medal, false));
    });
    
    // Determine where to position the medals container
    // Always attach to player element, but position differently based on guild
    const playerElement = document.getElementById('player');
    
    if (playerElement) {
        // Calculate the top position based on whether player has a guild
        // player-nameplate is at top: 60px (~18px height)
        // guild-nameplate is at top: 78px (~18px height)
        let topPosition;
        if (player.guild) {
            topPosition = 96; // Below guild nameplate (78 + 18)
        } else {
            topPosition = 78; // Below player nameplate (60 + 18)
        }
        
        medalsContainer.style.top = topPosition + 'px';
        medalsContainer.style.marginTop = '0';
        playerElement.appendChild(medalsContainer);
    }
}





function checkAllMonsterKillerMedals() {
    if (!player.bestiary) return;
    
    // Check all monsters in the bestiary for medal eligibility
    for (const monsterType in player.bestiary.monsterKills) {
        checkMonsterKillerMedal(monsterType);
    }
}

function toggleMonsterKillerMedal(monsterType) {
    if (!player.bestiaryRewards) player.bestiaryRewards = {};
    if (!player.bestiaryRewards.hiddenMedals) player.bestiaryRewards.hiddenMedals = {};
    
    // Check if player has earned this medal
    if (!player.bestiaryRewards.claimedMedals || !player.bestiaryRewards.claimedMedals[monsterType]) {
        if (typeof addChatMessage !== 'undefined') {
            addChatMessage("You haven't earned this medal yet!", 'error');
        }
        return;
    }
    
    const monster = monsterTypes[monsterType];
    const isCurrentlyVisible = !player.bestiaryRewards.hiddenMedals[monsterType];
    
    if (isCurrentlyVisible) {
        // Hide the medal
        player.bestiaryRewards.hiddenMedals[monsterType] = true;
        if (typeof addChatMessage !== 'undefined') {
            addChatMessage(`${monster.name} Killer medal hidden from nameplate.`, 'system');
        }
    } else {
        // Show the medal
        delete player.bestiaryRewards.hiddenMedals[monsterType];
        if (typeof addChatMessage !== 'undefined') {
            addChatMessage(`${monster.name} Killer medal shown on nameplate.`, 'system');
        }
    }
    
    // Update nameplate display
    updatePlayerNameplate();
    
    // Update the toggle button in the current modal without closing it
    const toggleBtn = document.querySelector(`[onclick*="toggleMonsterKillerMedal('${monsterType}')"]`);
    if (toggleBtn) {
        const isNowVisible = !player.bestiaryRewards.hiddenMedals[monsterType];
        toggleBtn.textContent = isNowVisible ? 'Hide' : 'Show';
    }
    
    // Also update the medals tab if visible
    if (document.querySelector('#medals-list')?.classList.contains('active')) {
        updateMedalsTab();
    }
    
    // Save the change
    saveCharacter();
}

function createCharacter(name) {
    // Generate a temporary character ID (will be replaced by server ID after registration)
    const tempCharacterId = 'temp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    
    player = {
        name: name,
        characterId: tempCharacterId, // Will be updated after server registration
        class: 'beginner',
        customization: {
            hairStyle: currentHairIndex,
            hairColor: currentHairColorIndex,
            eyeColor: currentEyeColorIndex,
            skinTone: currentSkinIndex
        },
        guild: null,
        level: 1, hp: 50, maxHp: 50, mp: 30, maxMp: 30, exp: 0, maxExp: 100, gold: 0,
        ap: 0,
        sp: 0,
        beginnerSp: 0,
        baseStats: { str: creationStats.str, dex: creationStats.dex, int: creationStats.int, luk: creationStats.luk }, // Store rolled base stats
        stats: { ...creationStats, defense: 0, critChance: 5, minCritDamage: 1.5, maxCritDamage: 2.5, goldSpent: 0, accuracy: 5, avoidability: 5, totalGoldEarned: 0, totalKills: 0, enhanceSuccessCount: 0, potionsUsed: 0, talkedNPCs: new Set(), deathCount: 0 },
        bestiary: { monsterKills: {}, dropsFound: {}, firstKillTimestamp: {} },
        bestiaryRewards: {},
        specialMedals: {},
        equippedMedal: null,
        displayMedals: [],
        inventory: { equip: [], use: [], etc: [], cosmetic: [] },
        equipped: { weapon: null, helmet: null, top: null, bottom: null, gloves: null, shoes: null, earring: null, ring: null, pendant: null, shield: null, face: null, eye: null },
        cosmeticEquipped: { weapon: null, helmet: null, top: null, bottom: null, gloves: null, shoes: null, cape: null, earring: null, ring: null, pendant: null, shield: null, face: null, eye: null },
        inventorySlots: 16,
        abilities: [],
        hasFlashJumped: false,
        hotbar: [null, null, null, null, null, null, null, null, null, null, null, null], // 12 slots total
        discoveredMaps: new Set(['dewdropBeach']),
        quests: { active: [], completed: [] },
        tutorialActions: {}, // Tracks tutorial actions for 'welcomeToDewdrop' quest
        achievements: { progress: {}, completed: {}, claimed: {} },
        timePlayed: 0,
        buffs: [],
        hasClaimedJumpQuestPrize: false,
        x: 400, y: 300,
        width: 30, height: 60,
        yOffset: -6,
        previousY: 300,
        velocityX: 0, velocityY: 0, isJumping: false, isInvincible: false, isDead: false,
        lastAttackTime: {}, attackCooldown: 500,
        lastGlobalAttackTime: 0, // Global cooldown for all attacks/abilities
        lastMpRegenTime: 0, lastHpRegenTime: 0,
        currentMapId: 'dewdropBeach', isAttacking: false, isInvisible: false,
        isChargingPortal: false,
        portalChargeStartTime: 0,
        activePortal: null,
        speed: 1, // pixels per frame at 100fps
        jumpForce: JUMP_FORCE, // pixels per frame at 100fps
        originalSpeed: 1,
        originalJumpForce: JUMP_FORCE,
        hasFlashJumped: false,
        jumpInputConsumed: false, // Track if current jump press has been used
        onLadder: false,
        animationState: 'idle',
        animationFrame: 0,
        animationTimer: 0,
        isProne: false,
        isBlinking: false,
        blinkTimer: 240,
        blinkDurationTimer: 0,
        chatMessage: null,
        chatTimer: 0,
        hasSeenBeginnerSkillPopup: false,
        levelUpEffect: null, // { startTime: timestamp, frame: 0 }
        petInventory: [], // Array of owned pets
        activePet: null // Currently active pet { type, x, y, isSpawned, ... }
    };

    const startingItems = {
        weapon: 'Dull Sword',
        top: 'White T-shirt',
        bottom: 'Blue Jeans'
    };

    for (const slot in startingItems) {
        const itemName = startingItems[slot];
        const itemInfo = itemData[itemName];
        if (itemInfo) {
            player.equipped[slot] = {
                name: itemName,
                stats: { ...itemInfo.stats },
                levelReq: itemInfo.levelReq || 1,
                rarity: 'common',
                enhancement: 0
            };
        } else {
            console.error(`CRITICAL: Starting item "${itemName}" for slot "${slot}" not found in itemData. Character will start without it.`);
        }
    }

    const playerHitbox = document.createElement('div');
    playerHitbox.className = 'debug-hitbox';
    document.getElementById('player').appendChild(playerHitbox);
    player.hitboxElement = playerHitbox;
    document.getElementById('player-nameplate').textContent = player.name;
    updatePlayerNameplate();
    
    // Initialize default key mappings for new characters
    if (typeof keyMappingManager !== 'undefined') {
        keyMappingManager.initializeForNewCharacter();
    }
    
    // Initialize hotbar for new character
    if (typeof migrateHotbar === 'function') {
        migrateHotbar();
    }
    
    // Submit new character to rankings immediately
    if (typeof submitRanking === 'function') {
        submitRanking().catch(err => {
            console.warn('[Rankings] Failed to submit new character:', err);
        });
    }
}

// Enhanced Save System with Backup and Corruption Detection
class SaveManager {
    constructor() {
        this.saveKey = GAME_CONFIG.SAVE_KEY_PREFIX + 'characters';
        this.backupKey = GAME_CONFIG.SAVE_KEY_PREFIX + 'characters_backup';
        this.audioKey = GAME_CONFIG.SAVE_KEY_PREFIX + 'audioSettings';
        this.metaKey = GAME_CONFIG.SAVE_KEY_PREFIX + 'metadata';
    }
    
    // Create save data with metadata
    createSaveData(characters) {
        // Convert Set objects to arrays for JSON serialization
        const serializedCharacters = {};
        for (const charName in characters) {
            const char = { ...characters[charName] };
            
            // Convert Set objects to arrays
            if (char.discoveredMaps instanceof Set) {
                char.discoveredMaps = Array.from(char.discoveredMaps);
            }
            if (char.stats && char.stats.talkedNPCs instanceof Set) {
                char.stats = { ...char.stats };
                char.stats.talkedNPCs = Array.from(char.stats.talkedNPCs);
            }
            
            serializedCharacters[charName] = char;
        }
        
        return {
            version: '0.852',
            timestamp: Date.now(),
            checksum: this.calculateChecksum(serializedCharacters),
            data: serializedCharacters
        };
    }
    
    // Simple checksum calculation
    calculateChecksum(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }
    
    // Validate save data integrity
    validateSaveData(saveData) {
        if (!saveData || typeof saveData !== 'object') return false;
        if (!saveData.data || !saveData.checksum) return false;
        
        const calculatedChecksum = this.calculateChecksum(saveData.data);
        if (calculatedChecksum !== saveData.checksum) return false;
        
        // Validate character data structure
        for (const charName in saveData.data) {
            const char = saveData.data[charName];
            if (!this.validateCharacterData(char)) {
                console.error(`Invalid character data for ${charName}`);
                return false;
            }
        }
        
        return true;
    }
    
    // Validate individual character data
    validateCharacterData(char) {
        if (!char || typeof char !== 'object') return false;
        
        // Check required fields
        const requiredFields = ['name', 'class', 'level', 'hp', 'mp', 'x', 'y'];
        for (const field of requiredFields) {
            if (char[field] === undefined || char[field] === null) {
                console.error(`Missing required field: ${field}`);
                return false;
            }
        }
        
        // Validate data types
        if (typeof char.level !== 'number' || char.level < 1 || char.level > 200) return false;
        if (typeof char.hp !== 'number' || char.hp < 0) return false;
        if (typeof char.mp !== 'number' || char.mp < 0) return false;
        if (typeof char.x !== 'number' || isNaN(char.x)) return false;
        if (typeof char.y !== 'number' || isNaN(char.y)) return false;
        
        return true;
    }
    
    // Get saved characters with corruption handling
    getSavedCharacters() {
        try {
            // Try main save first
            const mainSave = localStorage.getItem(this.saveKey);
            if (mainSave) {
                const saveData = JSON.parse(mainSave);
                if (this.validateSaveData(saveData)) {
                    return saveData.data;
                } else {
                    console.warn('Main save corrupted, trying backup...');
                    gameErrorHandler.logError('Save Corruption', 'Main save file corrupted');
                }
            }
            
            // Try backup save
            const backupSave = localStorage.getItem(this.backupKey);
            if (backupSave) {
                const saveData = JSON.parse(backupSave);
                if (this.validateSaveData(saveData)) {
                    console.log('Restored from backup save');
                    // Restore main save from backup
                    localStorage.setItem(this.saveKey, backupSave);
                    return saveData.data;
                } else {
                    console.error('Backup save also corrupted');
                    gameErrorHandler.logError('Save Corruption', 'Backup save also corrupted');
                }
            }
            
            return {};
        } catch (e) {
            console.error("Error parsing saved characters:", e);
            gameErrorHandler.logError('Save Parse Error', e.message);
            
            // Try to recover by clearing corrupted saves
            localStorage.removeItem(this.saveKey);
            localStorage.removeItem(this.backupKey);
            return {};
        }
    }
    
    // Save characters with backup
    saveCharacters(characters) {
        try {
            const saveData = this.createSaveData(characters);
            const saveString = JSON.stringify(saveData);
            
            // Create backup of current save before overwriting
            const currentSave = localStorage.getItem(this.saveKey);
            if (currentSave) {
                localStorage.setItem(this.backupKey, currentSave);
            }
            
            // Save new data
            localStorage.setItem(this.saveKey, saveString);
            
            // Update metadata
            const metadata = {
                lastSave: Date.now(),
                totalSaves: (this.getMetadata().totalSaves || 0) + 1,
                gameVersion: '0.852'
            };
            localStorage.setItem(this.metaKey, JSON.stringify(metadata));
            
            return true;
        } catch (e) {
            console.error("Failed to save characters:", e);
            gameErrorHandler.logError('Save Failed', e.message);
            return false;
        }
    }
    
    // Get save metadata
    getMetadata() {
        try {
            const meta = localStorage.getItem(this.metaKey);
            return meta ? JSON.parse(meta) : {};
        } catch (e) {
            return {};
        }
    }
    
    // Export save data for backup
    exportSaveData() {
        const characters = this.getSavedCharacters();
        const audioSettings = this.getAudioSettings();
        const metadata = this.getMetadata();
        
        return {
            characters,
            audioSettings,
            metadata,
            exportDate: new Date().toISOString(),
            gameVersion: '0.852'
        };
    }
    
    // Import save data
    importSaveData(importData) {
        try {
            if (importData.characters) {
                this.saveCharacters(importData.characters);
            }
            if (importData.audioSettings) {
                this.saveAudioSettings(importData.audioSettings);
            }
            return true;
        } catch (e) {
            console.error("Failed to import save data:", e);
            return false;
        }
    }
    
    // Audio settings management
    getAudioSettings() {
        try {
            const settings = localStorage.getItem(this.audioKey);
            return settings ? JSON.parse(settings) : {
                sfx: GAME_CONFIG.DEFAULT_SFX_VOLUME,
                bgm: GAME_CONFIG.DEFAULT_BGM_VOLUME,
                lastSfx: GAME_CONFIG.DEFAULT_SFX_VOLUME,
                lastBgm: GAME_CONFIG.DEFAULT_BGM_VOLUME
            };
        } catch (e) {
            return {
                sfx: GAME_CONFIG.DEFAULT_SFX_VOLUME,
                bgm: GAME_CONFIG.DEFAULT_BGM_VOLUME,
                lastSfx: GAME_CONFIG.DEFAULT_SFX_VOLUME,
                lastBgm: GAME_CONFIG.DEFAULT_BGM_VOLUME
            };
        }
    }
    
    saveAudioSettings(settings) {
        try {
            localStorage.setItem(this.audioKey, JSON.stringify(settings));
            return true;
        } catch (e) {
            console.error("Failed to save audio settings:", e);
            return false;
        }
    }
    
    // Clear all save data
    clearAllSaves() {
        localStorage.removeItem(this.saveKey);
        localStorage.removeItem(this.backupKey);
        localStorage.removeItem(this.audioKey);
        localStorage.removeItem(this.metaKey);
    }
    
    // Get storage usage info
    getStorageInfo() {
        let totalSize = 0;
        const keys = [this.saveKey, this.backupKey, this.audioKey, this.metaKey];
        
        keys.forEach(key => {
            const item = localStorage.getItem(key);
            if (item) {
                totalSize += item.length;
            }
        });
        
        return {
            totalSize: totalSize,
            totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
            keys: keys.length
        };
    }
}

// Global save manager
const saveManager = new SaveManager();

/**
 * Retrieves all saved characters from local storage.
 * @returns {object} An object containing all character data.
 */
function getSavedCharacters() {
    return saveManager.getSavedCharacters();
}

/**
 * Creates a snapshot of the current character's appearance for use in character selection
 */
function createCharacterSnapshot() {
    try {
        // Create a temporary canvas for the snapshot - use same size as game rendering
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Get player sprite data
        const pData = spriteData.player;
        if (!pData || !playerSheetImage || !playerSheetImage.complete) {
            console.log('Cannot create snapshot - sprites not loaded');
            return createFallbackSnapshot();
        }
        
        // Use the same scale as the game's player rendering for perfect pixels
        const PIXEL_ART_SCALE = 4;
        canvas.width = pData.frameWidth * PIXEL_ART_SCALE;
        canvas.height = pData.frameHeight * PIXEL_ART_SCALE;
        ctx.imageSmoothingEnabled = false;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Use idle animation frame 0 for snapshot
        const frame = pData.animations.idle[0];
        if (!frame) {
            console.log('Cannot create snapshot - no idle frame');
            return createFallbackSnapshot();
        }
        
        // Create a draw queue similar to the main game rendering system
        const drawQueue = [];
        
        // Calculate skin color Y position
        const skinY = pData.frameHeight * (player.customization.skinTone + 1);
        
        // Add body layers to draw queue
        drawQueue.push({ type: 'body', zLevel: 1, source: playerSheetImage, sx: frame.x, sy: skinY, sWidth: pData.frameWidth, sHeight: pData.frameHeight }); // Skin
        drawQueue.push({ type: 'body', zLevel: 5, source: playerSheetImage, sx: frame.x, sy: 0, sWidth: pData.frameWidth, sHeight: pData.frameHeight }); // Clothes
        
        // Add eyes to draw queue if available
        if (playerEyesSheet && playerEyesSheet.complete && frame.attachments?.eyes) {
            const eyeData = spriteData.playerEyes;
            const eyeSourceX = 0; // Not blinking for portrait
            const eyeSourceY = eyeData.frameHeight * player.customization.eyeColor;
            
            drawQueue.push({ 
                type: 'eyes', 
                zLevel: 10, 
                source: playerEyesSheet, 
                sx: eyeSourceX, 
                sy: eyeSourceY, 
                sWidth: eyeData.frameWidth, 
                sHeight: eyeData.frameHeight, 
                attachment: frame.attachments.eyes 
            });
        }
        
        // Add equipped items to draw queue - with better error handling
        if (window.playerEquipmentSheet && window.playerEquipmentSheet.complete && 
            spriteData.playerEquipment && spriteData.playerEquipment.icons) {
            const allSlots = ['cape', 'bottom', 'shoes', 'top', 'pendant', 'earring', 'gloves', 'helmet', 'weapon', 'face', 'eye'];
            
            // Check if hair hides earrings
            const hairStyle = player.customization?.hairStyle || 0;
            const hairData = spriteData.playerHair[hairStyle];
            const shouldHideEarrings = hairData?.hidesEarrings || false;
            
            allSlots.forEach(slot => {
                const item = player.cosmeticEquipped[slot] || player.equipped[slot];
                if (item && item.name) {
                    // Skip earrings if hair hides them
                    if (slot === 'earring' && shouldHideEarrings) {
                        return;
                    }
                    
                    try {
                        const itemInfo = itemData[item.name];
                        const iconData = spriteData.playerEquipment.icons[item.name];
                        
                        if (itemInfo && iconData && iconData.frames && iconData.frames[0]) {
                            const equipFrame = iconData.frames[0];
                            let zLevel = itemInfo.zLevel || 7;
                            
                            // When climbing, render gloves behind hair (z-level 7 instead of 8)
                            if (player.onLadder && slot === 'gloves') {
                                zLevel = 7;
                            }
                            
                            drawQueue.push({
                                type: 'equipment',
                                zLevel: zLevel,
                                source: window.playerEquipmentSheet,
                                sx: equipFrame.x,
                                sy: equipFrame.y,
                                sWidth: pData.frameWidth,
                                sHeight: pData.frameHeight,
                                itemName: item.name
                            });
                        }
                    } catch (itemError) {
                        console.log(`Skipping equipment ${item.name} due to error:`, itemError.message);
                        // Continue with other items
                    }
                }
            });
        }
        
        // Check if helmet hides hair (check both cosmetic and regular helmet slots)
        const cosmeticHelmet = player.cosmeticEquipped?.helmet;
        const equippedHelmet = player.equipped?.helmet;
        const helmet = cosmeticHelmet || equippedHelmet;
        const helmetHidesHair = helmet && itemData[helmet.name]?.hidesHair;
        
        const hairStyle = player.customization?.hairStyle || 0;
        const hairData = spriteData.playerHair[hairStyle];
        const hairWorksWithHats = hairData?.worksWithHats;
        
        // Add hair to draw queue (z-level 8 so it renders after most equipment but before helmets)
        if (player.customization && playerHairSheet && (!helmetHidesHair || hairWorksWithHats)) {
            const hairColor = customizationOptions.hairColors[player.customization.hairColor || 0];
            if (hairData) {
                drawQueue.push({
                    type: 'hair',
                    zLevel: 8,
                    source: playerHairSheet,
                    sx: hairData.x,
                    sy: hairData.y,
                    sWidth: hairData.width,
                    sHeight: hairData.height,
                    hairColor: hairColor
                });
            }
        }
        
        // Sort draw queue by zLevel (bottom to top)
        drawQueue.sort((a, b) => a.zLevel - b.zLevel);
        
        // Draw all items in the queue
        drawQueue.forEach(item => {
            try {
                if (item.type === 'hair') {
                    // Special handling for hair with color
                    ctx.save();
                    ctx.globalCompositeOperation = 'source-atop';
                    ctx.fillStyle = item.hairColor;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.drawImage(
                        item.source,
                        item.sx, item.sy, item.sWidth, item.sHeight,
                        0, 0, canvas.width, canvas.height
                    );
                    ctx.restore();
                } else if (item.type === 'eyes' && item.attachment) {
                    // Special handling for eyes with attachment points
                    const eyeX = item.attachment.x * PIXEL_ART_SCALE;
                    const eyeY = item.attachment.y * PIXEL_ART_SCALE;
                    const eyeWidth = item.sWidth * PIXEL_ART_SCALE;
                    const eyeHeight = item.sHeight * PIXEL_ART_SCALE;
                    
                    ctx.drawImage(
                        item.source, 
                        item.sx, item.sy, item.sWidth, item.sHeight,
                        eyeX, eyeY, eyeWidth, eyeHeight
                    );
                } else {
                    // Standard rendering for body and equipment
                    ctx.drawImage(
                        item.source, 
                        item.sx, item.sy, item.sWidth, item.sHeight,
                        0, 0, canvas.width, canvas.height
                    );
                }
            } catch (drawError) {
                console.log(`Error drawing item ${item.itemName || item.type}:`, drawError.message);
                // Continue with other items
            }
        });
        
        // Convert canvas to base64 data URL with high quality
        return canvas.toDataURL('image/png');
        
    } catch (error) {
        console.error('Error creating character snapshot:', error);
        return createFallbackSnapshot();
    }
}

/**
 * Creates a simple fallback snapshot when the full rendering fails
 */
function createFallbackSnapshot() {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;
        ctx.imageSmoothingEnabled = false;
        
        // Draw simple character representation
        ctx.fillStyle = '#ffdbac'; // Skin color
        ctx.fillRect(20, 15, 24, 20);
        
        // Draw body
        ctx.fillStyle = '#4a90e2'; // Blue shirt
        ctx.fillRect(18, 35, 28, 20);
        
        // Draw legs
        ctx.fillStyle = '#2c3e50'; // Dark pants
        ctx.fillRect(20, 55, 10, 8);
        ctx.fillRect(34, 55, 10, 8);
        
        // Draw class indicator
        ctx.fillStyle = '#fff';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        const classText = player.class ? player.class.charAt(0).toUpperCase() : 'B';
        ctx.fillText(classText, 32, 25);
        
        return canvas.toDataURL('image/png');
    } catch (fallbackError) {
        console.error('Even fallback snapshot failed:', fallbackError);
        return null;
    }
}

/**
 * Saves the current player's data to local storage AND Firebase cloud.
 */
function saveCharacter() {
    if (!player || !player.name) return false;

    const characters = saveManager.getSavedCharacters();

    // --- THIS IS THE FIX ---
    // Ensure the settings object exists
    if (!player.settings) {
        player.settings = {};
    }
    // Save the current key mappings to the player object
    if (typeof keyMappingManager !== 'undefined') {
        player.settings.keyMappings = keyMappingManager.mappings;
    }
    // --- END OF FIX ---

    const playerToSave = { ...player };

    // Convert Set to Array for JSON compatibility
    if (playerToSave.discoveredMaps instanceof Set) {
        playerToSave.discoveredMaps = Array.from(playerToSave.discoveredMaps);
    }

    if (playerToSave.stats && playerToSave.stats.talkedNPCs instanceof Set) {
        playerToSave.stats.talkedNPCs = Array.from(playerToSave.stats.talkedNPCs);
    }
    
    // Convert collectedRareItems Set to Array
    if (playerToSave.stats && playerToSave.stats.collectedRareItems instanceof Set) {
        playerToSave.stats.collectedRareItems = Array.from(playerToSave.stats.collectedRareItems);
    }


    characters[player.name] = playerToSave;
    const success = saveManager.saveCharacters(characters);

    if (success) {
        // Audio settings are saved globally, but at the same time as the character.
        const audioSettings = {
            sfx: sfxVolume,
            bgm: bgmVolume,
            lastSfx: lastSfxVolume,
            lastBgm: lastBgmVolume
        };
        saveManager.saveAudioSettings(audioSettings);
        
        // Register character with global database if it doesn't have a real ID yet
        if (player.characterId && player.characterId.startsWith('temp_')) {
            // Try to register and get a real ID
            if (typeof registerNewCharacter === 'function') {
                registerNewCharacter(playerToSave).then(result => {
                    if (result.success && result.characterId) {
                        player.characterId = result.characterId;
                        playerToSave.characterId = result.characterId;
                        // Re-save with the real ID
                        characters[player.name] = playerToSave;
                        saveManager.saveCharacters(characters);
                        console.log(`Character registered with ID: ${result.characterId}`);
                    }
                }).catch(err => {
                    console.warn('Failed to register character:', err);
                });
            }
        } else if (player.characterId && typeof saveCharacterById === 'function') {
            // Character has a real ID, sync to global database
            saveCharacterById(player.characterId, playerToSave).catch(err => {
                console.warn('Failed to sync character to global DB:', err);
            });
        }
        
        // Also save to Firebase cloud (async, don't wait for it)
        if (typeof saveCharacterToCloud === 'function') {
            saveCharacterToCloud(playerToSave).catch(err => {
                console.warn('Cloud save failed:', err);
            });
        }
    }

    return success;
}

// Flag to track if we've already tried to migrate this character
let cloudMigrationAttempted = {};

/**
 * Async function to load character from cloud and migrate if needed.
 * Called after the synchronous loadCharacter completes.
 */
async function syncCharacterWithCloud(characterName) {
    if (!characterName) return;
    
    // Don't attempt migration more than once per session per character
    if (cloudMigrationAttempted[characterName]) return;
    cloudMigrationAttempted[characterName] = true;
    
    // Check if Firebase functions are available
    if (typeof loadCharacterFromCloud !== 'function' || typeof saveCharacterToCloud !== 'function') {
        console.log('Cloud functions not available');
        return;
    }
    
    try {
        // Try to load from cloud
        const cloudData = await loadCharacterFromCloud(characterName);
        
        if (cloudData) {
            // Compare cloud data with local data
            const localLevel = player.level || 1;
            const cloudLevel = cloudData.level || 1;
            const localPlayTime = player.timePlayed || 0;
            const cloudPlayTime = cloudData.timePlayed || 0;
            
            // Use cloud data if it's more advanced
            if (cloudLevel > localLevel || (cloudLevel === localLevel && cloudPlayTime > localPlayTime)) {
                console.log(`Cloud save is more advanced (Level ${cloudLevel} vs ${localLevel}), updating local...`);
                
                // Apply cloud data to player (need to re-run migrations)
                applyCloudDataToPlayer(cloudData);
                
                addChatMessage(`☁️ Loaded cloud save (Level ${cloudLevel})`, 'system');
            } else {
                // Local is more advanced, sync to cloud (force immediate save for migration)
                console.log(`Local save is more advanced, syncing to cloud...`);
                await saveCharacterToCloud(player, true); // Force immediate
            }
        } else {
            // No cloud save exists, migrate local to cloud (force immediate save for migration)
            console.log(`No cloud save found for "${characterName}", migrating...`);
            await saveCharacterToCloud(player, true); // Force immediate
            addChatMessage(`☁️ Character synced to cloud!`, 'system');
        }
    } catch (error) {
        console.error('Error syncing with cloud:', error);
    }
}

/**
 * Applies cloud data to the current player object
 */
function applyCloudDataToPlayer(cloudData) {
    // Preserve current position for smooth gameplay
    const currentX = player.x;
    const currentY = player.y;
    const currentMapId = player.currentMapId;
    
    // Copy cloud data to player
    Object.assign(player, cloudData);
    
    // Restore position
    player.x = currentX;
    player.y = currentY;
    player.currentMapId = currentMapId;
    
    // Re-run Set conversions
    if (Array.isArray(player.discoveredMaps)) {
        player.discoveredMaps = new Set(player.discoveredMaps);
    }
    if (player.stats && Array.isArray(player.stats.talkedNPCs)) {
        player.stats.talkedNPCs = new Set(player.stats.talkedNPCs);
    }
    if (player.stats && Array.isArray(player.stats.collectedRareItems)) {
        player.stats.collectedRareItems = new Set(player.stats.collectedRareItems);
    }
    
    // Re-initialize stats
    initializePlayerStats();
    
    // Recalculate maxExp to ensure correct EXP curve
    recalculateMaxExp();
    
    // Update UI
    if (typeof updateUI === 'function') updateUI();
    if (typeof updateInventoryUI === 'function') updateInventoryUI();
    if (typeof updateEquipmentUI === 'function') updateEquipmentUI();
    if (typeof updateSkillTreeUI === 'function') updateSkillTreeUI();
}

/**
 * Migrates a pre-existing character to the new ID system
 * Handles name conflicts by prompting for rename
 */
async function migrateCharacterToIdSystem(characterName, playerData) {
    // Check if the migration functions are available
    if (typeof registerNewCharacter !== 'function' || typeof isCharacterNameTaken !== 'function') {
        console.log('Migration functions not available, skipping ID migration');
        return;
    }
    
    try {
        console.log(`Attempting to migrate character "${characterName}" to ID system...`);
        
        // Try to register the character
        const result = await registerNewCharacter(playerData);
        
        if (result.success) {
            // Successfully registered! Update local data with new ID
            player.characterId = result.characterId;
            playerData.characterId = result.characterId;
            
            // Save the updated character with the new ID
            const characters = getSavedCharacters();
            characters[characterName] = playerData;
            saveManager.saveCharacters(characters);
            
            console.log(`Successfully migrated "${characterName}" with ID: ${result.characterId}`);
            
            if (typeof addChatMessage === 'function') {
                addChatMessage('☁️ Character synced to cloud!', 'system');
            }
        } else if (result.error === 'name_taken') {
            // Name conflict! Show rename dialog
            console.log(`Name "${characterName}" is already taken by another player`);
            showCharacterRenamePrompt(characterName, playerData);
        } else {
            console.warn('Failed to migrate character:', result.error);
        }
    } catch (error) {
        console.error('Error during character migration:', error);
    }
}

/**
 * Shows a prompt for the player to rename their character due to name conflict
 */
function showCharacterRenamePrompt(oldName, playerData) {
    // Don't show if already showing
    if (document.getElementById('rename-character-modal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'rename-character-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10001;
    `;
    
    modal.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 3px solid #f39c12;
            border-radius: 15px;
            padding: 30px;
            max-width: 450px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        ">
            <div style="font-size: 28px; margin-bottom: 15px;">⚠️ Name Conflict</div>
            <div style="color: #bdc3c7; margin-bottom: 20px; line-height: 1.6;">
                The name "<span style="color: #f1c40f; font-weight: bold;">${oldName}</span>" is already registered by another player in the cloud.
                <br><br>
                Please choose a new name for your character to continue syncing to the cloud.
            </div>
            <input type="text" id="new-character-name" placeholder="Enter new name" value="${oldName}" 
                style="
                    width: 100%;
                    padding: 12px;
                    margin-bottom: 15px;
                    background: #0f0f23;
                    border: 2px solid #34495e;
                    border-radius: 8px;
                    color: white;
                    font-size: 16px;
                    text-align: center;
                    box-sizing: border-box;
                "
                maxlength="16"
            >
            <div id="rename-error" style="color: #e74c3c; margin-bottom: 15px; min-height: 20px;"></div>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="submitCharacterRename('${oldName}')" style="
                    padding: 12px 25px;
                    background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 14px;
                ">Rename Character</button>
                <button onclick="skipCharacterRename()" style="
                    padding: 12px 25px;
                    background: linear-gradient(135deg, #7f8c8d 0%, #6c7a89 100%);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 14px;
                ">Play Offline</button>
            </div>
            <div style="color: #7f8c8d; font-size: 12px; margin-top: 15px;">
                Playing offline means your character won't sync to the cloud until renamed.
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Store the old player data for the rename function
    window._pendingRenameData = { oldName, playerData };
    
    // Focus the input
    setTimeout(() => {
        document.getElementById('new-character-name')?.focus();
    }, 100);
}

/**
 * Handle character rename submission
 */
async function submitCharacterRename(oldName) {
    const newNameInput = document.getElementById('new-character-name');
    const errorDiv = document.getElementById('rename-error');
    const newName = newNameInput?.value?.trim();
    
    if (!newName) {
        errorDiv.textContent = 'Please enter a name';
        return;
    }
    
    if (newName.length > 16) {
        errorDiv.textContent = 'Name cannot be longer than 16 characters';
        return;
    }
    
    // Check if new name is same as old
    if (newName.toLowerCase() === oldName.toLowerCase()) {
        errorDiv.textContent = 'Please choose a different name';
        return;
    }
    
    // Check local characters
    const characters = getSavedCharacters();
    if (characters[newName] && newName !== oldName) {
        errorDiv.textContent = 'You already have a character with that name';
        return;
    }
    
    // Check if new name is available in cloud
    errorDiv.textContent = 'Checking availability...';
    errorDiv.style.color = '#3498db';
    
    try {
        const taken = await isCharacterNameTaken(newName);
        if (taken.taken) {
            errorDiv.textContent = 'That name is also taken. Try another.';
            errorDiv.style.color = '#e74c3c';
            return;
        }
        
        // Name is available! Perform the rename
        const pendingData = window._pendingRenameData;
        if (!pendingData) return;
        
        // Update player data with new name
        pendingData.playerData.name = newName;
        player.name = newName;
        
        // Remove old character entry, add new one
        delete characters[oldName];
        characters[newName] = pendingData.playerData;
        saveManager.saveCharacters(characters);
        
        // Try to register with the new name
        const result = await registerNewCharacter(pendingData.playerData);
        if (result.success) {
            player.characterId = result.characterId;
            pendingData.playerData.characterId = result.characterId;
            characters[newName] = pendingData.playerData;
            saveManager.saveCharacters(characters);
            
            // Update nameplate
            document.getElementById('player-nameplate').textContent = newName;
            if (typeof updatePlayerNameplate === 'function') updatePlayerNameplate();
            
            if (typeof showNotification === 'function') {
                showNotification(`Character renamed to "${newName}" and synced!`, 'legendary');
            }
        }
        
        // Close the modal
        closeRenameModal();
        
    } catch (error) {
        console.error('Error during rename:', error);
        errorDiv.textContent = 'Error checking name. Try again.';
        errorDiv.style.color = '#e74c3c';
    }
}

/**
 * Skip renaming and play offline (no cloud sync)
 */
function skipCharacterRename() {
    if (typeof addChatMessage === 'function') {
        addChatMessage('⚠️ Playing offline - character not synced to cloud', 'system');
    }
    closeRenameModal();
}

function closeRenameModal() {
    const modal = document.getElementById('rename-character-modal');
    if (modal) modal.remove();
    delete window._pendingRenameData;
}

// Make functions globally available
window.submitCharacterRename = submitCharacterRename;
window.skipCharacterRename = skipCharacterRename;
window.closeRenameModal = closeRenameModal;

// in player.js

function loadCharacter(characterName) {
    const characters = getSavedCharacters();
    let playerData = characters[characterName];

    // Migrate pre-existing characters to the ID system (async, won't block loading)
    if (!playerData.characterId || playerData.characterId.startsWith('temp_')) {
        migrateCharacterToIdSystem(characterName, playerData);
    }

    // --- THIS IS THE FIX ---
    // Defensively ensure new properties exist for older save files before migration
    playerData.cosmeticEquipped = playerData.cosmeticEquipped || {};
    playerData.abilities = playerData.abilities || [];
    playerData.customization = playerData.customization || {
        hairStyle: 0,
        hairColor: 0,
        eyeColor: 0,
        skinTone: 0
    };
    playerData.tutorialActions = playerData.tutorialActions || {};
    playerData.hasLeftDewdrop = playerData.hasLeftDewdrop !== undefined ? playerData.hasLeftDewdrop : false;
    playerData.hasSeenBeginnerSkillPopup = playerData.hasSeenBeginnerSkillPopup || false;
    // If baseStats doesn't exist (old save), assume default rolled stats of 4/4/4/4
    if (!playerData.baseStats) {
        playerData.baseStats = { str: 4, dex: 4, int: 4, luk: 4 };
    }
    
    // Track last played time for character selection sorting
    playerData.lastPlayed = Date.now();
    
    // Migrate old pet system to new system
    if (playerData.pet && !playerData.petInventory) {
        // Old save had pet - migrate to new system
        playerData.petInventory = [playerData.pet.type];
        playerData.activePet = {
            type: playerData.pet.type,
            x: playerData.pet.x || player.x - 60,
            y: playerData.pet.y || player.y,
            animationFrame: 0,
            animationTimer: 0,
            isSpawned: true,
            velocityY: 0,
            previousY: playerData.pet.y || player.y,
            isJumping: false,
            yOffset: -6,
            facingLeft: false
        };
        delete playerData.pet;
    }
    
    // Initialize new pet system for older save files
    if (!playerData.petInventory) {
        playerData.petInventory = [];
    }
    if (!playerData.activePet) {
        playerData.activePet = null;
    }
    
    // Initialize gold tier pet tracking for older saves
    if (!playerData.bestiaryRewards) {
        playerData.bestiaryRewards = {};
    }
    if (!playerData.bestiaryRewards.goldTierPetsAwarded) {
        playerData.bestiaryRewards.goldTierPetsAwarded = {};
    }
    
    // Ensure active pet has all required properties if it exists
    if (playerData.activePet && playerData.activePet.isSpawned) {
        if (playerData.activePet.velocityY === undefined) playerData.activePet.velocityY = 0;
        if (playerData.activePet.previousY === undefined) playerData.activePet.previousY = playerData.activePet.y;
        if (playerData.activePet.isJumping === undefined) playerData.activePet.isJumping = false;
        if (playerData.activePet.yOffset === undefined) playerData.activePet.yOffset = -6;
        if (playerData.activePet.animationFrame === undefined) playerData.activePet.animationFrame = 0;
        if (playerData.activePet.animationTimer === undefined) playerData.activePet.animationTimer = 0;
        if (playerData.activePet.facingLeft === undefined) playerData.activePet.facingLeft = false;
    }
    // --- END OF FIX ---

    // Run the migration function to update old item names in the save file.
    playerData = migratePlayerItems(playerData);
    // --- END OF MIGRATION CALL ---

    player = playerData;
    
    // Migration: Initialize specialMedals for older characters
    if (!player.specialMedals) {
        player.specialMedals = {};
    }

    // Migrate hotbar to new drag & drop system
    if (typeof migrateHotbar === 'function') {
        migrateHotbar();
    }

    // --- THIS IS THE FIX ---
    // Load custom key mappings if they exist, otherwise initialize defaults for older saves
    if (typeof keyMappingManager !== 'undefined') {
        if (player.settings && player.settings.keyMappings) {
            keyMappingManager.mappings = player.settings.keyMappings;
            // Validate and fix any incorrect Escape key mappings
            keyMappingManager.validateMappings();
        } else {
            keyMappingManager.initializeForNewCharacter();
        }
    }
    // --- END OF FIX ---

    // Migration: Ensure existing characters meet new minimum (16) or keep their current slots if higher
    const loadedSlots = playerData.inventorySlots || 15;
    player.inventorySlots = Math.max(loadedSlots, 16);
    
    // If we upgraded from 15 to 16, log it
    if (loadedSlots === 15 && player.inventorySlots === 16) {
        console.log('Migrated character from 15 to 16 inventory slots');
    }

    if (player.discoveredMaps && Array.isArray(player.discoveredMaps)) {
        player.discoveredMaps = new Set(player.discoveredMaps);
    } else {
        player.discoveredMaps = new Set(['henesys']);
    }

    // Convert talkedNPCs to Set if it's an array from save data
    if (player.stats.talkedNPCs && Array.isArray(player.stats.talkedNPCs)) {
        player.stats.talkedNPCs = new Set(player.stats.talkedNPCs);
    } else if (!player.stats.talkedNPCs) {
        player.stats.talkedNPCs = new Set();
    }

    // Initialize missing stats for existing save files
    initializePlayerStats();
    
    // Recalculate maxExp to ensure all characters use the same EXP curve
    // This fixes any discrepancies from old saves or curve changes
    recalculateMaxExp();
    
    // Initialize monster pet data for any monster-derived pets
    initializeMonsterPets();

    // Validate player position and provide safe defaults if corrupted
    if (typeof player.x !== 'number' || isNaN(player.x) || player.x < 0) {
        console.warn('Invalid player X position detected, resetting to safe default');
        player.x = 150;
    }
    if (typeof player.y !== 'number' || isNaN(player.y) || player.y < 0) {
        console.warn('Invalid player Y position detected, resetting to safe default');
        player.y = 300;
    }

    // Ensure player has valid currentMapId
    if (!player.currentMapId || !maps[player.currentMapId]) {
        console.warn('Invalid or missing map ID, resetting to Dewdrop Beach');
        player.currentMapId = 'dewdropBeach';
        player.x = 400;
        player.y = 300;
    }

    document.getElementById('player-nameplate').textContent = player.name;
    updatePlayerNameplate();
    
    // Sync with cloud storage (async, won't block)
    syncCharacterWithCloud(characterName);
    
    // If character has an ID, try to sync with global database to get latest version
    if (player.characterId && !player.characterId.startsWith('temp_') && typeof loadCharacterById === 'function') {
        loadCharacterById(player.characterId).then(result => {
            if (result.success && result.characterData) {
                const globalData = result.characterData;
                const localLevel = player.level || 1;
                const globalLevel = globalData.level || 1;
                const localPlayTime = player.timePlayed || 0;
                const globalPlayTime = globalData.timePlayed || 0;
                
                // Use global data if it's more advanced
                if (globalLevel > localLevel || (globalLevel === localLevel && globalPlayTime > localPlayTime)) {
                    console.log(`Global database has newer data (Level ${globalLevel} vs ${localLevel}), syncing...`);
                    
                    // Apply the global data while preserving current session position
                    const currentX = player.x;
                    const currentY = player.y;
                    const currentMapId = player.currentMapId;
                    
                    // Apply relevant fields from global
                    Object.assign(player, globalData);
                    
                    // Restore position
                    player.x = currentX;
                    player.y = currentY;
                    player.currentMapId = currentMapId;
                    
                    // Re-convert Sets
                    if (player.discoveredMaps && Array.isArray(player.discoveredMaps)) {
                        player.discoveredMaps = new Set(player.discoveredMaps);
                    }
                    if (player.stats?.talkedNPCs && Array.isArray(player.stats.talkedNPCs)) {
                        player.stats.talkedNPCs = new Set(player.stats.talkedNPCs);
                    }
                    
                    // Update UI
                    if (typeof updateUI === 'function') updateUI();
                    if (typeof calculatePlayerStats === 'function') calculatePlayerStats();
                    
                    if (typeof addChatMessage === 'function') {
                        addChatMessage('☁️ Synced latest data from cloud!', 'system');
                    }
                }
            }
        }).catch(err => {
            console.warn('Failed to sync with global database:', err);
        });
    }
}

/**
 * Checks for overleveled skills after balance changes and refunds SP
 * This runs on character load to fix any skills that exceed their new maxLevel
 */
function refundOverleveledSkillSP() {
    if (!player.abilities || !Array.isArray(player.abilities)) return;
    if (typeof skillData === 'undefined') return;
    
    let totalRefundedSP = 0;
    let totalRefundedBeginnerSP = 0;
    const refundedSkills = [];
    
    // Check all learned skills
    for (const learnedSkill of player.abilities) {
        if (!learnedSkill.name || !learnedSkill.level) continue;
        
        // Find the skill template across all classes
        let skillTemplate = null;
        let skillClass = null;
        
        // Check all skill classes to find the template
        for (const className of Object.keys(skillData)) {
            if (skillData[className] && Array.isArray(skillData[className])) {
                const found = skillData[className].find(s => s.name === learnedSkill.name);
                if (found) {
                    skillTemplate = found;
                    skillClass = className;
                    break;
                }
            }
        }
        
        if (!skillTemplate) continue; // Skill not found in data, skip
        
        const maxLevel = skillTemplate.maxLevel || 1;
        
        // Check if skill is overleveled
        if (learnedSkill.level > maxLevel) {
            const excessLevels = learnedSkill.level - maxLevel;
            
            // Determine if this is a beginner skill or regular skill
            if (skillClass === 'beginner') {
                totalRefundedBeginnerSP += excessLevels;
            } else {
                totalRefundedSP += excessLevels;
            }
            
            refundedSkills.push({
                name: skillTemplate.displayName || learnedSkill.name,
                oldLevel: learnedSkill.level,
                newLevel: maxLevel,
                refunded: excessLevels
            });
            
            // Cap the skill at the new max level
            learnedSkill.level = maxLevel;
        }
    }
    
    // Apply refunds
    if (totalRefundedSP > 0) {
        player.sp = (player.sp || 0) + totalRefundedSP;
    }
    if (totalRefundedBeginnerSP > 0) {
        player.beginnerSp = (player.beginnerSp || 0) + totalRefundedBeginnerSP;
    }
    
    // Log and notify if any refunds occurred
    if (refundedSkills.length > 0) {
        console.log('[Skill Rebalance] Refunded SP for overleveled skills:');
        for (const skill of refundedSkills) {
            console.log(`  - ${skill.name}: Level ${skill.oldLevel} → ${skill.newLevel} (+${skill.refunded} SP refunded)`);
        }
        
        if (totalRefundedSP > 0) {
            console.log(`[Skill Rebalance] Total SP refunded: ${totalRefundedSP}`);
        }
        if (totalRefundedBeginnerSP > 0) {
            console.log(`[Skill Rebalance] Total Beginner SP refunded: ${totalRefundedBeginnerSP}`);
        }
        
        // Show notification to player after a short delay (so UI is ready)
        setTimeout(() => {
            const totalRefund = totalRefundedSP + totalRefundedBeginnerSP;
            if (typeof addChatMessage === 'function') {
                addChatMessage(`[Skill Rebalance] ${totalRefund} SP refunded from ${refundedSkills.length} skill(s) due to balance changes!`, 'system');
            }
            if (typeof showNotification === 'function') {
                showNotification(`+${totalRefund} SP Refunded!`, 'legendary');
            }
        }, 1000);
    }
}

/**
 * Initializes or fixes player stats for backwards compatibility and corrupted save data
 */
function initializePlayerStats() {
    if (!player.stats) player.stats = {};
    
    // CRITICAL: Clear old guild data - guilds are now managed via Firebase Social Hub
    // Old guilds were just stored as strings locally, new system requires Firebase
    if (player.guild && typeof player.guild === 'string') {
        console.log(`[Guild Cleanup] Clearing old local guild: ${player.guild}`);
        player.guild = null;
    }
    
    // Initialize buddies array if not exists
    if (!player.buddies) player.buddies = [];
    
    // CRITICAL: Initialize equipped slots to prevent undefined errors
    if (!player.equipped) {
        player.equipped = { weapon: null, helmet: null, top: null, bottom: null, gloves: null, shoes: null, earring: null, ring: null, pendant: null, shield: null, face: null, eye: null };
    }
    if (!player.cosmeticEquipped) {
        player.cosmeticEquipped = { weapon: null, helmet: null, top: null, bottom: null, gloves: null, shoes: null, earring: null, ring: null, pendant: null, shield: null, face: null, eye: null };
    }
    
    // Initialize basic stats
    if (!player.stats.goldSpent) player.stats.goldSpent = 0;
    if (!player.stats.totalGoldEarned) player.stats.totalGoldEarned = 0;
    if (!player.stats.totalKills) player.stats.totalKills = 0;
    if (!player.stats.enhanceSuccessCount) player.stats.enhanceSuccessCount = 0;
    if (!player.stats.potionsUsed) player.stats.potionsUsed = 0;
    if (!player.stats.deathCount) player.stats.deathCount = 0;
    
    // Initialize trading stats
    if (!player.stats.tradesCompleted) player.stats.tradesCompleted = 0;
    if (!player.stats.goldTraded) player.stats.goldTraded = 0;
    
    // Initialize party stats
    if (!player.stats.partiesCreated) player.stats.partiesCreated = 0;
    if (!player.stats.partyKills) player.stats.partyKills = 0;
    if (!player.stats.partyBossKills) player.stats.partyBossKills = 0;
    
    if (!player.bestiary) player.bestiary = { monsterKills: {}, dropsFound: {}, firstKillTimestamp: {} };
    if (!player.bestiaryRewards) player.bestiaryRewards = {};
    if (!player.bestiaryRewards.claimedMedals) player.bestiaryRewards.claimedMedals = {};
    if (!player.bestiaryRewards.hiddenMedals) player.bestiaryRewards.hiddenMedals = {};
    
    // Check for retroactive Monster Killer medals
    checkAllMonsterKillerMedals();
    
    // Check for overleveled skills and refund SP (after skill balance changes)
    refundOverleveledSkillSP();
    
    // Mark existing epic/legendary items as already announced (prevent duplicate announcements)
    markExistingRareItemsAsAnnounced();
    
    // Fix Set objects that may have been corrupted by JSON serialization
    if (!player.stats.talkedNPCs || typeof player.stats.talkedNPCs.add !== 'function') {
        if (Array.isArray(player.stats.talkedNPCs)) {
            player.stats.talkedNPCs = new Set(player.stats.talkedNPCs);
        } else {
            player.stats.talkedNPCs = new Set();
        }
    }
    
    // --- NEW: Clean up deleted or outdated achievements from old player saves ---
    if (player.achievements && (player.achievements.progress || player.achievements.completed || player.achievements.claimed)) {
        // Only cleanup if achievementData is available (after data.js loads)
        if (typeof achievementData !== 'undefined' && achievementData) {
            const validAchievementIds = Object.keys(achievementData);
            
            // Remove deleted achievements from progress
            if (player.achievements.progress) {
                for (const id in player.achievements.progress) {
                    if (!validAchievementIds.includes(id)) {
                        delete player.achievements.progress[id];
                        console.log(`[Cleanup] Removed deleted achievement progress: ${id}`);
                    }
                }
            }
            
            // Remove deleted achievements from completed
            if (player.achievements.completed) {
                for (const id in player.achievements.completed) {
                    if (!validAchievementIds.includes(id)) {
                        delete player.achievements.completed[id];
                        console.log(`[Cleanup] Removed deleted achievement completion: ${id}`);
                    }
                }
            }
            
            // Remove deleted achievements from claimed
            if (player.achievements.claimed) {
                for (const id in player.achievements.claimed) {
                    if (!validAchievementIds.includes(id)) {
                        delete player.achievements.claimed[id];
                        console.log(`[Cleanup] Removed deleted achievement claim: ${id}`);
                    }
                }
            }
        }
    }
    // --- END NEW ---
}

function expandInventory() {
    const currentSlots = player.inventorySlots || 16;
    if (currentSlots >= 96) {
        addChatMessage("Your inventory is already at maximum size!", 'error');
        return false;
    }

    // Define the upgrade costs (16 -> 24 -> 32 -> 40 -> 48 -> 56 -> 64 -> 72 -> 80 -> 88 -> 96)
    const costs = {
        16: 10000,   // Cost to upgrade from 16 to 24
        24: 20000,   // Cost to upgrade from 24 to 32
        32: 30000,   // Cost to upgrade from 32 to 40
        40: 40000,  // Cost to upgrade from 40 to 48
        48: 50000,  // Cost to upgrade from 48 to 56
        56: 60000,  // Cost to upgrade from 56 to 64
        64: 70000,  // Cost to upgrade from 64 to 72
        72: 80000, // Cost to upgrade from 72 to 80
        80: 90000, // Cost to upgrade from 80 to 88
        88: 100000, // Cost to upgrade from 88 to 96
    };

    const cost = costs[currentSlots];
    if (player.gold < cost) {
        addChatMessage("Not enough gold!", 'error');
        return false;
    }

    player.gold -= cost;
    player.inventorySlots += 8;

    playSound('levelUp'); // Re-use the level up sound for a satisfying effect
    showMajorNotification(`Inventory expanded to ${player.inventorySlots} slots!`, 'success');

    // Update UI elements that show gold
    updateUI();
    updateInventoryUI();

    return true;
}

// --- Combat, Abilities & Items ---

function equipItem(itemToEquip, inventoryIndex) {
    console.log('[equipItem] Function called with:', itemToEquip.name, 'at index:', inventoryIndex);
    const itemInfo = itemData[itemToEquip.name];
    if (!itemInfo || (itemInfo.category !== 'Equip' && itemInfo.category !== 'Cosmetic')) {
        console.log('[equipItem] Item cannot be equipped - invalid category');
        showNotification("This item cannot be equipped.", 'error');
        return;
    }
    if (player.level < (itemToEquip.levelReq || itemInfo.levelReq || 1)) {
        console.log('[equipItem] Level too low - required:', itemToEquip.levelReq || itemInfo.levelReq, 'player:', player.level);
        showNotification("Level too low!", 'error');
        return;
    }

    // --- THIS IS THE FIX ---
    // Check for class requirements
    if (itemInfo.classReq) {
        let canEquip = false;
        let currentClass = player.class;
        // Check player's current class and all its parent classes (e.g., a Fighter is also a Warrior)
        while (currentClass) {
            if (itemInfo.classReq.includes(currentClass)) {
                canEquip = true;
                break;
            }
            const classInfo = classHierarchy[currentClass];
            currentClass = classInfo ? classInfo.parent : null;
        }

        if (!canEquip) {
            const requiredClasses = itemInfo.classReq.map(c => capitalize(c)).join(' / ');
            showNotification(`Only ${requiredClasses} can equip this item.`, 'error');
            return;
        }
    }
    // --- END OF FIX ---

    const slot = itemInfo.type;
    const isCosmetic = itemInfo.category === 'Cosmetic';
    const targetEquip = isCosmetic ? player.cosmeticEquipped : player.equipped;

    console.log('[equipItem] Equipping to slot:', slot, 'isCosmetic:', isCosmetic);

    if (slot) {
        if (targetEquip[slot]) {
            // Direct swap: put the currently equipped item in the inventory slot where the new item came from
            const currentlyEquipped = targetEquip[slot];
            console.log('[equipItem] Swapping with currently equipped:', currentlyEquipped.name);
            player.inventory[activeInventoryTab][inventoryIndex] = currentlyEquipped;
            targetEquip[slot] = itemToEquip;
        } else {
            // No item currently equipped, just equip the new item
            console.log('[equipItem] Equipping to empty slot');
            targetEquip[slot] = itemToEquip;
            player.inventory[activeInventoryTab].splice(inventoryIndex, 1);
        }
        
        playSound('equipItem');
        console.log('[equipItem] Item successfully equipped!');
        
        // Track tutorial action for Equipment Basics quest
        if (itemToEquip.name === 'Leather Cap' && typeof trackTutorialAction === 'function') {
            trackTutorialAction('equipLeatherCap');
        }
        
        selectedInventoryIndex = null;
        updateInventoryUI();
        updateEquipmentUI();
        updateUI();
        
        // Update stat window in real-time if open (equipment affects stats)
        if (statWindowElement && statWindowElement.style.display !== 'none') {
            updateStatWindowUI();
        }
        reapplyBuffs();
        
        // Notify server of appearance change for multiplayer
        if (typeof sendAppearanceUpdate === 'function') {
            sendAppearanceUpdate();
        }
    }
}

/**
 * Unequips an item and returns it to the inventory.
 * @param {string} slotType - The equipment slot to unequip from.
 * @param {boolean} isCosmetic - Whether the slot is for cosmetic gear.
 */
function dequipItem(slotType, isCosmetic) {
    const targetEquip = isCosmetic ? player.cosmeticEquipped : player.equipped;
    const itemToDequip = targetEquip[slotType];
    if (itemToDequip) {
        if (addItemToInventory(itemToDequip)) {
            targetEquip[slotType] = null;
            playSound('equipItem');
            updateEquipmentUI();
            updateInventoryUI();
            updateUI();
            
            // Update stat window in real-time if open (equipment affects stats)
            if (statWindowElement && statWindowElement.style.display !== 'none') {
                updateStatWindowUI();
            }

            // --- THIS IS THE NEW, MORE RELIABLE FIX ---
            // This forces the browser to repaint the inventory in a separate frame,
            // which reliably clears any stuck hover effects.
            const inventoryGrid = document.getElementById('inventory-grid');
            if (inventoryGrid) {
                inventoryGrid.style.display = 'none';
                requestAnimationFrame(() => {
                    inventoryGrid.style.display = 'grid';
                });
            }
            // --- END OF FIX ---
            reapplyBuffs();
            
            // Notify server of appearance change for multiplayer
            if (typeof sendAppearanceUpdate === 'function') {
                sendAppearanceUpdate();
            }
        }
    }
}

/**
 * Finds and uses a consumable item from the inventory by its name.
 * @param {string} itemName - The name of the item to use (e.g., 'Red Potion').
 */
function useItemByName(itemName) {
    // Look for the potion in the 'use' tab specifically
    const itemIndex = player.inventory.use.findIndex(i => i.name === itemName && i.quantity > 0);

    if (itemIndex > -1) {
        const item = player.inventory.use[itemIndex];
        // Call useItem and explicitly tell it the item is from the 'use' tab
        useItem(item, itemIndex, 'use');
    } else {
        showNotification(`You have no ${itemName}s left.`, 'error');
    }
}

function useItem(item, inventoryIndex, tab) {
    const itemInfo = itemData[item.name];
    if (!itemInfo || !itemInfo.effect) return;

    let itemConsumed = false;
    const finalStats = calculatePlayerStats();

    // --- Special case for Elixir ---
    if (item.name === 'Elixir') {
        // THIS IS THE MODIFIED LOGIC
        // Restores HP by half of the player's FINAL max HP (including gear)
        player.hp = Math.min(finalStats.finalMaxHp, player.hp + (finalStats.finalMaxHp / 2));
        // Restores MP by half of the player's FINAL max MP (including gear)
        player.mp = Math.min(finalStats.finalMaxMp, player.mp + (finalStats.finalMaxMp / 2));

        playSound('usePotion');
        itemConsumed = true;
    }
    // --- End of special case ---

    else if (itemInfo.type === 'buff') {
        const existingBuff = player.buffs.find(b => b.name === item.name);
        if (existingBuff) {
            showNotification("You already have this buff active.", 'error');
            return;
        }

        const endTime = Date.now() + itemInfo.duration;
        const newBuff = {
            name: item.name,
            displayName: item.name,
            effect: itemInfo.effect,
            endTime: endTime,
            isItemBuff: true
        };

        newBuff.timeoutId = setTimeout(() => {
            const buffIndex = player.buffs.findIndex(b => b.name === item.name);
            if (buffIndex > -1) {
                player.buffs.splice(buffIndex, 1);
                reapplyBuffs();
            }
        }, itemInfo.duration);

        player.buffs.push(newBuff);
        reapplyBuffs();
        showNotification(`${item.name} used!`, 'rare');
        playSound('usePotion');
        itemConsumed = true;

    } else { // Logic for all OTHER consumables
        const isHpOnly = (itemInfo.effect.hp || itemInfo.effect.hpPercent) && !itemInfo.effect.mp && !itemInfo.effect.mpPercent;
        const isMpOnly = (itemInfo.effect.mp || itemInfo.effect.mpPercent) && !itemInfo.effect.hp && !itemInfo.effect.hpPercent;
        const isBoth = (itemInfo.effect.hp || itemInfo.effect.hpPercent) && (itemInfo.effect.mp || itemInfo.effect.mpPercent);

        if ((isHpOnly && player.hp >= finalStats.finalMaxHp) ||
            (isMpOnly && player.mp >= finalStats.finalMaxMp) ||
            (isBoth && player.hp >= finalStats.finalMaxHp && player.mp >= finalStats.finalMaxMp)) {
            showNotification("HP/MP is already full.", 'error');
            return;
        }

        if (itemInfo.effect.hp) player.hp = Math.min(finalStats.finalMaxHp, player.hp + itemInfo.effect.hp);
        if (itemInfo.effect.mp) player.mp = Math.min(finalStats.finalMaxMp, player.mp + itemInfo.effect.mp);
        if (itemInfo.effect.hpPercent) player.hp = Math.min(finalStats.finalMaxHp, player.hp + Math.ceil(finalStats.finalMaxHp * (itemInfo.effect.hpPercent / 100)));
        if (itemInfo.effect.mpPercent) player.mp = Math.min(finalStats.finalMaxMp, player.mp + Math.ceil(finalStats.finalMaxMp * (itemInfo.effect.mpPercent / 100)));

        playSound('usePotion');
        itemConsumed = true;
    }

    if (itemConsumed) {
        item.quantity--;
        if (item.quantity <= 0) {
            player.inventory[tab].splice(inventoryIndex, 1);
        }
        
        // Track potion usage for achievements (all Use category items)
        if (itemInfo.category === 'Use') {
            player.stats.potionsUsed = (player.stats.potionsUsed || 0) + 1;
            updateAchievementProgress('action_accumulate', 'potionsUsed', 1);
        }
        
        // Update quest progress for useItem objectives
        updateQuestProgressUseItem(item.name);
    }

    updateInventoryUI();
    updateUI();
    updateSkillHotbarUI();

    if (statWindowElement && statWindowElement.style.display !== 'none') {
        updateStatWindowUI();
    }
}

function levelUpSkill(skillName) {
    let skillInfo = skillData[player.class]?.find(s => s.name === skillName) || skillData.beginner.find(s => s.name === skillName);
    
    // If not found in current class, search all skill data for cross-class skills
    if (!skillInfo) {
        for (const className in skillData) {
            if (skillData[className] && Array.isArray(skillData[className])) {
                skillInfo = skillData[className].find(s => s.name === skillName);
                if (skillInfo) break;
            }
        }
    }
    
    if (!skillInfo) return;

    const isBeginnerSkill = skillData.beginner.some(s => s.name === skillName);
    let learnedSkill = player.abilities.find(a => a.name === skillName);

    // --- UPDATED SP LOGIC ---
    // Determines which SP pool to use.
    let spPool = isBeginnerSkill ? 'beginnerSp' : 'sp';

    // If trying to level a beginner skill but out of beginner SP, use regular SP.
    if (spPool === 'beginnerSp' && (player.beginnerSp || 0) === 0) {
        spPool = 'sp';
    }

    // Check if the determined SP pool has points.
    if ((player[spPool] || 0) <= 0) {
        addChatMessage("Not enough SP!", 'error');
        return;
    }
    // --- END OF UPDATED SP LOGIC ---

    // This logic correctly forces you to spend remaining Beginner SP before using SP on 1st job skills.
    if (!isBeginnerSkill && (player.beginnerSp || 0) > 0) {
        addChatMessage("You must spend all of your Beginner SP first!", 'error');
        return;
    }

    if (!learnedSkill) {
        if (player.level >= skillInfo.levelReq) {
            player.abilities.push({ name: skillName, level: 1 });
            player[spPool]--; // Deduct from the correct pool
        }
    } else if (learnedSkill.level < skillInfo.maxLevel) {
        learnedSkill.level++;
        player[spPool]--; // Deduct from the correct pool
    }

    updateSkillTreeUI();
    updateSkillHotbarUI();
    
    // Update stat window in real-time if open (SP changes affect stats display)
    if (statWindowElement && statWindowElement.style.display !== 'none') {
        updateStatWindowUI();
    }
    
    // Restore gamepad selection if applicable
    if (typeof gamepadManager !== 'undefined' && window.gamepadLastSelectedSkillName) {
        setTimeout(() => {
            const skillTreeWindow = document.getElementById('skill-tree');
            if (skillTreeWindow && gamepadManager.restoreSkillSelection) {
                gamepadManager.restoreSkillSelection(skillTreeWindow);
            }
        }, 50);
    }
}

// in player.js

// in player.js

function handleLadderMovement(ladder) {
    // This function is now ONLY responsible for what happens WHILE on a ladder.
    player.animationState = 'climb';
    player.isJumping = false;
    player.velocityY = 0;
    player.velocityX = 0;

    // Move up or down with ground collision check
    const map = maps[currentMapId];
    const groundLevel = (map.height || scalingContainer.clientHeight) - GROUND_Y;

    // MODIFIED: Check the 'actions' object for movement
    if (actions['move-up']) {
        player.y -= GAME_CONFIG.LADDER_SPEED;
    } else if (actions['move-down']) {
        const newY = player.y + GAME_CONFIG.LADDER_SPEED;
        // Prevent going below ground level
        if (newY + player.height <= groundLevel) {
            player.y = newY;
        }
    }

    // MODIFIED: Animate only when moving based on 'actions'
    if (actions['move-up'] || actions['move-down']) {
        player.animationTimer++;
        if (player.animationTimer > 12) {
            player.animationTimer = 0;
            player.animationFrame = (player.animationFrame + 1) % spriteData.player.animations.climb.length;
        }
    } else {
        player.animationTimer = 0;
    }

    // MODIFIED: Jump off the ladder using the 'jump' action
    if (actions['jump']) {
        player.onLadder = false;
        player.isJumping = true;
        player.animationState = 'jump';
        player.velocityX = (actions['move-left'] ? -1 : 1) * player.speed;
        player.velocityY = player.jumpForce / 1.5;
    }

    // --- INSTANT LADDER CENTERING ---
    const ladderVisualCenter = ladder.x + (16 * GAME_CONFIG.PIXEL_ART_SCALE / 2);
    const playerVisualOffset = 60 / 2;
    const targetX = ladderVisualCenter - playerVisualOffset;

    // Instantly snap player to center of ladder
    player.x = targetX;
}

// in player.js

function determinePlayerAction() {
    let nearbyLadder = null;
    const playerCenterX = player.x + (player.width / 2);

    // Check for ladder proximity
    for (const p of platforms) {
        if (p.isLadder && playerCenterX > p.x && playerCenterX < p.x + 32 && player.y + player.height > p.y1 && player.y < p.y2) {
            nearbyLadder = p;
            break;
        }
    }

    // PRIORITY 1: LADDER ACTIONS
    if (nearbyLadder) {
        // MODIFIED: Check the 'actions' object
        if (actions['move-up'] || actions['move-down']) {
            if (!player.onLadder) {
                // Latch onto the ladder
                player.onLadder = true;
                player.isJumping = false;
                player.velocityY = 0;
                player.velocityX = 0;
            }
            // Move on the ladder
            handleLadderMovement(nearbyLadder);
            return; // Action decided: Climbing. Stop here.
        }
    }

    if (player.onLadder && !nearbyLadder) {
        player.onLadder = false;
    }

    // PRIORITY 2: GROUND/AIR MOVEMENT (only if not climbing)
    handleGroundAndAirMovement(!player.isJumping && !player.onLadder);
}

// in player.js

function updatePlayer() {
    if (player.isChanneling && !player.isJumping) {
        player.velocityX = 0;
    }
    // --- LADDER DETECTION & ACTION (HIGHEST PRIORITY) ---
    let nearbyLadder = null;
    const playerCenterX = player.x + player.width / 2;

    for (const p of platforms) {
        if (p.isLadder && playerCenterX > p.x && playerCenterX < p.x + 32 && player.y + player.height > p.y1 && player.y < p.y2) {
            nearbyLadder = p;
            break;
        }
    }

    // Check if player is currently on a platform to prevent ladder spazzing
    let currentlyOnPlatform = false;
    const playerCollisionX = player.x + (60 - player.width) / 2;
    for (const p of platforms) {
        if (p.isLadder || p.y === undefined) continue;
        if (isColliding({ ...player, x: playerCollisionX }, p) && player.velocityY >= 0 && player.previousY + player.height <= p.y) {
            currentlyOnPlatform = true;
            break;
        }
    }

    // MODIFIED: Check the 'actions' object to get on a ladder
    if (!player.onLadder && nearbyLadder && (actions['move-up'] || actions['move-down']) && !currentlyOnPlatform) {
        player.onLadder = true;
        player.isJumping = false;
    } else if (player.onLadder && !nearbyLadder) {
        player.onLadder = false;
    }

    if (player.onLadder) {
        handleLadderMovement(nearbyLadder);
        return;
    }

    // --- REGULAR MOVEMENT & PHYSICS (if not on a ladder) ---
    player.velocityY += GRAVITY;
    handleGroundAndAirMovement(!player.isJumping);

    // --- COLLISION RESOLUTION ---
    let onPlatform = false;
    platforms.forEach(p => {
        if (p.isLadder || p.y === undefined) return;
        const playerCollisionX = player.x + (60 - player.width) / 2;
        if (isColliding({ ...player, x: playerCollisionX }, p) && player.velocityY >= 0 && player.previousY + player.height <= p.y) {
            player.y = p.y - player.height;
            player.velocityY = 0;
            player.isJumping = false;
            player.hasFlashJumped = false; // Reset the ability on landing
            player.jumpInputConsumed = false; // Reset jump input when landing to allow continuous jumping

            // MODIFIED: Check the 'actions' object for movement
            if (actions['move-right']) {
                player.velocityX = player.speed;
            } else if (actions['move-left']) {
                player.velocityX = -player.speed;
            }

            onPlatform = true;
        }
    });

    // --- SLOPE COLLISION ---
    // Pattern for 'right' direction:
    //     S  G  G  G  G  <- top slope + ground cap (width)
    //  S  SE             <- slope + edge
    //  G  SE  G  G       <- ground level
    let onSlope = false;
    const map = maps[currentMapId];
    if (!onPlatform && (map.slopes || map.hills)) {
        const playerCenterX = player.x + player.width / 2;
        const playerBottom = player.y + player.height;
        const scaledTileSize = 48;
        const groundY = (map.height || scalingContainer.clientHeight) - GAME_CONFIG.GROUND_Y;
        
        // Expand hills into pairs of slopes for collision
        const allSlopes = [...(map.slopes || [])];
        (map.hills || []).forEach(hill => {
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
                width: 0, // No separate cap for down-slope (cap is shared at peak)
                isHillDownSlope: true
            });
        });
        
        for (const slope of allSlopes) {
            const numTiles = slope.tiles || 1;
            const slopeX = slope.x;
            // For hill down-slopes, no cap
            const capWidth = slope.isHillDownSlope ? 0 : (slope.width || scaledTileSize);
            const numCapTiles = Math.ceil(capWidth / scaledTileSize);
            
            // Total width: slope tiles + cap tiles
            const slopeWidth = numTiles * scaledTileSize;
            const totalHeight = numTiles * scaledTileSize;
            
            let startX, endX, capStartX, capEndX;
            const collisionPadding = 20; // Extend collision outward
            if (slope.direction === 'left') {
                // For hill down-slopes: no cap, slope starts at slopeX
                if (slope.isHillDownSlope) {
                    capStartX = slopeX;
                    capEndX = slopeX; // No cap area
                    startX = slopeX; // No padding at start (connects directly to up-slope cap)
                    endX = slopeX + slopeWidth + collisionPadding; // Padding at end
                } else {
                    // Regular left slope: cap on left
                    capStartX = slopeX - (numCapTiles * scaledTileSize);
                    capEndX = slopeX;
                    startX = capStartX - collisionPadding;
                    endX = slopeX + slopeWidth + collisionPadding;
                }
            } else {
                // Slopes start at slopeX, cap on right
                startX = slopeX - collisionPadding;
                capStartX = slopeX + slopeWidth;
                capEndX = capStartX + (numCapTiles * scaledTileSize);
                // No padding after cap if this is a hill (connects to down-slope)
                endX = slope.isHillPart ? capEndX : capEndX + collisionPadding;
            }
            
            if (playerCenterX >= startX && playerCenterX <= endX) {
                let surfaceY;
                
                // Max offset to lift player on slope (prevents sinking)
                const maxSlopeOffset = 10;
                // Transition zone size (how quickly offset fades in/out)
                const transitionZone = 30;
                
                if (slope.direction === 'left') {
                    if (numCapTiles > 0 && playerCenterX <= capEndX) {
                        // On the flat cap - no offset
                        surfaceY = groundY - totalHeight;
                    } else {
                        // On the slope going down
                        // Progress from slopeX (top) to slopeX + slopeWidth (bottom of visual slope)
                        // Padding zone after that is at ground level
                        if (playerCenterX <= slopeX + slopeWidth) {
                            // On the visual slope tiles
                            const slopeProgress = Math.max(0, Math.min(1, (playerCenterX - slopeX) / slopeWidth));
                            surfaceY = groundY - totalHeight + (slopeProgress * totalHeight);
                            
                            // Apply offset smoothly across the slope
                            // Entry is at TOP (slopeX), exit is at BOTTOM (slopeX + slopeWidth)
                            const distFromTop = playerCenterX - slopeX;
                            const distFromBottom = slopeWidth - distFromTop;
                            // fadeIn from entry (top), fadeOut toward exit (bottom)
                            const fadeInFactor = Math.min(1, distFromTop / transitionZone);
                            const fadeOutFactor = Math.min(1, distFromBottom / transitionZone);
                            const smoothOffset = maxSlopeOffset * fadeInFactor * fadeOutFactor;
                            surfaceY += smoothOffset;
                        } else {
                            // In the padding zone after the slope - at ground level
                            surfaceY = groundY;
                        }
                    }
                } else {
                    if (playerCenterX >= capStartX) {
                        // On the flat cap - no offset
                        surfaceY = groundY - totalHeight;
                    } else if (playerCenterX >= slopeX) {
                        // On the visual slope tiles
                        const slopeProgress = Math.max(0, Math.min(1, (playerCenterX - slopeX) / slopeWidth));
                        surfaceY = groundY - (slopeProgress * totalHeight);
                        
                        // Apply offset smoothly across the slope (subtract to lift player up)
                        const distFromBottom = playerCenterX - slopeX;
                        const distFromTop = slopeWidth - distFromBottom;
                        const fadeInFactor = Math.min(1, distFromBottom / transitionZone);
                        const fadeOutFactor = Math.min(1, distFromTop / transitionZone);
                        const smoothOffset = maxSlopeOffset * fadeInFactor * fadeOutFactor;
                        surfaceY -= smoothOffset;
                    } else {
                        // In the padding zone before the slope - at ground level
                        surfaceY = groundY;
                    }
                }
                
                // Use larger thresholds for smoother slope walking
                const snapThreshold = 30; // How far above the slope we can snap down
                const maxFallDistance = scaledTileSize + 10; // How far below we still count as on slope
                const distanceToSlope = playerBottom - surfaceY;
                
                // Snap to slope if we're close enough (above or slightly below)
                // Don't snap DOWN when player is prone or pressing down (prevents sinking into slope)
                const shouldSnapDown = distanceToSlope < 0 && !player.isProne && !actions['move-down'];
                const shouldSnapUp = distanceToSlope >= 0 && distanceToSlope <= maxFallDistance;
                
                if ((shouldSnapDown || shouldSnapUp) && distanceToSlope >= -snapThreshold && player.velocityY >= 0) {
                    player.y = surfaceY - player.height;
                    player.velocityY = 0;
                    player.isJumping = false;
                    player.hasFlashJumped = false;
                    player.jumpInputConsumed = false;
                    onSlope = true;
                    onPlatform = true;
                    break;
                }
            }
        }
    }
    
    let onGround = false;
    const groundLevel = (map.height || scalingContainer.clientHeight) - GAME_CONFIG.GROUND_Y;
    if (!onPlatform && player.y + player.height > groundLevel) {
        player.y = groundLevel - player.height;
        player.velocityY = 0;
        player.isJumping = false;
        player.hasFlashJumped = false; // Reset the ability on landing
        player.jumpInputConsumed = false; // Reset jump input when landing to allow continuous jumping

        // MODIFIED: Check the 'actions' object for movement
        if (actions['move-right']) {
            player.velocityX = player.speed;
        } else if (actions['move-left']) {
            player.velocityX = -player.speed;
        }

        onGround = true;
    }

    // MODIFIED: Check the 'actions' object for jumping
    // Check for GM Hat (unlimited jumping)
    const equippedHelmet = player.equipped?.helmet;
    const cosmeticHelmet = player.cosmeticEquipped?.helmet;
    const hasGMHat = (equippedHelmet && equippedHelmet.name === 'GM Hat') || 
                     (cosmeticHelmet && cosmeticHelmet.name === 'GM Hat') ||
                     equippedHelmet === 'GM Hat' || 
                     cosmeticHelmet === 'GM Hat';
    
    // Check for Flash Jump skill (double jump)
    const hasFlashJump = player.abilities.find(a => a.name === 'Flash Jump');
    
    // Track jump input to prevent spam on single press
    if (!actions['jump']) {
        player.jumpInputConsumed = false;
    }
    
    // For GM Hat: allow jumping any time
    if (hasGMHat) {
        if (actions['jump'] && !player.isProne && !player.jumpInputConsumed) {
            player.velocityY = player.jumpForce;
            player.jumpInputConsumed = true;
            playSound('jump');
            trackTutorialAction('jump');
        }
    } 
    // Normal jump logic with Flash Jump support
    else {
        // Can jump from ground/platform, or in air if have Flash Jump and haven't used it yet
        const canNormalJump = onPlatform || onGround;
        const canFlashJump = hasFlashJump && player.isJumping && !player.hasFlashJumped;
        
        if (actions['jump'] && !player.isProne && !player.jumpInputConsumed && (canNormalJump || canFlashJump)) {
            player.isJumping = true;
            player.velocityY = player.jumpForce;
            player.jumpInputConsumed = true;
            playSound('jump');
            trackTutorialAction('jump');
            
            // Mark flash jump as used if we're doing an air jump
            if (!canNormalJump && canFlashJump) {
                player.hasFlashJumped = true;
                // Propel player in the direction they're facing
                const flashJumpSpeed = player.speed * 2; // Double the normal speed
                if (player.facing === 'left') {
                    player.velocityX = -flashJumpSpeed;
                } else {
                    player.velocityX = flashJumpSpeed;
                }
            }
        }
    }

    // --- FINAL UPDATES ---
    player.x = Math.max(0, Math.min(player.x, map.width - player.width));

    // Death boundary check
    if (player.y > (map.height || scalingContainer.clientHeight)) handlePlayerDeath();
    handlePassiveRegen();
    player.previousY = player.y;
}

// In player.js
function handleGroundAndAirMovement(onSolidGround) {
    let isMovingHorizontally = false;

    // MODIFIED: Check 'actions' object
    if (onSolidGround && actions['move-down']) {
        let onTopOfLadder = null;
        const playerCenterX = player.x + player.width / 2;
        for (const p of platforms) {
            if (p.isLadder && Math.abs((player.y + player.height) - p.y1) < 5 && playerCenterX > p.x && playerCenterX < p.x + 32) {
                onTopOfLadder = p;
                break;
            }
        }

        if (onTopOfLadder) {
            player.onLadder = true;
            player.ignorePlatformCollision = true;
            return;
        }

        if (!player.isProne) {
            player.isProne = true;
            player.animationState = 'prone';
            player.height = 30;
            player.width = 60;
            player.velocityX = 0;
            player.velocityY = 0;
        }
    } else {
        if (player.isProne) {
            player.isProne = false;
            player.height = 60;
            player.width = 30;
        }

        if (!player.isChanneling && !player.isProne) {
            // MODIFIED: Check 'actions' object
            if (actions['move-left']) {
                if (player.velocityX > -player.speed) {
                    player.velocityX = -player.speed;
                }
                player.facing = 'left';
                isMovingHorizontally = true;
                trackTutorialAction('moveLeft');
                // MODIFIED: Check 'actions' object
            } else if (actions['move-right']) {
                if (player.velocityX < player.speed) {
                    player.velocityX = player.speed;
                }
                player.facing = 'right';
                isMovingHorizontally = true;
                trackTutorialAction('moveRight');
            } else {
                const friction = onSolidGround ? GAME_CONFIG.GROUND_FRICTION : GAME_CONFIG.AIR_FRICTION;
                player.velocityX *= friction;
            }
        }
    }

    if (Math.abs(player.velocityX) < 0.1) {
        player.velocityX = 0;
    }

    if (!player.isProne) {
        player.x += player.velocityX;
        player.y += player.velocityY;
    }

    if (player.animationState !== 'attack' || (!player.isChanneling && !player.isPlayingAttackAnimation)) {
        if (!onSolidGround) {
            player.animationState = 'jump';
        } else if (isMovingHorizontally) {
            player.animationState = 'walk';
        } else if (!player.isProne) {
            player.animationState = 'idle';
        }
        if (player.isChanneling) {
            player.animationState = 'attack';
        }
    }
}

/**
 * Handles passive HP and MP regeneration, now including bonuses from buffs.
 */
function handlePassiveRegen() {
    const now = Date.now();
    const finalStats = calculatePlayerStats();

    // 1. Calculate bonus regeneration from all active buffs
    let hpRegenBonus = 0;
    let mpRegenBonus = 0;
    for (const buff of player.buffs) {
        if (buff.effect) {
            hpRegenBonus += buff.effect.hpRegenBonus || 0;
            mpRegenBonus += buff.effect.mpRegenBonus || 0; // For future MP regen skills
        }
    }

    // 2. Determine the final regeneration amounts
    const finalHpRegen = HP_REGEN_AMOUNT + hpRegenBonus;
    const finalMpRegen = MP_REGEN_AMOUNT + mpRegenBonus;

    // 3. Apply MP Regeneration with the final amount
    if (now - (player.lastMpRegenTime || 0) > MP_REGEN_INTERVAL && player.mp < finalStats.finalMaxMp) {
        player.mp = Math.min(finalStats.finalMaxMp, player.mp + finalMpRegen);
        player.lastMpRegenTime = now;
        updateUI();
    }

    // 4. Apply HP Regeneration with the final amount
    if (now - (player.lastHpRegenTime || 0) > HP_REGEN_INTERVAL && player.hp < finalStats.finalMaxHp) {
        player.hp = Math.min(finalStats.finalMaxHp, player.hp + finalHpRegen);
        player.lastHpRegenTime = now;
        updateUI();
    }
}

/**
 * Manages the player's blinking animation timer.
 */
function updatePlayerBlink() {
    if (player.isDead || !isGameActive) return;
    const BLINK_INTERVAL_MIN = 180, BLINK_INTERVAL_MAX = 480, BLINK_DURATION = 8;

    if (player.isBlinking) {
        if (--player.blinkDurationTimer <= 0) player.isBlinking = false;
    } else {
        if (--player.blinkTimer <= 0) {
            player.isBlinking = true;
            player.blinkDurationTimer = BLINK_DURATION;
            player.blinkTimer = Math.floor(Math.random() * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN + 1)) + BLINK_INTERVAL_MIN;
        }
    }
}

// in player.js

function playAttackAnimation(duration = 200) {
    // Determine the state to return to after the attack is over
    const previousState = player.onLadder ? 'climb' : (player.isJumping ? 'jump' : 'idle');
    player.animationState = 'attack';
    player.animationFrame = 0; // Reset animation to the first frame
    player.isPlayingAttackAnimation = true; // Flag to prevent animation override

    // After a short duration, revert the animation
    setTimeout(() => {
        // Only revert if another action hasn't already changed the state
        if (player.animationState === 'attack' && player.isPlayingAttackAnimation) {
            player.animationState = previousState;
            player.isPlayingAttackAnimation = false;
        }
    }, duration);
}

/**
 * Updates the player's portal charging progress.
 */
function updatePortalCharging() {
    if (!player.isChargingPortal || player.isDead) {
        document.getElementById('portal-charge-bar-container').style.display = 'none';
        return;
    }
    const chargeDuration = 400;
    const elapsedTime = Date.now() - player.portalChargeStartTime;
    const progress = Math.min(elapsedTime / chargeDuration, 1);
    document.getElementById('portal-charge-bar-fill').style.width = `${progress * 100}%`;

    if (elapsedTime >= chargeDuration) {
        const portal = player.activePortal;
        player.isChargingPortal = false;
        player.activePortal = null;
        if (portal) {
            // Reward for completing Dewdrop Jump Quest
            if (player.currentMapId === 'dewdropJumpQuest' && portal.targetMap === 'dewdropVillage' && portal.y < 300) {
                // This is the exit portal at the top (y: 250)
                if (!player.completedDewdropJQ) {
                    player.completedDewdropJQ = true;
                    
                    // Give rewards
                    player.gold += 200;
                    showNotification('+200 Gold for completing Dewdrop Jump Quest!', 'rare');
                    
                    // Add Red Potions
                    const redPotionItem = { name: 'Red Potion', quantity: 3 };
                    addItemToInventory(redPotionItem);
                    showNotification(`Received ${redPotionItem.quantity}x ${redPotionItem.name}!`, 'rare');
                    
                    // Unlock achievement
                    if (typeof updateAchievementProgress === 'function') {
                        updateAchievementProgress('action', 'complete_dewdrop_jq');
                    }
                    
                    updateUI();
                }
            }
            
            fadeAndChangeMap(portal.targetMap, portal.targetX, portal.targetY);
        }
    }
}

// --- Combat, Death, & Stats ---

/**
 * Handles the logic for player death.
 */
function handlePlayerDeath() {
    // Check if player is in a job trial - handle specially
    if (typeof activeJobTrial !== 'undefined' && activeJobTrial && !activeJobTrial.completed) {
        failJobTrial('death');
        return; // Don't do normal death processing
    }
    
    // Check if player is in world boss arena - warp out instead of normal respawn
    if (typeof checkWorldBossArenaOnDeath === 'function' && checkWorldBossArenaOnDeath()) {
        player.isDead = true;
        player.exp = Math.floor(player.exp * 0.95); // Lose only 5% EXP in world boss arena
        
        // Play death sound
        playSound('death');
        
        // Clear buffs
        document.getElementById('player-buff-effects').innerHTML = '';
        player.buffs.forEach(b => {
            clearTimeout(b.timeoutId);
            clearInterval(b.intervalId);
            if (b.element) b.element.remove();
        });
        player.buffs = [];
        player.isInvisible = false;
        
        // Respawn with half HP after warp (handled by warpBackFromArena)
        setTimeout(() => {
            player.isDead = false;
            const finalStats = calculatePlayerStats();
            player.hp = finalStats.finalMaxHp / 2;
            player.mp = finalStats.finalMaxMp / 2;
            player.isInvincible = true;
            document.getElementById('player').style.opacity = 1;
            setTimeout(() => { player.isInvincible = false; }, 1500);
            updateUI();
        }, 2000);
        return;
    }
    
    player.isDead = true;
    player.exp = Math.floor(player.exp * 0.9); // Lose 10% EXP
    
    // Play death sound
    playSound('death');
    
    // Track death count for achievements
    player.stats.deathCount = (player.stats.deathCount || 0) + 1;

    document.getElementById('player-buff-effects').innerHTML = ''; // Clear visual buff effects

    // Clear all buffs
    player.buffs.forEach(b => {
        clearTimeout(b.timeoutId);
        clearInterval(b.intervalId);
        if (b.element) b.element.remove();
    });
    player.buffs = [];
    player.isInvisible = false;

    setTimeout(respawnPlayer, 1500);
}

/**
 * Respawns the player after death.
 */
function respawnPlayer() {
    player.isDead = false;
    const finalStats = calculatePlayerStats();
    player.hp = finalStats.finalMaxHp / 2;
    player.mp = finalStats.finalMaxMp / 2;
    player.isInvincible = true;
    document.getElementById('player').style.opacity = 1;
    setTimeout(() => { player.isInvincible = false; }, 1500);

    // Respawn in appropriate location based on whether player has left Dewdrop Island
    const respawnMap = player.hasLeftDewdrop ? 'henesys' : 'dewdropBeach';
    fadeAndChangeMap(respawnMap, respawnMap === 'dewdropBeach' ? 400 : 150);
    updateUI();
    
    // Update stat window in real-time if open (respawn changes HP/MP)
    if (statWindowElement && statWindowElement.style.display !== 'none') {
        updateStatWindowUI();
    }
}

/**
 * Calculates the stats of an item including its enhancement level.
 * @param {object} item - The item object.
 * @returns {object} The calculated stats.
 */
/**
 * Calculates the stats of an item including its enhancement level.
 * @param {object} item - The item object.
 * @returns {object} The calculated stats.
 */
function calculateEnhancedStats(item) {
    if (!item || !item.stats || !item.enhancement) return item.stats;

    const baseItemInfo = itemData[item.name];
    const enhancedStats = { ...item.stats };
    const enhancementLevel = item.enhancement;

    // Get the main class stat for weapons
    let mainClassStat = 'str'; // default
    switch (player.class) {
        case 'warrior': mainClassStat = 'str'; break;
        case 'magician': mainClassStat = 'int'; break;
        case 'bowman':
        case 'pirate': mainClassStat = 'dex'; break;
        case 'thief': mainClassStat = 'luk'; break;
    }

    // Apply enhancement bonuses based on item type
    switch (baseItemInfo.type) {
        case 'weapon':
            // Weapons: attack + main class stat
            enhancedStats.attack = (enhancedStats.attack || 0) + enhancementLevel;
            enhancedStats[mainClassStat] = (enhancedStats[mainClassStat] || 0) + enhancementLevel;
            break;
        case 'shoes':
            // Shoes: speed and jump
            enhancedStats.speed = (enhancedStats.speed || 0) + enhancementLevel;
            enhancedStats.jump = (enhancedStats.jump || 0) + enhancementLevel;
            break;
        case 'gloves':
            // Gloves: attack
            enhancedStats.attack = (enhancedStats.attack || 0) + enhancementLevel;
            break;
        case 'ring':
            // Rings: MP + accuracy
            enhancedStats.mp = (enhancedStats.mp || 0) + enhancementLevel;
            enhancedStats.accuracy = (enhancedStats.accuracy || 0) + enhancementLevel;
            break;
        case 'pendant':
            // Pendants: all stats
            enhancedStats.str = (enhancedStats.str || 0) + enhancementLevel;
            enhancedStats.dex = (enhancedStats.dex || 0) + enhancementLevel;
            enhancedStats.int = (enhancedStats.int || 0) + enhancementLevel;
            enhancedStats.luk = (enhancedStats.luk || 0) + enhancementLevel;
            enhancedStats.attack = (enhancedStats.attack || 0) + enhancementLevel;
            enhancedStats.accuracy = (enhancedStats.accuracy || 0) + enhancementLevel;
            enhancedStats.defense = (enhancedStats.defense || 0) + enhancementLevel;
            enhancedStats.hp = (enhancedStats.hp || 0) + enhancementLevel;
            enhancedStats.mp = (enhancedStats.mp || 0) + enhancementLevel;
            break;
        default:
            // --- THIS IS THE FIX ---
            // Other armor (helmet, top, bottom, cape, etc.) now grants +1 to all main stats per enhancement level.
            enhancedStats.str = (enhancedStats.str || 0) + enhancementLevel;
            enhancedStats.dex = (enhancedStats.dex || 0) + enhancementLevel;
            enhancedStats.int = (enhancedStats.int || 0) + enhancementLevel;
            enhancedStats.luk = (enhancedStats.luk || 0) + enhancementLevel;
            // It still grants the original defense and HP bonuses as well.
            enhancedStats.defense = (enhancedStats.defense || 0) + enhancementLevel;
            enhancedStats.hp = (enhancedStats.hp || 0) + (enhancementLevel * 15);
            break;
        // --- END OF FIX ---
    }

    return enhancedStats;
}

function calculatePlayerStats() {
    const calculated = { bonusStr: 0, bonusDex: 0, bonusInt: 0, bonusLuk: 0, totalDefense: player.stats.defense, totalAttack: 0, totalHp: 0, totalMp: 0, bonusAccuracy: 0, bonusAvoidability: 0, bonusCritChance: 0, bonusMinCritDamage: 0, bonusMaxCritDamage: 0 };

    // Calculate stats from equipped items
    for (const slot in player.equipped) {
        const item = player.equipped[slot];
        if (item?.stats) {
            const itemStats = calculateEnhancedStats(item);
            calculated.totalAttack += itemStats.attack || 0;
            calculated.totalDefense += itemStats.defense || 0;
            calculated.totalHp += itemStats.hp || 0;
            calculated.totalMp += itemStats.mp || 0;
            calculated.bonusStr += itemStats.str || 0;
            calculated.bonusDex += itemStats.dex || 0;
            calculated.bonusInt += itemStats.int || 0;
            calculated.bonusLuk += itemStats.luk || 0;
            calculated.bonusAccuracy += itemStats.accuracy || 0;
            calculated.bonusAvoidability += itemStats.avoidability || 0;
            calculated.bonusCritChance += itemStats.critChance || 0;
            calculated.bonusMinCritDamage += itemStats.minCritDamage || 0;
            calculated.bonusMaxCritDamage += itemStats.maxCritDamage || 0;
        }
    }

    // --- THIS IS THE FIX ---
    // The loop now correctly adds all primary stat bonuses from buffs.
    player.buffs.forEach(buff => {
        if (buff?.effect) {
            calculated.totalDefense += buff.effect.defense || 0;
            calculated.totalAttack += buff.effect.attack || 0;
            calculated.bonusStr += buff.effect.str || 0;
            calculated.bonusDex += buff.effect.dex || 0;
            calculated.bonusInt += buff.effect.int || 0;
            calculated.bonusLuk += buff.effect.luk || 0;
        }
    });
    // --- END OF FIX ---

    // Add bonuses from equipped medal
    if (player.equippedMedal) {
        let medalStats = null;
        if (player.equippedMedal.type === 'special') {
            if (typeof specialMedals !== 'undefined' && specialMedals[player.equippedMedal.id]) {
                medalStats = specialMedals[player.equippedMedal.id].stats;
            }
        } else if (player.equippedMedal.type === 'monster') {
            if (typeof monsterMedalStats !== 'undefined' && player.equippedMedal.tier) {
                medalStats = monsterMedalStats[player.equippedMedal.tier];
            }
        }
        
        if (medalStats) {
            calculated.bonusStr += medalStats.str || 0;
            calculated.bonusDex += medalStats.dex || 0;
            calculated.bonusInt += medalStats.int || 0;
            calculated.bonusLuk += medalStats.luk || 0;
            calculated.totalDefense += medalStats.defense || 0;
            calculated.bonusCritChance += medalStats.critChance || 0;
            calculated.bonusAvoidability += medalStats.avoidability || 0;
            calculated.bonusAccuracy += medalStats.accuracy || 0;
            calculated.totalHp += medalStats.hp || 0;
            calculated.totalMp += medalStats.mp || 0;
            calculated.totalAttack += medalStats.attack || 0;
        }
    }

    // Add bonuses from passive skills
    let finalMaxHpPercentBonus = 0;
    let finalMaxMpPercentBonus = 0;
    for (const learnedSkill of player.abilities) {
        const skillDetails = getSkillDetails(learnedSkill.name);
        if (skillDetails && skillDetails.type === 'passive' && skillDetails.effect) {
            const effect = skillDetails.effect;
            calculated.totalDefense += effect.defense || 0;
            calculated.bonusCritChance += effect.critChance || 0;
            calculated.bonusAvoidability += effect.avoidability || 0;
            calculated.totalAttack += effect.attack || 0;
            finalMaxHpPercentBonus += effect.maxHpPercent || 0;
            finalMaxMpPercentBonus += effect.maxMpPercent || 0;
        }
    }

    calculated.totalStr = player.stats.str + calculated.bonusStr;
    calculated.totalDex = player.stats.dex + calculated.bonusDex;
    calculated.totalInt = player.stats.int + calculated.bonusInt;
    calculated.totalLuk = player.stats.luk + calculated.bonusLuk;

    let finalMaxHp = player.maxHp + calculated.totalHp;
    finalMaxHp *= (1 + finalMaxHpPercentBonus / 100);
    finalMaxHp = Math.floor(finalMaxHp);

    let finalMaxMp = player.maxMp + calculated.totalMp;
    finalMaxMp *= (1 + finalMaxMpPercentBonus / 100);
    finalMaxMp = Math.floor(finalMaxMp);

    // Determine primary and secondary stats based on class
    // Primary stat contributes 100% to damage, secondary stat contributes 25%
    let primaryStat, secondaryStat;
    switch (player.class) {
        // Warrior branch (STR primary, DEX secondary)
        case 'warrior': 
        case 'fighter': 
        case 'spearman': 
            primaryStat = calculated.totalStr;
            secondaryStat = calculated.totalDex;
            break;
        // Magician branch (INT primary, LUK secondary)
        case 'magician': 
        case 'cleric': 
        case 'wizard': 
            primaryStat = calculated.totalInt;
            secondaryStat = calculated.totalLuk;
            break;
        // Bowman branch (DEX primary, STR secondary)
        case 'bowman': 
        case 'hunter': 
        case 'crossbowman': 
            primaryStat = calculated.totalDex;
            secondaryStat = calculated.totalStr;
            break;
        // Thief branch (LUK primary, DEX secondary)
        case 'thief': 
        case 'assassin': 
        case 'bandit': 
            primaryStat = calculated.totalLuk;
            secondaryStat = calculated.totalDex;
            break;
        // Pirate branch (STR primary, DEX secondary)
        case 'pirate': 
        case 'brawler': 
        case 'gunslinger': 
            primaryStat = calculated.totalStr;
            secondaryStat = calculated.totalDex;
            break;
        default: 
            primaryStat = calculated.totalStr;
            secondaryStat = calculated.totalDex;
    }

    // Damage formula: primary stat * 1.0 + secondary stat * 0.25 + attack * 1.5
    const effectiveStat = primaryStat + (secondaryStat * 0.25);
    const minDamage = Math.floor((effectiveStat * 0.9) + (calculated.totalAttack * 1.5));
    const maxDamage = Math.floor((effectiveStat * 1.1) + (calculated.totalAttack * 1.5));
    const finalCritChance = player.stats.critChance + (calculated.totalLuk / 20) + calculated.bonusCritChance;

    const finalAccuracy = (player.stats.accuracy || 0) + calculated.bonusAccuracy + Math.floor(calculated.totalDex * 0.1) + Math.floor(calculated.totalLuk * 0.05) + player.level;
    const finalAvoidability = (player.stats.avoidability || 0) + calculated.bonusAvoidability + Math.floor(calculated.totalLuk * 0.05) + Math.floor(calculated.totalDex * 0.1) + player.level;

    return { ...calculated, finalMaxHp, finalMaxMp, minDamage, maxDamage, finalCritChance, finalMinCritDamage: player.stats.minCritDamage + calculated.bonusMinCritDamage, finalMaxCritDamage: player.stats.maxCritDamage + calculated.bonusMaxCritDamage, finalJumpForce: player.jumpForce, finalAccuracy, finalAvoidability };
}

/**
 * Calculates the player's overall Combat Score based on all stats
 * @returns {number} The calculated combat score
 */
function calculateCombatScore() {
    const stats = calculatePlayerStats();
    
    // Weight different stats based on their combat impact
    const score = 
        // Primary stats (high weight)
        (stats.totalStr * 2) +
        (stats.totalDex * 2) +
        (stats.totalInt * 2) +
        (stats.totalLuk * 2) +
        
        // Damage output (very high weight)
        (stats.minDamage * 5) +
        (stats.maxDamage * 5) +
        
        // Survivability (high weight)
        (stats.finalMaxHp * 0.5) +
        (stats.finalMaxMp * 0.3) +
        (stats.totalDefense * 10) +
        
        // Accuracy & Avoidability (medium weight)
        (stats.finalAccuracy * 3) +
        (stats.finalAvoidability * 3) +
        
        // Critical stats (high weight)
        (stats.finalCritChance * 20) +
        (stats.finalMinCritDamage * 3) +
        (stats.finalMaxCritDamage * 3) +
        
        // Level contribution (medium weight)
        (player.level * 50);
    
    return Math.floor(score);
}

function gainExp(amount) {
    //EXP_RATE exprate exp-rate
    amount *= 1;
    
    // Apply global event EXP multiplier (e.g., Double EXP event)
    let eventBonusAmount = 0;
    if (typeof getEventMultipliers === 'function') {
        const eventMult = getEventMultipliers();
        if (eventMult.exp > 1) {
            eventBonusAmount = Math.ceil(amount * (eventMult.exp - 1));
            amount += eventBonusAmount;
        }
    }
    
    // Apply party EXP bonus if in a party with members on same map
    let partyBonusAmount = 0;
    if (typeof getPartyExpBonus === 'function') {
        const partyBonus = getPartyExpBonus();
        if (partyBonus > 0) {
            // Use Math.ceil to ensure at least 1 bonus EXP (floor was rounding low EXP to 0)
            partyBonusAmount = Math.max(1, Math.ceil(amount * partyBonus));
            amount += partyBonusAmount;
        }
    }
    
    player.exp += amount;
    const baseExp = Math.floor(amount - partyBonusAmount - eventBonusAmount);
    showNotification(`+${baseExp} EXP`, 'exp');
    
    // Show separate notification for event bonus EXP
    if (eventBonusAmount > 0) {
        showNotification(`+${eventBonusAmount} Event EXP`, 'eventExp');
    }
    
    // Show separate blue notification for party bonus EXP
    if (partyBonusAmount > 0) {
        showNotification(`+${partyBonusAmount} Party EXP`, 'partyExp');
    }
    while (player.exp >= player.maxExp) {
        player.exp -= player.maxExp;
        levelUp();
    }
    updateAchievementProgress('level', player.level);
    updateUI();
    
    // Update stat window in real-time if open
    if (statWindowElement && statWindowElement.style.display !== 'none') {
        updateStatWindowUI();
    }
}

function levelUp() {
    player.level++;
    player.ap += 5;

    // Make ghost players congratulate
    if (typeof ghostsCongratsPlayer === 'function') {
        ghostsCongratsPlayer();
    }

    // Auto-assign stat points to STR for beginners
    if (player.class === 'beginner') {
        player.stats.str += 5;
        player.ap = 0; // Reset AP since we auto-assigned
    }

    if (player.level >= 11) {
        player.sp += 3;
    } else {
        player.beginnerSp = (player.beginnerSp || 0) + 1;
    }

    // Use the centralized EXP curve function
    player.maxExp = getExpForLevel(player.level);
    player.maxHp += 30;
    player.maxMp += 20;

    const finalStats = calculatePlayerStats();
    player.hp = finalStats.finalMaxHp;
    player.mp = finalStats.finalMaxMp;

    playSound('levelUp');
    addChatMessage(`Congratulations! You have reached Level ${player.level}.`, 'success');

    // Send global announcement for level ups (every 10 levels)
    if (player.level % 10 === 0 && typeof sendAnnouncement === 'function') {
        sendAnnouncement('level_up', { newLevel: player.level });
    }

    // Trigger level up visual effect
    player.levelUpEffect = {
        animationFrame: 0,
        animationTimer: 0
    };

    // Broadcast level up VFX to other players
    if (typeof broadcastPlayerVFX === 'function') {
        broadcastPlayerVFX('levelUp', player.x, player.y);
    }

    // Show skill point popup on first level up
    if (player.level === 2 && player.class === 'beginner' && !player.hasSeenBeginnerSkillPopup) {
        player.hasSeenBeginnerSkillPopup = true;
        showInfoModal(
            'Beginner Skills Available!',
            `<p>Congratulations on reaching Level 2!</p>
            <p>You now have <span style="color: var(--exp-color); font-weight: bold;">Skill Points (SP)</span> to spend on Beginner skills!</p>
            <p>Press <span style="color: var(--rare-color); font-weight: bold;">K</span> to open your Skill Tree and learn new abilities.</p>
            <p>As a Beginner, your stat points are automatically assigned to <span style="color: var(--legendary-color); font-weight: bold;">STR</span> to help you get started.</p>`
        );
    }

    if (player.level === 10 && player.class === 'beginner') {
        openJobAdvancementWindow(10);
    } else if (player.level === 20 && (!player.petInventory || player.petInventory.length === 0)) {
        // Unlock pet system at level 20 only if player hasn't selected a pet yet
        openPetSelectionWindow();
    } else if (player.level === 30 && jobAdvancementData['30'].optionsFor.includes(player.class)) {
        openJobAdvancementWindow(30);
    }

    updateUI();
    
    // Update stat window and skill tree in real-time if open
    if (statWindowElement && statWindowElement.style.display !== 'none') {
        updateStatWindowUI();
    }
    if (skillTreeElement && skillTreeElement.style.display !== 'none') {
        updateSkillTreeUI();
    }
    
    // Check for server-first level medals
    if (typeof checkLevelMedals === 'function') {
        checkLevelMedals(player.level);
    }
}

function reapplyBuffs() {
    // Reset all stat modifiers first
    player.speed = player.originalSpeed;
    player.jumpForce = player.originalJumpForce;
    player.isInvisible = false;
    document.getElementById('player').style.opacity = 1;

    // Calculate total speed bonus points from equipment
    let totalSpeedBonus = 0;
    let totalJumpBonus = 0;
    for (const slot in player.equipped) {
        const item = player.equipped[slot];
        if (item?.stats) {
            const itemInfo = itemData[item.name];
            if (itemInfo && itemInfo.category === 'Equip') {
                const enhancedStats = calculateEnhancedStats(item);
                totalSpeedBonus += enhancedStats.speed || 0;
                totalJumpBonus += enhancedStats.jump || 0;
            }
        }
    }

    // Add speed bonuses from buffs
    player.buffs.forEach(buff => {
        if (buff?.effect) {
            if (buff.effect.speed) totalSpeedBonus += buff.effect.speed;
            if (buff.effect.jump) totalJumpBonus += buff.effect.jump;
            if (buff.effect.invisible) player.isInvisible = true;
        }
    });

    // Apply speed as percentage multiplier (each point = +2.5% from 100% base)
    player.speed = player.originalSpeed * (1 + totalSpeedBonus * 0.025);

    // Apply jump as percentage multiplier (each point = +1.25% from 100% base)
    player.jumpForce = player.originalJumpForce * (1 + totalJumpBonus * 0.0125);

    if (player.isInvisible) {
        document.getElementById('player').style.opacity = 0.5;
        // Dark Sight has a fixed speed, overriding other speed buffs
        player.speed = 1.5;
    }
    
    // Update stat window in real-time if open (speed changes affect stats)
    if (statWindowElement && statWindowElement.style.display !== 'none') {
        updateStatWindowUI();
    }
}

function playGachapon() {
    const ticketIndex = player.inventory.etc.findIndex(i => i.name === 'Gachapon Ticket');
    if (ticketIndex === -1) {
        addChatMessage("You need a Gachapon Ticket!", 'error');
        return;
    }

    // --- THIS IS THE FIX ---
    // Check if all inventory tabs have at least one free slot.
    const maxSlots = player.inventorySlots || 16;
    if (player.inventory.equip.length >= maxSlots ||
        player.inventory.use.length >= maxSlots ||
        player.inventory.etc.length >= maxSlots ||
        player.inventory.cosmetic.length >= maxSlots) {
        addChatMessage("Your inventory is full! Please make sure all tabs have at least one free slot.", 'error');
        return;
    }
    // --- END OF FIX ---

    // This function will now open the Gachapon window AND trigger the spin automatically.
    if (typeof openGachaponWindow === 'function') {
        if (dialogueWindowElement && dialogueWindowElement.style.display !== 'none') {
            toggleWindow(dialogueWindowElement);
        }
        openGachaponWindow(true);
    }
}

// --- Bestiary Functions ---

function updateBestiaryKill(monsterType) {
    if (!player.bestiary) player.bestiary = { monsterKills: {}, dropsFound: {}, firstKillTimestamp: {} };
    
    // Track kill count
    player.bestiary.monsterKills[monsterType] = (player.bestiary.monsterKills[monsterType] || 0) + 1;
    
    // Track first kill timestamp
    if (!player.bestiary.firstKillTimestamp[monsterType]) {
        player.bestiary.firstKillTimestamp[monsterType] = Date.now();
    }
    
    // Check for Monster Killer medal eligibility
    checkMonsterKillerMedal(monsterType);
    
    // Update bestiary UI in real-time if window is open
    if (bestiaryWindow && bestiaryWindow.style.display !== 'none') {
        updateBestiaryUI();
    }
}

function updateBestiaryDrop(monsterType, itemName, amount = 1) {
    if (!player.bestiary) player.bestiary = { monsterKills: {}, dropsFound: {}, firstKillTimestamp: {} };
    
    if (!player.bestiary.dropsFound[monsterType]) {
        player.bestiary.dropsFound[monsterType] = {};
    }
    
    if (itemName === 'Gold') {
        // For gold, track the total amount accumulated
        player.bestiary.dropsFound[monsterType][itemName] = (player.bestiary.dropsFound[monsterType][itemName] || 0) + amount;
    } else {
        // For other items, track the count
        player.bestiary.dropsFound[monsterType][itemName] = (player.bestiary.dropsFound[monsterType][itemName] || 0) + 1;
    }
    
    // Check for Monster Killer medal eligibility
    checkMonsterKillerMedal(monsterType);
    
    // Update bestiary UI in real-time if window is open
    if (bestiaryWindow && bestiaryWindow.style.display !== 'none') {
        updateBestiaryUI();
    }
}

function checkMonsterKillerMedal(monsterType) {
    if (!player.bestiaryRewards) player.bestiaryRewards = {};
    if (!player.bestiaryRewards.claimedMedals) player.bestiaryRewards.claimedMedals = {};
    
    const monster = monsterTypes[monsterType];
    if (!monster) return;
    
    const killCount = player.bestiary.monsterKills[monsterType] || 0;
    const dropsFound = player.bestiary.dropsFound[monsterType] || {};
    
    // Always check for gold tier pet reward (independent of medal status)
    checkGoldTierPetReward(monsterType, killCount);
    
    // Skip medal awarding if already awarded
    if (player.bestiaryRewards.claimedMedals[monsterType]) return;
    
    // Medal requirements:
    // - 50+ kills: Bronze (no drop requirement)
    // - 1000+ kills + all drops: Diamond (drop requirement only for max tier)
    let shouldAwardMedal = false;
    
    if (killCount >= 1000) {
        // Diamond tier requires all drops collected
        const totalPossibleDrops = monster.loot.length;
        const foundDropCount = Object.keys(dropsFound).length;
        shouldAwardMedal = foundDropCount >= totalPossibleDrops;
    } else if (killCount >= 50) {
        // Bronze, Silver, Gold tiers only require kill count
        shouldAwardMedal = true;
    }
    
    if (shouldAwardMedal) {
        // Automatically award the Monster Killer medal (no claiming needed)
        if (!player.bestiaryRewards.claimedMedals) player.bestiaryRewards.claimedMedals = {};
        player.bestiaryRewards.claimedMedals[monsterType] = {
            name: `${monster.name} Killer`,
            monsterType: monsterType,
            timestamp: Date.now()
        };
        
        // Show notification
        if (typeof addChatMessage !== 'undefined') {
            addChatMessage(`🏅 You've earned the "${monster.name} Killer" medal! It now appears under your nameplate.`, 'achievement');
        }
        
        // Send global announcement for medal earned
        if (typeof sendAnnouncement === 'function') {
            sendAnnouncement('medal', { medalName: `${monster.name} Killer` });
        }
        
        // Update nameplate display
        updatePlayerNameplate();
    }
}

/**
 * Awards a pet when player reaches gold tier (500+ kills) on a monster
 * The monster becomes available as a pet companion!
 */
function checkGoldTierPetReward(monsterType, killCount) {
    // Only award at gold tier (500+ kills)
    if (killCount < 500) return;
    
    // Initialize pet inventory if needed
    if (!player.petInventory) player.petInventory = [];
    
    // Initialize tracking for gold tier pets already awarded
    if (!player.bestiaryRewards) player.bestiaryRewards = {};
    if (!player.bestiaryRewards.goldTierPetsAwarded) player.bestiaryRewards.goldTierPetsAwarded = {};
    
    // Skip if pet already awarded for this monster
    if (player.bestiaryRewards.goldTierPetsAwarded[monsterType]) return;
    
    // Get monster data
    const monster = monsterTypes[monsterType];
    if (!monster) return;
    
    // Skip monsters that shouldn't become pets (trial bosses, test dummy, mini-bosses too big, etc.)
    if (monster.isTrialBoss || monster.excludeFromBestiary) return;
    
    // Skip mini-bosses (too big to be pets)
    if (monster.isMiniBoss) return;
    
    // Skip monsters without proper pixel art sprites (non-pixel art monsters use a different system)
    if (!monster.isPixelArt) return;
    
    // Generate pet key from monster type
    const petKey = monsterType;
    
    // Check if player already owns this pet (prevents duplicates, especially for baby slimes)
    if (player.petInventory.includes(petKey)) {
        // Mark as awarded so we don't check again
        player.bestiaryRewards.goldTierPetsAwarded[monsterType] = true;
        return;
    }
    
    // Ensure pet data exists for this monster
    ensureMonsterPetData(monsterType);
    
    // Award the pet
    player.petInventory.push(petKey);
    player.bestiaryRewards.goldTierPetsAwarded[monsterType] = true;
    
    // Show notification
    if (typeof addChatMessage !== 'undefined') {
        addChatMessage(`🐾 NEW PET UNLOCKED! You can now use ${monster.name} as a pet companion!`, 'legendary');
    }
    
    if (typeof showMajorNotification !== 'undefined') {
        showMajorNotification(`NEW PET: ${monster.name}!`, 'legendary');
    }
    
    // Play sound
    if (typeof playSound === 'function') {
        playSound('achievement');
    }
    
    // Save character
    if (typeof saveCharacter === 'function') {
        saveCharacter();
    }
}

/**
 * Ensures pet data exists for a monster type (called on load and when awarding)
 */
function ensureMonsterPetData(monsterType) {
    // Skip if pet data already exists
    if (petData[monsterType]) return;
    
    const monster = monsterTypes[monsterType];
    if (!monster || !monster.isPixelArt) return;
    
    // Dynamically create pet entry based on monster data
    petData[monsterType] = {
        name: monsterType,
        displayName: monster.name,
        description: `A tamed ${monster.name} that follows you loyally. Earned by defeating 500+ ${monster.name}s!`,
        spriteKey: monsterType, // Use monster type as sprite key (works for pixel art monsters)
        width: Math.min(monster.width, 64), // Cap size for pets
        height: Math.min(monster.height, 64),
        offsetX: -60,
        offsetY: 0,
        followSpeed: 1.5,
        lootRange: 40,
        isMonsterPet: true // Flag to identify monster-derived pets
    };
}

/**
 * Called on game load to ensure all monster pets have their data entries
 */
function initializeMonsterPets() {
    if (!player.petInventory) return;
    
    player.petInventory.forEach(petKey => {
        // Check if this is a monster-derived pet (not in original petData)
        if (!petData[petKey] && monsterTypes[petKey]) {
            ensureMonsterPetData(petKey);
        }
    });
}

function updateAchievementProgress(type, value) {
    if (!player.achievements) {
        player.achievements = { progress: {}, completed: {}, claimed: {} };
    }

    for (const id in achievementData) {
        const ach = achievementData[id];
        if (player.achievements.completed[id]) continue;

        let requirementMet = false;

        if (ach.type === type) {
            let currentProgress = player.achievements.progress[id] || 0;
            switch (type) {
                case 'level':
                    currentProgress = value;
                    if (currentProgress >= ach.requirement) requirementMet = true;
                    break;
                case 'kill':
                    if (value === ach.requirement.target) currentProgress++;
                    if (currentProgress >= ach.requirement.count) requirementMet = true;
                    break;
                case 'action':
                    if (value === ach.requirement) {
                        currentProgress = 1;
                        requirementMet = true;
                    }
                    break;
                case 'explore':
                    const visited = new Set(player.achievements.progress[id] || []);
                    visited.add(value);
                    currentProgress = Array.from(visited);
                    if (currentProgress.length >= ach.requirement) requirementMet = true;
                    break;
            }
            player.achievements.progress[id] = currentProgress;
        }

        // --- NEW: Logic for new achievement types ---
        if (ach.type === 'kill_set' && type === 'kill') {
            const killedBosses = new Set(player.achievements.progress[id] || []);
            if (ach.requirement.targets.includes(value)) {
                killedBosses.add(value);
                player.achievements.progress[id] = Array.from(killedBosses);
            }
            if (killedBosses.size >= ach.requirement.targets.length) {
                requirementMet = true;
            }
        }


        if (ach.type === 'action_accumulate' && ach.requirement.action === value) {
            if (value === 'gold_spent') {
                player.achievements.progress[id] = player.stats.goldSpent;
                if (player.stats.goldSpent >= ach.requirement.amount) {
                    requirementMet = true;
                }
            } else if (value === 'gold_earned') {
                player.achievements.progress[id] = player.stats.totalGoldEarned || 0;
                if ((player.stats.totalGoldEarned || 0) >= ach.requirement.amount) {
                    requirementMet = true;
                }
            } else if (value === 'potionsUsed') {
                player.achievements.progress[id] = player.stats.potionsUsed || 0;
                if ((player.stats.potionsUsed || 0) >= ach.requirement.amount) {
                    requirementMet = true;
                }
            } else if (value === 'items_enhanced') {
                player.achievements.progress[id] = player.stats.enhanceSuccessCount || 0;
                if ((player.stats.enhanceSuccessCount || 0) >= ach.requirement.amount) {
                    requirementMet = true;
                }
            } else if (value === 'total_kills') {
                player.achievements.progress[id] = player.stats.totalKills || 0;
                if ((player.stats.totalKills || 0) >= ach.requirement.amount) {
                    requirementMet = true;
                }
            } else if (value === 'quests_completed') {
                const completedCount = Object.values(player.quests).filter(q => q.completed).length;
                player.achievements.progress[id] = completedCount;
                if (completedCount >= ach.requirement.amount) {
                    requirementMet = true;
                }
            } else if (value === 'talk_all_npcs') {
                const talkedCount = player.stats.talkedNPCs ? player.stats.talkedNPCs.size : 0;
                player.achievements.progress[id] = talkedCount;
                if (talkedCount >= ach.requirement.amount) {
                    requirementMet = true;
                }
            } else if (value === 'collect_rares_10') {
                // Count unique rare items in all inventory tabs
                // Ensure collectedRareItems is a Set (may be array/object from localStorage)
                if (!player.stats.collectedRareItems || !(player.stats.collectedRareItems instanceof Set)) {
                    const existingItems = Array.isArray(player.stats.collectedRareItems) 
                        ? player.stats.collectedRareItems 
                        : (player.stats.collectedRareItems ? Object.values(player.stats.collectedRareItems) : []);
                    player.stats.collectedRareItems = new Set(existingItems);
                }
                const rareCount = player.stats.collectedRareItems.size;
                player.achievements.progress[id] = rareCount;
                if (rareCount >= ach.requirement.amount) {
                    requirementMet = true;
                }
            } else if (value === 'trades_completed') {
                player.achievements.progress[id] = player.stats.tradesCompleted || 0;
                if ((player.stats.tradesCompleted || 0) >= ach.requirement.amount) {
                    requirementMet = true;
                }
            } else if (value === 'gold_traded') {
                player.achievements.progress[id] = player.stats.goldTraded || 0;
                if ((player.stats.goldTraded || 0) >= ach.requirement.amount) {
                    requirementMet = true;
                }
            } else if (value === 'parties_created') {
                player.achievements.progress[id] = player.stats.partiesCreated || 0;
                if ((player.stats.partiesCreated || 0) >= ach.requirement.amount) {
                    requirementMet = true;
                }
            } else if (value === 'parties_joined') {
                player.achievements.progress[id] = player.stats.partiesJoined || 0;
                if ((player.stats.partiesJoined || 0) >= ach.requirement.amount) {
                    requirementMet = true;
                }
            } else if (value === 'party_kills') {
                player.achievements.progress[id] = player.stats.partyKills || 0;
                if ((player.stats.partyKills || 0) >= ach.requirement.amount) {
                    requirementMet = true;
                }
            } else if (value === 'party_boss_kills') {
                player.achievements.progress[id] = player.stats.partyBossKills || 0;
                if ((player.stats.partyBossKills || 0) >= ach.requirement.amount) {
                    requirementMet = true;
                }
            }
        }
        // --- END NEW ---

        if (requirementMet) {
            player.achievements.completed[id] = true;
            addChatMessage(`Achievement Unlocked: ${ach.title}`, `rare`);
            
            // Send global announcement for gold/diamond tier achievements
            if ((ach.tier === 'gold' || ach.tier === 'diamond') && typeof sendAnnouncement === 'function') {
                sendAnnouncement('achievement', { achievementTitle: ach.title, tier: ach.tier });
            }
            
            // Check for completionist medal (server-first all achievements)
            if (typeof checkCompletionistMedal === 'function') {
                checkCompletionistMedal();
            }
            
            updateHotkeyNotifications();
        }
    }
    
    // Update achievement window in real-time if open
    if (achievementWindow && achievementWindow.style.display !== 'none') {
        updateAchievementUI();
    }
}

/**
 * Claims the reward for a completed achievement.
 * @param {string} id - The ID of the achievement to claim.
 */
function claimAchievementReward(id) {
    if (player.achievements.completed[id] && !player.achievements.claimed[id]) {
        const ach = achievementData[id];

        // --- FIX: Check for item rewards and inventory space FIRST ---
        if (ach.reward.item) {
            const newItem = {
                name: ach.reward.item,
                quantity: ach.reward.quantity || 1,
                ...itemData[ach.reward.item]
            };
            // Attempt to add the item. If it fails, stop the function.
            if (!addItemToInventory(newItem)) {
                // The addItemToInventory function already shows the "inventory full" message.
                return;
            }
            showNotification(`You received ${newItem.name}!`, 'rare');
        }
        // --- END OF FIX ---

        // If the item was added successfully (or if there was no item), proceed.
        player.achievements.claimed[id] = true;

        if (ach.reward.gold) {
            player.gold += ach.reward.gold;
            player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + ach.reward.gold;
            updateAchievementProgress('action_accumulate', 'gold_earned');
            showNotification(`+${ach.reward.gold.toLocaleString()} Gold`, 'exp');
        }

        // Grant EXP based on achievement tier
        const expRewards = {
            'bronze': 50,
            'silver': 150,
            'gold': 400,
            'diamond': 1000
        };
        const expReward = expRewards[ach.tier] || 0;
        if (expReward > 0) {
            gainExp(expReward);
            showNotification(`+${expReward} EXP`, 'exp');
        }

        updateAchievementUI();
        updateUI();
        updateHotkeyNotifications();
    }
}

// in player.js

function performEnhancement() {
    // --- THIS ENTIRE FUNCTION IS REFACTORED ---
    if (!enhancementTarget) return;

    let item;
    // Get the item from its source
    if (enhancementTarget.source === 'inventory') {
        item = player.inventory[enhancementTarget.tab][enhancementTarget.index];
    } else { // 'equipment'
        item = player.equipped[enhancementTarget.slot];
    }

    const scrollIndex = player.inventory.etc.findIndex(i => i.name === 'Enhancement Scroll');
    const scroll = player.inventory.etc[scrollIndex];
    const currentLevel = item.enhancement || 0;
    const cost = 100 * (currentLevel + 1) * (currentLevel + 1);

    if (!item || !scroll || player.gold < cost) {
        showNotification("Cannot perform enhancement.", 'error');
        toggleWindow(document.getElementById('enhancement-confirm-modal'));
        return;
    }

    player.gold -= cost;
    player.stats.goldSpent += cost;
    updateAchievementProgress('action_accumulate', 'gold_spent');
    scroll.quantity--;
    if (scroll.quantity <= 0) {
        player.inventory.etc.splice(scrollIndex, 1);
    }
    
    // Update enhancement window immediately after gold is spent (affects affordability)
    if (typeof updateEnhancementWindow === 'function') {
        updateEnhancementWindow();
    }

    const successRates = [0.95, 0.90, 0.85, 0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.10];
    const destroyRates = [0, 0, 0, 0, 0.01, 0.02, 0.03, 0.05, 0.08, 0.1];
    const successChance = successRates[Math.min(currentLevel, successRates.length - 1)];
    const destroyChance = destroyRates[Math.min(currentLevel, destroyRates.length - 1)];
    const roll = Math.random();

    if (roll < successChance) {
        item.enhancement = (item.enhancement || 0) + 1;
        addChatMessage(`Enhancement SUCCEEDED! ${item.name} is now +${item.enhancement}.`, 'success');
        playSound('enchantSuccess');
        
        // Send global announcement for +10 enhancement (max level)
        if (item.enhancement === 10 && typeof sendAnnouncement === 'function') {
            sendAnnouncement('enhancement', { itemName: item.name, enhancementLevel: item.enhancement });
        }
        
        updateAchievementProgress('action', 'enhance_success');
        player.stats.enhanceSuccessCount = (player.stats.enhanceSuccessCount || 0) + 1;
        
        // Check enhancement count achievements
        updateAchievementProgress('action_accumulate', 'items_enhanced');
        // Update UI immediately to show new enhancement level and glow
        updateInventoryUI();
        updateEquipmentUI();
        
        // Update stat window in real-time if open (enhancement affects stats)
        if (statWindowElement && statWindowElement.style.display !== 'none') {
            updateStatWindowUI();
        }
        
        // Update achievement window in real-time if open (enhancement may trigger achievements)
        if (achievementWindow && achievementWindow.style.display !== 'none') {
            updateAchievementUI();
        }
        
        // Update enhancement window in real-time if open (show new enhancement level and costs)
        if (typeof updateEnhancementWindow === 'function') {
            updateEnhancementWindow();
        }
        reapplyBuffs();
    } else {
        if (Math.random() < destroyChance) {
            addChatMessage(`Enhancement FAILED and ${item.name} was DESTROYED!`, 'destroyed');
            playSound('enchantFail');
            // Remove the item from its source
            if (enhancementTarget.source === 'inventory') {
                player.inventory[enhancementTarget.tab].splice(enhancementTarget.index, 1);
            } else {
                player.equipped[enhancementTarget.slot] = null;
            }
            // Mark that the item was destroyed for UI display
            itemWasDestroyed = true;
            // Don't clear enhancementTarget yet - keep it for the destroyed message
            selectedInventoryIndex = null;
            // Update UI immediately to show item removal
            updateInventoryUI();
            updateEquipmentUI();
            
            // Recalculate player stats after item removal
            reapplyBuffs();
            
            // Update stat window in real-time if open (item removal affects stats)
            if (statWindowElement && statWindowElement.style.display !== 'none') {
                updateStatWindowUI();
            }
            
            // Update enhancement window in real-time to show destroyed message
            if (typeof updateEnhancementWindow === 'function') {
                updateEnhancementWindow();
            }
            
            // Clear enhancementTarget after a short delay to prevent auto-filling with another item
            setTimeout(() => {
                enhancementTarget = null;
                itemWasDestroyed = false;
            }, 100);
        } else {
            addChatMessage(`Enhancement FAILED on ${item.name}.`, 'fail');
            playSound('enchantFail');
        }
    }

    // Keep the target selected so user can enhance the same item multiple times
    // enhancementTarget and selectedInventoryIndex remain unchanged
    // Don't close the enhancement modal - let user enhance multiple items
    updateInventoryUI();
    updateEquipmentUI(); // Update equipment UI in case an item was destroyed
    updateUI();
    
    // Keep the NPC dialogue open by not closing it
}

/**
 * Checks an NPC's quests against the player's log to determine their status.
 * @param {object} npc - The NPC object from npcData.
 * @returns {string|null} 'complete', 'available', 'inProgress', or null.
 */
function getNpcQuestStatus(npc) {
    if (!npc.quests || npc.quests.length === 0) {
        return null;
    }

    let isAvailable = false;
    let isInProgress = false;

    // First, check all active quests to see if any can be completed at this NPC (cross-NPC completion)
    for (const activeQuest of player.quests.active) {
        const quest = questData[activeQuest.id];
        if (!quest) continue;
        
        const completionNpc = quest.completionNpcId || quest.npcId;
        if (completionNpc === npc.id) {
            let canComplete = false;
            if (quest.objective.type === 'kill') {
                canComplete = activeQuest.progress >= quest.objective.count;
            } else if (quest.objective.type === 'killMultiple') {
                canComplete = quest.objective.targets.every(target => 
                    (activeQuest.multiProgress?.[target.monster] || 0) >= target.count
                );
            } else if (quest.objective.type === 'collect') {
                const allInventoryItems = [
                    ...player.inventory.equip,
                    ...player.inventory.use,
                    ...player.inventory.etc,
                    ...player.inventory.cosmetic
                ];
                const totalCount = allInventoryItems
                    .filter(item => item.name === quest.objective.target)
                    .reduce((sum, item) => sum + (item.quantity || 1), 0);
                canComplete = totalCount >= quest.objective.count;
            } else if (quest.objective.type === 'talk') {
                canComplete = true;
            } else if (quest.objective.type === 'tutorial' || quest.objective.type === 'actions') {
                canComplete = player.tutorialActions && quest.objective.actions.every(action => player.tutorialActions[action]);
            } else if (quest.objective.type === 'useItem') {
                canComplete = activeQuest.progress >= quest.objective.count;
            }
            if (canComplete) {
                return 'complete'; // Highest priority
            }
        }
    }

    // Then check quests that this NPC offers
    for (const questId of npc.quests) {
        const quest = questData[questId];
        
        // Skip if quest data doesn't exist
        if (!quest) {
            console.warn(`Quest data not found for ID: ${questId} (NPC: ${npc.id})`);
            continue;
        }
        
        const playerActiveQuest = player.quests.active.find(q => q.id === questId);

        // Priority 1: Check for completable quests
        if (playerActiveQuest) {
            // Skip if this quest must be completed at a different NPC
            const completionNpc = quest.completionNpcId || quest.npcId;
            if (completionNpc !== npc.id) {
                isInProgress = true;
                continue;
            }
            
            let canComplete = false;
            if (quest.objective.type === 'kill') {
                canComplete = playerActiveQuest.progress >= quest.objective.count;
            } else if (quest.objective.type === 'killMultiple') {
                canComplete = quest.objective.targets.every(target => 
                    (playerActiveQuest.multiProgress?.[target.monster] || 0) >= target.count
                );
            } else if (quest.objective.type === 'collect') {
                // Check all inventory categories for the item with proper quantity
                const allInventoryItems = [
                    ...player.inventory.equip,
                    ...player.inventory.use,
                    ...player.inventory.etc,
                    ...player.inventory.cosmetic
                ];
                const totalCount = allInventoryItems
                    .filter(item => item.name === quest.objective.target)
                    .reduce((sum, item) => sum + (item.quantity || 1), 0);
                canComplete = totalCount >= quest.objective.count;
            } else if (quest.objective.type === 'talk') {
                canComplete = true;
            } else if (quest.objective.type === 'tutorial' || quest.objective.type === 'actions') {
                // Check if all required tutorial actions have been completed
                canComplete = player.tutorialActions && quest.objective.actions.every(action => player.tutorialActions[action]);
            } else if (quest.objective.type === 'useItem') {
                canComplete = playerActiveQuest.progress >= quest.objective.count;
            }
            if (canComplete) {
                return 'complete'; // Highest priority
            }
            isInProgress = true;
        }

        // Check for available quests (including prerequisite and level checks)
        const isCompleted = player.quests.completed.includes(questId);
        const prerequisiteMet = !quest.prerequisite || player.quests.completed.includes(quest.prerequisite);
        const levelMet = !quest.levelReq || player.level >= quest.levelReq;
        if (!playerActiveQuest && !isCompleted && prerequisiteMet && levelMet) {
            isAvailable = true;
        }
    }

    if (isAvailable) return 'available';
    if (isInProgress) return 'inProgress';

    return null;
}

// Track items that have already been announced (to prevent duplicate announcements)
const announcedRareItems = new Set();

// Mark existing epic/legendary items as already announced on character load
function markExistingRareItemsAsAnnounced() {
    // Clear the set first (in case of re-initialization)
    announcedRareItems.clear();
    
    // Check all inventory tabs
    const tabs = ['equip', 'use', 'etc', 'cosmetic'];
    for (const tab of tabs) {
        if (player.inventory && player.inventory[tab]) {
            for (const item of player.inventory[tab]) {
                if (item && (item.rarity === 'legendary' || item.rarity === 'epic')) {
                    announcedRareItems.add(`${item.name}_${item.rarity}`);
                }
            }
        }
    }
    
    // Check equipped items
    if (player.equipped) {
        for (const slot of Object.keys(player.equipped)) {
            const item = player.equipped[slot];
            if (item && (item.rarity === 'legendary' || item.rarity === 'epic')) {
                announcedRareItems.add(`${item.name}_${item.rarity}`);
            }
        }
    }
    
    // Check cosmetic equipped items
    if (player.cosmeticEquipped) {
        for (const slot of Object.keys(player.cosmeticEquipped)) {
            const item = player.cosmeticEquipped[slot];
            if (item && (item.rarity === 'legendary' || item.rarity === 'epic')) {
                announcedRareItems.add(`${item.name}_${item.rarity}`);
            }
        }
    }
}

// Helper function to announce legendary/epic drops after successful pickup
// Only announces each item ONCE (first time acquired)
function announceRareDrop(item) {
    // Create a unique key for this item (name + rarity)
    const itemKey = `${item.name}_${item.rarity}`;
    
    // Skip if already announced
    if (announcedRareItems.has(itemKey)) {
        return;
    }
    
    if (item.rarity === 'legendary') {
        announcedRareItems.add(itemKey);
        updateAchievementProgress('action', 'loot_legendary');
        if (typeof sendAnnouncement === 'function') {
            sendAnnouncement('rare_drop', { itemName: item.name, rarity: 'legendary' });
        }
    } else if (item.rarity === 'epic') {
        announcedRareItems.add(itemKey);
        if (typeof sendAnnouncement === 'function') {
            sendAnnouncement('rare_drop', { itemName: item.name, rarity: 'epic' });
        }
    }
}

function addItemToInventory(item) {
    const itemInfo = itemData[item.name];
    if (!itemInfo) return false;

    // --- NEW: Track rare items collected for Treasure Hunter achievement ---
    // Note: Announcements for legendary/epic items are sent AFTER successful pickup
    if (item.rarity === 'rare') {
        // Ensure collectedRareItems is a Set (may be array/object from localStorage)
        if (!player.stats.collectedRareItems || !(player.stats.collectedRareItems instanceof Set)) {
            const existingItems = Array.isArray(player.stats.collectedRareItems) 
                ? player.stats.collectedRareItems 
                : (player.stats.collectedRareItems ? Object.values(player.stats.collectedRareItems) : []);
            player.stats.collectedRareItems = new Set(existingItems);
        }
        player.stats.collectedRareItems.add(item.name);
        updateAchievementProgress('action_accumulate', 'collect_rares_10');
    }
    // --- END NEW ---

    const category = itemInfo.category.toLowerCase();
    const targetTab = (category === 'equip' || category === 'use' || category === 'cosmetic') ? category : 'etc';
    const targetInventory = player.inventory[targetTab];

    if (targetTab === 'use' || targetTab === 'etc') {
        const existingStack = targetInventory.find(i => i.name === item.name);
        if (existingStack) {
            existingStack.quantity = (existingStack.quantity || 1) + (item.quantity || 1);
            
            // Update inventory UI in real-time if open
            if (inventoryElement && inventoryElement.style.display !== 'none') {
                updateInventoryUI();
            }
            
            // Update hotbar UI to show updated item quantities
            if (typeof updateSkillHotbarUI === 'function') {
                updateSkillHotbarUI();
            }
            
            // Announce rare drops AFTER successful pickup
            announceRareDrop(item);
            
            return true;
        }
    }

    // --- THIS IS THE FIX ---
    // Use the player's actual inventory slot count instead of a fixed number.
    const slotsPerTab = player.inventorySlots || 16;
    // --- END OF FIX ---

    if (targetInventory.length < slotsPerTab) {
        targetInventory.push(item);
        
        // Update inventory UI in real-time if open
        if (inventoryElement && inventoryElement.style.display !== 'none') {
            updateInventoryUI();
        }
        
        // Update hotbar UI to show updated item quantities
        if (typeof updateSkillHotbarUI === 'function') {
            updateSkillHotbarUI();
        }
        
        // Check if this item is needed for any active collect quests
        const hasCollectQuest = player.quests.active.some(quest => {
            const qData = questData[quest.id];
            return qData && qData.objective.type === 'collect' && qData.objective.target === item.name;
        });
        
        // Auto-open quest helper if item is for a quest
        if (hasCollectQuest) {
            if (typeof updateQuestHelperUI === 'function') {
                updateQuestHelperUI();
            }
            if (typeof autoOpenQuestHelper === 'function') {
                autoOpenQuestHelper();
            }
        }
        
        // Announce rare drops AFTER successful pickup
        announceRareDrop(item);
        
        return true;
    }

    addChatMessage(`Inventory tab '${targetTab}' is full!`, 'error');
    return false;
}

/**
 * Sorts the items in a specific inventory tab.
 * @param {string} tabName - The name of the inventory tab to sort (e.g., 'equip', 'use').
 */
function sortInventoryTab(tabName) {
    const targetInventory = player.inventory[tabName];
    if (!targetInventory) return;

    const rarityOrder = { legendary: 5, epic: 4, rare: 3, quest: 2, cosmetic: 1, common: 0 };

    targetInventory.sort((a, b) => {
        const itemInfoA = itemData[a.name];
        const itemInfoB = itemData[b.name];

        // 1. Primary Sort: Group by Item Type (e.g., all swords together)
        const typeA = itemInfoA.type || itemInfoA.category;
        const typeB = itemInfoB.type || itemInfoB.category;
        if (typeA !== typeB) {
            return typeA.localeCompare(typeB);
        }

        // 2. Secondary Sort: Rarity (descending)
        const rarityA = rarityOrder[a.rarity] || 0;
        const rarityB = rarityOrder[b.rarity] || 0;
        if (rarityA !== rarityB) {
            return rarityB - rarityA;
        }

        // 3. Tertiary Sort: Level Requirement (descending)
        const levelA = a.levelReq || 1;
        const levelB = b.levelReq || 1;
        if (levelA !== levelB) {
            return levelB - levelA;
        }

        // 4. Fallback Sort: Alphabetical by name
        return a.name.localeCompare(b.name);
    });

    // Deselect any item after sorting
    selectedInventoryIndex = null;
    addChatMessage(`${capitalize(tabName)} tab sorted.`, 'success');
}

/**
 * Retrieves the detailed data for a learned skill.
 * @param {string} abilityName - The name of the skill.
 * @returns {object|null} The complete skill object with current level stats.
 */
function getSkillDetails(abilityName) {
    const learnedSkill = player.abilities.find(a => a.name === abilityName);
    let skillTemplate = skillData[player.class]?.find(s => s.name === abilityName) || skillData.beginner.find(s => s.name === abilityName);

    // If not found in current class, search all skill data
    if (!skillTemplate) {
        for (const className in skillData) {
            if (skillData[className] && Array.isArray(skillData[className])) {
                skillTemplate = skillData[className].find(s => s.name === abilityName);
                if (skillTemplate) break;
            }
        }
    }

    if (learnedSkill && skillTemplate) {
        const levelIndex = Math.min(learnedSkill.level - 1, skillTemplate.levels.length - 1);
        return { ...skillTemplate, ...skillTemplate.levels[levelIndex] };
    }
    return null;
}

/**
 * Begins a channeling-type skill.
 * @param {object} skill - The skill object to channel.
 */
function startChanneling(skill) {
    if (player.isChanneling || (player.mp < skill.mpCost && !isGmMode.infiniteStats)) {
        if (player.mp < skill.mpCost && !isGmMode.infiniteStats) showNotification("Not enough MP!", 'error');
        return;
    }

    player.isChanneling = true;
    player.channelingSkill = skill;

    if (!isGmMode.infiniteStats) {
        player.mp -= skill.mpCost;
    }
    createProjectile(skill.projectile, skill.damageMultiplier);
    updateUI();

    player.channelingInterval = setInterval(() => {
        if (player.mp >= skill.mpCost || isGmMode.infiniteStats) {
            if (!isGmMode.infiniteStats) {
                player.mp -= skill.mpCost;
            }
            createProjectile(skill.projectile, skill.damageMultiplier);
            updateUI();
        } else {
            stopChanneling();
            showNotification("Not enough MP!", 'error');
        }
    }, skill.fireRate);
}

/**
 * Stops a channeling skill.
 */
function stopChanneling() {
    if (player.isChanneling) {
        clearInterval(player.channelingInterval);
        player.isChanneling = false;
        player.channelingSkill = null;
        player.channelingInterval = null;
        player.animationState = player.onLadder ? 'climb' : (player.isJumping ? 'jump' : 'idle');
    }
}

// in player.js

function getPlayerWeaponType() {
    // Safety check for player.equipped
    if (!player || !player.equipped) {
        return 'melee';
    }
    
    const weapon = player.equipped.weapon;
    if (!weapon || !weapon.name) return 'melee';
    
    const weaponName = weapon.name.toLowerCase();
    
    // Check for ranged weapons by name
    if (weaponName.includes('bow') || weaponName.includes('staff') || weaponName.includes('pistol') || weaponName.includes('gun')) {
        return 'ranged';
    }
    
    // Check by class requirement (more reliable method)
    const weaponData = itemData[weapon.name];
    if (weaponData && weaponData.classReq) {
        const rangedClasses = ['bowman', 'hunter', 'crossbowman', 'magician', 'wizard', 'cleric', 'pirate', 'gunslinger'];
        if (weaponData.classReq.some(cls => rangedClasses.includes(cls))) {
            return 'ranged';
        }
    }
    
    // If weapon has no class requirement (can be equipped by all), check player's class
    if (weaponData && !weaponData.classReq) {
        const playerClass = player.class.toLowerCase();
        const rangedClasses = ['bowman', 'hunter', 'crossbowman', 'magician', 'wizard', 'cleric', 'pirate', 'gunslinger'];
        if (rangedClasses.includes(playerClass)) {
            return 'ranged';
        }
    }
    
    return 'melee';
}

function getProjectileTypeForWeapon() {
    const weapon = player.equipped.weapon;
    if (!weapon || !weapon.name) return 'arrowProjectile';
    
    const weaponName = weapon.name.toLowerCase();
    const weaponData = itemData[weapon.name];
    
    // Determine projectile type based on weapon name or class requirement
    if (weaponName.includes('bow') || (weaponData && weaponData.classReq && weaponData.classReq.includes('bowman'))) {
        return 'arrowProjectile';
    } else if (weaponName.includes('staff') || (weaponData && weaponData.classReq && weaponData.classReq.includes('magician'))) {
        return 'energyBoltProjectile';
    } else if (weaponName.includes('pistol') || weaponName.includes('gun') || (weaponData && weaponData.classReq && weaponData.classReq.includes('pirate'))) {
        return 'bulletProjectile';
    }
    
    // If weapon has no class requirement (can be equipped by all), check player's class
    if (weaponData && !weaponData.classReq) {
        const playerClass = player.class.toLowerCase();
        if (playerClass === 'bowman' || playerClass === 'hunter' || playerClass === 'crossbowman') {
            return 'arrowProjectile';
        } else if (playerClass === 'magician' || playerClass === 'wizard' || playerClass === 'cleric') {
            return 'energyBoltProjectile';
        } else if (playerClass === 'pirate' || playerClass === 'gunslinger') {
            return 'bulletProjectile';
        }
    }
    
    return 'arrowProjectile'; // Default fallback
}

function useAbility(abilityName) {
    // Check if player is initialized
    if (!player || !player.lastAttackTime) {
        console.warn('[useAbility] Player not initialized yet');
        return;
    }
    
    if (player.onLadder) {
        const skill = getSkillDetails(abilityName);
        if (skill?.type !== 'buff') {
            return;
        }
    }

    if (player.isInvisible && abilityName !== 'Dark Sight') {
        // Cancel Dark Sight when player attacks
        const darkSightBuffIndex = player.buffs.findIndex(b => b.name === 'Dark Sight');
        if (darkSightBuffIndex > -1) {
            const darkSightBuff = player.buffs[darkSightBuffIndex];
            if (darkSightBuff.timeoutId) {
                clearTimeout(darkSightBuff.timeoutId);
            }
            player.buffs.splice(darkSightBuffIndex, 1);
            reapplyBuffs();
            showNotification("Dark Sight cancelled!", 'system');
        }
    }

    const now = Date.now();
    let skillTemplate = null;
    
    // Safely check for skillData
    if (typeof skillData !== 'undefined' && skillData) {
        skillTemplate = skillData[player.class]?.find(s => s.name === abilityName) || skillData.beginner?.find(s => s.name === abilityName);

        if (!skillTemplate) {
            for (const className in skillData) {
                if (skillData[className] && Array.isArray(skillData[className])) {
                    skillTemplate = skillData[className].find(s => s.name === abilityName);
                    if (skillTemplate) break;
                }
            }
        }
    }

    let ability;
    if (abilityName === 'Basic Attack') {
        const weaponType = getPlayerWeaponType();
        if (weaponType === 'ranged') {
            ability = { name: 'Basic Attack', displayName: 'Basic Attack', mpCost: 0, type: 'ranged', damageMultiplier: 1, multiTarget: false };
        } else {
            ability = { name: 'Basic Attack', displayName: 'Basic Attack', mpCost: 0, type: 'melee', damageMultiplier: 1, multiTarget: false };
        }
    } else {
        const learnedSkill = player.abilities.find(a => a.name === abilityName);
        if (learnedSkill && skillTemplate) {
            const levelIndex = Math.min(learnedSkill.level - 1, skillTemplate.levels.length - 1);
            ability = { ...skillTemplate, ...skillTemplate.levels[levelIndex] };
        } else {
            return;
        }
    }

    const cooldown = ability.cooldown || player.attackCooldown;
    
    // Check global cooldown first (prevents ability spam by alternating)
    if (now - player.lastGlobalAttackTime < player.attackCooldown) return;
    
    // Then check individual ability cooldown
    if (now - (player.lastAttackTime[ability.name] || 0) < cooldown) return;

    if (player.mp < ability.mpCost && !isGmMode.infiniteStats) {
        showNotification("Not enough MP!", 'error');
        return;
    }

    if (!isGmMode.infiniteStats) {
        player.mp -= ability.mpCost;
    }
    player.lastAttackTime[ability.name] = now;
    player.lastGlobalAttackTime = now; // Update global cooldown

    if (ability.type === 'buff') {
        // --- THIS IS THE REFACTORED LOGIC ---
        // It now only handles the data side of applying a buff. The UI is handled by updateBuffUI.
        const existingBuffIndex = player.buffs.findIndex(b => b.name === ability.name);
        if (existingBuffIndex > -1) {
            // Remove the old buff to refresh its duration
            clearTimeout(player.buffs[existingBuffIndex].timeoutId);
            player.buffs.splice(existingBuffIndex, 1);
        }

        const endTime = Date.now() + ability.duration;
        const newBuff = {
            name: ability.name,
            displayName: ability.displayName,
            effect: ability.effect,
            endTime: endTime,
            isItemBuff: false // It's a skill buff
        };

        // This timeout is only for removing the buff data from the player object later
        newBuff.timeoutId = setTimeout(() => {
            const buffIndex = player.buffs.findIndex(b => b.name === ability.name);
            if (buffIndex > -1) {
                player.buffs.splice(buffIndex, 1);
                reapplyBuffs();
            }
        }, ability.duration);

        player.buffs.push(newBuff);
        showNotification(`${ability.displayName} activated!`, 'rare');
        reapplyBuffs();
        // --- END OF REFACTORED LOGIC ---

    } else if (ability.type === 'melee' || ability.type === 'aoe_melee') {
        playAttackAnimation();
        playSound('attack');
        handlePlayerAttack(ability);
    } else if (ability.type === 'ranged') {
        playAttackAnimation();
        playSound('attack');
        const projectileType = getProjectileTypeForWeapon();
        createProjectile(projectileType, ability.damageMultiplier);
    } else if (ability.type === 'projectile') {
        playAttackAnimation();
        playSound('attack');
        const hits = ability.hits || 1;
        for (let i = 0; i < hits; i++) {
            setTimeout(() => {
                createProjectile(ability.projectile, ability.damageMultiplier, undefined, undefined, 0, ability.homing);
            }, i * 100);
        }
        if (ability.distance) {
            player.velocityX += (player.facing === 'right' ? ability.distance / 10 : -ability.distance / 10);
        }
    } else if (ability.type === 'movement') {
        if (ability.name === 'Dash') {
            player.velocityX += player.facing === 'right' ? ability.distance / 10 : -ability.distance / 10;
        } else if (ability.name === 'Teleport') {
            player.x += player.facing === 'right' ? ability.distance : -ability.distance;
        }
        // Flash Jump is passive - no activation needed
    } else if (ability.type === 'aoe_ranged') {
        playAttackAnimation();
        playSound('attack');
        if (ability.name === 'Arrow Rain') {
            const rainX = player.x + (player.facing === 'right' ? 100 : -150);
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    createProjectile('arrowProjectile', ability.damageMultiplier, rainX + (Math.random() * 100 - 50), player.y - 250, 90);
                }, i * 80);
            }
        } else if (ability.name === 'Grenade') {
            createProjectile('grenadeIcon', ability.damageMultiplier);
        }
    } else if (ability.type === 'channeling') {
        player.animationState = 'attack';
        player.animationFrame = 0;
        playSound('attack');
        startChanneling(ability);
    }
    updateUI();
}

/**
 * Plays a quest VFX animation above the player's head
 */
function playQuestVFX() {
    const effectData = spriteData.questVFX;
    if (!effectData) return;

    const animation = effectData.animations.play;
    if (!animation || animation.length === 0) return;
    
    // Broadcast to other players
    if (typeof broadcastPlayerVFX === 'function') {
        broadcastPlayerVFX('questComplete', player.x, player.y);
    }

    const el = document.createElement('div');
    el.className = 'quest-vfx';
    el.style.position = 'absolute';
    el.style.zIndex = 120;
    el.style.pointerEvents = 'none';

    const effectWidth = effectData.frameWidth * PIXEL_ART_SCALE;
    const effectHeight = effectData.frameHeight * PIXEL_ART_SCALE;

    // Position directly above player's head, centered
    // player.y is the top of the player sprite
    // Use anchor point for proper centering (anchor is at x=8 in the 16px sprite, which is center)
    const anchorOffsetX = effectData.anchorPoint ? effectData.anchorPoint.x * PIXEL_ART_SCALE : effectWidth / 2;
    
    // Player visual sprite is 60px wide (15px * 4 scale), center on that instead of hitbox
    const playerVisualWidth = 60; // The actual rendered sprite width
    const topPos = player.y - effectHeight;
    const leftPos = player.x + (playerVisualWidth / 2) - anchorOffsetX;

    el.style.width = `${effectWidth}px`;
    el.style.height = `${effectHeight}px`;
    el.style.left = `${leftPos}px`;
    el.style.top = `${topPos}px`;

    el.style.backgroundImage = `url(${artAssets.questVFX})`;
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

/**
 * Tracks a tutorial action for action-based quests (welcomeToDewdrop, equipmentBasics, etc).
 * @param {string} action - The action to track (moveLeft, moveRight, jump, attackDummy, openInventory, equipLeatherCap, openEquipment)
 */
function trackTutorialAction(action) {
    // Find any active quest that tracks actions (both 'tutorial' and 'actions' types)
    const actionQuests = player.quests.active.filter(q => {
        const qData = questData[q.id];
        return qData && qData.objective && (qData.objective.type === 'actions' || qData.objective.type === 'tutorial');
    });
    
    if (actionQuests.length === 0) return;
    
    if (!player.tutorialActions[action]) {
        player.tutorialActions[action] = true;
        updateQuestHelperUI();
        updateQuestLogUI();
        
        // Check if any quest's actions are all complete
        for (const quest of actionQuests) {
            const questData_quest = questData[quest.id];
            const allComplete = questData_quest.objective.actions.every(a => player.tutorialActions[a]);
            if (allComplete) {
                playQuestVFX();
                break; // Only play VFX once
            }
        }
        
        // Auto-open quest helper when tutorial action is completed
        if (typeof autoOpenQuestHelper === 'function') {
            autoOpenQuestHelper();
        }
    }
}

/**
 * Adds a quest to the player's active quest log.
 * @param {string} questId - The ID of the quest to accept.
 */
function acceptQuest(questId) {
    const quest = questData[questId];

    // Check if quest has a prerequisite and if it's been completed
    if (quest.prerequisite && !player.quests.completed.includes(quest.prerequisite)) {
        const prereqQuest = questData[quest.prerequisite];
        addChatMessage(`You must complete "${prereqQuest.title}" first.`, 'error');
        return;
    }

    const newQuest = { id: questId, progress: 0 };
    
    // Initialize multiProgress for killMultiple quests
    if (quest.objective && quest.objective.type === 'killMultiple') {
        newQuest.multiProgress = {};
        // Initialize each monster target to 0
        quest.objective.targets.forEach(target => {
            newQuest.multiProgress[target.monster] = 0;
        });
    }
    
    player.quests.active.push(newQuest);
    
    // Give items when accepting quest (if specified)
    if (quest.giveOnAccept && quest.giveOnAccept.items) {
        for (const giveItem of quest.giveOnAccept.items) {
            const newItem = {
                name: giveItem.name,
                quantity: giveItem.quantity || 1,
                ...itemData[giveItem.name],
                ...giveItem
            };
            delete newItem.sprite;
            
            if (addItemToInventory(newItem)) {
                showNotification(`You received ${newItem.name}${newItem.quantity > 1 ? ` x${newItem.quantity}` : ''}!`, giveItem.rarity || itemData[giveItem.name]?.rarity || 'rare');
            } else {
                addChatMessage(`Your inventory is full! Cannot accept quest.`, 'error');
                // Remove the quest that was just added
                player.quests.active.pop();
                return;
            }
        }
    }
    
    // Damage player when accepting quest (if specified) - for tutorial quests
    if (quest.giveOnAccept && quest.giveOnAccept.damagePlayer) {
        player.hp = Math.max(1, player.hp - quest.giveOnAccept.damagePlayer);
        showDamageNumber(quest.giveOnAccept.damagePlayer, player.x + player.width / 2, player.y, true);
        updateUI();
    }
    
    addChatMessage(`Quest Accepted: ${questData[questId].title}`, 'common');
    playQuestVFX();
    toggleWindow(dialogueWindowElement);

    // MODIFIED: Use the new "ensure open" function instead of toggle
    openWindow(questHelperElement, updateQuestHelperUI);

    // Update quest log UI if it's open
    if (typeof updateQuestLogUI === 'function') {
        updateQuestLogUI();
    }
}

/**
 * Completes a quest, removes it from the active log, and gives rewards.
 * @param {string} questId - The ID of the quest to complete.
 */
function completeQuest(questId) {
    const quest = questData[questId];
    const questIndex = player.quests.active.findIndex(q => q.id === questId);
    if (questIndex === -1) return;

    // --- FIX: Reordered logic to grant items BEFORE completing the quest ---
    // 1. Handle item requirements and rewards first.
    if (quest.objective.type === 'collect') {
        // This part is for taking quest items, so it's fine.
        const itemIndex = player.inventory.etc.findIndex(i => i.name === quest.objective.target);
        if (itemIndex > -1) {
            player.inventory.etc.splice(itemIndex, 1);
        }
    }

    // Handle reward items (both singular and array)
    const rewardItems = quest.reward.item ? [quest.reward.item] : (quest.reward.items || []);
    
    for (const rewardItem of rewardItems) {
        const newItem = {
            name: rewardItem.name,
            quantity: rewardItem.quantity || 1,
            ...itemData[rewardItem.name],
            ...rewardItem
        };
        delete newItem.sprite;

        // 2. Attempt to add the item to inventory.
        if (!addItemToInventory(newItem)) {
            // 3. If it fails, put the collected item back (if any) and stop.
            addChatMessage(`Your inventory is full! Make some space to complete the quest.`, 'error');
            if (quest.objective.type === 'collect') {
                addItemToInventory({ name: quest.objective.target, quantity: 1 });
            }
            return; // Stop the entire function.
        }
        // If the item was added successfully, show the notification for it.
        showNotification(`You received ${newItem.name}${newItem.quantity > 1 ? ` x${newItem.quantity}` : ''}!`, rewardItem.rarity || itemData[rewardItem.name]?.rarity || 'rare');
    }

    // 4. If all item rewards were granted successfully, give EXP/Gold and complete the quest.
    gainExp(quest.reward.exp);
    player.gold += quest.reward.gold;
    player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + quest.reward.gold;
    updateAchievementProgress('action_accumulate', 'gold_earned');
    showNotification(`+${quest.reward.gold.toLocaleString()} Gold`, 'exp');

    player.quests.completed.push(questId);
    player.quests.active.splice(questIndex, 1);
    updateAchievementProgress('action', 'quest');
    
    // Check for quest chain completion
    const chainQuests = ['slimeInvestigation2', 'advancedForging2', 'forestGuardian2', 'pirateCode2'];
    if (chainQuests.includes(questId)) {
        updateAchievementProgress('action', 'quest_chain');
    }
    
    // Track quest completion count
    updateAchievementProgress('action_accumulate', 'quests_completed');

    playSound('quest');
    addChatMessage('Quest Complete!', 'quest-complete');
    playQuestVFX();
    toggleWindow(dialogueWindowElement);
    updateUI();
    updateInventoryUI();
    
    // Update quest log UI if it exists
    if (typeof updateQuestLogUI === 'function') {
        updateQuestLogUI();
    }
    
    // Update stat window in real-time if open (quest completion affects gold/inventory)
    if (statWindowElement && statWindowElement.style.display !== 'none') {
        updateStatWindowUI();
    }
    
    // Update achievement window in real-time if open (quest completion may trigger achievements)
    if (achievementWindow && achievementWindow.style.display !== 'none') {
        updateAchievementUI();
    }
}

// --- Rendering ---

function renderPlayer() {
    const playerElement = document.getElementById('player');
    const spriteContainer = document.getElementById('player-sprite-container');
    const chatBubble = document.getElementById('player-chat-bubble');

    const playerVisualY = player.y - (player.yOffset || 0);
    playerElement.style.left = `${Math.round(player.x)}px`;
    playerElement.style.top = `${Math.round(playerVisualY)}px`;

    let canvas = spriteContainer.querySelector('canvas');
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
        spriteContainer.innerHTML = '';
        spriteContainer.appendChild(canvas);
    }
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (player.isDead) {
        spriteContainer.innerHTML = sprites.tombstone;
    } else {
        const pData = spriteData.player;
        const anim = pData.animations[player.animationState] || pData.animations.idle;
        const frameIndex = player.animationFrame % anim.length;
        const frame = anim[frameIndex];

        ctx.save();
        if (player.facing === 'left') {
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
        }

        const skinY = pData.frameHeight * (player.customization.skinTone + 1);
        ctx.drawImage(playerSheetImage, frame.x, skinY, pData.frameWidth, pData.frameHeight, 0, 0, canvas.width, canvas.height);
        ctx.drawImage(playerSheetImage, frame.x, 0, pData.frameWidth, pData.frameHeight, 0, 0, canvas.width, canvas.height);

        // --- CORRECTED EYE RENDERING CHECK ---
        // This check now correctly references frame.attachments to see if eyes should be drawn.
        if (player.animationState !== 'climb' && frame.attachments?.eyes) {
            // Check if any face or eye accessory hides the eyes
            const faceItem = player.equipped.face || player.cosmeticEquipped.face;
            const eyeItem = player.equipped.eye || player.cosmeticEquipped.eye;
            const shouldHideEyes = (faceItem && itemData[faceItem.name] && itemData[faceItem.name].hideEyes) ||
                                   (eyeItem && itemData[eyeItem.name] && itemData[eyeItem.name].hideEyes);
            
            if (!shouldHideEyes) {
                const eyeData = spriteData.playerEyes;
                const eyeDestWidth = eyeData.frameWidth * PIXEL_ART_SCALE;
                const eyeDestHeight = eyeData.frameHeight * PIXEL_ART_SCALE;
                let eyeAttachmentPoint = frame.attachments.eyes;
                const finalEyeX = eyeAttachmentPoint.x * PIXEL_ART_SCALE;
                const finalEyeY = eyeAttachmentPoint.y * PIXEL_ART_SCALE;
                const eyeSourceX = player.isBlinking ? eyeData.frameWidth : 0;
                const eyeSourceY = eyeData.frameHeight * player.customization.eyeColor;

                ctx.drawImage(
                    playerEyesSheet, eyeSourceX, eyeSourceY,
                    eyeData.frameWidth, eyeData.frameHeight,
                    finalEyeX, finalEyeY, eyeDestWidth, eyeDestHeight
                );
            }
        }

        ctx.restore();
    }

    if (player.chatMessage && !player.isDead) {
        chatBubble.textContent = player.chatMessage;
        chatBubble.style.display = 'block';
    } else {
        chatBubble.style.display = 'none';
    }
}

/**
 * Updates the pet position and animation to follow the player
 */
function updatePet() {
    if (!player.activePet || !player.activePet.type || !player.activePet.isSpawned) return;

    const petInfo = petData[player.activePet.type];
    if (!petInfo) return;

    // Initialize pet physics properties if not present
    if (player.activePet.velocityY === undefined) player.activePet.velocityY = 0;
    if (player.activePet.previousY === undefined) player.activePet.previousY = player.activePet.y;
    if (player.activePet.isJumping === undefined) player.activePet.isJumping = false;
    if (player.activePet.yOffset === undefined) player.activePet.yOffset = -6; // Visual offset like player
    if (player.activePet.facingLeft === undefined) player.activePet.facingLeft = false;

    // Teleport pet if player is on a ladder or pet is too far away
    const distanceToPlayer = Math.hypot(
        player.x - player.activePet.x,
        player.y - player.activePet.y
    );
    
    const MAX_PET_DISTANCE = 600; // Teleport if pet gets more than 600px away
    
    if (player.onLadder || distanceToPlayer > MAX_PET_DISTANCE) {
        // Teleport pet to player's side
        player.activePet.x = player.x + petInfo.offsetX;
        player.activePet.y = player.y + petInfo.offsetY;
        player.activePet.velocityY = 0;
        player.activePet.isJumping = false;
        player.activePet.previousY = player.activePet.y;
        return; // Skip rest of update this frame
    }

    // Initialize pet failed loot tracking (always ensure it's a Map, not a plain object from save)
    if (!player.activePet.failedLootAttempts || !(player.activePet.failedLootAttempts instanceof Map)) {
        player.activePet.failedLootAttempts = new Map(); // Map of item -> { startTime, lastY }
    }
    
    // Clean up tracking for items that no longer exist
    for (const [trackedItem, data] of player.activePet.failedLootAttempts) {
        if (!droppedItems.includes(trackedItem)) {
            player.activePet.failedLootAttempts.delete(trackedItem);
        }
    }

    // Check for nearby items within detection range
    let nearestItem = null;
    let nearestDistance = Infinity;
    const ITEM_DETECTION_RANGE = 400; // Pet can see items from very far away
    const MAX_Y_DIFFERENCE = 80; // Reduced from 100 - only track items within ~80px vertically (more realistic jump height)
    const PET_MAX_JUMP_HEIGHT = 60; // Approximate max height pet can reach with its jump
    const FAILED_ATTEMPT_TIMEOUT = 3000; // Stop trying after 3 seconds of failed attempts
    
    // Look for items if pet is reasonably close to player
    if (distanceToPlayer < 500 && typeof droppedItems !== 'undefined') {
        for (const item of droppedItems) {
            // Check if pet has been failing to reach this item for too long
            const attemptData = player.activePet.failedLootAttempts.get(item);
            if (attemptData && Date.now() - attemptData.startTime > FAILED_ATTEMPT_TIMEOUT) {
                // Pet has been trying too long, skip this item
                continue;
            }
            
            // Skip gold items in this check (gold can always be picked up)
            if (item.name !== 'Gold') {
                // Check if pet can actually pick up this item based on inventory space
                const itemInfo = itemData[item.name];
                if (itemInfo) {
                    const category = itemInfo.category.toLowerCase();
                    const targetTab = (category === 'equip' || category === 'use' || category === 'cosmetic') ? category : 'etc';
                    const targetInventory = player.inventory[targetTab];
                    const slotsPerTab = player.inventorySlots || 16;
                    
                    // Check if item can stack or if there's space
                    const canStack = (targetTab === 'use' || targetTab === 'etc') && 
                                     targetInventory.some(i => i.name === item.name);
                    const hasSpace = targetInventory.length < slotsPerTab;
                    
                    // If can't pick up, ignore this item completely
                    if (!canStack && !hasSpace) {
                        continue;
                    }
                }
            }
            
            // Calculate horizontal and vertical distances separately
            const dx = Math.abs((player.activePet.x + petInfo.width / 2) - (item.x + item.width / 2));
            const dy = (item.y + item.height / 2) - (player.activePet.y + petInfo.height / 2);
            
            // Only consider items that are within reasonable vertical reach
            // Allow items slightly above (can jump) or below (can fall) but not too far
            if (Math.abs(dy) > MAX_Y_DIFFERENCE) continue;
            
            // Prefer horizontal distance for pathfinding (prioritize items on same level)
            const itemDistance = dx + Math.abs(dy) * 0.3; // Weight vertical distance less
            
            // Check if item is within detection range and closer than current nearest
            if (dx < ITEM_DETECTION_RANGE && itemDistance < nearestDistance) {
                // Also verify item is somewhat near the player (within extended loot assist range)
                const itemToPlayerDist = Math.hypot(
                    (player.x + player.width / 2) - (item.x + item.width / 2),
                    (player.y + player.height / 2) - (item.y + item.height / 2)
                );
                
                if (itemToPlayerDist < 600) { // Item is near player (extended range)
                    nearestItem = item;
                    nearestDistance = itemDistance;
                }
            }
        }
    }

    // Determine target position
    let targetX, targetY;
    let chasingItem = false;
    if (nearestItem && nearestDistance > petInfo.lootRange) {
        // Check if this is a new target or continuing to chase the same item
        if (!player.activePet.failedLootAttempts.has(nearestItem)) {
            // Start tracking this item
            player.activePet.failedLootAttempts.set(nearestItem, {
                startTime: Date.now(),
                lastPetY: player.activePet.y
            });
        } else {
            // Update tracking - check if pet is making progress
            const attemptData = player.activePet.failedLootAttempts.get(nearestItem);
            const petToItemY = nearestItem.y - player.activePet.y;
            
            // If item is above pet and pet hasn't gotten closer in a while, it's stuck
            if (petToItemY < -20) { // Item is above pet
                // Check if pet has been at roughly the same Y position (stuck jumping)
                if (Math.abs(player.activePet.y - attemptData.lastPetY) < 30 && 
                    Date.now() - attemptData.startTime > 1500) {
                    // Pet is stuck, mark as failed for longer timeout
                    attemptData.startTime = Date.now() - 2500; // Will timeout soon
                }
            }
            attemptData.lastPetY = player.activePet.y;
        }
        
        // Run towards the item
        targetX = nearestItem.x + nearestItem.width / 2 - petInfo.width / 2;
        targetY = nearestItem.y + nearestItem.height / 2 - petInfo.height / 2;
        chasingItem = true;
    } else {
        // Not chasing any item - clear failed attempts for items we're no longer near
        // (but keep tracking items we've given up on)
        
        // Follow player at offset
        targetX = player.x + petInfo.offsetX;
        targetY = player.y + petInfo.offsetY;
    }

    // Apply gravity
    player.activePet.velocityY += GRAVITY;

    // Horizontal movement toward target with slightly faster speed when chasing items
    const dx = targetX - player.activePet.x;
    const moveSpeed = chasingItem ? petInfo.followSpeed * 1.5 : petInfo.followSpeed;
    
    if (Math.abs(dx) > 5) {
        const moveX = Math.sign(dx) * Math.min(Math.abs(dx), moveSpeed);
        player.activePet.x += moveX;
        
        // Update facing direction based on movement
        if (moveX > 0) {
            player.activePet.facingLeft = false; // Moving right
        } else if (moveX < 0) {
            player.activePet.facingLeft = true; // Moving left
        }
    }

    // Apply vertical velocity
    player.activePet.y += player.activePet.velocityY;

    // Get map and ground level
    const map = maps[currentMapId];
    const groundLevel = (map.height || scalingContainer.clientHeight) - GAME_CONFIG.GROUND_Y;

    // Platform collision detection (with yOffset applied)
    let onPlatform = false;
    platforms.forEach(p => {
        if (p.isLadder || p.y === undefined) return;
        
        const petRect = {
            x: player.activePet.x,
            y: player.activePet.y,
            width: petInfo.width,
            height: petInfo.height
        };
        
        if (isColliding(petRect, p) && player.activePet.velocityY >= 0 && player.activePet.previousY + petInfo.height <= p.y) {
            player.activePet.y = p.y - petInfo.height;
            player.activePet.velocityY = 0;
            player.activePet.isJumping = false;
            onPlatform = true;
        }
    });

    // Ground collision detection with slope support
    const petCenterX = player.activePet.x + petInfo.width / 2;
    const slopeSurfaceY = getSlopeSurfaceY(petCenterX, map, groundLevel, 48);
    const petBottom = player.activePet.y + petInfo.height;
    const distanceToSlope = petBottom - slopeSurfaceY;
    // Snap to slope if close enough (above or below)
    if (!onPlatform && distanceToSlope >= -50 && distanceToSlope <= 100) {
        player.activePet.y = slopeSurfaceY - petInfo.height;
        player.activePet.velocityY = 0;
        player.activePet.isJumping = false;
    }

    // Jump if target is above pet (to follow up platforms/jumps or reach items)
    const verticalDistance = targetY - player.activePet.y;
    const horizontalDistance = Math.abs(targetX - player.activePet.x);
    
    // Jump if target is above and pet is moving towards it horizontally
    if (verticalDistance < -40 && horizontalDistance < 150 && !player.activePet.isJumping && player.activePet.velocityY === 0) {
        player.activePet.isJumping = true;
        player.activePet.velocityY = JUMP_FORCE * 0.9; // Slightly weaker jump than player
    }

    // Keep pet within map bounds
    player.activePet.x = Math.max(0, Math.min(player.activePet.x, map.width - petInfo.width));

    // Store previous Y for collision detection
    player.activePet.previousY = player.activePet.y;

    // Update animation
    player.activePet.animationTimer++;
    if (player.activePet.animationTimer > 12) {
        player.activePet.animationTimer = 0;
        const petSpriteData = spriteData[petInfo.spriteKey];
        if (petSpriteData) {
            player.activePet.animationFrame = (player.activePet.animationFrame + 1) % petSpriteData.animations.idle.length;
        }
    }
}

/**
 * Renders the pet on screen
 */
function renderPet() {
    if (!player.activePet || !player.activePet.type || !player.activePet.isSpawned || player.isDead) {
        // Remove pet element if it exists
        const existingPet = document.getElementById('player-pet');
        if (existingPet) {
            existingPet.remove();
        }
        // Remove pet nameplate if it exists
        const existingNameplate = document.getElementById('pet-nameplate');
        if (existingNameplate) {
            existingNameplate.remove();
        }
        return;
    }

    // Hide pet when player is on a ladder
    if (player.onLadder) {
        const existingPet = document.getElementById('player-pet');
        const existingNameplate = document.getElementById('pet-nameplate');
        if (existingPet) {
            existingPet.style.display = 'none';
        }
        if (existingNameplate) {
            existingNameplate.style.display = 'none';
        }
        return;
    }

    const petInfo = petData[player.activePet.type];
    if (!petInfo) return;

    // Ensure all required properties exist (safety check for loaded games)
    if (player.activePet.x === undefined) player.activePet.x = player.x - 60;
    if (player.activePet.y === undefined) player.activePet.y = player.y;
    if (player.activePet.animationFrame === undefined) player.activePet.animationFrame = 0;
    if (player.activePet.animationTimer === undefined) player.activePet.animationTimer = 0;

    const petSpriteData = spriteData[petInfo.spriteKey];
    
    // Create or get the cached pet image
    if (!player.activePet.imageElement) {
        player.activePet.imageElement = new Image();
        player.activePet.imageElement.src = artAssets[petInfo.spriteKey];
        // Force a re-render when the image loads
        player.activePet.imageElement.onload = () => {
            // Image is now loaded, rendering will work on next frame
        };
    }
    const petAsset = player.activePet.imageElement;

    // Don't render if sprite data is missing or image hasn't loaded yet
    if (!petSpriteData || !petAsset) return;
    if (!petAsset.complete) {
        // Image is still loading, try again next frame
        return;
    }

    // Get or create pet element
    let petElement = document.getElementById('player-pet');
    if (!petElement) {
        petElement = document.createElement('div');
        petElement.id = 'player-pet';
        petElement.style.position = 'absolute';
        petElement.style.pointerEvents = 'none';
        petElement.style.zIndex = '9'; // Behind player (10) and medals
        const worldContent = document.getElementById('world-content');
        if (worldContent) {
            worldContent.appendChild(petElement);
        }
    }

    // Make sure pet is visible (in case it was hidden on ladder)
    petElement.style.display = 'block';

    // Position pet element with yOffset applied for proper visual placement
    const petVisualY = player.activePet.y - (player.activePet.yOffset || 0);
    petElement.style.left = `${Math.round(player.activePet.x)}px`;
    petElement.style.top = `${Math.round(petVisualY)}px`;
    petElement.style.width = `${petInfo.width}px`;
    petElement.style.height = `${petInfo.height}px`;

    // Get or create canvas
    let canvas = petElement.querySelector('canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        const scale = 3;
        canvas.width = petSpriteData.frameWidth * scale;
        canvas.height = petSpriteData.frameHeight * scale;
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`;
        canvas.style.position = 'absolute';
        canvas.style.left = '0px';
        canvas.style.top = '0px';
        canvas.style.imageRendering = 'pixelated';
        petElement.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pet sprite
    const frame = petSpriteData.animations.idle[player.activePet.animationFrame % petSpriteData.animations.idle.length];

    ctx.save();
    
    // Flip pet based on facing direction
    if (player.activePet.facingLeft) {
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
    }

    ctx.drawImage(
        petAsset,
        frame.x, frame.y,
        petSpriteData.frameWidth, petSpriteData.frameHeight,
        0, 0,
        canvas.width, canvas.height
    );

    ctx.restore();
    
    // Render pet nameplate
    renderPetNameplate();
}

/**
 * Renders the pet nameplate above the pet
 */
function renderPetNameplate() {
    if (!player.activePet || !player.activePet.type || !player.activePet.isSpawned) {
        // Remove nameplate if exists
        const existingNameplate = document.getElementById('pet-nameplate');
        if (existingNameplate) {
            existingNameplate.remove();
        }
        return;
    }
    
    const petInfo = petData[player.activePet.type];
    if (!petInfo) return;
    
    // Get pet name (custom or default)
    const petName = (player.petNames && player.petNames[player.activePet.type]) || petInfo.displayName;
    
    // Get or create nameplate element
    let nameplate = document.getElementById('pet-nameplate');
    if (!nameplate) {
        nameplate = document.createElement('div');
        nameplate.id = 'pet-nameplate';
        nameplate.style.position = 'absolute';
        nameplate.style.color = 'white';
        nameplate.style.fontSize = 'var(--font-small)';
        nameplate.style.fontFamily = "'Ari9500'";
        nameplate.style.fontWeight = 'bold';
        nameplate.style.textShadow = '1px 1px 2px #000';
        nameplate.style.whiteSpace = 'nowrap';
        nameplate.style.padding = '2px 6px';
        nameplate.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        nameplate.style.borderRadius = '4px';
        nameplate.style.pointerEvents = 'none';
        nameplate.style.zIndex = '11'; // Above pet but same as player nameplate
        nameplate.style.transform = 'translateX(-50%)';
        
        const worldContent = document.getElementById('world-content');
        if (worldContent) {
            worldContent.appendChild(nameplate);
        }
    }
    
    // Make sure nameplate is visible (in case it was hidden on ladder)
    nameplate.style.display = 'block';
    
    // Update nameplate content and position
    nameplate.textContent = petName;
    
    // Position above pet
    const nameplateX = player.activePet.x + (petInfo.width / 2);
    const nameplateY = player.activePet.y - (player.activePet.yOffset || 0) - 15; // Above the pet
    
    nameplate.style.left = `${Math.round(nameplateX)}px`;
    nameplate.style.top = `${Math.round(nameplateY)}px`;
}