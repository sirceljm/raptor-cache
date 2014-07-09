var Cache = require('./Cache');
var DiskStore = require('./DiskStore');
var MemoryStore = require('./MemoryStore');

module.exports = exports = {
    createCache: function(config) {
        var store = config.store;
        
        if (store == null) {
            store = 'memory';
        }

        if (typeof store === 'string') {
            if (store === 'disk') {
                store = new DiskStore(config);
            } else if (store === 'memory') {
                store = new MemoryStore(config);
            } else {
                throw new Error('Unsupported store type: ' + store);
            }
        }

        return new Cache(store, config);
    },
    createDiskCache: function(config) {
        var store = new DiskStore(config);
        return new Cache(store, config);
    },
    createMemoryCache: function(config) {
        var store = new MemoryStore(config);
        return new Cache(store, config);
    }
};