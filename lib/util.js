var DelayedReadStream = require('./DelayedReadStream');

exports.createDelayedReadStream = function(options, streamProvider) {
    return new DelayedReadStream(options, streamProvider);
};