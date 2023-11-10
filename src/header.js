import {BIT_RATES, BSID_ANNEX_D, BSID_ANNEX_E, BSID_STANDARD, CHANNELS, SAMPLE_RATES} from './constants';

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

export const readBSI = (stream) => {
    // Syncword
    const syncword = stream.read(16);
    if (syncword != 0x0b77) {
        throw new Error(`Invalid syncword ${syncword.toString(16)}`);
    }

    // Skip Error Detection Code
    stream.advance(16);

    // Bit Stream Information (BSI)
    const bsi = {};

    bsi.fscod = stream.read(2);
    bsi.frmsizecod = stream.read(6);

    // Determine bit rate (in kbps) and frame size (in 16-bit words)
    const bitRate = BIT_RATES[bsi.frmsizecod >> 1];
    switch (bsi.fscod) {
        case 0b00:
            bsi.frmsize = 2 * bitRate;
            break;
        case 0b01:
            bsi.frmsize = ((320 * bitRate) / 147 + (bsi.frmsizecod & 1)) >> 0;
            break;
        case 0b10:
            bsi.frmsize = 3 * bitRate;
            break;
        default:
            throw new Error(`Unknown sample rate code ${bsi.fscod.toString(2)}`);
    }

    // Convert from word size to byte size
    bsi.frmsize *= 2;

    bsi.bsid = stream.read(5);
    bsi.bsmod = stream.read(3);

    if (bsi.bsid !== BSID_STANDARD && bsi.bsid !== BSID_ANNEX_D) {
        if (bsi.bsid === BSID_ANNEX_E) {
            throw new Error('Enhanced AC-3 streams are not supported.');
        }
        throw new Error(`Invalid bsid ${bsi.bsid.toString(2)}`);
    }

    bsi.acmod = stream.read(3);
    bsi.nfchans = CHANNELS[bsi.acmod];
    if ((bsi.acmod & 0x1) !== 0 && bsi.acmod != 0x1) {
        bsi.cmixlev = stream.read(2);
    }
    if ((bsi.acmod & 0x4) !== 0) {
        bsi.surmixlev = stream.read(2);
    }
    if (bsi.acmod == 0x2) {
        bsi.dsurmod = stream.read(2);
    }

    bsi.lfeon = stream.read(1);
    bsi.dialnorm = stream.read(5);
    if (stream.read(1) !== 0) {
        bsi.compr = stream.read(8);
    }
    if (stream.read(1) !== 0) {
        bsi.langcod = stream.read(8);
    }
    if (stream.read(1) !== 0) {
        bsi.mixlevel = stream.read(5);
        bsi.roomtyp = stream.read(2);
    }

    if (bsi.acmod === 0x0) {
        bsi.dialnorm2 = stream.read(5);
        if (stream.read(1) !== 0) {
            bsi.compr2 = stream.read(8);
        }
        if (stream.read(1) !== 0) {
            bsi.langcod2 = stream.read(8);
        }
        if (stream.read(1) !== 0) {
            bsi.mixlevel2 = stream.read(5);
            bsi.roomtyp2 = stream.read(2);
        }
    }

    bsi.copyrightb = stream.read(1);
    bsi.origbs = stream.read(1);
    if (stream.read(1) !== 0) {
        if (bsi.bsid === BSID_ANNEX_D) {
            bsi.dmixmod = stream.read(2);
            bsi.ltrtcmixlev = stream.read(3);
            bsi.ltrtsurmixlev = stream.read(3);
            bsi.lorocmixlev = stream.read(3);
            bsi.lorosurmixlev = stream.read(3);
        } else {
            bsi.timecod1 = stream.read(14);
        }
    }
    if (stream.read(1) !== 0) {
        if (bsi.bsid === BSID_ANNEX_D) {
            bsi.dsurexmod = stream.read(2);
            bsi.dheadphonmod = stream.read(2);
            bsi.adconvtyp = stream.read(1);
            bsi.xbsi2 = stream.read(8);
            bsi.encinfo = stream.read(1);
        } else {
            bsi.timecod2 = stream.read(14);
        }
    }
    if (stream.read(1) !== 0) {
        bsi.addbsil = stream.read(6);
        bsi.addbsi = stream.stream.readSingleBuffer(bsi.addbsil + 1);
    }

    return bsi;
};
