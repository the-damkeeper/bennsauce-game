// Object Pooling System for Performance Optimization
class ObjectPool {
    constructor(createFn, resetFn, initialSize = 10) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        this.active = [];
        
        // Pre-create initial objects
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }
    
    get() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.createFn();
        }
        
        this.active.push(obj);
        return obj;
    }
    
    release(obj) {
        const index = this.active.indexOf(obj);
        if (index > -1) {
            this.active.splice(index, 1);
            this.resetFn(obj);
            this.pool.push(obj);
        }
    }
    
    releaseAll() {
        while (this.active.length > 0) {
            this.release(this.active[0]);
        }
    }
    
    getStats() {
        return {
            pooled: this.pool.length,
            active: this.active.length,
            total: this.pool.length + this.active.length
        };
    }
}

// Damage Number Pool
const damageNumberPool = new ObjectPool(
    () => {
        const el = document.createElement('div');
        el.className = 'damage-number';
        return { element: el, timeoutId: null };
    },
    (obj) => {
        if (obj.timeoutId) {
            clearTimeout(obj.timeoutId);
            obj.timeoutId = null;
        }
        obj.element.remove();
        obj.element.className = 'damage-number';
        obj.element.textContent = '';
    },
    20
);

// Effect Pool
const effectPool = new ObjectPool(
    () => {
        const el = document.createElement('div');
        el.className = 'effect';
        return { element: el, timeoutId: null };
    },
    (obj) => {
        if (obj.timeoutId) {
            clearTimeout(obj.timeoutId);
            obj.timeoutId = null;
        }
        obj.element.remove();
        obj.element.className = 'effect';
        obj.element.innerHTML = '';
        obj.element.style.cssText = '';
    },
    15
);

// Projectile Pool
const projectilePool = new ObjectPool(
    () => {
        const el = document.createElement('div');
        el.className = 'projectile';
        return {
            element: el,
            x: 0, y: 0, width: 20, height: 20,
            velocityX: 0, velocityY: 0,
            damageMultiplier: 1,
            hitMonsters: [],
            createdAt: 0,
            type: null,
            targetId: null
        };
    },
    (obj) => {
        obj.element.remove();
        obj.element.className = 'projectile';
        obj.element.innerHTML = '';
        obj.element.style.cssText = '';
        obj.x = obj.y = 0;
        obj.velocityX = obj.velocityY = 0;
        obj.damageMultiplier = 1;
        obj.hitMonsters = [];
        obj.createdAt = 0;
        obj.type = null;
        obj.targetId = null;
    },
    25
);

// Attack Box Pool
const attackBoxPool = new ObjectPool(
    () => {
        const el = document.createElement('div');
        el.className = 'attack-box';
        return {
            element: el,
            x: 0, y: 0, width: 80, height: 60,
            damageMultiplier: 1,
            isMultiTarget: false,
            hitMonsters: [],
            createdAt: 0
        };
    },
    (obj) => {
        obj.element.remove();
        obj.element.className = 'attack-box';
        obj.element.innerHTML = '';
        obj.element.style.cssText = '';
        obj.x = obj.y = 0;
        obj.width = 80;
        obj.height = 60;
        obj.damageMultiplier = 1;
        obj.isMultiTarget = false;
        obj.hitMonsters = [];
        obj.createdAt = 0;
    },
    15
);

// Notification Pool
const notificationPool = new ObjectPool(
    () => {
        const el = document.createElement('div');
        el.className = 'notification-text';
        return { element: el, timeoutId: null };
    },
    (obj) => {
        if (obj.timeoutId) {
            clearTimeout(obj.timeoutId);
            obj.timeoutId = null;
        }
        obj.element.remove();
        obj.element.className = 'notification-text';
        obj.element.textContent = '';
        obj.element.style.cssText = ''; // Clear all inline styles
    },
    10
);

// Pool management
const gameObjectPools = {
    damageNumber: damageNumberPool,
    effect: effectPool,
    projectile: projectilePool,
    attackBox: attackBoxPool,
    notification: notificationPool
};

// Cleanup function
function cleanupObjectPools() {
    Object.values(gameObjectPools).forEach(pool => {
        pool.releaseAll();
    });
}

// Debug function
function getPoolStats() {
    const stats = {};
    Object.keys(gameObjectPools).forEach(key => {
        stats[key] = gameObjectPools[key].getStats();
    });
    return stats;
}