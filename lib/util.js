var DelayedReadStream = require('./DelayedReadStream');

exports.createDelayedReadStream = function(streamProvider) {
    return new DelayedReadStream(streamProvider);
};

exports.callbackToPromise = function (func, thisObj, args) {
    return new Promise(function(resolve, reject) {
        args.push(function callback(err, result) {
            if (err) {
                return reject(err);
            }

            resolve(result);
        });
        func.apply(thisObj, args);
    });
};
