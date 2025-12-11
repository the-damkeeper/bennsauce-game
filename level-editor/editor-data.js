/**
 * BennSauce Level Editor - Data Module
 * Data definitions that match the actual game data.js
 * 
 * IMPORTANT: Names and structures MUST match data.js exactly
 * 
 * This file loads assets from the parent data.js file
 */

// Sprite data for ground tiles (matches spriteData.ground in data.js)
const SPRITE_DATA = {
    ground: {
        sheetWidth: 144,
        sheetHeight: 112,
        tileSize: 16,
        tiles: {
            platformGrassLeft: { x: 0, y: 0 },
            platformGrassCenter: { x: 16, y: 0 },
            platformGrassRight: { x: 32, y: 0 },
            groundGrass: { x: 48, y: 0 },
            backgroundGrass: { x: 64, y: 0 },
            slopeGrass: { x: 112, y: 0 },
            slopeGrassEdge: { x: 128, y: 0 },

            platformDirtLeft: { x: 0, y: 16 },
            platformDirtCenter: { x: 16, y: 16 },
            platformDirtRight: { x: 32, y: 16 },
            groundDirt: { x: 48, y: 16 },
            backgroundDirt: { x: 64, y: 16 },
            slopeDirt: { x: 112, y: 16 },
            slopeDirtEdge: { x: 128, y: 16 },

            platformStoneLeft: { x: 0, y: 32 },
            platformStoneCenter: { x: 16, y: 32 },
            platformStoneRight: { x: 32, y: 32 },
            groundStone: { x: 48, y: 32 },
            backgroundStone: { x: 64, y: 32 },
            slopeStone: { x: 112, y: 32 },
            slopeStoneEdge: { x: 128, y: 32 },

            platformMossLeft: { x: 0, y: 48 },
            platformMossCenter: { x: 16, y: 48 },
            platformMossRight: { x: 32, y: 48 },
            groundMoss: { x: 48, y: 48 },
            backgroundMoss: { x: 64, y: 48 },
            slopeMoss: { x: 112, y: 48 },
            slopeMossEdge: { x: 128, y: 48 },

            platformSnowLeft: { x: 0, y: 64 },
            platformSnowCenter: { x: 16, y: 64 },
            platformSnowRight: { x: 32, y: 64 },
            groundSnow: { x: 48, y: 64 },
            backgroundSnow: { x: 64, y: 64 },
            slopeSnow: { x: 112, y: 64 },
            slopeSnowEdge: { x: 128, y: 64 },

            platformBrickLeft: { x: 0, y: 80 },
            platformBrickCenter: { x: 16, y: 80 },
            platformBrickRight: { x: 32, y: 80 },
            groundBrick: { x: 48, y: 80 },
            backgroundBrick: { x: 64, y: 80 },
            slopeBrick: { x: 112, y: 80 },
            slopeBrickEdge: { x: 128, y: 80 },

            platformDarkBrickLeft: { x: 0, y: 96 },
            platformDarkBrickCenter: { x: 16, y: 96 },
            platformDarkBrickRight: { x: 32, y: 96 },
            groundDarkBrick: { x: 48, y: 96 },
            backgroundDarkBrick: { x: 64, y: 96 },
            slopeDarkBrick: { x: 112, y: 96 },
            slopeDarkBrickEdge: { x: 128, y: 96 }
        }
    }
};

// Tile sets for each ground type (matches tileSets in data.js)
const TILE_SETS = {
    grass: {
        platformLeft: SPRITE_DATA.ground.tiles.platformGrassLeft,
        platformCenter: SPRITE_DATA.ground.tiles.platformGrassCenter,
        platformRight: SPRITE_DATA.ground.tiles.platformGrassRight,
        ground: SPRITE_DATA.ground.tiles.groundGrass,
        background: SPRITE_DATA.ground.tiles.backgroundGrass,
        groundEdge: { x: 80, y: 0 },
        backgroundEdge: { x: 96, y: 0 },
        slope: SPRITE_DATA.ground.tiles.slopeGrass,
        slopeEdge: SPRITE_DATA.ground.tiles.slopeGrassEdge
    },
    dirt: {
        platformLeft: SPRITE_DATA.ground.tiles.platformDirtLeft,
        platformCenter: SPRITE_DATA.ground.tiles.platformDirtCenter,
        platformRight: SPRITE_DATA.ground.tiles.platformDirtRight,
        ground: SPRITE_DATA.ground.tiles.groundDirt,
        background: SPRITE_DATA.ground.tiles.backgroundDirt,
        groundEdge: { x: 80, y: 16 },
        backgroundEdge: { x: 96, y: 16 },
        slope: SPRITE_DATA.ground.tiles.slopeDirt,
        slopeEdge: SPRITE_DATA.ground.tiles.slopeDirtEdge
    },
    stone: {
        platformLeft: SPRITE_DATA.ground.tiles.platformStoneLeft,
        platformCenter: SPRITE_DATA.ground.tiles.platformStoneCenter,
        platformRight: SPRITE_DATA.ground.tiles.platformStoneRight,
        ground: SPRITE_DATA.ground.tiles.groundStone,
        background: SPRITE_DATA.ground.tiles.backgroundStone,
        groundEdge: { x: 80, y: 32 },
        backgroundEdge: { x: 96, y: 32 },
        slope: SPRITE_DATA.ground.tiles.slopeStone,
        slopeEdge: SPRITE_DATA.ground.tiles.slopeStoneEdge
    },
    moss: {
        platformLeft: SPRITE_DATA.ground.tiles.platformMossLeft,
        platformCenter: SPRITE_DATA.ground.tiles.platformMossCenter,
        platformRight: SPRITE_DATA.ground.tiles.platformMossRight,
        ground: SPRITE_DATA.ground.tiles.groundMoss,
        background: SPRITE_DATA.ground.tiles.backgroundMoss,
        groundEdge: { x: 80, y: 48 },
        backgroundEdge: { x: 96, y: 48 },
        slope: SPRITE_DATA.ground.tiles.slopeMoss,
        slopeEdge: SPRITE_DATA.ground.tiles.slopeMossEdge
    },
    snow: {
        platformLeft: SPRITE_DATA.ground.tiles.platformSnowLeft,
        platformCenter: SPRITE_DATA.ground.tiles.platformSnowCenter,
        platformRight: SPRITE_DATA.ground.tiles.platformSnowRight,
        ground: SPRITE_DATA.ground.tiles.groundSnow,
        background: SPRITE_DATA.ground.tiles.backgroundSnow,
        groundEdge: { x: 80, y: 64 },
        backgroundEdge: { x: 96, y: 64 },
        slope: SPRITE_DATA.ground.tiles.slopeSnow,
        slopeEdge: SPRITE_DATA.ground.tiles.slopeSnowEdge
    },
    brick: {
        platformLeft: SPRITE_DATA.ground.tiles.platformBrickLeft,
        platformCenter: SPRITE_DATA.ground.tiles.platformBrickCenter,
        platformRight: SPRITE_DATA.ground.tiles.platformBrickRight,
        ground: SPRITE_DATA.ground.tiles.groundBrick,
        background: SPRITE_DATA.ground.tiles.backgroundBrick,
        groundEdge: { x: 80, y: 80 },
        backgroundEdge: { x: 96, y: 80 },
        slope: SPRITE_DATA.ground.tiles.slopeBrick,
        slopeEdge: SPRITE_DATA.ground.tiles.slopeBrickEdge
    },
    darkBrick: {
        platformLeft: SPRITE_DATA.ground.tiles.platformDarkBrickLeft,
        platformCenter: SPRITE_DATA.ground.tiles.platformDarkBrickCenter,
        platformRight: SPRITE_DATA.ground.tiles.platformDarkBrickRight,
        ground: SPRITE_DATA.ground.tiles.groundDarkBrick,
        background: SPRITE_DATA.ground.tiles.backgroundDarkBrick,
        groundEdge: { x: 80, y: 96 },
        backgroundEdge: { x: 96, y: 96 },
        slope: SPRITE_DATA.ground.tiles.slopeDarkBrick,
        slopeEdge: SPRITE_DATA.ground.tiles.slopeDarkBrickEdge
    }
};

// Monster types - extracted directly from data.js monsterTypes
const MONSTER_TYPES = {
    // Main game monsters (Dewdrop Island)
    snail: { name: 'Snail', level: 1, width: 48, height: 48 },
    blueSnail: { name: 'Blue Snail', level: 2, width: 48, height: 48 },
    redSnail: { name: 'Red Snail', level: 3, width: 48, height: 48 },
    babySlime: { name: 'Baby Slime', level: 4, width: 48, height: 48 },
    babyRedSlime: { name: 'Baby Red Slime', level: 5, width: 48, height: 48 },
    babyBlueSlime: { name: 'Baby Blue Slime', level: 6, width: 48, height: 48 },
    slime: { name: 'Slime', level: 10, width: 48, height: 48 },
    redSlime: { name: 'Red Slime', level: 8, width: 48, height: 48 },
    blueSlime: { name: 'Blue Slime', level: 12, width: 48, height: 48 },
    testDummy: { name: 'Test Dummy', level: 1, width: 126, height: 96 },
    orangeMushroom: { name: 'Orange Mushroom', level: 11, width: 48, height: 48 },
    stump: { name: 'Stump', level: 18, width: 48, height: 48 },
    darkStump: { name: 'Dark Stump', level: 20, width: 48, height: 48 },
    axeStump: { name: 'Axe Stump', level: 22, width: 48, height: 60 },
    // Mini-bosses
    mano: { name: 'Mano', level: 15, width: 144, height: 96, isMiniBoss: true },
    mushmom: { name: 'Mushmom', level: 23, width: 144, height: 144, isMiniBoss: true },
    stumpy: { name: 'Stumpy', level: 20, width: 40, height: 48, isMiniBoss: true },
    stoneGolem: { name: 'Stone Golem', level: 28, width: 80, height: 96, isMiniBoss: true },
    yeti: { name: 'Yeti', level: 30, width: 64, height: 64, isMiniBoss: true }
};

// NPC types - extracted from data.js npcData
const NPC_TYPES = {
    welcomeGuide: { name: 'Guide Sam' },
    trainerLily: { name: 'Trainer Lily' },
    chiefElder: { name: 'Chief Elder' },
    merchantTom: { name: 'Merchant Tom' },
    secretExplorer: { name: '??? Explorer' },
    captainBoris: { name: 'Captain Boris' },
    mayorStan: { name: 'Mayor Stan' },
    guildMaster: { name: 'Guild Master' },
    poeBlacksmith: { name: 'Poe the Blacksmith' },
    storageKeeper: { name: 'Storage Keeper' },
    chiefStan: { name: 'Chief Stan' }
};

// Ground types used in the game
const GROUND_TYPES = {
    grass: { name: 'Grass' },
    dirt: { name: 'Dirt' },
    stone: { name: 'Stone' },
    moss: { name: 'Moss' },
    snow: { name: 'Snow' },
    brick: { name: 'Brick' },
    darkBrick: { name: 'Dark Brick' }
};

// BGM tracks used in the game
const BGM_TRACKS = [
    { id: 'dewdropIsland', name: 'Dewdrop Island' },
    { id: 'ironHaven', name: 'Iron Haven' },
    { id: 'skyPalace', name: 'Sky Palace' }
];

// Default map template matching data.js structure
const DEFAULT_MAP_TEMPLATE = {
    width: 1366,
    height: 720,
    backgroundColor: '#87CEEB',
    bgm: 'dewdropIsland',
    groundType: 'grass',
    parallax: [],
    platforms: [],
    structures: [],
    ladders: [],
    portals: [],
    npcs: [],
    monsters: []
};

// Editor rendering colors (fallback when tileset not loaded)
const EDITOR_COLORS = {
    grid: 'rgba(255, 255, 255, 0.1)',
    gridMajor: 'rgba(255, 255, 255, 0.25)',
    selection: '#00ff00',
    selectionFill: 'rgba(0, 255, 0, 0.2)',
    platform: '#8B4513',
    platformNoSpawn: '#FF4444',
    structure: '#654321',
    portal: '#00BFFF',
    portalConnection: 'rgba(0, 191, 255, 0.4)',
    npc: '#FFD700',
    monster: '#FF6B6B',
    ladder: '#DAA520',
    ground: '#4CAF50'
};

// Default ground Y position (from game - typically map height - 120)
const DEFAULT_GROUND_Y = 600;

// Grid size (standard tile size used in game)
const GRID_SIZE = 48;

// Ground level offset (matches GAME_CONFIG.GROUND_LEVEL_OFFSET in constants.js)
// Map data stores positions BEFORE this offset is applied
// When rendering, the game adds this offset
const GROUND_LEVEL_OFFSET = -100;

// Platform height constant (from game rendering)
const PLATFORM_HEIGHT = 20;

// Structure height constant
const STRUCTURE_HEIGHT = 48;

// Portal dimensions (24x32 sprite * PIXEL_ART_SCALE)
const PORTAL_WIDTH = 72;  // 24 * 3
const PORTAL_HEIGHT = 96; // 32 * 3

// NPC dimensions (approximate)
const NPC_WIDTH = 48;
const NPC_HEIGHT = 96;

// Pixel art scale (matches PIXEL_ART_SCALE in game.js)
const PIXEL_ART_SCALE = 3;

// Ladder types (matches spriteData.ladder in data.js)
const LADDER_TYPES = {
    tiles: {
        name: 'Wood Ladder',
        top: { x: 0, y: 0 },
        middle: { x: 16, y: 0 },
        bottom: { x: 32, y: 0 }
    },
    pipe: {
        name: 'Pipe',
        top: { x: 0, y: 16 },
        middle: { x: 16, y: 16 },
        bottom: { x: 32, y: 16 }
    },
    yellow: {
        name: 'Yellow Ladder',
        top: { x: 0, y: 32 },
        middle: { x: 16, y: 32 },
        bottom: { x: 32, y: 32 }
    },
    purple: {
        name: 'Purple Ladder',
        top: { x: 0, y: 48 },
        middle: { x: 16, y: 48 },
        bottom: { x: 32, y: 48 }
    }
};

const LADDER_TILE_SIZE = 16;

// Tileset image - will be loaded from parent data.js
let tilesetImage = null;
let tilesetLoaded = false;
let ladderImage = null;
let ladderLoaded = false;
let portalImage = null;
let portalLoaded = false;

// Function to load the tileset from parent data.js
function loadTilesetFromGameData() {
    return new Promise((resolve, reject) => {
        // Try to load from parent directory's data.js
        const script = document.createElement('script');
        script.src = '../data.js';
        script.onload = () => {
            console.log('data.js script loaded');
            console.log('artAssets available:', typeof artAssets !== 'undefined');
            console.log('artAssets.ladder available:', typeof artAssets !== 'undefined' && !!artAssets.ladder);
            
            // After data.js loads, artAssets should be available
            if (typeof artAssets !== 'undefined' && artAssets.tileset) {
                tilesetImage = new Image();
                tilesetImage.onload = () => {
                    tilesetLoaded = true;
                    console.log('Tileset loaded successfully from game data');
                    
                    // Also load ladder image
                    if (artAssets.ladder) {
                        console.log('Loading ladder image from artAssets.ladder...');
                        ladderImage = new Image();
                        ladderImage.onload = () => {
                            ladderLoaded = true;
                            console.log('Ladder tileset loaded successfully, dimensions:', ladderImage.width, 'x', ladderImage.height);
                            loadPortalAndResolve(tilesetImage, ladderImage);
                        };
                        ladderImage.onerror = (err) => {
                            console.error('Failed to load ladder image:', err);
                            loadPortalAndResolve(tilesetImage, null);
                        };
                        ladderImage.src = artAssets.ladder;
                    } else {
                        console.warn('artAssets.ladder not found in data.js');
                        loadPortalAndResolve(tilesetImage, null);
                    }
                    
                    function loadPortalAndResolve(tileset, ladder) {
                        if (artAssets.portal) {
                            console.log('Loading portal image from artAssets.portal...');
                            portalImage = new Image();
                            portalImage.onload = () => {
                                portalLoaded = true;
                                console.log('Portal image loaded successfully, dimensions:', portalImage.width, 'x', portalImage.height);
                                resolve({ tileset, ladder, portal: portalImage });
                            };
                            portalImage.onerror = (err) => {
                                console.error('Failed to load portal image:', err);
                                resolve({ tileset, ladder, portal: null });
                            };
                            portalImage.src = artAssets.portal;
                        } else {
                            console.warn('artAssets.portal not found in data.js');
                            resolve({ tileset, ladder, portal: null });
                        }
                    }
                };
                tilesetImage.onerror = () => {
                    console.error('Failed to load tileset image');
                    reject(new Error('Failed to load tileset image'));
                };
                tilesetImage.src = artAssets.tileset;
            } else {
                console.warn('artAssets.tileset not found in data.js');
                reject(new Error('artAssets.tileset not found'));
            }
        };
        script.onerror = () => {
            console.error('Failed to load data.js');
            reject(new Error('Failed to load data.js'));
        };
        document.head.appendChild(script);
    });
}

// Export all data for use in other modules
window.EditorData = {
    SPRITE_DATA,
    TILE_SETS,
    MONSTER_TYPES,
    NPC_TYPES,
    GROUND_TYPES,
    BGM_TRACKS,
    LADDER_TYPES,
    LADDER_TILE_SIZE,
    DEFAULT_MAP_TEMPLATE,
    EDITOR_COLORS,
    DEFAULT_GROUND_Y,
    GRID_SIZE,
    GROUND_LEVEL_OFFSET,
    PLATFORM_HEIGHT,
    STRUCTURE_HEIGHT,
    PORTAL_WIDTH,
    PORTAL_HEIGHT,
    NPC_WIDTH,
    NPC_HEIGHT,
    PIXEL_ART_SCALE,
    loadTilesetFromGameData,
    getTilesetImage: () => tilesetImage,
    getLadderImage: () => ladderImage,
    getPortalImage: () => portalImage,
    isTilesetLoaded: () => tilesetLoaded,
    isLadderLoaded: () => ladderLoaded,
    isPortalLoaded: () => portalLoaded
};