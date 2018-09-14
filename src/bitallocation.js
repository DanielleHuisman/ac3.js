import { BNDTAB, BNDSZ, LATAB, MASKTAB } from "./tables";

function logadd(a, b) {
    let c = a - b;
    let address = min(abs(c) >> 1, 255);
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
            a = max(0, a - 64);
        }
    } else if (bin < 20) {
        if ((b0 + 256) === b1) {
            a = 320;
        } else if (b0 > b1) {
            a = max(0, a - 64);
        }
    } else {
        a = max(0, a - 128) ;
    }

    return a;
}

export const bitAllocate = (audblk, start, end, exp, fastleak, slowleak) => {
    let psd = new Array(end);
    
    for (let bin = start; bin < end; bin++) {
        psd[bin] = 3072 - (exp[bin] << 7);
    }

    let j = start;
    let k = MASKTAB[start];
    let lastbin;

    do {
        lastbin = min(BNDTAB[k] + BNDSZ[k], end);
        bndpsd[k] = psd[j];
        j++;
        for (let i = j; i < lastbin; i++) {
            bndpsd[k] = logadd(bndpsd[k], psd[j]);
            j++;
        }
        k++;
    } while (end > lastbin);

    let bndstrt = MASKTAB[start];
    let bndend = MASKTAB[end - 1] + 1;
    let begin;

    if (bndstrt === 0) {
        lowcomp = calc_lowcomp(lowcomp, bndpsd[0], bndpsd[1], 0);
        excite[0] = bndpsd[0] - fgain - lowcomp;
        lowcomp = calc_lowcomp(lowcomp, bndpsd[1], bndpsd[2], 1);
        excite[1] = bndpsd[1] - fgain - lowcomp;
        begin = 7;
    
        for (let bin = 2; bin < 7; bin++) {
            if ((bndend !== 7) || (bin !== 6)) {
                lowcomp = calc_lowcomp(lowcomp, bndpsd[bin], bndpsd[bin +1 ], bin);
            }
            fastleak = bndpsd[bin] - fgain;
            slowleak = bndpsd[bin] - sgain;
            excite[bin] = fastleak - lowcomp;
            if ((bndend !== 7) || (bin !== 6)) {
                if (bndpsd[bin] <= bndpsd[bin + 1]) {
                    begin = bin + 1;
                    break;
                }
            }
        }
    
        for (let bin = begin; bin < min(bndend, 22); bin++) {
            if ((bndend !== 7) || (bin !== 6)) {
                lowcomp = calc_lowcomp(lowcomp, bndpsd[bin], bndpsd[bin + 1], bin);
            }
            fastleak -= fdecay;
            faskleak = max(fastleak, bndpsd[bin] - fgain);
            slowleak -= sdecay;
            slowleak = max(slowleak, bndpsd[bin] - sgain);
            excite[bin] = max(fastleak - lowcomp, slowleak);
        }
    
        begin = 22;
    } else {
        begin = bndstrt;
    }

    for (let bin = begin; bin < bndend; bin++) {
        fastleak -= fdecay;
        faskleak = max(fastleak, bndpsd[bin] - fgain);
        slowleak -= sdecay;
        slowleak = max(slowleak, bndpsd[bin] - sgain);
        excite[bin] = max(fastleak, slowleak);
    }

    for (let bin = bndstrt; bin < bndend; bin++) {
        if (bndpsd[bin] < dbknee) {
            excite[bin] += ((dbknee - bndpsd[bin]) >> 2);
        }
        mask[bin] = max(excite[bin], HTH[audblk.fscod][bin]);
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

    let i = start;
    j = MASKTAB[start];
    do {
        lastbin = min(BNDTAB[j] + BNDSZ[j], end);
        mask[j] -= snroffset;
        mask[j] -= floor;
        if (mask[j] < 0) {
            mask[j] = 0;
        }
        mask[j] &= 0x1fe0;
        mask[j] += floor;
        for (let k = i; k < lastbin; k++) {
            let address = (psd[i] - mask[j]) >> 5 ;
            address = min(63, max(0, address));
            bap[i] = BAPTAB[address];
            i++;
        }
        j++;
    } while (end > lastbin);

    return bap;
};