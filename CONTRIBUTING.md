# Contributing to StackPad

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Reporting bugs and suggesting features

- **Bugs:** in StackPad, choose **Help → Report a Problem**. It opens the bug form with your version and operating system filled in. You can also [open an issue](https://github.com/arafatanam/StackPad/issues/new/choose) directly.
- **Ideas:** use the feature request form. StackPad aims to stay a small, fast, plain-text notepad, so a feature that fits that idea is much more likely to be added.
- **Security problems:** see [SECURITY.md](SECURITY.md). Please don't post them publicly.

## Working on the code

Requirements: [Node.js](https://nodejs.org/) 20 or newer and npm. Windows 10/11 or Linux.

```bash
npm install     # install dependencies
npm start       # run StackPad from source
npm test        # run the automated tests
```

If you run StackPad from a terminal inside VS Code and it fails with `Cannot find module 'electron'`, the `ELECTRON_RUN_AS_NODE` variable from VS Code is set. Run it from a normal terminal, or clear that variable first.

### Where things are

| Path | What it does |
| --- | --- |
| `main.js` | The window, native menu, file and settings storage, and all IPC handlers |
| `preload.js` | The only bridge between the page and the main process. Keep it small |
| `lib/textfile.js` | Encodings, line endings and crash-safe saving. Has no Electron dependency so it can be tested with plain Node |
| `lib/updater.js` | Automatic updates from GitHub releases |
| `src/` | The window's page: layout, styles and editor behaviour |
| `test/` | Tests run with Node's built-in test runner |
| `website/` | The project website, hosted on Vercel |

### Guidelines

- Keep the page sandboxed: no `nodeIntegration`, and add new abilities as named functions in `preload.js`, not general-purpose ones.
- Anything that touches users' files needs a test in `test/`.
- Match the existing style: plain JavaScript, no frameworks, comments that explain _why_.
- Keep the in-app menu (`src/index.html`) and the native menu (`main.js`) in step.

### Pull requests

1. Branch from `main`.
2. Make your change, and run `npm test`.
3. Add a line under a new **Unreleased** heading in [CHANGELOG.md](CHANGELOG.md).
4. Open the pull request and describe what changed and how you tested it.

## Making a release (maintainers)

1. Update `version` in `package.json` (and run `npm install --package-lock-only`), and turn the changelog's **Unreleased** heading into the new version and date.
2. Update `VERSION` and the release date in `website/index.html`'s download script.
3. Commit, then tag and push: `git tag v2.3.0 && git push origin main v2.3.0`.
4. GitHub Actions tests and builds everything and creates a **draft** release with the installers, `latest.yml` and `latest-linux.yml` attached. Check it, then publish it. Installed copies start updating once it's published.
5. If the Microsoft Store package was built, download it from the workflow run and submit it in Partner Center (see [docs/SIGNING.md](docs/SIGNING.md)).
