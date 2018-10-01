import {Decoder} from 'av';

import {AUDIO_SAMPLES} from './constants';
import {readBSI} from './header';
import {createAudioBlock, readAudioBlock} from './audioblock';
import {IMDCT} from './mdct';
import {downmix} from './downmix';

export class AC3Decoder extends Decoder {
    packets = 0;
    pcm = false;
    samples = null;
    imdct = null;

    constructor(demuxer, format, pcm = false) {
        super(demuxer, format);
        this.pcm = pcm;
    }

    readChunk() {
        // Skip empty chunks
        if (!this.stream.available(1)) {
            return;
        }

        const start = this.stream.offset;

        // Bit Stream Information (BSI)
        let bsi;
        try {
            bsi = readBSI(this.bitstream);
        } catch (err) {
            return this.emit('error', err);
        }

        // Intialize arrays
        // IMDCT instances must be preserved across chunks for proper decoding.
        // Otherwise, overlapping samples will be lost.
        if (!this.samples) {
            this.samples = new Array(bsi.nfchans);
            for (let i = 0; i < bsi.nfchans; i++) {
                this.samples[i] = new Array(AUDIO_SAMPLES);
            }
        }
        if (!this.imdct) {
            this.imdct = new Array(bsi.nfchans);
            for (let i = 0; i < bsi.nfchans; i++) {
                this.imdct[i] = new IMDCT();
            }
        }

        // Audio Blocks
        const audblk = createAudioBlock(bsi);
        for (let blk = 0; blk < 6; blk++) {
            readAudioBlock(this.bitstream, bsi, this.samples, this.imdct, audblk, blk);
        }

        // Downmixing
        downmix(bsi, this.samples);

        // Skip auxiliary data
        this.bitstream.align();
        this.stream.advance(bsi.frmsize - (this.stream.offset - start));

        const CHANNELS = 2;
        if (this.pcm) {
            const sampleBytes = new Uint8Array(AUDIO_SAMPLES * CHANNELS * 2);
            let sample;
            for (let i = 0; i < AUDIO_SAMPLES; i++) {
                sample = this.samples[0][i] * 65535;
                sampleBytes[i * 4] = sample & 0xff;
                sampleBytes[i * 4 + 1] = sample >> 8;

                sample = this.samples[1][i] * 65535;
                sampleBytes[i * 4 + 2] = sample & 0xff;
                sampleBytes[i * 4 + 3] = sample >> 8;
            }

            this.emit('pcm', sampleBytes);
            return sampleBytes;
        } else {
            const result = new Int16Array(AUDIO_SAMPLES * CHANNELS);
            let sample;
            for (let i = 0; i < AUDIO_SAMPLES; i++) {
                for (let ch = 0; ch < CHANNELS; ch++) {
                    sample = this.samples[ch][i] * 65535;
                    result[ch + i * 2] = sample;
                }
            }
            return result;
        }
    }

    setCookie(cookie) {}
};
