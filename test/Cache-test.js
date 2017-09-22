'use strict';

var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var raptorCache = require('../');
var fs = require('fs');
var nodePath = require('path');
var crypto = require('crypto');
var cacheDir = nodePath.join(__dirname, '.cache');

function removeCacheDir (dir) {
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
    } catch (e) {}
}

describe('raptor-cache', function () {
    it('should invoke callback with null for missing cache entry', () => {
        const cache = raptorCache.createMemoryCache();
        return cache.get('hello').then((value) => {
            expect(value == null).to.equal(true);
        });
    });

    it('should retrieve a key using a builder', () => {
        const cache = raptorCache.createMemoryCache();
        return cache.get('hello', {
            builder () {
                return new Promise((resolve) => {
                    resolve('world');
                });
            }
        }).then((value) => {
            expect(value).to.equal('world');
        });
    });

    it('should delay reads when a value is being built', () => {
        var cache = raptorCache.createMemoryCache();
        return Promise.all([
            cache.get('hello', {
                test: 1,
                builder: function () {
                    return new Promise((resolve) => {
                        setTimeout(function () {
                            resolve('world');
                        }, 100);
                    });
                }
            }),
            cache.get('hello', {
                test: 2,
                builder: function () {
                    return new Promise((resolve) => {
                        setTimeout(function () {
                            resolve('world2');
                        }, 100);
                    });
                }
            }),
            new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 50);
            }).then(() => {
                cache.get('hello', { test: 3 }).then((value) => {
                    expect(value).to.equal('world');
                });
            })
        ]);
    });

    it('should support createReadStream() with a multi-file disk cache', () => {
        removeCacheDir(cacheDir);

        function createCache () {
            return raptorCache.createDiskCache({ singleFile: false, dir: cacheDir });
        }

        var reader = function () {
            return fs.createReadStream(nodePath.join(__dirname, 'hello.txt'));
        };

        var signature = null;
        var cache;

        return new Promise((resolve, reject) => {
            var shasum = crypto.createHash('sha1');
            var stream = reader();

            stream
                .on('data', function (data) {
                    shasum.update(data);
                })
                .on('end', function () {
                    signature = shasum.digest('hex');
                    resolve();
                })
                .on('error', function (e) {
                    reject(e);
                });
        }).then(() => {
            cache = createCache();
            cache.put('hello', reader);
            return cache.flush();
        }).then(() => {
            return new Promise((resolve, reject) => {
                cache = createCache();
                var shasum = crypto.createHash('sha1');
                var stream = cache.createReadStream('hello');

                stream
                    .on('data', function (data) {
                        shasum.update(data);
                    })
                    .on('end', function () {
                        expect(shasum.digest('hex')).to.equal(signature);
                        resolve();
                    })
                    .on('error', function (e) {
                        reject(e);
                    });
            });
        }).then(() => {
            return new Promise((resolve, reject) => {
                var shasum = crypto.createHash('sha1');
                var stream = cache.createReadStream('hello');

                stream
                    .on('data', function (data) {
                        shasum.update(data);
                    })
                    .on('end', function () {
                        expect(shasum.digest('hex')).to.equal(signature);
                        resolve();
                    })
                    .on('error', function (e) {
                        reject(e);
                    });
            });
        });
    });
});
