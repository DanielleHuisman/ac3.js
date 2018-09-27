import jDataView from 'jdataview';
import through2 from 'through2';

const BIT_RATES = [32,  40,  48,  56,  64,  80,  96, 112, 128, 160, 192, 224, 256, 320, 384, 448, 512, 576, 640];

export const AC3Deframer = function() { 
    let frameSize;
    let frameHeader;
    let leftoverBytes = Buffer.from([]);

    return through2.obj(function (chunk, enc, callback) {
        let chunkPtr = 0;
        if (leftoverBytes.length) {
            chunk = Buffer.concat([leftoverBytes, chunk]);
        }
        while (chunk.length >= chunkPtr + 5) {
            const bitStream = new jDataView(chunk.slice(chunkPtr, chunkPtr + 5));

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

            //console.log('Bit rate', bitRate, 'kbps', 'Frame size', frameSize, 'bytes');

            if (chunk.length >= chunkPtr + frameSize) {
                this.push(new jDataView(chunk.slice(chunkPtr, chunkPtr + frameSize)));
                chunkPtr += frameSize;
            } else {
                break;
            }
        }
        debugger;
        leftoverBytes = chunk.slice(chunkPtr);
        callback();
    }
)};