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

async function restoreSettings() {
  const stored = await chrome.storage.local.get(REVIEW_BASE_URL_KEY);
  input.value = stored[REVIEW_BASE_URL_KEY] ?? "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const reviewBaseUrl = normalizeReviewBaseUrl(input.value);
  if (!reviewBaseUrl) {
    status.textContent = "Enter a valid HTTPS URL without query parameters or a fragment.";
    input.focus();
    return;
  }

  await chrome.storage.local.set({ [REVIEW_BASE_URL_KEY]: reviewBaseUrl });
  input.value = reviewBaseUrl;
  status.textContent = "Saved.";

  window.setTimeout(() => {
    status.textContent = "";
  }, 2000);
});

void restoreSettings();
