const GITHUB_PR_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/;

function isGitHubPullRequest(url) {
  return typeof url === "string" && GITHUB_PR_PATTERN.test(url);
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
    if (chrome.runtime.lastError) return;

    const [tab] = tabs;
    if (tab?.id !== undefined) {
      updateAction(tab.id, tab.url);
    }
  });
}

initializeActiveTab();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url ?? tab.url;
  updateAction(tabId, url);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    updateAction(tabId, tab.url);
  });
});
