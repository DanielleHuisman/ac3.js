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
const y128 = fft128.createComplexArray();
const x256 = new Array(N);

const Z64A = fft64.createComplexArray();
const Z64B = fft64.createComplexArray();
const z64a = fft64.createComplexArray();
const z64b = fft64.createComplexArray();
const y64a = fft64.createComplexArray();
const y64b = fft64.createComplexArray();

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
    this.delaySamples = new Array(N/2);
    this.delaySamples.fill(0);

    this.process256 = (coeffs, outputSamples, outputOffset) => {
        for (let k = 0; k < N/4; k++) {
            Z128[k * 2] = (coeffs[N/2 - 2 * k - 1] * xcos1[k]) - (coeffs[2 * k] * xsin1[k]);
            Z128[k * 2 + 1] = (coeffs[2 * k] * xcos1[k]) + (coeffs[N/2 - 2 * k - 1] * xsin1[k]);
        }
        fft128.inverseTransform(z128, Z128);
        for (let n = 0; n < N/4; n++) {
            y128[n * 2] = (z128[n * 2] * xcos1[n]) - (z128[n * 2 + 1] * xsin1[n]);
            y128[n * 2 + 1] = (z128[n * 2 + 1] * xcos1[n]) + (z128[n * 2] * xsin1[n]);          
        }
        for (let n = 0; n < N/8; n++) {
            x256[2*n] = -y128[2 * (N/8+n) + 1] * WINDOW[2*n];
            x256[2*n+1] = y128[2 * (N/8-n-1)] * WINDOW[2*n+1];
            x256[N/4+2*n] = -y128[2 * n] * WINDOW[N/4+2*n];
            x256[N/4+2*n+1] = y128[2 * (N/4-n-1) + 1] * WINDOW[N/4+2*n+1];
            x256[N/2+2*n] = -y128[2 * (N/8+n)] * WINDOW[N/2-2*n-1];
            x256[N/2+2*n+1] = y128[2 * (N/8-n-1) + 1] * WINDOW[N/2-2*n-2];
            x256[3*N/4+2*n] = y128[2 * n + 1] * WINDOW[N/4-2*n-1];
            x256[3*N/4+2*n+1] = -y128[2 * (N/4-n-1)] * WINDOW[N/4-2*n-2];
        }
        for (let n = 0; n < N/2; n++) {
            let outputSample = 128 * 65535 * (x256[n] + this.delaySamples[n]);
            if (outputSample < -32767)
                outputSample = -32767;
            else if (outputSample > 32767)
                outputSample = 32767;
            outputSamples[n + outputOffset] = outputSample;
            this.delaySamples[n] = x256[N/2 + n];
        }
    }

    this.process128 = (coeffs, outputSamples, outputOffset) => {
        for (let k = 0; k < N/8; k++) {
            Z64A[k * 2] = (coeffs[2 * (N/4-2*k-1)] * xcos2[k]) - (coeffs[4 * k] * xsin2[k]);
            Z64A[k * 2 + 1] = (coeffs[4 * k] * xcos2[k]) + (coeffs[2 * (N/4-2*k-1)] * xsin2[k]);
            Z64B[k * 2] = (coeffs[2 * (N/4-2*k-1 + 1)] * xcos2[k]) - (coeffs[4 * k + 2] * xsin2[k]);
            Z64B[k * 2 + 1] = (coeffs[4 * k + 2] * xcos2[k]) + (coeffs[2 * (N/4-2*k-1 + 1)] * xsin2[k]);
        }
        fft64.inverseTransform(z64A, Z64a);
        fft64.inverseTransform(z64B, Z64b);
        for (let n = 0; n < N/8; n++) {
            y64a[n * 2] = (z64a[n * 2] * xcos2[n]) - (z64a[n * 2 + 1] * xsin2[n]);
            y64a[n * 2 + 1] = (z64a[n * 2 + 1] * xcos2[n]) + (z64a[n * 2] * xsin2[n]);
            y64b[n * 2] = (z64b[n * 2] * xcos2[n]) - (z64b[n * 2 + 1] * xsin2[n]);
            y64b[n * 2 + 1] = (z64b[n * 2 + 1] * xcos2[n]) + (z64b[n * 2] * xsin2[n]);
        }
        for (let n = 0; n < N/8; n++) {
            x256[2*n] = -y64a[2 * n + 1] * WINDOW[2*n];
            x256[2*n+1] = y64a[2 * (N/8-n-1)] * WINDOW[2*n+1];
            x256[N/4+2*n] = -y64a[2 * n] * WINDOW[N/4+2*n];
            x256[N/4+2*n+1] = y64a[2 * (N/8-n-1) + 1] * WINDOW[N/4+2*n+1];
            x256[N/2+2*n] = -y64b[2 * n] * WINDOW[N/2-2*n-1];
            x256[N/2+2*n+1] = y64b[2 * (N/8-n-1) + 1] * WINDOW[N/2-2*n-2];
            x256[3*N/4+2*n] = y64b[2 * n + 1] * WINDOW[N/4-2*n-1];
            x256[3*N/4+2*n+1] = -y64b[2 * (N/-n-1)] * WINDOW[N/4-2*n-2];
        }
        for (let n = 0; n < N/2; n++) {
            let outputSample = 64 * 65535 * (x256[n] + this.delaySamples[n]);
            if (outputSample < -32767)
                outputSample = -32767;
            else if (outputSample > 32767)
                outputSample = 32767;
            outputSamples[n + outputOffset] = outputSample;
            this.delaySamples[n] = x256[N/2 + n];
        }
    }
}