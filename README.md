# a52.js

JavaScript ATSC A/52 (AC-3) decoder

## Syntax implementation
- [x] `syncframe`
    - [x] `syncinfo`
    - [x] `bsi`
    - [x] `audblk`
    - [x] `auxdata`
    - [x] `errorcheck`

## Decoding implementation
- [ ] Input Bit Stream
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
- [/] Downmixing
- [ ] PCM Output Buffer
- [ ] Output PCM
