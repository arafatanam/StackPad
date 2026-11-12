# Security policy

## Supported versions

Only the latest release of StackPad receives fixes. StackPad updates itself automatically (unless you've turned that off in the Help menu), so staying current is usually automatic.

## Reporting a vulnerability

**Please don't report security problems in public issues.**

Use GitHub's private reporting instead: go to the [Security tab](https://github.com/arafatanam/StackPad/security), choose **Report a vulnerability**, and describe:

- what the problem is and what an attacker could do with it,
- the steps or a file that reproduces it,
- the StackPad version (**Help → About StackPad → Copy details**) and your operating system.

You can expect a first reply within 7 days. Once a fix is released, you'll be credited in the changelog unless you'd rather not be.

## Scope

Examples of what counts:

- opening a crafted text file that makes StackPad run code, read other files or crash in a way that loses data,
- a way for the window's page to reach Node.js or the file system beyond the preload bridge,
- problems with how updates are downloaded or verified.

Problems in Electron or Chromium themselves should be reported to those projects. StackPad picks up their fixes when it updates Electron.
