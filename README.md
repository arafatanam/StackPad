# StackPad

A minimal desktop note-taking app for fast writing, clean organization, and distraction-free editing.

StackPad is built for users who want a simple writing experience with a polished desktop layout, quick note tabs, and essential editing tools without unnecessary clutter.

## Features

- Body-style writing throughout the editor
- Light, Dark, and System theme support
- Multiple tabs for managing notes
- Restores the most recently selected tab when reopened
- Save, save as, print, and local draft support
- Find, replace, go to line, and word wrap with match navigation and highlighting
- Create new tabs with the plus button
- Rename tabs with the pencil button or by double-clicking a tab title
- Reorder tabs by dragging them vertically within the sidebar rail
- Font family, font size, and editor zoom controls
- Date and time insertion
- Window ratio presets for 4:5 and 16:9 layouts
- Optional status bar and light, dark, or system theme controls
- Keyboard shortcuts for common editing actions
- Clean desktop-style interface with responsive layout options

## How to run StackPad

### Method 1: Download from GitHub Releases

1. Open the Releases page for this project.
2. Download the latest Windows installer.
3. Run the `.exe` file.
4. Install it on your computer.
5. Open StackPad from the desktop or Start menu.

### Method 2: Build the application yourself

```bash
npm install
npm run dist
```

This generates the installer file inside the `dist` folder, which can then be installed and used on a Windows PC. On Windows, building may require Developer Mode or an Administrator PowerShell because electron-builder uses symbolic links while preparing packaging tools.

### Method 3: Run the app directly from source

```bash
npm install
npm start
```

This starts the app in development mode without generating a packaged installer.

## System requirements

- Windows 10 or Windows 11
- Node.js 18 or newer
- npm

## Notes

- This project is currently intended for Windows desktop use.
- For macOS and Linux, the app can be run from source using the same commands above, but release builds are being provided for Windows only.
- The `dist` folder is generated after running `npm run dist` and contains the installable setup file.

## Project files

```text
stackpad/
├── .gitignore
├── build/
│   ├── icon.ico
│   └── icon.png
├── main.js
├── package-lock.json
├── package.json
├── preload.js
├── README.md
└── src/
    ├── index.html
    ├── renderer.js
    └── styles.css

```

## License

MIT

## Release 1.2.0

Version 1.2.0 improves tab creation, naming, and drag-and-drop organization:

- Fixed the plus button so it opens a new tab.
- Added a greyed-out tab preview while dragging.
- Constrained tab dragging to the sidebar rail so tabs move only up and down within their panel.
- Preserved the tab reorder placeholder and existing drag-and-drop behavior.
