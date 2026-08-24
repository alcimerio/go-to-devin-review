<p align="center">
  <img src="icons/go-to-devin-review-128.png" width="96" alt="Go to Devin Review icon" />
</p>

# Go to Devin Review

A Firefox extension for opening GitHub pull requests in Devin Review and keeping PR/review tabs organized.

**[Install Go to Devin Review from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/go-to-devin-review/)**

> This is an unofficial community project and is not affiliated with or endorsed by Cognition.

## What it does

Go to Devin Review connects the GitHub pull requests you already have open with their corresponding Devin Review pages.

Given a GitHub PR such as:

```text
https://github.com/example/project/pull/66
```

and a Review base URL such as:

```text
https://your-devin-host.example/review
```

it opens:

```text
https://your-devin-host.example/review/example/project/pull/66
```

It can also organize multiple PR/review pairs at once and clean up stale review tabs.

## Getting started

1. **[Install the extension from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/go-to-devin-review/).**
2. Open the extension settings and set **Review base URL** to the HTTPS URL for your Devin Review instance. Include `/review` if it is part of your instance URL.
3. Open a pull request on GitHub.
4. Click the extension icon and choose an action.

Firefox 140 or newer is required.

## Actions

### Open current

Opens the active GitHub pull request in Devin Review.

### Open all and group

Finds open GitHub PR tabs across browser windows and organizes each one with its matching Devin Review tab.

The operation is idempotent:

- existing review tabs are reused instead of duplicated;
- duplicate GitHub tabs for the same PR are skipped;
- an existing GitHub/review pair that is already grouped is left unchanged;
- if one tab is grouped and the other is not, the ungrouped tab joins the existing group;
- if both tabs are ungrouped, a new group is created and named after the repository and PR number, for example `project #66`;
- if the two tabs are already in conflicting groups, those groups are left untouched.

An ungrouped review tab in another browser window may be moved next to its GitHub PR so the pair can be grouped.

### Clean up reviews

Scans review tabs that belong to the configured Review base URL and shows a preview before making changes.

It can identify:

- **Orphaned reviews** — the review is open but its corresponding GitHub PR tab is not.
- **Duplicate reviews** — multiple review tabs point to the same GitHub PR; one is kept and the extras can be closed.
- **Pairs to organize** — both tabs are open and can safely be grouped.

Cleanup never closes GitHub PR tabs and never creates a missing review. Conflicting tab groups are left untouched.

## Configuration

The extension does not ship with a Devin Review host configured.

The **Review base URL** is stored locally in your browser profile using the WebExtension storage API. If you use an action before configuring it, the settings page opens automatically.

## Permissions and privacy

Go to Devin Review needs access to browser tabs so it can recognize GitHub PRs, find matching review tabs, avoid duplicates, create tab groups, and clean up stale reviews.

When you open a review, the GitHub PR path (`/<owner>/<repo>/pull/<number>`) is sent to the Review base URL you configured as part of normal browser navigation.

The project has no backend service, analytics, or telemetry, and it does not send data to the project author.

See [PRIVACY.md](./PRIVACY.md) for the full privacy policy.

## Development

There are no runtime dependencies or build framework. The extension is plain HTML, CSS, and JavaScript.

To validate and package it locally, use Node.js 22 or newer:

```bash
npm install
npm run firefox:lint
npm run firefox:build
```

For local Firefox development, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on...**, and select `manifest.json`.

## Contributing

Issues and pull requests are welcome. When changing extension behavior, keep the project small, browser-native, and easy to inspect without a build pipeline.

## License

[MIT](./LICENSE)
