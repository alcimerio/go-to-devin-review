const GITHUB_PR_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/;
const REVIEW_BASE_URL_KEY = "reviewBaseUrl";
const LOG_PREFIX = "[go-to-devin-review]";

function isGitHubPullRequest(url) {
  return typeof url === "string" && GITHUB_PR_PATTERN.test(url);
}

function normalizeReviewBaseUrl(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      return null;
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function elapsedMs(startedAt) {
  return `${(performance.now() - startedAt).toFixed(1)}ms`;
}

async function getReviewBaseUrl() {
  const stored = await chrome.storage.local.get(REVIEW_BASE_URL_KEY);
  return normalizeReviewBaseUrl(stored[REVIEW_BASE_URL_KEY]);
}

async function updateAction(tabId, url) {
  if (isGitHubPullRequest(url)) {
    await chrome.action.enable(tabId);
    return;
  }

  await chrome.action.disable(tabId);
}

async function initializeActiveTab() {
  await chrome.action.disable();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) {
    await updateAction(tab.id, tab.url);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void initializeActiveTab();
});

chrome.runtime.onStartup.addListener(() => {
  void initializeActiveTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url ?? tab.url;
  void updateAction(tabId, url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await updateAction(tabId, tab.url);
});

chrome.action.onClicked.addListener(async (tab) => {
  const clickStartedAt = performance.now();
  console.debug(`${LOG_PREFIX} action click received`);

  if (!tab.url) return;

  const match = tab.url.match(GITHUB_PR_PATTERN);
  if (!match) return;

  const storageStartedAt = performance.now();
  const reviewBaseUrl = await getReviewBaseUrl();
  console.debug(`${LOG_PREFIX} storage.local.get completed in ${elapsedMs(storageStartedAt)}`);

  if (!reviewBaseUrl) {
    console.debug(`${LOG_PREFIX} opening options page after ${elapsedMs(clickStartedAt)}`);
    await chrome.runtime.openOptionsPage();
    return;
  }

  const [, owner, repo, pullNumber] = match;
  const targetUrl = `${reviewBaseUrl}/${owner}/${repo}/pull/${pullNumber}`;

  const createStartedAt = performance.now();
  console.debug(`${LOG_PREFIX} tabs.create called after ${elapsedMs(clickStartedAt)}`);
  await chrome.tabs.create({ url: targetUrl });
  console.debug(
    `${LOG_PREFIX} tabs.create resolved in ${elapsedMs(createStartedAt)} (${elapsedMs(clickStartedAt)} total)`,
  );
});
