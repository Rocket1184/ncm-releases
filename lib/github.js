'use strict';

import fetch from 'node-fetch';

const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
    console.error('Invalid GITHUB_TOKEN');
    process.exit(1);
}

const ApiUrl = 'https://api.github.com';
const Repo = process.env.GITHUB_REPO || 'Rocket1184/electron-netease-cloud-music';

/**
 * @param {number} since
 * @param {number} until
 * @returns {Promise<Gh.ReposListCommitsResponse>}
 */
export function getCommits(since, until = Date.now()) {
    const search = new URLSearchParams();
    search.append('since', new Date(since).toISOString())
    search.append('until', new Date(until).toISOString())
    return fetch(`${ApiUrl}/repos/${Repo}/commits?${search.toString()}`, {
        headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `token ${TOKEN}`
        }
    }).then(response => response.json());
}
