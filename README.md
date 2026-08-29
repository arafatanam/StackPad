# StackPad

A minimal desktop note-taking app for fast writing, clean organization, and distraction-free editing.

StackPad is built for users who want a simple writing experience with a polished desktop layout, quick note tabs, and essential formatting without unnecessary clutter.

## Features

- H1, H2, and Body text modes
- Light, Dark, and System theme support
- Multiple tabs for managing notes
- Save, save as, print, and local draft support
- Find, replace, go to line, and word wrap
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

This generates the installer file inside the `dist` folder, which can then be installed and used on a Windows PC.

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
