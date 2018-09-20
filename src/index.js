import fs from 'fs';
import path from 'path';

import { AC3Deframer } from './reader';
import { AC3FrameParser } from './frame';

const TEST_FILE = path.join(__dirname, '..', 'tests', 'test1.ac3');

const inputStream = fs.createReadStream(TEST_FILE);
const outputStream = fs.createWriteStream('test.bin');

const deframer = AC3Deframer();
const parser = AC3FrameParser();
inputStream.pipe(deframer).pipe(parser).pipe(outputStream);