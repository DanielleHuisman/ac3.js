import { WINDOW } from './tables';

const FFT = require('fft.js');
const N = 512;

const xcos1 = new Array(N/4);
const xsin1 = new Array(N/4);

const xcos2 = new Array(N/8);
const xsin2 = new Array(N/8);

const fft128 = new FFT(N/4);
const fft64 = new FFT(N/8);

const Z128 = fft128.createComplexArray();
const z128 = fft128.createComplexArray();
const y256 = new Array(N);
const x256 = new Array(N);

const Z64A = fft64.createComplexArray();
const Z64B = fft64.createComplexArray();
const z64a = fft64.createComplexArray();
const z64b = fft64.createComplexArray();
const y128a = new Array(N/2);
const y128b = new Array(N/2);
const x128 = new Array(N/2);

(function() {
    for (let i = 0; i < N/4; i++) {
        xcos1[i] = -Math.cos(2 * Math.PI * (8 * i + 1) / (8 * N));
        xsin1[i] = -Math.sin(2 * Math.PI * (8 * i + 1) / (8 * N));
    }
    for (let i = 0; i < N/8; i++) {
        xcos2[i] = -Math.cos(2 * Math.PI * (8 * i + 1) / (4 * N));
        xsin2[i] = -Math.sin(2 * Math.PI * (8 * i + 1) / (4 * N));
    }
})();

export const IMDCT = function() {
    this.outputSamples = new Array(N/2);
    this.delaySamples = new Array(N/2);
    this.outputSamples.fill(0);
    this.delaySamples.fill(0);

    this.process256 = (coeffs) => {
        for (let k = 0; k < N/4; k++) {
            Z128[k * 2] = (coeffs[N/2 - 2 * k - 1] * xcos1[k]) - (coeffs[2 * k] * xsin1[k]);
            Z128[k * 2 + 1] = (coeffs[2 * k] * xcos1[k]) + (coeffs[N/2 - 2 * k - 1] * xsin1[k]);
        }
        fft128.inverseTransform(Z128, z128);
        for (let n = 0; n < N/4; n++) {
            y256[n * 2] = (z128[n * 2] * xcos1[n]) - (z128[n * 2 + 1] * xsin1[n]);
            y256[n * 2 + 1] = (z128[n * 2 + 1] * xcos1[n]) + (z128[n * 2] * xsin1[n]);          
        }
        for (let n = 0; n < N/8; n++) {
            x256[2*n] = -y256[2 * (N/8+n) + 1] * WINDOW[2*n];
            x256[2*n+1] = y256[2 * (N/8-n-1)] * WINDOW[2*n+1];
            x256[N/4+2*n] = -y256[2 * n] * WINDOW[N/4+2*n];
            x256[N/4+2*n+1] = y256[2 * (N/4-n-1) + 1] * WINDOW[N/4+2*n+1];
            x256[N/2+2*n] = -y256[2 * (N/8+n)] * WINDOW[N/2-2*n-1];
            x256[N/2+2*n+1] = y256[2 * (N/8-n-1) + 1] * WINDOW[N/2-2*n-2];
            x256[3*N/4+2*n] = y256[2 * n + 1] * WINDOW[N/4-2*n-1];
            x256[3*N/4+2*n+1] = -y256[2 * (N/4-n-1)] * WINDOW[N/4-2*n-2];
        }
        for (let n = 0; n < N/2; n++) {
            this.outputSamples[n] = 2 * (x256[n] + this.delaySamples[n]);
            if (this.outputSamples[n] < -1.0)
                this.outputSamples[n] = -1.0;
            else if (this.outpueSamples[n] > 1.0)
                this.outpueSamples[n] = 1.0;
            this.delaySamples[n] = x256[N/2 + n];
        }
    }

    this.process128 = (coeffs) => {
        for (let k = 0; k < N/8; k++) {
            Z64A[k * 2] = (coeffs[2 * (N/4-2*k-1)] * xcos2[k]) - (coeffs[4 * k] * xsin2[k]);
            Z64A[k * 2 + 1] = (coeffs[4 * k] * xcos2[k]) + (coeffs[2 * (N/4-2*k-1)] * xsin2[k]);
            Z64B[k * 2] = (coeffs[2 * (N/4-2*k-1 + 1)] * xcos2[k]) - (coeffs[4 * k + 2] * xsin2[k]);
            Z64B[k * 2 + 1] = (coeffs[4 * k + 2] * xcos2[k]) + (coeffs[2 * (N/4-2*k-1 + 1)] * xsin2[k]);
        }
        fft64.inverseTransform(Z64A, z64a);
        fft64.inverseTransform(Z64B, z64b);
        for (let k = 0; k < N/8; k++) {
            
            y128a[n] = (zr1[n] * xcos2[n] - zi1[n] * xsin2[n]) + j * (zi1[n] * xcos2[n] + zr1[n] * xsin2[n]) ;

        }
        for (let n = 0; n < N/8; n++) {
            x256[2*n] = -y256[2 * (N/8+n) + 1] * WINDOW[2*n];
            x256[2*n+1] = y256[2 * (N/8-n-1)] * WINDOW[2*n+1];
            x256[N/4+2*n] = -y256[2 * n] * WINDOW[N/4+2*n];
            x256[N/4+2*n+1] = y256[2 * (N/4-n-1) + 1] * WINDOW[N/4+2*n+1];
            x256[N/2+2*n] = -y256[2 * (N/8+n)] * WINDOW[N/2-2*n-1];
            x256[N/2+2*n+1] = y256[2 * (N/8-n-1) + 1] * WINDOW[N/2-2*n-2];
            x256[3*N/4+2*n] = y256[2 * n + 1] * WINDOW[N/4-2*n-1];
            x256[3*N/4+2*n+1] = -y256[2 * (N/4-n-1)] * WINDOW[N/4-2*n-2];
        }
        for (let n = 0; n < N/2; n++) {
            this.outputSamples[n] = 2 * (x256[n] + this.delaySamples[n]);
            if (this.outputSamples[n] < -1.0)
                this.outputSamples[n] = -1.0;
            else if (this.outpueSamples[n] > 1.0)
                this.outpueSamples[n] = 1.0;
            this.delaySamples[n] = x256[N/2 + n];
        }
    }
}