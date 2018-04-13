import jDataView from 'jdataview';
import through from 'through2';

const BIT_RATES = [32,  40,  48,  56,  64,  80,  96, 112, 128, 160, 192, 224, 256, 320, 384, 448, 512, 576, 640];

const handleReadStream = (inputStream) => {
    // Create output stream
    const outputStream = through.obj();

    let frameSize = 0;

    inputStream.on('readable', () => {
        if (!frameSize) {
            console.log('Stream started');

            // Read syncinfo
            const frameHeader = inputStream.read(5);
            const bitStream = new jDataView(frameHeader);

            // Validate syncword
            const syncword = bitStream.getUint16();
            if (syncword != 0x0b77) {
                throw new Error(`Invalid syncword ${syncword.toString(16)}`);
            }

            // Validate CRC
            const crc = bitStream.getUint16();
            // TODO: validate CRC

            const sampleRateCode = bitStream.getUnsigned(2);
            const frameSizeCode = bitStream.getUnsigned(6);

            // Determine bit rate (in kbps) and frame size (in 16-bit words)
            let bitRate = BIT_RATES[frameSizeCode >> 1];
            switch(sampleRateCode) {
                case 0b00:
                    frameSize = 2 * bitRate;
                    break;
                case 0b01:
                    frameSize = ((320 * bitRate) / 147 + (frameSizeCode & 1)) >> 0;
                    break;
                case 0b10:
                    frameSize = 3 * bitRate;
                    break;
                default:
                    throw new Error(`Unknown sample rate code ${sampleRateCode.toString(2)}`);
            }

            // Convert from word size to byte size
            frameSize *= 2;

            console.log('Bit rate', bitRate, 'kbps', 'Frame size', frameSize, 'bytes');

            // Read remaining frame
            const frame = inputStream.read(frameSize - 5);

            // Merge frame header and actual frame
            outputStream.push(new jDataView(Buffer.concat([frameHeader, frame])));
        }

        // Read frames
        let chunk = null;
        while ((chunk = inputStream.read(frameSize)) !== null) {
            const bitStream = new jDataView(chunk);

            outputStream.push(bitStream);
        }
    });

    inputStream.on('end', () => {
        outputStream.end();

        console.log('Stream ended');
    });

    return outputStream;
};

export default handleReadStream;
