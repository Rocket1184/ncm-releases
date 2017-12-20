'use strict';

const qs = require('querystring');

const pug = require('pug');
const koa = require('koa');
const route = require('koa-route');
const serve = require('koa-static');
const qiniu = require('qiniu');
const fetch = require('node-fetch');

const mac = new qiniu.auth.digest.Mac(process.env.QINIU_ACCESS_KEY, process.env.QINIU_SECRET_KEY);
const config = new qiniu.conf.Config();
config.useHttpsDomain = true;
config.zone = qiniu.zone.Zone_z0;
const bucketManager = new qiniu.rs.BucketManager(mac, config);

const renderIndex = pug.compileFile('./static/index.pug');

function formatSize(val) {
    for (const unit of ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z']) {
        if (val < 1000) return `${val.toFixed(1)} ${unit}B`;
        val /= 1024;
    }
    return `${val.toFixed(1)} YB`;
}

function formatDate(timestamp) {
    const dt = new Date(timestamp / 10000);
    return dt.toLocaleDateString('en', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getCommits(since, until = new Date().toISOString()) {
    let url = 'https://api.github.com/repos/Rocket1184/electron-netease-cloud-music/commits';
    let query = {};
    if (since) query.since = since;
    if (until) query.until = until;
    url += `?${qs.stringify(query)}`;
    return fetch(url).then(r => r.json());
}

async function addChangeLog(files) {
    await Promise.all(files.map(async (value, index) => {
        let previous = files[index + 1];
        if (previous) {
            value.commits = await getCommits(files[index + 1].timestamp, value.timestamp);
        } else {
            value.commits = await getCommits('', value.timestamp);
        }
    }));
}

function getFiles() {
    const options = {
        limit: 20,
        prefix: '',
    };
    return new Promise((res, rej) => {
        bucketManager.listPrefix('electron-netease-cloud-music', options, (err, respBody, respInfo) => {
            if (!err && respInfo.statusCode === 200) {
                respBody.items.sort((a, b) => b.putTime - a.putTime);
                const result = [];
                respBody.items.forEach(item => {
                    const hashReg = /-([a-z0-9]{7}).tar.gz/g;
                    const typeReg = /([a-z0-9]+-[a-z0-9]+)/g;
                    const parsed = {
                        name: item.key.replace('electron-ncm-', ''),
                        hash: hashReg.exec(item.key)[1] || 'unknown_hash',
                        size: formatSize(item.fsize),
                        time: formatDate(item.putTime),
                        url: `http://ncm.qn.rocka.cn/${item.key}`
                    };
                    const type = typeReg.exec(parsed.name)[1] || 'Unknown OS';
                    const lastResult = result[result.length - 1] || {};
                    if (lastResult.hash && lastResult.hash === parsed.hash) {
                        lastResult.pkgs[type] = parsed;
                    } else {
                        result.push({
                            hash: parsed.hash,
                            timestamp: new Date(item.putTime / 10000).toISOString(),
                            pkgs: { [type]: parsed }
                        });
                    }
                });
                res(result);
            } else {
                rej(err);
            }
        });
    });
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
        console.log('getFiles:', files);
        // due to GitHub API [rate-limiting](https://developer.github.com/v3/#rate-limiting)
        // we can only request 60 times per hour.
        // so do not refresh change log when avaliable builds have no changes
        if (countPkg(files) === countPkg(avaliableBuilds.data)) return;
        await addChangeLog(files);
        console.log('addChangeLog:', files);
        avaliableBuilds = { data: files };
    } catch (err) {
        console.log('Error when refreshBinaryData:', err);
        return refreshAvaliableBuilds();
    }
}

refreshAvaliableBuilds();
setInterval(refreshAvaliableBuilds, 8 * 1000);

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
