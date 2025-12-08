/**
 * BennSauce Firebase Cloud Functions
 * 
 * These functions provide server-side validation for anti-cheat protection.
 * They only run when triggered, minimizing read/write costs.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Login: firebase login
 * 3. Init functions: firebase init functions (select your project)
 * 4. Copy this file to functions/index.js
 * 5. Deploy: firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ============================================
// VALIDATION HELPERS (Server-side, not visible to clients)
// ============================================

// Secret server-side salt (different from client)
const SERVER_SALT = 'BennSauceServer2025_X7k9Pm3Q';

/**
 * Generate server-side checksum (more secure than client version)
 */
function generateServerChecksum(data) {
    const str = JSON.stringify(data) + SERVER_SALT;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

/**
 * Validate player stats for cheating indicators
 * Returns { valid: boolean, issues: string[], severity: 'none'|'warning'|'critical' }
 */
function validatePlayerData(data, previousData = null) {
    const issues = [];
    let severity = 'none';
    
    // Basic sanity checks
    if (data.level < 1 || data.level > 200) {
        issues.push('Invalid level range');
        severity = 'critical';
    }
    
    if (data.totalGold < 0) {
        issues.push('Negative gold');
        severity = 'critical';
    }
    
    // Time-based validation
    const minTimeForLevel = Math.max(0, (data.level - 1) * 30); // 30 sec per level minimum
    if (data.level > 10 && data.timePlayed < minTimeForLevel) {
        issues.push(`Level ${data.level} with only ${data.timePlayed}s played`);
        severity = 'critical';
    }
    
    // Kill-based validation
    const minKillsForLevel = Math.max(0, (data.level - 1) * 3);
    if (data.level > 5 && data.totalKills < minKillsForLevel) {
        issues.push(`Level ${data.level} with only ${data.totalKills} kills`);
        severity = 'critical';
    }
    
    // Gold-based validation (generous upper bound)
    const maxReasonableGold = Math.max(100000, data.totalKills * 500);
    if (data.totalGold > maxReasonableGold && data.totalGold > 5000000) {
        issues.push(`${data.totalGold} gold with ${data.totalKills} kills`);
        severity = severity === 'critical' ? 'critical' : 'warning';
    }
    
    // Combat score validation
    // Combat score is roughly: level * 100 + equipment bonuses
    // Max reasonable is around level * 500 with godly gear
    const maxReasonableCombat = data.level * 600;
    if (data.combatScore > maxReasonableCombat) {
        issues.push(`Combat score ${data.combatScore} too high for level ${data.level}`);
        severity = severity === 'critical' ? 'critical' : 'warning';
    }
    
    // Check for sudden jumps if we have previous data
    if (previousData) {
        const levelJump = data.level - previousData.level;
        const timeElapsed = (data.timePlayed || 0) - (previousData.timePlayed || 0);
        
        // More than 10 levels gained with less than 5 minutes of playtime
        if (levelJump > 10 && timeElapsed < 300) {
            issues.push(`Gained ${levelJump} levels in ${timeElapsed}s`);
            severity = 'critical';
        }
        
        // Massive gold jump
        const goldJump = data.totalGold - previousData.totalGold;
        if (goldJump > 10000000 && timeElapsed < 600) {
            issues.push(`Gained ${goldJump} gold in ${timeElapsed}s`);
            severity = 'critical';
        }
    }
    
    return {
        valid: severity !== 'critical',
        issues,
        severity
    };
}

// ============================================
// CLOUD FUNCTIONS
// ============================================

/**
 * Triggered when a ranking document is created or updated
 * Validates the data and adds server-side verification
 * 
 * Cost: 1 read (automatic trigger), 1 write (if updating)
 */
exports.validateRanking = functions.firestore
    .document('rankings/{playerId}')
    .onWrite(async (change, context) => {
        const playerId = context.params.playerId;
        
        // Document was deleted
        if (!change.after.exists) {
            console.log(`Ranking deleted for ${playerId}`);
            return null;
        }
        
        const newData = change.after.data();
        const previousData = change.before.exists ? change.before.data() : null;
        
        // Skip if already validated by server (prevent infinite loops)
        if (newData.serverValidated === true) {
            return null;
        }
        
        // Validate the data
        const validation = validatePlayerData(newData, previousData);
        
        // Generate server checksum
        const serverChecksum = generateServerChecksum({
            playerName: newData.playerName,
            level: newData.level,
            totalKills: newData.totalKills,
            timePlayed: newData.timePlayed
        });
        
        // Update the document with server validation
        const updateData = {
            serverValidated: true,
            serverValidation: {
                valid: validation.valid,
                issues: validation.issues,
                severity: validation.severity,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            },
            serverChecksum: serverChecksum
        };
        
        // If critical issues, flag the account
        if (validation.severity === 'critical') {
            updateData.flagged = true;
            updateData.flagReason = validation.issues.join(', ');
            console.warn(`[ANTI-CHEAT] Flagged player ${playerId}:`, validation.issues);
        }
        
        await change.after.ref.update(updateData);
        
        console.log(`Validated ranking for ${playerId}:`, validation);
        return null;
    });

/**
 * Triggered when a cloud save is created or updated
 * Validates character data before it's saved
 * 
 * Cost: 1 read (automatic trigger), 1 write (if issues found)
 */
exports.validateCloudSave = functions.firestore
    .document('cloudSaves/{playerId}')
    .onWrite(async (change, context) => {
        const playerId = context.params.playerId;
        
        if (!change.after.exists) {
            return null;
        }
        
        const saveData = change.after.data();
        
        // Skip if already validated
        if (saveData.serverValidated === true) {
            return null;
        }
        
        // Extract character data for validation
        const charData = saveData.characterData;
        if (!charData) {
            return null;
        }
        
        // Build validation-friendly format
        const dataToValidate = {
            level: charData.level || 1,
            totalGold: charData.gold || 0,
            totalKills: charData.bestiary?.monsterKills ? 
                Object.values(charData.bestiary.monsterKills).reduce((sum, k) => sum + k, 0) : 0,
            timePlayed: charData.timePlayed || 0,
            combatScore: 0 // We don't have this in save data
        };
        
        const validation = validatePlayerData(dataToValidate);
        
        const updateData = {
            serverValidated: true,
            serverValidation: {
                valid: validation.valid,
                issues: validation.issues,
                severity: validation.severity,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            }
        };
        
        if (validation.severity === 'critical') {
            updateData.flagged = true;
            console.warn(`[ANTI-CHEAT] Flagged cloud save ${playerId}:`, validation.issues);
        }
        
        await change.after.ref.update(updateData);
        return null;
    });

/**
 * Scheduled function to clean up old/invalid rankings
 * Runs once per day to minimize costs
 * 
 * Cost: ~1 read per ranking checked, 1 write per deletion
 */
exports.cleanupRankings = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        console.log('Running daily rankings cleanup...');
        
        // Find flagged accounts that haven't played in 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const flaggedQuery = await db.collection('rankings')
            .where('flagged', '==', true)
            .where('lastUpdated', '<', thirtyDaysAgo)
            .limit(100) // Process in batches to avoid timeouts
            .get();
        
        const batch = db.batch();
        let deleteCount = 0;
        
        flaggedQuery.forEach(doc => {
            batch.delete(doc.ref);
            deleteCount++;
        });
        
        if (deleteCount > 0) {
            await batch.commit();
            console.log(`Deleted ${deleteCount} old flagged rankings`);
        }
        
        return null;
    });

/**
 * HTTP callable function to report suspicious activity
 * Players can report suspected cheaters
 * 
 * Cost: 1 read (to check if target exists), 1 write (to add report)
 */
exports.reportPlayer = functions.https.onCall(async (data, context) => {
    const { reportedPlayer, reason, reporterName } = data;
    
    if (!reportedPlayer || !reason) {
        return { success: false, error: 'Missing required fields' };
    }
    
    // Check if the reported player exists
    const playerDoc = await db.collection('rankings').doc(reportedPlayer).get();
    if (!playerDoc.exists) {
        return { success: false, error: 'Player not found' };
    }
    
    // Add report to a reports collection
    await db.collection('reports').add({
        reportedPlayer,
        reporterName: reporterName || 'Anonymous',
        reason,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        reviewed: false
    });
    
    // Increment report count on the player
    await playerDoc.ref.update({
        reportCount: admin.firestore.FieldValue.increment(1)
    });
    
    console.log(`Player ${reportedPlayer} reported by ${reporterName}: ${reason}`);
    return { success: true };
});

/**
 * Get filtered rankings (excludes flagged accounts)
 * This is an HTTP function for cleaner rankings display
 * 
 * Cost: 1 read for the query
 */
exports.getCleanRankings = functions.https.onCall(async (data, context) => {
    const { category = 'level', limit = 50 } = data;
    
    // Get rankings that are NOT flagged
    let query = db.collection('rankings')
        .where('flagged', '!=', true)
        .limit(limit);
    
    // Sort by category
    switch (category) {
        case 'level':
            query = query.orderBy('flagged').orderBy('level', 'desc');
            break;
        case 'kills':
            query = query.orderBy('flagged').orderBy('totalKills', 'desc');
            break;
        case 'gold':
            query = query.orderBy('flagged').orderBy('totalGold', 'desc');
            break;
        case 'combat':
            query = query.orderBy('flagged').orderBy('combatScore', 'desc');
            break;
        default:
            query = query.orderBy('flagged').orderBy('level', 'desc');
    }
    
    const snapshot = await query.get();
    const rankings = [];
    
    snapshot.forEach(doc => {
        const data = doc.data();
        rankings.push({
            id: doc.id,
            playerName: data.playerName,
            level: data.level,
            class: data.class,
            totalKills: data.totalKills,
            totalGold: data.totalGold,
            combatScore: data.combatScore,
            achievementCount: data.achievementCount,
            bestiaryCompletion: data.bestiaryCompletion
        });
    });
    
    return { rankings };
});
