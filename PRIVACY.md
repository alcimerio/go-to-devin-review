# Privacy Policy

_Last updated: August 18, 2026_

Go to Devin Review is a browser extension that helps users open GitHub pull requests in a configured Devin Review host and organize related browser tabs.

## Data the extension accesses

The extension can access:

- GitHub pull request tab URLs on `https://github.com/*`
- the Review base URL configured by the user in the extension settings
- browser tab and tab-group metadata needed to open, pair, group, deduplicate, and clean up review tabs

## Data stored locally

The extension stores only the user-provided **Review base URL** in the browser's local extension storage.

## Data transmitted

When the user triggers an action such as **Open current** or **Open all and group**, the extension constructs a review URL using:

- the configured Review base URL; and
- the GitHub pull request path in the form `/<owner>/<repo>/pull/<number>`.

The browser then opens that URL. As part of that navigation, the pull request path is transmitted directly from the browser to the review host configured by the user.

The Go to Devin Review project does **not** operate a backend service and does **not** proxy or relay this data.

## What the extension does not do

The extension does **not**:

- collect analytics or telemetry
- send data to the project author
- sell user data
- share user data with advertisers or data brokers
- collect passwords, payment information, or personal account profile information
- inspect GitHub page content beyond the URL information needed to identify pull requests and manage related tabs

## Third-party services

The extension interacts with:

- **GitHub**, by reading GitHub pull request URLs from open browser tabs; and
- the **user-configured Devin Review host**, by navigating to the matching review URL.

Use of those services is subject to their own terms and privacy policies.

## Contact

Project repository: https://github.com/alcimerio/go-to-devin-review
