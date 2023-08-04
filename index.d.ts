// from `@octokit/rest`
type ReposListCommitsResponseItemParentsItem = { url: string; sha: string };
type ReposListCommitsResponseItemCommitter = {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    site_admin: boolean;
};
type ReposListCommitsResponseItemAuthor = {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    site_admin: boolean;
};
type ReposListCommitsResponseItemCommitVerification = {
    verified: boolean;
    reason: string;
    signature: null;
    payload: null;
};
type ReposListCommitsResponseItemCommitTree = { url: string; sha: string };
type ReposListCommitsResponseItemCommitCommitter = {
    name: string;
    email: string;
    date: string;
};
type ReposListCommitsResponseItemCommitAuthor = {
    name: string;
    email: string;
    date: string;
};
type ReposListCommitsResponseItemCommit = {
    url: string;
    author: ReposListCommitsResponseItemCommitAuthor;
    committer: ReposListCommitsResponseItemCommitCommitter;
    message: string;
    tree: ReposListCommitsResponseItemCommitTree;
    comment_count: number;
    verification: ReposListCommitsResponseItemCommitVerification;
};
type ReposListCommitsResponseItem = {
    url: string;
    sha: string;
    node_id: string;
    html_url: string;
    comments_url: string;
    commit: ReposListCommitsResponseItemCommit;
    author: ReposListCommitsResponseItemAuthor;
    committer: ReposListCommitsResponseItemCommitter;
    parents: Array<ReposListCommitsResponseItemParentsItem>;
};

namespace Gh {
    type ReposListCommit = ReposListCommitsResponseItem;
    type ReposListCommitsResponse = Array<ReposListCommitsResponseItem>;
}

namespace Ncm {
    interface Pkg {
        name: string;
        size: string;
        url: string;
    }
    interface Commit {
        sha?: string;
        commit: {
            message: string;
        }
    }
    interface Build {
        version: string;
        sha: string;
        timestamp: number;
        commits?: Commit[];
        pkgs: {
            [key: string]: Pkg
        };
    }
}

expors as namespace;