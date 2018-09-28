import fs from 'fs';
import path from 'path';

import {AC3Deframer, AC3FrameParser} from '../src';

const INPUT_FILE = path.join(__dirname, '..', 'tests', 'test1.ac3');
const OUTPUT_FILE = path.join(__dirname, 'test.bin');

const inputStream = fs.createReadStream(INPUT_FILE);
const outputStream = fs.createWriteStream(OUTPUT_FILE);

const deframer = AC3Deframer();
const parser = AC3FrameParser();

console.log('Decoding AC3 file...');
inputStream.pipe(deframer).pipe(parser).pipe(outputStream);

outputStream.on('close', () => {
    console.log('Finished');
});
