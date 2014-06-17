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

    if (lastModified > 0) {
        cacheEntry.lastModified = lastModified;
    }

    cache.doPut(key, cacheEntry);

    return cacheEntry;
}

function getCheckLastModified(cache, key, cacheEntry, options, callback) {
    var value = cacheEntry.value;

    var lastModified = options ? options.lastModified : null;

    if (cacheEntry && cacheEntry.lastModified && lastModified && lastModified > 0) {
        if (cacheEntry.lastModified !== lastModified) {
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
    _put: function(key, value, options) {
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

            var cacheEntryPromise = promise
                .then(function(value) {
                    delete _this.promises[key];
                    return addCacheEntry(_this, key, value, options);
                });

            this.promises[key] = cacheEntryPromise;

            return cacheEntryPromise;

        } else {
            return addCacheEntry(this, key, value, options);
        }
    },

    put: function(key, value, options) {
        this._put(key, value, options);
    },

    get: function(key, options, callback) {

        if (this.enabled === false) {
            if (callback) {
                callback();
            } else {
                return nullPromise;
            }
        }

        if (arguments.length === 2) {
            if (typeof options === 'function') {
                callback = options;
                options = null;
            }
        }

        var rebuild = false;
        var builder;
        var lastModified = null;
        var deserialize = null;
        
        if (options) {
            deserialize = options.deserialize;
            rebuild = options.rebuild === true;
            builder = options.builder;
            lastModified = options.lastModified;
        }

        var _this = this;

        var cacheEntry = null;
        var cacheEntryPromise = this.promises[key];

        if (cacheEntryPromise) {
            cacheEntryPromise = cacheEntryPromise.then(function(cacheEntry) {

                if (!cacheEntry) {
                    if (callback) {
                        callback();
                    }

                    return undefined;
                }

                return getCheckLastModified(_this, key, cacheEntry, options, callback);
            });

            if (!callback) {
                return cacheEntryPromise;
            }

            return;
        } else  {
            cacheEntry = this.doGet(key, options);

            var getValueFromCacheEntry = function(cacheEntry, cacheEntryDeferred) {
                if (cacheEntry && cacheEntry.lastModified && lastModified && lastModified > 0) {
                    if (cacheEntry.lastModified !== lastModified) {
                        _this.remove(key);
                        cacheEntry = undefined;
                    }
                }

                if ((rebuild || cacheEntry === undefined) && builder) {
                    var builderArg = {
                        setLastModified: function(value) {
                            lastModified = value;
                        }
                    };

                    var value = builder(builderArg);

                    if (lastModified) {
                        if (!options) {
                            options = {};
                        }
                        options.lastModified = lastModified;
                    }

                    cacheEntry = _this._put(key, value, options);

                    if (cacheEntryDeferred) {
                        cacheEntryDeferred.resolve(cacheEntry);
                    }

                    if (callback) {
                        if (value.then) {
                            value.then(function fulfilled(value) {
                                    callback(null, value);
                                },
                                callback);
                        } else {
                            callback(null, value);
                        }
                    } else {
                        return raptorPromises.makePromise(value);
                    }
                } else if (cacheEntry) {
                    if (cacheEntryDeferred) {
                        cacheEntryDeferred.resolve(cacheEntry);
                    }

                    if (deserialize && !cacheEntry.deserialized) {
                        cacheEntry.value = deserialize(cacheEntry.value);
                        cacheEntry.deserialized = true;
                    }

                    if (callback) {
                        callback(null, cacheEntry.value);
                    } else {
                        return raptorPromises.makePromise(cacheEntry.value);
                    }
                } else {
                    if (cacheEntryDeferred) {
                        cacheEntryDeferred.resolve(null);
                    }

                    if (callback) {
                        callback();
                    } else {
                        return nullPromise;
                    }
                }
            };

            if (cacheEntry && typeof cacheEntry.then === 'function') {
                var cacheEntryDeferred = raptorPromises.defer();
                var promise = cacheEntryDeferred.promise;
                this.promises[key] = promise;
                var removePromise = function() {
                    delete _this.promises[key];
                };

                promise.then(removePromise, removePromise);
                promise = cacheEntry.then(function(cacheEntry) {
                    return getValueFromCacheEntry(cacheEntry, cacheEntryDeferred);
                });

                if (!callback) {
                    return promise;
                }
            } else {
                return getValueFromCacheEntry(cacheEntry);
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