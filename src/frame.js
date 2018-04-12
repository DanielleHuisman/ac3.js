import through from 'through2';

const handleFrameStream = (frameStream) => {
    let frames = 0;

    frameStream.on('readable', () => {
        let frame = null;
        while ((frame = frameStream.read()) !== null) {
            frames++;

            // Validate syncword
            const syncword = frame.readInt16();
            if (syncword != 0x770b) {
                throw new Error(`Invalid syncword ${syncword.toString(16)}`);
            }

            // Validate CRC
            const crc = frame.readInt16();
            // TODO: validate CRC
        }
    });

    frameStream.on('end', () => {
        console.log('Frames', frames);
        console.log('Frame stream ended');
    });
};

export default handleFrameStream;
