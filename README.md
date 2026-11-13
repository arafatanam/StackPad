<p align="center">
  <img src="build/icon.png" alt="StackPad logo" width="112" />
</p>

<h1 align="center">StackPad</h1>

<p align="center">
  A free, lightweight notepad for Windows and Linux with vertical tabs, tab groups and one-click window sizes.
</p>

<p align="center">
  <a href="https://getstackpad.vercel.app/#download"><strong>Download</strong></a> ·
  <a href="https://getstackpad.vercel.app/">Website</a> ·
  <a href="CHANGELOG.md">What's new</a> ·
  <a href="PRIVACY.md">Privacy</a> ·
  <a href="https://github.com/arafatanam/StackPad/issues/new/choose">Report a problem</a>
</p>

<p align="center">
  <img src="website/assets/screenshot-light-rail.webp" alt="StackPad with the tab rail open, showing tabs in Work and Home groups" width="760" />
</p>

## Highlights

- **Tabs down the side.** A slim rail keeps every tab visible; hover it to see full titles. Each tab gets a coloured initials badge.
- **Tab groups.** Name a group, drag tabs into it, fold it away.
- **Never lose a note.** Every tab is kept between sessions, even ones you never saved. Saving is crash-safe.
- **One-click window sizes.** 4:5, 16:9, or Freeform (remembers your size and position).
- **Proper find and replace** with a live "3 of 12" count, match case and whole word.
- **Keeps your files as they were:** original line endings (CRLF/LF) and encoding (UTF-8, UTF-16, ANSI).
- **Light and dark themes**, word count, zoom, word wrap, print.
- **Updates itself**, and that update check is its only connection to the internet.
- **Free and open source.** No account, no ads, no telemetry, no AI.

## Download and install

Get the latest version from the **[website](https://getstackpad.vercel.app/#download)** or the **[Releases page](https://github.com/arafatanam/StackPad/releases/latest)**.

| System | File | Updates |
| --- | --- | --- |
| Windows 10 / 11 (64-bit) | `StackPad.v<version>.exe` | Automatic |
| Linux, any distribution | `StackPad.v<version>.AppImage` | Automatic |
| Ubuntu, Debian, Mint | `StackPad.v<version>.deb` | StackPad tells you when one is out |

### Windows

1. Run the downloaded `.exe` and follow the setup wizard. You can install for just you or for everyone on the PC.
2. StackPad appears in the Start menu, on the desktop, and under **Open with** for `.txt` files.

> **"Windows protected your PC"?** That's expected. Windows shows this warning for any app that isn't **code-signed**, and signing certificates cost money each year, so this free project doesn't have one. To continue, click **More info → Run anyway**. You only see this once. Every installer is built in public by [GitHub Actions](https://github.com/arafatanam/StackPad/actions) from the source code in this repository.

To uninstall, open **Settings → Apps → Installed apps → StackPad → Uninstall**.

### Linux

**AppImage:** make it executable, then run it:

```bash
chmod +x StackPad.v*.AppImage
./StackPad.v*.AppImage
```

If it doesn't start, install FUSE first: `sudo apt install libfuse2` (Ubuntu/Debian).

**.deb:**

```bash
sudo apt install ./StackPad.v*.deb
```

## Getting started

| To... | Do this |
| --- | --- |
| See full tab titles | Hover the tab rail on the left |
| Rename a tab | Double-click it, or the title above the editor |
| Reorder tabs | Drag them up or down |
| Make a group | `Ctrl+Shift+N`, then drag tabs under its header |
| Change the window size | **Screen** menu → 4:5, 16:9 or Freeform |
| Change theme, font or zoom | **View** menu, or `Ctrl` + mouse wheel to zoom |
| Open files | `Ctrl+O`, drag them onto the window, or **Open with → StackPad** |
| Check for updates | **Help → Check for Updates** |

Closing a tab with unsaved changes asks **Save / Don't Save / Cancel**. If another program changes a file you have open, StackPad reloads it, or asks first if you have unsaved edits.

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| New tab / new group | `Ctrl+N` / `Ctrl+Shift+N` |
| Open / Save / Save As | `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S` |
| Close tab | `Ctrl+W` |
| Next / previous tab | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Find / Replace | `Ctrl+F` / `Ctrl+H` |
| Find next / previous | `F3` / `Shift+F3` |
| Replace current / all (in the Replace box) | `Enter` / `Ctrl+Enter` |
| Go to line | `Ctrl+G` |
| Insert time and date | `F5` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` |
| Zoom in / out / reset | `Ctrl` `+` / `Ctrl` `-` / `Ctrl+0` |
| Print | `Ctrl+P` |

## Updates

New versions download in the background and install when you close StackPad, or straight away if you choose **Restart now**. To turn this off, untick **Help → Check for Updates Automatically**. The `.deb` version tells you when an update is out instead of installing it.

## Your notes and privacy

StackPad keeps your open tabs and settings on your computer:

- **Windows:** `%APPDATA%\stackpad`
- **Linux:** `~/.config/stackpad`

To back up your notes, copy that folder. Uninstalling StackPad leaves it in place. Files you save with **Save / Save As** stay wherever you put them. StackPad has no accounts or analytics, and it never uploads your text. Details: [PRIVACY.md](PRIVACY.md).

## Troubleshooting

- **Windows warns that the app is unrecognised:** see the note under [Windows](#windows).
- **The AppImage won't start:** install FUSE (`sudo apt install libfuse2`).
- **Still on version 2.1.0:** that version can't update itself. Install the latest version once over it; your notes are kept.
- **Something else:** use **Help → Report a Problem**, which fills in your version, or [open an issue](https://github.com/arafatanam/StackPad/issues/new/choose).

## For developers

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install     # install dependencies
npm start       # run StackPad
npm test        # run the tests
npm run dist    # build the installer for your system
```

- The app lives in `main.js`, `preload.js` and `src/`. Saving and encodings are in `lib/textfile.js`, auto-update in `lib/updater.js`, and the website in `website/`.
- Pushing a version tag (for example `v2.3.0`) makes GitHub Actions test everything, build the Windows and Linux installers, publish the release and submit the Microsoft Store update.
- Release steps are in [CONTRIBUTING.md](CONTRIBUTING.md). The optional Microsoft Store setup is in [docs/MICROSOFT-STORE.md](docs/MICROSOFT-STORE.md).

Bug reports, ideas and pull requests are welcome. Please report security problems privately, as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Arafat Anam Chowdhury
