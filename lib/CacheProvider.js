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
            var settings = this.configs[settingsName] || this.configs.DEFAULT || {};
            settings.cacheName = cacheName;
            settings.settingsName = settingsName;
            this.cachesByName[lookupKey] = cache = new Cache(settings);
        }
        
        return cache;
    },

    clearAllCaches: function() {
        this.cachesByName = {};
    }
};

module.exports = CacheProvider;