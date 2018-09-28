import {EXP_REUSE} from './constants';

export const createAudioBlock = (bsi) => ({
    blksw: new Uint8Array(bsi.nfchans),
    dithflag: new Uint8Array(bsi.nfchans),
    chincpl: new Uint8Array(bsi.nfchans),
    mstrcplco: new Uint8Array(bsi.nfchans),
    cplcoe: new Uint8Array(bsi.nfchans),
    cplcoexp: new Uint8Array(bsi.nfchans),
    cplcomant: new Uint8Array(bsi.nfchans),
    cplco: new Uint8Array(bsi.nfchans),
    chexpstr: new Uint8Array(bsi.nfchans),
    chbwcod: new Uint8Array(bsi.nfchans),
    strtmant: new Uint8Array(bsi.nfchans),
    endmant: new Uint8Array(bsi.nfchans),
    nchgrps: new Uint8Array(bsi.nfchans),
    exps: new Uint8Array(bsi.nfchans),
    gainrng: new Uint8Array(bsi.nfchans),
    deltbae: new Uint8Array(bsi.nfchans),
    rematflg: null
});

export const readAudioBlock = (stream, bsi, samples, imdct, audblk) => {
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

    // TODO
};
