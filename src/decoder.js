import {Decoder} from 'av';

import {readHeader} from './header';

export class AC3Decoder extends Decoder {
    packets = 0;

    readChunk() {
        // Skip empty chunks
        if (!this.stream.available(1)) {
            // console.log('nop');
            return;
        }

        // Read header
        let header;
        try {
            header = readHeader(this.stream);
        } catch (err) {
            let offset = 0;
            while (this.stream.available(offset + 2)) {
                if (this.stream.peekUInt16(offset) === 0x0b77) {
                    console.log('qer', this.stream.offset, 'found at ', offset);
                    this.stream.advance(offset);
                    break;
                } else {
                    offset += 2;
                }
            }

            return new Uint8Array();
            // return this.emit('error', err);
        }


        this.packets++;
        console.log(this.packets);

        // console.log('Chunk | bit rate:', header.bitRate, 'kpbs | frame size:', header.frameSize, 'bytes');

        this.stream.advance(header.frameSize - 5);

        return new Uint8Array();
    }

    setCookie(cookie) {}
};
