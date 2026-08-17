# Go to Devin Review

Tiny browser extension that opens the current GitHub pull request in a configurable Devin Review instance.

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

The Review page opens in a new tab.

## Configuration

The extension does not ship with a Devin Review host configured.

Open the extension settings and set **Review base URL** to the HTTPS base URL for your Devin Review instance. Include the `/review` path when it is part of your instance URL. The value is stored locally in the browser extension profile using the WebExtension storage API.

If you click the extension on a GitHub pull request before configuring a Review base URL, the settings page opens automatically.

## Firefox

This extension is Firefox-first and uses WebExtension APIs that are also compatible with Chromium-based browsers.

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

Clicking the extension opens the equivalent Review URL in a new tab.

> Temporary add-ons loaded through `about:debugging` are removed when Firefox restarts.

### Diagnose a slow click

The background script logs timing information without logging the configured Review base URL.

1. Open `about:debugging#/runtime/this-firefox`.
2. Find **Go to Devin Review** and click **Inspect**.
3. Open the Console.
4. Click the extension from a GitHub pull request.

You should see timing entries for:

```text
action click received
storage.local.get completed
tabs.create called
tabs.create resolved
```

This makes it possible to distinguish time spent waking/running the extension from time spent loading the Devin page itself.

## Chrome / Chromium

The same source also targets Chromium Manifest V3. Load the repository as an unpacked extension from `chrome://extensions` with **Developer mode** enabled.

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
└── README.md
```

No build step or dependencies are required.
