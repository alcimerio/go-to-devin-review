# Go to Devin Review

Tiny browser extension that opens GitHub pull requests in a configurable Devin Review instance.

Example:

```text
https://github.com/example/project/pull/66
```

with a Review base URL configured as:

```text
https://your-devin-host.example/review
```

opens:

```text
https://your-devin-host.example/review/example/project/pull/66
```

## Actions

When the active tab is a GitHub pull request, click the extension icon to open a small menu:

- **Open current** — opens the active pull request in Devin Review.
- **Open all and group** — organizes every open GitHub pull request with its matching Devin Review tab.

`Open all and group` is idempotent:

- If a matching Devin Review tab is already open, it is reused instead of opening a duplicate.
- If the GitHub PR and Devin Review tabs are already in the same group, nothing changes.
- If one of the two tabs is already in a group, the ungrouped tab joins that existing group.
- If both tabs are ungrouped, a new group is created and named after the repository and pull request number, for example `project #66`.
- If both tabs are already in different groups, the extension leaves those groups untouched.
- Duplicate GitHub tabs for the same pull request are skipped.

The bulk action scans PRs across browser windows. When an existing ungrouped Devin Review tab is in another window, it may be moved next to its GitHub PR so the pair can be grouped.

The first time you use **Open all and group**, the browser asks for optional tab access. This permission is used only to recognize already-open Devin Review tabs and avoid duplicates.

## Configuration

The extension does not ship with a Devin Review host configured.

Open the extension settings and set **Review base URL** to the HTTPS base URL for your Devin Review instance. Include the `/review` path when it is part of your instance URL. The value is stored locally in the browser extension profile using the WebExtension storage API.

If you use an action before configuring a Review base URL, the settings page opens automatically.

## Firefox

This extension is Firefox-first and uses WebExtension APIs that are also compatible with modern Chromium-based browsers.

### Install for local development

1. Clone or download this repository.
2. Open `about:debugging` in Firefox.
3. Click **This Firefox**.
4. Click **Load Temporary Add-on...**.
5. Select `manifest.json` from this repository.
6. Pin **Go to Devin Review** to the toolbar if desired.
7. Open the extension preferences and configure **Review base URL**.

The extension action is enabled only when the active tab is a GitHub pull request URL such as:

```text
https://github.com/<owner>/<repo>/pull/<number>
```

> Temporary add-ons loaded through `about:debugging` are removed when Firefox restarts.

For local changes, `git pull` followed by **Reload** in `about:debugging` is enough; you do not need to reinstall the temporary add-on.

## Chrome / Chromium

Load the repository as an unpacked extension from `chrome://extensions` with **Developer mode** enabled.

## Project structure

```text
.
├── background.js
├── icons/
├── manifest.json
├── options/
│   ├── options.css
│   ├── options.html
│   └── options.js
├── popup/
│   ├── popup.css
│   ├── popup.html
│   └── popup.js
└── README.md
```

No build step or dependencies are required.
