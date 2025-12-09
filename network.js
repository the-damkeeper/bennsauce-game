 // Firebase Configuration
// Replace these values with your actual Firebase project credentials
// Get these from: Firebase Console > Project Settings > General > Your apps > Web app

// Shared utility functions (defined here since network.js loads first)
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
window.capitalize = capitalize;

// Class colors for all jobs (shared across UI components)
const classColors = {
    // Base classes
    'Beginner': '#95a5a6',
    'Warrior': '#e74c3c',
    'Magician': '#3498db',
    'Bowman': '#27ae60',
    'Thief': '#9b59b6',
    'Pirate': '#f39c12',
    // 2nd job - Warriors
    'Fighter': '#e74c3c',
    'Spearman': '#c0392b',
    // 2nd job - Magicians
    'Cleric': '#5dade2',
    'Wizard': '#2980b9',
    // 2nd job - Bowmen
    'Hunter': '#27ae60',
    'Crossbowman': '#1e8449',
    // 2nd job - Thieves
    'Assassin': '#9b59b6',
    'Bandit': '#8e44ad',
    // 2nd job - Pirates
    'Brawler': '#f39c12',
    'Gunslinger': '#d68910'
};
window.classColors = classColors;

const firebaseConfig = {
    apiKey: "AIzaSyAIw5ox2HDWefSMFmJAZvX47jx88eYXmM4",
    authDomain: "bennsauce.firebaseapp.com",
    projectId: "bennsauce",
    storageBucket: "bennsauce.firebasestorage.app",
    messagingSenderId: "304261842788",
    appId: "1:304261842788:web:f52c865a7ee33d76761c71",
};

// Initialize Firebase
let db = null;
let auth = null;
let currentUser = null;
let rankingsInitialized = false;

async function initializeFirebase() {
    try {
        // Check if Firebase is already loaded
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded. Make sure to include Firebase scripts in index.html');
            return false;
        }

        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        // Initialize Firestore
        db = firebase.firestore();
        
        // Initialize Auth
        if (firebase.auth) {
            auth = firebase.auth();
            // Listen for auth state changes
            auth.onAuthStateChanged((user) => {
                currentUser = user;
                if (user) {
                    console.log('User signed in:', user.email || user.uid);
                    if (typeof updateAccountUI === 'function') {
                        updateAccountUI(true, user.email || 'Guest');
                    }
                } else {
                    console.log('User signed out');
                    if (typeof updateAccountUI === 'function') {
                        updateAccountUI(false);
                    }
                }
            });
        }
        
        rankingsInitialized = true;
        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return false;
    }
}

// =============================================
// ACCOUNT SYSTEM - Email/Password Authentication
// =============================================

/**
 * Register a new account with email and password
 */
async function registerAccount(email, password) {
    // Initialize Firebase if not already done
    if (!auth) {
        await initializeFirebase();
    }
    
    if (!auth) {
        return { success: false, error: 'Authentication not initialized. Make sure firebase-auth-compat.js is loaded.' };
    }
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Create user document in Firestore
        await db.collection('users').doc(user.uid).set({
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Generate and store recovery code
        const recoveryCode = generateRecoveryCode();
        await db.collection('users').doc(user.uid).update({
            recoveryCode: recoveryCode
        });
        
        if (typeof showNotification === 'function') {
            showNotification('Account created successfully!', 'legendary');
        }
        
        // Automatically migrate local characters to the new account
        setTimeout(async () => {
            await migrateLocalCharactersToCloud();
        }, 500);
        
        return { success: true, user: user, recoveryCode: recoveryCode };
    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = 'Registration failed';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Email already in use';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password must be at least 6 characters';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        }
        return { success: false, error: errorMessage };
    }
}

/**
 * Login with email and password
 */
async function loginAccount(email, password) {
    // Initialize Firebase if not already done
    if (!auth) {
        await initializeFirebase();
    }
    
    if (!auth) {
        return { success: false, error: 'Authentication not initialized. Make sure firebase-auth-compat.js is loaded.' };
    }
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update last login
        await db.collection('users').doc(user.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        if (typeof showNotification === 'function') {
            showNotification('Logged in successfully!', 'rare');
        }
        
        // Automatically sync local characters to cloud on login
        setTimeout(async () => {
            await migrateLocalCharactersToCloud();
        }, 500);
        
        return { success: true, user: user };
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Invalid email or password';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many attempts. Try again later';
        }
        return { success: false, error: errorMessage };
    }
}

/**
 * Logout current user
 */
async function logoutAccount() {
    if (!auth) {
        await initializeFirebase();
    }
    if (!auth) return { success: false, error: 'Authentication not initialized' };
    
    try {
        await auth.signOut();
        if (typeof showNotification === 'function') {
            showNotification('Logged out', 'system');
        }
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: 'Logout failed' };
    }
}

/**
 * Check if user is logged in
 */
function isLoggedIn() {
    return currentUser !== null;
}

/**
 * Get current user ID (for saving/loading)
 */
function getCurrentUserId() {
    return currentUser ? currentUser.uid : null;
}

// =============================================
// RECOVERY CODE SYSTEM - For users without accounts
// =============================================

/**
 * Generate a unique recovery code (16 characters, easy to type)
 */
function generateRecoveryCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0/O, 1/I/L)
    let code = '';
    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) code += '-'; // Add dashes for readability
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code; // Format: XXXX-XXXX-XXXX-XXXX
}

/**
 * Create a recovery code for guest player (no account needed)
 * Saves character data to Firestore under this code
 */
async function createRecoveryCode() {
    // Initialize Firebase if not already done
    if (!db) {
        await initializeFirebase();
    }
    
    if (!db || !player) {
        return { success: false, error: 'Cannot create recovery code' };
    }
    
    try {
        const recoveryCode = generateRecoveryCode();
        
        // Check if code already exists (extremely unlikely but be safe)
        const existing = await db.collection('recoveryCodes').doc(recoveryCode).get();
        if (existing.exists) {
            // Regenerate if collision
            return createRecoveryCode();
        }
        
        // Save character data under recovery code
        const characterData = getCharacterDataForCloud();
        
        await db.collection('recoveryCodes').doc(recoveryCode).set({
            characterData: characterData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Store recovery code locally
        localStorage.setItem('evergreenRPG_recoveryCode', recoveryCode);
        
        if (typeof showNotification === 'function') {
            showNotification('Recovery code created! Write it down!', 'legendary');
        }
        return { success: true, code: recoveryCode };
    } catch (error) {
        console.error('Error creating recovery code:', error);
        return { success: false, error: 'Failed to create recovery code' };
    }
}

/**
 * Create a recovery code for a specific character (passed as data)
 * Used when player hasn't loaded a character yet
 */
async function createRecoveryCodeForCharacter(characterData) {
    // Initialize Firebase if not already done
    if (!db) {
        await initializeFirebase();
    }
    
    if (!db || !characterData) {
        return { success: false, error: 'Cannot create recovery code' };
    }
    
    try {
        const recoveryCode = generateRecoveryCode();
        
        // Check if code already exists (extremely unlikely but be safe)
        const existing = await db.collection('recoveryCodes').doc(recoveryCode).get();
        if (existing.exists) {
            // Regenerate if collision
            return createRecoveryCodeForCharacter(characterData);
        }
        
        // Prepare character data for cloud (clean undefined, convert Sets)
        const cleanData = prepareCharacterForCloud(characterData);
        
        await db.collection('recoveryCodes').doc(recoveryCode).set({
            characterData: cleanData,
            characterName: cleanData.name || 'Unknown',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Store recovery code locally
        localStorage.setItem('evergreenRPG_recoveryCode', recoveryCode);
        
        return { success: true, code: recoveryCode };
    } catch (error) {
        console.error('Error creating recovery code:', error);
        return { success: false, error: 'Failed to create recovery code' };
    }
}

/**
 * Update character data for existing recovery code
 */
async function updateRecoveryCode(recoveryCode) {
    // Initialize Firebase if not already done
    if (!db) {
        await initializeFirebase();
    }
    
    if (!db || !player) {
        return { success: false, error: 'Cannot update recovery code' };
    }
    
    try {
        const docRef = db.collection('recoveryCodes').doc(recoveryCode);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            return { success: false, error: 'Recovery code not found' };
        }
        
        const characterData = getCharacterDataForCloud();
        
        await docRef.update({
            characterData: characterData,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error updating recovery code:', error);
        return { success: false, error: 'Failed to update recovery code' };
    }
}

/**
 * Load character data from recovery code
 */
async function loadFromRecoveryCode(recoveryCode) {
    // Initialize Firebase if not already done
    if (!db) {
        await initializeFirebase();
    }
    
    if (!db) {
        return { success: false, error: 'Database not initialized' };
    }
    
    // Normalize code (uppercase, remove spaces)
    recoveryCode = recoveryCode.toUpperCase().replace(/\s/g, '');
    
    try {
        const doc = await db.collection('recoveryCodes').doc(recoveryCode).get();
        
        if (!doc.exists) {
            return { success: false, error: 'Invalid recovery code' };
        }
        
        const data = doc.data();
        
        // Store recovery code locally for future saves
        localStorage.setItem('evergreenRPG_recoveryCode', recoveryCode);
        
        if (typeof showNotification === 'function') {
            showNotification('Character data loaded!', 'legendary');
        }
        return { success: true, characterData: data.characterData };
    } catch (error) {
        console.error('Error loading from recovery code:', error);
        return { success: false, error: 'Failed to load character data' };
    }
}

/**
 * Get character data formatted for cloud save
 */
function getCharacterDataForCloud() {
    if (!player) return null;
    
    // Convert Sets to Arrays for JSON serialization
    const discoveredMaps = player.discoveredMaps instanceof Set 
        ? Array.from(player.discoveredMaps) 
        : (player.discoveredMaps || []);
    
    // Helper to remove undefined values (Firebase doesn't accept undefined)
    const cleanUndefined = (obj) => {
        const cleaned = {};
        for (const key in obj) {
            if (obj[key] !== undefined) {
                cleaned[key] = obj[key];
            }
        }
        return cleaned;
    };
    
    const data = {
        name: player.name || player.characterName || 'Adventurer',
        characterId: player.characterId || null, // Include character ID for syncing
        class: player.class || 'Warrior',
        level: player.level || 1,
        exp: player.exp || 0,
        maxExp: player.maxExp || 100,
        gold: player.gold || 0,
        hp: player.hp || 100,
        maxHp: player.maxHp || 100,
        mp: player.mp || 50,
        maxMp: player.maxMp || 50,
        ap: player.ap || 0,
        sp: player.sp || 0,
        beginnerSp: player.beginnerSp || 0,
        baseStats: player.baseStats || { str: 5, dex: 5, int: 5, luk: 5 },
        stats: player.stats || { defense: 0, critChance: 5, minCritDamage: 1.5, maxCritDamage: 2.5, accuracy: 5, avoidability: 5 },
        statPoints: player.statPoints || 0,
        abilities: player.abilities || [],
        hotbar: player.hotbar || [null, null, null, null, null, null, null, null, null, null, null, null],
        inventory: player.inventory || { equip: [], use: [], etc: [], cosmetic: [] },
        equipped: player.equipped || {},
        cosmeticEquipped: player.cosmeticEquipped || {},
        customization: player.customization || {},
        quests: player.quests || [],
        completedQuests: player.completedQuests || [],
        achievements: player.achievements || {},
        timePlayed: player.timePlayed || 0,
        totalMonstersKilled: player.totalMonstersKilled || 0,
        totalGoldEarned: player.totalGoldEarned || 0,
        highestDamage: player.highestDamage || 0,
        discoveredMaps: discoveredMaps,
        currentMapId: player.currentMapId || (typeof currentMapId !== 'undefined' ? currentMapId : 'ironHaven'),
        activePet: player.activePet || null,
        ownedPets: player.ownedPets || [],
        medals: player.medals || [],
        buffs: player.buffs || [],
        bestiary: player.bestiary || { monsterKills: {}, dropsFound: {}, firstKillTimestamp: {} },
        bestiaryRewards: player.bestiaryRewards || {},
        savedAt: new Date().toISOString()
    };
    
    return cleanUndefined(data);
}

/**
 * Apply loaded character data to player
 */
function applyCharacterData(data) {
    if (!data || !player) return false;
    
    try {
        player.name = data.name || player.name;
        player.class = data.class || player.class;
        player.level = data.level || 1;
        player.exp = data.exp || 0;
        player.maxExp = data.maxExp || 100;
        player.gold = data.gold || 0;
        player.hp = data.hp || player.hp;
        player.maxHp = data.maxHp || player.maxHp;
        player.mp = data.mp || player.mp;
        player.maxMp = data.maxMp || player.maxMp;
        player.ap = data.ap || 0;
        player.sp = data.sp || 0;
        player.beginnerSp = data.beginnerSp || 0;
        player.baseStats = data.baseStats || player.baseStats;
        
        // Restore stats with proper defaults
        if (data.stats) {
            player.stats = {
                ...player.stats,
                ...data.stats,
                defense: data.stats.defense ?? player.stats?.defense ?? 0,
                critChance: data.stats.critChance ?? player.stats?.critChance ?? 5,
                minCritDamage: data.stats.minCritDamage ?? player.stats?.minCritDamage ?? 1.5,
                maxCritDamage: data.stats.maxCritDamage ?? player.stats?.maxCritDamage ?? 2.5,
                accuracy: data.stats.accuracy ?? player.stats?.accuracy ?? 5,
                avoidability: data.stats.avoidability ?? player.stats?.avoidability ?? 5
            };
        }
        
        player.statPoints = data.statPoints || 0;
        player.abilities = data.abilities || [];
        player.hotbar = data.hotbar || player.hotbar;
        player.inventory = data.inventory || player.inventory;
        player.equipped = data.equipped || {};
        player.cosmeticEquipped = data.cosmeticEquipped || {};
        player.customization = data.customization || player.customization;
        player.quests = data.quests || [];
        player.completedQuests = data.completedQuests || [];
        player.achievements = data.achievements || {};
        player.timePlayed = data.timePlayed || 0;
        player.totalMonstersKilled = data.totalMonstersKilled || 0;
        player.totalGoldEarned = data.totalGoldEarned || 0;
        player.highestDamage = data.highestDamage || 0;
        player.discoveredMaps = new Set(data.discoveredMaps || []);
        player.activePet = data.activePet || null;
        player.ownedPets = data.ownedPets || [];
        player.medals = data.medals || [];
        player.buffs = data.buffs || [];
        player.bestiary = data.bestiary || player.bestiary;
        player.bestiaryRewards = data.bestiaryRewards || player.bestiaryRewards;
        
        // Ensure stats object exists before recalculating
        if (!player.stats) {
            player.stats = { defense: 0, critChance: 5, minCritDamage: 1.5, maxCritDamage: 2.5, accuracy: 5, avoidability: 5 };
        }
        
        // Recalculate stats
        if (typeof calculatePlayerStats === 'function') {
            calculatePlayerStats();
        }
        
        // Recalculate maxExp to ensure correct EXP curve
        if (typeof recalculateMaxExp === 'function') {
            recalculateMaxExp();
        }
        
        // Update UI
        if (typeof updateUI === 'function') {
            updateUI();
        }
        
        return true;
    } catch (error) {
        console.error('Error applying character data:', error);
        return false;
    }
}

// =============================================
// UNIQUE CHARACTER ID SYSTEM
// =============================================

/**
 * Generate a unique character ID
 */
function generateCharacterId() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `char_${timestamp}_${randomPart}`;
}

/**
 * Check if a character name already exists in the global database
 */
async function isCharacterNameTaken(name) {
    if (!db) {
        await initializeFirebase();
    }
    
    if (!db) {
        return { taken: false, error: 'Database not initialized' };
    }
    
    try {
        // Check the global character names collection
        const normalizedName = name.toLowerCase().trim();
        const doc = await db.collection('characterNames').doc(normalizedName).get();
        
        return { taken: doc.exists, error: null };
    } catch (error) {
        console.error('Error checking character name:', error);
        return { taken: false, error: 'Failed to check name availability' };
    }
}

/**
 * Reserve a character name and create the character in the global database
 * Returns the unique character ID
 */
async function registerNewCharacter(characterData) {
    if (!db) {
        await initializeFirebase();
    }
    
    if (!db || !characterData || !characterData.name) {
        return { success: false, error: 'Invalid character data' };
    }
    
    const characterName = characterData.name.trim();
    const normalizedName = characterName.toLowerCase();
    
    try {
        // First check if name is taken
        const nameDoc = await db.collection('characterNames').doc(normalizedName).get();
        if (nameDoc.exists) {
            return { success: false, error: 'name_taken', message: 'Character name is already taken' };
        }
        
        // Generate unique character ID
        const characterId = generateCharacterId();
        
        // Prepare the character data for storage
        const cleanData = prepareCharacterForCloud(characterData);
        cleanData.characterId = characterId;
        cleanData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        cleanData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
        
        // Use a batch write to ensure atomicity
        const batch = db.batch();
        
        // Reserve the name
        const nameRef = db.collection('characterNames').doc(normalizedName);
        batch.set(nameRef, {
            characterId: characterId,
            displayName: characterName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            ownerId: currentUser?.uid || null
        });
        
        // Create the global character document
        const charRef = db.collection('globalCharacters').doc(characterId);
        batch.set(charRef, cleanData);
        
        // If user is logged in, link to their account
        if (currentUser) {
            const userCharRef = db.collection('users').doc(currentUser.uid)
                .collection('characterIds').doc(characterId);
            batch.set(userCharRef, {
                characterId: characterId,
                characterName: characterName,
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        await batch.commit();
        
        console.log(`Registered new character "${characterName}" with ID: ${characterId}`);
        return { success: true, characterId: characterId };
    } catch (error) {
        console.error('Error registering character:', error);
        return { success: false, error: 'Failed to register character' };
    }
}

/**
 * Save character data to the global database by ID
 */
async function saveCharacterById(characterId, characterData) {
    if (!db) {
        await initializeFirebase();
    }
    
    if (!db || !characterId) {
        return { success: false, error: 'Invalid parameters' };
    }
    
    try {
        const cleanData = prepareCharacterForCloud(characterData);
        cleanData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
        
        await db.collection('globalCharacters').doc(characterId).update(cleanData);
        
        return { success: true };
    } catch (error) {
        console.error('Error saving character by ID:', error);
        return { success: false, error: 'Failed to save character' };
    }
}

/**
 * Load character data from the global database by ID
 * Always returns the latest version
 */
async function loadCharacterById(characterId) {
    if (!db) {
        await initializeFirebase();
    }
    
    if (!db || !characterId) {
        return { success: false, error: 'Invalid parameters' };
    }
    
    try {
        const doc = await db.collection('globalCharacters').doc(characterId).get();
        
        if (!doc.exists) {
            return { success: false, error: 'Character not found' };
        }
        
        return { success: true, characterData: doc.data() };
    } catch (error) {
        console.error('Error loading character by ID:', error);
        return { success: false, error: 'Failed to load character' };
    }
}

/**
 * Check if character name exists in cloud (for character creation)
 */
async function characterExistsInCloud(name) {
    const result = await isCharacterNameTaken(name);
    return result.taken;
}

/**
 * Get or create character ID for existing local character
 * Used when migrating local characters to the ID system
 */
async function ensureCharacterHasId(characterData) {
    if (!characterData || !characterData.name) {
        return { success: false, error: 'Invalid character data' };
    }
    
    // If character already has an ID, verify it exists in global DB
    if (characterData.characterId) {
        const result = await loadCharacterById(characterData.characterId);
        if (result.success) {
            return { success: true, characterId: characterData.characterId, isNew: false };
        }
        // ID doesn't exist in DB, need to re-register
    }
    
    // Try to register the character (will fail if name is taken by someone else)
    const result = await registerNewCharacter(characterData);
    if (result.success) {
        return { success: true, characterId: result.characterId, isNew: true };
    }
    
    // Name was taken - check if it's our character
    if (result.error === 'name_taken') {
        const normalizedName = characterData.name.toLowerCase().trim();
        const nameDoc = await db.collection('characterNames').doc(normalizedName).get();
        
        if (nameDoc.exists) {
            const existingId = nameDoc.data().characterId;
            const ownerId = nameDoc.data().ownerId;
            
            // If we own this character (or it has no owner), we can use it
            if (!ownerId || ownerId === currentUser?.uid) {
                return { success: true, characterId: existingId, isNew: false };
            }
        }
        
        return { success: false, error: 'name_taken', message: 'Character name is already taken by another player' };
    }
    
    return result;
}

// =============================================
// CLOUD SAVE - For logged in users
// =============================================

/**
 * Migrate all local characters to cloud when user logs in/registers
 */
async function migrateLocalCharactersToCloud() {
    if (!currentUser || !db) {
        return { success: false, error: 'Must be logged in' };
    }
    
    try {
        // Get all local characters
        const localCharacters = typeof getSavedCharacters === 'function' ? getSavedCharacters() : {};
        const characterNames = Object.keys(localCharacters);
        
        if (characterNames.length === 0) {
            console.log('No local characters to migrate');
            return { success: true, migrated: 0 };
        }
        
        let migratedCount = 0;
        
        for (const charName of characterNames) {
            const charData = localCharacters[charName];
            
            // Check if this character already exists in cloud
            const existingDoc = await db.collection('users').doc(currentUser.uid)
                .collection('characters').doc(charName).get();
            
            if (existingDoc.exists) {
                const cloudData = existingDoc.data().characterData;
                // Compare levels and playtime to decide which is more advanced
                const localLevel = charData.level || 1;
                const cloudLevel = cloudData?.level || 1;
                const localPlayTime = charData.timePlayed || 0;
                const cloudPlayTime = cloudData?.timePlayed || 0;
                
                // Only overwrite cloud if local is more advanced
                if (localLevel > cloudLevel || (localLevel === cloudLevel && localPlayTime > cloudPlayTime)) {
                    await saveCharacterToCloudByName(charName, charData);
                    migratedCount++;
                    console.log(`Migrated "${charName}" (local was more advanced)`);
                }
            } else {
                // No cloud version, save local to cloud
                await saveCharacterToCloudByName(charName, charData);
                migratedCount++;
                console.log(`Migrated new character "${charName}" to cloud`);
            }
        }
        
        if (migratedCount > 0 && typeof showNotification === 'function') {
            showNotification(`${migratedCount} character(s) synced to cloud!`, 'rare');
        }
        
        return { success: true, migrated: migratedCount };
    } catch (error) {
        console.error('Error migrating characters to cloud:', error);
        return { success: false, error: 'Failed to migrate characters' };
    }
}

/**
 * Save a character to cloud by name
 */
async function saveCharacterToCloudByName(characterName, characterData) {
    if (!currentUser || !db) {
        return { success: false, error: 'Must be logged in' };
    }
    
    try {
        // Clean the data for Firestore (remove undefined values, convert Sets)
        const cleanData = prepareCharacterForCloud(characterData);
        
        await db.collection('users').doc(currentUser.uid)
            .collection('characters').doc(characterName).set({
                characterData: cleanData,
                characterName: characterName,
                level: cleanData.level || 1,
                class: cleanData.class || 'Warrior',
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        return { success: true };
    } catch (error) {
        console.error('Error saving character to cloud:', error);
        return { success: false, error: 'Failed to save to cloud' };
    }
}

/**
 * Prepare character data for cloud (clean undefined values, convert Sets)
 */
function prepareCharacterForCloud(charData) {
    if (!charData) return null;
    
    // Deep clone to avoid modifying original
    const data = JSON.parse(JSON.stringify(charData, (key, value) => {
        // Convert Sets to Arrays
        if (value instanceof Set) {
            return Array.from(value);
        }
        // Remove undefined values
        if (value === undefined) {
            return null;
        }
        return value;
    }));
    
    // Ensure required fields have defaults
    data.name = data.name || data.characterName || 'Adventurer';
    data.class = data.class || 'Warrior';
    data.level = data.level || 1;
    data.exp = data.exp || 0;
    data.gold = data.gold || 0;
    data.hp = data.hp || 100;
    data.maxHp = data.maxHp || 100;
    data.mp = data.mp || 50;
    data.maxMp = data.maxMp || 50;
    
    // Ensure stats object exists
    if (!data.stats) {
        data.stats = { defense: 0, critChance: 5, minCritDamage: 1.5, maxCritDamage: 2.5, accuracy: 5, avoidability: 5 };
    }
    
    // Ensure baseStats exists
    if (!data.baseStats) {
        data.baseStats = { str: 5, dex: 5, int: 5, luk: 5 };
    }
    
    return data;
}

/**
 * Save current character to cloud (for logged in users)
 */
async function saveToCloud(slot = 0) {
    if (!currentUser || !db || !player || !player.name) {
        return { success: false, error: 'Must be logged in with a character loaded' };
    }
    
    try {
        // Save by character name, not slot
        const result = await saveCharacterToCloudByName(player.name, player);
        
        if (result.success && typeof showNotification === 'function') {
            showNotification('Saved to cloud!', 'rare');
        }
        return result;
    } catch (error) {
        console.error('Error saving to cloud:', error);
        return { success: false, error: 'Failed to save to cloud' };
    }
}

/**
 * List all cloud saves for current user
 */
async function listCloudSaves() {
    if (!currentUser || !db) {
        return { success: false, error: 'Must be logged in', saves: [] };
    }
    
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid)
            .collection('characters').get();
        
        const saves = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            saves.push({
                id: doc.id,
                name: data.characterName || data.characterData?.name || doc.id,
                level: data.level || data.characterData?.level || 1,
                class: data.class || data.characterData?.class || 'Unknown',
                lastUpdated: data.lastUpdated?.toDate?.() || null,
                characterData: data.characterData
            });
        });
        
        return { success: true, saves: saves };
    } catch (error) {
        console.error('Error listing cloud saves:', error);
        return { success: false, error: 'Failed to list saves', saves: [] };
    }
}

/**
 * Load character from cloud by name and apply to local
 */
async function loadFromCloud(characterNameOrSlot) {
    if (!currentUser || !db) {
        return { success: false, error: 'Must be logged in to load from cloud' };
    }
    
    try {
        // Handle old slot-based saves and new name-based saves
        const docId = typeof characterNameOrSlot === 'number' 
            ? `slot_${characterNameOrSlot}` 
            : characterNameOrSlot;
            
        const doc = await db.collection('users').doc(currentUser.uid)
            .collection('characters').doc(docId).get();
        
        if (!doc.exists) {
            return { success: false, error: 'No cloud save found' };
        }
        
        const data = doc.data();
        const characterData = data.characterData;
        
        if (!characterData) {
            return { success: false, error: 'Invalid cloud save data' };
        }
        
        // Also save to local storage so it appears in character select
        if (characterData.name && typeof getSavedCharacters === 'function' && typeof saveManager !== 'undefined') {
            const characters = getSavedCharacters();
            characters[characterData.name] = characterData;
            saveManager.saveCharacters(characters);
        }
        
        if (typeof showNotification === 'function') {
            showNotification('Loaded from cloud!', 'rare');
        }
        return { success: true, characterData: characterData };
    } catch (error) {
        console.error('Error loading from cloud:', error);
        return { success: false, error: 'Failed to load from cloud' };
    }
}

/**
 * Load cloud character by name
 */
async function loadCloudCharacterByName(characterName) {
    return loadFromCloud(characterName);
}

/**
 * List all cloud saves for current user
 */
async function listCloudSaves() {
    if (!currentUser || !db) {
        return { success: false, error: 'Must be logged in', saves: [] };
    }
    
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid)
            .collection('characters').get();
        
        const saves = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.characterData) {
                saves.push({
                    slot: doc.id,
                    name: data.characterData.name,
                    level: data.characterData.level,
                    class: data.characterData.class,
                    lastUpdated: data.lastUpdated?.toDate() || new Date()
                });
            }
        });
        
        return { success: true, saves: saves };
    } catch (error) {
        console.error('Error listing cloud saves:', error);
        return { success: false, error: 'Failed to list saves', saves: [] };
    }
}

// =============================================
// UI UPDATE HELPER
// =============================================

function updateAccountUI(loggedIn, email = '') {
    const accountBtn = document.getElementById('account-btn');
    const accountStatus = document.getElementById('account-status');
    
    if (accountBtn) {
        accountBtn.textContent = loggedIn ? 'Account' : 'Login';
    }
    if (accountStatus) {
        accountStatus.textContent = loggedIn ? email : 'Not logged in';
    }
}

// Make functions globally available
window.registerAccount = registerAccount;
window.loginAccount = loginAccount;
window.logoutAccount = logoutAccount;
window.isLoggedIn = isLoggedIn;
window.getCurrentUserId = getCurrentUserId;
window.createRecoveryCode = createRecoveryCode;
window.createRecoveryCodeForCharacter = createRecoveryCodeForCharacter;
window.updateRecoveryCode = updateRecoveryCode;
window.loadFromRecoveryCode = loadFromRecoveryCode;
window.saveToCloud = saveToCloud;
window.loadFromCloud = loadFromCloud;
window.listCloudSaves = listCloudSaves;
window.applyCharacterData = applyCharacterData;
window.getCharacterDataForCloud = getCharacterDataForCloud;
window.updateAccountUI = updateAccountUI;
window.migrateLocalCharactersToCloud = migrateLocalCharactersToCloud;
window.saveCharacterToCloudByName = saveCharacterToCloudByName;
window.loadCloudCharacterByName = loadCloudCharacterByName;
// New ID-based character system
window.isCharacterNameTaken = isCharacterNameTaken;
window.registerNewCharacter = registerNewCharacter;
window.saveCharacterById = saveCharacterById;
window.loadCharacterById = loadCharacterById;
window.characterExistsInCloud = characterExistsInCloud;
window.ensureCharacterHasId = ensureCharacterHasId;
window.generateCharacterId = generateCharacterId;

// Simple checksum to verify data integrity (not cryptographically secure, but deters basic cheating)
function generateChecksum(data) {
    const str = JSON.stringify(data) + "BennSauce2025"; // Secret salt
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}

// Verify checksum
function verifyChecksum(data, checksum) {
    return generateChecksum(data) === checksum;
}

/**
 * Validate player stats for obvious cheating
 * Returns { valid: boolean, reason: string }
 */
function validatePlayerStats() {
    if (!player) return { valid: false, reason: 'No player data' };
    
    const issues = [];
    
    // Level sanity checks
    if (player.level < 1 || player.level > 200) {
        issues.push('Invalid level');
    }
    
    // Time played vs level check (rough estimate: ~2 min per level minimum at low levels)
    // A level 50+ player should have at least ~30 minutes of playtime
    const minTimeForLevel = Math.max(0, (player.level - 1) * 30); // 30 seconds per level minimum
    if (player.level > 10 && (player.timePlayed || 0) < minTimeForLevel) {
        issues.push('Level too high for time played');
    }
    
    // Kill count vs level check
    // You need kills to level up - rough minimum of 5 kills per level
    const totalKills = player.bestiary?.monsterKills ? 
        Object.values(player.bestiary.monsterKills).reduce((sum, k) => sum + k, 0) : 0;
    const minKillsForLevel = Math.max(0, (player.level - 1) * 3);
    if (player.level > 5 && totalKills < minKillsForLevel) {
        issues.push('Not enough kills for level');
    }
    
    // Gold sanity check - max theoretical gold is bounded by kills
    // Average ~50 gold per kill at mid-levels, so max gold ≈ totalKills * 200 (generous upper bound)
    const maxReasonableGold = Math.max(100000, totalKills * 500);
    if (player.gold > maxReasonableGold && player.gold > 1000000) {
        issues.push('Gold exceeds reasonable bounds');
    }
    
    // Stat point validation
    // Each level gives 5 AP, so max AP spent should be (level-1) * 5
    const maxAP = (player.level - 1) * 5;
    const totalStatsSpent = (player.stats?.str || 0) + (player.stats?.dex || 0) + 
                           (player.stats?.int || 0) + (player.stats?.luk || 0) - 16; // Base is 4 each
    if (totalStatsSpent > maxAP + 50) { // +50 for potential equipment bonuses
        issues.push('Stats exceed available AP');
    }
    
    // Check for impossible negative values
    if (player.gold < 0 || player.exp < 0 || player.hp < 0 || player.mp < 0) {
        issues.push('Negative stat values detected');
    }
    
    // Check achievement count vs what's possible
    const maxAchievements = Object.keys(achievementData || {}).length;
    const completedAchievements = Object.keys(player.achievements?.completed || {}).length;
    if (completedAchievements > maxAchievements) {
        issues.push('More achievements than exist');
    }
    
    return {
        valid: issues.length === 0,
        reason: issues.join(', ') || 'Valid',
        issues: issues
    };
}

// Helper function to sort rankings by category
function sortRankings(rankings, category) {
    const sorted = [...rankings];
    switch (category) {
        case 'level':
            sorted.sort((a, b) => b.level - a.level);
            break;
        case 'kills':
            sorted.sort((a, b) => b.totalKills - a.totalKills);
            break;
        case 'gold':
            sorted.sort((a, b) => b.totalGold - a.totalGold);
            break;
        case 'achievements':
            sorted.sort((a, b) => b.achievementCount - a.achievementCount);
            break;
        case 'bestiary':
            sorted.sort((a, b) => b.bestiaryCompletion - a.bestiaryCompletion);
            break;
        case 'bosses':
            sorted.sort((a, b) => b.bossKills - a.bossKills);
            break;
        case 'combat':
            sorted.sort((a, b) => b.combatScore - a.combatScore);
            break;
        case 'guilds':
            sorted.sort((a, b) => b.totalCombatScore - a.totalCombatScore);
            break;
    }
    return sorted;
}

// ============================================
// GUILD RANKINGS SYSTEM
// ============================================

// Guild rankings cache
let guildRankingsCache = null;
let guildRankingsCacheTime = 0;
const GUILD_RANKINGS_CACHE_DURATION = 60000; // Cache for 60 seconds

/**
 * Update guild data in Firebase when a player's ranking is updated
 * This aggregates combat scores from all guild members
 */
async function updateGuildRanking() {
    console.log('[Guilds] updateGuildRanking called');
    
    if (!rankingsInitialized) {
        console.log('[Guilds] Firebase not initialized, initializing...');
        const initialized = await initializeFirebase();
        if (!initialized) {
            console.log('[Guilds] Failed to initialize Firebase');
            return false;
        }
    }
    
    if (!player || !player.name) {
        console.log('[Guilds] Skipping - no player:', player?.name);
        return false;
    }
    if (!player.guild || !player.guild.name) {
        console.log('[Guilds] Skipping - player not in guild');
        return false;
    }
    
    try {
        const guildName = player.guild.name;
        const guildIcon = player.guild.icon || 1;
        // Calculate combat score - function is in player.js which loads after network.js
        // so we need to check it exists first
        let playerCombatScore = 0;
        if (typeof calculateCombatScore === 'function') {
            playerCombatScore = calculateCombatScore();
        } else {
            console.warn('[Guilds] calculateCombatScore not available yet');
            // Fallback: estimate combat score from level
            playerCombatScore = (player.level || 1) * 100;
        }
        
        console.log('[Guilds] Updating guild:', guildName, 'Player:', player.name, 'Score:', playerCombatScore);
        
        // Get the guild document reference
        const guildRef = db.collection('guilds').doc(guildName);
        
        // Update the guild with this player's contribution
        await db.runTransaction(async (transaction) => {
            const guildDoc = await transaction.get(guildRef);
            
            let guildData;
            if (!guildDoc.exists) {
                console.log('[Guilds] Creating new guild document');
                guildData = {
                    name: guildName,
                    icon: guildIcon,
                    members: {},
                    totalCombatScore: 0,
                    memberCount: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                };
            } else {
                console.log('[Guilds] Updating existing guild document');
                guildData = guildDoc.data();
            }
            
            // Update this player's contribution
            if (!guildData.members) guildData.members = {};
            guildData.members[player.name] = {
                combatScore: playerCombatScore,
                level: player.level,
                class: player.class || 'Beginner',
                lastUpdated: Date.now()
            };
            
            // Recalculate totals
            guildData.totalCombatScore = Object.values(guildData.members)
                .reduce((sum, m) => sum + (m.combatScore || 0), 0);
            guildData.memberCount = Object.keys(guildData.members).length;
            guildData.icon = guildIcon;
            guildData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
            
            console.log('[Guilds] Final data:', { name: guildData.name, score: guildData.totalCombatScore, members: guildData.memberCount });
            
            transaction.set(guildRef, guildData, { merge: true });
        });
        
        // Clear cache so next fetch gets fresh data
        guildRankingsCache = null;
        guildRankingsCacheTime = 0;
        
        console.log(`[Guilds] Successfully updated guild ranking for ${guildName}`);
        return true;
    } catch (error) {
        console.error('[Guilds] Error updating guild ranking:', error);
        return false;
    }
}

/**
 * Remove a player from their guild's rankings (when leaving a guild)
 */
async function removePlayerFromGuildRanking(guildName, playerName) {
    if (!rankingsInitialized || !guildName || !playerName) return false;
    
    try {
        const guildRef = db.collection('guilds').doc(guildName);
        
        await db.runTransaction(async (transaction) => {
            const guildDoc = await transaction.get(guildRef);
            if (!guildDoc.exists) return;
            
            const guildData = guildDoc.data();
            if (!guildData.members || !guildData.members[playerName]) return;
            
            // Remove this player
            delete guildData.members[playerName];
            
            // Recalculate totals
            guildData.totalCombatScore = Object.values(guildData.members)
                .reduce((sum, m) => sum + (m.combatScore || 0), 0);
            guildData.memberCount = Object.keys(guildData.members).length;
            guildData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
            
            // If guild is now empty, delete it
            if (guildData.memberCount === 0) {
                transaction.delete(guildRef);
            } else {
                transaction.set(guildRef, guildData, { merge: true });
            }
        });
        
        // Clear cache
        guildRankingsCache = null;
        guildRankingsCacheTime = 0;
        
        console.log(`[Guilds] Removed ${playerName} from guild ${guildName}`);
        return true;
    } catch (error) {
        console.error('[Guilds] Error removing player from guild:', error);
        return false;
    }
}

/**
 * Update guild challenge progress when a monster is killed
 * @param {boolean} isBoss - Whether the killed monster was a boss
 */
async function updateGuildChallengeProgress(isBoss = false) {
    // Must be in a guild
    if (!player || !player.guild) return;
    
    const guildName = typeof player.guild === 'string' ? player.guild : player.guild.name;
    if (!guildName) return;
    
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) return;
    }
    
    try {
        const guildRef = db.collection('guilds').doc(guildName);
        
        // Use increment for atomic updates
        const updates = {
            weeklyKills: firebase.firestore.FieldValue.increment(1),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Also increment boss kills if applicable
        if (isBoss) {
            updates.dailyBossKills = firebase.firestore.FieldValue.increment(1);
        }
        
        await guildRef.update(updates);
        
        // Update local player guild data for UI
        if (typeof player.guild === 'object') {
            player.guild.weeklyKills = (player.guild.weeklyKills || 0) + 1;
            if (isBoss) {
                player.guild.dailyBossKills = (player.guild.dailyBossKills || 0) + 1;
            }
        }
        
        // Check if challenge was completed
        checkGuildChallengeCompletion(guildName);
        
    } catch (error) {
        // Silently fail - don't spam errors for every kill
        console.debug('[Guild Challenge] Update failed:', error.message);
    }
}

/**
 * Check if guild challenges were completed and award rewards
 */
async function checkGuildChallengeCompletion(guildName) {
    if (!guildName || !rankingsInitialized) return;
    
    try {
        const guildRef = db.collection('guilds').doc(guildName);
        const guildDoc = await guildRef.get();
        
        if (!guildDoc.exists) return;
        
        const data = guildDoc.data();
        const weeklyKills = data.weeklyKills || 0;
        const dailyBossKills = data.dailyBossKills || 0;
        
        // Check weekly challenge (1000 kills)
        if (weeklyKills >= 1000 && !data.weeklyRewardClaimed) {
            // Award 100,000 gold to player
            player.gold = (player.gold || 0) + 100000;
            addChatMessage('🏆 Guild Challenge Complete! Weekly Monster Hunt - You received 10,000 Gold!', 'system');
            
            // Mark as claimed for this player (in local data)
            // The actual guild-wide tracking would need more complex logic
        }
        
        // Check daily boss challenge (10 bosses)
        if (dailyBossKills >= 10 && !data.dailyRewardClaimed) {
            // Award Enhancement Scroll
            if (typeof addItemToInventory === 'function') {
                addItemToInventory('Enhancement Scroll');
                addChatMessage('🏆 Guild Challenge Complete! Daily Boss Slayer - You received an Enhancement Scroll!', 'system');
            }
        }
        
    } catch (error) {
        console.debug('[Guild Challenge] Completion check failed:', error.message);
    }
}

/**
 * Sync guild challenge data from Firebase to local player
 */
async function syncGuildChallengeData() {
    if (!player || !player.guild) return;
    
    const guildName = typeof player.guild === 'string' ? player.guild : player.guild.name;
    if (!guildName) return;
    
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) return;
    }
    
    try {
        const guildRef = db.collection('guilds').doc(guildName);
        const guildDoc = await guildRef.get();
        
        if (!guildDoc.exists) return;
        
        const data = guildDoc.data();
        
        // Update local player guild data
        if (typeof player.guild === 'object') {
            player.guild.weeklyKills = data.weeklyKills || 0;
            player.guild.dailyBossKills = data.dailyBossKills || 0;
        }
        
        console.log('[Guild Challenge] Synced data:', { weeklyKills: data.weeklyKills, dailyBossKills: data.dailyBossKills });
    } catch (error) {
        console.debug('[Guild Challenge] Sync failed:', error.message);
    }
}

/**
 * Get top guild rankings
 */
async function getTopGuildRankings(limit = 50) {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            console.log('[Guilds] Firebase not initialized');
            return [];
        }
    }
    
    try {
        // Check cache first
        const now = Date.now();
        if (guildRankingsCache && (now - guildRankingsCacheTime) < GUILD_RANKINGS_CACHE_DURATION) {
            console.log('[Guilds] Using cached guild rankings');
            return guildRankingsCache.slice(0, limit);
        }
        
        console.log('[Guilds] Fetching guild rankings from Firebase...');
        
        // Fetch all guilds and sort client-side to avoid requiring Firestore index
        const snapshot = await db.collection('guilds').limit(100).get();
        
        console.log('[Guilds] Found', snapshot.size, 'guilds');
        
        const rankings = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log('[Guilds] Guild:', doc.id, 'Score:', data.totalCombatScore, 'Members:', data.memberCount);
            rankings.push({
                id: doc.id,
                name: data.name || doc.id,
                icon: data.icon || 1,
                totalCombatScore: data.totalCombatScore || 0,
                memberCount: data.memberCount || 0,
                members: data.members || {},
                lastUpdated: data.lastUpdated
            });
        });
        
        // Sort by totalCombatScore descending
        rankings.sort((a, b) => b.totalCombatScore - a.totalCombatScore);
        
        // Cache the results
        guildRankingsCache = rankings;
        guildRankingsCacheTime = now;
        
        return rankings.slice(0, limit);
    } catch (error) {
        console.error('[Guilds] Error fetching guild rankings:', error);
        return [];
    }
}

/**
 * Get the player's guild rank
 */
async function getPlayerGuildRank() {
    if (!player || !player.guild || !player.guild.name) return null;
    
    try {
        const allGuilds = await getTopGuildRankings(100);
        const guildIndex = allGuilds.findIndex(g => g.name === player.guild.name);
        
        if (guildIndex === -1) return null;
        return guildIndex + 1;
    } catch (error) {
        console.error('[Guilds] Error getting guild rank:', error);
        return null;
    }
}

// Ranking submission cooldown (for manual submissions only)
let lastRankingSubmitTime = 0;
const RANKING_SUBMIT_COOLDOWN = 60000; // 60 seconds between manual ranking updates

// Internal function to actually submit ranking (no cooldown check)
async function submitRankingInternal() {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            return false;
        }
    }

    if (!player || !player.name) {
        return false;
    }

    // Validate player stats before submission
    const validation = validatePlayerStats();
    if (!validation.valid) {
        console.warn('[Rankings] Stat validation failed:', validation.reason);
        // Still allow submission but flag it
        // In the future, you could reject entirely or flag for manual review
    }

    try {
        // Prepare ranking data
        const totalMonsters = Object.keys(monsterTypes).filter(type => !monsterTypes[type].excludeFromBestiary).length;
        const discoveredMonsters = Object.keys(player.bestiary.monsterKills).filter(type => monsterTypes[type] && !monsterTypes[type].excludeFromBestiary).length;
        
        const rankingData = {
            playerName: player.name,
            level: player.level,
            class: player.class,
            totalKills: Object.values(player.bestiary.monsterKills).reduce((sum, kills) => sum + kills, 0),
            totalGold: player.gold,
            timePlayed: player.timePlayed || 0,
            achievementCount: Object.keys(player.achievements.completed).length,
            bestiaryCompletion: Math.round((discoveredMonsters / totalMonsters) * 100),
            bossKills: Object.keys(monsterTypes)
                .filter(type => monsterTypes[type].isMiniBoss)
                .reduce((sum, type) => sum + (player.bestiary.monsterKills[type] || 0), 0),
            combatScore: calculateCombatScore(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            // Add validation status for potential filtering/flagging
            validated: validation.valid,
            validationIssues: validation.issues || [],
            // Flag if player has used GM privileges
            isGM: hasPlayerUsedGMPrivileges()
        };

        // Generate checksum
        const checksum = generateChecksum(rankingData);
        rankingData.checksum = checksum;

        // Use player name as document ID for easy updates
        const docRef = db.collection('rankings').doc(player.name);
        
        // Set (create or update) the document
        await docRef.set({
            ...rankingData,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Also update guild ranking if player is in a guild
        if (player.guild && player.guild.name) {
            if (typeof updateGuildRanking === 'function') {
                await updateGuildRanking();
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error submitting ranking:', error);
        return false;
    }
}

// Manual submit ranking (with cooldown and messages)
async function submitRanking() {
    // Check cooldown for manual submissions
    const now = Date.now();
    if (now - lastRankingSubmitTime < RANKING_SUBMIT_COOLDOWN) {
        const remainingSeconds = Math.ceil((RANKING_SUBMIT_COOLDOWN - (now - lastRankingSubmitTime)) / 1000);
        addChatMessage(`Please wait ${remainingSeconds} seconds before updating your ranking again.`, 'error');
        return false;
    }
    
    if (!player || !player.name) {
        addChatMessage('Player name not found. Please create a character first.', 'error');
        return false;
    }
    
    lastRankingSubmitTime = now;
    
    const success = await submitRankingInternal();
    if (success) {
        addChatMessage('Ranking updated successfully!', 'success');
    } else {
        addChatMessage('Failed to submit ranking.', 'error');
    }
    return success;
}

// Rankings cache to reduce reads
let rankingsCache = null;
let rankingsCacheTime = 0;
const RANKINGS_CACHE_DURATION = 60000; // Cache rankings for 60 seconds

// Get top rankings by level
async function getTopRankings(category = 'level', limit = 100) {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            return [];
        }
    }

    try {
        // Check cache first to reduce Firebase reads
        const now = Date.now();
        if (rankingsCache && (now - rankingsCacheTime) < RANKINGS_CACHE_DURATION) {
            console.log('[Rankings] Using cached data');
            return sortRankings(rankingsCache, category).slice(0, limit);
        }

        let query = db.collection('rankings');

        // Apply ordering based on category
        switch (category) {
            case 'level':
                query = query.orderBy('level', 'desc').orderBy('exp', 'desc');
                break;
            case 'kills':
                query = query.orderBy('totalKills', 'desc');
                break;
            case 'gold':
                query = query.orderBy('totalGold', 'desc');
                break;
            case 'achievements':
                query = query.orderBy('achievementCount', 'desc');
                break;
            case 'bestiary':
                query = query.orderBy('bestiaryCompletion', 'desc');
                break;
            case 'bosses':
                query = query.orderBy('bossKills', 'desc');
                break;
            default:
                query = query.orderBy('level', 'desc');
        }

        // Fetch all and sort client-side to avoid complex indexes
        const snapshot = await db.collection('rankings').limit(100).get(); // Reduced from 200 to 100
        const rankings = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // Skip flagged accounts (server-side anti-cheat)
            if (data.flagged === true) {
                return;
            }
            // Skip accounts with validation issues (client-side anti-cheat)
            if (data.validationIssues && data.validationIssues.length > 0) {
                return;
            }
            // Skip GM accounts from public rankings
            if (data.isGM === true) {
                return;
            }
            rankings.push({
                id: doc.id,
                playerName: data.playerName || data.name,
                level: data.level || 0,
                class: data.class || 'Unknown',
                totalKills: data.totalKills || 0,
                totalGold: data.totalGold || 0,
                achievementCount: data.achievementCount || 0,
                bestiaryCompletion: data.bestiaryCompletion || 0,
                bossKills: data.bossKills || 0,
                combatScore: data.combatScore || 0,
                serverValidated: data.serverValidated || false,
                isGM: data.isGM || false,
                timestamp: data.timestamp
            });
        });

        // Cache the rankings
        rankingsCache = rankings;
        rankingsCacheTime = now;

        return sortRankings(rankings, category).slice(0, limit);
    } catch (error) {
        console.error('Error fetching rankings:', error);
        return [];
    }
}

/**
 * Report a player for suspected cheating
 * @param {string} playerName - Name of the player to report
 * @param {string} reason - Reason for the report
 * @returns {Promise<boolean>} Success status
 */
async function reportPlayer(playerName, reason) {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            addChatMessage('Unable to submit report. Please try again later.', 'error');
            return false;
        }
    }
    
    if (!playerName || !reason) {
        addChatMessage('Please provide a player name and reason.', 'error');
        return false;
    }
    
    try {
        await db.collection('reports').add({
            reportedPlayer: playerName,
            reporterName: player?.name || 'Anonymous',
            reason: reason,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            reviewed: false
        });
        
        addChatMessage(`Report submitted for ${playerName}. Thank you!`, 'success');
        return true;
    } catch (error) {
        console.error('Error submitting report:', error);
        addChatMessage('Failed to submit report. Please try again.', 'error');
        return false;
    }
}

// Get player's rank in a specific category
async function getPlayerRank(category = 'level') {
    if (!rankingsInitialized || !player || !player.name) {
        return null;
    }

    try {
        // Get all rankings and calculate rank client-side
        const allRankings = await getTopRankings(category, 1000);
        
        // Find player's position
        const playerIndex = allRankings.findIndex(r => r.playerName === player.name || r.id === player.name);
        
        if (playerIndex === -1) {
            return null; // Player not in rankings yet
        }
        
        return playerIndex + 1; // Rank is index + 1
    } catch (error) {
        console.error('Error fetching player rank:', error);
        return null;
    }
}

// Auto-submit ranking when player levels up or achieves milestones (silent, no cooldown messages)
function autoSubmitRanking() {
    // Only auto-submit if Firebase is enabled and player has played for at least 5 minutes
    if (rankingsInitialized && (player.timePlayed || 0) > 300) {
        // Don't submit too frequently (max once per 30 minutes to reduce writes)
        const lastSubmit = localStorage.getItem('lastRankingSubmit');
        const now = Date.now();
        
        if (!lastSubmit || (now - parseInt(lastSubmit)) > 1800000) { // 30 minutes
            // Use internal function to avoid cooldown check and messages
            submitRankingInternal().then((success) => {
                if (success) {
                    localStorage.setItem('lastRankingSubmit', now.toString());
                }
            });
        }
    }
}

// ============================================
// CHARACTER DATA CLOUD STORAGE
// ============================================

let characterDataInitialized = false;

/**
 * Saves a character to Firebase cloud storage
 * @param {Object} characterData - The character data to save
 * @returns {Promise<boolean>} - True if save succeeded
 */
async function saveCharacterToCloud(characterData, forceImmediate = false) {
    if (!characterData || !characterData.name) {
        console.error('Cannot save character without name');
        return false;
    }

    // Throttle cloud saves to reduce Firebase writes (unless forced)
    const now = Date.now();
    if (!forceImmediate && lastCloudSaveTime && (now - lastCloudSaveTime) < CLOUD_SAVE_INTERVAL) {
        console.log('[Cloud Save] Throttled - last save was', Math.round((now - lastCloudSaveTime) / 1000), 'seconds ago');
        return true; // Return true so caller doesn't think it failed
    }

    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            console.log('Firebase not available, skipping cloud save');
            return false;
        }
    }

    try {
        lastCloudSaveTime = now;
        // Prepare character data for Firebase (convert Sets to Arrays)
        const charToSave = prepareCharacterForStorage(characterData);
        
        // Add metadata
        charToSave._cloudMeta = {
            lastSaved: firebase.firestore.FieldValue.serverTimestamp(),
            version: '0.852',
            checksum: generateChecksum(charToSave)
        };

        // Save to Firebase using character name as document ID
        await db.collection('characters').doc(characterData.name).set(charToSave, { merge: true });
        
        console.log(`Character "${characterData.name}" saved to cloud`);
        return true;
    } catch (error) {
        console.error('Error saving character to cloud:', error);
        return false;
    }
}

/**
 * Loads a character from Firebase cloud storage
 * @param {string} characterName - The name of the character to load
 * @returns {Promise<Object|null>} - The character data or null if not found
 */
async function loadCharacterFromCloud(characterName) {
    if (!characterName) {
        return null;
    }

    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            console.log('Firebase not available, cannot load from cloud');
            return null;
        }
    }

    try {
        const doc = await db.collection('characters').doc(characterName).get();
        
        if (!doc.exists) {
            console.log(`Character "${characterName}" not found in cloud`);
            return null;
        }

        let charData = doc.data();
        
        // Remove cloud metadata before returning
        delete charData._cloudMeta;
        
        // Restore Sets from Arrays
        charData = restoreCharacterFromStorage(charData);
        
        console.log(`Character "${characterName}" loaded from cloud`);
        return charData;
    } catch (error) {
        console.error('Error loading character from cloud:', error);
        return null;
    }
}

/**
 * Gets all characters saved in the cloud for a list of character names
 * @param {string[]} characterNames - Array of character names to check
 * @returns {Promise<Object>} - Object mapping character names to their data
 */
async function getCloudCharacters(characterNames) {
    if (!characterNames || characterNames.length === 0) {
        return {};
    }

    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            return {};
        }
    }

    try {
        const cloudCharacters = {};
        
        // Firestore 'in' queries are limited to 10 items, so batch if needed
        const batches = [];
        for (let i = 0; i < characterNames.length; i += 10) {
            batches.push(characterNames.slice(i, i + 10));
        }

        for (const batch of batches) {
            const snapshot = await db.collection('characters')
                .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
                .get();

            snapshot.forEach(doc => {
                const charData = doc.data();
                delete charData._cloudMeta;
                cloudCharacters[doc.id] = restoreCharacterFromStorage(charData);
            });
        }

        return cloudCharacters;
    } catch (error) {
        console.error('Error getting cloud characters:', error);
        return {};
    }
}

/**
 * Checks if a character exists in the cloud
 * @param {string} characterName - The character name to check
 * @returns {Promise<boolean>}
 */
async function characterExistsInCloud(characterName) {
    if (!characterName) return false;

    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) return false;
    }

    try {
        const doc = await db.collection('characters').doc(characterName).get();
        return doc.exists;
    } catch (error) {
        console.error('Error checking cloud character:', error);
        return false;
    }
}

/**
 * Migrates a local character to cloud storage
 * @param {Object} localCharacter - The local character data
 * @returns {Promise<boolean>}
 */
async function migrateCharacterToCloud(localCharacter) {
    if (!localCharacter || !localCharacter.name) {
        return false;
    }

    try {
        // Check if character already exists in cloud
        const existsInCloud = await characterExistsInCloud(localCharacter.name);
        
        if (existsInCloud) {
            // Load cloud version to compare
            const cloudChar = await loadCharacterFromCloud(localCharacter.name);
            
            // Use the one with higher level or more recent play time
            const useCloud = cloudChar && (
                cloudChar.level > localCharacter.level ||
                (cloudChar.level === localCharacter.level && 
                 (cloudChar.lastPlayed || 0) > (localCharacter.lastPlayed || 0))
            );
            
            if (useCloud) {
                console.log(`Cloud save for "${localCharacter.name}" is more advanced, keeping cloud version`);
                return true;
            }
        }

        // Save local character to cloud (force immediate for migration)
        const success = await saveCharacterToCloud(localCharacter, true);
        if (success) {
            console.log(`Character "${localCharacter.name}" migrated to cloud storage`);
            addChatMessage(`☁️ Character data synced to cloud!`, 'system');
        }
        return success;
    } catch (error) {
        console.error('Error migrating character to cloud:', error);
        return false;
    }
}

/**
 * Deletes a character from cloud storage
 * @param {string} characterName - The name of the character to delete
 * @returns {Promise<boolean>}
 */
async function deleteCharacterFromCloud(characterName) {
    if (!characterName) return false;

    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) return false;
    }

    try {
        await db.collection('characters').doc(characterName).delete();
        console.log(`Character "${characterName}" deleted from cloud`);
        return true;
    } catch (error) {
        console.error('Error deleting character from cloud:', error);
        return false;
    }
}

/**
 * Prepares character data for Firebase storage (converts Sets to Arrays)
 */
function prepareCharacterForStorage(char) {
    const prepared = JSON.parse(JSON.stringify(char)); // Deep clone
    
    // Convert discoveredMaps Set to Array
    if (char.discoveredMaps instanceof Set) {
        prepared.discoveredMaps = Array.from(char.discoveredMaps);
    }
    
    // Convert talkedNPCs Set to Array
    if (char.stats && char.stats.talkedNPCs instanceof Set) {
        prepared.stats.talkedNPCs = Array.from(char.stats.talkedNPCs);
    }
    
    // Convert collectedRareItems Set to Array
    if (char.stats && char.stats.collectedRareItems instanceof Set) {
        prepared.stats.collectedRareItems = Array.from(char.stats.collectedRareItems);
    }
    
    return prepared;
}

/**
 * Restores character data from Firebase storage (converts Arrays back to Sets where needed)
 */
function restoreCharacterFromStorage(char) {
    // Note: We don't convert back to Sets here - that's handled by loadCharacter()
    // Just return the data as-is, loadCharacter will handle the conversion
    return char;
}

// ============================================
// GLOBAL CHAT SYSTEM
// ============================================

let globalChatInitialized = false;
let globalChatUnsubscribe = null;
let lastMessageTimestamp = null;
const MAX_CHAT_MESSAGES = 5; // Only load last 5 messages to reduce reads (we ignore old ones anyway)
const CHAT_RATE_LIMIT_MS = 3000; // 3 seconds between messages (increased from 2s)
let lastChatSentTime = 0;

// Announcements system
let announcementsInitialized = false;
let announcementsUnsubscribe = null;
let lastAnnouncementTimestamp = null;
const MAX_ANNOUNCEMENTS = 3; // Only load last 3 announcements to reduce reads
const ANNOUNCEMENT_RATE_LIMIT_MS = 2000; // 2 second rate limit (increased from 1s)
let lastAnnouncementSentTime = 0;

// Cloud save throttling
let lastCloudSaveTime = 0;
const CLOUD_SAVE_INTERVAL = 300000; // Only save to cloud every 5 minutes (300 seconds)

// Initialize announcements listener
async function initializeAnnouncements() {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            console.log('Firebase not available, announcements disabled');
            return false;
        }
    }

    if (announcementsInitialized) {
        return true;
    }

    try {
        // Set timestamp to now so we only show NEW announcements, not old history
        // This prevents flooding with old announcements on login
        if (!lastAnnouncementTimestamp) {
            lastAnnouncementTimestamp = Date.now();
        }
        
        // Listen for new announcements in real-time
        announcementsUnsubscribe = db.collection('announcements')
            .orderBy('timestamp', 'desc')
            .limit(MAX_ANNOUNCEMENTS)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        // Only show announcements we haven't seen yet
                        if (data.timestamp && (!lastAnnouncementTimestamp || data.timestamp.toMillis() > lastAnnouncementTimestamp)) {
                            // Don't show our own announcements (optional, but we might want to see them)
                            if (data.playerName !== player.name) {
                                displayAnnouncement(data);
                            }
                            lastAnnouncementTimestamp = data.timestamp.toMillis();
                        }
                    }
                });
            }, (error) => {
                console.error('Announcements listener error:', error);
            });

        announcementsInitialized = true;
        console.log('Announcements system initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing announcements:', error);
        return false;
    }
}

// Send an announcement to all players
async function sendAnnouncement(type, details) {
    // Rate limiting
    const now = Date.now();
    if (now - lastAnnouncementSentTime < ANNOUNCEMENT_RATE_LIMIT_MS) {
        console.log('[Announcements] Rate limited, skipping announcement');
        return false;
    }

    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            console.warn('[Announcements] Firebase not initialized, cannot send announcement');
            return false;
        }
    }

    if (!player || !player.name) {
        console.warn('[Announcements] No player data, cannot send announcement');
        return false;
    }

    try {
        const announcementData = {
            playerName: player.name,
            playerClass: capitalize(player.class) || 'Beginner',
            playerLevel: player.level,
            type: type, // 'level_up', 'job_advancement', 'achievement', 'medal', 'enhancement'
            details: details, // { newLevel, newClass, achievementTitle, medalName, itemName, enhancementLevel }
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('announcements').add(announcementData);
        console.log('[Announcements] Successfully sent announcement:', type, details);

        lastAnnouncementSentTime = now;
        
        // Also display our own announcement locally (since we filter it out in the listener)
        displayAnnouncement({
            ...announcementData,
            timestamp: { toMillis: () => Date.now() }
        });
        
        return true;
    } catch (error) {
        console.error('[Announcements] Error sending announcement:', error);
        return false;
    }
}

// Display an announcement in chat
function displayAnnouncement(data) {
    let message = '';
    let icon = '';

    switch (data.type) {
        case 'level_up':
            message = `${data.playerName} has reached Level ${data.details.newLevel}!`;
            break;
        case 'job_advancement':
            message = `${data.playerName} has advanced to ${capitalize(data.details.newClass)}!`;
            break;
        case 'achievement':
            message = `${data.playerName} has unlocked "${data.details.achievementTitle}"!`;
            break;
        case 'medal':
            message = `${data.playerName} has earned the "${data.details.medalName}" medal!`;
            break;
        case 'enhancement':
            message = `${data.playerName} has enhanced ${data.details.itemName} to +${data.details.enhancementLevel}!`;
            break;
        case 'rare_drop':
            if (data.details.rarity === 'legendary') {
                message = `${data.playerName} found a LEGENDARY ${data.details.itemName}!`;
            } else if (data.details.rarity === 'epic') {
                message = `${data.playerName} found an EPIC ${data.details.itemName}!`;
            } else {
                return;
            }
            break;
        default:
            return;
    }

    // Add to chat log
    if (typeof addChatMessage === 'function') {
        addChatMessage(`${icon} ${message}`, 'announcement');
    }
}

// ============================================
// GLOBAL EVENTS SYSTEM
// ============================================

let globalEventsUnsubscribe = null;
let globalEventsInitialized = false;
let currentGlobalEvent = null;
let eventTimerInterval = null;

// Initialize global events listener
async function initializeGlobalEvents() {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            console.log('Firebase not available, global events disabled');
            return false;
        }
    }

    if (globalEventsInitialized) {
        return true;
    }

    try {
        // Listen for active global events
        globalEventsUnsubscribe = db.collection('globalEvents')
            .where('active', '==', true)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' || change.type === 'modified') {
                        const data = change.doc.data();
                        data.id = change.doc.id;
                        handleGlobalEvent(data);
                    } else if (change.type === 'removed') {
                        hideGlobalEventBanner();
                    }
                });
                
                // If no active events, hide banner
                if (snapshot.empty) {
                    hideGlobalEventBanner();
                }
            }, (error) => {
                // Silently handle permission errors - collection may not exist yet
                if (error.code === 'permission-denied') {
                    console.log('Global events: No permission (collection may not exist yet)');
                } else {
                    console.log('Global events listener error:', error.message);
                }
                globalEventsInitialized = false;
            });

        globalEventsInitialized = true;
        console.log('Global events system initialized');
        return true;
    } catch (error) {
        console.error('Error initializing global events:', error);
        return false;
    }
}

// Handle a global event
function handleGlobalEvent(eventData) {
    currentGlobalEvent = eventData;
    
    const banner = document.getElementById('global-event-banner');
    const iconEl = document.getElementById('event-banner-icon');
    const textEl = document.getElementById('event-banner-text');
    const timerEl = document.getElementById('event-banner-timer');
    
    if (!banner || !iconEl || !textEl) return;
    
    // Clear existing classes
    banner.className = '';
    
    // Set event-specific styling
    switch (eventData.type) {
        case 'double_exp':
            banner.classList.add('double-exp');
            textEl.textContent = 'Double EXP Event!';
            break;
        case 'double_drops':
            banner.classList.add('double-drops');
            textEl.textContent = 'Double Drop Rate!';
            break;
        case 'boss_spawn':
            banner.classList.add('boss-spawn');
            textEl.textContent = `World Boss: ${eventData.bossName || 'Unknown'}`;
            break;
        default:
            textEl.textContent = eventData.message || 'Special Event!';
    }
    
    // Show banner
    banner.style.display = 'block';
    
    // Start timer if event has end time
    if (eventData.endTime) {
        startEventTimer(eventData.endTime.toMillis ? eventData.endTime.toMillis() : eventData.endTime);
    } else if (timerEl) {
        timerEl.textContent = '';
    }
    
    // Announce in chat
    if (typeof addChatMessage === 'function') {
        addChatMessage(`${textEl.textContent} has started!`, 'announcement');
    }
}

// Start countdown timer for event
function startEventTimer(endTimeMs) {
    const timerEl = document.getElementById('event-banner-timer');
    if (!timerEl) return;
    
    // Clear existing interval
    if (eventTimerInterval) {
        clearInterval(eventTimerInterval);
    }
    
    const updateTimer = () => {
        const now = Date.now();
        const remaining = endTimeMs - now;
        
        if (remaining <= 0) {
            timerEl.textContent = 'Ending soon...';
            clearInterval(eventTimerInterval);
            return;
        }
        
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        
        if (hours > 0) {
            timerEl.textContent = `${hours}h ${minutes}m remaining`;
        } else if (minutes > 0) {
            timerEl.textContent = `${minutes}m ${seconds}s remaining`;
        } else {
            timerEl.textContent = `${seconds}s remaining`;
        }
    };
    
    updateTimer();
    eventTimerInterval = setInterval(updateTimer, 1000);
}

// Hide the event banner
function hideGlobalEventBanner() {
    const banner = document.getElementById('global-event-banner');
    if (banner) {
        banner.style.display = 'none';
    }
    
    if (eventTimerInterval) {
        clearInterval(eventTimerInterval);
        eventTimerInterval = null;
    }
    
    currentGlobalEvent = null;
}

// Get current event multipliers (for game logic)
function getEventMultipliers() {
    if (!currentGlobalEvent) {
        return { exp: 1, drops: 1 };
    }
    
    return {
        exp: currentGlobalEvent.type === 'double_exp' ? 2 : 1,
        drops: currentGlobalEvent.type === 'double_drops' ? 2 : 1
    };
}

// Initialize global chat listener
async function initializeGlobalChat() {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            console.log('Firebase not available, global chat disabled');
            return false;
        }
    }

    if (globalChatInitialized) {
        return true;
    }

    try {
        // Set timestamp to now so we only show NEW messages, not old history
        // This prevents flooding the chat with old messages on login
        if (!lastMessageTimestamp) {
            lastMessageTimestamp = Date.now();
        }
        
        // Listen for new chat messages in real-time
        globalChatUnsubscribe = db.collection('globalChat')
            .orderBy('timestamp', 'desc')
            .limit(MAX_CHAT_MESSAGES)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        // Only show messages we haven't seen yet
                        if (data.timestamp && (!lastMessageTimestamp || data.timestamp.toMillis() > lastMessageTimestamp)) {
                            // Handle party system messages
                            if (data.type && (data.type === 'partyInvite' || data.type === 'partyAccept' || data.type === 'partyLeave')) {
                                handlePartyMessage(data);
                            } else if (data.type === 'guildInvite') {
                                handleGuildInvite(data);
                            } else if (data.type === 'guildDisband' || data.type === 'guildKick') {
                                handleGuildMessage(data);
                            } else if (data.type === 'buddyRequest' || data.type === 'buddyAccept') {
                                handleBuddyMessage(data);
                            } else if (data.playerName !== player.name) {
                                // Don't show our own messages (we already added them locally)
                                displayGlobalChatMessage(data);
                            }
                            lastMessageTimestamp = data.timestamp.toMillis();
                        }
                    }
                });
            }, (error) => {
                console.error('Global chat listener error:', error);
            });

        globalChatInitialized = true;
        console.log('Global chat initialized successfully');
        
        // Show a system message indicating global chat is active
        addChatMessage('🌐 Global chat connected! Your messages are visible to all players.', 'system');
        
        return true;
    } catch (error) {
        console.error('Error initializing global chat:', error);
        return false;
    }
}

// Send a message to global chat
async function sendGlobalChatMessage(message) {
    if (!message || message.trim().length === 0) {
        return false;
    }

    // Rate limiting
    const now = Date.now();
    if (now - lastChatSentTime < CHAT_RATE_LIMIT_MS) {
        addChatMessage('Please wait before sending another message.', 'error');
        return false;
    }

    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            addChatMessage('Unable to connect to chat service.', 'error');
            return false;
        }
    }

    if (!player || !player.name) {
        addChatMessage('You must be logged in to chat.', 'error');
        return false;
    }

    // Sanitize message (basic XSS prevention)
    const sanitizedMessage = message
        .trim()
        .slice(0, 200) // Max 200 characters
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    try {
        // Get equipped medal info to display in chat
        let medalName = null;
        let medalTier = null;
        if (player.equippedMedal) {
            if (player.equippedMedal.type === 'special' && typeof specialMedals !== 'undefined') {
                const medal = specialMedals[player.equippedMedal.id];
                if (medal) {
                    medalName = medal.name;
                    medalTier = medal.tier;
                }
            } else if (player.equippedMedal.type === 'monster') {
                // Use the medal name stored on the player
                medalName = player.equippedMedal.name || 'Medal';
                medalTier = player.equippedMedal.tier || 'bronze';
            }
        }
        
        const chatData = {
            playerName: player.name,
            playerClass: capitalize(player.class) || 'Beginner',
            playerLevel: player.level || 1,
            message: sanitizedMessage,
            medalName: medalName,
            medalTier: medalTier,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('globalChat').add(chatData);
        lastChatSentTime = now;
        
        // We don't need to call addChatMessage here because the listener will pick it up
        // But we show it immediately for the sender for instant feedback
        displayGlobalChatMessage({
            playerName: player.name,
            playerClass: capitalize(player.class) || 'Beginner',
            playerLevel: player.level || 1,
            message: sanitizedMessage,
            medalName: medalName,
            medalTier: medalTier,
            timestamp: { toDate: () => new Date() }
        });
        
        return true;
    } catch (error) {
        console.error('Error sending chat message:', error);
        addChatMessage('Failed to send message.', 'error');
        return false;
    }
}

// Display a global chat message in the chat log
function displayGlobalChatMessage(data) {
    const chatLog = document.getElementById('chat-log');
    if (!chatLog) return;

    // Format timestamp
    let timeStr = '';
    if (data.timestamp && data.timestamp.toDate) {
        const date = data.timestamp.toDate();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        timeStr = `[${hours}:${minutes}]`;
    } else {
        const now = new Date();
        timeStr = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}]`;
    }

    // Use global classColors from ui.js
    const nameColor = (window.classColors && window.classColors[data.playerClass]) || '#ffffff';

    // Format medal display with name and rarity color
    let medalDisplay = '';
    if (data.medalName) {
        // Map tier to color
        const tierColors = {
            'legendary': '#f39c12',  // Orange/gold
            'epic': '#9b59b6',       // Purple
            'gold': '#f1c40f',       // Yellow/gold
            'silver': '#bdc3c7',     // Silver
            'bronze': '#cd7f32'      // Bronze
        };
        const medalColor = tierColors[data.medalTier] || '#ffffff';
        medalDisplay = `<span style="color: ${medalColor}; font-weight: bold;">${data.medalName}</span> `;
    }
    
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-log-message chat-log--global';
    messageEl.innerHTML = `<span style="color: #888;">${timeStr}</span> <span style="color: #f1c40f;">[🌐]</span> ${medalDisplay}<span style="color: ${nameColor}; font-weight: bold;">${data.playerName}</span><span style="color: #888; font-size: 0.9em;"> [Lv.${data.playerLevel}]</span>: ${data.message}`;

    chatLog.appendChild(messageEl);
    chatLog.scrollTop = chatLog.scrollHeight;
}

// Clean up old chat messages (call periodically or via Cloud Function)
async function cleanupOldChatMessages() {
    if (!rankingsInitialized || !db) return;

    try {
        // Delete messages older than 24 hours
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - 24);

        const oldMessages = await db.collection('globalChat')
            .where('timestamp', '<', cutoff)
            .limit(100)
            .get();

        const batch = db.batch();
        oldMessages.forEach(doc => {
            batch.delete(doc.ref);
        });

        if (!oldMessages.empty) {
            await batch.commit();
            console.log(`Cleaned up ${oldMessages.size} old chat messages`);
        }
    } catch (error) {
        console.error('Error cleaning up chat messages:', error);
    }
}

// Stop listening to global chat
function disconnectGlobalChat() {
    if (globalChatUnsubscribe) {
        globalChatUnsubscribe();
        globalChatUnsubscribe = null;
        globalChatInitialized = false;
        console.log('Disconnected from global chat');
    }
}

// ============================================
// BUDDY CHAT SYSTEM
// ============================================

let buddyChatUnsubscribe = null;
let buddyChatInitialized = false;

// Initialize buddy chat listener
async function initializeBuddyChat() {
    // Don't initialize if no player or buddies
    if (!player || !player.name) return false;
    
    // Clean up any duplicate buddies first
    if (typeof deduplicateBuddyList === 'function') {
        deduplicateBuddyList();
    }
    
    // Clean up existing listener before creating a new one
    if (buddyChatUnsubscribe) {
        buddyChatUnsubscribe();
        buddyChatUnsubscribe = null;
    }
    
    // Skip if already initialized (use flag to prevent rapid re-init)
    if (buddyChatInitialized) return true;
    
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) return false;
    }

    try {
        // Listen for messages where we are the recipient or sender
        // We'll use a collection specific to this player's buddy chat
        const playerChatRef = db.collection('buddyChat').doc(player.name).collection('messages');
        
        // Track when we started listening to ignore old messages
        let isFirstSnapshot = true;
        
        buddyChatUnsubscribe = playerChatRef
            .orderBy('timestamp', 'desc')
            .limit(50)
            .onSnapshot((snapshot) => {
                // Skip the first snapshot which contains historical messages
                if (isFirstSnapshot) {
                    isFirstSnapshot = false;
                    return;
                }
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        // Don't display messages we just sent (they're already shown)
                        if (data.senderName !== player.name || !data.displayedBySender) {
                            // Only display if the sender is still on our buddy list
                            const isStillBuddy = player.buddies && player.buddies.some(b => 
                                (typeof b === 'string' ? b : b.name) === data.senderName
                            );
                            if (isStillBuddy) {
                                displayBuddyChatMessage(data);
                            }
                        }
                    }
                });
            }, (error) => {
                console.error('Buddy chat listener error:', error);
            });

        buddyChatInitialized = true;
        console.log('Buddy chat initialized');
        return true;
    } catch (error) {
        console.error('Error initializing buddy chat:', error);
        return false;
    }
}

// Send a message to all buddies
async function sendBuddyChatMessage(message) {
    if (!message || message.trim().length === 0) return false;

    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            addChatMessage('Unable to connect to chat service.', 'error');
            return false;
        }
    }

    if (!player || !player.name) {
        addChatMessage('You must be logged in to chat.', 'error');
        return false;
    }

    // Check if player has any buddies
    if (!player.buddies || player.buddies.length === 0) {
        addChatMessage('You don\'t have any buddies to chat with!', 'error');
        return false;
    }

    const sanitizedMessage = message.trim().slice(0, 200).replace(/</g, '&lt;').replace(/>/g, '&gt;');

    try {
        const chatData = {
            senderName: player.name,
            senderClass: player.class || 'Beginner',
            senderLevel: player.level || 1,
            message: sanitizedMessage,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            displayedBySender: true
        };

        // Get unique buddy names (deduplicate)
        const uniqueBuddyNames = [...new Set(player.buddies.map(buddy => 
            typeof buddy === 'string' ? buddy : buddy.name
        ))];

        // Send to each buddy's message collection
        const batch = db.batch();
        for (const buddyName of uniqueBuddyNames) {
            const buddyChatRef = db.collection('buddyChat').doc(buddyName).collection('messages').doc();
            batch.set(buddyChatRef, chatData);
        }
        await batch.commit();

        // Display locally for sender
        displayBuddyChatMessage({
            senderName: player.name,
            senderClass: player.class || 'Beginner',
            senderLevel: player.level || 1,
            message: sanitizedMessage,
            timestamp: { toDate: () => new Date() }
        });

        return true;
    } catch (error) {
        console.error('Error sending buddy chat message:', error);
        addChatMessage('Failed to send buddy message.', 'error');
        return false;
    }
}

// Display a buddy chat message
function displayBuddyChatMessage(data) {
    const chatLog = document.getElementById('chat-log');
    if (!chatLog) return;

    let timeStr = '';
    if (data.timestamp && data.timestamp.toDate) {
        const date = data.timestamp.toDate();
        timeStr = `[${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}]`;
    } else {
        const now = new Date();
        timeStr = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}]`;
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'chat-log-message chat-log--buddy';
    messageEl.innerHTML = `<span style="color: #888;">${timeStr}</span> <span style="color: #e91e63;">[Buddy]</span> <span style="color: #f48fb1; font-weight: bold;">${data.senderName}</span><span style="color: #888; font-size: 0.9em;"> [Lv.${data.senderLevel}]</span>: ${data.message}`;

    chatLog.appendChild(messageEl);
    chatLog.scrollTop = chatLog.scrollHeight;
}

// ============================================
// GUILD CHAT SYSTEM
// ============================================

let guildChatUnsubscribe = null;
let guildChatInitialized = false;

// Initialize guild chat listener
async function initializeGuildChat() {
    if (guildChatInitialized || !player || !player.guild) return false;
    
    // Get guild name - handle both string and object formats
    const guildName = typeof player.guild === 'string' ? player.guild : player.guild.name;
    if (!guildName) return false;
    
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) return false;
    }

    try {
        const guildChatRef = db.collection('guildChat').doc(guildName).collection('messages');
        
        // Track when we started listening to ignore old messages
        let isFirstSnapshot = true;
        
        guildChatUnsubscribe = guildChatRef
            .orderBy('timestamp', 'desc')
            .limit(50)
            .onSnapshot((snapshot) => {
                // Skip the first snapshot which contains historical messages
                if (isFirstSnapshot) {
                    isFirstSnapshot = false;
                    return;
                }
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        // Don't display messages we just sent
                        if (data.senderName !== player.name || !data.displayedBySender) {
                            displayGuildChatMessage(data);
                        }
                    }
                });
            }, (error) => {
                console.error('Guild chat listener error:', error);
            });

        guildChatInitialized = true;
        console.log('Guild chat initialized for guild:', guildName);
        
        // Sync guild challenge data from Firebase
        syncGuildChallengeData();
        
        return true;
    } catch (error) {
        console.error('Error initializing guild chat:', error);
        return false;
    }
}

// Send a message to guild
async function sendGuildChatMessage(message) {
    if (!message || message.trim().length === 0) return false;

    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            addChatMessage('Unable to connect to chat service.', 'error');
            return false;
        }
    }

    if (!player || !player.name) {
        addChatMessage('You must be logged in to chat.', 'error');
        return false;
    }

    if (!player.guild) {
        addChatMessage('You are not in a guild!', 'error');
        return false;
    }

    // Get guild name - handle both string and object formats
    const guildName = typeof player.guild === 'string' ? player.guild : player.guild.name;
    if (!guildName) {
        addChatMessage('Invalid guild data!', 'error');
        return false;
    }

    const sanitizedMessage = message.trim().slice(0, 200).replace(/</g, '&lt;').replace(/>/g, '&gt;');

    try {
        const chatData = {
            senderName: player.name,
            senderClass: player.class || 'Beginner',
            senderLevel: player.level || 1,
            message: sanitizedMessage,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            displayedBySender: true
        };

        await db.collection('guildChat').doc(guildName).collection('messages').add(chatData);

        // Display locally for sender
        displayGuildChatMessage({
            senderName: player.name,
            senderClass: player.class || 'Beginner',
            senderLevel: player.level || 1,
            message: sanitizedMessage,
            timestamp: { toDate: () => new Date() }
        });

        return true;
    } catch (error) {
        console.error('Error sending guild chat message:', error);
        addChatMessage('Failed to send guild message.', 'error');
        return false;
    }
}

// Display a guild chat message
function displayGuildChatMessage(data) {
    const chatLog = document.getElementById('chat-log');
    if (!chatLog) return;

    let timeStr = '';
    if (data.timestamp && data.timestamp.toDate) {
        const date = data.timestamp.toDate();
        timeStr = `[${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}]`;
    } else {
        const now = new Date();
        timeStr = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}]`;
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'chat-log-message chat-log--guild';
    messageEl.innerHTML = `<span style="color: #888;">${timeStr}</span> <span style="color: #9b59b6;">[Guild]</span> <span style="color: #ce93d8; font-weight: bold;">${data.senderName}</span><span style="color: #888; font-size: 0.9em;"> [Lv.${data.senderLevel}]</span>: ${data.message}`;

    chatLog.appendChild(messageEl);
    chatLog.scrollTop = chatLog.scrollHeight;
}

// ============================================
// PARTY CHAT SYSTEM
// ============================================

let partyChatUnsubscribe = null;
let partyChatInitialized = false;

// Initialize party chat listener
async function initializePartyChat() {
    if (partyChatInitialized || !player || !playerParty.id) return false;
    
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) return false;
    }

    try {
        const partyChatRef = db.collection('partyChat').doc(playerParty.id).collection('messages');
        
        // Track when we started listening to ignore old messages
        let isFirstSnapshot = true;
        
        partyChatUnsubscribe = partyChatRef
            .orderBy('timestamp', 'desc')
            .limit(50)
            .onSnapshot((snapshot) => {
                // Skip the first snapshot which contains historical messages
                if (isFirstSnapshot) {
                    isFirstSnapshot = false;
                    return;
                }
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        // Don't display messages we just sent
                        if (data.senderName !== player.name || !data.displayedBySender) {
                            displayPartyChatMessage(data);
                        }
                    }
                });
            }, (error) => {
                console.error('Party chat listener error:', error);
            });

        partyChatInitialized = true;
        console.log('Party chat initialized for party:', playerParty.id);
        return true;
    } catch (error) {
        console.error('Error initializing party chat:', error);
        return false;
    }
}

// Send a message to party
async function sendPartyChatMessage(message) {
    if (!message || message.trim().length === 0) return false;

    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            addChatMessage('Unable to connect to chat service.', 'error');
            return false;
        }
    }

    if (!player || !player.name) {
        addChatMessage('You must be logged in to chat.', 'error');
        return false;
    }

    if (!playerParty.id) {
        addChatMessage('You are not in a party!', 'error');
        return false;
    }

    const sanitizedMessage = message.trim().slice(0, 200).replace(/</g, '&lt;').replace(/>/g, '&gt;');

    try {
        const chatData = {
            senderName: player.name,
            senderClass: player.class || 'Beginner',
            senderLevel: player.level || 1,
            message: sanitizedMessage,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            displayedBySender: true
        };

        await db.collection('partyChat').doc(playerParty.id).collection('messages').add(chatData);

        // Display locally for sender
        displayPartyChatMessage({
            senderName: player.name,
            senderClass: player.class || 'Beginner',
            senderLevel: player.level || 1,
            message: sanitizedMessage,
            timestamp: { toDate: () => new Date() }
        });

        return true;
    } catch (error) {
        console.error('Error sending party chat message:', error);
        addChatMessage('Failed to send party message.', 'error');
        return false;
    }
}

// Display a party chat message
function displayPartyChatMessage(data) {
    const chatLog = document.getElementById('chat-log');
    if (!chatLog) return;

    let timeStr = '';
    if (data.timestamp && data.timestamp.toDate) {
        const date = data.timestamp.toDate();
        timeStr = `[${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}]`;
    } else {
        const now = new Date();
        timeStr = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}]`;
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'chat-log-message chat-log--party-chat';
    messageEl.innerHTML = `<span style="color: #888;">${timeStr}</span> <span style="color: #3498db;">[Party]</span> <span style="color: #81d4fa; font-weight: bold;">${data.senderName}</span><span style="color: #888; font-size: 0.9em;"> [Lv.${data.senderLevel}]</span>: ${data.message}`;

    chatLog.appendChild(messageEl);
    chatLog.scrollTop = chatLog.scrollHeight;
}

// Disconnect from party chat
function disconnectPartyChat() {
    if (partyChatUnsubscribe) {
        partyChatUnsubscribe();
        partyChatUnsubscribe = null;
        partyChatInitialized = false;
        console.log('Disconnected from party chat');
    }
}

// Disconnect from guild chat
function disconnectGuildChat() {
    if (guildChatUnsubscribe) {
        guildChatUnsubscribe();
        guildChatUnsubscribe = null;
        guildChatInitialized = false;
        console.log('Disconnected from guild chat');
    }
}

// Disconnect from buddy chat
function disconnectBuddyChat() {
    if (buddyChatUnsubscribe) {
        buddyChatUnsubscribe();
        buddyChatUnsubscribe = null;
        buddyChatInitialized = false;
        console.log('Disconnected from buddy chat');
    }
}

// ============================================
// ONLINE PRESENCE SYSTEM
// ============================================

let presenceInitialized = false;
let presenceUnsubscribe = null;
let presenceUpdateInterval = null;
let onlinePlayers = {};

// ============================================
// PARTY SYSTEM
// ============================================
let playerParty = {
    id: null,           // Party ID (leader's playerName)
    leader: null,       // Leader's playerName
    members: [],        // Array of member playerNames
    pendingInvites: []  // Invites we've sent (waiting for response)
};

// Get party members who are on the same map
function getPartyMembersOnSameMap() {
    if (!playerParty.id) return [];
    
    const myMap = player.currentMapId;
    const partyMembers = Object.values(onlinePlayers).filter(p => 
        p.partyId === playerParty.id && 
        p.playerName !== player.name
    );
    
    // Debug logging
    console.log(`[Party EXP Debug] My map: "${myMap}", Party ID: ${playerParty.id}`);
    partyMembers.forEach(p => {
        console.log(`[Party EXP Debug] Member ${p.playerName} on map: "${p.currentMap}", match: ${p.currentMap === myMap}`);
    });
    
    return partyMembers.filter(p => p.currentMap === myMap);
}

// Calculate party EXP bonus - NOW DISABLED since we use real multiplayer party EXP sharing
// Party members now get 50% of EXP when other members kill monsters (handled in socketClient.js)
// This legacy bonus is kept at 0 to avoid double-dipping
function getPartyExpBonus() {
    // Check if we're connected to multiplayer server
    if (typeof isConnectedToServer !== 'undefined' && isConnectedToServer) {
        // Multiplayer mode: No bonus here, party EXP comes from other members' kills
        return 0;
    }
    
    // Single-player/offline mode: Keep the old bonus system for backwards compatibility
    const membersOnMap = getPartyMembersOnSameMap();
    const bonus = Math.min(0.3, membersOnMap.length * 0.1);
    if (membersOnMap.length > 0) {
        console.log(`[Party EXP] Offline mode - ${membersOnMap.length} members on same map, bonus: ${bonus * 100}%`);
    }
    return bonus; // 10% per member, max 30%
}

/**
 * Check if the current player has validation issues (anti-cheat flag)
 * Players with validation issues cannot use trade, party, or guild systems
 * This checks both local player data and cached validation status from Firebase
 */
function hasValidationIssues() {
    if (!player) return true; // No player = blocked
    
    // Check local player data first (may be set from cloud sync)
    if (player.validated === false) return true;
    if (player.validationIssues && player.validationIssues.length > 0) return true;
    if (player.flagged === true) return true;
    
    // Check cached validation status from Firebase (set during ranking fetch)
    if (window._playerValidationCache && window._playerValidationCache.playerName === player.name) {
        if (window._playerValidationCache.validated === false) return true;
        if (window._playerValidationCache.validationIssues && window._playerValidationCache.validationIssues.length > 0) return true;
        if (window._playerValidationCache.flagged === true) return true;
    }
    
    return false;
}

/**
 * Fetch and cache validation status from Firebase
 * Call this on login to ensure we have the latest validation status
 */
async function fetchValidationStatus() {
    if (!player || !player.name || !rankingsInitialized) return;
    
    try {
        // Check rankings collection for validation status
        const rankingDoc = await db.collection('rankings').doc(player.name).get();
        if (rankingDoc.exists) {
            const data = rankingDoc.data();
            window._playerValidationCache = {
                playerName: player.name,
                validated: data.validated,
                validationIssues: data.validationIssues || [],
                flagged: data.flagged || false,
                fetchedAt: Date.now()
            };
            
            // Also sync to local player object for persistence
            if (data.validated === false) player.validated = false;
            if (data.validationIssues && data.validationIssues.length > 0) {
                player.validationIssues = data.validationIssues;
            }
            if (data.flagged === true) player.flagged = true;
            
            console.log('[Validation] Status fetched:', window._playerValidationCache);
        }
        
        // Also check characters collection
        const charDoc = await db.collection('characters').doc(player.name).get();
        if (charDoc.exists) {
            const data = charDoc.data();
            if (data.validated === false) {
                player.validated = false;
                if (window._playerValidationCache) window._playerValidationCache.validated = false;
            }
            if (data.validationIssues && data.validationIssues.length > 0) {
                player.validationIssues = data.validationIssues;
                if (window._playerValidationCache) {
                    window._playerValidationCache.validationIssues = data.validationIssues;
                }
            }
            if (data.flagged === true) {
                player.flagged = true;
                if (window._playerValidationCache) window._playerValidationCache.flagged = true;
            }
        }
    } catch (error) {
        console.error('[Validation] Error fetching validation status:', error);
    }
}

/**
 * Show blocked message for players with validation issues
 */
function showValidationBlockedMessage(action) {
    addChatMessage(`⚠️ You cannot ${action} due to account validation issues. Please contact Benn.`, 'error');
}

// Create a new party (you become the leader)
function createParty() {
    // Check for validation issues
    if (hasValidationIssues()) {
        showValidationBlockedMessage('create a party');
        return false;
    }
    
    if (playerParty.id) {
        addChatMessage('You are already in a party.', 'error');
        return false;
    }
    
    playerParty.id = player.name;
    playerParty.leader = player.name;
    playerParty.members = [player.name];
    
    // Save party info to player for persistence
    player.partyInfo = { id: playerParty.id, leader: playerParty.leader };
    if (typeof saveCharacter === 'function') saveCharacter();
    
    // Update presence with party info
    updatePresence();
    
    // Notify game server of party change
    if (typeof window.updatePartyOnServer === 'function') {
        window.updatePartyOnServer();
    }
    
    // Initialize party chat for this party
    partyChatInitialized = false; // Reset so it can reinitialize for new party
    initializePartyChat();
    
    // Track party creation for achievements
    player.stats.partiesCreated = (player.stats.partiesCreated || 0) + 1;
    
    // Check if this is the first party ever
    const firstPartyEver = player.stats.partiesCreated === 1 && !player.stats.partiesJoined;
    if (firstPartyEver) {
        updateAchievementProgress('action', 'first_party');
    }
    updateAchievementProgress('action_accumulate', 'parties_created');
    
    addChatMessage('You have created a party.', 'party');
    if (typeof updateOnlinePlayersUI === 'function') updateOnlinePlayersUI();
    if (typeof window.updatePartyOverlay === 'function') window.updatePartyOverlay();
    return true;
}

// Send a party invite to another player (uses chat system)
async function sendPartyInvite(targetPlayerName) {
    // Check for validation issues
    if (hasValidationIssues()) {
        showValidationBlockedMessage('send party invites');
        return false;
    }
    
    if (!playerParty.id) {
        // Auto-create party when inviting
        createParty();
    }
    
    if (playerParty.leader !== player.name) {
        addChatMessage('Only the party leader can invite players.', 'error');
        return false;
    }
    
    if (playerParty.members.length >= 4) {
        addChatMessage('Party is full (max 4 members).', 'error');
        return false;
    }
    
    if (playerParty.members.includes(targetPlayerName)) {
        addChatMessage(`${targetPlayerName} is already in your party.`, 'error');
        return false;
    }
    
    // Check if target is online
    if (!onlinePlayers[targetPlayerName]) {
        addChatMessage(`${targetPlayerName} is not online.`, 'error');
        return false;
    }
    
    // Check if target is already in a party
    if (onlinePlayers[targetPlayerName].partyId) {
        addChatMessage(`${targetPlayerName} is already in a party.`, 'error');
        return false;
    }
    
    try {
        // Send invite via chat system (special message type)
        await db.collection('globalChat').add({
            type: 'partyInvite',
            from: player.name,
            to: targetPlayerName,
            partyId: playerParty.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        playerParty.pendingInvites.push(targetPlayerName);
        addChatMessage(`Party invite sent to ${targetPlayerName}.`, 'party');
        return true;
    } catch (error) {
        console.error('Error sending party invite:', error);
        addChatMessage('Failed to send party invite.', 'error');
        return false;
    }
}

// Accept a party invite
async function acceptPartyInvite(partyId, leaderName) {
    // Check for validation issues
    if (hasValidationIssues()) {
        showValidationBlockedMessage('join parties');
        return false;
    }
    
    if (playerParty.id) {
        addChatMessage('You must leave your current party first.', 'error');
        return false;
    }
    
    // Check if the party still exists (leader is still online with that party)
    const leaderData = onlinePlayers[leaderName];
    if (!leaderData || leaderData.partyId !== partyId) {
        addChatMessage('Party no longer exists.', 'error');
        return false;
    }
    
    playerParty.id = partyId;
    playerParty.leader = leaderName;
    playerParty.members = [player.name]; // Will be updated from presence data
    
    // Save party info to player for persistence
    player.partyInfo = { id: playerParty.id, leader: playerParty.leader };
    if (typeof saveCharacter === 'function') saveCharacter();
    
    // Update presence with party info
    await updatePresence();
    
    // Notify game server of party change
    if (typeof window.updatePartyOnServer === 'function') {
        window.updatePartyOnServer();
    }
    
    // Send acceptance message via chat
    await db.collection('globalChat').add({
        type: 'partyAccept',
        from: player.name,
        partyId: partyId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Track party join for achievements
    player.stats.partiesJoined = (player.stats.partiesJoined || 0) + 1;
    
    // Check if this is the first party ever (either created or joined)
    if (!player.stats.partiesCreated && player.stats.partiesJoined === 1) {
        updateAchievementProgress('action', 'first_party');
    }
    updateAchievementProgress('action_accumulate', 'parties_joined');
    
    addChatMessage(`You have joined ${leaderName}'s party!`, 'party');
    if (typeof updateOnlinePlayersUI === 'function') updateOnlinePlayersUI();
    if (typeof window.updatePartyOverlay === 'function') window.updatePartyOverlay();
    
    // Initialize party chat for this party
    partyChatInitialized = false; // Reset so it can reinitialize for new party
    initializePartyChat();
    
    return true;
}

// Decline a party invite
function declinePartyInvite(leaderName) {
    addChatMessage(`You declined ${leaderName}'s party invite.`, 'party');
    // No need to send anything to Firebase - just dismiss the UI
}

// Leave the party
async function leaveParty() {
    if (!playerParty.id) {
        addChatMessage('You are not in a party.', 'error');
        return false;
    }
    
    const wasLeader = playerParty.leader === player.name;
    const oldPartyId = playerParty.id;
    
    // Cleanup party chat listener
    if (partyChatUnsubscribe) {
        partyChatUnsubscribe();
        partyChatUnsubscribe = null;
    }
    partyChatInitialized = false;
    
    // Clear local party data
    playerParty.id = null;
    playerParty.leader = null;
    playerParty.members = [];
    playerParty.pendingInvites = [];
    
    // Clear saved party info
    player.partyInfo = null;
    if (typeof saveCharacter === 'function') saveCharacter();
    
    // Update presence to remove party info
    await updatePresence();
    
    // Notify game server of party change
    if (typeof window.updatePartyOnServer === 'function') {
        window.updatePartyOnServer();
    }
    
    // Send leave message via chat
    await db.collection('globalChat').add({
        type: 'partyLeave',
        from: player.name,
        partyId: oldPartyId,
        wasLeader: wasLeader,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    addChatMessage('You have left the party.', 'party');
    if (typeof updateOnlinePlayersUI === 'function') updateOnlinePlayersUI();
    if (typeof window.updatePartyOverlay === 'function') window.updatePartyOverlay();
    return true;
}

// Kick a player from the party (leader only)
async function kickFromParty(targetPlayerName) {
    if (!playerParty.id) {
        addChatMessage('You are not in a party.', 'error');
        return false;
    }
    
    if (playerParty.leader !== player.name) {
        addChatMessage('Only the party leader can kick members.', 'error');
        return false;
    }
    
    if (targetPlayerName === player.name) {
        addChatMessage('You cannot kick yourself. Use Leave Party instead.', 'error');
        return false;
    }
    
    // Send kick message via chat
    await db.collection('globalChat').add({
        type: 'partyKick',
        from: player.name,
        target: targetPlayerName,
        partyId: playerParty.id,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    addChatMessage(`You kicked ${targetPlayerName} from the party.`, 'party');
    if (typeof updateOnlinePlayersUI === 'function') updateOnlinePlayersUI();
    if (typeof window.updatePartyOverlay === 'function') window.updatePartyOverlay();
    return true;
}

// Handle incoming party-related chat messages
function handlePartyMessage(data) {
    if (!data.type) return;
    
    switch (data.type) {
        case 'partyInvite':
            if (data.to === player.name && data.from !== player.name) {
                // Show invite UI
                showPartyInvitePrompt(data.from, data.partyId);
            }
            break;
            
        case 'partyAccept':
            if (playerParty.id === data.partyId && data.from !== player.name) {
                // Someone joined our party
                addChatMessage(`${data.from} has joined the party!`, 'party');
                // Remove from pending invites
                playerParty.pendingInvites = playerParty.pendingInvites.filter(n => n !== data.from);
                if (typeof updateOnlinePlayersUI === 'function') updateOnlinePlayersUI();
            }
            break;
            
        case 'partyLeave':
            if (playerParty.id === data.partyId && data.from !== player.name) {
                addChatMessage(`${data.from} has left the party.`, 'party');
                // If leader left, party disbands
                if (data.wasLeader) {
                    addChatMessage('The party has been disbanded.', 'party');
                    playerParty.id = null;
                    playerParty.leader = null;
                    playerParty.members = [];
                    // Clear saved party info
                    player.partyInfo = null;
                    if (typeof saveCharacter === 'function') saveCharacter();
                    // Notify game server of party change
                    if (typeof window.updatePartyOnServer === 'function') {
                        window.updatePartyOnServer();
                    }
                    if (typeof window.updatePartyOverlay === 'function') window.updatePartyOverlay();
                }
                if (typeof updateOnlinePlayersUI === 'function') updateOnlinePlayersUI();
            }
            break;
            
        case 'partyKick':
            // Check if WE are being kicked
            if (data.target === player.name && data.partyId === playerParty.id) {
                addChatMessage(`You have been kicked from the party by ${data.from}.`, 'error');
                playerParty.id = null;
                playerParty.leader = null;
                playerParty.members = [];
                playerParty.pendingInvites = [];
                // Clear saved party info
                player.partyInfo = null;
                if (typeof saveCharacter === 'function') saveCharacter();
                updatePresence();
                // Notify game server of party change
                if (typeof window.updatePartyOnServer === 'function') {
                    window.updatePartyOnServer();
                }
                if (typeof updateOnlinePlayersUI === 'function') updateOnlinePlayersUI();
                if (typeof window.updatePartyOverlay === 'function') window.updatePartyOverlay();
            } 
            // Check if someone else in our party was kicked
            else if (data.partyId === playerParty.id && data.from !== player.name) {
                addChatMessage(`${data.target} was kicked from the party.`, 'party');
                if (typeof updateOnlinePlayersUI === 'function') updateOnlinePlayersUI();
            }
            break;
    }
}

// Helper function to dismiss invite prompts with fade animation
function dismissInvitePrompt(element) {
    const prompt = element.closest('.invite-prompt');
    if (prompt) {
        prompt.classList.add('dismissing');
        setTimeout(() => prompt.remove(), 200);
    }
}
window.dismissInvitePrompt = dismissInvitePrompt;

// Show party invite prompt
function showPartyInvitePrompt(fromPlayer, partyId) {
    // Remove any existing party invite prompts
    document.querySelectorAll('.party-invite-prompt').forEach(el => el.remove());
    
    // Create a fixed position prompt
    const prompt = document.createElement('div');
    prompt.className = 'invite-prompt party-invite-prompt';
    prompt.innerHTML = `
        <h3>Party Invite</h3>
        <p><strong>${fromPlayer}</strong> wants you to join their party!</p>
        <div class="invite-buttons">
            <button class="invite-accept-btn" onclick="acceptPartyInvite('${partyId}', '${fromPlayer}'); dismissInvitePrompt(this);">Accept</button>
            <button class="invite-decline-btn" onclick="declinePartyInvite('${fromPlayer}'); dismissInvitePrompt(this);">Decline</button>
        </div>
    `;
    
    const promptContainer = document.getElementById('invite-prompt-container') || document.body;
    promptContainer.appendChild(prompt);
    
    // Auto-dismiss after 30 seconds
    setTimeout(() => {
        if (prompt.parentNode) {
            prompt.remove();
            addChatMessage(`Party invite from ${fromPlayer} expired.`, 'party');
        }
    }, 30000);
    
    // Also show notification
    if (typeof showNotification === 'function') {
        showNotification(`Party invite from ${fromPlayer}!`, 'party');
    }
    
    // Play notification sound
    if (typeof playSound === 'function') {
        playSound('playerOnline');
    }
}

// Handle incoming guild invites
function handleGuildInvite(data) {
    if (data.to !== player.name || data.from === player.name) return;
    
    // Don't show invite if already in a guild
    if (player.guild && player.guild.name) {
        return;
    }
    
    showGuildInvitePrompt(data.from, data.guildName, data.guildIcon);
}

// Show guild invite prompt
function showGuildInvitePrompt(fromPlayer, guildName, guildIcon) {
    // Remove any existing guild invite prompts
    document.querySelectorAll('.guild-invite-prompt').forEach(el => el.remove());
    
    // Render guild icon as sprite
    const iconId = guildIcon || 1;
    const guildIconHtml = typeof renderGuildIcon === 'function' ? renderGuildIcon(iconId, 2) : '';
    
    const prompt = document.createElement('div');
    prompt.className = 'invite-prompt guild-invite-prompt';
    prompt.innerHTML = `
        <h3>Guild Invite</h3>
        <p><strong>${fromPlayer}</strong> invites you to join</p>
        <p style="font-size: 1.2em; color: #9b59b6; display: flex; align-items: center; justify-content: center; gap: 8px;">${guildIconHtml} ${guildName}</p>
        <div class="invite-buttons">
            <button class="invite-accept-btn" onclick="acceptGuildInvite('${guildName}', '${guildIcon}'); dismissInvitePrompt(this);">Accept</button>
            <button class="invite-decline-btn" onclick="declineGuildInvite('${fromPlayer}'); dismissInvitePrompt(this);">Decline</button>
        </div>
    `;
    
    const promptContainer = document.getElementById('invite-prompt-container') || document.body;
    promptContainer.appendChild(prompt);
    
    // Auto-dismiss after 30 seconds
    setTimeout(() => {
        if (prompt.parentNode) {
            prompt.remove();
            addChatMessage(`Guild invite to ${guildName} expired.`, 'system');
        }
    }, 30000);
    
    if (typeof showNotification === 'function') {
        showNotification(`Guild invite to ${guildName}!`, 'system');
    }
    
    // Play notification sound
    if (typeof playSound === 'function') {
        playSound('playerOnline');
    }
}

// Accept a guild invite
function acceptGuildInvite(guildName, guildIcon) {
    // Check for validation issues
    if (hasValidationIssues()) {
        showValidationBlockedMessage('join guilds');
        return;
    }
    
    if (player.guild && player.guild.name) {
        addChatMessage('You are already in a guild.', 'error');
        return;
    }
    
    player.guild = {
        name: guildName,
        icon: guildIcon,
        role: 'member',
        joinedAt: Date.now(),
        weeklyKills: 0,
        dailyBossKills: 0
    };
    
    addChatMessage(`You have joined ${guildName}!`, 'system');
    
    if (typeof updateGuildNameplate === 'function') {
        updateGuildNameplate();
    }
    
    // Notify server of appearance change for multiplayer
    if (typeof sendAppearanceUpdate === 'function') {
        sendAppearanceUpdate();
    }
    
    if (typeof updateSocialHubUI === 'function') {
        updateSocialHubUI();
    }
    
    // Update presence with guild info
    updatePresence();
    
    // Initialize guild chat for this guild
    guildChatInitialized = false; // Reset so it can reinitialize for new guild
    initializeGuildChat();
    
    // Add this player to guild rankings
    if (typeof updateGuildRanking === 'function') {
        updateGuildRanking();
    }
    
    // Save player data
    if (typeof saveCharacter === 'function') {
        saveCharacter();
    }
}

// Decline a guild invite
function declineGuildInvite(fromPlayer) {
    addChatMessage(`You declined the guild invite from ${fromPlayer}.`, 'system');
}

// ============================================
// GUILD KICK/DISBAND SYSTEM
// ============================================

/**
 * Delete a guild entirely from Firebase rankings
 * Called when guild master disbands the guild
 */
async function deleteGuildFromRankings(guildName) {
    if (!rankingsInitialized || !guildName) return false;
    
    try {
        const guildRef = db.collection('guilds').doc(guildName);
        await guildRef.delete();
        
        // Clear cache
        guildRankingsCache = null;
        guildRankingsCacheTime = 0;
        
        console.log(`[Guild] Deleted guild "${guildName}" from rankings`);
        return true;
    } catch (error) {
        console.error('[Guild] Error deleting guild from rankings:', error);
        return false;
    }
}

/**
 * Send guild disband notification to all members
 * Called when guild master leaves the guild
 */
async function sendGuildDisbandNotification(guildName) {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) return false;
    }
    
    try {
        // Delete the guild from rankings
        await deleteGuildFromRankings(guildName);
        
        // Send notification to all members
        await db.collection('globalChat').add({
            type: 'guildDisband',
            guildName: guildName,
            from: player.name,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Guild] Sent disband notification for ${guildName}`);
        return true;
    } catch (error) {
        console.error('Error sending guild disband notification:', error);
        return false;
    }
}

/**
 * Send guild kick notification to a specific player
 */
async function sendGuildKickNotification(guildName, targetPlayerName) {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) return false;
    }
    
    try {
        await db.collection('globalChat').add({
            type: 'guildKick',
            guildName: guildName,
            target: targetPlayerName,
            from: player.name,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Guild] Sent kick notification to ${targetPlayerName}`);
        return true;
    } catch (error) {
        console.error('Error sending guild kick notification:', error);
        return false;
    }
}

/**
 * Handle incoming guild disband/kick messages
 */
function handleGuildMessage(data) {
    if (!data.type) return;
    
    switch (data.type) {
        case 'guildDisband':
            // Check if we are in the disbanded guild
            if (player.guild && player.guild.name === data.guildName && data.from !== player.name) {
                const guildName = player.guild.name;
                
                // Disconnect from guild chat
                disconnectGuildChat();
                
                // Remove guild from player
                player.guild = null;
                
                // Update UI
                if (typeof updateSocialHubUI === 'function') {
                    updateSocialHubUI();
                }
                if (typeof updateGuildNameplate === 'function') {
                    updateGuildNameplate();
                }
                
                // Notify server of appearance change for multiplayer
                if (typeof sendAppearanceUpdate === 'function') {
                    sendAppearanceUpdate();
                }
                
                // Update presence
                updatePresence();
                
                // Save player data
                if (typeof saveCharacter === 'function') {
                    saveCharacter();
                }
                
                addChatMessage(`⚠️ ${guildName} has been disbanded by the Guild Master.`, 'system');
                if (typeof showNotification === 'function') {
                    showNotification(`${guildName} has been disbanded!`, 'system');
                }
            }
            break;
            
        case 'guildKick':
            // Check if WE are being kicked
            if (data.target === player.name && player.guild && player.guild.name === data.guildName) {
                const guildName = player.guild.name;
                
                // Disconnect from guild chat
                disconnectGuildChat();
                
                // Remove guild from player
                player.guild = null;
                
                // Update UI
                if (typeof updateSocialHubUI === 'function') {
                    updateSocialHubUI();
                }
                if (typeof updateGuildNameplate === 'function') {
                    updateGuildNameplate();
                }
                
                // Notify server of appearance change for multiplayer
                if (typeof sendAppearanceUpdate === 'function') {
                    sendAppearanceUpdate();
                }
                
                // Update presence
                updatePresence();
                
                // Save player data
                if (typeof saveCharacter === 'function') {
                    saveCharacter();
                }
                
                addChatMessage(`⚠️ You have been kicked from ${guildName} by the Guild Master.`, 'error');
                if (typeof showNotification === 'function') {
                    showNotification(`You were kicked from ${guildName}!`, 'error');
                }
            }
            break;
    }
}

// ============================================
// BUDDY REQUEST SYSTEM
// ============================================

/**
 * Clean up duplicate buddies in player's buddy list
 */
function deduplicateBuddyList() {
    if (!player || !player.buddies || player.buddies.length === 0) return;
    
    const seen = new Set();
    const uniqueBuddies = [];
    
    for (const buddy of player.buddies) {
        const name = typeof buddy === 'string' ? buddy : buddy.name;
        if (!seen.has(name)) {
            seen.add(name);
            uniqueBuddies.push(buddy);
        }
    }
    
    if (uniqueBuddies.length !== player.buddies.length) {
        console.log(`[Buddy] Removed ${player.buddies.length - uniqueBuddies.length} duplicate buddies`);
        player.buddies = uniqueBuddies;
        if (typeof saveCharacter === 'function') {
            saveCharacter();
        }
    }
}

/**
 * Send a buddy request to another player
 */
async function sendBuddyRequest(targetPlayerName) {
    // Clean up duplicates first
    deduplicateBuddyList();
    
    if (!player || !player.name) {
        addChatMessage('You must be logged in to send buddy requests.', 'error');
        return false;
    }
    
    if (targetPlayerName === player.name) {
        addChatMessage("You can't add yourself as a buddy!", 'error');
        return false;
    }
    
    // Check if already buddies
    if (player.buddies && player.buddies.some(b => b.name === targetPlayerName)) {
        addChatMessage(`${targetPlayerName} is already your buddy.`, 'error');
        return false;
    }
    
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            addChatMessage('Unable to connect to server.', 'error');
            return false;
        }
    }
    
    try {
        // Send buddy request via global chat (same pattern as party invites)
        await db.collection('globalChat').add({
            type: 'buddyRequest',
            from: player.name,
            fromLevel: player.level || 1,
            fromClass: player.class || 'Beginner',
            to: targetPlayerName,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        addChatMessage(`Buddy request sent to ${targetPlayerName}!`, 'system');
        return true;
    } catch (error) {
        console.error('Error sending buddy request:', error);
        addChatMessage('Failed to send buddy request.', 'error');
        return false;
    }
}

/**
 * Accept a buddy request - adds both players to each other's buddy lists
 */
async function acceptBuddyRequest(fromPlayerName) {
    if (!player || !player.name) return;
    
    if (!player.buddies) player.buddies = [];
    
    // Check if already buddies
    if (player.buddies.some(b => b.name === fromPlayerName)) {
        addChatMessage(`${fromPlayerName} is already your buddy.`, 'error');
        return;
    }
    
    // Check buddy list limit
    if (player.buddies.length >= 50) {
        addChatMessage('Your buddy list is full (max 50).', 'error');
        return;
    }
    
    // Add to our buddy list
    player.buddies.push({
        name: fromPlayerName,
        addedAt: Date.now()
    });
    
    addChatMessage(`You are now buddies with ${fromPlayerName}!`, 'system');
    
    // Update UI
    if (typeof updateSocialHubUI === 'function') {
        updateSocialHubUI();
    }
    
    // Save our player data
    if (typeof saveCharacter === 'function') {
        saveCharacter();
    }
    
    // Send acceptance notification so the other player also adds us
    if (rankingsInitialized) {
        try {
            await db.collection('globalChat').add({
                type: 'buddyAccept',
                from: player.name,
                fromLevel: player.level || 1,
                fromClass: player.class || 'Beginner',
                to: fromPlayerName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error sending buddy acceptance:', error);
        }
    }
    
    // Initialize/reinitialize buddy chat
    if (typeof initializeBuddyChat === 'function') {
        buddyChatInitialized = false;
        initializeBuddyChat();
    }
}

/**
 * Decline a buddy request
 */
function declineBuddyRequest(fromPlayerName) {
    addChatMessage(`You declined the buddy request from ${fromPlayerName}.`, 'system');
}

/**
 * Handle incoming buddy request messages
 */
function handleBuddyMessage(data) {
    if (!data.type) return;
    
    switch (data.type) {
        case 'buddyRequest':
            if (data.to === player.name && data.from !== player.name) {
                // Show buddy request UI
                showBuddyRequestPrompt(data.from, data.fromLevel, data.fromClass);
            }
            break;
            
        case 'buddyAccept':
            if (data.to === player.name && data.from !== player.name) {
                // The other player accepted our request - add them to our list
                if (!player.buddies) player.buddies = [];
                
                if (!player.buddies.some(b => b.name === data.from)) {
                    player.buddies.push({
                        name: data.from,
                        addedAt: Date.now()
                    });
                    
                    addChatMessage(`${data.from} accepted your buddy request!`, 'system');
                    
                    if (typeof updateSocialHubUI === 'function') {
                        updateSocialHubUI();
                    }
                    
                    if (typeof saveCharacter === 'function') {
                        saveCharacter();
                    }
                    
                    // Initialize/reinitialize buddy chat
                    buddyChatInitialized = false;
                    initializeBuddyChat();
                }
            }
            break;
    }
}

/**
 * Show buddy request prompt
 */
function showBuddyRequestPrompt(fromPlayer, fromLevel, fromClass) {
    // Remove any existing buddy request prompts from this player
    document.querySelectorAll(`.buddy-invite-prompt[data-from="${fromPlayer}"]`).forEach(el => el.remove());
    
    const prompt = document.createElement('div');
    prompt.className = 'invite-prompt buddy-invite-prompt';
    prompt.setAttribute('data-from', fromPlayer);
    prompt.innerHTML = `
        <h3>Buddy Request</h3>
        <p><strong>${fromPlayer}</strong> wants to be your buddy!</p>
        <div class="invite-buttons">
            <button class="invite-accept-btn" onclick="acceptBuddyRequest('${fromPlayer}'); dismissInvitePrompt(this);">Accept</button>
            <button class="invite-decline-btn" onclick="declineBuddyRequest('${fromPlayer}'); dismissInvitePrompt(this);">Decline</button>
        </div>
    `;
    
    const promptContainer = document.getElementById('invite-prompt-container') || document.body;
    promptContainer.appendChild(prompt);
    
    // Auto-dismiss after 60 seconds
    setTimeout(() => {
        if (prompt.parentNode) {
            prompt.remove();
            addChatMessage(`Buddy request from ${fromPlayer} expired.`, 'system');
        }
    }, 60000);
    
    // Show notification
    if (typeof showNotification === 'function') {
        showNotification(`Buddy request from ${fromPlayer}!`, 'system');
    }
    
    // Play notification sound
    if (typeof playSound === 'function') {
        playSound('playerOnline');
    }
}

// Get current party info for UI
function getPartyInfo() {
    return {
        inParty: !!playerParty.id,
        isLeader: playerParty.leader === player.name,
        partyId: playerParty.id,
        leader: playerParty.leader,
        members: playerParty.members
    };
}

// Check if a player is in our party
function isInMyParty(playerName) {
    if (!playerParty.id) return false;
    const playerData = onlinePlayers[playerName];
    return playerData && playerData.partyId === playerParty.id;
}
const PRESENCE_UPDATE_INTERVAL = 60000; // Update presence every 60 seconds (reduced to save writes)
const PRESENCE_TIMEOUT = 180000; // Consider offline after 3 minutes of no updates (3x the interval)
const AFK_TIMEOUT = 300000; // 5 minutes of no activity = AFK

// Activity tracking for AFK detection
let lastActivityTime = Date.now();
let currentStatus = 'online'; // 'online', 'afk', 'offline'

// Track user activity
function trackActivity() {
    lastActivityTime = Date.now();
    if (currentStatus === 'afk') {
        currentStatus = 'online';
        // Immediately update presence when coming back from AFK
        updatePresence();
    }
}

// Set up activity listeners
function setupActivityTracking() {
    // Track mouse movement
    document.addEventListener('mousemove', trackActivity, { passive: true });
    // Track key presses
    document.addEventListener('keydown', trackActivity, { passive: true });
    // Track mouse clicks
    document.addEventListener('mousedown', trackActivity, { passive: true });
    // Track touch events (mobile)
    document.addEventListener('touchstart', trackActivity, { passive: true });
    // Track gamepad input (checked in game loop, but also here)
    window.addEventListener('gamepadconnected', trackActivity);
}

// Check if player is AFK
function checkAfkStatus() {
    const timeSinceActivity = Date.now() - lastActivityTime;
    if (timeSinceActivity >= AFK_TIMEOUT && currentStatus !== 'afk') {
        currentStatus = 'afk';
        updatePresence(); // Update presence to show AFK status
    }
}

// Clean up presence on page unload - multiple methods for reliability
window.addEventListener('beforeunload', async () => {
    if (rankingsInitialized && player && player.name && typeof db !== 'undefined') {
        try {
            // Try to delete the presence document
            await db.collection('presence').doc(player.name).delete();
        } catch (e) {
            // Fallback: use sendBeacon if available
            if (navigator.sendBeacon) {
                // Can't directly use Firestore with sendBeacon, but we can set a flag
                // The document will be cleaned up by timeout
            }
        }
    }
});

// Also handle visibility change (tab hidden/closed)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        // Tab is hidden - could be switching tabs or closing
        // We'll let the timeout handle cleanup, but mark as potentially leaving
    } else if (document.visibilityState === 'visible') {
        // Tab is visible again - update presence
        trackActivity();
        if (presenceInitialized) {
            updatePresence();
        }
    }
});

// Handle page hide event (more reliable for mobile)
window.addEventListener('pagehide', () => {
    if (rankingsInitialized && player && player.name && typeof db !== 'undefined') {
        try {
            db.collection('presence').doc(player.name).delete();
        } catch (e) {
            // Ignore errors during unload
        }
    }
});

// Initialize online presence tracking
async function initializePresence() {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            console.log('Firebase not available, presence disabled');
            return false;
        }
    }

    if (presenceInitialized) {
        return true;
    }

    try {
        // Fetch validation status from Firebase first
        await fetchValidationStatus();
        
        // Set up activity tracking
        setupActivityTracking();
        
        // Reset activity time
        lastActivityTime = Date.now();
        currentStatus = 'online';
        
        // Set initial presence first (without party info - we'll validate it after)
        await updatePresence();

        // Only check AFK status periodically - presence updates happen on map change
        presenceUpdateInterval = setInterval(() => {
            checkAfkStatus();
            // Don't update presence here - only on map changes to save writes
        }, PRESENCE_UPDATE_INTERVAL);
        
        // Validate and restore party info from saved player data
        if (player.partyInfo && player.partyInfo.id && player.partyInfo.leader) {
            try {
                // Check if the party leader is still online with the same party
                const leaderPresenceDoc = await db.collection('presence').doc(player.partyInfo.leader).get();
                if (leaderPresenceDoc.exists) {
                    const leaderData = leaderPresenceDoc.data();
                    // Verify leader is online and in the same party
                    if (leaderData.partyId === player.partyInfo.id) {
                        // Party still exists! Restore it
                        playerParty.id = player.partyInfo.id;
                        playerParty.leader = player.partyInfo.leader;
                        playerParty.members = [player.name];
                        console.log('[Party] Validated and restored party info:', player.partyInfo);
                        // Update our presence with party info
                        await updatePresence();
                    } else {
                        // Leader is online but doesn't have matching partyId in presence
                        // This could be a race condition - don't clear immediately
                        // Just restore our local state and let the game server handle actual party sync
                        console.log('[Party] Leader presence partyId mismatch, restoring local party anyway:', player.partyInfo);
                        playerParty.id = player.partyInfo.id;
                        playerParty.leader = player.partyInfo.leader;
                        playerParty.members = [player.name];
                    }
                } else {
                    // Leader is offline - we can't verify, so clear for safety
                    // They'll need to re-invite when they come back online
                    console.log('[Party] Party leader is offline, clearing party info until they return');
                    player.partyInfo = null;
                    await saveCharacter(player.name, player);
                }
            } catch (error) {
                console.error('[Party] Error validating party info:', error);
                // Clear on error to be safe
                player.partyInfo = null;
            }
        }

        // Track previously known online players for join/leave detection
        if (!window.knownOnlinePlayers) {
            window.knownOnlinePlayers = {};
            window.presenceFirstLoad = true;
        }

        // Listen for online players
        presenceUnsubscribe = db.collection('presence')
            .onSnapshot((snapshot) => {
                const now = Date.now();
                const previousPlayers = { ...window.knownOnlinePlayers };
                onlinePlayers = {};
                
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    // Only include players who updated recently
                    if (data.lastSeen && data.lastSeen.toMillis && (now - data.lastSeen.toMillis()) < PRESENCE_TIMEOUT) {
                        onlinePlayers[doc.id] = {
                            playerName: data.playerName,
                            level: data.level,
                            class: data.class,
                            currentMap: data.currentMap,
                            mapDisplayName: data.mapDisplayName,
                            status: data.status || 'online',
                            activity: data.activity || 'exploring',
                            lastSeen: data.lastSeen,
                            partyId: data.partyId || null,
                            partyLeader: data.partyLeader || null,
                            guildName: data.guildName || null,
                            guildIcon: data.guildIcon || null,
                            totalKills: data.totalKills || 0,
                            achievementCount: data.achievementCount || 0,
                            // Avatar visual data for player inspection
                            customization: data.customization || { skinTone: 0, eyeColor: 0, hairStyle: 0, hairColor: 0 },
                            equipped: data.equipped || {}
                        };
                        
                        // Check if this is a new player coming online (not on first load, not ourselves)
                        if (!window.presenceFirstLoad && !previousPlayers[doc.id] && doc.id !== player.name) {
                            if (typeof addChatMessage === 'function') {
                                addChatMessage(`${data.playerName} (Lv.${data.level} ${capitalize(data.class) || 'Beginner'}) has come online!`, 'player-join');
                            }
                            // Show popup notification with sound
                            const isBuddy = player.buddies && player.buddies.some(b => b.name === data.playerName);
                            const isGuildMember = player.guild && player.guild.name && data.guildName === player.guild.name;
                            if (typeof window.showPlayerOnlineNotification === 'function') {
                                window.showPlayerOnlineNotification(data.playerName, data.level, data.class || 'Beginner', true, isBuddy, isGuildMember);
                            }
                        }
                        
                        // Check if player went AFK or came back
                        if (!window.presenceFirstLoad && previousPlayers[doc.id] && doc.id !== player.name) {
                            const prevStatus = previousPlayers[doc.id].status || 'online';
                            const newStatus = data.status || 'online';
                            if (prevStatus !== 'afk' && newStatus === 'afk') {
                                // Player went AFK - no message needed, just update UI
                            } else if (prevStatus === 'afk' && newStatus !== 'afk') {
                                // Player came back from AFK - no message needed, just update UI
                            }
                        }
                    }
                });
                
                // Check for players who went offline (not on first load)
                if (!window.presenceFirstLoad) {
                    for (const playerId in previousPlayers) {
                        if (!onlinePlayers[playerId] && playerId !== player.name) {
                            const offlinePlayer = previousPlayers[playerId];
                            if (typeof addChatMessage === 'function') {
                                addChatMessage(`${offlinePlayer.playerName} has gone offline.`, 'player-leave');
                            }
                            // Show popup notification (no sound for offline)
                            const isBuddy = player.buddies && player.buddies.some(b => b.name === offlinePlayer.playerName);
                            const isGuildMember = player.guild && player.guild.name && offlinePlayer.guildName === player.guild.name;
                            if (typeof window.showPlayerOnlineNotification === 'function') {
                                window.showPlayerOnlineNotification(offlinePlayer.playerName, offlinePlayer.level, offlinePlayer.class || 'Beginner', false, isBuddy, isGuildMember);
                            }
                        }
                    }
                }
                
                // Update known players and mark first load complete
                window.knownOnlinePlayers = { ...onlinePlayers };
                window.presenceFirstLoad = false;
                
                // Update online players UI if it's open
                if (typeof updateOnlinePlayersUI === 'function') {
                    updateOnlinePlayersUI();
                }
            }, (error) => {
                console.error('Presence listener error:', error);
            });

        presenceInitialized = true;
        console.log('Presence tracking initialized');
        return true;
    } catch (error) {
        console.error('Error initializing presence:', error);
        return false;
    }
}

// Update player presence
async function updatePresence() {
    if (!rankingsInitialized || !player || !player.name) return;

    try {
        const mapName = player.currentMapId || 'ironHaven';
        const mapInfo = typeof maps !== 'undefined' ? maps[mapName] : null;
        const mapDisplayName = mapInfo?.displayName || mapName;
        
        // Calculate total kills for inspection
        const totalKills = player.bestiary?.monsterKills ? 
            Object.values(player.bestiary.monsterKills).reduce((sum, k) => sum + k, 0) : 0;
        
        // Get visual equipped items for avatar rendering (cosmetic overrides regular)
        const visualEquipped = {};
        const allSlots = ['weapon', 'helmet', 'top', 'bottom', 'gloves', 'shoes', 'cape', 'earring', 'ring', 'pendant', 'shield', 'face', 'eye'];
        allSlots.forEach(slot => {
            // Cosmetic items override regular equipped items for visual appearance
            const cosmeticItem = player.cosmeticEquipped?.[slot];
            const equippedItem = player.equipped?.[slot];
            const visualItem = cosmeticItem || equippedItem;
            if (visualItem && visualItem.name) {
                visualEquipped[slot] = visualItem.name;
            }
        });

        await db.collection('presence').doc(player.name).set({
            playerName: player.name,
            level: player.level,
            class: player.class || 'Beginner',
            currentMap: mapName,
            mapDisplayName: mapDisplayName,
            status: currentStatus, // 'online' or 'afk'
            activity: window.playerActivity || 'exploring', // Activity status
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            partyId: playerParty.id,
            partyLeader: playerParty.leader,
            guildName: player.guild?.name || null,
            guildIcon: player.guild?.icon || null,
            totalKills: totalKills,
            achievementCount: Object.keys(player.achievements?.completed || {}).length,
            // Avatar visual data
            customization: player.customization || { skinTone: 0, eyeColor: 0, hairStyle: 0, hairColor: 0 },
            equipped: visualEquipped
        });
    } catch (error) {
        console.error('Error updating presence:', error);
    }
}

// Go offline (call when player leaves)
async function goOffline() {
    if (!rankingsInitialized || !player || !player.name) return;

    try {
        await db.collection('presence').doc(player.name).delete();
    } catch (error) {
        console.error('Error going offline:', error);
    }

    if (presenceUpdateInterval) {
        clearInterval(presenceUpdateInterval);
        presenceUpdateInterval = null;
    }

    if (presenceUnsubscribe) {
        presenceUnsubscribe();
        presenceUnsubscribe = null;
    }

    presenceInitialized = false;
}

// Get list of online players
function getOnlinePlayers() {
    return Object.values(onlinePlayers).filter(p => p.playerName !== player.name);
}

// Get count of online players
function getOnlinePlayerCount() {
    return Object.keys(onlinePlayers).length;
}

// ============================================
// TRADING SYSTEM
// ============================================

let tradeListenerUnsubscribe = null;
let currentTradeId = null;
let currentTradeData = null;
let tradeExecuted = false; // Flag to prevent double execution
const TRADE_TIMEOUT = 300000; // 5 minutes timeout for trades
let tradeAcceptedHandled = false; // Track if we've already handled the accepted state for current trade

// Initialize trade listener for incoming trade requests
async function initializeTradeListener() {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) return false;
    }

    if (!player || !player.name) return false;

    try {
        // Listen for trade requests where this player is the target
        tradeListenerUnsubscribe = db.collection('trades')
            .where('targetPlayer', '==', player.name)
            .where('status', '==', 'pending')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const trade = change.doc.data();
                        trade.id = change.doc.id;
                        showIncomingTradeRequest(trade);
                    }
                });
            });

        // Also listen for updates to trades we initiated
        db.collection('trades')
            .where('initiatorPlayer', '==', player.name)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'modified') {
                        const trade = change.doc.data();
                        trade.id = change.doc.id;
                        handleTradeUpdate(trade);
                    }
                });
            });

        console.log('Trade listener initialized');
        return true;
    } catch (error) {
        console.error('Error initializing trade listener:', error);
        return false;
    }
}

// Send a trade request to another player
async function sendTradeRequest(targetPlayerName) {
    // Check for validation issues
    if (hasValidationIssues()) {
        showValidationBlockedMessage('trade with other players');
        return false;
    }
    
    if (!rankingsInitialized || !player || !player.name) {
        addChatMessage('Unable to send trade request.', 'error');
        return false;
    }

    if (targetPlayerName === player.name) {
        addChatMessage("You can't trade with yourself!", 'error');
        return false;
    }

    // Check if target is online
    if (!onlinePlayers[targetPlayerName]) {
        addChatMessage(`${targetPlayerName} is not online.`, 'error');
        return false;
    }

    // Reset the accepted handled flag for new trade
    tradeAcceptedHandled = false;

    try {
        const tradeData = {
            initiatorPlayer: player.name,
            initiatorLevel: player.level,
            initiatorClass: player.class,
            targetPlayer: targetPlayerName,
            status: 'pending', // pending, accepted, confirmed, completed, cancelled
            initiatorItems: [],
            initiatorGold: 0,
            targetItems: [],
            targetGold: 0,
            initiatorConfirmed: false,
            targetConfirmed: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + TRADE_TIMEOUT)
        };

        const docRef = await db.collection('trades').add(tradeData);
        currentTradeId = docRef.id;
        currentTradeData = tradeData;

        addChatMessage(`Trade request sent to ${targetPlayerName}!`, 'success');
        return true;
    } catch (error) {
        console.error('Error sending trade request:', error);
        addChatMessage('Failed to send trade request.', 'error');
        return false;
    }
}

// Show incoming trade request notification
function showIncomingTradeRequest(trade) {
    // Create a notification/popup for the trade request
    const tradeNotification = document.createElement('div');
    tradeNotification.id = `trade-request-${trade.id}`;
    tradeNotification.className = 'invite-prompt trade-invite-prompt';
    tradeNotification.innerHTML = `
        <h3>Trade Request</h3>
        <p><strong>${trade.initiatorPlayer}</strong> wants to trade with you!</p>
        <div class="invite-buttons">
            <button class="invite-accept-btn" onclick="acceptTradeRequest('${trade.id}'); dismissInvitePrompt(this);">Accept</button>
            <button class="invite-decline-btn" onclick="declineTradeRequest('${trade.id}'); dismissInvitePrompt(this);">Decline</button>
        </div>
    `;

    const promptContainer = document.getElementById('invite-prompt-container') || document.body;
    promptContainer.appendChild(tradeNotification);
    
    // Play notification sound
    if (typeof playSound === 'function') {
        playSound('playerOnline');
    }
    
    // Auto-decline after timeout
    setTimeout(() => {
        const el = document.getElementById(`trade-request-${trade.id}`);
        if (el) {
            el.remove();
            declineTradeRequest(trade.id);
        }
    }, 60000); // 1 minute to respond
}

// Accept trade request
async function acceptTradeRequest(tradeId) {
    try {
        await db.collection('trades').doc(tradeId).update({
            status: 'accepted'
        });

        currentTradeId = tradeId;
        
        // Remove notification
        const el = document.getElementById(`trade-request-${tradeId}`);
        if (el) el.remove();

        // Open trade window
        openTradeWindow(tradeId);
        
        addChatMessage('Trade accepted! Opening trade window...', 'success');
    } catch (error) {
        console.error('Error accepting trade:', error);
        addChatMessage('Failed to accept trade.', 'error');
    }
}

// Decline trade request
async function declineTradeRequest(tradeId) {
    try {
        await db.collection('trades').doc(tradeId).update({
            status: 'cancelled'
        });

        // Remove notification
        const el = document.getElementById(`trade-request-${tradeId}`);
        if (el) el.remove();
    } catch (error) {
        console.error('Error declining trade:', error);
    }
}

// Handle trade status updates
function handleTradeUpdate(trade) {
    if (trade.status === 'accepted' && trade.initiatorPlayer === player.name) {
        // Only handle the 'accepted' state once per trade to avoid repeated messages
        if (!tradeAcceptedHandled) {
            tradeAcceptedHandled = true;
            // Our trade request was accepted, open trade window
            openTradeWindow(trade.id);
            addChatMessage(`${trade.targetPlayer} accepted your trade request!`, 'success');
        }
    } else if (trade.status === 'cancelled') {
        tradeAcceptedHandled = false; // Reset for next trade
        addChatMessage('Trade was cancelled.', 'error');
        closeTradeWindow();
    } else if (trade.status === 'completed') {
        tradeAcceptedHandled = false; // Reset for next trade
        addChatMessage('Trade completed successfully!', 'success');
        closeTradeWindow();
    }
}

// Update items/gold in trade
async function updateTradeOffer(items, gold) {
    if (!currentTradeId) return false;

    // Sanitize items to remove undefined values (Firebase doesn't accept undefined)
    const sanitizedItems = (items || []).map(item => {
        const cleanItem = {};
        for (const key in item) {
            if (item[key] !== undefined) {
                cleanItem[key] = item[key];
            }
        }
        return cleanItem;
    });

    const isInitiator = currentTradeData?.initiatorPlayer === player.name;
    const updateData = isInitiator 
        ? { initiatorItems: sanitizedItems, initiatorGold: gold || 0, initiatorConfirmed: false }
        : { targetItems: sanitizedItems, targetGold: gold || 0, targetConfirmed: false };

    try {
        await db.collection('trades').doc(currentTradeId).update(updateData);
        return true;
    } catch (error) {
        console.error('Error updating trade offer:', error);
        return false;
    }
}

// Confirm trade (both players must confirm)
async function confirmTrade() {
    if (!currentTradeId || tradeExecuted) return false;

    const tradeId = currentTradeId; // Store locally in case it gets cleared
    const isInitiator = currentTradeData?.initiatorPlayer === player.name;
    const updateData = isInitiator 
        ? { initiatorConfirmed: true }
        : { targetConfirmed: true };

    try {
        await db.collection('trades').doc(tradeId).update(updateData);
        // The real-time listener in openTradeWindow will handle detecting both confirmations
        // and trigger trade execution when appropriate
        return true;
    } catch (error) {
        console.error('Error confirming trade:', error);
        return false;
    }
}

// Execute the actual trade (transfer items) - both players execute locally
// This function should NOT update Firebase status - the listener handles that
// Returns true if successful, false if failed
async function executeTrade(trade, tradeId) {
    if (!tradeId) {
        console.error('No trade ID provided to executeTrade');
        addChatMessage('Trade failed - missing trade ID!', 'error');
        return false;
    }
    
    try {
        const isInitiator = trade.initiatorPlayer === player.name;
        
        // Both parties execute their own side of the trade
        // Items we receive
        const itemsToReceive = isInitiator ? (trade.targetItems || []) : (trade.initiatorItems || []);
        const goldToReceive = isInitiator ? (trade.targetGold || 0) : (trade.initiatorGold || 0);
        
        // Items we give away
        const itemsToGive = isInitiator ? (trade.initiatorItems || []) : (trade.targetItems || []);
        const goldToGive = isInitiator ? (trade.initiatorGold || 0) : (trade.targetGold || 0);

        // Validate we have the gold to give
        if (player.gold < goldToGive) {
            addChatMessage("You don't have enough gold for this trade!", 'error');
            return false;
        }

        // Validate we have all items to give BEFORE removing anything
        for (const item of itemsToGive) {
            if (!player.inventory[item.tab] || !player.inventory[item.tab][item.index]) {
                addChatMessage(`Item ${item.name} not found in inventory!`, 'error');
                return false;
            }
            const invItem = player.inventory[item.tab][item.index];
            if (invItem.name !== item.name) {
                addChatMessage(`Item mismatch for ${item.name}!`, 'error');
                return false;
            }
        }

        // All validations passed - now actually transfer items
        // Remove items we're giving (do this in reverse order to not mess up indices)
        const sortedItemsToGive = [...itemsToGive].sort((a, b) => b.index - a.index);
        for (const item of sortedItemsToGive) {
            const removed = removeItemFromInventory(item.name, item.tab, item.index);
            if (!removed) {
                // This should not happen since we validated above, but log it
                console.error(`Failed to remove ${item.name} after validation passed!`);
            }
        }

        // Remove gold we're giving
        player.gold -= goldToGive;

        // Add items we're receiving
        for (const item of itemsToReceive) {
            const newItem = { ...item };
            delete newItem.tab;
            delete newItem.index;
            addItemToInventory(newItem);
        }

        // Add gold we're receiving
        player.gold += goldToReceive;

        // Update UI
        updateUI();
        updateInventoryUI();
        
        // Show loot notifications for traded items
        // Show items/gold we gave away (lost)
        for (const item of itemsToGive) {
            const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
            showNotification(`-${item.name}${qty}`, 'error');
        }
        if (goldToGive > 0) {
            showNotification(`-${goldToGive.toLocaleString()} Gold`, 'error');
        }
        
        // Show items/gold we received (gained)
        for (const item of itemsToReceive) {
            const itemInfo = itemData ? itemData[item.name] : null;
            const rarity = item.rarity || (itemInfo?.category === 'Cosmetic' ? 'cosmetic' : 'common');
            const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
            showNotification(`+${item.name}${qty}`, rarity);
        }
        if (goldToReceive > 0) {
            showNotification(`+${goldToReceive.toLocaleString()} Gold`, 'exp');
        }
        
        playSound('levelUp');
        showMajorNotification('Trade completed!', 'success');
        addChatMessage('Trade completed successfully!', 'success');
        
        // Track trading stats for achievements
        player.stats.tradesCompleted = (player.stats.tradesCompleted || 0) + 1;
        if (goldToGive > 0) {
            player.stats.goldTraded = (player.stats.goldTraded || 0) + goldToGive;
        }
        
        // Check trading achievements
        if (player.stats.tradesCompleted === 1) {
            updateAchievementProgress('action', 'first_trade');
        }
        updateAchievementProgress('action_accumulate', 'trades_completed');
        if (goldToGive > 0) {
            updateAchievementProgress('action_accumulate', 'gold_traded');
        }

        currentTradeId = null;
        currentTradeData = null;
        // Don't close trade window here - let the listener do it when status = 'completed'

        return true;
    } catch (error) {
        console.error('Error executing trade:', error);
        addChatMessage('Trade failed!', 'error');
        return false;
    }
}

// Cancel current trade
async function cancelTrade() {
    if (!currentTradeId) return;

    try {
        await db.collection('trades').doc(currentTradeId).update({ status: 'cancelled' });
        currentTradeId = null;
        currentTradeData = null;
        closeTradeWindow();
        addChatMessage('Trade cancelled.', 'system');
    } catch (error) {
        console.error('Error cancelling trade:', error);
    }
}

// Helper to remove item from inventory by index
function removeItemFromInventory(itemName, tab, index) {
    if (!player.inventory[tab] || !player.inventory[tab][index]) {
        return false;
    }
    
    const item = player.inventory[tab][index];
    if (item.name !== itemName) {
        return false;
    }

    player.inventory[tab].splice(index, 1);
    return true;
}

// ==========================================
// SERVER-FIRST MEDAL SYSTEM
// ==========================================

// Check if player has ever used GM privileges (disqualifies from server-first medals)
function hasPlayerUsedGMPrivileges() {
    if (!player) return false;
    
    // Check the explicit flag
    if (player.hasUsedGMPrivileges) return true;
    
    // Check if GM mode is currently active
    if (typeof isGmMode !== 'undefined' && isGmMode.infiniteStats) return true;
    
    // Check if player has GM Hat in inventory
    if (player.inventory) {
        for (const tab in player.inventory) {
            if (Array.isArray(player.inventory[tab])) {
                for (const item of player.inventory[tab]) {
                    if (item && item.name === 'GM Hat') return true;
                }
            }
        }
    }
    
    // Check if player has GM Hat equipped
    if (player.equipped?.helmet?.name === 'GM Hat') return true;
    if (player.cosmeticEquipped?.helmet?.name === 'GM Hat') return true;
    
    return false;
}

// Check and claim a server-first medal
async function claimServerFirstMedal(medalId) {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            console.log('[Medals] Firebase not available for server-first medals');
            return { success: false, reason: 'Firebase not initialized' };
        }
    }

    if (!player || !player.name) {
        return { success: false, reason: 'No player' };
    }
    
    // Check for GM privileges - disqualifies from server-first medals
    if (hasPlayerUsedGMPrivileges()) {
        console.log('[Medals] Player has used GM privileges, ineligible for server-first medals');
        return { success: false, reason: 'GM privileges used' };
    }

    // Already have this medal?
    if (player.specialMedals && player.specialMedals[medalId]) {
        return { success: false, reason: 'Already owned' };
    }

    try {
        const medalRef = db.collection('serverFirstMedals').doc(medalId);
        
        // Use a transaction to ensure only one player can claim
        const result = await db.runTransaction(async (transaction) => {
            const medalDoc = await transaction.get(medalRef);
            
            if (medalDoc.exists) {
                // Medal already claimed by someone
                const data = medalDoc.data();
                return { success: false, reason: 'already_claimed', claimedBy: data.playerName };
            }
            
            // Claim the medal!
            transaction.set(medalRef, {
                playerName: player.name,
                claimedAt: firebase.firestore.FieldValue.serverTimestamp(),
                playerLevel: player.level,
                playerClass: capitalize(player.class) || 'Beginner'
            });
            
            return { success: true };
        });

        if (result.success) {
            // Award the medal locally
            if (!player.specialMedals) player.specialMedals = {};
            player.specialMedals[medalId] = {
                earnedAt: Date.now(),
                serverFirst: true
            };
            
            const medal = typeof specialMedals !== 'undefined' ? specialMedals[medalId] : null;
            const medalName = medal ? medal.name : medalId;
            
            // Show celebration
            addChatMessage(`🏆 SERVER FIRST! You earned the "${medalName}" medal!`, 'legendary');
            showMajorNotification(`SERVER FIRST: ${medalName}!`, 'legendary');
            playSound('levelUp');
            
            // Save character to persist the medal
            if (typeof saveCharacter === 'function') {
                saveCharacter();
            }
            
            // Send global announcement
            if (typeof sendAnnouncement === 'function') {
                sendAnnouncement('medal_earned', { medalName: medalName, isServerFirst: true });
            }
            
            return { success: true };
        } else {
            return result;
        }
    } catch (error) {
        console.error('[Medals] Error claiming server-first medal:', error);
        return { success: false, reason: 'error' };
    }
}

// Check if a server-first medal has been claimed
async function checkServerFirstMedalClaimed(medalId) {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) return null;
    }

    try {
        const medalDoc = await db.collection('serverFirstMedals').doc(medalId).get();
        if (medalDoc.exists) {
            return medalDoc.data();
        }
        return null;
    } catch (error) {
        console.error('[Medals] Error checking server-first medal:', error);
        return null;
    }
}

// Check founding player status (first 100 players)
async function checkAndClaimFoundingPlayer() {
    if (!rankingsInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) return false;
    }

    if (!player || !player.name) return false;
    
    // Check for GM privileges - disqualifies from founding player medal
    if (hasPlayerUsedGMPrivileges()) {
        console.log('[Medals] Player has used GM privileges, ineligible for founding player medal');
        return false;
    }

    // Already have this medal?
    if (player.specialMedals && player.specialMedals.foundingPlayer) {
        return false;
    }

    try {
        const foundingRef = db.collection('serverFirstMedals').doc('foundingPlayersList');
        
        const result = await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(foundingRef);
            
            let players = [];
            if (doc.exists) {
                players = doc.data().players || [];
            }
            
            // Already in the list?
            if (players.includes(player.name)) {
                return { success: true, alreadyInList: true };
            }
            
            // List full?
            if (players.length >= 100) {
                return { success: false, reason: 'List full' };
            }
            
            // Add to list
            players.push(player.name);
            transaction.set(foundingRef, { 
                players: players,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, position: players.length };
        });

        if (result.success && !result.alreadyInList) {
            // Award the medal
            if (!player.specialMedals) player.specialMedals = {};
            player.specialMedals.foundingPlayer = {
                earnedAt: Date.now(),
                position: result.position
            };
            
            addChatMessage(`You are Founding Player #${result.position}! You earned the "Founding Player" medal!`, 'legendary');
            showMajorNotification(`Founding Player #${result.position}!`, 'epic');
            playSound('levelUp');
            
            if (typeof saveCharacter === 'function') {
                saveCharacter();
            }
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('[Medals] Error checking founding player:', error);
        return false;
    }
}

// Award beta tester medal (called manually or on first login during beta period)
function awardBetaTesterMedal() {
    // Check if beta period is active (set this to false after beta ends)
    const BETA_PERIOD_ACTIVE = true;
    const BETA_END_DATE = new Date('2025-03-01'); // Set your beta end date
    
    if (!BETA_PERIOD_ACTIVE && new Date() > BETA_END_DATE) {
        return false;
    }

    if (!player) return false;
    
    // Check for GM privileges - disqualifies from beta tester medal
    if (hasPlayerUsedGMPrivileges()) {
        console.log('[Medals] Player has used GM privileges, ineligible for beta tester medal');
        return false;
    }

    // Already have this medal?
    if (player.specialMedals && player.specialMedals.betaTester) {
        return false;
    }

    // Award the medal
    if (!player.specialMedals) player.specialMedals = {};
    player.specialMedals.betaTester = {
        earnedAt: Date.now()
    };
    
    addChatMessage(`🎮 You earned the "Beta Tester" medal for playing during the beta period!`, 'epic');
    showMajorNotification('Beta Tester Medal Earned!', 'epic');
    playSound('levelUp');
    
    if (typeof saveCharacter === 'function') {
        saveCharacter();
    }
    
    return true;
}

// Check level-based server-first medals
async function checkLevelMedals(newLevel) {
    if (newLevel >= 50) {
        await claimServerFirstMedal('firstLevel50');
    }
    if (newLevel >= 100) {
        await claimServerFirstMedal('firstLevel100');
    }
}

// Check if player has killed all bosses (for server-first)
async function checkAllBossesKilledMedal() {
    if (!player || !player.bestiary) return;

    const bossTypes = Object.keys(monsterTypes).filter(type => monsterTypes[type].isMiniBoss);
    const allBossesKilled = bossTypes.every(type => (player.bestiary.monsterKills[type] || 0) > 0);
    
    if (allBossesKilled) {
        await claimServerFirstMedal('firstBossKiller');
    }
}

// Check if player has completed all achievements (for server-first)
async function checkCompletionistMedal() {
    if (!player || !player.achievements) return;

    const totalAchievements = typeof achievementData !== 'undefined' ? Object.keys(achievementData).length : 0;
    const completedCount = Object.keys(player.achievements.completed || {}).length;
    
    if (totalAchievements > 0 && completedCount >= totalAchievements) {
        await claimServerFirstMedal('firstCompletionist');
    }
}

// Check Sky Palace-specific medals
async function checkskyPalaceMedals(eventType, data = {}) {
    if (eventType === 'enter_skyPalace') {
        await claimServerFirstMedal('skyPalacePioneer');
    } else if (eventType === 'kill_alishar') {
        await claimServerFirstMedal('firstAlisharSlayer');
    }
}

// Master function to check all applicable medals (call on significant events)
async function checkServerMedals() {
    if (!player) return;
    
    // Check level medals
    await checkLevelMedals(player.level);
    
    // Check boss killer medal
    await checkAllBossesKilledMedal();
    
    // Check completionist medal
    await checkCompletionistMedal();
}

// Initialize medals on character load
async function initializeServerMedals() {
    // Check founding player status on first load
    await checkAndClaimFoundingPlayer();
    
    // Award beta tester medal if in beta period
    awardBetaTesterMedal();
    
    // Check for any medals the player may have earned but not claimed
    await checkServerMedals();
}
