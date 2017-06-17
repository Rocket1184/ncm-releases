'use strict';

const pug = require('pug');
const koa = require('koa');
const route = require('koa-route');
const qiniu = require('qiniu');

qiniu.conf.ACCESS_KEY = process.env.QINIU_ACCESS_KEY;
qiniu.conf.SECRET_KEY = process.env.QINIU_SECRET_KEY;

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
    return new Promise((res, rej) => {
        qiniu.rsf.listPrefix(`electron-netease-cloud-music${suffix}`, '', '', 100, '', (err, ret) => {
            if (!err) {
                ret.items.sort((a, b) => b.putTime - a.putTime);
                const list = ret.items.map(i => ({
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
    })
}

let binaryData = {};
async function refreshBinaryData() {
    try {
        const [master, dev] = await Promise.all([getFiles(), getFiles('-dev')]);
        binaryData = { data: { master, dev } };
    } catch (err) {
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

app.listen(process.env.PORT || 11233);
