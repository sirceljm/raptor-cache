var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var series = require('raptor-async/series');
var parallel = require('raptor-async/parallel');
var raptorCache = require('../');

describe('raptor-cache' , function() {

    beforeEach(function(done) {
        require('raptor-logging').configureLoggers({
            'raptor-cache': 'DEBUG'
        });

        done();
    });

    it("should invoke callback with null for missing cache entry", function(done) {
        var cache = raptorCache.createMemoryCache();
        parallel([
                function(callback) {
                    cache.get('hello', function(err, value) {
                        if (err) {
                            return callback(err);
                        }

                        expect(value == null).to.equal(true);
                        callback();
                    });
                }
            ],
            done);
    });

    it("should retrieve a key using a builder", function(done) {
        var cache = raptorCache.createMemoryCache();
        parallel([
                function(callback) {
                    cache.get('hello', function(callback) {
                        setTimeout(function() {
                            callback(null, 'world');
                        }, 100);
                    }, function(err, value) {
                        if (err) {
                            return callback(err);
                        }

                        expect(value).to.equal('world');
                        callback();
                    });
                }
            ],
            done);
    });

    it("should delay reads when a value is being built", function(done) {
        var cache = raptorCache.createMemoryCache();
        parallel([
                function(callback) {
                    cache.get('hello', function(callback) {
                        setTimeout(function() {
                            callback(null, 'world');
                        }, 100);
                    }, callback);
                },
                function(callback) {
                    cache.get('hello', function(callback) {
                        setTimeout(function() {
                            callback(null, 'world2');
                        }, 100);
                    }, callback);
                },
                function(callback) {
                    cache.get('hello', function(err, value) {
                        expect(value).to.equal('world');
                        callback();
                    });
                }
            ],
            done);
    });
});

