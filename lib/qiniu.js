'use strict';

import qiniu from 'qiniu';

const AK = process.env.QINIU_AK;
const SK = process.env.QINIU_SK;

if (!AK || !SK) {
    console.error('Invalid QINIU_AK or QINIU_SK');
    process.exit(1);
}

const BucketName = process.env.QINIU_BUCKET;

if (!BucketName) {
    console.error('Invalid QINIU_BUCKET');
    process.exit(1);
}

const mac = new qiniu.auth.digest.Mac(AK, SK);
const config = new qiniu.conf.Config({
    useHttpsDomain: true,
    zone: qiniu.zone.Zone_z0
});
const bucketManager = new qiniu.rs.BucketManager(mac, config);

/**
 * @returns {Promise<Qn.File[]>}
 */
export function listBucketFiles() {
    const options = { limit: 1024, prefix: '' };
    return new Promise((resolve, reject) => {
        bucketManager.listPrefix(BucketName, options, (err, respBody, respInfo) => {
            if (!err && respInfo.statusCode === 200) {
                resolve(respBody.items);
            } else {
                reject(err);
            }
        });
    });
}

/**
 * @param {string} filename
 * @returns {Promise<Qn.File[]>}
 */
export function deleteBucketFiles(filename) {
    return new Promise((resolve, reject) => {
        bucketManager.delete(BucketName, filename, (err, respBody, respInfo) => {
            if (!err && respInfo.statusCode === 200) {
                resolve(respBody.items);
            } else {
                reject(err);
            }
        })
    });
}
