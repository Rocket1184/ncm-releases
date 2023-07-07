// @ts-check
'use strict';

import pug from 'pug';
import koa from 'koa';
import route from 'koa-route';
import serve from 'koa-static';
import groupBy from 'lodash.groupby'

import { getCommits } from './lib/github.js';
import { listBucketFiles } from './lib/qiniu.js';

/**
 * @param {number} val
 */
function formatSize(val) {
    for (const unit of ['', 'K', 'M']) {
        if (val < 1000) return `${val.toFixed(1)} ${unit}B`;
        val /= 1024;
    }
    return `${val.toFixed(1)} GB`;
}

/**
 * @param {Ncm.Build[]} releases
 */
async function addChangeLog(releases) {
    await Promise.all(releases.map(async (value, index) => {
        if (index + 1 < releases.length) {
            // it's not the oldest build
            value.commits = await getCommits(releases[index + 1].timestamp, value.timestamp);
        } else {
            // it's the oldest build
            value.commits = await getCommits(0, value.timestamp);
            if (value.commits.length > 9) {
                value.commits = value.commits.slice(0, 9);
                value.commits.push({ commit: { message: 'and more ...' } });
            }
        }
    }));
}

/**
 * @param {Qn.File[]} items
 * @returns {{[key: string]: Qn.File[]}}
 */
function groupFilesByVersion(items) {
    return groupBy(items, item => {
        const regxp = /_(v\w+\.\w+\.\w+-\d+-g[0-9a-f]+)/;
        const version = regxp.exec(item.key)[1];
        return version || 'unknown';
    });
}

/**
 * @param {Qn.File[]} files
 * @returns {{[key: string]: Ncm.Pkg}}
 */
function groupPackageByPlatform(files) {
    let result = {};
    for (const file of files) {
        /** @type {Ncm.Pkg} */
        const parsed = {
            name: file.key,
            size: formatSize(file.fsize),
            url: `http://ncm.qn.rocka.cn/${file.key}`
        };
        if (file.key.endsWith('.asar')) {
            result['asar'] = parsed;
        } else if (file.key.endsWith('.tar.gz')) {
            if (file.key.includes('linux')) {
                result['linux'] = parsed;
            } else if (file.key.includes('darwin')) {
                result['darwin'] = parsed;
            }
        }
    }
    // @ts-ignore
    return result;
}

/**
 * @returns {Promise<Ncm.Build[]>}
 */
async function getFiles() {
    const result = [];
    const files = await listBucketFiles();
    const groups = groupFilesByVersion(files);
    for (const [version, files] of Object.entries(groups)) {
        result.push({
            hash: version,
            timestamp: Math.trunc(files[0].putTime / 10000),
            pkgs: groupPackageByPlatform(files)
        });
    }
    result.sort((a, b) => b.timestamp - a.timestamp);
    return result;
}

/**
 * @type {{data: Ncm.Build[]}}
 */
let avaliableBuilds = {
    data: [
        {
            hash: 'Load failed',
            timestamp: Date.now(),
            commits: [
                {
                    sha: 'xxxxxxx',
                    commit: {
                        message: 'Please refresh page and try again ...'
                    }
                }
            ],
            pkgs: {
                'Refresh': {
                    name: 'not_avaliable',
                    size: 'not_avaliable',
                    url: 'javascript:location.reload();'
                }
            }
        }
    ]
};

/**
 * @param {Ncm.Build[]} input
 */
function countPkg(input) {
    return input.reduce((prev, cur) => Object.keys(cur.pkgs).length + prev, 0);
}

async function refreshAvaliableBuilds() {
    try {
        const releases = await getFiles();
        const cnt = countPkg(releases);
        // due to GitHub API [rate-limiting](https://developer.github.com/v3/#rate-limiting)
        // we can only request 60 times per hour.
        // so do not refresh change log when avaliable builds have no changes
        if (cnt === countPkg(avaliableBuilds.data)) return;
        console.log(`countPkg(getFiles()); // ${cnt}`);
        await addChangeLog(releases);
        console.log('addChangeLog();');
        avaliableBuilds = { data: releases };
    } catch (e) {
        console.error('refreshAvaliableBuilds() failed:');
        console.error(e);
    }
}

(async function loop() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        await refreshAvaliableBuilds();
        await new Promise(_ => setTimeout(() => _(), 8 * 1000));
    }
})();

const app = new koa();

app.use(route.get('/', ctx => {
    ctx.body = pug.renderFile('./static/index.pug', avaliableBuilds)
}));

app.use(serve('./static'));

const port = process.env.PORT || 11233;
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
