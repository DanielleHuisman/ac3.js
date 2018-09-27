import through2 from 'through2';

import { BSID_STANDARD, BSID_ANNEX_D, BSID_ANNEX_E, EXP_REUSE, EXP_D15, EXP_D25, EXP_D45 } from './constants';
import { unpackExponents } from './exponents';
import { FAST_GAIN, FAST_DECAY, SLOW_DECAY, SLOW_GAIN, DB_PER_BIT, FLOOR, REMATRIX_BANDS, CLEV, SLEV } from './tables';
import { bitAllocation } from './bitallocation';
import { MantissaReader, getDitherMantissa } from './mantissa';
import { IMDCT } from './mdct';

const CHANNELS = [2, 1, 2, 3, 3, 4, 4, 5];
const GROUP_SIZE = [0, 1, 2, 4];

export const AC3FrameDecoder = function() {
    this.imdct = new Array(6);
    this.samples = new Array(6);
    
    for (let i = 0; i < this.imdct.length; i++) {
        this.imdct[i] = new IMDCT();
        this.samples[i] = new Array(1536);
    }
};

AC3FrameDecoder.prototype.decodeFrame = function(frame) {
    // Syncword
    const syncword = frame.getUint16();
    if (syncword != 0x0b77) {
        throw new Error(`Invalid syncword ${syncword.toString(16)}`);
    }

    // Error Detection Code
    const crc1 = frame.getUint16();
    const crc2 = frame.slice(frame.byteLength - 2).getUint16();
    // TODO: validate CRCs

    // Bit Stream Information (BSI)
    const bsi = {};

    bsi.fscod = frame.getUnsigned(2);
    bsi.frmsizecod = frame.getUnsigned(6);
    bsi.bsid = frame.getUnsigned(5);
    bsi.bsmod = frame.getUnsigned(3);

    if (bsi.bsid !== BSID_STANDARD && bsi.bsid !== BSID_ANNEX_D) {
        if (bsi.bsid === BSID_ANNEX_E) {
            throw new Error('Enhanced AC-3 streams are not supported.');
        }
        throw new Error(`Invalid bsid ${bsi.bsid.toString(2)}`);
    }

    bsi.acmod = frame.getUnsigned(3);
    bsi.nfchans = CHANNELS[bsi.acmod];
    if ((bsi.acmod & 0x1) !== 0 && bsi.acmod != 0x1) {
        bsi.cmixlev = frame.getUnsigned(2);
    }
    if ((bsi.acmod & 0x4) !== 0) {
        bsi.surmixlev = frame.getUnsigned(2);
    }
    if (bsi.acmod == 0x2) {
        bsi.dsurmod = frame.getUnsigned(2);
    }

    bsi.lfeon = frame.getUnsigned(1);
    bsi.dialnorm = frame.getUnsigned(5);
    if (frame.getUnsigned(1) !== 0) {
        bsi.compr = frame.getUint8();
    }
    if (frame.getUnsigned(1) !== 0) {
        bsi.langcod = frame.getUint8();
    }
    if (frame.getUnsigned(1) !== 0) {
        bsi.mixlevel = frame.getUnsigned(5);
        bsi.roomtyp = frame.getUnsigned(2);
    }

    if (bsi.acmod === 0x0) {
        bsi.dialnorm2 = frame.getUnsigned(5);
        if (frame.getUnsigned(1) !== 0) {
            bsi.compr2 = frame.getUint8();
        }
        if (frame.getUnsigned(1) !== 0) {
            bsi.langcod2 = frame.getUint8();
        }
        if (frame.getUnsigned(1) !== 0) {
            bsi.mixlevel2 = frame.getUnsigned(5);
            bsi.roomtyp2 = frame.getUnsigned(2);
        }
    }

    bsi.copyrightb = frame.getUnsigned(1);
    bsi.origbs = frame.getUnsigned(1);
    if (frame.getUnsigned(1) !== 0) {
        if (bsi.bsid === BSID_ANNEX_D) {
            bsi.dmixmod = frame.getUnsigned(2);
            bsi.ltrtcmixlev = frame.getUnsigned(3);
            bsi.ltrtsurmixlev = frame.getUnsigned(3);
            bsi.lorocmixlev = frame.getUnsigned(3);
            bsi.lorosurmixlev = frame.getUnsigned(3);
        } else {
            bsi.timecod1 = frame.getUnsigned(14);
        }
    }
    if (frame.getUnsigned(1) !== 0) {
        if (bsi.bsid === BSID_ANNEX_D) {
            bsi.dsurexmod = frame.getUnsigned(2);
            bsi.dheadphonmod = frame.getUnsigned(2);
            bsi.adconvtyp = frame.getUnsigned(1);
            bsi.xbsi2 = frame.getUnint8();
            bsi.encinfo = frame.getUnsigned(1);
        } else {
            bsi.timecod2 = frame.getUnsigned(14);
        }
    }
    if(frame.getUnsigned(1) !== 0) {
        bsi.addbsil = frame.getUnsigned(6);
        bsi.addbsi = frame.getBytes(bsi.addbsil + 1);
    }

    //console.log(bsi);

    const params = {
        slowDecay: 0,
        fastDecay: 0,
        slowGain: 0,
        dbPerBit: 0,
        floor: 0
    };

    // Audio Blocks
    let audblk = {};
    audblk.blksw = new Array(bsi.nfchans);
    audblk.dithflag = new Array(bsi.nfchans);
    audblk.chincpl = new Array(bsi.nfchans);
    audblk.mstrcplco = new Array(bsi.nfchans);
    audblk.cplcoe = new Array(bsi.nfchans);
    audblk.cplcoexp = new Array(bsi.nfchans);
    audblk.cplcomant = new Array(bsi.nfchans);
    audblk.cplco = new Array(bsi.nfchans);
    audblk.chexpstr = new Array(bsi.nfchans);
    audblk.chbwcod = new Array(bsi.nfchans);
    audblk.strtmant = new Array(bsi.nfchans);
    audblk.endmant = new Array(bsi.nfchans);
    audblk.nchgrps = new Array(bsi.nfchans);
    audblk.exps = new Array(bsi.nfchans);
    audblk.gainrng = new Array(bsi.nfchans);
    audblk.deltbae = new Array(bsi.nfchans);
    audblk.rematflg = [];

    for (let blk = 0; blk < 6; blk++) {
        let mantissas = new MantissaReader(frame);

        // Block switch and dither flags
        for (let ch = 0; ch < bsi.nfchans; ch++) {
            audblk.blksw[ch] = frame.getUnsigned(1);
        }
        for (let ch = 0; ch < bsi.nfchans; ch++) {
            audblk.dithflag[ch] = frame.getUnsigned(1);
        }

        // Dynamic range control
        if (frame.getUnsigned(1) !== 0) {
            audblk.dynrng = frame.getUint8();
        }
        if (bsi.acmod === 0x0) {
            if (frame.getUnsigned(1) !== 0) {
                audblk.dynrng2 = frame.getUint8();
            }
        }

        // Coupling strategy information
        if (frame.getUnsigned(1) !== 0) {
            audblk.cplinu = frame.getUnsigned(1);
            if (audblk.cplinu) {
                for (let ch = 0; ch < bsi.nfchans; ch++) {
                    audblk.chincpl[ch] = frame.getUnsigned(1);
                }

                if (bsi.acmod === 0x2) {
                    audblk.phsflginu = frame.getUnsigned(1);
                }

                audblk.cplbegf = frame.getUnsigned(4);
                audblk.cplendf = frame.getUnsigned(4);

                audblk.ncplsubnd = 3 + audblk.cplendf - audblk.cplbegf;
                audblk.ncplbnd = audblk.ncplsubnd;
                audblk.cplbndstrc = new Array(audblk.ncplsubnd);
                audblk.cplbndstrc[0] = 0;
                for (let bnd = 1; bnd < audblk.ncplsubnd; bnd++) {
                    audblk.cplbndstrc[bnd] = frame.getUnsigned(1);
                    audblk.ncplbnd -= audblk.cplbndstrc[bnd];
                }
            }
        }

        // Coupling coordinates and phase flags
        if (audblk.cplinu) {
            for (let ch = 0; ch < bsi.nfchans; ch++) {
                if (audblk.chincpl[ch]) {
                    audblk.cplcoe[ch] = frame.getUnsigned(1);
                    if (audblk.cplcoe[ch]) {
                        audblk.mstrcplco[ch] = frame.getUnsigned(2);

                        audblk.cplcoexp[ch] = new Array(audblk.ncplbnd);
                        audblk.cplcomant[ch] = new Array(audblk.ncplbnd);
                        audblk.cplco[ch] = new Array(audblk.ncplbnd);
                        for (let bnd = 0; bnd < audblk.ncplbnd; bnd++) {
                            audblk.cplcoexp[ch][bnd] = frame.getUnsigned(4);
                            audblk.cplcomant[ch][bnd] = frame.getUnsigned(4);
                        }
                    }

                    let cplco;
                    let bnd = 0;
                    for (let sbnd = 0; sbnd < audblk.ncplsubnd; sbnd++) {
                        if (!audblk.cplbndstrc[sbnd]) {
                            if (audblk.cplcoexp[ch][bnd] === 15) {
                                cplco = audblk.cplcomant[ch][bnd] / 16;
                            } else {
                                cplco = (audblk.cplcomant[ch][bnd] + 16) / 32;
                            }
                            cplco /= Math.pow(2, audblk.cplcoexp[ch][bnd] + 3 * audblk.mstrcplco[ch]);
                        }
                        audblk.cplco[ch][sbnd] = cplco;
                    }
                }
            }

            if (bsi.acmod === 0x2 && audblk.phsflginu && (audblk.cplcoe[0] || audblk.cplcoe[1])) {
                audblk.phsflg = new Array(audblk.ncplbnd);
                for (let bnd = 0; bnd < audblk.ncplbnd; bnd++) {
                    audblk.phsflg[bnd] = frame.getUnsigned(1);
                }
            }
        }

        // Rematrixing operation in the 2/0 mode
        if (bsi.acmod === 0x2) {
            audblk.rematstr = frame.getUnsigned(1);
            if (audblk.rematstr) {
                let bands = 0;
                if (audblk.cplbegf > 2 || audblk.cplinu === 0) {
                    bands = 4;
                } else if (audblk.cplbegf > 0 && audblk.cplbegf <= 2 && audblk.cplinu) {
                    bands = 3;
                } else if (audblk.cplbegf === 0 && audblk.cplinu) {
                    bands = 2;
                }

                audblk.rematflg = new Array(bands);
                for (let rbnd = 0; rbnd < bands; rbnd++) {
                    audblk.rematflg[rbnd] = frame.getUnsigned(1);
                }
            }
        }

        // Exponent strategy
        if (audblk.cplinu) {
            audblk.cplexpstr = frame.getUnsigned(2);
        }

        for (let ch = 0; ch < bsi.nfchans; ch++) {
            audblk.chexpstr[ch] = frame.getUnsigned(2);
        }

        if (bsi.lfeon) {
            audblk.lfeexpstr = frame.getUnsigned(1);
        }

        for (let ch = 0; ch < bsi.nfchans; ch++) {
            if (audblk.chexpstr[ch] !== EXP_REUSE) {
                if (!audblk.chincpl[ch]) {
                    audblk.chbwcod[ch] = frame.getUnsigned(6);
                }
            }
        }

        // Exponents for the coupling channel
        if (audblk.cplinu) {
            audblk.cplstrtmant = (audblk.cplbegf * 12) + 37;
            audblk.cplendmant = ((audblk.cplendf + 3) * 12) + 37;

            if (audblk.cplexpstr !== EXP_REUSE) {
                switch (audblk.cplexpstr) {
                    case EXP_D15:
                        audblk.ncplgrps = ((audblk.cplendmant - audblk.cplstrtmant) / 3) >> 0;
                        break;
                    case EXP_D25:
                        audblk.ncplgrps = ((audblk.cplendmant - audblk.cplstrtmant) / 6) >> 0;
                        break;
                    case EXP_D45:
                        audblk.ncplgrps = ((audblk.cplendmant - audblk.cplstrtmant) / 12) >> 0;
                        break;
                }

                const cplabsexp = frame.getUnsigned(4);
                audblk.cplexps = new Array(audblk.ncplgrps);
                for (let grp = 0; grp < audblk.ncplgrps; grp++) {
                    audblk.cplexps[grp] = frame.getUnsigned(7);
                }

                // Unpack exponent groups
                audblk.cplexps = unpackExponents(audblk.cplexps, cplabsexp << 1, GROUP_SIZE[audblk.cplexpstr], 0);
            }
        }

        // Exponents for full bandwidth channels
        for (let ch = 0; ch < bsi.nfchans; ch++) {
            if (audblk.chexpstr[ch] !== EXP_REUSE) {
                audblk.strtmant[ch] = 0;
                if (audblk.chincpl[ch]) {
                    audblk.endmant[ch] = 37 + (12 * audblk.cplbegf);
                } else {
                    audblk.endmant[ch] = 37 + (3 * (audblk.chbwcod[ch] + 12));
                }

                switch (audblk.chexpstr[ch]) {
                    case EXP_D15:
                        audblk.nchgrps[ch] = ((audblk.endmant[ch] - 1) / 3) >> 0;
                        break;
                    case EXP_D25:
                        audblk.nchgrps[ch] = ((audblk.endmant[ch] + 2) / 6) >> 0;
                        break;
                    case EXP_D45:
                        audblk.nchgrps[ch] = ((audblk.endmant[ch] + 8) / 12) >> 0;
                        break;
                }

                audblk.exps[ch] = new Array(audblk.nchgrps[ch]);
                const absexps = frame.getUnsigned(4);
                for (let grp = 0; grp < audblk.nchgrps[ch]; grp++) {
                    audblk.exps[ch][grp] = frame.getUnsigned(7);
                }

                // Unpack exponent groups
                audblk.exps[ch] = unpackExponents(audblk.exps[ch], absexps, GROUP_SIZE[audblk.chexpstr[ch]], 1);

                audblk.gainrng[ch] = frame.getUnsigned(2);
            }
        }

        // Exponents for the low frequency effects channel
        if (bsi.lfeon) {
            if (audblk.lfeexpstr !== EXP_REUSE) {
                audblk.lfestartmant = 0;
                audblk.lfeendmant = 7;

                audblk.nlfegrps = 2;
                audblk.lfeexps = new Array(audblk.nlfegrps);

                const lfeabsexp = frame.getUnsigned(4);
                audblk.lfeexps[0] = frame.getUnsigned(7);
                audblk.lfeexps[1] = frame.getUnsigned(7);

                // Unpack exponent groups
                audblk.lfeexps = unpackExponents(audblk.lfeexps, lfeabsexp, GROUP_SIZE[audblk.lfeexpstr], 1);
            }
        }

        // Bit-allocation parametric information
        audblk.baie = frame.getUnsigned(1);
        if (audblk.baie) {
            audblk.sdcycod = frame.getUnsigned(2);
            audblk.fdcycod = frame.getUnsigned(2);
            audblk.sgaincod = frame.getUnsigned(2);
            audblk.dbpbcod = frame.getUnsigned(2);
            audblk.floorcod = frame.getUnsigned(3);
        }
        audblk.snroffste = frame.getUnsigned(1);
        if (audblk.snroffste) {
            audblk.csnroffst = frame.getUnsigned(6);
            if (audblk.cplinu) {
                audblk.cplfsnroffst = frame.getUnsigned(4);
                audblk.cplfgaincod = frame.getUnsigned(3);
            }

            audblk.fsnroffst = new Array(bsi.nfchans);
            audblk.fgaincod = new Array(bsi.nfchans);
            for (let ch = 0; ch < bsi.nfchans; ch++) {
                audblk.fsnroffst[ch] = frame.getUnsigned(4);
                audblk.fgaincod[ch] = frame.getUnsigned(3);
            }

            if (bsi.lfeon) {
                audblk.lfefsnroffst = frame.getUnsigned(4);
                audblk.lfefgaincod = frame.getUnsigned(3);
            }
        }
        if (audblk.cplinu) {
            audblk.cplleake = frame.getUnsigned(1);
            if (audblk.cplleake) {
                audblk.cplfleak = frame.getUnsigned(3);
                audblk.cplsleak = frame.getUnsigned(3);
            }
        }

        // Delta bit allocation information
        audblk.deltbaie = frame.getUnsigned(1);
        if (audblk.deltbaie) {
            if (audblk.cplinu) {
                audblk.cpldeltbae = frame.getUnsigned(2);
            }

            for (let ch = 0; ch < bsi.nfchans; ch++) {
                audblk.deltbae[ch] = frame.getUnsigned(2);
            }

            if (audblk.cplinu) {
                if (audblk.cpldeltbae === 0x1) {
                    audblk.cpldeltnseg = frame.getUnsigned(2);

                    audblk.cpldeltoffst = new Array(audblk.cpldeltnseg + 1);
                    audblk.cpldeltlen = new Array(audblk.cpldeltnseg + 1);
                    audblk.cpldeltba = new Array(audblk.cpldeltnseg + 1);
                    for (let seg = 0; seg <= audblk.cpldeltnseg; seg++) {
                        audblk.cpldeltoffst[seg] = frame.getUnsigned(5);
                        audblk.cpldeltlen[seg] = frame.getUnsigned(4);
                        audblk.cpldeltba[seg] = frame.getUnsigned(3);
                    }
                }
            }

            audblk.deltoffst = new Array(bsi.nfchans);
            audblk.deltlen = new Array(bsi.nfchans);
            audblk.deltba = new Array(bsi.nfchans);
            audblk.deltnseg = new Array(bsi.nfchans);
            for (let ch = 0; ch < bsi.nfchans; ch++) {
                if (audblk.deltbae[ch] === 0x1) {
                    audblk.deltnseg[ch] = frame.getUnsigned(2);

                    audblk.deltoffst[ch] = new Array(audblk.deltnseg[ch] + 1);
                    audblk.deltlen[ch] = new Array(audblk.deltnseg[ch] + 1);
                    audblk.deltba[ch] = new Array(audblk.deltnseg[ch] + 1);
                    for (let seg = 0; seg <= audblk.deltnseg[ch]; seg++) {
                        audblk.deltoffst[ch][seg] = frame.getUnsigned(5);
                        audblk.deltlen[ch][seg] = frame.getUnsigned(4);
                        audblk.deltba[ch][seg] = frame.getUnsigned(3);
                    }
                }
            }
        } else if (blk == 0) {
            audblk.cpldeltbae = 2;
            for (let ch = 0; ch < bsi.nfchans; ch++) {
                audblk.deltbae[ch] = 2;
            }
        }

        // TODO: bit allocation, see section 7.3
        // "The bit allocation must be computed in the decoder whenever the exponent strategy (chexpstr,
        // cplexpstr, lfeexpstr) for one or more channels does not indicate reuse, or whenever baie, snroffste, or
        // deltbaie = 1."

        audblk.sdecay = SLOW_DECAY[audblk.sdcycod];
        audblk.fdecay = FAST_DECAY[audblk.fdcycod];
        audblk.sgain = SLOW_GAIN[audblk.sgaincod];
        audblk.dbknee = DB_PER_BIT[audblk.dbpbcod];
        audblk.floor = FLOOR[audblk.floorcod];

        audblk.baps = new Array(bsi.nfchans);
        for (let ch = 0; ch < bsi.nfchans; ch++) {
            let delt = null;
            if (audblk.deltbae[ch] == 0 || audblk.deltbae[ch] == 1) {
                delt = {
                    nseg: audblk.deltnseg[ch],
                    offst: audblk.deltoffst[ch],
                    ba: audblk.deltba[ch],
                    len: audblk.deltlen[ch]
                };
            }
            audblk.baps[ch] = bitAllocation(bsi, audblk, audblk.strtmant[ch],
                audblk.endmant[ch], audblk.exps[ch], FAST_GAIN[audblk.fgaincod[ch]],
                (((audblk.csnroffst - 15) << 4) + audblk.fsnroffst[ch]) << 2, 0, 0, delt);
        }
        if (audblk.cplinu) {
            let delt = null;
            if (audblk.cpldeltbae == 0 || audblk.cpldeltbae == 1) {
                delt = {
                    nseg: audblk.cpldeltnseg,
                    offst: audblk.cpldeltoffst,
                    ba: audblk.cpldeltba,
                    len: audblk.cpldeltlen
                };
            }
            audblk.cplbap = bitAllocation(bsi, audblk, audblk.cplstrtmant,
                audblk.cplendmant, audblk.cplexps, FAST_GAIN[audblk.cplfgaincod],
                (((audblk.csnroffst - 15) << 4) + audblk.cplfsnroffst) << 2,
                (audblk.cplfleak << 8) + 768, (audblk.cplsleak << 8) + 768, delt);
        }
        if (bsi.lfeon) {
            audblk.lfebap = bitAllocation(bsi, audblk, audblk.lfestartmant,
                audblk.lfeendmant, audblk.lfeexps, FAST_GAIN[audblk.lfefgaincod],
                (((audblk.csnroffst - 15) << 4) + audblk.lfefsnroffst) << 2, 0, 0, null);
        }

        // Dummy data
        if (frame.getUnsigned(1) !== 0) {
            let skipl = frame.getUnsigned(9);
            while (skipl--) {
                frame.getUnsigned(8);
            }
        }

        // Quantized mantissa values
        audblk.got_cplchan = 0;
        audblk.chmant = new Array(bsi.nfchans);
        for (let ch = 0; ch < bsi.nfchans; ch++) {
            audblk.chmant[ch] = new Array(256);
            audblk.chmant[ch].fill(0);
            for (let bin = 0; bin < audblk.endmant[ch]; bin++) {
                if (audblk.baps[ch][bin] != 0 || !audblk.dithflag[ch]) {
                    audblk.chmant[ch][bin] = mantissas.get(audblk.baps[ch][bin]) *
                        Math.pow(2, -audblk.exps[ch][bin]);
                } else {
                    audblk.chmant[ch][bin] = getDitherMantissa() *
                        Math.pow(2, -audblk.exps[ch][bin]);
                }
            }

            if (audblk.cplinu && audblk.chincpl[ch] && !audblk.got_cplchan) {
                audblk.ncplmant = 12 * audblk.ncplsubnd;
                audblk.cplmant = new Array(audblk.ncplmant);
                for (let bin = 0; bin < audblk.ncplmant; bin++) {
                    audblk.cplmant[bin] = mantissas.get(audblk.cplbap[bin]) *
                        Math.pow(2, -audblk.cplexps[bin]);
                }
                audblk.got_cplchan = 1;
            }
        }

        if (bsi.lfeon) {
            audblk.nlfemant = 7;
            audblk.lfemant = new Array(audblk.nlfemant);
            for (let bin = 0; bin < audblk.nlfemant; bin++) {
                audblk.lfemant[bin] = mantissas.get(audblk.lfebap[bin]) *
                    Math.pow(2, -audblk.lfeexps[bin]);
            }
        }

        // Decouple channels
        if (audblk.cplinu) {
            for (let ch = 0; ch < bsi.nfchans; ch++) {
                if (audblk.chincpl[ch]) {
                    for (let sbnd = 0; sbnd < audblk.ncplsubnd; sbnd++) {
                        for (let bin = 0; bin < 12; bin++) {
                            let mantissa;
                            if (audblk.cplmant[sbnd * 12 + bin] == 0 && audblk.dithflag[ch]) {
                                mantissa = getDitherMantissa() *
                                    Math.pow(2, -audblk.cplexps[sbnd * 12 + bin]);
                            } else {
                                mantissa = audblk.cplmant[sbnd * 12 + bin];
                            }
                            audblk.chmant[ch][(sbnd + audblk.cplbegf) * 12 + bin + 37] =
                                mantissa * audblk.cplco[ch][sbnd] * 8;
                        }
                    }
                }
            }
        }

        for (let i = 0; i < audblk.rematflg.length; i++) {
            if (audblk.rematflg[i]) {
                let beginBin = REMATRIX_BANDS[i];
                let endBin = REMATRIX_BANDS[i + 1];
                if (audblk.cplinu && endBin >= 36 + audblk.cplbegf * 12) {
                    endBin = 36 + audblk.cplbegf * 12;
                }
                for (let bin = beginBin; bin < endBin; bin++) {
                    let left = audblk.chmant[0][bin];
                    let right = audblk.chmant[1][bin];
                    audblk.chmant[0][bin] = left + right;
                    audblk.chmant[1][bin] = left - right;
                } 
            }
        }

        for (let ch = 0; ch < bsi.nfchans; ch++) {
            if (audblk.blksw[ch]) {
                this.imdct[ch].process128(audblk.chmant[ch], this.samples[ch], blk * 256);
            } else {
                this.imdct[ch].process256(audblk.chmant[ch], this.samples[ch], blk * 256);
            }
        }
    }

    // TODO: Support other downmix modes.
    let leftCoeffs;
    let rightCoeffs;
    let clev;
    let slev;
    let totlev;
    switch (bsi.acmod) {
        case 0: // 1+1 independent mono channels
            leftCoeffs = [1, 0];
            rightCoeffs = [0, 1];
            break;
        case 1: // 1 mono channel
            leftCoeffs = [0.707];
            rightCoeffs = [0.707];
            break;
        case 2: // left/right
            leftCoeffs = [1, 0];
            rightCoeffs = [0, 1];
            break;
        case 3: // left/center/right
            clev = CLEV[bsi.cmixlev];
            totlev = (1 + clev);
            leftCoeffs = [1 / totlev, clev / totlev, 0];
            rightCoeffs = [0, clev / totlev, 1 / totlev];
            break;
        case 4: // left/right/surround
            slev = SLEV[bsi.surmixlev] * 0.707;
            totlev = (1 + clev);
            leftCoeffs = [1 / totlev, 0, slev / totlev];
            rightCoeffs = [0, 1 / totlev, slev / totlev];
            break;
        case 5: // left/center/right/surround
            clev = CLEV[bsi.cmixlev];
            slev = SLEV[bsi.surmixlev] * 0.707;
            totlev = (1 + clev + slev);
            leftCoeffs = [1 / totlev, clev / totlev, 0];
            rightCoeffs = [0, clev / totlev, 1 / totlev];
            break;
        case 6: // left/right/left surround/right surroun
            slev = SLEV[bsi.surmixlev];
            totlev = (1 + slev);
            leftCoeffs = [1 / totlev, 0, slev / totlev, 0];
            rightCoeffs = [0, 1 / totlev, 0, slev / totlev];
            break;
        case 7: // left/center/right/left surround/right surround
            clev = CLEV[bsi.cmixlev];
            slev = SLEV[bsi.surmixlev];
            totlev = (1 + clev + slev);
            leftCoeffs = [1 / totlev, clev / totlev, 0, slev / totlev, 0];
            rightCoeffs = [0, clev / totlev, 1 / totlev, 0, slev / totlev];
            break;
    }

    for (let i = 0; i < 1536; i++) {
        let left = 0;
        let right = 0;
        for (let ch = 0; ch < bsi.nfchans; ch++) {
            left += this.samples[ch][i] * leftCoeffs[ch];
            right += this.samples[ch][i] * rightCoeffs[ch];
        }
        this.samples[0][i] = left;
        this.samples[1][i] = right;
    }
};

AC3FrameDecoder.prototype.pcmBytes = function() {
    let sampleBytes = new Uint8Array(6144);
    let sample;
    for (let i = 0; i < 1536; i++) {
        sample = this.samples[0][i] * 65535;
        sampleBytes[i * 4] = sample & 0xff;
        sampleBytes[i * 4 + 1] = sample >> 8;
        sample = this.samples[1][i] * 65535;
        sampleBytes[i * 4 + 2] = sample & 0xff;
        sampleBytes[i * 4 + 3] = sample >> 8;
    }
    return sampleBytes;
};

export const AC3FrameParser = function() {
    let frames = 0;
    let parser = new AC3FrameDecoder();

    return through2.obj(function (chunk, enc, callback) {
        parser.decodeFrame(chunk);
        this.push(parser.pcmBytes());
        frames++;
        callback();
    });
}