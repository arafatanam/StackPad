# Changelog

All notable changes to StackPad. Versions follow [semantic versioning](https://semver.org/).

## [2.2.0] - 2026-11-12

Automatic updates, a Help menu, safer saving and a proper Linux release.

### New

- **Automatic updates.** StackPad checks for a new version in the background, downloads it, and installs it when you close the app. **Help → Check for Updates** checks straight away, and **Help → Check for Updates Automatically** turns the background checks off
- **Help menu** with the StackPad website, keyboard shortcuts, release notes and **Report a Problem**, which opens a bug report with your StackPad version and operating system already filled in
- **About StackPad**, showing the version, with a button to copy it for bug reports
- **Changes made by other programs are noticed.** When you come back to StackPad, a file that was edited elsewhere is reloaded if you hadn't changed it. If you had, StackPad asks whether to keep your version or reload the file, so neither is lost silently. Files that were moved or deleted are flagged too
- **Linux .deb package** for Ubuntu, Debian and similar, alongside the AppImage

### Improved

- Saving a file is now crash-safe: the new text is written in full and flushed to disk before it replaces the old file, so a crash or power cut during a save can't leave a half-written document. Read-only files are refused with a clear message, and symbolic links, hard links and Linux file permissions are kept
- The app runs on Electron 45 (from 31), bringing current security fixes and a newer Chromium
- Linux windows now show the StackPad icon
- Installer files are named `StackPad.v2.2.0.exe`, `StackPad.v2.2.0.AppImage` and `StackPad.v2.2.0.deb`

### Fixed

- Files in the ANSI (Windows-1252) encoding are now read and written byte for byte in every case, including characters such as € and curly quotes

### Note for 2.1.0 users

2.1.0 can't update itself, so install 2.2.0 once from the website. From then on, updates arrive automatically. Your notes are kept.

## [2.1.0] - 2026-11-09

Tab groups, and more room for your tab titles.

### New

- Tab groups: named sections in the rail that fold away and are remembered between sessions
- Drag tabs into, out of and around groups, and drag a group's header to reorder the groups
- **New Group** in the File menu and on the rail, with the `Ctrl+Shift+N` shortcut
- A Linux build, as an AppImage

### Improved

- Tab titles have much more room: the open rail no longer shows the initials badge or a rename button (double-click a tab to rename it)
- Unsaved tabs are marked with a notch on their left edge in the open rail instead of a dot that took up space
- The collapsed rail shows only the initials badges, without the notch
- The rail scrolls when you drag a tab or group near its top or bottom edge, and stays where you left it after you drop

## [2.0.0]

The biggest update yet: a redesigned tab rail, a much more reliable save system, a reworked find and replace, and a proper Windows installer.

### New

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

### Improved

- Find and replace: search follows the cursor, previous/next/replace stay in step, the highlight stays aligned after scrolling, resizing or zooming, and every replacement can be undone
- The tab rail slides over the editor instead of re-wrapping your text
- Printing outputs the full note rather than just the visible part of the window
- The window opens at the right size and theme without flashing
- The app works fully offline (the online font dependency was removed)

### Fixed

- Dropping a file onto the window no longer replaces the app with that file
- The last few keystrokes are no longer lost when closing quickly
- Saved tabs no longer ask to be saved again when closed
- Undo now works after Replace, Replace All, Time/Date and Tab
- Double-clicking a tab to rename it works reliably
- Edit menu commands (including Paste) now run reliably from the in-app menu
- Open and save errors (e.g. a read-only file) are now reported instead of failing silently
- The column number in the status bar is correct at the start of a note

## Earlier versions

See the [releases page](https://github.com/arafatanam/StackPad/releases).
