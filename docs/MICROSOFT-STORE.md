# Publishing StackPad on the Microsoft Store

The installer on the website isn't code-signed, so Windows SmartScreen shows "Windows protected your PC" the first time someone runs it (they continue with **More info → Run anyway**). The Microsoft Store avoids that: it's free for individual developers, Microsoft signs the package itself, and people can find StackPad by searching the Store.

The build is already set up for it. Once the three repository variables below are set, every tagged release also produces a Store package.

### 1. Create a developer account

1. Go to <https://storedeveloper.microsoft.com> and choose **Individual developer**.
2. Sign in with a Microsoft account and verify your identity (a government ID and a selfie). Registration is free for individuals.
3. Once verified, you land in **Partner Center** (<https://partner.microsoft.com/dashboard>).

### 2. Reserve the name

1. In Partner Center, open **Apps and games → New product → MSIX or PWA app**.
2. Reserve the name **StackPad**. If it's taken, try "StackPad Notepad".

> Choose **MSIX**, not "EXE or MSI". For EXE/MSI listings the Store requires *you* to sign the installer with a paid certificate, which is the problem we're trying to avoid. With MSIX, Microsoft signs it for you.

### 3. Copy the package identity into GitHub

1. In the new product, open **Product management → Product identity**. You'll see three values:
   - `Package/Identity/Name` (something like `12345ArafatAnamChowdhury.StackPad`)
   - `Package/Identity/Publisher` (something like `CN=1A2B3C4D-...`)
   - `Package/Properties/PublisherDisplayName`
2. On GitHub, open the repository → **Settings → Secrets and variables → Actions → Variables** tab, and add three **repository variables**:

   | Variable | Value |
   | --- | --- |
   | `MS_STORE_IDENTITY_NAME` | `Package/Identity/Name` |
   | `MS_STORE_PUBLISHER` | `Package/Identity/Publisher` (including `CN=`) |
   | `MS_STORE_PUBLISHER_DISPLAY_NAME` | `Package/Properties/PublisherDisplayName` |

   These aren't secrets, which is why they're variables.

3. Optional: put the same values in the `appx` section of `package.json`, in place of the `REPLACE...` placeholders, so `npm run dist:store` works on your own PC too.

From now on, every tagged release also builds a Store package. It appears as **microsoft-store-package** under the workflow run's artifacts.

### 4. Build the first package

Push the release tag (see [CONTRIBUTING.md](../CONTRIBUTING.md#making-a-release-maintainers)), or open **Actions → Build installers → Run workflow**. When the run finishes, download the `microsoft-store-package` artifact and unzip it to get `StackPad.v2.2.0.appx`.

### 5. Fill in the submission

In Partner Center, open StackPad and **Start your submission**:

- **Pricing and availability:** Free, all markets.
- **Properties:** category **Productivity** (subcategory none) or **Utilities & tools**. Privacy policy URL: `https://stackpad-app.vercel.app/privacy.html`. Website: `https://stackpad-app.vercel.app/`. Support contact: `https://github.com/arafatanam/StackPad/issues`.
- **Age ratings:** answer the questionnaire. StackPad has no user interaction, sharing, purchases or location, so it gets the lowest rating.
- **Packages:** upload the `.appx`. Partner Center checks that its identity matches the reservation.
- **Store listings → English:**
  - *Description:* reuse the opening of the README.
  - *What's new:* the latest CHANGELOG section.
  - *Screenshots:* at least one, 1366×768 or larger. `website/assets/screenshot-light.png` and `screenshot-dark.png` work.
  - *Short description:* "A fast, offline notepad with vertical tabs and tab groups."
- **Submission options → Notes for certification:**

  > StackPad is an Electron desktop app packaged as MSIX. The `runFullTrust` restricted capability is required because it is a full-trust desktop (Win32) app. It reads and writes text files the user opens, and it has no accounts, sign-in or network features apart from links that open in the browser. Its built-in auto-updater is disabled in the Store build; updates come through the Store.

Submit. Certification usually takes 1–3 business days. You'll get an email if anything needs changing.

### 6. Connect the website

When the listing is live, copy its URL (`https://apps.microsoft.com/detail/...`) into `STORE_URL` near the top of `website/assets/site.js`. The "Get it from Microsoft" button then appears on the website.

### Later releases

Each release: download the new `microsoft-store-package` artifact, open **Partner Center → StackPad → Update** on the last submission, replace the package, update "What's new", and submit. The Store version number must always go up, which the normal version bump takes care of.
