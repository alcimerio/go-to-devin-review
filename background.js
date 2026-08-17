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

function logRuntimeError(context) {
  if (chrome.runtime.lastError) {
    console.error(`${LOG_PREFIX} ${context}: ${chrome.runtime.lastError.message}`);
    return true;
  }

  return false;
}

function updateAction(tabId, url) {
  if (tabId === undefined) return;

  if (isGitHubPullRequest(url)) {
    chrome.action.enable(tabId);
    return;
  }

  chrome.action.disable(tabId);
}

function initializeActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (logRuntimeError("tabs.query failed")) return;

    const [tab] = tabs;
    if (tab?.id !== undefined) {
      updateAction(tab.id, tab.url);
    }
  });
}

// Run on every background load, including Firefox's Reload button.
initializeActiveTab();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url ?? tab.url;
  updateAction(tabId, url);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (logRuntimeError("tabs.get failed")) return;
    updateAction(tabId, tab.url);
  });
});

chrome.action.onClicked.addListener((tab) => {
  const clickStartedAt = performance.now();
  console.debug(`${LOG_PREFIX} action click received`);

  if (!tab.url) return;

  const match = tab.url.match(GITHUB_PR_PATTERN);
  if (!match) return;

  const storageStartedAt = performance.now();
  chrome.storage.local.get(REVIEW_BASE_URL_KEY, (stored) => {
    if (logRuntimeError("storage.local.get failed")) return;

    console.debug(`${LOG_PREFIX} storage.local.get completed in ${elapsedMs(storageStartedAt)}`);

    const reviewBaseUrl = normalizeReviewBaseUrl(stored[REVIEW_BASE_URL_KEY]);
    if (!reviewBaseUrl) {
      console.debug(`${LOG_PREFIX} opening options page after ${elapsedMs(clickStartedAt)}`);
      chrome.runtime.openOptionsPage();
      return;
    }

    const [, owner, repo, pullNumber] = match;
    const targetUrl = `${reviewBaseUrl}/${owner}/${repo}/pull/${pullNumber}`;
    const createStartedAt = performance.now();

    console.debug(`${LOG_PREFIX} tabs.create called after ${elapsedMs(clickStartedAt)}`);
    chrome.tabs.create({ url: targetUrl }, () => {
      if (logRuntimeError("tabs.create failed")) return;

      console.debug(
        `${LOG_PREFIX} tabs.create resolved in ${elapsedMs(createStartedAt)} (${elapsedMs(clickStartedAt)} total)`,
      );
    });
  });
});
