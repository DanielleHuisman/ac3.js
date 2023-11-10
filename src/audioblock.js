import {bitAllocation} from './bitallocation';
import {EXPONENT_GROUP_SIZE, EXP_D15, EXP_D25, EXP_D45, EXP_REUSE} from './constants';
import {unpackExponents} from './exponents';
import {MantissaReader, getDitherMantissa} from './mantissa';
import {DB_PER_BIT, FAST_DECAY, FAST_GAIN, FLOOR, REMATRIX_BANDS, SLOW_DECAY, SLOW_GAIN} from './tables';

export const createAudioBlock = (bsi) => ({
    blksw: new Array(bsi.nfchans),
    dithflag: new Array(bsi.nfchans),
    chincpl: new Array(bsi.nfchans),
    mstrcplco: new Array(bsi.nfchans),
    cplcoe: new Array(bsi.nfchans),
    cplcoexp: new Array(bsi.nfchans),
    cplcomant: new Array(bsi.nfchans),
    cplco: new Array(bsi.nfchans),
    chexpstr: new Array(bsi.nfchans),
    chbwcod: new Array(bsi.nfchans),
    strtmant: new Array(bsi.nfchans),
    endmant: new Array(bsi.nfchans),
    nchgrps: new Array(bsi.nfchans),
    exps: new Array(bsi.nfchans),
    gainrng: new Array(bsi.nfchans),
    deltbae: new Array(bsi.nfchans),
    rematflg: []
});

export const readAudioBlock = (stream, bsi, samples, imdct, audblk, blk) => {
    // Block switch and dither flags
    for (let ch = 0; ch < bsi.nfchans; ch++) {
        audblk.blksw[ch] = stream.read(1);
    }
    for (let ch = 0; ch < bsi.nfchans; ch++) {
        audblk.dithflag[ch] = stream.read(1);
    }

    // Dynamic range control
    if (stream.read(1) !== 0) {
        audblk.dynrng = stream.read(8);
    }
    if (bsi.acmod === 0x0) {
        if (stream.read(1) !== 0) {
            audblk.dynrng2 = stream.read(8);
        }
    }

    // Coupling strategy information
    if (stream.read(1) !== 0) {
        audblk.cplinu = stream.read(1);
        if (audblk.cplinu) {
            for (let ch = 0; ch < bsi.nfchans; ch++) {
                audblk.chincpl[ch] = stream.read(1);
            }

            if (bsi.acmod === 0x2) {
                audblk.phsflginu = stream.read(1);
            }

            audblk.cplbegf = stream.read(4);
            audblk.cplendf = stream.read(4);

            audblk.ncplsubnd = 3 + audblk.cplendf - audblk.cplbegf;
            audblk.ncplbnd = audblk.ncplsubnd;
            audblk.cplbndstrc = new Array(audblk.ncplsubnd);
            audblk.cplbndstrc[0] = 0;
            for (let bnd = 1; bnd < audblk.ncplsubnd; bnd++) {
                audblk.cplbndstrc[bnd] = stream.read(1);
                audblk.ncplbnd -= audblk.cplbndstrc[bnd];
            }
        } else {
            for (let ch = 0; ch < bsi.nfchans; ch++) {
                audblk.chincpl[ch] = 0;
            }
        }
    }

    // Coupling coordinates and phase flags
    if (audblk.cplinu) {
        for (let ch = 0; ch < bsi.nfchans; ch++) {
            if (audblk.chincpl[ch]) {
                audblk.cplcoe[ch] = stream.read(1);
                if (audblk.cplcoe[ch]) {
                    audblk.mstrcplco[ch] = stream.read(2);

                    audblk.cplcoexp[ch] = new Array(audblk.ncplbnd);
                    audblk.cplcomant[ch] = new Array(audblk.ncplbnd);
                    audblk.cplco[ch] = new Array(audblk.ncplbnd);
                    for (let bnd = 0; bnd < audblk.ncplbnd; bnd++) {
                        audblk.cplcoexp[ch][bnd] = stream.read(4);
                        audblk.cplcomant[ch][bnd] = stream.read(4);
                    }
                }

                let cplco;
                const bnd = 0;
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
                audblk.phsflg[bnd] = stream.read(1);
            }
        }
    }

    // Rematrixing operation in the 2/0 mode
    if (bsi.acmod === 0x2) {
        audblk.rematstr = stream.read(1);
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
                audblk.rematflg[rbnd] = stream.read(1);
            }
        }
    }

    // Exponent strategy
    if (audblk.cplinu) {
        audblk.cplexpstr = stream.read(2);
    }

    for (let ch = 0; ch < bsi.nfchans; ch++) {
        audblk.chexpstr[ch] = stream.read(2);
    }

    if (bsi.lfeon) {
        audblk.lfeexpstr = stream.read(1);
    }

    for (let ch = 0; ch < bsi.nfchans; ch++) {
        if (audblk.chexpstr[ch] !== EXP_REUSE) {
            if (!audblk.chincpl[ch]) {
                audblk.chbwcod[ch] = stream.read(6);
            }
        }
    }

    // Exponents for the coupling channel
    if (audblk.cplinu) {
        audblk.cplstrtmant = audblk.cplbegf * 12 + 37;
        audblk.cplendmant = (audblk.cplendf + 3) * 12 + 37;

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

            const cplabsexp = stream.read(4);
            audblk.cplexps = new Array(audblk.ncplgrps);
            for (let grp = 0; grp < audblk.ncplgrps; grp++) {
                audblk.cplexps[grp] = stream.read(7);
            }

            // Unpack exponent groups
            audblk.cplexps = unpackExponents(audblk.cplexps, cplabsexp << 1, EXPONENT_GROUP_SIZE[audblk.cplexpstr], 0);
        }
    }

    // Exponents for full bandwidth channels
    for (let ch = 0; ch < bsi.nfchans; ch++) {
        if (audblk.chexpstr[ch] !== EXP_REUSE) {
            audblk.strtmant[ch] = 0;
            if (audblk.chincpl[ch]) {
                audblk.endmant[ch] = 37 + 12 * audblk.cplbegf;
            } else {
                audblk.endmant[ch] = 37 + 3 * (audblk.chbwcod[ch] + 12);
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
            const absexps = stream.read(4);
            for (let grp = 0; grp < audblk.nchgrps[ch]; grp++) {
                audblk.exps[ch][grp] = stream.read(7);
            }

            // Unpack exponent groups
            audblk.exps[ch] = unpackExponents(audblk.exps[ch], absexps, EXPONENT_GROUP_SIZE[audblk.chexpstr[ch]], 1);

            audblk.gainrng[ch] = stream.read(2);
        }
    }

    // Exponents for the low frequency effects channel
    if (bsi.lfeon) {
        if (audblk.lfeexpstr !== EXP_REUSE) {
            audblk.lfestartmant = 0;
            audblk.lfeendmant = 7;

            audblk.nlfegrps = 2;
            audblk.lfeexps = new Array(audblk.nlfegrps);

            const lfeabsexp = stream.read(4);
            audblk.lfeexps[0] = stream.read(7);
            audblk.lfeexps[1] = stream.read(7);

            // Unpack exponent groups
            audblk.lfeexps = unpackExponents(audblk.lfeexps, lfeabsexp, EXPONENT_GROUP_SIZE[audblk.lfeexpstr], 1);
        }
    }

    // Bit-allocation parametric information
    audblk.baie = stream.read(1);
    if (audblk.baie) {
        audblk.sdcycod = stream.read(2);
        audblk.fdcycod = stream.read(2);
        audblk.sgaincod = stream.read(2);
        audblk.dbpbcod = stream.read(2);
        audblk.floorcod = stream.read(3);
    }
    audblk.snroffste = stream.read(1);
    if (audblk.snroffste) {
        audblk.csnroffst = stream.read(6);
        if (audblk.cplinu) {
            audblk.cplfsnroffst = stream.read(4);
            audblk.cplfgaincod = stream.read(3);
        }

        audblk.fsnroffst = new Array(bsi.nfchans);
        audblk.fgaincod = new Array(bsi.nfchans);
        for (let ch = 0; ch < bsi.nfchans; ch++) {
            audblk.fsnroffst[ch] = stream.read(4);
            audblk.fgaincod[ch] = stream.read(3);
        }

        if (bsi.lfeon) {
            audblk.lfefsnroffst = stream.read(4);
            audblk.lfefgaincod = stream.read(3);
        }
    }
    if (audblk.cplinu) {
        audblk.cplleake = stream.read(1);
        if (audblk.cplleake) {
            audblk.cplfleak = stream.read(3);
            audblk.cplsleak = stream.read(3);
        }
    }

    // Delta bit allocation information
    audblk.deltbaie = stream.read(1);
    if (audblk.deltbaie) {
        if (audblk.cplinu) {
            audblk.cpldeltbae = stream.read(2);
        }

        for (let ch = 0; ch < bsi.nfchans; ch++) {
            audblk.deltbae[ch] = stream.read(2);
        }

        if (audblk.cplinu) {
            if (audblk.cpldeltbae === 0x1) {
                audblk.cpldeltnseg = stream.read(2);

                audblk.cpldeltoffst = new Array(audblk.cpldeltnseg + 1);
                audblk.cpldeltlen = new Array(audblk.cpldeltnseg + 1);
                audblk.cpldeltba = new Array(audblk.cpldeltnseg + 1);
                for (let seg = 0; seg <= audblk.cpldeltnseg; seg++) {
                    audblk.cpldeltoffst[seg] = stream.read(5);
                    audblk.cpldeltlen[seg] = stream.read(4);
                    audblk.cpldeltba[seg] = stream.read(3);
                }
            }
        }

        audblk.deltoffst = new Array(bsi.nfchans);
        audblk.deltlen = new Array(bsi.nfchans);
        audblk.deltba = new Array(bsi.nfchans);
        audblk.deltnseg = new Array(bsi.nfchans);
        for (let ch = 0; ch < bsi.nfchans; ch++) {
            if (audblk.deltbae[ch] === 0x1) {
                audblk.deltnseg[ch] = stream.read(2);

                audblk.deltoffst[ch] = new Array(audblk.deltnseg[ch] + 1);
                audblk.deltlen[ch] = new Array(audblk.deltnseg[ch] + 1);
                audblk.deltba[ch] = new Array(audblk.deltnseg[ch] + 1);
                for (let seg = 0; seg <= audblk.deltnseg[ch]; seg++) {
                    audblk.deltoffst[ch][seg] = stream.read(5);
                    audblk.deltlen[ch][seg] = stream.read(4);
                    audblk.deltba[ch][seg] = stream.read(3);
                }
            }
        }
    } else if (blk == 0) {
        audblk.cpldeltbae = 2;
        for (let ch = 0; ch < bsi.nfchans; ch++) {
            audblk.deltbae[ch] = 2;
        }
    }

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
        audblk.baps[ch] = bitAllocation(
            bsi,
            audblk,
            audblk.strtmant[ch],
            audblk.endmant[ch],
            audblk.exps[ch],
            FAST_GAIN[audblk.fgaincod[ch]],
            (((audblk.csnroffst - 15) << 4) + audblk.fsnroffst[ch]) << 2,
            0,
            0,
            delt
        );
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
        audblk.cplbap = bitAllocation(
            bsi,
            audblk,
            audblk.cplstrtmant,
            audblk.cplendmant,
            audblk.cplexps,
            FAST_GAIN[audblk.cplfgaincod],
            (((audblk.csnroffst - 15) << 4) + audblk.cplfsnroffst) << 2,
            (audblk.cplfleak << 8) + 768,
            (audblk.cplsleak << 8) + 768,
            delt
        );
    }
    if (bsi.lfeon) {
        audblk.lfebap = bitAllocation(
            bsi,
            audblk,
            audblk.lfestartmant,
            audblk.lfeendmant,
            audblk.lfeexps,
            FAST_GAIN[audblk.lfefgaincod],
            (((audblk.csnroffst - 15) << 4) + audblk.lfefsnroffst) << 2,
            0,
            0,
            null
        );
    }

    // Dummy data
    if (stream.read(1) !== 0) {
        let skipl = stream.read(9);
        while (skipl--) {
            stream.read(8);
        }
    }

    // Quantized mantissa values
    const mantissas = new MantissaReader(stream);
    audblk.got_cplchan = 0;
    audblk.chmant = new Array(bsi.nfchans);
    for (let ch = 0; ch < bsi.nfchans; ch++) {
        audblk.chmant[ch] = new Array(256);
        audblk.chmant[ch].fill(0);
        for (let bin = 0; bin < audblk.endmant[ch]; bin++) {
            if (audblk.baps[ch][bin] != 0 || !audblk.dithflag[ch]) {
                audblk.chmant[ch][bin] = mantissas.get(audblk.baps[ch][bin]) * Math.pow(2, -audblk.exps[ch][bin]);
            } else {
                audblk.chmant[ch][bin] = getDitherMantissa() * Math.pow(2, -audblk.exps[ch][bin]);
            }
        }

        if (audblk.cplinu && audblk.chincpl[ch] && !audblk.got_cplchan) {
            audblk.ncplmant = 12 * audblk.ncplsubnd;
            audblk.cplmant = new Array(audblk.ncplmant);
            for (let bin = 0; bin < audblk.ncplmant; bin++) {
                audblk.cplmant[bin] = mantissas.get(audblk.cplbap[bin]) * Math.pow(2, -audblk.cplexps[bin]);
            }
            audblk.got_cplchan = 1;
        }
    }

    if (bsi.lfeon) {
        audblk.nlfemant = 7;
        audblk.lfemant = new Array(audblk.nlfemant);
        for (let bin = 0; bin < audblk.nlfemant; bin++) {
            audblk.lfemant[bin] = mantissas.get(audblk.lfebap[bin]) * Math.pow(2, -audblk.lfeexps[bin]);
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
                            mantissa = getDitherMantissa() * Math.pow(2, -audblk.cplexps[sbnd * 12 + bin]);
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
            const beginBin = REMATRIX_BANDS[i];
            let endBin = REMATRIX_BANDS[i + 1];
            if (audblk.cplinu && endBin >= 36 + audblk.cplbegf * 12) {
                endBin = 36 + audblk.cplbegf * 12;
            }
            for (let bin = beginBin; bin < endBin; bin++) {
                const left = audblk.chmant[0][bin];
                const right = audblk.chmant[1][bin];
                audblk.chmant[0][bin] = left + right;
                audblk.chmant[1][bin] = left - right;
            }
        }
    }

    for (let ch = 0; ch < bsi.nfchans; ch++) {
        if (audblk.blksw[ch]) {
            imdct[ch].process128(audblk.chmant[ch], samples[ch], blk * 256);
        } else {
            imdct[ch].process256(audblk.chmant[ch], samples[ch], blk * 256);
        }
    }
};
