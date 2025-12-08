// Accessibility and Usability Enhancement System
class AccessibilityManager {
    constructor() {
        this.settings = this.loadAccessibilitySettings();
        this.keyboardNavigation = false;
        this.screenReaderActive = false;
        this.highContrast = false;
        this.reducedMotion = false;
        this.fontSize = 1;
        this.soundEnabled = true;
        this.init();
    }

    addAccessibilityUI() {
        // Accessibility UI completely disabled
        return;
    }
    
    init() {
        this.detectAccessibilityNeeds();
        this.setupKeyboardNavigation();
        this.setupScreenReaderSupport();
        this.setupColorBlindSupport();
        this.setupMotionSettings();
        this.setupFontSizeControls();
        this.addAccessibilityUI();
    }
    
    detectAccessibilityNeeds() {
        // Detect if user prefers reduced motion
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.reducedMotion = true;
            this.settings.reducedMotion = true;
        }
        
        // Detect high contrast preference
        if (window.matchMedia && window.matchMedia('(prefers-contrast: high)').matches) {
            this.highContrast = true;
            this.settings.highContrast = true;
        }
        
        // Detect if screen reader might be present
        this.detectScreenReader();
        
        this.applySettings();
    }
    
    detectScreenReader() {
        // Check for common screen reader indicators
        const indicators = [
            navigator.userAgent.includes('NVDA'),
            navigator.userAgent.includes('JAWS'),
            navigator.userAgent.includes('VoiceOver'),
            window.speechSynthesis !== undefined,
            document.body.getAttribute('aria-live') !== null
        ];
        
        this.screenReaderActive = indicators.some(indicator => indicator);
        
        if (this.screenReaderActive) {
            this.settings.screenReader = true;
            this.settings.keyboardNavigation = true;
        }
    }
    
    setupKeyboardNavigation() {
        let focusedElement = null;
        const focusableElements = [];
        
        const updateFocusableElements = () => {
            focusableElements.splice(0);
            const selectors = [
                'button:not([disabled])',
                'input:not([disabled])',
                'select:not([disabled])',
                'textarea:not([disabled])',
                '[tabindex]:not([tabindex=\"-1\"])',
                '.window:not([style*=\"display: none\"]) .close-btn',
                '.inventory-slot:not(.empty)'
            ];
            
            selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    if (this.isElementVisible(el)) {
                        focusableElements.push(el);
                    }
                });
            });
        };
        
        const handleKeyboardNavigation = (e) => {
            if (!this.settings.keyboardNavigation) return;
            
            updateFocusableElements();
            
            if (e.key === 'Tab') {
                e.preventDefault();
                const currentIndex = focusableElements.indexOf(focusedElement);
                const nextIndex = e.shiftKey ? 
                    (currentIndex - 1 + focusableElements.length) % focusableElements.length :
                    (currentIndex + 1) % focusableElements.length;
                
                if (focusableElements[nextIndex]) {
                    this.focusElement(focusableElements[nextIndex]);
                }
            } else if (e.key === 'Enter' || e.key === ' ') {
                // Don't trigger button clicks during active gameplay
                if (typeof isGameActive !== 'undefined' && isGameActive) {
                    return;
                }
                
                if (focusedElement && focusedElement.click) {
                    e.preventDefault();
                    focusedElement.click();
                }
            } else if (e.key === 'Escape') {
                // Check if settings window is open - let main game handler deal with it
                const settingsMenu = document.getElementById('settings-menu');
                if (settingsMenu && (settingsMenu.style.display === 'block' || settingsMenu.style.display === 'flex')) {
                    // Let the main game handler toggle the settings window
                    return;
                }
                
                // Close other top-most windows
                const visibleWindows = Array.from(document.querySelectorAll('.window'))
                    .filter(w => w.style.display !== 'none' && w.id !== 'settings-menu' && w.id !== 'job-advancement-window');
                if (visibleWindows.length > 0) {
                    const topWindow = visibleWindows[visibleWindows.length - 1];
                    const closeBtn = topWindow.querySelector('.close-btn');
                    if (closeBtn) {
                        closeBtn.click();
                        // Prevent the main game handler from running since we handled the window closure
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                }
            }
        };
        
        addManagedEventListener(document, 'keydown', handleKeyboardNavigation);
        
        // Focus management
        addManagedEventListener(document, 'focusin', (e) => {
            focusedElement = e.target;
            this.announceElement(e.target);
        });
    }
    
    focusElement(element) {
        if (element && typeof element.focus === 'function') {
            element.focus();
            
            // Add visual focus indicator
            element.classList.add('keyboard-focused');
            managedSetTimeout(() => {
                element.classList.remove('keyboard-focused');
            }, 2000);
            
            // Announce to screen reader
            this.announceElement(element);
        }
    }
    
    isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return rect.width > 0 && rect.height > 0 && 
               style.visibility !== 'hidden' && 
               style.display !== 'none' &&
               element.offsetParent !== null;
    }
    
    setupScreenReaderSupport() {
        // Add ARIA labels and descriptions to game elements
        this.addAriaLabels();
        
        // Create live regions for announcements
        this.createLiveRegions();
        
        // Add game state announcements
        this.setupGameStateAnnouncements();
    }
    
    addAriaLabels() {
        // Add labels to common UI elements
        const labelMap = {
            '#inventory': 'Inventory window',
            '#equipment': 'Equipment window',
            '#skill-tree': 'Skills window',
            '#stat-window': 'Character stats window',
            '#quest-log': 'Quest log window',
            '#settings-menu': 'Settings menu',
            '#hp-bar': 'Health bar',
            '#mp-bar': 'Mana bar',
            '#exp-bar': 'Experience bar',
            '#chat-input': 'Chat input field',
            '#player-level-num': 'Player level',
            '.close-btn': 'Close window'
        };
        
        Object.entries(labelMap).forEach(([selector, label]) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (!el.getAttribute('aria-label')) {
                    el.setAttribute('aria-label', label);
                }
            });
        });
        
        // Add role attributes
        document.querySelectorAll('.window').forEach(window => {
            window.setAttribute('role', 'dialog');
            window.setAttribute('aria-modal', 'true');
        });
        
        document.querySelectorAll('.inventory-slot').forEach(slot => {
            slot.setAttribute('role', 'button');
            slot.setAttribute('tabindex', '0');
        });
    }
    
    createLiveRegions() {
        // Create polite live region for non-urgent announcements
        const politeRegion = document.createElement('div');
        politeRegion.id = 'aria-live-polite';
        politeRegion.setAttribute('aria-live', 'polite');
        politeRegion.setAttribute('aria-atomic', 'true');
        politeRegion.style.position = 'absolute';
        politeRegion.style.left = '-10000px';
        politeRegion.style.width = '1px';
        politeRegion.style.height = '1px';
        politeRegion.style.overflow = 'hidden';
        document.body.appendChild(politeRegion);
        
        // Create assertive live region for urgent announcements
        const assertiveRegion = document.createElement('div');
        assertiveRegion.id = 'aria-live-assertive';
        assertiveRegion.setAttribute('aria-live', 'assertive');
        assertiveRegion.setAttribute('aria-atomic', 'true');
        assertiveRegion.style.position = 'absolute';
        assertiveRegion.style.left = '-10000px';
        assertiveRegion.style.width = '1px';
        assertiveRegion.style.height = '1px';
        assertiveRegion.style.overflow = 'hidden';
        document.body.appendChild(assertiveRegion);
    }
    
    announce(message, priority = 'polite') {
        if (!this.settings.screenReader) return;
        
        const regionId = priority === 'assertive' ? 'aria-live-assertive' : 'aria-live-polite';
        const region = document.getElementById(regionId);
        
        if (region) {
            region.textContent = message;
            
            // Clear after announcement
            managedSetTimeout(() => {
                region.textContent = '';
            }, 1000);
        }
    }
    
    announceElement(element) {
        if (!this.settings.screenReader) return;
        
        let announcement = '';
        
        // Get element text or label
        const label = element.getAttribute('aria-label') || 
                     element.getAttribute('title') || 
                     element.textContent || 
                     element.value || '';
        
        announcement += label;
        
        // Add role information
        const role = element.getAttribute('role') || element.tagName.toLowerCase();
        if (role && role !== 'generic') {
            announcement += `, ${role}`;
        }
        
        // Add state information
        if (element.disabled) announcement += ', disabled';
        if (element.checked) announcement += ', checked';
        if (element.selected) announcement += ', selected';
        
        if (announcement.trim()) {
            this.announce(announcement);
        }
    }
    
    setupGameStateAnnouncements() {
        // Announce level ups
        if (typeof gainExp === 'function') {
            const originalGainExp = gainExp;
            gainExp = (amount) => {
                const oldLevel = player.level;
                originalGainExp(amount);
                if (player.level > oldLevel) {
                    this.announce(`Level up! You are now level ${player.level}`, 'assertive');
                }
            };
        }
        
        // Announce item pickups
        if (typeof addItemToInventory === 'function') {
            const originalAddItemToInventory = addItemToInventory;
            addItemToInventory = (item) => {
                const result = originalAddItemToInventory(item);
                if (result && this.settings.screenReader) {
                    this.announce(`Picked up ${item.name}`);
                }
                return result;
            };
        }
        
        // Announce combat results
        if (typeof showDamageNumber === 'function') {
            const originalShowDamageNumber = showDamageNumber;
            showDamageNumber = (amount, x, y, isPlayerDamage, options = {}) => {
                originalShowDamageNumber(amount, x, y, isPlayerDamage, options);
                
                if (this.settings.screenReader && this.settings.announceNumbers) {
                    if (options.isMiss) {
                        this.announce('Miss');
                    } else if (isPlayerDamage) {
                        this.announce(`You take ${Math.floor(amount)} damage`);
                    } else {
                        this.announce(`You deal ${Math.floor(amount)} damage${options.isCritical ? ' critical hit' : ''}`);
                    }
                }
            };
        }
    }
    
    setupColorBlindSupport() {
        if (this.settings.colorBlindMode) {
            this.applyColorBlindFilters();
        }
    }
    
    applyColorBlindFilters() {
        const filterMap = {
            'protanopia': 'url(#protanopia-filter)',
            'deuteranopia': 'url(#deuteranopia-filter)', 
            'tritanopia': 'url(#tritanopia-filter)',
            'high-contrast': 'contrast(1.5) saturate(1.2)'
        };
        
        const filter = filterMap[this.settings.colorBlindMode];
        if (filter) {
            document.body.style.filter = filter;
        }
        
        // Add high contrast styles
        if (this.settings.colorBlindMode === 'high-contrast' || this.settings.highContrast) {
            document.body.classList.add('high-contrast');
        }
    }
    
    setupMotionSettings() {
        if (this.settings.reducedMotion) {
            // Disable animations
            document.body.classList.add('reduced-motion');
            
            // Override animation functions
            this.overrideAnimations();
        }
    }
    
    overrideAnimations() {
        // Reduce or eliminate motion in game
        const style = document.createElement('style');
        style.textContent = `
            .reduced-motion * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
                scroll-behavior: auto !important;
            }
            
            .reduced-motion .shake,
            .reduced-motion .bounce,
            .reduced-motion .pulse {
                animation: none !important;
                transform: none !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    setupFontSizeControls() {
        if (this.settings.fontSize !== 1) {
            this.applyFontSize(this.settings.fontSize);
        }
    }
    
    applyFontSize(scale) {
        document.documentElement.style.fontSize = `${16 * scale}px`;
        this.fontSize = scale;
        this.settings.fontSize = scale;
        this.saveAccessibilitySettings();
    }
    
    addAccessibilityUI() {
        // Accessibility UI completely disabled
        return;
    }
    
    bindAccessibilityControls() {
        // Bind control event listeners
        const controls = {
            'keyboard-navigation-toggle': (checked) => {
                this.settings.keyboardNavigation = checked;
                this.saveAccessibilitySettings();
            },
            'screen-reader-toggle': (checked) => {
                this.settings.screenReader = checked;
                this.saveAccessibilitySettings();
            },
            'high-contrast-toggle': (checked) => {
                this.settings.highContrast = checked;
                this.applyColorBlindFilters();
                this.saveAccessibilitySettings();
            },
            'reduced-motion-toggle': (checked) => {
                this.settings.reducedMotion = checked;
                if (checked) {
                    this.overrideAnimations();
                    document.body.classList.add('reduced-motion');
                } else {
                    document.body.classList.remove('reduced-motion');
                }
                this.saveAccessibilitySettings();
            }
        };
        
        Object.entries(controls).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.checked = this.settings[id.replace('-toggle', '').replace('-', '')];
                element.addEventListener('change', (e) => handler(e.target.checked));
            }
        });
        
        // Font size slider
        const fontSizeSlider = document.getElementById('font-size-slider');
        if (fontSizeSlider) {
            fontSizeSlider.addEventListener('input', (e) => {
                this.applyFontSize(parseFloat(e.target.value));
            });
        }
        
        // Color blind select
        const colorBlindSelect = document.getElementById('colorblind-select');
        if (colorBlindSelect) {
            colorBlindSelect.value = this.settings.colorBlindMode || 'none';
            colorBlindSelect.addEventListener('change', (e) => {
                this.settings.colorBlindMode = e.target.value;
                this.applyColorBlindFilters();
                this.saveAccessibilitySettings();
            });
        }
    }
    
    applySettings() {
        if (this.settings.keyboardNavigation) {
            document.body.classList.add('keyboard-navigation');
        }
        
        if (this.settings.highContrast) {
            this.applyColorBlindFilters();
        }
        
        if (this.settings.reducedMotion) {
            this.overrideAnimations();
        }
        
        if (this.settings.fontSize !== 1) {
            this.applyFontSize(this.settings.fontSize);
        }
    }
    
    loadAccessibilitySettings() {
        try {
            const settings = localStorage.getItem(GAME_CONFIG.SAVE_KEY_PREFIX + 'accessibility');
            return settings ? JSON.parse(settings) : {
                keyboardNavigation: false,
                screenReader: false,
                highContrast: false,
                reducedMotion: false,
                fontSize: 1,
                colorBlindMode: 'none',
                announceNumbers: false
            };
        } catch (e) {
            return {
                keyboardNavigation: false,
                screenReader: false,
                highContrast: false,
                reducedMotion: false,
                fontSize: 1,
                colorBlindMode: 'none',
                announceNumbers: false
            };
        }
    }
    
    saveAccessibilitySettings() {
        try {
            localStorage.setItem(
                GAME_CONFIG.SAVE_KEY_PREFIX + 'accessibility', 
                JSON.stringify(this.settings)
            );
        } catch (e) {
            console.error('Failed to save accessibility settings:', e);
        }
    }
}

// Global accessibility manager
const accessibilityManager = new AccessibilityManager();

// Helper functions for other parts of the game
function announceToScreenReader(message, priority = 'polite') {
    accessibilityManager.announce(message, priority);
}

function isKeyboardNavigationEnabled() {
    return accessibilityManager.settings.keyboardNavigation;
}

function isScreenReaderActive() {
    return accessibilityManager.settings.screenReader;
}