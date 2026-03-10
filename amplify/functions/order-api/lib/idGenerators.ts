import crypto from 'node:crypto';

export function generateOrderId(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(2).toString('hex');
    return `ord-${date}-${rand}`;
}

export function generateContactId(): string {
    return `ct-${crypto.randomBytes(3).toString('hex')}`;
}

export function generateDocId(): string {
    return `doc-${crypto.randomBytes(3).toString('hex')}`;
}
