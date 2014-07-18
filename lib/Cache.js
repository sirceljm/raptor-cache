var DataHolder = require('raptor-async/DataHolder');
var inherit = require('raptor-util/inherit');
var EventEmitter = require('events').EventEmitter;
var CacheEntry = require('./CacheEntry');
var logger = require('raptor-logging').logger(module);

function isCacheEntryValid(cache, cacheEntry, lastModified) {
    if (cache.timeToIdle && cacheEntry.meta.lastAccessed && (Date.now() - cacheEntry.meta.lastAccessed > cache.timeToIdle)) {
        return false;
    }

    if (cache.timeToLive && cacheEntry.meta.created && (Date.now() - cacheEntry.meta.created > cache.timeToLive)) {
        return false;
    }

    if (lastModified && cacheEntry.lastModified && lastModified > cacheEntry.lastModified) {
        // The latest last modified is newer than the last modified associated with the cache entry
        return false;
    }

    return true;
}

function getCacheEntry(cache, key, builder, lastModified, callback) {
    var debugEnabled = logger.isDebugEnabled();

    var hold = cache.pending[key];
    if (hold) {
        if (debugEnabled) {
            logger.debug('Hold on key. Delaying getCacheEntry. key: ', key);
        }
        
        // The value for this key is being built... let's wait for it
        // to finish before reading from the cache
        hold.done(function() {
            // Try again after the hold is released...
            getCacheEntry(cache, key, builder, lastModified, callback);
        });
        return;
    }

    if (debugEnabled) {
        logger.debug('No hold on key. Continuing with getCacheEntry for key: ', key);
    }

    cache.cacheStore.get(key, function(err, cacheEntry) {
        if (err) {
            return callback(err);
        }

        if (cacheEntry && !isCacheEntryValid(cache, cacheEntry, lastModified)) {
            cache.remove(key);
            cacheEntry = null;
        }

        if (cacheEntry) {
            if (cache.timeToIdle) {
                cacheEntry.meta.lastAccessed = Date.now();
            }

            if (debugEnabled) {
                logger.debug('Found cache entry for key: ', key);
            }

            return callback(null, cacheEntry);
        }

        if (builder) {
            // See if there is a hold on this key
            var hold = cache.pending[key];
            if (hold) {
                if (debugEnabled) {
                    logger.debug('There is a hold. Waiting for it to finish.');
                }

                // There is a hold... try again after the hold is released...
                hold.done(function() {
                    if (debugEnabled) {
                        logger.debug('Hold finished.');
                    }
                    getCacheEntry(cache, key, builder, lastModified, callback);
                });
            } else {
                hold = cache.hold(key);
                logger.debug('Hold created before invoking builder.');
                builder(function(err, value) {
                    if (err) {
                        logger.error('Error returned by cache entry builder.', err);
                        hold.release();
                        callback(err);
                        return;
                    }
                    if (debugEnabled) {
                        logger.debug('Cache entry builder for key "' + key + '"finished.');
                    }
                    cache.put(key, value);
                    hold.release();
                    getCacheEntry(cache, key, builder, lastModified, callback);
                });
            }
        } else {
            callback();
        }
    });
    
}

function scheduleFree(cache) {
    if (cache.freeDelay) {
        if (cache.freeTimeoutID) {
            clearTimeout(cache.freeTimeoutID);
        }
        cache.freeTimeoutID = setTimeout(function() {
            logger.info('Cleared cache ' + (cache.name || '(unnamed)') + ' after ' + cache.freeDelay + 'ms of inactivity.');
            cache.cacheStore.free();
        }, cache.freeDelay);
    }
}

function Cache(cacheStore, options) {
    if (!options) {
        options = {};
    }

    this.name = options.name;
    this.cacheStore = cacheStore;
    this.timeToLive = options.timeToLive;
    this.timeToIdle = options.timeToIdle;
    this.freeDelay = options.freeDelay;
    this.freeTimeoutID = null;

    // timeToLive: maximum duration since entry added until entry is automatically invalidated
    if (!this.timeToLive || this.timeToLive < 0) {
        // entries will live indefinitely
        this.timeToLive = 0;
    }

    // timeToIdle: maximum duration of inactivity until entry is automatically invalidated
    if (!this.timeToIdle || this.timeToIdle < 0) {
        this.timeToIdle = 0;
    }

    // freeDelay: duration of time after no activity after which the entire cache will be cleared
    if (!this.freeDelay || this.freeDelay < 0) {
        this.freeDelay = 0;
    }

    var _this = this;

    if (cacheStore.hasOwnProperty('isCacheEntryValid')) {
        
        cacheStore.isCacheEntryValid = function(cacheEntry) {
            return isCacheEntryValid(_this, cacheEntry);
        };
    }

    if (this.freeDelay) {
        scheduleFree(this);
    }

    this.pending = {};
}

Cache.prototype = {
    
    hold: function(key) {
        scheduleFree(this);

        var pending = this.pending;
        var dataHolder = new DataHolder();

        var hold = pending[key] = {
            done: function(callback) {
                dataHolder.done(callback);
            },
            release: function() {
                delete pending[key];
                dataHolder.resolve();
            }
        };

        return hold;
    },

    get: function(key, options, callback) {
        scheduleFree(this);

        if (arguments.length === 2) {
            callback = options;
            options = null;
        }

        var builder;
        var lastModified;

        if (typeof options === 'function') {
            builder = options;
            options = null;
        } else if (options) {
            builder = options.builder;
            lastModified = options.lastModified;
        }

        getCacheEntry(this, key, builder, lastModified, function(err, cacheEntry) {
            if (err) {
                return callback(err);
            }

            if (cacheEntry) {
                cacheEntry.readValue(callback);
            } else {
                callback();
            }
        });
    },

    getReadStream: function(key, options, callback) {
        scheduleFree(this);

        if (arguments.length === 2) {
            callback = options;
            options = null;
        }

        var builder;
        var lastModified;

        if (typeof options === 'function') {
            builder = options;
            options = null;
        } else if (options) {
            builder = options.builder;
            lastModified = options.lastModified;
        }

        getCacheEntry(this, key, builder, lastModified, function(err, cacheEntry) {
            if (cacheEntry) {
                var stream = cacheEntry.createReadStream();
                callback(null, stream);
            } else {
                callback();
            }
        });
    },

    put: function(key, value, options) {
        scheduleFree(this);

        var builder;

        if (options) {
            builder = options.builder;
        }

        var reader;

        if (typeof value === 'function') {
            reader = value;
            value = null;
        }

        if (value == null) {
            if (builder) {
                if (!options) {
                    options = {
                        builder: builder
                    };
                } else {
                    options.builder = builder;
                }

                var _this = this;


                var hold = this.hold(key);
                builder(function(err, value) {
                    _this.put(key, value, options);
                    hold.release();
                });
            } else {
                this.remove(key);
            }

            return;
        }

        var cacheEntry = new CacheEntry({
            key: key
        });

        if (this.timeToLive) {
            cacheEntry.meta.created = Date.now();
        }

        if (value != null) {
            cacheEntry.value = value;
        } else if (reader != null) {
            cacheEntry.reader = reader;
        } else {
            throw new Error('Unable to put value for key "' + key + '". Invalid value.');
        }

        this.cacheStore.put(key, cacheEntry);
    },

    remove: function(key) {
        scheduleFree(this);

        this.cacheStore.remove(key);
    },

    flush: function() {
        this.cacheStore.flush();
    }
};

inherit(Cache, EventEmitter);

module.exports = Cache;
