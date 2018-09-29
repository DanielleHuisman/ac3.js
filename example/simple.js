import fs from 'fs';
import path from 'path';

import {AC3SimpleDecoder} from '../src';

const INPUT_FILE = path.join(__dirname, '..', 'tests', 'test1.ac3');
const OUTPUT_FILE = path.join(__dirname, 'test1.pcm');

// Initialize input and output stream
const inputStream = fs.createReadStream(INPUT_FILE);
const outputStream = fs.createWriteStream(OUTPUT_FILE);

outputStream.on('end', () => {
    console.log('end');
});

// Initialize simple decoder
const simpleDecoder = new AC3SimpleDecoder(inputStream);

// Write PCM data to output stream (data is a Uint8Array)
simpleDecoder.on('data', (data) => {
    outputStream.push(data);
});
