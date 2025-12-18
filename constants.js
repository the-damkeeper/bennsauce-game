// Game Constants - Centralized configuration
const GAME_CONFIG = {
    // Version
    VERSION: '0.853',
    
    // Performance
    TARGET_FPS: 100, // Target 100 FPS cap
    FRAME_TIME: 1000 / 100,
    
    // Base game dimensions - ALWAYS use these for physics calculations, not container size
    // This prevents exploits where players shrink their browser to bypass physics
    BASE_GAME_WIDTH: 1366,
    BASE_GAME_HEIGHT: 768,
    
    // Physics
    SCALE: 0.8,
    GRAVITY: 0.4, // Stronger gravity for less floaty feeling
    JUMP_FORCE: -8, // Stronger jump force to compensate
    GROUND_FRICTION: 0.85,
    AIR_FRICTION: 0.97,
    KNOCKBACK_FORCE: 2, // Stronger knockback
    LADDER_SPEED: 1.5,
    
    // Rendering
    PIXEL_ART_SCALE: 3,
    CAMERA_EASING: 0.1,
    LADDER_CENTER_EASING: 0.15,
    GROUND_Y: 281, // Shifted up 100px (was 181, now 281)
    GROUND_LEVEL_OFFSET: -100, // Offset to adjust map layouts for ground level change
    PLATFORM_EDGE_PADDING: 5,
    
    // UI
    NPC_INTERACTION_RANGE: 75,
    LOOT_RANGE: 50,
    
    // Game Balance
    DROP_RATE_MODIFIER: 0.4,
    EXP_RATE: 1.0,
    
    // EXP Curve - Single source of truth for all characters
    // Higher base and growth rate for slower, more meaningful progression
    BASE_EXP: 100,           // EXP needed for level 1 -> 2
    EXP_GROWTH_RATE: 1.25,   // 25% increase per level (compounds to ~70k at level 25)
    
    HP_REGEN_INTERVAL: 6000,
    HP_REGEN_AMOUNT: 4,
    MP_REGEN_INTERVAL: 3000,
    MP_REGEN_AMOUNT: 2,
    RESPAWN_TIME: 2000,
    
    // Audio
    DEFAULT_SFX_VOLUME: 0.5,
    DEFAULT_BGM_VOLUME: 0.3,
    
    // Save System
    AUTO_SAVE_INTERVAL: 60000, // 60 seconds
    SAVE_KEY_PREFIX: 'bennSauce_',
    
    // Input
    KEY_REPEAT_DELAY: 50, // Reduced from 150ms for more responsive non-movement keys
    
    // Animation
    DEFAULT_ANIMATION_SPEED: 12,
    BLINK_INTERVAL_MIN: 180,
    BLINK_INTERVAL_MAX: 480,
    BLINK_DURATION: 8
};

// Legacy constant aliases for backward compatibility
// These reference GAME_CONFIG values to avoid duplication
const SCALE = GAME_CONFIG.SCALE;
const PIXEL_ART_SCALE = GAME_CONFIG.PIXEL_ART_SCALE;
const CAMERA_EASING = GAME_CONFIG.CAMERA_EASING;
const GRAVITY = GAME_CONFIG.GRAVITY;
const JUMP_FORCE = GAME_CONFIG.JUMP_FORCE;
const KNOCKBACK_FORCE = GAME_CONFIG.KNOCKBACK_FORCE;
const TARGET_FPS = GAME_CONFIG.TARGET_FPS;
const GROUND_Y = GAME_CONFIG.GROUND_Y;
const GROUND_LEVEL_OFFSET = GAME_CONFIG.GROUND_LEVEL_OFFSET;
const PLATFORM_EDGE_PADDING = GAME_CONFIG.PLATFORM_EDGE_PADDING;
const MP_REGEN_INTERVAL = GAME_CONFIG.MP_REGEN_INTERVAL;
const MP_REGEN_AMOUNT = GAME_CONFIG.MP_REGEN_AMOUNT;
const HP_REGEN_INTERVAL = GAME_CONFIG.HP_REGEN_INTERVAL;
const HP_REGEN_AMOUNT = GAME_CONFIG.HP_REGEN_AMOUNT;
const NPC_INTERACTION_RANGE = GAME_CONFIG.NPC_INTERACTION_RANGE;
const RESPAWN_TIME = GAME_CONFIG.RESPAWN_TIME;
const DROP_RATE_MODIFIER = GAME_CONFIG.DROP_RATE_MODIFIER;

// ============================================
// GUILD SYSTEM CONSTANTS
// ============================================
const GUILD_CREATION_COST = 100000;
const GUILD_MAX_MEMBERS = 50;

// Guild Roles with permissions
const GUILD_ROLES = {
    master: {
        name: 'Guild Master',
        icon: '👑',
        permissions: ['invite', 'kick', 'manage_roles', 'manage_guild'],
        priority: 1
    },
    officer: {
        name: 'Officer',
        icon: '⚔️',
        permissions: ['invite', 'kick', 'manage_roles'],
        priority: 2
    },
    veteran: {
        name: 'Veteran',
        icon: '⭐',
        permissions: ['invite'],
        priority: 3
    },
    member: {
        name: 'Member',
        icon: '🛡️',
        permissions: [],
        priority: 4
    },
    recruit: {
        name: 'Recruit',
        icon: '🌱',
        permissions: [],
        priority: 5
    }
};

// Guild Buffs that can be unlocked
const GUILD_BUFFS = {
    expBoost1: { name: 'EXP Boost I', icon: '📚', description: '+2% EXP from monsters', effect: { type: 'exp', value: 0.02 }, cost: 50000, level: 1 },
    expBoost2: { name: 'EXP Boost II', icon: '📚', description: '+5% EXP from monsters', effect: { type: 'exp', value: 0.05 }, cost: 150000, level: 2, requires: 'expBoost1' },
    expBoost3: { name: 'EXP Boost III', icon: '📚', description: '+10% EXP from monsters', effect: { type: 'exp', value: 0.10 }, cost: 500000, level: 3, requires: 'expBoost2' },
    goldBoost1: { name: 'Gold Boost I', icon: '💰', description: '+5% Gold from monsters', effect: { type: 'gold', value: 0.05 }, cost: 50000, level: 1 },
    goldBoost2: { name: 'Gold Boost II', icon: '💰', description: '+10% Gold from monsters', effect: { type: 'gold', value: 0.10 }, cost: 150000, level: 2, requires: 'goldBoost1' },
    goldBoost3: { name: 'Gold Boost III', icon: '💰', description: '+20% Gold from monsters', effect: { type: 'gold', value: 0.20 }, cost: 500000, level: 3, requires: 'goldBoost2' },
    dropBoost1: { name: 'Drop Rate I', icon: '🎁', description: '+5% Drop Rate', effect: { type: 'drop', value: 0.05 }, cost: 100000, level: 1 },
    dropBoost2: { name: 'Drop Rate II', icon: '🎁', description: '+10% Drop Rate', effect: { type: 'drop', value: 0.10 }, cost: 300000, level: 2, requires: 'dropBoost1' }
};

// Rescue System Constants
const RESCUE_RANGE = 100; // Pixels within which a player can be rescued
const RESCUE_TIME = 3000; // Time in ms to complete rescue
const RESCUE_EXP_BONUS = 500; // Bonus EXP for rescuing a player
const RESCUE_WINDOW = 10000; // Time in ms player can be rescued after death

// World Boss Constants
const WORLD_BOSS_SPAWN_INTERVAL = 3600000; // 1 hour between world boss spawns
const WORLD_BOSS_DURATION = 600000; // 10 minutes to defeat boss
const WORLD_BOSS_MIN_DAMAGE_PERCENT = 0.5; // Must deal 0.5% damage to get rewards

// Export for ES6 modules (if needed later)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GAME_CONFIG;
}