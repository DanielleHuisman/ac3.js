import {BAP_1, BAP_2, BAP_3, BAP_4, BAP_5} from './tables';

const DITHER_CONST = Math.sqrt(2);

export class MantissaReader {
    constructor(stream) {
        this.stream = stream;
        this.bap_1_ptr = 3;
        this.bap_2_ptr = 3;
        this.bap_4_ptr = 2;
    }

    get(bap) {
        switch (bap) {
            case 0:
                return 0;
            case 1:
                if (this.bap_1_ptr > 2) {
                    this.bap_1 = BAP_1[this.stream.read(5)];
                    this.bap_1_ptr = 0;
                }
                return this.bap_1[this.bap_1_ptr++];
            case 2:
                if (this.bap_2_ptr > 2) {
                    this.bap_2 = BAP_2[this.stream.read(7)];
                    this.bap_2_ptr = 0;
                }
                return this.bap_2[this.bap_2_ptr++];
            case 3:
                return BAP_3[this.stream.read(3)];
            case 4:
                if (this.bap_4_ptr > 1) {
                    this.bap_4 = BAP_4[this.stream.read(7)];
                    this.bap_4_ptr = 0;
                }
                return this.bap_4[this.bap_4_ptr++];
            case 5:
                return BAP_5[this.stream.read(4)];
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
            case 11:
            case 12:
            case 13:
                return this.stream.read(bap - 1, true) / Math.pow(2, bap - 2);
            case 14:
                return this.stream.read(14, true) / Math.pow(2, 13);
            case 15:
                return this.stream.read(16, true) / Math.pow(2, 15);
            default:
                // eslint-disable-next-line no-debugger
                debugger;
        }
    }
}

export const getDitherMantissa = () => (Math.random() - 0.5) * DITHER_CONST;
