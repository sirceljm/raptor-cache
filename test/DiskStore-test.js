'use strict';

var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var nodePath = require('path');
var fs = require('fs');
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

function buffersEqual(actualValue, expectedValue) {
    if (expectedValue.length !== actualValue.length) {
        return false;
    }

    for (var i = 0; i < expectedValue.length; i++) {
        if (expectedValue[i] !== actualValue[i]) {
            return false;
        }
    }

    return true;
}

function checkValue(store, key, expectedValue) {
    return store.get(key).then((cacheEntry) => {
        if (!cacheEntry) {
            if (expectedValue !== undefined) {
                throw new Error('Expected value for "' + key + '" to exist');
            }
            return;
        }

        if (cacheEntry.deserialize || cacheEntry.deserialized) {
            return cacheEntry.readValue().then((actualValue) => {
                if (typeof expectedValue === 'function') {
                    expectedValue(actualValue);
                } else {
                    expect(actualValue).to.equal(expectedValue);
                }
            });
        } else {
            expect(store.encoding).to.equal(cacheEntry.encoding);

            return cacheEntry.readRaw().then((rawValue) => {
                if (store.encoding) {
                    // if there is an encoding disk store will return decode as string for us
                    expect(rawValue).to.be.a('string');

                    expect(rawValue).to.equal(expectedValue);
                } else {
                    // no encoding so working with raw Buffer objects
                    expect(rawValue).to.be.an.instanceof(Buffer);
                    expect(buffersEqual(rawValue, expectedValue)).to.equal(true);
                }
            });
        }
    });
}

function checkValues(store, expected) {
    let promise = Promise.resolve();

    Object.keys(expected).forEach((key) => {
        const expectedValue = expected[key];
        promise = promise.then(() => {
            return checkValue(store, key, expectedValue);
        });
    });

    return promise;
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
            name: 'single-file',
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
            name: 'multi-file',
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
            'raptor-cache': 'WARN'
        });

        removeCacheDir(dir);

        done();
    });

    stores.forEach(function(storeProvider) {
        it('should allow flushed store to be read back correctly - ' + storeProvider.label, function() {
            var store = storeProvider.create();
            expect(store.encoding).to.equal('utf8');

            store.put('hello', 'world');
            store.put('foo', 'bar');

            return checkValues(store, {
                'foo': 'bar',
                'hello': 'world',
                'missing': undefined
            }).then(() => {
                return store.flush();
            }).then(() => {
                var store = storeProvider.create();
                expect(store.encoding).to.equal('utf8');
                return checkValues(store, {
                    'foo': 'bar',
                    'hello': 'world',
                    'missing': undefined
                });
            });
        });

        it('should handle removals correctly - ' + storeProvider.label, function() {
            var store = storeProvider.create();

            store.put('hello', 'world');
            store.put('foo', 'bar');
            store.put('remove', 'me');
            store.put('remove2', 'me2');
            store.remove('remove');

            return checkValues(store, {
                'hello': 'world',
                'foo': 'bar',
                'remove': undefined,
                'remove2': 'me2'
            }).then(() => {
                return store.flush();
            }).then(() => {
                var store = storeProvider.create();
                store.remove('remove2');

                return checkValues(store, {
                    'hello': 'world',
                    'foo': 'bar',
                    'remove': undefined,
                    'remove2': undefined
                });
            });
        });

        it('should schedule flushes correctly - ' + storeProvider.label, function() {
            var store = storeProvider.create({
                flushDelay: 50
            });

            store.put('schedule', 'flush');
            store.put('foo', 'bar');

            return new Promise((resolve, reject) => {
                setTimeout(function() {
                    var store = storeProvider.create();

                    checkValues(store, {
                        'schedule': 'flush',
                        'foo': 'bar'
                    }).then(resolve).catch(reject);
                }, 500);
            });
        });

        it('should handle writes after flush - ' + storeProvider.label, function() {
            var store = storeProvider.create();
            store.put('hello', 'world');
            store.flush();

            store.put('foo', 'bar');

            return store.flush(function() {
                const store = storeProvider.create();

                return checkValues(store, {
                    'hello': 'world',
                    'foo': 'bar'
                });
            });
        });

        it('should allow reader for cache entry - ' + storeProvider.label, function() {
            var store = storeProvider.create();

            store.put('hello', new CacheEntry({
                reader: function() {
                    return fs.createReadStream(nodePath.join(__dirname, 'large.txt'), 'utf8');
                }
            }));

            store.put('foo', 'bar');

            return store.flush().then(() => {
                var store = storeProvider.create();

                return checkValues(store, {
                    'hello': fs.readFileSync(largeFilePath, 'utf8'),
                    'foo': 'bar'
                });
            });
        });

        it('should allow binary reader for cache entry - ' + storeProvider.label, function() {
            var config = {encoding: null};
            var store = storeProvider.create(config);

            store.put('hello', new CacheEntry({
                reader: function() {
                    return fs.createReadStream(nodePath.join(__dirname, 'large.txt'));
                }
            }));

            store.put('foo', new Buffer('bar', 'utf8'));

            return store.flush().then(() => {
                var store = storeProvider.create(config);

                return checkValues(store, {
                    'hello': fs.readFileSync(largeFilePath),
                    'foo': new Buffer('bar', 'utf8')
                });
            });
        });

        it('should allow a serializer/deserializer to be used - ' + storeProvider.label, function() {
            var config = {
                serialize: function(value) {
                    return JSON.stringify(value);
                },
                deserialize (reader) {
                    return new Promise((resolve, reject) => {
                        try {
                            expect(this.encoding).to.equal('utf8');
                            expect(store.encoding).to.equal('utf8');
                        } catch (err) {
                            return reject(err);
                        }

                        var json = '';
                        var stream = reader();

                        stream
                            .on('data', function(str) {
                                expect(typeof str).to.equal('string');
                                json += str;
                            })

                            .on('end', function() {
                                resolve(JSON.parse(json));
                            });
                    });
                }
            };

            var store = storeProvider.create(config);

            store.put('hello', {hello: 'world'});
            store.put('foo', {foo: 'bar'});

            return store.flush().then(() => {
                var store = storeProvider.create(config);

                return checkValues(store, {
                    'hello': function(actual) {
                        expect(actual.hello).to.equal('world');
                    },
                    'foo': function(actual) {
                        expect(actual.foo).to.equal('bar');
                    }
                });
            });
        });

        it('should handle re-read after flush - ' + storeProvider.label, function() {
            var config = {
                serialize: function(value) {
                    return value;
                },
                deserialize (reader) {
                    return new Promise((resolve, reject) => {
                        var data = '';
                        var stream = reader();

                        stream
                            .on('data', function(str) {
                                data += str;
                            })

                            .on('end', function() {
                                resolve(data);
                            });
                    });
                }
            };

            var store = storeProvider.create(config);
            store.put('foo', 'bar');

            return store.flush().then(() => {
                return store.get('foo').then((value) => {
                    return value.readValue().then((value) => {
                        expect(value).to.equal('bar');
                    });
                });
            });
        });
    });
});
