/**
 * Input Display Manager
 * Manages the display of control labels (keyboard vs gamepad) throughout the UI
 */

class InputDisplayManager {
    constructor() {
        this.isGamepadMode = false;
        this.lastInputType = 'keyboard'; // 'keyboard' or 'gamepad'
        this.updateCallbacks = [];
        
        // Map of actions to their keyboard and gamepad equivalents
        // Based on the actual gamepadManager button mappings
        this.controlMap = {
            jump: { keyboard: 'Alt', gamepad: 'A / Cross' },
            attack: { keyboard: 'Ctrl', gamepad: 'B / Circle' },
            loot: { keyboard: 'Z', gamepad: 'X / Square' },
            interact: { keyboard: 'Y', gamepad: 'Y / Triangle' },
            move: { keyboard: 'Arrow Keys', gamepad: 'Left Stick / D-Pad' },
            skills: { keyboard: '1-4', gamepad: 'LB/RB/LT/RT' },
            hpPotion: { keyboard: '5', gamepad: 'D-Pad Up (custom)' },
            mpPotion: { keyboard: '6', gamepad: 'D-Pad Down (custom)' },
            inventory: { keyboard: 'I', gamepad: 'Select / Share' },
            equipment: { keyboard: 'E', gamepad: 'D-Pad Right (custom)' },
            stats: { keyboard: 'S', gamepad: 'RT / R2' },
            achievements: { keyboard: 'A', gamepad: 'Select (custom)' },
            questLog: { keyboard: 'L', gamepad: 'L3 (Left Stick)' },
            bestiary: { keyboard: 'B', gamepad: 'R3 (Right Stick)' },
            worldMap: { keyboard: 'W', gamepad: 'Start (custom)' },
            pet: { keyboard: 'P', gamepad: 'N/A' },
            settings: { keyboard: 'Esc', gamepad: 'Start / Options' },
            chat: { keyboard: 'Enter', gamepad: 'N/A' }
        };
        
        this.init();
    }
    
    init() {
        // Listen for gamepad connection/disconnection
        window.addEventListener('gamepadconnected', () => {
            console.log('[InputDisplay] Gamepad connected - switching to gamepad mode');
            this.switchToGamepadMode();
        });
        
        window.addEventListener('gamepaddisconnected', () => {
            console.log('[InputDisplay] Gamepad disconnected - switching to keyboard mode');
            this.switchToKeyboardMode();
        });
        
        // Check if gamepad is already connected
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                console.log('[InputDisplay] Gamepad already connected on init');
                this.switchToGamepadMode();
                break;
            }
        }
        
        // Also detect keyboard/mouse input to switch back
        let inputTimeout = null;
        
        window.addEventListener('keydown', (e) => {
            // Ignore if this is a simulated key from gamepad
            if (e.isTrusted && this.isGamepadMode) {
                clearTimeout(inputTimeout);
                inputTimeout = setTimeout(() => {
                    console.log('[InputDisplay] Keyboard input detected - switching to keyboard mode');
                    this.switchToKeyboardMode();
                }, 100);
            }
        });
        
        window.addEventListener('mousemove', (e) => {
            // Ignore small movements (might be accidental)
            // Also ignore mouse movements when they come from the virtual mouse (gamepad)
            if (e.movementX !== 0 || e.movementY !== 0) {
                if (this.isGamepadMode && e.isTrusted) {
                    // Only switch on real mouse movement, not virtual mouse
                    clearTimeout(inputTimeout);
                    inputTimeout = setTimeout(() => {
                        this.switchToKeyboardMode();
                    }, 100);
                }
            }
        });
        
        window.addEventListener('click', (e) => {
            // Don't switch modes if the click came from the gamepad (synthetic events are not trusted)
            if (this.isGamepadMode) {
                console.log('[InputDisplay] Click event - isTrusted:', e.isTrusted);
                if (e.isTrusted) {
                    console.log('[InputDisplay] Real mouse click detected - switching to keyboard mode');
                    this.switchToKeyboardMode();
                }
            }
        });
        
        // Poll for gamepad input to switch back to gamepad mode
        this.startGamepadInputPolling();
    }
    
    startGamepadInputPolling() {
        // Keep track of previous button states
        this.previousButtonStates = {};
        
        const pollGamepadInput = () => {
            // Only poll if we're in keyboard mode
            if (!this.isGamepadMode) {
                const gamepads = navigator.getGamepads();
                
                for (let i = 0; i < gamepads.length; i++) {
                    const gamepad = gamepads[i];
                    if (!gamepad) continue;
                    
                    // Check if any button is pressed
                    for (let j = 0; j < gamepad.buttons.length; j++) {
                        const buttonPressed = gamepad.buttons[j].pressed;
                        const wasPressed = this.previousButtonStates[`${i}-${j}`] || false;
                        
                        // Detect new button press (wasn't pressed before, now is)
                        if (buttonPressed && !wasPressed) {
                            console.log('[InputDisplay] Gamepad button press detected - switching to gamepad mode');
                            this.switchToGamepadMode();
                            break;
                        }
                        
                        this.previousButtonStates[`${i}-${j}`] = buttonPressed;
                    }
                    
                    // Check for analog stick movement
                    const leftStickX = Math.abs(gamepad.axes[0] || 0);
                    const leftStickY = Math.abs(gamepad.axes[1] || 0);
                    const rightStickX = Math.abs(gamepad.axes[2] || 0);
                    const rightStickY = Math.abs(gamepad.axes[3] || 0);
                    
                    const deadzone = 0.3;
                    if (leftStickX > deadzone || leftStickY > deadzone || 
                        rightStickX > deadzone || rightStickY > deadzone) {
                        console.log('[InputDisplay] Gamepad stick movement detected - switching to gamepad mode');
                        this.switchToGamepadMode();
                        break;
                    }
                }
            }
            
            requestAnimationFrame(pollGamepadInput);
        };
        
        pollGamepadInput();
    }
    
    switchToGamepadMode() {
        if (this.isGamepadMode) return;
        
        console.log('[InputDisplay] Switching to GAMEPAD mode');
        this.isGamepadMode = true;
        this.lastInputType = 'gamepad';
        
        // Tell gamepad manager to un-force keyboard mode
        if (typeof gamepadManager !== 'undefined' && gamepadManager) {
            gamepadManager.setForceKeyboardMode(false);
        }
        
        // Add gamepad-active class to body
        document.body.classList.add('gamepad-active');
        
        // Show virtual mouse cursor if gamepadManager has enableVirtualMouse method
        if (typeof gamepadManager !== 'undefined' && gamepadManager) {
            // Call gamepadManager to properly enable virtual mouse
            if (typeof gamepadManager.enableVirtualMouse === 'function') {
                gamepadManager.enableVirtualMouse();
            } else {
                // Fallback: directly show cursor
                const cursor = document.getElementById('virtual-mouse-cursor');
                if (cursor) {
                    cursor.style.display = 'block';
                    cursor.style.opacity = '1';
                }
            }
        }
        
        // Update settings tab visibility (show gamepad tab, hide keyboard tab)
        if (typeof updateSettingsTabVisibility === 'function') {
            updateSettingsTabVisibility();
        }
        
        // Update hotbar display to gamepad mode (6 slots with controller icons)
        if (typeof updateSkillHotbarUI === 'function') {
            updateSkillHotbarUI();
        }
        
        this.updateAllLabels();
        this.triggerCallbacks();
    }
    
    switchToKeyboardMode() {
        if (!this.isGamepadMode) return;
        
        console.log('[InputDisplay] Switching to KEYBOARD mode');
        this.isGamepadMode = false;
        this.lastInputType = 'keyboard';
        
        // Tell gamepad manager to force keyboard mode
        if (typeof gamepadManager !== 'undefined' && gamepadManager) {
            gamepadManager.setForceKeyboardMode(true);
        }
        
        // Remove gamepad-active class from body
        document.body.classList.remove('gamepad-active');
        
        // Hide virtual mouse cursor
        const cursor = document.getElementById('virtual-mouse-cursor');
        if (cursor) {
            cursor.style.display = 'none';
        }
        
        // Clear any virtual mouse hover states
        document.querySelectorAll('.virtual-mouse-hover').forEach(el => {
            el.classList.remove('virtual-mouse-hover');
        });
        
        // Update settings tab visibility (show keyboard tab, hide gamepad tab)
        if (typeof updateSettingsTabVisibility === 'function') {
            updateSettingsTabVisibility();
        }
        
        // Update hotbar display to keyboard mode (12 slots with number keys)
        if (typeof updateSkillHotbarUI === 'function') {
            updateSkillHotbarUI();
        }
        
        this.updateAllLabels();
        this.triggerCallbacks();
    }
    
    // Get the display string for an action
    getDisplayString(action) {
        const mapping = this.controlMap[action];
        if (!mapping) return '';
        
        return this.isGamepadMode ? mapping.gamepad : mapping.keyboard;
    }
    
    // Update all control labels in the UI
    updateAllLabels() {
        console.log(`[InputDisplay] Updating labels to ${this.isGamepadMode ? 'GAMEPAD' : 'KEYBOARD'} mode`);
        
        // Update settings menu controls list
        this.updateSettingsControls();
        
        // Update any other UI elements that show controls
        this.updateHotkeyBar();
    }
    
    updateSettingsControls() {
        const controlsList = document.getElementById('controls-list');
        const modeLabel = document.getElementById('controls-mode-label');
        
        if (!controlsList) return;
        
        // Update the header label
        if (modeLabel) {
            modeLabel.textContent = this.isGamepadMode ? 'Gamepad Controls' : 'Keyboard Controls';
        }
        
        // Update each control key label
        const controlKeys = controlsList.querySelectorAll('.control-key[data-action]');
        controlKeys.forEach(keyEl => {
            const action = keyEl.dataset.action;
            const displayText = this.getDisplayString(action);
            
            if (displayText) {
                keyEl.textContent = displayText;
            }
        });
        
        // Highlight the active controls section
        const keyboardSection = controlsList.closest('.controls-section');
        const gamepadSection = document.querySelector('.controls-section:has(#gamepad-mapping-list)');
        
        if (this.isGamepadMode) {
            if (keyboardSection) keyboardSection.style.opacity = '1'; // Keep it visible, just updated
            if (gamepadSection) gamepadSection.style.opacity = '1';
        } else {
            if (keyboardSection) keyboardSection.style.opacity = '1';
            if (gamepadSection) gamepadSection.style.opacity = '0.5';
        }
    }
    
    updateHotkeyBar() {
        // Update tooltip hints on hotkey buttons
        const hotkeyK = document.getElementById('hotkey-k');
        const hotkeyS = document.getElementById('hotkey-s');
        const hotkeyA = document.getElementById('hotkey-a');
        const hotkeyB = document.getElementById('hotkey-b');
        
        if (hotkeyK) {
            hotkeyK.title = this.isGamepadMode 
                ? 'Skills (Left Stick Click)' 
                : 'Open Skills (K)';
        }
        
        if (hotkeyS) {
            hotkeyS.title = this.isGamepadMode 
                ? 'Stats (Right Stick Click)' 
                : 'Open Stats (S)';
        }
        
        if (hotkeyA) {
            hotkeyA.title = this.isGamepadMode 
                ? 'Achievements (Select)' 
                : 'Open Achievements (A)';
        }
        
        if (hotkeyB) {
            hotkeyB.title = this.isGamepadMode 
                ? 'Bestiary (Share)' 
                : 'Open Bestiary (B)';
        }
        
    }
    
    // Register a callback to be called when input mode changes
    onInputModeChange(callback) {
        this.updateCallbacks.push(callback);
    }
    
    triggerCallbacks() {
        this.updateCallbacks.forEach(cb => {
            try {
                cb(this.isGamepadMode, this.lastInputType);
            } catch (error) {
                console.error('[InputDisplay] Error in callback:', error);
            }
        });
    }
    
    // Get gamepad button name from gamepadManager if available
    getGamepadButtonName(buttonIndex) {
        if (typeof gamepadManager !== 'undefined' && gamepadManager) {
            return gamepadManager.getButtonName(buttonIndex);
        }
        return `Button ${buttonIndex}`;
    }
}

// Initialize the input display manager
let inputDisplayManager = null;

document.addEventListener('DOMContentLoaded', () => {
    inputDisplayManager = new InputDisplayManager();
    console.log('[InputDisplay] Input Display Manager initialized');
    
    // Example: Update skill tree hints when input mode changes
    inputDisplayManager.onInputModeChange((isGamepad, inputType) => {
        console.log(`[InputDisplay] Input mode changed to: ${inputType}`);
        
        // Show notification when switching control modes
        if (typeof addChatMessage === 'function') {
            if (isGamepad) {
                addChatMessage('Gamepad controls active', 'success');
            } else {
                addChatMessage('Keyboard controls active', 'info');
            }
        }
    });
});
