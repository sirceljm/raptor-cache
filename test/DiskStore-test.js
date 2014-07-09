var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var nodePath = require('path');
var fs = require('fs');
var series = require('raptor-async/series');
var through = require('through');
var DiskStore = require('../lib/DiskStore');
var CacheEntry = require('../lib/CacheEntry');
var extend = require('raptor-util/extend');

function removeCacheDir(dir) {
    try {
        var children = fs.readdirSync(dir);
        for (var i = 0; i < children.length; i++) {
            var file = nodePath.join(dir, children[i]);
            var stat = fs.statSync(file);
            
            if (stat.isDirectory()) {
                removeCacheDir(file);
            } else {
                fs.unlinkSync(file);
            }
        }

        fs.rmdirSync(dir);
    } catch(e) {}
}

function checkValue(store, key, expectedValue, callback) {
    store.get(key, function(err, cacheEntry) {
        if (err) {
            return callback(err);
        }

        if (!cacheEntry) {
            if (expectedValue == null) {
                // We are good
                callback();
            } else {
                callback(new Error('Expected value for "' + key + '" to exist'));
            }
            return;
        }

        cacheEntry.readValue(function(err, actualValue) {
            if (err) {
                return callback(err);
            }

            if (typeof expectedValue === 'function') {
                expectedValue(actualValue);
                return callback();
            }

            if (typeof expectedValue === 'string' || typeof actualValue === 'string') {
                expect(actualValue).to.equal(expectedValue);    
            } else if (expectedValue instanceof Buffer || actualValue instanceof Buffer) {
                if (expectedValue == null || actualValue == null) {
                    throw new Error('Buffers do not match for key "' + key + '"');
                }

                if (expectedValue.length != actualValue.length) {
                    throw new Error('Buffers do not match for key "' + key + '"');
                }

                for (var i=0; i<expectedValue.length; i++) {
                    if (expectedValue[i] !== actualValue[i]) {
                        throw new Error('Buffers do not match for key "' + key + '"');
                    }
                }

            } else {
                throw new Error('Illegal state.');
            }
            
            callback();
        });
    });
}

function checkValues(store, expected, callback) {

    var tasks = Object.keys(expected).map(function(key) {
        var expectedValue = expected[key];
        return function(callback) {
            checkValue(store, key, expectedValue, callback);
        };
    });

    series(tasks, callback);
}


var largeFilePath = nodePath.join(__dirname, 'large.txt');
if (!fs.existsSync(largeFilePath)) {
    var largeStr = '';
    for (var i=0; i<5000; i++) {
        largeStr += 'abc';
    }

    fs.writeFileSync(largeFilePath, largeStr, 'utf8');
}

var dir = nodePath.join(__dirname, '.cache');

function getConfig(config, overrides) {
    config = extend({}, config || {});
    if (overrides) {
        extend(config, overrides);    
    }
    return config;
}

var stores = [
    {
        label: 'DiskStore - single-file',
        config: {
            dir: dir,
            encoding: 'utf8',
            flushDelay: -1,
            singleFile: true
        },
        create: function(overrides) {
            return new DiskStore(getConfig(this.config, overrides));    
        }
    },
    {
        label: 'DiskStore - multi-file',
        config: {
            dir: dir,
            encoding: 'utf8',
            flushDelay: -1,
            singleFile: false
        },
        create: function(overrides) {
            return new DiskStore(getConfig(this.config, overrides));    
        }
    }
];

describe('raptor-cache/DiskStore' , function() {

    beforeEach(function(done) {
        require('raptor-logging').configureLoggers({
            'raptor-cache': 'DEBUG'
        });

        removeCacheDir(dir);

        done();
    });

    stores.forEach(function(storeProvider) {
        it("should allow flushed store to be read back correctly - " + storeProvider.label, function(done) {
            var store = storeProvider.create();

            store.put('hello', 'world');
            store.put('foo', 'bar');

            series([
                    function (callback) {
                        checkValues(store, {
                            'foo': 'bar',
                            'hello': 'world',
                            'missing': null
                        }, callback);
                    },
                    function (callback) {
                        store.flush(function(err) {
                            if (err) {
                                return callback(err);
                            }

                            var store = storeProvider.create();
                            checkValues(store, {
                                'foo': 'bar',
                                'hello': 'world',
                                'missing': null
                            }, callback);
                        });
                    }
                ],
                function (err) {
                    if (err) {
                        return done(err);
                    }
                    done();
                });
        });

        it("should handle removals correctly - " + storeProvider.label, function(done) {
            var store = storeProvider.create();

            store.put('hello', 'world');
            store.put('foo', 'bar');
            store.put('remove', 'me');
            store.put('remove2', 'me2');
            store.remove('remove');

            series([
                    function (callback) {
                        checkValues(store, {
                            'hello': 'world',
                            'foo': 'bar',
                            'remove': null,
                            'remove2': 'me2'
                        }, callback);
                    },
                    function (callback) {
                        store.flush(function(err) {
                            if (err) {
                                return callback(err);
                            }

                            var store = storeProvider.create();
                            store.remove('remove2');

                            checkValues(store, {
                                'hello': 'world',
                                'foo': 'bar',
                                'remove': null,
                                'remove2': null
                            }, callback);
                        });
                    }
                ],
                function (err) {
                    if (err) {
                        return done(err);
                    }
                    done();
                });
        });

        it("should schedule flushes correctly - " + storeProvider.label, function(done) {
            
            var store = storeProvider.create({
                flushDelay: 100
            });

            store.put('schedule', 'flush');
            store.put('foo', 'bar');
            
            setTimeout(function() {
                var store = storeProvider.create();

                checkValues(store, {
                    'schedule': 'flush',
                    'foo': 'bar'
                }, done);
            }, 200);
        });

        it("should handle writes after flush - " + storeProvider.label, function(done) {
            var store = storeProvider.create();
            store.put('hello', 'world');
            store.flush();

            store.put('foo', 'bar');

            store.flush(function() {
                var store = storeProvider.create();

                checkValues(store, {
                    'hello': 'world',
                    'foo': 'bar'
                }, done);
            });
        });

        it("should allow reader for cache entry - " + storeProvider.label, function(done) {
            var store = storeProvider.create();

            store.put('hello', new CacheEntry({
                reader: function() {
                    return fs.createReadStream(nodePath.join(__dirname, 'large.txt'), 'utf8');
                }    
            }));

            store.put('foo', 'bar');

            store.flush(function(err) {
                if (err) {
                    return done(err);
                }

                var store = storeProvider.create();

                checkValues(store, {
                    'hello': fs.readFileSync(largeFilePath, 'utf8'),
                    'foo': 'bar'
                }, done);
            });
        });

        it("should allow binary reader for cache entry - " + storeProvider.label, function(done) {
            var config = {encoding: null};
            var store = storeProvider.create(config);

            store.put('hello', new CacheEntry({
                reader: function() {
                    return fs.createReadStream(nodePath.join(__dirname, 'large.txt'));
                }    
            }));

            store.put('foo', new Buffer('bar', 'utf8'));

            store.flush(function(err) {
                if (err) {
                    return done(err);
                }

                var store = storeProvider.create(config);

                checkValues(store, {
                    'hello': fs.readFileSync(largeFilePath),
                    'foo': new Buffer('bar', 'utf8')
                }, done);
            });
        });

        it("should allow a serializer/deserializer to be used - " + storeProvider.label, function(done) {
            var config = {
                serialize: function(value) {
                    return JSON.stringify(value);
                },
                deserialize: function(reader, callback) {
                    var readable = reader();
                    var json = '';

                    readable.pipe(through(
                        function data(str) {
                            expect(typeof str).to.equal('string');
                            json += str;
                        },
                        function end() {
                            callback(null, JSON.parse(json));
                        }));
                }
            };

            var store = storeProvider.create(config);

            store.put('hello', {hello: 'world'});
            store.put('foo', {foo: 'bar'});

            store.flush(function(err) {
                if (err) {
                    return done(err);
                }

                var store = storeProvider.create(config);

                checkValues(store, {
                    'hello': function(actual) {
                        expect(actual.hello).to.equal('world');
                    },
                    'foo': function(actual) {
                        expect(actual.foo).to.equal('bar');
                    }
                }, done);
            });
        });
    });
});

