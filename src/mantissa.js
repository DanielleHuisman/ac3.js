import { BAP_1, BAP_2, BAP_4, BAP_5 } from "./tables";

export const MantissaReader = function(frame) {
    this.bap_1 = [];
    this.bap_2 = [];
    this.bap_4 = [];

    this.get = function(bap) {
        switch (bap) {
            case 0:
                return 0;
            case 1:
                if (this.bap_1 === []) {
                    this.bap_1 = BAP_1[frame.getUnsigned(5)];
                }
                return this.bap_1.shift();
            case 2:
                if (this.bap_2 === []) {
                    this.bap_2 = BAP_2[frame.getUnsigned(7)];
                }
                return this.bap_2.shift();
            case 3:
                return frame.getUnsigned(3);
            case 4:
                if (this.bap_4 === []) {
                    this.bap_4 = BAP_4[frame.getUnsigned(7)];
                }
                return this.bap_4.shift();
            case 5:
                return BAP_5[frame.getUnsigned(4)];
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
            case 11:
            case 12:
            case 13:
                return frame.getUnsigned(bap - 1) / Math.pow(2, bap - 1);
            case 14:
                return frame.getUnsigned(14) / Math.pow(2, 14);
            case 15:
                return frame.getUnsigned(16) / Math.pow(2, 16);
        }
    }
}