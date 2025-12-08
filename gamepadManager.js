// Gamepad Manager for Steam Deck and other controllers
class GamepadManager {
    constructor() {
        // Core gamepad state
        this.gamepad = null;
        this.deadzone = 0.15;
        this.buttonStates = {};
        this.axisStates = {};
        this.enabled = true;
        this.debugMode = false;
        this.forceKeyboardMode = false; // Flag to force keyboard mode even when gamepad connected
        
        // Cached DOM elements (for performance)
        this.cachedElements = {
            cursor: null,
            startScreen: null,
            charSelection: null,
            charCreation: null,
            gameCanvas: null
        };
        
        // Virtual mouse state
        this.mouseX = window.innerWidth / 2;
        this.mouseY = window.innerHeight / 2;
        this.mouseSensitivity = 10;
        this.mouseButtonDown = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.isDragging = false;
        this.dragTarget = null;
        this.lastHoveredElement = null;
        this.lastStickMoveTime = 0; // Start at 0 so cursor is hidden initially
        this.cursorFadeTimeout = 2000; // Fade after 2 seconds of no movement
        this.lastClickTime = 0;
        this.lastClickElement = null;
        this.doubleClickThreshold = 300; // 300ms for double-click
        
        // Radial menu for right stick
        this.radialMenuActive = false;
        this.radialMenuAngle = 0;
        this.radialMenuItems = [
            { name: 'Inventory', id: 'inventory', icon: '🎒', angle: 0 },
            { name: 'Equipment', id: 'equipment', icon: '⚔️', angle: 40 },
            { name: 'Skills', id: 'skill-tree', icon: '✨', angle: 80 },
            { name: 'Stats', id: 'stat-window', icon: '📊', angle: 120 },
            { name: 'Quests', id: 'quest-log', icon: '📜', angle: 160 },
            { name: 'Social', id: 'social-hub-window', icon: '👥', angle: 200 },
            { name: 'Bestiary', id: 'bestiary-window', icon: '📖', angle: 240 },
            { name: 'Achievements', id: 'achievement-window', icon: '🏆', angle: 280 },
            { name: 'Map', id: 'world-map-window', icon: '🗺️', angle: 320 }
        ];
        this.radialMenuSelection = null;
        
        // Default button mappings (new control scheme)
        this.defaultButtonMap = {
            0: 'smart-action', // A/Cross - Smart button: Click if over interactive element, otherwise attack/interact
            1: 'loot',         // B/Circle - Loot
            2: 'attack',          // X/Square - Attack
            3: 'interact',          // Y/Triangle - Interact
            4: 'hotbar-1',    // LB/L1 - Hotbar Slot 1
            5: 'hotbar-2',    // RB/R1 - Hotbar Slot 2
            6: 'hotbar-3',    // LT/L2 - Hotbar Slot 3
            7: 'hotbar-4',    // RT/R2 - Hotbar Slot 4
            8: 'map',          // Select/Share - Map
            9: 'settings',    // Start/Options - Settings menu (locked)
            10: 'hotbar-5',   // L3 - Hotbar Slot 5 (left stick click)
            11: 'hotbar-6',   // R3 - Hotbar Slot 6 (right stick click)
            12: 'move-up',    // D-pad Up
            13: 'move-down',  // D-pad Down
            14: 'move-left',  // D-pad Left - Movement restored
            15: 'move-right'  // D-pad Right - Movement restored
        };
        
        // Button names for display
        this.buttonNames = {
            0: 'A / Cross',
            1: 'B / Circle',
            2: 'X / Square',
            3: 'Y / Triangle',
            4: 'LB / L1',
            5: 'RB / R1',
            6: 'LT / L2',
            7: 'RT / R2',
            8: 'Select / Share',
            9: 'Start / Options',
            10: 'L3 (Left Stick)',
            11: 'R3 (Right Stick)',
            12: 'D-Pad Up',
            13: 'D-Pad Down',
            14: 'D-Pad Left',
            15: 'D-Pad Right'
        };
        
        // Action names for display
        this.actionNames = {
            'jump': 'Jump',
            'attack': 'Attack',
            'loot': 'Loot',
            'interact': 'Interact',
            'smart-action': 'Smart Action (Click/Hotbar)',
            'hotbar-1': 'Hotbar Slot 1',
            'hotbar-2': 'Hotbar Slot 2',
            'hotbar-3': 'Hotbar Slot 3',
            'hotbar-4': 'Hotbar Slot 4',
            'hotbar-5': 'Hotbar Slot 5',
            'hotbar-6': 'Hotbar Slot 6',
            'hotbar-7': 'Hotbar Slot 7',
            'hotbar-8': 'Hotbar Slot 8',
            'inventory': 'Inventory',
            'equipment': 'Equipment',
            'skills': 'Skills',
            'stats': 'Stats',
            'settings': 'Settings',
            'world-map': 'World Map',
            'quest-log': 'Quest Log',
            'bestiary': 'Bestiary',
            'achievements': 'Achievements',
            'minimap': 'Toggle Minimap',
            'tab-prev': 'Previous Tab',
            'tab-next': 'Next Tab',
            'move-up': 'Move Up',
            'move-down': 'Move Down',
            'move-left': 'Move Left',
            'move-right': 'Move Right'
        };
        
        // Load saved mappings or use defaults
        this.buttonMap = this.loadButtonMap();
        
        this.init();
    }
    
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    
    init() {
        // Create virtual mouse cursor immediately (even before gamepad connects)
        this.createVirtualMouseCursor();
        
        // Listen for gamepad connection
        window.addEventListener('gamepadconnected', (e) => {
            this.gamepad = e.gamepad;
            this.gamepadConnected = true;
            this.showGamepadIndicator(true);
            this.enableVirtualMouse();
            this.updateStartButtonText(true);
            
            // Update settings tab visibility
            if (typeof updateSettingsTabVisibility === 'function') {
                updateSettingsTabVisibility();
            }
            
            // Update hotbar display to gamepad mode (6 slots with controller icons)
            if (typeof updateSkillHotbarUI === 'function') {
                updateSkillHotbarUI();
            }
            
            // Show notification to user
            if (typeof showNotification === 'function') {
                showNotification('Controller connected!', 'success');
            }
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('Gamepad disconnected');
            this.gamepad = null;
            this.gamepadConnected = false; // Clear the connected flag
            this.showGamepadIndicator(false);
            
            // Remove any lingering virtual mouse hover classes
            document.querySelectorAll('.virtual-mouse-hover').forEach(el => {
                el.classList.remove('virtual-mouse-hover');
            });
            
            // Clear last hovered element
            this.lastHoveredElement = null;
            
            // Update start button text
            this.updateStartButtonText(false);
            
            // Update settings tab visibility
            if (typeof updateSettingsTabVisibility === 'function') {
                updateSettingsTabVisibility();
            }
            
            // Update hotbar display to keyboard mode (12 slots with number keys)
            if (typeof updateSkillHotbarUI === 'function') {
                updateSkillHotbarUI();
            }
            
            if (typeof showNotification === 'function') {
                showNotification('Controller disconnected', 'info');
            }
        });
    }
    
    // ============================================================================
    // CORE UPDATE LOOP
    // ============================================================================
    
    update() {
        if (!this.enabled) return;
        
        // Get the latest gamepad state (must poll every frame)
        const gamepads = navigator.getGamepads();
        
        // Find first connected gamepad
        let foundGamepad = false;
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                // If this is a new gamepad, show indicator
                if (!this.gamepad) {
                    console.log('Gamepad detected:', gamepads[i].id);
                    this.showGamepadIndicator(true);
                }
                this.gamepad = gamepads[i];
                foundGamepad = true;
                break;
            }
        }
        
        // If we had a gamepad but lost it
        if (!foundGamepad && this.gamepad) {
            this.gamepad = null;
            this.showGamepadIndicator(false);
            return;
        }
        
        if (!this.gamepad) return;
        
        // If keyboard mode is forced, don't process gamepad input
        if (this.forceKeyboardMode) return;
        
        // Close virtual keyboard if you left the pre-game menus
        if (typeof virtualKeyboard !== 'undefined' && virtualKeyboard.isOpen) {
            if (!this.isInPreGameMenu()) {
                virtualKeyboard.close();
            }
        }
        
        // Menu navigation disabled - using virtual mouse cursor instead
        // this.handleMenuNavigation();
        
        // Debug: Log all button presses
        if (this.debugMode) {
            for (let i = 0; i < this.gamepad.buttons.length; i++) {
                if (this.gamepad.buttons[i].pressed && !this.buttonStates[i]) {
                    console.log(`[Gamepad Debug] Button ${i} PRESSED (${this.getButtonName(i)}) - Action: ${this.buttonMap[i] || 'none'}`);
                }
            }
        }
        
        // Process buttons
        this.gamepad.buttons.forEach((button, index) => {
            const action = this.buttonMap[index];
            
            const pressed = button.pressed || button.value > 0.5;
            const wasPressed = this.buttonStates[index];
            
            if (!action) {
                this.buttonStates[index] = pressed;
                return;
            }
            
            if (pressed && !wasPressed) {
                // Button just pressed
                this.handleButtonPress(action);
            } else if (!pressed && wasPressed) {
                // Button just released
                this.handleButtonRelease(action);
            }
            
            this.buttonStates[index] = pressed;
        });
        
        // Process analog sticks
        this.updateAnalogSticks();
    }
    
    updateAnalogSticks() {
        if (!this.gamepad) return;
        
        const windowOpen = this.isAnyWindowOpen();
        const inPreGameMenu = this.isInPreGameMenu();
        
        // Get analog stick values
        const leftX = this.applyDeadzone(this.gamepad.axes[0]);
        const leftY = this.applyDeadzone(this.gamepad.axes[1]);
        const rightX = this.applyDeadzone(this.gamepad.axes[2]);
        const rightY = this.applyDeadzone(this.gamepad.axes[3]);
        
        // LEFT STICK = Virtual Mouse Cursor (works in ALL screens including menus)
        if (leftX !== 0 || leftY !== 0) {
            this.mouseX += leftX * this.mouseSensitivity;
            this.mouseY += leftY * this.mouseSensitivity;
            
            // Clamp to screen bounds
            this.mouseX = Math.max(0, Math.min(window.innerWidth, this.mouseX));
            this.mouseY = Math.max(0, Math.min(window.innerHeight, this.mouseY));
            
            // Update timestamp for cursor fade
            this.lastStickMoveTime = Date.now();
            
            this.updateVirtualMousePosition();
            this.updateCursorStyle();
        }
        
        // Update cursor visibility based on idle time
        this.updateCursorVisibility();
        
        // D-PAD = Character Movement (only when no windows open)
        if (typeof actions !== 'undefined') {
            if (windowOpen) {
                actions['move-left'] = false;
                actions['move-right'] = false;
                actions['move-up'] = false;
                actions['move-down'] = false;
            } else {
                actions['move-left'] = this.isButtonPressed(14);   // D-pad Left
                actions['move-right'] = this.isButtonPressed(15);  // D-pad Right
                actions['move-up'] = this.isButtonPressed(12);     // D-pad Up
                actions['move-down'] = this.isButtonPressed(13);   // D-pad Down
            }
        }
        
        if (typeof gamepadMovement !== 'undefined') {
            if (windowOpen) {
                gamepadMovement.left = false;
                gamepadMovement.right = false;
                gamepadMovement.up = false;
                gamepadMovement.down = false;
            } else {
                gamepadMovement.left = this.isButtonPressed(14);
                gamepadMovement.right = this.isButtonPressed(15);
                gamepadMovement.up = this.isButtonPressed(12);
                gamepadMovement.down = this.isButtonPressed(13);
            }
        }
        
        // RIGHT STICK = Scroll control (works in ALL screens) or Radial Menu (in-game only)
        const magnitude = Math.sqrt(rightX * rightX + rightY * rightY);
        
        // Check if cursor is over a scrollable element
        const elementAtCursor = document.elementFromPoint(this.mouseX, this.mouseY);
        const scrollableParent = this.findScrollableParent(elementAtCursor);
        
        // Only allow radial menu if player is initialized (in-game only)
        const playerExists = typeof player !== 'undefined' && player && player.name;
        
        if (magnitude > 0.4) {
            if (scrollableParent) {
                // Right stick controls scrolling when over scrollable content (works in all screens)
                const scrollSpeed = 15;
                scrollableParent.scrollTop += rightY * scrollSpeed;
                
                // Close radial menu if it was open (only relevant in-game)
                if (this.radialMenuActive) {
                    this.radialMenuActive = false;
                    this.hideRadialMenu();
                }
            } else if (playerExists && !inPreGameMenu) {
                // Right stick opens radial menu ONLY in-game (not in menus)
                if (!this.radialMenuActive) {
                    this.radialMenuActive = true;
                    this.showRadialMenu();
                }
                
                // Calculate angle (0 = right, 90 = down, 180 = left, 270 = up)
                let angle = Math.atan2(rightY, rightX) * (180 / Math.PI);
                if (angle < 0) angle += 360;
                
                this.radialMenuAngle = angle;
                this.updateRadialMenuSelection(angle);
            }
        } else if (this.radialMenuActive) {
            // Right stick released - execute selection
            this.radialMenuActive = false;
            this.executeRadialMenuSelection();
            this.hideRadialMenu();
        }
        
        // Store for reference
        this.axisStates.leftX = leftX;
        this.axisStates.leftY = leftY;
        this.axisStates.rightX = rightX;
        this.axisStates.rightY = rightY;
    }
    
    applyDeadzone(value) {
        return Math.abs(value) < this.deadzone ? 0 : value;
    }
    
    isAnyWindowOpen() {
        // Check if any menu window is currently open
        const menuWindows = [
            'inventory', 'equipment', 'skill-tree', 'stat-window',
            'quest-log', 'bestiary-window', 'achievement-window',
            'world-map-window', 'settings-menu', 'shop-window',
            'dialogue-window', 'confirmation-modal'
        ];
        
        return menuWindows.some(windowId => {
            const windowEl = document.getElementById(windowId);
            return windowEl && (windowEl.style.display === 'block' || windowEl.style.display === 'flex');
        });
    }
    
    // Cache frequently accessed DOM elements
    getCachedElement(key, selector) {
        if (!this.cachedElements[key] || !document.body.contains(this.cachedElements[key])) {
            this.cachedElements[key] = document.getElementById(selector || key);
        }
        return this.cachedElements[key];
    }
    
    // Check if we're in pre-game menus
    isInPreGameMenu() {
        const startScreen = this.getCachedElement('startScreen', 'start-screen');
        const charSelection = this.getCachedElement('charSelection', 'character-selection-screen');
        const charCreation = this.getCachedElement('charCreation', 'character-creation');
        
        return (startScreen && startScreen.style.display !== 'none') ||
               (charSelection && charSelection.style.display !== 'none') ||
               (charCreation && charCreation.style.display !== 'none');
    }
    
    // ============================================================================
    // BUTTON HANDLING
    // ============================================================================
    
    handleButtonPress(action) {
        console.log('[handleButtonPress] Called with action:', action);
        const windowOpen = this.isAnyWindowOpen();
        const inPreGameMenu = this.isInPreGameMenu();
        console.log('[handleButtonPress] windowOpen:', windowOpen, 'inPreGameMenu:', inPreGameMenu);
        // B button (loot action) closes windows when a window is open
        if (action === 'loot' && windowOpen) {
            console.log('[Gamepad] B button pressed - closing window with Escape');
            this.simulateKeyPress('Escape', 'keydown');
            this.simulateKeyPress('Escape', 'keyup');
            this.vibrate(50);
            return; // Don't process loot action when closing window
        }
        
        // Trigger the appropriate action based on button mapping
        switch(action) {
            case 'smart-action':
                // Smart A button: Click when hovering over interactive element, otherwise jump
                const elementAtCursor = document.elementFromPoint(this.mouseX, this.mouseY);
                console.log('[Smart Action] Cursor at:', this.mouseX, this.mouseY);
                console.log('[Smart Action] Element:', elementAtCursor?.tagName, elementAtCursor?.id, elementAtCursor?.className);
                console.log('[Smart Action] Is interactive?', this.isInteractive(elementAtCursor));
                
                if (this.isInteractive(elementAtCursor)) {
                    // Act as click when over interactive element
                    
                    // Special handling for SELECT dropdowns
                    if (elementAtCursor && elementAtCursor.tagName.toUpperCase() === 'SELECT') {
                        
                        // Focus and trigger mousedown to open dropdown (browsers open select on mousedown, not click)
                        elementAtCursor.focus();
                        
                        const mousedownEvent = new MouseEvent('mousedown', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: this.mouseX,
                            clientY: this.mouseY,
                            button: 0,
                            buttons: 1
                        });
                        elementAtCursor.dispatchEvent(mousedownEvent);
                        
                        // Also dispatch mouseup to complete the click
                        setTimeout(() => {
                            const mouseupEvent = new MouseEvent('mouseup', {
                                bubbles: true,
                                cancelable: true,
                                view: window,
                                clientX: this.mouseX,
                                clientY: this.mouseY,
                                button: 0
                            });
                            elementAtCursor.dispatchEvent(mouseupEvent);
                        }, 10);
                        
                        this.vibrate(30);
                        return;
                    }
                    
                    // Handle virtual keyboard key presses
                    if (typeof virtualKeyboard !== 'undefined' && virtualKeyboard.isOpen) {
                        if (elementAtCursor.classList.contains('virtual-keyboard-key')) {
                            const key = elementAtCursor.dataset.key;
                            virtualKeyboard.pressKey(key);
                            this.vibrate(50);
                            return;
                        } else if (elementAtCursor.id === 'virtual-keyboard-close') {
                            virtualKeyboard.close();
                            this.vibrate(75);
                            return;
                        }
                    }
                    
                    // Focus focusable elements and open virtual keyboard for text inputs
                    if (elementAtCursor.tagName === 'INPUT' || elementAtCursor.tagName === 'TEXTAREA') {
                        console.log('[Smart Action] INPUT/TEXTAREA detected!');
                        console.log('[Smart Action] Element type:', elementAtCursor.type);
                        console.log('[Smart Action] virtualKeyboard exists?', typeof virtualKeyboard !== 'undefined');
                        elementAtCursor.focus();
                        
                        // Open virtual keyboard for gamepad users
                        if (typeof virtualKeyboard !== 'undefined' && 
                            (elementAtCursor.type === 'text' || elementAtCursor.tagName === 'TEXTAREA')) {
                            console.log('[Smart Action] Opening virtual keyboard!');
                            virtualKeyboard.open(elementAtCursor);
                            this.vibrate(100);
                            return; // Don't continue with click events
                        }
                    }
                    
                    // Start mousedown for potential drag/click
                    const mousedownEvent = new MouseEvent('mousedown', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: this.mouseX,
                        clientY: this.mouseY,
                        button: 0,
                        buttons: 1
                    });
                    elementAtCursor.dispatchEvent(mousedownEvent);
                    
                    // Track for potential drag
                    this.mouseButtonDown = true;
                    this.dragStartX = this.mouseX;
                    this.dragStartY = this.mouseY;
                    this.lastStickMoveTime = Date.now();
                    
                    // Determine drag target (prefer draggable parent)
                    if (elementAtCursor.draggable) {
                        this.dragTarget = elementAtCursor;
                    } else if (elementAtCursor.parentElement?.draggable) {
                        this.dragTarget = elementAtCursor.parentElement;
                    } else {
                        this.dragTarget = elementAtCursor;
                    }
                    
                    this.animateCursorClick();
                    this.vibrate(30);
                } else {
                    // When not over interactive element, trigger jump
                    if (!windowOpen && this.isPlayerActive()) {
                        this.simulateKeyPress('Alt', 'keydown');
                    }
                }
                break;
            case 'jump':
                // Jump action - trigger Alt key (only when player is active)
                if (!windowOpen && this.isPlayerActive()) {
                    this.simulateKeyPress('Alt', 'keydown');
                }
                break;
            case 'attack':
                // Attack action - trigger Ctrl key (only when player is active)
                if (!windowOpen && this.isPlayerActive()) {
                    this.simulateKeyPress('Control', 'keydown');
                }
                break;
            case 'loot':
                // Loot action - trigger Z key
                if (!windowOpen) {
                    this.simulateKeyPress('z', 'keydown');
                }
                break;
            case 'interact':
                // Interact action - trigger Y key
                if (!windowOpen) {
                    this.simulateKeyPress('y', 'keydown');
                }
                break;
            case 'move-up':
                // D-pad Up - check for portal activation (only when not jumping)
                if (!windowOpen && typeof player !== 'undefined' && player && !player.isJumping) {
                    if (typeof checkPortalActivation === 'function') {
                        checkPortalActivation();
                    }
                }
                break;
            case 'inventory':
                // Allow window toggles even if other windows are open
                this.simulateKeyPress('i', 'keydown');
                break;
            case 'equipment':
                // Allow window toggles even if other windows are open
                this.simulateKeyPress('e', 'keydown');
                break;
            case 'skills':
                // Allow window toggles even if other windows are open
                this.simulateKeyPress('k', 'keydown');
                break;
            case 'stats':
                // Allow window toggles even if other windows are open
                this.simulateKeyPress('s', 'keydown');
                break;
            case 'quest-log':
                // Allow window toggles even if other windows are open
                this.simulateKeyPress('l', 'keydown');
                break;
            case 'bestiary':
                // Allow window toggles even if other windows are open
                this.simulateKeyPress('b', 'keydown');
                break;
            case 'achievements':
                // Allow window toggles even if other windows are open
                this.simulateKeyPress('a', 'keydown');
                break;
            case 'minimap':
                // Allow window toggles even if other windows are open
                this.simulateKeyPress('m', 'keydown');
                break;
            case 'settings':
                this.simulateKeyPress('Escape', 'keydown');
                break;
            case 'world-map':
                this.simulateKeyPress('w', 'keydown');
                break;
            case 'tab-prev':
                this.switchTab(-1);
                break;
            case 'tab-next':
                this.switchTab(1);
                break;
            case 'hotbar-1':
            case 'hotbar-2':
            case 'hotbar-3':
            case 'hotbar-4':
            case 'hotbar-5':
            case 'hotbar-6':
            case 'hotbar-7':
            case 'hotbar-8':
            case 'hotbar-9':
                // Block hotbar actions when windows are open
                if (windowOpen) {
                    console.log(`[Gamepad Hotbar] Blocked ${action} - window is open`);
                    return;
                }
                const slotNumber = action.split('-')[1];
                console.log(`[Gamepad Hotbar] Pressing ${action} (slot ${slotNumber}) - simulating key "${slotNumber}"`);
                this.simulateKeyPress(slotNumber, 'keydown');
                break;
        }
    }
    
    handleButtonRelease(action) {
        if (action === 'smart-action') {
            // If we were dragging or had mouse button down, release it
            if (this.mouseButtonDown && this.dragTarget) {
                const elementAtCursor = document.elementFromPoint(this.mouseX, this.mouseY);
                const dragDistance = Math.sqrt(
                    Math.pow(this.mouseX - this.dragStartX, 2) + 
                    Math.pow(this.mouseY - this.dragStartY, 2)
                );
                
                if (this.isDragging && this.dragTarget.draggable) {
                    // Handle drag completion
                    this.completeDragOperation(elementAtCursor);
                } else if (dragDistance < 30 && this.dragTarget) {
                    // Handle click (increased threshold from 10 to 30 pixels)
                    this.handleClickOperation();
                }
                
                // Dispatch mouseup
                if (elementAtCursor) {
                    const mouseupEvent = new MouseEvent('mouseup', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: this.mouseX,
                        clientY: this.mouseY,
                        button: 0
                    });
                    elementAtCursor.dispatchEvent(mouseupEvent);
                }
                
                // Restore dragged element opacity
                if (this.dragTarget && this.isDragging) {
                    this.dragTarget.style.opacity = '1';
                }
                
                // Reset drag state
                this.mouseButtonDown = false;
                this.dragTarget = null;
                this.isDragging = false;
            } else {
                // If we weren't clicking/dragging, we were jumping - release jump key
                this.simulateKeyPress('Alt', 'keyup');
            }
        } else if (action === 'jump') {
            this.simulateKeyPress('Alt', 'keyup');
        } else if (action === 'attack') {
            this.simulateKeyPress('Control', 'keyup');
        } else if (action && action.startsWith('hotbar-')) {
            // Release hotbar keys
            const slotNumber = action.split('-')[1];
            console.log(`[Gamepad Hotbar] Releasing ${action} (slot ${slotNumber}) - simulating keyup "${slotNumber}"`);
            this.simulateKeyPress(slotNumber, 'keyup');
        }
    }
    
    // Complete drag and drop operation
    completeDragOperation(elementAtCursor) {
        if (this.debugMode) {
            console.log('[Gamepad] Ending drag, dropping on:', elementAtCursor?.tagName);
        }
        
        if (elementAtCursor) {
            const dropEvent = new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: this.mouseX,
                clientY: this.mouseY,
                dataTransfer: new DataTransfer()
            });
            elementAtCursor.dispatchEvent(dropEvent);
            
            const dragleaveEvent = new DragEvent('dragleave', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: this.mouseX,
                clientY: this.mouseY,
                dataTransfer: new DataTransfer()
            });
            elementAtCursor.dispatchEvent(dragleaveEvent);
        }
        
        const dragendEvent = new DragEvent('dragend', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: this.mouseX,
            clientY: this.mouseY,
            dataTransfer: new DataTransfer()
        });
        this.dragTarget.dispatchEvent(dragendEvent);
    }
    
    // Handle click operation with double-click detection
    handleClickOperation() {
        // Get the element currently under the cursor (in case it's different from dragTarget)
        const elementAtCursor = document.elementFromPoint(this.mouseX, this.mouseY);
        
        // For inventory slots, we might click on the icon inside, so traverse up to find the slot
        let targetElement = elementAtCursor || this.dragTarget;
        
        // If we clicked on a child element of an inventory slot, use the slot instead
        if (targetElement && !targetElement.classList.contains('inventory-slot')) {
            const inventorySlot = targetElement.closest('.inventory-slot');
            if (inventorySlot) {
                targetElement = inventorySlot;
                console.log('[Gamepad] Clicked child of inventory slot, using parent slot');
            }
        }
        
        console.log('[Gamepad] Click operation - element:', targetElement?.className, targetElement?.id);
        console.log('[Gamepad] Element is inventory slot:', targetElement?.classList?.contains('inventory-slot'));
        
        // ONLY dispatch the click event - don't call onclick directly or use .click()
        // This prevents multiple handlers from firing
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: this.mouseX,
            clientY: this.mouseY,
            button: 0,
            buttons: 0
        });
        targetElement.dispatchEvent(clickEvent);
        
        // Check for double-click
        const now = Date.now();
        const timeSinceLastClick = now - this.lastClickTime;
        let isDoubleClick = false;
        
        console.log('[Gamepad] Time since last click:', timeSinceLastClick, 'ms (threshold:', this.doubleClickThreshold, 'ms)');
        
        // For inventory slots, compare by data-index since the elements get recreated on each click
        let isSameElement = this.lastClickElement === targetElement;
        if (targetElement?.classList?.contains('inventory-slot') && this.lastClickElement?.classList?.contains('inventory-slot')) {
            const currentIndex = targetElement.dataset?.index;
            const lastIndex = this.lastClickElement.dataset?.index;
            isSameElement = currentIndex === lastIndex;
            console.log('[Gamepad] Comparing inventory slots by index - current:', currentIndex, 'last:', lastIndex, 'same:', isSameElement);
        } else {
            console.log('[Gamepad] Same element as last click:', isSameElement);
        }
        
        if (timeSinceLastClick < this.doubleClickThreshold && isSameElement) {
            // Double-click detected
            isDoubleClick = true;
            console.log('[Gamepad] Double-click detected on:', targetElement?.className, targetElement?.id);
            
            const dblclickEvent = new MouseEvent('dblclick', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: this.mouseX,
                clientY: this.mouseY,
                button: 0,
                buttons: 0
            });
            targetElement.dispatchEvent(dblclickEvent);
            
            console.log('[Gamepad] dblclick event dispatched');
            
            // Reset to prevent triple-click
            this.lastClickTime = 0;
            this.lastClickElement = null;
        } else {
            // Record this click for double-click detection
            this.lastClickTime = now;
            this.lastClickElement = targetElement;
        }
    }
    
    // Check if player is active and can perform actions
    isPlayerActive() {
        return typeof player !== 'undefined' && 
               player && 
               !player.isDead && 
               (typeof isChatting === 'undefined' || !isChatting);
    }
    
    simulateKeyPress(key, eventType) {
        if (this.debugMode) {
            console.log(`[Gamepad] Simulating key: ${key} (${eventType})`);
        }
        
        // Map keys to proper KeyboardEvent.code values
        let code = key;
        let keyCode = key.charCodeAt(0);
        
        // Handle number keys (0-9)
        if (key >= '0' && key <= '9') {
            code = 'Digit' + key;
            keyCode = 48 + parseInt(key); // 48 is keyCode for '0'
        }
        // Handle letter keys (a-z, A-Z)
        else if (key.length === 1 && key.match(/[a-z]/i)) {
            code = 'Key' + key.toUpperCase();
            keyCode = key.toUpperCase().charCodeAt(0);
        }
        // Handle special keys
        else if (key === 'Alt' || key === 'alt') {
            code = 'AltLeft';
            keyCode = 18;
        }
        else if (key === 'Control' || key === 'ctrl') {
            code = 'ControlLeft';
            keyCode = 17;
        }
        else if (key === 'Enter') {
            code = 'Enter';
            keyCode = 13;
        }
        else if (key === 'Escape') {
            code = 'Escape';
            keyCode = 27;
        }
        else if (key === '-') {
            code = 'Minus';
            keyCode = 189;
        }
        else if (key === '=') {
            code = 'Equal';
            keyCode = 187;
        }
        
        console.log(`[Gamepad simulateKeyPress] Creating ${eventType} event - key: "${key}", code: "${code}", keyCode: ${keyCode}`);
        
        // Instead of creating synthetic KeyboardEvent, directly trigger the game's action system
        // This bypasses the event system and directly activates hotbar slots
        if (eventType === 'keydown') {
            // Directly activate hotbar slot
            if (key >= '1' && key <= '9') {
                const slotIndex = parseInt(key) - 1;
                if (typeof player !== 'undefined' && player.hotbar && player.hotbar[slotIndex]) {
                    const hotbarItem = player.hotbar[slotIndex];
                    console.log(`[Gamepad simulateKeyPress] Directly triggering hotbar slot ${slotIndex + 1}:`, hotbarItem);
                    
                    if (hotbarItem.type === 'skill' && typeof useAbility === 'function') {
                        useAbility(hotbarItem.name);
                    } else if (hotbarItem.type === 'item' && typeof useItemByName === 'function') {
                        useItemByName(hotbarItem.name);
                    }
                    return; // Skip event dispatch for hotbar keys
                }
            } else if (key === '0') {
                const slotIndex = 9; // Slot 10 (0 key)
                if (typeof player !== 'undefined' && player.hotbar && player.hotbar[slotIndex]) {
                    const hotbarItem = player.hotbar[slotIndex];
                    console.log(`[Gamepad simulateKeyPress] Directly triggering hotbar slot 10:`, hotbarItem);
                    
                    if (hotbarItem.type === 'skill' && typeof useAbility === 'function') {
                        useAbility(hotbarItem.name);
                    } else if (hotbarItem.type === 'item' && typeof useItemByName === 'function') {
                        useItemByName(hotbarItem.name);
                    }
                    return; // Skip event dispatch
                }
            }
        }
        
        // For other keys, still create and dispatch the event
        const event = new KeyboardEvent(eventType, {
            key: key,
            code: code,
            keyCode: keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window
        });
        
        // Dispatch to document and focused element
        document.dispatchEvent(event);
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.dispatchEvent(event);
        }
    }
    
    isButtonPressed(buttonIndex) {
        if (!this.gamepad) return false;
        return this.gamepad.buttons[buttonIndex]?.pressed || false;
    }
    
    getAxisValue(axisIndex) {
        if (!this.gamepad) return 0;
        return this.applyDeadzone(this.gamepad.axes[axisIndex] || 0);
    }
    
    // Simplified vibrate with standard intensity
    vibrate(duration = 50, intensity = 0.5) {
        if (!this.gamepad || !this.gamepad.vibrationActuator) return;
        
        this.gamepad.vibrationActuator.playEffect('dual-rumble', {
            duration: duration,
            weakMagnitude: intensity,
            strongMagnitude: intensity
        }).catch(() => {}); // Silently fail if vibration not supported
    }
    
    // ============================================================================
    // RADIAL MENU SYSTEM (Right Stick)
    // ============================================================================
    
    showRadialMenu() {
        let radialMenu = document.getElementById('gamepad-radial-menu');
        
        if (!radialMenu) {
            // Create the radial menu UI
            radialMenu = document.createElement('div');
            radialMenu.id = 'gamepad-radial-menu';
            radialMenu.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 400px;
                height: 400px;
                z-index: 100000;
                pointer-events: none;
            `;
            
            // Center circle
            const center = document.createElement('div');
            center.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80px;
                height: 80px;
                background: rgba(0, 0, 0, 0.8);
                border: 3px solid var(--legendary-color);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: var(--font-small);;
                color: white;
            `;
            center.textContent = 'Windows';
            radialMenu.appendChild(center);
            
            // Create menu items in a circle
            this.radialMenuItems.forEach((item, index) => {
                const angle = item.angle * (Math.PI / 180);
                const radius = 150;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                
                const menuItem = document.createElement('div');
                menuItem.id = `radial-item-${item.id}`;
                menuItem.className = 'radial-menu-item';
                menuItem.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(calc(-50% + ${x}px), calc(-50% + ${y}px));
                    width: 60px;
                    height: 60px;
                    background: rgba(0, 0, 0, 0.7);
                    border: 2px solid #555;
                    border-radius: 50%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    color: white;
                    transition: all 0.2s;
                `;
                
                const icon = document.createElement('div');
                icon.textContent = item.icon;
                menuItem.appendChild(icon);
                
                const label = document.createElement('div');
                label.style.cssText = 'font-size: 10px; margin-top: 2px;';
                label.textContent = item.name;
                menuItem.appendChild(label);
                
                radialMenu.appendChild(menuItem);
            });
            
            document.body.appendChild(radialMenu);
        }
        
        radialMenu.style.display = 'block';
    }
    
    hideRadialMenu() {
        const radialMenu = document.getElementById('gamepad-radial-menu');
        if (radialMenu) {
            radialMenu.style.display = 'none';
        }
        
        // Clear selection highlighting
        this.radialMenuItems.forEach(item => {
            const element = document.getElementById(`radial-item-${item.id}`);
            if (element) {
                element.style.background = 'rgba(0, 0, 0, 0.7)';
                element.style.border = '2px solid #555';
                element.style.transform = element.style.transform.replace('scale(1.3)', '');
            }
        });
    }
    
    updateRadialMenuSelection(angle) {
        // Find closest menu item to the current angle
        let closestItem = null;
        let minDiff = Infinity;
        
        this.radialMenuItems.forEach(item => {
            let diff = Math.abs(angle - item.angle);
            if (diff > 180) diff = 360 - diff; // Handle wrap-around
            
            if (diff < minDiff) {
                minDiff = diff;
                closestItem = item;
            }
        });
        
        // Update selection if changed
        if (closestItem && closestItem !== this.radialMenuSelection) {
            // Remove highlight from previous selection
            if (this.radialMenuSelection) {
                const prevElement = document.getElementById(`radial-item-${this.radialMenuSelection.id}`);
                if (prevElement) {
                    prevElement.style.background = 'rgba(0, 0, 0, 0.7)';
                    prevElement.style.border = '2px solid #555';
                    prevElement.style.transform = prevElement.style.transform.replace(' scale(1.3)', '');
                }
            }
            
            // Highlight new selection
            this.radialMenuSelection = closestItem;
            const element = document.getElementById(`radial-item-${closestItem.id}`);
            if (element) {
                element.style.background = 'rgba(255, 215, 0, 0.3)';
                element.style.border = '2px solid var(--legendary-color)';
                element.style.transform += ' scale(1.3)';
            }
            
            this.vibrate(20, 0.3, 0.3);
        }
    }
    
    executeRadialMenuSelection() {
        if (!this.radialMenuSelection) return;
        
        const windowId = this.radialMenuSelection.id;
        
        // Use the existing toggleWindow function with the appropriate update function
        if (typeof toggleWindow === 'function') {
            const windowElement = document.getElementById(windowId);
            
            if (windowElement) {
                // Special case for world map - needs tab initialization
                if (windowId === 'world-map-window') {
                    if (typeof initWorldMapTabs !== 'undefined' && typeof switchWorldMapRegion !== 'undefined' && typeof player !== 'undefined') {
                        // Determine which region tab to show based on current map
                        let defaultRegion = 'victoria';
                        if (player.currentMapId.startsWith('dewdrop')) {
                            defaultRegion = 'dewdrop';
                        } else if (player.currentMapId.startsWith('skypalace') || player.currentMapId.startsWith('toyFactory') || player.currentMapId.startsWith('clockTower') || player.currentMapId.startsWith('deepskyPalace') || player.currentMapId.startsWith('ominousTower')) {
                            defaultRegion = 'skypalace';
                        }
                        toggleWindow(windowElement, () => {
                            initWorldMapTabs();
                            switchWorldMapRegion(defaultRegion);
                        });
                    }
                } else {
                    // Map window IDs to their update functions
                    const windowUpdateFunctions = {
                        'inventory': typeof updateInventoryUI !== 'undefined' ? updateInventoryUI : null,
                        'equipment': typeof updateEquipmentUI !== 'undefined' ? updateEquipmentUI : null,
                        'skill-tree': typeof updateSkillTreeUI !== 'undefined' ? updateSkillTreeUI : null,
                        'stat-window': typeof updateStatWindowUI !== 'undefined' ? updateStatWindowUI : null,
                        'quest-log': typeof updateQuestLogUI !== 'undefined' ? updateQuestLogUI : null,
                        'bestiary-window': typeof updateBestiaryUI !== 'undefined' ? updateBestiaryUI : null,
                        'achievement-window': typeof updateAchievementUI !== 'undefined' ? updateAchievementUI : null,
                        'social-hub-window': typeof updateSocialHubUI !== 'undefined' ? updateSocialHubUI : null
                    };
                    
                    const updateFunction = windowUpdateFunctions[windowId];
                    toggleWindow(windowElement, updateFunction);
                }
                
                this.vibrate(50, 0.5, 0.5);
            }
        }
        
        this.radialMenuSelection = null;
    }
    
    // ============================================================================
    // VIRTUAL MOUSE SYSTEM (Left Stick)
    // ============================================================================
    
    createVirtualMouseCursor() {
        // Remove any existing cursor to ensure fresh creation
        const existingCursor = document.getElementById('virtual-mouse-cursor');
        if (existingCursor) {
            existingCursor.remove();
        }
        
        // Create cursor element
        const cursor = document.createElement('div');
        cursor.id = 'virtual-mouse-cursor';
        cursor.style.position = 'fixed';
        cursor.style.width = '20px';
        cursor.style.height = '20px';
        cursor.style.background = 'rgba(255, 215, 0, 0.8)';
        cursor.style.border = '2px solid white';
        cursor.style.borderRadius = '50%';
        cursor.style.pointerEvents = 'none';
        cursor.style.zIndex = '99999';
        cursor.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.6)';
        cursor.style.display = 'block';
        cursor.style.opacity = '0';
        cursor.style.transition = 'opacity 0.3s ease-out';
        cursor.style.left = this.mouseX + 'px';
        cursor.style.top = this.mouseY + 'px';
        document.body.appendChild(cursor);
        this.cachedElements.cursor = cursor;
        
        if (this.debugMode) {
            console.log('[Gamepad] Virtual mouse cursor created (hidden by default)');
        }
    }
    
    updateCursorStyle() {
        const cursor = this.getCachedElement('cursor', 'virtual-mouse-cursor');
        if (!cursor) return;
        
        const elementAtCursor = document.elementFromPoint(this.mouseX, this.mouseY);
        const isOverInteractive = this.isInteractive(elementAtCursor);
        
        // Track last hovered element for hover events
        if (this.lastHoveredElement !== elementAtCursor) {
            // Mouse left previous element
            if (this.lastHoveredElement) {
                const mouseoutEvent = new MouseEvent('mouseout', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: this.mouseX,
                    clientY: this.mouseY,
                    relatedTarget: elementAtCursor
                });
                this.lastHoveredElement.dispatchEvent(mouseoutEvent);
                
                const mouseleaveEvent = new MouseEvent('mouseleave', {
                    bubbles: false,
                    cancelable: false,
                    view: window,
                    clientX: this.mouseX,
                    clientY: this.mouseY,
                    relatedTarget: elementAtCursor
                });
                this.lastHoveredElement.dispatchEvent(mouseleaveEvent);
                
                // Remove virtual hover class from previous element
                this.lastHoveredElement.classList.remove('virtual-mouse-hover');
            }
            
            // Mouse entered new element
            if (elementAtCursor) {
                const mouseoverEvent = new MouseEvent('mouseover', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: this.mouseX,
                    clientY: this.mouseY,
                    relatedTarget: this.lastHoveredElement
                });
                elementAtCursor.dispatchEvent(mouseoverEvent);
                
                const mouseenterEvent = new MouseEvent('mouseenter', {
                    bubbles: false,
                    cancelable: false,
                    view: window,
                    clientX: this.mouseX,
                    clientY: this.mouseY,
                    relatedTarget: this.lastHoveredElement
                });
                elementAtCursor.dispatchEvent(mouseenterEvent);
                
                // Add virtual hover class ONLY to interactive elements to trigger CSS hover effects
                if (this.isInteractive(elementAtCursor)) {
                    elementAtCursor.classList.add('virtual-mouse-hover');
                }
            }
            
            this.lastHoveredElement = elementAtCursor;
        }
        
        if (isOverInteractive) {
            // Make cursor larger and brighter when over interactive element
            cursor.style.width = '24px';
            cursor.style.height = '24px';
            cursor.style.background = 'rgba(0, 255, 100, 0.9)';
            cursor.style.border = '3px solid white';
            cursor.style.boxShadow = '0 0 15px rgba(0, 255, 100, 0.8)';
        } else {
            // Normal cursor style
            cursor.style.width = '20px';
            cursor.style.height = '20px';
            cursor.style.background = 'rgba(255, 215, 0, 0.8)';
            cursor.style.border = '2px solid white';
            cursor.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.6)';
        }
    }
    
    updateVirtualMousePosition() {
        const cursor = this.getCachedElement('cursor', 'virtual-mouse-cursor');
        if (!cursor) {
            this.createVirtualMouseCursor();
            return;
        }
        
        // Update cursor position
        cursor.style.left = this.mouseX + 'px';
        cursor.style.top = this.mouseY + 'px';
        
        // Always dispatch mousemove events for hover effects (even when not dragging)
        const elementAtCursor = document.elementFromPoint(this.mouseX, this.mouseY);
        if (elementAtCursor && !this.mouseButtonDown) {
            const mousemoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: this.mouseX,
                clientY: this.mouseY,
                screenX: this.mouseX,
                screenY: this.mouseY,
                button: 0,
                buttons: 0
            });
            elementAtCursor.dispatchEvent(mousemoveEvent);
        }
        
        // Auto-scroll when hovering near bottom of scrollable containers
        this.handleAutoScroll(elementAtCursor);
        
        // Handle dragging if mouse button is down
        if (this.mouseButtonDown && this.dragTarget) {
            const dragDistance = Math.sqrt(
                Math.pow(this.mouseX - this.dragStartX, 2) + 
                Math.pow(this.mouseY - this.dragStartY, 2)
            );
            
            // If moved more than 5 pixels, start dragging
            if (dragDistance > 5 && !this.isDragging) {
                this.isDragging = true;
                
                // Make dragged element semi-transparent (like native drag behavior)
                if (this.dragTarget) {
                    this.dragTarget.style.opacity = '0.5';
                    this.dragTarget.style.transition = 'opacity 0.1s ease';
                }
                
                // Check if element is draggable (HTML5 drag-and-drop)
                if (this.dragTarget.draggable) {
                    // Dispatch dragstart event for HTML5 drag-and-drop
                    const dragstartEvent = new DragEvent('dragstart', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: this.dragStartX,
                        clientY: this.dragStartY,
                        dataTransfer: new DataTransfer()
                    });
                    this.dragTarget.dispatchEvent(dragstartEvent);
                }
            }
            
            // Dispatch mousemove events while dragging
            if (this.isDragging) {
                const mousemoveEvent = new MouseEvent('mousemove', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: this.mouseX,
                    clientY: this.mouseY,
                    screenX: this.mouseX,
                    screenY: this.mouseY,
                    button: 0,
                    buttons: 1  // Left button is down
                });
                
                const elementAtCursor = document.elementFromPoint(this.mouseX, this.mouseY);
                if (elementAtCursor) {
                    elementAtCursor.dispatchEvent(mousemoveEvent);
                    
                    // If dragging a draggable element, dispatch dragover on target
                    if (this.dragTarget && this.dragTarget.draggable) {
                        const dragoverEvent = new DragEvent('dragover', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: this.mouseX,
                            clientY: this.mouseY,
                            dataTransfer: new DataTransfer()
                        });
                        elementAtCursor.dispatchEvent(dragoverEvent);
                    }
                }
                
                // Special handling for range sliders
                if (this.dragTarget && this.dragTarget.tagName === 'INPUT' && this.dragTarget.type === 'range') {
                    const slider = this.dragTarget;
                    const rect = slider.getBoundingClientRect();
                    const percent = (this.mouseX - rect.left) / rect.width;
                    const min = parseFloat(slider.min) || 0;
                    const max = parseFloat(slider.max) || 1;
                    const step = parseFloat(slider.step) || 0.01;
                    
                    // Calculate new value
                    let newValue = min + (percent * (max - min));
                    newValue = Math.max(min, Math.min(max, newValue));
                    
                    // Round to step
                    if (step) {
                        newValue = Math.round(newValue / step) * step;
                    }
                    
                    // Update slider value and trigger input event
                    if (slider.value !== newValue.toString()) {
                        slider.value = newValue;
                        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                        slider.dispatchEvent(inputEvent);
                    }
                }
                
                // Also dispatch on drag target
                if (this.dragTarget) {
                    this.dragTarget.dispatchEvent(mousemoveEvent);
                    
                    // Dispatch drag event on the dragged element
                    if (this.dragTarget.draggable) {
                        const dragEvent = new DragEvent('drag', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: this.mouseX,
                            clientY: this.mouseY,
                            dataTransfer: new DataTransfer()
                        });
                        this.dragTarget.dispatchEvent(dragEvent);
                    }
                }
            }
        }
    }
    
    updateCursorVisibility() {
        const cursor = this.getCachedElement('cursor', 'virtual-mouse-cursor');
        if (!cursor) return;
        
        // Don't show cursor if gamepad not connected or keyboard mode forced
        if (!this.gamepadConnected || this.forceKeyboardMode) {
            cursor.style.opacity = '0';
            return;
        }
        
        // Fade cursor after timeout (only show when left stick has been moved recently)
        const timeSinceLastMove = Date.now() - this.lastStickMoveTime;
        const shouldFade = timeSinceLastMove > this.cursorFadeTimeout;
        
        // Only update if state changed (avoid redundant style updates)
        const currentOpacity = cursor.style.opacity;
        const targetOpacity = shouldFade ? '0' : '1';
        
        if (currentOpacity !== targetOpacity) {
            cursor.style.opacity = targetOpacity;
        }
    }
    
    animateCursorClick() {
        const cursor = this.getCachedElement('cursor', 'virtual-mouse-cursor');
        if (!cursor) return;
        
        // Scale down quickly then back to normal
        cursor.style.transform = 'scale(0.8)';
        cursor.style.transition = 'transform 0.1s ease-out';
        
        setTimeout(() => {
            cursor.style.transform = 'scale(1)';
        }, 100);
    }
    
    findScrollableParent(element) {
        if (!element) return null;
        
        let scrollableParent = element;
        while (scrollableParent && scrollableParent !== document.body) {
            const overflowY = window.getComputedStyle(scrollableParent).overflowY;
            if ((overflowY === 'auto' || overflowY === 'scroll') && scrollableParent.scrollHeight > scrollableParent.clientHeight) {
                return scrollableParent;
            }
            scrollableParent = scrollableParent.parentElement;
        }
        
        return null;
    }
    
    handleAutoScroll(elementAtCursor) {
        if (!elementAtCursor) return;
        
        // Find the scrollable parent container
        const scrollableParent = this.findScrollableParent(elementAtCursor);
        
        if (!scrollableParent) return;
        
        // Get the bounds of the scrollable container
        const rect = scrollableParent.getBoundingClientRect();
        const scrollThreshold = 80; // Distance from bottom to start scrolling
        const scrollSpeed = 3; // Pixels to scroll per frame
        
        // Check if cursor is near the bottom of the scrollable container
        const distanceFromBottom = rect.bottom - this.mouseY;
        const distanceFromTop = this.mouseY - rect.top;
        
        if (distanceFromBottom < scrollThreshold && distanceFromBottom > 0) {
            // Near bottom - scroll down
            const intensity = 1 - (distanceFromBottom / scrollThreshold);
            scrollableParent.scrollTop += scrollSpeed * intensity;
        } else if (distanceFromTop < scrollThreshold && distanceFromTop > 0) {
            // Near top - scroll up
            const intensity = 1 - (distanceFromTop / scrollThreshold);
            scrollableParent.scrollTop -= scrollSpeed * intensity;
        }
    }
    
    updateStartButtonText(gamepadConnected) {
        const startBtn = document.getElementById('start-game-audio-btn');
        if (startBtn) {
            startBtn.textContent = gamepadConnected ? 'Click to Start' : 'Click to Start';
        }
    }
    
    enableVirtualMouse() {
        if (this.forceKeyboardMode) return;
        
        const cursor = this.getCachedElement('cursor', 'virtual-mouse-cursor');
        if (cursor && this.gamepadConnected) {
            cursor.style.display = 'block';
            cursor.style.visibility = 'visible';
            cursor.style.pointerEvents = 'none';
            // Don't set opacity here - let updateCursorVisibility handle it
        }
    }
    
    showGamepadIndicator(show) {
        const indicator = document.getElementById('gamepad-status-indicator');
        const helpText = document.getElementById('gamepad-help-text');
        
        // Override show to false if keyboard mode is forced
        const actualShow = show && !this.forceKeyboardMode;
        
        if (indicator) {
            indicator.style.display = actualShow ? 'block' : 'none';
        }
        if (helpText) {
            helpText.style.display = actualShow ? 'block' : 'none';
        }
        
        // Toggle gamepad-active class on body to control CSS
        if (actualShow) {
            document.body.classList.add('gamepad-active');
        } else {
            document.body.classList.remove('gamepad-active');
            this.clearAllSelections();
        }
        
        // Update settings UI if it's open
        if (show && typeof updateGamepadSettingsUI === 'function') {
            updateGamepadSettingsUI();
        }
    }
    
    clearAllSelections() {
        document.querySelectorAll('.gamepad-selected').forEach(el => {
            el.classList.remove('gamepad-selected');
        });
        document.querySelectorAll('.virtual-mouse-hover').forEach(el => {
            el.classList.remove('virtual-mouse-hover');
        });
    }
    
    isInteractive(element) {
        if (!element) return false;
        
        // Check if element is clickable/interactive
        const tagName = element.tagName.toLowerCase();
        const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
        
        if (interactiveTags.includes(tagName)) return true;
        if (element.onclick) return true;
        if (element.draggable) return true; // HTML5 draggable elements
        if (element.classList.contains('inventory-slot')) return true;
        if (element.classList.contains('equipment-slot')) return true;
        if (element.classList.contains('skill-item')) return true;
        if (element.classList.contains('skill-node')) return true;
        if (element.classList.contains('skill-slot')) return true;
        if (element.classList.contains('hotbar-slot')) return true;
        if (element.classList.contains('hotbar-menu-slot')) return true;
        if (element.classList.contains('hotkey')) return true;
        if (element.classList.contains('quest-item')) return true;
        if (element.classList.contains('monster-entry')) return true;
        if (element.classList.contains('achievement-item')) return true;
        if (element.classList.contains('shop-item')) return true;
        if (element.classList.contains('character-slot')) return true;
        if (element.classList.contains('dialogue-option')) return true;
        if (element.classList.contains('window-header')) return true;
        if (element.classList.contains('window-title')) return true;
        if (element.classList.contains('tab-button')) return true;
        if (element.classList.contains('close-btn')) return true;
        if (element.classList.contains('draggable')) return true;
        if (element.classList.contains('npc')) return true;
        if (element.classList.contains('gamepad-action-select')) return true;
        if (element.classList.contains('gamepad-button-row')) return true;
        if (element.classList.contains('virtual-keyboard-key')) return true;
        if (element.id === 'virtual-keyboard-close') return true;
        if (tagName === 'option') return true;
        
        // Check if parent or grandparent is interactive (for nested elements)
        let currentElement = element.parentElement;
        let depth = 0;
        while (currentElement && depth < 3) { // Check up to 3 levels up
            if (currentElement.draggable) return true;
            if (currentElement.classList.contains('inventory-slot')) return true;
            if (currentElement.classList.contains('equipment-slot')) return true;
            if (currentElement.classList.contains('skill-item')) return true;
            if (currentElement.classList.contains('skill-node')) return true;
            if (currentElement.classList.contains('hotbar-slot')) return true;
            if (currentElement.classList.contains('hotkey')) return true;
            if (currentElement.classList.contains('npc')) return true; // Check for NPC parent
            if (currentElement.tagName.toLowerCase() === 'button') return true;
            currentElement = currentElement.parentElement;
            depth++;
        }
        
        return false;
    }
    
    simulateMouseEvent(eventType, x, y) {
        const element = document.elementFromPoint(x, y);
        if (!element) return;
        
        // For hotkey buttons, use direct click() to bypass event handling issues
        if (eventType === 'click' && element.classList.contains('hotkey')) {
            console.log('[Gamepad Debug] Hotkey button detected:', element.id);
            console.log('[Gamepad Debug] Element:', element);
            console.log('[Gamepad Debug] Calling click() on element...');
            element.click();
            console.log('[Gamepad Debug] Click completed');
            this.vibrate(30);
            return;
        }
        
        // Create proper mouse event with all necessary properties
        const eventOptions = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
            screenX: x,
            screenY: y,
            button: 0,
            buttons: this.mouseButtonDown ? 1 : 0,
            detail: eventType === 'click' ? 1 : 0
        };
        
        const mouseEvent = new MouseEvent(eventType, eventOptions);
        element.dispatchEvent(mouseEvent);
        
        // For click events, also try native click
        if (eventType === 'click') {
            setTimeout(() => {
                if (element.tagName === 'BUTTON' || element.tagName === 'A' || 
                    element.classList.contains('close-btn') ||
                    element.classList.contains('window-content-button') ||
                    element.classList.contains('tab-button')) {
                    element.click();
                }
            }, 10);
        }
        
        // Focus inputs on mousedown
        if (eventType === 'mousedown') {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
                element.focus();
            }
        }
    }
    
    scrollToElement(element, container) {
        if (!element || !container) return;
        
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Check if element is out of view
        if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    switchTab(direction) {
        // Find active window with tabs
        const windows = [
            { id: 'settings-menu', selectors: ['.tab-button', '#settings-content .tab-button'] },
            { id: 'skill-tree', selectors: ['.skill-tab-btn', '.tab-button'] },
            { id: 'world-map-window', selectors: ['.map-tab', '.tab-button'] }
        ];
        
        for (const win of windows) {
            const windowEl = document.getElementById(win.id);
            if (windowEl && windowEl.style.display !== 'none') {
                let tabs = [];
                
                // Try each selector
                for (const selector of win.selectors) {
                    tabs = Array.from(windowEl.querySelectorAll(selector));
                    if (tabs.length > 0) break;
                }
                
                if (tabs.length === 0) continue;
                
                const activeIndex = tabs.findIndex(tab => tab.classList.contains('active'));
                console.log(`[Gamepad] Tab switch in ${win.id}: ${tabs.length} tabs, active: ${activeIndex}`);
                
                if (activeIndex >= 0) {
                    const newIndex = (activeIndex + direction + tabs.length) % tabs.length;
                    console.log(`[Gamepad] Switching to tab ${newIndex}`);
                    tabs[newIndex].click();
                    this.vibrate(50);
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // ============================================================================
    // PRE-GAME MENU NAVIGATION (D-Pad)
    // ============================================================================
    
    // Handle menu navigation with gamepad (only for pre-game screens)
    handleMenuNavigation() {
        if (!this.gamepad) return;
        
        // Check if we're on the start screen
        const startScreen = document.getElementById('start-screen');
        const charSelection = document.getElementById('character-selection-screen');
        const charCreation = document.getElementById('character-creation');
        
        // Skip menu navigation if we're in-game (canvas visible)
        const gameCanvas = document.getElementById('gameCanvas');
        if (gameCanvas && gameCanvas.style.display !== 'none') {
            // In-game - use virtual mouse instead
            return;
        }
        
        // Start screen - Press Start button (button 9) to begin
        if (startScreen && startScreen.style.display !== 'none') {
            // Check ANY button press on start screen for debugging
            for (let i = 0; i < this.gamepad.buttons.length; i++) {
                const buttonPressed = this.gamepad.buttons[i] && (this.gamepad.buttons[i].pressed || this.gamepad.buttons[i].value > 0.5);
                
                if (buttonPressed && !this.buttonStates[i]) {
                    console.log(`[Gamepad] Button ${i} (${this.getButtonName(i)}) pressed on start screen`);
                    const startBtn = document.getElementById('start-game-audio-btn');
                    if (startBtn) {
                        startBtn.click();
                        this.vibrate(100);
                    }
                }
                
                // Update button state
                this.buttonStates[i] = buttonPressed;
            }
            return; // Don't process other menus while on start screen
        }
        
        // Character selection navigation
        if (charSelection && charSelection.style.display !== 'none') {
            const slots = Array.from(document.querySelectorAll('.character-slot'));
            const createBtn = document.getElementById('create-new-char-btn');
            const charList = document.getElementById('character-list');
            
            // Ensure at least one element is selected
            let currentIndex = slots.findIndex(s => s.classList.contains('gamepad-selected'));
            if (currentIndex === -1 && slots.length > 0) {
                slots[0].classList.add('gamepad-selected');
                currentIndex = 0;
            }
            
            // Check if create button is selected
            const createBtnSelected = createBtn?.classList.contains('gamepad-selected');
            
            // A button (0) to select/confirm
            if (this.isButtonPressed(0) && !this.buttonStates[0]) {
                if (createBtnSelected) {
                    createBtn.click();
                    this.vibrate(100);
                } else if (currentIndex >= 0) {
                    // Click the info div inside the slot to load character
                    const infoDiv = slots[currentIndex].querySelector('div[style*="cursor: pointer"]');
                    if (infoDiv) {
                        infoDiv.click();
                        this.vibrate(100);
                    }
                }
            }
            
            // D-pad or stick for navigation (UP/DOWN)
            const leftY = this.getAxisValue(1);
            
            // DOWN - Move down through character list or to Create button
            if ((this.isButtonPressed(13) || leftY > 0.5) && !this.buttonStates[13]) {
                if (!createBtnSelected) {
                    if (currentIndex < slots.length - 1) {
                        // Move to next character
                        slots[currentIndex].classList.remove('gamepad-selected');
                        slots[currentIndex + 1].classList.add('gamepad-selected');
                        this.scrollToElement(slots[currentIndex + 1], charList);
                        this.vibrate(50);
                    } else {
                        // Move to Create button
                        slots.forEach(s => s.classList.remove('gamepad-selected'));
                        createBtn?.classList.add('gamepad-selected');
                        this.vibrate(50);
                    }
                }
            }
            
            // UP - Move up through character list
            if ((this.isButtonPressed(12) || leftY < -0.5) && !this.buttonStates[12]) {
                if (createBtnSelected) {
                    // Move back to last character
                    createBtn?.classList.remove('gamepad-selected');
                    if (slots.length > 0) {
                        const lastIndex = slots.length - 1;
                        slots[lastIndex].classList.add('gamepad-selected');
                        this.scrollToElement(slots[lastIndex], charList);
                        this.vibrate(50);
                    }
                } else if (currentIndex > 0) {
                    // Move to previous character
                    slots[currentIndex].classList.remove('gamepad-selected');
                    slots[currentIndex - 1].classList.add('gamepad-selected');
                    this.scrollToElement(slots[currentIndex - 1], charList);
                    this.vibrate(50);
                }
            }
            return; // Don't process game controls while in character selection
        }
        
        // Character creation screen
        if (charCreation && charCreation.style.display !== 'none') {
            this.handleCharacterCreation(charCreation);
            return; // Don't process other navigation
        }
        
        // DISABLED: Universal window navigation - use virtual mouse instead
        // this.handleWindowNavigation();
    }
    
    handleCharacterCreation(charCreation) {
        // All interactive elements in character creation
        const elements = [
            document.getElementById('character-name'),
            document.getElementById('roll-dice-btn'),
            document.getElementById('prev-hair-btn'),
            document.getElementById('next-hair-btn'),
            document.getElementById('prev-hair-color-btn'),
            document.getElementById('next-hair-color-btn'),
            document.getElementById('prev-eye-btn'),
            document.getElementById('next-eye-btn'),
            document.getElementById('prev-skin-btn'),
            document.getElementById('next-skin-btn'),
            document.getElementById('start-game-btn'),
            document.getElementById('back-to-select-btn')
        ].filter(el => el !== null);
        
        if (elements.length === 0) return;
        
        // Find or initialize selection
        let selectedIndex = elements.findIndex(el => el.classList.contains('gamepad-selected'));
        if (selectedIndex === -1) {
            elements[0].classList.add('gamepad-selected');
            elements[0].focus();
            selectedIndex = 0;
        }
        
        const leftY = this.getAxisValue(1);
        const leftX = this.getAxisValue(0);
        
        // Navigate DOWN
        if ((this.isButtonPressed(13) || leftY > 0.5) && !this.buttonStates[13]) {
            elements[selectedIndex].classList.remove('gamepad-selected');
            selectedIndex = (selectedIndex + 1) % elements.length;
            elements[selectedIndex].classList.add('gamepad-selected');
            if (elements[selectedIndex].tagName !== 'INPUT') {
                elements[selectedIndex].focus();
            }
            this.vibrate(30);
        }
        
        // Navigate UP
        if ((this.isButtonPressed(12) || leftY < -0.5) && !this.buttonStates[12]) {
            elements[selectedIndex].classList.remove('gamepad-selected');
            selectedIndex = (selectedIndex - 1 + elements.length) % elements.length;
            elements[selectedIndex].classList.add('gamepad-selected');
            if (elements[selectedIndex].tagName !== 'INPUT') {
                elements[selectedIndex].focus();
            }
            this.vibrate(30);
        }
        
        // LEFT/RIGHT for prev/next buttons
        if ((this.isButtonPressed(14) || leftX < -0.5) && !this.buttonStates[14]) {
            const el = elements[selectedIndex];
            // If we're on a "next" button, jump to corresponding "prev" button
            if (el.id.includes('next-')) {
                const prevBtn = el.id.replace('next-', 'prev-');
                const prevEl = document.getElementById(prevBtn);
                if (prevEl) {
                    prevEl.click();
                    this.vibrate(30);
                }
            } else if (el.tagName === 'BUTTON' && !el.id.includes('prev-') && !el.id.includes('next-')) {
                // For other buttons, click them with left arrow
                el.click();
                this.vibrate(50);
            }
        }
        
        if ((this.isButtonPressed(15) || leftX > 0.5) && !this.buttonStates[15]) {
            const el = elements[selectedIndex];
            // If we're on a "prev" button, jump to corresponding "next" button
            if (el.id.includes('prev-')) {
                const nextBtn = el.id.replace('prev-', 'next-');
                const nextEl = document.getElementById(nextBtn);
                if (nextEl) {
                    nextEl.click();
                    this.vibrate(30);
                }
            } else if (el.tagName === 'BUTTON' && !el.id.includes('prev-') && !el.id.includes('next-')) {
                // For other buttons, click them with right arrow
                el.click();
                this.vibrate(50);
            }
        }
        
        // A button to activate selected element
        if (this.isButtonPressed(0) && !this.buttonStates[0]) {
            const el = elements[selectedIndex];
            if (el.tagName === 'BUTTON') {
                el.click();
                this.vibrate(100);
            } else if (el.tagName === 'INPUT') {
                // Toggle virtual keyboard for inputs
                el.focus();
                this.vibrate(50);
            }
        }
        
        // B button to go back
        if (this.isButtonPressed(1) && !this.buttonStates[1]) {
            const backBtn = document.getElementById('back-to-select-btn');
            if (backBtn) {
                backBtn.click();
                this.vibrate(100);
            }
        }
    }
    
    // ============================================================================
    // LEGACY: IN-GAME WINDOW NAVIGATION (No longer used - virtual mouse handles this)
    // These methods are kept for backwards compatibility but are disabled
    // ============================================================================
    
    handleWindowNavigation() {
        // NOTE: This method is DISABLED - virtual mouse system handles all UI interaction now
        // Kept here for reference only
        const windows = [
            'shop-window',
            'dialogue-window', 
            'inventory',
            'equipment',
            'skill-tree',
            'stat-window',
            'quest-log',
            'bestiary-window',
            'achievement-window',
            'settings-menu'
        ];
        
        // First pass: clear selections from all closed windows
        for (const windowId of windows) {
            const windowEl = document.getElementById(windowId);
            if (windowEl) {
                const isVisible = windowEl.style.display === 'block' || windowEl.style.display === 'flex';
                if (!isVisible) {
                    const hadSelections = windowEl.querySelectorAll('.gamepad-selected').length > 0;
                    if (hadSelections) {
                        windowEl.querySelectorAll('.gamepad-selected').forEach(el => {
                            el.classList.remove('gamepad-selected');
                        });
                        console.log(`[Gamepad] Cleared ${hadSelections} selections from closed ${windowId}`);
                    }
                }
            }
        }
        
        // Second pass: handle open windows
        for (const windowId of windows) {
            const windowEl = document.getElementById(windowId);
            if (!windowEl) {
                if (this.debugMode) console.log(`[Gamepad Debug] Window ${windowId} not found in DOM`);
                continue;
            }
            
            // Check if window is actually visible (not just style, but computed style)
            const computedStyle = window.getComputedStyle(windowEl);
            const isVisible = computedStyle.display !== 'none' && 
                             (windowEl.style.display === 'block' || 
                              windowEl.style.display === 'flex' ||
                              windowEl.style.display === '');
            
            if (this.debugMode) {
                console.log(`[Gamepad Debug] Window ${windowId}: computed=${computedStyle.display}, inline=${windowEl.style.display}, visible=${isVisible}`);
            }
            
            if (!isVisible) continue;
            
            // Window is open - let's navigate it
            console.log(`[Gamepad] Navigating window: ${windowId}`);
            
            // B button closes windows
            if (this.isButtonPressed(1) && !this.buttonStates[1]) {
                const closeBtn = windowEl.querySelector('.close-btn');
                if (closeBtn) {
                    closeBtn.click();
                    this.vibrate(100);
                    // Clear selections after closing
                    setTimeout(() => {
                        this.clearAllSelections();
                    }, 100);
                    return;
                }
            }
            
            // Let specific handlers deal with this window
            if (windowId === 'dialogue-window') {
                this.handleDialogueNavigation();
                return;
            }
            
            if (windowId === 'shop-window') {
                this.handleShopNavigation();
                return;
            }
            
            // Generic list navigation for other windows
            this.handleGenericListNavigation(windowEl, windowId);
            return;
        }
    }
    
    showGamepadHelpOverlay(show) {
        const overlay = document.getElementById('gamepad-help-overlay');
        if (overlay && this.gamepad) {
            overlay.style.display = show ? 'block' : 'none';
        }
    }
    
    handleDialogueNavigation() {
        // A button to select dialogue option or continue
        if (this.isButtonPressed(0) && !this.buttonStates[0]) {
            const continueBtn = document.getElementById('dialogue-continue-btn');
            const options = document.querySelectorAll('.dialogue-option');
            
            if (continueBtn && continueBtn.style.display !== 'none') {
                continueBtn.click();
                this.vibrate(100);
            } else if (options.length > 0) {
                options[0].click();
                this.vibrate(100);
            }
        }
    }
    
    handleShopNavigation() {
        // Simple shop navigation - just use A to buy for now
        const shopItems = Array.from(document.querySelectorAll('.shop-item'));
        if (shopItems.length === 0) return;
        
        // Initialize selection
        let selected = shopItems.findIndex(item => item.classList.contains('gamepad-selected'));
        if (selected === -1) {
            shopItems[0].classList.add('gamepad-selected');
            selected = 0;
        }
        
        const leftY = this.getAxisValue(1);
        
        // Up/Down navigation
        if ((this.isButtonPressed(13) || leftY > 0.5) && !this.buttonStates[13]) {
            if (selected < shopItems.length - 1) {
                shopItems[selected].classList.remove('gamepad-selected');
                shopItems[selected + 1].classList.add('gamepad-selected');
                this.scrollToElement(shopItems[selected + 1], document.querySelector('.shop-items'));
                this.vibrate(30);
            }
        }
        
        if ((this.isButtonPressed(12) || leftY < -0.5) && !this.buttonStates[12]) {
            if (selected > 0) {
                shopItems[selected].classList.remove('gamepad-selected');
                shopItems[selected - 1].classList.add('gamepad-selected');
                this.scrollToElement(shopItems[selected - 1], document.querySelector('.shop-items'));
                this.vibrate(30);
            }
        }
        
        // A to buy
        if (this.isButtonPressed(0) && !this.buttonStates[0]) {
            shopItems[selected].click();
            this.vibrate(50);
        }
    }
    
    handleSkillTreeNavigation(windowEl) {
        // Handle tab switching with L1/R1
        this.handleTabSwitching(windowEl, 'skill-tree');
        
        // Get all skill nodes (both tabs and skills)
        const skillNodes = Array.from(windowEl.querySelectorAll('.skill-node')).filter(el => {
            return el.offsetParent !== null;
        });
        
        if (skillNodes.length === 0) {
            return;
        }
        
        // Initialize selection
        let selected = skillNodes.findIndex(node => node.classList.contains('gamepad-selected'));
        if (selected === -1) {
            windowEl.querySelectorAll('.gamepad-selected').forEach(el => {
                el.classList.remove('gamepad-selected');
            });
            skillNodes[0].classList.add('gamepad-selected');
            selected = 0;
            console.log(`[Gamepad] Initialized selection in skill tree, ${skillNodes.length} skills available`);
        }
        
        const leftY = this.getAxisValue(1);
        
        // Navigate down/up
        if ((this.isButtonPressed(13) || leftY > 0.5) && !this.buttonStates[13]) {
            if (selected + 1 < skillNodes.length) {
                skillNodes[selected].classList.remove('gamepad-selected');
                skillNodes[selected + 1].classList.add('gamepad-selected');
                this.scrollToElement(skillNodes[selected + 1], windowEl);
                this.vibrate(30);
            }
        }
        
        if ((this.isButtonPressed(12) || leftY < -0.5) && !this.buttonStates[12]) {
            if (selected - 1 >= 0) {
                skillNodes[selected].classList.remove('gamepad-selected');
                skillNodes[selected - 1].classList.add('gamepad-selected');
                this.scrollToElement(skillNodes[selected - 1], windowEl);
                this.vibrate(30);
            }
        }
        
        // A button to level up skill (if + button exists)
        if (this.isButtonPressed(0) && !this.buttonStates[0]) {
            const selectedNode = skillNodes[selected];
            const plusButton = selectedNode.querySelector('button[data-skill-name]');
            
            // Always get the skill name from the node's dataset first
            const skillName = selectedNode.dataset.skillName;
            
            if (plusButton) {
                // Skill has a + button - level it up
                console.log(`[Gamepad] Leveling up skill via + button: ${skillName}`);
                
                // Store the current selection by skill name before clicking
                window.gamepadLastSelectedSkillName = skillName;
                
                plusButton.click();
                this.vibrate(50);
            }
        }
        
        // X button (2) to assign learned skill to hotbar
        if (this.isButtonPressed(2) && !this.buttonStates[2]) {
            const selectedNode = skillNodes[selected];
            const skillName = selectedNode.dataset.skillName;
            
            if (skillName && selectedNode.draggable) {
                // Skill is learned - assign to hotbar
                console.log(`[Gamepad] Assigning skill to hotbar: ${skillName}`);
                if (typeof assignSkillToNextHotbarSlot === 'function') {
                    assignSkillToNextHotbarSlot(skillName, skillName);
                    this.vibrate(50);
                }
            }
        }
    }
    
    handleStatWindowNavigation(windowEl) {
        // Get all stat add buttons
        const statButtons = Array.from(windowEl.querySelectorAll('.stat-add-btn')).filter(el => {
            return el.offsetParent !== null && !el.disabled;
        });
        
        if (statButtons.length === 0) {
            return;
        }
        
        // Initialize selection
        let selected = statButtons.findIndex(btn => btn.classList.contains('gamepad-selected'));
        if (selected === -1) {
            windowEl.querySelectorAll('.gamepad-selected').forEach(el => {
                el.classList.remove('gamepad-selected');
            });
            statButtons[0].classList.add('gamepad-selected');
            selected = 0;
        }
        
        const leftY = this.getAxisValue(1);
        
        // Navigate down/up
        if ((this.isButtonPressed(13) || leftY > 0.5) && !this.buttonStates[13]) {
            if (selected + 1 < statButtons.length) {
                statButtons[selected].classList.remove('gamepad-selected');
                statButtons[selected + 1].classList.add('gamepad-selected');
                this.vibrate(30);
            }
        }
        
        if ((this.isButtonPressed(12) || leftY < -0.5) && !this.buttonStates[12]) {
            if (selected - 1 >= 0) {
                statButtons[selected].classList.remove('gamepad-selected');
                statButtons[selected - 1].classList.add('gamepad-selected');
                this.vibrate(30);
            }
        }
        
        // A button to add stat point
        if (this.isButtonPressed(0) && !this.buttonStates[0]) {
            const selectedButton = statButtons[selected];
            const statType = selectedButton.dataset.stat;
            
            // Store which stat button was selected
            window.gamepadLastSelectedStat = statType;
            
            console.log(`[Gamepad] Adding point to ${statType}`);
            selectedButton.click();
            this.vibrate(50);
            
            // Restore selection after UI updates
            setTimeout(() => {
                this.restoreStatSelection(windowEl);
            }, 100);
        }
    }
    
    restoreStatSelection(windowEl) {
        if (!window.gamepadLastSelectedStat) return;
        
        const statButtons = Array.from(windowEl.querySelectorAll('.stat-add-btn'));
        const targetButton = statButtons.find(btn => 
            btn.dataset.stat === window.gamepadLastSelectedStat
        );
        
        if (targetButton && !targetButton.disabled) {
            windowEl.querySelectorAll('.gamepad-selected').forEach(el => {
                el.classList.remove('gamepad-selected');
            });
            targetButton.classList.add('gamepad-selected');
            console.log(`[Gamepad] Restored selection to: ${window.gamepadLastSelectedStat}`);
        } else if (targetButton && targetButton.disabled) {
            // Button is disabled (no more AP), select the first available button
            const firstAvailable = statButtons.find(btn => !btn.disabled);
            if (firstAvailable) {
                windowEl.querySelectorAll('.gamepad-selected').forEach(el => {
                    el.classList.remove('gamepad-selected');
                });
                firstAvailable.classList.add('gamepad-selected');
                window.gamepadLastSelectedStat = firstAvailable.dataset.stat;
            }
        }
    }
    
    restoreSkillSelection(windowEl) {
        if (!window.gamepadLastSelectedSkillName) return;
        
        const skillNodes = Array.from(windowEl.querySelectorAll('.skill-node'));
        const targetNode = skillNodes.find(node => 
            node.dataset.skillName === window.gamepadLastSelectedSkillName
        );
        
        if (targetNode) {
            windowEl.querySelectorAll('.gamepad-selected').forEach(el => {
                el.classList.remove('gamepad-selected');
            });
            targetNode.classList.add('gamepad-selected');
            this.scrollToElement(targetNode, windowEl);
            console.log(`[Gamepad] Restored selection to: ${window.gamepadLastSelectedSkillName}`);
        }
    }
    
    handleGenericListNavigation(windowEl, windowId) {
        // Special handling for skill tree window
        if (windowId === 'skill-tree') {
            this.handleSkillTreeNavigation(windowEl);
            return;
        }
        
        // Special handling for stat window
        if (windowId === 'stat-window') {
            this.handleStatWindowNavigation(windowEl);
            return;
        }
        
        // Handle tab switching with L1/R1
        this.handleTabSwitching(windowEl, windowId);
        
        // Find all clickable/interactive elements (include action buttons)
        const selectors = [
            '.inventory-slot',
            '.equipment-slot',
            '.skill-item',
            '.quest-item',
            '.monster-entry',
            '.achievement-item',
            'button:not(.close-btn):not(.tab-button)' // Include all buttons except close and tabs
        ];
        
        let items = [];
        for (const selector of selectors) {
            items = Array.from(windowEl.querySelectorAll(selector)).filter(el => {
                return el.offsetParent !== null && !el.disabled;
            });
            if (items.length > 0) break;
        }
        
        if (items.length === 0) {
            console.log(`[Gamepad] No navigable items in ${windowId}`);
            return;
        }
        
        // Initialize selection - always ensure one item is selected
        let selected = items.findIndex(item => item.classList.contains('gamepad-selected'));
        if (selected === -1) {
            // Clear any stale selections first
            windowEl.querySelectorAll('.gamepad-selected').forEach(el => {
                el.classList.remove('gamepad-selected');
            });
            // Select first item
            items[0].classList.add('gamepad-selected');
            selected = 0;
            console.log(`[Gamepad] Initialized selection in ${windowId}, ${items.length} items available`);
        }
        
        const leftY = this.getAxisValue(1);
        const leftX = this.getAxisValue(0);
        
        // Calculate grid dimensions for inventory/equipment
        const isGrid = windowId === 'inventory' || windowId === 'equipment';
        let cols = 1;
        if (isGrid && items.length > 0) {
            const firstRect = items[0].getBoundingClientRect();
            cols = items.filter(item => 
                Math.abs(item.getBoundingClientRect().top - firstRect.top) < 5
            ).length;
        }
        
        // Navigate down/up
        if ((this.isButtonPressed(13) || leftY > 0.5) && !this.buttonStates[13]) {
            const nextIndex = isGrid ? selected + cols : selected + 1;
            if (nextIndex < items.length) {
                items[selected].classList.remove('gamepad-selected');
                items[nextIndex].classList.add('gamepad-selected');
                this.scrollToElement(items[nextIndex], windowEl);
                this.vibrate(30);
            }
        }
        
        if ((this.isButtonPressed(12) || leftY < -0.5) && !this.buttonStates[12]) {
            const prevIndex = isGrid ? selected - cols : selected - 1;
            if (prevIndex >= 0) {
                items[selected].classList.remove('gamepad-selected');
                items[prevIndex].classList.add('gamepad-selected');
                this.scrollToElement(items[prevIndex], windowEl);
                this.vibrate(30);
            }
        }
        
        // Navigate left/right for grids
        if (isGrid) {
            if ((this.isButtonPressed(15) || leftX > 0.5) && !this.buttonStates[15]) {
                const nextIndex = selected + 1;
                if (nextIndex < items.length && nextIndex % cols !== 0) {
                    items[selected].classList.remove('gamepad-selected');
                    items[nextIndex].classList.add('gamepad-selected');
                    this.vibrate(30);
                }
            }
            
            if ((this.isButtonPressed(14) || leftX < -0.5) && !this.buttonStates[14]) {
                const prevIndex = selected - 1;
                if (prevIndex >= 0 && selected % cols !== 0) {
                    items[selected].classList.remove('gamepad-selected');
                    items[prevIndex].classList.add('gamepad-selected');
                    this.vibrate(30);
                }
            }
        }
        
        // A to activate/click
        if (this.isButtonPressed(0) && !this.buttonStates[0]) {
            items[selected].click();
            this.vibrate(50);
            console.log(`[Gamepad] Clicked item ${selected}`);
        }
    }
    
    // ============================================================================
    // BUTTON MAPPING PERSISTENCE
    // ============================================================================
    
    // Save button mappings to localStorage
    saveButtonMap() {
        try {
            localStorage.setItem('gamepadButtonMap', JSON.stringify(this.buttonMap));
            console.log('Gamepad mappings saved');
        } catch (e) {
            console.error('Failed to save gamepad mappings:', e);
        }
    }
    
    // Load button mappings from localStorage
    loadButtonMap() {
        try {
            const saved = localStorage.getItem('gamepadButtonMap');
            if (saved) {
                const loaded = JSON.parse(saved);
                console.log('Loaded gamepad mappings from storage');
                
                // MIGRATION: Convert old 'mouse-click' to new 'smart-action'
                let needsMigration = false;
                if (loaded[10] === 'mouse-click') {
                    console.log('[Gamepad] Migrating old button map: mouse-click → smart-action');
                    loaded[0] = 'smart-action'; // Move mouse-click from L3 to A button
                    loaded[10] = 'hotbar-5'; // L3 now triggers hotbar-5
                    needsMigration = true;
                }
                
                // Ensure we have the new smart-action system
                if (loaded[0] !== 'smart-action' && !loaded[0]?.startsWith('hotbar-')) {
                    console.log('[Gamepad] Migrating button 0 to smart-action from:', loaded[0]);
                    loaded[0] = 'smart-action';
                    needsMigration = true;
                }
                
                const merged = { ...this.defaultButtonMap, ...loaded };
                
                // Force button 9 (Start) to always be 'settings'
                merged[9] = 'settings';
                
                // Save migrated mapping
                if (needsMigration) {
                    console.log('[Gamepad] Saving migrated button map');
                    localStorage.setItem('gamepadButtonMap', JSON.stringify(merged));
                }
                
                return merged;
            }
        } catch (e) {
            console.error('Failed to load gamepad mappings:', e);
        }
        return { ...this.defaultButtonMap };
    }
    
    // Reset to default mappings
    resetToDefaults() {
        this.buttonMap = { ...this.defaultButtonMap };
        this.saveButtonMap();
        console.log('Reset gamepad mappings to defaults');
    }
    
    // Remapping is now handled by a dedicated UI polling system in ui.js
    // These methods are kept for backwards compatibility but are no longer used
    
    // Set a button mapping
    setButtonMapping(buttonIndex, action) {
        // Prevent remapping the Start button (button 9) - it should always open settings
        if (buttonIndex === 9) {
            console.warn('Cannot remap Start button (button 9) - it is locked to Settings');
            if (typeof showNotification === 'function') {
                showNotification('Start button cannot be remapped', 'error');
            }
            return;
        }
        
        this.buttonMap[buttonIndex] = action;
        this.saveButtonMap();
        console.log(`Mapped button ${buttonIndex} to ${action}`);
    }
    
    // Get available actions for remapping
    getAvailableActions() {
        return [
            'jump', 'attack', 'loot', 'interact',
            'inventory', 'equipment', 'skills', 'stats',
            'settings', 'world-map', 'quest-log', 'bestiary',
            'achievements', 'minimap', 'tab-prev', 'tab-next',
            null  // For unassigned
        ];
    }
    
    // Handle tab switching for windows with tabs
    handleTabSwitching(windowEl, windowId) {
        // Check if this window has tabs
        const tabs = Array.from(windowEl.querySelectorAll('.tab-button')).filter(tab => 
            tab.offsetParent !== null
        );
        
        if (tabs.length === 0) return;
        
        // L1 (button 4) - Previous tab
        if (this.isButtonPressed(4) && !this.buttonStates[4]) {
            const activeIndex = tabs.findIndex(tab => tab.classList.contains('active'));
            if (activeIndex > 0) {
                tabs[activeIndex - 1].click();
                this.vibrate(30);
                console.log(`[Gamepad] Switched to previous tab in ${windowId}`);
                
                // Clear selections when switching tabs
                setTimeout(() => {
                    windowEl.querySelectorAll('.gamepad-selected').forEach(el => {
                        el.classList.remove('gamepad-selected');
                    });
                }, 50);
            }
        }
        
        // R1 (button 5) - Next tab
        if (this.isButtonPressed(5) && !this.buttonStates[5]) {
            const activeIndex = tabs.findIndex(tab => tab.classList.contains('active'));
            if (activeIndex >= 0 && activeIndex < tabs.length - 1) {
                tabs[activeIndex + 1].click();
                this.vibrate(30);
                console.log(`[Gamepad] Switched to next tab in ${windowId}`);
                
                // Clear selections when switching tabs
                setTimeout(() => {
                    windowEl.querySelectorAll('.gamepad-selected').forEach(el => {
                        el.classList.remove('gamepad-selected');
                    });
                }, 50);
            }
        }
    }
    
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    
    // Check if gamepad is connected
    isConnected() {
        return this.gamepad !== null;
    }
    
    // Get button name for display
    getButtonName(buttonIndex) {
        return this.buttonNames[buttonIndex] || `Button ${buttonIndex}`;
    }
    
    // Get action name for display
    getActionName(action) {
        return this.actionNames[action] || action || 'Unassigned';
    }
    
    // Force keyboard mode (disable gamepad even if connected)
    setForceKeyboardMode(force) {
        console.log(`[Gamepad] ${force ? 'Forcing' : 'Un-forcing'} keyboard mode`);
        this.forceKeyboardMode = force;
        
        if (force) {
            // Hide virtual cursor
            const cursor = document.getElementById('virtual-mouse-cursor');
            if (cursor) {
                cursor.style.display = 'none';
            }
            
            // Remove gamepad UI elements
            this.showGamepadIndicator(false);
            
            // Clear any hover states
            this.clearAllSelections();
        } else {
            // Re-enable gamepad if connected
            if (this.gamepad) {
                this.showGamepadIndicator(true);
                
                // Re-enable virtual mouse if we're in gameplay
                const startScreen = this.cachedElements.startScreen || document.getElementById('start-screen');
                const charSelection = this.cachedElements.charSelection || document.getElementById('character-selection-screen');
                const charCreation = this.cachedElements.charCreation || document.getElementById('character-creation-screen');
                
                // Virtual mouse is now always enabled when gamepad is connected
                // No need to check for menu state
            }
        }
    }
}

// Global gamepad movement state
const gamepadMovement = {
    left: false,
    right: false,
    up: false,
    down: false
};

// Initialize gamepad manager
let gamepadManager = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    gamepadManager = new GamepadManager();
    console.log('Gamepad Manager initialized');
    
    // Check if gamepad is already connected on load
    const gamepads = navigator.getGamepads();
    const connectedGamepad = Array.from(gamepads).find(gp => gp !== null);
    if (connectedGamepad) {
        console.log('[Gamepad] Controller already connected on load:', connectedGamepad.id);
        gamepadManager.updateStartButtonText(true);
    }
    
    let debugLogged = false;
    let gamepadCheckCount = 0;
    
    // Ensure gamepad updates even when game loop might not be running
    // This is a backup for menu navigation
    setInterval(() => {
        if (gamepadManager && typeof gamepadManager.update === 'function') {
            // Only run this backup update if we're not in active gameplay
            const startScreen = document.getElementById('start-screen');
            const charSelection = document.getElementById('character-selection-screen');
            const charCreation = document.getElementById('character-creation');
            
            const inMenu = (startScreen && startScreen.style.display !== 'none') ||
                          (charSelection && charSelection.style.display !== 'none') ||
                          (charCreation && charCreation.style.display !== 'none');
            
            if (inMenu) {
                // Debug log once per screen
                if (!debugLogged) {
                    console.log('[Gamepad] Menu navigation active');
                    console.log('[Gamepad] Start screen:', startScreen && startScreen.style.display !== 'none');
                    console.log('[Gamepad] Char selection:', charSelection && charSelection.style.display !== 'none');
                    console.log('[Gamepad] Char creation:', charCreation && charCreation.style.display !== 'none');
                    debugLogged = true;
                }
                
                // Check for gamepad every 60 frames (once per second)
                if (gamepadCheckCount++ % 60 === 0) {
                    const gamepads = navigator.getGamepads();
                    const connected = Array.from(gamepads).some(gp => gp !== null);
                    if (connected && !gamepadManager.gamepad) {
                        console.log('[Gamepad] Controller detected in poll');
                    }
                }
                
                gamepadManager.update();
            } else {
                debugLogged = false;
            }
        }
    }, 16); // ~60 FPS
});

// Virtual Keyboard for Gamepad Input
class VirtualKeyboard {
    constructor() {
        this.isOpen = false;
        this.currentInput = '';
        this.maxLength = 50;
        this.targetInput = null;
        this.selectedKey = 0;
        this.keys = [
            ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
            ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
            ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
            ['SPACE', 'BACKSPACE', 'ENTER']
        ];
        this.allKeys = this.keys.flat();
        
        this.init();
    }
    
    init() {
        const keyboardEl = document.getElementById('virtual-keyboard');
        if (!keyboardEl) return;
        
        const keysContainer = keyboardEl.querySelector('.virtual-keyboard-keys');
        if (!keysContainer) return;
        
        // Build keyboard layout
        keysContainer.innerHTML = '';
        this.keys.forEach((row, rowIndex) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'virtual-keyboard-row';
            
            row.forEach((key, keyIndex) => {
                const keyEl = document.createElement('div');
                keyEl.className = 'virtual-keyboard-key';
                keyEl.dataset.key = key;
                
                if (key === 'SPACE') {
                    keyEl.textContent = '␣ Space';
                    keyEl.classList.add('wide-key');
                } else if (key === 'BACKSPACE') {
                    keyEl.textContent = '⌫ Backspace';
                    keyEl.classList.add('wide-key');
                } else if (key === 'ENTER') {
                    keyEl.textContent = '⏎ Enter';
                    keyEl.classList.add('wide-key');
                } else {
                    keyEl.textContent = key.toUpperCase();
                }
                
                rowEl.appendChild(keyEl);
            });
            
            keysContainer.appendChild(rowEl);
        });
        
        // Close button handler
        const closeBtn = document.getElementById('virtual-keyboard-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
    }
    
    open(inputElement) {
        this.targetInput = inputElement;
        this.currentInput = inputElement.value || '';
        this.maxLength = parseInt(inputElement.getAttribute('maxlength')) || 50;
        this.selectedKey = 0;
        this.isOpen = true;
        
        const keyboardEl = document.getElementById('virtual-keyboard');
        if (keyboardEl) {
            keyboardEl.style.display = 'block';
            this.updateDisplay();
            this.updateSelection();
        }
    }
    
    close() {
        if (this.targetInput) {
            this.targetInput.value = this.currentInput;
            this.targetInput.blur();
        }
        
        const keyboardEl = document.getElementById('virtual-keyboard');
        if (keyboardEl) {
            keyboardEl.style.display = 'none';
        }
        
        this.isOpen = false;
        this.targetInput = null;
        this.currentInput = '';
        
        // Re-enable chat mode if closing without submitting
        if (typeof isChatting !== 'undefined' && isChatting) {
            const chatInputContainer = document.getElementById('chat-input-container');
            if (chatInputContainer) {
                chatInputContainer.style.display = 'none';
            }
            isChatting = false;
        }
    }
    
    submit() {
        if (this.targetInput) {
            this.targetInput.value = this.currentInput;
            
            // Check if this is the chat input
            if (this.targetInput.id === 'chat-input' && this.currentInput.trim()) {
                // Send the chat message
                if (typeof player !== 'undefined' && typeof addChatMessage === 'function') {
                    addChatMessage(`${player.name}: ${this.currentInput}`, 'player');
                    player.chatMessage = this.currentInput;
                    player.chatTimer = 180;
                }
            }
        }
        
        this.close();
    }
    
    handleGamepadInput(gamepad) {
        if (!this.isOpen || !gamepad) return;
        
        const leftStickX = gamepad.axes[0];
        const leftStickY = gamepad.axes[1];
        const dpadUp = gamepad.buttons[12]?.pressed;
        const dpadDown = gamepad.buttons[13]?.pressed;
        const dpadLeft = gamepad.buttons[14]?.pressed;
        const dpadRight = gamepad.buttons[15]?.pressed;
        
        // Navigation with debounce
        const now = Date.now();
        if (!this.lastNavTime || now - this.lastNavTime > 200) {
            if (Math.abs(leftStickX) > 0.5 || dpadLeft || dpadRight) {
                if (leftStickX < -0.5 || dpadLeft) {
                    this.selectedKey = Math.max(0, this.selectedKey - 1);
                    this.lastNavTime = now;
                    this.updateSelection();
                    gamepadManager.vibrate(50);
                } else if (leftStickX > 0.5 || dpadRight) {
                    this.selectedKey = Math.min(this.allKeys.length - 1, this.selectedKey + 1);
                    this.lastNavTime = now;
                    this.updateSelection();
                    gamepadManager.vibrate(50);
                }
            }
            
            if (Math.abs(leftStickY) > 0.5 || dpadUp || dpadDown) {
                const keysPerRow = [10, 9, 7, 3];
                let currentRow = 0;
                let keyInRow = this.selectedKey;
                
                // Find current row
                for (let i = 0; i < keysPerRow.length; i++) {
                    if (keyInRow < keysPerRow[i]) {
                        currentRow = i;
                        break;
                    }
                    keyInRow -= keysPerRow[i];
                }
                
                if (leftStickY < -0.5 || dpadUp) {
                    // Move up
                    if (currentRow > 0) {
                        currentRow--;
                        let offset = 0;
                        for (let i = 0; i < currentRow; i++) {
                            offset += keysPerRow[i];
                        }
                        this.selectedKey = offset + Math.min(keyInRow, keysPerRow[currentRow] - 1);
                        this.lastNavTime = now;
                        this.updateSelection();
                        gamepadManager.vibrate(50);
                    }
                } else if (leftStickY > 0.5 || dpadDown) {
                    // Move down
                    if (currentRow < keysPerRow.length - 1) {
                        currentRow++;
                        let offset = 0;
                        for (let i = 0; i < currentRow; i++) {
                            offset += keysPerRow[i];
                        }
                        this.selectedKey = offset + Math.min(keyInRow, keysPerRow[currentRow] - 1);
                        this.lastNavTime = now;
                        this.updateSelection();
                        gamepadManager.vibrate(50);
                    }
                }
            }
        }
        
        // A button to press key
        if (!this.lastAPress || now - this.lastAPress > 200) {
            if (gamepad.buttons[0]?.pressed) {
                this.pressKey(this.allKeys[this.selectedKey]);
                this.lastAPress = now;
            }
        }
        
        // B button to close
        if (!this.lastBPress || now - this.lastBPress > 200) {
            if (gamepad.buttons[1]?.pressed) {
                this.close();
                this.lastBPress = now;
            }
        }
    }
    
    pressKey(key) {
        if (key === 'ENTER') {
            this.submit();
        } else if (key === 'BACKSPACE') {
            this.currentInput = this.currentInput.slice(0, -1);
            this.updateDisplay();
            gamepadManager.vibrate(75);
        } else if (key === 'SPACE') {
            if (this.currentInput.length < this.maxLength) {
                this.currentInput += ' ';
                this.updateDisplay();
                gamepadManager.vibrate(50);
            }
        } else {
            if (this.currentInput.length < this.maxLength) {
                this.currentInput += key;
                this.updateDisplay();
                gamepadManager.vibrate(50);
            }
        }
    }
    
    updateDisplay() {
        const displayEl = document.getElementById('virtual-keyboard-input-display');
        if (displayEl) {
            displayEl.textContent = this.currentInput || '(empty)';
        }
    }
    
    updateSelection() {
        const allKeyEls = document.querySelectorAll('.virtual-keyboard-key');
        allKeyEls.forEach((el, index) => {
            if (index === this.selectedKey) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        });
    }
}

// Initialize virtual keyboard
const virtualKeyboard = new VirtualKeyboard();

// Add to gamepad manager update loop
if (gamepadManager) {
    const originalUpdate = gamepadManager.update.bind(gamepadManager);
    gamepadManager.update = function() {
        originalUpdate();
        if (virtualKeyboard.isOpen && this.gamepad) {
            virtualKeyboard.handleGamepadInput(this.gamepad);
        }
    };
}
