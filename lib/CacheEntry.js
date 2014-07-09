var through = require('through');
var Readable = require('stream').Readable;

function createReadableFromValue(value, encoding) {
    var objectMode = false;

    if (typeof value !== 'string' && !(value instanceof Buffer)) {
        objectMode = true;
    }

    var readableStream  = new Readable({
        objectMode: objectMode
    });

    if (encoding) {
        readableStream.setEncoding(encoding);
    }

    var read = false;

    readableStream._read = function(size) {
        if (read) {
            return;
        }

        read = true;
        readableStream.push(value);
        readableStream.push(null);
    };
    return readableStream;
}

function CacheEntry(config) {
    if (!config) {
        config = {};
    }

    this.key = config.key;
    this.value = config.value;
    this.valueHolder = config.valueHolder;
    this.reader = config.reader;
    this.meta = {}; // Metadata that should be persisted with the cache entry
    this.data = {}; // A container for extra data that can be attached to 
    this.deserialize = null;
    this.deserialized = true;
    this.encoding = null;
}

CacheEntry.prototype = {
    createReadStream: function() {
        if (this.deserialize) {
            throw new Error('A read stream cannot be created for cache entries with a deserialize');
        }

        var value = this.value;
        if (value != null) {
            return createReadableFromValue(value);
        } else if (this.reader) {
            return this.reader();
        } else {
            throw new Error('Illegal state');
        }
    },

    readValue: function(callback) {

        var value = this.value;

        if (this.deserialize) {
            var _this = this;

            if (value != null) {
                if (this.deserialized) {
                    return callback(null, value);
                } else {
                    var reader = function() {
                        return createReadableFromValue(value, _this.encoding);
                    };

                    this.deserialize(reader, function(err, value) {
                        if (err) {
                            return callback(err);
                        }

                        _this.value = value;
                        _this.deserialized = true;
                        callback(null, value);
                    });
                }
            } else if (this.reader) {
                // We have a reader and we need to deserialize the value on the fly
                this.deserialize(this.reader, callback);
            } else {
                throw new Error('Illegal state');
            }

            return;
        }

        if (value != null) {
            return callback(null, value);
        }

        var result = [];
        var totalLength = 0;

        var inStream = this.createReadStream();
        inStream.pipe(through(
            function data(d) {
                totalLength += d.length;
                result.push(d);
            },
            function end() {
                if (result.length) {
                    if (typeof result[0] === 'string') {
                        callback(null, result.join(''));
                    } else {
                        var valueBuffer = Buffer.concat(result, totalLength);
                        callback(null, valueBuffer);
                    }
                } else {
                    callback();
                }
            }));
    }
};

module.exports = CacheEntry;