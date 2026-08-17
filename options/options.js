const REVIEW_BASE_URL_KEY = "reviewBaseUrl";

const form = document.querySelector("#settings-form");
const input = document.querySelector("#review-base-url");
const status = document.querySelector("#status");

function normalizeReviewBaseUrl(value) {
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

function restoreSettings() {
  chrome.storage.local.get(REVIEW_BASE_URL_KEY, (stored) => {
    if (chrome.runtime.lastError) {
      status.textContent = `Could not load settings: ${chrome.runtime.lastError.message}`;
      return;
    }

    input.value = stored[REVIEW_BASE_URL_KEY] ?? "";
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const reviewBaseUrl = normalizeReviewBaseUrl(input.value);
  if (!reviewBaseUrl) {
    status.textContent = "Enter a valid HTTPS URL without query parameters or a fragment.";
    input.focus();
    return;
  }

  chrome.storage.local.set({ [REVIEW_BASE_URL_KEY]: reviewBaseUrl }, () => {
    if (chrome.runtime.lastError) {
      status.textContent = `Could not save settings: ${chrome.runtime.lastError.message}`;
      return;
    }

    input.value = reviewBaseUrl;
    status.textContent = "Saved.";

    window.setTimeout(() => {
      status.textContent = "";
    }, 2000);
  });
});

restoreSettings();
