import path from 'path';
import AV from 'av';

import {AC3Demuxer, AC3Decoder} from '../src';

const INPUT_FILE = path.join(__dirname, '..', 'tests', 'test1.ac3');

// Register demuxer
AV.Demuxer.register(AC3Demuxer);
AV.Decoder.register('ac3', AC3Decoder);

const player = AV.Player.fromFile(INPUT_FILE);

const print = (info) => {
    console.log(info);
};

player.on('format', print);
player.on('duration', print);
player.on('ready', () => print('ready'));
player.on('end', () => print('end'));
player.on('error', (err) => console.error(err));

// player.play();
player.preload();
