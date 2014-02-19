var Cache = require('./Cache');

function CacheProvider(configs) {
    this.configs = configs;
    this.cachesByName = {};
}

CacheProvider.prototype = {
    getCache: function(settingsName, cacheName) {
        var lookupKey = cacheName ? settingsName + '|' + cacheName : settingsName;

        if (settingsName == null) {
            settingsName = "DEFAULT";
        }
        
        var cache = this.cachesByName[lookupKey];
        
        if (!cache) {
            this.cachesByName[lookupKey] = cache = new Cache(this.configs[settingsName] || {});
            cache.settingsName = settingsName;
            cache.cacheName = cacheName;
        }
        
        return cache;
    },

    clearAllCaches: function() {
        this.cachesByName = {};
    }
};

module.exports = CacheProvider;