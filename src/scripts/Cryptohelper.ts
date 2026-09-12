import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

export function generateNonceAndHash() {
    const randomBytes = Crypto.getRandomBytes(16);
    const nonce = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const hashValue = CryptoJS.SHA256(nonce).toString(CryptoJS.enc.Hex);

    return { nonce, hashValue };
}

export function dataHash(nonce: string = '', data: any) {
    const datacb = String(data) + nonce;
    const hashValue = CryptoJS.SHA256(datacb).toString(CryptoJS.enc.Hex);

    return hashValue;
}