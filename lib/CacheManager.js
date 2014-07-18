var extend = require('raptor-util').extend;
var raptorCache = require('./raptor-cache');
var baseCacheDir = require('path').join(require('app-root-dir').get(), '.cache');
var path = require('path');

function CacheManager(options) {
    if (!options) {
        options = {};
    }
    
    this._cacheByName = {};
    this._cacheDir = options.dir || (options.name ? path.join(baseCacheDir, options.name) : baseCacheDir);
}

var proto = CacheManager.prototype;

proto.getCacheByName = function(name, defaultConfig) {
    var cache = this._cacheByName[name];
    if (cache === undefined) {
        var config = extend({}, defaultConfig);
        if ((config.store !== 'memory') && !config.dir) {
            // configure the directory where cache will be created
            config.dir = path.join(this._cacheDir, name);
        }
        
        if (!config.name) {
            config.name = name;
        }
        cache = this._cacheByName[name] = raptorCache.createCache(config);
    }
    return cache;
};

proto.forEachCache = function(callback) {
    for (var key in this._cacheByName) {
        if (this._cacheByName.hasOwnProperty(key)) {
            callback(this._cacheByName[key]);
        }
    }
};

proto.flushAll = function() {
    this.forEachCache(function(cache) {
        cache.flush();
    });
};

module.exports = CacheManager;
