var Readable = require('stream').Readable;
var inherit = require('raptor-util/inherit');

function DelayedReadStream(streamDataHolder) {
    DelayedReadStream.$super.call(this, {objectMode: true});

    this._streamDataHolder = streamDataHolder;
    this._delayedIsReading = false;
    this._wrappedStream = null;
}

DelayedReadStream.prototype = {
    setEncoding: function(encoding) {
        if (this._wrappedStream) {
            this._wrappedStream.setEncoding(encoding);
        }
    },

    pause: function() {
        if (this._wrappedStream) {
            return this._wrappedStream.pause();    
        } else {
            var _this = this;
            this._streamDataHolder.done(function() {
                _this.pause();
            });
        }
    },

    resume: function() {
        if (this._wrappedStream) {
            return this._wrappedStream.resume();    
        } else {
            var _this = this;
            this._streamDataHolder.done(function() {
                _this.resume();
            });
        }
    },

    _read: function(size) {

        if (this._delayedIsReading) {
            return;
        }

        this._delayedIsReading = true;

        var _this = this;

        this._streamDataHolder.done(function(err, stream) {
            if (err) {
                _this.emit('error', err);
                _this.emit('end');
                return;
            }

            this._wrappedStream = stream;

            stream
                .on('end', function() {
                    _this.push(null);
                })
                .on('error', function(e) {
                    _this.emit('error', e);
                })
                .on('data', function(data) {
                    _this.push(data);
                });

            // Start the flow of data if it 
            stream.resume();
        });
    }
};

inherit(DelayedReadStream, Readable);

module.exports = DelayedReadStream;