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
                for (let i = 0; i < bsi.nfchans; i++) {
                    audblk.blksw[i] = frame.getUnsigned(1);
                }
                audblk.dithflag = new Array(bsi.nfchans);
                for (let i = 0; i < bsi.nfchans; i++) {
                    audblk.dithflag[i] = frame.getUnsigned(1);
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
                    if (frame.getUnsigned(1) !== 0) {
                        audblk.chincpl = new Array(bsi.nfchans);
                        for (let i = 0; i < bsi.nfchans; i++) {
                            audblk.chincpl[i] = frame.getUnsigned(1);
                        }

                        if (bsi.acmod === 0x2) {
                            audblk.phsflginu = frame.getUnsigned(1);
                        }

                        audblk.cplbegf = frame.getUnsigned(4);
                        audblk.cplendf = frame.getUnsigned(4);

                        audblk.cplbndstrc = new Array(3 + audblk.cplbegf - audblk.cplendf);
                        for (let i = 0; i < audblk.cplbndstrc.length; i++) {
                            audblk.cplbndstrc[i] = frame.getUnsigned(1);
                        }
                    }
                }

                // Coupling coordinates and phase flags
                // TODO

                // Rematrixing operation in the 2/0 mode
                // TODO

                // Exponent strategy
                // TODO

                // Exponents
                // TODO

                // Parametric information
                // TODO

                // Allocation information
                // TODO

                // Dummy data
                // TODO

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
