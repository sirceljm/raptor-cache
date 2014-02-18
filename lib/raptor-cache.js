var defaultProvider = null;

module.exports = {
    getDefaultProvider: function() {
        if (!defaultProvider) {
            var SimpleCacheProvider = require('./SimpleCacheProvider');
            defaultProvider = new SimpleCacheProvider();
        }
        return defaultProvider;
    },

    toString: function () {
        return '[raptor-cache@' + __filename + ']';
    }
};