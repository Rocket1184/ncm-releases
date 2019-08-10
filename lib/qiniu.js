'use strict';

const qiniu = require('qiniu');

const mac = new qiniu.auth.digest.Mac(process.env.QINIU_ACCESS_KEY, process.env.QINIU_SECRET_KEY);
const config = new qiniu.conf.Config({
    useHttpsDomain: true,
    zone: qiniu.zone.Zone_z0
});
const bucketManager = new qiniu.rs.BucketManager(mac, config);
const bucketName = 'electron-netease-cloud-music';

/**
 * @returns {Promise<Qn.File[]>}
 */
function listBucketFiles() {
    const options = { limit: 1024, prefix: '' };
    return new Promise((resolve, reject) => {
        bucketManager.listPrefix(bucketName, options, (err, respBody, respInfo) => {
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
function deleteBucketFiles(filename) {
    return new Promise((resolve, reject) => {
        bucketManager.delete(bucketName, filename, (err, respBody, respInfo) => {
            if (!err && respInfo.statusCode === 200) {
                resolve(respBody.items);
            } else {
                reject(err);
            }
        })
    });
}

module.exports = {
    listBucketFiles,
    deleteBucketFiles
};
