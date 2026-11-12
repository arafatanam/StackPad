# Privacy policy

_Last updated: 12 November 2026_

StackPad is a notepad that runs entirely on your computer. It has no accounts, no analytics, no telemetry, no ads and no AI features.

## What StackPad stores

Everything StackPad keeps stays on your computer, in your user profile:

- **Windows:** `%APPDATA%\stackpad`
- **Linux:** `~/.config/stackpad`

That folder holds the text of your open tabs, their titles and order, and your settings (theme, font, window size and similar). Files you save with **Save** or **Save As** are stored wherever you choose. StackPad never uploads any of it.

## When StackPad connects to the internet

StackPad makes exactly one kind of network request on its own: **checking for updates**.

- About 15 seconds after it starts, and then every 6 hours, StackPad asks GitHub (where its releases are published) whether a newer version exists. If there is one, it downloads the installer from GitHub.
- Like any web request, this tells GitHub your IP address and that a copy of StackPad is checking for updates. No note contents, file names, settings or identifiers are sent. GitHub's handling of that request is covered by the [GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).
- You can turn this off with **Help → Check for Updates Automatically**. StackPad then only checks when you choose **Help → Check for Updates**.
- Copies installed from the Microsoft Store don't check by themselves; the Store updates them.

Links in the **Help** menu and the About box open in your web browser only when you click them.

## The website

The StackPad website is hosted on GitHub Pages. It sets no cookies and uses no analytics. To show the latest version on its download button, your browser asks GitHub's public API for the newest release. GitHub may log that request as described in its privacy statement.

## Bug reports

**Help → Report a Problem** opens a GitHub issue form in your browser with your StackPad version and operating system filled in. Nothing is sent until you choose to submit the form, and you can edit or remove anything first.

## Changes

If this policy changes, the new version will be published here and noted in the [changelog](CHANGELOG.md).

## Contact

Questions about privacy: open an issue at <https://github.com/arafatanam/StackPad/issues>.
