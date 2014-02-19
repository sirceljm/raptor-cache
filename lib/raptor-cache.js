var configLoader = require('./cache-config-loader');

var defaultProvider = null;

var defaultConfig = {
    DEFAULT: {
        memory: {
            enabled: true,
            maxEntries: -1
        },
        disk: {
            enabled: false
        }
    }
};

module.exports = exports = {
    defaultConfig: defaultConfig,

    getDefaultProvider: function() {
        if (!defaultProvider) {
            defaultProvider = exports.configureDefault(exports.defaultConfig, 'DEFAULT');
        }
        return defaultProvider;
    },

    configureDefault: function(config, path) {
        defaultProvider = exports.configure(config);
        return defaultProvider;
    },

    configure: function(config, path) {
        return configLoader.load(config, path);
    },

    toString: function () {
        return '[raptor-cache@' + __filename + ']';
    }
};