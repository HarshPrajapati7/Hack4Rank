export interface GitHubProfileContext {
  username: string;
  summary: string;
}

interface GitHubUserResponse {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  followers: number;
  following: number;
  public_repos: number;
  public_gists: number;
  created_at: string;
  updated_at: string;
}

interface GitHubRepoResponse {
  name: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  fork: boolean;
}

const githubProfileCache = new Map<string, Promise<GitHubProfileContext | null>>();

function compactDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return 'unknown';
  }

  const value = new Date(isoDate);
  if (Number.isNaN(value.getTime())) {
    return 'unknown';
  }

  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

function extractGitHubUsername(input: string | undefined): string | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const normalizedUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(normalizedUrl);

    if (!/github\.com$/i.test(url.hostname)) {
      return null;
    }

    const [username] = url.pathname.split('/').filter(Boolean);
    return username ? username.replace(/^@/, '') : null;
  } catch {
    const directUsername = trimmed.replace(/^@/, '').match(/^[a-z\d](?:[a-z\d-]{0,38})$/i);
    return directUsername ? directUsername[0] : null;
  }
}

function summarizeRepos(repos: GitHubRepoResponse[]): string {
  if (!repos.length) {
    return 'No public repositories were returned by GitHub.';
  }

  const nonForkRepos = repos.filter((repo) => !repo.fork);
  const repoPool = nonForkRepos.length ? nonForkRepos : repos;
  const recentCutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
  const recentlyActive = repoPool.filter((repo) => {
    const pushedAt = new Date(repo.pushed_at).getTime();
    return Number.isFinite(pushedAt) && pushedAt >= recentCutoff;
  }).length;

  const languageCounts = new Map<string, number>();
  for (const repo of repoPool) {
    if (repo.language) {
      languageCounts.set(repo.language, (languageCounts.get(repo.language) || 0) + 1);
    }
  }

  const topLanguages = Array.from(languageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([language, count]) => `${language} (${count})`)
    .join(', ');

  const topRepos = [...repoPool]
    .sort((a, b) => {
      const scoreA = a.stargazers_count * 2 + a.forks_count;
      const scoreB = b.stargazers_count * 2 + b.forks_count;
      return scoreB - scoreA;
    })
    .slice(0, 3)
    .map((repo) => {
      const stats = [];
      if (repo.stargazers_count > 0) {
        stats.push(`${repo.stargazers_count}★`);
      }
      if (repo.language) {
        stats.push(repo.language);
      }
      return `${repo.name}${stats.length ? ` [${stats.join(', ')}]` : ''}`;
    })
    .join('; ');

  const repoParts: string[] = [
    `Recent active repos (last 6 months): ${recentlyActive}/${repoPool.length}`,
  ];

  if (topLanguages) {
    repoParts.push(`Top languages: ${topLanguages}`);
  }

  if (topRepos) {
    repoParts.push(`Notable repos: ${topRepos}`);
  }

  return repoParts.join('. ');
}

async function loadGitHubProfileContext(username: string): Promise<GitHubProfileContext | null> {
  const headers = {
    Accept: 'application/vnd.github+json',
  };

  const profileResponse = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers });
  if (profileResponse.status === 404) {
    return null;
  }

  if (!profileResponse.ok) {
    throw new Error(`GitHub profile lookup failed for ${username} (HTTP ${profileResponse.status}).`);
  }

  const profile = (await profileResponse.json()) as GitHubUserResponse;
  const remainingRequests = Number(profileResponse.headers.get('x-ratelimit-remaining') || '0');
  let repoSummary = 'Repository details unavailable.';

  if (remainingRequests > 5) {
    const reposResponse = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=20&sort=updated`,
      { headers }
    );

    if (reposResponse.ok) {
      const repos = (await reposResponse.json()) as GitHubRepoResponse[];
      repoSummary = summarizeRepos(repos);
    } else if (reposResponse.status === 403 || reposResponse.status === 429) {
      repoSummary = 'Repository details skipped due to GitHub rate limiting.';
    }
  } else {
    repoSummary = 'Repository details skipped because GitHub rate limit is low.';
  }

  const profileFacts = [
    `GitHub username: ${profile.login}`,
    profile.name ? `Display name: ${profile.name}` : '',
    profile.bio ? `Bio: ${profile.bio}` : '',
    `Followers: ${profile.followers}`,
    `Following: ${profile.following}`,
    `Public repos: ${profile.public_repos}`,
    `Public gists: ${profile.public_gists}`,
    profile.company ? `Company: ${profile.company}` : '',
    profile.location ? `Location: ${profile.location}` : '',
    profile.blog ? `Website: ${profile.blog}` : '',
    `Account age: since ${compactDate(profile.created_at)}`,
    `Last profile update: ${compactDate(profile.updated_at)}`,
    repoSummary,
  ].filter(Boolean);

  return {
    username: profile.login,
    summary: profileFacts.join('. '),
  };
}

export async function fetchGitHubProfileContext(input: string | undefined): Promise<GitHubProfileContext | null> {
  const username = extractGitHubUsername(input);
  if (!username) {
    return null;
  }

  const cacheKey = username.toLowerCase();
  if (!githubProfileCache.has(cacheKey)) {
    githubProfileCache.set(cacheKey, loadGitHubProfileContext(username));
  }

  return githubProfileCache.get(cacheKey)!;
}
