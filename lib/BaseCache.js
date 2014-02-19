var ok = require('assert').ok;

var raptorPromises = require('raptor-promises');
var nullPromise = raptorPromises.resolved(null);

function addCacheEntry(cache, key, value, options) {
    value = value || null;
    var lastModified;
    if (options) {
        lastModified = options.lastModified;
    }

    var cacheEntry = {
        value: value
    };

    if (lastModified) {
        cacheEntry.lastModified = lastModified;
    }

    cache.doPut(key, cacheEntry);

    return cacheEntry;
}

function getCheckLastModified(cache, key, cacheEntry, options, callback) {
    var value = cacheEntry.value;

    if (options && options.lastModified && cacheEntry.lastModified) {
        if (options.lastModified !== cacheEntry.lastModified) {
            cache.remove(key); // Delete the out-of-date cache entry
            value = undefined;
        }
    }

    if (callback) {
        callback(null, value);
    }

    return value;
}

function BaseCache(config) {
    ok(config, '"config" argument is required');
    this.enabled = config && config.enabled !== false;
    this.promises = {};
}

BaseCache.prototype = {
    put: function(key, value, options) {
        if (this.enabled === false) {
            return;
        }

        if (value && typeof value.then === 'function') {
            var promise = value;
            this.promises[key] = promise;

            var _this = this;

            promise.fail(function() {
                    delete _this.promises[key];
                });

            this.promises[key] = promise
                .then(function(value) {
                    delete _this.promises[key];
                    return addCacheEntry(_this, key, value, options);
                });

        } else {
            addCacheEntry(this, key, value, options);
        }
    },

    get: function(key, options, callback) {

        if (this.enabled === false) {
            if (callback) {
                callback();    
            }
            
            return nullPromise;
        }

        if (arguments.length === 2) {
            if (typeof options === 'function') {
                callback = options;
                options = null;
            }
        }

        var rebuild = false;
        var builder;
        
        if (options) {
            rebuild = options.rebuild === true;
            builder = options.builder;
        }

        var _this = this;

        var cacheEntry = null;
        var cacheEntryPromise = this.promises[key];

        if (cacheEntryPromise) {
            return cacheEntryPromise.then(function(cacheEntry) {
                return getCheckLastModified(_this, key, cacheEntry, callback);
            });
        } else  {
            cacheEntry = this.doGet(key);

            if ((rebuild || cacheEntry === undefined) && builder) {

                var lastModified = null;

                var builderArg = {
                    setLastModified: function(value) {
                        lastModified = lastModified;
                    }
                };

                var value = builder(builderArg);

                if (lastModified) {
                    if (!options) {
                        options = {};
                    }
                    options.lastModified = lastModified;
                }

                this.put(key, value, options);

                var valuePromise = raptorPromises.resolved(value);

                if (callback) {
                    valuePromise.then(
                        function fulfilled(value) {
                            callback(null, value);
                        },
                        callback);
                }

                return valuePromise;
            } else if (cacheEntry) {
                return raptorPromises.resolved(
                    getCheckLastModified(_this, key, cacheEntry, callback));
            } else {
                if (callback) {
                    callback();    
                }
                
                return nullPromise;
            }
        }
    },

    clear: function() {
        if (this.enabled === false) {
            return;
        }

        this.promises = {};
        this.doClear();
    },

    remove: function(key) {
        if (this.enabled === false) {
            return;
        }
        
        delete this.promises[key];
        return this.doRemove(key);
    }
};

module.exports = BaseCache;