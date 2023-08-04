import fetch from 'node-fetch';
import { panic } from './util.js';

const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) panic('GITHUB_TOKEN not set');

const ApiUrl = 'https://api.github.com';
const Repo = process.env.GITHUB_REPO || 'Rocket1184/electron-netease-cloud-music';

/**
 * @param {string} sha
 * @param {number} pageSize
 * @returns {Promise<Gh.ReposListCommitsResponse>}
 */
export function listRepoCommits(sha, pageSize = 100) {
    const search = new URLSearchParams();
    search.append('sha', sha);
    search.append('per_page', pageSize.toString());
    // @ts-ignore
    return fetch(`${ApiUrl}/repos/${Repo}/commits?${search.toString()}`, {
        headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `token ${TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28'
        }
    }).then(response => response.json());
}
