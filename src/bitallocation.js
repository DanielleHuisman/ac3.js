import { BNDTAB, BNDSZ, LATAB, MASKTAB, BAPTAB, HTH } from "./tables";

function logadd(a, b) {
    let c = a - b;
    let address = Math.min(Math.abs(c) >> 1, 255);
    if (c >= 0) {
        return (a + LATAB[address]);
    } else {
        return (b + LATAB[address]);
    }
}

function calc_lowcomp(a, b0, b1, bin) {
    if (bin < 7) {
        if ((b0 + 256) === b1) {
            a = 384;
        } else if (b0 > b1) {
            a = Math.max(0, a - 64);
        }
    } else if (bin < 20) {
        if ((b0 + 256) === b1) {
            a = 320;
        } else if (b0 > b1) {
            a = Math.max(0, a - 64);
        }
    } else {
        a = Math.max(0, a - 128) ;
    }

    return a;
}

export const bitAllocation = (bsi, audblk, start, end, exp, fgain, snroffset, fastleak, slowleak) => {
    let bndstrt = MASKTAB[start];
    let bndend = MASKTAB[end - 1] + 1;
    let psd = new Array(end);
    let bndpsd = new Array(bndend);
    let excite = new Array(bndend);
    let mask = new Array(bndend);

    for (let bin = start; bin < end; bin++) {
        psd[bin] = 3072 - (exp[bin] << 7);
    }

    let j = start;
    let k = bndstrt;
    let lastbin;

    do {
        lastbin = Math.min(BNDTAB[k] + BNDSZ[k], end);
        bndpsd[k] = psd[j];
        j++;
        for (let i = j; i < lastbin; i++) {
            bndpsd[k] = logadd(bndpsd[k], psd[j]);
            j++;
        }
        k++;
    } while (end > lastbin);

    let begin;

    if (bndstrt === 0) {
        let lowcomp = calc_lowcomp(lowcomp, bndpsd[0], bndpsd[1], 0);
        excite[0] = bndpsd[0] - fgain - lowcomp;
        lowcomp = calc_lowcomp(lowcomp, bndpsd[1], bndpsd[2], 1);
        excite[1] = bndpsd[1] - fgain - lowcomp;
        begin = 7;
    
        for (let bin = 2; bin < 7; bin++) {
            if ((bndend !== 7) || (bin !== 6)) {
                lowcomp = calc_lowcomp(lowcomp, bndpsd[bin], bndpsd[bin +1 ], bin);
            }
            fastleak = bndpsd[bin] - audblk.fgain;
            slowleak = bndpsd[bin] - audblk.sgain;
            excite[bin] = fastleak - lowcomp;
            if ((bndend !== 7) || (bin !== 6)) {
                if (bndpsd[bin] <= bndpsd[bin + 1]) {
                    begin = bin + 1;
                    break;
                }
            }
        }
    
        for (let bin = begin; bin < Math.min(bndend, 22); bin++) {
            if ((bndend !== 7) || (bin !== 6)) {
                lowcomp = calc_lowcomp(lowcomp, bndpsd[bin], bndpsd[bin + 1], bin);
            }
            fastleak -= audblk.fdecay;
            fastleak = Math.max(fastleak, bndpsd[bin] - audblk.fgain);
            slowleak -= audblk.sdecay;
            slowleak = Math.max(slowleak, bndpsd[bin] - audblk.sgain);
            excite[bin] = Math.max(fastleak - lowcomp, slowleak);
        }
    
        begin = 22;
    } else {
        begin = bndstrt;
    }

    for (let bin = begin; bin < bndend; bin++) {
        fastleak -= audblk.fdecay;
        fastleak = Math.max(fastleak, bndpsd[bin] - audblk.fgain);
        slowleak -= audblk.sdecay;
        slowleak = Math.max(slowleak, bndpsd[bin] - audblk.sgain);
        excite[bin] = Math.max(fastleak, slowleak);
    }

    for (let bin = bndstrt; bin < bndend; bin++) {
        if (bndpsd[bin] < audblk.dbknee) {
            excite[bin] += ((audblk.dbknee - bndpsd[bin]) >> 2);
        }
        mask[bin] = Math.max(excite[bin], HTH[bsi.fscod][bin]);
    }

    if (audblk.deltbae === 0 || audblk.deltbae === 1) {
        let band = 0;
        for (let seg = 0; seg < audblk.deltnseg + 1; seg++) {
            band += audblk.deltoffst[seg];
        }
        if (deltba[seg] >= 4) {
            delta = (deltba[seg] - 3) << 7;
        } else {
            delta = (deltba[seg] - 4) << 7;
        }
        
        for (let k = 0; k < deltlen[seg]; k++) {
            mask[band] += delta;
            band++;
        }
    }

    let bap = new Array(end);
    let i = start;
    j = MASKTAB[start];
    do {
        lastbin = Math.min(BNDTAB[j] + BNDSZ[j], end);
        mask[j] -= snroffset;
        mask[j] -= audblk.floor;
        if (mask[j] < 0) {
            mask[j] = 0;
        }
        mask[j] &= 0x1fe0;
        mask[j] += audblk.floor;
        for (let k = i; k < lastbin; k++) {
            let address = (psd[i] - mask[j]) >> 5 ;
            address = Math.min(63, Math.max(0, address));
            bap[i] = BAPTAB[address];
            i++;
        }
        j++;
    } while (end > lastbin);

    return bap;
};