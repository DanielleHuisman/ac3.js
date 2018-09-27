import {BAP_1, BAP_2, BAP_3, BAP_4, BAP_5} from './tables';

const DITHER_CONST = Math.sqrt(2);

export class MantissaReader {
    constructor(frame) {
        this.frame = frame;
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
                    this.bap_1 = BAP_1[this.frame.getUnsigned(5)];
                    this.bap_1_ptr = 0;
                }
                return this.bap_1[this.bap_1_ptr++];
            case 2:
                if (this.bap_2_ptr > 2) {
                    this.bap_2 = BAP_2[this.frame.getUnsigned(7)];
                    this.bap_2_ptr = 0;
                }
                return this.bap_2[this.bap_2_ptr++];
            case 3:
                return BAP_3[this.frame.getUnsigned(3)];
            case 4:
                if (this.bap_4_ptr > 1) {
                    this.bap_4 = BAP_4[this.frame.getUnsigned(7)];
                    this.bap_4_ptr = 0;
                }
                return this.bap_4[this.bap_4_ptr++];
            case 5:
                return BAP_5[this.frame.getUnsigned(4)];
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
            case 11:
            case 12:
            case 13:
                return this.frame.getSigned(bap - 1) / Math.pow(2, bap - 2);
            case 14:
                return this.frame.getSigned(14) / Math.pow(2, 13);
            case 15:
                return this.frame.getSigned(16) / Math.pow(2, 15);
            default:
                debugger;
        }
    }
};

export const getDitherMantissa = () => (Math.random() - 0.5) * DITHER_CONST;
