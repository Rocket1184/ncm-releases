'use strict';

const pug = require('pug');
const koa = require('koa');
const route = require('koa-route');
const qiniu = require('qiniu');

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

function formatDate(timespan) {
    const to2Digit = num => num < 10 ? `0${num}` : num;
    const dt = new Date(timespan / 10000);
    const M = parseInt(dt.getMonth()) + 1;
    const D = dt.getDate();
    const h = dt.getHours();
    const m = dt.getMinutes();
    return `${to2Digit(M)}-${to2Digit(D)} ${to2Digit(h)}:${to2Digit(m)}`;
}

function getFiles(suffix = '') {
    const options = {
        limit: 20,
        prefix: '',
    };
    return new Promise((res, rej) => {
        bucketManager.listPrefix(`electron-netease-cloud-music${suffix}`, options, (err, respBody, respInfo) => {
            if (!err && respInfo.statusCode === 200) {
                respBody.items.sort((a, b) => b.putTime - a.putTime);
                const list = respBody.items.map(i => ({
                    name: i.key.replace('electron-ncm-', ''),
                    size: formatSize(i.fsize),
                    time: formatDate(i.putTime),
                    url: `http://ncm${suffix}.rocka.cn/${i.key}`
                }));
                res(list);
            } else {
                rej(err);
            }
        });
    });
}

let binaryData = {
    data: {
        Info: [
            {
                name: 'Please refresh page and try again...',
                size: '∑(￣□￣;)',
                time: formatDate(Date.now()),
                url: 'javascript:window.location.reload()'
            }
        ]
    }
};

async function refreshBinaryData() {
    try {
        // const [master, dev] = await Promise.all([getFiles(), getFiles('-dev')]);
        // binaryData = { data: { master, dev } };
        const [master] = await Promise.all([getFiles()]);
        binaryData = { data: { master } };
    } catch (err) {
        console.log(`Error when refreshBinaryData: ${JSON.stringify(err, null, 4)}`);
        return refreshBinaryData();
    }
};

refreshBinaryData();
setInterval(refreshBinaryData, 8 * 1000);

async function indexHandler(ctx, next) {
    ctx.body = renderIndex(binaryData);
}

const app = new koa();

app.use(route.get('/', indexHandler));

const port = process.env.PORT || 11233;
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
