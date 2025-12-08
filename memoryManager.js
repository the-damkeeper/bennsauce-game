// Memory Management and Cleanup System
class MemoryManager {
    constructor() {
        this.eventListeners = new Map();
        this.intervals = new Set();
        this.timeouts = new Set();
        this.observers = new Set();
        this.cleanupFunctions = new Set();
    }
    
    // Event Listener Management
    addEventListener(element, event, handler, options = {}) {
        const key = `${element}_${event}`;
        if (!this.eventListeners.has(key)) {
            this.eventListeners.set(key, []);
        }
        
        element.addEventListener(event, handler, options);
        this.eventListeners.get(key).push({ handler, options });
        
        return { element, event, handler, options };
    }
    
    removeEventListener(element, event, handler) {
        const key = `${element}_${event}`;
        const listeners = this.eventListeners.get(key);
        
        if (listeners) {
            const index = listeners.findIndex(l => l.handler === handler);
            if (index > -1) {
                listeners.splice(index, 1);
                element.removeEventListener(event, handler);
                
                if (listeners.length === 0) {
                    this.eventListeners.delete(key);
                }
            }
        }
    }
    
    removeAllEventListeners(element) {
        const keysToRemove = [];
        for (const [key, listeners] of this.eventListeners) {
            if (key.startsWith(element.toString())) {
                listeners.forEach(({ handler, options }) => {
                    const eventType = key.split('_')[1];
                    element.removeEventListener(eventType, handler, options);
                });
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => this.eventListeners.delete(key));
    }
    
    // Timer Management
    setTimeout(callback, delay) {
        const id = setTimeout(() => {
            this.timeouts.delete(id);
            callback();
        }, delay);
        
        this.timeouts.add(id);
        return id;
    }
    
    setInterval(callback, interval) {
        const id = setInterval(callback, interval);
        this.intervals.add(id);
        return id;
    }
    
    clearTimeout(id) {
        clearTimeout(id);
        this.timeouts.delete(id);
    }
    
    clearInterval(id) {
        clearInterval(id);
        this.intervals.delete(id);
    }
    
    // Observer Management
    observeElement(element, callback, options = {}) {
        const observer = new MutationObserver(callback);
        observer.observe(element, {
            childList: true,
            attributes: true,
            subtree: true,
            ...options
        });
        
        this.observers.add(observer);
        return observer;
    }
    
    disconnectObserver(observer) {
        observer.disconnect();
        this.observers.delete(observer);
    }
    
    // Custom Cleanup Functions
    addCleanupFunction(fn) {
        this.cleanupFunctions.add(fn);
    }
    
    removeCleanupFunction(fn) {
        this.cleanupFunctions.delete(fn);
    }
    
    // Complete Cleanup
    cleanup() {
        // Clear all timers
        this.timeouts.forEach(id => clearTimeout(id));
        this.intervals.forEach(id => clearInterval(id));
        this.timeouts.clear();
        this.intervals.clear();
        
        // Disconnect all observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        
        // Run custom cleanup functions
        this.cleanupFunctions.forEach(fn => {
            try {
                fn();
            } catch (error) {
                console.error('Cleanup function error:', error);
            }
        });
        this.cleanupFunctions.clear();
        
        // Clean event listeners
        this.eventListeners.clear();
        
        // Clean up object pools
        if (typeof cleanupObjectPools === 'function') {
            cleanupObjectPools();
        }
    }
    
    // Memory usage reporting
    getMemoryInfo() {
        const info = {
            eventListeners: this.eventListeners.size,
            intervals: this.intervals.size,
            timeouts: this.timeouts.size,
            observers: this.observers.size,
            cleanupFunctions: this.cleanupFunctions.size
        };
        
        // Add performance memory info if available
        if (performance.memory) {
            info.heapUsed = Math.round(performance.memory.usedJSHeapSize / 1048576); // MB
            info.heapTotal = Math.round(performance.memory.totalJSHeapSize / 1048576); // MB
            info.heapLimit = Math.round(performance.memory.jsHeapSizeLimit / 1048576); // MB
        }
        
        return info;
    }
}

// Global memory manager instance
const memoryManager = new MemoryManager();

// Wrapper functions for global use
function addManagedEventListener(element, event, handler, options) {
    return memoryManager.addEventListener(element, event, handler, options);
}

function removeManagedEventListener(element, event, handler) {
    memoryManager.removeEventListener(element, event, handler);
}

function managedSetTimeout(callback, delay) {
    return memoryManager.setTimeout(callback, delay);
}

function managedSetInterval(callback, interval) {
    return memoryManager.setInterval(callback, interval);
}

function managedClearTimeout(id) {
    memoryManager.clearTimeout(id);
}

function managedClearInterval(id) {
    memoryManager.clearInterval(id);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    memoryManager.cleanup();
});

// Periodic memory cleanup (every 5 minutes)
setInterval(() => {
    // Force garbage collection if available (Chrome DevTools)
    if (window.gc && typeof window.gc === 'function') {
        window.gc();
    }
    
    // Log memory usage in development
    if (typeof DEBUG !== 'undefined' && DEBUG) {
        console.log('Memory Info:', memoryManager.getMemoryInfo());
        if (typeof getPoolStats === 'function') {
            console.log('Pool Stats:', getPoolStats());
        }
    }
}, 300000); // 5 minutes