const GITHUB_PR_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/;
const GITHUB_PR_MATCH_PATTERN = "https://github.com/*/*/pull/*";
const REVIEW_BASE_URL_KEY = "reviewBaseUrl";

const openCurrentButton = document.querySelector("#open-current");
const openAllButton = document.querySelector("#open-all");
const settingsButton = document.querySelector("#settings");
const status = document.querySelector("#status");

const firefoxApi = typeof browser !== "undefined" ? browser : null;

function chromeCall(fn, context, ...args) {
  return new Promise((resolve, reject) => {
    fn.call(context, ...args, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(result);
    });
  });
}

function storageGet(key) {
  if (firefoxApi) return firefoxApi.storage.local.get(key);
  return chromeCall(chrome.storage.local.get, chrome.storage.local, key);
}

function queryTabs(queryInfo) {
  if (firefoxApi) return firefoxApi.tabs.query(queryInfo);
  return chromeCall(chrome.tabs.query, chrome.tabs, queryInfo);
}

function createTab(createProperties) {
  if (firefoxApi) return firefoxApi.tabs.create(createProperties);
  return chromeCall(chrome.tabs.create, chrome.tabs, createProperties);
}

function groupTabs(groupOptions) {
  if (firefoxApi) return firefoxApi.tabs.group(groupOptions);
  return chromeCall(chrome.tabs.group, chrome.tabs, groupOptions);
}

function updateTabGroup(groupId, updateProperties) {
  if (firefoxApi) return firefoxApi.tabGroups.update(groupId, updateProperties);
  return chromeCall(chrome.tabGroups.update, chrome.tabGroups, groupId, updateProperties);
}

function openOptionsPage() {
  if (firefoxApi) return firefoxApi.runtime.openOptionsPage();
  return chromeCall(chrome.runtime.openOptionsPage, chrome.runtime);
}

function parseGitHubPullRequest(url) {
  if (typeof url !== "string") return null;

  const match = url.match(GITHUB_PR_PATTERN);
  if (!match) return null;

  const [, owner, repo, pullNumber] = match;
  return { owner, repo, pullNumber };
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
  const stored = await storageGet(REVIEW_BASE_URL_KEY);
  return normalizeReviewBaseUrl(stored[REVIEW_BASE_URL_KEY]);
}

function buildReviewUrl(reviewBaseUrl, pullRequest) {
  return `${reviewBaseUrl}/${pullRequest.owner}/${pullRequest.repo}/pull/${pullRequest.pullNumber}`;
}

function setBusy(busy) {
  openCurrentButton.disabled = busy;
  openAllButton.disabled = busy;
  settingsButton.disabled = busy;
}

async function requireReviewBaseUrl() {
  const reviewBaseUrl = await getReviewBaseUrl();
  if (reviewBaseUrl) return reviewBaseUrl;

  await openOptionsPage();
  window.close();
  return null;
}

openCurrentButton.addEventListener("click", async () => {
  setBusy(true);
  status.textContent = "Opening…";

  try {
    const reviewBaseUrl = await requireReviewBaseUrl();
    if (!reviewBaseUrl) return;

    const [tab] = await queryTabs({ active: true, currentWindow: true });
    const pullRequest = parseGitHubPullRequest(tab?.url);
    if (!tab || !pullRequest) {
      status.textContent = "Current tab is not a GitHub PR.";
      return;
    }

    await createTab({
      url: buildReviewUrl(reviewBaseUrl, pullRequest),
      windowId: tab.windowId,
      index: tab.index + 1,
      active: true,
    });

    window.close();
  } catch (error) {
    console.error(error);
    status.textContent = "Could not open review.";
    setBusy(false);
  }
});

openAllButton.addEventListener("click", async () => {
  setBusy(true);
  status.textContent = "Finding PRs…";

  try {
    const reviewBaseUrl = await requireReviewBaseUrl();
    if (!reviewBaseUrl) return;

    const tabs = await queryTabs({ url: GITHUB_PR_MATCH_PATTERN });
    const pullRequestTabs = tabs
      .map((tab) => ({ tab, pullRequest: parseGitHubPullRequest(tab.url) }))
      .filter(({ tab, pullRequest }) => tab.id !== undefined && pullRequest)
      .sort((left, right) => {
        if (left.tab.windowId !== right.tab.windowId) {
          return left.tab.windowId - right.tab.windowId;
        }

        return right.tab.index - left.tab.index;
      });

    if (pullRequestTabs.length === 0) {
      status.textContent = "No GitHub PR tabs found.";
      setBusy(false);
      return;
    }

    const groupingAvailable = Boolean(
      (firefoxApi?.tabs.group && firefoxApi?.tabGroups?.update) ||
        (!firefoxApi && chrome.tabs.group && chrome.tabGroups?.update),
    );

    let grouped = 0;
    let opened = 0;

    for (const { tab, pullRequest } of pullRequestTabs) {
      const reviewTab = await createTab({
        url: buildReviewUrl(reviewBaseUrl, pullRequest),
        windowId: tab.windowId,
        index: tab.index + 1,
        active: false,
      });

      opened += 1;

      if (!groupingAvailable || reviewTab.id === undefined) continue;

      try {
        const groupId = await groupTabs({
          tabIds: [tab.id, reviewTab.id],
          createProperties: { windowId: tab.windowId },
        });

        await updateTabGroup(groupId, {
          title: `${pullRequest.repo} #${pullRequest.pullNumber}`,
          collapsed: false,
        });

        grouped += 1;
      } catch (error) {
        console.error("Could not group PR tabs", error);
      }
    }

    if (!groupingAvailable) {
      status.textContent = `Opened ${opened}; grouping unavailable.`;
    } else if (grouped === opened) {
      status.textContent = `Opened ${opened} review${opened === 1 ? "" : "s"} in ${grouped} group${grouped === 1 ? "" : "s"}.`;
    } else {
      status.textContent = `Opened ${opened}; grouped ${grouped}.`;
    }
  } catch (error) {
    console.error(error);
    status.textContent = "Could not open all reviews.";
  } finally {
    setBusy(false);
  }
});

settingsButton.addEventListener("click", async () => {
  await openOptionsPage();
  window.close();
});
