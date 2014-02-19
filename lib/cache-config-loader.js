var nodePath = require('path');
var CacheProvider = require('./CacheProvider');
var propertyHandlers = require('property-handlers');

function load(config, path) {
    path = path || '(unknown)';

    var cacheConfigs = {};

    function configureCache(cacheName, config) {
        var cacheConfig = {};

        propertyHandlers(config, {
            memory: function(value) {
                var memoryConfig = cacheConfig.memory = {};

                propertyHandlers(value, {
                    enabled: function(value) {
                        memoryConfig.enabled = value === true;
                    },
                    maxEntries: function(value) {
                        if (value < 0 || value == null) {
                            value = null;
                        }
                        memoryConfig.maxEntries = value;
                    }
                }, 'memory');
            },

            disk: function(value) {
                var diskConfig = cacheConfig.disk = {};

                propertyHandlers(value, {
                    enabled: function(value) {
                        diskConfig.enabled = value === true;
                    },
                    dir: function(value) {
                        diskConfig.dir = nodePath.resolve(path || process.cwd(), value);
                    },
                    read: function(value) {
                        diskConfig.read = value === true;
                    },
                    write: function(value) {
                        diskConfig.write = value === true;
                    },
                    maxEntries: function(value) {
                        if (value < 0 || value == null) {
                            value = null;
                        }
                        diskConfig.maxEntries = value;   
                    }
                }, 'disk');
            }
        }, '"' + cacheName + '" in config at path ' + path);

        if (!cacheConfig.memory) {
            cacheConfig.memory = {};
        }

        cacheConfigs[cacheName] = cacheConfig;
    }

    for (var cacheName in config) {
        if (config.hasOwnProperty(cacheName)) {
            configureCache(cacheName, config[cacheName]);
        }
    }

    if (!cacheConfigs.DEFAULT) {
        cacheConfigs.DEFAULT = {
            memory: {
                maxEntries: null
            }
        };
    }

    return new CacheProvider(cacheConfigs);
}

exports.load = load;