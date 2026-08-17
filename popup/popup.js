const GITHUB_PR_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/;
const REVIEW_BASE_URL_KEY = "reviewBaseUrl";
const TAB_GROUP_ID_NONE = -1;

const mainActions = document.querySelector("#main-actions");
const openCurrentButton = document.querySelector("#open-current");
const openAllButton = document.querySelector("#open-all");
const cleanupButton = document.querySelector("#cleanup-reviews");
const cleanupPanel = document.querySelector("#cleanup-panel");
const cleanupOrphans = document.querySelector("#cleanup-orphans");
const cleanupDuplicates = document.querySelector("#cleanup-duplicates");
const cleanupGroups = document.querySelector("#cleanup-groups");
const cleanupCancelButton = document.querySelector("#cleanup-cancel");
const cleanupConfirmButton = document.querySelector("#cleanup-confirm");
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

function moveTab(tabId, moveProperties) {
  if (firefoxApi) return firefoxApi.tabs.move(tabId, moveProperties);
  return chromeCall(chrome.tabs.move, chrome.tabs, tabId, moveProperties);
}

function removeTabs(tabIds) {
  if (tabIds.length === 0) return Promise.resolve();
  if (firefoxApi) return firefoxApi.tabs.remove(tabIds);
  return chromeCall(chrome.tabs.remove, chrome.tabs, tabIds);
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

function comparableUrl(value) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";

    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.origin}${pathname}`;
  } catch {
    return null;
  }
}

function reviewKeyFromUrl(reviewBaseUrl, value) {
  if (typeof value !== "string") return null;

  try {
    const base = new URL(reviewBaseUrl);
    const url = new URL(value);
    if (url.origin !== base.origin) return null;

    const basePath = base.pathname.replace(/\/+$/, "");
    const pathname = url.pathname.replace(/\/+$/, "");
    const prefix = `${basePath}/`;
    if (!pathname.startsWith(prefix)) return null;

    const suffix = pathname.slice(basePath.length);
    if (!/^\/[^/]+\/[^/]+\/pull\/\d+$/.test(suffix)) return null;

    url.search = "";
    url.hash = "";
    return comparableUrl(`${url.origin}${basePath}${suffix}`);
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

function isGrouped(tab) {
  return Number.isInteger(tab?.groupId) && tab.groupId !== TAB_GROUP_ID_NONE;
}

function isSameGroup(left, right) {
  return isGrouped(left) && left.groupId === right.groupId;
}

function setBusy(busy) {
  openCurrentButton.disabled = busy;
  openAllButton.disabled = busy;
  cleanupButton.disabled = busy;
  cleanupCancelButton.disabled = busy;
  cleanupConfirmButton.disabled = busy;
  settingsButton.disabled = busy;
}

async function requireReviewBaseUrl() {
  const reviewBaseUrl = await getReviewBaseUrl();
  if (reviewBaseUrl) return reviewBaseUrl;

  await openOptionsPage();
  window.close();
  return null;
}

function pickPullRequestTabs(tabs, reviewBaseUrl) {
  const uniquePullRequests = new Map();
  let totalPullRequestTabs = 0;

  for (const tab of tabs) {
    if (tab.id === undefined) continue;

    const pullRequest = parseGitHubPullRequest(tab.url);
    if (!pullRequest) continue;

    totalPullRequestTabs += 1;

    const reviewUrl = buildReviewUrl(reviewBaseUrl, pullRequest);
    const reviewKey = comparableUrl(reviewUrl);
    if (!reviewKey) continue;

    const existing = uniquePullRequests.get(reviewKey);
    if (!existing || (tab.active && !existing.tab.active)) {
      uniquePullRequests.set(reviewKey, { tab, pullRequest, reviewUrl, reviewKey });
    }
  }

  return {
    entries: [...uniquePullRequests.values()].sort((left, right) => {
      if (left.tab.windowId !== right.tab.windowId) {
        return left.tab.windowId - right.tab.windowId;
      }

      return right.tab.index - left.tab.index;
    }),
    duplicateCount: Math.max(0, totalPullRequestTabs - uniquePullRequests.size),
  };
}

function indexReviewTabs(tabs, reviewKeys) {
  const reviewsByKey = new Map();

  for (const tab of tabs) {
    if (tab.id === undefined) continue;

    const key = comparableUrl(tab.url);
    if (!key || !reviewKeys.has(key)) continue;

    const existing = reviewsByKey.get(key) ?? [];
    existing.push(tab);
    reviewsByKey.set(key, existing);
  }

  return reviewsByKey;
}

function indexConfiguredReviewTabs(tabs, reviewBaseUrl) {
  const reviewsByKey = new Map();

  for (const tab of tabs) {
    if (tab.id === undefined) continue;

    const key = reviewKeyFromUrl(reviewBaseUrl, tab.url);
    if (!key) continue;

    const existing = reviewsByKey.get(key) ?? [];
    existing.push(tab);
    reviewsByKey.set(key, existing);
  }

  return reviewsByKey;
}

function pickReviewTab(candidates, pullRequestTab) {
  if (!candidates?.length) return null;

  return (
    candidates.find((tab) => tab.windowId === pullRequestTab.windowId && isSameGroup(tab, pullRequestTab)) ??
    candidates.find((tab) => tab.windowId === pullRequestTab.windowId && !isGrouped(tab)) ??
    candidates.find((tab) => tab.windowId === pullRequestTab.windowId) ??
    candidates.find((tab) => !isGrouped(tab)) ??
    candidates[0]
  );
}

function normalizeMovedTab(result) {
  return Array.isArray(result) ? result[0] : result;
}

async function createPairGroup(pullRequestTab, reviewTab, pullRequest) {
  const groupId = await groupTabs({
    tabIds: [pullRequestTab.id, reviewTab.id],
    createProperties: { windowId: pullRequestTab.windowId },
  });

  await updateTabGroup(groupId, {
    title: `${pullRequest.repo} #${pullRequest.pullNumber}`,
    collapsed: false,
  });
}

function classifyPairGrouping(pullRequestTab, reviewTab, groupingAvailable) {
  if (!groupingAvailable || pullRequestTab.id === undefined || reviewTab.id === undefined) {
    return "unavailable";
  }

  if (isSameGroup(pullRequestTab, reviewTab)) return "already";

  if (reviewTab.windowId !== pullRequestTab.windowId && isGrouped(reviewTab)) {
    return "conflict";
  }

  if (
    reviewTab.windowId === pullRequestTab.windowId &&
    isGrouped(pullRequestTab) &&
    isGrouped(reviewTab) &&
    pullRequestTab.groupId !== reviewTab.groupId
  ) {
    return "conflict";
  }

  return "groupable";
}

async function ensurePairGrouped(pullRequestTab, reviewTab, pullRequest, groupingAvailable) {
  const classification = classifyPairGrouping(pullRequestTab, reviewTab, groupingAvailable);
  if (classification !== "groupable") return classification;

  let currentReviewTab = reviewTab;

  if (currentReviewTab.windowId !== pullRequestTab.windowId) {
    currentReviewTab = normalizeMovedTab(
      await moveTab(currentReviewTab.id, {
        windowId: pullRequestTab.windowId,
        index: pullRequestTab.index + 1,
      }),
    );

    if (!currentReviewTab) return "conflict";
    if (isSameGroup(pullRequestTab, currentReviewTab)) return "grouped";
  }

  if (isGrouped(pullRequestTab)) {
    await groupTabs({
      groupId: pullRequestTab.groupId,
      tabIds: [currentReviewTab.id],
    });
    return "grouped";
  }

  if (isGrouped(currentReviewTab)) {
    await groupTabs({
      groupId: currentReviewTab.groupId,
      tabIds: [pullRequestTab.id],
    });
    return "grouped";
  }

  await createPairGroup(pullRequestTab, currentReviewTab, pullRequest);
  return "grouped";
}

function summarizeBulkResult({ opened, reused, grouped, alreadyPaired, conflicts, duplicatePullRequests, groupingAvailable }) {
  if (opened === 0 && grouped === 0 && conflicts === 0) {
    return "Everything is already organized.";
  }

  const parts = [];
  if (opened > 0) parts.push(`${opened} opened`);
  if (reused > 0) parts.push(`${reused} reused`);
  if (grouped > 0) parts.push(`${grouped} grouped`);
  if (alreadyPaired > 0) parts.push(`${alreadyPaired} already paired`);
  if (conflicts > 0) parts.push(`${conflicts} left as-is`);
  if (duplicatePullRequests > 0) parts.push(`${duplicatePullRequests} duplicate PR${duplicatePullRequests === 1 ? "" : "s"} skipped`);
  if (!groupingAvailable) parts.push("grouping unavailable");

  return parts.join(" · ");
}

function buildCleanupPlan(tabs, reviewBaseUrl, groupingAvailable) {
  const pullRequestEntries = pickPullRequestTabs(tabs, reviewBaseUrl).entries;
  const pullRequestsByKey = new Map(pullRequestEntries.map((entry) => [entry.reviewKey, entry]));
  const reviewsByKey = indexConfiguredReviewTabs(tabs, reviewBaseUrl);

  const orphanedTabs = [];
  const duplicateTabs = [];
  const pairsToGroup = [];
  let alreadyPaired = 0;
  let conflicts = 0;

  for (const [reviewKey, reviewTabs] of reviewsByKey) {
    const pullRequestEntry = pullRequestsByKey.get(reviewKey);
    if (!pullRequestEntry) {
      orphanedTabs.push(...reviewTabs);
      continue;
    }

    const keeper = pickReviewTab(reviewTabs, pullRequestEntry.tab);
    if (!keeper) continue;

    duplicateTabs.push(...reviewTabs.filter((tab) => tab.id !== keeper.id));

    const classification = classifyPairGrouping(pullRequestEntry.tab, keeper, groupingAvailable);
    if (classification === "groupable") {
      pairsToGroup.push({ pullRequestEntry, reviewTab: keeper });
    } else if (classification === "already") {
      alreadyPaired += 1;
    } else if (classification === "conflict") {
      conflicts += 1;
    }
  }

  return {
    orphanedTabs,
    duplicateTabs,
    pairsToGroup,
    alreadyPaired,
    conflicts,
  };
}

function cleanupActionCount(plan) {
  return plan.orphanedTabs.length + plan.duplicateTabs.length + plan.pairsToGroup.length;
}

function showCleanupPreview(plan) {
  cleanupOrphans.textContent = String(plan.orphanedTabs.length);
  cleanupDuplicates.textContent = String(plan.duplicateTabs.length);
  cleanupGroups.textContent = String(plan.pairsToGroup.length);
  mainActions.hidden = true;
  cleanupPanel.hidden = false;
}

function hideCleanupPreview() {
  cleanupPanel.hidden = true;
  mainActions.hidden = false;
}

async function executeCleanup(reviewBaseUrl, groupingAvailable) {
  const tabsBefore = await queryTabs({});
  const planBefore = buildCleanupPlan(tabsBefore, reviewBaseUrl, groupingAvailable);
  const tabIdsToClose = [...new Set([...planBefore.orphanedTabs, ...planBefore.duplicateTabs].map((tab) => tab.id))];

  await removeTabs(tabIdsToClose);

  const tabsAfter = tabIdsToClose.length > 0 ? await queryTabs({}) : tabsBefore;
  const planAfter = buildCleanupPlan(tabsAfter, reviewBaseUrl, groupingAvailable);

  let grouped = 0;
  let conflicts = planAfter.conflicts;

  for (const { pullRequestEntry, reviewTab } of planAfter.pairsToGroup) {
    try {
      const result = await ensurePairGrouped(
        pullRequestEntry.tab,
        reviewTab,
        pullRequestEntry.pullRequest,
        groupingAvailable,
      );

      if (result === "grouped") grouped += 1;
      if (result === "conflict") conflicts += 1;
    } catch (error) {
      console.error("Could not organize cleanup pair", error);
      conflicts += 1;
    }
  }

  return {
    orphanedClosed: planBefore.orphanedTabs.length,
    duplicatesClosed: planBefore.duplicateTabs.length,
    grouped,
    conflicts,
  };
}

function summarizeCleanupResult({ orphanedClosed, duplicatesClosed, grouped, conflicts }) {
  const parts = [];
  if (orphanedClosed > 0) parts.push(`${orphanedClosed} orphan${orphanedClosed === 1 ? "" : "s"} closed`);
  if (duplicatesClosed > 0) parts.push(`${duplicatesClosed} duplicate${duplicatesClosed === 1 ? "" : "s"} closed`);
  if (grouped > 0) parts.push(`${grouped} pair${grouped === 1 ? "" : "s"} organized`);
  if (conflicts > 0) parts.push(`${conflicts} left untouched`);
  return parts.length > 0 ? parts.join(" · ") : "Everything is already clean.";
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
  status.textContent = "Checking tabs…";

  try {
    const reviewBaseUrl = await requireReviewBaseUrl();
    if (!reviewBaseUrl) return;

    const tabs = await queryTabs({});
    const { entries: pullRequestTabs, duplicateCount: duplicatePullRequests } = pickPullRequestTabs(
      tabs,
      reviewBaseUrl,
    );

    if (pullRequestTabs.length === 0) {
      status.textContent = "No GitHub PR tabs found.";
      return;
    }

    const reviewKeys = new Set(pullRequestTabs.map(({ reviewKey }) => reviewKey));
    const reviewsByKey = indexReviewTabs(tabs, reviewKeys);
    const groupingAvailable = Boolean(
      (firefoxApi?.tabs.group && firefoxApi?.tabGroups?.update) ||
        (!firefoxApi && chrome.tabs.group && chrome.tabGroups?.update),
    );

    let opened = 0;
    let reused = 0;
    let grouped = 0;
    let alreadyPaired = 0;
    let conflicts = 0;

    for (const { tab, pullRequest, reviewUrl, reviewKey } of pullRequestTabs) {
      let reviewTab = pickReviewTab(reviewsByKey.get(reviewKey), tab);

      if (reviewTab) {
        reused += 1;
      } else {
        reviewTab = await createTab({
          url: reviewUrl,
          windowId: tab.windowId,
          index: tab.index + 1,
          active: false,
        });
        opened += 1;
      }

      const groupingResult = await ensurePairGrouped(tab, reviewTab, pullRequest, groupingAvailable);
      if (groupingResult === "grouped") grouped += 1;
      if (groupingResult === "already") alreadyPaired += 1;
      if (groupingResult === "conflict") conflicts += 1;
    }

    status.textContent = summarizeBulkResult({
      opened,
      reused,
      grouped,
      alreadyPaired,
      conflicts,
      duplicatePullRequests,
      groupingAvailable,
    });
  } catch (error) {
    console.error(error);
    status.textContent = "Could not organize reviews.";
  } finally {
    setBusy(false);
  }
});

cleanupButton.addEventListener("click", async () => {
  setBusy(true);
  status.textContent = "Scanning reviews…";

  try {
    const reviewBaseUrl = await requireReviewBaseUrl();
    if (!reviewBaseUrl) return;

    const tabs = await queryTabs({});
    const groupingAvailable = Boolean(
      (firefoxApi?.tabs.group && firefoxApi?.tabGroups?.update) ||
        (!firefoxApi && chrome.tabs.group && chrome.tabGroups?.update),
    );
    const plan = buildCleanupPlan(tabs, reviewBaseUrl, groupingAvailable);

    if (cleanupActionCount(plan) === 0) {
      status.textContent =
        plan.conflicts > 0
          ? `Nothing safe to clean · ${plan.conflicts} pair${plan.conflicts === 1 ? "" : "s"} left untouched`
          : "Everything is already clean.";
      return;
    }

    status.textContent = "";
    showCleanupPreview(plan);
  } catch (error) {
    console.error(error);
    status.textContent = "Could not scan reviews.";
  } finally {
    setBusy(false);
  }
});

cleanupCancelButton.addEventListener("click", () => {
  hideCleanupPreview();
  status.textContent = "";
});

cleanupConfirmButton.addEventListener("click", async () => {
  setBusy(true);
  status.textContent = "Cleaning up…";

  try {
    const reviewBaseUrl = await requireReviewBaseUrl();
    if (!reviewBaseUrl) return;

    const groupingAvailable = Boolean(
      (firefoxApi?.tabs.group && firefoxApi?.tabGroups?.update) ||
        (!firefoxApi && chrome.tabs.group && chrome.tabGroups?.update),
    );
    const result = await executeCleanup(reviewBaseUrl, groupingAvailable);

    hideCleanupPreview();
    status.textContent = summarizeCleanupResult(result);
  } catch (error) {
    console.error(error);
    status.textContent = "Could not clean up reviews.";
  } finally {
    setBusy(false);
  }
});

settingsButton.addEventListener("click", async () => {
  await openOptionsPage();
  window.close();
});
