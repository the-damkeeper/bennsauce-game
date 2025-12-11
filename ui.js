// in ui.js

// --- Global UI State & Element References ---

let activeInventoryTab = 'equip';
let selectedInventoryIndex = null;
let selectedEquipmentSlot = null;
let enhancementTarget = null;
let itemWasDestroyed = false;
let activeSkillTab = 'Beginner';
let gachaponWindowElement;
let isPaused = false; // To pause game logic when settings menu is open
let windowPositions = {}; // To store and save window locations
let currentHairIndex = 0, currentHairColorIndex = 0, currentEyeColorIndex = 0, currentSkinIndex = 0, questHelperElement;
let debugHairInfo = null;
let previewAnimationId = null, previewAnimationFrame = 0, previewAnimationTimer = 0;
let previewLastFrameTime = 0;
let previewAccumulator = 0;

// Debug border for game area visualization
let debugBorderVisible = false;
let debugBorderElement = null;

let lastHudState = {
    name: null,
    class: null,
    level: -1
};

// Activity status for presence
window.playerActivity = 'exploring';

// Update player activity status
function setPlayerActivity(activity) {
    window.playerActivity = activity;
    // Activity will be synced on next presence update
}

// =============================================
// ACCOUNT & RECOVERY CODE UI FUNCTIONS
// =============================================

function showAccountModal() {
    const modal = document.getElementById('account-modal');
    if (modal) {
        modal.style.display = 'flex';
        updateAccountModalState();
    }
}

function hideAccountModal() {
    const modal = document.getElementById('account-modal');
    if (modal) modal.style.display = 'none';
}

function showRecoveryCodeModal() {
    const modal = document.getElementById('recovery-modal');
    if (modal) {
        modal.style.display = 'flex';
        
        // Reset the recovery code display to initial state
        const recoveryCodeDisplay = document.getElementById('recovery-code-display');
        if (recoveryCodeDisplay) {
            recoveryCodeDisplay.style.display = 'none';
            recoveryCodeDisplay.innerHTML = `
                <p style="color: #f1c40f; font-weight: bold;">Your Recovery Code:</p>
                <div id="recovery-code-text" style="font-family: monospace; font-size: 20px; background: #1a1a2e; padding: 15px; border-radius: 5px; letter-spacing: 2px; text-align: center; margin: 10px 0;"></div>
                <p style="color: #e74c3c; font-size: 12px;">⚠️ WRITE THIS DOWN! You cannot recover it later!</p>
                <button onclick="copyRecoveryCode()" class="account-btn secondary">📋 Copy Code</button>
            `;
        }
        
        // Clear the input field
        const codeInput = document.getElementById('recovery-code-input');
        if (codeInput) codeInput.value = '';
        
        // Clear any errors
        clearRecoveryError();
        
        // Check if there's a stored recovery code
        const storedCode = localStorage.getItem('evergreenRPG_recoveryCode');
        const currentCodeSection = document.getElementById('current-recovery-code');
        const currentCodeDisplay = document.getElementById('current-code-display');
        
        if (storedCode && currentCodeSection && currentCodeDisplay) {
            currentCodeSection.style.display = 'block';
            currentCodeDisplay.textContent = storedCode;
        } else if (currentCodeSection) {
            currentCodeSection.style.display = 'none';
        }
    }
}

function hideRecoveryCodeModal() {
    const modal = document.getElementById('recovery-modal');
    if (modal) modal.style.display = 'none';
}

function switchAccountTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabs = document.querySelectorAll('.account-tab');
    
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'login') {
        if (loginForm) loginForm.style.display = 'flex';
        if (registerForm) registerForm.style.display = 'none';
        tabs[0]?.classList.add('active');
    } else {
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'flex';
        tabs[1]?.classList.add('active');
    }
    
    // Clear error
    const errorEl = document.getElementById('account-error');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('show');
    }
}

function showAccountError(message) {
    const errorEl = document.getElementById('account-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
}

function showRecoveryError(message) {
    const errorEl = document.getElementById('recovery-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
        errorEl.style.display = 'block';
    }
}

function clearRecoveryError() {
    const errorEl = document.getElementById('recovery-error');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('show');
        errorEl.style.display = 'none';
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    
    if (!email || !password) {
        showAccountError('Please enter email and password');
        return;
    }
    
    const result = await loginAccount(email, password);
    if (result.success) {
        updateAccountModalState();
        // Try to load cloud save
        const saves = await listCloudSaves();
        if (saves.success && saves.saves.length > 0) {
            showNotification('Cloud saves found! Check Account to load.', 'rare');
        }
    } else {
        showAccountError(result.error);
    }
}

async function handleRegister() {
    const email = document.getElementById('register-email')?.value?.trim();
    const password = document.getElementById('register-password')?.value;
    const confirmPassword = document.getElementById('register-password-confirm')?.value;
    
    if (!email || !password) {
        showAccountError('Please fill in all fields');
        return;
    }
    
    if (password !== confirmPassword) {
        showAccountError('Passwords do not match');
        return;
    }
    
    if (password.length < 6) {
        showAccountError('Password must be at least 6 characters');
        return;
    }
    
    const result = await registerAccount(email, password);
    if (result.success) {
        updateAccountModalState();
        if (result.recoveryCode) {
            showNotification('Account created! Recovery code: ' + result.recoveryCode, 'legendary');
        }
    } else {
        showAccountError(result.error);
    }
}

async function handleLogout() {
    await logoutAccount();
    updateAccountModalState();
}

async function handleSaveToCloud() {
    if (!isLoggedIn()) {
        showNotification('Must be logged in to save to cloud', 'error');
        return;
    }
    
    const result = await saveToCloud(0);
    if (result.success) {
        updateCloudSavesList();
    } else {
        showNotification(result.error, 'error');
    }
}

async function handleLoadFromCloud(characterNameOrSlot) {
    const result = await loadFromCloud(characterNameOrSlot);
    if (result.success && result.characterData) {
        // The character is now saved to local storage by loadFromCloud
        // Refresh the character selection screen to show it
        hideAccountModal();
        showNotification('Character loaded from cloud! Select it from the list.', 'legendary');
        
        // Refresh the character selection screen
        if (typeof showCharacterSelection === 'function') {
            showCharacterSelection();
        }
    } else {
        showNotification(result.error || 'Failed to load', 'error');
    }
}

async function handleCreateRecoveryCode() {
    clearRecoveryError();
    
    // Check if we have a loaded character OR local saved characters
    const localCharacters = typeof getSavedCharacters === 'function' ? getSavedCharacters() : {};
    const characterNames = Object.keys(localCharacters);
    
    // If player is loaded and has a name, use that
    if (player && player.name) {
        const result = await createRecoveryCode();
        if (result.success) {
            const display = document.getElementById('recovery-code-display');
            const codeText = document.getElementById('recovery-code-text');
            
            if (display && codeText) {
                codeText.textContent = result.code;
                display.style.display = 'block';
            }
            
            // Update current code display
            const currentCodeSection = document.getElementById('current-recovery-code');
            const currentCodeDisplay = document.getElementById('current-code-display');
            if (currentCodeSection && currentCodeDisplay) {
                currentCodeSection.style.display = 'block';
                currentCodeDisplay.textContent = result.code;
            }
        } else {
            showRecoveryError(result.error);
        }
        return;
    }
    
    // No character loaded - check for local characters
    if (characterNames.length === 0) {
        showRecoveryError('No characters found. Create a character first!');
        return;
    }
    
    // If only one character, use that
    if (characterNames.length === 1) {
        const charData = localCharacters[characterNames[0]];
        const result = await createRecoveryCodeForCharacter(charData);
        if (result.success) {
            const display = document.getElementById('recovery-code-display');
            const codeText = document.getElementById('recovery-code-text');
            
            if (display && codeText) {
                codeText.textContent = result.code;
                display.style.display = 'block';
            }
            showNotification(`Recovery code created for ${characterNames[0]}!`, 'legendary');
        } else {
            showRecoveryError(result.error);
        }
        return;
    }
    
    // Multiple characters - show selection
    const charList = characterNames.map(name => {
        const char = localCharacters[name];
        return `<div class="recovery-char-option" onclick="selectCharacterForRecovery('${name.replace(/'/g, "\\'")}')">
            <strong>${name}</strong> - Lvl ${char.level || 1} ${char.class || 'Beginner'}
        </div>`;
    }).join('');
    
    showRecoveryError('');
    const display = document.getElementById('recovery-code-display');
    if (display) {
        display.innerHTML = `
            <p style="color: #f1c40f; margin-bottom: 10px;">Select a character to backup:</p>
            <div style="max-height: 150px; overflow-y: auto;">${charList}</div>
        `;
        display.style.display = 'block';
    }
}

async function selectCharacterForRecovery(characterName) {
    const localCharacters = typeof getSavedCharacters === 'function' ? getSavedCharacters() : {};
    const charData = localCharacters[characterName];
    
    if (!charData) {
        showRecoveryError('Character not found');
        return;
    }
    
    const result = await createRecoveryCodeForCharacter(charData);
    if (result.success) {
        const display = document.getElementById('recovery-code-display');
        const codeText = document.getElementById('recovery-code-text');
        
        if (display) {
            display.innerHTML = `
                <p style="color: #f1c40f; font-weight: bold;">Your Recovery Code:</p>
                <div id="recovery-code-text" style="font-family: monospace; font-size: 20px; background: #1a1a2e; padding: 15px; border-radius: 5px; letter-spacing: 2px; text-align: center; margin: 10px 0;">${result.code}</div>
                <p style="color: #e74c3c; font-size: 12px;">⚠️ WRITE THIS DOWN! You cannot recover it later!</p>
                <button onclick="copyRecoveryCode()" class="account-btn secondary">📋 Copy Code</button>
            `;
            display.style.display = 'block';
        }
        
        // Update current code display
        const currentCodeSection = document.getElementById('current-recovery-code');
        const currentCodeDisplay = document.getElementById('current-code-display');
        if (currentCodeSection && currentCodeDisplay) {
            currentCodeSection.style.display = 'block';
            currentCodeDisplay.textContent = result.code;
        }
        
        showNotification(`Recovery code created for ${characterName}!`, 'legendary');
    } else {
        showRecoveryError(result.error);
    }
}

// Make selectCharacterForRecovery globally available
window.selectCharacterForRecovery = selectCharacterForRecovery;

async function handleUpdateRecoveryCode() {
    clearRecoveryError();
    
    const storedCode = localStorage.getItem('evergreenRPG_recoveryCode');
    if (!storedCode) {
        showRecoveryError('No recovery code found');
        return;
    }
    
    const result = await updateRecoveryCode(storedCode);
    if (result.success) {
        showNotification('Recovery code updated!', 'rare');
    } else {
        showRecoveryError(result.error);
    }
}

async function handleLoadFromRecoveryCode() {
    clearRecoveryError();
    
    const codeInput = document.getElementById('recovery-code-input');
    const code = codeInput?.value?.trim();
    
    if (!code) {
        showRecoveryError('Please enter a recovery code');
        return;
    }
    
    const result = await loadFromRecoveryCode(code);
    if (result.success && result.characterData) {
        const charData = result.characterData;
        const charName = charData.name || 'RecoveredCharacter';
        
        // Ensure required fields have defaults (recovery codes may be from older saves)
        if (charData.x === undefined || charData.x === null) charData.x = 300;
        if (charData.y === undefined || charData.y === null) charData.y = 0;
        
        // Save the character to local storage so it appears in character selection
        if (typeof getSavedCharacters === 'function' && typeof saveManager !== 'undefined') {
            const characters = getSavedCharacters();
            characters[charName] = charData;
            saveManager.saveCharacters(characters);
            console.log(`Saved recovered character "${charName}" to local storage`);
        }
        
        hideRecoveryCodeModal();
        
        // Update current code display
        const currentCodeSection = document.getElementById('current-recovery-code');
        const currentCodeDisplay = document.getElementById('current-code-display');
        if (currentCodeSection && currentCodeDisplay) {
            currentCodeSection.style.display = 'block';
            currentCodeDisplay.textContent = code.toUpperCase().replace(/\s/g, '');
        }
        
        showNotification(`Character "${charName}" recovered! Select it from the list.`, 'legendary');
        
        // Refresh the character selection screen to show the recovered character
        if (typeof showCharacterSelection === 'function') {
            showCharacterSelection();
            
            // Show a success message under the character list
            setTimeout(() => {
                const charList = document.getElementById('character-list');
                if (charList) {
                    // Remove any existing restore message
                    const existingMsg = document.getElementById('restore-success-message');
                    if (existingMsg) existingMsg.remove();
                    
                    // Add new restore message
                    const successMsg = document.createElement('div');
                    successMsg.id = 'restore-success-message';
                    successMsg.style.cssText = 'text-align: center; padding: 12px; margin-top: 15px; background: linear-gradient(135deg, rgba(46, 204, 113, 0.3) 0%, rgba(39, 174, 96, 0.3) 100%); border: 2px solid #2ecc71; border-radius: 8px; color: #2ecc71; font-weight: bold; animation: pulse 1s ease-in-out;';
                    successMsg.innerHTML = `✓ <span style="color: #f1c40f;">${charName}</span> successfully restored!`;
                    charList.parentNode.insertBefore(successMsg, charList.nextSibling);
                    
                    // Remove message after 5 seconds
                    setTimeout(() => {
                        if (successMsg.parentNode) {
                            successMsg.style.transition = 'opacity 0.5s';
                            successMsg.style.opacity = '0';
                            setTimeout(() => successMsg.remove(), 500);
                        }
                    }, 5000);
                }
            }, 100);
        }
    } else {
        showRecoveryError(result.error || 'Invalid recovery code');
    }
}

function copyRecoveryCode() {
    const codeText = document.getElementById('recovery-code-text')?.textContent;
    if (codeText) {
        navigator.clipboard.writeText(codeText).then(() => {
            showNotification('Recovery code copied!', 'rare');
        }).catch(() => {
            showNotification('Failed to copy', 'error');
        });
    }
}

/**
 * Show a popup message when a character name is already taken
 */
function showNameTakenMessage(name) {
    const creationScreen = document.getElementById('character-creation');
    if (!creationScreen) return;
    
    // Remove any existing message
    const existingMsg = document.getElementById('name-taken-message');
    if (existingMsg) existingMsg.remove();
    
    // Create a proper modal popup using game-modal style
    const messageDiv = document.createElement('div');
    messageDiv.id = 'name-taken-message';
    messageDiv.className = 'game-modal';
    messageDiv.innerHTML = `
        <div class="game-modal-title">
            <span>Name Unavailable</span>
        </div>
        <div class="game-modal-content">
            <p>The name "<strong style="color: var(--exp-color);">${name}</strong>" is already taken by another player.</p>
            <p style="color: #95a5a6; margin-top: 8px;">Please choose a different name.</p>
        </div>
        <div class="game-modal-buttons">
            <button class="game-btn primary" onclick="closeNameTakenMessage()">OK</button>
        </div>
    `;
    
    document.body.appendChild(messageDiv);
    
    // Focus the name input when closed
    const nameInput = document.getElementById('character-name');
    if (nameInput) {
        nameInput.classList.add('input-error');
    }
}

function closeNameTakenMessage() {
    const msg = document.getElementById('name-taken-message');
    if (msg) {
        msg.style.animation = 'modalFadeOut 0.2s ease-out';
        setTimeout(() => msg.remove(), 200);
    }
    
    // Remove error highlight from input and focus it
    const nameInput = document.getElementById('character-name');
    if (nameInput) {
        nameInput.classList.remove('input-error');
        nameInput.focus();
        nameInput.select();
    }
}

// Make closeNameTakenMessage globally available
window.closeNameTakenMessage = closeNameTakenMessage;

function updateAccountModalState() {
    const loggedOutSection = document.getElementById('account-logged-out');
    const loggedInSection = document.getElementById('account-logged-in');
    const emailDisplay = document.getElementById('account-email');
    
    if (isLoggedIn()) {
        if (loggedOutSection) loggedOutSection.style.display = 'none';
        if (loggedInSection) loggedInSection.style.display = 'block';
        if (emailDisplay && currentUser) {
            emailDisplay.textContent = currentUser.email || 'Guest';
        }
        updateCloudSavesList();
    } else {
        if (loggedOutSection) loggedOutSection.style.display = 'block';
        if (loggedInSection) loggedInSection.style.display = 'none';
    }
    
    // Clear error
    const errorEl = document.getElementById('account-error');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('show');
    }
}

async function updateCloudSavesList() {
    const listEl = document.getElementById('cloud-saves-list');
    if (!listEl) return;
    
    const result = await listCloudSaves();
    
    if (!result.success || result.saves.length === 0) {
        listEl.innerHTML = '<p style="color: #7f8c8d; font-size: 12px;">No cloud saves found. Your local characters will be synced automatically.</p>';
        return;
    }
    
    listEl.innerHTML = result.saves.map(save => {
        const date = save.lastUpdated ? save.lastUpdated.toLocaleDateString() : 'Unknown';
        const charName = save.name || save.id || 'Unknown';
        // Escape the character name for use in onclick
        const escapedName = charName.replace(/'/g, "\\'").replace(/"/g, '\\"');
        return `
            <div class="cloud-save-item">
                <div class="cloud-save-info">
                    <div class="cloud-save-name">${charName}</div>
                    <div class="cloud-save-details">Lvl ${save.level || 1} ${save.class || 'Beginner'} • ${date}</div>
                </div>
                <button onclick="handleLoadFromCloud('${escapedName}')" class="account-btn" style="padding: 5px 10px; font-size: 12px;">Load</button>
            </div>
        `;
    }).join('');
}

// Make functions globally available
window.showAccountModal = showAccountModal;
window.hideAccountModal = hideAccountModal;
window.showRecoveryCodeModal = showRecoveryCodeModal;
window.hideRecoveryCodeModal = hideRecoveryCodeModal;
window.switchAccountTab = switchAccountTab;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.handleSaveToCloud = handleSaveToCloud;
window.handleLoadFromCloud = handleLoadFromCloud;
window.handleCreateRecoveryCode = handleCreateRecoveryCode;
window.handleUpdateRecoveryCode = handleUpdateRecoveryCode;
window.handleLoadFromRecoveryCode = handleLoadFromRecoveryCode;
window.copyRecoveryCode = copyRecoveryCode;

// =============================================
// END ACCOUNT UI FUNCTIONS
// =============================================

// Party Overlay - shows party members under minimap with same-map indicator
let partyOverlayDragging = false;
let partyOverlayUserMoved = false;

function updatePartyOverlay() {
    const overlay = document.getElementById('party-overlay');
    const membersContainer = document.getElementById('party-overlay-members');
    if (!overlay || !membersContainer) return;
    
    // Get party info
    const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : { inParty: false, members: [], leader: null, partyId: null };
    
    if (!partyInfo.inParty) {
        overlay.style.display = 'none';
        return;
    }
    
    // Get party members from onlinePlayers (same way party tab does it)
    const allOnlinePlayers = typeof getOnlinePlayers === 'function' ? getOnlinePlayers() : [];
    const partyMembers = allOnlinePlayers.filter(p => p.partyId === partyInfo.partyId);
    
    // Need at least 1 other member (yourself is always in party)
    if (partyMembers.length === 0) {
        overlay.style.display = 'none';
        return;
    }
    
    // Show overlay
    overlay.style.display = 'block';
    
    // Only auto-position if user hasn't moved it
    if (!partyOverlayUserMoved) {
        const minimapContainer = document.getElementById('minimap-container');
        if (minimapContainer && minimapContainer.style.display === 'block') {
            const minimapRect = minimapContainer.getBoundingClientRect();
            overlay.style.top = (minimapRect.bottom + 5) + 'px';
            overlay.style.left = minimapRect.left + 'px';
            overlay.style.width = minimapContainer.offsetWidth + 'px';
        }
    }
    
    const myMap = player?.currentMapId;
    
    // Get socket-synced party stats
    const partyStats = window.partyMemberStats || {};
    
    // Build members list - start with yourself
    let html = '';
    const isLeader = partyInfo.leader === player?.name;
    
    // Calculate HP and EXP percentages for yourself
    const myHpPct = player ? Math.round((player.hp / player.maxHp) * 100) : 100;
    const myExpPct = player ? Math.round((player.exp / player.maxExp) * 100) : 0;
    const myHpLow = myHpPct < 30;
    
    // Add yourself first
    html += `
        <div class="party-overlay-member same-map">
            <div class="member-info">
                ${isLeader ? '<span class="leader-crown">👑</span>' : ''}
                <span class="member-name">${player?.name} (You)</span>
                <span class="member-level">Lv.${player?.level || 1}</span>
            </div>
            <div class="member-bars">
                <div class="member-bar hp-bar ${myHpLow ? 'low' : ''}">
                    <div class="member-bar-fill" style="width: ${myHpPct}%"></div>
                </div>
                <div class="member-bar exp-bar">
                    <div class="member-bar-fill" style="width: ${myExpPct}%"></div>
                </div>
            </div>
        </div>
    `;
    
    // Add other party members
    for (const member of partyMembers) {
        const memberIsLeader = member.playerName === partyInfo.leader;
        const memberMapId = member.currentMap;
        const isSameMap = memberMapId === myMap;
        const mapClass = isSameMap ? 'same-map' : 'different-map';
        
        // Get real-time stats from socket if available, otherwise use presence data
        const memberOdId = Object.keys(partyStats).find(id => partyStats[id].name === member.playerName);
        const stats = memberOdId ? partyStats[memberOdId] : null;
        
        // Use socket stats if recent (within 10 seconds), otherwise show unknown
        const statsRecent = stats && (Date.now() - stats.lastUpdate < 10000);
        const hpPct = statsRecent ? Math.round((stats.hp / stats.maxHp) * 100) : 100;
        const expPct = statsRecent ? Math.round((stats.exp / stats.maxExp) * 100) : 0;
        const level = statsRecent ? stats.level : member.level || '?';
        const hpLow = hpPct < 30;
        
        html += `
            <div class="party-overlay-member ${mapClass}">
                <div class="member-info">
                    ${memberIsLeader ? '<span class="leader-crown">👑</span>' : ''}
                    <span class="member-name">${member.playerName}</span>
                    <span class="member-level">Lv.${level}</span>
                </div>
                ${isSameMap ? `
                    <div class="member-bars">
                        <div class="member-bar hp-bar ${hpLow ? 'low' : ''}">
                            <div class="member-bar-fill" style="width: ${hpPct}%"></div>
                        </div>
                        <div class="member-bar exp-bar">
                            <div class="member-bar-fill" style="width: ${expPct}%"></div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    membersContainer.innerHTML = html;
}

// Setup party overlay dragging
function setupPartyOverlayDrag() {
    const overlay = document.getElementById('party-overlay');
    const header = document.getElementById('party-overlay-header');
    if (!overlay || !header) return;
    
    let dragOffsetX = 0, dragOffsetY = 0;
    
    header.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left mouse button
        
        partyOverlayDragging = true;
        partyOverlayUserMoved = true;
        
        const scalingContainer = document.getElementById('scaling-container');
        if (!scalingContainer) return;
        
        const parentRect = scalingContainer.getBoundingClientRect();
        const scale = window.gameScale || (parentRect.width / scalingContainer.offsetWidth);
        
        // Convert mouse position to un-scaled coordinate space
        const mouseXInParent = (e.clientX - parentRect.left) / scale;
        const mouseYInParent = (e.clientY - parentRect.top) / scale;
        
        dragOffsetX = mouseXInParent - overlay.offsetLeft;
        dragOffsetY = mouseYInParent - overlay.offsetTop;
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!partyOverlayDragging) return;
        
        const scalingContainer = document.getElementById('scaling-container');
        if (!scalingContainer) return;
        
        const parentRect = scalingContainer.getBoundingClientRect();
        const scale = window.gameScale || (parentRect.width / scalingContainer.offsetWidth);
        
        // Convert mouse position to un-scaled coordinate space
        const mouseXInParent = (e.clientX - parentRect.left) / scale;
        const mouseYInParent = (e.clientY - parentRect.top) / scale;
        
        // Calculate new position
        let newX = mouseXInParent - dragOffsetX;
        let newY = mouseYInParent - dragOffsetY;
        
        // Clamp within the un-scaled boundaries
        const minX = 0;
        const minY = 0;
        const maxX = scalingContainer.offsetWidth - overlay.offsetWidth;
        const maxY = scalingContainer.offsetHeight - overlay.offsetHeight;
        
        newX = Math.max(minX, Math.min(newX, maxX));
        newY = Math.max(minY, Math.min(newY, maxY));
        
        overlay.style.left = `${newX}px`;
        overlay.style.top = `${newY}px`;
    });
    
    document.addEventListener('mouseup', () => {
        partyOverlayDragging = false;
    });
}

// Initialize drag on load
document.addEventListener('DOMContentLoaded', setupPartyOverlayDrag);

// Expose to window for external calls
window.updatePartyOverlay = updatePartyOverlay;

// Update party overlay periodically
setInterval(updatePartyOverlay, 2000);

// --- Core UI Management ---

// Helper function to format gold with coin icon
function formatGold(amount) {
    return `<span style="display: inline-flex; align-items: center; gap: 3px;"><span style="display: inline-block; width: 14px; height: 14px; overflow: hidden; vertical-align: middle; image-rendering: pixelated;"><img src="${artAssets.coin}" style="display: block; width: 56px; height: 14px; margin-left: 0px; image-rendering: pixelated;"></span>${amount.toLocaleString()}</span>`;
}

// in ui.js (add this near the top)
function hexToRgb(hex) {
    if (!hex) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// in ui.js
function logDragDebugInfo(eventName, element, boundaryCalcs = null) {
    console.group(`--- Drag Debug Info: ${eventName} ---`);

    const gameContainer = document.getElementById('game-container');
    const scalingContainer = document.getElementById('scaling-container');

    function logElementInfo(name, el) {
        if (!el) {
            console.log(`%c${name}: Not Found`, 'color: red;');
            return;
        }
        console.log(`%c${name}:`, 'font-weight: bold; color: cyan;', el);
        console.table({
            'getBoundingClientRect': el.getBoundingClientRect(),
            'offsetWidth/Height': `${el.offsetWidth} x ${el.offsetHeight}`,
            'offsetLeft/Top': `${el.offsetLeft} x ${el.offsetTop}`,
            'position': window.getComputedStyle(el).position,
            'transform': window.getComputedStyle(el).transform
        });
    }

    logElementInfo('Window Being Dragged', element);
    logElementInfo('Playable Area (scaling-container)', scalingContainer);
    logElementInfo('Main Container (game-container)', gameContainer);

    console.log(`%cCurrent Game Scale (window.gameScale):`, 'font-weight: bold; color: yellow;', window.gameScale || 'Not Set');

    if (boundaryCalcs) {
        console.log('%cCalculated Drag Boundaries:', 'font-weight: bold; color: limegreen;');
        console.table(boundaryCalcs);
    }

    console.groupEnd();
}

// in ui.js
let debugBoundsVisible = false;
let debugBoundsElement = null;

function toggleDebugBounds() {
    if (!debugBoundsElement) {
        debugBoundsElement = document.createElement('div');
        debugBoundsElement.id = 'debug-drag-bounds';
        debugBoundsElement.style.cssText = `
            position: fixed;
            border: 3px dotted limegreen;
            pointer-events: none;
            z-index: 99999;
            box-sizing: border-box;
            display: none;
        `;
        document.body.appendChild(debugBoundsElement);
    }
    debugBoundsVisible = !debugBoundsVisible;
    if (!debugBoundsVisible && debugBoundsElement) {
        debugBoundsElement.style.display = 'none';
    }
    console.log('Debug drag bounds visualizer:', debugBoundsVisible ? 'Enabled' : 'Disabled');
}

function toggleDebugBorder() {
    if (!debugBorderElement) {
        // Create the debug border element
        debugBorderElement = document.createElement('div');
        debugBorderElement.id = 'debug-game-area-border';
        debugBorderElement.style.cssText = `
            position: fixed;
            border: 2px solid red;
            pointer-events: none;
            z-index: 9999;
            box-sizing: border-box;
        `;
        document.body.appendChild(debugBorderElement);
    }

    debugBorderVisible = !debugBorderVisible;

    if (debugBorderVisible) {
        // Update border position and size to match the scaling-container (playable area)
        const scalingContainer = document.getElementById('scaling-container');
        if (scalingContainer) {
            const rect = scalingContainer.getBoundingClientRect();
            const shadowInset = 30; // Match the shadow inset used in drag bounds
            debugBorderElement.style.left = (rect.left + shadowInset) + 'px';
            debugBorderElement.style.top = (rect.top + shadowInset) + 'px';
            debugBorderElement.style.width = (rect.width - 2 * shadowInset) + 'px';
            debugBorderElement.style.height = (rect.height - 2 * shadowInset) + 'px';
            debugBorderElement.style.display = 'block';
        }
    } else {
        debugBorderElement.style.display = 'none';
    }

    console.log('Debug playable area border:', debugBorderVisible ? 'shown' : 'hidden');
}

function toggleBgm() {
    if (bgmVolume > 0) {
        lastBgmVolume = bgmVolume;
        bgmVolume = 0;
    } else {
        bgmVolume = lastBgmVolume > 0 ? lastBgmVolume : 0.3;
    }
    if (typeof applyAudioSettings === 'function') {
        applyAudioSettings();
    }
}

function toggleSfx() {
    if (sfxVolume > 0) {
        lastSfxVolume = sfxVolume;
        sfxVolume = 0;
    } else {
        sfxVolume = lastSfxVolume > 0 ? lastSfxVolume : 0.5;
    }
    if (typeof applyAudioSettings === 'function') {
        applyAudioSettings();
    }
}

// Add debug key listener
document.addEventListener('keydown', (e) => {
    if (!e.key) return;
    if (e.key.toLowerCase() === 'h') {
        // Don't trigger if user is typing in an input field or chatting
        const activeEl = document.activeElement.tagName.toUpperCase();
        if (activeEl === 'INPUT' || activeEl === 'TEXTAREA' || activeEl === 'SELECT') {
            return;
        }
        
        toggleDebugBorder();
        toggleDebugBounds();
    }
});

// capitalize() and classColors are defined in network.js (which loads first)
// They are available globally via window.capitalize and window.classColors

/**
 * Returns a fallback class icon (emoji-based) when sprite data is unavailable
 */
function getClassIcon(className) {
    const classEmojis = {
        'beginner': '🌱',
        'warrior': '⚔️',
        'magician': '🔮',
        'bowman': '🏹',
        'thief': '🗡️',
        'pirate': '🔫',
        'fighter': '⚔️',
        'spearman': '🔱',
        'cleric': '✨',
        'wizard': '🔥',
        'hunter': '🏹',
        'crossbowman': '🎯',
        'assassin': '🌙',
        'bandit': '💀',
        'brawler': '👊',
        'gunslinger': '🔫'
    };
    const emoji = classEmojis[className?.toLowerCase()] || '❓';
    return `<div style="font-size: 48px; line-height: 1;">${emoji}</div>`;
}

function makeWindowDraggable(element, headerElement) {
    if (!element) return;

    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const header = headerElement || element.querySelector('.window-header') || element.querySelector('.window-title');
    if (!header) return;

    header.style.cursor = 'move';
    header.addEventListener('mousedown', startDrag);

    function startDrag(e) {
        if (e.button !== 0) return; // Only for left mouse button
        
        // Don't start drag if clicking on close button
        if (e.target.classList.contains('close-btn')) return;

        isDragging = true;
        const scalingContainer = document.getElementById('scaling-container');
        if (!scalingContainer) return;

        const parentRect = scalingContainer.getBoundingClientRect();
        const scale = window.gameScale || (parentRect.width / scalingContainer.offsetWidth);
        const elemRect = element.getBoundingClientRect();

        // --- THE REAL FIX: CONVERT ALL COORDINATES ---

        // 1. If the element is centered with transform, we first convert its visual
        //    position into a permanent, pixel-based absolute position.
        if (window.getComputedStyle(element).transform !== 'none') {
            // Convert viewport position (elemRect) to a position relative to the scaled container
            const initialLeft = (elemRect.left - parentRect.left) / scale;
            const initialTop = (elemRect.top - parentRect.top) / scale;

            // Apply this new pixel-based position and remove the transform
            element.style.left = `${initialLeft}px`;
            element.style.top = `${initialTop}px`;
            element.style.transform = 'none';
        }

        // 2. Calculate the mouse's offset from the element's corner, all within the UN-SCALED coordinate space.
        const mouseXInParent = (e.clientX - parentRect.left) / scale;
        const mouseYInParent = (e.clientY - parentRect.top) / scale;

        dragOffsetX = mouseXInParent - element.offsetLeft;
        dragOffsetY = mouseYInParent - element.offsetTop;

        // --- END OF FIX ---

        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    }

    function drag(e) {
        if (!isDragging) return;

        const scalingContainer = document.getElementById('scaling-container');
        if (!scalingContainer) return;

        const parentRect = scalingContainer.getBoundingClientRect();
        const scale = window.gameScale || (parentRect.width / scalingContainer.offsetWidth);

        // Convert the current mouse position to the un-scaled coordinate space
        const mouseXInParent = (e.clientX - parentRect.left) / scale;
        const mouseYInParent = (e.clientY - parentRect.top) / scale;

        // Calculate the element's new top-left position in the un-scaled space
        let newX = mouseXInParent - dragOffsetX;
        let newY = mouseYInParent - dragOffsetY;

        // Clamp the position within the UN-SCALED boundaries of the parent
        const minX = 0;
        const minY = 0;
        const maxX = scalingContainer.offsetWidth - element.offsetWidth;
        const maxY = scalingContainer.offsetHeight - element.offsetHeight;

        newX = Math.max(minX, Math.min(newX, maxX));
        newY = Math.max(minY, Math.min(newY, maxY));

        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);

        // The saved positions are now correct, un-scaled pixel values
        if (windowPositions) {
            windowPositions[element.id] = { left: element.style.left, top: element.style.top };
            localStorage.setItem('evergreenRPG_windowPositions', JSON.stringify(windowPositions));
        }
    }
}

/**
 * Ensures a window is open and optionally runs its update function.
 * If the window is already open, it just runs the update function.
 * @param {HTMLElement} element - The window element to open.
 * @param {function} [updateFunction] - The function to call to refresh the window's content.
 */
function openWindow(element, updateFunction) {
    const isVisible = element.style.display === 'block' || element.style.display === 'flex';
    if (!isVisible) {
        // Only toggle if it's currently closed.
        toggleWindow(element, updateFunction);
    } else if (updateFunction) {
        // If it's already open, just run the update function.
        updateFunction();
    }
}

// in ui.js
function toggleWindow(element, updateFunction) {
    hideTooltip();
    const isVisible = element.style.display === 'block' || element.style.display === 'flex';

    // Determine the correct display type based on the element's ID
    let displayType = 'block';
    // --- THIS IS THE FIX ---
    // Added 'job-advancement-window' to the list of windows that use 'display: flex'
    if (['world-map-window', 'character-selection-screen', 'character-creation', 'job-advancement-window'].includes(element.id)) {
        displayType = 'flex';
    }
    // --- END OF FIX ---

    console.log(`[UI Debug] toggleWindow(${element.id}): isVisible=${isVisible}, willBe=${isVisible ? 'none' : displayType}`);
    element.style.display = isVisible ? 'none' : displayType;
    console.log(`[UI Debug] After toggle: ${element.id}.style.display = ${element.style.display}`);

    // Track tutorial actions for Equipment Basics quest
    if (!isVisible) {
        if (element.id === 'inventory' && typeof trackTutorialAction === 'function') {
            trackTutorialAction('openInventory');
        } else if (element.id === 'equipment' && typeof trackTutorialAction === 'function') {
            trackTutorialAction('openEquipment');
        }
    }

    // Clear gamepad selections when closing windows
    if (isVisible && typeof gamepadManager !== 'undefined' && gamepadManager) {
        element.querySelectorAll('.gamepad-selected').forEach(el => {
            el.classList.remove('gamepad-selected');
        });
        console.log('[UI] Cleared gamepad selections from', element.id);
    }
    
    // Cleanup event listeners when closing window
    if (isVisible && typeof eventManager !== 'undefined') {
        eventManager.cleanupWindow(element.id);
        console.log(`[EventManager] Cleaned up listeners for ${element.id}`);
    }

    // Pause game logic if the settings menu is opened
    if (element.id === 'settings-menu') {
        isPaused = !isVisible;
        
        // When opening settings, ensure proper tab state
        if (!isVisible) {
            // Reset to default state: show controls tab, hide others
            const settingsContent = document.getElementById('settings-content');
            if (settingsContent) {
                // Reset all tab buttons
                settingsContent.querySelectorAll('.tab-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Reset all tab content visibility
                settingsContent.querySelectorAll('.tab-content').forEach(content => {
                    content.style.display = 'none';
                    content.classList.remove('active');
                });
                
                // Activate the appropriate default tab based on gamepad connection
                const useGamepadMode = typeof gamepadManager !== 'undefined' && 
                                      gamepadManager && 
                                      gamepadManager.isConnected() && 
                                      !gamepadManager.forceKeyboardMode;
                
                if (useGamepadMode) {
                    // Show gamepad tab
                    const gamepadBtn = settingsContent.querySelector('[data-tab="gamepad"]');
                    const gamepadContent = document.getElementById('settings-gamepad-content');
                    if (gamepadBtn) gamepadBtn.classList.add('active');
                    if (gamepadContent) {
                        gamepadContent.style.display = 'block';
                        gamepadContent.classList.add('active');
                    }
                    updateGamepadDetailedUI();
                } else {
                    // Show keyboard controls tab (default)
                    const controlsBtn = settingsContent.querySelector('[data-tab="controls"]');
                    const controlsContent = document.getElementById('settings-controls-content');
                    if (controlsBtn) controlsBtn.classList.add('active');
                    if (controlsContent) {
                        controlsContent.style.display = 'block';
                        controlsContent.classList.add('active');
                    }
                }
                
                // Update gamepad settings UI if controls tab is shown
                if (typeof updateGamepadSettingsUI === 'function') {
                    updateGamepadSettingsUI();
                }
            }
        }
    }

    // If opening the window, call its specific update function
    if (!isVisible && updateFunction) {
        updateFunction();
    }
    // Deselect inventory item when closing the inventory window
    if (element.id === 'inventory' && isVisible) {
        selectedInventoryIndex = null;
    }

    // Reset enhancement flags when closing the enhancement modal
    if (element.id === 'enhancement-confirm-modal' && isVisible) {
        itemWasDestroyed = false;
        enhancementTarget = null;
        // Show the buttons again when closing
        const confirmButtons = document.getElementById('enhancement-confirm-buttons');
        if (confirmButtons) {
            confirmButtons.style.display = 'flex';
        }
    }
}

function formatTimePlayed(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds < 0) {
        return "00:00";
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');

    if (hours > 0) {
        const paddedHours = String(hours).padStart(2, '0');
        return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
    } else {
        return `${paddedMinutes}:${paddedSeconds}`;
    }
}

function setupMinimapResize() {
    const minimapContainer = document.getElementById('minimap-container');
    const minimapContentDiv = document.getElementById('minimap');
    const resizeHandle = document.getElementById('minimap-resize-handle');
    const scalingContainer = document.getElementById('scaling-container');

    const MIN_WIDTH = 100;
    const MAX_WIDTH = 500;

    resizeHandle.addEventListener('mousedown', function (e) {
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = minimapContainer.offsetWidth;

        // Account for the game's overall scale
        const containerRect = scalingContainer.getBoundingClientRect();
        const scale = containerRect.width / scalingContainer.offsetWidth;
        
        // Get current map's aspect ratio
        const map = maps[currentMapId];
        const mapWidth = map ? map.width : 1000;
        const mapHeight = map ? (map.height || 480) : 480;
        const mapAspectRatio = mapHeight / mapWidth;

        function doDrag(e) {
            const dx = (e.clientX - startX) / scale;
            let newWidth = startWidth + dx;

            // Clamp the width between min and max values
            newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH));

            // Use the current map's aspect ratio
            const newHeight = newWidth * mapAspectRatio;

            minimapContainer.style.width = newWidth + 'px';
            minimapContentDiv.style.height = newHeight + 'px';
            updateMiniMap();
        }

        function stopDrag() {
            // Save the final width to localStorage (height will be recalculated per map)
            localStorage.setItem('evergreenRPG_minimapWidth', minimapContainer.style.width);

            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        }

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    });
}

/**
 * Displays a custom in-game confirmation modal.
 * @param {string} title - The text for the window's title bar.
 * @param {string} text - The main message to display.
 * @param {string} [confirmText='Confirm'] - The text for the confirmation button.
 * @param {string} [cancelText='Cancel'] - The text for the cancellation button.
 * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false otherwise.
 */
function showConfirmation(title, text, confirmText = 'Confirm', cancelText = 'Cancel') {
    const modal = document.getElementById('confirmation-modal');
    const titleEl = document.getElementById('confirmation-title');
    const textEl = document.getElementById('confirmation-message');
    const confirmBtn = document.getElementById('confirm-action-btn');
    const cancelBtn = document.getElementById('cancel-action-btn');
    const closeBtn = modal.querySelector('.close-btn');

    titleEl.textContent = title;
    textEl.innerHTML = text;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    modal.style.display = 'block';

    return new Promise((resolve) => {
        const cleanup = () => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            closeBtn.removeEventListener('click', onClose);
        };

        const onConfirm = () => {
            cleanup();
            resolve(true);
        };

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        const onClose = () => {
            cleanup();
            resolve(false);
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        closeBtn.addEventListener('click', onClose);
    });
}

// --- Character Creation & Selection

function cleanupCharacterPreviews() {
    const charList = document.getElementById('character-list');
    const canvases = charList.querySelectorAll('canvas');
    canvases.forEach(canvas => {
        if (canvas._animationId) {
            cancelAnimationFrame(canvas._animationId);
        }
    });
}

function createCharacterPreview(char) {
    // Create a simple class icon instead of trying to render the character
    const iconDiv = document.createElement('div');
    iconDiv.style.width = '64px';
    iconDiv.style.height = '80px';
    iconDiv.style.display = 'flex';
    iconDiv.style.flexDirection = 'column';
    iconDiv.style.alignItems = 'center';
    iconDiv.style.justifyContent = 'flex-end';
    iconDiv.style.paddingBottom = '15px';
    iconDiv.style.position = 'relative';

    // Create pixel art class icon instead of emoji
    const classIconData = spriteData.classIcons?.icons[capitalize(char.class)];
    let classIconHTML = '';
    if (classIconData) {
        const frameWidth = spriteData.classIcons.frameWidth;
        const frameHeight = spriteData.classIcons.frameHeight;
        const scale = 4; // Scale up the 16x16 icon to 64x64
        classIconHTML = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameHeight}px; background-image: url(${artAssets.classIcons}); background-position: -${classIconData.x}px -${classIconData.y}px; transform: scale(${scale}); transform-origin: center; border: 1px solid grey;"></div>`;
    } else {
        // Fallback to emoji if icon not found
        classIconHTML = getClassIcon(char.class);
    }

    // Level indicator
    const levelDiv = document.createElement('div');
    levelDiv.style.fontSize = '10px';
    levelDiv.style.fontWeight = 'bold';
    levelDiv.style.color = '#fff';
    levelDiv.style.marginTop = '4px';
    levelDiv.style.textShadow = '1px 1px 1px rgba(0,0,0,0.8)';
    levelDiv.style.position = 'relative';
    levelDiv.style.zIndex = '1';
    levelDiv.textContent = `Lv.${char.level}`;

    iconDiv.innerHTML = classIconHTML;
    iconDiv.appendChild(levelDiv);

    return iconDiv;
}

function showCharacterSelection() {
    playBGM('title');
    isGameActive = false;
    characterSelectionScreen.style.display = 'flex';
    characterCreationScreen.style.display = 'none';
    uiContainer.style.display = 'none';
    minimapContainer.style.display = 'none';
    document.getElementById('settings-menu').style.display = 'none';
    const charList = document.getElementById('character-list');
    charList.innerHTML = '';
    const characters = getSavedCharacters();

    console.log('showCharacterSelection - Found characters:', Object.keys(characters));
    console.log('Raw localStorage data:', localStorage.getItem(GAME_CONFIG.SAVE_KEY_PREFIX + 'characters'));

    if (Object.keys(characters).length === 0) {
        charList.innerHTML = '<p>No characters found. Create one!</p>';
    } else {
        // Sort characters by last played time (most recent first)
        const sortedCharNames = Object.keys(characters).sort((a, b) => {
            const timeA = characters[a].lastPlayed || 0;
            const timeB = characters[b].lastPlayed || 0;
            return timeB - timeA; // Descending order (most recent first)
        });
        
        for (const charName of sortedCharNames) {
            const char = characters[charName];
            const slot = document.createElement('div');
            slot.className = 'character-slot';
            slot.style.display = 'flex';
            slot.style.alignItems = 'center';
            slot.style.gap = '15px';

            // Create character preview
            const previewCanvas = createCharacterPreview(char);
            slot.appendChild(previewCanvas);

            const infoDiv = document.createElement('div');
            const timePlayedString = formatTimePlayed(char.timePlayed || 0);
            infoDiv.innerHTML = `<div style="font-weight: bold; margin-bottom: 5px;">${char.name}</div><div style="font-size: var(--font-small);
 color: #bdc3c7;">Lvl ${char.level} ${capitalize(char.class)} • ${timePlayedString}</div>`;
            infoDiv.style.flexGrow = '1';
            
            // Make the entire slot clickable for easier gamepad selection
            slot.style.cursor = 'pointer';
            slot.onclick = (e) => {
                // Don't trigger if clicking the delete button
                if (e.target.classList.contains('delete-char-btn')) {
                    return;
                }
                
                // Fade to black
                const fadeOverlay = document.getElementById('fade-overlay');
                fadeOverlay.style.opacity = ''; // Clear any inline styles
                fadeOverlay.classList.add('fade-to-black');
                
                // After fade to black completes, load character and start game
                setTimeout(() => {
                    loadCharacter(charName);
                    startGame();
                    
                    // Fade from black
                    fadeOverlay.classList.remove('fade-to-black');
                    fadeOverlay.classList.add('fade-from-black');
                    
                    // Clear fade classes after fade in completes
                    setTimeout(() => {
                        fadeOverlay.classList.remove('fade-from-black');
                    }, 300);
                }, 300);
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-char-btn';
            deleteBtn.textContent = 'X';

            // Delete character with confirmation
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                
                const confirmed = await showConfirmation(
                    "Delete Character",
                    `Are you sure you want to permanently delete <strong>${charName}</strong>?<br><br>This action cannot be undone.`,
                    "Delete",
                    "Cancel"
                );

                if (confirmed) {
                    // Use the correct save key
                    const saveKey = GAME_CONFIG.SAVE_KEY_PREFIX + 'characters';
                    const savedData = localStorage.getItem(saveKey);
                    let saveData = {};

                    if (savedData) {
                        try {
                            saveData = JSON.parse(savedData);
                        } catch (e) {
                            console.error('Error parsing saved characters:', e);
                            return;
                        }
                    }

                    // Ensure we have the data property and it's an object
                    if (!saveData.data || typeof saveData.data !== 'object') {
                        saveData.data = {};
                    }

                    // Delete the character from the data property
                    delete saveData.data[charName];

                    // Update timestamp and checksum
                    saveData.timestamp = Date.now();

                    // Calculate new checksum for the modified data
                    const calculateChecksum = (data) => {
                        const str = JSON.stringify(data);
                        let hash = 0;
                        for (let i = 0; i < str.length; i++) {
                            const char = str.charCodeAt(i);
                            hash = ((hash << 5) - hash) + char;
                            hash = hash & hash;
                        }
                        return hash.toString();
                    };

                    saveData.checksum = calculateChecksum(saveData.data);
                    localStorage.setItem(saveKey, JSON.stringify(saveData));

                    // Also delete from cloud storage
                    if (typeof deleteCharacterFromCloud === 'function') {
                        deleteCharacterFromCloud(charName).catch(err => {
                            console.warn('Failed to delete from cloud:', err);
                        });
                    }

                    // Refresh the character list
                    showCharacterSelection();
                }
            };

            slot.appendChild(infoDiv);
            slot.appendChild(deleteBtn);
            charList.appendChild(slot);
        }
        
        // Initialize gamepad selection on first character
        setTimeout(() => {
            const firstSlot = document.querySelector('.character-slot');
            if (firstSlot) {
                firstSlot.classList.add('gamepad-selected');
            }
        }, 100);
    }
}

function setupCustomizationControls() {
    const listen = (id, callback) => document.getElementById(id).addEventListener('click', callback);
    listen('roll-dice-btn', rollCreationStats);
    listen('random-name-btn', generateRandomName);
    listen('random-appearance-btn', randomizeAppearance);
    listen('next-hair-btn', () => { currentHairIndex = (currentHairIndex + 1) % customizationOptions.hair.length; updateCreationLabels(); });
    listen('prev-hair-btn', () => { currentHairIndex = (currentHairIndex - 1 + customizationOptions.hair.length) % customizationOptions.hair.length; updateCreationLabels(); });
    listen('next-hair-color-btn', () => { currentHairColorIndex = (currentHairColorIndex + 1) % customizationOptions.hairColors.length; updateCreationLabels(); });
    listen('prev-hair-color-btn', () => { currentHairColorIndex = (currentHairColorIndex - 1 + customizationOptions.hairColors.length) % customizationOptions.hairColors.length; updateCreationLabels(); });
    listen('next-eye-btn', () => { currentEyeColorIndex = (currentEyeColorIndex + 1) % customizationOptions.eyeColors.length; updateCreationLabels(); });
    listen('prev-eye-btn', () => { currentEyeColorIndex = (currentEyeColorIndex - 1 + customizationOptions.eyeColors.length) % customizationOptions.eyeColors.length; updateCreationLabels(); });
    listen('next-skin-btn', () => { currentSkinIndex = (currentSkinIndex + 1) % customizationOptions.skinTones.length; updateCreationLabels(); });
    listen('prev-skin-btn', () => { currentSkinIndex = (currentSkinIndex - 1 + customizationOptions.skinTones.length) % customizationOptions.skinTones.length; updateCreationLabels(); });

    // Set initial labels
    updateCreationLabels();
}

// Random name generator - 2005 EvergreenStory style
function generateRandomName() {
    const adjectives = ['Dark', 'Shadow', 'Fire', 'Ice', 'Holy', 'Sin', 'Night', 'Blood', 'Death', 'Soul', 'Demon', 'Angel', 'Dragon', 'Moon', 'Star', 'Storm', 'Thunder', 'Lightning', 'Chaos', 'Silent', 'Fierce', 'Brave', 'Swift', 'Cunning', 'Noble', 'Wild', 'Savage', 'Mighty', 'Vicious', 'Ghostly', 'Phantom', 'Crimson', 'Obsidian', 'Silver', 'Golden', 'Iron', 'Steel', 'Frost', 'Blaze', 'Venom', 'Toxic', 'Rogue', 'Valkyrie', 'Wraith', 'Specter', 'Inferno',
    'Tempest', 'Eclipse', 'Nova', 'Raven', 'Wolf', 'Lion', 'Tiger', 'Bear', 'Hawk', 'Falcon', 'Serpent', 'Phoenix', 'Grim', 'Stinky', 'Fluffy', 'Tiny', 'Giant', 'Mighty', 'Sneaky', 'Brilliant', 'Clever', 'Wise', 'Fierce', 'Bold', 'Daring', 'Fearless', 'Lone'];
    const nouns = ['Assassin', 'Blade', 'Knight', 'Mage', 'Archer', 'Warrior', 'Thief', 'Killer', 'Slayer', 'Hunter', 'Master', 'Lord', 'King', 'Prince', 'God', 'Devil', 'Reaper', 'Ranger', 'Bandit', 'Chief', 'Rabbit', 'Fox', 'Dragon', 'Wolf', 'Bear', 'Eagle', 'Hawk', 'Lion', 'Tiger', 'Panther', 'Shadow', 'Ghost', 'Spirit', 'Demon', 'Angel', 'Wizard', 'Sorcerer', 'Ninja', 'Samurai', 'Pirate', 'Viking', 'Gladiator', 'Paladin', 'Monk', 'Druid', 'Rogue', 'Berserker'];
    const leetReplacements = {
        'a': ['a', '4', '@'],
        'e': ['e', '3'],
        'i': ['i', '1', '!'],
        'o': ['o', '0'],
        's': ['s', '5', 'z'],
        'l': ['l', '1'],
        't': ['t', '7']
    };
    
    // Random patterns
    const patterns = [
        () => {
            // XxNamexX pattern
            const word = (Math.random() > 0.5 ? adjectives : nouns)[Math.floor(Math.random() * 20)];
            return 'Xx' + word + 'xX';
        },
        () => {
            // iNamei or llNamell pattern
            const wrapper = Math.random() > 0.5 ? 'i' : 'l';
            const word = (Math.random() > 0.5 ? adjectives : nouns)[Math.floor(Math.random() * 20)];
            return wrapper + word + wrapper;
        },
        () => {
            // Name with numbers
            const word1 = adjectives[Math.floor(Math.random() * adjectives.length)];
            const word2 = nouns[Math.floor(Math.random() * nouns.length)];
            const num = Math.floor(Math.random() * 1000);
            return word1 + word2 + num;
        },
        () => {
            // L33t speak version
            const word1 = adjectives[Math.floor(Math.random() * adjectives.length)];
            const word2 = nouns[Math.floor(Math.random() * nouns.length)];
            let name = word1 + word2;
            
            // Apply random leet replacements
            name = name.toLowerCase();
            for (let char in leetReplacements) {
                if (name.includes(char) && Math.random() > 0.5) {
                    const replacements = leetReplacements[char];
                    name = name.replace(new RegExp(char, 'g'), replacements[Math.floor(Math.random() * replacements.length)]);
                }
            }
            return name;
        },
        () => {
            // Simple combo
            const word1 = adjectives[Math.floor(Math.random() * adjectives.length)];
            const word2 = nouns[Math.floor(Math.random() * nouns.length)];
            return word1 + word2;
        }
    ];
    
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const name = pattern();
    document.getElementById('character-name').value = name.substring(0, 16); // Limit to 16 chars
}

// Randomize appearance
function randomizeAppearance() {
    currentHairIndex = Math.floor(Math.random() * customizationOptions.hair.length);
    currentHairColorIndex = Math.floor(Math.random() * customizationOptions.hairColors.length);
    currentEyeColorIndex = Math.floor(Math.random() * customizationOptions.eyeColors.length);
    currentSkinIndex = Math.floor(Math.random() * customizationOptions.skinTones.length);
    updateCreationLabels();
}
/**
 * Renders the character preview canvas with the current selections.
 */

// in ui.js

function previewAnimationLoop(currentTime = 0) {
    const deltaTime = currentTime - previewLastFrameTime;
    previewLastFrameTime = currentTime;
    previewAccumulator += deltaTime;

    // Use the same fixed timestep as the main game loop for consistency
    const FIXED_TIMESTEP = 10; // 10ms per update (100 FPS)

    // Process logic updates based on the fixed timestep
    while (previewAccumulator >= FIXED_TIMESTEP) {
        const pData = spriteData.player;
        const animData = pData.animations.idle;
        const frameDuration = 15; // Same duration as in-game idle

        previewAnimationTimer++;
        if (previewAnimationTimer > frameDuration) {
            previewAnimationTimer = 0;
            previewAnimationFrame = (previewAnimationFrame + 1) % animData.length;
        }
        previewAccumulator -= FIXED_TIMESTEP;
    }

    // Render the preview on every frame for smoothness
    renderCharacterPreview();

    // Continue the loop
    previewAnimationId = requestAnimationFrame(previewAnimationLoop);
}

function openAppearanceCustomization() {
    // Create a separate appearance modal that doesn't interfere with character creation
    createAppearanceModal();
}

// This function will set up everything for the appearance window.
function initializeAppearanceWindow() {
    const appearanceWindow = document.getElementById('appearance-window');
    // If the window element doesn't exist in index.html, stop here.
    if (!appearanceWindow) return;

    // Get references to all the UI elements inside the window once.
    const elements = {
        hairName: document.getElementById('appearance-hair-name'),
        hairColorBox: document.getElementById('appearance-hair-color-box'),
        eyeName: document.getElementById('appearance-eye-name'),
        skinColorBox: document.getElementById('appearance-skin-color-box')
    };

    let originalState = {}; // To store the player's look before they make changes.

    // This is the single, reliable function to update all the labels and colors.
    const updateDisplay = () => {
        if (!player || !player.customization) return; // Safety check
        const cust = player.customization;
        const hairStyleIndex = Number(cust.hairStyle) || 0;
        const hairColorIndex = Number(cust.hairColor) || 0;
        const eyeColorIndex = Number(cust.eyeColor) || 0;
        const skinToneIndex = Number(cust.skinTone) || 0;

        elements.hairName.textContent = customizationOptions.hair[hairStyleIndex]?.name || 'Default';
        elements.hairColorBox.style.backgroundColor = customizationOptions.hairColors[hairColorIndex] || '#000';
        elements.eyeName.textContent = customizationOptions.eyeColors[eyeColorIndex]?.name || 'Default';
        elements.skinColorBox.style.backgroundColor = customizationOptions.skinTones[skinToneIndex] || '#FFF';
        
        // Also render the preview canvas
        renderAppearancePreview(hairStyleIndex, hairColorIndex, eyeColorIndex, skinToneIndex);
    };

    // This is the function that will be called when the user wants to open the window.
    const openWindow = () => {
        if (!player.customization) {
            player.customization = { hairStyle: 0, hairColor: 0, eyeColor: 0, skinTone: 0 };
        }
        originalState = { ...player.customization };
        updateDisplay(); // Set the initial state and render preview
        updateHairDebugInfo();
        toggleWindow(appearanceWindow);
    };

    // We attach our open function to the global window object so other parts of the code can call it.
    window.openAppearanceCustomization = openWindow;

    // Debug function to update hair info
    const updateHairDebugInfo = () => {
        if (!player || !player.customization) return;
        const hairIndex = Number(player.customization.hairStyle) || 0;
        const customizationHair = customizationOptions.hair[hairIndex];
        const spriteHair = spriteData.playerHair[hairIndex];
        
        debugHairInfo = {
            hairIndex: hairIndex,
            customizationName: customizationHair?.name || 'undefined',
            spriteName: spriteHair?.name || 'undefined',
            spriteY: spriteHair?.y || 'undefined',
            arraysMatch: customizationHair?.name === spriteHair?.name,
            totalCustomizationHairs: customizationOptions.hair.length,
            totalSpriteHairs: spriteData.playerHair.length
        };
    };
    
    window.updateHairDebugInfo = updateHairDebugInfo;

    // --- All Event Listeners are now set up here, once. ---
    const listen = (id, callback) => document.getElementById(id).addEventListener('click', callback);

    const cycle = (key, optionsArray) => {
        player.customization[key] = (Number(player.customization[key] || 0) + 1) % optionsArray.length;
        updateDisplay();
        renderPlayer();
        updateHairDebugInfo();
    };
    const cycleReverse = (key, optionsArray) => {
        player.customization[key] = (Number(player.customization[key] || 0) - 1 + optionsArray.length) % optionsArray.length;
        updateDisplay();
        renderPlayer();
        updateHairDebugInfo();
    };

    // Button bindings
    listen('appearance-next-hair-btn', () => cycle('hairStyle', customizationOptions.hair));
    listen('appearance-prev-hair-btn', () => cycleReverse('hairStyle', customizationOptions.hair));
    listen('appearance-next-hair-color-btn', () => cycle('hairColor', customizationOptions.hairColors));
    listen('appearance-prev-hair-color-btn', () => cycleReverse('hairColor', customizationOptions.hairColors));
    listen('appearance-next-eye-btn', () => cycle('eyeColor', customizationOptions.eyeColors));
    listen('appearance-prev-eye-btn', () => cycleReverse('eyeColor', customizationOptions.eyeColors));
    listen('appearance-next-skin-btn', () => cycle('skinTone', customizationOptions.skinTones));
    listen('appearance-prev-skin-btn', () => cycleReverse('skinTone', customizationOptions.skinTones));

    // Apply/Cancel/Close logic
    listen('appearance-apply-btn', () => {
        const cost = 10000;
        if (player.gold < cost) {
            addChatMessage("You don't have enough gold!", 'error');
            return;
        }
        player.gold -= cost;
        player.stats.goldSpent += cost;
        addChatMessage("Your appearance has been changed!", 'success');
        toggleWindow(appearanceWindow);
        updateUI();
        saveCharacter();
    });

    const cancelChanges = () => {
        player.customization = { ...originalState };
        renderPlayer();
        toggleWindow(appearanceWindow);
    };

    listen('appearance-cancel-btn', cancelChanges);
    appearanceWindow.querySelector('.close-btn').addEventListener('click', cancelChanges);
}

function renderAppearancePreview(hairStyle, hairColor, eyeColor, skinTone) {
    const previewArea = document.getElementById('appearance-preview-area');
    if (!previewArea) return;

    // Check if sprite data is available
    if (!spriteData || !spriteData.player) {
        previewArea.innerHTML = '<div style="color: white; text-align: center; line-height: 200px;">Loading...</div>';
        return;
    }

    const pData = spriteData.player;
    const PIXEL_ART_SCALE = 3;
    const CANVAS_WIDTH = pData.frameWidth * PIXEL_ART_SCALE;
    const CANVAS_HEIGHT = pData.frameHeight * PIXEL_ART_SCALE;

    let canvas = previewArea.querySelector('canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        canvas.style.width = `${CANVAS_WIDTH}px`;
        canvas.style.height = `${CANVAS_HEIGHT}px`;
        canvas.style.imageRendering = 'pixelated';
        previewArea.innerHTML = '';
        previewArea.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Check if player sheet image is loaded
    if (!playerSheetImage || !playerSheetImage.complete) {
        ctx.fillStyle = '#3498db';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Loading...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        return;
    }

    // Draw character with preview customization
    const anim = pData.animations.idle;
    if (!anim || anim.length === 0) return;

    const frame = anim[0]; // Use first frame for preview
    const skinY = pData.frameHeight * (skinTone + 1);

    try {
        // Draw body
        ctx.drawImage(
            playerSheetImage,
            frame.x, skinY,
            pData.frameWidth, pData.frameHeight,
            0, 0,
            CANVAS_WIDTH, CANVAS_HEIGHT
        );

        // Draw eyes if available
        if (playerEyesSheet && playerEyesSheet.complete && spriteData.playerEyes) {
            const eyeData = spriteData.playerEyes;
            const eyeSourceY = eyeData.frameHeight * eyeColor;
            ctx.drawImage(
                playerEyesSheet,
                frame.x, eyeSourceY,
                eyeData.frameWidth, eyeData.frameHeight,
                0, 0,
                CANVAS_WIDTH, CANVAS_HEIGHT
            );
        }

        // Draw hair if available and not Bald
        if (playerHairSheet && playerHairSheet.complete && spriteData.playerHair) {
            const hairInfo = spriteData.playerHair[hairStyle];
            if (hairInfo && hairInfo.name !== 'Bald') {
                // Create a temporary canvas for coloring the hair
                const hairCanvas = document.createElement('canvas');
                hairCanvas.width = pData.frameWidth;
                hairCanvas.height = pData.frameHeight;
                const hairCtx = hairCanvas.getContext('2d');
                
                // Draw the hair sprite
                hairCtx.drawImage(
                    playerHairSheet,
                    hairInfo.x + frame.x, hairInfo.y,
                    pData.frameWidth, pData.frameHeight,
                    0, 0,
                    pData.frameWidth, pData.frameHeight
                );
                
                // Apply hair color
                hairCtx.globalCompositeOperation = 'source-atop';
                hairCtx.fillStyle = customizationOptions.hairColors[hairColor];
                hairCtx.fillRect(0, 0, pData.frameWidth, pData.frameHeight);
                
                // Draw the colored hair onto the main canvas
                ctx.drawImage(
                    hairCanvas,
                    0, 0,
                    pData.frameWidth, pData.frameHeight,
                    0, 0,
                    CANVAS_WIDTH, CANVAS_HEIGHT
                );
            }
        }
    } catch (error) {
        console.error('Error drawing preview:', error);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Preview Error', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
}

function updateAppearanceLabels(hairStyle, hairColor, eyeColor, skinTone) {
    // Update hair name
    const hairNameEl = document.getElementById('appearance-hair-name');
    if (hairNameEl && customizationOptions.hair && customizationOptions.hair[hairStyle]) {
        hairNameEl.textContent = customizationOptions.hair[hairStyle].name;
    }

    // Update hair color box
    const hairColorEl = document.getElementById('appearance-hair-color-box');
    if (hairColorEl && customizationOptions.hairColors && Array.isArray(customizationOptions.hairColors) && customizationOptions.hairColors[hairColor]) {
        hairColorEl.style.background = customizationOptions.hairColors[hairColor];
    }

    // Update eye color name
    const eyeNameEl = document.getElementById('appearance-eye-name');
    if (eyeNameEl && customizationOptions.eyeColors && customizationOptions.eyeColors[eyeColor]) {
        eyeNameEl.textContent = customizationOptions.eyeColors[eyeColor].name;
    }

    // Update skin color box
    const skinColorEl = document.getElementById('appearance-skin-color-box');
    if (skinColorEl && customizationOptions.skinTones && customizationOptions.skinTones[skinTone]) {
        skinColorEl.style.background = customizationOptions.skinTones[skinTone];
    }
}

function updateCreationLabels() {
    document.getElementById('hair-name').textContent = customizationOptions.hair[currentHairIndex].name;
    document.getElementById('hair-color-box').style.backgroundColor = customizationOptions.hairColors[currentHairColorIndex];
    document.getElementById('eye-name').textContent = customizationOptions.eyeColors[currentEyeColorIndex].name;
    document.getElementById('skin-color-box').style.backgroundColor = customizationOptions.skinTones[currentSkinIndex];
}

// REPLACE the existing renderCharacterPreview function
function renderCharacterPreview() {
    const previewArea = document.getElementById('character-preview-area');
    if (!previewArea) return;

    const pData = spriteData.player;
    const PIXEL_ART_SCALE = 4;
    const CANVAS_WIDTH = pData.frameWidth * PIXEL_ART_SCALE;
    const CANVAS_HEIGHT = pData.frameHeight * PIXEL_ART_SCALE;

    let canvas = previewArea.querySelector('canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        canvas.style.width = `${CANVAS_WIDTH}px`;
        canvas.style.height = `${CANVAS_HEIGHT}px`;
        canvas.style.imageRendering = 'pixelated';
        previewArea.innerHTML = '';
        previewArea.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    hairTintCanvas.width = canvas.width;
    hairTintCanvas.height = canvas.height;
    hairTintCtx.imageSmoothingEnabled = false;

    const anim = pData.animations.idle;
    const frameIndex = previewAnimationFrame % anim.length;
    const frame = anim[frameIndex];
    const skinY = pData.frameHeight * (currentSkinIndex + 1);

    const drawQueue = [];

    drawQueue.push({ type: 'body', zLevel: 1, source: playerSheetImage, sx: frame.x, sy: skinY, sWidth: pData.frameWidth, sHeight: pData.frameHeight });
    drawQueue.push({ type: 'body', zLevel: 5, source: playerSheetImage, sx: frame.x, sy: 0, sWidth: pData.frameWidth, sHeight: pData.frameHeight });

    const eyeData = spriteData.playerEyes;
    const eyeSourceY = eyeData.frameHeight * currentEyeColorIndex;
    drawQueue.push({ type: 'eyes', zLevel: 10, source: playerEyesSheet, sx: 0, sy: eyeSourceY, sWidth: eyeData.frameWidth, sHeight: eyeData.frameHeight, attachment: frame.attachments.eyes });

    const hairStyle = customizationOptions.hair[currentHairIndex];
    if (hairStyle && hairStyle.name !== 'Bald') {
        const hairInfo = spriteData.playerHair[currentHairIndex];
        if (hairInfo) {
            drawQueue.push({
                type: 'hair',
                zLevel: 6,
                source: playerHairSheet,
                sx: hairInfo.x + frame.x,
                sy: hairInfo.y,
                sWidth: pData.frameWidth,
                sHeight: pData.frameHeight,
                hairColor: customizationOptions.hairColors[currentHairColorIndex]
            });
        }
    }

    const previewEquipment = {
        top: 'White T-shirt',
        bottom: 'Blue Jeans',
        weapon: 'Dull Sword'
    };

    Object.keys(previewEquipment).forEach(slot => {
        const itemName = previewEquipment[slot];
        const itemInfo = itemData[itemName];
        const coords = spriteData.playerEquipment.coords[itemName];
        if (itemInfo && coords) {
            drawQueue.push({
                type: 'equip',
                zLevel: itemInfo.zLevel,
                source: playerEquipmentSheet,
                sx: coords.x + frame.x,
                sy: coords.y,
                sWidth: pData.frameWidth,
                sHeight: pData.frameHeight
            });
        }
    });

    drawQueue.sort((a, b) => a.zLevel - b.zLevel);

    drawQueue.forEach(item => {
        let destWidth = canvas.width;
        let destHeight = canvas.height;
        let destX = 0;
        let destY = 0;

        if (item.type === 'eyes' && item.attachment) {
            destWidth = item.sWidth * PIXEL_ART_SCALE;
            destHeight = item.sHeight * PIXEL_ART_SCALE;
            destX = item.attachment.x * PIXEL_ART_SCALE;
            destY = item.attachment.y * PIXEL_ART_SCALE;
        }

        if (item.type === 'hair' && item.hairColor) {
            hairTintCtx.clearRect(0, 0, canvas.width, canvas.height);
            hairTintCtx.drawImage(item.source, item.sx, item.sy, item.sWidth, item.sHeight, destX, destY, destWidth, destHeight);

            const imageData = hairTintCtx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const tintColor = hexToRgb(item.hairColor);

            const outlineR = 34, outlineG = 32, outlineB = 52;

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
            hairTintCtx.putImageData(imageData, 0, 0);
            ctx.drawImage(hairTintCanvas, 0, 0);
        } else {
            ctx.drawImage(item.source, item.sx, item.sy, item.sWidth, item.sHeight, destX, destY, destWidth, destHeight);
        }
    });
}



async function rollCreationStats() {
    const rollBtn = document.getElementById('roll-dice-btn');
    const createCharacterBtn = document.getElementById('start-game-btn');

    rollBtn.disabled = true;

    if (createCharacterBtn.style.visibility !== 'visible') {
        createCharacterBtn.style.visibility = 'visible';
    }

    let stats = { str: 4, dex: 4, int: 4, luk: 4 };
    let pointsToDistribute = 9;
    const statKeys = ['str', 'dex', 'int', 'luk'];

    for (let i = 0; i < pointsToDistribute; i++) {
        const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
        if (stats[randomStat] < 12) {
            stats[randomStat]++;
        } else {
            i--;
        }
    }
    creationStats = stats;

    statKeys.forEach(stat => {
        const element = document.getElementById(`${stat}-val`);
        const value = creationStats[stat];
        element.textContent = value;
        if (value === 12) element.style.color = 'var(--hp-color)';
        else if (value === 11) element.style.color = 'var(--legendary-color)';
        else element.style.color = 'var(--exp-color)';
    });

    // --- UPDATED: This object now supports multiple suggestions per stat ---
    const statToClassMap = {
        str: [
            { name: 'Warrior', color: '#c0392b' }, // Red
            { name: 'Pirate', color: '#9b59b6' }  // Purple
        ],
        dex: [
            { name: 'Bowman', color: '#27ae60' }, // Green
            { name: 'Pirate', color: '#9b59b6' }  // Purple
        ],
        int: [{ name: 'Magician', color: '#2980b9' }], // Blue
        luk: [{ name: 'Thief', color: '#f1c40f' }]  // Yellow
    };

    for (const stat in creationStats) {
        if (creationStats[stat] >= 11) {
            const suggestedClasses = statToClassMap[stat];

            // --- UPDATED: This logic now builds the multi-colored string ---
            const classSuggestionsHTML = suggestedClasses.map(c =>
                `<span style="color:${c.color}; text-shadow: 1px 1px #000;">${c.name}</span>`
            ).join(' or ');

            const message = `These stats would be great for a ${classSuggestionsHTML}. Are you sure you want to roll again?`;

            await showConfirmation(
                "Excellent Roll!",
                message,
                "Yes, Roll Again",
                "No, Keep These"
            );
            break;
        }
    }

    rollBtn.disabled = false;
}

// --- Tooltip Management ---

/**
 * Shows a tooltip with the specified content at the mouse event's position.
 * @param {MouseEvent} e - The mouse event that triggered the tooltip.
 * @param {string} content - The HTML content to display in the tooltip.
 */
function showTooltip(e, content) {
    const tooltip = document.getElementById('tooltip');
    tooltip.innerHTML = content;
    tooltip.style.display = 'block';
    moveTooltip(e); // Position it once immediately
    document.addEventListener('mousemove', moveTooltip);
}

/**
 * Hides the tooltip and removes its mouse-tracking event listener.
 */
function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.display = 'none';
    document.removeEventListener('mousemove', moveTooltip);
}

/**
 * Updates the tooltip's position to follow the mouse cursor.
 * @param {MouseEvent} e - The mousemove event.
 */
function moveTooltip(e) {
    const tooltip = document.getElementById('tooltip');

    // Position is based directly on the viewport coordinates
    let x = e.clientX + 15;
    let y = e.clientY + 15;

    // Check to keep the tooltip from going off-screen
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (x + tooltipRect.width > viewportWidth) {
        x = e.clientX - tooltipRect.width - 15;
    }
    if (y + tooltipRect.height > viewportHeight) {
        y = e.clientY - tooltipRect.height - 15;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}

function ensureTooltipOutsideScaling() {
    const tooltip = document.getElementById('tooltip');
    const scalingContainer = document.getElementById('scaling-container');

    if (tooltip && scalingContainer && scalingContainer.contains(tooltip)) {
        // Move tooltip to the body to avoid all scaling and z-index issues
        document.body.appendChild(tooltip);
        console.log('Tooltip moved outside of game container for proper layering.');
    }
}

/**
 * Attaches mouseover/mouseout event listeners to an element to show/hide a tooltip.
 * @param {HTMLElement} element - The element to attach the events to.
 * @param {string} content - The HTML content for the tooltip.
 */
function addTooltipEvents(element, contentOrFunction) {
    element.addEventListener('mouseover', (e) => {
        const content = typeof contentOrFunction === 'function' ? contentOrFunction() : contentOrFunction;
        if (content && content.trim()) { // Only show tooltip if content is not empty
            showTooltip(e, content);
        }
    });
    element.addEventListener('mouseout', hideTooltip);
}

function buildTooltipHtml(item, comparisonItem = null) {
    if (!item) return '';
    const itemInfo = itemData[item.name];
    if (!itemInfo) return '';

    const rarity = item.rarity || (item.isQuestItem ? 'quest' : (itemInfo.category === 'Cosmetic' ? 'cosmetic' : 'common'));
    const enhancementText = item.enhancement > 0 ? ` +${item.enhancement}` : '';
    let html = `<h4 class="${rarity}">${item.name}${enhancementText}</h4>`;

    if (itemInfo.category === 'Equip' && itemInfo.type) {
        html += `<p class="item-category">${capitalize(itemInfo.type)}</p>`;
    } else if (itemInfo.category) {
        html += `<p class="item-category">${itemInfo.category}</p>`;
    }

    // Show "Quest Item" subcategory for quest items
    if (item.isQuestItem || itemInfo.isQuestItem) {
        html += `<p class="item-category">Quest Item</p>`;
    }

    if (itemInfo.description) html += `<p class="item-description">${itemInfo.description}</p>`;

    // Level requirement (shown early, before stats)
    if (item.levelReq > 1) {
        const meetsLevelReq = player.level >= item.levelReq;
        const levelColor = meetsLevelReq ? 'white' : 'var(--fail-color)';
        html += `<p>Level Req: <span style="color: ${levelColor};">${item.levelReq}</span></p>`;
    }

    // Class requirement (shown early, before stats)
    if (itemInfo.classReq) {
        let canEquip = false;
        let currentClass = player.class;
        while (currentClass) {
            if (itemInfo.classReq.includes(currentClass)) {
                canEquip = true;
                break;
            }
            const classInfo = classHierarchy[currentClass];
            currentClass = classInfo ? classInfo.parent : null;
        }
        const classList = itemInfo.classReq.map(c => capitalize(c)).join(' / ');
        html += `<p>Class: <span style="color: ${canEquip ? 'white' : 'var(--fail-color)'};">${classList}</span></p>`;
    }

    const baseStats = item.stats || {};
    const enhancedStats = calculateEnhancedStats(item);
    const comparisonStats = comparisonItem ? calculateEnhancedStats(comparisonItem) : null;
    const comparisonBaseStats = comparisonItem ? (comparisonItem.stats || {}) : null;

    // Collect ALL stats from both items for complete comparison
    const allStatKeys = new Set([
        ...Object.keys(baseStats), 
        ...(enhancedStats ? Object.keys(enhancedStats) : []), 
        ...(comparisonStats ? Object.keys(comparisonStats) : []),
        ...(comparisonBaseStats ? Object.keys(comparisonBaseStats) : [])
    ]);

    // Track total stat changes for summary
    let totalPositiveChanges = 0;
    let totalNegativeChanges = 0;

    if (allStatKeys.size > 0) {
        // Add divider before stats
        html += `<div class="tooltip-stats-divider"></div>`;
        
        // Sort stats so important ones come first
        const statPriority = ['attack', 'defense', 'hp', 'mp', 'str', 'dex', 'int', 'luk', 'accuracy', 'avoidability', 'speed', 'jump', 'critChance', 'critDamage', 'minCritDamage', 'maxCritDamage'];
        const sortedStats = [...allStatKeys].sort((a, b) => {
            const aIdx = statPriority.indexOf(a);
            const bIdx = statPriority.indexOf(b);
            if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
        });

        sortedStats.forEach(stat => {
            const baseStatValue = baseStats[stat] || 0;
            const enhancedStatValue = enhancedStats ? (enhancedStats[stat] || 0) : baseStatValue;
            const enhancementBonus = enhancedStatValue - baseStatValue;
            const comparisonStatValue = comparisonStats ? (comparisonStats[stat] || 0) : 0;

            // Show stat if either item has it
            const thisItemHasStat = baseStatValue !== 0 || enhancementBonus !== 0;
            const equippedHasStat = comparisonStats && comparisonStatValue !== 0;

            if (thisItemHasStat || equippedHasStat) {
                let comparisonHtml = '';
                if (comparisonStats) {
                    const diff = enhancedStatValue - comparisonStatValue;
                    if (diff > 0) {
                        comparisonHtml = ` <span class="stat-increase">(+${diff})</span>`;
                        totalPositiveChanges++;
                    } else if (diff < 0) {
                        comparisonHtml = ` <span class="stat-decrease">(${diff})</span>`;
                        totalNegativeChanges++;
                    }
                }

                let enhancementHtml = '';
                if (enhancementBonus > 0) {
                    enhancementHtml = ` <span class="enhancement-bonus">(+${enhancementBonus})</span>`;
                }

                // Format stat name nicely
                const statDisplayName = formatStatName(stat);

                // Format stat display based on stat type
                let displayValue;
                if (stat === 'critChance' || stat === 'critDamage' || stat === 'minCritDamage' || stat === 'maxCritDamage') {
                    displayValue = `${baseStatValue}%`;
                } else {
                    displayValue = baseStatValue;
                }

                // If this item doesn't have the stat but equipped does, show it differently
                if (!thisItemHasStat && equippedHasStat) {
                    // This item is MISSING a stat the equipped item has
                    const lostValue = stat.includes('Crit') || stat === 'critChance' ? `${comparisonStatValue}%` : comparisonStatValue;
                    html += `<p class="stat-missing">${statDisplayName}: 0 <span class="stat-decrease">(-${lostValue})</span></p>`;
                    totalNegativeChanges++;
                } else {
                    html += `<p>${statDisplayName}: ${displayValue}${enhancementHtml}${comparisonHtml}</p>`;
                }
            }
        });
    }

    // Add comparison summary if comparing items
    if (comparisonItem && comparisonStats) {
        // Calculate combat score difference using weighted values
        const statWeights = {
            'attack': 10,      // Attack is very important
            'defense': 5,      // Defense is moderately important
            'hp': 0.1,         // HP in bulk, so lower weight per point
            'mp': 0.05,        // MP less critical
            'str': 3,          // Main stats are valuable
            'dex': 3,
            'int': 3,
            'luk': 3,
            'accuracy': 2,     // Accuracy matters for hitting
            'avoidability': 1, // Avoid is nice to have
            'speed': 1,
            'jump': 0.5,
            'critChance': 8,   // Crit chance is very valuable
            'critDamage': 5,   // Crit damage multiplier
            'minCritDamage': 3,
            'maxCritDamage': 3
        };
        
        let thisItemScore = 0;
        let comparisonScore = 0;
        
        allStatKeys.forEach(stat => {
            const weight = statWeights[stat] || 1;
            const thisValue = enhancedStats ? (enhancedStats[stat] || 0) : (baseStats[stat] || 0);
            const compValue = comparisonStats[stat] || 0;
            thisItemScore += thisValue * weight;
            comparisonScore += compValue * weight;
        });
        
        const scoreDiff = thisItemScore - comparisonScore;
        const scorePercent = comparisonScore > 0 ? Math.round((scoreDiff / comparisonScore) * 100) : (thisItemScore > 0 ? 100 : 0);
        
        html += `<div class="comparison-divider"></div>`;
        html += `<p class="comparison-header">vs Equipped: <span class="${comparisonItem.enhancement > 0 ? 'enhancement-bonus' : ''}">${comparisonItem.name}${comparisonItem.enhancement > 0 ? ' +' + comparisonItem.enhancement : ''}</span></p>`;
        
        // Use score difference to determine upgrade/downgrade, with a small threshold for "equal"
        if (scoreDiff > 5) {
            const percentText = scorePercent > 0 ? ` (+${scorePercent}%)` : '';
            html += `<p class="comparison-summary upgrade">▲${percentText}</p>`;
        } else if (scoreDiff < -5) {
            const percentText = scorePercent < 0 ? ` (${scorePercent}%)` : '';
            html += `<p class="comparison-summary downgrade">▼${percentText}</p>`;
        } else {
            html += `<p class="comparison-summary equal">≈</p>`;
        }
    }

    return html;
}

// Helper function to format stat names nicely
function formatStatName(stat) {
    const statNames = {
        'attack': 'ATK',
        'defense': 'DEF',
        'hp': 'HP',
        'mp': 'MP',
        'str': 'STR',
        'dex': 'DEX',
        'int': 'INT',
        'luk': 'LUK',
        'accuracy': 'Accuracy',
        'avoidability': 'Avoid',
        'speed': 'Speed',
        'jump': 'Jump',
        'critChance': 'Crit Rate',
        'critDamage': 'Crit DMG',
        'minCritDamage': 'Min Crit',
        'maxCritDamage': 'Max Crit'
    };
    return statNames[stat] || stat.toUpperCase();
}

// Returns a color code for each item rarity
function getRarityColor(rarity) {
    switch (rarity) {
        case 'common': return '#bdc3c7';
        case 'uncommon': return '#27ae60';
        case 'rare': return '#2980b9';
        case 'epic': return '#8e44ad';
        case 'legendary': return '#f1c40f';
        case 'unique': return '#e67e22';
        default: return '#bdc3c7';
    }
}

// --- Notification Management ---

/**
 * Displays a small, floating notification on the right side of the screen.
 * @param {string} text - The message to display.
 * @param {string} rarity - The color/rarity of the message (e.g., 'common', 'rare', 'exp').
 */
function showNotification(text, rarity) {
    const notificationContainer = document.getElementById('notification-container');
    const el = document.createElement('div');
    el.className = `notification-text ${rarity || 'common'}`;
    el.textContent = text;
    // Append to end - with column-reverse, this appears at the bottom visually
    notificationContainer.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

/**
 * Displays a player online/offline notification toast that slides in and fades out.
 * @param {string} playerName - The name of the player
 * @param {number} level - The player's level
 * @param {string} playerClass - The player's class
 * @param {boolean} isOnline - Whether the player is coming online (true) or going offline (false)
 * @param {boolean} isBuddy - Whether this player is on the buddy list
 * @param {boolean} isGuildMember - Whether this player is in the same guild
 */
function showPlayerOnlineNotification(playerName, level, playerClass, isOnline = true, isBuddy = false, isGuildMember = false) {
    const container = document.getElementById('player-notification-container');
    if (!container) {
        console.warn('Player notification container not found');
        return;
    }
    
    // Create toast element
    const toast = document.createElement('div');
    let classes = 'player-notification-toast';
    if (!isOnline) classes += ' offline';
    if (isBuddy) classes += ' buddy';
    if (isGuildMember) classes += ' guild';
    toast.className = classes;
    
    // Icon based on status
    let icon = isOnline ? '🟢' : '⚪';
    
    // Label for special relationships
    let label = '';
    if (isBuddy && isGuildMember) label = ' <span style="color: #9b59b6; font-size: 0.8em;">(Buddy & Guild)</span>';
    else if (isBuddy) label = ' <span style="color: #f1c40f; font-size: 0.8em;">(Buddy)</span>';
    else if (isGuildMember) label = ' <span style="color: #9b59b6; font-size: 0.8em;">(Guild)</span>';
    
    toast.innerHTML = `
        <div class="player-notification-icon">${icon}</div>
        <div class="player-notification-content">
            <div class="player-notification-name">${playerName}${label}</div>
            <div class="player-notification-status ${isOnline ? 'online' : 'offline'}">
                Lv.${level} ${capitalize(playerClass) || 'Beginner'} ${isOnline ? 'is now online' : 'went offline'}
            </div>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Play sound for online notifications
    if (isOnline && typeof playSound === 'function') {
        playSound('playerOnline');
    }
    
    // Remove after animation completes (2 seconds total)
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 2000);
}

// Expose to window for firebase-config.js to access
window.showPlayerOnlineNotification = showPlayerOnlineNotification;

/**
 * Dynamically positions the notification container to the left of the main hotkey bar.
 */
function updateNotificationContainerPosition() {
    // No longer needed - notification container uses fixed CSS positioning
    // that scales with the UI container
}

// --- Main UI and HUD Updates ---

// REPLACE your old updateUI function with these two new ones:

/**
 * Updates only the essential HUD elements that need to refresh every frame.
 * This is the lightweight function called by the game loop.
 */
function updateHUD() {
    if (!player || !player.stats) return; // Guard clause

    const finalStats = calculatePlayerStats();
    const hpPercent = (player.hp / finalStats.finalMaxHp) * 100;
    const mpPercent = (player.mp / finalStats.finalMaxMp) * 100;
    const expPercent = (player.exp / player.maxExp) * 100;

    // Update HP/MP/EXP bars
    document.querySelector('#hp-bar .ui-bar-fill').style.width = `${hpPercent}%`;
    document.querySelector('#hp-bar .ui-bar-text').textContent = `${Math.ceil(player.hp)} / ${finalStats.finalMaxHp}`;
    document.querySelector('#mp-bar .ui-bar-fill').style.width = `${mpPercent}%`;
    document.querySelector('#mp-bar .ui-bar-text').textContent = `${Math.ceil(player.mp)} / ${finalStats.finalMaxMp}`;
    document.querySelector('#exp-bar .ui-bar-fill').style.width = `${expPercent}%`;
    document.getElementById('exp-text').textContent = `EXP: ${Math.floor(player.exp).toLocaleString()} [${Math.floor(expPercent)}%]`;

    // Update on-player HP bar
    const playerHpBarContainer = document.getElementById('player-hp-bar-container');
    const playerHpBarFill = document.getElementById('player-hp-bar-fill');
    if (player.hp < finalStats.finalMaxHp && !player.isDead) {
        playerHpBarContainer.style.display = 'block';
        playerHpBarFill.style.width = `${hpPercent}%`;
    } else {
        playerHpBarContainer.style.display = 'none';
    }

    // Update buff icons and timers in real-time
    if (typeof updateBuffUI === 'function') {
        updateBuffUI();
    }
}

function updateUI() {
    if (!player || !player.stats) return;

    // --- Part 1: Real-time updates (run every frame) ---
    const finalStats = calculatePlayerStats();
    const hpPercent = (player.hp / finalStats.finalMaxHp) * 100;
    const mpPercent = (player.mp / finalStats.finalMaxMp) * 100;
    const expPercent = (player.exp / player.maxExp) * 100;

    document.querySelector('#hp-bar .ui-bar-fill').style.width = `${hpPercent}%`;
    document.querySelector('#hp-bar .ui-bar-text').textContent = `${Math.ceil(player.hp)} / ${finalStats.finalMaxHp}`;
    document.querySelector('#mp-bar .ui-bar-fill').style.width = `${mpPercent}%`;
    document.querySelector('#mp-bar .ui-bar-text').textContent = `${Math.ceil(player.mp)} / ${finalStats.finalMaxMp}`;
    document.querySelector('#exp-bar .ui-bar-fill').style.width = `${expPercent}%`;
    document.getElementById('exp-text').textContent = `EXP: ${Math.floor(player.exp).toLocaleString()} [${Math.floor(expPercent)}%]`;

    if (typeof updateBuffUI === 'function') {
        updateBuffUI();
    }

    // --- Part 2: Static updates (only run if data has changed to be efficient) ---
    if (player.name !== lastHudState.name || player.class !== lastHudState.class || player.level !== lastHudState.level) {

        const nameUI = document.getElementById('player-name-ui');
        const classUI = document.getElementById('player-class-ui');
        const levelUI = document.getElementById('player-level-ui');
        const portraitUI = document.getElementById('player-portrait');

        if (nameUI) nameUI.textContent = player.name;
        if (classUI) classUI.textContent = capitalize(player.class);
        if (levelUI) levelUI.textContent = `Lvl ${player.level}`;

        if (portraitUI) {
            const className = capitalize(player.class);
            const classIconData = spriteData.classIcons.icons[className];
            let classIconHTML = '';

            if (classIconData) {
                const frameWidth = spriteData.classIcons.frameWidth;
                const scale = 4;
                classIconHTML = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.classIcons}); background-position: -${classIconData.x}px -${classIconData.y}px; transform: scale(${scale}); transform-origin: center;"></div>`;
            }
            // This line was deleting the level display
            portraitUI.innerHTML = classIconHTML;

            // FIX 2: Add the level display back after the icon is drawn
            if (levelUI) {
                portraitUI.appendChild(levelUI);
            }
        }

        lastHudState.name = player.name;
        lastHudState.class = player.class;
        lastHudState.level = player.level;
    }

    updateHotkeyNotifications();

    const playerHpBarContainer = document.getElementById('player-hp-bar-container');
    const playerHpBarFill = document.getElementById('player-hp-bar-fill');
    if (player.hp < finalStats.finalMaxHp && !player.isDead) {
        playerHpBarContainer.style.display = 'block';
        playerHpBarFill.style.width = `${hpPercent}%`;
    } else {
        playerHpBarContainer.style.display = 'none';
    }
}

/**
 * Efficiently updates buff icons and on-player visual effects by only
 * changing what is necessary each frame, preventing performance issues.
 */
function updateBuffUI() {
    const buffContainer = document.getElementById('buff-container');
    const buffEffectContainer = document.getElementById('player-buff-effects');
    if (!buffContainer || !buffEffectContainer) return;

    const activeBuffNames = new Set(player.buffs.map(b => b.name));

    // --- Part 1: Update Buff Icons on the HUD ---

    // Remove icons from the DOM for buffs that are no longer active
    for (const child of Array.from(buffContainer.children)) {
        if (!activeBuffNames.has(child.dataset.buffName)) {
            child.remove();
        }
    }

    // Add new icons for active buffs that aren't in the DOM yet, and update all timers
    player.buffs.forEach(buff => {
        let buffElement = buffContainer.querySelector(`[data-buff-name="${buff.name}"]`);

        // If the buff icon doesn't exist, create it once
        if (!buffElement) {
            buffElement = document.createElement('div');
            buffElement.className = 'buff-icon';
            buffElement.dataset.buffName = buff.name;

            let iconData, assetSheet, frameWidth, scale;

            if (spriteData.skillIcons.icons[buff.name]) {
                iconData = spriteData.skillIcons.icons[buff.name];
                assetSheet = artAssets.skillIcons;
                frameWidth = spriteData.skillIcons.frameWidth;
                scale = 2; // Scale 16px to 32px
            } else if (spriteData.dropIcons.icons[buff.name]) {
                iconData = spriteData.dropIcons.icons[buff.name];
                assetSheet = artAssets.dropIcons;
                frameWidth = spriteData.dropIcons.frameWidth;
                scale = 4; // Scale 8px to 32px
            }

            if (iconData) {
                const iconHTML = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${assetSheet}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center;"></div>`;
                buffElement.innerHTML = iconHTML;
            }

            const timerElement = document.createElement('span');
            timerElement.className = 'buff-timer';
            buffElement.appendChild(timerElement);
            buffContainer.appendChild(buffElement);
        }

        // Always update the timer text and tooltip
        const timerElement = buffElement.querySelector('.buff-timer');
        const timeLeft = Math.max(0, Math.ceil((buff.endTime - Date.now()) / 1000));

        if (timerElement.textContent !== timeLeft.toString()) {
            timerElement.textContent = timeLeft;
        }

        addTooltipEvents(buffElement, () => `<h4>${buff.displayName}</h4><p>Time remaining: ${timeLeft}s</p>`);
    });

    // --- Part 2: Update Visual Effects on the Player Sprite (THE FIX) ---

    // Remove visual effects from the DOM for buffs that are no longer active
    for (const child of Array.from(buffEffectContainer.children)) {
        if (!activeBuffNames.has(child.dataset.buffEffectName)) {
            child.remove();
        }
    }

    // Add new visual effects for active buffs that aren't in the DOM yet
    player.buffs.forEach(buff => {
        const effectExists = buffEffectContainer.querySelector(`[data-buff-effect-name="${buff.name}"]`);
        if (buffVisualEffects[buff.name] && !effectExists) {
            const effectEl = document.createElement('div');
            effectEl.dataset.buffEffectName = buff.name;
            effectEl.innerHTML = buffVisualEffects[buff.name];
            buffEffectContainer.appendChild(effectEl);
        }
    });
}

function updateSkillHotbarUI() {
    // --- THIS IS THE FIX ---
    // Add a "guard clause" to prevent this function from running before a character is loaded.
    if (!player || !player.hotbar) {
        return;
    }
    // --- END OF FIX ---

    const skillHotbarElement = document.getElementById('skill-hotbar');
    skillHotbarElement.innerHTML = '';
    
    // Check if gamepad is connected AND not forced to keyboard mode
    const isGamepadMode = typeof gamepadManager !== 'undefined' && 
                          gamepadManager.gamepad !== null && 
                          !gamepadManager.forceKeyboardMode;
    const hotbarSlotCount = isGamepadMode ? 8 : 12;

    function createHotbarSlot(slotIndex, keyMapping, buttonIcon = null) {
        const slot = document.createElement('div');
        slot.className = 'skill-slot hotbar-drop-zone';
        slot.dataset.index = slotIndex;
        const hotbarItem = player.hotbar[slotIndex];

        let iconHTML = '';
        let tooltipContent = '';

        if (hotbarItem && hotbarItem.name) {
            if (hotbarItem.type === 'skill') {
                let skillInfo = null;
                if (skillData[player.class]) {
                    skillInfo = skillData[player.class].find(s => s.name === hotbarItem.name);
                }
                if (!skillInfo && skillData.beginner) {
                    skillInfo = skillData.beginner.find(s => s.name === hotbarItem.name);
                }
                if (!skillInfo) {
                    for (const className in skillData) {
                        if (skillData[className] && Array.isArray(skillData[className])) {
                            const found = skillData[className].find(s => s.name === hotbarItem.name);
                            if (found) {
                                skillInfo = found;
                                break;
                            }
                        }
                    }
                }

                const learnedSkill = player.abilities.find(a => a.name === hotbarItem.name);
                if (skillInfo && learnedSkill) {
                    const iconData = spriteData.skillIcons.icons[skillInfo.name];
                    if (iconData) {
                        const frameWidth = spriteData.skillIcons.frameWidth;
                        const scale = 3;
                        iconHTML = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.skillIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center;"></div>`;
                    }
                    const levelIndex = Math.min(learnedSkill.level - 1, skillInfo.levels.length - 1);
                    const skillDetails = skillInfo.levels[levelIndex];
                    tooltipContent = `<h4>${skillInfo.displayName} [Lv. ${learnedSkill.level}]</h4><p>MP Cost: ${skillDetails.mpCost}\n${skillDetails.desc}</p>`;
                }
            } else if (hotbarItem.type === 'item') {
                const itemInfo = itemData[hotbarItem.name];
                const inventoryItem = player.inventory.use.find(i => i.name === hotbarItem.name);
                if (itemInfo) {
                    const iconData = spriteData.dropIcons.icons[hotbarItem.name];
                    if (iconData) {
                        const frameWidth = spriteData.dropIcons.frameWidth;
                        const scale = 5;
                        let filterStyle = '';
                        if (hotbarItem.name === 'Rusty Iron Sword') {
                            filterStyle = 'filter: brightness(0.6) sepia(0.3) hue-rotate(15deg);';
                        } else if (hotbarItem.name === 'Dull Sword') {
                            filterStyle = 'filter: brightness(0.8) saturate(0.5);';
                        }
                        iconHTML = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.dropIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center; ${filterStyle}"></div>`;
                    }
                    if (inventoryItem) {
                        iconHTML += `<span class="item-quantity-top-left">${inventoryItem.quantity}</span>`;
                    }
                    tooltipContent = buildTooltipHtml({ name: hotbarItem.name });
                }
            }

            slot.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                addChatMessage(`${hotbarItem.name} removed from hotbar.`, 'common');
                player.hotbar[slotIndex] = null;
                updateSkillHotbarUI();
            });
        }

        // Display controller button icon in gamepad mode, keyboard key otherwise
        let keyLabel;
        if (buttonIcon) {
            keyLabel = buttonIcon;  // Use controller button icon
        } else {
            keyLabel = typeof keyMappingManager !== 'undefined' ?
                keyMappingManager.getKeyLabel(keyMappingManager.getMappedKey(keyMapping)) :
                keyMapping.replace('hotbar-', '');
        }
        slot.innerHTML = iconHTML + `<span class="hotkey-num">${keyLabel}</span>`;

        if (tooltipContent) {
            addTooltipEvents(slot, tooltipContent);
        }

        addHotbarDropListeners(slot, slotIndex);
        return slot;
    }

    if (isGamepadMode) {
        // Gamepad mode: Dynamically find which buttons are mapped to each hotbar slot
        const singleRow = document.createElement('div');
        singleRow.className = 'hotbar-row hotbar-gamepad-mode';
        
        // For each hotbar slot 1-6, find which button triggers it
        for (let hotbarSlot = 1; hotbarSlot <= 6; hotbarSlot++) {
            let buttonIcon = '?';
            const hotbarAction = `hotbar-${hotbarSlot}`;
            
            // Search through button map to find which button triggers this hotbar slot
            for (let buttonIndex = 0; buttonIndex < 16; buttonIndex++) {
                const mappedAction = gamepadManager.buttonMap[buttonIndex];
                
                // Regular hotbar mapping
                if (mappedAction === hotbarAction) {
                    const fullName = gamepadManager.getButtonName(buttonIndex);
                    buttonIcon = fullName.split(' ')[0]; // Get first part
                    break;
                }
            }
            
            // If no button found, show empty or question mark
            if (buttonIcon === '?') {
                buttonIcon = '--';
            }
            
            singleRow.appendChild(createHotbarSlot(hotbarSlot - 1, hotbarAction, buttonIcon));
        }
        
        skillHotbarElement.appendChild(singleRow);
    } else {
        // Keyboard mode: 12 slots in two rows with keyboard numbers
        const topRow = document.createElement('div');
        topRow.className = 'hotbar-row';
        for (let i = 0; i < 6; i++) {
            topRow.appendChild(createHotbarSlot(i, `hotbar-${i + 1}`));
        }
        skillHotbarElement.appendChild(topRow);

        const bottomRow = document.createElement('div');
        bottomRow.className = 'hotbar-row';
        for (let i = 6; i < 12; i++) {
            bottomRow.appendChild(createHotbarSlot(i, `hotbar-${i + 1}`));
        }
        skillHotbarElement.appendChild(bottomRow);
    }

    const expBar = document.getElementById('exp-bar');
    expBar.onmouseover = (e) => showTooltip(e, `<h4>Experience</h4><p>EXP: ${Math.floor(player.exp).toLocaleString()} / ${player.maxExp.toLocaleString()}</p>`);
    expBar.onmouseout = hideTooltip;
}

// Drag and Drop System for Hotbar
let draggedItem = null;
let draggedFromHotbar = false;
let draggedHotbarSlot = null;
let draggedEquipmentItem = null;
let draggedFromInventory = false;
let draggedInventoryIndex = null;
let draggedInventoryTab = null;

// Clean up old hotbar structure
function migrateHotbar() {
    // Ensure hotbar has 12 slots
    if (!player.hotbar || player.hotbar.length !== 12) {
        const oldHotbar = player.hotbar || [];
        player.hotbar = new Array(12).fill(null);

        // Copy over existing valid items
        for (let i = 0; i < Math.min(oldHotbar.length, 4); i++) {
            if (oldHotbar[i] && typeof oldHotbar[i] === 'object' && oldHotbar[i].name) {
                player.hotbar[i] = oldHotbar[i];
            }
        }

        // Add default potions to slots 4 and 5 for new characters
        if (player.level <= 1) {
            player.hotbar[4] = { name: 'Red Potion', type: 'item' };
            player.hotbar[5] = { name: 'Blue Potion', type: 'item' };
        }
    }

    // Ensure all hotbar items have proper type
    for (let i = 0; i < player.hotbar.length; i++) {
        if (player.hotbar[i] && !player.hotbar[i].type) {
            // Determine type based on item name
            const itemName = player.hotbar[i].name;
            if (itemData[itemName]) {
                player.hotbar[i].type = 'item';
            } else {
                player.hotbar[i].type = 'skill';
            }
        }
    }
}

/**
 * Makes a DOM element draggable onto the skill hotbar.
 * @param {HTMLElement} element The element to make draggable.
 * @param {object} itemInfo An object with {name, type} for the hotbar.
 */
function makeHotbarDraggable(element, itemInfo) {
    element.draggable = true;

    element.addEventListener('dragstart', (e) => {
        draggedItem = itemInfo;
        e.dataTransfer.effectAllowed = 'copy';
    });

    element.addEventListener('dragend', () => {
        draggedItem = null;
    });
    
    // Add click handler for gamepad mode - show slot assignment menu
    element.addEventListener('click', (e) => {
        const isGamepadMode = document.body.classList.contains('gamepad-active');
        if (isGamepadMode && typeof showGamepadHotbarMenu === 'function') {
            e.preventDefault();
            e.stopPropagation();
            showGamepadHotbarMenu(itemInfo);
        }
    });
}

function addHotbarDropListeners(slotElement, slotIndex) {
    // Allow drop
    slotElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        slotElement.classList.add('drag-over');
    });

    slotElement.addEventListener('dragleave', () => {
        slotElement.classList.remove('drag-over');
    });

    slotElement.addEventListener('drop', (e) => {
        e.preventDefault();
        slotElement.classList.remove('drag-over');

        console.log('Drop event triggered on slot', slotIndex);
        console.log('draggedItem at drop:', draggedItem);
        console.log('draggedItem.name at drop:', draggedItem?.name);
        console.log('JSON of draggedItem at drop:', JSON.stringify(draggedItem));

        if (draggedItem) {
            handleHotbarDrop(draggedItem, slotIndex);
        } else {
            console.log('No draggedItem found during drop');
        }
    });

    // Make items in hotbar draggable
    if (player.hotbar[slotIndex]) {
        slotElement.draggable = true;
        slotElement.addEventListener('dragstart', (e) => {
            draggedItem = player.hotbar[slotIndex];
            draggedFromHotbar = true;
            draggedHotbarSlot = slotIndex;
            e.dataTransfer.effectAllowed = 'move';
        });

        slotElement.addEventListener('dragend', () => {
            draggedItem = null;
            draggedFromHotbar = false;
            draggedHotbarSlot = null;
        });
    }
}

function handleHotbarDrop(item, targetSlot) {
    // Debug logging
    console.log('handleHotbarDrop called with:', item, targetSlot);
    console.log('Global draggedItem:', draggedItem);
    console.log('Item name:', item?.name, 'Item type:', item?.type);
    console.log('Item keys:', Object.keys(item || {}));

    // Use the global draggedItem directly since it might be more reliable
    const actualItem = draggedItem || item;
    console.log('Using actualItem:', actualItem);

    // Let's see exactly what keys and values are in the object
    if (actualItem) {
        console.log('=== DETAILED OBJECT INSPECTION ===');
        Object.keys(actualItem).forEach(key => {
            console.log(`Key: "${key}", Value: "${actualItem[key]}", Type: ${typeof actualItem[key]}`);
        });
        console.log('JSON stringify:', JSON.stringify(actualItem));
        console.log('=== END INSPECTION ===');
    }

    if (!actualItem || (!actualItem.name && !actualItem.displayName)) {
        console.error('Invalid item dropped - no name found:', actualItem);
        addChatMessage('Invalid item - could not add to hotbar.', 'error');
        return;
    }

    // Use displayName if name is not available
    const itemName = actualItem.name || actualItem.displayName;
    if (!itemName) {
        console.error('Invalid item dropped - no valid name:', actualItem);
        addChatMessage('Invalid item - could not add to hotbar.', 'error');
        return;
    }

    if (draggedFromHotbar && draggedHotbarSlot !== null) {
        // Swap items if dragging from hotbar to hotbar
        const tempItem = player.hotbar[targetSlot];
        player.hotbar[targetSlot] = player.hotbar[draggedHotbarSlot];
        player.hotbar[draggedHotbarSlot] = tempItem;
        addChatMessage(`${itemName} moved to hotbar slot ${targetSlot + 1}.`, 'common');
    } else {
        // Adding new item to hotbar
        player.hotbar[targetSlot] = {
            name: itemName,
            type: actualItem.type || (actualItem.mpCost !== undefined ? 'skill' : 'item')
        };
        addChatMessage(`${itemName} added to hotbar slot ${targetSlot + 1}.`, 'common');
    }

    updateSkillHotbarUI();
}

/**
 * Shows/hides notification icons on the main UI hotkeys for AP, SP, and achievements.
 */
function updateHotkeyNotifications() {
    const skillHotkey = document.getElementById('hotkey-k');
    const statHotkey = document.getElementById('hotkey-s');
    const achievementHotkey = document.getElementById('hotkey-a');
    if (!skillHotkey || !statHotkey || !achievementHotkey) return;

    [skillHotkey, statHotkey, achievementHotkey].forEach(el => el.querySelector('.hotkey-notification')?.remove());

    if (player.sp > 0 || (player.beginnerSp || 0) > 0) {
        const sp_notify = document.createElement('div');
        sp_notify.className = 'hotkey-notification pixel-art';
        const iconData = spriteData.uiIcons.icons.plusIcon;
        sp_notify.style.width = '24px';
        sp_notify.style.height = '24px';
        sp_notify.style.backgroundImage = `url(${artAssets.uiIcons})`;
        sp_notify.style.backgroundPosition = `-${iconData.x * 1.5}px -${iconData.y * 1.5}px`;
        sp_notify.style.backgroundSize = '72px 72px';
        sp_notify.style.imageRendering = 'pixelated';
        skillHotkey.appendChild(sp_notify);
    }

    if (player.ap > 0) {
        const ap_notify = document.createElement('div');
        ap_notify.className = 'hotkey-notification pixel-art';
        const iconData = spriteData.uiIcons.icons.plusIcon;
        ap_notify.style.width = '24px';
        ap_notify.style.height = '24px';
        ap_notify.style.backgroundImage = `url(${artAssets.uiIcons})`;
        ap_notify.style.backgroundPosition = `-${iconData.x * 1.5}px -${iconData.y * 1.5}px`;
        ap_notify.style.backgroundSize = '72px 72px';
        ap_notify.style.imageRendering = 'pixelated';
        statHotkey.appendChild(ap_notify);
    }

    const hasUnclaimed = Object.keys(player.achievements.completed).some(id => !player.achievements.claimed[id]);
    if (hasUnclaimed) {
        const ach_notify = document.createElement('div');
        ach_notify.className = 'hotkey-notification pixel-art';
        const iconData = spriteData.uiIcons.icons.exclamation;
        ach_notify.style.width = '24px';
        ach_notify.style.height = '24px';
        ach_notify.style.backgroundImage = `url(${artAssets.uiIcons})`;
        ach_notify.style.backgroundPosition = `-${iconData.x * 1.5}px -${iconData.y * 1.5}px`;
        ach_notify.style.backgroundSize = '72px 72px';
        ach_notify.style.imageRendering = 'pixelated';
        achievementHotkey.appendChild(ach_notify);
    }
}

// --- Window Content Updaters ---

function updateInventoryUI() {
    const tabsContainer = document.getElementById('inventory-tabs');
    const inventoryGrid = document.getElementById('inventory-grid');
    const enhanceItemBtn = document.getElementById('enhance-item-btn');
    const inventoryTrashBtn = document.getElementById('inventory-trash-btn'); // Get reference to the button
    tabsContainer.innerHTML = '';
    const tabNames = ['equip', 'use', 'etc', 'cosmetic'];

    tabNames.forEach(tabName => {
        const tabBtn = document.createElement('button');
        tabBtn.className = 'tab-btn';
        tabBtn.textContent = capitalize(tabName);
        if (tabName === activeInventoryTab) tabBtn.classList.add('active');
        tabBtn.onclick = () => {
            activeInventoryTab = tabName;
            selectedInventoryIndex = null;
            updateInventoryUI();
        };
        tabsContainer.appendChild(tabBtn);
    });

    inventoryGrid.innerHTML = '';
    const activeInventory = player.inventory[activeInventoryTab] || [];
    const slotsPerTab = player.inventorySlots || 16;

    for (let i = 0; i < slotsPerTab; i++) {
        const slot = document.createElement('div');
        slot.className = 'inventory-slot';
        const item = activeInventory[i];
        if (item) {
            const itemInfo = itemData[item.name];
            
            // Skip items that don't exist in itemData
            if (!itemInfo) {
                console.error(`Item data not found for: ${item.name}`);
                continue;
            }
            
            const iconData = spriteData.dropIcons.icons[item.name];

            if (iconData) {
                const frameWidth = spriteData.dropIcons.frameWidth;
                const scale = 6;
                const innerIcon = document.createElement('div');
                innerIcon.className = 'pixel-art';

                let filterStyle = '';
                if (item.name === 'Rusty Iron Sword') {
                    filterStyle = 'filter: brightness(0.6) sepia(0.3) hue-rotate(15deg);';
                } else if (item.name === 'Dull Sword') {
                    filterStyle = 'filter: brightness(0.8) saturate(0.5);';
                }

                innerIcon.style.cssText = `width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.dropIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center; ${filterStyle}`;
                slot.appendChild(innerIcon);
            } else {
                console.error(`Icon not found for item: ${item.name}`);
            }

            if (item.quantity > 1) {
                const quantityEl = document.createElement('span');
                quantityEl.className = 'item-quantity';
                quantityEl.textContent = item.quantity;
                slot.appendChild(quantityEl);
            }

            const rarity = item.rarity || (item.isQuestItem ? 'quest' : (itemInfo.category === 'Cosmetic' ? 'cosmetic' : 'common'));
            slot.classList.add(rarity);

            if (itemInfo.type === 'weapon' && item.enhancement) {
                if (item.enhancement >= 10) slot.classList.add('weapon-glow-red');
                else if (item.enhancement >= 7) slot.classList.add('weapon-glow-blue');
            }

            slot.dataset.index = i;

            let comparisonItem = null;
            if (itemInfo.category === 'Equip' || itemInfo.category === 'Cosmetic') {
                const targetEquipSet = itemInfo.category === 'Cosmetic' ? player.cosmeticEquipped : player.equipped;
                comparisonItem = targetEquipSet[itemInfo.type];
            }
            addTooltipEvents(slot, () => buildTooltipHtml(activeInventory[i], comparisonItem));

            if (i === selectedInventoryIndex && itemInfo.category === 'Equip') slot.classList.add('selected');
            
            // This makes the item draggable if its category is "Use"
            if (itemInfo.category === 'Use') {
                makeHotbarDraggable(slot, { name: item.name, type: 'item' });
            }
            
            // Make Equip and Cosmetic items draggable to equipment slots
            if (itemInfo.category === 'Equip' || itemInfo.category === 'Cosmetic') {
                slot.draggable = true;
                slot.addEventListener('dragstart', (e) => {
                    // Store the actual item data (not a copy)
                    draggedEquipmentItem = item;
                    draggedFromInventory = true;
                    draggedInventoryIndex = i;
                    draggedInventoryTab = activeInventoryTab;
                    e.dataTransfer.effectAllowed = 'move';
                    slot.style.opacity = '0.5';
                });
                slot.addEventListener('dragend', () => {
                    slot.style.opacity = '1';
                    // Reset drag state
                    draggedEquipmentItem = null;
                    draggedFromInventory = false;
                    draggedInventoryIndex = null;
                    draggedInventoryTab = null;
                });
            }

            slot.onclick = () => {
                console.log('[Inventory] Single click on slot', i, 'item:', item.name, 'category:', itemInfo.category);
                if (itemInfo.category === 'Equip') {
                    selectedInventoryIndex = i;
                    updateInventoryUI();
                }
            };
            slot.addEventListener('dblclick', (e) => {
                console.log('[Inventory] DOUBLE-CLICK detected on slot', i, 'item:', item.name, 'category:', itemInfo.category);
                console.log('[Inventory] Event details:', e);
                if (itemInfo.category === 'Equip' || itemInfo.category === 'Cosmetic') {
                    console.log('[Inventory] Calling equipItem for:', item.name);
                    equipItem(item, i);
                } else if (itemInfo.category === 'Use') {
                    console.log('[Inventory] Calling useItem for:', item.name);
                    useItem(item, i, activeInventoryTab);
                }
            });
        }
        inventoryGrid.appendChild(slot);
    }
    
    // Update gold display with animated coin
    const goldAmountEl = document.getElementById('inventory-gold-amount');
    if (goldAmountEl) {
        goldAmountEl.textContent = player.gold.toLocaleString();
    }
    
    // Display coin icon
    const coinImg = document.getElementById('gold-coin-img');
    if (coinImg && !coinImg.src) {
        coinImg.src = artAssets.coin;
    }
    
    const selectedItem = player.inventory[activeInventoryTab]?.[selectedInventoryIndex];
    enhanceItemBtn.disabled = !selectedItem || itemData[selectedItem.name]?.category !== 'Equip' || itemData[selectedItem.name]?.canEnhance === false;

    // --- THIS IS THE FIX ---
    // Use the 'disabled' property for the button instead of a class.
    inventoryTrashBtn.disabled = !selectedItem;
    // --- END OF FIX ---
}

// Achievement tab state
let achievementTabsSetup = false;

function setupAchievementTabs() {
    if (achievementTabsSetup) return;
    
    const tabButtons = document.querySelectorAll('.achievement-tab-button');
    const tabContents = document.querySelectorAll('#achievement-window .achievement-tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            if (e.target.classList.contains('active')) return;

            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab
            e.target.classList.add('active');
            const targetTab = e.target.dataset.tab;
            
            if (targetTab === 'achievements') {
                document.getElementById('achievement-list').classList.add('active');
            } else if (targetTab === 'medals') {
                document.getElementById('medals-list').classList.add('active');
                updateMedalsTab();
            }
        });
    });
    
    achievementTabsSetup = true;
}

function updateEquipmentUI() {
    const enhanceBtn = document.getElementById('equipment-enhance-btn');

    // Update regular equipment
    document.querySelectorAll('#equipment-display .equip-slot').forEach(slot => {
        const slotType = slot.dataset.slot;
        const item = player.equipped[slotType];
        
        // Add drag-and-drop support for equipment slots
        slot.addEventListener('dragover', (e) => {
            if (draggedEquipmentItem && draggedFromInventory) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                slot.classList.add('drag-over');
            }
        });
        
        slot.addEventListener('dragleave', () => {
            slot.classList.remove('drag-over');
        });
        
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            
            if (draggedEquipmentItem && draggedFromInventory) {
                const itemInfo = itemData[draggedEquipmentItem.name];
                
                // Check if item matches the slot type
                if (itemInfo && itemInfo.type === slotType) {
                    // Check level requirement
                    if (player.level < (draggedEquipmentItem.levelReq || itemInfo.levelReq || 1)) {
                        showNotification("Level too low!", 'error');
                        return;
                    }
                    
                    // Check class requirement
                    if (itemInfo.classReq) {
                        let canEquip = false;
                        let currentClass = player.class;
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
                    
                    // Equip the item - get fresh reference from inventory
                    const itemToEquip = player.inventory[draggedInventoryTab][draggedInventoryIndex];
                    
                    if (player.equipped[slotType]) {
                        // Swap: put currently equipped item back in inventory
                        const currentlyEquipped = player.equipped[slotType];
                        player.inventory[draggedInventoryTab][draggedInventoryIndex] = currentlyEquipped;
                        player.equipped[slotType] = itemToEquip;
                    } else {
                        // Remove from inventory and equip
                        player.inventory[draggedInventoryTab].splice(draggedInventoryIndex, 1);
                        player.equipped[slotType] = itemToEquip;
                    }
                    
                    playSound('equipItem');
                    
                    // Clear drag state
                    draggedEquipmentItem = null;
                    draggedFromInventory = false;
                    draggedInventoryIndex = null;
                    draggedInventoryTab = null;
                    
                    selectedInventoryIndex = null;
                    updateInventoryUI();
                    updateEquipmentUI();
                    updateUI();
                    
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
        });

        // --- THIS IS THE MODIFIED LOGIC ---
        // Single-click now handles selection without a full UI refresh.
        slot.onclick = () => {
            // If there's no item, do nothing.
            if (!item) {
                selectedEquipmentSlot = null;
            }
            // If this item is already selected, deselect it.
            else if (selectedEquipmentSlot === slotType) {
                selectedEquipmentSlot = null;
            }
            // Otherwise, select this item.
            else {
                selectedEquipmentSlot = slotType;
            }

            // Manually update the 'selected' visual for all slots.
            document.querySelectorAll('#equipment-display .equip-slot').forEach(s => {
                s.classList.toggle('selected', s.dataset.slot === selectedEquipmentSlot);
            });

            // Update the enhance button's state.
            enhanceBtn.disabled = !selectedEquipmentSlot;
        };

        // Double-click now correctly unequips the item.
        slot.ondblclick = () => {
            if (!item) return; // Prevent unequipping an empty slot
            selectedEquipmentSlot = null;
            dequipItem(slotType, false);
        };
        // --- END OF MODIFIED LOGIC ---

        // The rest of the function populates the slot's visuals.
        slot.innerHTML = '';
        slot.className = 'equip-slot'; // Reset classes
        if (item) {
            const iconData = spriteData.dropIcons.icons[item.name];
            if (iconData) {
                const frameWidth = spriteData.dropIcons.frameWidth;
                const scale = 6;
                const innerIcon = document.createElement('div');
                innerIcon.className = 'pixel-art';

                // Apply special tinting for quest items
                let filterStyle = '';
                if (item.name === 'Rusty Iron Sword') {
                    filterStyle = 'filter: brightness(0.6) sepia(0.3) hue-rotate(15deg);';
                } else if (item.name === 'Dull Sword') {
                    filterStyle = 'filter: brightness(0.8) saturate(0.5);';
                }

                innerIcon.style.cssText = `width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.dropIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center; ${filterStyle}`;
                slot.appendChild(innerIcon);
            }
            if (item.rarity) slot.classList.add(item.rarity);

            // Add weapon glow effect based on enhancement level
            const itemInfo = itemData[item.name];
            if (itemInfo && itemInfo.type === 'weapon' && item.enhancement) {
                if (item.enhancement >= 10) {
                    slot.classList.add('weapon-glow-red');
                } else if (item.enhancement >= 7) {
                    slot.classList.add('weapon-glow-blue');
                }
            }

            addTooltipEvents(slot, () => buildTooltipHtml(player.equipped[slotType]));
        }

        // Add 'selected' class if this slot is the currently selected one on initial render.
        if (selectedEquipmentSlot === slotType) {
            slot.classList.add('selected');
        }
    });

    enhanceBtn.disabled = !selectedEquipmentSlot || !player.equipped[selectedEquipmentSlot];

    // Cosmetic equipment logic with drag-and-drop support
    document.querySelectorAll('#cosmetic-equipment-display .equip-slot').forEach(slot => {
        const slotType = slot.dataset.slot;
        const item = player.cosmeticEquipped[slotType];
        
        // Add drag-and-drop support for cosmetic slots (transmog system)
        slot.addEventListener('dragover', (e) => {
            if (draggedEquipmentItem && draggedFromInventory) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                slot.classList.add('drag-over');
            }
        });
        
        slot.addEventListener('dragleave', () => {
            slot.classList.remove('drag-over');
        });
        
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            
            if (draggedEquipmentItem && draggedFromInventory) {
                const itemInfo = itemData[draggedEquipmentItem.name];
                
                // Cosmetic slots accept both Equip and Cosmetic items that match the slot type
                if (itemInfo && itemInfo.type === slotType && 
                    (itemInfo.category === 'Equip' || itemInfo.category === 'Cosmetic')) {
                    
                    // Cosmetic slots don't check level or class requirements
                    // This is the transmog system - visual only, no stats
                    
                    // Get fresh reference from inventory
                    const itemToEquip = player.inventory[draggedInventoryTab][draggedInventoryIndex];
                    
                    // Swap or equip
                    if (player.cosmeticEquipped[slotType]) {
                        const currentlyEquipped = player.cosmeticEquipped[slotType];
                        const currentItemInfo = itemData[currentlyEquipped.name];
                        
                        // ONLY cosmetic items go to cosmetic tab, everything else goes to equip tab
                        const correctTab = currentItemInfo.category === 'Cosmetic' ? 'cosmetic' : 'equip';
                        
                        // Check if there's space in the correct destination tab
                        const slotsPerTab = player.inventorySlots || 16;
                        if (player.inventory[correctTab].length >= slotsPerTab) {
                            showNotification("Inventory full!", 'error');
                            return;
                        }
                        
                        // Remove new item from source inventory
                        player.inventory[draggedInventoryTab].splice(draggedInventoryIndex, 1);
                        
                        // Add currently equipped item to its correct tab
                        player.inventory[correctTab].push(currentlyEquipped);
                        
                        // Equip the new item
                        player.cosmeticEquipped[slotType] = itemToEquip;
                    } else {
                        player.inventory[draggedInventoryTab].splice(draggedInventoryIndex, 1);
                        player.cosmeticEquipped[slotType] = itemToEquip;
                    }
                    
                    playSound('equipItem');
                    
                    // Clear drag state
                    draggedEquipmentItem = null;
                    draggedFromInventory = false;
                    draggedInventoryIndex = null;
                    draggedInventoryTab = null;
                    
                    selectedInventoryIndex = null;
                    updateInventoryUI();
                    updateEquipmentUI();
                    updateUI();
                    
                    showNotification(`${itemToEquip.name} equipped as cosmetic (no stats)`, 'system');
                    
                    // Notify server of appearance change for multiplayer
                    if (typeof sendAppearanceUpdate === 'function') {
                        sendAppearanceUpdate();
                    }
                }
            }
        });
        
        slot.innerHTML = '';
        slot.className = 'equip-slot cosmetic-slot';
        if (item) {
            const iconData = spriteData.dropIcons.icons[item.name];
            if (iconData) {
                const frameWidth = spriteData.dropIcons.frameWidth;
                const scale = 6;
                const innerIcon = document.createElement('div');
                innerIcon.className = 'pixel-art';

                // Apply special tinting for quest items
                let filterStyle = '';
                if (item.name === 'Rusty Iron Sword') {
                    filterStyle = 'filter: brightness(0.6) sepia(0.3) hue-rotate(15deg);';
                } else if (item.name === 'Dull Sword') {
                    filterStyle = 'filter: brightness(0.8) saturate(0.5);';
                }

                innerIcon.style.cssText = `width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.dropIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center; ${filterStyle}`;
                slot.appendChild(innerIcon);
            }
            slot.classList.add('cosmetic');

            // Add weapon glow effect based on enhancement level
            const itemInfo = itemData[item.name];
            if (itemInfo && itemInfo.type === 'weapon' && item.enhancement) {
                if (item.enhancement >= 10) {
                    slot.classList.add('weapon-glow-red');
                } else if (item.enhancement >= 7) {
                    slot.classList.add('weapon-glow-blue');
                }
            }

            addTooltipEvents(slot, () => buildTooltipHtml(player.cosmeticEquipped[slotType]));
            
            // Double-click to unequip cosmetic item (matches regular equipment behavior)
            slot.ondblclick = () => {
                if (item) {
                    dequipItem(slotType, true);
                }
            };
        }
    });
}

function updateSkillTreeUI() {
    const tabsContainer = document.getElementById('skill-tree-tabs');
    const container = document.getElementById('skill-tree-content');
    const spDisplay = document.getElementById('skill-points-display');

    let playerPath = {};
    let currentClassName = player.class;
    while (currentClassName) {
        const data = classHierarchy[currentClassName];
        if (data) {
            playerPath[data.tier] = currentClassName;
            currentClassName = data.parent;
        } else { break; }
    }
    const playerTier = classHierarchy[player.class]?.tier ?? 0;

    // Build tab names from actual class names in player's path
    const jobTierNames = [];
    for (let i = 0; i <= playerTier; i++) {
        if (playerPath[i]) {
            jobTierNames[i] = capitalize(playerPath[i]);
        }
    }

    tabsContainer.innerHTML = '';
    for (let i = 0; i <= playerTier; i++) {
        const tabName = jobTierNames[i];
        if (playerPath[i]) {
            const tabBtn = document.createElement('button');
            tabBtn.className = 'skill-tab-btn';
            tabBtn.textContent = tabName;
            tabBtn.dataset.tabName = tabName;
            if (tabName === activeSkillTab) {
                tabBtn.classList.add('active');
            }
            tabBtn.addEventListener('click', () => {
                activeSkillTab = tabName;
                updateSkillTreeUI();
            });
            tabsContainer.appendChild(tabBtn);
        }
    }

    container.innerHTML = '';
    const isBeginnerTabActive = activeSkillTab === 'Beginner';

    if (isBeginnerTabActive) {
        spDisplay.textContent = `Beginner SP: ${player.beginnerSp || 0}`;
    } else {
        spDisplay.textContent = `SP: ${player.sp}`;
        if ((player.beginnerSp || 0) > 0) {
            container.innerHTML += `<p style="color: var(--fail-color); text-align: center;">You must spend your remaining ${player.beginnerSp} Beginner SP to unlock these skills.</p>`;
        }
    }

    const activeTierIndex = jobTierNames.indexOf(activeSkillTab);
    const classForTab = playerPath[activeTierIndex];
    let classSkills = skillData[classForTab] || [];
    
    // Add Flash Jump to beginner tab if player has learned it (from Jump Quest)
    if (isBeginnerTabActive && player.abilities.find(a => a.name === 'Flash Jump')) {
        const flashJumpInList = classSkills.find(s => s.name === 'Flash Jump');
        if (!flashJumpInList) {
            // Add Flash Jump skill definition for display
            classSkills = [...classSkills, {
                name: 'Flash Jump', 
                displayName: 'Flash Jump', 
                levelReq: 1, 
                maxLevel: 1, 
                type: 'passive', 
                levels: [{ effect: {}, desc: 'Allows you to perform a double jump in mid-air. Press jump again while airborne.' }]
            }];
        }
    }

    classSkills.forEach(skillInfo => {
        const node = document.createElement('div');
        node.className = 'skill-node';

        node.dataset.skillName = skillInfo.displayName || skillInfo.name;

        const learnedSkill = player.abilities.find(a => a.name === skillInfo.name);
        const currentLevel = learnedSkill ? learnedSkill.level : 0;
        const levelIndex = Math.min(currentLevel > 0 ? currentLevel - 1 : 0, skillInfo.levels.length - 1);
        const skillDetails = skillInfo.levels[levelIndex];

        if (currentLevel > 0) {
            const skillName = skillInfo.displayName || skillInfo.name;

            // This makes the skill node draggable to the hotbar (unless it's a passive skill)
            if (skillInfo.type !== 'passive') {
                makeHotbarDraggable(node, { name: skillName, type: 'skill' });
            }
            const tooltipContent = `<h4>${skillInfo.displayName} [Lv. ${currentLevel}]</h4><p>MP Cost: ${skillDetails.mpCost || 0}\n${skillDetails.desc}</p>`;
            addTooltipEvents(node, tooltipContent);
        }

        const canLearn = player.level >= skillInfo.levelReq;
        if (!canLearn) {
            node.classList.add('locked');
            // Add tooltip for locked skills showing unlock level
            const lockedTooltipContent = `<h4>${skillInfo.displayName}</h4><p style="color: var(--fail-color);">Requires Level ${skillInfo.levelReq}</p><p>${skillDetails.desc}</p>`;
            addTooltipEvents(node, lockedTooltipContent);
        }

        let buttonHtml = '';
        let canLevelUp = false;
        if (isBeginnerTabActive) {
            canLevelUp = (player.beginnerSp || 0) > 0;
        } else {
            canLevelUp = (player.beginnerSp || 0) === 0 && player.sp > 0;
        }

        if (canLearn && currentLevel < skillInfo.maxLevel && canLevelUp) {
            const plusIconData = spriteData.uiIcons.icons.plusIcon;
            buttonHtml = `<button class="skill-add-btn pixel-art" data-skill-name="${skillInfo.name}" style="width: 32px; height: 32px; padding: 0; background-image: url(${artAssets.uiIcons}); background-position: -${plusIconData.x * 2}px -${plusIconData.y * 2}px; background-size: 96px 96px; background-repeat: no-repeat; image-rendering: pixelated;"></button>`;
        }

        let iconHTML = '';
        const iconData = spriteData.skillIcons.icons[skillInfo.name];
        if (iconData) {
            // --- THIS IS THE FIX ---
            // This now uses the same robust rendering method as the hotbar.
            const frameWidth = spriteData.skillIcons.frameWidth;
            const scale = 2; // Scales the 16x16 icon to 32x32
            iconHTML = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.skillIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center;"></div>`;
            // --- END OF FIX ---
        }

        // Add passive badge if applicable
        const passiveBadge = skillInfo.type === 'passive' ? '<span class="passive-badge">PASSIVE</span>' : '';
        
        node.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex-grow: 1;">
                <div style="width: 32px; height: 32px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                    ${iconHTML}
                </div>
                <div style="flex-grow: 1;">
                    <h4>${skillInfo.displayName} [${currentLevel}/${skillInfo.maxLevel}] ${passiveBadge}</h4>
                    <p>${skillDetails.desc}</p>
                </div>
            </div>
            ${buttonHtml}
        `;
        container.appendChild(node);
    });

    // Add click handlers to buttons for skill level up
    container.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling to parent node
            levelUpSkill(e.target.dataset.skillName);
        });
    });
}

// in ui.js -> REPLACE the existing updateStatWindowUI function with this one:

function updateStatWindowUI() {
    const content = document.getElementById('stat-window-content');
    const finalStats = calculatePlayerStats();

    // Beginners get auto-assigned stats, so no manual assignment
    const iconData = spriteData.uiIcons.icons.plusIcon;
    const addBtn = (stat) => (player.ap > 0 && player.class !== 'beginner') ? 
        `<button class="stat-add-btn pixel-art" data-stat="${stat}" style="width: 32px; height: 32px; padding: 0; background-image: url(${artAssets.uiIcons}); background-position: -${iconData.x * 2}px -${iconData.y * 2}px; background-size: 96px 96px; background-repeat: no-repeat; image-rendering: pixelated;"></button>` : '';
    const hpPercent = (player.hp / finalStats.finalMaxHp) * 100;
    const mpPercent = (player.mp / finalStats.finalMaxMp) * 100;
    const expPercent = (player.exp / player.maxExp) * 100;

    const combatScore = calculateCombatScore();
    
    content.innerHTML = `
        <div class="ui-bar"><div class="ui-bar-fill" style="width:${hpPercent}%;background-color:var(--hp-color);"></div><span class="ui-bar-text">HP: ${Math.ceil(player.hp)}/${finalStats.finalMaxHp}</span></div>
        <div class="ui-bar"><div class="ui-bar-fill" style="width:${mpPercent}%;background-color:var(--mp-color);"></div><span class="ui-bar-text">MP: ${Math.ceil(player.mp)}/${finalStats.finalMaxMp}</span></div>
        <div class="ui-bar"><div class="ui-bar-fill" style="width:${expPercent}%;background-color:var(--exp-color);"></div><span class="ui-bar-text">EXP: ${Math.floor(expPercent)}%</span></div>
        <div style="margin: 10px 0; padding: 10px; background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,140,0,0.2)); border-radius: 5px; border: 2px solid rgba(255,215,0,0.5);">
            <div style="text-align: center; font-size: 14px; color: var(--legendary-color); font-weight: bold; text-shadow: 0 0 10px rgba(255,215,0,0.5);">Combat Score: ${combatScore.toLocaleString()}</div>
        </div>
        <div class="stat-group">
            <div class="stat-row"><span>Damage</span><span style="color:white;">${finalStats.minDamage} ~ ${finalStats.maxDamage}</span></div>
            <div class="stat-row"><span>Defense</span><span style="color:white;">${finalStats.totalDefense}</span></div>
            <div class="stat-row"><span>Crit Chance</span><span style="color:white;">${finalStats.finalCritChance.toFixed(1)}%</span></div>
            <div class="stat-row"><span>Crit Damage</span><span style="color:white;">${Math.round(finalStats.finalMinCritDamage * 100)}%~${Math.round(finalStats.finalMaxCritDamage * 100)}%</span></div>
            <div class="stat-row"><span>Speed</span><span style="color:white;">${Math.round((player.speed / player.originalSpeed) * 100)}%</span></div>
            <div class="stat-row"><span>Jump</span><span style="color:white;">${Math.round((player.jumpForce / player.originalJumpForce) * 100)}%</span></div>
            <div class="stat-row"><span>Accuracy</span><span style="color:white;">${finalStats.finalAccuracy}</span></div>
            <div class="stat-row"><span>Avoidability</span><span style="color:white;">${finalStats.finalAvoidability}</span></div>
        </div>
        <div class="stat-group">
            <div class="stat-row"><span>STR</span><div><span>${player.stats.str}</span><span class="stat-bonus">(+${finalStats.bonusStr})</span>${addBtn('str')}</div></div>
            <div class="stat-row"><span>DEX</span><div><span>${player.stats.dex}</span><span class="stat-bonus">(+${finalStats.bonusDex})</span>${addBtn('dex')}</div></div>
            <div class="stat-row"><span>INT</span><div><span>${player.stats.int}</span><span class="stat-bonus">(+${finalStats.bonusInt})</span>${addBtn('int')}</div></div>
            <div class="stat-row"><span>LUK</span><div><span>${player.stats.luk}</span><span class="stat-bonus">(+${finalStats.bonusLuk})</span>${addBtn('luk')}</div></div>
        </div>
        <div class="ap-display">AP Available: <span>${player.ap}</span></div>
        ${player.class === 'beginner' ? '<div style="margin-top: 10px; padding: 10px; background: rgba(255,215,0,0.1); border-radius: 5px; color: var(--exp-color); font-size: var(--font-small);;">As a Beginner, stat points are automatically assigned to STR when you level up!</div>' : ''}`;

    content.querySelectorAll('.stat-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const stat = e.target.dataset.stat;
            if (player.ap > 0) {
                player.stats[stat]++;
                player.ap--;
                
                // Store which stat was being modified for gamepad
                window.gamepadLastSelectedStat = stat;
                
                updateStatWindowUI();
                updateUI();
                
                // Restore gamepad selection if applicable
                if (typeof gamepadManager !== 'undefined' && window.gamepadLastSelectedStat) {
                    setTimeout(() => {
                        const statWindow = document.getElementById('stat-window');
                        if (statWindow && gamepadManager.restoreStatSelection) {
                            gamepadManager.restoreStatSelection(statWindow);
                        }
                    }, 50);
                }
            }
        });
    });
}

function updateWorldMapUI(layout) {
    const grid = document.getElementById('world-map-grid');
    grid.innerHTML = '';

    // --- NEW: Scan all NPCs for quest statuses ---
    const questMapData = {};
    for (const mapId in maps) {
        if (maps[mapId].npcs) {
            for (const npc of maps[mapId].npcs) {
                const npcInfo = { ...npcData[npc.type], id: npc.type };
                const status = getNpcQuestStatus(npcInfo);
                if (status) {
                    // Priority: 'complete' > 'inProgress' > 'available'
                    if (!questMapData[mapId]) {
                        questMapData[mapId] = status;
                    } else if (status === 'complete') {
                        questMapData[mapId] = status; // Always overwrite with complete
                    } else if (status === 'inProgress' && questMapData[mapId] === 'available') {
                        questMapData[mapId] = status; // Overwrite available with inProgress
                    }
                }
            }
        }
    }

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute('id', 'world-map-connections');
    grid.appendChild(svg);

    if (!player.discoveredMaps) player.discoveredMaps = new Set(['ironHaven']);

    for (const mapId in maps) {
        if (player.discoveredMaps.has(mapId) && maps[mapId].portals) {
            maps[mapId].portals.forEach(portal => {
                const targetMapId = portal.targetMap;
                if (player.discoveredMaps.has(targetMapId)) {
                    const startPos = layout[mapId];
                    const endPos = layout[targetMapId];
                    if (startPos && endPos) {
                        const line = document.createElementNS(svgNS, 'line');
                        line.setAttribute('x1', `${startPos.x}%`);
                        line.setAttribute('y1', `${startPos.y}%`);
                        line.setAttribute('x2', `${endPos.x}%`);
                        line.setAttribute('y2', `${endPos.y}%`);
                        line.setAttribute('stroke', 'rgba(255, 255, 255, 0.4)');
                        line.setAttribute('stroke-width', '2');
                        svg.appendChild(line);
                    }
                }
            });
        }
    }

    // Initialize with current map selected
    let selectedMapId = player.currentMapId;
    
    for (const mapId in layout) {
        const pos = layout[mapId];
        const mapNode = document.createElement('div');
        mapNode.className = 'world-map-node';
        mapNode.style.left = `${pos.x}%`;
        mapNode.style.top = `${pos.y}%`;
        mapNode.style.transform = 'translate(-50%, -50%)';

        const displayName = mapId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        mapNode.textContent = displayName;

        if (player.discoveredMaps.has(mapId)) {
            mapNode.classList.add('discovered');
        }

        if (mapId === player.currentMapId) {
            mapNode.classList.add('current');
            const playerIcon = document.createElement('div');
            playerIcon.className = 'world-map-player-icon';
            mapNode.appendChild(playerIcon);
        }

        // Add quest icon to map node if available
        if (questMapData[mapId]) {
            const questIcon = document.createElement('div');
            questIcon.className = 'world-map-quest-indicator pixel-art';
            let iconData;
            if (questMapData[mapId] === 'complete') {
                iconData = spriteData?.uiIcons?.icons?.questComplete;
            } else if (questMapData[mapId] === 'inProgress') {
                iconData = spriteData?.uiIcons?.icons?.questInProgress;
            } else {
                iconData = spriteData?.uiIcons?.icons?.questAvailable;
            }
            if (iconData && iconData.x !== undefined && iconData.y !== undefined) {
                questIcon.style.width = '32px';
                questIcon.style.height = '32px';
                questIcon.style.backgroundImage = `url(${artAssets.uiIcons})`;
                questIcon.style.backgroundPosition = `-${iconData.x * 2}px -${iconData.y * 2}px`;
                questIcon.style.backgroundSize = `96px 96px`;
                questIcon.style.imageRendering = 'pixelated';
                mapNode.appendChild(questIcon);
            }
        }
        
        // Add player dots for online players
        const onlinePlayersHere = typeof getOnlinePlayers === 'function' ? 
            getOnlinePlayers().filter(p => p.currentMap === mapId) : [];
        
        if (onlinePlayersHere.length > 0) {
            const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : { partyId: null };
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'world-map-player-dots';
            
            // Group by party membership and limit display
            let partyCount = 0;
            let otherCount = 0;
            
            onlinePlayersHere.forEach(p => {
                const isPartyMember = partyInfo.partyId && p.partyId === partyInfo.partyId;
                if (isPartyMember) partyCount++;
                else otherCount++;
            });
            
            // Show up to 3 dots per category, then show count
            if (partyCount > 0) {
                if (partyCount <= 3) {
                    for (let i = 0; i < partyCount; i++) {
                        const dot = document.createElement('div');
                        dot.className = 'player-dot party-member';
                        dot.title = 'Party member';
                        dotsContainer.appendChild(dot);
                    }
                } else {
                    const dot = document.createElement('div');
                    dot.className = 'player-dot party-member';
                    dot.textContent = partyCount;
                    dot.title = `${partyCount} party members`;
                    dotsContainer.appendChild(dot);
                }
            }
            
            if (otherCount > 0) {
                if (otherCount <= 3) {
                    for (let i = 0; i < otherCount; i++) {
                        const dot = document.createElement('div');
                        dot.className = 'player-dot other-player';
                        dot.title = 'Other player';
                        dotsContainer.appendChild(dot);
                    }
                } else {
                    const dot = document.createElement('div');
                    dot.className = 'player-dot other-player';
                    dot.textContent = otherCount;
                    dot.title = `${otherCount} other players`;
                    dotsContainer.appendChild(dot);
                }
            }
            
            mapNode.appendChild(dotsContainer);
        }

        // Add click functionality to select map and show details
        if (player.discoveredMaps.has(mapId)) {
            mapNode.style.cursor = 'pointer';
            mapNode.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Remove selected class from all nodes
                document.querySelectorAll('.world-map-node').forEach(n => n.classList.remove('selected'));
                mapNode.classList.add('selected');
                
                selectedMapId = mapId;
                updateMapDetails(mapId, questMapData[mapId]);
            });
        }

        grid.appendChild(mapNode);
    }
    
    // Update map details panel
    function updateMapDetails(mapId, questStatus) {
        const mapData = maps[mapId];
        const displayName = mapId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        
        document.getElementById('map-detail-name').textContent = displayName;
        
        let detailsHTML = '';
        
        // Show monsters
        if (mapData && mapData.monsters && mapData.monsters.length > 0) {
            const monsterNames = mapData.monsters
                .filter(m => m.type !== 'testDummy')
                .map(m => {
                    const monsterData = monsterTypes[m.type];
                    return monsterData ? monsterData.name : m.type;
                })
                .filter((name, index, self) => self.indexOf(name) === index);
            
            if (monsterNames.length > 0) {
                detailsHTML += `<div style="margin-bottom: 15px;"><strong>Monsters:</strong><br>${monsterNames.map(name => `• ${name}`).join('<br>')}</div>`;
            }
        }
        
        // Show NPCs
        if (mapData && mapData.npcs && mapData.npcs.length > 0) {
            const npcNames = mapData.npcs.map(npc => {
                const npcInfo = npcData[npc.type];
                return npcInfo ? npcInfo.name : npc.type;
            });
            
            detailsHTML += `<div style="margin-bottom: 15px;"><strong>NPCs:</strong><br>${npcNames.map(name => `• ${name}`).join('<br>')}</div>`;
        }
        
        // Show quest status
        if (questStatus) {
            let statusText = '';
            if (questStatus === 'complete') statusText = '✓ Quest Ready to Complete';
            else if (questStatus === 'inProgress') statusText = '◆ Quest In Progress';
            else if (questStatus === 'available') statusText = '! New Quest Available';
            
            detailsHTML += `<div style="margin-bottom: 15px; color: #ffd700;"><strong>${statusText}</strong></div>`;
        }
        
        if (!detailsHTML) {
            detailsHTML = '<div style="color: #aaa;">No monsters or NPCs in this area.</div>';
        }
        
        document.getElementById('map-detail-content').innerHTML = detailsHTML;
        
        // Show/hide warp button
        const warpBtn = document.getElementById('world-map-warp-btn');
        if (mapId !== player.currentMapId) {
            warpBtn.style.display = 'block';
            warpBtn.onclick = () => {
                // Find a suitable spawn location
                const targetMap = maps[mapId];
                let spawnX = 150;
                let spawnY = undefined;
                
                if (targetMap && targetMap.portals && targetMap.portals.length > 0) {
                    const firstPortal = targetMap.portals[0];
                    if (firstPortal.x !== undefined) spawnX = firstPortal.x;
                    if (firstPortal.y !== undefined) spawnY = firstPortal.y;
                }
                
                toggleWindow(worldMapWindow);
                fadeAndChangeMap(mapId, spawnX, spawnY);
            };
        } else {
            warpBtn.style.display = 'none';
        }
    }
    
    // Initialize with current map selected
    updateMapDetails(selectedMapId, questMapData[selectedMapId]);
    const currentMapNode = document.querySelector('.world-map-node.current');
    if (currentMapNode) currentMapNode.classList.add('selected');
}

// Current active world map region
let currentWorldMapRegion = 'victoria';

/**
 * Check if a region is unlocked (player has discovered any map in that region)
 * @param {string} region - 'dewdrop', 'victoria', or 'skypalace'
 * @returns {boolean} Whether the region is unlocked
 */
function isRegionUnlocked(region) {
    if (!player.discoveredMaps) return false;
    
    // Check if player has discovered any map starting with the region prefix
    for (const mapId of player.discoveredMaps) {
        if (region === 'dewdrop' && mapId.startsWith('dewdrop')) return true;
        if (region === 'skypalace' && (mapId.startsWith('skypalace') || mapId.startsWith('toyFactory') || mapId.startsWith('clockTower') || mapId.startsWith('deepskyPalace') || mapId.startsWith('ominousTower'))) return true;
        if (region === 'victoria' && !mapId.startsWith('dewdrop') && !mapId.startsWith('skypalace') && !mapId.startsWith('toyFactory') && !mapId.startsWith('clockTower') && !mapId.startsWith('deepskyPalace') && !mapId.startsWith('ominousTower')) return true;
    }
    return false;
}

/**
 * Update visibility of world map tabs based on discovered regions
 */
function updateWorldMapTabVisibility() {
    const tabs = document.querySelectorAll('.world-map-tab');
    tabs.forEach(tab => {
        const region = tab.dataset.region;
        const isUnlocked = isRegionUnlocked(region);
        tab.style.display = isUnlocked ? 'block' : 'none';
    });
}

/**
 * Initialize the world map tab system
 */
function initWorldMapTabs() {
    const tabs = document.querySelectorAll('.world-map-tab');
    tabs.forEach(tab => {
        // Remove old listeners by cloning
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        newTab.addEventListener('click', () => {
            const region = newTab.dataset.region;
            if (isRegionUnlocked(region)) {
                switchWorldMapRegion(region);
            }
        });
    });
    
    // Update tab visibility based on unlocked regions
    updateWorldMapTabVisibility();
}

/**
 * Switch to a different world map region tab
 * @param {string} region - 'dewdrop', 'victoria', or 'skypalace'
 */
function switchWorldMapRegion(region) {
    currentWorldMapRegion = region;
    
    // Update tab visibility and active states
    updateWorldMapTabVisibility();
    const tabs = document.querySelectorAll('.world-map-tab');
    tabs.forEach(tab => {
        if (tab.dataset.region === region) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Get the appropriate layout for this region
    let mapLayout;
    switch (region) {
        case 'dewdrop':
            mapLayout = dewdropWorldMapLayout;
            break;
        case 'skypalace':
            mapLayout = skypalaceWorldMapLayout;
            break;
        case 'victoria':
        default:
            mapLayout = worldMapLayout;
            break;
    }
    
    // Calculate dynamic layout and update the map
    const dynamicLayout = calculateDynamicMapLayout(maps, mapLayout);
    updateWorldMapUI(dynamicLayout);
}

/**
 * Get the current world map region based on player location
 * @returns {string} The region name
 */
function getPlayerWorldMapRegion() {
    if (player.currentMapId.startsWith('dewdrop')) {
        return 'dewdrop';
    } else if (player.currentMapId.startsWith('skypalace') || player.currentMapId.startsWith('toyFactory') || player.currentMapId.startsWith('clockTower') || player.currentMapId.startsWith('deepskyPalace') || player.currentMapId.startsWith('ominousTower')) {
        return 'skypalace';
    }
    return 'victoria';
}

function updateQuestLogUI() {
    // Get all available quests from NPCs
    const availableQuests = [];
    const activeQuestIds = (player.quests.active || []).map(q => q.id);
    const completedQuestIds = player.quests.completed || [];

    for (const npcId in npcData) {
        const npc = npcData[npcId];
        if (npc.quests) {
            for (const questId of npc.quests) {
                const quest = questData[questId];
                if (quest && !activeQuestIds.includes(questId) && !completedQuestIds.includes(questId)) {
                    // Check if prerequisite and level requirements are met
                    const prerequisiteMet = !quest.prerequisite || completedQuestIds.includes(quest.prerequisite);
                    const levelMet = !quest.levelReq || player.level >= quest.levelReq;
                    if (prerequisiteMet && levelMet) {
                        availableQuests.push({ questId, npc: npc.name, quest });
                    }
                }
            }
        }
    }

    // Update Available Quests Tab
    const availableContainer = document.getElementById('quest-available-content');
    if (availableQuests.length === 0) {
        availableContainer.innerHTML = '<p>No available quests.</p>';
    } else {
        availableContainer.innerHTML = availableQuests.map(({ questId, npc, quest }) => {
            const isChainQuest = quest.prerequisite ? ' 🔗' : '';
            const chainInfo = quest.prerequisite ? `<p class="quest-chain"><strong>Requires:</strong> ${questData[quest.prerequisite]?.title || 'Unknown Quest'}</p>` : '';
            const levelInfo = quest.levelReq ? `<p class="quest-level"><strong>Level Required:</strong> ${quest.levelReq}</p>` : '';
            return `
                <div class="quest-item available">
                    <h4>${quest.title}${isChainQuest}</h4>
                    <p><strong>From:</strong> ${npc}</p>
                    ${chainInfo}
                    ${levelInfo}
                    <p class="quest-description">${quest.startText}</p>
                    <p class="quest-objective"><strong>Objective:</strong> ${getObjectiveText(quest.objective, quest)}</p>
                    <p class="quest-reward"><strong>Reward:</strong> ${getRewardText(quest.reward)}</p>
                </div>
            `;
        }).join('');
    }

    // Update Active Quests Tab
    const activeContainer = document.getElementById('quest-active-content');
    if (!player.quests.active || player.quests.active.length === 0) {
        activeContainer.innerHTML = '<p>No active quests.</p>';
    } else {
        activeContainer.innerHTML = player.quests.active.map(quest => {
            const qData = questData[quest.id];
            let progressText = '';
            let isComplete = false;
            
            if (qData.objective.type === 'kill') {
                const monsterInfo = monsterTypes[qData.objective.target];
                const monsterName = monsterInfo ? monsterInfo.name : capitalize(qData.objective.target);
                progressText = `${monsterName}s killed: ${quest.progress} / ${qData.objective.count}`;
                isComplete = quest.progress >= qData.objective.count;
            } else if (qData.objective.type === 'killMultiple') {
                // Show each monster target on a separate line with its own progress
                const targetProgress = qData.objective.targets.map(target => {
                    const monsterInfo = monsterTypes[target.monster];
                    const monsterName = monsterInfo ? monsterInfo.name : capitalize(target.monster);
                    const killed = quest.multiProgress?.[target.monster] || 0;
                    const isDone = killed >= target.count;
                    const color = isDone ? '#4CAF50' : '#fff';
                    return `<span style="color: ${color};">${monsterName}s: ${killed} / ${target.count}</span>`;
                });
                progressText = targetProgress.join('<br>');
                isComplete = qData.objective.targets.every(target => 
                    (quest.multiProgress?.[target.monster] || 0) >= target.count
                );
            } else if (qData.objective.type === 'hit') {
                const monsterInfo = monsterTypes[qData.objective.target];
                const monsterName = monsterInfo ? monsterInfo.name : capitalize(qData.objective.target);
                progressText = `${monsterName} hits: ${quest.progress} / ${qData.objective.count}`;
                isComplete = quest.progress >= qData.objective.count;
            } else if (qData.objective.type === 'collect') {
                const allInventoryItems = [
                    ...player.inventory.equip,
                    ...player.inventory.use,
                    ...player.inventory.etc,
                    ...player.inventory.cosmetic
                ];
                const itemCount = allInventoryItems
                    .filter(item => item.name === qData.objective.target)
                    .reduce((sum, item) => sum + (item.quantity || 1), 0);
                progressText = `${qData.objective.target}: ${itemCount} / ${qData.objective.count}`;
                isComplete = itemCount >= qData.objective.count;
            } else if (qData.objective.type === 'talk') {
                const completionNpc = qData.completionNpcId || qData.npcId;
                progressText = `Talk to ${npcData[completionNpc]?.name || 'the quest giver'}`;
                isComplete = true; // Talk quests are always completable once active
            } else if (qData.objective.type === 'tutorial' || qData.objective.type === 'actions') {
                const completed = player.tutorialActions ? qData.objective.actions.filter(a => player.tutorialActions[a]).length : 0;
                isComplete = completed === qData.objective.actions.length;
                const actionNames = {
                    moveLeft: 'Move Arrow Keys / D-Pad : Left ←',
                    moveRight: 'Move Arrow Keys / D-Pad : Right →',
                    jump: 'Alt / A / Cross: Jump ↑',
                    attack: 'Ctrl / X / Square: Attack',
                    attackDummy: 'Ctrl / X / Square: Attack The Test Dummy',
                    openInventory: 'I / Right Stick Menu: Open Inventory Window',
                    equipLeatherCap: 'Double Click: Equip Leather Cap',
                    openEquipment: 'E / Right Stick Menu: Open Equipment Window'
                };
                const actionChecklist = qData.objective.actions.map(action => {
                    const done = player.tutorialActions && player.tutorialActions[action];
                    return `<span style="color: ${done ? '#4CAF50' : '#999'};">${done ? '✓' : '○'} ${actionNames[action]}</span>`;
                }).join('<br>');
                progressText = actionChecklist;
            }
            
            const progressPercent = (qData.objective.type === 'kill' || qData.objective.type === 'hit') ?
                Math.min((quest.progress / qData.objective.count) * 100, 100) :
                (() => {
                    if (qData.objective.type === 'killMultiple') {
                        // Calculate overall progress for multiple targets
                        const totalRequired = qData.objective.targets.reduce((sum, t) => sum + t.count, 0);
                        const totalKilled = qData.objective.targets.reduce((sum, t) => 
                            sum + (quest.multiProgress?.[t.monster] || 0), 0
                        );
                        return Math.min((totalKilled / totalRequired) * 100, 100);
                    } else if (qData.objective.type === 'collect') {
                        const allInventoryItems = [
                            ...player.inventory.equip,
                            ...player.inventory.use,
                            ...player.inventory.etc,
                            ...player.inventory.cosmetic
                        ];
                        const itemCount = allInventoryItems
                            .filter(item => item.name === qData.objective.target)
                            .reduce((sum, item) => sum + (item.quantity || 1), 0);
                        return Math.min((itemCount / qData.objective.count) * 100, 100);
                    } else if (qData.objective.type === 'talk') {
                        return 50; // Show half progress for talk quests
                    } else if (qData.objective.type === 'tutorial' || qData.objective.type === 'actions') {
                        const completed = player.tutorialActions ? qData.objective.actions.filter(a => player.tutorialActions[a]).length : 0;
                        return (completed / qData.objective.actions.length) * 100;
                    }
                    return 0;
                })();

            const progressBarColor = isComplete ? '#4CAF50' : '#ffd700'; // Green if complete, gold otherwise
            const titleSuffix = isComplete ? ' <span style="color: #4CAF50;">(Done)</span>' : '';
            const levelInfo = qData.levelReq ? `<p class="quest-level"><strong>Level Required:</strong> ${qData.levelReq}</p>` : '';
            return `
                <div class="quest-item active">
                    <h4>${qData.title}${titleSuffix}</h4>
                    ${levelInfo}
                    <p>${progressText}</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%; background-color: ${progressBarColor};"></div>
                    </div>
                    <p class="quest-reward"><strong>Reward:</strong> ${getRewardText(qData.reward)}</p>
                </div>
            `;
        }).join('');
    }

    // Update Completed Quests Tab
    const completedContainer = document.getElementById('quest-completed-content');
    if (!player.quests.completed || player.quests.completed.length === 0) {
        completedContainer.innerHTML = '<p>No completed quests.</p>';
    } else {
        completedContainer.innerHTML = player.quests.completed.map(questId => {
            const quest = questData[questId];
            if (!quest) {
                // Quest was renamed or removed - skip it
                return '';
            }
            const levelInfo = quest.levelReq ? `<p class="quest-level"><strong>Level Required:</strong> ${quest.levelReq}</p>` : '';
            return `
                <div class="quest-item completed">
                    <h4>${quest.title}</h4>
                    ${levelInfo}
                    <p class="quest-description">${quest.completeText}</p>
                    <p class="quest-reward"><strong>Rewarded:</strong> ${getRewardText(quest.reward)}</p>
                </div>
            `;
        }).join('');
    }

    // Update tab counters
    updateQuestTabCounts(availableQuests.length, player.quests.active?.length || 0, player.quests.completed?.length || 0);

    // Set up tab switching if not already done
    setupQuestLogTabs();
}

/**
 * Automatically opens the quest helper if it's closed.
 */
function autoOpenQuestHelper() {
    if (questHelperElement && questHelperElement.style.display === 'none') {
        questHelperElement.style.display = 'block';
        updateQuestHelperUI();
    }
}

/**
 * Updates the Quest Helper window with real-time progress of active quests.
 */
function updateQuestHelperUI() {
    const container = document.getElementById('quest-helper-content');
    if (!container) return;

    if (!player.quests.active || player.quests.active.length === 0) {
        container.innerHTML = '<p style="text-align: center; font-style: italic; color: #888;">No active quests.</p>';
        return;
    }

    // Calculate progress for each quest and prepare for sorting
    const questsWithProgress = player.quests.active.map(quest => {
        const qData = questData[quest.id];
        
        // Skip if quest data doesn't exist
        if (!qData) {
            console.warn(`Quest data not found for ID: ${quest.id}`);
            return null;
        }
        
        let progress = 0;
        let progressText = '...';
        let isComplete = false;

        if (qData.objective.type === 'kill') {
            progress = Math.min((quest.progress / qData.objective.count) * 100, 100);
            progressText = `${quest.progress} / ${qData.objective.count}`;
            isComplete = quest.progress >= qData.objective.count;
        } else if (qData.objective.type === 'killMultiple') {
            // Show each monster target on a separate line with its own progress
            const targetProgress = qData.objective.targets.map(target => {
                const killed = quest.multiProgress?.[target.monster] || 0;
                const isDone = killed >= target.count;
                return `${killed} / ${target.count}`;
            });
            progressText = targetProgress.join('<br>');
            
            // Calculate overall progress percentage
            const totalRequired = qData.objective.targets.reduce((sum, t) => sum + t.count, 0);
            const totalKilled = qData.objective.targets.reduce((sum, t) => 
                sum + (quest.multiProgress?.[t.monster] || 0), 0
            );
            progress = Math.min((totalKilled / totalRequired) * 100, 100);
            isComplete = qData.objective.targets.every(target => 
                (quest.multiProgress?.[target.monster] || 0) >= target.count
            );
        } else if (qData.objective.type === 'collect') {
            const allInventoryItems = [...player.inventory.equip, ...player.inventory.use, ...player.inventory.etc, ...player.inventory.cosmetic];
            const itemCount = allInventoryItems.filter(item => item.name === qData.objective.target).reduce((sum, item) => sum + (item.quantity || 1), 0);
            progress = Math.min((itemCount / qData.objective.count) * 100, 100);
            progressText = `${itemCount} / ${qData.objective.count}`;
            isComplete = itemCount >= qData.objective.count;
        } else if (qData.objective.type === 'talk') {
            progress = 50; // Show half progress
            progressText = 'Return to NPC';
            isComplete = true; // Talk quests are always completable once active
        } else if (qData.objective.type === 'useItem') {
            progress = Math.min((quest.progress / qData.objective.count) * 100, 100);
            progressText = `${quest.progress} / ${qData.objective.count}`;
            isComplete = quest.progress >= qData.objective.count;
        } else if (qData.objective.type === 'tutorial' || qData.objective.type === 'actions') {
            const completed = player.tutorialActions ? qData.objective.actions.filter(a => player.tutorialActions[a]).length : 0;
            progress = (completed / qData.objective.actions.length) * 100;
            isComplete = completed === qData.objective.actions.length;
            // Build detailed action list for tutorial quests
            const actionNames = {
                moveLeft: 'Move Arrow Keys / D-Pad : Left ←',
                moveRight: 'Move Arrow Keys / D-Pad : Right →',
                jump: 'Alt / A / Cross: Jump ↑',
                attack: 'Ctrl / X / Square: Attack',
                attackDummy: 'Ctrl / X / Square: Attack The Test Dummy',
                openInventory: 'I / Right Stick Menu: Open Inventory Window',
                equipLeatherCap: 'Double Click: Equip Leather Cap',
                openEquipment: 'E / Right Stick Menu: Open Equipment Window'
            };
            progressText = qData.objective.actions.map(action => {
                const done = player.tutorialActions && player.tutorialActions[action];
                return `<span style="color: ${done ? '#4CAF50' : '#999'};">${done ? '✓' : '○'} ${actionNames[action]}</span>`;
            }).join('<br>');
        }
        return { ...quest, qData, progress, progressText, isComplete };
    }).filter(q => q !== null); // Filter out quests with missing data

    // Sort quests by progress (descending)
    questsWithProgress.sort((a, b) => b.progress - a.progress);

    // Build and display the sorted quests
    container.innerHTML = questsWithProgress.map(({ qData, progress, progressText, isComplete }) => {
        // For tutorial/actions quests, align progress text to left and don't show on single line
        const progressStyle = (qData.objective.type === 'tutorial' || qData.objective.type === 'actions') ? 'text-align: left; line-height: 1.6;' : 'text-align: right;';
        const progressBarColor = isComplete ? '#4CAF50' : '#ffd700'; // Green if complete, gold otherwise
        const titleSuffix = isComplete ? ' <span style="color: #4CAF50;">(Done)</span>' : '';
        return `
            <div class="quest-helper-item">
                <h5>${qData.title}${titleSuffix}</h5>
                <p>${getObjectiveText(qData.objective, qData)}</p>
                <div class="quest-helper-progress-bar">
                    <div class="progress-fill" style="width: ${progress}%; background-color: ${progressBarColor};"></div>
                </div>
                <p style="${progressStyle}">${progressText}</p>
            </div>
        `;
    }).join('');
}

// Add these new helper functions to ui.js
let questToNpcMap = {};
function buildQuestToNpcMap() {
    for (const npcId in npcData) {
        if (npcData[npcId].quests) {
            for (const questId of npcData[npcId].quests) {
                questToNpcMap[questId] = npcData[npcId].name;
            }
        }
    }
}

function findNpcForQuest(questId) {
    return questToNpcMap[questId] || 'an NPC';
}

function getObjectiveText(objective, questData) {
    if (objective.type === 'kill') {
        const monsterInfo = monsterTypes[objective.target];
        const monsterName = monsterInfo ? monsterInfo.name : capitalize(objective.target);
        return `Defeat ${objective.count} ${monsterName}${objective.count > 1 ? 's' : ''}`;
    } else if (objective.type === 'killMultiple') {
        // Handle multiple kill targets - show each on separate line for quest helper
        const targetTexts = objective.targets.map(target => {
            const monsterInfo = monsterTypes[target.monster];
            const monsterName = monsterInfo ? monsterInfo.name : capitalize(target.monster);
            return `Defeat ${target.count} ${monsterName}${target.count > 1 ? 's' : ''}`;
        });
        return targetTexts.join('<br>');
    } else if (objective.type === 'hit') {
        const monsterInfo = monsterTypes[objective.target];
        const monsterName = monsterInfo ? monsterInfo.name : capitalize(objective.target);
        return `Hit ${monsterName} ${objective.count} time${objective.count > 1 ? 's' : ''}`;
    } else if (objective.type === 'collect') {
        return `Collect ${objective.count} ${objective.target}${objective.count > 1 ? 's' : ''}`;
    } else if (objective.type === 'talk') {
        if (questData && questData.completionNpcId) {
            const npcName = npcData[questData.completionNpcId]?.name || 'the quest giver';
            return `Talk to ${npcName}`;
        }
        return 'Return and talk to the quest giver';
    } else if (objective.type === 'tutorial' || objective.type === 'actions') {
        const actionNames = {
            moveLeft: 'Move Left',
            moveRight: 'Move Right',
            jump: 'Jump',
            attack: 'Attack',
            attackDummy: 'Attack Test Dummy',
            openInventory: 'Open Inventory Window',
            equipLeatherCap: 'Equip Leather Cap',
            openEquipment: 'Open Equipment Window'
        };
        const completedActions = player.tutorialActions ? objective.actions.filter(a => player.tutorialActions[a]).length : 0;
        return `Complete actions (${completedActions}/${objective.actions.length})`;
    } else if (objective.type === 'useItem') {
        return `Use ${objective.count} ${objective.target}${objective.count > 1 ? 's' : ''}`;
    }
    return 'Unknown objective';
}

function getRewardText(reward) {
    let rewardText = [];
    if (reward.exp) rewardText.push(`${reward.exp} EXP`);
    if (reward.gold) rewardText.push(formatGold(reward.gold));
    if (reward.item) {
        const itemName = typeof reward.item === 'string' ? reward.item : reward.item.name;
        const quantity = reward.quantity || 1;
        rewardText.push(`${quantity > 1 ? quantity + 'x ' : ''}${itemName}`);
    }
    return rewardText.join(', ') || 'None';
}

function updateQuestTabCounts(availableCount, activeCount, completedCount) {
    const availableCountEl = document.getElementById('available-count');
    const activeCountEl = document.getElementById('active-count');
    const completedCountEl = document.getElementById('completed-count');

    if (availableCountEl) availableCountEl.textContent = availableCount;
    if (activeCountEl) activeCountEl.textContent = activeCount;
    if (completedCountEl) completedCountEl.textContent = completedCount;
}

function setupQuestLogTabs() {
    // Check if tabs are already set up to prevent duplicate listeners
    if (document.querySelector('.quest-tab-button[data-setup="true"]')) return;

    const tabButtons = document.querySelectorAll('.quest-tab-button');
    const tabContents = document.querySelectorAll('.quest-tab-content');

    tabButtons.forEach(button => {
        button.setAttribute('data-setup', 'true');
        button.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetTab = button.dataset.tab;
            const targetContent = document.getElementById(`quest-${targetTab}-content`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

function showStartScreen() {
    isGameActive = false;
    if (gameLoopId) cancelAnimationFrame(gameLoopId);

    // Hide all game elements
    uiContainer.style.display = 'none';
    minimapContainer.style.display = 'none';
    document.querySelectorAll('.window').forEach(win => win.style.display = 'none');
    characterSelectionScreen.style.display = 'none';
    characterCreationScreen.style.display = 'none';
    document.getElementById('game-world').style.display = 'none';

    if (currentBGM && !currentBGM.paused) {
        currentBGM.pause();
        currentBGM.currentTime = 0;
    }

    // Show the start screen
    const startScreen = document.getElementById('start-screen');
    startScreen.style.display = 'flex';
}

/**
 * Opens and initializes the Gachapon window UI.
 * @param {boolean} [autoSpin=false] - If true, the wheel will spin automatically upon opening.
 */
function openGachaponWindow(autoSpin = false) {
    // --- THIS IS THE FIX ---
    // Add a guard clause to prevent opening the window if inventory is full.
    const maxSlots = player.inventorySlots || 16;
    if (player.inventory.equip.length >= maxSlots ||
        player.inventory.use.length >= maxSlots ||
        player.inventory.etc.length >= maxSlots ||
        player.inventory.cosmetic.length >= maxSlots) {
        // This message is a fallback, the check in playGachapon should catch it first.
        addChatMessage("Your inventory is full! Make sure all tabs have at least one free slot.", 'error');
        return;
    }
    // --- END OF FIX ---

    const ticket = player.inventory.etc.find(i => i.name === 'Gachapon Ticket');
    const ticketCount = ticket ? ticket.quantity : 0;

    document.getElementById('gachapon-ticket-count').textContent = `Tickets: ${ticketCount}`;
    document.getElementById('gachapon-spin-btn').disabled = ticketCount <= 0;
    document.getElementById('gachapon-result').style.display = 'none';
    document.getElementById('gachapon-wheel-items').innerHTML = ''; // Clear previous spin
    document.getElementById('gachapon-wheel-items').style.transition = 'none'; // Reset transition
    document.getElementById('gachapon-wheel-items').style.transform = 'translateX(0)'; // Reset position

    toggleWindow(gachaponWindowElement);

    if (autoSpin) {
        document.getElementById('gachapon-spin-btn').style.display = 'none';
        setTimeout(() => {
            spinGachaponWheel();
        }, 300);
    } else {
        document.getElementById('gachapon-spin-btn').style.display = 'inline-block';
    }
}

/**
 * Handles the logic and animation for spinning the Gachapon wheel.
 */
function spinGachaponWheel() {
    const spinBtn = document.getElementById('gachapon-spin-btn');
    const resultDiv = document.getElementById('gachapon-result');
    const resultItemDiv = document.getElementById('gachapon-result-item');
    const wheelItemsContainer = document.getElementById('gachapon-wheel-items');
    const ticketCountEl = document.getElementById('gachapon-ticket-count');

    // --- THIS IS THE FIX ---
    // Add a final check right before consuming the ticket, for the "Spin Again" button.
    const maxSlots = player.inventorySlots || 16;
    if (player.inventory.equip.length >= maxSlots ||
        player.inventory.use.length >= maxSlots ||
        player.inventory.etc.length >= maxSlots ||
        player.inventory.cosmetic.length >= maxSlots) {
        addChatMessage("Your inventory is full! Please ensure all tabs have at least one free slot.", 'error');
        const ticket = player.inventory.etc.find(i => i.name === 'Gachapon Ticket');
        spinBtn.disabled = !ticket;
        spinBtn.style.display = 'inline-block';
        return;
    }
    // --- END OF FIX ---

    // 1. Check and consume ticket
    const ticketIndex = player.inventory.etc.findIndex(i => i.name === 'Gachapon Ticket');
    if (ticketIndex === -1) {
        addChatMessage("You don't have a Gachapon Ticket!", 'error');
        spinBtn.disabled = true;
        spinBtn.style.display = 'inline-block';
        return;
    }

    spinBtn.disabled = true;
    spinBtn.style.display = 'none'; // Hide button during spin
    resultDiv.style.display = 'none';

    const ticket = player.inventory.etc[ticketIndex];
    ticket.quantity--;
    if (ticket.quantity <= 0) {
        player.inventory.etc.splice(ticketIndex, 1);
    }
    ticketCountEl.textContent = `Tickets: ${ticket.quantity}`;
    updateInventoryUI();

    wheelItemsContainer.style.transition = 'none';
    wheelItemsContainer.style.transform = 'translateX(0)';
    wheelItemsContainer.innerHTML = ''; // Clear out old items

    setTimeout(() => {
        // 2. Determine the prize using weighted random selection
        if (!gachaponPrizePool || gachaponPrizePool.length === 0) {
            addChatMessage("The Gachapon is empty today!", 'error');
            addItemToInventory({ name: 'Gachapon Ticket', quantity: 1 });
            openGachaponWindow();
            return;
        }

        // Calculate total weight
        const totalWeight = gachaponPrizePool.reduce((sum, prize) => sum + prize.weight, 0);
        
        // Pick a random number between 0 and totalWeight
        let random = Math.random() * totalWeight;
        
        // Find which prize was selected
        let prizeName = null;
        for (const prize of gachaponPrizePool) {
            random -= prize.weight;
            if (random <= 0) {
                prizeName = prize.name;
                break;
            }
        }
        
        // Fallback to first item if something went wrong
        if (!prizeName) {
            prizeName = gachaponPrizePool[0].name;
        }
        const baseItem = itemData[prizeName];
        const winningItem = { name: prizeName, rarity: 'common', ...baseItem };
        if (baseItem.category === 'Use' || baseItem.category === 'Etc') {
            // Give multiple quantities for consumables and scrolls
            const multiQuantityItems = [
                'Enhancement Scroll', 'Gachapon Ticket', 'Red Potion', 'Blue Potion',
                'Elixir', 'Power Potion', 'Agility Potion', 'Wise Potion'
            ];
            
            if (multiQuantityItems.includes(prizeName)) {
                winningItem.quantity = Math.floor(Math.random() * 8) + 3; // 3-10
            } else {
                winningItem.quantity = 1;
            }
        }
        if (baseItem.category === 'Equip') {
            winningItem.stats = {};
            const qualityRoll = Math.random();
            for (const stat in baseItem.stats) {
                const baseStat = baseItem.stats[stat];
                let bonus = 0;
                if (qualityRoll > 0.98) { winningItem.rarity = 'legendary'; bonus = (baseItem.variance || 1) * 2 + 2; }
                else if (qualityRoll > 0.85) { winningItem.rarity = 'epic'; bonus = (baseItem.variance || 1) + 1; }
                else if (qualityRoll > 0.60) { winningItem.rarity = 'rare'; bonus = Math.ceil(Math.random() * (baseItem.variance || 1)); }
                winningItem.stats[stat] = baseStat + bonus;
            }
        } else if (baseItem.category === 'Cosmetic') {
            winningItem.rarity = 'cosmetic';
            winningItem.stats = {};
        }

        // 3. Populate the wheel for animation
        const NUM_ITEMS_IN_WHEEL = 100;
        const WINNING_ITEM_INDEX = NUM_ITEMS_IN_WHEEL - 5;
        let wheelHtml = '';

        for (let i = 0; i < NUM_ITEMS_IN_WHEEL; i++) {
            let itemToDisplay;
            if (i === WINNING_ITEM_INDEX) {
                itemToDisplay = winningItem;
            } else {
                // Pick a random item from the prize pool for the wheel animation
                const randomPrize = gachaponPrizePool[Math.floor(Math.random() * gachaponPrizePool.length)];
                itemToDisplay = { name: randomPrize.name, ...itemData[randomPrize.name] };
            }

            const iconData = spriteData.dropIcons.icons[itemToDisplay.name];
            let iconHtml = '';
            if (iconData) {
                const frameWidth = spriteData.dropIcons.frameWidth;
                const scale = 6;
                iconHtml = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.dropIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale});"></div>`;
            } else {
                iconHtml = `<div style="width:48px; height:48px; display:flex; align-items:center; justify-content:center; font-size:24px;">?</div>`;
            }

            const rarity = itemToDisplay.rarity || 'common';

            wheelHtml += `
                <div class="gachapon-item ${rarity}">
                    ${iconHtml}
                </div>
            `;
        }
        wheelItemsContainer.innerHTML = wheelHtml;

        // 4. Animate the spin
        const itemWidth = 80 + 10;
        const wheelContainerWidth = document.getElementById('gachapon-wheel').offsetWidth;
        const targetX = (WINNING_ITEM_INDEX * itemWidth) - (wheelContainerWidth / 2) + (itemWidth / 2);
        const randomOffset = Math.random() * (itemWidth - 20) - ((itemWidth - 20) / 2);

        setTimeout(() => {
            wheelItemsContainer.style.transition = 'transform 2.5s cubic-bezier(0.25, 1, 0.5, 1)';
            wheelItemsContainer.style.transform = `translateX(-${targetX + randomOffset}px)`;
        }, 100);

        // 5. Handle the result after animation (reduced time)
        setTimeout(() => {
            const itemToAdd = { ...winningItem };
            if (addItemToInventory(itemToAdd)) {
                // Show quantity in message if item has quantity
                let quantityText;
                if (itemToAdd.quantity && itemToAdd.quantity > 1) {
                    quantityText = `${itemToAdd.quantity} ${itemToAdd.name}s`;
                } else {
                    // Use "an" if item name starts with a vowel, otherwise "a"
                    const startsWithVowel = /^[aeiouAEIOU]/.test(itemToAdd.name);
                    quantityText = `${startsWithVowel ? 'an' : 'a'} ${itemToAdd.name}`;
                }
                addChatMessage(`[Gachapon] You won ${quantityText}!`, itemToAdd.rarity);
            }

            const iconData = spriteData.dropIcons.icons[winningItem.name];
            let resultIconHtml = '';
            if (iconData) {
                const frameWidth = spriteData.dropIcons.frameWidth;
                const scale = 4;
                resultIconHtml = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.dropIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale});"></div>`;
            }

            resultItemDiv.className = 'gachapon-result-item';
            resultItemDiv.classList.add(winningItem.rarity);

            resultItemDiv.innerHTML = `${resultIconHtml} <span class="item-name ${winningItem.rarity}">${winningItem.name}</span>`;

            addTooltipEvents(resultItemDiv, buildTooltipHtml(winningItem));

            resultDiv.style.display = 'block';

            updateInventoryUI();
            updateUI();

            const currentTicket = player.inventory.etc.find(i => i.name === 'Gachapon Ticket');
            const hasMoreTickets = currentTicket && currentTicket.quantity > 0;

            spinBtn.disabled = !hasMoreTickets;
            if (hasMoreTickets) {
                spinBtn.style.display = 'inline-block';
                spinBtn.textContent = 'Spin Again';
            }

        }, 2750); // Reduced from 5500ms to 2750ms (half time)
    }, 50);
}

// --- Bestiary Functions ---

function updateBestiaryUI() {
    setupBestiaryTabs();
    updateBestiaryMonstersTab();
    updateBestiaryBossesTab();
    updateBestiaryStatsTab();
}

function setupBestiaryTabs() {
    const tabButtons = document.querySelectorAll('.bestiary-tab-button');
    const tabContents = document.querySelectorAll('.bestiary-tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            if (e.target.classList.contains('active')) return;

            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab
            e.target.classList.add('active');
            const targetTab = e.target.dataset.tab;
            document.getElementById(`bestiary-${targetTab}-content`).classList.add('active');
            
            // Update Statistics tab content when switching to it
            if (targetTab === 'stats') {
                updateBestiaryStatsTab();
            }
        });
    });
}

function updateBestiaryMonstersTab() {
    const container = document.getElementById('bestiary-monsters-content');
    container.innerHTML = '';

    const regularMonsters = Object.keys(monsterTypes).filter(type => !monsterTypes[type].isMiniBoss && !monsterTypes[type].excludeFromBestiary);

    regularMonsters.forEach(monsterType => {
        const monster = monsterTypes[monsterType];
        const killCount = player.bestiary.monsterKills[monsterType] || 0;
        const isDiscovered = killCount > 0;
        const drops = player.bestiary.dropsFound[monsterType] || {};

        // Check if Monster Killer medal is earned
        const hasEarnedMedal = player.bestiaryRewards && player.bestiaryRewards.claimedMedals && player.bestiaryRewards.claimedMedals[monsterType];

        const dropsHtml = Object.keys(drops).length > 0
            ? `<p>Drops found: ${Object.keys(drops).length} types</p>`
            : '<p>No drops recorded</p>';

        const monsterElement = document.createElement('div');
        monsterElement.className = `bestiary-monster ${isDiscovered ? 'discovered clickable monster-entry' : 'undiscovered'}`;
        monsterElement.dataset.monsterType = monsterType;

        monsterElement.innerHTML = `
            <div class="bestiary-monster-info">
                <h4>${isDiscovered ? monster.name : '???'} ${hasEarnedMedal ? '<span class="monster-medal-icon" title="Monster Killer Medal Earned">🏅</span>' : ''}</h4>
                <p>Level: ${isDiscovered ? monster.level : '?'}</p>
                <p>Kills: ${killCount}</p>
                ${isDiscovered ? dropsHtml : '<p>Not discovered</p>'}
            </div>
            <div class="bestiary-monster-stats">
                <p>HP: ${isDiscovered ? monster.hp : '?'}</p>
                <p>EXP: ${isDiscovered ? monster.exp : '?'}</p>
                <p>Damage: ${isDiscovered ? monster.damage : '?'}</p>
            </div>
        `;

        if (isDiscovered) {
            monsterElement.addEventListener('click', () => {
                // Remove previous selection
                document.querySelectorAll('.bestiary-monster.selected').forEach(el => el.classList.remove('selected'));
                monsterElement.classList.add('selected');
                showMonsterDetailInPanel(monsterType);
            });
        }

        container.appendChild(monsterElement);
    });
}

function updateBestiaryBossesTab() {
    const container = document.getElementById('bestiary-bosses-content');
    container.innerHTML = '';

    const bosses = Object.keys(monsterTypes).filter(type => monsterTypes[type].isMiniBoss);

    bosses.forEach(bossType => {
        const boss = monsterTypes[bossType];
        const killCount = player.bestiary.monsterKills[bossType] || 0;
        const isDiscovered = killCount > 0;
        const drops = player.bestiary.dropsFound[bossType] || {};

        // Check if Monster Killer medal is earned
        const hasEarnedMedal = player.bestiaryRewards && player.bestiaryRewards.claimedMedals && player.bestiaryRewards.claimedMedals[bossType];

        const rareDrops = Object.keys(drops).filter(item =>
            boss.loot.find(loot => loot.name === item && loot.rate < 0.1)
        );
        const rareDropsHtml = rareDrops.length > 0
            ? `<p class="bestiary-rare-drop">Rare drops: ${rareDrops.join(', ')}</p>`
            : '';

        const bossElement = document.createElement('div');
        bossElement.className = `bestiary-monster ${isDiscovered ? 'discovered clickable monster-entry' : 'undiscovered'}`;
        bossElement.dataset.monsterType = bossType;

        bossElement.innerHTML = `
            <div class="bestiary-monster-info">
                <h4>${isDiscovered ? boss.name : '???'} ${hasEarnedMedal ? '<span class="monster-medal-icon" title="Monster Killer Medal Earned">🏅</span>' : ''}</h4>
                <p>Level: ${isDiscovered ? boss.level : '?'} (Boss)</p>
                <p>Defeats: ${killCount}</p>
                <p>Drops found: ${Object.keys(drops).length} types</p>
                ${rareDropsHtml}
            </div>
            <div class="bestiary-monster-stats">
                <p>HP: ${isDiscovered ? boss.hp.toLocaleString() : '?'}</p>
                <p>EXP: ${isDiscovered ? boss.exp.toLocaleString() : '?'}</p>
                <p>Damage: ${isDiscovered ? boss.damage : '?'}</p>
            </div>
        `;

        if (isDiscovered) {
            bossElement.addEventListener('click', () => {
                // Remove previous selection
                document.querySelectorAll('.bestiary-monster.selected').forEach(el => el.classList.remove('selected'));
                bossElement.classList.add('selected');
                showMonsterDetailInPanel(bossType);
            });
        }

        container.appendChild(bossElement);
    });
}

function updateBestiaryStatsTab() {
    const container = document.getElementById('bestiary-stats-content');
    if (!container) {
        console.error('[Bestiary] Stats container not found!');
        return;
    }

    // Ensure bestiary data exists
    if (!player.bestiary) player.bestiary = {};
    if (!player.bestiary.monsterKills) player.bestiary.monsterKills = {};
    if (!player.bestiary.dropsFound) player.bestiary.dropsFound = {};
    if (!player.bestiary.firstKillTimestamp) player.bestiary.firstKillTimestamp = {};

    const totalMonsters = Object.keys(monsterTypes).filter(type => !monsterTypes[type].excludeFromBestiary).length;
    const discoveredMonsters = Object.keys(player.bestiary.monsterKills).filter(type => monsterTypes[type] && !monsterTypes[type].excludeFromBestiary).length;
    const totalKills = Object.values(player.bestiary.monsterKills).reduce((sum, kills) => sum + kills, 0);
    const totalDropTypes = Object.values(player.bestiary.dropsFound).reduce((sum, drops) => sum + Object.keys(drops).length, 0);

    const bossKills = Object.keys(monsterTypes)
        .filter(type => monsterTypes[type].isMiniBoss)
        .reduce((sum, type) => sum + (player.bestiary.monsterKills[type] || 0), 0);

    const mostKilledMonster = Object.keys(player.bestiary.monsterKills)
        .reduce((max, type) =>
            (player.bestiary.monsterKills[type] > (player.bestiary.monsterKills[max] || 0)) ? type : max
            , '');

    const firstKill = Object.keys(player.bestiary.firstKillTimestamp)
        .sort((a, b) => player.bestiary.firstKillTimestamp[a] - player.bestiary.firstKillTimestamp[b])[0];

    // Boss Slayer Supreme tracking - dynamically get ALL bosses
    const allBosses = Object.keys(monsterTypes).filter(type => monsterTypes[type].isMiniBoss && !monsterTypes[type].excludeFromBestiary);
    const bossProgress = allBosses
        .map(boss => ({
            name: monsterTypes[boss].name,
            kills: player.bestiary.monsterKills[boss] || 0,
            target: 5,
            level: monsterTypes[boss].level
        }))
        .sort((a, b) => a.level - b.level); // Sort by level so they appear in order
    const bossSlayerComplete = bossProgress.length > 0 && bossProgress.every(boss => boss.kills >= boss.target);

    // Monster Tier Achievements tracking
    const allRegularMonsters = Object.keys(monsterTypes).filter(type => !monsterTypes[type].isMiniBoss && !monsterTypes[type].excludeFromBestiary);
    
    const monsterKillerProgress = allRegularMonsters.filter(type => (player.bestiary.monsterKills[type] || 0) >= 50).length;
    const monsterKillerComplete = monsterKillerProgress === allRegularMonsters.length;
    
    const monsterHunterProgress = allRegularMonsters.filter(type => (player.bestiary.monsterKills[type] || 0) >= 150).length;
    const monsterHunterComplete = monsterHunterProgress === allRegularMonsters.length;
    
    const monsterSlaughtererProgress = allRegularMonsters.filter(type => (player.bestiary.monsterKills[type] || 0) >= 500).length;
    const monsterSlaughtererComplete = monsterSlaughtererProgress === allRegularMonsters.length;
    
    const monsterExterminatorProgress = allRegularMonsters.filter(type => {
        const kills = player.bestiary.monsterKills[type] || 0;
        if (kills < 1000) return false;
        
        // Check if all drops are collected
        const monster = monsterTypes[type];
        const dropsFound = player.bestiary.dropsFound[type] || {};
        const requiredDrops = monster.loot.filter(loot => loot.name !== 'Gold');
        return requiredDrops.every(loot => dropsFound[loot.name] !== undefined);
    }).length;
    const monsterExterminatorComplete = monsterExterminatorProgress === allRegularMonsters.length;

    container.innerHTML = `
        <div class="bestiary-stats-section">
            <h3>Discovery Progress</h3>
            <div class="bestiary-progress-stat">
                <div class="bestiary-progress-header">
                    <span>Monsters Discovered</span>
                    <span>${discoveredMonsters}/${totalMonsters} (${((discoveredMonsters / totalMonsters) * 100).toFixed(1)}%)</span>
                </div>
                <div class="bestiary-progress-bar-container">
                    <div class="bestiary-progress-bar" style="width: ${(discoveredMonsters / totalMonsters) * 100}%; background: linear-gradient(90deg, #3498db, #2ecc71);"></div>
                </div>
            </div>
        </div>
        
        <div class="bestiary-stats-section">
            <h3>Combat Statistics</h3>
            <div class="bestiary-stat-row">
                <span>Total Kills:</span>
                <span>${totalKills.toLocaleString()}</span>
            </div>
            <div class="bestiary-stat-row">
                <span>Boss Defeats:</span>
                <span>${bossKills}</span>
            </div>
            <div class="bestiary-stat-row">
                <span>Unique Drops Found:</span>
                <span>${totalDropTypes}</span>
            </div>
        </div>
        
        <div class="bestiary-stats-section">
            <h3>Boss Slayer Supreme ${bossSlayerComplete ? '<span style="color: #2ecc71;">✓</span>' : ''}</h3>
            <p style="margin-bottom: 10px; font-size: 10px; color: #bdc3c7;">Defeat each mini-boss 5 times</p>
            ${bossProgress.map(boss => {
                const percent = Math.min((boss.kills / boss.target) * 100, 100);
                const isComplete = boss.kills >= boss.target;
                return `
                <div class="bestiary-progress-stat">
                    <div class="bestiary-progress-header">
                        <span>${boss.name}</span>
                        <span class="${isComplete ? 'bestiary-complete' : ''}">${boss.kills}/${boss.target}</span>
                    </div>
                    <div class="bestiary-progress-bar-container">
                        <div class="bestiary-progress-bar" style="width: ${percent}%; background: ${isComplete ? 'linear-gradient(90deg, #2ecc71, #27ae60)' : 'linear-gradient(90deg, #e74c3c, #c0392b)'};"></div>
                    </div>
                </div>
            `}).join('')}
            ${bossSlayerComplete ? `
                <p class="bestiary-achievement-complete">🏆 Boss Slayer Supreme Complete!</p>
                ${!player.bestiaryRewards || !player.bestiaryRewards.bossSlayerSupreme ?
                `<button id="claim-boss-slayer-btn" class="window-content-button" style="margin-top: 5px;">Claim Reward (${formatGold(50000)} + Boss Slayer Crown)</button>` :
                '<p style="text-align: center; margin-top: 5px; color: var(--success-color); font-size: 10px;">Reward Claimed!</p>'
            }` : ''}
        </div>
        
        <div class="bestiary-stats-section">
            <h3>Monster Tier Achievements</h3>
            <p style="margin-bottom: 10px; font-size: 10px; color: #bdc3c7;">Reach each tier on all regular monsters</p>
            
            <div class="bestiary-progress-stat">
                <div class="bestiary-progress-header">
                    <span><span style="color: #cd7f32;">Monster Killer</span> (50+ kills)</span>
                    <span class="${monsterKillerComplete ? 'bestiary-complete' : ''}">${monsterKillerProgress}/${allRegularMonsters.length}</span>
                </div>
                <div class="bestiary-progress-bar-container">
                    <div class="bestiary-progress-bar" style="width: ${(monsterKillerProgress / allRegularMonsters.length) * 100}%; background: linear-gradient(90deg, #cd7f32, #b87333);"></div>
                </div>
            </div>
            ${monsterKillerComplete ? '<p class="bestiary-achievement-complete" style="font-size: 10px;">✓ Complete!</p>' : ''}
            
            <div class="bestiary-progress-stat">
                <div class="bestiary-progress-header">
                    <span><span style="color: #c0c0c0;">Monster Hunter</span> (150+ kills)</span>
                    <span class="${monsterHunterComplete ? 'bestiary-complete' : ''}">${monsterHunterProgress}/${allRegularMonsters.length}</span>
                </div>
                <div class="bestiary-progress-bar-container">
                    <div class="bestiary-progress-bar" style="width: ${(monsterHunterProgress / allRegularMonsters.length) * 100}%; background: linear-gradient(90deg, #c0c0c0, #a8a8a8);"></div>
                </div>
            </div>
            ${monsterHunterComplete ? '<p class="bestiary-achievement-complete" style="font-size: 10px;">✓ Complete!</p>' : ''}
            
            <div class="bestiary-progress-stat">
                <div class="bestiary-progress-header">
                    <span><span style="color: #ffd700;">Monster Slaughterer</span> (500+ kills)</span>
                    <span class="${monsterSlaughtererComplete ? 'bestiary-complete' : ''}">${monsterSlaughtererProgress}/${allRegularMonsters.length}</span>
                </div>
                <div class="bestiary-progress-bar-container">
                    <div class="bestiary-progress-bar" style="width: ${(monsterSlaughtererProgress / allRegularMonsters.length) * 100}%; background: linear-gradient(90deg, #ffd700, #f1c40f);"></div>
                </div>
            </div>
            ${monsterSlaughtererComplete ? '<p class="bestiary-achievement-complete" style="font-size: 10px;">✓ Complete!</p>' : ''}
            
            <div class="bestiary-progress-stat">
                <div class="bestiary-progress-header">
                    <span><span style="color: #b9f2ff;">Monster Exterminator</span> (1000+ & all drops)</span>
                    <span class="${monsterExterminatorComplete ? 'bestiary-complete' : ''}">${monsterExterminatorProgress}/${allRegularMonsters.length}</span>
                </div>
                <div class="bestiary-progress-bar-container">
                    <div class="bestiary-progress-bar" style="width: ${(monsterExterminatorProgress / allRegularMonsters.length) * 100}%; background: linear-gradient(90deg, #b9f2ff, #74d4e8);"></div>
                </div>
            </div>
            ${monsterExterminatorComplete ? '<p class="bestiary-achievement-complete" style="font-size: 10px;">✓ Complete!</p>' : ''}
        </div>
        
        <div class="bestiary-stats-section">
            <h3>📜 Records</h3>
            <div class="bestiary-stat-row">
                <span>Most Killed Monster:</span>
                <span>${mostKilledMonster && monsterTypes[mostKilledMonster] ? monsterTypes[mostKilledMonster].name : 'None'}</span>
            </div>
            ${mostKilledMonster && monsterTypes[mostKilledMonster] ? `
            <div class="bestiary-stat-row">
                <span>Kill Count:</span>
                <span>${player.bestiary.monsterKills[mostKilledMonster].toLocaleString()}</span>
            </div>
            ` : ''}
            ${firstKill && monsterTypes[firstKill] ? `
            <div class="bestiary-stat-row">
                <span>First Kill:</span>
                <span>${monsterTypes[firstKill].name}</span>
            </div>
            ` : ''}
        </div>
    `;

    // Add event listener for Boss Slayer Supreme reward claiming
    setTimeout(() => {
        const claimBtn = document.getElementById('claim-boss-slayer-btn');
        if (claimBtn) {
            claimBtn.addEventListener('click', () => {
                // Give rewards
                player.gold += 50000;
                const crownItem = {
                    name: 'Boss Slayer Crown',
                    ...itemData['Boss Slayer Crown']
                };

                if (addItemToInventory(crownItem)) {
                    player.bestiaryRewards.bossSlayerSupreme = true;
                    player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + 50000;
                    updateAchievementProgress('action_accumulate', 'gold_earned');
                    addChatMessage(`Boss Slayer Supreme reward claimed! +${formatGold(50000)} + Boss Slayer Crown`, 'rare');
                    showNotification('Boss Slayer Supreme Complete!', 'rare');
                    updateBestiaryStatsTab(); // Refresh the tab
                    updateUI();
                } else {
                    addChatMessage('Inventory full! Cannot claim Boss Slayer Crown.', 'error');
                }
            });
        }
    }, 0);
}

function updateBestiaryMedalsTab() {
    // Deprecated - medals moved to Equipment window
    // Redirect to medals tab in achievements window
    updateMedalsTab();
}

function updateMedalsTab() {
    const container = document.getElementById('medals-list');
    if (!container) return;

    container.innerHTML = '';
    
    // Get currently equipped medal
    const equippedMedal = player.equippedMedal || null;

    // --- SPECIAL MEDALS SECTION ---
    const specialHeader = document.createElement('div');
    specialHeader.className = 'medal-section-header';
    specialHeader.textContent = 'Special Medals';
    container.appendChild(specialHeader);
    
    // Check for earned special medals
    if (typeof specialMedals !== 'undefined') {
        const earnedSpecial = [];
        const lockedSpecial = [];
        
        Object.values(specialMedals).forEach(medal => {
            const isEarned = checkSpecialMedalEarned(medal);
            if (isEarned) {
                earnedSpecial.push(medal);
            } else {
                lockedSpecial.push(medal);
            }
        });
        
        if (earnedSpecial.length === 0 && lockedSpecial.length === 0) {
            const noMedals = document.createElement('p');
            noMedals.style.cssText = 'color: #888; padding: 10px; text-align: center;';
            noMedals.textContent = 'No special medals available yet.';
            container.appendChild(noMedals);
        } else {
            // Show earned special medals
            earnedSpecial.forEach(medal => {
                const isEquipped = equippedMedal && equippedMedal.type === 'special' && equippedMedal.id === medal.id;
                const entry = createMedalEntry(medal, 'special', isEquipped, false);
                container.appendChild(entry);
            });
            
            // Show locked special medals
            lockedSpecial.forEach(medal => {
                const entry = createMedalEntry(medal, 'special', false, true);
                container.appendChild(entry);
            });
        }
    }

    // --- MONSTER KILLER MEDALS SECTION ---
    const monsterHeader = document.createElement('div');
    monsterHeader.className = 'medal-section-header';
    monsterHeader.textContent = 'Monster Killer Medals';
    container.appendChild(monsterHeader);

    const allMonsters = Object.keys(monsterTypes);
    let hasMonsterMedals = false;

    allMonsters.forEach(monsterType => {
        const killCount = player.bestiary.monsterKills[monsterType] || 0;
        const hasEarnedMedal = player.bestiaryRewards && player.bestiaryRewards.claimedMedals && player.bestiaryRewards.claimedMedals[monsterType];

        if (hasEarnedMedal) {
            hasMonsterMedals = true;
            const monster = monsterTypes[monsterType];
            const isMedalVisible = !player.bestiaryRewards.hiddenMedals || !player.bestiaryRewards.hiddenMedals[monsterType];

            let medalTier = 'bronze';
            let medalTitle = 'Killer';
            
            if (killCount >= 1000) {
                medalTier = 'diamond';
                medalTitle = 'Exterminator';
            } else if (killCount >= 500) {
                medalTier = 'gold';
                medalTitle = 'Slaughterer';
            } else if (killCount >= 150) {
                medalTier = 'silver';
                medalTitle = 'Hunter';
            }

            const medalData = {
                id: monsterType,
                name: `${monster.name} ${medalTitle}`,
                description: `Defeated ${killCount.toLocaleString()} ${monster.name}s`,
                tier: medalTier,
                category: monster.isMiniBoss ? 'Boss' : 'Monster',
                monsterType: monsterType,
                stats: typeof monsterMedalStats !== 'undefined' ? monsterMedalStats[medalTier] : null
            };

            const isEquipped = equippedMedal && equippedMedal.type === 'monster' && equippedMedal.id === monsterType;
            const entry = createMedalEntry(medalData, 'monster', isEquipped, false);
            container.appendChild(entry);
        }
    });

    if (!hasMonsterMedals) {
        const noMedals = document.createElement('p');
        noMedals.style.cssText = 'color: #888; padding: 10px; text-align: center;';
        noMedals.innerHTML = 'No Monster Killer medals earned yet.<br><small>Defeat monsters 50+ times to earn medals.</small>';
        container.appendChild(noMedals);
    }
}

function createMedalEntry(medal, type, isEquipped, isLocked) {
    // Initialize displayMedals if needed
    if (!player.displayMedals) player.displayMedals = [];
    
    // Check if this medal is being displayed
    const isDisplayed = player.displayMedals.some(m => m.type === type && m.id === medal.id);
    
    const entry = document.createElement('div');
    entry.className = `medal-entry ${medal.tier || 'bronze'}`;
    if (isLocked) entry.classList.add('locked');
    if (isEquipped) entry.classList.add('equipped');
    if (isDisplayed && !isEquipped) entry.classList.add('displayed');

    const info = document.createElement('div');
    info.className = 'medal-info';
    
    const title = document.createElement('h4');
    title.textContent = medal.name;
    if (isEquipped) title.textContent += ' [STATS]';
    if (isDisplayed && !isEquipped) title.textContent += ' [SHOWN]';
    if (isLocked) title.textContent += ' [LOCKED]';
    info.appendChild(title);
    
    const desc = document.createElement('p');
    desc.textContent = medal.description;
    info.appendChild(desc);
    
    // Show progress for locked medals
    if (isLocked && medal.requirement) {
        const progress = document.createElement('small');
        progress.className = 'medal-progress';
        progress.style.cssText = 'color: #f39c12; display: block; margin-top: 5px;';
        
        if (medal.requirement.type === 'level') {
            progress.textContent = `Progress: Level ${player.level}/${medal.requirement.level}`;
        } else if (medal.requirement.type === 'first_level') {
            progress.textContent = `Progress: Level ${player.level}/${medal.requirement.level} (Server first!)`;
        } else if (medal.requirement.type === 'first_all_bosses') {
            const bossTypes = Object.keys(monsterTypes).filter(t => monsterTypes[t].isMiniBoss);
            const bossesKilled = bossTypes.filter(t => (player.bestiary.monsterKills[t] || 0) > 0).length;
            progress.textContent = `Progress: ${bossesKilled}/${bossTypes.length} bosses defeated (Server first!)`;
        } else if (medal.requirement.type === 'first_completionist') {
            const totalAchievements = typeof achievementData !== 'undefined' ? Object.keys(achievementData).length : 0;
            const completedAchievements = Object.keys(player.achievements.completed).length;
            progress.textContent = `Progress: ${completedAchievements}/${totalAchievements} achievements (Server first!)`;
        } else if (medal.requirement.type === 'first_players') {
            progress.textContent = `Awarded to the first 100 players who created a character!`;
        } else if (medal.requirement.type === 'manual') {
            progress.textContent = `Awarded during the beta testing period!`;
        } else if (medal.requirement.type === 'first_sky_palace_entry') {
            progress.textContent = `Be the first player to enter Sky Palace!`;
        } else if (medal.requirement.type === 'first_alishar_kill') {
            progress.textContent = `Be the first player to defeat Alishar!`;
        } else if (medal.requirement.type === 'beta_participant') {
            progress.textContent = 'Beta participant reward';
        } else if (medal.requirement.type === 'event') {
            progress.textContent = `Event: ${medal.requirement.event || 'Special event'}`;
        } else if (medal.requirement.type === 'timePlayed') {
            const hoursPlayed = Math.floor((player.timePlayed || 0) / 3600);
            progress.textContent = `Progress: ${hoursPlayed}/${medal.requirement.hours} hours played`;
        } else if (medal.requirement.type === 'achievements') {
            const completedAchievements = Object.keys(player.achievements.completed).length;
            progress.textContent = `Progress: ${completedAchievements}/${medal.requirement.count} achievements`;
        } else if (medal.requirement.type === 'bestiary') {
            const totalMonsters = Object.keys(monsterTypes).filter(t => !monsterTypes[t].excludeFromBestiary).length;
            const discoveredMonsters = Object.keys(player.bestiary.monsterKills).filter(t => monsterTypes[t] && !monsterTypes[t].excludeFromBestiary).length;
            const percent = Math.round((discoveredMonsters / totalMonsters) * 100);
            progress.textContent = `Progress: ${percent}%/${medal.requirement.percent}% bestiary`;
        } else if (medal.requirement.type === 'totalKills') {
            const totalKills = Object.values(player.bestiary.monsterKills).reduce((sum, k) => sum + k, 0);
            progress.textContent = `Progress: ${totalKills.toLocaleString()}/${medal.requirement.count.toLocaleString()} kills`;
        }
        
        info.appendChild(progress);
    }
    
    // Show stats even for locked medals so players know what they're working towards
    if (medal.stats) {
        const statsText = document.createElement('small');
        statsText.className = 'medal-stats-display';
        if (isLocked) statsText.style.opacity = '0.7';
        const statStrings = [];
        for (const stat in medal.stats) {
            const value = medal.stats[stat];
            const statName = stat === 'critChance' ? 'Crit%' : 
                            stat === 'avoidability' ? 'Avoid' :
                            stat.charAt(0).toUpperCase() + stat.slice(1);
            statStrings.push(`+${value} ${statName}`);
        }
        statsText.textContent = statStrings.join(', ');
        info.appendChild(statsText);
    }
    
    entry.appendChild(info);

    // Actions - only show for unlocked medals
    if (!isLocked) {
        const actions = document.createElement('div');
        actions.className = 'medal-actions';
        actions.style.cssText = 'display: flex; gap: 5px; flex-wrap: wrap;';
        
        // Equip for Stats button
        const equipBtn = document.createElement('button');
        if (isEquipped) {
            equipBtn.textContent = 'Remove Stats';
            equipBtn.className = 'equipped-btn';
            equipBtn.style.cssText = 'font-size: 11px; padding: 4px 8px;';
            equipBtn.onclick = () => unequipMedal();
        } else {
            equipBtn.textContent = 'Use for Stats';
            equipBtn.style.cssText = 'font-size: 11px; padding: 4px 8px;';
            equipBtn.onclick = () => equipMedal(type, medal.id, medal.name, medal.tier);
        }
        actions.appendChild(equipBtn);
        
        // Show/Hide button
        const displayBtn = document.createElement('button');
        if (isDisplayed) {
            displayBtn.textContent = 'Hide';
            displayBtn.style.cssText = 'font-size: 11px; padding: 4px 8px;';
            displayBtn.onclick = () => toggleMedalDisplay(type, medal.id, medal.name, medal.tier);
        } else {
            displayBtn.textContent = 'Show';
            displayBtn.style.cssText = 'font-size: 11px; padding: 4px 8px;';
            displayBtn.onclick = () => toggleMedalDisplay(type, medal.id, medal.name, medal.tier);
        }
        actions.appendChild(displayBtn);
        
        entry.appendChild(actions);
    }

    return entry;
}

function equipMedal(type, id, name, tier) {
    player.equippedMedal = { type, id, name, tier };
    if (typeof addChatMessage !== 'undefined') {
        addChatMessage(`Using ${name} for stats`, 'system');
    }
    updatePlayerNameplate();
    updateMedalsTab();
    updateUI();
    updateStatWindowUI();
    saveCharacter();
    
    // Notify server of appearance change for multiplayer
    if (typeof sendAppearanceUpdate === 'function') {
        sendAppearanceUpdate();
    }
}

function unequipMedal() {
    if (player.equippedMedal) {
        const name = player.equippedMedal.name;
        player.equippedMedal = null;
        if (typeof addChatMessage !== 'undefined') {
            addChatMessage(`Removed ${name} from stats`, 'system');
        }
        updatePlayerNameplate();
        updateMedalsTab();
        updateUI();
        updateStatWindowUI();
        saveCharacter();
        
        // Notify server of appearance change for multiplayer
        if (typeof sendAppearanceUpdate === 'function') {
            sendAppearanceUpdate();
        }
    }
}

function toggleMedalDisplay(type, id, name, tier) {
    if (!player.displayMedals) player.displayMedals = [];
    
    // Check if medal is already in display list
    const existingIndex = player.displayMedals.findIndex(m => m.type === type && m.id === id);
    
    if (existingIndex >= 0) {
        // Remove from display
        player.displayMedals.splice(existingIndex, 1);
        if (typeof addChatMessage !== 'undefined') {
            addChatMessage(`Hidden medal: ${name}`, 'system');
        }
    } else {
        // Add to display
        player.displayMedals.push({ type, id, name, tier });
        if (typeof addChatMessage !== 'undefined') {
            addChatMessage(`Showing medal: ${name}`, 'system');
        }
    }
    
    updatePlayerNameplate();
    updateMedalsTab();
    saveCharacter();
    
    // Notify server of appearance change for multiplayer
    if (typeof sendAppearanceUpdate === 'function') {
        sendAppearanceUpdate();
    }
}

// Get medal stats for the currently equipped medal
function getEquippedMedalStats() {
    if (!player.equippedMedal) return null;
    
    if (player.equippedMedal.type === 'special') {
        // Get stats from special medals data
        if (typeof specialMedals !== 'undefined' && specialMedals[player.equippedMedal.id]) {
            return specialMedals[player.equippedMedal.id].stats || null;
        }
    } else if (player.equippedMedal.type === 'monster') {
        // Get stats from monster medal tiers
        const tier = player.equippedMedal.tier;
        if (typeof monsterMedalStats !== 'undefined' && tier) {
            return monsterMedalStats[tier] || null;
        }
    }
    return null;
}

// Check if a special medal is earned
function checkSpecialMedalEarned(medal) {
    if (!medal || !medal.requirement) return false;
    
    // Check player's earned special medals
    if (player.specialMedals && player.specialMedals[medal.id]) {
        return true;
    }
    
    // Check requirement conditions for local medals
    const req = medal.requirement;
    switch (req.type) {
        case 'playtime':
            return (player.timePlayed || 0) >= req.hours * 3600;
        case 'kill_count':
            return (player.bestiary.monsterKills[req.monster] || 0) >= req.count;
        case 'gold_total':
            return (player.stats?.totalGoldEarned || 0) >= req.amount;
        case 'enhance_max':
            // Check if any equipped/inventory item has +10 enhancement
            for (const slot in player.equipped) {
                if (player.equipped[slot]?.enhancement >= 10) return true;
            }
            return false;
        case 'all_quests':
            const totalQuests = Object.keys(questData || {}).length;
            return (player.quests?.completed?.length || 0) >= totalQuests;
        case 'talk_all_npcs':
            const totalNPCs = Object.keys(npcData || {}).length;
            return (player.stats?.talkedNPCs?.size || 0) >= totalNPCs;
        case 'all_jqs':
            return player.stats?.jqsCompleted?.includes('onyx') && player.stats?.jqsCompleted?.includes('dewdrop');
        case 'manual':
        case 'first_level':
        case 'first_all_bosses':
        case 'first_completionist':
        case 'first_players':
        case 'first_sky_palace_entry':
        case 'first_alishar_kill':
            // These require server verification - check if already granted
            return player.specialMedals && player.specialMedals[medal.id];
        default:
            return false;
    }
}

function getBestiaryMedals(killCount) {
    const medals = [];

    if (killCount >= 1000) medals.push({ name: 'Exterminator', tier: 'diamond' });
    else if (killCount >= 500) medals.push({ name: 'Slaughterer', tier: 'gold' });
    else if (killCount >= 150) medals.push({ name: 'Hunter', tier: 'silver' });
    else if (killCount >= 50) medals.push({ name: 'Killer', tier: 'bronze' });

    return medals;
}

function showMonsterDetailInPanel(monsterType) {
    const monster = monsterTypes[monsterType];
    const killCount = player.bestiary.monsterKills[monsterType] || 0;
    const drops = player.bestiary.dropsFound[monsterType] || {};
    const medals = getBestiaryMedals(killCount);

    // Check Monster Killer medal status
    const hasEarnedMedal = player.bestiaryRewards && player.bestiaryRewards.claimedMedals && player.bestiaryRewards.claimedMedals[monsterType];

    const detailPanel = document.getElementById('bestiary-detail-panel');
    
    // Create detail panel HTML
    const detailHTML = `
        <div class="bestiary-detail-content">
                <div class="monster-detail-layout">
                    <div class="monster-animation-container">
                        <div id="monster-sprite-display" class="monster-sprite-animated"></div>
                    </div>
                    <div class="monster-info-section">
                        <h3>${monster.name} ${monster.isMiniBoss ? '(Boss)' : ''}</h3>
                        <div class="monster-stats-grid">
                            <div class="stat-item"><span>Level:</span> <span>${monster.level}</span></div>
                            <div class="stat-item"><span>HP:</span> <span>${monster.hp.toLocaleString()}</span></div>
                            <div class="stat-item"><span>Damage:</span> <span>${monster.damage}</span></div>
                            <div class="stat-item"><span>EXP:</span> <span>${monster.exp.toLocaleString()}</span></div>
                            <div class="stat-item"><span>Kills:</span> <span>${killCount}</span></div>
                            <div class="stat-item"><span>Accuracy:</span> <span>${monster.accuracy}</span></div>
                        </div>
                        <div class="monster-medals">
                            ${medals.map(medal => `<span class="bestiary-medal ${medal.tier}">${medal.name}</span>`).join('')}
                            ${hasEarnedMedal ? `<p style="font-size: 9px; color: #ffd700; margin-top: 4px;">${monster.name} Killer Medal Earned</p>` : ''}
                        </div>
                        <div class="medal-progress-section" style="margin-top: 8px;">
                            <h5 style="margin: 0 0 3px 0; font-size: 10px; color: var(--text-color);">Medal Progress:</h5>
                            ${(() => {
                                let nextTier = '';
                                let nextTierKills = 0;
                                let currentProgress = 0;
                                let progressPercent = 0;
                                let tierColor = '#cd7f32'; // bronze
                                
                                if (killCount >= 1000) {
                                    nextTier = 'Max Tier Reached';
                                    currentProgress = killCount;
                                    nextTierKills = killCount;
                                    progressPercent = 100;
                                    tierColor = '#b9f2ff'; // diamond
                                } else if (killCount >= 500) {
                                    nextTier = 'Diamond (Exterminator)';
                                    nextTierKills = 1000;
                                    currentProgress = killCount - 500;
                                    progressPercent = (currentProgress / 500) * 100;
                                    tierColor = '#ffd700'; // gold
                                } else if (killCount >= 150) {
                                    nextTier = 'Gold (Slaughterer)';
                                    nextTierKills = 500;
                                    currentProgress = killCount - 150;
                                    progressPercent = (currentProgress / 350) * 100;
                                    tierColor = '#c0c0c0'; // silver
                                } else if (killCount >= 50) {
                                    nextTier = 'Silver (Hunter)';
                                    nextTierKills = 150;
                                    currentProgress = killCount - 50;
                                    progressPercent = (currentProgress / 100) * 100;
                                    tierColor = '#cd7f32'; // bronze
                                } else {
                                    nextTier = 'Bronze (Killer)';
                                    nextTierKills = 50;
                                    currentProgress = killCount;
                                    progressPercent = (killCount / 50) * 100;
                                    tierColor = '#888'; // no tier yet
                                }
                                
                                return `
                                    <div style="background: rgba(0, 0, 0, 0.3); padding: 5px; border-radius: 4px; border: 1px solid var(--ui-border);">
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 9px;">
                                            <span style="color: var(--text-color);">Next: ${nextTier}</span>
                                            <span style="color: var(--exp-color);">${killCount >= 1000 ? '' : killCount + '/' + nextTierKills}</span>
                                        </div>
                                        <div style="width: 100%; height: 8px; background: rgba(0, 0, 0, 0.5); border-radius: 4px; overflow: hidden; border: 1px solid var(--ui-border);">
                                            <div style="height: 100%; background: ${tierColor}; width: ${progressPercent}%; transition: width 0.3s ease;"></div>
                                        </div>
                                    </div>
                                `;
                            })()}
                        </div>
                    </div>
                </div>
                <div class="monster-drops-section">
                    <h4>Drops Found (${monster.loot.filter(loot => loot.name !== 'Gold' && drops[loot.name] !== undefined).length}/${monster.loot.filter(loot => loot.name !== 'Gold').length})</h4>
                    <div class="drops-grid">
                        ${monster.loot.map(lootItem => {
        const dropName = lootItem.name;
        const dropCount = drops[dropName];
        const isDiscovered = dropCount !== undefined;
        const dropInfo = itemData[dropName];
        let dropIcon = '';

        if (isDiscovered) {
            // Create drop icon for discovered items
            if (dropName === 'Gold') {
                // Use static coin for gold - single frame, no animation
                dropIcon = `<div class="coin-icon pixel-art" style="
                                        width: 32px; 
                                        height: 32px; 
                                        background-image: url(${artAssets.coin}); 
                                        background-position: 0px 0px;
                                        background-size: 128px 32px;
                                        background-repeat: no-repeat;
                                        image-rendering: pixelated;
                                    "></div>`;
            } else if (dropInfo && spriteData.dropIcons && spriteData.dropIcons.icons[dropName]) {
                const iconData = spriteData.dropIcons.icons[dropName];
                const iconSize = spriteData.dropIcons.frameWidth; // Original sprite size (e.g., 8px)
                const scaledSize = iconSize * 4; // Calculate final display size
                dropIcon = `<div class="drop-icon-wrapper" style="width: ${scaledSize}px; height: ${scaledSize}px; overflow: hidden; display: inline-block;">
                                        <div class="item-icon pixel-art" style="
                                            width: ${iconSize}px; 
                                            height: ${iconSize}px; 
                                            background-image: url(${artAssets.dropIcons}); 
                                            background-position: -${iconData.x}px -${iconData.y}px;
                                            background-repeat: no-repeat;
                                            image-rendering: pixelated;
                                            transform: scale(4);
                                            transform-origin: top left;
                                        "></div>
                                    </div>`;
            } else {
                dropIcon = '<div class="unknown-icon">?</div>';
            }

            const rarity = dropInfo ? dropInfo.rarity || 'common' : 'common';
            const displayCount = dropName === 'Gold' ? dropCount.toLocaleString() : `×${dropCount}`;
            return `
                                    <div class="drop-item ${rarity}">
                                        ${dropIcon}
                                        <span class="drop-name">${dropName}</span>
                                        <span class="drop-count">${displayCount}</span>
                                    </div>
                                `;
        } else {
            // Create empty slot for undiscovered items
            return `
                                    <div class="drop-item undiscovered">
                                        <div class="empty-slot">?</div>
                                        <span class="drop-name">???</span>
                                        <span class="drop-count">???</span>
                                    </div>
                                `;
        }
    }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Update the detail panel
    detailPanel.innerHTML = detailHTML;

    // Set up monster sprite animation
    const spriteDisplay = document.getElementById('monster-sprite-display');
    
    // Check if monster uses pixel art first
    if (monster.isPixelArt && spriteData[monsterType]) {
        // Handle pixel art monsters with sprite data
        const monsterSprite = monster.sprite || artAssets[monsterType];
        const monsterData = spriteData[monsterType];
        const frameWidth = monsterData.frameWidth;
        const frameHeight = monsterData.frameHeight;
        const scale = 4; // Scale up for better visibility

        // Calculate the sprite sheet dimensions based on animation frames
        let maxX = 0, maxY = 0;
        if (monsterData.animations && monsterData.animations.idle) {
            monsterData.animations.idle.forEach(frame => {
                maxX = Math.max(maxX, frame.x + frameWidth);
                maxY = Math.max(maxY, frame.y + frameHeight);
            });
        } else {
            maxX = frameWidth;
            maxY = frameHeight;
        }

        spriteDisplay.style.cssText = `
            width: ${frameWidth * scale}px;
            height: ${frameHeight * scale}px;
            background-image: url(${monsterSprite});
            background-position: 0px 0px;
            background-size: ${maxX * scale}px ${maxY * scale}px;
            image-rendering: pixelated;
            margin: 20px auto;
            background-repeat: no-repeat;
        `;

        // Add idle animation if available
        if (monsterData.animations && monsterData.animations.idle) {
            let frameIndex = 0;
            const frames = monsterData.animations.idle;
            const animateSprite = () => {
                const frame = frames[frameIndex];
                spriteDisplay.style.backgroundPosition = `-${frame.x * scale}px -${frame.y * scale}px`;
                frameIndex = (frameIndex + 1) % frames.length;
            };

            // Start animation
            animateSprite();
            setInterval(animateSprite, 166); // ~15 frames at 60fps = 250ms, but use 166ms for smoother display
        }
    } else if (monster.sprite && typeof monster.sprite === 'string' && monster.sprite.includes('<svg')) {
        // Handle SVG monsters
        spriteDisplay.innerHTML = monster.sprite;
        // Add animation class for idle animation
        spriteDisplay.classList.add('monster-idle-animation');
    } else {
        // Fallback for monsters without sprite data
        spriteDisplay.innerHTML = '<div class="no-sprite-available">Sprite not available</div>';
    }
}

/**
 * Updates the achievement UI with progress and claimable rewards.
 */
function updateAchievementUI() {
    // Setup tabs (only once)
    setupAchievementTabs();
    
    const container = document.getElementById('achievement-list');
    container.innerHTML = '';
    
    // --- NEW: Clean up any deleted achievements that may still be in player data ---
    if (player.achievements) {
        const validAchievementIds = Object.keys(achievementData);
        
        // Remove from progress
        if (player.achievements.progress) {
            for (const id in player.achievements.progress) {
                if (!validAchievementIds.includes(id)) {
                    delete player.achievements.progress[id];
                }
            }
        }
        
        // Remove from completed
        if (player.achievements.completed) {
            for (const id in player.achievements.completed) {
                if (!validAchievementIds.includes(id)) {
                    delete player.achievements.completed[id];
                }
            }
        }
        
        // Remove from claimed
        if (player.achievements.claimed) {
            for (const id in player.achievements.claimed) {
                if (!validAchievementIds.includes(id)) {
                    delete player.achievements.claimed[id];
                }
            }
        }
    }
    // --- END NEW ---
    
    // Sort achievements: claimable first, then by tier, then by completion status
    const achievementEntries = Object.keys(achievementData).map(id => {
        const ach = achievementData[id];
        const progressData = player.achievements.progress[id] || 0;
        const isCompleted = player.achievements.completed[id];
        const isClaimed = player.achievements.claimed[id];
        const isClaimable = isCompleted && !isClaimed;
        
        // Tier order for sorting (higher = better)
        const tierOrder = { diamond: 4, gold: 3, silver: 2, bronze: 1 };
        
        return {
            id,
            ach,
            progressData,
            isCompleted,
            isClaimed,
            isClaimable,
            tierValue: tierOrder[ach.tier] || 0
        };
    });
    
    // Sort: claimable first, then by tier (ascending - bronze to diamond), then unclaimed completed, then by progress
    achievementEntries.sort((a, b) => {
        // Claimable always first
        if (a.isClaimable !== b.isClaimable) return b.isClaimable ? 1 : -1;
        // Then by tier (ascending order: bronze first)
        if (a.tierValue !== b.tierValue) return a.tierValue - b.tierValue;
        // Then completed but not claimed
        if (a.isCompleted !== b.isCompleted) return b.isCompleted ? 1 : -1;
        // Then claimed last
        if (a.isClaimed !== b.isClaimed) return a.isClaimed ? 1 : -1;
        return 0;
    });
    
    achievementEntries.forEach(({ id, ach, progressData, isCompleted, isClaimed, isClaimable }) => {
        const entry = document.createElement('div');
        entry.className = `achievement-entry ${ach.tier}`;
        if (isClaimed) entry.classList.add('completed');
        if (isClaimable) entry.classList.add('claimable');

        let displayProgress = 0, requirementCount = 1;
        if (ach.type === 'explore') {
            displayProgress = Array.isArray(progressData) ? progressData.length : 0;
            requirementCount = ach.requirement;
        } else if (ach.type === 'kill') {
            displayProgress = progressData;
            requirementCount = ach.requirement.count;
        } else if (ach.type === 'kill_set') {
            // kill_set stores an array of killed boss types
            displayProgress = Array.isArray(progressData) ? progressData.length : 0;
            requirementCount = ach.requirement.targets.length;
        } else if (ach.type === 'level') {
            displayProgress = progressData;
            requirementCount = ach.requirement;
        } else if (ach.type === 'action_accumulate') {
            displayProgress = progressData;
            requirementCount = ach.requirement.amount;
        } else { // 'action' type
            displayProgress = progressData;
        }

        let progressHtml = '';
        if (!isCompleted) {
            const percent = Math.min((displayProgress / requirementCount) * 100, 100);
            progressHtml = `<div class="achievement-progress"><div class="achievement-progress-fill" style="width: ${percent}%;"></div></div>`;
        }

        // Build reward display
        const expRewards = { 'bronze': 50, 'silver': 150, 'gold': 400, 'diamond': 1000 };
        const expReward = expRewards[ach.tier] || 0;
        let rewardText = [];
        if (ach.reward.gold) rewardText.push(formatGold(ach.reward.gold));
        if (expReward) rewardText.push(`${expReward} EXP`);
        if (ach.reward.item) {
            const itemCount = ach.reward.quantity || 1;
            rewardText.push(itemCount > 1 ? `${itemCount}x ${ach.reward.item}` : ach.reward.item);
        }
        const rewardDisplay = rewardText.length > 0 ? `<small>Reward: ${rewardText.join(', ')}</small>` : '';

        let buttonHtml = '';
        let claimableIcon = '';
        if (isCompleted && !isClaimed) {
            buttonHtml = `<button data-ach-id="${id}">Claim</button>`;
            const iconData = spriteData.uiIcons.icons.exclamation;
            claimableIcon = `<span class="achievement-claimable-icon" style="display: inline-block; width: 24px; height: 24px; background-image: url(${artAssets.uiIcons}); background-position: -${iconData.x * 1.5}px -${iconData.y * 1.5}px; background-size: 72px 72px; image-rendering: pixelated; margin-left: 5px; vertical-align: middle;"></span>`;
        } else if (isClaimed) {
            buttonHtml = `<button disabled>Claimed</button>`;
        }

        entry.innerHTML = `
            <div class="achievement-info">
                <h4>${ach.title}${claimableIcon}</h4>
                <p>${ach.description} (${Math.min(displayProgress, requirementCount)}/${requirementCount})</p>
                ${rewardDisplay}
                ${progressHtml}
            </div>
            <div class="achievement-reward">${buttonHtml}</div>`;
        container.appendChild(entry);
    });

    container.querySelectorAll('button[data-ach-id]').forEach(button => {
        button.addEventListener('click', (e) => claimAchievementReward(e.target.dataset.achId));
    });
}

// Rankings UI Functions
let activeRankingCategory = 'combat';

/**
 * Format a timestamp into a human-readable "time ago" string
 * Also returns freshness info for staleness indicators
 */
function formatTimeAgo(timestamp) {
    if (!timestamp) return { text: 'Unknown', daysAgo: 999, isFresh: false };
    
    // Handle Firebase Timestamp objects
    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else {
        date = new Date(timestamp);
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    let text;
    if (diffMins < 1) {
        text = 'Just now';
    } else if (diffMins < 60) {
        text = `${diffMins}m ago`;
    } else if (diffHours < 24) {
        text = `${diffHours}h ago`;
    } else if (diffDays < 7) {
        text = `${diffDays}d ago`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        text = `${weeks}w ago`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        text = `${months}mo ago`;
    } else {
        const years = Math.floor(diffDays / 365);
        text = `${years}y ago`;
    }
    
    return {
        text,
        daysAgo: diffDays,
        isFresh: diffDays < 7  // Consider "fresh" if updated within a week
    };
}

/**
 * Get staleness indicator styling
 */
function getStalenessIndicator(timestamp) {
    const { text, daysAgo, isFresh } = formatTimeAgo(timestamp);
    
    let color, icon;
    if (daysAgo < 1) {
        color = '#2ecc71'; // Green - very fresh
        icon = '🟢';
    } else if (daysAgo < 7) {
        color = '#3498db'; // Blue - recent
        icon = '🔵';
    } else if (daysAgo < 30) {
        color = '#f39c12'; // Orange - getting stale
        icon = '🟠';
    } else {
        color = '#95a5a6'; // Gray - stale
        icon = '⚪';
    }
    
    return { text, color, icon, daysAgo };
}

async function updateRankingsUI() {
    const container = document.getElementById('rankings-content');
    const playerRankDisplay = document.getElementById('player-rank-display');
    
    // Show loading state
    container.innerHTML = '<div style="text-align: center; padding: 50px; color: #bdc3c7;"><p>Loading rankings...</p></div>';
    
    try {
        // Handle guilds category separately
        if (activeRankingCategory === 'guilds') {
            await updateGuildRankingsUI(container, playerRankDisplay);
            return;
        }
        
        // Get rankings
        const rankings = await getTopRankings(activeRankingCategory, 100);
        
        // Get player's rank
        const playerRank = await getPlayerRank(activeRankingCategory);
        
        // Update player rank display
        if (playerRank) {
            playerRankDisplay.innerHTML = `
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <span>Global Rank: <strong style="color: var(--exp-color);">#${playerRank}</strong></span>
                    <span>Level: <strong>${player.level}</strong></span>
                    <span>Total Kills: <strong>${Object.values(player.bestiary.monsterKills).reduce((sum, kills) => sum + kills, 0)}</strong></span>
                </div>
            `;
        } else {
            playerRankDisplay.innerHTML = '<span>Submit your ranking to see your rank!</span>';
        }
        
        if (rankings.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 50px; color: #bdc3c7;">
                    <p>No rankings yet. Be the first to submit!</p>
                    <p style="margin-top: 10px; font-size: 10px;">Click "Submit/Update Ranking" to add your stats.</p>
                </div>
            `;
            return;
        }
        
        // Get category display info
        const categoryInfo = {
            combat: { label: 'Combat Score', getValue: r => `⚔️ ${(r.combatScore || 0).toLocaleString()}` },
            level: { label: 'Level', getValue: r => `Lv.${r.level}` },
            kills: { label: 'Total Kills', getValue: r => r.totalKills.toLocaleString() },
            gold: { label: 'Gold', getValue: r => formatGold(r.totalGold) },
            achievements: { label: 'Achievements', getValue: r => r.achievementCount },
            bestiary: { label: 'Bestiary', getValue: r => `${r.bestiaryCompletion}%` },
            bosses: { label: 'Boss Kills', getValue: r => r.bossKills }
        };
        
        const info = categoryInfo[activeRankingCategory];
        
        // Build rankings HTML
        container.innerHTML = rankings.map((ranking, index) => {
            const isCurrentPlayer = (ranking.playerName === player.name) || (ranking.id === player.name);
            const rankClass = index < 3 ? `top-${index + 1}` : '';
            const highlightClass = isCurrentPlayer ? 'current-player' : '';
            
            let rankMedal = '';
            if (index === 0) rankMedal = '🥇';
            else if (index === 1) rankMedal = '🥈';
            else if (index === 2) rankMedal = '🥉';
            
            // GM tag for players who have used GM privileges
            const gmTag = ranking.isGM ? '<span style="background: linear-gradient(135deg, #e74c3c, #c0392b); color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; margin-left: 5px;">GM</span>' : '';
            
            // Staleness indicator
            const staleness = getStalenessIndicator(ranking.timestamp);
            const stalenessHtml = `<span title="Last updated: ${staleness.text}" style="font-size: 10px; color: ${staleness.color}; margin-left: auto; opacity: 0.8;">${staleness.icon} ${staleness.text}</span>`;
            
            return `
                <div class="ranking-entry ${rankClass} ${highlightClass}" style="display: flex; align-items: center; padding: 10px; margin-bottom: 5px; background: rgba(0,0,0,${isCurrentPlayer ? 0.5 : 0.2}); border-radius: 5px; ${isCurrentPlayer ? 'border: 2px solid var(--exp-color);' : ''}">
                    <span class="ranking-number" style="min-width: 60px; font-size: 16px; font-weight: bold; color: ${index < 3 ? '#ffd700' : '#bdc3c7'};">${rankMedal} #${index + 1}</span>
                    <div style="flex: 1; display: flex; gap: 15px; align-items: center;">
                        <span class="ranking-name" style="min-width: 150px; font-size: 14px; color: ${isCurrentPlayer ? 'var(--exp-color)' : '#ecf0f1'}; font-weight: ${isCurrentPlayer ? 'bold' : 'normal'};">${ranking.playerName}${gmTag}</span>
                        <span class="ranking-class" style="min-width: 100px; font-size: 11px; color: ${classColors[capitalize(ranking.class)] || '#fff'};">${capitalize(ranking.class)}</span>
                        <span class="ranking-value" style="min-width: 120px; font-size: 13px; color: #3498db; font-weight: bold;">${info.getValue(ranking)}</span>
                        ${stalenessHtml}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error updating rankings UI:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #e74c3c;">
                <p>Failed to load rankings.</p>
                <p style="margin-top: 10px; font-size: 10px;">Please check your internet connection.</p>
            </div>
        `;
    }
}

/**
 * Update the rankings UI for guilds category
 */
async function updateGuildRankingsUI(container, playerRankDisplay) {
    try {
        // Get guild rankings
        const guildRankings = typeof getTopGuildRankings === 'function' 
            ? await getTopGuildRankings(50) 
            : [];
        
        // Update player rank display for guilds
        if (player.guild && player.guild.name) {
            const guildRank = typeof getPlayerGuildRank === 'function' 
                ? await getPlayerGuildRank() 
                : null;
            
            const playerGuild = guildRankings.find(g => g.name === player.guild.name);
            const guildCombatScore = playerGuild ? playerGuild.totalCombatScore : 0;
            const guildMemberCount = playerGuild ? playerGuild.memberCount : 1;
            
            playerRankDisplay.innerHTML = `
                <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                    ${guildRank ? `<span>Guild Rank: <strong style="color: #9b59b6;">#${guildRank}</strong></span>` : ''}
                    <span style="display: flex; align-items: center; gap: 5px;">
                        ${renderGuildIcon(player.guild.icon || 1, 1)}
                        <strong style="color: #9b59b6;">${player.guild.name}</strong>
                    </span>
                    <span>Score: <strong>${guildCombatScore.toLocaleString()}</strong></span>
                    <span>Members: <strong>${guildMemberCount}</strong></span>
                </div>
            `;
        } else {
            playerRankDisplay.innerHTML = '<span style="color: #9b59b6;">Join or create a guild to compete in guild rankings!</span>';
        }
        
        if (guildRankings.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 50px; color: #bdc3c7;">
                    <p style="color: #9b59b6; font-size: 1.2em;">🏰 No guild rankings yet!</p>
                    <p style="margin-top: 10px;">Create a guild in the Social Hub and submit your ranking to appear here.</p>
                    <p style="margin-top: 10px; font-size: 10px; color: #7f8c8d;">Guild rankings are based on the combined Combat Score of all members.</p>
                </div>
            `;
            return;
        }
        
        // Build guild rankings HTML
        container.innerHTML = guildRankings.map((guild, index) => {
            const isMyGuild = player.guild && player.guild.name === guild.name;
            const rankClass = index < 3 ? `top-${index + 1}` : '';
            const highlightClass = isMyGuild ? 'current-player' : '';
            
            let rankMedal = '';
            if (index === 0) rankMedal = '🥇';
            else if (index === 1) rankMedal = '🥈';
            else if (index === 2) rankMedal = '🥉';
            
            // Get top 3 members by combat score for display
            const topMembers = Object.entries(guild.members || {})
                .sort((a, b) => (b[1].combatScore || 0) - (a[1].combatScore || 0))
                .slice(0, 3)
                .map(([name, data]) => `${name} (${(data.combatScore || 0).toLocaleString()})`)
                .join(', ');
            
            // Staleness indicator for guild
            const staleness = getStalenessIndicator(guild.lastUpdated);
            const stalenessHtml = `<span title="Last updated: ${staleness.text}" style="font-size: 10px; color: ${staleness.color}; margin-left: auto; opacity: 0.8;">${staleness.icon} ${staleness.text}</span>`;
            
            return `
                <div class="ranking-entry ${rankClass} ${highlightClass}" style="display: flex; align-items: center; padding: 12px; margin-bottom: 8px; background: rgba(155, 89, 182, ${isMyGuild ? 0.3 : 0.1}); border-radius: 5px; ${isMyGuild ? 'border: 2px solid #9b59b6;' : 'border: 1px solid rgba(155, 89, 182, 0.3);'}">
                    <span class="ranking-number" style="min-width: 60px; font-size: 16px; font-weight: bold; color: ${index < 3 ? '#ffd700' : '#bdc3c7'};">${rankMedal} #${index + 1}</span>
                    <div style="flex: 1;">
                        <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 5px;">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                ${renderGuildIcon(guild.icon || 1, 2)}
                                <span class="ranking-name" style="font-size: 14px; color: ${isMyGuild ? '#9b59b6' : '#ecf0f1'}; font-weight: bold;">${guild.name}</span>
                            </span>
                            <span style="font-size: 11px; color: #bdc3c7;">👥 ${guild.memberCount} member${guild.memberCount !== 1 ? 's' : ''}</span>
                            <span class="ranking-value" style="font-size: 13px; color: #9b59b6; font-weight: bold;">⚔️ ${(guild.totalCombatScore || 0).toLocaleString()}</span>
                            ${stalenessHtml}
                        </div>
                        <div style="font-size: 10px; color: #7f8c8d; margin-left: 46px;">
                            Top members: ${topMembers || 'None'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error updating guild rankings UI:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #e74c3c;">
                <p>Failed to load guild rankings.</p>
                <p style="margin-top: 10px; font-size: 10px;">Please check your internet connection.</p>
            </div>
        `;
    }
}

function setupRankingsTabs() {
    const tabButtons = document.querySelectorAll('.ranking-tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            if (button.classList.contains('active')) return;
            
            // Update active state
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update active category and refresh
            activeRankingCategory = button.dataset.category;
            await updateRankingsUI();
        });
    });
}

function initializeRankingsWindow() {
    // Set up tab switching
    setupRankingsTabs();
    
    // Set up submit button
    const submitBtn = document.getElementById('submit-ranking-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            
            const success = await submitRanking();
            
            if (success) {
                await updateRankingsUI();
            }
            
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit/Update Ranking';
        });
    }
    
    // Don't load rankings on init - wait until window is opened to save reads
    // Rankings will be loaded when toggleWindow is called with updateRankingsUI
}

// ============================================
// ============================================
// SOCIAL HUB UI
// ============================================

let tradeWindow = null;
let tradeItems = [];
let tradeUnsubscribe = null;
let tradeUpdatingLocally = false; // Flag to prevent Firebase listener from interfering with local updates
let currentSocialTab = 'online';

// Buddy list stored in player object
// player.buddies = [{ name: 'PlayerName', addedAt: timestamp }]

// Guild data stored in player object  
// player.guild = { name: 'GuildName', icon: 'iconId', role: 'master'|'member', joinedAt: timestamp }

function initializeSocialHub() {
    tradeWindow = document.getElementById('trade-window');
    
    // Set up trade window buttons first (don't skip if socialHubWindow is null)
    if (tradeWindow) {
        const tradeCloseBtn = tradeWindow.querySelector('.close-btn');
        if (tradeCloseBtn) {
            tradeCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeTradeWindow();
            });
        }
        
        const cancelBtn = document.getElementById('cancel-trade-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof cancelTrade === 'function') cancelTrade();
            });
        }
        
        const confirmBtn = document.getElementById('confirm-trade-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Confirming...';
                
                try {
                    if (typeof confirmTrade === 'function') {
                        const result = await confirmTrade();
                        setTimeout(() => {
                            if (tradeWindow && tradeWindow.style.display !== 'none') {
                                confirmBtn.disabled = false;
                                confirmBtn.textContent = '✓ Confirm Trade';
                            }
                        }, 10000);
                    }
                } catch (error) {
                    console.error('Trade confirmation error:', error);
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = '✓ Confirm Trade';
                }
            });
        }
        
        const addItemBtn = document.getElementById('add-item-to-trade-btn');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', openTradeItemSelector);
        }
        
        const goldInput = document.getElementById('my-trade-gold');
        if (goldInput) {
            goldInput.addEventListener('change', async (e) => {
                const gold = Math.max(0, Math.min(parseInt(e.target.value) || 0, player.gold));
                e.target.value = gold;
                if (typeof updateTradeOffer === 'function') {
                    await updateTradeOffer(tradeItems, gold);
                }
            });
        }
    }
    
    if (!socialHubWindow) return;
    
    // Set up close button
    const closeBtn = socialHubWindow.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            socialHubWindow.style.display = 'none';
        });
    }
    
    // Set up tab switching
    const tabs = socialHubWindow.querySelectorAll('#social-hub-tabs .tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchSocialTab(tabName);
        });
    });
    
    // Initialize buddy list if not exists
    if (!player.buddies) {
        player.buddies = [];
    }
}

function switchSocialTab(tabName) {
    currentSocialTab = tabName;
    
    // Update tab buttons
    const tabs = socialHubWindow.querySelectorAll('#social-hub-tabs .tab-btn');
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    const contents = socialHubWindow.querySelectorAll('.social-tab-content');
    contents.forEach(content => {
        content.classList.toggle('active', content.id === `social-tab-${tabName}`);
    });
    
    // Update the active tab's content
    updateSocialHubUI();
}

function updateSocialHubUI() {
    if (!socialHubWindow) return;
    
    const countEl = document.getElementById('online-count');
    const totalOnline = typeof getOnlinePlayerCount === 'function' ? getOnlinePlayerCount() : 0;
    if (countEl) {
        countEl.textContent = totalOnline;
    }
    
    switch (currentSocialTab) {
        case 'online':
            updateOnlineTab();
            break;
        case 'party':
            updatePartyTab();
            break;
        case 'buddies':
            updateBuddiesTab();
            break;
        case 'guild':
            updateGuildTab();
            break;
    }
}

function getStatusIndicator(status) {
    if (status === 'afk') {
        return '<span class="status-indicator status-afk" title="Away">💤</span>';
    }
    return '<span class="status-indicator status-online" title="Online">🟢</span>';
}

// ============================================
// ONLINE TAB
// ============================================

// Activity icons for display
const activityIcons = {
    'exploring': '🚶',
    'grinding': '⚔️',
    'questing': '📜',
    'boss': '💀',
    'trading': '💰',
    'afk': '💤'
};

function updateOnlineTab() {
    const list = document.getElementById('online-players-list');
    if (!list) return;
    
    const players = typeof getOnlinePlayers === 'function' ? getOnlinePlayers() : [];
    const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : { partyId: null, leader: null, members: [] };
    const isInParty = !!partyInfo.partyId;
    const isPartyLeader = partyInfo.leader === player.name;
    const hasGuild = player.guild && player.guild.name;
    const isGuildMaster = hasGuild && player.guild.role === 'master';
    
    if (players.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #7f8c8d;">
                <p>No other players online</p>
                <p style="font-size: 0.85em; margin-top: 10px;">Share the game with friends!</p>
            </div>
        `;
        return;
    }
    
    const playersHtml = players.map(p => {
        const inOtherParty = p.partyId && p.partyId !== partyInfo.partyId;
        const isPartyMember = p.partyId === partyInfo.partyId && partyInfo.partyId;
        const isOnSameMap = p.currentMap === player.currentMapId;
        const activityIcon = p.status === 'afk' ? activityIcons.afk : (activityIcons[p.activity] || activityIcons.exploring);
        
        return `
        <div class="online-player-entry${p.status === 'afk' ? ' player-afk' : ''}${inOtherParty ? ' in-other-party' : ''}${isPartyMember ? ' party-member' : ''}${isOnSameMap && isPartyMember ? ' same-map-party' : ''}" onclick="inspectPlayer('${p.playerName}')" style="cursor: pointer;" title="Click to inspect">
            <div class="online-player-info">
                <span class="online-player-name">${getStatusIndicator(p.status)} ${p.playerName}${isPartyMember ? ' <span class="party-indicator">⭐</span>' : ''}${p.status === 'afk' ? ' <span class="afk-tag">(AFK)</span>' : ''}${inOtherParty ? ' <span class="party-tag">(In Party)</span>' : ''}${p.guildName ? ` <span style="color: #9b59b6; font-size: 0.8em;">[${p.guildName}]</span>` : ''}</span>
                <span class="online-player-details">Lv.${p.level} <span style="color: ${classColors[capitalize(p.class)] || '#fff'};">${capitalize(p.class)}</span> <span class="activity-status">${activityIcon}</span></span>
                <span class="online-player-map">📍 ${capitalize(p.mapDisplayName || p.currentMap)}${isOnSameMap ? ' <span class="same-map-tag">HERE</span>' : ''}</span>
            </div>
        </div>
    `}).join('');
    
    list.innerHTML = playersHtml;
}

// ============================================
// PARTY TAB
// ============================================
function updatePartyTab() {
    const content = document.getElementById('party-content');
    if (!content) return;
    
    const players = typeof getOnlinePlayers === 'function' ? getOnlinePlayers() : [];
    const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : { partyId: null, leader: null, members: [] };
    const isInParty = !!partyInfo.partyId;
    const isPartyLeader = partyInfo.leader === player.name;
    
    let html = '';
    
    if (isInParty) {
        const partyMembers = players.filter(p => typeof isInMyParty === 'function' && isInMyParty(p.playerName));
        const partyBonus = typeof getPartyExpBonus === 'function' ? getPartyExpBonus() : 0;
        const membersOnMap = typeof getPartyMembersOnSameMap === 'function' ? getPartyMembersOnSameMap() : [];
        
        html += `<div class="party-section">`;
        html += `<div class="party-info">`;
        html += `<span style="color: #f1c40f;">👑 Leader: ${partyInfo.leader}</span>`;
        if (partyBonus > 0) {
            html += `<span style="color: #2ecc71; margin-left: 10px;">+${Math.round(partyBonus * 100)}% EXP (${membersOnMap.length} on map)</span>`;
        }
        html += `</div>`;
        
        html += `<div class="party-members">`;
        
        // Add self first
        const selfClassColor = classColors[capitalize(player.class)] || '#fff';
        html += `<div class="party-member-entry" style="background: rgba(46, 204, 113, 0.2);">
            <span class="party-member-name">🔵 ${player.name} (You)${isPartyLeader ? ' 👑' : ''}</span>
            <span class="party-member-details">Lv.${player.level} <span style="color: ${selfClassColor};">${capitalize(player.class) || 'Beginner'}</span></span>
        </div>`;
        
        // Add other party members (online)
        partyMembers.forEach(p => {
            const isOnSameMap = p.currentMap === player.currentMapId;
            const memberClassColor = classColors[capitalize(p.class)] || '#fff';
            html += `<div class="party-member-entry${isOnSameMap ? ' same-map' : ''}">
                <div class="party-member-header">
                    <span class="party-member-name">🔵 ${p.playerName}${p.playerName === partyInfo.leader ? ' 👑' : ''}</span>
                    ${isPartyLeader && p.playerName !== partyInfo.leader ? `<button class="party-kick-btn" onclick="event.stopPropagation(); if(typeof kickFromParty==='function')kickFromParty('${p.playerName}')" title="Kick from party">✖</button>` : ''}
                </div>
                <span class="party-member-details">Lv.${p.level} <span style="color: ${memberClassColor};">${capitalize(p.class)}</span></span>
                <span class="party-member-map">${isOnSameMap ? '✓ Same Map' : '📍 ' + capitalize(p.mapDisplayName || p.currentMap)}</span>
            </div>`;
        });
        html += `</div>`;
        
        html += `<button class="leave-party-btn" onclick="if(typeof leaveParty==='function')leaveParty()">Leave Party</button>`;
        html += `</div>`;
    } else {
        html += `<div class="no-guild-message">`;
        html += `<p>You are not in a party</p>`;
        html += `<p style="font-size: 0.85em;">Go to the Online tab to invite players!</p>`;
        html += `<p style="font-size: 0.8em; color: #2ecc71; margin-top: 15px;">🔹 +10% EXP per party member on same map</p>`;
        html += `<p style="font-size: 0.8em; color: #2ecc71;">🔹 Maximum 30% bonus (3 members)</p>`;
        html += `</div>`;
    }
    
    content.innerHTML = html;
}

// ============================================
// BUDDIES TAB
// ============================================

// Format last seen timestamp into a human-readable string
function formatLastSeen(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    // If less than a minute ago
    if (seconds < 60) return 'Just now';
    
    // If less than an hour ago
    if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
    
    // If less than 24 hours ago
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    
    // If less than 7 days ago
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    
    // Otherwise show the date and time
    const date = new Date(timestamp);
    const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    return date.toLocaleDateString('en-US', options);
}

function updateBuddiesTab() {
    const content = document.getElementById('buddies-content');
    if (!content) return;
    
    if (!player.buddies) player.buddies = [];
    
    const onlinePlayers = typeof getOnlinePlayers === 'function' ? getOnlinePlayers() : [];
    const onlineNames = new Set(onlinePlayers.map(p => p.playerName));
    
    let html = '';
    
    if (player.buddies.length === 0) {
        html += `<div class="no-guild-message">`;
        html += `<p>Your buddy list is empty</p>`;
        html += `<p style="font-size: 0.85em;">Add buddies from the Online tab!</p>`;
        html += `</div>`;
    } else {
        // Sort buddies: online first, then alphabetically
        const sortedBuddies = [...player.buddies].sort((a, b) => {
            const aOnline = onlineNames.has(a.name);
            const bOnline = onlineNames.has(b.name);
            if (aOnline !== bOnline) return bOnline - aOnline;
            return a.name.localeCompare(b.name);
        });
        
        // Online buddies
        const onlineBuddies = sortedBuddies.filter(b => onlineNames.has(b.name));
        const offlineBuddies = sortedBuddies.filter(b => !onlineNames.has(b.name));
        
        if (onlineBuddies.length > 0) {
            html += `<h4 style="color: #2ecc71; margin: 0 0 10px 0;">Online (${onlineBuddies.length})</h4>`;
            onlineBuddies.forEach(buddy => {
                const playerData = onlinePlayers.find(p => p.playerName === buddy.name);
                // Update lastSeen for online buddies
                buddy.lastSeen = Date.now();
                html += `<div class="buddy-entry">
                    <div class="buddy-info">
                        <span class="buddy-name">🟢 ${buddy.name}</span>
                        <span class="buddy-status online">Lv.${playerData?.level || '?'} ${capitalize(playerData?.class || 'Unknown')} - ${capitalize(playerData?.mapDisplayName || playerData?.currentMap || 'Unknown')}</span>
                    </div>
                    <div class="buddy-buttons">
                        <button class="trade-btn" onclick="initiateTradeWith('${buddy.name}')">Trade</button>
                        <button class="remove-buddy-btn" onclick="removeBuddy('${buddy.name}')">×</button>
                    </div>
                </div>`;
            });
        }
        
        if (offlineBuddies.length > 0) {
            html += `<h4 style="color: #7f8c8d; margin: 15px 0 10px 0;">Offline (${offlineBuddies.length})</h4>`;
            offlineBuddies.forEach(buddy => {
                const lastSeenText = buddy.lastSeen ? formatLastSeen(buddy.lastSeen) : 'Unknown';
                html += `<div class="buddy-entry offline">
                    <div class="buddy-info">
                        <span class="buddy-name">⚫ ${buddy.name}</span>
                        <span class="buddy-status">Last seen: ${lastSeenText}</span>
                    </div>
                    <div class="buddy-buttons">
                        <button class="remove-buddy-btn" onclick="removeBuddy('${buddy.name}')">×</button>
                    </div>
                </div>`;
            });
        }
    }
    
    content.innerHTML = html;
}

function addBuddy(playerName) {
    if (!player.buddies) player.buddies = [];
    
    if (playerName === player.name) {
        addChatMessage("You can't add yourself as a buddy!", 'error');
        return;
    }
    
    if (player.buddies.some(b => b.name === playerName)) {
        addChatMessage(`${playerName} is already your buddy.`, 'error');
        return;
    }
    
    if (player.buddies.length >= 50) {
        addChatMessage('Buddy list is full (max 50).', 'error');
        return;
    }
    
    // Send buddy request via Firebase instead of directly adding
    if (typeof sendBuddyRequest === 'function') {
        sendBuddyRequest(playerName);
    } else {
        addChatMessage('Unable to send buddy request.', 'error');
    }
}

function removeBuddy(playerName) {
    if (!player.buddies) return;
    
    const index = player.buddies.findIndex(b => b.name === playerName);
    if (index === -1) return;
    
    player.buddies.splice(index, 1);
    addChatMessage(`Removed ${playerName} from your buddy list.`, 'system');
    updateSocialHubUI();
    
    // Save player data
    if (typeof saveCharacter === 'function') {
        saveCharacter();
    }
}

// ============================================
// PLAYER INSPECTION SYSTEM
// ============================================

function inspectPlayer(playerName) {
    const onlinePlayers = typeof getOnlinePlayers === 'function' ? getOnlinePlayers() : [];
    let targetPlayer = onlinePlayers.find(p => p.playerName === playerName);
    
    // Check if this is a remote player on the same map
    if (!targetPlayer && typeof remotePlayers !== 'undefined') {
        const remotePlayer = Object.values(remotePlayers).find(p => p.name === playerName);
        if (remotePlayer) {
            // Convert remote player to inspector format
            // Try to get additional data from online players list
            const onlinePlayerData = onlinePlayers.find(p => p.playerName === remotePlayer.name);
            
            targetPlayer = {
                playerName: remotePlayer.name,
                level: remotePlayer.level || 1,
                class: remotePlayer.class || 'Beginner',
                customization: remotePlayer.customization || {},
                equipped: remotePlayer.cosmeticEquipped || remotePlayer.equipped || {},
                guildName: remotePlayer.guild?.name || null,
                guildRole: remotePlayer.guild?.role || null,
                totalKills: onlinePlayerData?.totalKills || 0,
                achievementCount: onlinePlayerData?.achievementCount || 0,
                combatScore: onlinePlayerData?.combatScore || 0,
                currentMap: player.currentMapId, // Same map as us
                mapDisplayName: maps?.[player.currentMapId]?.displayName || player.currentMapId,
                status: 'online',
                partyId: remotePlayer.partyId || null
            };
        }
    }
    
    // If inspecting self, use local player data with cosmetic overrides
    const isSelf = playerName === player.name;
    if (isSelf) {
        // Build visual equipped from local player data (cosmetic overrides regular)
        const visualEquipped = {};
        const allSlots = ['weapon', 'helmet', 'top', 'bottom', 'gloves', 'shoes', 'cape', 'earring', 'ring', 'pendant', 'shield', 'face', 'eye'];
        allSlots.forEach(slot => {
            const cosmeticItem = player.cosmeticEquipped?.[slot];
            const equippedItem = player.equipped?.[slot];
            const visualItem = cosmeticItem || equippedItem;
            if (visualItem && visualItem.name) {
                visualEquipped[slot] = visualItem.name;
            }
        });
        
        targetPlayer = {
            playerName: player.name,
            level: player.level,
            class: player.class || 'Beginner',
            customization: player.customization || { skinTone: 0, eyeColor: 0, hairStyle: 0, hairColor: 0 },
            equipped: visualEquipped,
            guildName: player.guild?.name || null,
            guildRole: player.guild?.role || null,
            totalKills: player.bestiary?.monsterKills ? Object.values(player.bestiary.monsterKills).reduce((sum, k) => sum + k, 0) : 0,
            achievementCount: Object.keys(player.achievements?.completed || {}).length,
            combatScore: typeof calculateCombatScore === 'function' ? calculateCombatScore() : 0,
            currentMap: player.currentMapId,
            mapDisplayName: maps?.[player.currentMapId]?.displayName || player.currentMapId,
            status: 'online'
        };
    }
    
    if (!targetPlayer) {
        addChatMessage(`Cannot inspect ${playerName} - player not found.`, 'error');
        return;
    }
    
    const inspectWindow = document.getElementById('player-inspect-popup');
    const inspectContent = document.getElementById('player-inspect-content');
    const inspectTitle = document.getElementById('inspect-popup-title');
    
    if (!inspectWindow || !inspectContent) return;
    
    inspectTitle.textContent = `Inspector`;
    
    // Class colors
    const classColor = {
        'Beginner': '#95a5a6', 'Warrior': '#e74c3c', 'Magician': '#3498db', 
        'Bowman': '#27ae60', 'Thief': '#9b59b6', 'Pirate': '#f39c12',
        'Fighter': '#e74c3c', 'Spearman': '#c0392b', 'Cleric': '#5dade2', 
        'Wizard': '#2980b9', 'Hunter': '#27ae60', 'Crossbowman': '#1e8449',
        'Assassin': '#9b59b6', 'Bandit': '#8e44ad', 'Brawler': '#f39c12', 
        'Gunslinger': '#d68910'
    };
    
    const playerClass = capitalize(targetPlayer.class || 'Beginner');
    const classColorValue = classColor[playerClass] || '#fff';
    
    // Check relationship status
    const isBuddy = player.buddies?.some(b => b.name === playerName);
    const partyInfo = typeof getPartyInfo === 'function' ? getPartyInfo() : { partyId: null, leader: null };
    const isInParty = !!partyInfo.partyId;
    const isPartyLeader = partyInfo.leader === player.name;
    const canInviteParty = (!targetPlayer.partyId && isPartyLeader) || (!targetPlayer.partyId && !isInParty);
    const inOtherParty = targetPlayer.partyId && targetPlayer.partyId !== partyInfo.partyId;
    const hasGuild = player.guild?.name;
    const isGuildMaster = hasGuild && player.guild.role === 'master';
    const canInviteGuild = hasGuild && isGuildMaster && !targetPlayer.guildName;
    
    // Can teleport if player is on a different map and map is discovered
    const canTeleport = !isSelf && targetPlayer.currentMap && targetPlayer.currentMap !== player.currentMapId && player.discoveredMaps?.has(targetPlayer.currentMap);
    
    // Get guild role display
    const guildRoleInfo = targetPlayer.guildRole ? (GUILD_ROLES[targetPlayer.guildRole] || GUILD_ROLES.member) : null;
    const guildRoleDisplay = guildRoleInfo ? `${guildRoleInfo.icon} ${guildRoleInfo.name}` : '';
    
    let html = `
        <div class="inspect-header">
            <div class="inspect-status-badge">${targetPlayer.status === 'afk' ? '💤' : '🟢'}</div>
            <div class="inspect-avatar" id="inspect-avatar-canvas">
                <canvas id="inspect-player-canvas" width="120" height="120" style="image-rendering: pixelated;"></canvas>
            </div>
            <div class="inspect-basic-info">
                <div class="inspect-name">
                    ${playerName}
                </div>
                <div class="inspect-class">
                    Level ${targetPlayer.level} 
                    <span style="color: ${classColorValue};">${playerClass}</span>
                </div>
                ${targetPlayer.guildName ? `<div class="inspect-guild">🏰 ${targetPlayer.guildName}${guildRoleDisplay ? ` <span style="font-size: 0.85em; opacity: 0.8;">(${guildRoleDisplay})</span>` : ''}</div>` : ''}
            </div>
        </div>
        
        <div class="inspect-section">
            <h4>Statistics</h4>
            <div class="inspect-stats-grid">
                <div class="inspect-stat">
                    <span class="inspect-stat-label">Total Kills</span>
                    <span class="inspect-stat-value">${(targetPlayer.totalKills || 0).toLocaleString()}</span>
                </div>
                <div class="inspect-stat">
                    <span class="inspect-stat-label">Combat Score</span>
                    <span class="inspect-stat-value">${(targetPlayer.combatScore || 0).toLocaleString()}</span>
                </div>
                <div class="inspect-stat">
                    <span class="inspect-stat-label">Location</span>
                    <span class="inspect-stat-value">${capitalize(targetPlayer.mapDisplayName || targetPlayer.currentMap || 'Unknown')}</span>
                </div>
            </div>
        </div>
        
        <div class="inspect-section inspect-actions">
            <div class="inspect-btn-grid">
                ${!isSelf && !isBuddy ? `<button class="inspect-btn" onclick="addBuddy('${playerName}'); closeInspectWindow();">Add Buddy</button>` : ''}
                ${!isSelf && isBuddy ? `<button class="inspect-btn inspect-btn-danger" onclick="removeBuddy('${playerName}'); closeInspectWindow();">Remove Buddy</button>` : ''}
                ${!isSelf ? `<button class="inspect-btn" onclick="initiateTradeWith('${playerName}'); closeInspectWindow();"${targetPlayer.status === 'afk' ? ' title="Player is AFK"' : ''}>Trade</button>` : ''}
                ${canInviteParty && !inOtherParty ? `<button class="inspect-btn" onclick="if(typeof sendPartyInvite==='function')sendPartyInvite('${playerName}'); closeInspectWindow();">Party Invite</button>` : ''}
                ${canInviteGuild ? `<button class="inspect-btn" onclick="inviteToGuild('${playerName}'); closeInspectWindow();">Guild Invite</button>` : ''}
                ${canTeleport ? `<button class="inspect-btn inspect-btn-teleport" onclick="teleportToPlayer('${playerName}', '${targetPlayer.currentMap}'); closeInspectWindow();">Teleport</button>` : ''}
            </div>
        </div>
    `;
    
    inspectContent.innerHTML = html;
    
    // Show window
    inspectWindow.style.display = 'block';
    
    // Center the window
    inspectWindow.style.left = '50%';
    inspectWindow.style.top = '50%';
    inspectWindow.style.transform = 'translate(-50%, -50%)';
    
    // Render the player avatar on the canvas
    setTimeout(() => {
        renderInspectAvatar(targetPlayer);
    }, 50);
}

// Close the inspect window
function closeInspectWindow() {
    const inspectWindow = document.getElementById('player-inspect-popup');
    if (inspectWindow) {
        inspectWindow.style.display = 'none';
    }
    // Stop animation when window closes
    if (window.inspectAvatarInterval) {
        clearInterval(window.inspectAvatarInterval);
        window.inspectAvatarInterval = null;
    }
}

// Teleport to another player's map
function teleportToPlayer(playerName, mapId) {
    if (!mapId || !maps[mapId]) {
        addChatMessage(`Cannot teleport - invalid map.`, 'error');
        return;
    }
    
    if (!player.discoveredMaps?.has(mapId)) {
        addChatMessage(`You haven't discovered ${maps[mapId]?.displayName || mapId} yet!`, 'error');
        return;
    }
    
    if (mapId === player.currentMapId) {
        addChatMessage(`You're already in this map!`, 'system');
        return;
    }
    
    // Get a spawn point for the map
    const mapData = maps[mapId];
    const spawnX = mapData.playerSpawn?.x || 200;
    const spawnY = mapData.playerSpawn?.y || 300;
    
    addChatMessage(`Teleporting to ${playerName}'s location...`, 'system');
    
    if (typeof fadeAndChangeMap === 'function') {
        fadeAndChangeMap(mapId, spawnX, spawnY);
    }
}

// Expose inspect functions globally for onclick handlers in HTML
window.inspectPlayer = inspectPlayer;
window.closeInspectWindow = closeInspectWindow;
window.teleportToPlayer = teleportToPlayer;

// ============================================
// GIFT SYSTEM - Send items to offline buddies
// ============================================
let selectedGiftItem = null;
let giftRecipient = null;

function openGiftWindow(recipientName) {
    giftRecipient = recipientName;
    selectedGiftItem = null;
    
    const modal = document.createElement('div');
    modal.className = 'guild-modal';
    modal.id = 'gift-modal';
    modal.style.width = '450px';
    modal.innerHTML = `
        <h3>🎁 Send Gift to ${recipientName}</h3>
        <p style="font-size: 0.85em; color: #7f8c8d;">Select an item from your inventory to send as a gift.</p>
        
        <div class="gift-inventory-grid" id="gift-inventory-grid" style="max-height: 200px; overflow-y: auto; margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 5px;">
            ${renderGiftInventory()}
        </div>
        
        <div id="gift-selected-info" style="min-height: 40px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px; margin-bottom: 10px;">
            <em style="color: #7f8c8d;">Select an item to send</em>
        </div>
        
        <div class="gift-gold-section" style="margin-bottom: 10px;">
            <label style="display: flex; align-items: center; gap: 10px;">
                <span>Include Gold:</span>
                <input type="number" id="gift-gold-amount" min="0" max="${player.gold}" value="0" 
                    style="width: 100px; padding: 5px; font-family: 'Ari9500', cursive; font-size: var(--font-small); border-radius: 3px; border: 1px solid #f1c40f; background: rgba(0,0,0,0.5); color: #f1c40f;">
                <span style="color: #7f8c8d; font-size: 0.85em;">(You have: ${player.gold.toLocaleString()})</span>
            </label>
        </div>
        
        <div class="guild-modal-buttons">
            <button class="guild-modal-btn confirm" onclick="sendGift()">Send Gift</button>
            <button class="guild-modal-btn cancel" onclick="closeGiftWindow()">Cancel</button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function renderGiftInventory() {
    let html = '<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px;">';
    
    // Combine all tradeable items
    const allItems = [
        ...player.inventory.equip.map((item, i) => ({ ...item, category: 'equip', index: i })),
        ...player.inventory.use.map((item, i) => ({ ...item, category: 'use', index: i })),
        ...player.inventory.etc.map((item, i) => ({ ...item, category: 'etc', index: i }))
    ].filter(item => item && item.name);
    
    if (allItems.length === 0) {
        return '<p style="color: #7f8c8d; text-align: center;">No items to send</p>';
    }
    
    allItems.forEach((item, i) => {
        const itemInfo = itemData[item.name] || {};
        const rarityColor = getRarityColor(item.rarity || 'common');
        const quantity = item.quantity || 1;
        
        html += `
            <div class="gift-item-slot" onclick="selectGiftItem(${i}, '${item.category}', ${item.index})" 
                style="width: 40px; height: 40px; background: rgba(0,0,0,0.4); border: 2px solid ${rarityColor}; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative;"
                data-index="${i}" title="${item.name}${item.enhancement ? ` +${item.enhancement}` : ''}${quantity > 1 ? ` (x${quantity})` : ''}">
                <span style="font-size: 16px;">${itemInfo.icon || '📦'}</span>
                ${quantity > 1 ? `<span style="position: absolute; bottom: 0; right: 2px; font-size: 9px; color: #fff;">${quantity}</span>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function selectGiftItem(displayIndex, category, inventoryIndex) {
    // Remove previous selection
    document.querySelectorAll('.gift-item-slot').forEach(slot => {
        slot.style.boxShadow = 'none';
    });
    
    // Highlight selected
    const slots = document.querySelectorAll('.gift-item-slot');
    if (slots[displayIndex]) {
        slots[displayIndex].style.boxShadow = '0 0 10px #27ae60';
    }
    
    // Get item info
    const item = player.inventory[category][inventoryIndex];
    if (!item) return;
    
    selectedGiftItem = { category, index: inventoryIndex, item };
    
    const itemInfo = itemData[item.name] || {};
    const infoDiv = document.getElementById('gift-selected-info');
    if (infoDiv) {
        infoDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">${itemInfo.icon || '📦'}</span>
                <div>
                    <div style="color: ${getRarityColor(item.rarity || 'common')}; font-weight: bold;">
                        ${item.name}${item.enhancement ? ` +${item.enhancement}` : ''}
                    </div>
                    <div style="font-size: 0.8em; color: #7f8c8d;">
                        ${item.quantity > 1 ? `Quantity: ${item.quantity}` : itemInfo.type || 'Item'}
                    </div>
                </div>
            </div>
        `;
    }
}

async function sendGift() {
    if (!giftRecipient) {
        addChatMessage('No recipient selected.', 'error');
        return;
    }
    
    const goldAmount = parseInt(document.getElementById('gift-gold-amount')?.value || 0);
    
    if (!selectedGiftItem && goldAmount <= 0) {
        addChatMessage('Please select an item or enter a gold amount to send.', 'error');
        return;
    }
    
    if (goldAmount > player.gold) {
        addChatMessage('You don\'t have enough gold!', 'error');
        return;
    }
    
    // Send gift via Firebase
    if (typeof sendGiftToPlayer === 'function') {
        const success = await sendGiftToPlayer(giftRecipient, selectedGiftItem, goldAmount);
        if (success) {
            // Remove item from inventory
            if (selectedGiftItem) {
                const { category, index, item } = selectedGiftItem;
                if (item.quantity && item.quantity > 1) {
                    player.inventory[category][index].quantity--;
                    if (player.inventory[category][index].quantity <= 0) {
                        player.inventory[category].splice(index, 1);
                    }
                } else {
                    player.inventory[category].splice(index, 1);
                }
            }
            
            // Deduct gold
            if (goldAmount > 0) {
                player.gold -= goldAmount;
            }
            
            saveCharacter();
            updateInventoryUI();
            updateUI();
            
            addChatMessage(`Gift sent to ${giftRecipient}!`, 'success');
            closeGiftWindow();
        }
    } else {
        addChatMessage('Gift system not available.', 'error');
    }
}

function closeGiftWindow() {
    const modal = document.getElementById('gift-modal');
    if (modal) modal.remove();
    selectedGiftItem = null;
    giftRecipient = null;
}

window.openGiftWindow = openGiftWindow;
window.selectGiftItem = selectGiftItem;
window.sendGift = sendGift;
window.closeGiftWindow = closeGiftWindow;

// ============================================
// MAILBOX SYSTEM
// ============================================
function openMailbox() {
    const pendingGifts = player.pendingGifts || [];
    
    const modal = document.createElement('div');
    modal.className = 'guild-modal';
    modal.id = 'mailbox-modal';
    modal.style.minWidth = '400px';
    
    let html = '<h3>📬 Mailbox</h3>';
    
    if (pendingGifts.length === 0) {
        html += '<p style="text-align: center; color: #7f8c8d; padding: 30px;">Your mailbox is empty.</p>';
    } else {
        html += '<div class="mailbox-gifts-list">';
        pendingGifts.forEach((gift, index) => {
            const itemData = typeof itemDatabase !== 'undefined' ? itemDatabase[gift.itemId] : null;
            const itemName = itemData ? itemData.name : gift.itemId;
            const itemIcon = itemData ? (itemData.icon || '🎁') : '🎁';
            html += `<div class="mailbox-gift-entry">
                <div class="mailbox-gift-icon">${itemIcon}</div>
                <div class="mailbox-gift-info">
                    <div class="mailbox-gift-from">From: <strong>${gift.from}</strong></div>
                    <div class="mailbox-gift-item">${itemName}${gift.quantity > 1 ? ' x' + gift.quantity : ''}</div>
                    ${gift.gold ? `<div class="mailbox-gift-gold">+ ${formatGold(gift.gold)} gold</div>` : ''}
                    ${gift.message ? `<div class="mailbox-gift-message">"${gift.message}"</div>` : ''}
                </div>
                <button class="mailbox-claim-btn" onclick="claimGift(${index})">Claim</button>
            </div>`;
        });
        html += '</div>';
        html += `<button class="guild-action-btn" onclick="claimAllGifts()" style="margin-top: 10px;">Claim All</button>`;
    }
    
    html += `<div class="guild-modal-buttons">
        <button class="guild-modal-btn cancel" onclick="closeMailbox()">Close</button>
    </div>`;
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
}

function closeMailbox() {
    const modal = document.getElementById('mailbox-modal');
    if (modal) modal.remove();
}

function claimGift(index) {
    const pendingGifts = player.pendingGifts || [];
    const gift = pendingGifts[index];
    if (!gift) return;
    
    // Check inventory space
    const emptySlot = player.inventory.findIndex(slot => !slot);
    if (emptySlot === -1 && gift.itemId) {
        showNotification('Your inventory is full!', 'error');
        return;
    }
    
    // Add item to inventory
    if (gift.itemId) {
        const itemTemplate = typeof itemData !== 'undefined' ? itemData[gift.itemId] : null;
        if (itemTemplate) {
            const newItem = {
                name: gift.itemId,
                ...itemTemplate,
                quantity: gift.quantity || 1
            };
            addItemToInventory(newItem, newItem.rarity || 'common');
        }
    }
    
    // Add gold
    if (gift.gold && typeof addGold === 'function') {
        addGold(gift.gold);
    }
    
    // Remove from pending
    player.pendingGifts.splice(index, 1);
    
    showNotification(`Claimed gift from ${gift.from}!`, 'success');
    
    // Refresh mailbox
    closeMailbox();
    openMailbox();
    
    // Sync to Firebase
    if (typeof savePlayerData === 'function') {
        savePlayerData();
    }
}

function claimAllGifts() {
    const pendingGifts = player.pendingGifts || [];
    if (pendingGifts.length === 0) return;
    
    let claimed = 0;
    let totalGold = 0;
    
    // Process each gift
    for (let i = pendingGifts.length - 1; i >= 0; i--) {
        const gift = pendingGifts[i];
        const emptySlot = player.inventory.findIndex(slot => !slot);
        
        if (emptySlot === -1 && gift.itemId) {
            continue; // Skip if no space
        }
        
        // Add item
        if (gift.itemId) {
            const itemTemplate = typeof itemData !== 'undefined' ? itemData[gift.itemId] : null;
            if (itemTemplate) {
                const newItem = {
                    name: gift.itemId,
                    ...itemTemplate,
                    quantity: gift.quantity || 1
                };
                addItemToInventory(newItem, newItem.rarity || 'common');
            }
        }
        
        // Add gold
        if (gift.gold) {
            totalGold += gift.gold;
        }
        
        pendingGifts.splice(i, 1);
        claimed++;
    }
    
    if (totalGold > 0 && typeof addGold === 'function') {
        addGold(totalGold);
    }
    
    showNotification(`Claimed ${claimed} gift(s)!${totalGold > 0 ? ` +${formatGold(totalGold)} gold` : ''}`, 'success');
    
    closeMailbox();
    openMailbox();
    
    if (typeof savePlayerData === 'function') {
        savePlayerData();
    }
}

function openSendGiftWindow() {
    // Show buddy selection first
    if (!player.buddies || player.buddies.length === 0) {
        showNotification('You have no buddies to send gifts to!', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'guild-modal';
    modal.id = 'send-gift-select-modal';
    modal.style.minWidth = '350px';
    
    let html = '<h3>🎁 Send Gift</h3>';
    html += '<p style="margin-bottom: 10px;">Select a buddy:</p>';
    html += '<div class="gift-buddy-list">';
    
    player.buddies.forEach(buddy => {
        html += `<div class="gift-buddy-entry" onclick="selectGiftRecipient('${buddy.name}')">
            <span class="gift-buddy-name">${buddy.name}</span>
        </div>`;
    });
    
    html += '</div>';
    html += `<div class="guild-modal-buttons">
        <button class="guild-modal-btn cancel" onclick="closeSendGiftSelect()">Cancel</button>
    </div>`;
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
}

function closeSendGiftSelect() {
    const modal = document.getElementById('send-gift-select-modal');
    if (modal) modal.remove();
}

function selectGiftRecipient(buddyName) {
    closeSendGiftSelect();
    openGiftWindow(buddyName);
}

window.openMailbox = openMailbox;
window.closeMailbox = closeMailbox;
window.claimGift = claimGift;
window.claimAllGifts = claimAllGifts;
window.openSendGiftWindow = openSendGiftWindow;
window.closeSendGiftSelect = closeSendGiftSelect;
window.selectGiftRecipient = selectGiftRecipient;

// Render player avatar on inspect canvas with animation
function renderInspectAvatar(targetPlayer) {
    const canvas = document.getElementById('inspect-player-canvas');
    if (!canvas) return;
    
    // Clear any existing animation interval
    if (window.inspectAvatarInterval) {
        clearInterval(window.inspectAvatarInterval);
        window.inspectAvatarInterval = null;
    }
    
    // Check if all required sprite data is available
    if (typeof spriteData === 'undefined' || typeof playerSheetImage === 'undefined' || !playerSheetImage.complete) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 60, 60);
        return;
    }
    
    const SCALE = 3;
    const pData = spriteData.player;
    const customization = targetPlayer.customization || { skinTone: 0, eyeColor: 0, hairStyle: 0, hairColor: 0 };
    const equipped = targetPlayer.equipped || {};
    const idleAnim = pData.animations.idle;
    
    let animFrame = 0;
    
    function drawFrame() {
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const frame = idleAnim[animFrame % idleAnim.length];
        
        const spriteWidth = pData.frameWidth * SCALE;
        const spriteHeight = pData.frameHeight * SCALE;
        const offsetX = (canvas.width - spriteWidth) / 2;
        const offsetY = (canvas.height - spriteHeight) / 2;
        
        // Create hair tint canvas
        const hairTintCanvas = document.createElement('canvas');
        hairTintCanvas.width = spriteWidth;
        hairTintCanvas.height = spriteHeight;
        const hairTintCtx = hairTintCanvas.getContext('2d', { willReadFrequently: true });
        hairTintCtx.imageSmoothingEnabled = false;
        
        // Build draw queue
        const drawQueue = [];
        
        // Body layers
        const skinY = pData.frameHeight * ((customization.skinTone || 0) + 1);
        drawQueue.push({ type: 'body', zLevel: 1, source: playerSheetImage, sx: frame.x, sy: skinY, sWidth: pData.frameWidth, sHeight: pData.frameHeight });
        drawQueue.push({ type: 'body', zLevel: 5, source: playerSheetImage, sx: frame.x, sy: 0, sWidth: pData.frameWidth, sHeight: pData.frameHeight });
        
        // Eyes
        if (frame.attachments?.eyes && typeof playerEyesSheet !== 'undefined' && playerEyesSheet.complete) {
            const faceItem = equipped.face;
            const shouldHideEyes = faceItem && typeof itemData !== 'undefined' && itemData[faceItem]?.hideEyes;
            
            if (!shouldHideEyes) {
                const eyeData = spriteData.playerEyes;
                const eyeSourceX = 0;
                const eyeSourceY = eyeData.frameHeight * (customization.eyeColor || 0);
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
        }
        
        // Equipment
        if (typeof spriteData.playerEquipment !== 'undefined' && typeof playerEquipmentSheet !== 'undefined' && playerEquipmentSheet.complete) {
            const equipmentSheetData = spriteData.playerEquipment;
            const allSlots = ['cape', 'bottom', 'shoes', 'top', 'pendant', 'earring', 'gloves', 'helmet', 'weapon', 'face', 'eye'];
            allSlots.forEach(slot => {
                const itemName = equipped[slot];
                if (itemName && equipmentSheetData.coords && equipmentSheetData.coords[itemName]) {
                    const itemInfo = typeof itemData !== 'undefined' ? itemData[itemName] : null;
                    if (!itemInfo) return;
                    const itemCoords = equipmentSheetData.coords[itemName];
                    const sourceX = itemCoords.x + frame.x;
                    const sourceY = itemCoords.y;
                    const zLevel = itemInfo.zLevel || 5;
                    drawQueue.push({ type: 'equip', zLevel: zLevel, source: playerEquipmentSheet, sx: sourceX, sy: sourceY, sWidth: pData.frameWidth, sHeight: pData.frameHeight });
                }
            });
        }
        
        // Hair
        if (typeof playerHairSheet !== 'undefined' && playerHairSheet.complete && typeof spriteData.playerHair !== 'undefined') {
            const helmet = equipped.helmet;
            const helmetHidesHair = helmet && typeof itemData !== 'undefined' && itemData[helmet]?.hidesHair;
            const hairStyleIndex = customization.hairStyle || 0;
            const hairInfo = spriteData.playerHair[hairStyleIndex];
            const hairWorksWithHats = hairInfo?.worksWithHats;
            
            if (hairInfo && hairInfo.name !== 'Bald' && (!helmetHidesHair || hairWorksWithHats)) {
                const hairColor = typeof customizationOptions !== 'undefined' ? 
                    customizationOptions.hairColors[customization.hairColor || 0] : '#8B4513';
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
            let destWidth = spriteWidth;
            let destHeight = spriteHeight;
            let destX = offsetX;
            let destY = offsetY;
            
            if (item.type === 'eyes') {
                destWidth = item.sWidth * SCALE;
                destHeight = item.sHeight * SCALE;
                destX = offsetX + item.attachment.x * SCALE;
                destY = offsetY + item.attachment.y * SCALE;
                ctx.drawImage(item.source, item.sx, item.sy, item.sWidth, item.sHeight, destX, destY, destWidth, destHeight);
            } else if (item.type === 'hair' && item.hairColor) {
                hairTintCtx.clearRect(0, 0, spriteWidth, spriteHeight);
                hairTintCtx.drawImage(item.source, item.sx, item.sy, item.sWidth, item.sHeight, 0, 0, spriteWidth, spriteHeight);
                
                const imageData = hairTintCtx.getImageData(0, 0, spriteWidth, spriteHeight);
                const data = imageData.data;
                const tintColor = typeof hexToRgb === 'function' ? hexToRgb(item.hairColor) : null;
                
                const outlineR = 34, outlineG = 32, outlineB = 52;
                
                if (tintColor) {
                    for (let i = 0; i < data.length; i += 4) {
                        const isOutline = data[i] === outlineR && data[i + 1] === outlineG && data[i + 2] === outlineB;
                        if (data[i + 3] > 0 && !isOutline) {
                            data[i] = (data[i] / 255) * tintColor.r;
                            data[i + 1] = (data[i + 1] / 255) * tintColor.g;
                            data[i + 2] = (data[i + 2] / 255) * tintColor.b;
                        }
                    }
                }
                hairTintCtx.putImageData(imageData, 0, 0);
                ctx.drawImage(hairTintCanvas, destX, destY);
            } else {
                ctx.drawImage(item.source, item.sx, item.sy, item.sWidth, item.sHeight, destX, destY, destWidth, destHeight);
            }
        });
    }
    
    // Draw first frame immediately
    drawFrame();
    
    // Start animation loop (every 200ms = 5fps, matching game idle animation)
    window.inspectAvatarInterval = setInterval(() => {
        animFrame++;
        drawFrame();
    }, 200);
}

// ============================================
// GUILD TAB
// ============================================
const GUILD_ICONS = [
    { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 },
    { id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }, { id: 10 }
];

// Helper function to render a guild icon sprite as HTML
function renderGuildIcon(iconId, scale = 1) {
    // Safety check for spriteData and artAssets availability
    const dataReady = typeof spriteData !== 'undefined' && 
                      spriteData.guildIcons && 
                      spriteData.guildIcons.icons &&
                      typeof artAssets !== 'undefined' && 
                      artAssets.guildIcons;
    
    if (!dataReady) {
        console.warn('Guild icon data not ready yet:', {
            spriteDataDefined: typeof spriteData !== 'undefined',
            guildIconsInSprite: typeof spriteData !== 'undefined' && !!spriteData.guildIcons,
            artAssetsDefined: typeof artAssets !== 'undefined',
            guildIconsInArt: typeof artAssets !== 'undefined' && !!artAssets.guildIcons
        });
        return `<span style="font-size: ${16 * scale}px;">🏰</span>`; // Fallback emoji
    }
    
    const iconData = spriteData.guildIcons;
    const iconPos = iconData.icons[iconId] || iconData.icons[1];
    if (!iconPos) {
        return `<span style="font-size: ${16 * scale}px;">🏰</span>`; // Fallback emoji
    }
    const width = iconData.frameWidth * scale;
    const height = iconData.frameHeight * scale;
    const bgX = iconPos.x * scale;
    const bgY = iconPos.y * scale;
    const bgWidth = iconData.sheetWidth * scale;
    const bgHeight = iconData.sheetHeight * scale;
    return `<div class="guild-icon-sprite" style="width: ${width}px; height: ${height}px; background-image: url(${artAssets.guildIcons}); background-position: -${bgX}px -${bgY}px; background-size: ${bgWidth}px ${bgHeight}px; image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges; -ms-interpolation-mode: nearest-neighbor; display: inline-block; vertical-align: middle;"></div>`;
}

function updateGuildTab() {
    const content = document.getElementById('guild-content');
    if (!content) return;
    
    // Sync guild challenge data from Firebase when tab is opened
    if (player.guild && typeof syncGuildChallengeData === 'function') {
        syncGuildChallengeData();
    }
    
    let html = '';
    
    if (player.guild && player.guild.name) {
        // Player is in a guild
        const guildIconId = player.guild.icon || 1;
        const isGuildMaster = player.guild.role === 'master';
        
        // Get player's role and permissions
        const playerRole = player.guild.role || 'member';
        const playerRoleData = typeof GUILD_ROLES !== 'undefined' ? GUILD_ROLES[playerRole] : null;
        const playerRoleIcon = playerRoleData ? playerRoleData.icon : '👤';
        const playerRoleName = playerRoleData ? playerRoleData.name : 'Member';
        const canManageRoles = playerRoleData && playerRoleData.permissions.includes('manage_roles');
        const canKick = playerRoleData && playerRoleData.permissions.includes('kick');
        const canInvite = playerRoleData && playerRoleData.permissions.includes('invite');
        
        html += `<div class="guild-header">
            <div class="guild-icon-display">
                ${renderGuildIcon(guildIconId, 2)}
            </div>
            <div class="guild-info-header">
                <h3>${player.guild.name}</h3>
                <p>Your Role: ${playerRoleIcon} ${playerRoleName}</p>
            </div>
        </div>`;
        
        // Guild members section
        html += `<div class="guild-members-section">`;
        html += `<h4>Guild Members Online</h4>`;
        
        const onlinePlayers = typeof getOnlinePlayers === 'function' ? getOnlinePlayers() : [];
        const guildMembers = onlinePlayers.filter(p => p.guildName === player.guild.name);
        
        // Helper function to render role badge
        const renderRoleBadge = (role) => {
            const roleData = typeof GUILD_ROLES !== 'undefined' ? GUILD_ROLES[role] : null;
            if (!roleData) return '';
            return `<span class="guild-role-badge" title="${roleData.name}">${roleData.icon}</span>`;
        };
        
        // Helper function to render role management buttons
        const renderRoleButtons = (memberName, memberRole, memberPriority) => {
            if (!canManageRoles) return '';
            // Can only manage roles lower priority than yourself
            if (memberPriority <= (playerRoleData ? playerRoleData.priority : 0)) return '';
            
            let buttons = '<div class="guild-role-buttons">';
            // Promote button (if not already at officer level or if player is master)
            if (memberRole !== 'officer' && (isGuildMaster || memberRole === 'recruit' || memberRole === 'member')) {
                const nextRole = memberRole === 'recruit' ? 'member' : memberRole === 'member' ? 'veteran' : memberRole === 'veteran' ? 'officer' : null;
                if (nextRole) {
                    buttons += `<button class="guild-role-btn promote" onclick="promoteGuildMember('${memberName}', '${nextRole}')" title="Promote to ${nextRole}">▲</button>`;
                }
            }
            // Demote button (if not already recruit)
            if (memberRole !== 'recruit' && memberRole !== 'master') {
                const prevRole = memberRole === 'officer' ? 'veteran' : memberRole === 'veteran' ? 'member' : memberRole === 'member' ? 'recruit' : null;
                if (prevRole) {
                    buttons += `<button class="guild-role-btn demote" onclick="demoteGuildMember('${memberName}', '${prevRole}')" title="Demote to ${prevRole}">▼</button>`;
                }
            }
            buttons += '</div>';
            return buttons;
        };
        
        // Always show self
        html += `<div class="guild-member-entry${isGuildMaster ? ' leader' : ' online'}">
            <div style="display: flex; align-items: center; gap: 6px;">
                ${renderRoleBadge(playerRole)}
                <span class="guild-member-name">${player.name} (You)</span>
            </div>
            <span class="guild-member-status" style="color: #2ecc71;">Lv.${player.level} ${capitalize(player.class)}</span>
        </div>`;
        
        if (guildMembers.length > 0) {
            // Sort members by role priority (lower = higher rank)
            guildMembers.sort((a, b) => {
                const roleA = typeof GUILD_ROLES !== 'undefined' && GUILD_ROLES[a.guildRole] ? GUILD_ROLES[a.guildRole].priority : 5;
                const roleB = typeof GUILD_ROLES !== 'undefined' && GUILD_ROLES[b.guildRole] ? GUILD_ROLES[b.guildRole].priority : 5;
                return roleA - roleB;
            });
            
            guildMembers.forEach(m => {
                const memberRole = m.guildRole || 'member';
                const memberRoleData = typeof GUILD_ROLES !== 'undefined' ? GUILD_ROLES[memberRole] : null;
                const memberPriority = memberRoleData ? memberRoleData.priority : 5;
                
                html += `<div class="guild-member-entry online">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        ${renderRoleBadge(memberRole)}
                        <span class="guild-member-name">${m.playerName}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="guild-member-status" style="color: #2ecc71;">Lv.${m.level} ${capitalize(m.class)}</span>
                        ${renderRoleButtons(m.playerName, memberRole, memberPriority)}
                        ${canKick && memberPriority > (playerRoleData ? playerRoleData.priority : 0) ? `<button class="guild-kick-btn" onclick="kickFromGuild('${m.playerName}')" title="Kick from guild">✕</button>` : ''}
                    </div>
                </div>`;
            });
        }
        html += `</div>`;
        
        // Guild challenges
        html += `<div class="guild-challenges">`;
        html += `<h4>🏆 Guild Challenges</h4>`;
        
        // Weekly challenge (example)
        const weeklyKills = player.guild.weeklyKills || 0;
        const weeklyGoal = 1000;
        const weeklyProgress = Math.min(100, (weeklyKills / weeklyGoal) * 100);
        
        html += `<div class="guild-challenge-entry">
            <div class="guild-challenge-name">Weekly Monster Hunt</div>
            <div style="font-size: 0.85em; color: #bdc3c7; margin-bottom: 5px;">Guild kills: ${weeklyKills} / ${weeklyGoal}</div>
            <div class="guild-challenge-progress">
                <div class="guild-challenge-progress-bar" style="width: ${weeklyProgress}%;"></div>
            </div>
            <div class="guild-challenge-reward">Reward: 10,000 Gold per member</div>
        </div>`;
        
        // Daily challenge
        const dailyBosses = player.guild.dailyBossKills || 0;
        const dailyGoal = 10;
        const dailyProgress = Math.min(100, (dailyBosses / dailyGoal) * 100);
        
        html += `<div class="guild-challenge-entry">
            <div class="guild-challenge-name">Daily Boss Slayer</div>
            <div style="font-size: 0.85em; color: #bdc3c7; margin-bottom: 5px;">Bosses killed: ${dailyBosses} / ${dailyGoal}</div>
            <div class="guild-challenge-progress">
                <div class="guild-challenge-progress-bar" style="width: ${dailyProgress}%;"></div>
            </div>
            <div class="guild-challenge-reward">Reward: Enhancement Scroll</div>
        </div>`;
        
        html += `</div>`;
        
        // Guild Buffs section
        const canManageGuild = playerRoleData && playerRoleData.permissions.includes('manage_guild');
        html += `<div class="guild-buffs-section">`;
        html += `<h4>✨ Guild Buffs</h4>`;
        
        // Get guild's unlocked buffs
        const unlockedBuffs = player.guild.buffs || [];
        
        // Show currently active buffs
        const activeBuffs = Object.entries(typeof GUILD_BUFFS !== 'undefined' ? GUILD_BUFFS : {})
            .filter(([buffId]) => unlockedBuffs.includes(buffId));
        
        if (activeBuffs.length > 0) {
            html += `<div class="guild-active-buffs">`;
            activeBuffs.forEach(([buffId, buff]) => {
                html += `<div class="guild-buff-active" title="${buff.description}">
                    <span class="guild-buff-icon">${buff.icon}</span>
                    <span class="guild-buff-name">${buff.name}</span>
                </div>`;
            });
            html += `</div>`;
        } else {
            html += `<p style="font-size: 0.85em; color: #7f8c8d; text-align: center;">No buffs unlocked yet</p>`;
        }
        
        // Show unlock button for master only (they pay with personal gold)
        if (canManageGuild) {
            html += `<button class="guild-action-btn guild-buffs-btn" onclick="openGuildBuffsWindow()">Manage Buffs</button>`;
        }
        
        html += `</div>`;
        
        html += `<button class="guild-action-btn leave-guild-btn" onclick="leaveGuild()">Leave Guild</button>`;
    } else {
        // Player not in a guild
        html += `<div class="no-guild-message">`;
        html += `<p style="font-size: 1.1em;">You are not in a guild</p>`;
        html += `<p style="margin: 15px 0;">Create your own guild or get invited by a Guild Master!</p>`;
        html += `<p style="font-size: 0.85em; color: #9b59b6;">Guilds unlock weekly challenges and rewards</p>`;
        html += `<p style="font-size: 0.85em; color: #9b59b6;">Collaborate with guild members</p>`;
        html += `</div>`;
        html += `<button class="guild-action-btn create-guild-btn" onclick="openGuildCreation()">Create Guild (100,000 Gold)</button>`;
    }
    
    content.innerHTML = html;
}

function openGuildCreation() {
    // Check for validation issues
    if (typeof hasValidationIssues === 'function' && hasValidationIssues()) {
        if (typeof showValidationBlockedMessage === 'function') {
            showValidationBlockedMessage('create a guild');
        } else {
            showNotification('⚠️ You cannot create a guild due to account validation issues.', 'error');
        }
        return;
    }
    
    const GUILD_CREATION_COST = 100000;
    
    if (player.guild && player.guild.name) {
        showNotification('You are already in a guild.', 'error');
        return;
    }
    
    if (player.gold < GUILD_CREATION_COST) {
        showNotification(`You need ${GUILD_CREATION_COST.toLocaleString()} gold to create a guild.`, 'error');
        return;
    }
    
    // Create modal for guild creation
    const modal = document.createElement('div');
    modal.className = 'guild-modal';
    modal.id = 'guild-creation-modal';
    modal.innerHTML = `
        <h3>Create Guild</h3>
        <p>Choose a name and icon for your guild:</p>
        <input type="text" id="guild-name-input" placeholder="Guild name (3-16 chars)" maxlength="16" 
            style="width: 90%; margin: 10px 0; padding: 8px; font-family: 'Ari9500', cursive; font-size: var(--font-small); border-radius: 5px; border: 1px solid #9b59b6; background: rgba(0,0,0,0.5); color: white;">
        <div class="guild-icon-selector">
            ${GUILD_ICONS.map(icon => `
                <div class="guild-icon-option" data-icon="${icon.id}" onclick="selectGuildIcon(${icon.id})">
                    ${renderGuildIcon(icon.id, 2)}
                </div>
            `).join('')}
        </div>
        <p style="font-size: 0.85em; color: #f1c40f;">Cost: ${formatGold(GUILD_CREATION_COST)}</p>
        <div class="guild-modal-buttons">
            <button class="guild-modal-btn confirm" onclick="confirmGuildCreation()">Create</button>
            <button class="guild-modal-btn cancel" onclick="closeGuildCreation()">Cancel</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Select first icon by default
    selectGuildIcon(GUILD_ICONS[0].id);
}

let selectedGuildIcon = GUILD_ICONS[0].id;

function selectGuildIcon(iconId) {
    selectedGuildIcon = iconId;
    
    const options = document.querySelectorAll('.guild-icon-option');
    options.forEach(opt => {
        opt.classList.toggle('selected', parseInt(opt.dataset.icon) === iconId);
    });
}

function confirmGuildCreation() {
    const GUILD_CREATION_COST = 100000;
    const input = document.getElementById('guild-name-input');
    const guildName = input.value.trim();
    
    if (guildName.length < 3) {
        addChatMessage('Guild name must be at least 3 characters.', 'error');
        return;
    }
    
    if (guildName.length > 16) {
        addChatMessage('Guild name cannot exceed 16 characters.', 'error');
        return;
    }
    
    // Deduct gold and create guild
    player.gold -= GUILD_CREATION_COST;
    player.guild = {
        name: guildName,
        icon: selectedGuildIcon,
        role: 'master',
        joinedAt: Date.now(),
        weeklyKills: 0,
        dailyBossKills: 0
    };
    
    updateUI();
    closeGuildCreation();
    updateSocialHubUI();
    updateGuildNameplate();
    
    addChatMessage(`Congratulations! You founded the guild "${guildName}"!`, 'system');
    
    // Update presence with guild info
    if (typeof updatePresence === 'function') {
        updatePresence();
    }
    
    // Create guild in Firebase rankings
    if (typeof updateGuildRanking === 'function') {
        updateGuildRanking();
    }
    
    // Save player data
    if (typeof saveCharacter === 'function') {
        saveCharacter();
    }
}

function closeGuildCreation() {
    const modal = document.getElementById('guild-creation-modal');
    if (modal) {
        modal.remove();
    }
}

function leaveGuild() {
    if (!player.guild || !player.guild.name) {
        addChatMessage('You are not in a guild.', 'error');
        return;
    }
    
    const guildName = player.guild.name;
    const wasGuildMaster = player.guild.role === 'master';
    
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.className = 'guild-modal';
    modal.id = 'leave-guild-modal';
    modal.innerHTML = `
        <h3 style="color: #e74c3c;">Leave Guild?</h3>
        <p>Are you sure you want to leave <strong>${guildName}</strong>?</p>
        ${wasGuildMaster ? '<p style="color: #f1c40f; font-size: 0.9em;">⚠️ As Guild Master, leaving will disband the guild!</p>' : ''}
        <div class="guild-modal-buttons">
            <button class="guild-modal-btn danger" onclick="confirmLeaveGuild()">Leave</button>
            <button class="guild-modal-btn cancel" onclick="closeLeaveGuildModal()">Stay</button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function confirmLeaveGuild() {
    const guildName = player.guild.name;
    const wasGuildMaster = player.guild.role === 'master';
    
    // If guild master is leaving, send disband notification to all members
    if (wasGuildMaster && typeof sendGuildDisbandNotification === 'function') {
        await sendGuildDisbandNotification(guildName);
    }
    
    // Remove from guild rankings in Firebase
    if (typeof removePlayerFromGuildRanking === 'function') {
        removePlayerFromGuildRanking(guildName, player.name);
    }
    
    // Disconnect from guild chat
    if (typeof disconnectGuildChat === 'function') {
        disconnectGuildChat();
    }
    
    player.guild = null;
    
    closeLeaveGuildModal();
    updateSocialHubUI();
    updateGuildNameplate();
    
    if (wasGuildMaster) {
        addChatMessage(`You have disbanded ${guildName}.`, 'system');
    } else {
        addChatMessage(`You have left ${guildName}.`, 'system');
    }
    
    // Update presence to remove guild info
    if (typeof updatePresence === 'function') {
        updatePresence();
    }
    
    // Save player data
    if (typeof saveCharacter === 'function') {
        saveCharacter();
    }
}

function closeLeaveGuildModal() {
    const modal = document.getElementById('leave-guild-modal');
    if (modal) {
        modal.remove();
    }
}

// Kick a player from the guild (guild master only)
async function kickFromGuild(targetPlayerName) {
    if (!player.guild || !player.guild.name) {
        addChatMessage('You are not in a guild.', 'error');
        return;
    }
    
    // Check if player has kick permission
    const playerRole = player.guild.role || 'member';
    const playerRoleData = typeof GUILD_ROLES !== 'undefined' ? GUILD_ROLES[playerRole] : null;
    const canKick = playerRoleData && playerRoleData.permissions.includes('kick');
    
    if (!canKick) {
        addChatMessage('You do not have permission to kick members.', 'error');
        return;
    }
    
    if (targetPlayerName === player.name) {
        addChatMessage('You cannot kick yourself. Use Leave Guild instead.', 'error');
        return;
    }
    
    // Send kick notification via Firebase
    if (typeof sendGuildKickNotification === 'function') {
        await sendGuildKickNotification(player.guild.name, targetPlayerName);
        addChatMessage(`You kicked ${targetPlayerName} from the guild.`, 'system');
    } else {
        addChatMessage('Unable to kick player - network error.', 'error');
    }
}

// Promote a guild member to a higher role
async function promoteGuildMember(targetPlayerName, newRole) {
    if (!player.guild || !player.guild.name) {
        addChatMessage('You are not in a guild.', 'error');
        return;
    }
    
    // Check if player has manage_roles permission
    const playerRole = player.guild.role || 'member';
    const playerRoleData = typeof GUILD_ROLES !== 'undefined' ? GUILD_ROLES[playerRole] : null;
    const canManageRoles = playerRoleData && playerRoleData.permissions.includes('manage_roles');
    
    if (!canManageRoles) {
        addChatMessage('You do not have permission to manage roles.', 'error');
        return;
    }
    
    // Validate the new role exists
    const newRoleData = typeof GUILD_ROLES !== 'undefined' ? GUILD_ROLES[newRole] : null;
    if (!newRoleData) {
        addChatMessage('Invalid role specified.', 'error');
        return;
    }
    
    // Cannot promote to master or to same/higher priority than yourself
    if (newRole === 'master' || newRoleData.priority <= playerRoleData.priority) {
        addChatMessage('You cannot promote someone to this role.', 'error');
        return;
    }
    
    // Send role change via Firebase
    if (typeof sendGuildRoleChange === 'function') {
        await sendGuildRoleChange(player.guild.name, targetPlayerName, newRole);
        addChatMessage(`You promoted ${targetPlayerName} to ${newRoleData.name}.`, 'system');
        showNotification(`${targetPlayerName} has been promoted to ${newRoleData.name}!`, 'success');
        // Refresh guild tab
        updateGuildTab();
    } else {
        addChatMessage('Unable to change role - network error.', 'error');
    }
}

// Demote a guild member to a lower role
async function demoteGuildMember(targetPlayerName, newRole) {
    if (!player.guild || !player.guild.name) {
        addChatMessage('You are not in a guild.', 'error');
        return;
    }
    
    // Check if player has manage_roles permission
    const playerRole = player.guild.role || 'member';
    const playerRoleData = typeof GUILD_ROLES !== 'undefined' ? GUILD_ROLES[playerRole] : null;
    const canManageRoles = playerRoleData && playerRoleData.permissions.includes('manage_roles');
    
    if (!canManageRoles) {
        addChatMessage('You do not have permission to manage roles.', 'error');
        return;
    }
    
    // Validate the new role exists
    const newRoleData = typeof GUILD_ROLES !== 'undefined' ? GUILD_ROLES[newRole] : null;
    if (!newRoleData) {
        addChatMessage('Invalid role specified.', 'error');
        return;
    }
    
    // Send role change via Firebase
    if (typeof sendGuildRoleChange === 'function') {
        await sendGuildRoleChange(player.guild.name, targetPlayerName, newRole);
        addChatMessage(`You demoted ${targetPlayerName} to ${newRoleData.name}.`, 'system');
        showNotification(`${targetPlayerName} has been demoted to ${newRoleData.name}.`, 'info');
        // Refresh guild tab
        updateGuildTab();
    } else {
        addChatMessage('Unable to change role - network error.', 'error');
    }
}

window.promoteGuildMember = promoteGuildMember;
window.demoteGuildMember = demoteGuildMember;

// ============================================
// GUILD BUFFS SYSTEM
// ============================================
function openGuildBuffsWindow() {
    if (!player.guild || !player.guild.name) {
        showNotification('You are not in a guild.', 'error');
        return;
    }
    
    // Check permissions
    const playerRole = player.guild.role || 'member';
    const playerRoleData = typeof GUILD_ROLES !== 'undefined' ? GUILD_ROLES[playerRole] : null;
    const canManageGuild = playerRoleData && playerRoleData.permissions.includes('manage_guild');
    
    if (!canManageGuild) {
        showNotification('You do not have permission to manage guild buffs.', 'error');
        return;
    }
    
    const unlockedBuffs = player.guild.buffs || [];
    const playerGold = player.gold || 0;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'guild-modal';
    modal.id = 'guild-buffs-modal';
    
    let buffsHtml = '<h3>✨ Guild Buffs</h3>';
    buffsHtml += `<p style="margin-bottom: 10px;">Your Gold: <span style="color: #f1c40f;">${formatGold(playerGold)}</span></p>`;
    buffsHtml += '<div class="guild-buffs-grid">';
    
    // Group buffs by category
    const buffCategories = {
        exp: { name: 'EXP Boosts', icon: '📚', buffs: [] },
        gold: { name: 'Gold Boosts', icon: '💰', buffs: [] },
        drop: { name: 'Drop Rate', icon: '🎁', buffs: [] }
    };
    
    if (typeof GUILD_BUFFS !== 'undefined') {
        Object.entries(GUILD_BUFFS).forEach(([buffId, buff]) => {
            if (buffId.startsWith('exp')) buffCategories.exp.buffs.push({ id: buffId, ...buff });
            else if (buffId.startsWith('gold')) buffCategories.gold.buffs.push({ id: buffId, ...buff });
            else if (buffId.startsWith('drop')) buffCategories.drop.buffs.push({ id: buffId, ...buff });
        });
    }
    
    Object.entries(buffCategories).forEach(([catKey, category]) => {
        if (category.buffs.length === 0) return;
        
        buffsHtml += `<div class="guild-buff-category">`;
        buffsHtml += `<div class="guild-buff-category-header">${category.icon} ${category.name}</div>`;
        
        category.buffs.forEach(buff => {
            const isUnlocked = unlockedBuffs.includes(buff.id);
            const canAfford = playerGold >= buff.cost;
            const hasRequirement = !buff.requires || unlockedBuffs.includes(buff.requires);
            const canUnlock = !isUnlocked && canAfford && hasRequirement;
            
            buffsHtml += `<div class="guild-buff-item ${isUnlocked ? 'unlocked' : ''} ${canUnlock ? 'available' : ''}">
                <div class="guild-buff-icon-large">${buff.icon}</div>
                <div class="guild-buff-details">
                    <div class="guild-buff-title">${buff.name}</div>
                    <div class="guild-buff-desc">${buff.description}</div>
                    ${!isUnlocked ? `<div class="guild-buff-cost">${formatGold(buff.cost)}</div>` : ''}
                    ${buff.requires && !hasRequirement ? `<div class="guild-buff-req">Requires: ${GUILD_BUFFS[buff.requires]?.name || buff.requires}</div>` : ''}
                </div>
                ${isUnlocked ? '<div class="guild-buff-status">✓ Unlocked</div>' : ''}
                ${canUnlock ? `<button class="guild-buff-unlock-btn" onclick="unlockGuildBuff('${buff.id}')">Unlock</button>` : ''}
            </div>`;
        });
        
        buffsHtml += `</div>`;
    });
    
    buffsHtml += '</div>';
    buffsHtml += `<div class="guild-modal-buttons">
        <button class="guild-modal-btn cancel" onclick="closeGuildBuffsWindow()">Close</button>
    </div>`;
    
    modal.innerHTML = buffsHtml;
    document.body.appendChild(modal);
}

function closeGuildBuffsWindow() {
    const modal = document.getElementById('guild-buffs-modal');
    if (modal) modal.remove();
}

async function unlockGuildBuff(buffId) {
    if (!player.guild || !player.guild.name) return;
    
    const buff = typeof GUILD_BUFFS !== 'undefined' ? GUILD_BUFFS[buffId] : null;
    if (!buff) return;
    
    const unlockedBuffs = player.guild.buffs || [];
    const playerGold = player.gold || 0;
    
    if (unlockedBuffs.includes(buffId)) {
        showNotification('This buff is already unlocked!', 'info');
        return;
    }
    
    if (playerGold < buff.cost) {
        showNotification('You don\'t have enough gold!', 'error');
        return;
    }
    
    if (buff.requires && !unlockedBuffs.includes(buff.requires)) {
        showNotification(`You need to unlock ${GUILD_BUFFS[buff.requires]?.name || buff.requires} first!`, 'error');
        return;
    }
    
    // Deduct gold from player
    player.gold -= buff.cost;
    
    // Send to Firebase (just unlock the buff, no guild gold deduction)
    if (typeof unlockGuildBuffFirebase === 'function') {
        await unlockGuildBuffFirebase(player.guild.name, buffId, 0); // Pass 0 since we're not deducting from guild treasury
        
        // Update local state
        if (!player.guild.buffs) player.guild.buffs = [];
        player.guild.buffs.push(buffId);
        
        showNotification(`Unlocked ${buff.name}! ${buff.description}`, 'success');
        addChatMessage(`[Guild] ${buff.name} has been unlocked!`, 'guild');
        
        // Save character to persist gold deduction
        if (typeof saveCharacter === 'function') saveCharacter();
        
        // Refresh the modal
        closeGuildBuffsWindow();
        openGuildBuffsWindow();
        updateGuildTab();
    } else {
        // Refund gold if Firebase fails
        player.gold += buff.cost;
        showNotification('Unable to unlock buff - network error.', 'error');
    }
}

window.openGuildBuffsWindow = openGuildBuffsWindow;
window.closeGuildBuffsWindow = closeGuildBuffsWindow;
window.unlockGuildBuff = unlockGuildBuff;

function inviteToGuild(playerName) {
    // Check for validation issues
    if (typeof hasValidationIssues === 'function' && hasValidationIssues()) {
        if (typeof showValidationBlockedMessage === 'function') {
            showValidationBlockedMessage('send guild invites');
        } else {
            addChatMessage('⚠️ You cannot send guild invites due to account validation issues.', 'error');
        }
        return;
    }
    
    if (!player.guild || !player.guild.name) {
        addChatMessage('You are not in a guild.', 'error');
        return;
    }
    
    // Check if player has invite permission
    const playerRole = player.guild.role || 'member';
    const playerRoleData = typeof GUILD_ROLES !== 'undefined' ? GUILD_ROLES[playerRole] : null;
    const canInvite = playerRoleData && playerRoleData.permissions.includes('invite');
    
    if (!canInvite) {
        addChatMessage('You do not have permission to invite members.', 'error');
        return;
    }
    
    // Check if target player is already in a guild
    const onlinePlayers = typeof getOnlinePlayers === 'function' ? getOnlinePlayers() : [];
    const targetPlayer = onlinePlayers.find(p => p.playerName === playerName);
    if (targetPlayer && targetPlayer.guildName) {
        addChatMessage(`${playerName} is already in a guild.`, 'error');
        return;
    }
    
    // Send guild invite via chat system (similar to party invites)
    if (typeof db !== 'undefined') {
        db.collection('globalChat').add({
            type: 'guildInvite',
            from: player.name,
            to: playerName,
            guildName: player.guild.name,
            guildIcon: player.guild.icon,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            addChatMessage(`Guild invite sent to ${playerName}.`, 'system');
        }).catch(error => {
            console.error('Error sending guild invite:', error);
            addChatMessage('Failed to send guild invite.', 'error');
        });
    }
}

function updateGuildNameplate() {
    const guildNameplate = document.getElementById('guild-nameplate');
    const guildNameElement = document.getElementById('guild-name');
    const guildIconElement = document.getElementById('guild-icon');
    
    if (!guildNameplate) return;
    
    if (player.guild && player.guild.name) {
        const iconId = player.guild.icon || 1;
        guildNameElement.textContent = player.guild.name;
        // Render guild icon sprite to element
        if (typeof renderGuildIconToElement === 'function') {
            renderGuildIconToElement(guildIconElement, iconId, 1);
        } else {
            // Fallback: render inline
            const iconData = spriteData.guildIcons;
            const iconPos = iconData.icons[iconId] || iconData.icons[1];
            const scale = 1.5;
            const width = iconData.frameWidth * scale;
            const height = iconData.frameHeight * scale;
            const bgX = iconPos.x * scale;
            const bgY = iconPos.y * scale;
            const bgWidth = iconData.sheetWidth * scale;
            const bgHeight = iconData.sheetHeight * scale;
            guildIconElement.textContent = '';
            guildIconElement.style.width = `${width}px`;
            guildIconElement.style.height = `${height}px`;
            guildIconElement.style.backgroundImage = `url(${artAssets.guildIcons})`;
            guildIconElement.style.backgroundPosition = `-${bgX}px -${bgY}px`;
            guildIconElement.style.backgroundSize = `${bgWidth}px ${bgHeight}px`;
            guildIconElement.style.imageRendering = 'pixelated';
        }
        guildNameplate.style.display = 'flex';
    } else {
        guildNameplate.style.display = 'none';
    }
}

// Legacy function names for compatibility
function updateOnlinePlayersUI() {
    updateSocialHubUI();
}

function initializeOnlinePlayersWindow() {
    initializeSocialHub();
}

function openSocialHubWindow() {
    if (!socialHubWindow) {
        socialHubWindow = document.getElementById('social-hub-window');
    }
    
    if (socialHubWindow) {
        socialHubWindow.style.display = 'block';
        updateSocialHubUI();
    }
}

function initiateTradeWith(playerName) {
    if (typeof sendTradeRequest === 'function') {
        sendTradeRequest(playerName);
        // Set activity to trading
        setPlayerActivity('trading');
    } else {
        addChatMessage('Trading system not available.', 'error');
    }
}

// ============================================
// TRADE WINDOW UI
// ============================================

function openTradeWindow(tradeId) {
    if (!tradeWindow) {
        tradeWindow = document.getElementById('trade-window');
    }
    
    if (!tradeWindow) return;
    
    tradeWindow.style.display = 'block';
    tradeItems = [];
    
    // Reset trade executed flag
    if (typeof tradeExecuted !== 'undefined') {
        tradeExecuted = false;
    }
    
    // Set coin icons from artAssets (same approach as inventory)
    const coinImgs = tradeWindow.querySelectorAll('.trade-coin-img');
    coinImgs.forEach(img => {
        if (typeof artAssets !== 'undefined' && artAssets.coin && !img.src) {
            img.src = artAssets.coin;
        }
    });
    
    // Update gold input max
    const goldInput = document.getElementById('my-trade-gold');
    if (goldInput) {
        goldInput.max = player.gold;
        goldInput.value = 0;
    }
    
    // Set up real-time listener for trade updates
    if (typeof db !== 'undefined' && tradeId) {
        if (tradeUnsubscribe) tradeUnsubscribe();
        
        tradeUnsubscribe = db.collection('trades').doc(tradeId).onSnapshot(async (doc) => {
            if (!doc.exists) {
                // Trade document deleted - close window
                if (typeof tradeExecuted === 'undefined' || !tradeExecuted) {
                    addChatMessage('Trade ended.', 'system');
                }
                closeTradeWindow();
                return;
            }
            
            const trade = doc.data();
            
            // Handle cancelled trades - but NOT if we already executed successfully
            if (trade.status === 'cancelled') {
                if (!tradeExecuted) {
                    addChatMessage('Trade was cancelled.', 'error');
                }
                closeTradeWindow();
                return;
            }
            
            // Handle completed trades - close for both parties
            if (trade.status === 'completed') {
                // If we haven't executed yet but status is completed, we need to execute now
                // This happens when the other player completed first
                if (!tradeExecuted && typeof executeTrade === 'function') {
                    tradeExecuted = true;
                    await executeTrade(trade, tradeId);
                }
                closeTradeWindow();
                return;
            }
            
            // Store current trade data for reference
            if (typeof currentTradeData !== 'undefined') {
                currentTradeData = trade;
            }
            
            const isInitiator = trade.initiatorPlayer === player.name;
            const myReadyField = isInitiator ? 'initiatorReady' : 'targetReady';
            const myCompletedField = isInitiator ? 'initiatorCompleted' : 'targetCompleted';
            const otherCompletedField = isInitiator ? 'targetCompleted' : 'initiatorCompleted';
            
            // Check if both players have confirmed - start execution phase
            // Also handle if status is already 'executing' but we haven't marked ready yet
            if (trade.initiatorConfirmed && trade.targetConfirmed && 
                (trade.status === 'accepted' || trade.status === 'executing')) {
                
                // If we haven't marked ourselves ready yet, do so now
                if (!trade[myReadyField]) {
                    try {
                        await db.collection('trades').doc(tradeId).update({ 
                            [myReadyField]: true,
                            status: 'executing' // Lock the trade (or keep it locked)
                        });
                    } catch (e) {
                        console.error('Error marking ready:', e);
                    }
                    return; // Wait for the next snapshot with updated data
                }
            }
            
            // Both players are ready - actually execute the trade
            if (trade.status === 'executing' && trade.initiatorReady && trade.targetReady) {
                // Check if we already completed our side
                if (trade[myCompletedField]) {
                    // We already did our part, check if we need to finalize
                    if (trade[otherCompletedField]) {
                        // Both done, mark as completed
                        try {
                            await db.collection('trades').doc(tradeId).update({ status: 'completed' });
                        } catch (e) {
                            // Other player might have done this already
                        }
                    }
                    return;
                }
                
                // Execute the trade locally (only once)
                if (!tradeExecuted && typeof executeTrade === 'function') {
                    tradeExecuted = true;
                    const success = await executeTrade(trade, tradeId);
                    
                    if (success) {
                        // Mark ourselves as completed
                        try {
                            await db.collection('trades').doc(tradeId).update({ 
                                [myCompletedField]: true 
                            });
                            
                            // Re-read to check if other player also completed
                            // The next snapshot will handle finalizing
                        } catch (e) {
                            console.error('Error updating completion status:', e);
                        }
                    } else {
                        // Our execution failed - cancel the whole trade
                        try {
                            await db.collection('trades').doc(tradeId).update({ status: 'cancelled' });
                        } catch (e) {
                            console.error('Error cancelling trade:', e);
                        }
                    }
                }
                return;
            }
            
            updateTradeWindowUI(trade);
        }, (error) => {
            console.error('Trade listener error:', error);
            addChatMessage('Trade connection lost.', 'error');
            closeTradeWindow();
        });
    }
}

function updateTradeWindowUI(trade) {
    if (!trade) return;
    
    const isInitiator = trade.initiatorPlayer === player.name;
    const partnerName = isInitiator ? trade.targetPlayer : trade.initiatorPlayer;
    
    // Determine confirmation status
    const myConfirmed = isInitiator ? trade.initiatorConfirmed : trade.targetConfirmed;
    const theirConfirmed = isInitiator ? trade.targetConfirmed : trade.initiatorConfirmed;
    
    // Update partner name
    const partnerNameEl = document.getElementById('trade-partner-name');
    if (partnerNameEl) partnerNameEl.textContent = partnerName;
    
    // Update status
    const statusEl = document.getElementById('trade-status');
    if (statusEl) {
        let statusText = 'Pending';
        let statusColor = '#f1c40f';
        
        if (trade.status === 'executing') {
            statusText = 'Executing trade...';
            statusColor = '#27ae60';
        } else if (trade.status === 'accepted') {
            if (trade.initiatorConfirmed && trade.targetConfirmed) {
                statusText = 'Both Confirmed - Completing...';
                statusColor = '#27ae60';
            } else if (myConfirmed) {
                statusText = 'You Confirmed - Waiting for partner...';
                statusColor = '#3498db';
            } else if (theirConfirmed) {
                statusText = 'Partner Confirmed - Review and confirm!';
                statusColor = '#e67e22';
            } else {
                statusText = 'Add items and confirm';
                statusColor = '#f1c40f';
            }
        }
        
        statusEl.textContent = `Status: ${statusText}`;
        statusEl.style.color = statusColor;
    }
    
    // Update confirmed overlays
    const myOverlay = document.getElementById('my-trade-confirmed-overlay');
    const theirOverlay = document.getElementById('their-trade-confirmed-overlay');
    
    if (myOverlay) {
        myOverlay.style.display = myConfirmed ? 'flex' : 'none';
    }
    if (theirOverlay) {
        theirOverlay.style.display = theirConfirmed ? 'flex' : 'none';
    }
    
    // Disable/enable add item button and gold input when confirmed
    const addItemBtn = document.getElementById('add-item-to-trade-btn');
    const goldInput = document.getElementById('my-trade-gold');
    
    if (addItemBtn) {
        addItemBtn.disabled = myConfirmed;
        addItemBtn.style.opacity = myConfirmed ? '0.5' : '1';
    }
    if (goldInput) {
        goldInput.disabled = myConfirmed;
        goldInput.style.opacity = myConfirmed ? '0.5' : '1';
    }
    
    // Update their offer
    const theirItems = isInitiator ? trade.targetItems : trade.initiatorItems;
    const theirGold = isInitiator ? trade.targetGold : trade.initiatorGold;
    
    const theirItemsContainer = document.getElementById('their-trade-items');
    if (theirItemsContainer) {
        theirItemsContainer.innerHTML = '';
        
        // Create 8 slots (2 rows of 4)
        for (let i = 0; i < 8; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot trade-slot';
            
            const item = theirItems ? theirItems[i] : null;
            if (item) {
                const iconData = spriteData?.dropIcons?.icons?.[item.name];
                if (iconData) {
                    const frameWidth = spriteData.dropIcons.frameWidth;
                    const scale = 6;
                    const innerIcon = document.createElement('div');
                    innerIcon.className = 'pixel-art';
                    innerIcon.style.cssText = `width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.dropIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center;`;
                    slot.appendChild(innerIcon);
                }
                
                if (item.quantity > 1) {
                    const quantityEl = document.createElement('span');
                    quantityEl.className = 'item-quantity';
                    quantityEl.textContent = item.quantity;
                    slot.appendChild(quantityEl);
                }
                
                // Add rarity glow
                const itemInfo = itemData[item.name];
                const rarity = item.rarity || (itemInfo?.category === 'Cosmetic' ? 'cosmetic' : 'common');
                slot.classList.add(rarity);
                
                // Add tooltip on hover
                const tooltipContent = buildTooltipHtml(item);
                slot.addEventListener('mouseover', (e) => {
                    if (tooltipContent) showTooltip(e, tooltipContent);
                });
                slot.addEventListener('mouseout', hideTooltip);
            }
            
            theirItemsContainer.appendChild(slot);
        }
    }
    
    const theirGoldEl = document.getElementById('their-trade-gold');
    if (theirGoldEl) theirGoldEl.textContent = (theirGold || 0).toLocaleString();
    
    // Update my offer display (skip if we're in the middle of a local update to prevent flashing)
    if (!tradeUpdatingLocally) {
        updateMyTradeItemsUI();
    }
}

function updateMyTradeItemsUI() {
    const container = document.getElementById('my-trade-items');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Create 8 slots (2 rows of 4)
    for (let i = 0; i < 8; i++) {
        const slot = document.createElement('div');
        slot.className = 'inventory-slot trade-slot';
        
        const item = tradeItems[i];
        if (item) {
            const iconData = spriteData?.dropIcons?.icons?.[item.name];
            if (iconData) {
                const frameWidth = spriteData.dropIcons.frameWidth;
                const scale = 6;
                const innerIcon = document.createElement('div');
                innerIcon.className = 'pixel-art';
                innerIcon.style.cssText = `width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.dropIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center;`;
                slot.appendChild(innerIcon);
            }
            
            if (item.quantity > 1) {
                const quantityEl = document.createElement('span');
                quantityEl.className = 'item-quantity';
                quantityEl.textContent = item.quantity;
                slot.appendChild(quantityEl);
            }
            
            // Add rarity glow
            const itemInfo = itemData[item.name];
            const rarity = item.rarity || (itemInfo?.category === 'Cosmetic' ? 'cosmetic' : 'common');
            slot.classList.add(rarity);
            
            slot.style.cursor = 'pointer';
            slot.onclick = () => removeTradeItem(i);
            
            // Add tooltip on hover
            const tooltipContent = buildTooltipHtml(item);
            slot.addEventListener('mouseover', (e) => {
                if (tooltipContent) showTooltip(e, tooltipContent + '<p style="color: #e74c3c; font-size: 10px; margin-top: 5px;">Click to remove</p>');
            });
            slot.addEventListener('mouseout', hideTooltip);
        }
        
        container.appendChild(slot);
    }
}

async function removeTradeItem(index) {
    // Set flag to prevent Firebase listener from interfering
    tradeUpdatingLocally = true;
    
    tradeItems.splice(index, 1);
    updateMyTradeItemsUI();
    
    // Update trade offer
    const goldInput = document.getElementById('my-trade-gold');
    const gold = parseInt(goldInput?.value) || 0;
    if (typeof updateTradeOffer === 'function') {
        await updateTradeOffer(tradeItems, gold);
    }
    
    // Small delay to let Firebase listener settle
    await new Promise(resolve => setTimeout(resolve, 100));
    tradeUpdatingLocally = false;
}

function openTradeItemSelector() {
    // Remove any existing selector first
    const existingSelector = document.getElementById('trade-item-selector');
    if (existingSelector) existingSelector.remove();
    
    // Create a modal to select items from inventory
    const modal = document.createElement('div');
    modal.id = 'trade-item-selector';
    modal.className = 'window';
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        z-index: 10001;
        display: block;
    `;
    
    // Get tradeable items from inventory (equip and use tabs)
    const tradeableItems = [];
    ['equip', 'use', 'etc'].forEach(tab => {
        player.inventory[tab].forEach((item, index) => {
            if (item && !tradeItems.find(t => t.name === item.name && t.tab === tab && t.index === index)) {
                tradeableItems.push({ ...item, tab, index });
            }
        });
    });
    
    let itemsHtml = '';
    if (tradeableItems.length === 0) {
        itemsHtml = '<p style="color: #7f8c8d; text-align: center;">No tradeable items in inventory.</p>';
    } else {
        itemsHtml = '<div id="trade-selector-grid" class="trade-selector-grid"></div>';
    }
    
    modal.innerHTML = `
        <div class="window-title">
            <span>Select Item to Trade</span>
            <button class="close-btn">X</button>
        </div>
        <div class="window-content">
            ${itemsHtml}
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Make the window draggable
    const header = modal.querySelector('.window-title');
    if (header && typeof makeWindowDraggable === 'function') {
        makeWindowDraggable(modal, header);
    }
    
    // Set up close button
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            modal.remove();
        });
    }
    
    // Now populate items with proper icons
    if (tradeableItems.length > 0) {
        const grid = document.getElementById('trade-selector-grid');
        tradeableItems.forEach((item, i) => {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.style.cursor = 'pointer';
            slot.title = item.name;
            
            const iconData = spriteData?.dropIcons?.icons?.[item.name];
            if (iconData) {
                const frameWidth = spriteData.dropIcons.frameWidth;
                const scale = 6;
                const innerIcon = document.createElement('div');
                innerIcon.className = 'pixel-art';
                innerIcon.style.cssText = `width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.dropIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center;`;
                slot.appendChild(innerIcon);
            }
            
            if (item.quantity > 1) {
                const quantityEl = document.createElement('span');
                quantityEl.className = 'item-quantity';
                quantityEl.textContent = item.quantity;
                slot.appendChild(quantityEl);
            }
            
            // Add rarity glow
            const itemInfo = itemData[item.name];
            const rarity = item.rarity || (itemInfo?.category === 'Cosmetic' ? 'cosmetic' : 'common');
            slot.classList.add(rarity);
            
            slot.onclick = () => {
                addItemToTrade(i);
                modal.remove();
            };
            
            grid.appendChild(slot);
        });
    }
    
    // Store items reference for the onclick handler
    window._tradeableItems = tradeableItems;
}

function addItemToTrade(index, quantity = null) {
    const item = window._tradeableItems[index];
    if (!item) return;
    
    // If item is stackable (quantity > 1) and quantity not specified, show quantity selector
    if ((item.quantity || 1) > 1 && quantity === null) {
        openTradeQuantitySelector(index, item);
        return;
    }
    
    const tradeQuantity = quantity || item.quantity || 1;
    
    // Set flag to prevent Firebase listener from interfering
    tradeUpdatingLocally = true;
    
    // Add to trade items
    tradeItems.push({
        name: item.name,
        quantity: tradeQuantity,
        tab: item.tab,
        index: item.index,
        stats: item.stats,
        enhancement: item.enhancement,
        rarity: item.rarity
    });
    
    // Close selector
    const selector = document.getElementById('trade-item-selector');
    if (selector) selector.remove();
    
    // Update UI immediately
    updateMyTradeItemsUI();
    
    // Update trade offer in Firebase
    const goldInput = document.getElementById('my-trade-gold');
    const gold = parseInt(goldInput?.value) || 0;
    if (typeof updateTradeOffer === 'function') {
        updateTradeOffer(tradeItems, gold).then(() => {
            // Clear the flag after Firebase update completes
            tradeUpdatingLocally = false;
        }).catch(() => {
            tradeUpdatingLocally = false;
        });
    } else {
        tradeUpdatingLocally = false;
    }
}

// Quantity selector for stackable items in trade
function openTradeQuantitySelector(index, item) {
    // Close the item selector first
    const itemSelector = document.getElementById('trade-item-selector');
    if (itemSelector) itemSelector.remove();
    
    const maxQuantity = item.quantity || 1;
    
    const modal = document.createElement('div');
    modal.id = 'trade-quantity-selector';
    modal.className = 'window';
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 300px;
        z-index: 10002;
        display: block;
    `;
    
    modal.innerHTML = `
        <div class="window-title">
            <span>Select Quantity</span>
            <button class="close-btn" onclick="this.closest('.window').remove()">X</button>
        </div>
        <div class="window-content" style="text-align: center; padding: 15px;">
            <p style="margin-bottom: 10px;">How many <strong>${item.name}</strong> do you want to trade?</p>
            <p style="margin-bottom: 15px; color: #7f8c8d; font-size: 11px;">You have ${maxQuantity} available</p>
            
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 15px;">
                <button id="trade-qty-minus" class="btn" style="width: 40px; padding: 5px;">-</button>
                <input type="number" id="trade-qty-input" value="1" min="1" max="${maxQuantity}" 
                    style="width: 80px; text-align: center; font-size: 16px; padding: 8px;">
                <button id="trade-qty-plus" class="btn" style="width: 40px; padding: 5px;">+</button>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="trade-qty-all" class="btn" style="padding: 5px 10px;">All (${maxQuantity})</button>
                <button id="trade-qty-half" class="btn" style="padding: 5px 10px;">Half (${Math.floor(maxQuantity / 2)})</button>
            </div>
            
            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                <button id="trade-qty-confirm" class="btn btn-success" style="padding: 8px 20px;">Confirm</button>
                <button id="trade-qty-cancel" class="btn btn-danger" style="padding: 8px 20px;">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = document.getElementById('trade-qty-input');
    const minusBtn = document.getElementById('trade-qty-minus');
    const plusBtn = document.getElementById('trade-qty-plus');
    const allBtn = document.getElementById('trade-qty-all');
    const halfBtn = document.getElementById('trade-qty-half');
    const confirmBtn = document.getElementById('trade-qty-confirm');
    const cancelBtn = document.getElementById('trade-qty-cancel');
    
    // Update input value with clamping
    const updateValue = (val) => {
        input.value = Math.max(1, Math.min(maxQuantity, val));
    };
    
    minusBtn.onclick = () => updateValue(parseInt(input.value) - 1);
    plusBtn.onclick = () => updateValue(parseInt(input.value) + 1);
    allBtn.onclick = () => updateValue(maxQuantity);
    halfBtn.onclick = () => updateValue(Math.floor(maxQuantity / 2) || 1);
    
    input.onchange = () => updateValue(parseInt(input.value) || 1);
    
    confirmBtn.onclick = () => {
        const qty = Math.max(1, Math.min(maxQuantity, parseInt(input.value) || 1));
        modal.remove();
        addItemToTrade(index, qty);
    };
    
    cancelBtn.onclick = () => {
        modal.remove();
        // Reopen item selector
        openTradeItemSelector();
    };
    
    // Focus input
    input.focus();
    input.select();
}

function closeTradeWindow() {
    if (tradeWindow) {
        tradeWindow.style.display = 'none';
        
        // Reset confirm button state
        const confirmBtn = document.getElementById('confirm-trade-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = '✓ Confirm Trade';
        }
    }
    
    // Reset activity to exploring
    setPlayerActivity('exploring');
    
    if (tradeUnsubscribe) {
        tradeUnsubscribe();
        tradeUnsubscribe = null;
    }
    
    tradeItems = [];
    
    // Reset trade state in firebase-config
    if (typeof currentTradeId !== 'undefined') {
        currentTradeId = null;
    }
    if (typeof currentTradeData !== 'undefined') {
        currentTradeData = null;
    }
    if (typeof tradeExecuted !== 'undefined') {
        tradeExecuted = false;
    }
    
    // Remove any trade notifications and modals
    document.querySelectorAll('.trade-invite-prompt').forEach(el => el.remove());
    document.querySelectorAll('#trade-item-selector').forEach(el => el.remove());
    document.querySelectorAll('#trade-quantity-selector').forEach(el => el.remove());
}

// Helper function to get item icon
function getItemIcon(itemName) {
    const info = itemData[itemName];
    if (!info) return '';
    
    if (info.icon && typeof artAssets !== 'undefined') {
        return artAssets.itemIcons || '';
    }
    
    return '';
}

/**
 * Update the Party Quest objective UI
 * Shows the current stage objective when in a PQ map
 */
function updatePQObjectiveUI() {
    let pqObjectiveUI = document.getElementById('pq-objective-ui');
    
    // Check if we're in a PQ map
    const map = maps[currentMapId];
    const isInPQ = map && map.isPartyQuest && map.pqStage > 0 && map.pqObjective !== 'reward';
    
    if (isInPQ) {
        // Create UI if it doesn't exist
        if (!pqObjectiveUI) {
            pqObjectiveUI = document.createElement('div');
            pqObjectiveUI.id = 'pq-objective-ui';
            pqObjectiveUI.style.cssText = `
                position: fixed;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(180deg, rgba(30, 30, 60, 0.95) 0%, rgba(20, 20, 40, 0.95) 100%);
                border: 2px solid #ffd700;
                border-radius: 10px;
                padding: 15px 30px;
                color: white;
                font-family: 'Press Start 2P', monospace;
                z-index: 1000;
                text-align: center;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 215, 0, 0.3);
                min-width: 300px;
            `;
            document.body.appendChild(pqObjectiveUI);
        }
        
        // Update content
        const stageText = map.pqStage === 5 ? 'BOSS STAGE' : `STAGE ${map.pqStage}`;
        const objectiveText = map.pqObjectiveText || 'Defeat all monsters!';
        
        // Count remaining monsters
        const aliveMonsters = (typeof monsters !== 'undefined') 
            ? monsters.filter(m => m && !m.isDead).length 
            : 0;
        
        pqObjectiveUI.innerHTML = `
            <div style="color: #ffd700; font-size: 14px; margin-bottom: 8px;">${stageText}</div>
            <div style="color: #fff; font-size: 11px; margin-bottom: 10px;">${objectiveText}</div>
            <div style="color: ${aliveMonsters === 0 ? '#4ade80' : '#ff6b6b'}; font-size: 10px;">
                ${aliveMonsters === 0 ? '✓ COMPLETE!' : `Monsters Remaining: ${aliveMonsters}`}
            </div>
        `;
        
        pqObjectiveUI.style.display = 'block';
    } else {
        // Hide UI if not in PQ
        if (pqObjectiveUI) {
            pqObjectiveUI.style.display = 'none';
        }
    }
}

// Export the function
window.updatePQObjectiveUI = updatePQObjectiveUI;

// Replace the updateMiniMap function in ui.js with this one.

function updateMiniMap() {
    if (!minimapContainer || minimapContainer.style.display !== 'block' || !isGameActive) return;

    const map = maps[currentMapId];
    if (!map) return;

    const minimapContent = minimap.querySelector('div') || document.createElement('div');
    if (!minimap.contains(minimapContent)) {
        minimap.appendChild(minimapContent);
    }

    // Use GAME_CONFIG.BASE_GAME_HEIGHT for consistent physics (prevents browser resize exploits)
    const mapHeight = map.height || GAME_CONFIG.BASE_GAME_HEIGHT;
    const mapWidth = map.width;
    
    // Get the minimap container width (user can resize this)
    const containerWidth = minimapContainer.clientWidth || 200;
    
    // Calculate the proper height based on the map's aspect ratio
    const mapAspectRatio = mapHeight / mapWidth;
    const properHeight = containerWidth * mapAspectRatio;
    
    // Update the minimap div height to match the map's aspect ratio
    minimap.style.height = `${properHeight}px`;
    
    // Calculate scale to fit the map exactly in the minimap
    const scale = containerWidth / mapWidth;

    mapNameElement.textContent = currentMapId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    
    // Update PQ objective UI if in a party quest map
    updatePQObjectiveUI();
    
    minimapContent.innerHTML = '';
    minimapContent.style.width = `${mapWidth * scale}px`;
    minimapContent.style.height = `${mapHeight * scale}px`;

    // Draw platforms and ground
    if (!map.isJumpQuest) {
        const groundPlane = document.createElement('div');
        groundPlane.className = 'minimap-platform';
        const groundLevel = mapHeight - GROUND_Y;
        groundPlane.style.left = '0px';
        groundPlane.style.top = `${groundLevel * scale}px`;
        groundPlane.style.width = `100%`;
        groundPlane.style.height = `${GROUND_Y * scale}px`;
        groundPlane.style.opacity = '0.5';
        minimapContent.appendChild(groundPlane);
    }

    platforms.forEach(p => {
        if (!p) return; // Skip null/undefined platforms
        const pEl = document.createElement('div');
        if (p.isLadder) {
            if (p.y1 === undefined || p.y2 === undefined) return; // Skip invalid ladders
            pEl.className = 'minimap-ladder';
            pEl.style.left = `${p.x * scale}px`;
            pEl.style.top = `${p.y1 * scale}px`;
            pEl.style.width = `1px`;
            pEl.style.height = `${(p.y2 - p.y1) * scale}px`;
        } else {
            if (p.y === undefined) return; // Skip platforms without y
            pEl.className = 'minimap-platform';
            pEl.style.left = `${p.x * scale}px`;
            pEl.style.top = `${p.y * scale}px`;
            pEl.style.width = `${Math.max(1, p.width * scale)}px`;
            pEl.style.height = `1px`;
        }
        minimapContent.appendChild(pEl);
    });

    const dotData = [
        { type: 'player', x: player.x, y: player.y, element: 'minimap-player' },
        ...monsters.map(m => {
            // Safety check for monster type data
            const monsterInfo = monsterTypes[m.type];
            if (!monsterInfo) return null;
            return { type: 'monster', x: m.x, y: m.y, element: monsterInfo.isMiniBoss ? 'minimap-boss' : 'minimap-monster' };
        }).filter(Boolean), // Filter out any null entries from dead/invalid monsters
        ...npcs.filter(n => n.y !== undefined).map(n => ({ type: 'npc', x: n.x, y: n.y, element: 'minimap-npc', questStatus: getNpcQuestStatus(n) })),
        ...portals.filter(p => p.y !== undefined).map(p => ({ type: 'portal', x: p.x, y: p.y, element: 'minimap-portal' })),
    ];

    dotData.forEach(data => {
        const dot = document.createElement('div');
        dot.className = data.element;
        if (data.type === 'player') dot.id = 'minimap-player';
        dot.style.left = `${data.x * scale}px`;
        dot.style.top = `${data.y * scale}px`;
        minimapContent.appendChild(dot);

        if (data.type === 'npc' && data.questStatus) {
            const indicator = document.createElement('div');
            indicator.className = 'minimap-quest-indicator pixel-art';
            let iconData;
            if (data.questStatus === 'complete') {
                iconData = spriteData?.uiIcons?.icons?.questComplete;
            } else if (data.questStatus === 'inProgress') {
                iconData = spriteData?.uiIcons?.icons?.questInProgress;
            } else {
                iconData = spriteData?.uiIcons?.icons?.questAvailable;
            }
            if (iconData && iconData.x !== undefined && iconData.y !== undefined) {
                indicator.style.width = '24px';
                indicator.style.height = '24px';
                indicator.style.backgroundImage = `url(${artAssets.uiIcons})`;
                indicator.style.backgroundPosition = `-${iconData.x * 1.5}px -${iconData.y * 1.5}px`;
                indicator.style.backgroundSize = `72px 72px`;
                indicator.style.imageRendering = 'pixelated';
                indicator.style.left = `${data.x * scale - 12}px`;
                indicator.style.top = `${data.y * scale - 12}px`;
                minimapContent.appendChild(indicator);
            }
        }
    });

    const playerLeft = player.x * scale;
    const playerTop = player.y * scale;
    let offsetX = playerLeft - (minimap.clientWidth / 2);
    let offsetY = playerTop - (minimap.clientHeight / 2);
    offsetX = Math.max(0, Math.min(offsetX, minimapContent.clientWidth - minimap.clientWidth));
    offsetY = Math.max(0, Math.min(offsetY, minimapContent.clientHeight - minimap.clientHeight));

    minimapContent.style.transform = `translateX(-${offsetX}px) translateY(-${offsetY}px)`;
}

// Replace the existing canCompleteCollectQuest function in ui.js
/**
 * Checks if a collect quest can be completed by looking in all inventory categories.
 * @param {object} quest - The quest object
 * @returns {boolean} - Whether the quest can be completed
 */
function canCompleteCollectQuest(quest) {
    if (quest.objective.type !== 'collect') return false;

    const target = quest.objective.target;
    const requiredCount = quest.objective.count;

    // Check all inventory categories for the item
    const allInventoryItems = [
        ...player.inventory.equip,
        ...player.inventory.use,
        ...player.inventory.etc,
        ...player.inventory.cosmetic
    ];

    const totalCount = allInventoryItems
        .filter(item => item.name === target)
        .reduce((sum, item) => sum + (item.quantity || 1), 0);

    return totalCount >= requiredCount;
}

function openDialogue(npc) {
    // --- KERNING CITY JUMP QUEST PRIZE BOX ---
    if (npc.id === 'prizeBox') {
        const dialogueTitle = document.getElementById('dialogue-title');
        const content = document.getElementById('dialogue-content');
        dialogueTitle.textContent = npc.name;
        
        // Check if already claimed using a dedicated flag
        if (player.hasClaimedJumpQuestPrize) {
            content.innerHTML = `<p>You've already received the rewards from this mysterious box.</p><p>Your Jump Quest Badge marks you as a skilled jumper!</p><p>Seek out the <strong>Sky Palace Jump Quest</strong> for the ultimate challenge - and the legendary Flash Jump skill!</p><button id="close-dialogue">Close</button>`;
            document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
        } else {
            // Give rewards
            player.hasClaimedJumpQuestPrize = true;
            
            const expReward = 5000;
            const goldReward = 10000;
            
            gainExp(expReward);
            player.gold += goldReward;
            
            // Give Jump Quest Badge item instead of Flash Jump
            const badgeItem = { ...itemData['Jump Quest Badge'], id: Date.now() };
            player.inventory.push(badgeItem);
            addChatMessage('You received Jump Quest Badge!', 'quest-complete');
            showNotification('Received Jump Quest Badge', 'epic');
            
            // Update achievement
            updateAchievementProgress('action', 'complete_jq');
            
            // Show rewards
            addChatMessage(`Jump Quest Complete! +${expReward.toLocaleString()} EXP`, 'quest-complete');
            addChatMessage(`Received ${goldReward.toLocaleString()} Gold`, 'quest-complete');
            
            content.innerHTML = `
                <p><strong>🎊 Congratulations! 🎊</strong></p>
                <p>You've conquered the Onyx City Jump Quest!</p>
                <br>
                <p><strong>Rewards:</strong></p>
                <p>✨ ${expReward.toLocaleString()} EXP</p>
                <p>💰 ${goldReward.toLocaleString()} Gold</p>
                <p>🏅 Jump Quest Badge</p>
                <br>
                <p>This badge marks you as a skilled jumper! But the true challenge awaits...</p>
                <p><strong>Seek out the Sky Palace Jump Quest for the legendary Flash Jump skill!</strong></p>
                <br>
                <p>Use the portal to return to Onyx City whenever you're ready!</p>
                <button id="close-dialogue">Awesome!</button>
            `;
            document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
            
            updateInventoryUI();
            updateUI();
        }
        toggleWindow(dialogueWindowElement);
        return; // End function for this special case
    }
    // --- END KERNING CITY PRIZE BOX ---

    // --- Sky Palace JUMP QUEST PRIZE BOX ---
    if (npc.id === 'skyPalacePrizeBox') {
        const dialogueTitle = document.getElementById('dialogue-title');
        const content = document.getElementById('dialogue-content');
        dialogueTitle.textContent = npc.name;
        
        // Check if already claimed
        if (player.hasClaimedskyPalaceJQPrize) {
            content.innerHTML = `<p>You've already claimed the ultimate prize from this ancient chest.</p><p>The power of Flash Jump flows through you!</p><p>Use the portal to return to Sky Palace whenever you're ready!</p><button id="close-dialogue">Close</button>`;
            document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
        } else {
            // Give rewards
            player.hasClaimedskyPalaceJQPrize = true;
            
            const expReward = 25000;
            const goldReward = 50000;
            
            gainExp(expReward);
            player.gold += goldReward;
            
            // Give Flash Jump skill - the ultimate reward!
            let flashJumpSkill = player.abilities.find(a => a.name === 'Flash Jump');
            if (!flashJumpSkill) {
                player.abilities.push({ name: 'Flash Jump', level: 1 });
                addChatMessage('You learned Flash Jump!', 'quest-complete');
                showNotification('Learned Flash Jump!', 'legendary');
            } else if (flashJumpSkill.level < 1) {
                flashJumpSkill.level = 1;
            }
            
            // Give Shadow Veil Jump Badge item
            const badgeItem = { ...itemData['Shadow Veil Jump Badge'], id: Date.now() };
            player.inventory.push(badgeItem);
            addChatMessage('You received Shadow Veil Jump Badge!', 'quest-complete');
            showNotification('Received Shadow Veil Jump Badge', 'legendary');
            
            // Update achievement for completing Sky Palace JQ
            updateAchievementProgress('action', 'complete_sky_palace_jq');
            
            // Show rewards
            addChatMessage(`Sky Palace Jump Quest Complete! +${expReward.toLocaleString()} EXP`, 'quest-complete');
            addChatMessage(`Received ${goldReward.toLocaleString()} Gold`, 'quest-complete');
            
            content.innerHTML = `
                <p><strong>🎊 LEGENDARY ACHIEVEMENT! 🎊</strong></p>
                <p>You've conquered the legendary Sky Palace Jump Quest!</p>
                <p>The most treacherous climb in all of BennSauce!</p>
                <br>
                <p><strong>Rewards:</strong></p>
                <p>✨ ${expReward.toLocaleString()} EXP</p>
                <p>💰 ${goldReward.toLocaleString()} Gold</p>
                <p>⚡ Flash Jump Skill</p>
                <p>🏅 Shadow Veil Jump Badge</p>
                <br>
                <p>You can now double jump in mid-air! Just press jump again while airborne.</p>
                <p>Few have ever reached this height. You are truly a master of movement!</p>
                <br>
                <p>Use the portal to return to the Sky Palace!</p>
                <button id="close-dialogue">Legendary!</button>
            `;
            document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
            
            updateInventoryUI();
            updateUI();
            updateSkillTreeUI();
            updateSkillHotbarUI();
        }
        toggleWindow(dialogueWindowElement);
        return; // End function for this special case
    }
    // --- END Sky Palace PRIZE BOX ---

    const dialogueTitle = document.getElementById('dialogue-title');
    const content = document.getElementById('dialogue-content');
    dialogueTitle.textContent = npc.name;

    if (npc.id) {
        if (!player.stats.talkedNPCs || typeof player.stats.talkedNPCs.add !== 'function') {
            player.stats.talkedNPCs = new Set(Array.isArray(player.stats.talkedNPCs) ? player.stats.talkedNPCs : []);
        }
        player.stats.talkedNPCs.add(npc.id);
        // Track progress for Social Butterfly achievement
        updateAchievementProgress('action_accumulate', 'talk_all_npcs');
    }

    let dialogueText = `<p>"Greetings, ${player.name}."</p>`;
    let optionsHtml = '';
    let hasSetPrimaryDialogue = false;
    const questActions = [];

    // --- Part 1: Prioritize Quest Dialogue ---
    // First check if any active quests can be completed at this NPC (even if not in their quest list)
    for (const playerQuest of player.quests.active) {
        const quest = questData[playerQuest.id];
        if (!quest) continue;
        
        // Check if this quest can be completed at this NPC
        const completionNpc = quest.completionNpcId || quest.npcId;
        if (completionNpc !== npc.id) continue;
        
        let canComplete = false;
        if (quest.objective.type === 'kill') canComplete = playerQuest.progress >= quest.objective.count;
        else if (quest.objective.type === 'killMultiple') {
            // Check if all targets in the killMultiple quest are complete
            canComplete = quest.objective.targets.every(target => 
                (playerQuest.multiProgress?.[target.monster] || 0) >= target.count
            );
        }
        else if (quest.objective.type === 'collect') canComplete = canCompleteCollectQuest(quest);
        else if (quest.objective.type === 'talk') canComplete = true;
        else if (quest.objective.type === 'useItem') canComplete = playerQuest.progress >= quest.objective.count;
        else if (quest.objective.type === 'tutorial' || quest.objective.type === 'actions') {
            // Check if all required tutorial actions have been completed
            canComplete = player.tutorialActions && quest.objective.actions.every(action => player.tutorialActions[action]);
        }
        
        if (canComplete) {
            questActions.push({ type: 'complete', questId: playerQuest.id, quest, priority: 1 });
        }
    }
    
    // Then check quests in this NPC's quest list
    if (npc.quests && npc.quests.length > 0) {
        for (const questId of npc.quests) {
            const quest = questData[questId];
            if (!quest) continue;

            const playerQuest = player.quests.active.find(q => q.id === questId);
            const isCompleted = player.quests.completed.includes(questId);
            const prerequisiteMet = !quest.prerequisite || player.quests.completed.includes(quest.prerequisite);
            const levelMet = !quest.levelReq || player.level >= quest.levelReq;

            let canComplete = false;
            if (playerQuest) {
                // Check if this quest can be completed at this NPC
                const completionNpc = quest.completionNpcId || quest.npcId;
                if (completionNpc !== npc.id) {
                    // Can't complete at this NPC, skip completion check
                    canComplete = false;
                } else {
                    if (quest.objective.type === 'kill') canComplete = playerQuest.progress >= quest.objective.count;
                    else if (quest.objective.type === 'killMultiple') {
                        // Check if all targets in the killMultiple quest are complete
                        canComplete = quest.objective.targets.every(target => 
                            (playerQuest.multiProgress?.[target.monster] || 0) >= target.count
                        );
                    }
                    else if (quest.objective.type === 'collect') canComplete = canCompleteCollectQuest(quest);
                    else if (quest.objective.type === 'talk') canComplete = true; // Talk quests complete when you talk to the right NPC
                    else if (quest.objective.type === 'tutorial' || quest.objective.type === 'actions') {
                        // Check if all required tutorial actions have been completed
                        canComplete = player.tutorialActions && quest.objective.actions.every(action => player.tutorialActions[action]);
                    }
                }
            }

            if (canComplete && !questActions.find(qa => qa.questId === questId)) {
                questActions.push({ type: 'complete', questId, quest, priority: 1 });
            } else if (!playerQuest && !isCompleted && prerequisiteMet && levelMet) {
                questActions.push({ type: 'accept', questId, quest, priority: 2 });
            } else if (playerQuest && !questActions.find(qa => qa.questId === questId)) {
                questActions.push({ type: 'progress', questId, quest, priority: 3 });
            }
        }
    }

    questActions.sort((a, b) => a.priority - b.priority);

    questActions.forEach(action => {
        if (!hasSetPrimaryDialogue) {
            if (action.type === 'complete') dialogueText = `<p>${action.quest.completeText}</p>`;
            else if (action.type === 'accept') dialogueText = `<p>${action.quest.startText}</p>`;
            else if (action.type === 'progress') dialogueText = `<p>${action.quest.inProgressText}</p>`;
            hasSetPrimaryDialogue = true;
        }
        optionsHtml += `<button id="${action.type}-quest-${action.questId}">${capitalize(action.type)}: ${action.quest.title}</button>`;
    });

    // --- Part 2: Add special interactions, but do not overwrite quest dialogue ---
    if (npc.shop && npc.shop.length > 0) {
        optionsHtml += `<button id="open-shop-${npc.id}">Shop</button>`;
    }

    if (npc.guildInteraction) {
        // --- THIS IS THE FIX ---
        if (!hasSetPrimaryDialogue) {
            if (player.guild && player.guild.name) {
                const guildName = typeof player.guild === 'string' ? player.guild : player.guild.name;
                dialogueText = `<p>"You are a proud member of the ${guildName} guild. Visit the Social Hub to manage your guild!"</p>`;
            } else {
                dialogueText = `<p>"Interested in forming a guild? Open the Social Hub (press O) and visit the Guild tab to create or join one!"</p>`;
            }
        }
        optionsHtml += `<button id="initiate-guild-creation">Open Social Hub</button>`;
    }

    if (npc.appearanceChange) {
        // --- THIS IS THE FIX ---
        if (!hasSetPrimaryDialogue) {
            dialogueText = `<p>"I can help you change your appearance for ${formatGold(10000)} if you decide to keep the changes."</p>`;
        }
        optionsHtml += `<button id="change-appearance">Change Appearance</button>`;
    }

    if (npc.storageInteraction) {
        // --- THIS IS THE FIX ---
        if (!hasSetPrimaryDialogue) {
            const currentSlots = player.inventorySlots || 16;
            const costs = { 16: 10000, 24: 20000, 32: 30000, 40: 40000, 48: 50000, 56: 60000, 64: 70000, 72: 80000, 80: 90000, 88: 100000 };
            const cost = costs[currentSlots];
            if (currentSlots >= 96 || !cost) {
                dialogueText = `<p>"Your bags are as big as they can get! You have the maximum of ${currentSlots} slots."</p>`;
            } else {
                const nextSlots = currentSlots + 8;
                dialogueText = `<p>"I can expand your inventory tabs to ${nextSlots} slots for ${cost.toLocaleString()} gold."</p>`;
            }
        }
        if ((player.inventorySlots || 16) < 96) {
            optionsHtml += `<button id="expand-inventory-btn">Expand Inventory</button>`;
        }
    }

    if (npc.gachaponInteraction) {
        if (!hasSetPrimaryDialogue) {
            const ticket = player.inventory.etc.find(i => i.name === 'Gachapon Ticket');
            const ticketCount = ticket ? ticket.quantity : 0;
            dialogueText = `<p>"Feeling lucky? Try the Gachapon! You have ${ticketCount} ticket(s)."</p>`;
        }
        optionsHtml += `<button id="play-gachapon">Use 1 Ticket</button>`;
    }

    // Mailbox Interaction - Gift System
    if (npc.mailboxInteraction) {
        if (!hasSetPrimaryDialogue) {
            const pendingGifts = player.pendingGifts || [];
            if (pendingGifts.length > 0) {
                dialogueText = `<p>"📬 You have <strong>${pendingGifts.length}</strong> gift(s) waiting! Would you like to collect them?"</p>`;
            } else {
                dialogueText = `<p>"📭 Your mailbox is empty. You can send gifts to your buddies from here!"</p>`;
            }
        }
        optionsHtml += `<button id="check-mailbox">Check Mail (${(player.pendingGifts || []).length})</button>`;
        optionsHtml += `<button id="send-gift-mailbox">Send Gift to Buddy</button>`;
    }

    // Salami Event Shop
    if (npc.salamiEventShop) {
        if (!hasSetPrimaryDialogue) {
            const salamiSticks = player.inventory.etc.find(i => i.name === 'Salami Stick');
            const stickCount = salamiSticks ? salamiSticks.quantity : 0;
            dialogueText = `<p>"Welcome to the Salami Celebration! I'm collecting <strong>Salami Sticks</strong> from brave adventurers like you. All monsters have a chance to drop them! Bring me enough and I'll trade you some amazing prizes!"</p><p>You have <strong>${stickCount}</strong> Salami Stick(s).</p>`;
        }
        optionsHtml += `<button id="trade-salami-weapon">Trade 250 Sticks for Weapon</button>`;
        optionsHtml += `<button id="trade-salami-badge">Trade 500 Sticks for Badge</button>`;
    }

    // Transport to Iron Haven (One-way from Dewdrop Island)
    if (npc.transportToIronHaven) {
        if (!hasSetPrimaryDialogue) {
            // Check if player completed the departure quest
            const hasCompletedIsland = player.quests.completed.includes('defeatKingCrab');
            if (hasCompletedIsland) {
                dialogueText = `<p>"Ready to leave Dewdrop Island? I'll take you to Iron Haven, where greater adventures await! <strong>Warning:</strong> You can never return here once you leave."</p>`;
            } else {
                dialogueText = `<p>"I can take you to Iron Haven, but I recommend completing all the challenges here first. You won't be able to return!"</p>`;
            }
        }
        optionsHtml += `<button id="transport-ironHaven">Travel to Iron Haven</button>`;
    }

    // Job Advancement Trial Retry
    if (npc.jobAdvancementRetry) {
        // Check if player is eligible for job trial (level 30+ and still 1st job class)
        const firstJobClasses = ['warrior', 'magician', 'bowman', 'thief', 'pirate'];
        const canRetryTrial = player.level >= 30 && firstJobClasses.includes(player.class);
        
        if (canRetryTrial) {
            if (!hasSetPrimaryDialogue) {
                dialogueText = `<p>"Ah, ${player.name}. I sense great potential in you. Are you ready to attempt the Job Advancement Trial? You must prove your worth by defeating a powerful Trial Guardian within 5 minutes!"</p>`;
            }
            optionsHtml += `<button id="retry-job-trial">Attempt Job Advancement Trial</button>`;
        }
    }

    // Transport to Dewdrop Island (Return trip)
    if (npc.transportToDewdrop) {
        if (!hasSetPrimaryDialogue) {
            dialogueText = `<p>"Ahoy there! Missing the peaceful shores of Dewdrop Island? I can take you back anytime you'd like. The voyage is free for returning heroes!"</p>`;
        }
        optionsHtml += `<button id="transport-dewdrop">Travel to Dewdrop Island</button>`;
    }

    // Transport to Sky Palace (requires 2nd job advancement)
    if (npc.transportToskyPalace) {
        const secondJobClasses = ['fighter', 'spearman', 'cleric', 'wizard', 'hunter', 'crossbowman', 'assassin', 'bandit', 'brawler', 'gunslinger'];
        const hasJobAdvanced = secondJobClasses.includes(player.class);
        
        if (hasJobAdvanced) {
            if (!hasSetPrimaryDialogue) {
                dialogueText = `<p>"Ahoy, brave ${capitalize(player.class)}! I've heard whispers of a dark fortress across the sea - the Sky Palace. Only those who have proven their worth through Job Advancement may venture there. Are you ready for the challenge?"</p>`;
            }
            optionsHtml += `<button id="transport-sky-palace">Travel to Sky Palace</button>`;
        } else {
            if (!hasSetPrimaryDialogue) {
                dialogueText = `<p>"There's a dangerous place across the sea called Sky Palace... but it's too dangerous for someone at your level. Come back after you've completed your Job Advancement!"</p>`;
            }
        }
    }

    // Transport back from Sky Palace to Iron Haven
    if (npc.transportFromskyPalace) {
        if (!hasSetPrimaryDialogue) {
            dialogueText = `<p>"Ready to head back to Iron Haven? The journey is long but safe. I'll have you there in no time!"</p>`;
        }
        optionsHtml += `<button id="transport-from-sky-palace">Return to Iron Haven</button>`;
    }

    // Party Quest Interaction
    if (npc.partyQuestInteraction) {
        const partyInfo = getPartyInfo();
        const isInParty = partyInfo && partyInfo.members && partyInfo.members.length >= 1;
        const partySize = isInParty ? partyInfo.members.length : 0;
        const minPlayers = npc.pqMinPlayers || 2;
        const maxPlayers = npc.pqMaxPlayers || 4;
        const minLevel = npc.pqMinLevel || 10;
        const maxLevel = npc.pqMaxLevel || 50;
        const meetsLevelReq = player.level >= minLevel && player.level <= maxLevel;
        
        if (!hasSetPrimaryDialogue) {
            dialogueText = `<p>"Greetings, brave adventurer! I am the guardian of the <strong>Kerning Party Quest</strong>."</p>
                <p>Requirements:</p>
                <p>• Party size: ${minPlayers}-${maxPlayers} members</p>
                <p>• Level range: ${minLevel}-${maxLevel}</p>
                <p>• Work together to clear 4 challenging stages and defeat the boss!</p>
                <br>
                <p>Your party: ${partySize > 0 ? partySize + ' member(s)' : 'None'}</p>
                <p>Your level: ${player.level} ${meetsLevelReq ? '✓' : '✗'}</p>`;
            hasSetPrimaryDialogue = true;
        }
        
        if (isInParty && partySize >= minPlayers && meetsLevelReq) {
            optionsHtml += `<button id="enter-party-quest">Enter Party Quest</button>`;
        } else if (!isInParty) {
            optionsHtml += `<button id="enter-party-quest-disabled" disabled style="opacity: 0.5;">Enter Party Quest (Need a party)</button>`;
        } else if (partySize < minPlayers) {
            optionsHtml += `<button id="enter-party-quest-disabled" disabled style="opacity: 0.5;">Enter Party Quest (Need ${minPlayers}+ members)</button>`;
        } else if (!meetsLevelReq) {
            optionsHtml += `<button id="enter-party-quest-disabled" disabled style="opacity: 0.5;">Enter Party Quest (Level ${minLevel}-${maxLevel})</button>`;
        }
    }

    // Party Quest Reward/Exit Interaction
    if (npc.pqRewardInteraction) {
        if (!hasSetPrimaryDialogue) {
            dialogueText = `<p>"🎉 <strong>Congratulations, brave adventurers!</strong> 🎉"</p>
                <p>"You have successfully completed the Kerning Party Quest!"</p>
                <p>"Your teamwork and skill have proven worthy. Take these rewards as a token of your achievement!"</p>
                <br>
                <p>When you're ready, I can transport you back to where your journey began.</p>`;
            hasSetPrimaryDialogue = true;
        }
        optionsHtml += `<button id="claim-pq-rewards">Claim Rewards & Exit</button>`;
    }

    // --- Part 3: Render and add event listeners ---
    optionsHtml += `<button id="close-dialogue">Goodbye</button>`;
    content.innerHTML = dialogueText + optionsHtml;

    setTimeout(() => {
        // Quest button listeners
        questActions.forEach(action => {
            const button = document.getElementById(`${action.type}-quest-${action.questId}`);
            if (button) {
                if (action.type === 'complete') button.addEventListener('click', () => completeQuest(action.questId));
                if (action.type === 'accept') button.addEventListener('click', () => acceptQuest(action.questId));
                if (action.type === 'progress') {
                    button.addEventListener('click', () => {
                        const playerQuest = player.quests.active.find(q => q.id === action.questId);
                        let progressText = '';
                        if (action.quest.objective.type === 'kill') {
                            progressText = `Killed: ${playerQuest.progress} / ${action.quest.objective.count}`;
                        } else if (action.quest.objective.type === 'collect') {
                            const itemCount = player.inventory.etc.find(i => i.name === action.quest.objective.target)?.quantity || 0;
                            progressText = `Collected: ${itemCount} / ${action.quest.objective.count}`;
                        } else if (action.quest.objective.type === 'talk') {
                            // Check if quest must be completed at a different NPC
                            const completionNpc = action.quest.completionNpcId || action.quest.npcId;
                            if (completionNpc !== npc.id) {
                                const completionNpcName = npcData[completionNpc]?.name || 'the quest completer';
                                progressText = `Go talk to ${completionNpcName} to complete`;
                            } else {
                                progressText = 'Return and talk to me again to complete';
                            }
                        } else if (action.quest.objective.type === 'tutorial' || action.quest.objective.type === 'actions') {
                            const actionNames = {
                                moveLeft: 'Move Arrow Keys / D-Pad : Left ←',
                                moveRight: 'Move Arrow Keys / D-Pad : Right →',
                                jump: 'Alt / A / Cross: Jump ↑',
                                attack: 'Ctrl / X / Square: Attack',
                                attackDummy: 'Ctrl / X / Square: Attack The Test Dummy',
                                openInventory: 'I / Right Stick Menu: Open Inventory Window',
                                equipLeatherCap: 'Double Click: Equip Leather Cap',
                                openEquipment: 'E / Right Stick Menu: Open Equipment Window'
                            };
                            const actionList = action.quest.objective.actions.map(a => {
                                const done = player.tutorialActions && player.tutorialActions[a];
                                return `${done ? '✓' : '○'} ${actionNames[a]}`;
                            }).join('<br>');
                            progressText = actionList;
                        }
                        content.innerHTML = `<p>${action.quest.inProgressText}</p><p><strong>Progress:</strong><br>${progressText}</p><button id="close-dialogue">Close</button>`;
                        document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
                    });
                }
            }
        });

        // Other special interaction button listeners
        document.getElementById(`open-shop-${npc.id}`)?.addEventListener('click', () => openShop(npc));
        document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
        document.getElementById('play-gachapon')?.addEventListener('click', () => playGachapon());
        
        // Mailbox interaction buttons
        document.getElementById('check-mailbox')?.addEventListener('click', () => {
            openMailbox();
            toggleWindow(dialogueWindowElement);
        });
        document.getElementById('send-gift-mailbox')?.addEventListener('click', () => {
            openSendGiftWindow();
            toggleWindow(dialogueWindowElement);
        });
        
        // Salami Event Trade buttons
        document.getElementById('trade-salami-weapon')?.addEventListener('click', () => {
            const salamiSticks = player.inventory.etc.find(i => i.name === 'Salami Stick');
            const stickCount = salamiSticks ? salamiSticks.quantity : 0;
            if (stickCount >= 250) {
                // Remove 250 Salami Sticks
                salamiSticks.quantity -= 250;
                if (salamiSticks.quantity === 0) {
                    player.inventory.etc = player.inventory.etc.filter(i => i.name !== 'Salami Stick');
                }
                // Create full item object from itemData
                const itemTemplate = itemData['Thick Salami Stick'];
                const newItem = {
                    name: 'Thick Salami Stick',
                    ...itemTemplate,
                    rarity: itemTemplate.rarity || 'cosmetic',
                    stats: itemTemplate.stats ? { ...itemTemplate.stats } : {}
                };
                addItemToInventory(newItem, 'cosmetic');
                addChatMessage('You received Thick Salami Stick!', 'quest-complete');
                showNotification('Gained Thick Salami Stick', newItem.rarity || 'cosmetic');
                updateInventoryUI();
                updateUI();
                toggleWindow(dialogueWindowElement);
            } else {
                content.innerHTML = `<p>"You don't have enough Salami Sticks! You need 250, but you only have ${stickCount}."</p><button id="close-dialogue">Okay</button>`;
                document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
            }
        });
        
        document.getElementById('trade-salami-badge')?.addEventListener('click', () => {
            const salamiSticks = player.inventory.etc.find(i => i.name === 'Salami Stick');
            const stickCount = salamiSticks ? salamiSticks.quantity : 0;
            if (stickCount >= 500) {
                // Remove 500 Salami Sticks
                salamiSticks.quantity -= 500;
                if (salamiSticks.quantity === 0) {
                    player.inventory.etc = player.inventory.etc.filter(i => i.name !== 'Salami Stick');
                }
                // Create full item object from itemData with stats and rarity
                const itemTemplate = itemData['Salami Slice Badge'];
                const newItem = {
                    name: 'Salami Slice Badge',
                    ...itemTemplate,
                    rarity: 'legendary',
                    stats: { ...itemTemplate.stats }
                };
                addItemToInventory(newItem, 'equip');
                addChatMessage('You received Salami Slice Badge!', 'quest-complete');
                showNotification('Gained Salami Slice Badge', newItem.rarity);
                updateInventoryUI();
                updateUI();
                toggleWindow(dialogueWindowElement);
            } else {
                content.innerHTML = `<p>"You don't have enough Salami Sticks! You need 500, but you only have ${stickCount}."</p><button id="close-dialogue">Okay</button>`;
                document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
            }
        });
        
        document.getElementById('transport-ironHaven')?.addEventListener('click', () => {
            // Transport to Iron Haven with confirmation
            content.innerHTML = `
                <p><strong>⚠ WARNING:</strong> Once you leave Dewdrop Island, you can NEVER return!</p>
                <p>Are you absolutely sure you want to travel to Iron Haven?</p>
                <button id="confirm-transport">Yes, I'm Ready!</button>
                <button id="close-dialogue">Not Yet</button>
            `;
            document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
            document.getElementById('confirm-transport').addEventListener('click', () => {
                toggleWindow(dialogueWindowElement);
                addChatMessage("Farewell, Dewdrop Island!", 'quest-complete');
                fadeAndChangeMap('ironHaven', 150, 300);
                // Add Iron Haven to discovered maps
                if (!player.discoveredMaps.has('ironHaven')) {
                    player.discoveredMaps.add('ironHaven');
                }
                // Mark that player has left Dewdrop Island permanently
                player.hasLeftDewdrop = true;
            });
        });

        document.getElementById('transport-dewdrop')?.addEventListener('click', () => {
            // Transport to Dewdrop Island
            content.innerHTML = `
                <p>"All aboard! We'll set sail for Dewdrop Island right away."</p>
                <button id="confirm-transport-dewdrop">Board the Ship</button>
                <button id="close-dialogue">Not Now</button>
            `;
            document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
            document.getElementById('confirm-transport-dewdrop').addEventListener('click', () => {
                toggleWindow(dialogueWindowElement);
                addChatMessage("Sailing back to Dewdrop Island!", 'quest-complete');
                fadeAndChangeMap('dewdropDocks', 700, 300);
                // Add Dewdrop maps to discovered maps if not already there
                if (!player.discoveredMaps.has('dewdropDocks')) {
                    player.discoveredMaps.add('dewdropDocks');
                }
            });
        });

        document.getElementById('transport-sky-palace')?.addEventListener('click', () => {
            // Transport to Sky Palace
            content.innerHTML = `
                <p>"The Sky Palace is a dangerous place filled with dark creatures. Are you ready to face the shadows?"</p>
                <button id="confirm-transport-sky-palace">Set Sail for Sky Palace</button>
                <button id="close-dialogue">Not Yet</button>
            `;
            document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
            document.getElementById('confirm-transport-sky-palace').addEventListener('click', () => {
                toggleWindow(dialogueWindowElement);
                addChatMessage("Setting sail for Sky Palace!", 'quest-complete');
                fadeAndChangeMap('skypalaceStation', 150, 300);
                // Add Sky Palace Station to discovered maps
                if (!player.discoveredMaps.has('skypalaceStation')) {
                    player.discoveredMaps.add('skypalaceStation');
                }
            });
        });

        document.getElementById('transport-from-sky-palace')?.addEventListener('click', () => {
            // Transport back to Iron Haven from Sky Palace
            content.innerHTML = `
                <p>"Ready to leave this dark place? I'll take you safely back to Iron Haven."</p>
                <button id="confirm-return-ironHaven">Return to Iron Haven</button>
                <button id="close-dialogue">Not Yet</button>
            `;
            document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
            document.getElementById('confirm-return-ironHaven').addEventListener('click', () => {
                toggleWindow(dialogueWindowElement);
                addChatMessage("Sailing back to Iron Haven!", 'quest-complete');
                fadeAndChangeMap('ironHaven', 1850, 300);
                // Make sure Iron Haven is discovered
                if (!player.discoveredMaps.has('ironHaven')) {
                    player.discoveredMaps.add('ironHaven');
                }
            });
        });
        
        // Job Advancement Trial Retry listener
        document.getElementById('retry-job-trial')?.addEventListener('click', () => {
            toggleWindow(dialogueWindowElement);
            openJobAdvancementWindow(30);
        });
        
        // Party Quest Entry listener
        document.getElementById('enter-party-quest')?.addEventListener('click', () => {
            const partyInfo = getPartyInfo();
            if (!partyInfo || partyInfo.members.length < 2) {
                content.innerHTML = `<p>"You need at least 2 party members to enter the Party Quest!"</p><button id="close-dialogue">Okay</button>`;
                document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
                return;
            }
            
            // Check if player is party leader
            if (partyInfo.leader !== player.name) {
                content.innerHTML = `<p>"Only the party leader can initiate the Party Quest. Ask <strong>${partyInfo.leader}</strong> to start it!"</p><button id="close-dialogue">Okay</button>`;
                document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
                return;
            }
            
            // Show intro popup explaining the party quest
            content.innerHTML = `
                <p><strong>🎮 Kerning Party Quest 🎮</strong></p>
                <p style="margin: 10px 0;"><em>"Welcome, brave adventurers! This ancient dungeon awaits your party..."</em></p>
                <hr style="margin: 10px 0; border-color: #444;">
                <p><strong>Stages:</strong></p>
                <p>📍 <strong>Stage 1:</strong> Defeat 15 Zombies</p>
                <p>📍 <strong>Stage 2:</strong> Defeat 20 Phantoms</p>
                <p>📍 <strong>Stage 3:</strong> Defeat Jr. Wraiths & Zombies</p>
                <p>📍 <strong>Stage 4:</strong> Defeat Phantoms & Jr. Wraiths</p>
                <p>👑 <strong>Boss:</strong> King Slime!</p>
                <hr style="margin: 10px 0; border-color: #444;">
                <p><strong>Rules:</strong></p>
                <p>• Clear all monsters in each stage to unlock the next portal</p>
                <p>• Work together - you have 10 seconds between stages!</p>
                <p>• Defeat the boss to claim your rewards!</p>
                <br>
                <p>Party of ${partyInfo.members.length} ready?</p>
                <button id="confirm-pq-entry">Begin Party Quest!</button>
                <button id="close-dialogue">Not Yet</button>
            `;
            document.getElementById('close-dialogue').addEventListener('click', () => toggleWindow(dialogueWindowElement));
            document.getElementById('confirm-pq-entry').addEventListener('click', () => {
                console.log('[PQ] Begin Party Quest button clicked!');
                toggleWindow(dialogueWindowElement);
                
                // Store original map for all party members before entering
                player.pqOriginalMap = currentMapId;
                player.pqOriginalX = player.x;
                player.pqOriginalY = player.y;
                
                // Get socket using the getter function
                const socket = window.getSocket ? window.getSocket() : null;
                console.log('[PQ] Socket status:', socket ? 'exists' : 'null', 'connected:', socket?.connected);
                console.log('[PQ] partyInfo:', partyInfo);
                console.log('[PQ] leaderId:', player.odId);
                
                // Emit socket event to start party quest for all members
                // All members (including leader) will warp via the socket handler
                if (socket && socket.connected) {
                    console.log('[PQ] Emitting startPartyQuest event...');
                    socket.emit('startPartyQuest', {
                        pqId: 'kerningPQ',
                        partyId: partyInfo.id,
                        leaderId: player.odId,
                        originalMap: currentMapId,
                        originalX: player.x,
                        originalY: player.y
                    });
                    addChatMessage('Starting Party Quest...', 'system');
                } else {
                    // Socket not connected - show error, don't allow PQ without server
                    console.error('[PQ] Cannot start PQ - not connected to server!');
                    addChatMessage('Error: Not connected to server! Cannot start Party Quest.', 'error');
                }
            });
        });
        
        // Party Quest Reward/Exit listener
        document.getElementById('claim-pq-rewards')?.addEventListener('click', () => {
            toggleWindow(dialogueWindowElement);
            
            // Give rewards
            const expReward = 5000 * player.level;
            const goldReward = 10000 + (Math.random() * 5000 | 0);
            
            if (typeof gainExperience === 'function') {
                gainExperience(expReward);
            }
            player.gold = (player.gold || 0) + goldReward;
            
            // Show reward notifications
            if (typeof showNotification === 'function') {
                showNotification(`Gained ${expReward.toLocaleString()} EXP!`, 'epic');
                setTimeout(() => showNotification(`Gained ${goldReward.toLocaleString()} Gold!`, 'epic'), 500);
            }
            if (typeof addChatMessage === 'function') {
                addChatMessage(`🎁 Party Quest Rewards: ${expReward.toLocaleString()} EXP, ${goldReward.toLocaleString()} Gold!`, 'quest-complete');
            }
            
            // Update achievement if exists
            if (typeof updateAchievementProgress === 'function') {
                updateAchievementProgress('action', 'complete_party_quest');
            }
            
            // Clear PQ stage progress
            if (typeof window !== 'undefined') {
                window.pqClearedStages = {};
            }
            
            // Update UI
            if (typeof updateUI === 'function') {
                updateUI();
            }
            
            // Warp back to original map
            const originalMap = player.pqOriginalMap || 'onyxCity';
            const originalX = player.pqOriginalX || 600;
            const originalY = player.pqOriginalY || 300;
            
            // Clear saved original map
            delete player.pqOriginalMap;
            delete player.pqOriginalX;
            delete player.pqOriginalY;
            
            setTimeout(() => {
                if (typeof addChatMessage === 'function') {
                    addChatMessage('🚀 Returning to ' + (maps[originalMap]?.name || originalMap) + '...', 'system');
                }
                if (typeof fadeAndChangeMap === 'function') {
                    fadeAndChangeMap(originalMap, originalX, originalY);
                } else if (typeof changeMap === 'function') {
                    changeMap(originalMap, originalX, originalY);
                }
            }, 1500);
        });
        
        document.getElementById('expand-inventory-btn')?.addEventListener('click', () => {
            const currentSlots = player.inventorySlots || 16;
            const costs = { 16: 10000, 24: 20000, 32: 30000, 40: 40000, 48: 50000, 56: 60000, 64: 70000, 72: 80000, 80: 90000, 88: 100000 };
            const cost = costs[currentSlots];
            const nextSlots = currentSlots + 8;
            
            // Check if expansion is possible
            if (!cost || currentSlots >= 96) {
                content.innerHTML = `<p>"Your bags are already at maximum capacity!"</p>`;
                return;
            }
            
            // Show confirmation dialog
            content.innerHTML = `
                <p>"Expanding your inventory from <span style="color: #4CAF50;">${currentSlots} slots</span> to <span style="color: #4CAF50;">${nextSlots} slots</span> will cost ${formatGold(cost)}."</p>
                <p style="margin-top: 10px;">Your gold: <span style="color: ${player.gold >= cost ? '#4CAF50' : '#f44336'};">${formatGold(player.gold)}</span></p>
                <div style="margin-top: 15px;">
                    <button id="confirm-expand">Expand Inventory</button>
                    <button id="cancel-expand">Cancel</button>
                </div>
            `;
            
            document.getElementById('confirm-expand')?.addEventListener('click', () => {
                if (expandInventory()) {
                    // After success, re-open the dialogue to show the next upgrade cost
                    openDialogue(npc);
                } else {
                    // If it failed (not enough gold), just refresh the dialogue
                    openDialogue(npc);
                }
            });
            
            document.getElementById('cancel-expand')?.addEventListener('click', () => {
                // Go back to the main dialogue
                openDialogue(npc);
            });
        });
        document.getElementById('change-appearance')?.addEventListener('click', () => {
            toggleWindow(dialogueWindowElement);
            openAppearanceCustomization();
        });
        document.getElementById('initiate-guild-creation')?.addEventListener('click', () => {
            // Open Social Hub and switch to Guild tab
            toggleWindow(dialogueWindowElement);
            if (socialHubWindow) {
                socialHubWindow.style.display = 'block';
                switchSocialTab('guild');
            }
        });

    }, 0);

    toggleWindow(dialogueWindowElement);
}

function openShop(npc) {
    toggleWindow(dialogueWindowElement);
    const shopTitle = document.getElementById('shop-title');
    const shopContent = shopWindowElement.querySelector('.window-content');

    shopTitle.textContent = `${npc.name}'s Shop`;

    shopContent.innerHTML = `
                    <div class="shop-tabs">
                        <button class="tab-button active" data-tab="buy">Buy</button>
                        <button class="tab-button" data-tab="sell">Sell</button>
                    </div>
                    <div id="shop-buy-content" class="tab-content active" style="max-height: 250px; overflow-y: auto; padding-right: 5px;"></div>
                    <div id="shop-sell-content" class="tab-content" style="max-height: 250px; overflow-y: auto; padding-right: 5px;"></div>
                    <br>
                    <button id="close-shop">Close</button>
                `;

    const buyTab = shopContent.querySelector('[data-tab="buy"]');
    const sellTab = shopContent.querySelector('[data-tab="sell"]');
    const buyContent = document.getElementById('shop-buy-content');
    const sellContent = document.getElementById('shop-sell-content');

    buyTab.addEventListener('click', () => {
        buyTab.classList.add('active');
        sellTab.classList.remove('active');
        buyContent.classList.add('active');
        sellContent.classList.remove('active');
    });

    sellTab.addEventListener('click', () => {
        sellTab.classList.add('active');
        buyTab.classList.remove('active');
        sellContent.classList.add('active');
        buyContent.classList.remove('active');
        populateShopSellTab();
    });

    npc.shop.forEach(itemName => {
        const itemInfo = itemData[itemName];
        if (!itemInfo) return;
        const shopItemEl = document.createElement('div');
        shopItemEl.className = 'shop-item';

        const itemObject = { name: itemName, ...itemInfo };
        const iconData = spriteData.dropIcons.icons[itemName];
        let iconHTML = '';
        if (iconData) {
            // --- THIS IS THE FIX ---
            // Replaced the old rendering method with the robust transform: scale() method.
            const frameWidth = spriteData.dropIcons.frameWidth;
            const scale = 3;
            iconHTML = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameWidth}px; flex-shrink: 0; background-image: url(${artAssets.dropIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center;"></div>`;
            // --- END OF FIX ---
        }

        shopItemEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex-grow: 1;">
                ${iconHTML}
                <span>${itemName} - ${formatGold(itemInfo.cost)}</span>
            </div>
            <button>Buy</button>`;

        const tooltipContent = buildTooltipHtml(itemObject);
        addTooltipEvents(shopItemEl, tooltipContent); // Attach to the whole item element for better UX

        buyContent.appendChild(shopItemEl);
        shopItemEl.querySelector('button').addEventListener('click', () => buyItem(itemName));
    });

    sellContent.addEventListener('click', function (e) {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.name) {
            const itemName = e.target.dataset.name;
            const itemTab = e.target.dataset.tab;
            const itemIndex = player.inventory[itemTab].findIndex(i => i.name === itemName);

            if (itemIndex > -1) {
                const item = player.inventory[itemTab][itemIndex];
                const itemInfo = itemData[item.name];
                let goldValue = Math.floor((itemInfo.cost / 4) * (1 + (item.enhancement || 0) * 0.1)) || 5;
                player.gold += goldValue;
                player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + goldValue;
                updateAchievementProgress('action_accumulate', 'gold_earned');

                if (item.quantity > 1) {
                    item.quantity--;
                } else {
                    player.inventory[itemTab].splice(itemIndex, 1);
                }

                addChatMessage(`Sold ${item.name} for ${goldValue} Gold`, 'exp');
                updateInventoryUI();
                updateShopUI();
                updateUI();
                populateShopSellTab();

                if (statWindowElement && statWindowElement.style.display !== 'none') {
                    updateStatWindowUI();
                }
            }
        }
    });

    document.getElementById('close-shop').addEventListener('click', () => toggleWindow(shopWindowElement));
    toggleWindow(shopWindowElement);
}


function populateShopSellTab() {
    const sellContent = document.getElementById('shop-sell-content');
    sellContent.innerHTML = '';

    const allItems = [
        ...player.inventory.equip.map(item => ({ ...item, tab: 'equip' })),
        ...player.inventory.use.map(item => ({ ...item, tab: 'use' })),
        ...player.inventory.etc.map(item => ({ ...item, tab: 'etc' })),
        ...player.inventory.cosmetic.map(item => ({ ...item, tab: 'cosmetic' }))
    ];

    if (allItems.length === 0) {
        sellContent.innerHTML = '<p>Your inventory is empty.</p>';
        return;
    }

    allItems.forEach((item, index) => {
        const itemInfo = itemData[item.name];
        if (!itemInfo || itemInfo.cost === undefined || itemInfo.cost === 0) return;

        const sellValue = Math.floor((itemInfo.cost / 4) * (1 + (item.enhancement || 0) * 0.1)) || 5;

        const sellItemEl = document.createElement('div');
        sellItemEl.className = 'shop-item';
        const enhancementText = item.enhancement > 0 ? ` +${item.enhancement}` : '';
        const rarity = item.rarity || (item.isQuestItem ? 'quest' : (itemInfo.category === 'Cosmetic' ? 'cosmetic' : 'common'));

        const iconData = spriteData.dropIcons.icons[item.name];
        let iconHTML = '';
        if (iconData) {
            // --- THIS IS THE FIX ---
            // Replaced the old rendering method with the robust transform: scale() method.
            const frameWidth = spriteData.dropIcons.frameWidth;
            const scale = 3;

            let filterStyle = '';
            if (item.name === 'Rusty Iron Sword') {
                filterStyle = 'filter: brightness(0.6) sepia(0.3) hue-rotate(15deg);';
            } else if (item.name === 'Dull Sword') {
                filterStyle = 'filter: brightness(0.8) saturate(0.5);';
            }

            iconHTML = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameWidth}px; flex-shrink: 0; background-image: url(${artAssets.dropIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center; ${filterStyle}"></div>`;
            // --- END OF FIX ---
        }

        sellItemEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex-grow: 1;">
                 ${iconHTML}
                <div class="sell-item-details" style="display: flex; justify-content: space-between; flex-grow: 1; align-items: center;">
                    <span class="item-name ${rarity}">${item.name}${enhancementText} ${item.quantity > 1 ? `(x${item.quantity})` : ''}</span>
                    <span>${formatGold(sellValue)}</span>
                </div>
            </div>
            <button data-name="${item.name}" data-tab="${item.tab}">Sell</button>
        `;

        const tooltipContent = buildTooltipHtml(item);
        addTooltipEvents(sellItemEl, tooltipContent); // Attach to the whole item element for better UX

        sellContent.appendChild(sellItemEl);
    });
}

function sellItemFromShop(item, index) { // The signature of this function is no longer correct, we'll find the item manually.
    // This function is now triggered by a button click with data attributes, not an index.
}

function updateShopUI() {
    // Refresh the sell tab content if the shop is open
    if (shopWindowElement && shopWindowElement.style.display !== 'none') {
        const sellTab = document.querySelector('#shop-window .tab-button[data-tab="sell"]');
        if (sellTab && sellTab.classList.contains('active')) {
            populateShopSellTab();
        }
    }
}

function buyItem(itemName) {
    const itemInfo = itemData[itemName];
    if (!itemInfo) return;

    // Check if item is Use or Etc category - these can be bought in bulk
    if (itemInfo.category === 'Use' || itemInfo.category === 'Etc') {
        showQuantityPurchaseDialog(itemName, itemInfo);
    } else {
        // Equipment and cosmetics - single purchase only
        if (player.gold >= itemInfo.cost) {
            const newItem = {
                name: itemName,
                stats: itemInfo.stats ? { ...itemInfo.stats } : {},
                levelReq: itemInfo.levelReq,
                rarity: itemInfo.isQuestItem ? 'quest' : (itemInfo.category === 'Cosmetic' ? 'cosmetic' : 'common'),
                enhancement: 0,
                quantity: 1,
                isQuestItem: itemInfo.isQuestItem || false
            };

            if (addItemToInventory(newItem)) {
                player.gold -= itemInfo.cost;
                player.stats.goldSpent += itemInfo.cost;
                updateAchievementProgress('action_accumulate', 'gold_spent');
                addChatMessage(`Purchased ${itemName}`, 'common');
                
                // Show notification for gained item
                const rarity = newItem.rarity || 'common';
                const quantity = newItem.quantity || 1;
                const displayText = quantity > 1 ? `Gained ${quantity}x ${itemName}` : `Gained ${itemName}`;
                showNotification(displayText, rarity);
                
                updateInventoryUI();
                updateShopUI(); // Update shop UI to refresh gold display
                updateUI();

                // Update stat window in real-time if open (gold/inventory changes)
                if (statWindowElement && statWindowElement.style.display !== 'none') {
                    updateStatWindowUI();
                }
            }
        } else {
            addChatMessage("Not enough gold!", 'error');
        }
    }
}

function showQuantityPurchaseDialog(itemName, itemInfo) {
    // Check if dialog is already open
    if (document.getElementById('quantity-purchase-dialog')) {
        return;
    }

    const maxQuantity = Math.floor(player.gold / itemInfo.cost);
    if (maxQuantity === 0) {
        addChatMessage("Not enough gold!", 'error');
        return;
    }

    let currentQuantity = 1;

    // Create dialog with proper window styling (matching shop/dialogue windows)
    const dialog = document.createElement('div');
    dialog.id = 'quantity-purchase-dialog';
    dialog.className = 'window';
    dialog.style.display = 'block';
    dialog.style.width = '350px';
    dialog.style.top = '150px';
    dialog.style.left = '250px';
    dialog.style.transform = 'none';

    // Build initial HTML structure
    dialog.innerHTML = `
        <h2 class="window-title">
            <span>Purchase ${itemName}</span>
            <button class="close-btn" id="close-quantity-dialog">×</button>
        </h2>
        <div class="window-content" style="padding: 15px;">
            <p style="margin: 0 0 15px 0; color: var(--text-color); font-family: 'Ari9500'; font-size: var(--font-standard);">
                Price per item: <span style="color: var(--exp-color);">${formatGold(itemInfo.cost)}</span>
            </p>
            <div style="display: flex; align-items: center; gap: 8px; margin: 15px 0; justify-content: center;">
                <button id="decrease-qty" class="window-content-button" style="width: 35px; height: 35px; padding: 0;">-</button>
                <input type="number" id="quantity-input" value="1" min="1" max="${maxQuantity}" 
                    style="width: 100px; text-align: center; font-size: var(--font-standard); font-family: 'Ari9500'; padding: 8px; background: var(--ui-bg); color: var(--text-color); border: 2px solid var(--ui-border); border-radius: 3px;">
                <button id="increase-qty" class="window-content-button" style="width: 35px; height: 35px; padding: 0;">+</button>
                <button id="max-qty" class="window-content-button" style="padding: 8px 12px;">Max</button>
            </div>
            <div style="margin: 15px 0; padding: 12px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; border: 1px solid var(--ui-border);">
                <p style="margin: 5px 0; color: var(--text-color); font-family: 'Ari9500'; font-size: var(--font-standard);">
                    Total Cost: <span id="total-cost-display" style="font-weight: bold;"></span>
                </p>
                <p style="margin: 5px 0; color: var(--text-color); font-family: 'Ari9500'; font-size: var(--font-standard);">
                    Your Gold: <span style="color: var(--exp-color);">${formatGold(player.gold)}</span>
                </p>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px;">
                <button id="cancel-purchase" class="window-content-button">Cancel</button>
                <button id="confirm-purchase" class="window-content-button" style="background-color: var(--exp-color); border-color: var(--exp-color);">Purchase</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Make window draggable
    const header = dialog.querySelector('.window-title');
    makeWindowDraggable(dialog, header);

    // Get references to dynamic elements
    const input = dialog.querySelector('#quantity-input');
    const totalCostDisplay = dialog.querySelector('#total-cost-display');
    const confirmBtn = dialog.querySelector('#confirm-purchase');
    const decreaseBtn = dialog.querySelector('#decrease-qty');
    const increaseBtn = dialog.querySelector('#increase-qty');
    const maxBtn = dialog.querySelector('#max-qty');
    const cancelBtn = dialog.querySelector('#cancel-purchase');
    const closeBtn = dialog.querySelector('#close-quantity-dialog');

    // Update only the dynamic parts (cost and button state)
    const updateCostDisplay = () => {
        const totalCost = currentQuantity * itemInfo.cost;
        const canAfford = totalCost <= player.gold;
        
        totalCostDisplay.innerHTML = formatGold(totalCost);
        totalCostDisplay.style.color = canAfford ? 'var(--exp-color)' : 'var(--fail-color)';
        
        if (!canAfford || currentQuantity === 0) {
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            confirmBtn.style.cursor = 'not-allowed';
        } else {
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
        }
    };

    // Initial update
    updateCostDisplay();

    // Event listeners
    input.addEventListener('input', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        let value = parseInt(e.target.value) || 0;
        value = Math.max(1, Math.min(maxQuantity, value));
        currentQuantity = value;
        input.value = value;
        updateCostDisplay();
    });

    input.addEventListener('focus', (e) => {
        e.stopPropagation();
    });

    input.addEventListener('keydown', (e) => {
        e.stopPropagation(); // Prevent hotkeys from interfering
        if (e.key === 'Enter') {
            if (!confirmBtn.disabled) {
                confirmBtn.click();
            }
        } else if (e.key === 'Escape') {
            closeDialog();
        }
    });

    decreaseBtn.addEventListener('click', () => {
        if (currentQuantity > 1) {
            currentQuantity--;
            input.value = currentQuantity;
            updateCostDisplay();
        }
    });

    increaseBtn.addEventListener('click', () => {
        if (currentQuantity < maxQuantity) {
            currentQuantity++;
            input.value = currentQuantity;
            updateCostDisplay();
        }
    });

    maxBtn.addEventListener('click', () => {
        currentQuantity = maxQuantity;
        input.value = currentQuantity;
        updateCostDisplay();
    });

    const closeDialog = () => {
        document.body.removeChild(dialog);
    };

    cancelBtn.addEventListener('click', closeDialog);
    closeBtn.addEventListener('click', closeDialog);

    confirmBtn.addEventListener('click', () => {
        if (confirmBtn.disabled) return;
        
        const totalCost = currentQuantity * itemInfo.cost;
        const newItem = {
            name: itemName,
            stats: itemInfo.stats ? { ...itemInfo.stats } : {},
            levelReq: itemInfo.levelReq,
            rarity: itemInfo.isQuestItem ? 'quest' : (itemInfo.category === 'Cosmetic' ? 'cosmetic' : 'common'),
            enhancement: 0,
            quantity: currentQuantity,
            isQuestItem: itemInfo.isQuestItem || false
        };

        if (addItemToInventory(newItem)) {
            player.gold -= totalCost;
            player.stats.goldSpent += totalCost;
            updateAchievementProgress('action_accumulate', 'gold_spent');
            addChatMessage(`Purchased ${currentQuantity}x ${itemName} for ${totalCost.toLocaleString()}g`, 'common');
            
            const rarity = newItem.rarity || 'common';
            const displayText = currentQuantity > 1 ? `Gained ${currentQuantity}x ${itemName}` : `Gained ${itemName}`;
            showNotification(displayText, rarity);
            
            updateInventoryUI();
            updateShopUI();
            updateUI();

            if (statWindowElement && statWindowElement.style.display !== 'none') {
                updateStatWindowUI();
            }

            closeDialog();
        } else {
            addChatMessage("Inventory full!", 'error');
        }
    });

    // Auto-focus the input
    setTimeout(() => input.focus(), 100);
}

function updateEnhancementWindow() {
    // Only update if the enhancement modal is open
    if (!enhancementConfirmModal || enhancementConfirmModal.style.display === 'none') {
        return;
    }

    if (!enhancementTarget) {
        // Close the window if there's no target
        if (enhancementConfirmModal.style.display !== 'none') {
            toggleWindow(enhancementConfirmModal);
        }
        return;
    }

    let item;
    if (enhancementTarget.source === 'inventory') {
        item = player.inventory[enhancementTarget.tab]?.[enhancementTarget.index];
    } else if (enhancementTarget.source === 'equipment') {
        item = player.equipped[enhancementTarget.slot];
    }

    const enhancementInfoContainer = document.getElementById('enhancement-info');
    const confirmButtons = document.getElementById('enhancement-confirm-buttons');

    if (!item && itemWasDestroyed) {
        enhancementInfoContainer.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <h4 style="color: var(--fail-color); margin: 0;">ITEM DESTROYED!</h4>
                <p style="margin: 10px 0; color: var(--fail-color);">Your enhancement attempt failed and the item was destroyed.</p>
            </div>
        `;
        if (confirmButtons) confirmButtons.style.display = 'none';
        // Add a temporary close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'window-content-button';
        closeBtn.textContent = 'Close';
        closeBtn.style.backgroundColor = 'var(--fail-color)';
        closeBtn.onclick = () => toggleWindow(enhancementConfirmModal);
        enhancementInfoContainer.appendChild(closeBtn);
        return;
    }

    if (!item) {
        toggleWindow(enhancementConfirmModal);
        return;
    }

    // Restore confirm buttons if they were hidden
    if (confirmButtons) confirmButtons.style.display = 'flex';

    const currentLevel = item.enhancement || 0;
    const cost = 100 * (currentLevel + 1) * (currentLevel + 1);

    const successRates = [0.95, 0.90, 0.85, 0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.10];
    const destroyRates = [0, 0, 0, 0, 0.01, 0.02, 0.03, 0.05, 0.08, 0.1];
    const successChance = successRates[Math.min(currentLevel, successRates.length - 1)];
    const destroyChance = destroyRates[Math.min(currentLevel, destroyRates.length - 1)];

    const canAfford = player.gold >= cost;
    const scroll = player.inventory.etc.find(i => i.name === 'Enhancement Scroll');
    const hasScroll = scroll && scroll.quantity > 0;

    const costColor = canAfford ? 'white' : 'red';
    const scrollStatus = hasScroll ? '' : ' <p style="color: red;">(No Enhancement Scroll!)</p>';

    let itemIconHtml = '';
    const iconData = spriteData.dropIcons?.icons?.[item.name];
    if (iconData) {
        const frameWidth = spriteData.dropIcons.frameWidth;
        itemIconHtml = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.dropIcons}); background-position: -${iconData.x}px -${iconData.y}px;"></div>`;
    }

    const baseStats = item.stats || {};
    const enhancedStats = calculateEnhancedStats(item);
    const nextEnhancedStats = calculateEnhancedStats({ ...item, enhancement: currentLevel + 1 });

    let statsHtml = '';
    const allStatKeys = new Set([...Object.keys(baseStats), ...Object.keys(enhancedStats), ...Object.keys(nextEnhancedStats)]);

    allStatKeys.forEach(stat => {
        const currentValue = enhancedStats[stat] || 0;
        const nextValue = nextEnhancedStats[stat] || 0;
        const diff = nextValue - currentValue;

        if (currentValue !== 0 || nextValue !== 0) {
            statsHtml += `<p>${stat.toUpperCase()}: ${currentValue} → ${nextValue} ${diff > 0 ? `<span style="color: var(--success-color);">(+${diff})</span>` : ''}</p>`;
        }
    });

    const rarity = item.rarity || (item.isQuestItem ? 'quest' : 'common');

    enhancementInfoContainer.innerHTML = `
        <div class="enhancement-layout">
            <div class="enhancement-item-display">
                <div id="enhancement-item-slot" class="equip-slot ${rarity}">
                    ${itemIconHtml}
                </div>
            </div>
            <div class="enhancement-stats-display">
                <h4 class="${rarity}" style="margin: 0 0 5px 0;">${item.name} +${currentLevel}</h4>
                <p style="margin-bottom: 15px;">Cost: <span style="color: ${costColor};">${formatGold(cost)}</span></p>
                <h5 style="margin: 0 0 5px 0; color: var(--common-color);">Stat Changes:</h5>
                ${statsHtml || '<p>No stat changes.</p>'}
            </div>
        </div>
        <div class="enhancement-chances">
            <p>Success: <span class="chance-success">${(successChance * 100).toFixed(0)}%</span></p>
            <p>Destroy on Fail: <span class="chance-destroy">${(destroyChance * 100).toFixed(0)}%</span></p>
            ${scrollStatus}
        </div>
    `;

    const enhanceButton = document.getElementById('confirm-enhance-btn');
    if (enhanceButton) {
        enhanceButton.disabled = !canAfford || !hasScroll;
        enhanceButton.style.opacity = (canAfford && hasScroll) ? '1' : '0.5';
    }
}

function openEnhancementConfirmation(target) {
    let item;
    // Determine the item based on the source
    if (target.source === 'inventory') {
        item = player.inventory[target.tab]?.[target.index];
    } else if (target.source === 'equipment') {
        item = player.equipped[target.slot];
    }

    if (!item || itemData[item.name]?.canEnhance === false) {
        showNotification("This item cannot be enhanced.", 'error');
        return;
    }

    const scroll = player.inventory.etc.find(i => i.name === 'Enhancement Scroll');
    if (!scroll) {
        showNotification("You need an 'Enhancement Scroll'!", 'error');
        return;
    }

    const currentLevel = item.enhancement || 0;
    const cost = 100 * (currentLevel + 1) * (currentLevel + 1);
    if (player.gold < cost) {
        showNotification("Not enough gold to enhance!", 'error');
        return;
    }

    enhancementTarget = target; // Store the target for the performEnhancement function
    itemWasDestroyed = false; // Reset the destroyed flag for new enhancement attempts
    updateAchievementProgress('action', 'enhance');
    toggleWindow(enhancementConfirmModal);

    // Update the window with current enhancement info
    updateEnhancementWindow();
}

// Global variable to track active job trial
let activeJobTrial = null;
let jobTrialTimerInterval = null;

function openJobAdvancementWindow(level) {
    const advWindow = document.getElementById('job-advancement-window');
    const titleEl = document.getElementById('job-adv-title');
    const contentEl = document.getElementById('job-adv-content');

    const advData = jobAdvancementData[level];
    if (!advData) return;

    // --- RESPONSIVE STYLING FIX ---
    // Apply dynamic styles to ensure the window always fits on screen.
    Object.assign(advWindow.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '1100px',      // Let content determine width
        maxWidth: '90vw',   // Never wider than 90% of the viewport
        height: 'auto',     // Let content determine height
        maxHeight: '85vh',  // Never taller than 85% of the viewport
        overflow: 'hidden', // The window itself should not scroll
        flexDirection: 'column' // Stack title and content vertically
    });

    // Make the content area scrollable if it overflows
    Object.assign(contentEl.style, {
        overflowY: 'auto',
        padding: '15px',
        flexShrink: '1' // Allows the content area to shrink
    });
    // --- END OF FIX ---

    // Hide the close button to force a selection
    const closeBtn = advWindow.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.style.display = 'none';
    }

    titleEl.textContent = advData.title;

    let optionsHtml = `<p style="text-align: center; margin-bottom: 20px; font-size: var(--font-small);; color: var(--exp-color);">${advData.description}</p>
                       <div class="job-options-container" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 15px;">`;

    let choices = (level === 10) ? advData.choices : (advData.choices[player.class] || []);

    choices.forEach(option => {
        const classIconData = spriteData.classIcons?.icons[capitalize(option.name)];
        let iconHtml = '';
        if (classIconData) {
            const frameWidth = spriteData.classIcons.frameWidth;
            const scale = 3;
            iconHtml = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.classIcons}); background-position: -${classIconData.x}px -${classIconData.y}px; transform: scale(${scale}); transform-origin: center;"></div>`;
        } else {
            iconHtml = getClassIcon(option.name);
        }

        const buttonText = level === 30 ? 'Begin Trial' : 'Select';

        optionsHtml += `
            <div class="job-option" style="flex: 1 1 180px; max-width: 200px;">
                <div class="job-info">
                    <div class="job-icon-container">
                        ${iconHtml}
                    </div>
                    <h3 class="job-class-name">${capitalize(option.name)}</h3>
                </div>
                <p class="job-description">${option.description}</p>
                <div class="job-action">
                    <button class="window-content-button job-select-btn" data-class="${option.name}" data-trial-map="${option.trialMap || ''}">${buttonText}</button>
                </div>
            </div>
        `;
    });

    optionsHtml += '</div>';

    // Add warning for level 30 trials
    if (level === 30) {
        optionsHtml += `<p style="margin-top: 20px; color: var(--legendary-color); text-align: center; font-weight: bold;">⚠️ Warning: You will be teleported to a trial arena! Defeat the Trial Guardian within 5 minutes to advance!</p>`;
        optionsHtml += `<button id="close-adv-btn" class="window-content-button" style="margin-top: 10px;">Cancel</button>`;
    }

    contentEl.innerHTML = optionsHtml;

    if (level === 10) {
        contentEl.querySelectorAll('.job-select-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const newClass = e.target.dataset.class;
                const startingWeaponMap = {
                    'warrior': 'Iron Sword', 'magician': 'Sapphire Staff',
                    'bowman': 'Wooden Bow', 'thief': 'Iron Dagger', 'pirate': 'Iron Pistol'
                };
                const weaponName = startingWeaponMap[newClass];
                if (weaponName) {
                    const weaponInfo = itemData[weaponName];
                    if (weaponInfo) {
                        const newItem = {
                            name: weaponName, stats: { ...weaponInfo.stats },
                            levelReq: weaponInfo.levelReq || 1, rarity: 'common', enhancement: 0
                        };
                        if (addItemToInventory(newItem)) {
                            addChatMessage(`You received a ${weaponName}!`, 'rare');
                        }
                    }
                }
                
                // Calculate total stat points invested (subtract the player's rolled base stats)
                const investedStats = 
                    (player.stats.str - player.baseStats.str) +
                    (player.stats.dex - player.baseStats.dex) +
                    (player.stats.int - player.baseStats.int) +
                    (player.stats.luk - player.baseStats.luk);
                
                // Reset stats to the player's rolled base values
                player.stats.str = player.baseStats.str;
                player.stats.dex = player.baseStats.dex;
                player.stats.int = player.baseStats.int;
                player.stats.luk = player.baseStats.luk;
                
                // Give back all invested stat points as AP
                player.ap = investedStats;
                
                player.class = newClass;
                player.sp += 1;
                playSound('jobAdvance');
                addChatMessage(`You are now a ${capitalize(newClass)}!`, 'quest-complete');
                
                // Send global announcement for job advancement
                if (typeof sendAnnouncement === 'function') {
                    sendAnnouncement('job_advancement', { newClass: newClass });
                }
                
                updateUI();
                updateSkillHotbarUI();
                updateInventoryUI();
                toggleWindow(advWindow);
                
                // Show info popup about stat reset and skill points
                setTimeout(() => {
                    showInfoModal(
                        `Welcome, ${capitalize(newClass)}!`,
                        `<p>Congratulations on becoming a <span style="color: var(--legendary-color); font-weight: bold;">${capitalize(newClass)}</span>!</p>
                        <p><span style="color: var(--rare-color); font-weight: bold;">Your stats have been reset!</span></p>
                        <p>You now have <span style="color: var(--exp-color); font-weight: bold;">${player.ap} AP (Ability Points)</span> to distribute however you like!</p>
                        <p>Press <span style="color: var(--rare-color); font-weight: bold;">S</span> to open your Stats window and customize your build.</p>
                        <hr style="border-color: rgba(255,255,255,0.2); margin: 15px 0;">
                        <p>You also have <span style="color: var(--exp-color); font-weight: bold;">Skill Points</span> to spend on powerful new ${newClass} skills!</p>
                        <p>Press <span style="color: var(--rare-color); font-weight: bold;">K</span> to open your Skill Tree and learn new abilities.</p>`
                    );
                }, 300);
            });
        });
    } else if (level === 30) {
        // Level 30 - Job trial system
        contentEl.querySelectorAll('.job-select-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const newClass = e.target.dataset.class;
                const trialMap = e.target.dataset.trialMap;
                
                if (!trialMap || !maps[trialMap]) {
                    addChatMessage('Error: Trial map not found!', 'error');
                    return;
                }
                
                // Store trial info
                player.pendingJobAdvancement = {
                    targetClass: newClass,
                    trialMap: trialMap,
                    returnMap: player.currentMapId || 'ironHaven',
                    returnX: player.x,
                    returnY: player.y
                };
                
                // Close window and start trial
                toggleWindow(advWindow);
                startJobTrial(newClass, trialMap);
            });
        });
        
        contentEl.querySelector('#close-adv-btn')?.addEventListener('click', () => {
            toggleWindow(advWindow);
        });
    }

    // This call will now correctly make the window visible
    toggleWindow(advWindow);
}

/**
 * Starts a job advancement trial
 */
function startJobTrial(targetClass, trialMap) {
    // Heal player to full before trial
    const finalStats = calculatePlayerStats();
    player.hp = finalStats.finalMaxHp;
    player.mp = finalStats.finalMaxMp;
    
    // Set up trial data
    activeJobTrial = {
        targetClass: targetClass,
        trialMap: trialMap,
        startTime: Date.now(),
        duration: jobAdvancementData[30].trialDuration, // 5 minutes
        completed: false
    };
    
    // Teleport to trial map
    fadeAndChangeMap(trialMap, 200, 600);
    
    // Show trial start message
    addChatMessage(`Job Trial Started! Defeat the Trial Guardian within 5 minutes!`, 'legendary');
    showMajorNotification('JOB TRIAL STARTED!', 'legendary');
    
    // Start the timer display
    startJobTrialTimer();
    
    // Play boss music
    if (typeof playBGM === 'function') {
        playBGM('bossTheme');
    }
}

/**
 * Starts the job trial timer display
 */
function startJobTrialTimer() {
    // Create timer element if it doesn't exist
    let timerEl = document.getElementById('job-trial-timer');
    if (!timerEl) {
        timerEl = document.createElement('div');
        timerEl.id = 'job-trial-timer';
        Object.assign(timerEl.style, {
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '10px 30px',
            borderRadius: '10px',
            fontSize: '24px',
            fontWeight: 'bold',
            zIndex: '10000',
            border: '2px solid var(--legendary-color)',
            textAlign: 'center'
        });
        document.body.appendChild(timerEl);
    }
    timerEl.style.display = 'block';
    
    // Update timer every second
    if (jobTrialTimerInterval) clearInterval(jobTrialTimerInterval);
    
    jobTrialTimerInterval = setInterval(() => {
        if (!activeJobTrial) {
            clearInterval(jobTrialTimerInterval);
            timerEl.style.display = 'none';
            return;
        }
        
        const elapsed = Date.now() - activeJobTrial.startTime;
        const remaining = Math.max(0, activeJobTrial.duration - elapsed);
        
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        
        timerEl.innerHTML = `⏱️ Time Remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Change color based on time remaining
        if (remaining <= 60000) {
            timerEl.style.borderColor = '#ff0000';
            timerEl.style.color = '#ff4444';
        } else if (remaining <= 120000) {
            timerEl.style.borderColor = '#ffaa00';
            timerEl.style.color = '#ffcc00';
        } else {
            timerEl.style.borderColor = 'var(--legendary-color)';
            timerEl.style.color = '#fff';
        }
        
        // Check for timeout
        if (remaining <= 0 && !activeJobTrial.completed) {
            failJobTrial('timeout');
        }
    }, 100);
}

/**
 * Called when the trial boss is defeated
 */
function completeJobTrial() {
    if (!activeJobTrial || activeJobTrial.completed) return;
    
    activeJobTrial.completed = true;
    
    // Clear timer
    if (jobTrialTimerInterval) {
        clearInterval(jobTrialTimerInterval);
        jobTrialTimerInterval = null;
    }
    
    const timerEl = document.getElementById('job-trial-timer');
    if (timerEl) timerEl.style.display = 'none';
    
    const newClass = activeJobTrial.targetClass;
    
    // Perform job advancement
    player.class = newClass;
    player.sp += 3; // Give 3 SP for 2nd job
    player.pendingJobAdvancement = null;
    
    playSound('jobAdvance');
    addChatMessage(`Congratulations! You are now a ${capitalize(newClass)}!`, 'legendary');
    showMajorNotification(`JOB ADVANCEMENT: ${capitalize(newClass)}!`, 'legendary');
    
    // Send global announcement
    if (typeof sendAnnouncement === 'function') {
        sendAnnouncement('job_advancement', { newClass: newClass });
    }
    
    // Teleport back after a short delay
    setTimeout(() => {
        fadeAndChangeMap('ironHaven', 500, 600);
        activeJobTrial = null;
        
        // Show success modal
        setTimeout(() => {
            showInfoModal(
                `Welcome, ${capitalize(newClass)}!`,
                `<p>Congratulations on becoming a <span style="color: var(--legendary-color); font-weight: bold;">${capitalize(newClass)}</span>!</p>
                <p>You have proven your worth in the Trial and unlocked powerful new abilities!</p>
                <p>You received <span style="color: var(--exp-color); font-weight: bold;">3 Skill Points</span> to spend on your new ${capitalize(newClass)} skills!</p>
                <p>Press <span style="color: var(--rare-color); font-weight: bold;">K</span> to open your Skill Tree and learn new abilities.</p>`
            );
        }, 500);
    }, 2000);
    
    updateUI();
    updateSkillHotbarUI();
}

/**
 * Called when the player fails the job trial (death or timeout)
 */
function failJobTrial(reason) {
    if (!activeJobTrial || activeJobTrial.completed) return;
    
    activeJobTrial.completed = true;
    
    // Clear timer
    if (jobTrialTimerInterval) {
        clearInterval(jobTrialTimerInterval);
        jobTrialTimerInterval = null;
    }
    
    const timerEl = document.getElementById('job-trial-timer');
    if (timerEl) timerEl.style.display = 'none';
    
    const failMessage = reason === 'timeout' 
        ? 'You ran out of time!' 
        : 'You were defeated by the Trial Guardian!';
    
    addChatMessage(`❌ Job Trial Failed! ${failMessage}`, 'error');
    
    // Heal player
    const finalStats = calculatePlayerStats();
    player.hp = finalStats.finalMaxHp;
    player.mp = finalStats.finalMaxMp;
    
    // Keep track that they can retry
    player.canRetryJobTrial = true;
    player.pendingJobAdvancement = null;
    
    // Teleport to Iron Haven after a short delay
    setTimeout(() => {
        fadeAndChangeMap('ironHaven', 500, 600);
        activeJobTrial = null;
        
        // Show failure modal
        setTimeout(() => {
            showInfoModal(
                'Trial Failed',
                `<p style="color: var(--error-color);">${failMessage}</p>
                <p>Don't give up! You can attempt the trial again by speaking with <span style="color: var(--legendary-color); font-weight: bold;">Mayor Stan</span> in Iron Haven.</p>
                <p>Make sure you're well prepared with potions and upgraded equipment before trying again!</p>`
            );
        }, 500);
    }, 1500);
}

/**
 * Checks if a monster kill should trigger trial completion
 */
function checkTrialBossKill(monsterType) {
    console.log('checkTrialBossKill called with:', monsterType, 'activeJobTrial:', activeJobTrial);
    
    const trialBossTypes = [
        'trialFighter', 'trialSpearman', 'trialCleric', 'trialWizard',
        'trialHunter', 'trialCrossbowman', 'trialAssassin', 'trialBandit',
        'trialBrawler', 'trialGunslinger'
    ];
    
    if (!trialBossTypes.includes(monsterType)) {
        console.log('Monster type not a trial boss');
        return;
    }
    
    // If no active trial but we're in a trial map, create one on the fly (for GM/testing)
    const currentMap = maps[currentMapId];
    if (!activeJobTrial && currentMap && currentMap.isTrialMap) {
        console.log('No active trial but in trial map - creating fallback trial');
        // Determine target class from map
        const trialClass = currentMap.trialClass || monsterType.replace('trial', '').toLowerCase();
        activeJobTrial = {
            targetClass: trialClass,
            trialMap: currentMapId,
            startTime: Date.now(),
            duration: 300000,
            completed: false
        };
    }
    
    if (!activeJobTrial || activeJobTrial.completed) {
        console.log('No active trial or already completed');
        return;
    }
    
    console.log('Completing job trial!');
    completeJobTrial();
}

/**
 * Opens the pet selection window at level 20
 */
function openPetSelectionWindow() {
    const petWindow = document.getElementById('job-advancement-window'); // Reuse the job advancement window
    const titleEl = document.getElementById('job-adv-title');
    const contentEl = document.getElementById('job-adv-content');

    // Apply dynamic styles
    Object.assign(petWindow.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '900px',
        maxWidth: '90vw',
        height: 'auto',
        maxHeight: '85vh',
        overflow: 'hidden',
        flexDirection: 'column'
    });

    Object.assign(contentEl.style, {
        overflowY: 'auto',
        padding: '15px',
        flexShrink: '1'
    });

    // Hide close button to force selection
    const closeBtn = petWindow.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.style.display = 'none';
    }

    titleEl.textContent = "Choose Your Pet Companion!";

    let optionsHtml = `<p style="text-align: center; margin-bottom: 20px; font-size: var(--font-small); color: var(--exp-color);">
        Congratulations on reaching Level 20! You've unlocked the <b>Pet System</b>!<br>
        Choose a loyal companion that will follow you and <b>automatically loot items</b> for you!
    </p>
    <div class="job-options-container" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 15px;">`;

    const pets = ['babySlime', 'babyBlueSlime', 'babyRedSlime'];

    pets.forEach(petKey => {
        const pet = petData[petKey];
        const monsterSpriteData = spriteData[pet.spriteKey];

        optionsHtml += `
            <div class="job-option" style="flex: 1 1 200px; max-width: 280px;">
                <h3 class="job-class-name" style="text-align: center; margin-bottom: 10px;">${pet.displayName}</h3>
                <div class="job-icon-container" style="min-height: 100px; min-width: 100px; display: flex; align-items: center; justify-content: center; overflow: visible; margin: 0 auto 10px auto;">
                    <div class="pet-preview-sprite" data-pet="${petKey}"></div>
                </div>
                <p class="job-description" style="font-size: 13px; min-height: 60px; text-align: center;">${pet.description}</p>
                <div class="job-action">
                    <button class="window-content-button pet-select-btn" data-pet="${petKey}">Choose ${pet.displayName}</button>
                </div>
            </div>
        `;
    });

    optionsHtml += '</div>';
    contentEl.innerHTML = optionsHtml;

    // Animate pet previews using CSS background position (same as bestiary)
    setTimeout(() => {
        document.querySelectorAll('.pet-preview-sprite').forEach(spriteDiv => {
            const petKey = spriteDiv.dataset.pet;
            const pet = petData[petKey];
            const monsterSpriteData = spriteData[pet.spriteKey];
            
            if (monsterSpriteData && artAssets[pet.spriteKey]) {
                const frameWidth = monsterSpriteData.frameWidth;
                const frameHeight = monsterSpriteData.frameHeight;
                const scale = 4; // Scale up for better visibility

                // Calculate the sprite sheet dimensions based on animation frames
                let maxX = 0, maxY = 0;
                if (monsterSpriteData.animations && monsterSpriteData.animations.idle) {
                    monsterSpriteData.animations.idle.forEach(frame => {
                        maxX = Math.max(maxX, frame.x + frameWidth);
                        maxY = Math.max(maxY, frame.y + frameHeight);
                    });
                } else {
                    maxX = frameWidth;
                    maxY = frameHeight;
                }

                // Set up sprite display with proper sizing
                spriteDiv.style.cssText = `
                    width: ${frameWidth * scale}px;
                    height: ${frameHeight * scale}px;
                    background-image: url(${artAssets[pet.spriteKey]});
                    background-position: 0px 0px;
                    background-size: ${maxX * scale}px ${maxY * scale}px;
                    image-rendering: pixelated;
                    background-repeat: no-repeat;
                `;

                // Add idle animation if available
                if (monsterSpriteData.animations && monsterSpriteData.animations.idle) {
                    let frameIndex = 0;
                    const frames = monsterSpriteData.animations.idle;
                    
                    const animateSprite = () => {
                        const frame = frames[frameIndex];
                        spriteDiv.style.backgroundPosition = `-${frame.x * scale}px -${frame.y * scale}px`;
                        frameIndex = (frameIndex + 1) % frames.length;
                    };
                    
                    // Start animation immediately and continue every 166ms
                    animateSprite();
                    setInterval(animateSprite, 166);
                }
            }
        });
    }, 50);

    // Add event listeners for pet selection
    contentEl.querySelectorAll('.pet-select-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const petKey = e.target.dataset.pet;
            const pet = petData[petKey];

            // Add to pet inventory and set as active pet
            if (!player.petInventory) player.petInventory = [];
            player.petInventory.push(petKey);
            
            // Mark this baby slime as already owned to prevent duplicate from gold tier bestiary
            // This ensures if player picks babySlime at level 20 and later kills 500+ Baby Slimes,
            // they won't get a duplicate pet
            if (!player.bestiaryRewards) player.bestiaryRewards = {};
            if (!player.bestiaryRewards.goldTierPetsAwarded) player.bestiaryRewards.goldTierPetsAwarded = {};
            player.bestiaryRewards.goldTierPetsAwarded[petKey] = true;
            
            player.activePet = {
                type: petKey,
                x: player.x - 60,
                y: player.y,
                isSpawned: true,
                velocityY: 0,
                previousY: player.y,
                isJumping: false,
                yOffset: -6,
                animationFrame: 0,
                animationTimer: 0,
                facingLeft: false
            };

            playSound('jobAdvance');
            addChatMessage(`You've chosen ${pet.displayName} as your companion!`, 'quest-complete');
            showNotification(`${pet.displayName} will now automatically loot items for you!`, 'legendary');

            toggleWindow(petWindow);

            // Show info about the pet system
            setTimeout(() => {
                showInfoModal(
                    `Welcome, ${pet.displayName}!`,
                    `<p>Your new pet companion will follow you everywhere!</p>
                    <p><span style="color: var(--legendary-color); font-weight: bold;">Auto-Loot:</span> Your pet will automatically pick up items within range, so you never miss any drops!</p>
                    <p><span style="color: var(--rare-color);">Tip:</span> Press 'P' to open the Pet Window to spawn/despawn your pet!</p>`
                );
            }, 300);

            saveCharacter();
        });
    });

    toggleWindow(petWindow);
}

/**
 * Opens and updates the pet management window
 */
function openPetWindow() {
    console.log('[Pet Window] Opening pet window');
    const petWindow = document.getElementById('pet-window');
    if (!petWindow) {
        console.error('[Pet Window] Pet window element not found!');
        return;
    }

    console.log('[Pet Window] Player pet data:', player.petInventory, player.activePet);

    // Update the pet window content
    updatePetWindow();

    // Toggle the window
    toggleWindow(petWindow);
}

/**
 * Updates the pet management window with current pet info
 */
function updatePetWindow() {
    const statusDisplay = document.querySelector('#pet-window .pet-status-display');
    const petList = document.querySelector('#pet-window .pet-list');
    const togglesSection = document.querySelector('#pet-window .pet-loot-toggles');

    if (!statusDisplay || !petList) return;
    
    // Initialize pet loot settings if not set
    if (player.petLootGold === undefined) player.petLootGold = true;
    if (player.petLootItems === undefined) player.petLootItems = true;
    
    // Update loot toggles section
    if (togglesSection) {
        togglesSection.innerHTML = `
            <h4>Auto-Loot Settings</h4>
            <div class="pet-toggle-row">
                <span class="pet-toggle-label">Loot Gold</span>
                <div class="pet-toggle-switch ${player.petLootGold ? 'active' : ''}" data-toggle="gold"></div>
            </div>
            <div class="pet-toggle-row">
                <span class="pet-toggle-label">Loot Items</span>
                <div class="pet-toggle-switch ${player.petLootItems ? 'active' : ''}" data-toggle="items"></div>
            </div>
        `;
        
        // Add toggle event listeners
        togglesSection.querySelectorAll('.pet-toggle-switch').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const toggleType = e.target.dataset.toggle;
                if (toggleType === 'gold') {
                    player.petLootGold = !player.petLootGold;
                    showNotification(`Pet gold looting ${player.petLootGold ? 'enabled' : 'disabled'}`, player.petLootGold ? 'exp' : 'common');
                } else if (toggleType === 'items') {
                    player.petLootItems = !player.petLootItems;
                    showNotification(`Pet item looting ${player.petLootItems ? 'enabled' : 'disabled'}`, player.petLootItems ? 'rare' : 'common');
                }
                e.target.classList.toggle('active');
                playSound('click');
            });
        });
    }

    // Update status display
    if (player.activePet && player.activePet.isSpawned) {
        const activePetInfo = petData[player.activePet.type];
        statusDisplay.innerHTML = `
            <div class="pet-status-active">Active: ${activePetInfo.displayName}</div>
            <div class="pet-status-info">Loot Range: ${activePetInfo.lootRange}px | Follow Speed: ${activePetInfo.followSpeed}</div>
        `;
    } else {
        statusDisplay.innerHTML = `
            <div class="pet-status-info" style="font-style: italic;">No pet currently active</div>
        `;
    }

    // Update pet list
    petList.innerHTML = '';
    
    if (!player.petInventory || player.petInventory.length === 0) {
        petList.innerHTML = `<div class="pet-no-pets">No pets in inventory</div>`;
        return;
    }

    player.petInventory.forEach(petKey => {
        const petInfo = petData[petKey];
        const isActive = player.activePet && player.activePet.type === petKey && player.activePet.isSpawned;
        
        // Initialize pet names object if it doesn't exist
        if (!player.petNames) player.petNames = {};
        const petName = player.petNames[petKey] || petInfo.displayName;
        
        const petItem = document.createElement('div');
        petItem.className = `pet-entry ${isActive ? 'active' : ''}`;

        petItem.innerHTML = `
            <div class="pet-entry-header">
                <div class="pet-entry-sprite">
                    <div class="pet-inventory-sprite" data-pet="${petKey}"></div>
                </div>
                <div class="pet-entry-info">
                    <div class="pet-entry-name">${petInfo.displayName}</div>
                    <div class="pet-entry-status ${isActive ? 'active-status' : ''}">
                        ${isActive ? '● Active' : '○ In Inventory'}
                    </div>
                </div>
                <button class="pet-action-btn ${isActive ? 'despawn-btn' : 'spawn-btn'}" data-pet="${petKey}">
                    ${isActive ? 'Despawn' : 'Spawn'}
                </button>
            </div>
            <div class="pet-entry-actions">
                <input 
                    type="text" 
                    class="pet-name-input" 
                    data-pet="${petKey}"
                    value="${petName}" 
                    maxlength="20"
                    placeholder="Enter pet name"
                />
            </div>
        `;

        petList.appendChild(petItem);
    });

    // Animate pet sprites using the same system as bestiary
    setTimeout(() => {
        petList.querySelectorAll('.pet-inventory-sprite').forEach(spriteDiv => {
            const petKey = spriteDiv.dataset.pet;
            const petInfo = petData[petKey];
            const monsterSpriteData = spriteData[petInfo.spriteKey];
            
            if (monsterSpriteData && artAssets[petInfo.spriteKey]) {
                const frameWidth = monsterSpriteData.frameWidth;
                const frameHeight = monsterSpriteData.frameHeight;
                const scale = 3; // Scale for 64px container

                // Calculate the sprite sheet dimensions based on animation frames
                let maxX = 0, maxY = 0;
                if (monsterSpriteData.animations && monsterSpriteData.animations.idle) {
                    monsterSpriteData.animations.idle.forEach(frame => {
                        maxX = Math.max(maxX, frame.x + frameWidth);
                        maxY = Math.max(maxY, frame.y + frameHeight);
                    });
                } else {
                    maxX = frameWidth;
                    maxY = frameHeight;
                }

                // Set up sprite display with proper sizing
                spriteDiv.style.cssText = `
                    width: ${frameWidth * scale}px;
                    height: ${frameHeight * scale}px;
                    background-image: url(${artAssets[petInfo.spriteKey]});
                    background-position: 0px 0px;
                    background-size: ${maxX * scale}px ${maxY * scale}px;
                    image-rendering: pixelated;
                    background-repeat: no-repeat;
                `;

                // Add idle animation if available
                if (monsterSpriteData.animations && monsterSpriteData.animations.idle) {
                    let frameIndex = 0;
                    const frames = monsterSpriteData.animations.idle;
                    
                    const animateSprite = () => {
                        const frame = frames[frameIndex];
                        spriteDiv.style.backgroundPosition = `-${frame.x * scale}px -${frame.y * scale}px`;
                        frameIndex = (frameIndex + 1) % frames.length;
                    };
                    
                    // Start animation immediately and continue every 166ms
                    animateSprite();
                    setInterval(animateSprite, 166);
                }
            }
        });
    }, 50);

    // Add event listeners to spawn/despawn buttons
    petList.querySelectorAll('.pet-action-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const petKey = e.target.dataset.pet;
            const isCurrentlyActive = player.activePet && player.activePet.type === petKey && player.activePet.isSpawned;

            if (isCurrentlyActive) {
                despawnPet();
            } else {
                spawnPet(petKey);
            }

            updatePetWindow();
            saveCharacter();
        });
    });
    
    // Add event listeners for pet name inputs
    petList.querySelectorAll('.pet-name-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const petKey = e.target.dataset.pet;
            const newName = e.target.value.trim();
            
            if (!player.petNames) player.petNames = {};
            
            if (newName) {
                player.petNames[petKey] = newName;
                addChatMessage(`Pet renamed to "${newName}"!`, 'system');
            } else {
                delete player.petNames[petKey];
                e.target.value = petData[petKey].displayName;
            }
            
            saveCharacter();
        });
        
        // Also update on blur
        input.addEventListener('blur', (e) => {
            const petKey = e.target.dataset.pet;
            if (!e.target.value.trim()) {
                e.target.value = player.petNames[petKey] || petData[petKey].displayName;
            }
        });
    });
}

/**
 * Spawns a pet from inventory
 * @param {string} petKey - The key of the pet to spawn
 */
function spawnPet(petKey) {
    if (!player.petInventory || !player.petInventory.includes(petKey)) {
        addChatMessage('You do not own this pet!', 'error');
        return;
    }

    const petInfo = petData[petKey];
    
    player.activePet = {
        type: petKey,
        x: player.x - 60,
        y: player.y,
        isSpawned: true,
        velocityY: 0,
        previousY: player.y,
        isJumping: false,
        yOffset: -6,
        animationFrame: 0,
        animationTimer: 0,
        facingLeft: false
    };

    playSound('levelUp');
    addChatMessage(`${petInfo.displayName} has been summoned!`, 'quest-complete');
}

/**
 * Despawns the currently active pet
 */
function despawnPet() {
    if (!player.activePet || !player.activePet.isSpawned) {
        return;
    }

    const petInfo = petData[player.activePet.type];
    player.activePet.isSpawned = false;

    playSound('buttonClick');
    addChatMessage(`${petInfo.displayName} has been recalled.`, 'system');
}

/**
 * Shows an informational modal popup with a title and message
 * @param {string} title - The modal title
 * @param {string} message - The HTML message content
 */
function showInfoModal(title, message) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid var(--rare-color);
        border-radius: 10px;
        padding: 25px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        text-align: center;
    `;
    
    modal.innerHTML = `
        <h2 style="color: var(--legendary-color); margin: 0 0 20px 0; font-size: 24px;">${title}</h2>
        <div style="color: white; font-size: var(--font-small);; line-height: 1.6; margin-bottom: 20px;">
            ${message}
        </div>
        <button class="window-content-button" style="padding: 10px 30px; font-size: var(--font-standard);;">OK</button>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Close on button click
    const okButton = modal.querySelector('button');
    okButton.addEventListener('click', () => {
        overlay.remove();
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
    
    playSound('notification');
}

/**
 * Adds a new message to the in-game chat log with a real-time timestamp.
 * @param {string} message - The text content of the message.
 * @param {string} [type='system'] - The type of message for styling (e.g., 'success', 'fail', 'rare').
 */
function addChatMessage(message, type = 'system') {
    const chatLog = document.getElementById('chat-log');
    if (!chatLog) return;

    // Get current real time for the timestamp
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    const timestamp = `[${paddedHours}:${paddedMinutes}]`;

    const messageEl = document.createElement('div');
    messageEl.className = `chat-log-message chat-log--${type}`;
    messageEl.textContent = `${timestamp} ${message}`;

    chatLog.appendChild(messageEl);

    chatLog.scrollTop = chatLog.scrollHeight;
}

function setupChatLogDragScroll() {
    const chatLog = document.getElementById('chat-log');
    if (!chatLog) return;

    let isDown = false;
    let startY;
    let scrollTop;

    chatLog.addEventListener('mousedown', (e) => {
        isDown = true;
        chatLog.classList.add('active');
        startY = e.pageY - chatLog.offsetTop;
        scrollTop = chatLog.scrollTop;
    });

    chatLog.addEventListener('mouseleave', () => {
        isDown = false;
        chatLog.classList.remove('active');
    });

    chatLog.addEventListener('mouseup', () => {
        isDown = false;
        chatLog.classList.remove('active');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const y = e.pageY - chatLog.offsetTop;
        const walk = (y - startY);
        chatLog.scrollTop = scrollTop - walk;
    });
}

function setupChatLogResize() {
    const chatLogContainer = document.getElementById('chat-log-container');
    const resizeHandle = document.getElementById('chat-log-resize-handle');
    const scalingContainer = document.getElementById('scaling-container');
    
    if (!chatLogContainer || !resizeHandle) return;
    
    const MIN_HEIGHT = 50;
    const MAX_HEIGHT = 400;
    
    resizeHandle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const startY = e.clientY;
        const startHeight = chatLogContainer.offsetHeight;
        
        // Account for the game's overall scale
        const containerRect = scalingContainer.getBoundingClientRect();
        const scale = containerRect.height / scalingContainer.offsetHeight;
        
        function doDrag(e) {
            // Dragging up (negative dy) should increase height
            const dy = (startY - e.clientY) / scale;
            let newHeight = startHeight + dy;
            
            // Clamp the height between min and max values
            newHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, MAX_HEIGHT));
            
            chatLogContainer.style.height = newHeight + 'px';
        }
        
        function stopDrag() {
            // Save the final size to localStorage
            localStorage.setItem('evergreenRPG_chatLogHeight', chatLogContainer.style.height);
            
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        }
        
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    });
    
    // Load saved height from localStorage
    const savedHeight = localStorage.getItem('evergreenRPG_chatLogHeight');
    if (savedHeight) {
        chatLogContainer.style.height = savedHeight;
    }
}

function updateGameClockUI() {
    const clockElement = document.getElementById('game-clock');
    if (!clockElement) return;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');

    clockElement.textContent = `${paddedHours}:${paddedMinutes}`;
}

// --- Gamepad Settings UI Functions ---

function updateGamepadSettingsUI() {
    if (typeof gamepadManager === 'undefined' || !gamepadManager) return;
    
    const statusEl = document.getElementById('gamepad-status');
    const mappingList = document.getElementById('gamepad-mapping-list');
    
    if (!statusEl || !mappingList) return;
    
    // Update connection status
    if (gamepadManager.isConnected()) {
        statusEl.textContent = '(Connected ✓)';
        statusEl.style.color = '#4CAF50';
    } else {
        statusEl.textContent = '(Not Connected)';
        statusEl.style.color = '#888';
    }
    
    // Build the mapping list
    let html = '<div class="gamepad-mappings">';
    
    for (let i = 0; i <= 15; i++) {
        const buttonName = gamepadManager.getButtonName(i);
        const action = gamepadManager.buttonMap[i];
        const actionName = gamepadManager.getActionName(action);
        
        // Button 9 (Start) is locked to Settings and cannot be remapped
        const isLocked = i === 9;
        const lockIndicator = isLocked ? ' <span style="color: #e74c3c;">🔒</span>' : '';
        const buttonDisabled = isLocked ? 'disabled' : '';
        const buttonOpacity = isLocked ? 'opacity: 0.5;' : '';
        
        html += `
            <div class="gamepad-mapping-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin: 4px 0; background: #2a2a2a; border-radius: 4px;">
                <span style="flex: 1;">${buttonName}${lockIndicator}</span>
                <span style="flex: 1; text-align: center; color: #ffd700;">${actionName}</span>
                <button class="window-content-button remap-gamepad-btn" data-button="${i}" style="padding: 4px 8px; font-size: var(--font-small);; ${buttonOpacity}" ${buttonDisabled}>Remap</button>
            </div>
        `;
    }
    
    html += '</div>';
    mappingList.innerHTML = html;
}

function updateSettingsTabVisibility() {
    if (typeof gamepadManager === 'undefined' || !gamepadManager) return;
    
    const settingsNav = document.querySelector('#settings-content .shop-tabs');
    if (!settingsNav) return;
    
    const keyboardTab = settingsNav.querySelector('[data-tab="controls"]');
    const gamepadTab = settingsNav.querySelector('[data-tab="gamepad"]');
    
    if (!keyboardTab || !gamepadTab) return;
    
    // Show/hide tabs based on gamepad connection AND forced keyboard mode
    const useGamepadMode = gamepadManager.isConnected() && !gamepadManager.forceKeyboardMode;
    
    if (useGamepadMode) {
        // Hide keyboard tab, show only gamepad tab
        keyboardTab.style.display = 'none';
        gamepadTab.style.display = 'inline-block';
        
        // Make gamepad tab active
        keyboardTab.classList.remove('active');
        gamepadTab.classList.add('active');
        document.getElementById('settings-controls-content').style.display = 'none';
        document.getElementById('settings-gamepad-content').style.display = 'block';
        updateGamepadDetailedUI();
    } else {
        // Hide gamepad tab when no controller connected or keyboard forced, show keyboard tab
        keyboardTab.style.display = 'inline-block';
        gamepadTab.style.display = 'none';
        
        // Make sure keyboard tab is active
        keyboardTab.classList.add('active');
        gamepadTab.classList.remove('active');
        document.getElementById('settings-gamepad-content').style.display = 'none';
        document.getElementById('settings-controls-content').style.display = 'block';
    }
}

function updateGamepadDetailedUI() {
    if (typeof gamepadManager === 'undefined' || !gamepadManager) return;
    
    const statusEl = document.getElementById('gamepad-status-detailed');
    const mappingList = document.getElementById('gamepad-detailed-mapping-list');
    
    if (!statusEl || !mappingList) return;
    
    // Update connection status
    if (gamepadManager.isConnected()) {
        statusEl.textContent = '(Connected ✓)';
        statusEl.style.color = '#4CAF50';
    } else {
        statusEl.textContent = '(Not Connected)';
        statusEl.style.color = '#e74c3c';
    }
    
    // Get all available actions - simplified list for shorter scroll
    const availableActions = [
        { value: null, label: '-- None --' },
        { value: 'jump', label: 'Jump' },
        { value: 'attack', label: 'Attack' },
        { value: 'loot', label: 'Loot' },
        { value: 'interact', label: 'Interact/Talk' },
        { value: 'smart-action', label: 'Smart Action (A)' },
        { value: 'hotbar-1', label: 'Hotbar Slot 1' },
        { value: 'hotbar-2', label: 'Hotbar Slot 2' },
        { value: 'hotbar-3', label: 'Hotbar Slot 3' },
        { value: 'hotbar-4', label: 'Hotbar Slot 4' },
        { value: 'hotbar-5', label: 'Hotbar Slot 5' },
        { value: 'hotbar-6', label: 'Hotbar Slot 6' },
        { value: 'hotbar-7', label: 'Hotbar Slot 7' },
        { value: 'hotbar-8', label: 'Hotbar Slot 8' },
        { value: 'inventory', label: 'Inventory' },
        { value: 'equipment', label: 'Equipment' },
        { value: 'skills', label: 'Skills' },
        { value: 'stats', label: 'Stats' },
        { value: 'quest-log', label: 'Quests' },
        { value: 'world-map', label: 'Map' }
    ];
    
    // Buttons that cannot be remapped (removed button 10 - L3 is now unlocked)
    const lockedButtons = [9, 12, 13, 14, 15];
    
    // Build the dropdown list
    let html = '';
    
    for (let i = 0; i <= 15; i++) {
        const buttonName = gamepadManager.getButtonName(i);
        const currentAction = gamepadManager.buttonMap[i];
        const isLocked = lockedButtons.includes(i);
        const lockIndicator = isLocked ? ' 🔒' : '';
        
        html += `<div class="gamepad-dropdown-item ${isLocked ? 'locked' : ''}">`;
        html += `<span class="gamepad-button-label">${buttonName}${lockIndicator}</span>`;
        
        // Create dropdown
        html += `<select class="gamepad-action-select" data-button="${i}" ${isLocked ? 'disabled' : ''}>`;
        for (const action of availableActions) {
            const selected = currentAction === action.value ? 'selected' : '';
            html += `<option value="${action.value}" ${selected}>${action.label}</option>`;
        }
        html += `</select>`;
        
        // Warning for duplicates
        html += `<span class="gamepad-duplicate-warning" id="gamepad-warning-${i}"></span>`;
        html += `</div>`;
    }
    
    mappingList.innerHTML = html;
    
    // Check for duplicates
    checkGamepadDuplicates();
}

function checkGamepadDuplicates() {
    if (typeof gamepadManager === 'undefined' || !gamepadManager) return;
    
    const actionCounts = {};
    
    // Count how many times each action is mapped
    for (let i = 0; i <= 15; i++) {
        const action = gamepadManager.buttonMap[i];
        if (action) {
            actionCounts[action] = (actionCounts[action] || 0) + 1;
        }
    }
    
    // Clear all warnings first
    for (let i = 0; i <= 15; i++) {
        const warningEl = document.getElementById(`gamepad-warning-${i}`);
        if (warningEl) warningEl.textContent = '';
    }
    
    // Show warnings for duplicates
    for (let i = 0; i <= 15; i++) {
        const action = gamepadManager.buttonMap[i];
        if (action && actionCounts[action] > 1) {
            const warningEl = document.getElementById(`gamepad-warning-${i}`);
            if (warningEl) warningEl.textContent = '⚠ Duplicate';
        }
    }
}

function openGamepadRemapDialog(buttonIndex) {
    if (typeof gamepadManager === 'undefined' || !gamepadManager) return;
    
    // Prevent remapping button 9 (Start button)
    if (buttonIndex === 9) {
        if (typeof showNotification === 'function') {
            showNotification('Start button is locked to Settings menu', 'error');
        }
        return;
    }
    
    const buttonName = gamepadManager.getButtonName(buttonIndex);
    const modal = document.getElementById('gamepad-remap-modal');
    const title = document.getElementById('gamepad-remap-title');
    const instruction = document.getElementById('gamepad-remap-instruction');
    const cancelBtn = document.getElementById('gamepad-remap-cancel-btn');
    const closeBtn = modal.querySelector('.close-btn');
    
    title.textContent = `Remap ${buttonName}`;
    instruction.textContent = 'Press any gamepad button...';
    instruction.style.color = 'var(--legendary-color)';
    
    modal.style.display = 'flex';
    
    // Simple polling approach - check for button press every frame
    let remapInterval = null;
    let lastButtonStates = [];
    
    const checkForButtonPress = () => {
        const gamepads = navigator.getGamepads();
        if (!gamepads || !gamepads[0]) return;
        
        const gamepad = gamepads[0];
        
        for (let i = 0; i < gamepad.buttons.length; i++) {
            const isPressed = gamepad.buttons[i].pressed;
            const wasPressed = lastButtonStates[i] || false;
            
            // Detect new button press (edge detection)
            if (isPressed && !wasPressed) {
                // Don't allow remapping to button 9 (Start)
                if (i === 9) {
                    instruction.textContent = 'Start button is locked! Try another button.';
                    instruction.style.color = 'var(--hp-color)';
                    setTimeout(() => {
                        instruction.textContent = 'Press any gamepad button...';
                        instruction.style.color = 'var(--legendary-color)';
                    }, 1500);
                    lastButtonStates[i] = isPressed;
                    return;
                }
                
                // Perform the swap
                const oldAction = gamepadManager.buttonMap[buttonIndex];
                const newAction = gamepadManager.buttonMap[i];
                
                gamepadManager.buttonMap[i] = oldAction;
                gamepadManager.buttonMap[buttonIndex] = newAction;
                gamepadManager.saveButtonMap();
                
                // Close modal and clean up
                cleanup();
                
                // Show success feedback
                updateGamepadSettingsUI();
                if (typeof showNotification === 'function') {
                    showNotification(`Swapped with ${gamepadManager.getButtonName(i)}`, 'success');
                }
                if (typeof playSound === 'function') {
                    playSound('pickup');
                }
                
                return;
            }
            
            lastButtonStates[i] = isPressed;
        }
    };
    
    const cleanup = () => {
        if (remapInterval) {
            clearInterval(remapInterval);
            remapInterval = null;
        }
        modal.style.display = 'none';
        lastButtonStates = [];
    };
    
    const cancel = () => {
        cleanup();
    };
    
    // Set up cancel handlers
    cancelBtn.onclick = cancel;
    closeBtn.onclick = cancel;
    
    // Also close on ESC key
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            cancel();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Start polling for button presses
    remapInterval = setInterval(checkForButtonPress, 16); // ~60fps
}

function showConfirmationCustom(title, message, confirmText, cancelText, onConfirm) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmation-modal');
        if (!modal) {
            resolve(false);
            return;
        }

        modal.querySelector('.window-title span').textContent = title;
        modal.querySelector('#confirmation-message').innerHTML = message;
        
        const confirmBtn = modal.querySelector('#confirm-action-btn');
        const cancelBtn = modal.querySelector('#cancel-action-btn');
        
        confirmBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;

        const cleanup = () => {
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            modal.style.display = 'none';
        };

        modal.querySelector('#confirm-action-btn').addEventListener('click', () => {
            if (onConfirm) onConfirm();
            cleanup();
            resolve(true);
        }, { once: true });

        modal.querySelector('#cancel-action-btn').addEventListener('click', () => {
            cleanup();
            resolve(false);
        }, { once: true });

        // Also handle the close button (X)
        const closeBtn = modal.querySelector('.close-btn');
        const handleClose = () => {
            cleanup();
            resolve(false);
        };
        closeBtn.addEventListener('click', handleClose, { once: true });

        modal.style.display = 'flex';
    });
}

// --- Open modal to assign skill to specific hotbar slot ---
function assignSkillToNextHotbarSlot(skillName, skillDisplayName) {
    if (!skillName) return;
    
    // Check if player has this skill learned
    const learnedSkill = player.abilities.find(a => a.name === skillName);
    if (!learnedSkill) {
        if (typeof addChatMessage === 'function') {
            addChatMessage("You haven't learned this skill yet!", 'error');
        }
        return;
    }
    
    // Find the skill data to get the actual skill name (not display name)
    let actualSkillName = skillName;
    for (const className in skillData) {
        const found = skillData[className].find(s => s.displayName === skillName || s.name === skillName);
        if (found) {
            actualSkillName = found.name; // Use the internal name
            break;
        }
    }
    
    // Check if skill is already on hotbar
    const existingSlot = player.hotbar.findIndex(slot => 
        slot && slot.type === 'skill' && slot.name === actualSkillName
    );
    
    if (existingSlot !== -1) {
        if (typeof addChatMessage === 'function') {
            addChatMessage(`${skillDisplayName} already on slot ${existingSlot + 1}`, 'common');
        }
        return;
    }
    
    // Open the hotbar assignment modal
    openHotbarAssignmentModal(actualSkillName, skillDisplayName || skillName);
}

// --- Open hotbar slot selection modal ---
function openHotbarAssignmentModal(skillName, skillDisplayName) {
    const modal = document.getElementById('hotbar-assignment-modal');
    const skillNameEl = document.getElementById('hotbar-assignment-skill-name');
    const slotSelection = document.getElementById('hotbar-slot-selection');
    
    if (!modal || !skillNameEl || !slotSelection) return;
    
    // Set skill name display
    skillNameEl.textContent = `Assign "${skillDisplayName}" to which slot?`;
    
    // Generate hotbar slot buttons
    slotSelection.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const slotBtn = document.createElement('button');
        slotBtn.className = 'hotbar-slot-btn window-content-button';
        
        const existingSkill = player.hotbar[i];
        const isEmpty = !existingSkill || !existingSkill.name;
        
        if (isEmpty) {
            slotBtn.innerHTML = `<div style="font-size: var(--font-standard);; margin-bottom: 5px;">${i + 1}</div><div style="font-size: 10px; color: #888;">Empty</div>`;
        } else {
            let displayName = existingSkill.name;
            // Try to find display name for existing skill
            for (const className in skillData) {
                const found = skillData[className].find(s => s.name === existingSkill.name);
                if (found) {
                    displayName = found.displayName || found.name;
                    break;
                }
            }
            slotBtn.innerHTML = `<div style="font-size: var(--font-standard);; margin-bottom: 5px;">${i + 1}</div><div style="font-size: 9px; color: var(--rare-color); overflow: hidden; text-overflow: ellipsis;">${displayName}</div>`;
            slotBtn.style.backgroundColor = 'rgba(231, 76, 60, 0.3)';
        }
        
        slotBtn.addEventListener('click', () => {
            assignSkillToSlot(skillName, skillDisplayName, i);
            toggleWindow(modal);
        });
        
        slotSelection.appendChild(slotBtn);
    }
    
    // Cancel button listener
    const cancelBtn = document.getElementById('cancel-hotbar-assignment-btn');
    cancelBtn.replaceWith(cancelBtn.cloneNode(true)); // Remove old listeners
    document.getElementById('cancel-hotbar-assignment-btn').addEventListener('click', () => {
        toggleWindow(modal);
    });
    
    // Show modal
    toggleWindow(modal);
}

// --- Assign skill to specific hotbar slot ---
function assignSkillToSlot(skillName, skillDisplayName, slotIndex) {
    const existingSkill = player.hotbar[slotIndex];
    
    // Warn if replacing existing skill
    if (existingSkill && existingSkill.name) {
        let existingDisplayName = existingSkill.name;
        for (const className in skillData) {
            const found = skillData[className].find(s => s.name === existingSkill.name);
            if (found) {
                existingDisplayName = found.displayName || found.name;
                break;
            }
        }
        if (typeof addChatMessage === 'function') {
            addChatMessage(`Replaced ${existingDisplayName} with ${skillDisplayName}`, 'common');
        }
    }
    
    // Assign to hotbar
    player.hotbar[slotIndex] = {
        name: skillName,
        type: 'skill'
    };
    
    if (typeof updateSkillHotbarUI === 'function') {
        updateSkillHotbarUI();
    }
    
    if (typeof addChatMessage === 'function') {
        addChatMessage(`${skillDisplayName} assigned to slot ${slotIndex + 1}`, 'success');
    }
    
    if (typeof playSound === 'function') {
        playSound('pickup');
    }
}

// --- Initialize UI Elements on DOM Content Loaded ---

document.addEventListener('DOMContentLoaded', () => {
    // --- Assign all global UI and Game Element variables here ---
    gameContainer = document.getElementById('game-container');
    scalingContainer = document.getElementById('scaling-container');
    worldContent = document.getElementById('world-content');
    playerElement = document.getElementById('player');
    uiContainer = document.getElementById('ui-container');
    groundElement = document.querySelector('.ground');
    groundCanvas = document.getElementById('ground-canvas');
    platformsCanvas = document.getElementById('platforms-canvas');
    notificationContainer = document.getElementById('notification-container');
    levelUpNotificationContainer = document.getElementById('level-up-notification-container');
    globalNotificationContainer = document.getElementById('global-notification-container');
    buffContainer = document.getElementById('buff-container');
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
    worldMapWindow = document.getElementById('world-map-window');
    questHelperElement = document.getElementById('quest-helper');
    enhanceItemBtn = document.getElementById('enhance-item-btn');
    inventoryTrashBtn = document.getElementById('inventory-trash-btn');
    enhancementConfirmModal = document.getElementById('enhancement-confirm-modal');
    minimapContainer = document.getElementById('minimap-container');
    mapNameElement = document.getElementById('map-name');
    minimap = document.getElementById('minimap');
    gmWindowElement = document.getElementById('gm-window');
    initializeAppearanceWindow();

    // --- Load saved audio settings on startup ---
    if (typeof saveManager !== 'undefined' && typeof saveManager.getAudioSettings === 'function') {
        const savedAudio = saveManager.getAudioSettings();
        // Set global audio variables
        bgmVolume = savedAudio.bgm;
        sfxVolume = savedAudio.sfx;
        lastBgmVolume = savedAudio.lastBgm || savedAudio.bgm;
        lastSfxVolume = savedAudio.lastSfx || savedAudio.sfx;
        // Apply settings (this also updates sliders and mute buttons)
        if (typeof applyAudioSettings === 'function') {
            applyAudioSettings();
        }
    }

    buildQuestToNpcMap();

    // --- Universal Window Dragging & Closing ---
    document.querySelectorAll('.window').forEach(win => {
        if (win.id !== 'job-advancement-window' && win.id !== 'confirmation-modal' && win.id !== 'welcome-popup') {
            const header = win.querySelector('.window-title') || win.querySelector('.window-header');
            if (header) {
                makeWindowDraggable(win, header);
            }
        }
    });
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('close-btn')) {
            const windowElement = e.target.closest('.window');
            // Skip player-inspect-popup as it has its own close handler
            if (windowElement && windowElement.id !== 'player-inspect-popup') {
                toggleWindow(windowElement);
            }
        }
    });

    // --- Inventory Window Event Delegation ---
    const inventoryWindow = document.getElementById('inventory');
    if (inventoryWindow) {
        inventoryWindow.addEventListener('click', async (e) => {
            if (e.target.id === 'inventory-sort-btn') {
                sortInventoryTab(activeInventoryTab);
                updateInventoryUI();
                return;
            }
            if (e.target.id === 'enhance-item-btn') {
                if (selectedInventoryIndex === null) return;
                const item = player.inventory[activeInventoryTab]?.[selectedInventoryIndex];
                if (!item || itemData[item.name]?.category !== 'Equip') {
                    showNotification("Only stat equipment can be enhanced.", 'error');
                    return;
                }
                openEnhancementConfirmation({ source: 'inventory', tab: activeInventoryTab, index: selectedInventoryIndex });
                return;
            }
            if (e.target.closest('#inventory-drop-btn')) {
                const item = player.inventory[activeInventoryTab]?.[selectedInventoryIndex];
                if (!item) return;
                const confirmed = await showConfirmation("Drop Item", `Drop ${item.name} on the ground?`, "Drop", "Cancel");
                if (confirmed) {
                    // Create the item drop at player's position
                    createItemDrop(item.name, player.x, player.y, { 
                        stats: item.stats, 
                        rarity: item.rarity, 
                        enhancement: item.enhancement,
                        quantity: item.quantity,
                        levelReq: item.levelReq,
                        isQuestItem: item.isQuestItem
                    });
                    // Remove from inventory
                    player.inventory[activeInventoryTab].splice(selectedInventoryIndex, 1);
                    selectedInventoryIndex = null;
                    updateInventoryUI();
                }
                return;
            }
            if (e.target.closest('#inventory-trash-btn')) {
                const item = player.inventory[activeInventoryTab]?.[selectedInventoryIndex];
                if (!item) return;
                const confirmed = await showConfirmation("Delete Item", `Are you sure you want to permanently delete ${item.name}?`, "Delete", "Cancel");
                if (confirmed) {
                    player.inventory[activeInventoryTab].splice(selectedInventoryIndex, 1);
                    selectedInventoryIndex = null;
                    updateInventoryUI();
                }
                return;
            }
        });
    }

    // --- Character & Game Start Button Listeners ---
    document.getElementById('start-game-audio-btn').addEventListener('click', () => {
        playBGM('title');
        document.getElementById('start-screen').style.display = 'none';
        showCharacterSelection();
    });
    document.getElementById('create-new-char-btn').addEventListener('click', () => {
        cleanupCharacterPreviews();
        characterSelectionScreen.style.display = 'none';
        characterCreationScreen.style.display = 'flex';
        const startGameBtn = document.getElementById('start-game-btn');
        startGameBtn.style.visibility = 'hidden';
        startGameBtn.disabled = false;
        startGameBtn.style.display = '';
        document.getElementById('roll-dice-btn').disabled = false;
        if (previewAnimationId) cancelAnimationFrame(previewAnimationId);
        previewAnimationFrame = 0;
        previewAnimationTimer = 0;
        previewAnimationId = null;
        previewLastFrameTime = 0;
        previewAccumulator = 0;
        previewAnimationLoop();
        setupCustomizationControls();
    });
    document.getElementById('back-to-select-btn').addEventListener('click', () => {
        cancelAnimationFrame(previewAnimationId);
        showCharacterSelection();
    });
    document.getElementById('start-game-btn').addEventListener('click', async (e) => {
        if (isGameActive) return;
        const name = document.getElementById('character-name').value.trim();
        if (!name) { showNotification("Please enter a name.", 'error'); return; }
        if (name.length > 16) { showNotification("Name cannot be longer than 16 characters.", 'error'); return; }
        if (getSavedCharacters()[name]) { showNotification("A character with that name already exists locally.", 'error'); return; }
        
        // Check if name is taken in the global database
        if (typeof isCharacterNameTaken === 'function') {
            try {
                const result = await isCharacterNameTaken(name);
                if (result.taken) {
                    // Show the name taken popup under character creation
                    showNameTakenMessage(name);
                    return;
                }
            } catch (err) {
                console.warn('Could not check database for character name:', err);
            }
        }

        const startBtn = document.getElementById('start-game-btn');
        startBtn.blur();
        startBtn.disabled = true;
        startBtn.style.display = 'none';

        cancelAnimationFrame(previewAnimationId);
        
        // Fade to black
        const fadeOverlay = document.getElementById('fade-overlay');
        fadeOverlay.style.opacity = ''; // Clear any inline styles
        fadeOverlay.classList.add('fade-to-black');
        
        // After fade to black completes, start game and fade in with welcome popup
        setTimeout(() => {
            createCharacter(name);
            saveCharacter();
            startGame(true);
            
            // Fade from black
            fadeOverlay.classList.remove('fade-to-black');
            fadeOverlay.classList.add('fade-from-black');
            
            // Show welcome popup after fade in completes
            setTimeout(() => {
                fadeOverlay.classList.remove('fade-from-black');
                
                // Show welcome popup
                const welcomePopup = document.getElementById('welcome-popup');
                if (welcomePopup) {
                    welcomePopup.style.display = 'block';
                    console.log('Welcome popup shown');
                } else {
                    console.error('Welcome popup element not found!');
                }
            }, 300);
        }, 300);
    });

    // Welcome popup close button
    document.getElementById('welcome-close-btn').addEventListener('click', () => {
        const welcomePopup = document.getElementById('welcome-popup');
        welcomePopup.style.display = 'none';
    });

    // --- Settings Menu Listeners ---
    const settingsContent = document.getElementById('settings-content');
    settingsContent.addEventListener('click', (e) => {
        if (e.target.matches('.tab-button') && !e.target.classList.contains('active')) {
            const tab = e.target.dataset.tab;
            settingsContent.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            settingsContent.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });
            const activeContent = document.getElementById(`settings-${tab}-content`);
            if (activeContent) {
                activeContent.style.display = 'block';
                activeContent.classList.add('active');
            }
            
            // Update gamepad UI when controls or gamepad tab is opened
            if (tab === 'controls') {
                updateGamepadSettingsUI();
            } else if (tab === 'gamepad') {
                updateGamepadDetailedUI();
            }
        }
    });
    const bgmSlider = document.getElementById('bgm-volume-slider');
    const sfxSlider = document.getElementById('sfx-volume-slider');
    const bgmMuteBtn = document.getElementById('bgm-mute-btn');
    const sfxMuteBtn = document.getElementById('sfx-mute-btn');
    if (bgmSlider) bgmSlider.addEventListener('input', (e) => {
        bgmVolume = parseFloat(e.target.value);
        if (bgmVolume > 0) lastBgmVolume = bgmVolume;
        if (typeof applyAudioSettings === 'function') applyAudioSettings();
    });
    if (sfxSlider) sfxSlider.addEventListener('input', (e) => {
        sfxVolume = parseFloat(e.target.value);
        if (sfxVolume > 0) lastSfxVolume = sfxVolume;
        if (typeof applyAudioSettings === 'function') applyAudioSettings();
    });
    if (bgmMuteBtn) bgmMuteBtn.addEventListener('click', toggleBgm);
    if (sfxMuteBtn) sfxMuteBtn.addEventListener('click', toggleSfx);
    document.getElementById('reset-windows-btn').addEventListener('click', () => {
        localStorage.removeItem('evergreenRPG_windowPositions');
        windowPositions = {};
        document.querySelectorAll('.window').forEach(win => {
            if (win.id !== 'controls-popup') {
                win.style.left = ''; win.style.top = ''; win.style.transform = '';
            }
        });
        addChatMessage("Window positions reset.", 'success');
    });
    
    // Ghost Players toggle
    const ghostPlayersToggle = document.getElementById('ghost-players-toggle');
    if (ghostPlayersToggle) {
        // Load saved preference
        const savedPref = localStorage.getItem('evergreenRPG_ghostPlayersEnabled');
        if (savedPref !== null) {
            ghostPlayersToggle.checked = savedPref === 'true';
        }
        
        // Apply initial state
        if (!ghostPlayersToggle.checked && typeof cleanupGhostPlayers === 'function') {
            cleanupGhostPlayers();
        }
        
        ghostPlayersToggle.addEventListener('change', () => {
            const enabled = ghostPlayersToggle.checked;
            localStorage.setItem('evergreenRPG_ghostPlayersEnabled', enabled);
            
            if (enabled) {
                // Re-enable ghost players - spawn some on current map
                if (typeof spawnGhostPlayersOnMap === 'function') {
                    spawnGhostPlayersOnMap();
                }
                addChatMessage("Ghost players enabled.", 'success');
            } else {
                // Disable ghost players - remove all from the game
                if (typeof cleanupGhostPlayers === 'function') {
                    cleanupGhostPlayers();
                }
                addChatMessage("Ghost players disabled.", 'info');
            }
        });
    }
    
    document.getElementById('fullscreen-btn').addEventListener('click', () => {
        if (!document.fullscreenElement) {
            gameContainer.requestFullscreen().catch(err => alert(`Error: ${err.message}`));
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    });
    // REPLACE the existing listener for the main-menu-btn
    document.getElementById('main-menu-btn').addEventListener('click', async () => {
        // Save locally first (this always works)
        saveCharacter();
        
        // Firebase operations - don't block on these, use fire-and-forget with timeout
        // This ensures Save & Quit works even if Firebase quota is exceeded
        const firebaseTimeout = (promise, ms = 3000) => {
            return Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), ms))
            ]).catch(err => console.warn('Firebase operation failed:', err.message));
        };
        
        // Submit ranking to Firebase (non-blocking, 3s timeout)
        if (typeof submitRanking === 'function') {
            firebaseTimeout(submitRanking());
        }
        
        // Go offline (non-blocking, 3s timeout)
        if (typeof goOffline === 'function') {
            firebaseTimeout(goOffline());
        }
        
        // Disconnect from global chat (synchronous, always works)
        if (typeof disconnectGlobalChat === 'function') {
            disconnectGlobalChat();
        }

        // Fade to black
        const fadeOverlay = document.getElementById('fade-overlay');
        fadeOverlay.style.opacity = ''; // Clear any inline styles
        fadeOverlay.classList.add('fade-to-black');

        // After fade to black completes, return to main menu
        setTimeout(() => {
            // --- THIS IS THE FIX ---
            // Clear the player's buffs array
            if (player && player.buffs) {
                player.buffs = [];
            }
            // Clear the buff UI display
            const buffContainer = document.getElementById('buff-container');
            const buffEffectContainer = document.getElementById('player-buff-effects');
            if (buffContainer) buffContainer.innerHTML = '';
            if (buffEffectContainer) buffEffectContainer.innerHTML = '';
            
            // Clean up boss/elite HP bars
            if (typeof removeMiniBossHPBar === 'function') {
                removeMiniBossHPBar();
            }
            if (typeof removeEliteMonsterHPBar === 'function') {
                removeEliteMonsterHPBar();
            }
            // Also clear any world boss UI
            const worldBossUI = document.getElementById('world-boss-ui');
            if (worldBossUI) worldBossUI.remove();
            // --- END OF FIX ---

            showStartScreen();

            // Fade from black
            fadeOverlay.classList.remove('fade-to-black');
            fadeOverlay.classList.add('fade-from-black');

            // Clear fade classes after fade in completes
            setTimeout(() => {
                fadeOverlay.classList.remove('fade-from-black');
            }, 300);
        }, 300);
    });
    document.getElementById('resume-btn').addEventListener('click', () => {
        saveCharacter();
        addChatMessage("Game Saved!", 'success');
        toggleWindow(settingsMenu);
    });

    gachaponWindowElement = document.getElementById('gachapon-window');
    document.getElementById('gachapon-spin-btn').addEventListener('click', spinGachaponWheel);

    // --- Other UI Listeners ---
    document.getElementById('confirm-enhance-btn').addEventListener('click', () => performEnhancement());
    document.getElementById('cancel-enhance-btn').addEventListener('click', () => toggleWindow(enhancementConfirmModal));

    // --- THIS IS THE FIX for the equipment enhance button ---
    document.getElementById('equipment-enhance-btn').addEventListener('click', () => {
        if (!selectedEquipmentSlot) return;
        openEnhancementConfirmation({ source: 'equipment', slot: selectedEquipmentSlot, isCosmetic: false });
    });
    // --- END OF FIX ---

    document.getElementById('toggle-minimap-btn').addEventListener('click', (e) => {
        const minimap = document.getElementById('minimap');
        minimap.classList.toggle('collapsed');
        e.target.textContent = minimap.classList.contains('collapsed') ? '+' : '-';
    });

    // --- Hotkey Button Event Listeners ---
    document.getElementById('hotkey-k').addEventListener('click', () => {
        console.log('[UI Debug] hotkey-k clicked! Opening skills window...');
        toggleWindow(skillTreeElement, updateSkillTreeUI);
    });
    document.getElementById('hotkey-s').addEventListener('click', () => {
        console.log('[UI Debug] hotkey-s clicked! Opening stats window...');
        toggleWindow(statWindowElement, updateStatWindowUI);
    });
    document.getElementById('hotkey-a').addEventListener('click', () => {
        console.log('[UI Debug] hotkey-a clicked! Opening achievements window...');
        toggleWindow(achievementWindow, updateAchievementUI);
    });
    document.getElementById('hotkey-b').addEventListener('click', () => {
        console.log('[UI Debug] hotkey-b clicked! Opening bestiary window...');
        toggleWindow(bestiaryWindow, updateBestiaryUI);
    });
    document.getElementById('hotkey-r').addEventListener('click', () => {
        console.log('[UI Debug] hotkey-r clicked! Opening rankings window...');
        toggleWindow(rankingsWindow, updateRankingsUI);
    });
    document.getElementById('hotkey-settings').addEventListener('click', () => {
        const updateFunction = () => {
            if (typeof keyMappingManager !== 'undefined' && typeof keyMappingManager.updateUI === 'function') {
                keyMappingManager.updateUI();
            }
            updateGamepadSettingsUI();
        };
        toggleWindow(settingsMenu, updateFunction);
    });
    document.getElementById('open-quest-helper-btn').addEventListener('click', () => toggleWindow(questHelperElement, updateQuestHelperUI));

    // --- Gamepad Settings Event Listeners ---
    const resetGamepadBtn = document.getElementById('reset-gamepad-btn');
    const testGamepadBtn = document.getElementById('test-gamepad-btn');
    
    if (resetGamepadBtn) {
        resetGamepadBtn.addEventListener('click', () => {
            if (typeof gamepadManager !== 'undefined' && gamepadManager) {
                gamepadManager.resetToDefaults();
                updateGamepadSettingsUI();
                addChatMessage("Gamepad mappings reset to defaults.", 'success');
                playSound('pickup');
            }
        });
    }
    
    if (testGamepadBtn) {
        testGamepadBtn.addEventListener('click', () => {
            window.open('gamepad-test.html', '_blank', 'width=800,height=600');
        });
    }
    
    // Delegate event listener for dynamically created remap buttons (old system)
    const gamepadMappingList = document.getElementById('gamepad-mapping-list');
    if (gamepadMappingList) {
        gamepadMappingList.addEventListener('click', (e) => {
            if (e.target.classList.contains('remap-gamepad-btn')) {
                const buttonIndex = parseInt(e.target.dataset.button);
                openGamepadRemapDialog(buttonIndex);
            }
        });
    }
    
    // Delegate event listener for new dropdown-based gamepad remapping
    const gamepadDetailedList = document.getElementById('gamepad-detailed-mapping-list');
    if (gamepadDetailedList) {
        gamepadDetailedList.addEventListener('change', (e) => {
            if (e.target.classList.contains('gamepad-action-select')) {
                const buttonIndex = parseInt(e.target.dataset.button);
                const newAction = e.target.value === 'null' ? null : e.target.value;
                
                if (typeof gamepadManager !== 'undefined' && gamepadManager) {
                    gamepadManager.buttonMap[buttonIndex] = newAction;
                    gamepadManager.saveButtonMap();
                    checkGamepadDuplicates();
                    
                    if (typeof showNotification === 'function') {
                        const buttonName = gamepadManager.getButtonName(buttonIndex);
                        const actionName = gamepadManager.getActionName(newAction);
                        showNotification(`${buttonName} → ${actionName}`, 'success');
                    }
                    if (typeof playSound === 'function') {
                        playSound('pickup');
                    }
                }
            }
        });
    }
    
    // Reset button for new gamepad tab
    const resetGamepadDetailedBtn = document.getElementById('reset-gamepad-detailed-btn');
    if (resetGamepadDetailedBtn) {
        resetGamepadDetailedBtn.addEventListener('click', () => {
            if (typeof gamepadManager !== 'undefined' && gamepadManager) {
                gamepadManager.resetToDefaults();
                updateGamepadDetailedUI();
                if (typeof showNotification === 'function') {
                    showNotification('Gamepad controls reset to defaults', 'success');
                }
            }
        });
    }
    
    // Test gamepad button for new tab
    const testGamepadDetailedBtn = document.getElementById('test-gamepad-detailed-btn');
    if (testGamepadDetailedBtn) {
        testGamepadDetailedBtn.addEventListener('click', () => {
            window.open('gamepad-test.html', '_blank', 'width=800,height=600');
        });
    }

    // --- Gamepad Hotbar Assignment Menu ---
    window.showGamepadHotbarMenu = function(itemInfo) {
        const menu = document.getElementById('gamepad-hotbar-menu');
        const backdrop = document.getElementById('gamepad-hotbar-menu-backdrop');
        const slotsContainer = document.getElementById('hotbar-menu-slots');
        
        if (!menu || !slotsContainer || !backdrop) return;
        
        // Store the item being assigned
        menu.dataset.itemName = itemInfo.name;
        menu.dataset.itemType = itemInfo.type;
        
        // Clear previous slots
        slotsContainer.innerHTML = '';
        
        // Determine how many slots to show (6 for gamepad, 12 for keyboard)
        const isGamepadMode = document.body.classList.contains('gamepad-active');
        const numSlots = isGamepadMode ? 6 : 12;
        
        // Create slot buttons
        for (let i = 0; i < numSlots; i++) {
            const slotDiv = document.createElement('div');
            slotDiv.className = 'hotbar-menu-slot';
            slotDiv.dataset.slotIndex = i;
            
            // Top section: Slot number and button mapping
            const slotHeader = document.createElement('div');
            slotHeader.className = 'hotbar-menu-slot-header';
            
            const slotNumber = document.createElement('div');
            slotNumber.className = 'hotbar-menu-slot-number';
            slotNumber.textContent = `Slot ${i + 1}`;
            
            // Show gamepad button mapping for this slot
            const buttonMapping = document.createElement('div');
            buttonMapping.className = 'hotbar-menu-slot-button';
            if (isGamepadMode) {
                // For gamepad: Slot 1=LB, 2=RB, 3=RT, 4=LT, 5=L3, 6=R3
                const buttonNames = ['LB/L1', 'RB/R1', 'RT/R2', 'LT/L2', 'L3', 'R3'];
                buttonMapping.textContent = buttonNames[i] || '';
            } else {
                // For keyboard: slots 1-12 map to keys 1-0, -, =
                const keyNames = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
                buttonMapping.textContent = keyNames[i] || '';
            }
            
            slotHeader.appendChild(slotNumber);
            slotHeader.appendChild(buttonMapping);
            
            // Middle section: Icon display
            const iconContainer = document.createElement('div');
            iconContainer.className = 'hotbar-menu-slot-icon';
            
            if (player.hotbar[i]) {
                const item = player.hotbar[i];
                // Render the icon using the same system as the hotbar
                if (item.type === 'skill') {
                    const iconData = spriteData.skillIcons?.icons?.[item.name];
                    if (iconData) {
                        const frameWidth = spriteData.skillIcons.frameWidth;
                        const scale = 3;
                        iconContainer.innerHTML = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.skillIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center;"></div>`;
                    }
                } else if (item.type === 'item') {
                    const iconData = spriteData.dropIcons?.icons?.[item.name];
                    if (iconData) {
                        const frameWidth = spriteData.dropIcons.frameWidth;
                        const scale = 3;
                        iconContainer.innerHTML = `<div class="pixel-art" style="width: ${frameWidth}px; height: ${frameWidth}px; background-image: url(${artAssets.dropIcons}); background-position: -${iconData.x}px -${iconData.y}px; transform: scale(${scale}); transform-origin: center;"></div>`;
                    }
                }
            }
            
            // Bottom section: Current item name
            const currentItem = document.createElement('div');
            currentItem.className = 'hotbar-menu-slot-current';
            
            if (player.hotbar[i]) {
                currentItem.textContent = player.hotbar[i].name;
            } else {
                currentItem.textContent = 'Empty';
            }
            
            slotDiv.appendChild(slotHeader);
            slotDiv.appendChild(iconContainer);
            slotDiv.appendChild(currentItem);
            
            // Click handler
            slotDiv.addEventListener('click', (e) => {
                console.log('[Hotbar Menu] Slot clicked:', i, 'Event:', e);
                const itemToAssign = {
                    name: menu.dataset.itemName,
                    type: menu.dataset.itemType
                };
                handleHotbarDrop(itemToAssign, i);
                menu.style.display = 'none';
                backdrop.style.display = 'none';
                
                if (typeof showNotification === 'function') {
                    showNotification(`${itemToAssign.name} assigned to slot ${i + 1}`, 'success');
                }
                if (typeof playSound === 'function') {
                    playSound('pickup');
                }
            });
            
            // Add mouseenter/mouseleave for hover effect (works with virtual mouse)
            slotDiv.addEventListener('mouseenter', () => {
                slotDiv.classList.add('selected');
            });
            slotDiv.addEventListener('mouseleave', () => {
                slotDiv.classList.remove('selected');
            });
            
            slotsContainer.appendChild(slotDiv);
        }
        
        // Show the backdrop and menu
        backdrop.style.display = 'block';
        menu.style.display = 'block';
        console.log('[Hotbar Menu] Menu displayed with', numSlots, 'slots');
        
        // Close menu on B button (button 1) or Escape
        const closeHandler = (e) => {
            if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') {
                menu.style.display = 'none';
                backdrop.style.display = 'none';
                document.removeEventListener('keydown', closeHandler);
            }
        };
        document.addEventListener('keydown', closeHandler);
        
        // Also close when clicking the backdrop
        backdrop.addEventListener('click', () => {
            menu.style.display = 'none';
            backdrop.style.display = 'none';
        }, { once: true });
        
        // Gamepad B button handler
        if (typeof gamepadManager !== 'undefined' && gamepadManager) {
            const checkBButton = () => {
                if (menu.style.display === 'none') return;
                
                if (gamepadManager.isButtonPressed(1)) { // B button
                    menu.style.display = 'none';
                    backdrop.style.display = 'none';
                    return;
                }
                
                requestAnimationFrame(checkBButton);
            };
            checkBButton();
        }
    };

    // --- Final Initializations ---
    setTimeout(() => {
        setupMinimapResize();
        setupChatLogDragScroll();
        setupChatLogResize();
        ensureTooltipOutsideScaling();
        updateNotificationContainerPosition();
    }, 100);
    updateGameClockUI();
    
    // --- Hair Debug System ---
    let hairDebugEnabled = false;
    const hairDebugPanel = document.getElementById('hair-debug-panel');
    const hairDebugContent = document.getElementById('hair-debug-content');
    
    // Toggle debug panel with F9 key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F9') {
            hairDebugEnabled = !hairDebugEnabled;
            if (hairDebugPanel) {
                hairDebugPanel.style.display = hairDebugEnabled ? 'block' : 'none';
            }
            if (hairDebugEnabled) {
                updateHairDebugDisplay();
            }
        }
    });
    
    // Update debug display
    function updateHairDebugDisplay() {
        if (!hairDebugEnabled || !hairDebugContent) return;
        
        let html = '<div style="margin-bottom: 8px; border-bottom: 1px solid #0f0; padding-bottom: 5px;">';
        html += '<div style="color: #fff;">RENDERED IN-GAME:</div>';
        if (window.debugHairRendered) {
            html += `<div>Index: ${window.debugHairRendered.hairIndex}</div>`;
            html += `<div>Name: ${window.debugHairRendered.hairName}</div>`;
            html += `<div>Sprite Y: ${window.debugHairRendered.hairY}</div>`;
        } else {
            html += '<div style="color: #f00;">Not yet rendered</div>';
        }
        html += '</div>';
        
        if (debugHairInfo) {
            html += '<div style="margin-bottom: 8px; border-bottom: 1px solid #0f0; padding-bottom: 5px;">';
            html += '<div style="color: #fff;">APPEARANCE WINDOW:</div>';
            html += `<div>Index: ${debugHairInfo.hairIndex}</div>`;
            html += `<div>Customization Name: ${debugHairInfo.customizationName}</div>`;
            html += `<div>Sprite Name: ${debugHairInfo.spriteName}</div>`;
            html += `<div>Sprite Y: ${debugHairInfo.spriteY}</div>`;
            html += `<div style="color: ${debugHairInfo.arraysMatch ? '#0f0' : '#f00'};">Arrays Match: ${debugHairInfo.arraysMatch}</div>`;
            html += '</div>';
            
            html += '<div>';
            html += `<div>Total Customization: ${debugHairInfo.totalCustomizationHairs}</div>`;
            html += `<div>Total Sprite Data: ${debugHairInfo.totalSpriteHairs}</div>`;
            html += `<div style="color: ${debugHairInfo.totalCustomizationHairs === debugHairInfo.totalSpriteHairs ? '#0f0' : '#f00'};">Lengths Match: ${debugHairInfo.totalCustomizationHairs === debugHairInfo.totalSpriteHairs}</div>`;
            html += '</div>';
        } else {
            html += '<div style="color: #888;">Appearance window not opened yet</div>';
        }
        
        hairDebugContent.innerHTML = html;
    }
    
    // Update debug display every frame when enabled
    setInterval(() => {
        if (hairDebugEnabled) {
            updateHairDebugDisplay();
        }
    }, 100);
});