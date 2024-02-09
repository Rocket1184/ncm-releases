import pug from 'pug';
import koa from 'koa';
import route from 'koa-route';
import serve from 'koa-static';
import groupBy from 'lodash/groupBy.js'
import semver from 'semver';

import { listRepoCommits } from './lib/github.js';
import { listBucketFiles } from './lib/s3.js';

/**
 * @typedef {import('minio').BucketItem} BucketItem
 */

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const S3_PUBLIC_DOMAIN = process.env.S3_PUBLIC_DOMAIN || 'encm-artifacts.rocka.me';

const SizeUnit = ['B', 'KiB', 'MiB', 'GiB']

/**
 * @param {number} val
 */
function formatSize(val) {
    let i = 0;
    while (val > 1000 && i < SizeUnit.length - 1) {
        val /= 1024;
        i++;
    }
    return `${val.toFixed(2)} ${SizeUnit[i]}`
}

/**
 * @param {Ncm.Build[]} releases
 */
async function addChangeLog(releases) {
    /** @type {Gh.ReposListCommit[]} */
    const commits = [];
    /** @type {(sha: string) => Promise<number>} */
    const findCommitIndex = async (sha) => {
        let i = -1;
        while (i = commits.findIndex(c => c.sha.startsWith(sha)), i < 0) {
            const earliestSha = commits.at(-1)?.sha ?? 'master';
            const earlierCommits = await listRepoCommits(earliestSha);
            if (earlierCommits.length === 1) return -1;
            commits.pop();
            commits.push(...earlierCommits);
        }
        return i;
    }
    for (let i = 0; i < releases.length; i++) {
        const current = releases[i];
        const previous = releases[i + 1];
        const startIndex = await findCommitIndex(current.sha);
        if (startIndex < 0) continue;
        let stopIndex = commits.length - 1;
        if (previous) {
            stopIndex = await findCommitIndex(previous.sha);
        }
        if (stopIndex - startIndex > 9) {
            stopIndex = startIndex + 9;
        }
        current.commits = commits.slice(startIndex, stopIndex);
    }
    if (!commits[0].sha.startsWith(releases[0].sha)) {
        let i = await findCommitIndex(releases[0].sha)
        if (i > 0) {
            releases.splice(0, 0, {
                version: 'Comming Soon™',
                sha: 'xxxxxxx',
                timestamp: Date.now(),
                commits: commits.slice(0, i),
                pkgs: {}
            });
        }
    }
}

/**
 * @param {BucketItem[]} files
 * @returns {{[key: string]: Ncm.Pkg}}
 */
function pkgByPlatform(files) {
    let result = {};
    for (const file of files) {
        /** @type {Ncm.Pkg} */
        const parsed = {
            name: file.name,
            size: formatSize(file.size),
            url: `//${S3_PUBLIC_DOMAIN}/${file.name}`
        };
        if (file.name.endsWith('.asar')) {
            result['asar'] = parsed;
        } else if (file.name.endsWith('.tar.gz')) {
            if (file.name.includes('linux')) {
                result['linux'] = parsed;
            } else if (file.name.includes('darwin')) {
                result['darwin'] = parsed;
            }
        }
    }
    // @ts-ignore
    return result;
}

const VersionRegex = /v(?<tag>\d+\.\d+\.\d+)-(?<distance>\d+)-g(?<sha>[0-9a-f]+)/;

/**
 * sort `0.1.2-3-g456789a` descending
 * @param {string} a
 * @param {string} b
 */
function versionCompare(a, b) {
    const va = VersionRegex.exec(a);
    const vb = VersionRegex.exec(b);
    let r = semver.rcompare(va.groups['tag'], vb.groups['tag']);
    if (r !== 0) return r;
    const la = Number.parseInt(va.groups['distance'], 10);
    const lb = Number.parseInt(vb.groups['distance'], 10);
    return lb - la;
}

const CommitShaRegex = /-g([0-9a-f]{7,})$/;

/**
 * @returns {Promise<Ncm.Build[]>}
 */
async function getFiles() {
    const result = [];
    const files = await listBucketFiles();
    const groups = groupBy(files, item => VersionRegex.exec(item.name)[0] ?? 'unknown');
    for (const [version, files] of Object.entries(groups)) {
        const sha = CommitShaRegex.exec(version)[1];
        result.push({
            version,
            sha,
            timestamp: Math.trunc(files[0].lastModified.getTime()),
            pkgs: pkgByPlatform(files)
        });
    }
    result.sort((a, b) => versionCompare(a.version, b.version));
    return result;
}

/**
 * @type {{data: Ncm.Build[]}}
 */
const avaliableBuilds = {
    data: [
        {
            version: 'Load failed',
            sha: 'xxxxxxx',
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
                    url: '/'
                }
            }
        }
    ]
};

async function refreshAvaliableBuilds() {
    try {
        const releases = await getFiles();
        await addChangeLog(releases);
        avaliableBuilds.data = releases;
        console.log(`refreshAvaliableBuilds(); // ${releases.length} versions`);
    } catch (e) {
        console.error('refreshAvaliableBuilds() failed:');
        console.error(e);
    }
}

refreshAvaliableBuilds();

const app = new koa();

app.use(route.get('/', ctx => {
    ctx.body = pug.renderFile('./static/index.pug', avaliableBuilds)
}));

app.use(serve('./static'));

if (typeof WEBHOOK_SECRET === 'string') {
    console.log('Webhook enabled');
    app.use(route.get('/webhook/:secret', async (ctx, secret) => {
        if (secret === WEBHOOK_SECRET) {
            console.log('Webhook received, refreshing builds...');
            refreshAvaliableBuilds();
            ctx.body = 'success';
        } else {
            console.log('Received invalid webhook request: ', ctx.path);
        }
    }));
} else {
    console.log('WEBHOOK_SECRET not set, not enabling webhook');
    (async function loop() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            await refreshAvaliableBuilds();
            await new Promise(_ => setTimeout(() => _(), 60 * 1000));
        }
    })();
}

const host = process.env.HOST || '127.0.0.1';
const port = process.env.PORT || 11233;
app.listen({ host, port }, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
