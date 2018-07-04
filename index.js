'use strict';

const qs = require('querystring');

const pug = require('pug');
const koa = require('koa');
const route = require('koa-route');
const serve = require('koa-static');
const qiniu = require('qiniu');
const axios = require('axios');

const _ = {
    groupBy: require('lodash.groupby')
};

const mac = new qiniu.auth.digest.Mac(process.env.QINIU_ACCESS_KEY, process.env.QINIU_SECRET_KEY);
const config = new qiniu.conf.Config();
config.useHttpsDomain = true;
config.zone = qiniu.zone.Zone_z0;
const bucketManager = new qiniu.rs.BucketManager(mac, config);

const renderIndex = pug.compileFile('./static/index.pug');

function formatSize(val) {
    for (const unit of ['', 'K', 'M']) {
        if (val < 1000) return `${val.toFixed(1)} ${unit}B`;
        val /= 1024;
    }
    return `${val.toFixed(1)} GB`;
}

function formatDate(timestamp) {
    const dt = new Date(timestamp / 10000);
    return dt.toLocaleDateString('zh', {
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getCommits(since, until = new Date().toISOString()) {
    return axios({
        url: `https://api.github.com/repos/Rocket1184/electron-netease-cloud-music/commits?${qs.stringify({ since, until })}`,
        headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `token ${process.env.GITHUB_TOKEN}`
        }
    }).then(response => response.data);
}

async function addChangeLog(releases) {
    await Promise.all(releases.map(async (value, index) => {
        if (index + 1 < releases.length) {
            // it's not the oldest build
            value.commits = await getCommits(releases[index + 1].timestamp, value.timestamp);
        } else {
            // it's the oldest build
            value.commits = await getCommits(new Date(0).toISOString(), value.timestamp);
            if (value.commits.length > 9) {
                value.commits = value.commits.slice(0, 9);
                value.commits.push({ commit: { message: 'and more ...' } });
            }
        }
    }));
}

function listPrefix(prefix = 'electron-netease-cloud-music') {
    const options = {
        limit: 1024,
        prefix: '',
    };
    return new Promise((resolve, reject) => {
        bucketManager.listPrefix(prefix, options, (err, respBody, respInfo) => {
            if (!err && respInfo.statusCode === 200) {
                resolve(respBody.items);
            } else {
                reject(err);
            }
        });
    });
}

function groupReleasesByCommit(items) {
    return _.groupBy(items, item => {
        const regxp = /[-_]([a-z0-9]{7})\./;
        const hash = regxp.exec(item.key);
        return hash[1] || 'unknown';
    });
}

function groupPackageByPlatform(pkgs) {
    const result = {};
    for (const pkg of pkgs) {
        const parsed = {
            size: formatSize(pkg.fsize),
            time: formatDate(pkg.putTime),
            url: `http://ncm.qn.rocka.cn/${pkg.key}`
        };
        if (pkg.key.endsWith('.asar')) {
            result['asar'] = parsed;
        } else if (pkg.key.endsWith('.tar.gz')) {
            if (pkg.key.includes('linux-x64')) {
                result['linux-x64'] = parsed;
            } else if (pkg.key.includes('darwin-x64')) {
                result['darwin-x64'] = parsed;
            }
        }
    }
    return result;
}

async function getFiles() {
    const result = [];
    const versions = groupReleasesByCommit(await listPrefix());
    for (const hash in versions) {
        result.push({
            hash,
            timestamp: versions[hash][0].putTime,
            pkgs: groupPackageByPlatform(versions[hash])
        });
    }
    result.sort((a, b) => b.timestamp - a.timestamp);
    result.forEach(r => r.timestamp = new Date(r.timestamp / 10000).toISOString());
    return result;
}

let avaliableBuilds = {
    data: [
        {
            hash: 'Load failed',
            timestamp: new Date().toISOString(),
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
                    hash: 'unknown_hash',
                    size: -1,
                    time: formatDate(Date.now()),
                    url: 'javascript:location.reload();'
                }
            }
        }
    ]
};

function countPkg(input) {
    return input.reduce((prev, cur) => Object.keys(cur.pkgs).length + prev, 0);
}

async function refreshAvaliableBuilds() {
    try {
        const files = await getFiles();
        const cnt = countPkg(files);
        // due to GitHub API [rate-limiting](https://developer.github.com/v3/#rate-limiting)
        // we can only request 60 times per hour.
        // so do not refresh change log when avaliable builds have no changes
        if (cnt === countPkg(avaliableBuilds.data)) return;
        console.log(`countPkg(getFiles()); // ${cnt}`);
        await addChangeLog(files);
        console.log('addChangeLog();');
        avaliableBuilds = { data: files };
    } catch (e) {
        console.error(`refreshAvaliableBuilds(); // ${e}`);
        return refreshAvaliableBuilds();
    }
}

(async function entryPoint() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        await refreshAvaliableBuilds();
        await new Promise(_ => setTimeout(() => _(), 8 * 1000));
    }
})();

async function indexHandler(ctx) {
    ctx.body = renderIndex(avaliableBuilds);
}

const app = new koa();

app.use(route.get('/', indexHandler));

app.use(serve('./static'));

const port = process.env.PORT || 11233;
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
