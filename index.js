'use strict';

const pug = require('pug');
const koa = require('koa');
const route = require('koa-route');
const qiniu = require('qiniu');

qiniu.conf.ACCESS_KEY = process.env.QINIU_ACCESS_KEY;
qiniu.conf.SECRET_KEY = process.env.QINIU_SECRET_KEY;

const compiledFunction = pug.compileFile('./static/index.pug');

function formatSize(val) {
    let i;
    const unit = ['', 'K', 'M', 'G', 'T'];
    for (i = 0; i < unit.length; i++) {
        if (val < 1000) break;
        else val /= 1024;
    }
    return `${val.toFixed(1)} ${unit[i]}B`;
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
                console.log(ret);
                const list = ret.items.map(i => ({
                    name: i.key.replace(/electron-ncm-([^\.]+)/, '$1'),
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

async function renderIndex(ctx, next) {
    const { 0: master, 1: dev } = await Promise.all([getFiles(), getFiles('-dev')]);
    ctx.body = compiledFunction({ master, dev });
}

const app = new koa();

app.use(route.get('/', renderIndex));

app.listen(11233);
