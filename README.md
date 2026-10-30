<p align="center">
  <img src="build/icon.png" alt="StackPad logo" width="112" />
</p>

<h1 align="center">StackPad</h1>

<p align="center">
  A lightweight Windows notepad with vertical tabs, window size presets and a calm light/dark design.
</p>

---

## Why StackPad?

StackPad started from two small frustrations with the standard Windows Notepad:

1. **Tabs belong on the side.** A horizontal tab strip runs out of room quickly and squeezes every title. StackPad keeps your notes in a vertical rail that stays slim while you write and opens to show full titles when you need them.
2. **The window should snap to a size you like.** StackPad has one-click **4:5** and **16:9** window presets, plus **Freeform** for everything else.

Everything else follows the same idea: keep the essentials of a plain-text notepad, and make them feel faster and tidier.

## StackPad vs. Windows Notepad

Both apps are plain-text editors with tabs, find and replace, themes and session restore. These are the areas where StackPad works differently:

| Area                   | Windows Notepad                                    | StackPad                                                                                                                                                             |
| ---------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tab layout**         | Horizontal tab strip across the top                | Vertical rail on the left that expands over the editor on hover, so the text never shifts or re-wraps                                                                |
| **Telling tabs apart** | Tab titles                                         | Each tab gets an initials badge in its own colour (e.g. **MN** for _Meeting Notes_). The colour stays with the tab even if you rename it                             |
| **Window size**        | Resize by hand                                     | One-click **4:5** and **16:9** presets, plus **Freeform**, which remembers your size and position                                                                    |
| **Find & replace**     | Find and replace panel                             | Compact controls that take the title's place in the toolbar, with a live "3 of 12" count, match case, whole word and an in-text highlight that follows wrapped lines |
| **Status bar**         | Position, characters, zoom, line endings, encoding | Also shows a live **word count**                                                                                                                                     |
| **Online features**    | Includes features linked to a Microsoft account    | Fully offline: no account, no sign-in, no AI features, no telemetry                                                                                                  |
| **Source**             | Closed source                                      | Open source (MIT), so you can change anything                                                                                                                        |

## Features

### Tabs

- Vertical tab rail with initials badges; untitled tabs show a page icon
- Badge colours are spread across a palette of 8, so neighbouring tabs rarely match
- Expand the rail by hovering it; it slides over the editor instead of pushing it
- Drag tabs up and down to reorder them
- Rename from the pencil button, by double-clicking a tab, or by double-clicking the centred title above the editor
- `Ctrl+Tab` / `Ctrl+Shift+Tab` cycles through tabs

### Never lose a note

- Every tab and its contents are kept between sessions, including tabs you never saved to a file
- Typing is saved continuously, and the last keystrokes are saved even if you close the app immediately
- Unsaved changes are marked with a dot on the tab and next to the title
- Closing a tab with unsaved changes asks **Save / Don't Save / Cancel**
- App data is written safely, so a crash or power cut can't leave it half-written

### Writing and editing

- Undo and redo work for everything, including Replace All, Time/Date and Tab
- `Tab` inserts a real tab character (shown 4 spaces wide)
- Insert the current time and date with `F5`
- Word wrap on or off, Go To line (`Ctrl+G`)
- Font family and size, plus zoom with `Ctrl` + mouse wheel or `Ctrl` `+` / `-` / `0`

### Find and replace

- Search starts from your cursor and jumps to matches as you type
- Live count ("3 of 12"), previous/next with wrap-around, `F3` / `Shift+F3`
- **Match case** and **Match whole word** toggles inside the search box
- Replace the current match (`Enter` in the Replace box) or all matches (`Ctrl+Enter`)
- A highlight follows matches that wrap across lines

### Files

- Open several files at once, drag files onto the window, or right-click a `.txt` in Explorer and choose **Open with → StackPad**
- Files opened while StackPad is running appear as new tabs in the same window
- Opening a file that's already open switches to its tab instead of duplicating it
- Files are saved back with their original **line endings** (Windows CRLF or Unix LF) and **encoding** (UTF-8, UTF-8 with BOM, UTF-16, ANSI). If you add characters ANSI can't store, the file is saved as UTF-8 instead of losing them
- Print outputs the whole note on its own, without the app interface

### Look and feel

- Light, Dark or follow Windows; both themes share the same blue accent
- Status bar with line/column, words, characters, zoom, line endings and encoding (can be hidden)
- Subtle motion for menus, dialogs, tabs and the find bar; turned off automatically when Windows **Animation effects** is off
- The window opens at your saved size and theme without a white flash

## Keyboard shortcuts

| Action                                     | Shortcut                                                       |
| ------------------------------------------ | -------------------------------------------------------------- |
| New tab                                    | `Ctrl+N`                                                       |
| Open                                       | `Ctrl+O`                                                       |
| Save / Save As                             | `Ctrl+S` / `Ctrl+Shift+S`                                      |
| Print                                      | `Ctrl+P`                                                       |
| Close tab                                  | `Ctrl+W`                                                       |
| Next / previous tab                        | `Ctrl+Tab` / `Ctrl+Shift+Tab`                                  |
| Find                                       | `Ctrl+F`                                                       |
| Find next / previous                       | `F3` / `Shift+F3` (or `Enter` / `Shift+Enter` in the find box) |
| Replace                                    | `Ctrl+H`                                                       |
| Replace current / all (in the Replace box) | `Enter` / `Ctrl+Enter`                                         |
| Close find or replace                      | `Esc`                                                          |
| Go to line                                 | `Ctrl+G`                                                       |
| Insert time and date                       | `F5`                                                           |
| Undo / Redo                                | `Ctrl+Z` / `Ctrl+Y`                                            |
| Zoom in / out / reset                      | `Ctrl` `+` / `Ctrl` `-` / `Ctrl+0`, or `Ctrl` + mouse wheel    |

## Installing StackPad

1. Download `StackPad v2.0.exe` from the project's **Releases** page.
2. Run it. The setup wizard walks you through:
   - the license agreement,
   - installing **for just you** or **for everyone on this PC**,
   - choosing the install folder,
   - a progress bar while files are copied,
   - a final page with **Run StackPad** ticked.
3. StackPad is added to the Start menu and the desktop, and appears under **Open with** for `.txt` files.

To uninstall, use **Settings → Apps → Installed apps → StackPad → Uninstall**. Your notes are kept unless you delete them yourself (see below).

> Windows SmartScreen may warn about an unrecognised app because the installer isn't code-signed. Choose **More info → Run anyway** to continue.

## Building from source

Requirements: Windows 10 or 11, [Node.js](https://nodejs.org/) 18 or newer, and npm.

```bash
npm install     # install dependencies
npm start       # run StackPad in development mode
npm run dist    # build the installer
```

`npm run dist` creates `dist/StackPad v<version>.exe`, the setup wizard described above. The first build may need **Developer Mode** turned on (Settings → System → For developers) or an Administrator terminal, because electron-builder creates symbolic links while preparing its tools.

macOS and Linux can run StackPad from source with `npm start`; release builds are produced for Windows only.

## Where your notes are stored

StackPad keeps its data in `%APPDATA%\stackpad`:

| File               | Contents                                                                  |
| ------------------ | ------------------------------------------------------------------------- |
| `drafts\*.txt`     | The text of every open tab                                                |
| `notes-index.json` | Tab order, titles, badge colours and linked file paths                    |
| `settings.json`    | Theme, font, zoom, word wrap, status bar, screen size and window position |

Files you save with **Save / Save As** live wherever you put them. The drafts are StackPad's own copy, so tabs you never saved to a file are still there next time.

## Project structure

```text
stackpad/
├── build/
│   ├── icon.ico              # app and installer icon
│   ├── icon.png              # app icon (macOS/Linux, README)
│   └── installerSidebar.bmp  # image on the setup wizard's welcome and finish pages
├── src/
│   ├── index.html            # window layout, menus and dialogs
│   ├── renderer.js           # tabs, editor, find/replace, saving, settings
│   └── styles.css            # themes, layout and motion
├── main.js                   # window, native menu, file reading/writing, storage
├── preload.js                # the safe bridge between the window and main.js
├── package.json              # scripts and installer configuration
└── LICENSE
```

## Release notes

### 2.0.0

The biggest update yet: a redesigned tab rail, a much more reliable save system, a reworked find and replace, and a proper Windows installer.

**New**

- Initials badges with a colour that stays with each tab, replacing the tab numbers
- Unsaved-change dots, and **Save / Don't Save / Cancel** when closing an unsaved tab
- **Match case** and **Match whole word** in find and replace
- Word count, line-ending and encoding indicators in the status bar
- Drag files onto the window to open them, and **Open with StackPad** from Explorer
- Original line endings and encodings are kept when saving
- Settings, the screen-size preset and the Freeform window position are remembered
- Setup wizard with install location, per-user or all-users install, shortcuts and an uninstaller
- New logo, and a blue accent shared by the light and dark themes
- Light motion throughout the interface

**Improved**

- Find and replace: search follows the cursor, previous/next/replace stay in step, the highlight stays aligned after scrolling, resizing or zooming, and every replacement can be undone
- The tab rail slides over the editor instead of re-wrapping your text
- Printing outputs the full note rather than just the visible part of the window
- The window opens at the right size and theme without flashing
- The app works fully offline (the online font dependency was removed)

**Fixed**

- Dropping a file onto the window no longer replaces the app with that file
- The last few keystrokes are no longer lost when closing quickly
- Saved tabs no longer ask to be saved again when closed
- Undo now works after Replace, Replace All, Time/Date and Tab
- Double-clicking a tab to rename it works reliably
- Edit menu commands (including Paste) now run reliably from the in-app menu
- Open and save errors (e.g. a read-only file) are now reported instead of failing silently
- The column number in the status bar is correct at the start of a note

## License

[MIT](LICENSE) © 2026 Arafat Anam Chowdhury
