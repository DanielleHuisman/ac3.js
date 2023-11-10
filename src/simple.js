import {Buffer, BufferSource, EventEmitter, FileSource, HTTPSource} from 'av';

import {AC3Decoder} from './decoder';
import {AC3Demuxer} from './demuxer';

class InputStreamSource extends EventEmitter {
    constructor(inputStream) {
        super();
        inputStream.on('data', (buffer) => {
            this.emit('data', new Buffer(buffer));
        });
        inputStream.on('end', () => {
            this.emit('end');
        });
    }

    start() {}
    pause() {}
    reset() {}
}

export class AC3SimpleDecoder extends EventEmitter {
    constructor(input) {
        super();

        // Initialize source
        if (input instanceof HTTPSource || input instanceof FileSource || input instanceof BufferSource) {
            this.source = input;
        } else {
            this.source = new InputStreamSource(input);
        }

        // Initialize demuxer
        this.demuxer = new AC3Demuxer(this.source, new Buffer(new Uint8Array()));
        this.demuxer.stream.list.advance();
        this.demuxer.on('format', (format) => {
            this.emit('format', format);
            this.decode(format);
        });
        this.demuxer.on('duration', (duration) => this.emit('duration', duration));
        this.demuxer.on('metadata', (metadata) => this.emit('metadata', metadata));
        this.demuxer.on('error', (error) => this.emit('error', error));
    }

    decode(format) {
        // Initialize decoder
        this.decoder = new AC3Decoder(this.demuxer, format, true);
        this.decoder.on('data', (data) => {
            if (data) {
                this.decoder.decode();
            }
            this.emit('data', data);
        });
        this.decoder.on('error', (data) => this.emit('error', data));
        this.decoder.on('end', (data) => this.emit('end', data));

        // Start decoding process
        this.decoder.decode();
    }
}
