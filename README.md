# AC3.js

JavaScript AC-3 (ATSC A/52) decoder for the [Aurora.js](https://github.com/audiocogs/aurora.js) audio framework.

## Installation
```bash
yarn add ac3.js
```

## Usage
### Simple
```javascript
import fs from 'fs';
import {AC3SimpleDecoder} from 'ac3.js';

// This example loads an AC-3 audio file and writes the PCM data to file.
// The output file is in PCM signed 16-bit interleaved format.

// Initialize input and output stream
const inputStream = fs.createReadStream('example.ac3');
const outputStream = fs.createWriteStream('example.pcm');

// Initialize simple decoder
const simpleDecoder = new AC3SimpleDecoder(inputStream);

// Write PCM data to output stream (data is an Uint8Array)
simpleDecoder.on('data', (data) => {
    outputStream.write(data);
});
```

### Aurora.js
```javascript
import AV from 'av';
import {AC3Demuxer, AC3Decoder} from 'ac3.js';

// This example loads an AC-3 audio file and plays it.
// - In Node.js this should play the audio using the speaker module.
// - In the browser this should play the audio using the Web Audio API.

// Register demuxer and decoder
AV.Demuxer.register(AC3Demuxer);
AV.Decoder.register('ac3', AC3Decoder);

// Initialize player
const player = AV.Player.fromURL('https://example.org/example.ac3');

player.on('format', (format) => console.log('format', format));
player.on('duration', (duration) => console.log('duration', duration));
player.on('progress', (progress) => console.log('progress', progress));
player.on('ready', () => console.log('ready'));
player.on('end', () => console.log('end'));
player.on('error', (error) => console.error(error));

// Start the player
player.play();
```

For detailed information on how to use Aurora.js, check out the [documentation](https://github.com/audiocogs/aurora.js/wiki).

## Authors
- [Daniel Huisman](https://github.com/DanielHuisman)
- [Karl Koscher](https://github.com/supersat)

## License
AC3.js is available under the terms of the MIT license.

## Progress
### Syntax implementation
- [x] `syncframe`
    - [x] `syncinfo`
    - [x] `bsi`
    - [x] `audblk`
    - [x] `auxdata`
    - [x] `errorcheck`

### Decoding implementation
- [x] Input Bit Stream
- [x] Synchronization
- [ ] Error Detection
- [x] Unpack BSI
- [x] Unpack Side Information
- [x] Decode Exponents
- [x] Bit Allocation
- [x] Process Mantissas
- [x] Decoupling
- [x] Rematrixing
- [x] Inverse Transform
- [x] Window, Overlap/Add
- [x] Downmixing
- [x] PCM Output Buffer
- [x] Output PCM

### Roadmap
- Support all downmixing modes
- Support Enhanced AC-3 (E-AC-3)
- Error detection
- Unit tests
