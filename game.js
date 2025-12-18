// --- Prevent Browser Zoom ---
// Block Ctrl +/-, Ctrl + scroll wheel, and trackpad pinch zoom
document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('keydown', (e) => {
    // Prevent Ctrl/Cmd + Plus/Minus/0 (zoom shortcuts)
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
    }
}, { passive: false });

// Block ESC key in pre-game menus (CAPTURE PHASE - runs before all other listeners)
document.addEventListener('keydown', (e) => {
    if (!e.key) return;
    if (e.key.toLowerCase() === 'escape') {
        const startScreen = document.getElementById('start-screen');
        const charSelection = document.getElementById('character-selection-screen');
        const charCreation = document.getElementById('character-creation');
        
        const isInPreGameMenu = (startScreen && startScreen.style.display && startScreen.style.display !== 'none') ||
                               (charSelection && charSelection.style.display && charSelection.style.display !== 'none') ||
                               (charCreation && charCreation.style.display && charCreation.style.display !== 'none');
        
        if (isInPreGameMenu) {
            console.log('[ESC CAPTURE] Blocking ESC in pre-game menu');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }
}, true); // TRUE = capture phase (runs FIRST)

// --- Game State & Core Variables ---
let player = {};
let _lastValidPlayerState = null; // For anti-cheat validation

// BASE_GAME_WIDTH and BASE_GAME_HEIGHT are defined in GAME_CONFIG (constants.js)
// Use GAME_CONFIG.BASE_GAME_HEIGHT for physics calculations to prevent browser resize exploits

// Anti-cheat: Track player state changes and detect suspicious modifications

let _playerIntegrityCheck = {
    lastLevel: 1,
    lastGold: 0,
    lastExp: 0,
    lastCheckTime: 0,
    suspiciousChanges: 0
};

/**
 * Check for suspicious player stat changes that indicate cheating
 * Called periodically during gameplay
 */
function validatePlayerIntegrity() {
    if (!player || !player.name) return;
    
    const now = Date.now();
    const timeSinceLastCheck = now - _playerIntegrityCheck.lastCheckTime;
    
    // Only check every 5 seconds minimum
    if (timeSinceLastCheck < 5000) return;
    
    // Check for impossible level jumps (more than 5 levels in 5 seconds is suspicious)
    const levelJump = player.level - _playerIntegrityCheck.lastLevel;
    if (levelJump > 5 && timeSinceLastCheck < 30000) {
        console.warn('[Anti-Cheat] Suspicious level jump detected:', levelJump, 'levels in', timeSinceLastCheck/1000, 'seconds');
        _playerIntegrityCheck.suspiciousChanges++;
    }
    
    // Check for impossible gold gains (more than 1M gold in 5 seconds without selling)
    const goldGain = player.gold - _playerIntegrityCheck.lastGold;
    if (goldGain > 1000000 && timeSinceLastCheck < 30000) {
        console.warn('[Anti-Cheat] Suspicious gold gain detected:', goldGain, 'gold in', timeSinceLastCheck/1000, 'seconds');
        _playerIntegrityCheck.suspiciousChanges++;
    }
    
    // Check for negative values (should never happen)
    if (player.level < 1 || player.gold < 0 || player.exp < 0) {
        console.warn('[Anti-Cheat] Invalid negative stat values detected');
        _playerIntegrityCheck.suspiciousChanges++;
        // Attempt to fix
        player.level = Math.max(1, player.level);
        player.gold = Math.max(0, player.gold);
        player.exp = Math.max(0, player.exp);
    }
    
    // Update tracking
    _playerIntegrityCheck.lastLevel = player.level;
    _playerIntegrityCheck.lastGold = player.gold;
    _playerIntegrityCheck.lastExp = player.exp;
    _playerIntegrityCheck.lastCheckTime = now;
    
    // If too many suspicious changes, could flag the account
    if (_playerIntegrityCheck.suspiciousChanges >= 5) {
        console.error('[Anti-Cheat] Multiple suspicious activities detected. Account may be flagged.');
        // You could add: disable ranking submission, add flag to cloud save, etc.
    }
}

let monsters = [];
const foliageSheetImage = new Image();
const ladderSheetImage = new Image();
const dropIconsSheetImage = new Image();
const playerEquipmentSheet = new Image();
const hairTintCanvas = document.createElement('canvas');
const hairTintCtx = hairTintCanvas.getContext('2d', { willReadFrequently: true });
window.playerEquipmentSheet = playerEquipmentSheet; // Make it globally accessible
let npcs = [];
let droppedItems = [];
let activeAttacks = [];
let projectiles = [];
let nextProjectileId = 1; // Unique ID counter for projectile multiplayer sync
let portals = [];
let platforms = [];
let monsterSpawners = [];
let parallaxBgs = [];
let sceneryObjects = [];
let clouds = [];

let keys = {}; // Object to track currently pressed keys
let currentMapId = 'ironHaven';
let gameLoopId;
let isGameActive = false;

// Attack holding system
let isHoldingAttack = false;
let lastHeldAttackTime = 0;
const HELD_ATTACK_DELAY = 500; // 500ms between held attacks (matches player.attackCooldown)
let worldState = {}; // To save state of maps when player leaves them
let lastSaveTime = 0;
const AUTO_SAVE_INTERVAL = 60000; // 60 seconds

let showHitboxes = false;
let slopeHitboxes = [];
let cameraX = 0;
let cameraY = 0;
let isChatting = false;
let currentChatChannel = 'map'; // 'map', 'global', 'buddy', 'guild', 'party'

let isGmMode = { infiniteStats: false };

let actions = {};

let lastClockUpdateTime = 0;

// --- DOM Element References ---
// These need to be declared globally within the game's scope
let gameContainer, scalingContainer, worldContent, playerElement, uiContainer, groundElement;
let portalChargeBarContainer, portalChargeBarFill, groundCanvas, platformCanvas, notificationContainer,
    levelUpNotificationContainer, globalNotificationContainer, buffContainer;

// UI Window Elements (now all declared here)
let characterSelectionScreen, characterCreationScreen, inventoryElement, equipmentElement,
    skillTreeElement, statWindowElement, questLogElement, dialogueWindowElement,
    shopWindowElement, settingsMenu, achievementWindow, bestiaryWindow, rankingsWindow, worldMapWindow, enhanceItemBtn,
    inventoryTrashBtn, minimapContainer, mapNameElement, minimap, enhancementConfirmModal, petWindow, socialHubWindow;

// Initialize DOM references when DOM is ready
function initializeDOMReferences() {
    gameContainer = document.getElementById('game-container');
    scalingContainer = document.getElementById('scaling-container');
    worldContent = document.getElementById('world-content');
    playerElement = document.getElementById('player');
    uiContainer = document.getElementById('ui-container');
    groundElement = document.querySelector('.ground');
    groundCanvas = document.getElementById('ground-canvas');
    platformCanvas = document.getElementById('platforms-canvas');
    notificationContainer = document.getElementById('notification-container');
    levelUpNotificationContainer = document.getElementById('level-up-notifications');
    globalNotificationContainer = document.getElementById('global-notifications');
    buffContainer = document.getElementById('buff-container');
    minimapContainer = document.getElementById('minimap-container');
    mapNameElement = document.getElementById('map-name');
    minimap = document.getElementById('minimap');
    
    // UI Windows
    characterSelectionScreen = document.getElementById('character-selection-screen');
    characterCreationScreen = document.getElementById('character-creation');
    inventoryElement = document.getElementById('inventory');
    equipmentElement = document.getElementById('equipment');
    skillTreeElement = document.getElementById('skill-tree');
    statWindowElement = document.getElementById('stat-window');
    questLogElement = document.getElementById('quest-log');
    dialogueWindowElement = document.getElementById('dialogue-window');
    shopWindowElement = document.getElementById('shop-window');
    settingsMenu = document.getElementById('settings-menu');
    achievementWindow = document.getElementById('achievement-window');
    bestiaryWindow = document.getElementById('bestiary-window');
    rankingsWindow = document.getElementById('rankings-window');
    worldMapWindow = document.getElementById('world-map-window');
    petWindow = document.getElementById('pet-window');
    socialHubWindow = document.getElementById('social-hub-window');
    enhancementConfirmModal = document.getElementById('enhancement-confirm-modal');
    enhanceItemBtn = document.getElementById('enhance-item-btn');
    inventoryTrashBtn = document.getElementById('inventory-trash-btn');
}
// --- Game Initialization & State Management ---

// --- Loading Manager ---
let loadingManager = {
    assetsToLoad: 0,
    assetsLoaded: 0,
    isReady: false,
    
    addAsset() {
        this.assetsToLoad++;
    },
    
    assetLoaded() {
        this.assetsLoaded++;
        this.updateLoadingText();
        if (this.assetsLoaded >= this.assetsToLoad) {
            this.finishLoading();
        }
    },
    
    updateLoadingText() {
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            const percentage = Math.round((this.assetsLoaded / this.assetsToLoad) * 100);
            if (percentage < 100) {
                loadingText.textContent = `Loading assets... ${this.assetsLoaded}/${this.assetsToLoad} (${percentage}%)`;
            } else {
                loadingText.textContent = 'Loading complete!';
            }
        }
    },
    
    finishLoading() {
        this.isReady = true;

        generateAllFoliage();

        // Wait for server connection before showing start screen
        this.waitForServer();
    },
    
    waitForServer() {
        const loadingText = document.getElementById('loading-text');
        const serverStatusText = document.getElementById('server-status-text');
        
        if (loadingText) {
            loadingText.textContent = 'Waiting for server connection...';
        }
        
        const startTime = Date.now();
        const maxWaitTime = 90000; // 90 seconds max wait (server wake-up can take 60s)
        
        // Check if socket is connected
        const checkConnection = () => {
            const elapsed = Date.now() - startTime;
            
            if (typeof isConnectedToServer !== 'undefined' && isConnectedToServer) {
                // Connected! Show start screen
                setTimeout(() => {
                    const loadingScreen = document.getElementById('loading-screen');
                    const startScreen = document.getElementById('start-screen');
                    const settingsMenu = document.getElementById('settings-menu');
                    if (loadingScreen && startScreen) {
                        loadingScreen.style.display = 'none';
                        startScreen.style.display = 'flex';
                        if (settingsMenu) settingsMenu.style.display = 'none';
                    }
                }, 500);
            } else if (elapsed > maxWaitTime) {
                // Timeout - server didn't respond in time
                if (loadingText) {
                    loadingText.textContent = 'Connection timeout';
                }
                if (serverStatusText) {
                    serverStatusText.textContent = '❌ Server did not respond. It may be offline or overloaded. Please refresh to try again.';
                    serverStatusText.style.color = '#e74c3c';
                }
            } else {
                // Still waiting, check again
                setTimeout(checkConnection, 100);
            }
        };
        
        checkConnection();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all DOM references first
    initializeDOMReferences();
    
    // Set up animated title cards
    const loadingTitleCard = document.getElementById('loading-title-card');
    const startTitleCard = document.getElementById('start-title-card');
    
    // Initialize title card animation
    let titleCardFrame = 0;
    let titleCardTimer = 0;
    const TITLE_CARD_ANIMATION_SPEED = 8; // Frames per animation frame
    
    function updateTitleCardAnimation() {
        if (!artAssets || !artAssets.titleCard || !spriteData.titleCard) return;
        
        titleCardTimer++;
        if (titleCardTimer >= TITLE_CARD_ANIMATION_SPEED) {
            titleCardTimer = 0;
            titleCardFrame = (titleCardFrame + 1) % spriteData.titleCard.animations.display.length;
            
            // Create a canvas to render the current frame
            const frameData = spriteData.titleCard.animations.display[titleCardFrame];
            const canvas = document.createElement('canvas');
            canvas.width = spriteData.titleCard.frameWidth;
            canvas.height = spriteData.titleCard.frameHeight;
            const ctx = canvas.getContext('2d');
            
            const img = new Image();
            img.src = artAssets.titleCard;
            img.onload = () => {
                ctx.drawImage(
                    img,
                    frameData.x, frameData.y,
                    spriteData.titleCard.frameWidth, spriteData.titleCard.frameHeight,
                    0, 0,
                    spriteData.titleCard.frameWidth, spriteData.titleCard.frameHeight
                );
                
                const frameDataUrl = canvas.toDataURL();
                if (loadingTitleCard) loadingTitleCard.src = frameDataUrl;
                if (startTitleCard) startTitleCard.src = frameDataUrl;
            };
        }
        
        requestAnimationFrame(updateTitleCardAnimation);
    }
    
    // Start the animation
    if (artAssets && artAssets.titleCard && spriteData.titleCard) {
        updateTitleCardAnimation();
    }
    
    // Set up chat input listener for channel switching with space
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('input', (e) => {
            const value = chatInput.value.toLowerCase();
            const chatChannelIndicator = document.getElementById('chat-channel-indicator');
            
            // Check for channel switch commands followed by space
            if (value === '/s ' || value === '/s') {
                if (value.endsWith(' ')) {
                    currentChatChannel = 'global';
                    if (chatChannelIndicator) {
                        chatChannelIndicator.textContent = '[Global]';
                        chatChannelIndicator.dataset.channel = 'global';
                    }
                    chatInput.value = '';
                    addChatMessage('Switched to Global chat.', 'system');
                }
            } else if (value === '/b ' || value === '/b') {
                if (value.endsWith(' ')) {
                    currentChatChannel = 'buddy';
                    if (chatChannelIndicator) {
                        chatChannelIndicator.textContent = '[Buddy]';
                        chatChannelIndicator.dataset.channel = 'buddy';
                    }
                    chatInput.value = '';
                    addChatMessage('Switched to Buddy chat.', 'system');
                }
            } else if (value === '/g ' || value === '/g') {
                if (value.endsWith(' ')) {
                    currentChatChannel = 'guild';
                    if (chatChannelIndicator) {
                        chatChannelIndicator.textContent = '[Guild]';
                        chatChannelIndicator.dataset.channel = 'guild';
                    }
                    chatInput.value = '';
                    addChatMessage('Switched to Guild chat.', 'system');
                }
            } else if (value === '/p ' || value === '/p') {
                if (value.endsWith(' ')) {
                    currentChatChannel = 'party';
                    if (chatChannelIndicator) {
                        chatChannelIndicator.textContent = '[Party]';
                        chatChannelIndicator.dataset.channel = 'party';
                    }
                    chatInput.value = '';
                    addChatMessage('Switched to Party chat.', 'system');
                }
            }
        });
    }
    
    // Create and append portal charge bar elements
    portalChargeBarContainer = document.createElement('div');
    portalChargeBarContainer.id = 'portal-charge-bar-container';
    portalChargeBarFill = document.createElement('div');
    portalChargeBarFill.id = 'portal-charge-bar-fill';

    // Use the properly initialized playerElement
    if (playerElement) {
        playerElement.appendChild(portalChargeBarContainer);
    }
    portalChargeBarContainer.appendChild(portalChargeBarFill);
    
    // Initialize Rankings window
    if (typeof initializeRankingsWindow === 'function') {
        initializeRankingsWindow();
    }
    
    // Start loading process
    initializeAssetLoading();
    
    // Initialize responsive scaling
    initializeResponsiveScaling();
    
    // Initialize enhanced window management
    enhanceFullscreenExperience();
});

// --- Responsive Scaling System ---
function initializeResponsiveScaling() {
    const gameContainer = document.getElementById('game-container');
    const scalingContainer = document.getElementById('scaling-container');

    if (!gameContainer || !scalingContainer) return;

    // Target game dimensions (design resolution)
    const TARGET_WIDTH = 1366;
    const TARGET_HEIGHT = 768;
    const TARGET_ASPECT = TARGET_WIDTH / TARGET_HEIGHT;

    function updateGameScale() {
        const containerWidth = gameContainer.clientWidth;
        const containerHeight = gameContainer.clientHeight;

        // Account for padding that reduces available space
        const availableWidth = containerWidth;
        const availableHeight = containerHeight - 40; // 20px top + 20px bottom padding

        // Always maintain aspect ratio by using the smaller scale factor
        const scaleByWidth = availableWidth / TARGET_WIDTH;
        const scaleByHeight = availableHeight / TARGET_HEIGHT;
        const scale = Math.min(scaleByWidth, scaleByHeight);

        // Apply the transform
        scalingContainer.style.transform = `scale(${scale})`;

        // Store scale for other systems that might need it
        window.gameScale = scale;

        // Update any UI elements that need to know about the scale
        if (typeof updateUIScale === 'function') {
            updateUIScale(scale);
        }

        // Update debug display
        updateScaleDebug(containerWidth, containerHeight, availableWidth, availableHeight, scaleByWidth, scaleByHeight, scale);

        console.log(`Game scaled to ${(scale * 100).toFixed(1)}%`);
    }

    // Create debug overlay
    function createScaleDebug() {
        const debugDiv = document.createElement('div');
        debugDiv.id = 'scale-debug';
        debugDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #0f0;
            padding: 10px;
            font-family: monospace;
            font-size: var(--font-small);;
            z-index: 99999;
            border: 1px solid #0f0;
            border-radius: 4px;
            line-height: 1.4;
            display: none;
        `;
        document.body.appendChild(debugDiv);
        return debugDiv;
    }

    // Update debug display
    function updateScaleDebug(containerW, containerH, availW, availH, scaleW, scaleH, finalScale) {
        let debugDiv = document.getElementById('scale-debug');
        if (!debugDiv) {
            debugDiv = createScaleDebug();
        }
        
        const targetAspect = (TARGET_WIDTH / TARGET_HEIGHT).toFixed(3);
        const actualAspect = (availW / availH).toFixed(3);
        const scaledWidth = (TARGET_WIDTH * finalScale).toFixed(1);
        const scaledHeight = (TARGET_HEIGHT * finalScale).toFixed(1);
        
        debugDiv.innerHTML = `
            <strong>SCALE DEBUG</strong><br>
            Container: ${containerW}x${containerH}<br>
            Available: ${availW}x${availH}<br>
            Target: ${TARGET_WIDTH}x${TARGET_HEIGHT}<br>
            <br>
            Scale by Width: ${(scaleW * 100).toFixed(1)}%<br>
            Scale by Height: ${(scaleH * 100).toFixed(1)}%<br>
            <strong>Final Scale: ${(finalScale * 100).toFixed(1)}%</strong><br>
            <br>
            Scaled Size: ${scaledWidth}x${scaledHeight}<br>
            Target Aspect: ${targetAspect}<br>
            Actual Aspect: ${actualAspect}<br>
        `;
    }

    // Initial scale
    updateGameScale();

    // Handle window resize with debouncing
    let resizeTimeout;
    function handleResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateGameScale();
            // Call the notification repositioning function on resize
            if (typeof updateNotificationContainerPosition === 'function') {
                updateNotificationContainerPosition();
            }
        }, 100);
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
        setTimeout(updateGameScale, 500); // Wait for orientation to complete
    });

    // Store the update function globally for manual calls
    window.updateGameScale = updateGameScale;
}

// UI Scale Update Handler
function updateUIScale(scale) {
    // Adjust UI elements that need scaling consideration
    const windows = document.querySelectorAll('.window');
    const gameContainer = document.getElementById('game-container');
    
    if (!gameContainer) return;
    
    const containerRect = gameContainer.getBoundingClientRect();
    const scalingContainer = document.getElementById('scaling-container');
    const scalingRect = scalingContainer.getBoundingClientRect();
    
    // Calculate the effective game area
    const gameAreaLeft = (containerRect.width - scalingRect.width) / 2;
    const gameAreaTop = (containerRect.height - scalingRect.height) / 2;
    const gameAreaWidth = scalingRect.width;
    const gameAreaHeight = scalingRect.height;
    
    // Ensure windows stay within the visible game area
    windows.forEach(window => {
        if (window.style.display !== 'none') {
            const windowRect = window.getBoundingClientRect();
            const currentLeft = parseInt(window.style.left) || 0;
            const currentTop = parseInt(window.style.top) || 0;
            
            // Clamp window positions to stay within the scaled game area
            const maxLeft = gameAreaWidth - windowRect.width;
            const maxTop = gameAreaHeight - windowRect.height;
            
            const newLeft = Math.max(0, Math.min(currentLeft, maxLeft));
            const newTop = Math.max(0, Math.min(currentTop, maxTop));
            
            if (newLeft !== currentLeft || newTop !== currentTop) {
                window.style.left = newLeft + 'px';
                window.style.top = newTop + 'px';
            }
        }
    });
}

// Fullscreen Enhancement
function enhanceFullscreenExperience() {
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', () => {
        setTimeout(() => {
            if (window.updateGameScale) {
                window.updateGameScale();
            }
        }, 100);
    });
    
    // Add keyboard shortcut for fullscreen (F11 alternative)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F11' || (e.altKey && e.key === 'Enter')) {
            e.preventDefault();
            toggleFullscreen();
        }
    });
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log('Error attempting to enable fullscreen:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

function initializeAssetLoading() {
    // Create global tileset image reference
    window.tilesetImage = new Image();
    const tilesetImage = window.tilesetImage;
    
    // Track all image assets that need to load
    const imageAssets = [
        { img: foliageSheetImage, src: artAssets.groundFoliage, name: 'Ground Foliage' },
        { img: ladderSheetImage, src: artAssets.ladder, name: 'Ladder' },
        { img: dropIconsSheetImage, src: artAssets.dropIcons, name: 'Drop Icons' },
        { img: playerEquipmentSheet, src: artAssets.playerEquipmentSheet, name: 'Player Equipment' },
        { img: window.playerSheetImage, src: artAssets.playerSheet, name: 'Player Sprites' },
        { img: window.playerEyesSheet, src: artAssets.playerEyesSheet, name: 'Player Eyes' },
        { img: window.playerHairSheet, src: artAssets.playerHairSheet, name: 'Player Hair' },
        { img: tilesetImage, src: artAssets.tileset, name: 'Tileset' }
    ];
    
    // Add assets to loading manager
    imageAssets.forEach(asset => {
        if (!asset.img) {
            console.error(`Asset image object is undefined for: ${asset.name}`);
            return;
        }
        
        loadingManager.addAsset();
        
        asset.img.onload = () => {
            console.log(`Loaded: ${asset.name}`);
            loadingManager.assetLoaded();
        };
        
        asset.img.onerror = () => {
            console.error(`Failed to load: ${asset.name}`);
            loadingManager.assetLoaded(); // Still count as loaded to prevent hanging
        };
        
        // Start loading (only if not already loading)
        if (!asset.img.src || asset.img.src === window.location.href) {
            asset.img.src = asset.src;
        } else {
            // If already loaded or loading, just mark as complete
            if (asset.img.complete) {
                setTimeout(() => loadingManager.assetLoaded(), 1);
            }
        }
    });
    
    // Add a small delay to ensure DOM is fully ready
    loadingManager.addAsset();
    setTimeout(() => {
        loadingManager.assetLoaded();
    }, 100);
}

function startGame(isNewCharacter = false) {
    // CRITICAL: Set game active immediately to enable movement
    lastFrameTime = 0;
    accumulator = 0;
    isGameActive = true;
    console.log('Game activated immediately', isNewCharacter ? '(new character)' : '(existing character)');
    
    // Play enter game sound
    playSound('enterGame');

    const gameWorld = document.getElementById('game-world');
    const minimapContainer = document.getElementById('minimap-container');

    document.querySelectorAll('.window').forEach(win => win.style.display = 'none');
    gameWorld.style.display = 'block';
    
    // Enable virtual mouse for gamepad users now that game has loaded
    if (typeof gamepadManager !== 'undefined' && gamepadManager) {
        gamepadManager.enableVirtualMouse();
    }

    if (typeof initializePlayerStats === 'function') {
        initializePlayerStats();
    }

    // Reset transient player states for a clean start
    player.isDead = false;
    player.isJumping = false;
    player.isInvincible = false;
    player.isAttacking = false;
    player.isChanneling = false;
    player.isPlayingAttackAnimation = false;
    player.isChargingPortal = false;
    player.onLadder = false;
    player.isProne = false;
    player.isBlinking = false;
    player.blinkTimer = 240;
    player.blinkDurationTimer = 0;
    player.channelingSkill = null;
    player.activePortal = null;
    player.velocityX = 0;
    player.velocityY = 0;
    player.chatMessage = null;
    player.chatTimer = 0;
    player.animationState = 'idle';

    player.originalSpeed = 2;
    player.originalJumpForce = JUMP_FORCE; // Use constant from constants.js
    player.speed = player.originalSpeed;
    player.jumpForce = player.originalJumpForce;
    player.buffs = [];
    lastSaveTime = Date.now();

    document.getElementById('character-creation').style.display = 'none';
    document.getElementById('character-selection-screen').style.display = 'none';
    if (typeof cleanupCharacterPreviews === 'function') cleanupCharacterPreviews();

    // Ensure player position is initialized (will be properly set by loadMap)
    if (player.x === undefined) player.x = 400;
    if (player.y === undefined) player.y = 300;
    
    cameraX = player.x - (scalingContainer.clientWidth / 2);
    cameraY = player.y - (scalingContainer.clientHeight / 2);
    player.previousY = player.y;

    const playerElement = document.getElementById('player');
    playerElement.querySelector('.debug-hitbox')?.remove();
    const playerHitbox = document.createElement('div');
    playerHitbox.className = 'debug-hitbox';
    playerElement.appendChild(playerHitbox);
    player.hitboxElement = playerHitbox;

    player.velocityX = 0;
    player.velocityY = 0;
    player.isJumping = false;
    player.onLadder = false;
    player.isProne = false;
    player.ignorePlatformCollision = false;

    // Force clean pet elements on game start to ensure visibility
    if (player.activePet && player.activePet.isSpawned) {
        const existingPet = document.getElementById('player-pet');
        if (existingPet) {
            existingPet.remove();
        }
        const existingNameplate = document.getElementById('pet-nameplate');
        if (existingNameplate) {
            existingNameplate.remove();
        }
        // Clear cached image to force reload
        delete player.activePet.imageElement;
    }

    changeMap(player.currentMapId || 'ironHaven', player.x, player.y);

    updateUI();
    updateSkillHotbarUI();
    updateEquipmentUI();

    addChatMessage("Welcome to BennSauce v0.853!", 'system');
    
    // Initialize online presence tracking immediately (needed for party EXP on all maps including Dewdrop)
    if (typeof initializePresence === 'function') {
        initializePresence();
    }
    
    // Delay other Firebase listener initialization to reduce reads on login
    // These will start after 3 seconds to batch the initial loads
    setTimeout(() => {
        // Initialize global chat system
        if (typeof initializeGlobalChat === 'function') {
            initializeGlobalChat();
        }
        
        // Initialize buddy chat listener
        if (typeof initializeBuddyChat === 'function') {
            initializeBuddyChat();
        }
        
        // Initialize guild chat listener (if player is in a guild)
        if (typeof initializeGuildChat === 'function') {
            initializeGuildChat();
        }
        
        // Initialize party chat listener (if player is in a party)
        if (typeof initializePartyChat === 'function') {
            initializePartyChat();
        }
        
        // Initialize announcements system  
        if (typeof initializeAnnouncements === 'function') {
            initializeAnnouncements();
        }
        
        // Initialize global events system
        if (typeof initializeGlobalEvents === 'function') {
            initializeGlobalEvents();
        }
        
        // Initialize world boss event system
        if (typeof initWorldBossSystem === 'function') {
            initWorldBossSystem();
        }
        
        // Initialize server medals (founding player, beta tester, etc.)
        if (typeof initializeServerMedals === 'function') {
            initializeServerMedals();
        }
    }, 3000);
    
    // Initialize trade listener
    if (typeof initializeTradeListener === 'function') {
        initializeTradeListener();
    }
    
    // Initialize social hub window
    if (typeof initializeSocialHub === 'function') {
        initializeSocialHub();
    }
    
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoop();

    uiContainer.style.display = 'block';
    minimapContainer.style.display = 'block';
    
    // Rankings are now only updated on significant events (level up, achievements, etc.)
    // This reduces Firebase writes on every login
    
    // Start the elite monster event system
    if (typeof startEliteMonsterSystem === 'function') {
        startEliteMonsterSystem();
    }

    if (player.level >= 10 && player.class === 'beginner') {
        openJobAdvancementWindow(10);
    } else if (player.level >= 20 && (!player.petInventory || player.petInventory.length === 0)) {
        // Show pet selection window only for players who haven't selected a pet yet
        openPetSelectionWindow();
    } else if (player.level >= 30) {
        // Check if player is eligible for 2nd job advancement (still in 1st job class)
        const firstJobClasses = ['warrior', 'magician', 'bowman', 'thief', 'pirate'];
        if (firstJobClasses.includes(player.class)) {
            // Delay slightly to ensure UI is ready
            setTimeout(() => {
                openJobAdvancementWindow(30);
            }, 1000);
        }
    }

    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
}

// Performance tracking
let lastFrameTime = 0;
let deltaTime = 0;
let frameCount = 0;
let fpsDisplay = 0;
let accumulator = 0;

// Fixed timestep for consistent physics (100 FPS = 10ms per update)
const FIXED_TIMESTEP = 10; // milliseconds
const MAX_FRAME_TIME = 50; // Cap to prevent spiral of death
const TARGET_FPS = 60; // Target frame rate cap
const MIN_FRAME_TIME = 1000 / TARGET_FPS; // Minimum ms between frames (~16.67ms for 60 FPS)

/**
 * Spawns a hit squib VFX at the closest filled pixel on the monster sprite to the hit location
 */
function spawnHitSquibVFX(monster, attack, isCritical = false) {
    const monsterData = monsterTypes[monster.type];
    if (!monsterData || !monsterData.isPixelArt || !artAssets[monster.type]) {
        // World boss or non-pixel-art monsters don't have hit squibs
        return;
    }

    console.log('Spawning hit squib VFX for', monster.type, isCritical ? '(CRITICAL!)' : '');

    // Get monster's current sprite position
    const monsterCenterX = monster.x + (monster.width / 2);
    const monsterCenterY = monster.y + (monster.height / 2);

    // Determine hit location based on attack type
    let hitX, hitY;
    if (attack.x !== undefined && attack.y !== undefined) {
        // For projectiles, use projectile position
        hitX = attack.x;
        hitY = attack.y;
    } else {
        // For melee attacks, use player position relative to monster
        hitX = player.x + (player.width / 2);
        hitY = player.y + (player.height / 2);
    }

    const sData = spriteData[monster.type];
    if (!sData) {
        console.log('No sprite data for', monster.type);
        return;
    }

    // Create a temporary canvas to analyze the monster sprite
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    const img = new Image();
    img.src = artAssets[monster.type];

    // Use cached image if available from monster element
    const processVFX = () => {

        // Get current animation frame
        const currentAnim = monster.currentAnimation || 'idle';
        const frames = sData.animations[currentAnim];
        if (!frames || frames.length === 0) return;

        const frameIndex = monster.animationFrame || 0;
        const frame = frames[frameIndex];

        tempCanvas.width = sData.frameWidth;
        tempCanvas.height = sData.frameHeight;

        // Draw the current frame
        tempCtx.drawImage(
            img,
            frame.x, frame.y,
            sData.frameWidth, sData.frameHeight,
            0, 0,
            sData.frameWidth, sData.frameHeight
        );

        // Get pixel data
        const imageData = tempCtx.getImageData(0, 0, sData.frameWidth, sData.frameHeight);
        const pixels = imageData.data;

        // Calculate hit position relative to monster sprite (in sprite pixel coordinates)
        const relativeHitX = ((hitX - monster.x) / PIXEL_ART_SCALE);
        const relativeHitY = ((hitY - monster.y) / PIXEL_ART_SCALE);

        // Find closest filled pixel (alpha > 0) to the hit location
        let closestDistance = Infinity;
        let closestX = relativeHitX;
        let closestY = relativeHitY;

        for (let y = 0; y < sData.frameHeight; y++) {
            for (let x = 0; x < sData.frameWidth; x++) {
                const pixelIndex = (y * sData.frameWidth + x) * 4;
                const alpha = pixels[pixelIndex + 3];

                if (alpha > 0) { // Pixel is not transparent
                    const distance = Math.sqrt(
                        Math.pow(x - relativeHitX, 2) + 
                        Math.pow(y - relativeHitY, 2)
                    );

                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestX = x;
                        closestY = y;
                    }
                }
            }
        }

        // Convert back to world coordinates
        const vfxX = monster.x + (closestX * PIXEL_ART_SCALE);
        const vfxY = monster.y + (closestY * PIXEL_ART_SCALE);

        // Spawn the hitsquib VFX at the closest filled pixel
        const vfxData = spriteData.hitsquibVFX;
        if (!vfxData || !vfxData.anchorPoint) return; // Safety check
        const vfxEl = document.createElement('div');
        vfxEl.className = 'hitsquib-vfx pixel-art';
        vfxEl.style.position = 'absolute';
        vfxEl.style.width = `${vfxData.frameWidth * PIXEL_ART_SCALE}px`;
        vfxEl.style.height = `${vfxData.frameHeight * PIXEL_ART_SCALE}px`;
        vfxEl.style.backgroundImage = `url(${artAssets.hitsquibVFX})`;
        vfxEl.style.backgroundSize = `${vfxData.frameWidth * vfxData.animations.play.length * PIXEL_ART_SCALE}px ${vfxData.frameHeight * PIXEL_ART_SCALE}px`;
        vfxEl.style.backgroundRepeat = 'no-repeat';
        vfxEl.style.zIndex = '15';
        vfxEl.style.pointerEvents = 'none';
        
        // Apply red tint for critical hits
        if (isCritical) {
            vfxEl.style.filter = 'hue-rotate(200deg) saturate(2) brightness(1.3)';
        }
        
        // Random flipping for variety
        const flipX = Math.random() > 0.5 ? -1 : 1;
        const flipY = Math.random() > 0.5 ? -1 : 1;
        vfxEl.style.transform = `scale(${flipX}, ${flipY})`;
        vfxEl.style.transformOrigin = 'center';
        
        // Center the VFX on the hit point
        vfxEl.style.left = `${vfxX - (vfxData.anchorPoint.x * PIXEL_ART_SCALE)}px`;
        vfxEl.style.top = `${vfxY - (vfxData.anchorPoint.y * PIXEL_ART_SCALE)}px`;

        worldContent.appendChild(vfxEl);

        // Animate the VFX
        let vfxFrameIndex = 0;
        const animate = setInterval(() => {
            if (vfxFrameIndex >= vfxData.animations.play.length) {
                clearInterval(animate);
                vfxEl.remove();
                return;
            }

            const frame = vfxData.animations.play[vfxFrameIndex];
            vfxEl.style.backgroundPosition = `-${frame.x * PIXEL_ART_SCALE}px -${frame.y * PIXEL_ART_SCALE}px`;
            vfxFrameIndex++;
        }, 50); // ~20fps animation
    };
    
    // Try to use the image immediately if it's already loaded, otherwise wait
    if (img.complete) {
        processVFX();
    } else {
        img.onload = processVFX;
    }
}

/**
 * The main game loop, called every frame via requestAnimationFrame.
 * This function orchestrates all the update and render calls.
 * FPS is capped to ensure consistent game speed across all monitor refresh rates.
 */
function gameLoop(currentTime = 0) {
    // Schedule next frame first
    gameLoopId = requestAnimationFrame(gameLoop);
    
    // Calculate time since last frame
    deltaTime = currentTime - lastFrameTime;
    
    // FPS CAP: Skip this frame if not enough time has passed
    // This ensures the game runs at the same speed on 60Hz, 144Hz, and 240Hz monitors
    if (deltaTime < MIN_FRAME_TIME) {
        return; // Skip this frame, wait for next requestAnimationFrame
    }

    // Cap frame time to prevent huge jumps (e.g., when tab was inactive)
    if (deltaTime > MAX_FRAME_TIME) {
        deltaTime = MAX_FRAME_TIME;
    }

    lastFrameTime = currentTime;
    accumulator += deltaTime;

    // --- FIX START: Update the clock once per second ---
    if (currentTime - lastClockUpdateTime > 1000) {
        if (typeof updateGameClockUI === 'function') {
            updateGameClockUI();
        }
        lastClockUpdateTime = currentTime;
        
        // Anti-cheat: Validate player integrity every second
        validatePlayerIntegrity();
    }
    // --- FIX END ---

    // Fixed timestep updates - always run at consistent 100 FPS timing
    let updatesThisFrame = 0;
    while (accumulator >= FIXED_TIMESTEP && updatesThisFrame < 5) {
        // Run game logic at fixed 100 FPS
        updateGameLogic();
        accumulator -= FIXED_TIMESTEP;
        updatesThisFrame++;
    }

    // Always render (for smooth visuals)
    renderGame();

    // FPS calculation (update every second)
    frameCount++;
    if (frameCount % 60 === 0) {
        fpsDisplay = Math.round(1000 / deltaTime);
    }
}

/**
 * Updates all game logic at fixed 100 FPS timestep
 */
function updateGameLogic() {
    const now = Date.now();

    // Update gamepad input
    if (typeof gamepadManager !== 'undefined' && gamepadManager) {
        gamepadManager.update();
    }

    // Update input system
    if (typeof inputManager !== 'undefined') {
        inputManager.processInputQueue();
    }

    // Handle held attack
    if (isHoldingAttack && !player.isDead && !player.onLadder) {
        if (now - lastHeldAttackTime >= HELD_ATTACK_DELAY) {
            console.log('[Attack Debug] Attempting basic attack');
            useAbility('Basic Attack');
            lastHeldAttackTime = now;
        }
    } else if (isHoldingAttack) {
        console.log('[Attack Debug] Blocked - isDead:', player.isDead, 'onLadder:', player.onLadder);
    }

    // Wrap all game logic in error handling
    safeExecute(() => {
        if (isGmMode.infiniteStats) {
            const finalStats = calculatePlayerStats();
            player.hp = finalStats.finalMaxHp;
            player.mp = finalStats.finalMaxMp;
        }

        if (!player.isDead) {
            player.timePlayed = (player.timePlayed || 0) + (FIXED_TIMESTEP / 1000);

            player.previousY = player.y;

            updatePlayer();
            updatePet(); // Update pet position and animation
            autoPetLoot(); // Automatic pet looting
            updateCamera(); // Update camera after player physics
            updatePlayerBlink();
            updatePortalCharging();
            updateAttacks();
            updateProjectiles();
            updateDroppedItems();
            checkCollisions();
            updatePortalAnimations();
            updateChatBubble();
            updatePlayerAnimation();
            updateAnimatedIcons();
            updateUI();

            if (questHelperElement && questHelperElement.style.display !== 'none') {
                updateQuestHelperUI();
            }
        }
        
        // Always update remote projectiles for multiplayer sync (visual only)
        if (typeof updateRemoteProjectiles === 'function') {
            updateRemoteProjectiles();
        }
        
        // Always update monsters, even when player is dead (server-authoritative)
        updateMonsters();
        
        // For multiplayer non-host clients: interpolate monster positions from server
        if (typeof interpolateMonsterPositions === 'function') {
            interpolateMonsterPositions();
        }
        
        // Update spatial grid after monster positions change (OPTIMIZED)
        if (typeof updateSpatialGridForMonsters === 'function') {
            updateSpatialGridForMonsters();
        }
        
        // Always update mini-map to show monsters and other players
        updateMiniMap();

        updateSpawners();
        updatePrompts();
        
        // Update ghost players
        if (typeof updateGhostPlayers === 'function') {
            updateGhostPlayers();
        }

        // Update real-time remote players (multiplayer)
        if (typeof updateRemotePlayers === 'function') {
            updateRemotePlayers();
        }

        // Send party stats update (throttled to every 500ms)
        if (!window.lastPartyStatsUpdate || now - window.lastPartyStatsUpdate > 500) {
            if (typeof sendPartyStatsUpdate === 'function') {
                sendPartyStatsUpdate();
            }
            window.lastPartyStatsUpdate = now;
        }

        if (now - lastSaveTime > GAME_CONFIG.AUTO_SAVE_INTERVAL) {
            const saveSuccess = saveCharacter();
            lastSaveTime = Date.now();
            if (saveSuccess) {
                addChatMessage("Game Saved!", 'success');
                // Use throttled auto-submit for rankings (limits to once per 30 min)
                if (typeof autoSubmitRanking === 'function') {
                    autoSubmitRanking();
                }
            } else {
                addChatMessage("Save Failed!", 'error');
            }
        }
    });
}

/**
 * Renders the game visuals (can run at any frame rate for smoothness)
 */
function renderGame() {
    safeExecute(() => {
        render();
    });
}

/**
 * Saves the state of the current map (monsters, items) before the player leaves.
 * @param {string} mapId - The ID of the map to save.
 */
function saveMapState(mapId) {
    if (!maps[mapId]) return;
    worldState[mapId] = {
        monsters: monsters.map(m => ({
            id: m.id, 
            type: m.type, 
            hp: m.hp, 
            x: m.x, 
            y: m.y, 
            direction: m.direction,
            // Save elite monster state
            isEliteMonster: m.isEliteMonster || false,
            maxHp: m.maxHp,
            originalMaxHp: m.originalMaxHp,
            originalDamage: m.originalDamage,
            damage: m.damage
        })),
        droppedItems: droppedItems.map(item => {
            const { element, ...rest } = item; // Exclude HTML element from save data
            return rest;
        })
    };
}

/**
 * Cleans up memory and event listeners when leaving a map.
 */
function cleanupCurrentMap() {
    // Clean up elite monster HP bar if present
    if (typeof removeEliteMonsterHPBar === 'function') {
        removeEliteMonsterHPBar();
    }
    // Clean up mini boss HP bar if present
    if (typeof removeMiniBossHPBar === 'function') {
        removeMiniBossHPBar();
    }
    currentEliteMonster = null;
    
    // Clean up monster intervals and timers
    monsters.forEach(monster => {
        if (monster.aiInterval) {
            managedClearInterval(monster.aiInterval);
        }
        if (monster.animationInterval) {
            managedClearInterval(monster.animationInterval);
        }
        // Remove event listeners if any
        if (monster.element && typeof memoryManager !== 'undefined') {
            memoryManager.removeAllEventListeners(monster.element);
        }
        // Remove from spatial grid
        if (typeof spatialGrid !== 'undefined' && monster._inGrid) {
            spatialGrid.removeEntity(monster);
            monster._inGrid = false;
        }
        // Remove monster element from DOM
        if (monster.element && monster.element.parentElement) {
            monster.element.remove();
        }
    });
    
    // Clean up projectiles and attacks
    projectiles.forEach(projectile => {
        if (projectile.element && typeof projectilePool !== 'undefined') {
            projectilePool.release(projectile);
        }
    });
    
    activeAttacks.forEach(attack => {
        if (attack.element && typeof attackBoxPool !== 'undefined') {
            attackBoxPool.release(attack);
        }
    });
    
    // Clean up NPCs
    npcs.forEach(npc => {
        if (npc.element && typeof memoryManager !== 'undefined') {
            memoryManager.removeAllEventListeners(npc.element);
        }
    });
    
    // Clean up ghost players
    if (typeof cleanupGhostPlayers === 'function') {
        cleanupGhostPlayers();
    }
    
    // Force garbage collection hint
    if (window.gc && typeof window.gc === 'function') {
        window.gc();
    }
}

/**
 * Handles the transition between maps with a fade effect.
 * @param {string} mapId - The ID of the destination map.
 * @param {number} spawnX - The X coordinate to spawn at in the new map.
 * @param {number} [spawnY] - The optional Y coordinate to spawn at.
 */
function fadeAndChangeMap(mapId, spawnX, spawnY) {
    const fadeOverlay = document.getElementById('fade-overlay');
    fadeOverlay.classList.add('active');
    
    // Stop all monsters from chasing before map transition
    monsters.forEach(m => {
        if (m.aiState === 'chasing') {
            m.aiState = 'idle';
            m.chaseStartTime = 0;
        }
    });

    setTimeout(() => {
        changeMap(mapId, spawnX, spawnY);
        render(); // Render one frame to prevent visual pop-in
        fadeOverlay.classList.remove('active');
        playSound('portal');
    }, 250); // Duration matches CSS transition
}

// --- Player Interaction ---

/**
 * Checks if the player is near a portal and initiates charging.
 */
function checkPortalActivation() {
    if (player.isChargingPortal) return;

    for (const portal of portals) {
        // The condition "!player.isJumping" has been removed from the line below
        if (isColliding(player, portal)) {
            player.isChargingPortal = true;
            player.portalChargeStartTime = Date.now();
            player.activePortal = portal;
            portalChargeBarContainer.style.display = 'block';
            return; // Activate the first portal found
        }
    }
}

/**
 * Checks if the player is in range of an NPC and opens dialogue.
 */
function checkNpcInteraction() {
    for (const npc of npcs) {
        const distance = Math.hypot((player.x + player.width / 2) - (npc.x + npc.width / 2), (player.y + player.height / 2) - (npc.y + npc.height / 2));
        if (distance < NPC_INTERACTION_RANGE) {
            openDialogue(npc);
            return;
        }
    }
}

/**
 * Calculates an optimal map layout using a force-directed graph algorithm.
 * @param {object} mapsData - The original maps object with portal connections.
 * @param {object} initialLayout - The starting layout to use as a base.
 * @returns {object} A new layout object with calculated x, y positions.
 */
function calculateDynamicMapLayout(mapsData, initialLayout) {
    const nodes = Object.keys(initialLayout).map(id => ({
        id: id,
        x: initialLayout[id].x,
        y: initialLayout[id].y,
        vx: 0, vy: 0
    }));

    const connections = [];
    const connectionSet = new Set();
    for (const mapId in mapsData) {
        if (mapsData[mapId].portals) {
            mapsData[mapId].portals.forEach(portal => {
                const source = mapId;
                const target = portal.targetMap;
                if (initialLayout[source] && initialLayout[target]) {
                    const key = [source, target].sort().join('-');
                    if (!connectionSet.has(key)) {
                        connections.push({ source, target });
                        connectionSet.add(key);
                    }
                }
            });
        }
    }

    // Simulation parameters
    const ITERATIONS = 150;
    const REPULSION_STRENGTH = 120;
    const ATTRACTION_STRENGTH = 0.05;
    const DAMPING = 0.95;

    for (let i = 0; i < ITERATIONS; i++) {
        // Repulsion
        for (const nodeA of nodes) {
            for (const nodeB of nodes) {
                if (nodeA === nodeB) continue;
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                const force = REPULSION_STRENGTH / (distance * distance);
                nodeA.vx -= (dx / distance) * force;
                nodeA.vy -= (dy / distance) * force;
            }
        }

        // Attraction
        for (const conn of connections) {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            if (!sourceNode || !targetNode) continue;
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            const force = distance * ATTRACTION_STRENGTH;
            sourceNode.vx += (dx / distance) * force;
            sourceNode.vy += (dy / distance) * force;
            targetNode.vx -= (dx / distance) * force;
            targetNode.vy -= (dy / distance) * force;
        }

        // Update positions
        for (const node of nodes) {
            node.x += node.vx;
            node.y += node.vy;
            node.vx *= DAMPING;
            node.vy *= DAMPING;
            node.x = Math.max(10, Math.min(90, node.x));
            node.y = Math.max(10, Math.min(90, node.y));
        }
    }

    const newLayout = {};
    nodes.forEach(node => {
        newLayout[node.id] = { x: node.x, y: node.y };
    });
    return newLayout;
}

// in game.js

/**
 * Automatic pet looting - runs every frame
 */
function autoPetLoot() {
    if (!player.activePet || !player.activePet.type || !player.activePet.isSpawned) return;
    
    const petInfo = petData[player.activePet.type];
    if (!petInfo) return;
    
    // Initialize pet loot settings if not set (default to true)
    if (player.petLootGold === undefined) player.petLootGold = true;
    if (player.petLootItems === undefined) player.petLootItems = true;
    
    for (let i = droppedItems.length - 1; i >= 0; i--) {
        const item = droppedItems[i];
        
        // Check loot ownership (multiplayer) - skip if someone else owns it and timeout hasn't passed
        // Only apply ownership if ownerId is actually set (not null/undefined)
        if (item.ownerId && item.ownerId !== null && item.ownerTimeout && Date.now() < item.ownerTimeout) {
            if (typeof player !== 'undefined' && item.ownerId !== player.odId) {
                continue; // Can't loot - belongs to another player
            }
        }
        
        // Check pet auto-loot range
        const petDistance = Math.hypot(
            (player.activePet.x + petInfo.width / 2) - (item.x + item.width / 2),
            (player.activePet.y + petInfo.height / 2) - (item.y + item.height / 2)
        );
        
        if (petDistance < petInfo.lootRange) {
            let itemWasPickedUp = false;
            if (item.name === 'Gold') {
                // Skip gold if toggle is off
                if (!player.petLootGold) continue;
                // Check if we should share gold with party members
                let shareResult = { shouldAddGold: true, amount: item.amount, isSharing: false };
                if (typeof shareGoldWithParty === 'function') {
                    shareResult = shareGoldWithParty(item.amount);
                }
                
                if (shareResult.shouldAddGold) {
                    // Not in party or no party members - add full amount
                    player.gold += shareResult.amount;
                    player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + shareResult.amount;
                    updateAchievementProgress('action_accumulate', 'gold_earned');
                    showNotification(`+${shareResult.amount.toLocaleString()} Gold`, 'exp');
                }
                // If isSharing, server will send partyGoldShareResult with our share
                itemWasPickedUp = true;
            } else {
                // Skip items if toggle is off
                if (!player.petLootItems) continue;
                
                // Check if inventory has space before attempting to loot
                const itemInfo = itemData[item.name];
                if (itemInfo) {
                    const category = itemInfo.category.toLowerCase();
                    const targetTab = (category === 'equip' || category === 'use' || category === 'cosmetic') ? category : 'etc';
                    const targetInventory = player.inventory[targetTab];
                    const slotsPerTab = player.inventorySlots || 16;
                    
                    // Check if item can stack with existing item or if there's space
                    const canStack = (targetTab === 'use' || targetTab === 'etc') && 
                                     targetInventory.some(i => i.name === item.name);
                    const hasSpace = targetInventory.length < slotsPerTab;
                    
                    if (canStack || hasSpace) {
                        const itemCopy = { ...item };
                        delete itemCopy.element;
                        if (addItemToInventory(itemCopy)) {
                            showNotification(`Looted ${item.name}`, item.rarity || 'common');
                            itemWasPickedUp = true;
                            
                            // Check if this pickup completes a quest
                            player.quests.active.forEach(quest => {
                                const qData = questData[quest.id];
                                if (qData.objective.type === 'collect' && qData.objective.target === item.name && !quest.turnInNotified) {
                                    if (canCompleteCollectQuest(qData)) {
                                        quest.turnInNotified = true;
                                        const npcName = findNpcForQuest(quest.id);
                                        addChatMessage(`[Quest Update] "${qData.title}" is ready to be turned in at ${npcName}.`, 'quest-complete');
                                        playQuestVFX();
                                    }
                                }
                            });
                        }
                    }
                }
                // If inventory is full, pet will ignore this item (no VFX, no sound, no removal)
            }
            
            if (itemWasPickedUp) {
                // Play loot VFX at item location
                createPixelArtEffect('spawnEffect', item.x, item.y, item.width, item.height);
                
                // Notify server so other players can see the item was picked up
                if (typeof sendItemPickup === 'function') {
                    sendItemPickup(item);
                }
                
                // Clear this item from pet's failed loot attempts tracking
                if (player.activePet && player.activePet.failedLootAttempts) {
                    player.activePet.failedLootAttempts.delete(item);
                }
                
                if (item.element) {
                    item.element.remove();
                }
                droppedItems.splice(i, 1);
                playSound('pickupItem');
                updateUI();
            }
        }
    }
}

function lootItems() {
    const LOOT_RANGE = 50;
    let itemsLooted = false;

    for (let i = droppedItems.length - 1; i >= 0; i--) {
        const item = droppedItems[i];
        
        // Check loot ownership (multiplayer) - skip if someone else owns it and timeout hasn't passed
        // Only apply ownership if ownerId is actually set (not null/undefined)
        if (item.ownerId && item.ownerId !== null && item.ownerTimeout && Date.now() < item.ownerTimeout) {
            if (typeof player !== 'undefined' && item.ownerId !== player.odId) {
                continue; // Can't loot - belongs to another player
            }
        }
        
        // Check player manual loot range
        const playerDistance = Math.hypot(
            (player.x + player.width / 2) - (item.x + item.width / 2),
            (player.y + player.height / 2) - (item.y + item.height / 2)
        );

        // Check pet auto-loot range
        let petDistance = Infinity;
        if (player.activePet && player.activePet.isSpawned && player.activePet.type) {
            const petInfo = petData[player.activePet.type];
            if (petInfo) {
                petDistance = Math.hypot(
                    (player.activePet.x + petInfo.width / 2) - (item.x + item.width / 2),
                    (player.activePet.y + petInfo.height / 2) - (item.y + item.height / 2)
                );
            }
        }

        // Item can be looted either by player manually or by pet automatically
        const canLoot = playerDistance < LOOT_RANGE || (player.activePet && player.activePet.isSpawned && petDistance < (petData[player.activePet.type]?.lootRange || 0));

        if (canLoot) {
            let itemWasPickedUp = false;
            if (item.name === 'Gold') {
                // Check if we should share gold with party members
                let shareResult = { shouldAddGold: true, amount: item.amount, isSharing: false };
                if (typeof shareGoldWithParty === 'function') {
                    shareResult = shareGoldWithParty(item.amount);
                }
                
                if (shareResult.shouldAddGold) {
                    // Not in party or no party members - add full amount
                    player.gold += shareResult.amount;
                    player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + shareResult.amount;
                    updateAchievementProgress('action_accumulate', 'gold_earned');
                    showNotification(`+${shareResult.amount.toLocaleString()} Gold`, 'exp');
                }
                // If isSharing, server will send partyGoldShareResult with our share
                itemWasPickedUp = true;

            } else {
                const itemCopy = { ...item };
                delete itemCopy.element;
                if (addItemToInventory(itemCopy)) {
                    showNotification(`Looted ${item.name}`, item.rarity || 'common');
                    itemWasPickedUp = true;

                    // NEW: Check if this pickup completes a quest
                    player.quests.active.forEach(quest => {
                        const qData = questData[quest.id];
                        if (qData.objective.type === 'collect' && qData.objective.target === item.name && !quest.turnInNotified) {
                            if (canCompleteCollectQuest(qData)) { // Using the helper from ui.js
                                quest.turnInNotified = true;
                                const npcName = findNpcForQuest(quest.id);
                                addChatMessage(`[Quest Update] "${qData.title}" is ready to be turned in at ${npcName}.`, 'quest-complete');
                                playQuestVFX();
                            }
                        }
                    });
                }
            }

            if (itemWasPickedUp) {
                itemsLooted = true;

                // --- MOVED & MODIFIED: Play the effect at the item's location ---
                createPixelArtEffect('spawnEffect', item.x, item.y, item.width, item.height);

                // Notify server so other players can see the item was picked up
                if (typeof sendItemPickup === 'function') {
                    sendItemPickup(item);
                }

                item.element.remove();
                droppedItems.splice(i, 1);
            }
        }
    }

    if (itemsLooted) {
        // --- REMOVED: The effect is no longer created here ---

        playSound('pickup');
        updateUI();
        updateInventoryUI();
    }
}

/**
 * Handles GM commands when player has GM Hat equipped
 * @param {string} command - The command string starting with !
 */
function handleGMCommand(command) {
    console.log('[GM Command]', command); // Debug log
    const args = command.slice(1).toLowerCase().split(' ');
    const cmd = args[0];
    console.log('[GM Command] Parsed:', cmd, args); // Debug log
    
    switch(cmd) {
        case 'help':
            addChatMessage('=== GM Commands ===', 'legendary');
            addChatMessage('!spawn <name> [count] - Spawn monsters or items', 'system');
            addChatMessage('!kill - Kill all monsters on map', 'system');
            addChatMessage('!heal - Restore full HP and MP', 'system');
            addChatMessage('!gold <amount> - Add gold', 'system');
            addChatMessage('!level <number> - Set your level', 'system');
            addChatMessage('!tp <map> - Teleport to map', 'system');
            addChatMessage('!item <name> - Give yourself an item', 'system');
            addChatMessage('!god - Toggle invincibility', 'system');
            addChatMessage('!speed <multiplier> - Set movement speed', 'system');
            addChatMessage('!debug - Show equipment debug info', 'system');
            break;
            
        case 'spawn':
            // Get the name (everything except the last argument if it's a number)
            const lastArg = args[args.length - 1];
            const isCountProvided = !isNaN(parseInt(lastArg)) && parseInt(lastArg) > 0;
            const spawnCount = isCountProvided ? parseInt(lastArg) : 1;
            const nameArgs = isCountProvided ? args.slice(1, -1) : args.slice(1);
            const spawnName = nameArgs.join(' ');
            
            if (!spawnName) {
                addChatMessage('Usage: !spawn <name> [count]', 'error');
                break;
            }
            
            // Try to find a monster first
            let monsterType = null;
            for (const type in monsterTypes) {
                if (type.toLowerCase().includes(spawnName.toLowerCase()) || 
                    monsterTypes[type].name.toLowerCase().includes(spawnName.toLowerCase())) {
                    monsterType = type;
                    break;
                }
            }
            
            if (monsterType) {
                // Spawn monster(s)
                for (let i = 0; i < spawnCount; i++) {
                    const offsetX = (Math.random() - 0.5) * 200;
                    const offsetY = -50;
                    spawnMonster(monsterType, player.x + offsetX, player.y + offsetY);
                }
                addChatMessage(`Spawned ${spawnCount}x ${monsterTypes[monsterType].name}`, 'legendary');
            } else {
                // Try to find an item
                let foundItem = null;
                for (const name in itemData) {
                    if (name.toLowerCase().includes(spawnName.toLowerCase())) {
                        foundItem = name;
                        break;
                    }
                }
                
                if (foundItem) {
                    const itemInfo = itemData[foundItem];
                    for (let i = 0; i < spawnCount; i++) {
                        const offsetX = (Math.random() - 0.5) * 100;
                        createItemDrop(foundItem, player.x + offsetX, player.y - 50, null, true);
                    }
                    addChatMessage(`Spawned ${spawnCount}x ${foundItem}`, 'legendary');
                } else {
                    addChatMessage(`'${spawnName}' not found! Try: slime, pig, sword, etc.`, 'error');
                }
            }
            break;
            
        case 'kill':
            const killCount = monsters.length;
            monsters.forEach(m => {
                if (m.element && m.element.parentNode) {
                    m.element.remove();
                }
            });
            monsters.length = 0;
            addChatMessage(`Killed ${killCount} monsters`, 'legendary');
            break;
            
        case 'heal':
            player.hp = player.maxHp;
            player.mp = player.maxMp;
            addChatMessage('Fully healed!', 'legendary');
            updateUI();
            break;
            
        case 'gold':
            const goldAmount = parseInt(args[1]) || 10000;
            player.gold += goldAmount;
            addChatMessage(`Added ${goldAmount.toLocaleString()} gold`, 'legendary');
            updateUI();
            break;
            
        case 'level':
            const targetLevel = parseInt(args[1]);
            if (targetLevel && targetLevel > 0 && targetLevel <= 200) {
                player.level = targetLevel;
                player.exp = 0;
                player.expToNextLevel = Math.floor(100 * Math.pow(1.10, player.level - 1));
                addChatMessage(`Level set to ${targetLevel}`, 'legendary');
                updateUI();
            } else {
                addChatMessage('Invalid level (1-200)', 'error');
            }
            break;
            
        case 'tp':
        case 'teleport':
            const mapName = args.slice(1).join('');
            let foundMap = null;
            
            // Find matching map
            for (const mapId in maps) {
                if (mapId.toLowerCase().replace(/\s/g, '') === mapName.toLowerCase().replace(/\s/g, '')) {
                    foundMap = mapId;
                    break;
                }
            }
            
            if (foundMap) {
                const spawn = maps[foundMap].spawnPoint || { x: 100, y: 100 };
                fadeAndChangeMap(foundMap, spawn.x, spawn.y);
                addChatMessage(`Teleported to ${foundMap}`, 'legendary');
            } else {
                addChatMessage('Map not found! Try: ironHaven, stonepeak, woodbrook, etc.', 'error');
            }
            break;
            
        case 'item':
            const itemName = args.slice(1).join(' ');
            let foundItem = null;
            
            // Find matching item
            for (const name in itemData) {
                if (name.toLowerCase().includes(itemName.toLowerCase())) {
                    foundItem = name;
                    break;
                }
            }
            
            if (foundItem) {
                const itemInfo = itemData[foundItem];
                const newItem = {
                    name: foundItem,
                    stats: itemInfo.stats ? { ...itemInfo.stats } : {},
                    levelReq: itemInfo.levelReq,
                    rarity: itemInfo.rarity || 'common',
                    enhancement: 0,
                    quantity: itemInfo.stackable ? 100 : 1
                };
                
                if (addItemToInventory(newItem)) {
                    addChatMessage(`Added ${foundItem}`, 'legendary');
                    updateInventoryUI();
                } else {
                    addChatMessage('Inventory full!', 'error');
                }
            } else {
                addChatMessage('Item not found!', 'error');
            }
            break;
            
        case 'god':
            player.isInvincible = !player.isInvincible;
            addChatMessage(`God mode: ${player.isInvincible ? 'ON' : 'OFF'}`, 'legendary');
            break;
            
        case 'speed':
            const speedMultiplier = parseFloat(args[1]) || 1;
            player.speed = player.originalSpeed * speedMultiplier;
            addChatMessage(`Speed set to ${speedMultiplier}x`, 'legendary');
            break;
            
        case 'debug':
            const equippedHelmet = player.equipped?.helmet;
            const cosmeticHelmet = player.cosmeticEquipped?.helmet;
            addChatMessage('=== Debug Info ===', 'legendary');
            addChatMessage(`Equipped Helmet: ${JSON.stringify(equippedHelmet)}`, 'system');
            addChatMessage(`Cosmetic Helmet: ${JSON.stringify(cosmeticHelmet)}`, 'system');
            addChatMessage(`Helmet Name: ${equippedHelmet?.name || 'none'}`, 'system');
            console.log('Full player.equipped:', player.equipped);
            console.log('Full player.cosmeticEquipped:', player.cosmeticEquipped);
            break;
            
        default:
            addChatMessage(`Unknown command: ${cmd}. Type !help for commands.`, 'error');
            break;
    }
}

// Make GM command handler globally accessible
window.handleGMCommand = handleGMCommand;

/**
 * Updates the animation frame for a pixel art-based monster.
 * @param {object} entity - The monster object to animate.
 */
function updatePixelArtAnimation(entity) {
    if (!entity.isPixelArt) return;

    const sData = spriteData[entity.type];
    if (!sData) return;

    // Skip animation update if entity is in hit animation (test dummy)
    if (entity.hitAnimationTimeout) return;

    const animation = sData.animations['idle'];
    if (!animation) return;

    entity.animationFrame = entity.animationFrame || 0;
    entity.animationTimer = (entity.animationTimer || 0) + 1;

    const frameDuration = 15;
    if (entity.animationTimer > frameDuration) {
        entity.animationTimer = 0;
        entity.animationFrame = (entity.animationFrame + 1) % animation.length;
    }

    const frame = animation[entity.animationFrame];
    entity.element.style.backgroundPosition = `-${frame.x * PIXEL_ART_SCALE}px -${frame.y * PIXEL_ART_SCALE}px`;
    entity.element.style.transform = entity.direction === 1 ? 'scaleX(1)' : 'scaleX(-1)';
}

// --- Camera System ---

function updateCamera() {
    const map = maps[currentMapId];
    const mapWidth = map.width;
    let mapHeight = map.height || GAME_CONFIG.BASE_GAME_HEIGHT;

    // Horizontal camera follows normally with dead zone
    const idealCameraX = player.x - (scalingContainer.clientWidth / 2);
    const screenCenterX = cameraX + (scalingContainer.clientWidth / 2);
    const deadZoneX = scalingContainer.clientWidth * 0.2;
    const distanceFromCenterX = Math.abs(player.x - screenCenterX);
    
    const easingFactorX = distanceFromCenterX > deadZoneX ? 
        Math.min(1, (distanceFromCenterX - deadZoneX) / deadZoneX) * GAME_CONFIG.CAMERA_EASING : 
        GAME_CONFIG.CAMERA_EASING * 0.3;
    
    cameraX += (idealCameraX - cameraX) * easingFactorX;
    
    // Vertical camera logic
    let targetCameraY;
    
    if (currentMapId === 'onyxCityJumpQuest' || currentMapId === 'skypalaceJumpQuest') {
        // Jump quest: Always center player perfectly on screen
        targetCameraY = player.y - (scalingContainer.clientHeight / 2);
        // Use normal easing for smooth movement
        cameraY += (targetCameraY - cameraY) * GAME_CONFIG.CAMERA_EASING;
    } else {
        // Regular maps: Smooth vertical following with dead zone to reduce jarring on jumps
        
        // Calculate ground-based offset to show more of what's above the player
        const groundLevel = mapHeight - GAME_CONFIG.GROUND_Y;
        const distanceFromGround = Math.max(0, groundLevel - player.y);
        const maxOffsetDistance = 200;
        const offsetMultiplier = Math.max(0, Math.min(1, distanceFromGround / maxOffsetDistance));
        const verticalOffset = (scalingContainer.clientHeight * 0.15) * offsetMultiplier;
        
        targetCameraY = player.y - (scalingContainer.clientHeight / 2) - verticalOffset;
        
        // Vertical dead zone - camera doesn't follow small vertical movements (like regular jumps)
        const screenCenterY = cameraY + (scalingContainer.clientHeight / 2);
        const deadZoneY = scalingContainer.clientHeight * 0.25; // 25% of screen height dead zone
        const distanceFromCenterY = Math.abs(player.y - screenCenterY);
        
        // Only move camera vertically if player is outside the dead zone
        if (distanceFromCenterY > deadZoneY) {
            // Slower vertical easing for smoother, less jarring movement
            const verticalEasing = GAME_CONFIG.CAMERA_EASING * 0.5;
            cameraY += (targetCameraY - cameraY) * verticalEasing;
        } else {
            // Very slow drift back to ideal position when in dead zone
            const driftEasing = GAME_CONFIG.CAMERA_EASING * 0.1;
            cameraY += (targetCameraY - cameraY) * driftEasing;
        }
    }
    
    const clampedCameraX = Math.max(0, Math.min(cameraX, mapWidth - scalingContainer.clientWidth));
    
    // Camera clamping with proper ground level respect
    let clampedCameraY;
    let finalCameraY;
    
    // Simple, consistent camera clamping for all maps
    const effectiveMapHeight = mapHeight;
    worldContent.style.height = `${effectiveMapHeight}px`;
    
    // Standard camera bounds - works for both regular maps and jump quests
    const minCameraY = 0;
    const maxCameraY = Math.max(0, effectiveMapHeight - scalingContainer.clientHeight);
    
    clampedCameraY = Math.max(minCameraY, Math.min(cameraY, maxCameraY));
    finalCameraY = clampedCameraY;
    
    worldContent.style.transform = `translateX(-${clampedCameraX}px) translateY(-${finalCameraY}px)`;
    
    // Update parallax backgrounds
    parallaxBgs.forEach(bg => {
        bg.element.style.backgroundPositionX = `-${clampedCameraX * bg.speed}px`;
        bg.element.style.backgroundPositionY = `-${finalCameraY * bg.speed}px`;
    });
    
    // Update clouds (autonomous horizontal movement)
    clouds.forEach(cloud => {
        cloud.x += cloud.speed;
        
        // Wrap cloud when it exits the right side - spawn from off-screen left
        if (cloud.x > mapWidth + cloud.width) {
            cloud.x = -cloud.width - Math.random() * 200; // Spawn off-screen with random offset
            // Randomize Y position and flip on wrap for variety
            cloud.y = Math.random() * (mapHeight * 0.4);
            cloud.element.style.top = `${cloud.y}px`;
            
            // Random horizontal flip on respawn
            const flipX = Math.random() > 0.5 ? -1 : 1;
            cloud.element.style.transform = `scale(${PIXEL_ART_SCALE * flipX}, ${PIXEL_ART_SCALE})`;
            
            // Randomize cloud type on respawn
            const cloudTypes = ['cloud01', 'cloud02', 'cloud03'];
            const newType = cloudTypes[Math.floor(Math.random() * cloudTypes.length)];
            cloud.element.src = artAssets[newType];
            cloud.type = newType;
        }
        
        cloud.element.style.left = `${cloud.x}px`;
    });
}

// --- Rendering & Visuals ---

function render() {
    const map = maps[currentMapId];
    const mapWidth = map.width;
    const mapHeight = map.height || GAME_CONFIG.BASE_GAME_HEIGHT;

    if (showHitboxes) {
        if (player.hitboxElement) {
            player.hitboxElement.style.display = 'block';
            const visualContainerWidth = 60;
            const visualContainerHeight = 60;
            const offsetX = (visualContainerWidth - player.width) / 2;
            const offsetY = (visualContainerHeight - player.height) / 2;
            player.hitboxElement.style.left = `${offsetX}px`;
            player.hitboxElement.style.top = `${offsetY}px`;
            player.hitboxElement.style.width = `${player.width}px`;
            player.hitboxElement.style.height = `${player.height}px`;
        }
        monsters.forEach(m => {
            if (m.hitboxElement) {
                m.hitboxElement.style.display = 'block';
                m.hitboxElement.style.left = `0px`;
                m.hitboxElement.style.top = `0px`;
                m.hitboxElement.style.width = `${m.width}px`;
                m.hitboxElement.style.height = `${m.height}px`;
            }
        });
        portals.forEach(p => {
            if (p.hitboxElement) {
                p.hitboxElement.style.display = 'block';
                p.hitboxElement.style.left = `${p.x}px`;
                p.hitboxElement.style.top = `${p.y}px`;
                p.hitboxElement.style.width = `${p.width}px`;
                p.hitboxElement.style.height = `${p.height}px`;
            }
        });
        platforms.forEach(p => {
            if (p.hitboxElement) {
                p.hitboxElement.style.display = 'block';
            }
        });
        slopeHitboxes.forEach(s => {
            if (s.element) {
                s.element.style.display = 'block';
            }
        });
    } else {
        if (player.hitboxElement) player.hitboxElement.style.display = 'none';
        monsters.forEach(m => { if (m.hitboxElement) m.hitboxElement.style.display = 'none'; });
        portals.forEach(p => { if (p.hitboxElement) p.hitboxElement.style.display = 'none'; });
        platforms.forEach(p => { if (p.hitboxElement) p.hitboxElement.style.display = 'none'; });
        slopeHitboxes.forEach(s => { if (s.element) s.element.style.display = 'none'; });
    }

    let weaponRotation = 0;
    if (player.isAttacking) {
        const elapsedTime = Date.now() - player.attackStartTime;
        const attackDuration = 200;
        if (elapsedTime < attackDuration) {
            const halfDuration = attackDuration / 2;
            if (elapsedTime < halfDuration) {
                weaponRotation = (elapsedTime / halfDuration) * 70;
            } else {
                weaponRotation = 70 - ((elapsedTime - halfDuration) / halfDuration) * 70;
            }
        } else {
            player.isAttacking = false;
        }
    }

    const playerVisualY = player.y - (player.yOffset || 0);
    playerElement.style.left = `${Math.round(player.x)}px`;
    playerElement.style.top = `${Math.round(playerVisualY)}px`;

    const spriteContainer = document.getElementById('player-sprite-container');
    
    // Shadow Partner visual rendering
    const shadowPartnerBuff = player.buffs.find(b => b.name === 'Shadow Partner');
    let shadowCanvas = spriteContainer.querySelector('.shadow-partner-canvas');
    
    if (shadowPartnerBuff && !player.isDead) {
        // Create shadow canvas if it doesn't exist
        if (!shadowCanvas) {
            shadowCanvas = document.createElement('canvas');
            shadowCanvas.className = 'shadow-partner-canvas';
            const pData = spriteData.player;
            shadowCanvas.width = pData.frameWidth * PIXEL_ART_SCALE;
            shadowCanvas.height = pData.frameHeight * PIXEL_ART_SCALE;
            shadowCanvas.style.width = `${shadowCanvas.width}px`;
            shadowCanvas.style.height = `${shadowCanvas.height}px`;
            shadowCanvas.style.position = 'absolute';
            // Position behind player (offset based on facing direction)
            shadowCanvas.style.left = `-${(shadowCanvas.width - 60) / 2}px`;
            shadowCanvas.style.top = `-${(shadowCanvas.height - 60)}px`;
            shadowCanvas.style.opacity = '0.5';
            shadowCanvas.style.zIndex = '-1';
            spriteContainer.insertBefore(shadowCanvas, spriteContainer.firstChild);
        }
        // Update shadow position offset based on facing direction
        const shadowOffset = player.facing === 'right' ? -20 : 20;
        shadowCanvas.style.left = `${-((shadowCanvas.width - 60) / 2) + shadowOffset}px`;
        shadowCanvas.style.display = 'block';
    } else if (shadowCanvas) {
        // Hide shadow canvas if buff is not active
        shadowCanvas.style.display = 'none';
    }

    let canvas = spriteContainer.querySelector('canvas:not(.shadow-partner-canvas)');
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

    hairTintCanvas.width = canvas.width;
    hairTintCanvas.height = canvas.height;
    hairTintCtx.imageSmoothingEnabled = false;

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

        const drawQueue = [];

        const skinY = pData.frameHeight * (player.customization.skinTone + 1);
        drawQueue.push({ type: 'body', zLevel: 1, source: playerSheetImage, sx: frame.x, sy: skinY, sWidth: pData.frameWidth, sHeight: pData.frameHeight });
        drawQueue.push({ type: 'body', zLevel: 5, source: playerSheetImage, sx: frame.x, sy: 0, sWidth: pData.frameWidth, sHeight: pData.frameHeight });

        if (player.animationState !== 'climb' && frame.attachments?.eyes) {
            const faceItem = player.cosmeticEquipped.face || player.equipped.face;
            const shouldHideEyes = faceItem && itemData[faceItem.name] && itemData[faceItem.name].hideEyes;

            if (!shouldHideEyes) {
                const eyeData = spriteData.playerEyes;
                const eyeSourceX = player.isBlinking ? eyeData.frameWidth : 0;
                const eyeSourceY = eyeData.frameHeight * player.customization.eyeColor;
                drawQueue.push({ type: 'eyes', zLevel: 10, source: playerEyesSheet, sx: eyeSourceX, sy: eyeSourceY, sWidth: eyeData.frameWidth, sHeight: eyeData.frameHeight, attachment: frame.attachments.eyes });
            }
        }

        const equipmentSheetData = spriteData.playerEquipment;
        const allSlots = ['cape', 'bottom', 'shoes', 'top', 'pendant', 'earring', 'gloves', 'helmet', 'weapon', 'face', 'eye'];
        
        // Check if hair hides earrings
        const playerHairInfo = spriteData.playerHair[player.customization?.hairStyle || 0];
        // Debug: Track rendered hair
        if (window.debugHairRendered === undefined) window.debugHairRendered = {};
        window.debugHairRendered = {
            hairIndex: player.customization?.hairStyle || 0,
            hairName: playerHairInfo?.name || 'undefined',
            hairY: playerHairInfo?.y || 'undefined'
        };
        const shouldHideEarrings = playerHairInfo?.hidesEarrings || false;
        
        allSlots.forEach(slot => {
            const item = player.cosmeticEquipped[slot] || player.equipped[slot];
            if (item && equipmentSheetData.coords[item.name]) {
                // Skip earrings if hair hides them
                if (slot === 'earring' && shouldHideEarrings) {
                    return;
                }
                
                const itemInfo = itemData[item.name];
                const itemCoords = equipmentSheetData.coords[item.name];
                const sourceX = itemCoords.x + frame.x;
                const sourceY = itemCoords.y;
                let zLevel = itemInfo.zLevel;
                if (itemInfo.zLevelOverrides && itemInfo.zLevelOverrides[player.animationState]) {
                    zLevel = itemInfo.zLevelOverrides[player.animationState];
                }
                
                // When climbing, render gloves behind hair (z-level 5 instead of 8)
                if (player.onLadder && slot === 'gloves') {
                zLevel = 5;
            }
            
            let glowEffect = null;
            if (itemInfo.type === 'weapon' && item.enhancement) {
                if (item.enhancement >= 10) { glowEffect = 'red'; }
                else if (item.enhancement >= 7) { glowEffect = 'blue'; }
            }
            // Devil Tail gets red glow
            if (item.name === 'Devil Tail') {
                glowEffect = 'red';
            }
            drawQueue.push({ type: 'equip', zLevel: zLevel, source: playerEquipmentSheet, sx: sourceX, sy: sourceY, sWidth: pData.frameWidth, sHeight: pData.frameHeight, glow: glowEffect });
            }
        });        // Check if helmet hides hair (prioritize cosmetic helmet over regular helmet)
        const helmet = player.equipped?.helmet;
        const cosmeticHelmet = player.cosmeticEquipped?.helmet;
        // If wearing Transparent Hat as cosmetic, always show hair regardless of helmet underneath
        const hasTransparentHat = cosmeticHelmet && cosmeticHelmet.name === 'Transparent Hat';
        // Check cosmetic helmet first, then fall back to regular helmet
        const activeHelmet = cosmeticHelmet || helmet;
        const helmetHidesHair = activeHelmet && itemData[activeHelmet.name]?.hidesHair;
        const hairStyleIndex = player.customization?.hairStyle || 0;
        const hairInfo = spriteData.playerHair[hairStyleIndex];
        const hairWorksWithHats = hairInfo?.worksWithHats;

        if (player.customization && playerHairSheet && playerHairSheet.complete && (hasTransparentHat || !helmetHidesHair || hairWorksWithHats)) {
            if (hairInfo && hairInfo.name !== 'Bald') {
                const hairColor = customizationOptions.hairColors[player.customization.hairColor || 0];
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

            if (item.glow) {
                ctx.save();
                if (item.glow === 'blue') { ctx.filter = 'drop-shadow(0 0 4px #00aaff)'; }
                else if (item.glow === 'red') { ctx.filter = 'drop-shadow(0 0 6px #e74c3c)'; }
            }

            if (item.type === 'hair' && item.hairColor) {
                hairTintCtx.clearRect(0, 0, canvas.width, canvas.height);
                hairTintCtx.drawImage(item.source, item.sx, item.sy, item.sWidth, item.sHeight, destX, destY, destWidth, destHeight);

                const imageData = hairTintCtx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const tintColor = hexToRgb(item.hairColor);

                // The RGB values for the color to ignore (#222034)
                const outlineR = 34;
                const outlineG = 32;
                const outlineB = 52;

                if (tintColor) {
                    for (let i = 0; i < data.length; i += 4) {
                        // Check if the current pixel is the outline color
                        const isOutlineColor = data[i] === outlineR && data[i + 1] === outlineG && data[i + 2] === outlineB;

                        // Only apply tint if the pixel is visible AND is not the outline color
                        if (data[i + 3] > 0 && !isOutlineColor) {
                            data[i] = (data[i] / 255) * tintColor.r;       // Red
                            data[i + 1] = (data[i + 1] / 255) * tintColor.g; // Green
                            data[i + 2] = (data[i + 2] / 255) * tintColor.b; // Blue
                        }
                    }
                }
                hairTintCtx.putImageData(imageData, 0, 0);
                ctx.drawImage(hairTintCanvas, 0, 0);
            } else {
                ctx.drawImage(item.source, item.sx, item.sy, item.sWidth, item.sHeight, destX, destY, destWidth, destHeight);
            }

            if (item.glow) {
                ctx.restore();
            }
        });
        ctx.restore();
        
        // Copy player sprite to shadow partner canvas with black tint
        if (shadowPartnerBuff && shadowCanvas) {
            const shadowCtx = shadowCanvas.getContext('2d');
            shadowCtx.imageSmoothingEnabled = false;
            shadowCtx.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
            
            // Draw the main canvas content to shadow canvas
            shadowCtx.drawImage(canvas, 0, 0);
            
            // Apply black tint overlay
            shadowCtx.globalCompositeOperation = 'source-atop';
            shadowCtx.fillStyle = '#1a1a2e'; // Dark purple-black for shadow
            shadowCtx.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
            shadowCtx.globalCompositeOperation = 'source-over';
        }
    }

    const chatBubble = document.getElementById('player-chat-bubble');
    if (player.chatMessage && !player.isDead) {
        // Replace any newlines/breaks with spaces to ensure single-line text
        const cleanMessage = player.chatMessage.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
        chatBubble.innerHTML = `<span style="white-space: nowrap; display: inline;">${cleanMessage}</span>`;
        chatBubble.style.display = 'block';
    } else {
        chatBubble.style.display = 'none';
    }

    // Render level up effect
    if (player.levelUpEffect && !player.isDead) {
        const effectData = spriteData.lvlupEffect;
        
        // Update animation using same system as other sprites
        player.levelUpEffect.animationTimer = (player.levelUpEffect.animationTimer || 0) + 1;
        const frameDuration = 8; // Slower animation for level up effect
        
        if (player.levelUpEffect.animationTimer > frameDuration) {
            player.levelUpEffect.animationTimer = 0;
            player.levelUpEffect.animationFrame++;
            
            // Check if animation is complete
            if (player.levelUpEffect.animationFrame >= effectData.frameCount) {
                player.levelUpEffect = null;
                const effectCanvas = document.getElementById('player-levelup-effect-canvas');
                if (effectCanvas) {
                    effectCanvas.remove();
                }
                return; // Exit early since effect is done
            }
        }
        
        let effectCanvas = document.getElementById('player-levelup-effect-canvas');
        if (!effectCanvas) {
            effectCanvas = document.createElement('canvas');
            effectCanvas.id = 'player-levelup-effect-canvas';
            effectCanvas.width = effectData.frameWidth * PIXEL_ART_SCALE;
            effectCanvas.height = effectData.frameHeight * PIXEL_ART_SCALE;
            effectCanvas.style.position = 'absolute';
            effectCanvas.style.pointerEvents = 'none';
            effectCanvas.style.zIndex = '100';
            spriteContainer.appendChild(effectCanvas);
        }
        
        const effectCtx = effectCanvas.getContext('2d');
        effectCtx.imageSmoothingEnabled = false;
        effectCtx.clearRect(0, 0, effectCanvas.width, effectCanvas.height);
        
        const frame = effectData.frames[player.levelUpEffect.animationFrame];
        
        // Cache the image globally to avoid recreating it every frame
        if (!window.cachedLvlupImage) {
            window.cachedLvlupImage = new Image();
            window.cachedLvlupImage.src = artAssets.lvlupEffect;
        }
        
        const lvlupImage = window.cachedLvlupImage;
        if (lvlupImage.complete && lvlupImage.naturalWidth > 0) {
            effectCtx.drawImage(
                lvlupImage,
                frame.x, frame.y,
                effectData.frameWidth, effectData.frameHeight,
                0, 0,
                effectCanvas.width, effectCanvas.height
            );
        }
        
        // Position the effect exactly like the player canvas (same as player sprite positioning)
        effectCanvas.style.left = `-${(effectCanvas.width - 60) / 2}px`;
        effectCanvas.style.top = `-${(effectCanvas.height - 60)}px`;
    } else {
        // No effect active, make sure canvas is removed
        const effectCanvas = document.getElementById('player-levelup-effect-canvas');
        if (effectCanvas) {
            effectCanvas.remove();
        }
    }

    monsters.forEach(m => {
        let topPosition = m.y;
        if (m.isPixelArt) {
            const sData = spriteData[m.type];
            if (sData && sData.anchorPoint) {
                topPosition = m.y - (sData.anchorPoint.y * PIXEL_ART_SCALE) + m.height;
            }
        }
        m.element.style.left = `${Math.round(m.x)}px`;
        m.element.style.top = `${Math.round(topPosition)}px`;
        
        // DEBUG: Visual debug overlay
        if (window.DEBUG_MONSTERS) {
            let debugDiv = m.element.querySelector('.monster-debug-overlay');
            if (!debugDiv) {
                debugDiv = document.createElement('div');
                debugDiv.className = 'monster-debug-overlay';
                debugDiv.style.cssText = 'position:absolute;top:-30px;left:0;background:rgba(0,0,0,0.8);color:#0f0;font-size:10px;padding:2px 4px;white-space:nowrap;pointer-events:none;z-index:9999;';
                m.element.appendChild(debugDiv);
            }
            debugDiv.textContent = `Y:${Math.round(m.y)} VX:${m.velocityX?.toFixed(1)||0} VY:${m.velocityY?.toFixed(1)||0}`;
        } else {
            const existingDebug = m.element.querySelector('.monster-debug-overlay');
            if (existingDebug) existingDebug.remove();
        }

        if (m.nameplateElement) {
            const levelDiff = m.level - player.level;
            let color = 'white';
            if (levelDiff >= 10) color = '#c0392b';
            else if (levelDiff >= 5) color = '#e74c3c';
            else if (levelDiff >= -2) color = '#f39c12';
            else if (levelDiff >= -4) color = '#f1c40f';
            else if (levelDiff <= -10) color = '#95a5a6';
            m.nameplateElement.style.color = color;

            const isFlipped = m.element.style.transform === 'scaleX(-1)';
            const flipTransform = isFlipped ? 'scaleX(-1)' : '';
            m.nameplateElement.style.transform = `translateX(-50%) ${flipTransform}`;
        }
    });

    npcs.forEach(n => {
        const npcVisualY = n.y - (n.yOffset || 0);
        n.element.style.left = `${Math.round(n.x)}px`;
        n.element.style.top = `${Math.round(npcVisualY)}px`;

        // Update player-sprite NPC animation (new system)
        if (n.usesPlayerSprite) {
            updateNpcAnimation(n);
        } else if (n.isPixelArt) {
            // Update pixel art NPC animation (old system for mrSalami, etc.)
            updatePixelArtAnimation(n);
        }

        if (n.questIndicatorContainer) {
            const attachmentPoint = n.attachmentPoints?.questIcon || { x: n.width / (2 * PIXEL_ART_SCALE), y: -14 };
            const iconWidth = 36;
            const scaledAttachmentX = attachmentPoint.x * PIXEL_ART_SCALE;
            const scaledAttachmentY = attachmentPoint.y * PIXEL_ART_SCALE;
            const iconX_offset = (n.width / 2) + scaledAttachmentX - (iconWidth / 2);
            const iconY_offset = scaledAttachmentY;

            n.questIndicatorContainer.style.left = `${Math.round(iconX_offset)}px`;
            n.questIndicatorContainer.style.top = `${Math.round(iconY_offset)}px`;
        }
    });

    activeAttacks.forEach(a => { a.element.style.left = `${Math.round(a.x)}px`; a.element.style.top = `${Math.round(a.y)}px`; a.element.style.width = `${Math.round(a.width)}px`; a.element.style.height = `${Math.round(a.height)}px`; });
    projectiles.forEach(p => { p.element.style.left = `${Math.round(p.x)}px`; p.element.style.top = `${Math.round(p.y)}px`; });

    droppedItems.forEach(item => {
        const visualY = item.y + (item.visualYOffset || 0);
        item.element.style.left = `${Math.round(item.x)}px`;
        item.element.style.top = `${Math.round(visualY)}px`;
    });

    portals.forEach(p => {
        const portalData = spriteData.portal;
        const yOffset = (portalData.yOffset || 0) * PIXEL_ART_SCALE;
        const visualY = p.y - yOffset;
        p.element.style.left = `${Math.round(p.x)}px`;
        p.element.style.top = `${Math.round(visualY)}px`;
    });

    // Render pet
    if (typeof renderPet === 'function') {
        renderPet();
    }
}

/**
 * Shows or hides debug hitboxes for all collidable entities.
 * @param {boolean} show - Whether to show or hide the hitboxes.
 */
function toggleDebugHitboxes(show) {
    const displayValue = show ? 'block' : 'none';
    if (player.hitboxElement) {
        player.hitboxElement.style.display = displayValue;
        const offsetX = (60 - player.width) / 2;
        const offsetY = (60 - player.height);
        player.hitboxElement.style.left = `${offsetX}px`;
        player.hitboxElement.style.top = `${offsetY}px`;
        player.hitboxElement.style.width = `${player.width}px`;
        player.hitboxElement.style.height = `${player.height}px`;
    }
    document.querySelectorAll('.monster .debug-hitbox, .portal .debug-hitbox, .platform .debug-hitbox').forEach(el => {
        el.style.display = displayValue;
    });
}
// --- Map & World Setup ---

// --- THIS IS THE NEW, CORRECTED FUNCTION ---
function spawnMonster(monsterType) {
    // SERVER-ONLY MODE: All spawning handled by server
    console.error('[SPAWN ERROR] spawnMonster() should NEVER be called! Type:', monsterType);
    console.error('[SPAWN ERROR] Server handles ALL monster spawning. This is a bug.');
    return;
    
    // DEAD CODE BELOW - keeping for reference but should never execute
    const monsterData = monsterTypes[monsterType];
    if (!monsterData) {
        console.error(`Attempted to spawn unknown monster type: ${monsterType}`);
        return;
    }

    const map = maps[currentMapId];
    if (!map) return;

    const scaledTileSize = 16 * PIXEL_ART_SCALE;
    const baseGroundY = (map.height || GAME_CONFIG.BASE_GAME_HEIGHT) - GAME_CONFIG.GROUND_Y;

    // Helper function to check if a point is inside a hill/slope
    function isPointInsideHill(x, map, groundY) {
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

    // Build spawn surfaces list - ONLY platforms and ground (NOT structures)
    // CRITICAL: All Y values must match exactly what collision detection uses
    const allSpawnSurfaces = [];
    
    // Add ground
    allSpawnSurfaces.push({ 
        x: 0, 
        y: baseGroundY, 
        width: map.width, 
        isGround: true,
        surfaceType: 'ground'
    });
    
    // Add platforms - these use top surface for collision
    if (map.platforms) {
        for (const p of map.platforms) {
            if (!p.noSpawn && p.width >= 150) {
                allSpawnSurfaces.push({
                    x: p.x,
                    y: p.y + GROUND_LEVEL_OFFSET, // Top surface Y (collision Y)
                    width: p.width,
                    isGround: false,
                    surfaceType: 'platform'
                });
            }
        }
    }
    
    // Add structures - they also function as platforms
    // CRITICAL: Structures need height added to get TOP collision surface
    if (map.structures) {
        for (const s of map.structures) {
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
                console.log(`[SPAWN SURFACE] Structure at data Y=${s.y} → collision Y=${structureTopY}`);
            }
        }
    }

    if (allSpawnSurfaces.length === 0) {
        console.warn(`[Spawn] No valid spawn surfaces for ${monsterType} in ${currentMapId}`);
        return;
    }

    // Pick a random surface
    const spawnPoint = allSpawnSurfaces[Math.floor(Math.random() * allSpawnSurfaces.length)];

    // Calculate anchorY (where monster's "feet" are within sprite)
    let anchorY;
    if (monsterData.usesPlayerSprite) {
        anchorY = 60;
    } else if (monsterData.isPixelArt && spriteData[monsterType]?.anchorPoint) {
        anchorY = spriteData[monsterType].anchorPoint.y * PIXEL_ART_SCALE;
    } else {
        anchorY = monsterData.height || 55;
    }

    // Calculate spawn position
    const padding = monsterData.width || 48;
    let spawnX, spawnY;
    let attempts = 0;
    const maxAttempts = 10;

    // Try to find a spawn position that's not inside a hill (only for ground level)
    do {
        spawnX = spawnPoint.x + padding + Math.random() * (spawnPoint.width - padding * 2);
        spawnY = spawnPoint.y - anchorY; // Spawn Y = Surface Y - anchor offset
        attempts++;
    } while (spawnPoint.isGround && isPointInsideHill(spawnX, map, baseGroundY) && attempts < maxAttempts);

    // If still inside hill, use slope surface
    if (spawnPoint.isGround && isPointInsideHill(spawnX, map, baseGroundY)) {
        const slopeSurfaceY = getSlopeSurfaceY(spawnX, map, baseGroundY, scaledTileSize);
        if (slopeSurfaceY !== null && slopeSurfaceY < baseGroundY) {
            spawnY = slopeSurfaceY - anchorY;
        }
    }

    // Use the visual spawn effect and delayed creation for a better player experience.
    createPixelArtEffect('spawnEffect', spawnX, spawnY, monsterData.width, monsterData.height);
    setTimeout(() => {
        createMonster(monsterType, spawnX, spawnY);
    }, 350);
}

function changeMap(mapId, spawnX, spawnY) {
    // Prevent leaving world boss arena while event is active (unless bypass flag is set for death warp)
    if (currentMapId === 'worldBossArena' && typeof worldBossEventActive !== 'undefined' && worldBossEventActive && !window.bypassWorldBossLeaveCheck) {
        if (mapId !== 'worldBossArena') {
            showNotification('You cannot leave during the World Boss battle!', 'warning');
            return;
        }
    }
    
    if (currentMapId && isGameActive) {
        saveMapState(currentMapId);
        cleanupCurrentMap();
    }

    const map = maps[mapId];
    if (!map) {
        console.error(`!!! MAP NOT FOUND: Could not find data for mapId "${mapId}" in maps object.`);
        return;
    }

    updateAchievementProgress('explore', mapId);

    if (!player.discoveredMaps || typeof player.discoveredMaps.add !== 'function') {
        if (Array.isArray(player.discoveredMaps)) {
            player.discoveredMaps = new Set(player.discoveredMaps);
        } else {
            player.discoveredMaps = new Set();
        }
    }
    player.discoveredMaps.add(mapId);
    
    // Check for Sky Palace Pioneer medal (first to enter Sky Palace)
    if ((mapId.startsWith('skypalace') || mapId.startsWith('toyFactory') || mapId.startsWith('clockTower') || mapId.startsWith('deepskyPalace') || mapId.startsWith('ominousTower')) && typeof checkskyPalaceMedals === 'function') {
        checkskyPalaceMedals('enter_skyPalace');
    }

    [...worldContent.querySelectorAll('.monster, .item-drop, .portal, .parallax-bg, .npc, .projectile, .platform, .attack-box, .portal-label, .ladder, .debug-hitbox, .scenery, .cloud, .ghost-player, .remote-player')].forEach(el => {
        if (el.parentElement === worldContent) {
            el.remove();
        }
    });

    monsters = []; droppedItems = []; portals = []; parallaxBgs = []; npcs = [];
    projectiles = []; platforms = []; monsterSpawners = []; activeAttacks = []; sceneryObjects = []; clouds = [];
    
    // Clear spatial grid to prevent monsters from persisting in collision detection
    if (typeof spatialGrid !== 'undefined') {
        spatialGrid.clear();
        console.log('[MapChange] Spatial grid cleared');
    }

    currentMapId = mapId;
    player.currentMapId = mapId;

    worldContent.style.width = `${map.width}px`;
    worldContent.style.height = `${map.height || GAME_CONFIG.BASE_GAME_HEIGHT}px`;

    worldContent.style.backgroundImage = 'none';
    if (map.background && map.background.startsWith('data:')) {
        worldContent.style.backgroundImage = `url("${map.background}")`;
        worldContent.style.backgroundSize = 'cover';
        worldContent.style.backgroundRepeat = 'no-repeat';
        worldContent.style.backgroundColor = '';
    } else if (map.backgroundColor) {
        worldContent.style.backgroundColor = map.backgroundColor;
    } else if (map.background) {
        worldContent.style.backgroundColor = map.background;
    }

    // Add/update background gradient overlay for darkening effect
    let bgGradientOverlay = document.getElementById('bg-gradient-overlay');
    if (!bgGradientOverlay) {
        bgGradientOverlay = document.createElement('div');
        bgGradientOverlay.id = 'bg-gradient-overlay';
        worldContent.insertBefore(bgGradientOverlay, worldContent.firstChild);
    }

    groundElement.style.display = 'block';

    if (currentMapId === 'onyxCityJumpQuest') {
        player.speed = 3.0;
        player.jumpForce = -11;
    } else {
        player.speed = player.originalSpeed;
        player.jumpForce = player.originalJumpForce;
    }

    if (map.parallax) {
        map.parallax.forEach(layer => {
            const bgEl = document.createElement('div');
            bgEl.className = 'parallax-bg';
            bgEl.style.backgroundImage = `url("${layer.src}")`;
            bgEl.style.height = `${layer.height || '100%'}px`;
            bgEl.style.top = `${layer.y || 0}px`;
            bgEl.style.width = `${map.width}px`;
            bgEl.style.maxWidth = `${map.width}px`;
            bgEl.style.overflow = 'hidden';

            if (layer.scale) {
                bgEl.style.transform = `scale(${layer.scale})`;
            }

            worldContent.insertBefore(bgEl, worldContent.firstChild);
            parallaxBgs.push({ element: bgEl, speed: layer.speed });
        });
    }

    // Spawn clouds on every map
    const cloudTypes = ['cloud01', 'cloud02', 'cloud03'];
    const numClouds = Math.floor(map.width / 400) + 3; // ~1 cloud per 400px + 3 extra
    const mapHeight = map.height || GAME_CONFIG.BASE_GAME_HEIGHT;
    
    // Calculate cloud tint based on map background color
    const cloudTint = getCloudTintFromBackground(map.background || map.backgroundColor || '#87CEEB');
    
    for (let i = 0; i < numClouds; i++) {
        const cloudType = cloudTypes[Math.floor(Math.random() * cloudTypes.length)];
        const cloudEl = document.createElement('img');
        cloudEl.className = 'cloud pixel-art';
        cloudEl.src = artAssets[cloudType];
        cloudEl.style.position = 'absolute';
        cloudEl.style.zIndex = '2'; // Above parallax (1) but below gameplay elements (10+)
        cloudEl.style.pointerEvents = 'none';
        cloudEl.style.imageRendering = 'pixelated';
        
        // Apply cloud tint filter
        cloudEl.style.filter = cloudTint;
        
        // Random horizontal flip
        const flipX = Math.random() > 0.5 ? -1 : 1;
        cloudEl.style.transform = `scale(${PIXEL_ART_SCALE * flipX}, ${PIXEL_ART_SCALE})`;
        cloudEl.style.transformOrigin = 'top left';
        
        // Random positioning
        const cloudX = Math.random() * map.width;
        const cloudY = Math.random() * (mapHeight * 0.4); // Upper 40% of map
        const cloudSpeed = 0.1 + Math.random() * 0.2; // Speed: 0.1-0.3 px/frame
        
        cloudEl.style.left = `${cloudX}px`;
        cloudEl.style.top = `${cloudY}px`;
        
        worldContent.appendChild(cloudEl);
        clouds.push({
            element: cloudEl,
            x: cloudX,
            y: cloudY,
            speed: cloudSpeed,
            width: 128 * PIXEL_ART_SCALE, // Scaled cloud width
            type: cloudType
        });
    }

    if (map.ladders) {
        map.ladders.forEach(l => {
            const hitboxY = l.y1 + GROUND_LEVEL_OFFSET - 10;
            const adjustedY2 = l.y2 + GROUND_LEVEL_OFFSET - 20;
            const hitboxHeight = adjustedY2 - hitboxY;

            const ladderHitbox = document.createElement('div');
            ladderHitbox.className = 'debug-hitbox debug-hitbox-ladder';
            ladderHitbox.style.left = `${l.x}px`;
            ladderHitbox.style.top = `${hitboxY}px`;
            ladderHitbox.style.width = `32px`;
            ladderHitbox.style.height = `${hitboxHeight}px`;
            worldContent.appendChild(ladderHitbox);
            if (showHitboxes) ladderHitbox.style.display = 'block';

            platforms.push({ ...l, y1: hitboxY, y2: adjustedY2, isLadder: true, hitboxElement: ladderHitbox });
        });
    }

    // Add both platforms and structures to collision array
    const scaledTileSize = spriteData.ground.tileSize * PIXEL_ART_SCALE;

    const allSurfaces = [...(map.platforms || []), ...(map.structures || [])];
    allSurfaces.forEach(pData => {
        const pEl = document.createElement('div');
        pEl.className = 'platform';
        const snappedX = Math.round(pData.x);
        const snappedY = Math.round(pData.y + GROUND_LEVEL_OFFSET);
        const numTiles = Math.round(pData.width / scaledTileSize);
        const finalWidth = Math.max(1, numTiles) * scaledTileSize;

        pEl.style.left = `${snappedX}px`;
        pEl.style.top = `${snappedY}px`;
        pEl.style.width = `${finalWidth}px`;
        worldContent.appendChild(pEl);

        const platformHitbox = document.createElement('div');
        platformHitbox.className = 'debug-hitbox';
        platformHitbox.style.left = `${snappedX + PLATFORM_EDGE_PADDING}px`;
        platformHitbox.style.top = `${snappedY}px`;
        platformHitbox.style.width = `${finalWidth - (PLATFORM_EDGE_PADDING * 2)}px`;
        platformHitbox.style.height = `20px`;
        worldContent.appendChild(platformHitbox);
        if (showHitboxes) platformHitbox.style.display = 'block';

        platforms.push({
            ...pData,
            x: snappedX,
            y: snappedY,
            width: finalWidth,
            element: pEl,
            height: 20,
            hitboxElement: platformHitbox
        });
    });

    // --- FIX: Player position is now set AFTER platforms are created ---
    const requestedX = spawnX;
    const requestedY = spawnY !== undefined ? spawnY + GROUND_LEVEL_OFFSET : undefined;

    const safePosition = findSafeSpawnPosition(requestedX, requestedY);
    player.x = safePosition.x;
    player.y = safePosition.y;
    
    // Force respawn pet to ensure it's visible and properly initialized
    if (player.activePet && player.activePet.isSpawned) {
        // Remove existing pet elements to force a clean recreation
        const existingPet = document.getElementById('player-pet');
        if (existingPet) {
            existingPet.remove();
        }
        const existingNameplate = document.getElementById('pet-nameplate');
        if (existingNameplate) {
            existingNameplate.remove();
        }
        
        // Reset pet position and physics
        player.activePet.x = player.x - 60;
        player.activePet.y = player.y;
        player.activePet.velocityY = 0;
        player.activePet.isJumping = false;
        player.activePet.previousY = player.y;
        player.activePet.animationFrame = 0;
        player.activePet.animationTimer = 0;
        
        // Clear cached image element to force reload
        delete player.activePet.imageElement;
    }
    // --- END OF FIX ---

    cameraX = player.x - (scalingContainer.clientWidth / 2);

    if (currentMapId === 'onyxCityJumpQuest') {
        cameraY = player.y - (scalingContainer.clientHeight / 2);
    } else {
        const mapHeight = map.height || GAME_CONFIG.BASE_GAME_HEIGHT;
        const groundLevel = mapHeight - GAME_CONFIG.GROUND_Y;
        const distanceFromGround = Math.max(0, groundLevel - player.y);
        const maxOffsetDistance = 200;
        const offsetMultiplier = Math.max(0, Math.min(1, distanceFromGround / maxOffsetDistance));
        const verticalOffset = (scalingContainer.clientHeight * 0.15) * offsetMultiplier;

        cameraY = player.y - (scalingContainer.clientHeight / 2) - verticalOffset;
    }

    // (The rest of the function continues from here)
    if (map.scenery) {
        map.scenery.forEach(s => createScenery(s.type, s.x, s.y));
    }

    if (map.npcs) {
        map.npcs.forEach(n => createNpc(n.type, n.x, n.y));
    }

    if (map.portals) {
        map.portals.forEach(p => {
            const portalData = spriteData.portal;
            const portalEl = document.createElement('div');
            portalEl.className = 'portal pixel-art';
            const pWidth = portalData.frameWidth * PIXEL_ART_SCALE;
            const pHeight = portalData.frameHeight * PIXEL_ART_SCALE;
            portalEl.style.width = `${pWidth}px`;
            portalEl.style.height = `${pHeight}px`;
            portalEl.style.backgroundImage = `url(${artAssets.portal})`;
            const sheetWidth = portalData.frameWidth * portalData.animations.idle.length * PIXEL_ART_SCALE;
            const sheetHeight = portalData.frameHeight * PIXEL_ART_SCALE;
            portalEl.style.backgroundSize = `${sheetWidth}px ${sheetHeight}px`;
            if (p.isHidden) {
                portalEl.style.opacity = '0';
            }
            const surfaceY = (p.y !== undefined ? p.y + GROUND_LEVEL_OFFSET : undefined) || (map.height || GAME_CONFIG.BASE_GAME_HEIGHT) - GAME_CONFIG.GROUND_Y;
            const finalY = surfaceY - pHeight;
            const arrowEl = document.createElement('div');
            arrowEl.className = 'portal-arrow-prompt pixel-art';
            arrowEl.style.width = `${spriteData.questIcons.frameWidth * PIXEL_ART_SCALE}px`;
            arrowEl.style.height = `${spriteData.questIcons.frameHeight * PIXEL_ART_SCALE}px`;
            arrowEl.dataset.anim = 'arrowEffect';
            arrowEl.animationFrame = 0;
            arrowEl.animationTimer = 0;
            portalEl.appendChild(arrowEl);
            const portalHitbox = document.createElement('div');
            portalHitbox.className = 'debug-hitbox';
            worldContent.appendChild(portalHitbox);
            portals.push({
                ...p,
                element: portalEl,
                arrowElement: arrowEl,
                x: p.x,
                y: finalY,
                width: pWidth,
                height: pHeight,
                hitboxElement: portalHitbox,
                animationFrame: 0,
                animationTimer: 0
            });
            worldContent.appendChild(portalEl);
            if (p.label) {
                const labelEl = document.createElement('div');
                labelEl.className = 'portal-label';
                labelEl.textContent = p.label;
                portalEl.appendChild(labelEl);
            }
        });
    }

    // SERVER-ONLY MODE: Server handles ALL monsters
    // Never restore monsters from worldState - server will send current monsters
    // Only restore dropped items (they're client-side for now)
    if (worldState[mapId]) {
        worldState[mapId].droppedItems.forEach(itemState => createItemDrop(itemState.name, itemState.x, itemState.y, itemState));
    }
    
    // Save initial map state (for dropped items tracking)
    if (!worldState[mapId]) {
        saveMapState(mapId);
    }

    // Validate monsters - remove any that don't belong on this map
    validateMonstersForMap(mapId);

    // SERVER-ONLY MODE: No local spawners - server handles all respawning
    // monsterSpawners array stays empty

    minimap.innerHTML = '';
    minimapContent = document.createElement('div');
    minimapContent.style.position = 'relative';
    minimap.appendChild(minimapContent);

    drawTiledLayers();

    const bgFoliageCanvas = document.getElementById('foliage-background-canvas');
    const fgFoliageCanvas = document.getElementById('foliage-foreground-canvas');
    const bgCtx = bgFoliageCanvas.getContext('2d');
    const fgCtx = fgFoliageCanvas.getContext('2d');
    bgFoliageCanvas.width = fgFoliageCanvas.width = map.width;
    bgFoliageCanvas.height = fgFoliageCanvas.height = map.height || GAME_CONFIG.BASE_GAME_HEIGHT;
    bgCtx.clearRect(0, 0, bgFoliageCanvas.width, bgFoliageCanvas.height);
    fgCtx.clearRect(0, 0, fgFoliageCanvas.width, fgFoliageCanvas.height);

    if (foliageData[mapId]) {
        bgCtx.drawImage(foliageData[mapId].background, 0, 0);
        fgCtx.drawImage(foliageData[mapId].foreground, 0, 0);
    }

    playBGM(map.bgm);
    reapplyBuffs();
    
    // Update online presence when changing maps (this is the only time presence updates)
    if (typeof updatePresence === 'function') {
        updatePresence();
    }
    
    // Notify game server of map change for real-time multiplayer
    if (typeof notifyMapChange === 'function') {
        notifyMapChange(mapId, player.x, player.y);
    }
    
    // Spawn ghost players on the new map
    if (typeof spawnGhostPlayersOnMap === 'function') {
        spawnGhostPlayersOnMap();
    }
}

/**
 * Generates all platform elements for a map.
 * @param {Array<object>} platformData - The array of platform definitions from the map data.
 */
function createPlatforms(platformData) {
    const scaledTileSize = spriteData.ground.tileSize * PIXEL_ART_SCALE;
    platformData.forEach(pData => {
        const pEl = document.createElement('div');
        pEl.className = 'platform';
        const numTiles = Math.round(pData.width / scaledTileSize);
        const finalWidth = Math.max(1, numTiles) * scaledTileSize;
        
        // Apply ground level offset to maintain original map layout
        const adjustedY = pData.y + GROUND_LEVEL_OFFSET;
        
        pEl.style.left = `${pData.x}px`;
        pEl.style.top = `${adjustedY}px`;
        pEl.style.width = `${finalWidth}px`;
        worldContent.appendChild(pEl);

        const platformHitbox = document.createElement('div');
        platformHitbox.className = 'debug-hitbox';
        platformHitbox.style.left = `${pData.x + PLATFORM_EDGE_PADDING}px`;
        platformHitbox.style.top = `${adjustedY}px`;
        platformHitbox.style.width = `${finalWidth - (PLATFORM_EDGE_PADDING * 2)}px`;
        platformHitbox.style.height = `20px`;
        worldContent.appendChild(platformHitbox);

        platforms.push({ ...pData, y: adjustedY, width: finalWidth, element: pEl, height: 20, hitboxElement: platformHitbox });
    });
}

/**
 * Generates all ladder elements for a map.
 * @param {Array<object>} ladderData - The array of ladder definitions.
 */
function createLadders(ladderData) {
    ladderData.forEach(l => {
        const ladderEl = document.createElement('div');
        ladderEl.className = 'ladder';
        ladderEl.style.left = `${l.x}px`;
        ladderEl.style.top = `${l.y1 + GROUND_LEVEL_OFFSET}px`;
        ladderEl.style.height = `${l.y2 - l.y1}px`;
        ladderEl.style.backgroundImage = `url(${artAssets.ladder})`;
        worldContent.appendChild(ladderEl);
        platforms.push({ ...l, y1: l.y1 + GROUND_LEVEL_OFFSET, y2: l.y2 + GROUND_LEVEL_OFFSET, isLadder: true });
    });
}

/**
 * Generates all portal elements for a map.
 * @param {Array<object>} portalData - The array of portal definitions.
 */
function createPortals(portalData) {
    portalData.forEach(p => {
        const pData = spriteData.portal;
        const pEl = document.createElement('div');
        pEl.className = 'portal pixel-art';
        const pWidth = pData.frameWidth * PIXEL_ART_SCALE;
        const pHeight = pData.frameHeight * PIXEL_ART_SCALE;
        pEl.style.width = `${pWidth}px`;
        pEl.style.height = `${pHeight}px`;
        pEl.style.backgroundImage = `url(${artAssets.portal})`;
        const sheetWidth = pData.frameWidth * pData.animations.idle.length * PIXEL_ART_SCALE;
        pEl.style.backgroundSize = `${sheetWidth}px ${pData.frameHeight * PIXEL_ART_SCALE}px`;

        const surfaceY = p.y || (maps[currentMapId].height || GAME_CONFIG.BASE_GAME_HEIGHT) - GAME_CONFIG.GROUND_Y;
        const finalY = surfaceY - pHeight;

        const arrowEl = document.createElement('div');
        arrowEl.className = 'portal-arrow-prompt pixel-art';
        arrowEl.style.width = `${spriteData.questIcons.frameWidth * PIXEL_ART_SCALE}px`;
        arrowEl.style.height = `${spriteData.questIcons.frameHeight * PIXEL_ART_SCALE}px`;
        arrowEl.dataset.anim = 'arrowEffect';
        pEl.appendChild(arrowEl);

        if (p.label) {
            const labelEl = document.createElement('div');
            labelEl.className = 'portal-label';
            labelEl.textContent = p.label;
            pEl.appendChild(labelEl);
        }

        worldContent.appendChild(pEl);
        portals.push({ ...p, element: pEl, arrowElement: arrowEl, x: p.x, y: finalY, width: pWidth, height: pHeight, animationFrame: 0, animationTimer: 0 });
    });
}

// in game.js

function createScenery(type, x, y) {
    const sceneryData = spriteData[type];
    if (!sceneryData) {
        console.error(`Scenery type "${type}" not found in spriteData.`);
        return;
    }

    const el = document.createElement('div');
    el.className = 'scenery pixel-art';

    const sWidth = sceneryData.frameWidth * PIXEL_ART_SCALE;
    const sHeight = sceneryData.frameHeight * PIXEL_ART_SCALE;

    el.style.width = `${sWidth}px`;
    el.style.height = `${sHeight}px`;
    el.style.backgroundImage = `url(${artAssets[type]})`;
    el.style.left = `${x}px`;
    el.style.top = `${y + GROUND_LEVEL_OFFSET}px`;

    // --- THIS IS THE FIX ---
    // Prevent the background from tiling
    el.style.backgroundRepeat = 'no-repeat';
    // Scale the background image to fill the entire element
    el.style.backgroundSize = '100% 100%';
    // --- END OF FIX ---

    worldContent.appendChild(el);
    sceneryObjects.push({ element: el, x, y });
}

/**
 * Renders an NPC using the player sprite system (same as ghost players)
 * This allows NPCs to have customizable appearances with equipment
 */
function renderNpcSprite(npc) {
    if (!npc.customization || !npc.equipped) return;
    
    // Create sprite container if it doesn't exist
    if (!npc.spriteContainer) {
        npc.spriteContainer = document.createElement('div');
        npc.spriteContainer.style.position = 'absolute';
        npc.spriteContainer.style.width = '60px';
        npc.spriteContainer.style.height = '60px';
        npc.spriteContainer.style.top = '0';
        npc.spriteContainer.style.left = '0';
        npc.element.insertBefore(npc.spriteContainer, npc.element.firstChild);
    }

    // Create canvas if it doesn't exist
    let canvas = npc.spriteContainer.querySelector('canvas');
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
        npc.spriteContainer.appendChild(canvas);
    }

    // Create hair tint canvas if needed
    if (!npc.hairTintCanvas) {
        npc.hairTintCanvas = document.createElement('canvas');
        npc.hairTintCanvas.width = canvas.width;
        npc.hairTintCanvas.height = canvas.height;
        npc.hairTintCtx = npc.hairTintCanvas.getContext('2d', { willReadFrequently: true });
        npc.hairTintCtx.imageSmoothingEnabled = false;
    }

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pData = spriteData.player;
    const anim = pData.animations[npc.animationState] || pData.animations.idle;
    const frameIndex = npc.animationFrame % anim.length;
    const frame = anim[frameIndex];

    ctx.save();
    if (npc.facing === 'left') {
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
    }

    // Use draw queue system (same as player/ghost)
    const drawQueue = [];

    // Add body layers
    const skinY = pData.frameHeight * (npc.customization.skinTone + 1);
    drawQueue.push({ type: 'body', zLevel: 1, source: playerSheetImage, sx: frame.x, sy: skinY, sWidth: pData.frameWidth, sHeight: pData.frameHeight });
    drawQueue.push({ type: 'body', zLevel: 5, source: playerSheetImage, sx: frame.x, sy: 0, sWidth: pData.frameWidth, sHeight: pData.frameHeight });

    // Add eyes
    if (npc.animationState !== 'climb' && frame.attachments?.eyes) {
        const faceItem = npc.equipped.face;
        const shouldHideEyes = faceItem && itemData[faceItem] && itemData[faceItem].hideEyes;

        if (!shouldHideEyes) {
            const eyeData = spriteData.playerEyes;
            const eyeSourceX = npc.isBlinking ? eyeData.frameWidth : 0;
            const eyeSourceY = eyeData.frameHeight * npc.customization.eyeColor;
            drawQueue.push({ type: 'eyes', zLevel: 10, source: playerEyesSheet, sx: eyeSourceX, sy: eyeSourceY, sWidth: eyeData.frameWidth, sHeight: eyeData.frameHeight, attachment: frame.attachments.eyes });
        }
    }

    // Add equipment
    const equipmentSheetData = spriteData.playerEquipment;
    const allSlots = ['cape', 'bottom', 'shoes', 'top', 'pendant', 'earring', 'gloves', 'helmet', 'weapon', 'face', 'eye'];
    allSlots.forEach(slot => {
        const itemName = npc.equipped[slot];
        if (itemName && equipmentSheetData.coords[itemName]) {
            const itemInfo = itemData[itemName];
            if (!itemInfo) return;
            const itemCoords = equipmentSheetData.coords[itemName];
            const sourceX = itemCoords.x + frame.x;
            const sourceY = itemCoords.y;
            let zLevel = itemInfo.zLevel;
            if (itemInfo.zLevelOverrides && itemInfo.zLevelOverrides[npc.animationState]) {
                zLevel = itemInfo.zLevelOverrides[npc.animationState];
            }
            
            drawQueue.push({ type: 'equip', zLevel: zLevel, source: playerEquipmentSheet, sx: sourceX, sy: sourceY, sWidth: pData.frameWidth, sHeight: pData.frameHeight });
        }
    });

    // Add hair - check if helmet hides hair
    const helmet = npc.equipped?.helmet;
    const helmetHidesHair = helmet && itemData[helmet]?.hidesHair;
    const hairStyleIndex = npc.customization.hairStyle || 0;
    const hairInfo = spriteData.playerHair[hairStyleIndex];
    const hairWorksWithHats = hairInfo?.worksWithHats;
    
    if (npc.customization && playerHairSheet && playerHairSheet.complete && (!helmetHidesHair || hairWorksWithHats)) {
        if (hairInfo && hairInfo.name !== 'Bald') {
            const hairColor = customizationOptions.hairColors[npc.customization.hairColor || 0];
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
            npc.hairTintCtx.clearRect(0, 0, canvas.width, canvas.height);
            npc.hairTintCtx.drawImage(item.source, item.sx, item.sy, item.sWidth, item.sHeight, destX, destY, destWidth, destHeight);

            const imageData = npc.hairTintCtx.getImageData(0, 0, canvas.width, canvas.height);
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
            npc.hairTintCtx.putImageData(imageData, 0, 0);
            ctx.drawImage(npc.hairTintCanvas, 0, 0);
        } else {
            ctx.drawImage(item.source, item.sx, item.sy, item.sWidth, item.sHeight, destX, destY, destWidth, destHeight);
        }
    });

    ctx.restore();
}

/**
 * Updates NPC animation state and blinking
 */
function updateNpcAnimation(npc) {
    if (!npc.usesPlayerSprite) return;
    
    // Update blink animation
    const BLINK_INTERVAL_MIN = 180, BLINK_INTERVAL_MAX = 480, BLINK_DURATION = 8;
    if (npc.isBlinking) {
        if (--npc.blinkDurationTimer <= 0) npc.isBlinking = false;
    } else {
        if (--npc.blinkTimer <= 0) {
            npc.isBlinking = true;
            npc.blinkDurationTimer = BLINK_DURATION;
            npc.blinkTimer = Math.floor(Math.random() * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN + 1)) + BLINK_INTERVAL_MIN;
        }
    }
    
    // NPCs stay in idle animation
    npc.animationState = 'idle';
    
    // Frame animation timing (same as player - every 12 game ticks)
    npc.animationTimer++;
    if (npc.animationTimer > 12) {
        npc.animationTimer = 0;
        const anim = spriteData.player.animations[npc.animationState];
        if (anim) {
            npc.animationFrame = (npc.animationFrame + 1) % anim.length;
        }
    }
    
    // Render the NPC sprite
    renderNpcSprite(npc);
}

function createNpc(type, x, y) {
    const npcInfo = npcData[type];
    if (!npcInfo) {
        console.error(`NPC type "${type}" not found in npcData.`);
        return;
    }

    const el = document.createElement('div');
    el.className = 'npc';

    let npcWidth = 60;
    let npcHeight = 60;
    let isPixelArt = false;
    let usesPlayerSprite = false;
    
    // Check if this NPC has custom appearance data (player-style sprites)
    const appearance = typeof npcAppearances !== 'undefined' ? npcAppearances[type] : null;
    
    if (appearance) {
        // Use player sprite system for this NPC
        usesPlayerSprite = true;
        isPixelArt = true;
        const pData = spriteData.player;
        npcWidth = 60; // Match player width
        npcHeight = 60; // Match player height
        el.classList.add('pixel-art');
        el.classList.add('player-sprite');
        el.style.width = `${npcWidth}px`;
        el.style.height = `${npcHeight}px`;
        el.style.pointerEvents = 'auto';
    } else if (spriteData[type]) {
        // Check if this NPC has its own pixel art sprite data (like mrSalami)
        isPixelArt = true;
        const sData = spriteData[type];
        npcWidth = sData.frameWidth * PIXEL_ART_SCALE;
        npcHeight = sData.frameHeight * PIXEL_ART_SCALE;
        el.classList.add('pixel-art');
        el.style.width = `${npcWidth}px`;
        el.style.height = `${npcHeight}px`;
        el.style.backgroundImage = `url(${artAssets[type]})`;
        const sheetWidth = sData.frameWidth * sData.animations.idle.length * PIXEL_ART_SCALE;
        el.style.backgroundSize = `${sheetWidth}px ${sData.frameHeight * PIXEL_ART_SCALE}px`;
    } else {
        // SVG-based NPCs (fallback for special NPCs like prizeBox)
        if (type === 'prizeBox' || type === 'skyPalacePrizeBox') {
            npcWidth = 50;
            npcHeight = 50;
        }
        el.style.width = `${npcWidth}px`;
        el.style.height = `${npcHeight}px`;

        // Create a dedicated container for the SVG sprite for stability
        if (npcInfo.sprite) {
            const spriteContainer = document.createElement('div');
            spriteContainer.style.width = '100%';
            spriteContainer.style.height = '100%';
            spriteContainer.innerHTML = npcInfo.sprite;
            el.appendChild(spriteContainer);
        }
    }

    // Create and append all necessary UI elements
    const nameplateEl = document.createElement('div');
    nameplateEl.className = 'npc-nameplate';
    nameplateEl.textContent = npcInfo.name;
    el.appendChild(nameplateEl);

    const promptEl = document.createElement('div');
    promptEl.className = 'npc-interaction-prompt';
    promptEl.textContent = '[]';
    el.appendChild(promptEl);

    const indicatorContainer = document.createElement('div');
    indicatorContainer.className = 'npc-quest-indicator pixel-art';
    el.appendChild(indicatorContainer);

    // Use the robust positioning logic
    // For player-sprite NPCs, use same anchor as player (55 pixels from top of 60px element)
    const playerSpriteAnchorY = 55;
    let spawnY;
    if (y !== undefined) {
        // For NPCs on platforms, Y is the surface level
        if (usesPlayerSprite) {
            // Use same anchor point as player/ghost (feet at 55px from top)
            spawnY = y + GROUND_LEVEL_OFFSET - playerSpriteAnchorY;
        } else if (isPixelArt && spriteData[type]?.anchorPoint) {
            const anchorY = spriteData[type].anchorPoint.y * PIXEL_ART_SCALE;
            spawnY = y + GROUND_LEVEL_OFFSET - anchorY;
        } else {
            spawnY = y + GROUND_LEVEL_OFFSET - npcHeight;
        }
    } else {
        // For NPCs without a Y, place them on the main ground
        if (usesPlayerSprite) {
            // Use same anchor point as player/ghost (feet at 55px from top)
            spawnY = (maps[currentMapId].height || GAME_CONFIG.BASE_GAME_HEIGHT) - GAME_CONFIG.GROUND_Y - playerSpriteAnchorY;
        } else if (isPixelArt && spriteData[type]?.anchorPoint) {
            const anchorY = spriteData[type].anchorPoint.y * PIXEL_ART_SCALE;
            spawnY = (maps[currentMapId].height || GAME_CONFIG.BASE_GAME_HEIGHT) - GAME_CONFIG.GROUND_Y - anchorY;
        } else {
            spawnY = (maps[currentMapId].height || GAME_CONFIG.BASE_GAME_HEIGHT) - GAME_CONFIG.GROUND_Y - npcHeight;
        }
    }

    el.style.top = `${spawnY}px`;
    el.style.left = `${x}px`;
    el.style.cursor = 'pointer'; // Indicate NPC is clickable

    worldContent.appendChild(el);

    // Create the NPC object first so we can reference it in the event listener
    const npcObject = {
        ...npcInfo,
        id: type,
        type: type,
        x,
        y: spawnY,
        width: npcWidth,
        height: npcHeight,
        element: el,
        promptElement: promptEl,
        questIndicatorContainer: indicatorContainer,
        yOffset: 0,
        isPixelArt: isPixelArt,
        usesPlayerSprite: usesPlayerSprite,
        customization: appearance?.customization || null,
        equipped: appearance?.equipped || null,
        animationFrame: 0,
        animationTimer: 0,
        animationState: 'idle',
        direction: 1,
        facing: 'right',
        isBlinking: false,
        blinkTimer: Math.floor(Math.random() * 300) + 180,
        blinkDurationTimer: 0
    };
    
    // Initial render for player-sprite NPCs
    if (usesPlayerSprite) {
        renderNpcSprite(npcObject);
    }

    // Add double-click interaction for NPC
    el.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Allow NPC interaction even with other windows open - only block if dialogue is already open
        const dialogueWindow = document.getElementById('dialogue-window');
        const isDialogueOpen = dialogueWindow && dialogueWindow.style.display !== 'none';

        if (!player.isDead && !isDialogueOpen) {
            openDialogue(npcObject);
        }
    });

    // Push the NPC object to the array
    npcs.push(npcObject);
}

function drawTiledLayers() {
    const map = maps[currentMapId];
    const groundCanvas = document.getElementById('ground-canvas');
    const platformsCanvas = document.getElementById('platforms-canvas');

    groundCanvas.width = platformsCanvas.width = map.width;
    groundCanvas.height = platformsCanvas.height = map.height || GAME_CONFIG.BASE_GAME_HEIGHT;

    const groundCtx = groundCanvas.getContext('2d');
    const platCtx = platformsCanvas.getContext('2d');

    groundCtx.imageSmoothingEnabled = false;
    platCtx.imageSmoothingEnabled = false;

    groundCtx.clearRect(0, 0, groundCanvas.width, groundCanvas.height);
    platCtx.clearRect(0, 0, platformsCanvas.width, platformsCanvas.height);
    
    // Clear old slope hitboxes
    slopeHitboxes.forEach(s => { if (s.element) s.element.remove(); });
    slopeHitboxes = [];

    const currentTileSet = tileSets[map.groundType] || tileSets.grass;
    const tileSize = spriteData.ground.tileSize;
    const scaledTileSize = tileSize * PIXEL_ART_SCALE;
    const groundSurfaceY = (map.height || GAME_CONFIG.BASE_GAME_HEIGHT) - GAME_CONFIG.GROUND_Y;

    // Step 1: Draw the background part of SOLID STRUCTURES on the BACK canvas.
    // Sort structures by z-layer (lowest first) so they render in correct order
    const sortedStructures = [...(map.structures || [])].sort((a, b) => (a.z || 0) - (b.z || 0));
    
    sortedStructures.forEach(structure => {
        const sX = Math.round(structure.x);
        const sY = Math.round(structure.y + GROUND_LEVEL_OFFSET);
        const numTilesWide = Math.round(structure.width / scaledTileSize);
        if (numTilesWide < 1) return;
        const sideEdgeTile = currentTileSet.backgroundEdge;
        const sideFillTile = currentTileSet.background;
        const columnTopY = sY + scaledTileSize;
        const columnBottomY = map.height || GAME_CONFIG.BASE_GAME_HEIGHT;
        for (let currentY = columnTopY; currentY < columnBottomY; currentY += scaledTileSize) {
            if (numTilesWide > 1) {
                groundCtx.drawImage(tilesetImage, sideEdgeTile.x, sideEdgeTile.y, tileSize, tileSize, sX, currentY, scaledTileSize, scaledTileSize);
                for (let col = 1; col < numTilesWide - 1; col++) {
                    groundCtx.drawImage(tilesetImage, sideFillTile.x, sideFillTile.y, tileSize, tileSize, sX + (col * scaledTileSize), currentY, scaledTileSize, scaledTileSize);
                }
                const rightEdgeX = sX + (numTilesWide - 1) * scaledTileSize;
                groundCtx.save();
                groundCtx.translate(rightEdgeX + scaledTileSize, currentY);
                groundCtx.scale(-1, 1);
                groundCtx.drawImage(tilesetImage, sideEdgeTile.x, sideEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                groundCtx.restore();
            } else {
                groundCtx.drawImage(tilesetImage, sideFillTile.x, sideFillTile.y, tileSize, tileSize, sX, currentY, scaledTileSize, scaledTileSize);
            }
        }
    });

    // Step 2: Draw the main ground block on the BACK canvas.
    const tilesAcross = Math.ceil(map.width / scaledTileSize);
    for (let col = 0; col < tilesAcross; col++) {
        const destX = col * scaledTileSize;
        groundCtx.drawImage(tilesetImage, currentTileSet.ground.x, currentTileSet.ground.y, tileSize, tileSize, destX, groundSurfaceY, scaledTileSize, scaledTileSize);
        
        // Calculate how many rows needed to fill to bottom of screen plus UI area
        const mapHeight = map.height || GAME_CONFIG.BASE_GAME_HEIGHT;
        const remainingHeight = mapHeight - groundSurfaceY - scaledTileSize;
        const maxRows = Math.max(10, Math.ceil(remainingHeight / scaledTileSize) + 4); // Ensure at least 10 rows with extra buffer
        
        for (let row = 1; row <= maxRows; row++) {
            const destY = groundSurfaceY + (row * scaledTileSize);
            groundCtx.drawImage(tilesetImage, currentTileSet.background.x, currentTileSet.background.y, tileSize, tileSize, destX, destY, scaledTileSize, scaledTileSize);
        }
    }

    // Step 3: Draw top surfaces of SOLID STRUCTURES on the FRONT canvas.
    // Use the same sorted structures to maintain z-layer order
    sortedStructures.forEach(structure => {
        const sX = Math.round(structure.x);
        const sY = Math.round(structure.y + GROUND_LEVEL_OFFSET);
        const numTilesWide = Math.round(structure.width / scaledTileSize);
        if (numTilesWide < 1) return;
        const topEdgeTile = currentTileSet.groundEdge;
        const topFillTile = currentTileSet.ground;
        if (numTilesWide > 1) {
            platCtx.drawImage(tilesetImage, topEdgeTile.x, topEdgeTile.y, tileSize, tileSize, sX, sY, scaledTileSize, scaledTileSize);
            for (let i = 1; i < numTilesWide - 1; i++) {
                platCtx.drawImage(tilesetImage, topFillTile.x, topFillTile.y, tileSize, tileSize, sX + (i * scaledTileSize), sY, scaledTileSize, scaledTileSize);
            }
            const rightEdgeX = sX + (numTilesWide - 1) * scaledTileSize;
            platCtx.save();
            platCtx.translate(rightEdgeX + scaledTileSize, sY);
            platCtx.scale(-1, 1);
            platCtx.drawImage(tilesetImage, topEdgeTile.x, topEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
            platCtx.restore();
        } else {
            platCtx.drawImage(tilesetImage, topFillTile.x, topFillTile.y, tileSize, tileSize, sX, sY, scaledTileSize, scaledTileSize);
        }
    });

    // Step 4: Draw the floating platforms on the FRONT canvas.
    (map.platforms || []).forEach(platform => {
        if (platform.y === undefined) return; // Safety check
        const pWidth = platform.width;
        const pX = Math.round(platform.x);
        const pY = Math.round(platform.y + GROUND_LEVEL_OFFSET);
        const numTiles = Math.round(pWidth / scaledTileSize);
        if (numTiles < 1) return;
        const leftTile = currentTileSet.platformLeft;
        const centerTile = currentTileSet.platformCenter;
        const rightTile = currentTileSet.platformRight;
        if (numTiles === 1) {
            const halfWidth = scaledTileSize / 2;
            const halfSource = tileSize / 2;
            platCtx.drawImage(tilesetImage, leftTile.x, leftTile.y, halfSource, tileSize, pX, pY, halfWidth, scaledTileSize);
            platCtx.drawImage(tilesetImage, rightTile.x + halfSource, rightTile.y, halfSource, tileSize, pX + halfWidth, pY, halfWidth, scaledTileSize);
        } else {
            platCtx.drawImage(tilesetImage, leftTile.x, leftTile.y, tileSize, tileSize, pX, pY, scaledTileSize, scaledTileSize);
            for (let i = 1; i < numTiles - 1; i++) {
                platCtx.drawImage(tilesetImage, centerTile.x, centerTile.y, tileSize, tileSize, pX + (i * scaledTileSize), pY, scaledTileSize, scaledTileSize);
            }
            platCtx.drawImage(tilesetImage, rightTile.x, rightTile.y, tileSize, tileSize, pX + (numTiles - 1) * scaledTileSize, pY, scaledTileSize, scaledTileSize);
        }
    });

    // Step 4.5: Draw SLOPES on the FRONT canvas
    // Pattern for 'right' direction (going up to the right):
    //     S  G  G  G  G  <- top slope + ground cap (width determines how many ground tiles)
    //  S  SE             <- slope + edge
    //  G  SE  G  G       <- ground level (edge under bottom slope)
    
    // Expand hills into pairs of slopes
    // A hill is: up-slope (right direction) + optional flat top + down-slope (left direction)
    const allSlopes = [...(map.slopes || [])];
    (map.hills || []).forEach(hill => {
        const hillTiles = hill.tiles || 2;
        const hillCapWidth = hill.width || 0; // Flat top width (0 = pointed peak)
        const slopeWidth = hillTiles * scaledTileSize;
        
        // Up-slope (right direction) - starts at hill.x
        allSlopes.push({
            x: hill.x,
            tiles: hillTiles,
            direction: 'right',
            width: hillCapWidth,
            isHillPart: true
        });
        
        // Down-slope (left direction) - starts after the up-slope and cap
        // For 'left' direction, x is the LEFT edge of the slope tiles
        const downSlopeX = hill.x + slopeWidth + hillCapWidth;
        allSlopes.push({
            x: downSlopeX,
            tiles: hillTiles,
            direction: 'left',
            width: 0, // No separate cap for down-slope of hill (cap is shared at peak)
            isHillDownSlope: true // Flag to skip cap rendering
        });
    });
    
    allSlopes.forEach(slope => {
        const sX = Math.round(slope.x);
        const baseY = groundSurfaceY;
        const numTiles = slope.tiles || 1;
        // For hill down-slopes, don't draw a cap
        const capWidth = slope.isHillDownSlope ? 0 : (slope.width || scaledTileSize);
        const numCapTiles = Math.ceil(capWidth / scaledTileSize);
        
        const slopeTile = currentTileSet.slope;
        const slopeEdgeTile = currentTileSet.slopeEdge;
        const groundTile = currentTileSet.ground;
        const groundEdgeTile = currentTileSet.groundEdge;
        const backgroundTile = currentTileSet.background;
        const backgroundEdgeTile = currentTileSet.backgroundEdge;
        
        if (!slopeTile) return;
        
        const mapHeight = map.height || GAME_CONFIG.BASE_GAME_HEIGHT;
        
        if (slope.direction === 'left') {
            // For hill down-slopes (isHillDownSlope), the slope starts at sX at the peak and goes DOWN to the right
            // For regular 'left' slopes, the cap is on the left and slope goes UP from right to left
            
            if (slope.isHillDownSlope) {
                // Hill down-slope: starts at peak (sX) at top, goes down to the right
                //  S               <- top of slope (at peak height)
                //  SE  S           <- edge + slope  
                //      SE          <- slopeEdge at ground level
                for (let i = 0; i < numTiles; i++) {
                    const tileX = sX + (i * scaledTileSize);
                    const tileY = baseY - ((numTiles - i) * scaledTileSize);
                    
                    // Draw slope tile (flipped to face right/down)
                    platCtx.save();
                    platCtx.translate(tileX + scaledTileSize, tileY);
                    platCtx.scale(-1, 1);
                    platCtx.drawImage(tilesetImage, slopeTile.x, slopeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                    platCtx.restore();
                    
                    // Fill background below slope
                    for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                        groundCtx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, tileX, fillY, scaledTileSize, scaledTileSize);
                    }
                    
                    if (i > 0) {
                        // Not the top tile: draw slopeEdge to the LEFT (flipped)
                        const edgeX = tileX - scaledTileSize;
                        platCtx.save();
                        platCtx.translate(edgeX + scaledTileSize, tileY);
                        platCtx.scale(-1, 1);
                        platCtx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                        platCtx.restore();
                        
                        for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                            groundCtx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, edgeX, fillY, scaledTileSize, scaledTileSize);
                        }
                    }
                }
                
                // Draw slopeEdge at ground level directly under the bottom slope tile (flipped)
                // Bottom slope tile is at sX + (numTiles-1) * scaledTileSize
                const bottomEdgeX = sX + ((numTiles - 1) * scaledTileSize);
                platCtx.save();
                platCtx.translate(bottomEdgeX + scaledTileSize, baseY);
                platCtx.scale(-1, 1);
                platCtx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                platCtx.restore();
                for (let fillY = baseY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                    groundCtx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, bottomEdgeX, fillY, scaledTileSize, scaledTileSize);
                }
            } else {
                // Regular left slope - cap on left, slope goes up to the left
                //  G  G  G  S          <- ground cap + top slope
                //           SE  S      <- edge + slope
                //  G  G  G  G  SE  G   <- ground level
                for (let i = 0; i < numTiles; i++) {
                    const tileX = sX + ((numTiles - 1 - i) * scaledTileSize);
                    const tileY = baseY - ((i + 1) * scaledTileSize);
                    
                    // Draw slope tile (flipped)
                    platCtx.save();
                    platCtx.translate(tileX + scaledTileSize, tileY);
                    platCtx.scale(-1, 1);
                    platCtx.drawImage(tilesetImage, slopeTile.x, slopeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                    platCtx.restore();
                    
                    // Fill background below slope
                    for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                        groundCtx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, tileX, fillY, scaledTileSize, scaledTileSize);
                    }
                    
                    if (i === numTiles - 1) {
                        // Top slope: draw ground cap tiles to the LEFT
                        const topY = tileY;
                        for (let c = 0; c < numCapTiles; c++) {
                            const capX = tileX - ((c + 1) * scaledTileSize);
                            // Use edge tile for rightmost cap tile (connects to slope), ground for rest
                            if (c === 0 && groundEdgeTile) {
                                // Flip the edge tile for left-facing slope
                                platCtx.save();
                                platCtx.translate(capX + scaledTileSize, topY);
                                platCtx.scale(-1, 1);
                                platCtx.drawImage(tilesetImage, groundEdgeTile.x, groundEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                                platCtx.restore();
                            } else {
                                platCtx.drawImage(tilesetImage, groundTile.x, groundTile.y, tileSize, tileSize, capX, topY, scaledTileSize, scaledTileSize);
                            }
                            for (let fillY = topY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                groundCtx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, capX, fillY, scaledTileSize, scaledTileSize);
                            }
                        }
                    } else {
                        // Not top: draw slopeEdge to the RIGHT (flipped)
                        const edgeX = tileX + scaledTileSize;
                        platCtx.save();
                        platCtx.translate(edgeX + scaledTileSize, tileY);
                        platCtx.scale(-1, 1);
                        platCtx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                        platCtx.restore();
                        
                        for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                            groundCtx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, edgeX, fillY, scaledTileSize, scaledTileSize);
                        }
                    }
                }
                
                // Draw slopeEdge at ground level under the bottom slope (flipped)
                const bottomEdgeX = sX + ((numTiles - 1) * scaledTileSize);
                platCtx.save();
                platCtx.translate(bottomEdgeX + scaledTileSize, baseY);
                platCtx.scale(-1, 1);
                platCtx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                platCtx.restore();
                for (let fillY = baseY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                    groundCtx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, bottomEdgeX, fillY, scaledTileSize, scaledTileSize);
                }
            }
        } else {
            // Direction 'right' - slope goes up to the right
            //     S  G  G  GE      <- top slope + ground tiles + groundEdge at end (no slopeEdge at top)
            //  S  SE               <- slope + slopeEdge
            //  SE                  <- slopeEdge at ground level (shifted left)
            for (let i = 0; i < numTiles; i++) {
                const tileX = sX + (i * scaledTileSize);
                const tileY = baseY - ((i + 1) * scaledTileSize);
                
                // Draw slope tile
                platCtx.drawImage(tilesetImage, slopeTile.x, slopeTile.y, tileSize, tileSize, tileX, tileY, scaledTileSize, scaledTileSize);
                
                // Fill background below slope
                for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                    groundCtx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, tileX, fillY, scaledTileSize, scaledTileSize);
                }
                
                if (i === numTiles - 1) {
                    // Top slope: draw ground cap tiles directly to the RIGHT (no slopeEdge)
                    const topY = tileY;
                    const capStartX = tileX + scaledTileSize; // Start directly after slope
                    for (let c = 0; c < numCapTiles; c++) {
                        const capX = capStartX + (c * scaledTileSize);
                        const isLastCapTile = (c === numCapTiles - 1);
                        
                        // For hills, don't draw groundEdge/backgroundEdge on last cap tile (it connects to down-slope)
                        if (isLastCapTile && groundEdgeTile && !slope.isHillPart) {
                            // Last cap tile: use groundEdge (flipped)
                            platCtx.save();
                            platCtx.translate(capX + scaledTileSize, topY);
                            platCtx.scale(-1, 1);
                            platCtx.drawImage(tilesetImage, groundEdgeTile.x, groundEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                            platCtx.restore();
                            // backgroundEdge below it (flipped)
                            for (let fillY = topY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                groundCtx.save();
                                groundCtx.translate(capX + scaledTileSize, fillY);
                                groundCtx.scale(-1, 1);
                                groundCtx.drawImage(tilesetImage, backgroundEdgeTile.x, backgroundEdgeTile.y, tileSize, tileSize, 0, 0, scaledTileSize, scaledTileSize);
                                groundCtx.restore();
                            }
                        } else {
                            // Regular ground tile (or hill cap tile)
                            platCtx.drawImage(tilesetImage, groundTile.x, groundTile.y, tileSize, tileSize, capX, topY, scaledTileSize, scaledTileSize);
                            for (let fillY = topY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                                groundCtx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, capX, fillY, scaledTileSize, scaledTileSize);
                            }
                        }
                    }
                } else {
                    // Not top: draw slopeEdge to the RIGHT
                    const edgeX = tileX + scaledTileSize;
                    platCtx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, edgeX, tileY, scaledTileSize, scaledTileSize);
                    
                    for (let fillY = tileY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                        groundCtx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, edgeX, fillY, scaledTileSize, scaledTileSize);
                    }
                }
            }
            
            // Draw slopeEdge at ground level directly under the bottom slope
            const bottomEdgeX = sX;
            platCtx.drawImage(tilesetImage, slopeEdgeTile.x, slopeEdgeTile.y, tileSize, tileSize, bottomEdgeX, baseY, scaledTileSize, scaledTileSize);
            for (let fillY = baseY + scaledTileSize; fillY < mapHeight; fillY += scaledTileSize) {
                groundCtx.drawImage(tilesetImage, backgroundTile.x, backgroundTile.y, tileSize, tileSize, bottomEdgeX, fillY, scaledTileSize, scaledTileSize);
            }
        }
        
        // Create slope hitbox element for debug display
        const slopeHitbox = document.createElement('div');
        slopeHitbox.className = 'debug-hitbox';
        slopeHitbox.style.display = 'none';
        slopeHitbox.style.position = 'absolute';
        slopeHitbox.style.pointerEvents = 'none';
        slopeHitbox.style.borderColor = 'lime';
        
        // Calculate hitbox bounds (matching collision logic)
        // For hill down-slopes, width is 0 (no cap)
        const hbCapWidth = slope.isHillDownSlope ? 0 : (slope.width || scaledTileSize);
        const hbNumCapTiles = Math.ceil(hbCapWidth / scaledTileSize);
        const hbSlopeWidth = numTiles * scaledTileSize;
        const hbTotalHeight = numTiles * scaledTileSize;
        
        let hitboxStartX, hitboxEndX;
        if (slope.direction === 'left') {
            // For hill down-slopes: no cap, just slope tiles
            hitboxStartX = slope.isHillDownSlope ? sX : sX - (hbNumCapTiles * scaledTileSize);
            hitboxEndX = sX + hbSlopeWidth;
        } else {
            hitboxStartX = sX;
            hitboxEndX = sX + hbSlopeWidth + (hbNumCapTiles * scaledTileSize);
        }
        
        // Create SVG for diagonal slope visualization
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        const hitboxWidth = hitboxEndX - hitboxStartX;
        svg.setAttribute("width", hitboxWidth);
        svg.setAttribute("height", hbTotalHeight);
        svg.style.position = "absolute";
        svg.style.left = `${hitboxStartX}px`;
        svg.style.top = `${baseY - hbTotalHeight}px`;
        svg.style.pointerEvents = "none";
        svg.style.display = "none";
        
        // Draw the slope line
        const line = document.createElementNS(svgNS, "polyline");
        let points;
        if (slope.direction === 'left') {
            // Flat cap on left, slope goes down to right
            const capW = hbNumCapTiles * scaledTileSize;
            points = `0,0 ${capW},0 ${hitboxWidth},${hbTotalHeight}`;
        } else {
            // Slope goes up, flat cap on right
            const capW = hbNumCapTiles * scaledTileSize;
            points = `0,${hbTotalHeight} ${hbSlopeWidth},0 ${hitboxWidth},0`;
        }
        line.setAttribute("points", points);
        line.setAttribute("fill", "none");
        line.setAttribute("stroke", "lime");
        line.setAttribute("stroke-width", "2");
        svg.appendChild(line);
        
        worldContent.appendChild(svg);
        slopeHitboxes.push({ slope, element: svg });
    });

    // Step 5: Draw LADDERS last, so they appear on top
    (map.ladders || []).forEach(ladder => {
        const lX = ladder.x;
        const lY2 = ladder.y2 + GROUND_LEVEL_OFFSET;

        // --- THIS IS THE FIX ---
        // Increased the overlap to half a tile's height for a more secure visual connection.
        const verticalOverlap = 24;
        const lY1 = ladder.y1 + GROUND_LEVEL_OFFSET - verticalOverlap;
        // --- END OF FIX ---

        // Check for ladder type (default to 'tiles' if not specified)
        const ladderType = ladder.type || 'tiles';
        const ladderTiles = spriteData.ladder[ladderType] || spriteData.ladder.tiles;
        const ladderTileSize = spriteData.ladder.frameWidth;

        let isFirstPiece = true;
        for (let currentY = lY1; currentY < lY2; currentY += scaledTileSize) {
            let tileToDraw;
            let sourceTileHeight = ladderTileSize;
            let destTileHeight = scaledTileSize;

            if (currentY + scaledTileSize > lY2) {
                destTileHeight = lY2 - currentY;
                sourceTileHeight = (destTileHeight / scaledTileSize) * ladderTileSize;
                tileToDraw = ladderTiles.bottom;
            } else if (isFirstPiece) {
                tileToDraw = ladderTiles.top;
                isFirstPiece = false;
            } else {
                tileToDraw = ladderTiles.middle;
            }

            if (destTileHeight <= 0) continue;

            platCtx.drawImage(
                ladderSheetImage,
                tileToDraw.x, tileToDraw.y,
                ladderTileSize, sourceTileHeight,
                lX, currentY,
                scaledTileSize, destTileHeight
            );
        }
    });

    // Step 6: Apply a darkening gradient to the bottom of the ground
    const gradientStartY = groundSurfaceY; // Start darkening from ground surface
    const gradientHeight = groundCanvas.height - gradientStartY;
    if (gradientHeight > 0) {
        const gradient = groundCtx.createLinearGradient(0, gradientStartY, 0, groundCanvas.height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');      // Fully transparent at top
        gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.3)'); // Slight darkening
        gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.6)'); // Medium darkening
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');   // Darker at bottom
        
        groundCtx.fillStyle = gradient;
        groundCtx.fillRect(0, gradientStartY, groundCanvas.width, gradientHeight);
    }
}

// --- ADD THIS NEW HELPER FUNCTION and the line below it ---
const tileCache = {};
// Tileset image will be loaded by the loading manager

function getTileImage(x, y, width, height) {
    const key = `${x},${y}`;
    if (tileCache[key]) {
        return tileCache[key];
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Turn off image smoothing to keep pixels sharp
    ctx.imageSmoothingEnabled = false;

    // Draw just the 16x16 tile we want from the main tileset onto the canvas
    ctx.drawImage(tilesetImage, x, y, width, height, 0, 0, width, height);

    // Convert the canvas content to a new Base64 image and cache it
    const dataURL = canvas.toDataURL();
    tileCache[key] = dataURL;
    return dataURL;
}

/**
 * Draws the pre-generated foliage canvases onto the visible map.
 */

function drawFoliage() {
    const map = maps[currentMapId];
    const bgFoliageCanvas = document.getElementById('foliage-background-canvas');
    const fgFoliageCanvas = document.getElementById('foliage-foreground-canvas');
    const bgCtx = bgFoliageCanvas.getContext('2d');
    const fgCtx = fgFoliageCanvas.getContext('2d');

    bgFoliageCanvas.width = fgFoliageCanvas.width = map.width;
    bgFoliageCanvas.height = fgFoliageCanvas.height = map.height || GAME_CONFIG.BASE_GAME_HEIGHT;
    bgCtx.clearRect(0, 0, bgFoliageCanvas.width, bgFoliageCanvas.height);
    fgCtx.clearRect(0, 0, fgFoliageCanvas.width, fgFoliageCanvas.height);

    // This line has been corrected to use 'currentMapId'
    if (foliageData[currentMapId]) {
        bgCtx.drawImage(foliageData[currentMapId].background, 0, 0);
        fgCtx.drawImage(foliageData[currentMapId].foreground, 0, 0);
    }
}

// Replace these two functions in game.js

/**
 * Generates foliage for a single map on off-screen canvases.
 * @param {object} map - The map object from the maps data.
 * @param {number} mapHeight - The calculated height of the map.
 * @param {number} groundY - The Y-coordinate of the ground level.
 * @returns {object} An object containing the background and foreground foliage canvases.
 */
function generateFoliageForMap(map, mapHeight, groundY) {
    const bgCanvas = document.createElement('canvas');
    const fgCanvas = document.createElement('canvas');
    bgCanvas.width = fgCanvas.width = map.width;
    bgCanvas.height = fgCanvas.height = mapHeight;

    const bgCtx = bgCanvas.getContext('2d');
    const fgCtx = fgCanvas.getContext('2d');
    bgCtx.imageSmoothingEnabled = fgCtx.imageSmoothingEnabled = false;
    bgCtx.filter = 'brightness(75%)';

    const foliageInfo = spriteData.groundFoliage;
    const foliageTypes = Object.values(foliageInfo.tiles);
    const tileSize = foliageInfo.tileSize;
    const scaledTileSize = tileSize * PIXEL_ART_SCALE;
    const anchorPoint = foliageInfo.anchorPoint || { x: 0, y: 0 };

    const groundSurfaceY = mapHeight - groundY;
    const surfaces = [
        { x: 0, y: groundSurfaceY, width: map.width, isGround: true },
        ...(map.platforms || []).map(p => ({ ...p, y: p.y + GROUND_LEVEL_OFFSET, isGround: false })),
        ...(map.structures || []).map(s => ({ ...s, y: s.y + GROUND_LEVEL_OFFSET, isGround: false }))
    ];

    if (surfaces.length === 0) {
        return { background: bgCanvas, foreground: fgCanvas };
    }

    const foliageDensity = 0.4;
    const totalFoliageCount = Math.floor(map.width / scaledTileSize * foliageDensity);

    for (let i = 0; i < totalFoliageCount; i++) {
        const surface = surfaces[Math.floor(Math.random() * surfaces.length)];
        const spawnableWidth = surface.width - (scaledTileSize * 2);
        if (spawnableWidth <= 0) {
            continue;
        }

        const randomFoliage = foliageTypes[Math.floor(Math.random() * foliageTypes.length)];
        const randomX = surface.x + scaledTileSize + (Math.random() * spawnableWidth);
        const foliageX = Math.round(randomX);
        
        // For ground surfaces, use slope surface Y to account for hills/slopes
        let surfaceY = surface.y;
        if (surface.isGround && (map.slopes || map.hills)) {
            surfaceY = getSlopeSurfaceY(foliageX, map, groundSurfaceY, 48);
        }
        
        const yOffsetRange = foliageInfo.verticalOffsetRange || { min: 0, max: 0 };
        const randomPixelOffset = Math.floor(Math.random() * (yOffsetRange.max - yOffsetRange.min + 1)) + yOffsetRange.min;
        const foliageY = surfaceY - (anchorPoint.y * PIXEL_ART_SCALE) + (randomPixelOffset * PIXEL_ART_SCALE);
        const targetCtx = Math.random() < 0.5 ? fgCtx : bgCtx;

        targetCtx.drawImage(
            foliageSheetImage,
            randomFoliage.x, randomFoliage.y, tileSize, tileSize,
            foliageX, foliageY, scaledTileSize, scaledTileSize
        );
    }
    return { background: bgCanvas, foreground: fgCanvas };
}

/**
 * Pre-generates foliage canvases for all grassy maps to improve performance.
 */
function generateAllFoliage() {
    foliageData = {};
    const containerHeight = 768; // Use a fixed default height for pre-generation

    for (const mapId in maps) {
        const map = maps[mapId];
        if (map.groundType === 'grass') {
            const mapHeight = map.height || containerHeight;
            // Pass the calculated height and the GROUND_Y constant as arguments
            foliageData[mapId] = generateFoliageForMap(map, mapHeight, GAME_CONFIG.GROUND_Y);
        }
    }
}

function updateAttacks() {
    const now = Date.now();
    for (let i = activeAttacks.length - 1; i >= 0; i--) {
        // Remove attack box after 300 milliseconds
        if (now - activeAttacks[i].createdAt > 300) {
            activeAttacks[i].element.remove();
            activeAttacks.splice(i, 1);
        }
    }
}

function handlePlayerAttack(ability) {
    // This function is now ONLY for creating the melee attack hitboxes.
    // The animation is handled by playAttackAnimation() in player.js
    player.isAttacking = true;
    player.attackStartTime = Date.now();

    const hits = ability.hits || 1;
    for (let i = 0; i < hits; i++) {
        setTimeout(() => {
            const isMultiTarget = ability.multiTarget !== false;
            let attackBoxWidth, attackBoxHeight, attackX, attackY;

            if (ability.type === 'aoe_melee') {
                attackBoxWidth = 150 * SCALE;
                attackBoxHeight = 150 * SCALE;
                attackX = player.x + player.width / 2 - attackBoxWidth / 2;
                attackY = player.y + player.height / 2 - attackBoxHeight / 2;
            } else {
                // Multi-target abilities have wider hitbox (200px vs 80px for single-target)
                attackBoxWidth = (isMultiTarget ? 200 : 80) * SCALE;
                attackBoxHeight = 60 * SCALE;
                attackX = player.facing === 'right' ? player.x + player.width - 20 * SCALE : player.x - attackBoxWidth + 20 * SCALE;
                attackY = player.y;
            }

            const attack = {
                x: attackX, y: attackY, width: attackBoxWidth, height: attackBoxHeight,
                element: document.createElement('div'),
                createdAt: Date.now(),
                damageMultiplier: ability.damageMultiplier,
                isMultiTarget: isMultiTarget, hitMonsters: []
            };

            if (ability.name === 'Slash Blast') {
                attack.element.className = 'attack-box';
                attack.element.innerHTML = sprites.slashBlastEffect;
                attack.element.style.transform = player.facing === 'left' ? 'scaleX(-1)' : '';
                attack.element.style.background = 'none';
                attack.element.style.border = 'none';
                attack.element.style.animation = 'attack-fade 0.3s forwards';
                worldContent.appendChild(attack.element);
                
                // Broadcast VFX to other players
                if (typeof broadcastSkillVFX === 'function') {
                    broadcastSkillVFX('slashBlastEffect', attackX, attackY, attackBoxWidth, attackBoxHeight, player.facing, 300);
                }
            } else if (ability.name === 'Thunderbolt') {
                attack.element.className = 'attack-box';
                attack.element.innerHTML = sprites.thunderboltEffect;
                attack.element.style.background = 'none';
                attack.element.style.border = 'none';
                attack.element.style.animation = 'attack-fade 0.3s forwards';
                worldContent.appendChild(attack.element);
                
                // Broadcast VFX to other players
                if (typeof broadcastSkillVFX === 'function') {
                    broadcastSkillVFX('thunderboltEffect', attackX, attackY, attackBoxWidth, attackBoxHeight, player.facing, 300);
                }
            }

            activeAttacks.push(attack);
        }, i * 100);
    }
}

function createProjectile(spriteName, damageMultiplier, startX, startY, angle = 0, isHoming = false) {
    const el = document.createElement('div');
    el.className = 'projectile';
    
    // Check if this projectile has pixel art in basicProjectiles
    const projectileData = artAssets.basicProjectiles;
    const animationFrames = projectileData?.animations?.[spriteName];
    
    let usePixelArt = false;
    let projectileCanvas = null;
    let projectileImg = null;
    
    if (animationFrames && projectileData.image) {
        usePixelArt = true;
        // Use pixel art from sprite sheet with proper PIXEL_ART_SCALE
        projectileCanvas = document.createElement('canvas');
        projectileCanvas.width = projectileData.frameWidth * PIXEL_ART_SCALE;
        projectileCanvas.height = projectileData.frameHeight * PIXEL_ART_SCALE;
        const ctx = projectileCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false; // Keep pixel art crisp
        
        projectileImg = new Image();
        projectileImg.src = projectileData.image;
        
        const drawFrame = (frameIndex) => {
            const frame = animationFrames[frameIndex % animationFrames.length];
            ctx.clearRect(0, 0, projectileCanvas.width, projectileCanvas.height);
            ctx.drawImage(
                projectileImg,
                frame.x, frame.y, projectileData.frameWidth, projectileData.frameHeight,
                0, 0, projectileCanvas.width, projectileCanvas.height
            );
        };
        
        projectileImg.onload = () => drawFrame(0);
        if (projectileImg.complete) drawFrame(0);
        
        el.appendChild(projectileCanvas);
        el.style.width = `${projectileCanvas.width}px`;
        el.style.height = `${projectileCanvas.height}px`;
    } else {
        // Fallback to SVG sprites
        el.innerHTML = sprites[spriteName] || '';
        el.style.width = '20px';
        el.style.height = '20px';
    }
    
    const pWidth = usePixelArt ? projectileData.frameWidth * PIXEL_ART_SCALE : 20;
    const pHeight = usePixelArt ? projectileData.frameHeight * PIXEL_ART_SCALE : 20;

    const pX = startX !== undefined ? startX : (player.facing === 'right' ? player.x + player.width : player.x - pWidth);
    const pY = startY !== undefined ? startY : player.y + player.height / 2 - pHeight / 2;

    const projectileId = nextProjectileId++;
    const projectile = {
        id: projectileId, // Unique ID for multiplayer sync
        x: pX, y: pY, width: pWidth, height: pHeight,
        damageMultiplier, element: el, hitMonsters: [],
        createdAt: Date.now(),
        // Animation properties for pixel art projectiles
        usePixelArt: usePixelArt,
        spriteName: spriteName,
        canvas: projectileCanvas,
        img: projectileImg,
        animationFrames: animationFrames,
        currentFrame: 0,
        frameTimer: 0
    };

    if (isHoming) {
        const HOMING_RANGE = 300;
        const VERTICAL_RANGE_UP = 100;
        const VERTICAL_RANGE_DOWN = 50;
        let closestMonster = null;
        let minDistance = HOMING_RANGE;

        for (const monster of monsters) {
            if (monster.isDead) continue;

            const verticalOk = monster.y > (player.y - VERTICAL_RANGE_UP) && monster.y < (player.y + player.height + VERTICAL_RANGE_DOWN);
            if (!verticalOk) continue;

            const distance = Math.hypot(monster.x - pX, monster.y - pY);
            if (distance < minDistance) {
                minDistance = distance;
                closestMonster = monster;
            }
        }
        if (closestMonster) {
            projectile.targetId = closestMonster.id;
        }
    }

    // --- ADD THIS BLOCK for grenade physics ---
    if (spriteName === 'grenadeIcon') {
        projectile.type = 'grenade';
        projectile.velocityY = -7; // Initial upward lob force
        projectile.velocityX = 6 * (player.facing === 'right' ? 1 : -1); // Initial forward speed
        projectile.grounded = false; // It starts in the air
        projectile.fuseTimer = 120; // Fuse time in frames (2 seconds at 60fps)
    } else {
        // --- END BLOCK ---
        const pSpeed = 8;
        const pDirection = player.facing === 'right' ? 1 : -1;
        const radAngle = angle * (Math.PI / 180);
        projectile.velocityX = angle === 0 ? pSpeed * pDirection : pSpeed * Math.cos(radAngle);
        projectile.velocityY = angle === 0 ? 0 : pSpeed * Math.sin(radAngle);

        if (angle === 0) {
            el.style.transform = `scaleX(${pDirection})`;
        } else {
            el.style.transform = `rotate(${angle}deg)`;
        }
    }

    worldContent.appendChild(el);
    projectiles.push(projectile);
    
    console.log('[Game] Projectile created with id:', projectileId, 'sprite:', spriteName, 'isHoming:', isHoming);
    
    // Broadcast projectile to other players for multiplayer sync
    if (typeof broadcastProjectile === 'function') {
        broadcastProjectile(projectileId, spriteName, pX, pY, projectile.velocityX, projectile.velocityY, angle, spriteName === 'grenadeIcon', isHoming);
    }
}

function explodeGrenade(grenade) {
    // Create an explosion effect and a damage box
    const explosion = {
        x: grenade.x - 40, // Center the explosion on the grenade
        y: grenade.y - 40,
        width: 100, // AOE size
        height: 100,
        element: document.createElement('div'),
        createdAt: Date.now(),
        damageMultiplier: grenade.damageMultiplier,
        isMultiTarget: true, // This makes it an AOE attack
        hitMonsters: []
    };

    // Style the explosion using existing classes and sprites
    explosion.element.className = 'attack-box';
    explosion.element.innerHTML = sprites.grenadeEffect; // A new sprite for the explosion itself
    explosion.element.style.background = 'none';
    explosion.element.style.border = 'none';
    explosion.element.style.animation = 'attack-fade 0.4s forwards';
    worldContent.appendChild(explosion.element);

    // Add the explosion to activeAttacks so it can deal damage
    activeAttacks.push(explosion);
    
    // Broadcast explosion VFX to other players
    if (typeof broadcastSkillVFX === 'function') {
        broadcastSkillVFX('grenadeEffect', explosion.x, explosion.y, 100, 100, 'right', 400);
    }

    // Remove the grenade's visual element from the game
    grenade.element.remove();
}

// in game.js

function updateProjectiles() {
    const now = Date.now();
    const PROJECTILE_ANIMATION_SPEED = 8; // Frames between animation updates (lower = faster)
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        
        // Update pixel art animation
        if (p.usePixelArt && p.canvas && p.img && p.img.complete && p.animationFrames) {
            p.frameTimer++;
            if (p.frameTimer >= PROJECTILE_ANIMATION_SPEED) {
                p.frameTimer = 0;
                p.currentFrame = (p.currentFrame + 1) % p.animationFrames.length;
                const frame = p.animationFrames[p.currentFrame];
                const ctx = p.canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);
                ctx.drawImage(
                    p.img,
                    frame.x, frame.y, artAssets.basicProjectiles.frameWidth, artAssets.basicProjectiles.frameHeight,
                    0, 0, p.canvas.width, p.canvas.height
                );
            }
        }

        if (p.targetId) {
            const target = monsters.find(m => m.id === p.targetId && !m.isDead);
            if (target) {
                const pSpeed = 8;
                const turnFactor = 0.04;

                const targetX = target.x + target.width / 2;
                const targetY = target.y + target.height / 2;
                const dx = targetX - p.x;
                const dy = targetY - p.y;
                const angleToTarget = Math.atan2(dy, dx);
                const currentAngle = Math.atan2(p.velocityY, p.velocityX);

                let angleDiff = angleToTarget - currentAngle;
                if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

                if (Math.abs(angleDiff) < Math.PI / 2) {
                    const newAngle = currentAngle + angleDiff * turnFactor;
                    p.velocityX = Math.cos(newAngle) * pSpeed;
                    p.velocityY = Math.sin(newAngle) * pSpeed;
                }

            } else {
                p.targetId = null;
            }
        }

        if (p.type === 'grenade') {
            p.fuseTimer--;

            if (p.grounded) {
                p.velocityX *= 0.92;
                if (Math.abs(p.velocityX) < 0.1) p.velocityX = 0;
            } else {
                p.velocityY += GRAVITY;
            }

            if (p.fuseTimer <= 0 || (p.grounded && p.velocityX === 0)) {
                explodeGrenade(p);
                projectiles.splice(i, 1);
                continue;
            }
        }

        p.x += p.velocityX;
        p.y += p.velocityY;

        if (p.type === 'grenade' && !p.grounded) {
            let onSurface = false;
            const map = maps[currentMapId];
            const groundLevel = (map.height || GAME_CONFIG.BASE_GAME_HEIGHT) - GAME_CONFIG.GROUND_Y;

            if (p.y + p.height >= groundLevel) {
                p.y = groundLevel - p.height;
                onSurface = true;
            } else {
                for (const platform of platforms) {
                    if (platform.isLadder || platform.y === undefined) continue;
                    if (p.x + p.width > platform.x && p.x < platform.x + platform.width &&
                        p.y + p.height >= platform.y && p.y + p.height <= platform.y + platform.height + 10 &&
                        p.velocityY >= 0) {
                        p.y = platform.y - p.height;
                        onSurface = true;
                        break;
                    }
                }
            }

            if (onSurface) {
                p.grounded = true;
                p.velocityY *= -0.4;
                if (Math.abs(p.velocityY) < 1) {
                    p.velocityY = 0;
                } else {
                    p.grounded = false;
                }
            }
        }

        // --- THIS IS THE FIX ---
        // Only apply the 500ms lifespan to projectiles that are NOT grenades.
        if (p.type !== 'grenade' && now - p.createdAt > 500) {
            p.element.remove();
            projectiles.splice(i, 1);
            continue;
        }
        // --- END OF FIX ---

        // Use BASE_GAME_HEIGHT for consistent boundary check
        if (p.x < -100 || p.x > maps[currentMapId].width + 100 || p.y < -200 || p.y > (maps[currentMapId].height || GAME_CONFIG.BASE_GAME_HEIGHT) + 100) {
            p.element.remove();
            projectiles.splice(i, 1);
        }
    }
}

function showDamageNumber(amount, x, y, isPlayerDamage, options = {}) {
    const { isCritical = false, isMiss = false, isShadowPartner = false } = options;
    
    // Ensure worldContent exists
    if (!worldContent) {
        worldContent = document.getElementById('world-content');
        if (!worldContent) {
            console.warn('worldContent not found, cannot show damage number');
            return;
        }
    }
    
    // Use object pool if available, fallback to direct creation
    let damageObj;
    let usePool = false;
    try {
        if (typeof damageNumberPool !== 'undefined' && damageNumberPool) {
            damageObj = damageNumberPool.get();
            usePool = true;
        }
    } catch (e) {
        console.warn('Object pool error, falling back to direct creation');
    }
    
    if (!damageObj) {
        const el = document.createElement('div');
        damageObj = { element: el, timeoutId: null };
    }
    
    const el = damageObj.element;
    el.className = `damage-number ${isPlayerDamage ? 'player' : 'monster'}`;

    if (isCritical) {
        el.classList.add('critical');
    }
    if (isShadowPartner) {
        el.classList.add('shadow-partner');
    }
    if (isMiss) {
        el.classList.add('miss');
        el.textContent = 'MISS';
    } else {
        el.textContent = Math.floor(amount);
    }

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.display = 'block'; // Ensure visibility
    worldContent.appendChild(el);
    
    // Use managed timeout if available, otherwise fallback to regular setTimeout
    const timeoutFn = typeof managedSetTimeout === 'function' ? managedSetTimeout : setTimeout;
    damageObj.timeoutId = timeoutFn(() => {
        try {
            if (usePool && typeof damageNumberPool !== 'undefined' && damageNumberPool) {
                damageNumberPool.release(damageObj);
            } else {
                el.remove();
            }
        } catch (e) {
            // Fallback: just remove the element
            if (el.parentNode) el.parentNode.removeChild(el);
        }
    }, 1000);
}

function createEffect(effectName, x, y, duration = 200, broadcast = true) {
    const el = document.createElement('div');
    el.className = 'attack-box'; // We can reuse the attack-box style for positioning and fading
    el.style.width = '50px';
    el.style.height = '50px';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.border = 'none';
    el.style.background = 'none';
    el.style.animation = `attack-fade ${duration / 1000}s forwards`;
    el.innerHTML = sprites[effectName];
    worldContent.appendChild(el);
    setTimeout(() => el.remove(), duration);
    
    // Broadcast effect to other players
    if (broadcast && typeof broadcastSkillVFX === 'function') {
        broadcastSkillVFX(effectName, x, y, 50, 50, 'right', duration);
    }
}

function showNotification(text, rarity) {
    // Use object pool if available
    let notificationObj;
    if (typeof notificationPool !== 'undefined') {
        notificationObj = notificationPool.get();
    } else {
        const el = document.createElement('div');
        notificationObj = { element: el, timeoutId: null };
    }
    
    const el = notificationObj.element;
    el.className = `notification-text ${rarity || 'common'}`;
    el.textContent = text;
    el.style.cssText = ''; // Clear any lingering inline styles from pool reuse
    
    if (notificationContainer) {
        notificationContainer.appendChild(el);
    }
    
    // Announce to screen reader
    if (typeof announceToScreenReader === 'function') {
        announceToScreenReader(text);
    }
    
    notificationObj.timeoutId = managedSetTimeout(() => {
        if (typeof notificationPool !== 'undefined') {
            notificationPool.release(notificationObj);
        } else {
            el.remove();
        }
    }, 2000);
}

function showMajorNotification(text, typeClass) {
    const el = document.createElement('div');
    el.className = `major-notification-text ${typeClass}`;
    el.textContent = text;

    // Use specific containers if they exist, otherwise fall back to the main notification container
    let targetContainer;
    if (typeClass === 'level-up' && levelUpNotificationContainer) {
        targetContainer = levelUpNotificationContainer;
    } else if (globalNotificationContainer) {
        targetContainer = globalNotificationContainer;
    } else if (notificationContainer) {
        targetContainer = notificationContainer;
    } else {
        // Last resort: create a temporary container
        console.warn('No notification container found, creating temporary one');
        return;
    }

    targetContainer.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

// --- Physics & Collision ---

function checkCollisions() {
    const finalStats = calculatePlayerStats();

    // --- Monster touching Player Collision ---
    // Check invincibility BEFORE the forEach loop so only ONE monster can hit per invincibility window
    if (!player.isInvincible && !player.isInvisible) {
        const now = Date.now();
        
        // Use spatial grid to get only nearby monsters (OPTIMIZED)
        const nearbyMonsters = typeof spatialGrid !== 'undefined' 
            ? Array.from(spatialGrid.getNearbyEntities(player)).filter(e => e.isDead === false || e.isDead === undefined)
            : monsters;
        
        // Find the first monster that can hit the player
        for (const m of nearbyMonsters) {
            // Skip monsters that are spawning (not yet fully visible)
            if (m.isSpawning) continue;
            
            if (isColliding(player, m) && !m.isDead && m.type !== 'testDummy') {
                if (now - m.lastAttackTime > m.attackCooldown) {
                    // Check AGAIN if player became invincible (in case another monster already hit)
                    if (player.isInvincible) break;
                    
                    m.lastAttackTime = now;
                    
                    // Trigger attack animation for trial bosses
                    if (m.usesPlayerSprite) {
                        m.isAttacking = true;
                        m.animationFrame = 0;
                        m.animationTimer = 0;
                    }

                    // Robust monster hit calculation
                    const levelDifference = player.level - m.level;
                    let monsterHitChance = 100;
                    
                    // Level-based avoidance (player dodges lower level monsters easier)
                    if (levelDifference > 0) {
                        // For each level above the monster, reduce monster's hit chance by 4%
                        // At +5 levels: 80% monster hit, at +10 levels: 60% hit, at +15 levels: 40% hit
                        const levelAdvantage = levelDifference * 4;
                        monsterHitChance = Math.max(5, 100 - levelAdvantage);
                    }
                    
                    // Accuracy vs Avoidability calculation
                    const accuracyDifference = m.accuracy - finalStats.finalAvoidability;
                    // Each point of accuracy advantage gives monster +2% hit chance
                    // Each point of avoidability advantage gives player better dodge
                    const accuracyHitChance = Math.max(5, Math.min(100, 80 + (accuracyDifference * 2)));
                    
                    // Use the LOWER of level-based and accuracy-based hit chances
                    monsterHitChance = Math.min(monsterHitChance, accuracyHitChance);
                    
                    // Check if monster misses
                    if (Math.random() * 100 > monsterHitChance) {
                        showDamageNumber(0, player.x + player.width / 2, player.y, true, { isMiss: true });
                        continue; // Try next monster
                    }

                    playSound('playerHit');
                    const damageTaken = Math.max(1, m.damage - (finalStats.totalDefense * 0.25));
                    
                    // Update interaction time when monster deals damage
                    m.lastInteractionTime = Date.now();
                    
                    if (!isGmMode.infiniteStats) {
                        player.hp -= damageTaken;
                        if (player.hp <= 0) {
                            player.hp = 0;
                            handlePlayerDeath();
                        }
                    }
                    showDamageNumber(damageTaken, player.x + player.width / 2, player.y, true);
                    m.previousAiState = m.aiState;
                    m.aiState = 'recoiling';
                    m.aiStateTimer = 30;
                    const knockbackDirection = m.x > player.x ? 1 : -1;
                    player.velocityX = -knockbackDirection * KNOCKBACK_FORCE;
                    m.velocityX = knockbackDirection * (KNOCKBACK_FORCE / 1.5);
                    updateUI();
                    player.isInvincible = true;
                    playerElement.style.opacity = 0.5;
                    setTimeout(() => {
                        if (!player.isDead) {
                            player.isInvincible = false;
                            playerElement.style.opacity = 1;
                        }
                    }, 1500);
                    
                    // Exit loop after first successful hit
                    break;
                }
            }
        }
    }

    // --- Player Attack hitting Monster Collision ---
    const allAttacks = [...activeAttacks, ...projectiles];
    for (const attack of allAttacks) {
        if (attack.type === 'grenade' || attack.toRemove) continue;

        // Use spatial grid to get only nearby monsters for this attack (OPTIMIZED)
        const nearbyMonsters = typeof spatialGrid !== 'undefined'
            ? Array.from(spatialGrid.getNearbyEntities(attack))
            : monsters;

        for (const m of nearbyMonsters) {
            // Skip monsters that are spawning (not yet fully visible) or already dead
            if (m.isDead || m.isSpawning || attack.hitMonsters.includes(m.id)) continue;

            if (isColliding(attack, m)) {
                // Debug: Log when projectile collision is detected
                if (attack.id) {
                    console.log('[Game] Projectile collision detected! id:', attack.id, 'monster:', m.type);
                }

                // Robust level and accuracy-based hit calculation
                const levelDifference = player.level - m.level;
                const monsterReqAccuracy = m.reqAccuracy || 0;
                let playerHitChance = 100;
                
                // Level-based miss chance (applies when fighting higher level monsters)
                if (levelDifference < 0) {
                    // For each level below the monster, reduce hit chance by 5%
                    // At -5 levels: 75% hit, at -10 levels: 50% hit, at -20 levels: 0% hit
                    const levelPenalty = Math.abs(levelDifference) * 5;
                    playerHitChance = Math.max(0, 100 - levelPenalty);
                }
                
                // Accuracy-based miss chance (applies regardless of level difference)
                if (monsterReqAccuracy > 0) {
                    const accuracyDifference = finalStats.finalAccuracy - monsterReqAccuracy;
                    // Each point of missing accuracy reduces hit chance by 3%
                    // Meeting reqAccuracy = 100% hit, -10 accuracy = 70% hit
                    const accuracyHitChance = Math.max(0, Math.min(100, 100 + (accuracyDifference * 3)));
                    
                    // Use the LOWER of level-based and accuracy-based hit chances
                    playerHitChance = Math.min(playerHitChance, accuracyHitChance);
                }
                
                // Always keep a minimum 5% hit chance if within reasonable level range (-10)
                if (levelDifference > -10) {
                    playerHitChance = Math.max(5, playerHitChance);
                }
                
                // Check if attack misses
                if (Math.random() * 100 > playerHitChance) {
                    showDamageNumber(0, m.x + m.width / 2, m.y, false, { isMiss: true });
                    attack.hitMonsters.push(m.id);
                    if (!attack.isMultiTarget) {
                        attack.toRemove = true;
                        // Broadcast projectile hit (even on miss) to stop remote visual
                        if (attack.id && typeof broadcastProjectileHit === 'function') {
                            console.log('[Game] Broadcasting projectile hit for miss, id:', attack.id);
                            broadcastProjectileHit(attack.id, attack.x, attack.y);
                        }
                    }
                    continue;
                }

                // Set chase state and update interaction time
                if (m.aiState !== 'chasing') {
                    m.aiState = 'chasing';
                    m.chaseStartTime = Date.now();
                }
                m.lastInteractionTime = Date.now(); // Update interaction time on damage dealt
                
                let totalDamage = finalStats.minDamage + Math.random() * (finalStats.maxDamage - finalStats.minDamage);
                totalDamage *= (attack.damageMultiplier || 1);
                let isCritical = false;
                if (Math.random() < finalStats.finalCritChance / 100) {
                    isCritical = true;
                    const critMultiplier = Math.random() * (finalStats.finalMaxCritDamage - finalStats.finalMinCritDamage) + finalStats.finalMinCritDamage;
                    totalDamage *= critMultiplier;
                }
                
                // Check for Shadow Partner buff - deals additional damage
                let shadowPartnerDamage = 0;
                const shadowPartnerBuff = player.buffs.find(b => b.name === 'Shadow Partner');
                if (shadowPartnerBuff && shadowPartnerBuff.effect && shadowPartnerBuff.effect.shadowPartnerDamage) {
                    const shadowPercent = shadowPartnerBuff.effect.shadowPartnerDamage / 100;
                    shadowPartnerDamage = Math.floor(totalDamage * shadowPercent);
                }
                
                // Calculate total damage for this hit
                const finalDamage = totalDamage + shadowPartnerDamage;
                
                // Server-authoritative monsters: send damage to server instead of applying locally
                const isServerAuth = typeof isServerAuthoritativeMonsters === 'function' && isServerAuthoritativeMonsters();
                if (isServerAuth && m.serverId) {
                    // Send damage to server - the sendMonsterAttack function now handles
                    // optimistic damage application, damage numbers, and hit feedback
                    if (typeof sendMonsterAttack === 'function') {
                        sendMonsterAttack(m.serverId, finalDamage, isCritical, attack.type || 'normal');
                    }
                    // Play hit sound and show VFX (optimistic damage handled in sendMonsterAttack)
                    playSound('monsterHit');
                    spawnHitSquibVFX(m, attack, isCritical);
                    
                    // Shadow partner damage shown separately
                    if (shadowPartnerDamage > 0) {
                        setTimeout(() => {
                            showDamageNumber(shadowPartnerDamage, m.x + m.width / 2 + 20, m.y - 10, false, { isShadowPartner: true });
                        }, 50);
                    }
                    
                    // Track tutorial action when hitting test dummy (must happen before continue)
                    if (m.type === 'testDummy') {
                        trackTutorialAction('attackDummy');
                        // Show hit animation for test dummy
                        if (m.isPixelArt) {
                            const sData = spriteData[m.type];
                            if (sData && sData.animations.hit) {
                                const hitFrame = sData.animations.hit[0];
                                m.element.style.backgroundPosition = `-${hitFrame.x * PIXEL_ART_SCALE}px -${hitFrame.y * PIXEL_ART_SCALE}px`;
                                if (m.hitAnimationTimeout) clearTimeout(m.hitAnimationTimeout);
                                m.hitAnimationTimeout = setTimeout(() => {
                                    if (m.element) {
                                        const idleFrame = sData.animations.idle[0];
                                        m.element.style.backgroundPosition = `-${idleFrame.x * PIXEL_ART_SCALE}px -${idleFrame.y * PIXEL_ART_SCALE}px`;
                                    }
                                }, 100);
                            }
                        }
                    }
                    
                    // Mark attack as hit (for multi-target handling)
                    attack.hitMonsters.push(m.id);
                    if (!attack.isMultiTarget) {
                        attack.toRemove = true;
                        // Broadcast projectile hit to other players
                        if (attack.id && typeof broadcastProjectileHit === 'function') {
                            console.log('[Game] Broadcasting projectile hit for server-auth damage, id:', attack.id);
                            broadcastProjectileHit(attack.id, attack.x, attack.y);
                        }
                        break; // Single-target attack - stop after first hit
                    }
                    continue; // Skip local damage processing
                }
                
                // Local damage processing (single-player or offline mode)
                m.hp -= totalDamage;
                if (shadowPartnerDamage > 0) {
                    m.hp -= shadowPartnerDamage;
                }
                playSound('monsterHit');

                // Track World Boss damage if this monster is a world boss
                if (m.isWorldBoss && typeof damageWorldBoss === 'function') {
                    damageWorldBoss(totalDamage + shadowPartnerDamage, player.name);
                    // Skip damage number if world boss is dead (prevents spam)
                    if (m.hp <= 0) continue;
                }

                // Spawn hit squib VFX at closest filled pixel to hit location
                spawnHitSquibVFX(m, attack, isCritical);

                // --- THIS IS THE FIX ---
                // Show the monster's HP bar and nameplate on first hit.
                if (m.hpBarContainer) m.hpBarContainer.style.display = 'block';
                if (m.nameplateElement) m.nameplateElement.style.display = 'block';
                // --- END OF FIX ---

                // Apply knockback unless monster has noKnockback flag (world bosses have no knockback)
                const monsterData = monsterTypes[m.type];
                if (monsterData && !monsterData.noKnockback && !m.isWorldBoss) {
                    // Default to right if facing is not set
                    const knockbackDir = player.facing ? (player.facing === 'right' ? 1 : -1) : 1;
                    m.velocityX = knockbackDir * KNOCKBACK_FORCE;
                }
                
                showDamageNumber(totalDamage, m.x + m.width / 2, m.y, false, { isCritical });
                
                // Show shadow partner damage number (slightly offset and in purple)
                if (shadowPartnerDamage > 0) {
                    setTimeout(() => {
                        showDamageNumber(shadowPartnerDamage, m.x + m.width / 2 + 20, m.y - 10, false, { isShadowPartner: true });
                    }, 50);
                }

                // Update HP bar (world boss uses global UI, others use local bar)
                if (m.hpBar) {
                    m.hpBar.style.width = `${Math.max(0, m.hp) / m.maxHp * 100}%`;
                }
                
                // Flash the world boss monster on hit
                if (m.isWorldBoss && m.element) {
                    m.element.classList.add('hit');
                    setTimeout(() => m.element.classList.remove('hit'), 200);
                }
                
                // Update elite monster HP bar if this is a elite monster
                if (m.isEliteMonster) {
                    updateEliteMonsterHPBar(m);
                }
                
                // Update mini boss HP bar if this is a mini boss or trial boss
                if ((m.isMiniBoss || m.isTrialBoss) && !m.isEliteMonster) {
                    updateMiniBossHPBar(m);
                    // Set activity to boss fighting
                    if (typeof setPlayerActivity === 'function') {
                        setPlayerActivity('boss');
                    }
                } else {
                    // Set activity to grinding when killing regular monsters
                    if (typeof setPlayerActivity === 'function' && window.playerActivity !== 'boss') {
                        setPlayerActivity('grinding');
                    }
                }

                // Update quest progress for hit-type objectives
                updateQuestProgressHit(m.type);

                // Track tutorial action when hitting test dummy
                if (m.type === 'testDummy') {
                    trackTutorialAction('attackDummy');
                }

                // Test dummies don't die but show hit animation
                if (m.type === 'testDummy' && m.isPixelArt) {
                    const sData = spriteData[m.type];
                    if (sData.animations.hit) {
                        const hitFrame = sData.animations.hit[0];
                        m.element.style.backgroundPosition = `-${hitFrame.x * PIXEL_ART_SCALE}px -${hitFrame.y * PIXEL_ART_SCALE}px`;
                        
                        // Clear any existing timeout
                        if (m.hitAnimationTimeout) {
                            clearTimeout(m.hitAnimationTimeout);
                        }
                        
                        // Return to idle after 100ms
                        m.hitAnimationTimeout = setTimeout(() => {
                            if (m.element) {
                                const idleFrame = sData.animations.idle[0];
                                m.element.style.backgroundPosition = `-${idleFrame.x * PIXEL_ART_SCALE}px -${idleFrame.y * PIXEL_ART_SCALE}px`;
                            }
                        }, 100);
                    }
                }

                if (m.hp <= 0 && m.type !== 'testDummy') {
                    // World boss death is handled by endWorldBossEvent, not here
                    if (m.isWorldBoss) {
                        continue; // Skip normal death handling - damageWorldBoss triggers endWorldBossEvent
                    }
                    
                    // SERVER-ONLY MODE: ALL death/drops handled server-side
                    if (!m.serverId) {
                        console.error('[DROP ERROR] Monster died WITHOUT serverId! Type:', m.type, 'isElite:', m.isEliteMonster);
                        console.error('[DROP ERROR] This monster should not exist. Removing without drops.');
                        // Remove the invalid monster
                        if (m.element) m.element.remove();
                        if (m.hitboxElement) m.hitboxElement.remove();
                        const index = monsters.indexOf(m);
                        if (index > -1) monsters.splice(index, 1);
                        continue;
                    }
                    // If monster has serverId, server will send death event - skip local processing
                    continue;
                }

                attack.hitMonsters.push(m.id);
                if (!attack.isMultiTarget) {
                    attack.toRemove = true;
                    // Broadcast projectile hit to other players (local/offline mode)
                    if (attack.id && typeof broadcastProjectileHit === 'function') {
                        console.log('[Game] Broadcasting projectile hit for local damage, id:', attack.id);
                        broadcastProjectileHit(attack.id, attack.x, attack.y);
                    }
                    break;
                }
            }
        }
    }

    for (let i = activeAttacks.length - 1; i >= 0; i--) {
        if (activeAttacks[i].toRemove) {
            activeAttacks[i].element.remove();
            activeAttacks.splice(i, 1);
        }
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
        if (projectiles[i].toRemove) {
            projectiles[i].element.remove();
            projectiles.splice(i, 1);
        }
    }
}

function isColliding(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y;
}

/**
 * Calculate the ground surface Y at a given X position, accounting for slopes and hills.
 * @param {number} centerX - The center X position of the entity
 * @param {object} map - The current map object (with slopes and hills arrays)
 * @param {number} groundY - The base ground Y level
 * @param {number} scaledTileSize - The scaled tile size (usually 48)
 * @returns {number} The Y position of the ground surface at this X
 */
function getSlopeSurfaceY(centerX, map, groundY, scaledTileSize) {
    if (!map.slopes && !map.hills) {
        return groundY;
    }
    
    // Expand hills into pairs of slopes
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
            width: 0,
            isHillDownSlope: true
        });
    });
    
    for (const slope of allSlopes) {
        const numTiles = slope.tiles || 1;
        const slopeX = slope.x;
        const capWidth = slope.isHillDownSlope ? 0 : (slope.width || scaledTileSize);
        const numCapTiles = Math.ceil(capWidth / scaledTileSize);
        
        const slopeWidth = numTiles * scaledTileSize;
        const totalHeight = numTiles * scaledTileSize;
        
        let startX, endX, capStartX, capEndX;
        const collisionPadding = 20;
        
        if (slope.direction === 'left') {
            if (slope.isHillDownSlope) {
                capStartX = slopeX;
                capEndX = slopeX;
                startX = slopeX; // No padding at start (connects directly to up-slope cap)
                endX = slopeX + slopeWidth + collisionPadding;
            } else {
                capStartX = slopeX - (numCapTiles * scaledTileSize);
                capEndX = slopeX;
                startX = capStartX - collisionPadding;
                endX = slopeX + slopeWidth + collisionPadding;
            }
        } else {
            startX = slopeX - collisionPadding;
            capStartX = slopeX + slopeWidth;
            capEndX = capStartX + (numCapTiles * scaledTileSize);
            // No padding after cap if this is a hill (connects to down-slope)
            endX = slope.isHillPart ? capEndX : capEndX + collisionPadding;
        }
        
        if (centerX >= startX && centerX <= endX) {
            let surfaceY;
            const maxSlopeOffset = 10;
            const transitionZone = 30;
            
            if (slope.direction === 'left') {
                if (numCapTiles > 0 && centerX <= capEndX) {
                    surfaceY = groundY - totalHeight;
                } else {
                    // On the slope going down
                    if (centerX <= slopeX + slopeWidth) {
                        // On the visual slope tiles
                        const slopeProgress = Math.max(0, Math.min(1, (centerX - slopeX) / slopeWidth));
                        surfaceY = groundY - totalHeight + (slopeProgress * totalHeight);
                        
                        // Apply offset smoothly
                        // Entry is at TOP (slopeX), exit is at BOTTOM (slopeX + slopeWidth)
                        const distFromTop = centerX - slopeX;
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
                if (centerX >= capStartX) {
                    surfaceY = groundY - totalHeight;
                } else if (centerX >= slopeX) {
                    // On the visual slope tiles
                    const slopeProgress = Math.max(0, Math.min(1, (centerX - slopeX) / slopeWidth));
                    surfaceY = groundY - (slopeProgress * totalHeight);
                    
                    // Apply offset smoothly (subtract to lift entities up)
                    const distFromBottom = centerX - slopeX;
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
            
            return surfaceY;
        }
    }
    
    return groundY;
}

function getCloudTintFromBackground(bgColor) {
    // Convert hex/rgba to RGB values
    let r, g, b;
    
    if (bgColor.startsWith('#')) {
        // Handle hex colors
        const hex = bgColor.replace('#', '');
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    } else if (bgColor.startsWith('rgb')) {
        // Handle rgb/rgba colors
        const matches = bgColor.match(/\d+/g);
        r = parseInt(matches[0]);
        g = parseInt(matches[1]);
        b = parseInt(matches[2]);
    } else {
        // Default to light blue if unable to parse
        return 'brightness(1.0) sepia(0.1) saturate(0.8) hue-rotate(190deg)';
    }
    
    // Calculate brightness (0-1 scale)
    const brightness = (r + g + b) / (3 * 255);
    
    // Calculate dominant hue
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let hue = 0;
    if (delta !== 0) {
        if (max === r) {
            hue = ((g - b) / delta) % 6;
        } else if (max === g) {
            hue = (b - r) / delta + 2;
        } else {
            hue = (r - g) / delta + 4;
        }
        hue = Math.round(hue * 60);
        if (hue < 0) hue += 360;
    }
    
    // Calculate saturation
    const lightness = (max + min) / (2 * 255);
    const saturation = delta === 0 ? 0 : delta / (255 * (1 - Math.abs(2 * lightness - 1)));
    
    // Adjust cloud appearance based on background
    // Darker backgrounds = darker clouds, warmer/cooler backgrounds affect hue
    const cloudBrightness = 0.7 + (brightness * 0.5); // Range: 0.7-1.2
    const cloudSaturation = 0.3 + (saturation * 0.4); // Add some color from background
    const hueRotate = (hue - 200) * 0.3; // Shift towards background hue (200 is base blue)
    
    return `brightness(${cloudBrightness}) saturate(${cloudSaturation}) sepia(0.15) hue-rotate(${hueRotate}deg)`;
}

function isGroundAt(x, y) {
    const map = maps[currentMapId];
    if (!map) return false;

    const groundLevel = (map.height || GAME_CONFIG.BASE_GAME_HEIGHT) - GAME_CONFIG.GROUND_Y;
    
    // Check slope surface at this X position
    const slopeSurfaceY = getSlopeSurfaceY(x, map, groundLevel, 48);
    
    // Use large tolerance to account for slope height changes
    // A 2-tile slope is 96px, so we need to allow probing well above/below the surface
    // If probe is within 150px of the slope surface (above or below), there's ground
    const tolerance = 150;
    if (y >= slopeSurfaceY - tolerance && y <= slopeSurfaceY + tolerance) {
        return true;
    }

    // Check platforms
    for (const p of platforms) {
        if (p.isLadder || p.y === undefined) continue;
        const platformSurfaceTop = p.y;
        const platformSurfaceBottom = p.y + p.height;
        const platformStartX = p.x + PLATFORM_EDGE_PADDING;
        const platformEndX = p.x + p.width - PLATFORM_EDGE_PADDING;
        if (x >= platformStartX && x <= platformEndX && y >= platformSurfaceTop && y <= platformSurfaceBottom) {
            return true;
        }
    }
    
    // Check structures (similar to platforms but defined in map data)
    if (map.structures) {
        for (const s of map.structures) {
            if (s.y === undefined) continue;
            const structureSurfaceTop = s.y;
            const structureSurfaceBottom = s.y + 50; // Structures have ~50px height tolerance
            const structureStartX = s.x + 3; // Small edge padding
            const structureEndX = s.x + s.width - 3;
            if (x >= structureStartX && x <= structureEndX && y >= structureSurfaceTop && y <= structureSurfaceBottom) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Checks if the player is stuck and teleports them to a safe position if needed.
 * Used only for: game loading, map changes, and F9 emergency command.
 * No longer runs automatically during gameplay.
 */
function validatePlayerPosition() {
    const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
    let isStuck = false;
    
    // Check if player is stuck inside a platform
    for (const p of platforms) {
        if (p.isLadder || p.y === undefined) continue;
        if (isColliding(playerRect, p)) {
            isStuck = true;
            console.warn('Player detected stuck inside platform, teleporting to safety');
            break;
        }
    }
    
    // Check if player is out of bounds
    const map = maps[currentMapId];
    if (player.x < 0 || player.x + player.width > map.width || 
        player.y < 0 || player.y + player.height > (map.height || GAME_CONFIG.BASE_GAME_HEIGHT)) {
        isStuck = true;
        console.warn('Player detected out of bounds, teleporting to safety');
    }
    
    if (isStuck) {
        const safePosition = findSafeSpawnPosition();
        player.x = safePosition.x;
        player.y = safePosition.y;
        player.velocityX = 0;
        player.velocityY = 0;
        player.isJumping = false;
        player.onLadder = false;
        addChatMessage('You have been moved to a safe location.', 'system');
        return true;
    }
    
    return false;
}

/**
 * Finds a safe spawn position for the player on the current map.
 * @param {number} preferredX - The preferred X coordinate to spawn at.
 * @param {number} preferredY - The preferred Y coordinate to spawn at.
 * @returns {object} An object with safe x and y coordinates.
 */
function findSafeSpawnPosition(preferredX, preferredY) {
    const map = maps[currentMapId];
    if (!map) return { x: 150, y: 300 };

    const playerWidth = 30;
    const playerHeight = 60;
    const groundLevel = (map.height || GAME_CONFIG.BASE_GAME_HEIGHT) - GAME_CONFIG.GROUND_Y;
    
    // Function to check if a position is safe (no collision with platforms, within bounds)
    function isPositionSafe(testX, testY) {
        // Check map boundaries
        if (testX < 0 || testX + playerWidth > map.width) return false;
        if (testY < 0 || testY + playerHeight > (map.height || GAME_CONFIG.BASE_GAME_HEIGHT)) return false;
        
        // Check for collision with platforms (player should not be inside them)
        const playerRect = { x: testX, y: testY, width: playerWidth, height: playerHeight };
        for (const p of platforms) {
            if (p.isLadder || p.y === undefined) continue;
            if (isColliding(playerRect, p)) return false;
        }
        
        // Ensure there's ground beneath the player
        const groundCheckY = testY + playerHeight + 10; // Check 10 pixels below player feet
        if (!isGroundAt(testX + playerWidth / 2, groundCheckY)) return false;
        
        return true;
    }
    
    // First, try the preferred position
    if (preferredX !== undefined && preferredY !== undefined) {
        // For portals with specific Y coordinates, try to find a platform at that Y level
        for (const p of platforms) {
            if (p.isLadder || p.noSpawn || p.y === undefined) continue;
            
            // Check if the platform Y is close to the preferred Y
            const platformTop = p.y - playerHeight;
            if (Math.abs(platformTop - preferredY) < 50) { // Within 50 pixels
                // Try to spawn on this platform near the preferred X
                const clampedX = Math.max(p.x + PLATFORM_EDGE_PADDING, 
                                         Math.min(preferredX, p.x + p.width - PLATFORM_EDGE_PADDING - playerWidth));
                if (isPositionSafe(clampedX, platformTop)) {
                    return { x: clampedX, y: platformTop };
                }
            }
        }
        
        // If no platform found, try the exact position anyway
        if (isPositionSafe(preferredX, preferredY)) {
            return { x: preferredX, y: preferredY };
        }
    }
    
    // If preferred position is not safe, try the preferred X on ground level
    if (preferredX !== undefined) {
        const groundY = groundLevel - playerHeight;
        if (isPositionSafe(preferredX, groundY)) {
            return { x: preferredX, y: groundY };
        }
        
        // If ground level doesn't work, find the closest platform to preferredX
        let closestPlatform = null;
        let closestDistance = Infinity;
        
        for (const p of platforms) {
            if (p.isLadder || p.noSpawn || p.y === undefined) continue;
            
            // Calculate distance from preferredX to platform center
            const platformCenterX = p.x + (p.width / 2);
            const distance = Math.abs(platformCenterX - preferredX);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPlatform = p;
            }
        }
        
        // Try to spawn on the closest platform at the preferredX (clamped to platform bounds)
        if (closestPlatform) {
            const platformTop = closestPlatform.y - playerHeight;
            const clampedX = Math.max(closestPlatform.x + PLATFORM_EDGE_PADDING, 
                                     Math.min(preferredX, closestPlatform.x + closestPlatform.width - PLATFORM_EDGE_PADDING - playerWidth));
            if (isPositionSafe(clampedX, platformTop)) {
                return { x: clampedX, y: platformTop };
            }
        }
    }
    
    // Try to find a safe position on platforms
    for (const p of platforms) {
        if (p.isLadder || p.noSpawn || p.y === undefined) continue;
        
        const platformTop = p.y - playerHeight;
        const platformCenterX = p.x + (p.width / 2) - (playerWidth / 2);
        
        // Try center of platform
        if (isPositionSafe(platformCenterX, platformTop)) {
            return { x: platformCenterX, y: platformTop };
        }
        
        // Try left side of platform
        const platformLeftX = p.x + PLATFORM_EDGE_PADDING;
        if (isPositionSafe(platformLeftX, platformTop)) {
            return { x: platformLeftX, y: platformTop };
        }
        
        // Try right side of platform
        const platformRightX = p.x + p.width - PLATFORM_EDGE_PADDING - playerWidth;
        if (isPositionSafe(platformRightX, platformTop)) {
            return { x: platformRightX, y: platformTop };
        }
    }
    
    // Last resort: try ground level at various X positions
    const groundY = groundLevel - playerHeight;
    const testPositions = [
        150, // Default spawn
        map.width * 0.25, // Quarter way through map
        map.width * 0.5,  // Middle of map
        map.width * 0.75, // Three quarters through map
        100, 200, 300, 400, 500 // Various fixed positions
    ];
    
    for (const testX of testPositions) {
        if (testX < 0 || testX + playerWidth > map.width) continue;
        if (isPositionSafe(testX, groundY)) {
            return { x: testX, y: groundY };
        }
    }
    
    // Ultimate fallback - return a basic safe position (should never reach here)
    console.warn('Could not find safe spawn position, using fallback');
    return { x: 150, y: groundLevel - playerHeight };
}

function updateDroppedItems() {
    for (let i = droppedItems.length - 1; i >= 0; i--) {
        const item = droppedItems[i];

        // --- NEW: Reset bobbing offset if the item is moving ---
        if (item.velocityY !== 0 || Math.abs(item.velocityX) > 0.1) {
            item.visualYOffset = 0;
        }
        // --- END NEW ---

        item.x += item.velocityX;
        item.velocityX *= 0.97; // Apply friction
        item.velocityY += GRAVITY;
        item.y += item.velocityY;

        // Animate gold coins
        if (item.name === 'Gold') {
            item.animationTimer = (item.animationTimer || 0) + 1;
            if (item.animationTimer > 10) {
                item.animationTimer = 0;
                item.animationFrame = (item.animationFrame + 1) % 4;
            }
            item.element.style.backgroundPosition = `-${item.animationFrame * 24}px 0px`;
        }

        const anchorY = item.anchorPoint ? item.anchorPoint.y : item.height;
        let onSurface = false;

        // Check for collision with platforms
        platforms.forEach(p => {
            if (p.isLadder || p.y === undefined) return;
            if (isColliding(item, p) && item.velocityY > 0 && (item.y - item.velocityY + anchorY) <= p.y) {
                item.y = p.y - anchorY;
                item.velocityY = 0;
                onSurface = true;
            }
        });

        // Check for collision with ground (with slope support)
        const map = maps[currentMapId];
        const groundLevel = (map.height || GAME_CONFIG.BASE_GAME_HEIGHT) - GAME_CONFIG.GROUND_Y;
        const itemCenterX = item.x + item.width / 2;
        const slopeSurfaceY = getSlopeSurfaceY(itemCenterX, map, groundLevel, 48);
        if (!onSurface && item.y + anchorY > slopeSurfaceY) {
            item.y = slopeSurfaceY - anchorY;
            item.velocityY = 0;
        }

        if (item.velocityY === 0 && Math.abs(item.velocityX) < 0.1) {
            item.velocityX = 0;
            item.x = Math.round(item.x);
            item.y = Math.round(item.y);

            // --- NEW: Calculate the bobbing animation when the item is at rest ---
            item.bobTimer += 0.05; // Controls the speed of the bob
            const bobAmplitude = 2; // Controls the height of the bob
            item.visualYOffset = Math.sin(item.bobTimer) * bobAmplitude;
            // --- END NEW ---
        }
    }
}

/**
 * Updates the visibility of NPC and Portal interaction prompts.
 */
function updatePrompts() {
    const isAnyBlockingWindowOpen = Array.from(document.querySelectorAll('.window')).some(
        win => win.style.display !== 'none' && win.dataset.isPassive !== 'true'
    );

    // Get the current key for the 'interact' action once per frame.
    let interactKeyLabel = 'Y'; // Default value
    if (typeof keyMappingManager !== 'undefined') {
        const mappedKeyCode = keyMappingManager.getMappedKey('interact');
        if (mappedKeyCode) {
            interactKeyLabel = keyMappingManager.getKeyLabel(mappedKeyCode);
        }
    }

    // Update NPC prompts and quest indicators
    npcs.forEach(npc => {
        const distance = Math.hypot((player.x + player.width / 2) - (npc.x + npc.width / 2), (player.y + player.height / 2) - (npc.y + npc.height / 2));
        const canInteract = distance < NPC_INTERACTION_RANGE && !player.isDead && !isAnyBlockingWindowOpen;

        if (canInteract) {
            npc.promptElement.textContent = `[${interactKeyLabel}]`;
            npc.promptElement.style.display = 'block';
        } else {
            npc.promptElement.style.display = 'none';
        }

        const questStatus = getNpcQuestStatus(npc);
        let newAnim = null;
        if (questStatus === 'complete') newAnim = 'completeQuest';
        else if (questStatus === 'available') newAnim = 'newQuest';
        else if (questStatus === 'inProgress') newAnim = 'currentQuest';

        if (npc.questIndicatorContainer.dataset.anim !== newAnim) {
            npc.questIndicatorContainer.dataset.anim = newAnim || '';
            npc.questIndicatorContainer.animationFrame = 0;
            npc.questIndicatorContainer.animationTimer = 0;
        }
    });

    // Handle Portal prompts
    portals.forEach(portal => {
        const canInteract = isColliding(player, portal) && !player.isJumping && !player.isDead && !isAnyBlockingWindowOpen;
        portal.arrowElement.style.display = canInteract ? 'block' : 'none';
    });
}

function updateQuestProgress(monsterType) {
    let questUpdated = false;
    player.quests.active.forEach(quest => {
        const qData = questData[quest.id];
        if (qData.objective.type === 'kill' && qData.objective.target === monsterType && quest.progress < qData.objective.count) {
            quest.progress++;
            questUpdated = true;

            // --- THIS IS THE FIX ---
            // Look up the monster's proper name from the monsterTypes object.
            const monsterInfo = monsterTypes[qData.objective.target];
            const monsterName = monsterInfo ? monsterInfo.name : capitalize(qData.objective.target);
            showNotification(`${qData.title}: ${monsterName} ${quest.progress}/${qData.objective.count}`, 'common');
            // --- END OF FIX ---
            
            // Play VFX when objective is fully complete
            if (quest.progress >= qData.objective.count) {
                playQuestVFX();
            }
        } else if (qData.objective.type === 'killMultiple') {
            // Handle multiple kill targets
            const target = qData.objective.targets.find(t => t.monster === monsterType);
            if (target) {
                // Initialize multiProgress if it doesn't exist
                if (!quest.multiProgress) {
                    quest.multiProgress = {};
                }
                if (!quest.multiProgress[monsterType]) {
                    quest.multiProgress[monsterType] = 0;
                }
                
                // Increment progress if not yet complete for this target
                if (quest.multiProgress[monsterType] < target.count) {
                    quest.multiProgress[monsterType]++;
                    questUpdated = true;
                    
                    const monsterInfo = monsterTypes[monsterType];
                    const monsterName = monsterInfo ? monsterInfo.name : capitalize(monsterType);
                    showNotification(`${qData.title}: ${monsterName} ${quest.multiProgress[monsterType]}/${target.count}`, 'common');
                    
                    // Check if ALL targets are complete
                    const allComplete = qData.objective.targets.every(t => 
                        quest.multiProgress[t.monster] >= t.count
                    );
                    
                    if (allComplete) {
                        playQuestVFX();
                    }
                }
            }
        }
    });

    // Update quest log UI if any quest was updated and the function exists
    if (questUpdated && typeof updateQuestLogUI === 'function') {
        updateQuestLogUI();
    }

    // Auto-open quest helper when progress is made
    if (questUpdated && typeof autoOpenQuestHelper === 'function') {
        autoOpenQuestHelper();
    }

    // Check for newly completable quests to notify the player
    player.quests.active.forEach(quest => {
        const qData = questData[quest.id];
        if (qData.objective.type === 'kill' && quest.progress >= qData.objective.count && !quest.turnInNotified) {
            quest.turnInNotified = true; // Mark as notified to prevent spam
            const npcName = findNpcForQuest(quest.id);
            addChatMessage(`[Quest Update] "${qData.title}" is ready to be turned in at ${npcName}.`, 'quest-complete');
        }
    });

    // Update quest log window in real-time if open
    if (questUpdated && questLogElement && questLogElement.style.display !== 'none') {
        updateQuestLogUI();
    }
}

function updateQuestProgressHit(monsterType) {
    let questUpdated = false;
    player.quests.active.forEach(quest => {
        const qData = questData[quest.id];
        if (qData.objective.type === 'hit' && qData.objective.target === monsterType && quest.progress < qData.objective.count) {
            quest.progress++;
            questUpdated = true;

            const monsterInfo = monsterTypes[qData.objective.target];
            const monsterName = monsterInfo ? monsterInfo.name : capitalize(qData.objective.target);
            showNotification(`${qData.title}: Hit ${monsterName} ${quest.progress}/${qData.objective.count}`, 'common');
            
            // Play VFX when objective is fully complete
            if (quest.progress >= qData.objective.count) {
                playQuestVFX();
            }
        }
    });

    // Update quest log UI if any quest was updated
    if (questUpdated && typeof updateQuestLogUI === 'function') {
        updateQuestLogUI();
    }

    // Auto-open quest helper when progress is made
    if (questUpdated && typeof autoOpenQuestHelper === 'function') {
        autoOpenQuestHelper();
    }

    // Check for newly completable quests to notify the player
    player.quests.active.forEach(quest => {
        const qData = questData[quest.id];
        if (qData.objective.type === 'hit' && quest.progress >= qData.objective.count && !quest.turnInNotified) {
            quest.turnInNotified = true;
            const npcName = findNpcForQuest(quest.id);
            addChatMessage(`[Quest Update] "${qData.title}" is ready to be turned in at ${npcName}.`, 'quest-complete');
        }
    });

    // Update quest log window in real-time if open
    if (questUpdated && questLogElement && questLogElement.style.display !== 'none') {
        updateQuestLogUI();
    }
}

function updateQuestProgressUseItem(itemName) {
    let questUpdated = false;
    player.quests.active.forEach(quest => {
        const qData = questData[quest.id];
        if (qData.objective.type === 'useItem' && qData.objective.target === itemName && quest.progress < qData.objective.count) {
            quest.progress++;
            questUpdated = true;

            showNotification(`${qData.title}: Used ${itemName} ${quest.progress}/${qData.objective.count}`, 'common');
            
            // Play VFX when objective is fully complete
            if (quest.progress >= qData.objective.count) {
                playQuestVFX();
            }
        }
    });

    // Update quest log UI if any quest was updated
    if (questUpdated && typeof updateQuestLogUI === 'function') {
        updateQuestLogUI();
    }

    // Auto-open quest helper when progress is made
    if (questUpdated && typeof autoOpenQuestHelper === 'function') {
        autoOpenQuestHelper();
    }

    // Check for newly completable quests to notify the player
    player.quests.active.forEach(quest => {
        const qData = questData[quest.id];
        if (qData.objective.type === 'useItem' && quest.progress >= qData.objective.count && !quest.turnInNotified) {
            quest.turnInNotified = true;
            const npcName = findNpcForQuest(quest.id);
            addChatMessage(`[Quest Update] "${qData.title}" is ready to be turned in at ${npcName}.`, 'quest-complete');
        }
    });

    // Update quest log window in real-time if open
    if (questUpdated && questLogElement && questLogElement.style.display !== 'none') {
        updateQuestLogUI();
    }
}

/**
 * Updates the player's chat bubble timer.
 */
function updateChatBubble() {
    if (player.chatTimer > 0) {
        player.chatTimer--;
        if (player.chatTimer <= 0) {
            player.chatMessage = null;
        }
    }
}

/**
 * Updates the player's current animation frame.
 */
function updatePlayerAnimation() {
    const animData = spriteData.player.animations[player.animationState];
    if (!animData) return;
    player.animationTimer++;
    const frameDuration = player.animationState === 'walk' ? 8 : 15;
    if (player.animationTimer > frameDuration) {
        player.animationTimer = 0;
        player.animationFrame = (player.animationFrame + 1) % animData.length;
    }
}

/**
 * Updates the animations for quest and portal icons.
 */
function updateAnimatedIcons() {
    const iconData = spriteData.questIcons;
    const frameDuration = 10;
    const allIcons = [
        ...npcs.map(n => n.questIndicatorContainer),
        ...portals.map(p => p.arrowElement)
    ].filter(Boolean);

    allIcons.forEach(icon => {
        const animName = icon.dataset.anim;
        const animFrames = animName ? iconData.animations[animName] : null;

        if (!animFrames) {
            icon.style.backgroundImage = 'none';
            return;
        }

        icon.style.backgroundImage = `url(${artAssets.questIcons})`;
        const sheetWidth = iconData.sheetWidth * PIXEL_ART_SCALE;
        const sheetHeight = iconData.sheetHeight * PIXEL_ART_SCALE;
        icon.style.backgroundSize = `${sheetWidth}px ${sheetHeight}px`;

        icon.animationTimer = (icon.animationTimer || 0) + 1;
        if (icon.animationTimer > frameDuration) {
            icon.animationTimer = 0;
            icon.animationFrame = ((icon.animationFrame || 0) + 1) % animFrames.length;
        }

        const currentFrameData = animFrames[icon.animationFrame || 0];
        if (currentFrameData) {
            const bgX = -currentFrameData.x * PIXEL_ART_SCALE;
            const bgY = -currentFrameData.y * PIXEL_ART_SCALE;
            icon.style.backgroundPosition = `${bgX}px ${bgY}px`;
        }
    });
}
/**
 * Updates the animation frame for all active portals.
 */
function updatePortalAnimations() {
    const portalData = spriteData.portal;
    const animation = portalData.animations.idle;
    const frameDuration = 15; // How many game frames each animation frame lasts

    portals.forEach(portal => {
        portal.animationTimer = (portal.animationTimer || 0) + 1;
        if (portal.animationTimer > frameDuration) {
            portal.animationTimer = 0;
            portal.animationFrame = (portal.animationFrame + 1) % animation.length;
        }
        const frame = animation[portal.animationFrame];
        portal.element.style.backgroundPosition = `-${frame.x * PIXEL_ART_SCALE}px -${frame.y * PIXEL_ART_SCALE}px`;
    });
}

/**
 * Updates the animations for quest and portal icons.
 */
function updateAnimatedIcons() {
    const iconData = spriteData.questIcons;
    const frameDuration = 10;
    const allIcons = [
        ...npcs.map(n => n.questIndicatorContainer),
        ...portals.map(p => p.arrowElement)
    ].filter(Boolean);

    allIcons.forEach(icon => {
        const animName = icon.dataset.anim;
        const animFrames = animName ? iconData.animations[animName] : null;

        if (!animFrames) {
            icon.style.backgroundImage = 'none';
            return;
        }

        icon.style.backgroundImage = `url(${artAssets.questIcons})`;
        const sheetWidth = iconData.sheetWidth * PIXEL_ART_SCALE;
        const sheetHeight = iconData.sheetHeight * PIXEL_ART_SCALE;
        icon.style.backgroundSize = `${sheetWidth}px ${sheetHeight}px`;

        icon.animationTimer = (icon.animationTimer || 0) + 1;
        if (icon.animationTimer > frameDuration) {
            icon.animationTimer = 0;
            icon.animationFrame = ((icon.animationFrame || 0) + 1) % animFrames.length;
        }

        const currentFrameData = animFrames[icon.animationFrame || 0];
        if (currentFrameData) {
            const bgX = -currentFrameData.x * PIXEL_ART_SCALE;
            const bgY = -currentFrameData.y * PIXEL_ART_SCALE;
            icon.style.backgroundPosition = `${bgX}px ${bgY}px`;
        }
    });
}

// in game.js

// in game.js

// Helper function to check if a key matches a mapped action
function isKeyForAction(key, action) {
    // Always use the defaults for core functionality to ensure reliability
    const defaults = {
        'move-left': 'arrowleft', 'move-right': 'arrowright', 'move-up': 'arrowup', 'move-down': 'arrowdown',
        'jump': 'alt', 'attack': 'control', 'hotbar-1': '1', 'hotbar-2': '2', 'hotbar-3': '3', 'hotbar-4': '4',
        'potion-hp': '5', 'potion-mp': '6', 'hotbar-7': '7', 'hotbar-8': '8', 'hotbar-9': '9', 'hotbar-10': '0',
        'hotbar-11': '-', 'hotbar-12': '=', 'inventory': 'i', 'equipment': 'e', 'skills': 'k', 'stats': 's',
        'achievements': 'a', 'bestiary': 'b', 'quest-log': 'l', 'world-map': 'w', 'minimap': 'm', 'settings': 'escape',
        'chat': 'enter', 'interact': 'y', 'loot': 'z', 'hitboxes': 'h', 'gm-window': '`', 'pet': 'p', 'social-hub': 'o'
    };
    
    // Check if we should use custom mappings (only for established characters)
    if (typeof keyMappingManager !== 'undefined' && keyMappingManager.mappings) {
        // Normalize key for comparison
        let normalizedKey = key.toLowerCase();
        if (key === 'Control') normalizedKey = 'control';
        else if (key === 'Alt') normalizedKey = 'alt';
        else if (key === 'Shift') normalizedKey = 'shift';
        else if (key === 'Meta') normalizedKey = 'meta';
        
        return keyMappingManager.isKeyMapped(normalizedKey, action);
    }
    
    // Fallback to defaults
    return defaults[action] === key.toLowerCase();
}

// NEW, CORRECTED EVENT LISTENERS FOR game.js

// This object maps all possible game actions to their default states.
const allGameActions = [
    'move-left', 'move-right', 'move-up', 'move-down', 'jump', 'attack',
    'loot', 'interact', 'inventory', 'equipment', 'skills', 'stats',
    'achievements', 'bestiary', 'rankings', 'quest-log', 'quest-helper', 'world-map', 'settings',
    'minimap', 'hotbar-1', 'hotbar-2', 'hotbar-3', 'hotbar-4', 'hotbar-5',
    'hotbar-6', 'hotbar-7', 'hotbar-8', 'hotbar-9', 'hotbar-10', 'hotbar-11',
    'hotbar-12', 'hitboxes', 'gm-window', 'pet', 'social-hub'
];

document.addEventListener('keydown', (e) => {
    if (!e.key) return;
    const key = e.key.toLowerCase();

    // Disable Escape key in pre-game menus
    if (key === 'escape') {
        const startScreen = document.getElementById('start-screen');
        const charSelection = document.getElementById('character-selection-screen');
        const charCreation = document.getElementById('character-creation');
        
        // Debug logging
        console.log('[ESC Debug] Start screen display:', startScreen ? startScreen.style.display : 'null');
        console.log('[ESC Debug] Char selection display:', charSelection ? charSelection.style.display : 'null');
        console.log('[ESC Debug] Char creation display:', charCreation ? charCreation.style.display : 'null');
        
        // Check if any pre-game screen is visible (display is not 'none' and not empty)
        const isInPreGameMenu = (startScreen && startScreen.style.display && startScreen.style.display !== 'none') ||
                               (charSelection && charSelection.style.display && charSelection.style.display !== 'none') ||
                               (charCreation && charCreation.style.display && charCreation.style.display !== 'none');
        
        console.log('[ESC Debug] isInPreGameMenu:', isInPreGameMenu);
        
        if (isInPreGameMenu) {
            console.log('[ESC Debug] BLOCKING ESC KEY');
            e.preventDefault();
            e.stopImmediatePropagation(); // Stop ALL other listeners from processing this event
            return; // Block Escape key in pre-game menus
        }
    }

    // Special handling for chat and Escape key
    if (isKeyForAction(key, 'chat')) {
        // Chat logic remains the same...
        const chatInputContainer = document.getElementById('chat-input-container');
        const chatInput = document.getElementById('chat-input');
        const chatChannelIndicator = document.getElementById('chat-channel-indicator');
        if (isChatting) {
            const message = chatInput.value.trim();
            if (message) {
                // Check for chat channel switching commands first
                if (message === '/m' || message === '/M') {
                    currentChatChannel = 'map';
                    if (chatChannelIndicator) {
                        chatChannelIndicator.textContent = '[Map]';
                        chatChannelIndicator.dataset.channel = 'map';
                    }
                    chatInput.value = '';
                    addChatMessage('Switched to Map chat.', 'system');
                    e.preventDefault();
                    return;
                } else if (message === '/s' || message === '/S') {
                    currentChatChannel = 'global';
                    if (chatChannelIndicator) {
                        chatChannelIndicator.textContent = '[Global]';
                        chatChannelIndicator.dataset.channel = 'global';
                    }
                    chatInput.value = '';
                    addChatMessage('Switched to Global chat.', 'system');
                    e.preventDefault();
                    return;
                } else if (message === '/b' || message === '/B') {
                    currentChatChannel = 'buddy';
                    if (chatChannelIndicator) {
                        chatChannelIndicator.textContent = '[Buddy]';
                        chatChannelIndicator.dataset.channel = 'buddy';
                    }
                    chatInput.value = '';
                    addChatMessage('Switched to Buddy chat.', 'system');
                    e.preventDefault();
                    return;
                } else if (message === '/g' || message === '/G') {
                    currentChatChannel = 'guild';
                    if (chatChannelIndicator) {
                        chatChannelIndicator.textContent = '[Guild]';
                        chatChannelIndicator.dataset.channel = 'guild';
                    }
                    chatInput.value = '';
                    addChatMessage('Switched to Guild chat.', 'system');
                    e.preventDefault();
                    return;
                } else if (message === '/p' || message === '/P') {
                    currentChatChannel = 'party';
                    if (chatChannelIndicator) {
                        chatChannelIndicator.textContent = '[Party]';
                        chatChannelIndicator.dataset.channel = 'party';
                    }
                    chatInput.value = '';
                    addChatMessage('Switched to Party chat.', 'system');
                    e.preventDefault();
                    return;
                }
                // Check for GM authentication command - password is verified server-side
                else if (message.startsWith('!gm ')) {
                    const password = message.slice(4).trim();
                    if (password && typeof requestGMAuth === 'function') {
                        requestGMAuth(password);
                    } else {
                        addChatMessage('Usage: !gm <password>', 'error');
                    }
                    chatInput.value = '';
                    e.preventDefault();
                    return;
                } else if (message.startsWith('!')) {
                    // Check for other GM commands (requires server-side GM authorization AND GM Hat)
                    const equippedHelmet = player.equipped?.helmet;
                    const cosmeticHelmet = player.cosmeticEquipped?.helmet;
                    const hasGMHat = (equippedHelmet && equippedHelmet.name === 'GM Hat') || 
                                    (cosmeticHelmet && cosmeticHelmet.name === 'GM Hat') ||
                                    equippedHelmet === 'GM Hat' || 
                                    cosmeticHelmet === 'GM Hat';
                    
                    // Check server-side GM authorization
                    const isServerAuthorized = typeof window.isGMAuthorized !== 'undefined' && window.isGMAuthorized === true;
                    
                    if (hasGMHat && isServerAuthorized) {
                        // Process GM command using the function from this file
                        if (typeof handleGMCommand === 'function') {
                            handleGMCommand(message);
                        } else {
                            addChatMessage('GM command system not available!', 'error');
                        }
                    } else if (!isServerAuthorized) {
                        addChatMessage('GM authorization required. Use !gm <password> to authenticate.', 'error');
                    } else {
                        addChatMessage('You need to equip the GM Hat to use GM commands!', 'error');
                    }
                } else {
                    // Normal chat message - route to appropriate channel
                    player.chatMessage = message;
                    player.chatTimer = 300;
                    
                    // Route message based on current channel
                    switch (currentChatChannel) {
                        case 'map':
                            if (typeof sendMapChat === 'function') {
                                sendMapChat(message);
                                addChatMessage(`${player.name}: ${message}`, 'map');
                            } else {
                                addChatMessage('Map chat is not available.', 'error');
                            }
                            break;
                        case 'buddy':
                            if (typeof sendBuddyChatMessage === 'function') {
                                sendBuddyChatMessage(message);
                            } else {
                                addChatMessage('Buddy chat is not available.', 'error');
                            }
                            break;
                        case 'guild':
                            if (typeof sendGuildChatMessage === 'function') {
                                sendGuildChatMessage(message);
                            } else {
                                addChatMessage('Guild chat is not available.', 'error');
                            }
                            break;
                        case 'party':
                            if (typeof sendPartyChatMessage === 'function') {
                                sendPartyChatMessage(message);
                            } else {
                                addChatMessage('Party chat is not available.', 'error');
                            }
                            break;
                        case 'global':
                        default:
                            if (typeof sendGlobalChatMessage === 'function') {
                                sendGlobalChatMessage(message);
                            } else {
                                addChatMessage(`${player.name}: ${message}`);
                            }
                            break;
                    }
                }
            }
            chatInput.value = '';
            chatInput.blur();
            chatInputContainer.style.display = 'none';
            // Remove chat-active class to lower the chat log
            const chatLogContainer = document.getElementById('chat-log-container');
            if (chatLogContainer) chatLogContainer.classList.remove('chat-active');
            isChatting = false;
        } else {
            const isAnyBlockingWindowOpen = [...document.querySelectorAll('.window')].some(
                win => win.style.display !== 'none' && win.dataset.isPassive !== 'true'
            );
            if (!isAnyBlockingWindowOpen && isGameActive) {
                isChatting = true;
                chatInputContainer.style.display = 'flex';
                chatInput.focus();
                // Add chat-active class to push up the chat log
                const chatLogContainer = document.getElementById('chat-log-container');
                if (chatLogContainer) chatLogContainer.classList.add('chat-active');
                // Update channel indicator when opening chat
                if (chatChannelIndicator) {
                    const channelNames = { map: '[Map]', global: '[Global]', buddy: '[Buddy]', guild: '[Guild]', party: '[Party]' };
                    chatChannelIndicator.textContent = channelNames[currentChatChannel] || '[Map]';
                    chatChannelIndicator.dataset.channel = currentChatChannel;
                }
            }
        }
        e.preventDefault();
        return;
    }

    // If typing in an input, ignore all other game keybinds
    const activeEl = document.activeElement.tagName.toUpperCase();
    if (activeEl === 'INPUT' || activeEl === 'SELECT' || !isGameActive) {
        return;
    }

    // --- NEW LOGIC: Translate Key to Action ---
    for (const action of allGameActions) {
        if (isKeyForAction(key, action)) {
            e.preventDefault(); // Prevent default browser actions for game keys

            // Define which actions are "one-shot" window toggles (shouldn't be held)
            const windowToggleActions = ['inventory', 'equipment', 'skills', 'stats', 'achievements', 'bestiary', 'rankings', 'quest-log', 'quest-helper', 'world-map', 'settings', 'minimap', 'loot', 'interact', 'gm-window', 'hitboxes', 'pet', 'social-hub'];
            const isWindowToggle = windowToggleActions.includes(action);

            // For actions that happen only once on key press (like opening a window)
            // Window toggles should work even if actions[action] is true (for gamepad support)
            if (!actions[action] || isWindowToggle) {
                switch (action) {
                    case 'inventory': toggleWindow(inventoryElement, updateInventoryUI); break;
                    case 'equipment': toggleWindow(equipmentElement, updateEquipmentUI); break;
                    case 'skills': toggleWindow(skillTreeElement, updateSkillTreeUI); break;
                    case 'stats': toggleWindow(statWindowElement, updateStatWindowUI); break;
                    case 'achievements': toggleWindow(achievementWindow, updateAchievementUI); break;
                    case 'bestiary': toggleWindow(bestiaryWindow, updateBestiaryUI); break;
                    case 'rankings': toggleWindow(rankingsWindow, updateRankingsUI); break;
                    case 'social-hub': toggleWindow(socialHubWindow, updateSocialHubUI); break;
                    case 'quest-log': toggleWindow(questLogElement, updateQuestLogUI); break;
                    case 'quest-helper': toggleWindow(questHelperElement, updateQuestHelperUI); break;
                    case 'pet': openPetWindow(); break;
                    case 'world-map':
                        // Determine which region tab to show based on current map
                        let defaultRegion = 'victoria';
                        if (player.currentMapId.startsWith('dewdrop')) {
                            defaultRegion = 'dewdrop';
                        } else if (player.currentMapId.startsWith('skypalace') || player.currentMapId.startsWith('toyFactory') || player.currentMapId.startsWith('clockTower') || player.currentMapId.startsWith('deepskyPalace') || player.currentMapId.startsWith('ominousTower')) {
                            defaultRegion = 'skypalace';
                        }
                        toggleWindow(worldMapWindow, () => {
                            initWorldMapTabs();
                            switchWorldMapRegion(defaultRegion);
                        });
                        break;
                    case 'settings':
                        const settingsIsOpen = settingsMenu.style.display === 'block' || settingsMenu.style.display === 'flex';
                        // Define the update function and bind the correct context to it.
                        const updateFunction = (typeof keyMappingManager !== 'undefined' && typeof keyMappingManager.updateUI === 'function')
                            ? keyMappingManager.updateUI.bind(keyMappingManager)
                            : null;

                        // Check if any other windows are open (excluding settings itself)
                        const otherWindowsOpen = [...document.querySelectorAll('.window')].filter(win => win.id !== 'settings-menu').some(win => win.style.display === 'block' || win.style.display === 'flex');
                        
                        if (!settingsIsOpen) {
                            // Only open settings if NO other windows are currently open
                            if (!otherWindowsOpen) {
                                toggleWindow(settingsMenu, updateFunction);
                                // Update settings tab visibility when opening
                                if (typeof updateSettingsTabVisibility === 'function') {
                                    updateSettingsTabVisibility();
                                }
                            }
                            // If other windows are open, do nothing - let them handle the Escape key
                        } else {
                            // Settings is open, so close it
                            toggleWindow(settingsMenu); // No update needed on close
                        }
                        break;
                    case 'minimap':
                        const isVisible = minimapContainer.style.display === 'block';
                        minimapContainer.style.display = isVisible ? 'none' : 'block';
                        if (!isVisible) updateMiniMap();
                        break;
                    case 'move-up':
                        // This ensures you can't enter portals while jumping.
                        if (!player.isJumping) {
                            checkPortalActivation();
                        }
                        break;
                    case 'loot': lootItems(); break;
                    case 'interact': checkNpcInteraction(); break;
                    case 'gm-window': 
                        // Check if player has GM Hat equipped
                        const equippedHelmet = player.equipped?.helmet;
                        const cosmeticHelmet = player.cosmeticEquipped?.helmet;
                        const hasGMHat = (equippedHelmet && equippedHelmet.name === 'GM Hat') || 
                                         (cosmeticHelmet && cosmeticHelmet.name === 'GM Hat') ||
                                         equippedHelmet === 'GM Hat' || 
                                         cosmeticHelmet === 'GM Hat';
                        
                        if (hasGMHat) {
                            toggleWindow(gmWindowElement, populateGmWindow);
                        } else {
                            addChatMessage('You need to equip the GM Hat to access the GM Panel!', 'error');
                        }
                        break;
                    case 'hitboxes':
                        // Don't toggle hitboxes while chatting
                        if (!isChatting) {
                            showHitboxes = !showHitboxes;
                            // Toggle scale debug display
                            const scaleDebug = document.getElementById('scale-debug');
                            if (scaleDebug) {
                                scaleDebug.style.display = scaleDebug.style.display === 'none' ? 'block' : 'none';
                            }
                        }
                        break;
                    case 'attack':
                        isHoldingAttack = true;
                        lastHeldAttackTime = Date.now();
                        useAbility('Basic Attack');
                        break;
                    // Handle hotbar presses
                    default:
                        if (action.startsWith('hotbar-') && player && player.hotbar) {
                            const slotIndex = parseInt(action.split('-')[1], 10) - 1;
                            const hotbarItem = player.hotbar[slotIndex];
                            if (hotbarItem) {
                                if (hotbarItem.type === 'skill') useAbility(hotbarItem.name);
                                else if (hotbarItem.type === 'item') useItemByName(hotbarItem.name);
                            }
                        }
                        break;
                }
            }

            // For actions that can be held down (like movement)
            actions[action] = true;
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (!e.key) return;
    const key = e.key.toLowerCase();

    // --- NEW LOGIC: Translate Key to Action ---
    for (const action of allGameActions) {
        if (isKeyForAction(key, action)) {
            actions[action] = false;

            // Stop holding attack
            if (action === 'attack') {
                isHoldingAttack = false;
            }
            // Stop channeling skills
            if (action.startsWith('hotbar-') && player && player.hotbar) {
                const slotIndex = parseInt(action.split('-')[1], 10) - 1;
                const hotbarItem = player.hotbar[slotIndex];
                if (player.isChanneling && hotbarItem && hotbarItem.type === 'skill' && player.channelingSkill && player.channelingSkill.name === hotbarItem.name) {
                    stopChanneling();
                }
            }
        }
    }
});

// in game.js (add this to the bottom of the file)

let gmWindowPopulated = false;
function populateGmWindow() {
    if (gmWindowPopulated) return;

    const itemSelect = document.getElementById('gm-item-select');
    const monsterSelect = document.getElementById('gm-monster-select');

    // Populate items
    for (const itemName in itemData) {
        const option = document.createElement('option');
        option.value = itemName;
        option.textContent = itemName;
        itemSelect.appendChild(option);
    }

    // Populate monsters
    for (const monsterType in monsterTypes) {
        const option = document.createElement('option');
        option.value = monsterType;
        option.textContent = monsterTypes[monsterType].name;
        monsterSelect.appendChild(option);
    }

    gmWindowPopulated = true;
}

document.addEventListener('DOMContentLoaded', () => {
    // GM Panel Event Listeners
    document.getElementById('gm-spawn-item-btn').addEventListener('click', () => {
        const selectedItem = document.getElementById('gm-item-select').value;
        if (selectedItem) {
            // Use the original createItemDrop function with level check bypass
            createItemDrop(selectedItem, player.x, player.y, null, true);
            addChatMessage(`Spawned ${selectedItem}`, 'rare');
        }
    });

    document.getElementById('gm-spawn-monster-btn').addEventListener('click', () => {
        const selectedMonster = document.getElementById('gm-monster-select').value;
        if (selectedMonster) {
            const spawnX = player.x + (player.facing === 'right' ? 75 : -75);
            createMonster(selectedMonster, spawnX, player.y);
            addChatMessage(`Spawned ${monsterTypes[selectedMonster].name}`, 'rare');
        }
    });

    document.getElementById('gm-gain-exp-btn').addEventListener('click', () => {
        const expAmount = parseInt(document.getElementById('gm-exp-input').value, 10);
        if (!isNaN(expAmount) && expAmount > 0) {
            gainExp(expAmount);
        }
    });

    document.getElementById('gm-add-gold-btn').addEventListener('click', () => {
        const goldAmount = parseInt(document.getElementById('gm-gold-input').value, 10);
        if (!isNaN(goldAmount) && goldAmount > 0) {
            player.gold += goldAmount;
            player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + goldAmount;
            updateAchievementProgress('action_accumulate', 'gold_earned');
            showNotification(`+${goldAmount.toLocaleString()} Gold`, 'exp');
            updateUI(); // Update HUD
            updateInventoryUI(); // Update gold display in inventory if open
        }
    });

    document.getElementById('gm-infinite-stats-btn').addEventListener('click', () => {
        isGmMode.infiniteStats = !isGmMode.infiniteStats;
        const button = document.getElementById('gm-infinite-stats-btn');
        if (isGmMode.infiniteStats) {
            const finalStats = calculatePlayerStats();
            player.hp = finalStats.finalMaxHp;
            player.mp = finalStats.finalMaxMp;
            button.textContent = 'Disable Infinite HP/MP';
            button.style.backgroundColor = '#4CAF50';
            addChatMessage('Infinite HP/MP enabled', 'rare');
        } else {
            button.textContent = 'Enable Infinite HP/MP';
            button.style.backgroundColor = '';
            addChatMessage('Infinite HP/MP disabled', 'rare');
        }
        updateUI();
    });

    document.getElementById('gm-spawn-elite-monster-btn').addEventListener('click', () => {
        // Get eligible monsters (exclude bosses, test dummies, elite monsters, and dead monsters)
        const eligibleMonsters = monsters.filter(m => 
            !m.isMiniBoss && 
            !m.isEliteMonster && 
            m.type !== 'testDummy' &&
            !m.isDead
        );
        
        if (eligibleMonsters.length === 0) {
            addChatMessage('No eligible monsters to transform into Elite Monster', 'error');
            return;
        }
        
        if (currentEliteMonster) {
            addChatMessage('A Elite Monster already exists!', 'error');
            return;
        }
        
        // Pick a random eligible monster
        const targetMonster = eligibleMonsters[Math.floor(Math.random() * eligibleMonsters.length)];
        transformToEliteMonster(targetMonster);
        addChatMessage('Elite Monster forcefully spawned!', 'legendary');
    });

    document.getElementById('gm-fma-btn').addEventListener('click', () => {
        let monstersKilled = 0;
        const monstersToKill = monsters.filter(m => m && !m.isDead);
        
        if (monstersToKill.length === 0) {
            addChatMessage('FMA: No monsters found on this map', 'system');
            return;
        }
        
        // Attack all monsters simultaneously
        monstersToKill.forEach((m, index) => {
            // Show damage number with slight delay for visual effect
            setTimeout(() => {
                showDamageNumber(9999999, m.x + m.width / 2, m.y, false, { isCritical: true });
            }, index * 50); // 50ms delay between each damage number
            
            // Mark as dead and add death animation
            m.hp = 0;
            m.isDead = true;
            m.hitboxElement.remove();
            m.element.classList.add('monster-death');
            m.velocityY = -5;
            const deathKnockbackDir = player.facing ? (player.facing === 'right' ? 1 : -1) : 1;
            m.velocityX = deathKnockbackDir * 8;

            // Award EXP
            gainExp(m.exp);
            
            // Update quest and achievement progress
            updateQuestProgress(m.type);
            updateAchievementProgress('kill', m.type);
            player.stats.totalKills = (player.stats.totalKills || 0) + 1;
            
            // Track bestiary data
            updateBestiaryKill(m.type);
            
            // Check total kill achievements
            updateAchievementProgress('action_accumulate', 'total_kills');

            const spawner = monsterSpawners.find(s => s.type === m.type);
            if (spawner && monsterTypes[m.type]) {
                if (monsterTypes[m.type].isMiniBoss) {
                    spawner.lastDefeatTime = Date.now();
                }
            }

            m.loot.forEach(loot => {
                // Special handling for quest items
                if (loot.name === 'Rusty Iron Sword') {
                    // Check if quest is active and player needs the item
                    const isQuestActive = player.quests.active.some(q => q.id === 'theLumberjacksAxe');
                    const hasItem = player.inventory.etc.some(item => item.name === 'Rusty Iron Sword');
                    
                    // Only drop if quest is active and player doesn't already have it
                    if (!isQuestActive || hasItem) {
                        return; // Skip this drop
                    }
                }
                
                if (Math.random() < (loot.rate * DROP_RATE_MODIFIER)) {
                    if (loot.name === 'Gold') {
                        const goldAmount = Math.floor(Math.random() * (loot.max - loot.min + 1)) + loot.min;
                        // Track bestiary drops with gold amount
                        updateBestiaryDrop(m.type, loot.name, goldAmount);
                        createItemDrop('Gold', m.x, m.y + m.height / 2, { amount: goldAmount });
                    } else {
                        // Track bestiary drops for non-gold items
                        updateBestiaryDrop(m.type, loot.name);
                        createItemDrop(loot.name, m.x, m.y + m.height / 2);
                    }
                }
            });
            
            // Salami Celebration Event: 20% chance to drop Salami Stick from all monsters
            if (Math.random() < 0.2) {
                updateBestiaryDrop(m.type, 'Salami Stick');
                createItemDrop('Salami Stick', m.x, m.y + m.height / 2);
            }
        });
        
        // Clean up dead monsters from array after a short delay
        setTimeout(() => {
            monsters = monsters.filter(monster => !monster.isDead);
        }, 600);
        
        // Check total kill achievements
        updateAchievementProgress('action_accumulate', 'total_kills');
        
        addChatMessage(`FMA: Eliminated ${monstersKilled} monsters with 9,999,999 damage!`, 'rare');
        showNotification(`FMA: ${monstersKilled} monsters eliminated!`, 'exp');
    });

    // Full Map Loot button event listener
    document.getElementById('gm-fml-btn').addEventListener('click', () => {
        let itemsCollected = 0;
        let goldCollected = 0;
        
        if (droppedItems.length === 0) {
            addChatMessage('FML: No items found on this map', 'system');
            return;
        }
        
        // Collect all items on the map
        for (let i = droppedItems.length - 1; i >= 0; i--) {
            const item = droppedItems[i];
            let itemWasPickedUp = false;
            
            if (item.name === 'Gold') {
                player.gold += item.amount;
                player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + item.amount;
                goldCollected += item.amount;
                itemWasPickedUp = true;
            } else {
                const itemCopy = { ...item };
                delete itemCopy.element;
                if (addItemToInventory(itemCopy)) {
                    itemsCollected++;
                    itemWasPickedUp = true;
                }
            }
            
            if (itemWasPickedUp) {
                // Create collection effect at item location
                const effect = document.createElement('div');
                effect.className = 'loot-effect';
                effect.style.cssText = `
                    position: absolute;
                    left: ${item.x + item.width / 2}px;
                    top: ${item.y + item.height / 2}px;
                    width: 20px;
                    height: 20px;
                    background: radial-gradient(circle, #ffd700, #ffaa00);
                    border-radius: 50%;
                    animation: lootPulse 0.5s ease-out;
                    pointer-events: none;
                    z-index: 1000;
                `;
                
                scalingContainer.appendChild(effect);
                
                // Remove effect after animation
                setTimeout(() => {
                    if (effect.parentNode) {
                        effect.remove();
                    }
                }, 500);
                
                // Remove item element and from array
                if (item.element && item.element.parentNode) {
                    item.element.remove();
                }
                droppedItems.splice(i, 1);
            }
        }
        
        // Update achievement progress
        if (goldCollected > 0) {
            updateAchievementProgress('action_accumulate', 'gold_earned');
        }
        
        // Show results
        let message = 'FML: ';
        if (itemsCollected > 0 && goldCollected > 0) {
            message += `Collected ${itemsCollected} items and ${goldCollected} gold!`;
            showNotification(`+${itemsCollected} items, +${goldCollected} gold`, 'rare');
        } else if (itemsCollected > 0) {
            message += `Collected ${itemsCollected} items!`;
            showNotification(`+${itemsCollected} items`, 'rare');
        } else if (goldCollected > 0) {
            message += `Collected ${goldCollected} gold!`;
            showNotification(`+${goldCollected} gold`, 'exp');
        } else {
            message = 'FML: No items could be collected (inventory full?)';
        }
        
        addChatMessage(message, 'rare');
    });

    // Initialize infinite stats button text
    const infiniteStatsBtn = document.getElementById('gm-infinite-stats-btn');
    if (isGmMode.infiniteStats) {
        infiniteStatsBtn.textContent = 'Disable Infinite HP/MP';
        infiniteStatsBtn.style.backgroundColor = '#4CAF50';
        const finalStats = calculatePlayerStats();
        player.hp = finalStats.finalMaxHp;
        player.mp = finalStats.finalMaxMp;
        updateUI();
    } else {
        infiniteStatsBtn.textContent = 'Enable Infinite HP/MP';
    }
    
});

// --- Autosave on Browser Close ---
// This attempts to save the character when the user closes the tab/browser
// Uses multiple event listeners for maximum reliability across browsers

function performEmergencySave() {
    if (!isGameActive || !player || !player.name) {
        return; // Not in a game session, nothing to save
    }
    
    try {
        // Perform synchronous localStorage save (this is reliable)
        if (typeof saveCharacter === 'function') {
            const saved = saveCharacter();
            if (saved) {
                console.log('[Autosave] Emergency save completed on browser close');
                
                // Also try to update rankings (async, best-effort)
                if (typeof submitRanking === 'function') {
                    submitRanking().catch(() => {
                        // Ignore errors - browser may close before this completes
                    });
                }
            }
        }
    } catch (e) {
        console.warn('[Autosave] Emergency save failed:', e);
    }
}

// Primary: beforeunload - fires when user tries to close tab/window
window.addEventListener('beforeunload', (event) => {
    // If player is in world boss arena, clean up their participation
    if (typeof currentMapId !== 'undefined' && currentMapId === 'worldBossArena') {
        if (typeof worldBossEventActive !== 'undefined' && worldBossEventActive) {
            // Player disconnecting from world boss fight
            console.log('[World Boss] Player disconnecting from arena');
        }
    }
    
    performEmergencySave();
    // Don't return anything or set returnValue - we don't want to prompt the user
});

// Secondary: pagehide - more reliable on mobile browsers
window.addEventListener('pagehide', (event) => {
    performEmergencySave();
});

// Tertiary: visibilitychange - catches some edge cases
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        // Tab is being hidden - could be closing or switching
        // Do a quick save just in case
        performEmergencySave();
    }
});

console.log('[Autosave] Browser close autosave initialized');
