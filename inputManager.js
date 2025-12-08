// Enhanced Input System with Debouncing
class InputManager {
    constructor() {
        this.keys = {};
        this.keyStates = {};
        this.lastKeyTime = {};
        this.gamepadStates = {};
        this.inputQueue = [];
        this.isInitialized = false;
        
        this.bindMethods();
    }
    
    bindMethods() {
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleGamepadInput = this.handleGamepadInput.bind(this);
    }
    
    init() {
        if (this.isInitialized) return;
        
        // Keyboard events
        addManagedEventListener(document, 'keydown', this.handleKeyDown);
        addManagedEventListener(document, 'keyup', this.handleKeyUp);
        
        // Prevent context menu on long press
        addManagedEventListener(document, 'contextmenu', (e) => e.preventDefault());
        
        // Focus management
        addManagedEventListener(window, 'blur', () => this.clearAllInputs());
        addManagedEventListener(window, 'focus', () => this.clearAllInputs());
        
        // Gamepad support
        if (navigator.getGamepads) {
            managedSetInterval(this.handleGamepadInput, 16); // ~60fps polling
        }
        
        this.isInitialized = true;
    }
    
    handleKeyDown(event) {
        console.log(`[InputManager] KeyDown received - key: "${event.key}", code: "${event.code}", keyCode: ${event.keyCode}, isTrusted: ${event.isTrusted}`);
        
        // Prevent default for game keys, but allow browser shortcuts
        const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight'];
        if (gameKeys.includes(event.code) || (event.key.length === 1 && !event.ctrlKey && !event.metaKey)) {
            event.preventDefault();
        }
        
        const key = this.normalizeKey(event.key);
        const now = Date.now();
        
        // Skip debouncing for movement keys to ensure smooth movement
        const movementKeys = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'];
        const shouldDebounce = !movementKeys.includes(key);
        
        // Debouncing for rapid key presses (except movement keys)
        if (shouldDebounce && this.lastKeyTime[key] && now - this.lastKeyTime[key] < GAME_CONFIG.KEY_REPEAT_DELAY) {
            return;
        }
        
        if (!this.keys[key]) {
            this.keys[key] = true;
            this.keyStates[key] = { pressed: true, justPressed: true, timePressed: now };
            this.lastKeyTime[key] = now;
            
            // Update global keys object for game compatibility
            this.updateGlobalKeys(key, true);
            
            // Handle special keys immediately
            this.handleSpecialKeys(key, event);
            
            this.queueInput({
                type: 'keydown',
                key: key,
                timestamp: now
            });
        }
    }
    
    handleKeyUp(event) {
        const key = this.normalizeKey(event.key);
        const now = Date.now();
        
        this.keys[key] = false;
        if (this.keyStates[key]) {
            this.keyStates[key].pressed = false;
            this.keyStates[key].justReleased = true;
            this.keyStates[key].timeReleased = now;
        }
        
        // Update global keys object for game compatibility
        this.updateGlobalKeys(key, false);
        
        this.queueInput({
            type: 'keyup',
            key: key,
            timestamp: now
        });
    }
    
    handleGamepadInput() {
        const gamepads = navigator.getGamepads();
        
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (!gamepad) continue;
            
            const prevState = this.gamepadStates[i] || {};
            const currentState = {};
            
            // Buttons
            gamepad.buttons.forEach((button, index) => {
                const key = `gamepad${i}_button${index}`;
                currentState[key] = button.pressed;
                
                if (button.pressed && !prevState[key]) {
                    this.simulateKeyPress(this.getGamepadAction(index), true);
                } else if (!button.pressed && prevState[key]) {
                    this.simulateKeyPress(this.getGamepadAction(index), false);
                }
            });
            
            // Axes (analog sticks) - DISABLED
            // Left stick is now handled by gamepadManager for virtual mouse
            // D-pad is used for character movement
            // Right stick is used for radial menu
            // We no longer convert analog sticks to arrow keys
            
            this.gamepadStates[i] = currentState;
        }
    }
    
    handleAnalogMovement(direction, pressed, wasPressed) {
        const keyMap = {
            left: 'arrowleft',
            right: 'arrowright',
            up: 'arrowup',
            down: 'arrowdown'
        };
        
        const key = keyMap[direction];
        if (pressed && !wasPressed) {
            this.simulateKeyPress(key, true);
        } else if (!pressed && wasPressed) {
            this.simulateKeyPress(key, false);
        }
    }
    
    simulateKeyPress(key, pressed) {
        if (pressed) {
            this.keys[key] = true;
            this.keyStates[key] = { pressed: true, justPressed: true, timePressed: Date.now() };
        } else {
            this.keys[key] = false;
            if (this.keyStates[key]) {
                this.keyStates[key].pressed = false;
                this.keyStates[key].justReleased = true;
                this.keyStates[key].timeReleased = Date.now();
            }
        }
    }
    
    normalizeKey(key) {
        const keyMap = {
            'ArrowUp': 'arrowup',
            'ArrowDown': 'arrowdown',
            'ArrowLeft': 'arrowleft',
            'ArrowRight': 'arrowright',
            'AltLeft': 'alt',
            'AltRight': 'alt',
            'ControlLeft': 'ctrl',
            'ControlRight': 'ctrl',
            'Enter': 'enter',
            'Escape': 'escape',
            ' ': 'space'
        };
        
        return keyMap[key] || key.toLowerCase();
    }
    
    getGamepadAction(buttonIndex) {
        const buttonMap = {
            0: 'ctrl',    // A/X button - attack
            1: 'alt',     // B/Circle button - jump
            2: '1',       // X/Square button - skill 1
            3: '2',       // Y/Triangle button - skill 2
            4: '3',       // LB/L1 - skill 3
            5: '4',       // RB/R1 - skill 4
            8: 'escape',  // Select/Share - menu
            9: 'enter',   // Start/Options - chat
            12: 'arrowup',
            13: 'arrowdown',
            14: 'arrowleft',
            15: 'arrowright'
        };
        
        return buttonMap[buttonIndex];
    }
    
    queueInput(input) {
        this.inputQueue.push(input);
        
        // Keep queue size manageable
        if (this.inputQueue.length > 100) {
            this.inputQueue.shift();
        }
    }
    
    processInputQueue() {
        // Process any queued inputs
        while (this.inputQueue.length > 0) {
            const input = this.inputQueue.shift();
            // Handle input processing here if needed
        }
        
        // Reset just-pressed/released states
        Object.keys(this.keyStates).forEach(key => {
            if (this.keyStates[key]) {
                this.keyStates[key].justPressed = false;
                this.keyStates[key].justReleased = false;
            }
        });
    }
    
    isKeyPressed(key) {
        return !!this.keys[key];
    }
    
    isKeyJustPressed(key) {
        return this.keyStates[key]?.justPressed || false;
    }
    
    isKeyJustReleased(key) {
        return this.keyStates[key]?.justReleased || false;
    }
    
    getKeyHoldTime(key) {
        const state = this.keyStates[key];
        if (state && state.pressed && state.timePressed) {
            return Date.now() - state.timePressed;
        }
        return 0;
    }
    
    updateGlobalKeys(key, isPressed) {
        // Update the global keys object for backward compatibility
        if (typeof keys !== 'undefined') {
            keys[key] = isPressed;
        }
    }
    
    handleSpecialKeys(key, event) {
        // Handle GM window toggle
        if (key === '`' || key === 'backquote') {
            if (typeof toggleWindow === 'function' && typeof gmWindowElement !== 'undefined') {
                toggleWindow(gmWindowElement, populateGmWindow);
            }
        }
        
        // Handle chat
        if (key === 'enter') {
            const chatInputContainer = document.getElementById('chat-input-container');
            const chatInput = document.getElementById('chat-input');
            const chatChannelIndicator = document.getElementById('chat-channel-indicator');
            const chatLogContainer = document.getElementById('chat-log-container');
            if (chatInputContainer && chatInput) {
                if (!isChatting) {
                    chatInputContainer.style.display = 'flex';
                    chatInput.focus();
                    isChatting = true;
                    // Push up the chat log
                    if (chatLogContainer) chatLogContainer.classList.add('chat-active');
                    // Update channel indicator when opening chat
                    if (chatChannelIndicator && typeof currentChatChannel !== 'undefined') {
                        const channelNames = { global: '[Global]', buddy: '[Buddy]', guild: '[Guild]', party: '[Party]' };
                        chatChannelIndicator.textContent = channelNames[currentChatChannel] || '[Global]';
                        chatChannelIndicator.dataset.channel = currentChatChannel;
                    }
                } else {
                    const message = chatInput.value.trim();
                    if (message) {
                        // Check for GM commands if player has GM Hat equipped
                        const equippedHelmet = player.equipped?.helmet;
                        const cosmeticHelmet = player.cosmeticEquipped?.helmet;
                        const hasGMHat = (equippedHelmet && equippedHelmet.name === 'GM Hat') || 
                                        (cosmeticHelmet && cosmeticHelmet.name === 'GM Hat') ||
                                        equippedHelmet === 'GM Hat' || 
                                        cosmeticHelmet === 'GM Hat';
                        
                        console.log('[Chat] Message:', message, 'Has GM Hat:', hasGMHat, 'Equipped:', equippedHelmet, 'Cosmetic:', cosmeticHelmet);
                        
                        if (hasGMHat && message.startsWith('!')) {
                            // Process GM command
                            console.log('[Chat] Processing GM command');
                            if (typeof handleGMCommand === 'function') {
                                handleGMCommand(message);
                            } else if (typeof window.handleGMCommand === 'function') {
                                window.handleGMCommand(message);
                            } else {
                                console.error('[Chat] handleGMCommand not found!');
                            }
                        } else {
                            // Normal chat message - route through channel system
                            player.chatMessage = message;
                            player.chatTimer = 180;
                            
                            // The main game.js handler should handle this, but as fallback:
                            if (typeof currentChatChannel === 'undefined' || currentChatChannel === 'global') {
                                if (typeof sendGlobalChatMessage === 'function') {
                                    sendGlobalChatMessage(message);
                                } else {
                                    addChatMessage(`${player.name}: ${message}`, 'player');
                                }
                            }
                        }
                    }
                    chatInput.value = '';
                    chatInputContainer.style.display = 'none';
                    // Lower the chat log
                    if (chatLogContainer) chatLogContainer.classList.remove('chat-active');
                    isChatting = false;
                }
            }
        }
        
        // Handle skills (1-4)
        if (!isNaN(parseInt(key)) && parseInt(key) >= 1 && parseInt(key) <= 4) {
            if (typeof player !== 'undefined' && player.hotbar) {
                const skillSlot = player.hotbar[parseInt(key) - 1];
                if (skillSlot) {
                    const skill = getSkillDetails(skillSlot.name);
                    if (skill) {
                        if (skill.type === 'channeling') {
                            startChanneling(skill);
                        } else {
                            useAbility(skill.name);
                        }
                    }
                }
            }
        }
        
        // Handle potions
        if (key === '5') {
            if (typeof useItemByName === 'function') {
                useItemByName('Red Potion');
            }
        }
        if (key === '6') {
            if (typeof useItemByName === 'function') {
                useItemByName('Blue Potion');  
            }
        }
    }

    clearAllInputs() {
        this.keys = {};
        Object.keys(this.keyStates).forEach(key => {
            if (this.keyStates[key]) {
                this.keyStates[key].pressed = false;
                this.keyStates[key].justReleased = true;
            }
        });
    }
    
    destroy() {
        this.clearAllInputs();
        this.inputQueue = [];
        this.gamepadStates = {};
        this.isInitialized = false;
    }
}

// Global input manager
const inputManager = new InputManager();

// Temporarily disable InputManager initialization to fix issues
// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', () => {
//         inputManager.init();
//     });
// } else {
//     inputManager.init();
// }