// Centralized Event Manager to prevent memory leaks
class EventManager {
    constructor() {
        this.listeners = new Map(); // Map of element -> array of {event, handler, options}
        this.windowListeners = new Map(); // Track listeners per window ID
    }
    
    /**
     * Add an event listener and track it for cleanup
     * @param {Element} element - DOM element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler function
     * @param {Object} options - addEventListener options
     * @param {string} windowId - Optional window ID for group cleanup
     */
    addEventListener(element, event, handler, options = {}, windowId = null) {
        if (!element || !event || !handler) {
            console.error('Invalid addEventListener parameters');
            return;
        }
        
        element.addEventListener(event, handler, options);
        
        // Track the listener
        if (!this.listeners.has(element)) {
            this.listeners.set(element, []);
        }
        this.listeners.get(element).push({ event, handler, options });
        
        // Track by window ID if provided
        if (windowId) {
            if (!this.windowListeners.has(windowId)) {
                this.windowListeners.set(windowId, []);
            }
            this.windowListeners.get(windowId).push({ element, event, handler, options });
        }
    }
    
    /**
     * Remove a specific event listener
     * @param {Element} element - DOM element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler function
     */
    removeEventListener(element, event, handler) {
        if (!element) return;
        
        element.removeEventListener(event, handler);
        
        // Remove from tracking
        if (this.listeners.has(element)) {
            const listeners = this.listeners.get(element);
            const index = listeners.findIndex(l => l.event === event && l.handler === handler);
            if (index > -1) {
                listeners.splice(index, 1);
            }
            if (listeners.length === 0) {
                this.listeners.delete(element);
            }
        }
    }
    
    /**
     * Remove all event listeners from an element
     * @param {Element} element - DOM element
     */
    removeAllListeners(element) {
        if (!element || !this.listeners.has(element)) return;
        
        const listeners = this.listeners.get(element);
        listeners.forEach(({ event, handler }) => {
            element.removeEventListener(event, handler);
        });
        
        this.listeners.delete(element);
    }
    
    /**
     * Remove all event listeners associated with a window
     * @param {string} windowId - Window ID
     */
    cleanupWindow(windowId) {
        if (!this.windowListeners.has(windowId)) return;
        
        const listeners = this.windowListeners.get(windowId);
        listeners.forEach(({ element, event, handler }) => {
            if (element) {
                element.removeEventListener(event, handler);
            }
        });
        
        this.windowListeners.delete(windowId);
        console.log(`[EventManager] Cleaned up ${listeners.length} listeners for window: ${windowId}`);
    }
    
    /**
     * Remove all tracked event listeners
     */
    cleanup() {
        this.listeners.forEach((listeners, element) => {
            listeners.forEach(({ event, handler }) => {
                element.removeEventListener(event, handler);
            });
        });
        
        this.listeners.clear();
        this.windowListeners.clear();
        console.log('[EventManager] Full cleanup completed');
    }
    
    /**
     * Get statistics about tracked listeners
     */
    getStats() {
        let totalListeners = 0;
        this.listeners.forEach(listeners => {
            totalListeners += listeners.length;
        });
        
        return {
            elements: this.listeners.size,
            totalListeners,
            windows: this.windowListeners.size
        };
    }
}

// Create global instance
const eventManager = new EventManager();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    eventManager.cleanup();
});
