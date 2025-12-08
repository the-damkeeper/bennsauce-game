// Simple Test Suite for Game Functions
class GameTestSuite {
    constructor() {
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            total: 0
        };
    }
    
    // Test helper methods
    assertEqual(actual, expected, message) {
        if (actual === expected) {
            return { passed: true, message };
        }
        return { 
            passed: false, 
            message: `${message} - Expected: ${expected}, Got: ${actual}` 
        };
    }
    
    assertTrue(condition, message) {
        return {
            passed: !!condition,
            message: condition ? message : `${message} - Expected true, got false`
        };
    }
    
    assertFalse(condition, message) {
        return {
            passed: !condition,
            message: !condition ? message : `${message} - Expected false, got true`
        };
    }
    
    assertExists(value, message) {
        return {
            passed: value !== undefined && value !== null,
            message: value !== undefined && value !== null ? 
                message : `${message} - Value does not exist`
        };
    }
    
    // Test registration and execution
    addTest(name, testFunction) {
        this.tests.push({ name, testFunction });
    }
    
    async runTests() {
        console.log('Running Game Tests...\n');
        this.results = { passed: 0, failed: 0, total: 0 };
        
        for (const test of this.tests) {
            try {
                const result = await test.testFunction();
                this.results.total++;
                
                if (result.passed) {
                    this.results.passed++;
                    console.log(`✅ ${test.name}`);
                } else {
                    this.results.failed++;
                    console.error(`❌ ${test.name}: ${result.message}`);
                }
            } catch (error) {
                this.results.failed++;
                this.results.total++;
                console.error(`${test.name}: ${error.message}`);
            }
        }
        
        this.printResults();
    }
    
    printResults() {
        console.log('\nTest Results:');
        console.log(`Total: ${this.results.total}`);
        console.log(`Passed: ${this.results.passed}`);
        console.log(`Failed: ${this.results.failed}`);
        console.log(`Success Rate: ${Math.round((this.results.passed / this.results.total) * 100)}%`);
        
        if (this.results.failed === 0) {
            console.log('All tests passed!');
        } else {
            console.warn(`⚠️  ${this.results.failed} test(s) failed`);
        }
    }
}

// Create test suite instance
const gameTests = new GameTestSuite();

// Core System Tests
gameTests.addTest('Constants Loaded', () => {
    return gameTests.assertExists(GAME_CONFIG, 'GAME_CONFIG should be defined');
});

gameTests.addTest('Error Handler Active', () => {
    return gameTests.assertExists(gameErrorHandler, 'Error handler should be initialized');
});

gameTests.addTest('Memory Manager Active', () => {
    return gameTests.assertExists(memoryManager, 'Memory manager should be initialized');
});

gameTests.addTest('Object Pools Active', () => {
    const poolsExist = typeof gameObjectPools !== 'undefined';
    return gameTests.assertTrue(poolsExist, 'Object pools should be available');
});

gameTests.addTest('Input Manager Active', () => {
    return gameTests.assertExists(inputManager, 'Input manager should be initialized');
});

// Game Logic Tests
gameTests.addTest('Player Stats Calculation', () => {
    if (typeof player === 'undefined' || !player.stats) {
        return { passed: false, message: 'Player not initialized for testing' };
    }
    
    const stats = calculatePlayerStats();
    const hasRequiredStats = stats.finalMaxHp > 0 && stats.finalMaxMp > 0;
    
    return gameTests.assertTrue(hasRequiredStats, 'Player stats should calculate valid HP/MP');
});

gameTests.addTest('Save System Integrity', () => {
    if (typeof saveManager === 'undefined') {
        return { passed: false, message: 'Save manager not available' };
    }
    
    const testData = { test: 'data', timestamp: Date.now() };
    const saveData = saveManager.createSaveData(testData);
    const isValid = saveManager.validateSaveData(saveData);
    
    return gameTests.assertTrue(isValid, 'Save data should validate correctly');
});

gameTests.addTest('Item Data Integrity', () => {
    if (typeof itemData === 'undefined') {
        return { passed: false, message: 'Item data not loaded' };
    }
    
    const itemCount = Object.keys(itemData).length;
    const hasItems = itemCount > 0;
    
    return gameTests.assertTrue(hasItems, `Should have item data (found ${itemCount} items)`);
});

gameTests.addTest('Monster Data Integrity', () => {
    if (typeof monsterTypes === 'undefined') {
        return { passed: false, message: 'Monster data not loaded' };
    }
    
    const monsterCount = Object.keys(monsterTypes).length;
    const hasMonsters = monsterCount > 0;
    
    return gameTests.assertTrue(hasMonsters, `Should have monster data (found ${monsterCount} monsters)`);
});

gameTests.addTest('Map Data Integrity', () => {
    if (typeof maps === 'undefined') {
        return { passed: false, message: 'Map data not loaded' };
    }
    
    const mapCount = Object.keys(maps).length;
    const hasMaps = mapCount > 0;
    
    return gameTests.assertTrue(hasMaps, `Should have map data (found ${mapCount} maps)`);
});

// Audio System Tests
gameTests.addTest('Audio Assets Loaded', () => {
    if (typeof audioAssets === 'undefined') {
        return { passed: false, message: 'Audio assets not loaded' };
    }
    
    const audioCount = Object.keys(audioAssets).length;
    const hasAudio = audioCount > 0;
    
    return gameTests.assertTrue(hasAudio, `Should have audio assets (found ${audioCount} assets)`);
});

// UI Tests
gameTests.addTest('DOM Elements Present', () => {
    const requiredElements = [
        'game-container',
        'scaling-container', 
        'world-content',
        'player',
        'ui-container'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    const allPresent = missingElements.length === 0;
    
    return gameTests.assertTrue(
        allPresent, 
        `All required DOM elements should be present. Missing: ${missingElements.join(', ')}`
    );
});

// Performance Tests
gameTests.addTest('Object Pool Efficiency', () => {
    if (typeof gameObjectPools === 'undefined') {
        return { passed: false, message: 'Object pools not available' };
    }
    
    // Test damage number pool
    const pool = gameObjectPools.damageNumber;
    if (!pool) {
        return { passed: false, message: 'Damage number pool not found' };
    }
    
    const initialPooled = pool.pool.length;
    const obj = pool.get();
    const afterGet = pool.pool.length;
    pool.release(obj);
    const afterRelease = pool.pool.length;
    
    const efficiency = (afterGet === initialPooled - 1) && (afterRelease === initialPooled);
    
    return gameTests.assertTrue(efficiency, 'Object pool should manage objects efficiently');
});

// Accessibility Tests
gameTests.addTest('Accessibility Manager', () => {
    if (typeof accessibilityManager === 'undefined') {
        return { passed: false, message: 'Accessibility manager not loaded' };
    }
    
    const hasSettings = accessibilityManager.settings && 
                       typeof accessibilityManager.settings === 'object';
    
    return gameTests.assertTrue(hasSettings, 'Accessibility manager should have settings');
});

// Collision System Test
gameTests.addTest('Collision Detection', () => {
    if (typeof isColliding !== 'function') {
        return { passed: false, message: 'Collision function not available' };
    }
    
    const rect1 = { x: 0, y: 0, width: 10, height: 10 };
    const rect2 = { x: 5, y: 5, width: 10, height: 10 };
    const rect3 = { x: 20, y: 20, width: 10, height: 10 };
    
    const colliding = isColliding(rect1, rect2);
    const notColliding = !isColliding(rect1, rect3);
    
    return gameTests.assertTrue(
        colliding && notColliding, 
        'Collision detection should work correctly'
    );
});

// Add test runner to debug console
if (typeof window.debugGame !== 'undefined') {
    window.debugGame.runTests = () => gameTests.runTests();
}

// Debug functions for monster troubleshooting
window.DEBUG_MONSTERS = false;
window.toggleMonsterDebug = function() {
    window.DEBUG_MONSTERS = !window.DEBUG_MONSTERS;
    console.log(`[DEBUG] Monster debug overlay: ${window.DEBUG_MONSTERS ? 'ENABLED' : 'DISABLED'}`);
    if (!window.DEBUG_MONSTERS) {
        // Clean up debug overlays
        document.querySelectorAll('.monster-debug-overlay').forEach(el => el.remove());
    }
    return window.DEBUG_MONSTERS;
};

// Auto-run tests in development
if (window.location.hostname === 'localhost' || window.location.search.includes('test=true')) {
    // Run tests after game initialization
    window.addEventListener('load', () => {
        setTimeout(() => {
            console.log('🔧 Development mode detected - running tests...');
            gameTests.runTests();
        }, 2000);
    });
}

console.log('🧪 Test suite loaded. Run window.debugGame.runTests() to execute tests.');
console.log('🐛 Monster debug: Run toggleMonsterDebug() to enable visual debugging.');