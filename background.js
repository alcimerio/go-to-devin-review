const GITHUB_PR_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/;
const REVIEW_BASE_URL_KEY = "reviewBaseUrl";

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

async function initializeActionState() {
  await chrome.action.disable();

  const tabs = await chrome.tabs.query({ url: "https://github.com/*" });
  await Promise.all(tabs.map((tab) => updateAction(tab.id, tab.url)));
}

void initializeActionState();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url ?? tab.url;
  void updateAction(tabId, url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await updateAction(tabId, tab.url);
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url) return;

  const match = tab.url.match(GITHUB_PR_PATTERN);
  if (!match) return;

  const reviewBaseUrl = await getReviewBaseUrl();
  if (!reviewBaseUrl) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  const [, owner, repo, pullNumber] = match;
  const targetUrl = `${reviewBaseUrl}/${owner}/${repo}/pull/${pullNumber}`;

  await chrome.tabs.create({ url: targetUrl });
});
