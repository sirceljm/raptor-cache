function MemoryCache(config) {
    this.cacheMap = {};
}

MemoryCache.prototype = {
    put: function(key, value) {
        this.cacheMap[key] = value;
    },
    
    get: function(key) {
        return this.cacheMap[key];
    },

    clear: function() {
        this.cacheMap = {};
    },

    remove: function(key) {
        delete this.cacheMap[key];
    }
};

module.exports = MemoryCache;