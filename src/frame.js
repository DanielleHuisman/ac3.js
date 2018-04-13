import through from 'through2';

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

            const bsid = frame.getUnsigned(5);
            const bsmod = frame.getUnsigned(3);

            if (bsid !== 0x8) {
                throw new Error(`Invalid bsid ${bsid.toString(2)}`);
            }
        }
    });

    frameStream.on('end', () => {
        console.log('Frames', frames);
        console.log('Frame stream ended');
    });
};

export default handleFrameStream;
