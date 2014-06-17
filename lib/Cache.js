var MemoryCache = require('./MemoryCache');
var DiskCache = require('./DiskCache');
var SingleFileDiskCache = require('./SingleFileDiskCache');
var ok = require('assert').ok;

/**
 * A unification of a disk cache and memory cache
 */
function Cache(config, settingsName, cacheName) {
    ok(config, '"config" is required');

    Cache.$super.call(this, config);

    this.cacheName = cacheName;
    this.settingsName = settingsName;

    var memoryConfig = config.memory || {};
    var diskConfig = config.disk;

    this.memoryCache = new MemoryCache(memoryConfig);
    this.diskCache = null;

    if (diskConfig && diskConfig.enabled !== false && diskConfig.read !== false) {
        var DiskCacheImpl = diskConfig.singleFile ? SingleFileDiskCache : DiskCache;
        this.diskCache = new DiskCacheImpl(diskConfig, this.settingsName, this.cacheName);
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

            // copy the disk cache entry back into the memory cache
            if (value && value.then) {
                value.then(function(realValue) {
                    if (realValue) {
                        this.memoryCache.put(key, realValue);
                    }
                });
            } else {
                this.memoryCache.put(key, value);
            }
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