# Code signing and the Microsoft Store

Without a signature, Windows SmartScreen shows "Windows protected your PC" to everyone who downloads StackPad, and many people stop there. There are two free ways to fix that, and StackPad's build is set up for both:

| | Microsoft Store | SignPath Foundation |
| --- | --- | --- |
| **Cost** | Free for individual developers | Free for open-source projects |
| **What gets signed** | The Store package, signed by Microsoft | The `.exe` installer on your website and GitHub |
| **SmartScreen** | No warning at all | Signed by "SignPath Foundation". The warning usually disappears, since that certificate already has reputation, though Microsoft doesn't guarantee it |
| **Updates** | The Store updates the app | StackPad's own auto-updater |
| **Approval** | Store certification, usually 1–3 days per release | A one-time application, which can take a few weeks; then you approve each release |
| **Extra benefit** | People can find StackPad by searching the Store | Signed downloads from your own site |

**Recommendation: do both, starting with the Store.** The Store is the fastest way to give Windows users a warning-free install, and the website will show a "Get it from Microsoft" button as soon as you add the Store link. Apply to SignPath at the same time. Once it's approved, the direct download is signed as well, and nothing in the build needs to change.

---

## Part 1: Microsoft Store

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

---

## Part 2: SignPath Foundation (signing the website download)

[SignPath Foundation](https://signpath.org) gives open-source projects a free code signing certificate. The certificate belongs to the Foundation, so Windows shows the publisher as **"SignPath Foundation"**. In return, the Foundation checks that what it signs is built from your public source code.

### 1. Check the requirements

SignPath Foundation checks these before approving a project (see <https://signpath.org/terms> for the current list). StackPad already meets the ones marked ✓:

- ✓ An OSI-approved open-source license (MIT), with no proprietary parts
- ✓ The software is already released and actively maintained
- ✓ Built on a public CI system from the public repository (GitHub Actions)
- ✓ A privacy statement saying what the program sends over the network ([PRIVACY.md](../PRIVACY.md))
- ☐ A **code signing policy** published on the website. One is prepared and switched off in `website/privacy.html`; turn it on once you're approved (step 4)
- ☐ Two-factor authentication on your GitHub account (Settings → Password and authentication)

### 2. Apply

1. Fill in the application form linked from <https://signpath.org> ("Apply" / "Get started for open source").
2. Give:
   - Repository: `https://github.com/arafatanam/StackPad`
   - Website: `https://stackpad-app.vercel.app/`
   - Build system: GitHub Actions (`.github/workflows/build.yml`)
   - What gets signed: the Windows app `StackPad.exe` and the installer `StackPad.v<version>.exe`
3. Wait for approval. It can take a few weeks. They may ask questions by email.

### 3. Set up the project on SignPath

Once you're approved, SignPath creates an organization for you on <https://app.signpath.io>. In it:

1. **Connect GitHub.** Under **Trusted Build Systems**, link GitHub.com and allow the StackPad repository. That's how SignPath confirms that signing requests come from your real workflow.
2. **Create a project** with the slug `stackpad`, linked to the repository.
3. **Add an artifact configuration** (set it as the default) with:

   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <artifact-configuration xmlns="http://signpath.io/artifact-configuration/v1">
     <zip-file>
       <pe-file path="*.exe">
         <authenticode-sign />
       </pe-file>
     </zip-file>
   </artifact-configuration>
   ```

   GitHub delivers each artifact as a ZIP, and this signs the single `.exe` inside it. The same configuration works for both `StackPad.exe` and the installer.

4. **Signing policies:** the Foundation sets up `release-signing`. It uses the Foundation's certificate and needs you to approve each request.
5. **Create an API token:** add a **CI user** under **Users**, give it *Submitter* permission on the `release-signing` policy, and generate its API token.

### 4. Switch it on in GitHub

In the repository's **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `SIGNPATH_API_TOKEN` | the CI user's API token |
| Variable | `SIGNPATH_ORGANIZATION_ID` | your organization ID (shown in SignPath's URL and settings) |
| Variable | `SIGNPATH_PROJECT_SLUG` | `stackpad` |
| Variable | `SIGNPATH_SIGNING_POLICY_SLUG` | `release-signing` |

Then publish the signing policy on the website: in `website/privacy.html`, remove the `<!-- SIGNPATH` and `SIGNPATH -->` lines around the **Code signing policy** section. Finally, set `SIGNED = true` near the top of `website/assets/site.js`. That removes the "Windows protected your PC" instructions from the download steps and the FAQ.

### 5. How a signed release works

When you push a version tag, the Windows job in [build.yml](../.github/workflows/build.yml):

1. packages the app folder and sends `StackPad.exe` to SignPath,
2. waits while you **approve the request** on app.signpath.io (you get an email; the job waits up to an hour),
3. builds the setup wizard around the signed app and sends the installer to SignPath for a second approval,
4. runs `scripts/refresh-update-info.js`, which rewrites the checksum in `latest.yml` and rebuilds the `.blockmap`. Signing changes the file, and without this the auto-updater would reject the download,
5. attaches everything to the draft release.

When the secret isn't set, the same workflow skips the signing steps and builds unsigned installers, exactly as before.

### Checking a signed file

On Windows, right-click the installer → **Properties → Digital Signatures**. It should list "SignPath Foundation" with a valid timestamp. Or in PowerShell:

```powershell
Get-AuthenticodeSignature ".\StackPad.v2.2.0.exe" | Format-List
```

---

## Why not buy a certificate?

Standard (OV) code signing certificates cost about $200–$400 a year, must now live on a hardware token or cloud HSM, and still start with no SmartScreen reputation. EV certificates no longer skip SmartScreen either. Azure Trusted Signing (about $10/month) is a good paid option if SignPath ever stops fitting, but between them, the Store and SignPath cover StackPad for free.
