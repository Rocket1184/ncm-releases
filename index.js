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
    const to2Digit = num => num < 10 ? `0${num}` : num;
    const dt = new Date(timestamp / 10000);
    const M = parseInt(dt.getMonth()) + 1;
    const D = dt.getDate();
    const h = dt.getHours();
    const m = dt.getMinutes();
    return `${to2Digit(M)}-${to2Digit(D)} ${to2Digit(h)}:${to2Digit(m)}`;
}

function getCommits(since, until = new Date().toISOString()) {
    let url = `https://api.github.com/repos/Rocket1184/electron-netease-cloud-music/commits`;
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
        bucketManager.listPrefix(`electron-netease-cloud-music`, options, (err, respBody, respInfo) => {
            if (!err && respInfo.statusCode === 200) {
                respBody.items.sort((a, b) => b.putTime - a.putTime);
                const result = [];
                respBody.items.forEach(item => {
                    const hashReg = /-([a-z0-9]{7}).tar.gz/g;
                    const typeReg = /([a-z0-9]+\-[a-z0-9]+)/g;
                    const parsed = {
                        name: item.key.replace('electron-ncm-', ''),
                        hash: hashReg.exec(item.key)[1] || 'unknown_hash',
                        size: formatSize(item.fsize),
                        time: formatDate(item.putTime),
                        url: `http://ncm.rocka.cn/${item.key}`
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
            hash: 'unknown_hash',
            timestamp: new Date().toISOString(),
            commits: [
                {
                    sha: 'xxxxxxx',
                    commit: {
                        message: 'what\'s this?'
                    }
                }
            ],
            pkgs: {
                'Unknown OS': {
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

async function refreshAvaliableBuilds() {
    try {
        const files = await getFiles();
        await addChangeLog(files);
        avaliableBuilds = { data: files };
    } catch (err) {
        console.log('Error when refreshBinaryData:', err);
        return refreshAvaliableBuilds();
    }
};

refreshAvaliableBuilds();
setInterval(refreshAvaliableBuilds, 8 * 1000);

async function indexHandler(ctx, next) {
    ctx.body = renderIndex(avaliableBuilds);
}

const app = new koa();

app.use(route.get('/', indexHandler));

app.use(serve('./static'));

const port = process.env.PORT || 11233;
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
