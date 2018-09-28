export const unpackExponents = (exps, absexp, grpsize, skip) => {
    const dexps = new Array(exps.length * 3);

    // Unpack mapped values
    for (let grp = 0; grp < exps.length; grp++) {
        const exp = exps[grp];
        dexps[grp * 3] = (exp / 25) >> 0;
        dexps[(grp * 3) + 1] = ((exp % 25) / 5) >> 0;
        dexps[(grp * 3) + 2] = ((exp % 25) % 5) >> 0;
    }

    // Convert to unbiased mapped values
    for (let i = 0; i < dexps.length; i++) {
        dexps[i] -= 2;
    }

    // Convert from differentials to absolutes
    let prevexp = absexp;
    for (let i = 0; i < dexps.length; i++) {
        dexps[i] = prevexp + dexps[i];
        prevexp = dexps[i];
    }

    // Expand to full absolute exponent array
    const aexps = new Array(skip + dexps.length * grpsize);
    aexps[0] = absexp;
    for (let i = 0; i < dexps.length; i++) {
        for (let j = 0; j < grpsize; j++) {
            aexps[(i * grpsize) + j + skip] = dexps[i];
        }
    }
    return aexps;
};
