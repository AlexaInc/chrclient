export async function generateNonceAndHash() {
    const randomValues = new Uint8Array(16);
    window.crypto.getRandomValues(randomValues);
    const nonce = Array.from(randomValues)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(nonce);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashValue = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return { nonce, hashValue };
}

export async function dataHash(nonce: string = '', data: any) {
    const datacb = String(data) + nonce;

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(datacb);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashValue = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return  hashValue ;
}