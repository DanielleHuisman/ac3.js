import {Demuxer} from 'av';

import {readHeader} from './header';

export class AC3Demuxer extends Demuxer {
    length = 0;
    hasSentFormat = false;

    static probe(stream) {
        // Attempt to find AC3 syncword
        let offset = 0;
        while (stream.available(offset + 2)) {
            if (stream.peekUInt16(offset) === 0x0b77) {
                stream.advance(offset);
                return true;
            } else {
                offset += 2;
            }
        }
        return false;
    }

    readChunk(buffer) {
        // Append buffer to internal stream
        const size = this.stream.remainingBytes() + buffer.data.length;
        console.log(this.stream.peekUInt16().toString(16), size);
        this.stream.list.append(buffer);

        while (this.stream.available(5)) {
            let header;
            try {
                header = readHeader(this.stream);
            } catch (err) {
                let offset = 0;
                while (this.stream.available(offset + 2)) {
                    if (this.stream.peekUInt16(offset) === 0x0b77) {
                        console.log(this.stream.offset, 'found at ', offset);
                        this.stream.advance(offset);
                        break;
                    } else {
                        offset += 2;
                    }
                }

                // this.emit('error', err);
                continue;
            }

            // Emit format information if necessary
            if (!this.hasSentFormat) {
                this.emit('format', {
                    formatID: 'ac3',
                    sampleRate: header.sampleRate,
                    channelsPerFrame: 2,
                    bitsPerChannel: 16
                });

                this.hasSentFormat = true;
            }

            // Rewind stream to before the header
            this.stream.rewind(5);

            // Check if the full chunk is available
            if (this.stream.available(header.frameSize)) {
                // Read chunk including header
                const chunk = this.stream.readBuffer(header.frameSize);
                this.length += header.frameSize;

                // console.log(this.length);
                this.emit('data', chunk);
            } else {
                break;
            }
        }
    }
};
