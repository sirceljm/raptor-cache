var fs = require('fs');
var Readable = require('stream').Readable;

exports.createDelayedFileReadStream = function(path, encoding, readyDataHolder) {
    var fileReadStream = null;
    var readableStream  = new Readable();

    if (encoding) {
        readableStream.setEncoding(encoding);
    }
    
    var reading = false;

    readableStream.pause = function() {
        if (fileReadStream) {
            return fileReadStream.pause();    
        }
        
    };

    readableStream.resume = function() {
        if (fileReadStream) {
            return fileReadStream.resume();    
        }
    };

    readableStream._read = function(size) {
        if (reading) {
            return;
        }

        reading = true;

        readyDataHolder.done(function(err) {
            if (err) {
                readableStream.emit('error', err);
                readableStream.emit('end');
                return;
            }

            fileReadStream = fs.createReadStream(path, {encoding: encoding});

            var oldEmit = fileReadStream.emit;

            fileReadStream.emit = function(type, arg) {
                if (type !== 'data') {
                    readableStream.emit.apply(readableStream, arguments);    
                }
                
                oldEmit.apply(fileReadStream, arguments);
            };

            fileReadStream.on('data', function(chunk) {
                readableStream.push(chunk);
            });

            // Start the flow of data
            fileReadStream.resume();
        });
    };

    return readableStream;
};