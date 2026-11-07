# iPhone builds and App Store releases (EAS)

## What this file is for

This is the step-by-step guide for every kind of iOS build of the mobile app (`apps/mobile`). Follow it whenever you need to:

- put a **development build** on your iPhone, to try changes from this PC;
- make a **simulator build**, for iPad screenshots or for a Mac's iOS Simulator;
- make a **production build** and **submit it to App Store Connect** (TestFlight, then App Review);
- send a **JavaScript-only fix** to people who already have the app (EAS Update).

No Mac is needed. Expo's EAS Build compiles the app in the cloud, and EAS Submit uploads it to Apple. Every command runs **from `apps/mobile`**, where `eas.json` lives:

```powershell
cd C:\Users\mhmdt\imenu\quran-classes-tracker\apps\mobile
```

`eas-cli` isn't installed in the repo. `npx eas-cli …` always fetches the latest version, which is what Expo recommends.

The Android guide is in [android-builds.md](android-builds.md). Store texts, review notes and privacy answers are in [../store/app-store.md](../store/app-store.md).

## The app's facts

| What                  | Value                                                         |
| --------------------- | ------------------------------------------------------------- |
| Expo project          | `@imenu/quran-classes-tracker` (owner `imenu`)                |
| Bundle identifier     | `ai.imenu.quran`                                              |
| Name on the App Store | Quran Memorization (home screen name: تحفيظ القرآن)           |
| Production server     | `https://quran.imenu.ai` (set per profile in `eas.json`)      |
| App version           | `version` in `app.json` (also kept in `package.json`)         |
| Build number          | kept by EAS (`appVersionSource: remote`); goes up by itself   |
| OTA runtime version   | follows the app version (`runtimeVersion.policy: appVersion`) |

## The build profiles (`eas.json`)

| Profile       | What you get                                                                               | Runs on                           | Server it talks to                                                    | Update channel |
| ------------- | ------------------------------------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------- | -------------- |
| `development` | A **dev client**: the app's native shell, which loads its JavaScript from Metro on this PC | Registered iPhones and iPads      | `EXPO_PUBLIC_API_URL` from `apps/mobile/.env.local` when Metro starts | `development`  |
| `simulator`   | A release build for the **iOS Simulator** (`.tar.gz` with the `.app`, unsigned)            | A Mac's Simulator, or Appetize.io | `https://quran.imenu.ai`                                              | `production`   |
| `preview`     | A release build for **registered devices** (ad hoc), outside the App Store                 | Registered iPhones and iPads      | `https://quran.imenu.ai`                                              | `preview`      |
| `production`  | The **App Store** build                                                                    | TestFlight, then the App Store    | `https://quran.imenu.ai`                                              | `production`   |

The release profiles (`simulator`, `preview`, `production`) talk to **production data**. Sign in to them with the demo center (code `689723`) or a test center, not a real one.

## Once per computer and account

1. **Apple Developer Program.** You need the paid membership. It already exists for this app.
2. **Expo account.** It must have access to the `imenu` organization:

   ```powershell
   npx eas-cli login
   npx eas-cli whoami      # shows your user and the imenu organization
   ```

3. **Dependencies.** Run `pnpm install` from the repo root, and again after pulling changes.

---

## A. A development build on your iPhone

Use it to try code from this PC on a real iPhone. Its JavaScript comes from Metro, so code changes show up without a new build. A **new build** is needed only when something native changes:

- a new native library (anything installed with `expo install` that has iOS code);
- a change to `app.json` or to a config plugin (`plugins/`);
- an Expo SDK upgrade.

### A1. Register the iPhone (once per device)

```powershell
npx eas-cli device:create
```

1. Choose **Website** and sign in with your Apple ID when asked.
2. Open the link it prints **on the iPhone**, in Safari.
3. Install the profile. Go to Settings → General → **VPN & Device Management** and finish installing it there.
4. Turn on **Developer Mode** (iOS 16 and later). Go to Settings → Privacy & Security → **Developer Mode**, switch it on, restart the phone, and confirm.

   This setting only shows up after a development or ad hoc build has been installed once. If you don't see it, do step A2 first, then come back.

To see the registered devices, run `npx eas-cli device:list`.

### A2. Build

```powershell
npx eas-cli build --profile development --platform ios
```

The first time, and whenever the certificate or provisioning profile needs renewing:

- **"Do you want to log in to your Apple account?"** Yes. Sign in and enter the two-factor code.
- **Let EAS manage the distribution certificate and provisioning profile.** Yes.
- **"Select devices for the ad hoc build".** Tick every iPhone or iPad that should run this build.

  A device registered later isn't in the old profile. Register it, build again, and say yes when EAS offers to update the profile.

The build takes 10–30 minutes. Follow it at the link the command prints (expo.dev → the project → Builds).

### A3. Install it

When the build is done, open its page on the iPhone (the link or QR code the command printed, or expo.dev → Builds) and tap **Install**. The app shows up on the home screen as تحفيظ القرآن.

### A4. Point it at a server

The dev build reads `EXPO_PUBLIC_API_URL` from `apps/mobile/.env.local` **when Metro starts**; `.env.local` takes precedence over `apps/mobile/.env`. Create the file from the example if it's missing:

```powershell
Copy-Item .env.example .env.local
```

Set it to one of:

| Server                                                           | `EXPO_PUBLIC_API_URL`                                                        |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Your `pnpm dev` on this PC (port 3000), iPhone on the same Wi-Fi | `http://<this PC's Wi-Fi IP>:3000` (find it with `ipconfig`, "IPv4 Address") |
| Production (real data, careful)                                  | `https://quran.imenu.ai`                                                     |

If the iPhone can't reach the PC, Windows Firewall is blocking it. Allow Node.js on **private** networks: Windows Security → Firewall → Allow an app.

### A5. Start Metro and open the app

From the repo root:

```powershell
pnpm mobile
```

Open the app on the iPhone. It lists the Metro server it finds on the network; tap it. If nothing shows up, scan the QR code that Metro prints with the iPhone's Camera.

Two variants run from `apps/mobile`:

- **Different networks**, or the Wi-Fi blocks devices from seeing each other: `pnpm exec expo start --dev-client --tunnel`. The first time, it asks to install `@expo/ngrok`.
- **A change doesn't show**, or after changing `.env.local`: `pnpm exec expo start --dev-client --clear`, then close and reopen the app.

Development builds have two extra checks in Settings: the local classes with an "add" button, which shows that writes sync, and an Intl check (plurals, dates and direction).

---

## B. A simulator build

**Windows has no iOS Simulator.** There are two ways to run this build:

- **Appetize.io**, in the browser. This is how the iPad screenshots were taken.
- **A Mac with Xcode installed.**

### B1. Build

```powershell
npx eas-cli build --profile simulator --platform ios
```

It needs no Apple sign-in and no certificates, because simulator builds are unsigned. The result is a `.tar.gz` holding `Quran Memorization.app`, and it talks to the production server.

### B2a. Run it on Appetize (no Mac)

1. Download the `.tar.gz` from the build page (expo.dev → Builds → the build → **Download**).
2. Go to <https://appetize.io/upload>, upload the file, and open the link it gives you.
3. Pick a device, for example **iPad Pro 13"** for App Store iPad screenshots, or an iPhone.
4. Sign in with the demo center and take screenshots from Appetize's toolbar.

The screenshot list and the sizes Apple asks for are in [../store/app-store.md](../store/app-store.md).

### B2b. Run it on a Mac

Start a simulator in Xcode (Xcode → Open Developer Tool → Simulator), then, from a clone of the repo on the Mac, in `apps/mobile`:

```sh
npx eas-cli build:run --platform ios --latest
```

It downloads the latest simulator build and installs it into the simulator that's running. Another way: unpack the `.tar.gz` and drag the `.app` onto the simulator window.

### Optional: a dev client in the simulator

The `simulator` profile is a release build. If you ever want the dev client in a simulator (code from Metro, like section A), add this profile to `eas.json`:

```json
"development-simulator": {
  "extends": "development",
  "ios": { "simulator": true }
}
```

Then build it with `npx eas-cli build --profile development-simulator --platform ios`.

---

## C. A production build and App Store submission

### C1. Before you build (every release)

1. **The code is ready.** From the repo root, `pnpm lint && pnpm typecheck && pnpm test` pass, and the device checks in the README ("Checks on an iPhone and an iPad") are done on a development build.
2. **The web app is deployed first.** The release build talks to `https://quran.imenu.ai`. The server must already accept the new app's data, and App Review opens the `/privacy` and `/support` pages.
3. **Bump the version** in **both** `apps/mobile/app.json` and `apps/mobile/package.json`, for example `1.1.0` → `1.2.0`. Every App Store release needs a version higher than the last one.
   - You never touch the build number: EAS raises it on each production build.
   - The runtime version follows the app version. EAS Updates for the old version therefore never reach the new build, and the new build's updates never reach old installs.
4. **Write "What's new"** in Arabic and English in [../store/app-store.md](../store/app-store.md).
5. **Commit, and build from a clean tree.** EAS uploads the project as it is on disk, without the files in `.gitignore` (so `.env.local` stays behind). A clean, committed tree means the build matches a commit.

### C2. Build

```powershell
npx eas-cli build --profile production --platform ios
```

1. Sign in with your Apple ID and enter the two-factor code when asked.
2. Let EAS reuse the existing **distribution certificate** and **App Store provisioning profile**. Apple certificates last a year; when one expires, EAS offers to make a new one, so say yes.
3. Wait 10–30 minutes. The build page shows the version and build number, for example "1.1.0 (3)".

### C3. Submit to App Store Connect

```powershell
npx eas-cli submit --profile production --platform ios --latest
```

`--latest` picks the newest iOS build on EAS. Answer the prompts:

- **Apple ID**: your developer account.
- **App Store Connect app**: choose the existing app (`ai.imenu.quran`).
- **App Store Connect API key**: let EAS create and keep one. Later submits won't ask for your password again.

To build and submit in one go, add `--auto-submit` to the build command in C2.

To skip the app question next time, put the app's Apple ID number in `eas.json`. Find it in App Store Connect → the app → App Information → **Apple ID**, for example `6740000000`:

```json
"submit": {
  "production": {
    "ios": { "ascAppId": "<the number>" }
  }
}
```

**"This bundle version has already been used"** means that build number is already in App Store Connect, typically because an earlier submit already uploaded it. Look in TestFlight: the build is probably there already. If it isn't, run C2 again for a new number.

### C4. TestFlight

1. App Store Connect emails you when the build has been processed, usually 5–30 minutes after the upload. It then shows under **TestFlight**.
2. The export compliance question is answered in the build, because `ITSAppUsesNonExemptEncryption` is `false` in `app.json`. If App Store Connect still asks, the answer is "None of the algorithms mentioned above".
3. Install it on your iPhone with the **TestFlight** app (internal testing, your account). Run through the main flow against production with the demo center.

### C5. Submit for review

In App Store Connect → Apps → Quran Memorization:

1. **Create the version.** Click **+** next to "iOS App" and enter the same version as in `app.json` (for example `1.1.0`).
2. **What's New in This Version.** Paste it in Arabic and English from `store/app-store.md`. Switch the language at the top right of the page.
3. **Build.** Click **Add Build** and choose the build from C3.
4. **Screenshots and description.** Change them only if the app changed visibly; otherwise the previous version's carry over.
5. **App Review Information.** Check that the demo center (code `689723`, users `demo_admin` and `demo_teacher`) still exists and that the passwords there are right; the passwords are in no file. If a reviewer deleted the center, the README ("The demo center for App Review") says how to recreate it.
6. **Version Release.** Choose manual (you press "Release" after approval) or automatic.
7. Click **Add for Review**, then **Submit for Review**.

Review usually takes one to three days; 1.0.0 took two. If Apple rejects the build, the reason shows in App Store Connect → the app → **App Review**. Fix it, then build and submit again from C2 with the same version (the build number goes up).

---

## D. JavaScript-only fixes (EAS Update)

A fix that changes only JavaScript or TypeScript (no native library, no `app.json` change) can reach installed apps without a store release:

```powershell
# First on the preview channel, if you have a preview build to try it on:
npx eas-cli update --channel preview --message "fix: …"

# Then to the App Store app:
npx eas-cli update --channel production --message "fix: …"
```

- It reaches only builds with the **same app version** (runtime version). An update published while `app.json` says `1.1.0` reaches 1.1.0 builds only.
- The app downloads the update when it starts and uses it from the next start.
- By default this publishes for iOS and Android. Add `--platform ios` to limit it.
- To undo a bad update, see expo.dev → the project → Updates, or run `npx eas-cli update:republish` with an earlier update.
- Don't use it for changes that need the server to change too, unless the web app is deployed first.

---

## Troubleshooting

| Problem                                                            | Fix                                                                                                                               |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| "Unable to install" when installing a development or preview build | The device isn't in the build's provisioning profile: `npx eas-cli device:create`, build again, and tick the device.              |
| The app opens and closes at once (development build)               | Developer Mode is off: Settings → Privacy & Security → Developer Mode.                                                            |
| The dev build can't find Metro                                     | Same Wi-Fi? Firewall allows Node on private networks? Otherwise use `--tunnel` (A5).                                              |
| Sign-in says there's no connection (dev build)                     | `EXPO_PUBLIC_API_URL` in `.env.local` must be the PC's Wi-Fi IP, not `localhost`. Restart Metro with `--clear` after changing it. |
| A native change (new library, `app.json`) doesn't show up          | That needs a new development build (A2). Metro only reloads JavaScript.                                                           |
| Apple sign-in fails, or credentials look wrong                     | `npx eas-cli credentials` → iOS → the profile, to see or replace the certificate and profile.                                     |
| "This bundle version has already been used"                        | See C3: the build is already uploaded.                                                                                            |
| An EAS Update doesn't reach a phone                                | Is the app version the same? Has the app been closed fully and opened twice? Is it a `production` build (the channel)?            |
