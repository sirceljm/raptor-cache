var MemoryCache = require('./MemoryCache');
var DiskCache = require('./DiskCache');
var ok = require('assert').ok;

function Cache(config) {
    ok(config, '"config" is required');

    Cache.$super.call(this, config);

    this.cacheName = config.cacheName;
    this.settingsName = config.settingsName;

    var memoryConfig = config.memory || {};
    var diskConfig = config.disk;

    this.memoryCache = new MemoryCache(memoryConfig);
    this.diskCache = null;

    if (diskConfig && diskConfig.enabled !== false && diskConfig.read !== false) {
        this.diskCache = new DiskCache(diskConfig, this.settingsName, this.cacheName);
    }
}

Cache.prototype = {
    doPut: function(key, value) {
        this.memoryCache.put(key, value);
        if (this.diskCache) {
            this.diskCache.put(key, value);
        }
    },
    
    doGet: function(key) {
        var value = this.memoryCache.get(key);
        if (value === undefined && this.diskCache) {
            value = this.diskCache.get(key);
        }
        return value;
    },

    doClear: function() {
        this.memoryCache.clear();
        if (this.diskCache) {
            this.diskCache.clear();
        }
    },

    doRemove: function(key) {
        this.memoryCache.remove(key);
        if (this.diskCache) {
            this.diskCache.remove(key);
        }
    }
};

require('raptor-util').inherit(Cache, require('./BaseCache'));

module.exports = Cache;