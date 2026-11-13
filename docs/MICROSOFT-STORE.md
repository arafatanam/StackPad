# Publishing StackPad on the Microsoft Store

**Live listing:** <https://apps.microsoft.com/detail/9NBDRFL8LM3D> (Store ID `9NBDRFL8LM3D`, published 2026-11-13).

The installer on the website isn't code-signed, so Windows SmartScreen shows "Windows protected your PC" the first time someone runs it (they continue with **More info → Run anyway**). The Microsoft Store avoids that: it's free for individual developers, Microsoft signs the package itself, and people can find StackPad by searching the Store.

The build is already set up for it: every release also produces a Store package.

### 1. Create a developer account

1. Go to <https://storedeveloper.microsoft.com> and choose **Individual developer**.
2. Sign in with a Microsoft account and verify your identity (a government ID and a selfie). Registration is free for individuals.
3. Once verified, you land in **Partner Center** (<https://partner.microsoft.com/dashboard>).

### 2. Reserve the name

1. In Partner Center, open **Apps and games → New product → MSIX or PWA app**.
2. Reserve the name **StackPad**. If it's taken, try "StackPad Notepad".

> Choose **MSIX**, not "EXE or MSI". For EXE/MSI listings the Store requires *you* to sign the installer with a paid certificate, which is the problem we're trying to avoid. With MSIX, Microsoft signs it for you.

### 3. Put the package identity in the app

In Partner Center, **Product management → Product identity** shows the package name, publisher ID and publisher display name. They're already in the `appx` section of `package.json`:

| Partner Center | `package.json` → `build.appx` |
| --- | --- |
| Package/Identity/Name | `identityName`: `ArafatAnamChowdhury.StackPadNotesMadeSimple` |
| Package/Identity/Publisher | `publisher`: `CN=D1A70030-BB93-4B85-A43C-720FD9773464` |
| Package/Properties/PublisherDisplayName | `publisherDisplayName`: `Arafat Anam Chowdhury` |
| Reserved app name | `displayName`: `StackPad – Notes, Made Simple` |

These aren't secret. Every build on GitHub Actions now also produces the Store package, as the **microsoft-store-package** artifact. To build it locally, run `npm run dist:store`.

### 4. Build the first package

Push the release tag (see [CONTRIBUTING.md](../CONTRIBUTING.md#making-a-release-maintainers)), or open **Actions → Build installers → Run workflow**. When the run finishes, download the `microsoft-store-package` artifact and unzip it to get `StackPad.v2.2.0.appx`.

### 5. Fill in the submission

In Partner Center, open StackPad and **Start your submission**:

- **Pricing and availability:** Free, all markets.
- **Properties:** category **Productivity** (subcategory none) or **Utilities & tools**. Privacy policy URL: `https://getstackpad.vercel.app/privacy.html`. Website: `https://getstackpad.vercel.app/`. Support contact: `https://github.com/arafatanam/StackPad/issues`.
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

### 7. Automatic Store updates (one-time setup)

After this, every version tag submits the new package to the Store, with that version's CHANGELOG notes as "What's new", without anyone opening Partner Center.

1. **Connect a Microsoft Entra ID tenant.** In Partner Center: **Settings (gear) → Account settings → Organization profile → Tenants**. Associate an existing tenant, or choose **Create new tenant** and follow the steps.
2. **Create the app access.** **Account settings → User management → Microsoft Entra applications → Create Microsoft Entra application**. Name it `StackPad GitHub`, give it the **Manager** role, and save.
3. Open the new application. Note its **Tenant ID** and **Client ID**, then click **Add new key** and copy the key. It's shown only once.
4. **Seller ID:** **Account settings → Legal info → Developer** tab.
5. **Store ID:** the app's **Product management → Product identity** page (it starts with `9`).
6. In the repository, set these secrets: `PARTNER_CENTER_TENANT_ID`, `PARTNER_CENTER_SELLER_ID`, `PARTNER_CENTER_CLIENT_ID`, `PARTNER_CENTER_CLIENT_SECRET` (the key from step 3). Also set the variable `MS_STORE_PRODUCT_ID` (the Store ID). For example:

   ```bash
   gh secret set PARTNER_CENTER_CLIENT_SECRET   # paste the key when asked
   gh variable set MS_STORE_PRODUCT_ID --body 9XXXXXXXXXXX
   ```

The Store accepts a new submission only when the previous one has finished certification. If a release is tagged while one is still in review, the Store step fails and the package can be submitted by hand (below) once the review is done.

### Submitting by hand

Download the **microsoft-store-package** artifact from the workflow run, open **Partner Center → StackPad → Update** on the last submission, replace the package, update "What's new", and submit. The Store version number must always go up, which the normal version bump takes care of.
