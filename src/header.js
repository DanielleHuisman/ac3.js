import {BIT_RATES, SAMPLE_RATES} from './constants';

export const readHeader = (stream) => {
    // Validate syncword
    const syncword = stream.readUInt16();
    if (syncword !== 0x0b77) {
        throw new Error(`Invalid syncword ${syncword.toString(16)}`);
    }

    // Validate CRC
    // eslint-disable-next-line no-unused-vars
    const crc = stream.readUInt16();
    // TODO: validate CRC

    // Read sample rate and frame size codes
    const codes = stream.readUInt8();
    const sampleRateCode = (codes & 0xc0) >> 6;
    const frameSizeCode = codes & 0x3f;

    // Determine sample rate (in Hz), bit rate (in kbps) and frame size (in 16-bit words)
    const sampleRate = SAMPLE_RATES[sampleRateCode];
    const bitRate = BIT_RATES[frameSizeCode >> 1];
    let frameSize;
    switch (sampleRateCode) {
        case 0b00:
            frameSize = 2 * bitRate;
            break;
        case 0b01:
            frameSize = ((320 * bitRate) / 147 + (frameSizeCode & 1)) >> 0;
            break;
        case 0b10:
            frameSize = 3 * bitRate;
            break;
        default:
            throw new Error(`Unknown sample rate code ${sampleRateCode.toString(2)}`);
    }

    // Convert from word size to byte size
    frameSize *= 2;

    return {
        crc,
        sampleRateCode,
        frameSizeCode,
        sampleRate,
        bitRate,
        frameSize
    };
};
