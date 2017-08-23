var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var raptorCache = require('../');
var sinon = require('sinon');

var promisesExist = typeof Promise !== 'undefined';

describe('CacheManager' , function() {
    if (promisesExist) {
        it('should return promise if no callback provided to flushAll', function () {
            var cacheManager = raptorCache.createCacheManager();

            cacheManager.getCache('hello');
            cacheManager.getCache('hello1');

            var callCount = 0;

            raptorCache.forEachCache(function (cache) {
                sinon.stub(cache.cacheStore, 'flush').callsFake(function (callback) {
                    callCount++;
                    callback();
                });
            });

            return raptorCache.flushAll()
                .then(function () {
                    expect(callCount).to.equal(2);
                    raptorCache.forEachCache(function (cache) {
                        cache.cacheStore.flush.restore();
                    });
                });
        });
    }
});
