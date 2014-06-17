var nodePath = require('path');
var thenFS = require('then-fs');
var logger = require('raptor-logging').logger(module);
var raptorPromises = require('raptor-promises');
var raptorFiles = require('raptor-files');

var WRITE_DELAY = 1000;

function safeFilename(filename) {
    return filename.replace(/[^A-Za-z0-9_\-\.]/g, '-');
}

function SingleFileDiskCache(config, settingsName, cacheName) {
    var dir = nodePath.resolve(process.cwd(), config.dir) || nodePath.resolve(process.cwd(), '.cache');

    var sub = [safeFilename(settingsName)];
    if (cacheName) {
        sub.push(safeFilename(cacheName));
    }

    sub.push('cache.json');

    this._file = nodePath.join(dir, sub.join('/'));

    raptorFiles.mkdirs(this._file);
    this._writeEnabled = config.write !== false;
    this._finishedReading = false;
    this._readPromise = null;
    this._cacheMap = {};
    this._writePromise = raptorPromises.resolved();
    this._writeTimeoutId = null;
}

SingleFileDiskCache.prototype = {
    _readThen: function(methodName, args) {
        var _this = this;

        if (!this._readPromise) {
            this._readPromise = thenFS.readFile(this._file, {encoding: 'utf8'})
                .then(
                    function fulfilled(data) {
                        _this._finishedReading = true;
                        try {
                            _this._cacheMap = JSON.parse(data);
                        }
                        catch(e) {}
                    },
                    function rejected() {
                        _this._finishedReading = true;
                    });
        }

        return this._readPromise.then(function() {
            return _this[methodName].apply(_this, args);
        });
    },

    _write: function() {
        var _this = this;

        function doWrite() {
            logger.info('Persisting cache to file "' + _this._file + '"...');

            var writePromise = thenFS.writeFile(
                _this._file,
                JSON.stringify(_this._cacheMap),
                {encoding: 'utf8'});

            writePromise.then(
                function fulfilled() {
                    logger.info('Cache written to disk: ' + _this._file);
                },
                function rejected(err) {
                    logger.error('Error while persisting cache to file "' + _this._file + '". Exception: ' + err, err);
                });

            return writePromise;
        }

        // It's possible the previous write did not complete so queue it up
        this._writePromise = this._writePromise
            .then(
                doWrite,
                function rejected(e) {
                    
                    return doWrite();
                });
    },

    _scheduleWrite: function() {
        if (!this._writeEnabled) {
            return;
        }

        if (this._writeTimeoutId == null) {
            var _this = this;

            this._writeTimeoutId = setTimeout(function() {
                _this._writeTimeoutId = null;
                _this._write();
            }, WRITE_DELAY);
        }
    },

    put: function(key, value) {
        if (this._finishedReading) {
            if (logger.isDebugEnabled()) {
                logger.debug('Added new value for key "' + key + '" to file "' + this._file + '"...');
            }

            this._cacheMap[key] = value;
            this._scheduleWrite();
        } else {
            this._readThen('put', arguments);
        }
    },
    
    get: function(key) {
        if (this._finishedReading) {
            if (logger.isDebugEnabled()) {
                logger.debug('Get "' + key + '" from file "' + this._file + '"...');
            }
            
            return this._cacheMap[key];
        } else {
            return this._readThen('get', arguments);
        }
    },

    clear: function() {
        if (this._finishedReading) {
            this._cacheMap = {};
            this._scheduleWrite();
        } else {
            this._readThen('clear', arguments);
        }
    },

    remove: function(key) {
        if (this._finishedReading) {
            delete this._cacheMap[key];
            this._scheduleWrite();
        } else {
            this._readThen('remove', arguments);
        }
    }
};

module.exports = SingleFileDiskCache;