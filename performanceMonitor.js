// Performance Monitoring and Debug System
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            fps: 0,
            frameTime: 0,
            memoryUsage: 0,
            drawCalls: 0,
            activeObjects: 0,
            networkRequests: 0
        };
        
        this.history = {
            fps: [],
            frameTime: [],
            memory: []
        };
        
        this.maxHistoryLength = 60; // Keep 1 second of data at 60fps
        this.isEnabled = false;
        this.debugElement = null;
        
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fpsUpdateInterval = 1000; // Update FPS every second
        this.lastFpsUpdate = 0;
        
        this.init();
    }
    
    init() {
        // Enable in development or when debug flag is set
        this.isEnabled = window.location.hostname === 'localhost' || 
                        window.location.search.includes('debug=true') ||
                        localStorage.getItem('bennSauce_debug') === 'true';
        
        if (this.isEnabled) {
            this.createDebugUI();
            this.startMonitoring();
        }
    }
    
    createDebugUI() {
        this.debugElement = document.createElement('div');
        this.debugElement.id = 'performance-debug';
        this.debugElement.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #00ff00;
            font-family: 'Ari9500', monospace;
            font-size: var(--font-standard);
            padding: 10px;
            border-radius: 5px;
            z-index: 10000;
            min-width: 200px;
            pointer-events: none;
            user-select: none;
        `;
        
        document.body.appendChild(this.debugElement);
        
        // Add toggle button
        const toggleButton = document.createElement('button');
        toggleButton.textContent = '📊';
        toggleButton.style.cssText = `
            position: fixed;
            top: 10px;
            right: 220px;
            width: 30px;
            height: 30px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            z-index: 10001;
            font-size: var(--font-standard);

        `;
        
        toggleButton.addEventListener('click', () => {
            this.debugElement.style.display = 
                this.debugElement.style.display === 'none' ? 'block' : 'none';
        });
        
        document.body.appendChild(toggleButton);
    }
    
    startMonitoring() {
        // Monitor performance every frame
        const monitor = () => {
            if (this.isEnabled) {
                this.updateMetrics();
                this.updateDisplay();
            }
            requestAnimationFrame(monitor);
        };
        
        requestAnimationFrame(monitor);
        
        // Periodic memory monitoring
        setInterval(() => {
            this.updateMemoryMetrics();
        }, 5000);
    }
    
    updateMetrics() {
        const now = performance.now();
        const deltaTime = now - this.lastTime;
        
        // Update frame time
        this.metrics.frameTime = deltaTime;
        this.addToHistory('frameTime', deltaTime);
        
        // Update FPS
        this.frameCount++;
        if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
            this.metrics.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
            this.addToHistory('fps', this.metrics.fps);
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }
        
        // Count active game objects
        this.metrics.activeObjects = this.countActiveObjects();
        
        this.lastTime = now;
    }
    
    updateMemoryMetrics() {
        if (performance.memory) {
            this.metrics.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1048576); // MB
            this.addToHistory('memory', this.metrics.memoryUsage);
        }
    }
    
    countActiveObjects() {
        let count = 0;
        
        if (typeof monsters !== 'undefined') count += monsters.length;
        if (typeof projectiles !== 'undefined') count += projectiles.length;
        if (typeof activeAttacks !== 'undefined') count += activeAttacks.length;
        if (typeof droppedItems !== 'undefined') count += droppedItems.length;
        if (typeof npcs !== 'undefined') count += npcs.length;
        if (typeof portals !== 'undefined') count += portals.length;
        
        return count;
    }
    
    addToHistory(metric, value) {
        if (!this.history[metric]) {
            this.history[metric] = [];
        }
        
        this.history[metric].push(value);
        
        if (this.history[metric].length > this.maxHistoryLength) {
            this.history[metric].shift();
        }
    }
    
    getAverageMetric(metric, samples = 10) {
        const history = this.history[metric];
        if (!history || history.length === 0) return 0;
        
        const recentSamples = history.slice(-samples);
        return recentSamples.reduce((sum, val) => sum + val, 0) / recentSamples.length;
    }
    
    getMetricStatus(metric, value, thresholds) {
        if (value >= thresholds.critical) return '🔴';
        if (value >= thresholds.warning) return '🟡';
        return '🟢';
    }
    
    updateDisplay() {
        if (!this.debugElement) return;
        
        const avgFps = Math.round(this.getAverageMetric('fps', 30));
        const avgFrameTime = Math.round(this.getAverageMetric('frameTime', 30) * 100) / 100;
        const avgMemory = Math.round(this.getAverageMetric('memory', 10));
        
        // Status indicators
        const fpsStatus = this.getMetricStatus(avgFps, avgFps, { warning: 30, critical: 20 });
        const frameTimeStatus = this.getMetricStatus(avgFrameTime, avgFrameTime, { warning: 25, critical: 50 });
        const memoryStatus = this.getMetricStatus(avgMemory, avgMemory, { warning: 100, critical: 200 });
        
        // Pool stats
        let poolStats = '';
        if (typeof getPoolStats === 'function') {
            const pools = getPoolStats();
            poolStats = Object.entries(pools)
                .map(([name, stats]) => `${name}: ${stats.active}/${stats.total}`)
                .join('<br>');
        }
        
        // Memory info
        let memoryInfo = '';
        if (typeof memoryManager !== 'undefined') {
            const info = memoryManager.getMemoryInfo();
            memoryInfo = `
                Events: ${info.eventListeners}<br>
                Timers: ${info.intervals + info.timeouts}<br>
                Observers: ${info.observers}
            `;
        }
        
        this.debugElement.innerHTML = `
            <div><strong>Performance Monitor</strong></div>
            <div>FPS: ${fpsStatus} ${avgFps} (${this.metrics.fps})</div>
            <div>Frame: ${frameTimeStatus} ${avgFrameTime}ms</div>
            <div>Memory: ${memoryStatus} ${avgMemory}MB</div>
            <div>Objects: ${this.metrics.activeObjects}</div>
            <br>
            <div><strong>Object Pools:</strong></div>
            <div style="font-size: var(--font-small);">${poolStats}</div>
            <br>
            <div><strong>Memory Manager:</strong></div>
            <div style="font-size: var(--font-small);">${memoryInfo}</div>
            <br>
            <div style="font-size: var(--font-small); color: #888;">
                Press F12 for full dev tools<br>
                localStorage.debug = 'true'
            </div>
        `;
    }
    
    // Public methods for external monitoring
    startTimer(name) {
        return {
            name,
            startTime: performance.now()
        };
    }
    
    endTimer(timer) {
        const duration = performance.now() - timer.startTime;
        console.log(`⏱️ ${timer.name}: ${duration.toFixed(2)}ms`);
        return duration;
    }
    
    logPerformanceWarning(message, value, threshold) {
        if (value > threshold) {
            console.warn(`⚠️ Performance Warning: ${message} (${value} > ${threshold})`);
        }
    }
    
    // Memory leak detection
    detectMemoryLeaks() {
        const baseline = this.getAverageMetric('memory', 60);
        const current = this.metrics.memoryUsage;
        
        if (current > baseline * 1.5) {
            console.warn('🧠 Potential memory leak detected!', {
                baseline: baseline + 'MB',
                current: current + 'MB',
                increase: Math.round((current - baseline) / baseline * 100) + '%'
            });
        }
    }
    
    // Export performance data
    exportData() {
        return {
            timestamp: Date.now(),
            metrics: { ...this.metrics },
            history: { ...this.history },
            gameInfo: {
                currentMap: typeof currentMapId !== 'undefined' ? currentMapId : 'unknown',
                playerLevel: typeof player !== 'undefined' ? player.level : 0,
                activeObjects: this.metrics.activeObjects
            }
        };
    }
    
    // Toggle debug mode
    toggle() {
        this.isEnabled = !this.isEnabled;
        localStorage.setItem('bennSauce_debug', this.isEnabled.toString());
        
        if (this.debugElement) {
            this.debugElement.style.display = this.isEnabled ? 'block' : 'none';
        }
        
        if (!this.isEnabled && !this.debugElement) {
            this.createDebugUI();
            this.startMonitoring();
        }
    }
}

// Global performance monitor
const performanceMonitor = new PerformanceMonitor();

// Check if we're in development mode
const isDevelopment = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.search.includes('debug=true') ||
                      localStorage.getItem('debug') === 'true';

// Only expose debug functions in development mode
if (isDevelopment) {
    window.debugGame = {
        togglePerformanceMonitor: () => performanceMonitor.toggle(),
        exportPerformanceData: () => performanceMonitor.exportData(),
        getPoolStats: () => typeof getPoolStats === 'function' ? getPoolStats() : 'Pools not available',
        getMemoryInfo: () => typeof memoryManager !== 'undefined' ? memoryManager.getMemoryInfo() : 'Memory manager not available',
        clearPools: () => typeof cleanupObjectPools === 'function' ? cleanupObjectPools() : 'Pools not available',
        forceGC: () => window.gc ? window.gc() : 'GC not available'
    };

    // Console welcome message for developers
    console.log(`
🎮 BennSauce Debug Console

Available commands:
- debugGame.togglePerformanceMonitor() - Toggle performance overlay
- debugGame.exportPerformanceData() - Export performance metrics
- debugGame.getPoolStats() - Get object pool statistics  
- debugGame.getMemoryInfo() - Get memory usage info
- debugGame.clearPools() - Clear all object pools
- debugGame.forceGC() - Force garbage collection (Chrome)

Add ?debug=true to URL or set localStorage.debug = 'true' for persistent debug mode.
`);
} else {
    // Production mode - disable console methods to prevent cheating
    // Keep error logging for debugging production issues
    const noop = () => {};
    
    // Store original console for error reporting
    const originalConsole = {
        error: console.error.bind(console),
        warn: console.warn.bind(console)
    };
    
    // Override console methods
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    console.table = noop;
    console.dir = noop;
    console.dirxml = noop;
    console.trace = noop;
    console.group = noop;
    console.groupCollapsed = noop;
    console.groupEnd = noop;
    console.time = noop;
    console.timeEnd = noop;
    console.profile = noop;
    console.profileEnd = noop;
    console.count = noop;
    console.clear = noop;
    
    // Keep error and warn for production debugging
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    
    // Disable debugGame entirely
    window.debugGame = {
        togglePerformanceMonitor: noop,
        exportPerformanceData: noop,
        getPoolStats: noop,
        getMemoryInfo: noop,
        clearPools: noop,
        forceGC: noop
    };
    
    // Freeze the object to prevent modifications
    Object.freeze(window.debugGame);
}