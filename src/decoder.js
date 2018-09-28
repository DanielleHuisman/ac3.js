import {Decoder} from 'av';

import {readHeader} from './header';

export class AC3Decoder extends Decoder {
    packets = 0;

    readChunk() {
        // Skip empty chunks
        if (!this.stream.available(1)) {
            return;
        }

        // Read header
        let header;
        try {
            header = readHeader(this.stream);
        } catch (err) {
            return this.emit('error', err);
        }

        console.log('Chunk | bit rate:', header.bitRate, 'kpbs | frame size:', header.frameSize, 'bytes');

        this.stream.advance(header.frameSize - 5);

        return new Uint8Array();
    }

    setCookie(cookie) {}
};
