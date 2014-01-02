function SimpleCache() {
    SimpleCache.$super.call(this);
    this.cacheMap = {};
}

SimpleCache.prototype = {
    doPut: function(key, value) {
        this.cacheMap[key] = value;
    },
    
    doGet: function(key) {
        return this.cacheMap[key];
    },

    clear: function() {
        this.cacheMap = {};
    },

    remove: function(key) {
        delete this.cacheMap[key];
    },

    contains: function(key) {
        return this.cacheMap.hasOwnProperty(key);
    }
};

require('raptor-util').inherit(SimpleCache, require('./BaseCache'));

module.exports = SimpleCache;