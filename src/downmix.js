import {CLEV, SLEV} from './tables';

export const downmix = (bsi, samples) => {
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
            totlev = 1 + clev;
            leftCoeffs = [1 / totlev, clev / totlev, 0];
            rightCoeffs = [0, clev / totlev, 1 / totlev];
            break;
        case 4: // left/right/surround
            slev = SLEV[bsi.surmixlev] * 0.707;
            totlev = 1 + clev;
            leftCoeffs = [1 / totlev, 0, slev / totlev];
            rightCoeffs = [0, 1 / totlev, slev / totlev];
            break;
        case 5: // left/center/right/surround
            clev = CLEV[bsi.cmixlev];
            slev = SLEV[bsi.surmixlev] * 0.707;
            totlev = 1 + clev + slev;
            leftCoeffs = [1 / totlev, clev / totlev, 0];
            rightCoeffs = [0, clev / totlev, 1 / totlev];
            break;
        case 6: // left/right/left surround/right surroun
            slev = SLEV[bsi.surmixlev];
            totlev = 1 + slev;
            leftCoeffs = [1 / totlev, 0, slev / totlev, 0];
            rightCoeffs = [0, 1 / totlev, 0, slev / totlev];
            break;
        case 7: // left/center/right/left surround/right surround
            clev = CLEV[bsi.cmixlev];
            slev = SLEV[bsi.surmixlev];
            totlev = 1 + clev + slev;
            leftCoeffs = [1 / totlev, clev / totlev, 0, slev / totlev, 0];
            rightCoeffs = [0, clev / totlev, 1 / totlev, 0, slev / totlev];
            break;
    }

    for (let i = 0; i < 1536; i++) {
        let left = 0;
        let right = 0;
        for (let ch = 0; ch < bsi.nfchans; ch++) {
            left += samples[ch][i] * leftCoeffs[ch];
            right += samples[ch][i] * rightCoeffs[ch];
        }
        samples[0][i] = left;
        samples[1][i] = right;
    }
};
