import { Client } from 'minio';

import { panic } from './util.js';

/**
 * @typedef {import('minio').BucketItem} BucketItem
 */

const EP = process.env.S3_ENDPOINT;
const BK = process.env.S3_BUCKET;
const AK = process.env.S3_ACCESS_KEY;
const SK = process.env.S3_SECRET_KEY;

if (!EP) panic('S3_ENDPOINT not set');
if (!BK) panic('S3_BUCKET not set');
if (!AK) panic('S3_ACCESS_KEY not set');
if (!SK) panic('S3_SECRET_KEY not set');

const client = new Client({
    endPoint: EP,
    useSSL: true,
    accessKey: AK,
    secretKey: SK,
});

/**
 * @returns {Promise<BucketItem[]>}
 */
export function listBucketFiles() {
    const s = client.listObjects(BK, '', true);
    /** @type {BucketItem[]} */
    const files = [];
    return new Promise((resolve, reject) => {
        s.on('data', item => files.push(item));
        s.on('end', () => resolve(files));
        s.on('error', reject);
    });
}
