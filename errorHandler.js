// Error Handling and Logging System
class GameErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 50;
        this.init();
    }
    
    init() {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.logError('Runtime Error', event.message, event.filename, event.lineno);
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled Promise', event.reason);
        });
    }
    
    logError(type, message, file = '', line = 0) {
        const error = {
            type,
            message,
            file,
            line,
            timestamp: new Date().toISOString(),
            stack: new Error().stack
        };
        
        this.errors.push(error);
        
        // Keep only recent errors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }
        
        // Console log for development
        console.error(`[${type}] ${message}`, error);
        
        // Could send to analytics service here
        this.reportError(error);
    }
    
    reportError(error) {
        // In production, you might want to send errors to a logging service
        // For now, we'll just store them locally
        try {
            const storedErrors = JSON.parse(localStorage.getItem('bennSauce_errors') || '[]');
            storedErrors.push(error);
            
            // Keep only last 20 errors in storage
            if (storedErrors.length > 20) {
                storedErrors.splice(0, storedErrors.length - 20);
            }
            
            localStorage.setItem('bennSauce_errors', JSON.stringify(storedErrors));
        } catch (e) {
            // Storage failed, ignore
        }
    }
    
    getErrors() {
        return this.errors;
    }
    
    clearErrors() {
        this.errors = [];
        localStorage.removeItem('bennSauce_errors');
    }
    
    // Safe function execution wrapper
    safe(fn, context = 'Unknown') {
        try {
            return fn();
        } catch (error) {
            this.logError('Safe Execution', `Error in ${context}: ${error.message}`);
            return null;
        }
    }
    
    // Safe async function execution wrapper
    async safeAsync(fn, context = 'Unknown') {
        try {
            return await fn();
        } catch (error) {
            this.logError('Safe Async Execution', `Error in ${context}: ${error.message}`);
            return null;
        }
    }
}

// Initialize global error handler
const gameErrorHandler = new GameErrorHandler();

// Helper function to safely execute code
function safeExecute(fn, context) {
    return gameErrorHandler.safe(fn, context);
}

// Helper function to safely execute async code
async function safeExecuteAsync(fn, context) {
    return await gameErrorHandler.safeAsync(fn, context);
}