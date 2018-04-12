import fs from 'fs';
import path from 'path';

import handleReadStream from './reader';
import handleFrameStream from './frame';

const TEST_FILE = path.join(__dirname, '..', 'tests', 'test2.ac3');

const inputStream = fs.createReadStream(TEST_FILE);

const frameStream = handleReadStream(inputStream);
const result = handleFrameStream(frameStream);
