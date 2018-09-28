import {Decoder} from 'av';

import {AUDIO_SAMPLES} from './constants';
import {readBSI} from './header';
import {createAudioBlock, readAudioBlock} from './block';
import {IMDCT} from './mdct';

export class AC3Decoder extends Decoder {
    packets = 0;

    readChunk() {
        // Skip empty chunks
        if (!this.stream.available(1)) {
            return;
        }

        // Bit Stream Information (BSI)
        let bsi;
        try {
            bsi = readBSI(this.bitstream);
        } catch (err) {
            return this.emit('error', err);
        }

        // Intialize arrays
        const samples = new Array(bsi.nfchans);
        const imdct = new Array(bsi.nfchans);
        for (let i = 0; i < bsi.nfchans; i++) {
            samples[i] = new Uint16Array(AUDIO_SAMPLES);
            imdct[i] = new IMDCT();
        }

        // Audio Blocks
        const audblk = createAudioBlock(bsi);
        for (let i = 0; i < 6; i++) {
            readAudioBlock(this.bitstream, bsi, samples, imdct, audblk);

            // TODO
        }

        // TODO: read all packet data or skip data

        return;
    }

    setCookie(cookie) {}
};
