import path from 'path';
import AV from 'av';

import {AC3Demuxer, AC3Decoder} from '../src';

const INPUT_FILE = path.join(__dirname, '..', 'tests', 'test1.ac3');

// Register demuxer and decoder
AV.Demuxer.register(AC3Demuxer);
AV.Decoder.register('ac3', AC3Decoder);

// Initialize player
const player = AV.Player.fromFile(INPUT_FILE);

player.on('format', (format) => console.log('format', format));
player.on('duration', (duration) => console.log('duration', duration));
player.on('ready', () => console.log('ready'));
player.on('end', () => console.log('end'));
player.on('error', (error) => console.error(error));

// player.play();
player.preload();
