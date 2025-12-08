// Key Mapping System for Customizable Controls
class KeyMappingManager {
    constructor() {
        this.defaultMappings = {
            // Movement
            'move-left': 'arrowleft',
            'move-right': 'arrowright',
            'move-up': 'arrowup',
            'move-down': 'arrowdown',
            'jump': 'alt',

            // Combat
            'attack': 'control',

            // Hotbar (12 customizable slots)
            'hotbar-1': '1',
            'hotbar-2': '2',
            'hotbar-3': '3',
            'hotbar-4': '4',
            'hotbar-5': '5',
            'hotbar-6': '6',
            'hotbar-7': '7',
            'hotbar-8': '8',
            'hotbar-9': '9',
            'hotbar-10': '0',
            'hotbar-11': '-',
            'hotbar-12': '=',

            // Menus
            'inventory': 'i',
            'equipment': 'e',
            'skills': 'k',
            'stats': 's',
            'achievements': 'a',
            'bestiary': 'b',
            'rankings': 'r',
            'quest-log': 'l',
            'quest-helper': 'q',
            'world-map': 'w',
            'minimap': 'm',
            'settings': 'escape',
            'pet': 'p',
            'social-hub': 'o',

            // Social/Interaction
            'chat': 'enter',
            'interact': 'y',
            'loot': 'z',

            // Debug
            'hitboxes': 'h',
            'gm-window': '`'
        };

        // In this version, we will let the player.js load the mappings.
        this.mappings = { ...this.defaultMappings };
        this.keyLabels = this.createKeyLabels();
        this.isCapturing = false;
        this.capturingAction = null;
    }

    createKeyLabels() {
        return {
            'arrowleft': '←',
            'arrowright': '→',
            'arrowup': '↑',
            'arrowdown': '↓',
            'control': 'Ctrl',
            'alt': 'Alt',
            'shift': 'Shift',
            'meta': 'Meta',
            'enter': 'Enter',
            'escape': 'Esc',
            'backspace': 'Backspace',
            'tab': 'Tab',
            ' ': 'Space',
            'space': 'Space',
            '`': '`',
            '-': '-',
            '=': '=',
            '[': '[',
            ']': ']',
            '\\': '\\',
            ';': ';',
            "'": "'",
            ',': ',',
            '.': '.',
            '/': '/',
            'pageup': 'PgUp',
            'pagedown': 'PgDn',
            'home': 'Home',
            'end': 'End',
            'insert': 'Ins',
            'delete': 'Del'
        };
    }

    // NOTE: loadMappings is now handled by player.js to keep settings character-specific.

    saveMappings() {
        // NOTE: saveMappings is now handled by player.js when saving the character.
        // This function remains for any potential global settings in the future.
    }

    getMappedKey(action) {
        return this.mappings[action] || this.defaultMappings[action];
    }

    getKeyLabel(key) {
        if (!key) return '';

        if (this.keyLabels[key.toLowerCase()]) {
            return this.keyLabels[key.toLowerCase()];
        }

        if (key.length === 1) {
            return key.toLowerCase();
        }

        if (key.startsWith('f') && key.length <= 3) {
            return key.toUpperCase();
        }

        return key;
    }

    setMapping(action, key) {
        if (!action || !key) return false;

        // Prevent remapping the Settings key (Escape)
        if (action === 'settings') {
            if (typeof showNotification === 'function') {
                showNotification('Settings key (Esc) cannot be remapped', 'error');
            }
            return false;
        }

        // Prevent ANY action from being mapped to the Escape key
        if (key.toLowerCase() === 'escape') {
            if (typeof showNotification === 'function') {
                showNotification('Escape key is reserved for Settings menu', 'error');
            }
            return false;
        }

        const conflictAction = Object.keys(this.mappings).find(
            a => a !== action && this.mappings[a] === key.toLowerCase()
        );

        if (conflictAction) {
            this.mappings[conflictAction] = this.mappings[action];
        }

        this.mappings[action] = key.toLowerCase();

        // No longer need to call saveMappings() here as it's saved with the character.

        this.updateUI(); // Update the settings menu UI.

        // --- THIS IS THE FIX ---
        // Call the correct global function from ui.js to update the hotbar.
        if (typeof updateSkillHotbarUI === 'function') {
            updateSkillHotbarUI();
        }
        // --- END OF FIX ---

        return true;
    }

    resetToDefaults() {
        this.mappings = { ...this.defaultMappings };
        
        // Ensure Settings key is always locked to Escape
        this.mappings['settings'] = 'escape';
        
        this.updateUI();

        // --- THIS IS THE FIX ---
        if (typeof updateSkillHotbarUI === 'function') {
            updateSkillHotbarUI();
        }
        // --- END OF FIX ---
    }

    initializeForNewCharacter() {
        this.mappings = { ...this.defaultMappings };
        this.updateUI();

        // --- THIS IS THE FIX ---
        if (typeof updateSkillHotbarUI === 'function') {
            updateSkillHotbarUI();
        }
        // --- END OF FIX ---
    }

    // Validate and fix mappings to ensure Escape is only used for Settings
    validateMappings() {
        let fixed = false;
        
        // Find any action (other than 'settings') that's mapped to Escape
        Object.keys(this.mappings).forEach(action => {
            if (action !== 'settings' && this.mappings[action] === 'escape') {
                // Reset this action to its default
                this.mappings[action] = this.defaultMappings[action] || null;
                fixed = true;
                console.log(`[KeyMapping] Fixed: ${action} was incorrectly mapped to Escape, reset to ${this.mappings[action]}`);
            }
        });
        
        // Ensure 'settings' is always mapped to Escape
        if (this.mappings['settings'] !== 'escape') {
            this.mappings['settings'] = 'escape';
            fixed = true;
            console.log('[KeyMapping] Fixed: Settings action reset to Escape key');
        }
        
        if (fixed && typeof showNotification === 'function') {
            showNotification('Key mappings corrected - Escape reserved for Settings', 'success');
        }
        
        return fixed;
    }

    isKeyMapped(key, action) {
        return this.getMappedKey(action) === key.toLowerCase();
    }

    getActionForKey(key) {
        const lowerKey = key.toLowerCase();
        return Object.keys(this.mappings).find(action => this.mappings[action] === lowerKey);
    }

    startCapture(action) {
        // Prevent capturing for locked actions
        if (action === 'settings') {
            if (typeof showNotification === 'function') {
                showNotification('Settings key (Esc) cannot be remapped', 'error');
            }
            return;
        }

        this.isCapturing = true;
        this.capturingAction = action;

        const button = document.querySelector(`[data-action="${action}"]`);
        if (button) {
            button.textContent = 'Press any key...';
            button.classList.add('capturing');
        }

        this.captureHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            let keyToCapture = e.key;
            this.captureKey(keyToCapture);
        };

        document.addEventListener('keydown', this.captureHandler, true);

        this.captureTimeout = setTimeout(() => {
            this.stopCapture();
        }, 5000);

        document.body.style.cursor = 'crosshair';
    }

    captureKey(key) {
        if (!this.isCapturing) return;

        let keyToMap = key;
        if (key === 'Control') keyToMap = 'control';
        else if (key === 'Alt') keyToMap = 'alt';
        else if (key === 'Shift') keyToMap = 'shift';
        else if (key === 'Meta') keyToMap = 'meta';
        else if (key === 'Escape') {
            // If Escape is pressed, cancel the capture instead of mapping it
            if (typeof showNotification === 'function') {
                showNotification('Escape key is reserved for Settings menu', 'error');
            }
            this.stopCapture();
            return;
        }

        this.setMapping(this.capturingAction, keyToMap);
        this.stopCapture();
    }

    stopCapture() {
        if (!this.isCapturing) return;

        this.isCapturing = false;

        if (this.captureHandler) {
            document.removeEventListener('keydown', this.captureHandler, true);
            this.captureHandler = null;
        }

        if (this.captureTimeout) {
            clearTimeout(this.captureTimeout);
            this.captureTimeout = null;
        }

        const button = document.querySelector(`[data-action="${this.capturingAction}"]`);
        if (button) {
            button.classList.remove('capturing');
        }

        this.capturingAction = null;
        this.updateUI();
        document.body.style.cursor = '';
    }

    updateUI() {
        Object.keys(this.mappings).forEach(action => {
            const button = document.querySelector(`[data-action="${action}"]`);
            if (button && !button.classList.contains('capturing')) {
                const key = this.getMappedKey(action);
                button.textContent = this.getKeyLabel(key);
            }
        });
    }

    // --- REMOVED incorrect updateHotbarUI function ---

    createControlsUI() {
        const controlsContent = document.getElementById('settings-controls-content');
        if (!controlsContent) return;

        const actionGroups = {
            'Movement': ['move-left', 'move-right', 'move-up', 'move-down', 'jump'],
            'Combat': ['attack'],
            'Hotbar': ['hotbar-1', 'hotbar-2', 'hotbar-3', 'hotbar-4', 'hotbar-5', 'hotbar-6', 'hotbar-7', 'hotbar-8', 'hotbar-9', 'hotbar-10', 'hotbar-11', 'hotbar-12'],
            'Menus': ['inventory', 'equipment', 'skills', 'stats', 'achievements', 'bestiary', 'rankings', 'quest-log', 'quest-helper', 'world-map', 'minimap', 'pet', 'social-hub'],
            'Interaction': ['chat', 'interact', 'loot'],
            'Debug': ['hitboxes', 'gm-window']
        };

        const actionNames = {
            'move-left': 'Move Left', 'move-right': 'Move Right', 'move-up': 'Move Up', 'move-down': 'Move Down', 'jump': 'Jump',
            'attack': 'Attack', 'hotbar-1': 'Hotbar 1', 'hotbar-2': 'Hotbar 2', 'hotbar-3': 'Hotbar 3', 'hotbar-4': 'Hotbar 4',
            'hotbar-5': 'Hotbar 5', 'hotbar-6': 'Hotbar 6', 'hotbar-7': 'Hotbar 7', 'hotbar-8': 'Hotbar 8', 'hotbar-9': 'Hotbar 9',
            'hotbar-10': 'Hotbar 10', 'hotbar-11': 'Hotbar 11', 'hotbar-12': 'Hotbar 12', 'inventory': 'Inventory', 'equipment': 'Equipment',
            'skills': 'Skills', 'stats': 'Stats', 'achievements': 'Achievements', 'bestiary': 'Bestiary', 'rankings': 'Rankings', 'quest-log': 'Quest Log',
            'quest-helper': 'Quest Helper', 'world-map': 'World Map', 'minimap': 'Toggle Minimap', 'settings': 'Settings', 'chat': 'Chat', 'interact': 'Talk/NPC',
            'loot': 'Loot', 'hitboxes': 'Toggle Hitboxes', 'gm-window': 'GM Window', 'pet': 'Pet Manager', 'social-hub': 'Social Hub'
        };

        let html = '<div class="key-mapping-container">';

        Object.entries(actionGroups).forEach(([groupName, actions]) => {
            html += `<div class="key-mapping-group"><h4>${groupName}</h4><div class="key-mapping-list">`;
            actions.forEach(action => {
                const key = this.getMappedKey(action);
                const keyLabel = this.getKeyLabel(key);
                const actionName = actionNames[action] || action;
                
                // Lock the Settings key (Escape) - cannot be remapped
                const isLocked = action === 'settings';
                const lockIcon = isLocked ? ' 🔒' : '';
                const disabledAttr = isLocked ? 'disabled' : '';
                const disabledStyle = isLocked ? 'opacity: 0.5; cursor: not-allowed;' : '';
                
                html += `<div class="key-mapping-row"><span class="action-name">${actionName}${lockIcon}</span><button class="key-mapping-button" data-action="${action}" ${disabledAttr} style="${disabledStyle}">${keyLabel}</button></div>`;
            });
            html += `</div></div>`;
        });

        html += `<div class="key-mapping-controls"><button id="reset-keys-btn" class="window-content-button">Reset to Defaults</button></div></div>`;
        controlsContent.innerHTML = html;
        this.bindControlsEvents();
    }

    bindControlsEvents() {
        document.querySelectorAll('.key-mapping-button').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                if (action && !this.isCapturing) {
                    this.startCapture(action);
                }
            });
        });

        const resetBtn = document.getElementById('reset-keys-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                showConfirmation("Reset Controls", "Are you sure you want to reset all keybinds to their default settings?", "Reset", "Cancel")
                    .then(confirmed => {
                        if (confirmed) {
                            this.resetToDefaults();
                        }
                    });
            });
        }
    }
}

const keyMappingManager = new KeyMappingManager();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        keyMappingManager.createControlsUI();
        // --- THIS IS THE FIX ---
        if (typeof updateSkillHotbarUI === 'function') {
            updateSkillHotbarUI();
        }
        // --- END OF FIX ---
    });
} else {
    keyMappingManager.createControlsUI();
    // --- THIS IS THE FIX ---
    if (typeof updateSkillHotbarUI === 'function') {
        updateSkillHotbarUI();
    }
    // --- END OF FIX ---
}