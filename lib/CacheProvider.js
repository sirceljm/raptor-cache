var Cache = require('./Cache');

function CacheProvider(configs) {
    this.configs = configs || {};
    this.cachesByName = {};
    this.configurators = {};
}

function createSettings(configs, inheritFrom) {
    var settings;
    if (inheritFrom && configs[inheritFrom]) {
        settings = JSON.parse(JSON.stringify(configs[inheritFrom]));
        settings.inheritsFrom = inheritFrom;
    } else {
        settings = {};
    }
    return settings;
}

CacheProvider.prototype = {

    getCacheConfigIfExists: function(settingsName) {
        return this.configs[settingsName];
    },

    getCacheConfig: function(settingsName) {

        var settings;

        if (settingsName) {
            if ((settings = this.configs[settingsName]) !== undefined) {
                // we already have an instance of these settings
                return settings;
            }
        } else {
            settingsName = 'DEFAULT';
        }
        
        // create settings that inherit from DEFAULT (if DEFAULT exists)
        this.configs[settingsName] = settings = createSettings(this.configs, 'DEFAULT');

        return settings;
    },

    getCache: function(settingsName, cacheName, defaultSettings) {
        var lookupKey = cacheName ? settingsName + '|' + cacheName : settingsName;
        
        var cache = this.cachesByName[lookupKey];

        if (!cache) {
            var settings = defaultSettings || this.getCacheConfig(settingsName);
            this.cachesByName[lookupKey] = cache = new Cache(settings, settingsName, cacheName);
        }
        
        return cache;
    },

    clearAllCaches: function() {
        this.cachesByName = {};
    }
};

module.exports = CacheProvider;