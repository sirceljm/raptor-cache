var nodePath = require('path');
var raptorPromises = require('raptor-promises');
var raptorFiles = require('raptor-files');
var fs = require('fs');
var crypto = require('crypto');

function safeFilename(filename) {
    return filename.replace(/[^A-Za-z0-9_\-\.]/g, '-');
}

function DiskCache(config, settingsName, cacheName) {
    var dir = config.dir ? nodePath.resolve(process.cwd(), config.dir) : nodePath.resolve(process.cwd(), '.cache');

    this.dir = nodePath.join(dir, cacheName ? safeFilename(settingsName) + '/' + safeFilename(cacheName) : safeFilename(settingsName));
    
    this._writeEnabled = config.write !== false;
    this._readEnabled = config.read !== false;

    this._finishedReading = false;
    this._readPromise = null;
    this._cacheMap = {};
    this._readPromises = {};
    this._writePromises = {};
    this._writeTimeoutId = null;
}

DiskCache.prototype = {

    put: function(key, value) {
        if (!this._writeEnabled) {
            return;
        }

        var _this = this;

        var readPromise = this._readPromises[key];
        if (readPromise) {
            return readPromise.then(function() {
                return _this.put(key, value);
            });
        }

        var writePromise = this._writePromises[key];
        if (writePromise) {
            
            writePromise = this._writePromises[key] = writePromise.then(function() {
                return _this.put(key, value);
            });
        } else {
            var _file = this._keyFile(key);
            raptorFiles.mkdirs(_file);
            var deferred = raptorPromises.defer();
            fs.writeFile(_file, JSON.stringify(value, null, 2), {encoding: 'utf8'}, function(err) {
                if (err) {
                    deferred.resolve(undefined);
                    return;
                }
                deferred.resolve();
            });
            writePromise = this._writePromises[key] = deferred.promise;

            writePromise.then(function() {
                delete _this._writePromises[key];
            });
        }

    },

    _keyFile: function(key) {
        var shasum = crypto.createHash('sha1');
        shasum.update(key.toString());
        var checksum = shasum.digest('hex');
        var file = nodePath.join(this.dir, checksum.charAt(0), checksum + '.json');
        return file;
    },
    
    get: function(key) {
        if (!this._readEnabled) {
            return undefined;
        }

        var _this = this;

        var writePromise = this._writePromises[key];
        if (writePromise) {
            return writePromise.then(function() {
                return _this.get(key);
            });
        }

        var readPromise = this._readPromises[key];
        if (!readPromise) {
            var _file = this._keyFile(key);
            var deferred = raptorPromises.defer();
            fs.readFile(_file, {encoding: 'utf8'}, function(err, data) {
                if (err) {
                    deferred.resolve(undefined);
                    return;
                }
                deferred.resolve(JSON.parse(data));
            });
            readPromise = this._readPromises[key] = deferred.promise;

            readPromise.then(function() {
                delete _this._readPromises[key];
            });
        }

        return readPromise;
    },

    clear: function() {
        // TODO
    },

    remove: function(key) {
        // TODO
    }
};

module.exports = DiskCache;