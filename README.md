# Go to Devin Review

Tiny browser extension that opens GitHub pull requests in a configurable Devin Review instance.

> This is an unofficial community project and is not affiliated with or endorsed by Cognition.

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
- **Clean up reviews** — previews and removes stale or duplicate Devin Review tabs, and organizes existing pairs that are still ungrouped.

### Open all and group

`Open all and group` is idempotent:

- If a matching Devin Review tab is already open, it is reused instead of opening a duplicate.
- If the GitHub PR and Devin Review tabs are already in the same group, nothing changes.
- If one of the two tabs is already in a group, the ungrouped tab joins that existing group.
- If both tabs are ungrouped, a new group is created and named after the repository and pull request number, for example `project #66`.
- If both tabs are already in different groups, the extension leaves those groups untouched.
- Duplicate GitHub tabs for the same pull request are skipped.

The bulk action scans PRs across browser windows. When an existing ungrouped Devin Review tab is in another window, it may be moved next to its GitHub PR so the pair can be grouped.

### Clean up reviews

Cleanup is deliberately conservative. It only acts on Devin Review tabs that match the configured Review base URL.

Before anything is closed, the popup shows a preview with counts for:

- **Orphaned reviews** — a Devin Review is open, but no corresponding GitHub PR tab is open.
- **Duplicate reviews** — more than one Devin Review is open for the same GitHub PR. One is kept and the extras are closed.
- **Pairs to organize** — a GitHub PR and its Devin Review are both open but can still be grouped safely.

Cleanup never closes GitHub PR tabs and never creates a missing Devin Review. If the GitHub PR and Devin Review are already in conflicting tab groups, the extension leaves them untouched.

## Configuration

The extension does not ship with a Devin Review host configured.

Open the extension settings and set **Review base URL** to the HTTPS base URL for your Devin Review instance. Include the `/review` path when it is part of your instance URL. The value is stored locally in the browser extension profile using the WebExtension storage API.

If you use an action before configuring a Review base URL, the settings page opens automatically.

The extension requests the `tabs` permission because the bulk and cleanup actions need to read open-tab URLs to identify GitHub PRs and matching Devin Review tabs.

## Privacy

The extension reads GitHub pull request URLs from open tabs. When you ask it to open a review, it uses the GitHub PR path to navigate directly to the Review base URL you configured.

The project itself has no backend, analytics, or telemetry. The only extension setting stored locally is the Review base URL.

Because the PR path is transmitted to the user-configured review host as part of browser navigation, the Firefox manifest declares the required `browsingActivity` data collection permission for Mozilla's built-in data consent system.

See [PRIVACY.md](./PRIVACY.md) for the full privacy policy.

## Firefox

This extension is Firefox-first and uses WebExtension APIs that are also compatible with modern Chromium-based browsers.

Firefox 140 or newer is required for the distributable Firefox package. Tab grouping itself is available from Firefox 139, while Firefox 140 adds the built-in data collection consent metadata used by new AMO submissions.

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

### Build and validate

`web-ext` 10.x requires Node.js 22 or newer.

```bash
npm install
npm run firefox:lint
npm run firefox:build
```

Build artifacts are written to `web-ext-artifacts/` and are ignored by Git.

### Install permanently with a self-distributed signed XPI

For personal/self-distributed installation, create Mozilla Add-ons API credentials, keep them outside the repository, and export them locally:

```bash
export WEB_EXT_API_KEY="your-jwt-issuer"
export WEB_EXT_API_SECRET="your-jwt-secret"
npm run firefox:sign
```

The command submits the extension to Mozilla as an **unlisted** add-on and downloads the signed `.xpi` into `web-ext-artifacts/` when signing succeeds.

### Publish publicly on Firefox Add-ons

For a public listing that anyone can discover and install from addons.mozilla.org, submit the built package through the Mozilla Add-ons Developer Hub as a **listed** add-on. The repository includes the stable Firefox extension ID, privacy policy, data collection declaration, and validation tooling needed for that flow.

## Chrome / Chromium

Load the repository as an unpacked extension from `chrome://extensions` with **Developer mode** enabled.

Chrome ignores the Firefox-specific `browser_specific_settings` section in the manifest.

## Project structure

```text
.
├── .github/
├── .gitignore
├── background.js
├── icons/
├── LICENSE
├── manifest.json
├── options/
│   ├── options.css
│   ├── options.html
│   └── options.js
├── package.json
├── popup/
│   ├── popup.css
│   ├── popup.html
│   └── popup.js
├── PRIVACY.md
└── README.md
```

No build step or runtime dependencies are required for the extension itself. `web-ext` is used only for development, packaging, linting, and Firefox signing.
