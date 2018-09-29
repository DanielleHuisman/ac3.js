import fs from 'fs';
import path from 'path';
import AV from 'av';
import through2 from 'through2';

import {AC3Demuxer, AC3Decoder} from '../src';

const INPUT_FILE = path.join(__dirname, '..', 'tests', 'test1.ac3');
const OUTPUT_FILE = path.join(__dirname, 'test1_aurora.bin');

// Register demuxer and decoder
AV.Demuxer.register(AC3Demuxer);
AV.Decoder.register('ac3', AC3Decoder);

// Initialize player
const player = AV.Player.fromFile(INPUT_FILE);

player.on('format', (format) => console.log('format', format));
player.on('duration', (duration) => console.log('duration', duration));
// player.on('progress', (progress) => console.log('progress', progress));
player.on('ready', () => console.log('ready'));
player.on('end', () => console.log('end'));
player.on('error', (error) => console.error(error));

player.play();

// Initialize output stream
const outputStream = fs.createWriteStream(OUTPUT_FILE);
const objectStream = through2.obj();
objectStream.pipe(outputStream);

outputStream.on('end', () => {
    console.log('written');
});

// Initialize asset
const asset = AV.Asset.fromFile(INPUT_FILE);

// TODO: fix the conversion from float32 to uint8
asset.on('data', (buffer) => {
    const sampleBytes = new Uint8Array(buffer.length * 2);
    for (let i = 0; i < buffer.length / 2; i++) {
        let sample = buffer[i] * Math.pow(2, 16);
        sampleBytes[i * 4] = sample & 0xff;
        sampleBytes[i * 4 + 1] = sample >> 8;

        sample = buffer[i + buffer.length / 2] * Math.pow(2, 16);
        sampleBytes[i * 4 + 2] = sample & 0xff;
        sampleBytes[i * 4 + 3] = sample >> 8;
    }

    objectStream.push(sampleBytes);
});

asset.start();
