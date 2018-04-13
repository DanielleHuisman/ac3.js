import through from 'through2';

const CHANNELS = [2, 1, 2, 3, 3, 4, 4, 5];

const handleFrameStream = (frameStream) => {
    let frames = 0;

    frameStream.on('readable', () => {
        let frame = null;
        while ((frame = frameStream.read()) !== null) {
            frames++;

            // Validate syncword
            const syncword = frame.getUint16();
            if (syncword != 0x0b77) {
                throw new Error(`Invalid syncword ${syncword.toString(16)}`);
            }

            // Validate CRC
            const crc = frame.getUint16();
            // TODO: validate CRC

            // Skip frame rate data
            frame.getInt8();

            // Bit Stream Information (BSI)
            const bsi = {};

            bsi.bsid = frame.getUnsigned(5);
            bsi.bsmod = frame.getUnsigned(3);

            if (bsi.bsid !== 0x8) {
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
                bsi.compr = frame.getUnint8();
            }
            if (frame.getUnsigned(1) !== 0) {
                bsi.langcod = frame.getUnint8();
            }
            if (frame.getUnsigned(1) !== 0) {
                bsi.mixlevel = frame.getUnsigned(5);
                bsi.roomtyp = frame.getUnsigned(2);
            }

            if (bsi.acmod === 0x0) {
                bsi.dialnorm2 = frame.getUnsigned(5);
                if (frame.getUnsigned(1) !== 0) {
                    bsi.compr2 = frame.getUnint8();
                }
                if (frame.getUnsigned(1) !== 0) {
                    bsi.langcod2 = frame.getUnint8();
                }
                if (frame.getUnsigned(1) !== 0) {
                    bsi.mixlevel2 = frame.getUnsigned(5);
                    bsi.roomtyp2 = frame.getUnsigned(2);
                }
            }

            bsi.copyrightb = frame.getUnsigned(1);
            bsi.origbs = frame.getUnsigned(1);
            if (frame.getUnsigned(1) !== 0) {
                bsi.timecod1 = frame.getUnsigned(14);
            }
            if (frame.getUnsigned(1) !== 0) {
                bsi.timecod2 = frame.getUnsigned(14);
            }
            if(frame.getUnsigned(1) !== 0) {
                bsi.addbsil = frame.getUnsigned(6);
                bsi.addbsi = frame.getBytes(bsi.addbsil + 1);
            }

            console.log(bsi);

            // Audio Blocks
            const audblks = new Array(6);
            for (let blk = 0; blk < 6; blk++) {
                const audblk = {};
                audblks[blk] = audblk;

                // Block switch and dither flags
                audblk.blksw = new Array(bsi.nfchans);
                for (let ch = 0; ch < bsi.nfchans; ch++) {
                    audblk.blksw[ch] = frame.getUnsigned(1);
                }
                audblk.dithflag = new Array(bsi.nfchans);
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
                        audblk.chincpl = new Array(bsi.nfchans);
                        for (let ch = 0; ch < bsi.nfchans; ch++) {
                            audblk.chincpl[ch] = frame.getUnsigned(1);
                        }

                        if (bsi.acmod === 0x2) {
                            audblk.phsflginu = frame.getUnsigned(1);
                        }

                        audblk.cplbegf = frame.getUnsigned(4);
                        audblk.cplendf = frame.getUnsigned(4);

                        audblk.ncplsubnd = 3 + audblk.cplbegf - audblk.cplendf;
                        audblk.ncplbnd = audblk.ncplsubnd;
                        audblk.cplbndstrc = new Array(audblk.ncplsubnd);
                        for (let bnd = 0; bnd < audblk.ncplsubnd; bnd++) {
                            audblk.cplbndstrc[bnd] = frame.getUnsigned(1);

                            if (bnd >= 1 && bnd < audblk.ncplsubnd) {
                                audblk.ncplbnd -= audblk.cplbndstrc[bnd];
                            }
                        }
                    }
                }

                // Coupling coordinates and phase flags
                if (audblk.cplinu) {
                    audblk.mstrcplco = new Array(bsi.nfchans);
                    audblk.cplcoe = new Array(bsi.nfchans);
                    audblk.cplcoexp = new Array(bsi.nfchans);
                    audblk.cplcomant = new Array(bsi.nfchans);

                    for (let ch = 0; ch < bsi.nfchans; ch++) {
                        if (audblk.chincpl[ch]) {
                            audblk.cplcoe[ch] = frame.getUnsigned(1);
                            if (audblk.cplcoe[ch] !== 0x0) {
                                audblk.mstrcplco[ch] = frame.getUnsigned(2);

                                audblk.cplcoexp[ch] = new Array(audblk.ncplsubnd);
                                audblk.cplcomant[ch] = new Array(audblk.ncplsubnd);
                                for (let bnd = 0; bnd < audblk.ncplsubnd; bnd++) {
                                    audblk.cplcoexp[ch][bnd] = frame.getUnsigned(4);
                                    audblk.cplcomant[ch][bnd] = frame.getUnsigned(4);
                                }
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
                            audblk.rematflg[rbnd]
                        }
                    }
                }

                // Exponent strategy
                if (audblk.cplinu) {
                    audblk.cplexpstr = frame.getUnsigned(2);

                    audblk.chexpstr = new Array(bsi.nfchans);
                    for (let ch = 0; ch < bsi.nfchans; ch++) {
                        audblk.chexpstr[ch] = frame.getUnsigned(2);
                    }

                    if (audblk.lfeon) {
                        audblk.lfeexpstr = frame.getUnsigned(1);
                    }

                    audblk.chbwcod = new Array(bsi.nfchans);
                    for (let ch = 0; ch < bsi.nfchans; ch++) {
                        if (audblk.chexpstr[ch] !== 0x0) {
                            if (!audblk.chincpl[ch]) {
                                audblk.chbwcod[ch] = frame.getUnsigned(6);
                            }
                        }
                    }
                }

                // Exponents for the coupling channel
                if (audblk.cplinu) {
                    audblk.cplstrtmant = (audblk.cplbegf * 12) + 37;
                    audblk.cplendmant = ((audblk.cplendf + 3) * 12) + 37;

                    if (audblk.cplexpstr !== 0x0) {
                        switch (audblk.cplexpstr) {
                            case 0b01:
                                audblk.ncplgrps = ((audblk.cplendmant - audblk.cplstrtmant) / 3) >> 0;
                                break;
                            case 0b10:
                                audblk.ncplgrps = ((audblk.cplendmant - audblk.cplstrtmant) / 6) >> 0;
                                break;
                            case 0b11:
                                audblk.ncplgrps = ((audblk.cplendmant - audblk.cplstrtmant) / 12) >> 0;
                                break;
                        }

                        audblk.cplabsexp = frame.getUnsigned(4);
                        audblk.cplexps = new Array(audblk.ncplgrps);
                        for (let grp = 0; grp < audblk.ncplgrps; grp++) {
                            audblk.cplexps[grp] = frame.getUnsigned(7);
                        }
                    }
                }

                // Exponents for full bandwidth channels
                audblk.endmant = new Array(bsi.nfchans);
                audblk.nchgrps = new Array(bsi.nfchans);
                audblk.exps = new Array(bsi.nfchans);
                audblk.gainrng = new Array(bsi.nfchans);
                for (let ch = 0; ch < bsi.nfchans; ch++) {
                    if (audblk.chexpstr[ch] !== 0x0) {
                        audblk.endmant[ch] = ((audblk.chbwcod[ch] + 12) * 3) + 37;

                        switch (audblk.cplexpstr) {
                            case 0b01:
                                audblk.nchgrps[ch] = ((audblk.endmant[ch] - 1) / 3) >> 0;
                                break;
                            case 0b10:
                                audblk.nchgrps[ch] = ((audblk.endmant[ch] + 2) / 6) >> 0;
                                break;
                            case 0b11:
                                audblk.nchgrps[ch] = ((audblk.endmant[ch] + 8) / 12) >> 0;
                                break;
                        }

                        audblk.exps[ch] = new Array(1 + audblk.nchgrps[ch]);
                        audblk.exps[ch][0] = frame.getUnsigned(4);

                        for (let grp = 1; grp <= audblk.nchgrps[ch]; grp++) {
                            audblk.exps[ch][grp] = frame.getUnsigned(7);
                        }

                        audblk.gainrng[ch] = frame.getUnsigned(2);
                    }
                }

                // Exponents for the low frequency effects channel
                if (audblk.lfeon) {
                    if (audblk.lfeexpstr !== 0) {
                        audblk.nlfegrps = 2;
                        audblk.lfeexps = new Array(1 + audblk.nlfegrps);
                        audblk.lfeexps[0] = frame.getUnsigned(4);
                        audblk.lfeexps[1] = frame.getUnsigned(7);
                        audblk.lfeexps[2] = frame.getUnsigned(7);
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

                    if (audblk.lfeon) {
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

                    audblk.deltbae = new Array(bsi.nfchans);
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

                    audblk.deltbae = new Array(bsi.nfchans);
                    audblk.deltoffst = new Array(bsi.nfchans);
                    audblk.deltlen = new Array(bsi.nfchans);
                    audblk.deltba = new Array(bsi.nfchans);
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
                }

                // Dummy data
                if (frame.getUnsigned(1) !== 0) {
                    frame.skip(frame.getUnsigned(9));
                }

                // Quantized mantissa values
                // TODO

                console.log(blk, audblk);
            }

            // Auxiliary Data
            // TODO

            // Error Detection Code
            // TODO

            global.test = global.test || 0;
            if (++test === 3) {
                throw new Error('Test stop');
            }
        }
    });

    frameStream.on('end', () => {
        console.log('Frames', frames);
        console.log('Frame stream ended');
    });
};

export default handleFrameStream;
