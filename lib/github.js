'use strict';

const qs = require('qs');

const fetch = require('node-fetch').default;

const ApiUrl = 'https://api.github.com';
const Repo = 'Rocket1184/electron-netease-cloud-music';

/**
 * @param {number} since
 * @param {number} until
 * @returns {Promise<Gh.ReposListCommitsResponse>}
 */
function getCommits(since, until = Date.now()) {
    const query = qs.stringify({
        since: new Date(since).toISOString(),
        until: new Date(until).toISOString()
    })
    return fetch(`${ApiUrl}/repos/${Repo}/commits?${query}`, {
        headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `token ${process.env.GITHUB_TOKEN}`
        }
    }).then(response => response.json());
}

module.exports = {
    getCommits
};
