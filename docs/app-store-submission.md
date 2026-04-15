# App Store Submission Guide

Internal reference for publishing OKrunit to the Apple App Store and Google Play Store.

## Architecture

The native apps use Capacitor to wrap `https://okrunit.com` in a native shell. There is no static export or separate codebase. Web updates deploy to Vercel as normal and the native apps pick them up immediately.

Native projects live in `ios/` and `android/` (gitignored). Regenerate them with:

```bash
npx cap add ios
npx cap add android
npx cap sync
```

## Prerequisites

| Requirement | iOS | Android |
|---|---|---|
| Developer account | [Apple Developer Program](https://developer.apple.com/programs/) ($99/year) | [Google Play Console](https://play.google.com/console/) ($25 one-time) |
| IDE | Xcode (Mac App Store, free) | [Android Studio](https://developer.android.com/studio) (free) |
| Push service | Apple Push Notification service (APNs), configured in Apple Developer portal | Firebase Cloud Messaging (FCM), create project at [Firebase Console](https://console.firebase.google.com/) |

## iOS: Apple App Store

### 1. Set up signing

1. Open the project: `npm run cap:ios`
2. In Xcode, select the **App** target, go to **Signing & Capabilities**.
3. Select your Team (Apple Developer account).
4. Set the Bundle Identifier to `com.okrunit.app`.
5. Xcode will auto-provision signing certificates for development.

### 2. Enable push notifications

1. In **Signing & Capabilities**, click **+ Capability**.
2. Add **Push Notifications**.
3. Add **Background Modes** and check **Remote notifications**.
4. In the [Apple Developer portal](https://developer.apple.com/account/resources/identifiers/), create an APNs key:
   - Go to **Keys** > **Create a Key**.
   - Enable **Apple Push Notifications service (APNs)**.
   - Download the `.p8` key file. You will need this on your server to send push notifications.
5. Note the Key ID and your Team ID.

### 3. Configure the app

The following are already set in `ios/App/App/Info.plist`:
- `UIBackgroundModes`: `remote-notification`
- `ITSAppUsesNonExemptEncryption`: `NO` (avoids export compliance questionnaire)
- `NSAppTransportSecurity`: Allows web content loading

### 4. App Store Connect setup

1. Go to [App Store Connect](https://appstoreconnect.apple.com/).
2. Create a new app with Bundle ID `com.okrunit.app`.
3. Fill in the required metadata:
   - **App Name**: OKrunit
   - **Subtitle**: Human approval for automations
   - **Category**: Business / Productivity
   - **Description**: OKrunit is a human-in-the-loop approval gateway for automated workflows. Pause AI agents, Zapier zaps, Make scenarios, and n8n workflows until a human approves. One dashboard for every workflow that needs a second pair of eyes.
   - **Keywords**: approval, automation, human-in-the-loop, workflow, zapier, make, n8n, ai safety
   - **Privacy Policy URL**: https://okrunit.com/privacy
   - **Support URL**: https://okrunit.com/contact
4. Upload screenshots (required sizes: 6.7" iPhone, 6.5" iPhone, 12.9" iPad).

### 5. Build and submit

1. In Xcode, set the target device to **Any iOS Device (arm64)**.
2. Go to **Product > Archive**.
3. Once archived, click **Distribute App > App Store Connect**.
4. Upload the build.
5. In App Store Connect, select the uploaded build, complete the review questionnaire, and click **Submit for Review**.

### 6. App Review notes

Include these in the review notes to avoid rejection:
- "This app loads content from our web application at https://okrunit.com. It requires an account to use. You can create a free account at the login screen."
- Provide a demo account if possible (email/password for a test org).
- Explain that push notifications are used for approval requests that need human review.

## Android: Google Play Store

### 1. Set up Firebase (for push notifications)

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project named "OKrunit".
2. Add an Android app with package name `com.okrunit.app`.
3. Download `google-services.json` and place it in `android/app/`.
4. The Capacitor Push Notifications plugin will pick it up automatically.

### 2. Open and configure

1. Open the project: `npm run cap:android`
2. Verify the package name is `com.okrunit.app` in `android/app/build.gradle`.
3. The theme colors are already set in `android/app/src/main/res/values/colors.xml` (OKrunit green #2e7d32).

### 3. Generate a signed release build

1. In Android Studio, go to **Build > Generate Signed Bundle / APK**.
2. Choose **Android App Bundle** (required by Google Play).
3. Create a new keystore or use an existing one:
   - **Keystore path**: Store this securely, you need it for every update.
   - **Key alias**: `okrunit`
   - **Passwords**: Store these securely.
4. Build the release AAB.

Alternatively, from the command line:

```bash
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### 4. Google Play Console setup

1. Go to [Google Play Console](https://play.google.com/console/).
2. Create a new app:
   - **App name**: OKrunit
   - **Category**: Business / Productivity
   - **Description**: Same as iOS above.
   - **Privacy Policy URL**: https://okrunit.com/privacy
3. Complete the content rating questionnaire.
4. Complete the data safety section:
   - The app collects email addresses and names for account management.
   - Data is encrypted in transit.
   - Users can request data deletion.
5. Upload screenshots (phone and 7" / 10" tablet).

### 5. Submit for review

1. Go to **Release > Production**.
2. Upload the signed AAB.
3. Add release notes (e.g., "Initial release of OKrunit for Android").
4. Submit for review.

Android review is typically faster than Apple (hours vs. days).

## Post-release maintenance

### Updating the app

Since the native apps load from `https://okrunit.com`, most updates require zero app store changes. Just deploy to Vercel.

You only need a new app store release when:
- Adding new Capacitor plugins (native permissions change)
- Updating the Capacitor version
- Changing the app icon or splash screen
- Apple/Google require SDK updates

When you do need to update:

```bash
npx cap sync         # Sync plugins and config
npm run cap:ios      # Open Xcode, bump version, archive, submit
npm run cap:android  # Open Android Studio, bump version, build AAB, submit
```

### Version numbering

- iOS: Set **Marketing Version** (e.g., 1.0.0) and **Current Project Version** (build number, e.g., 1) in Xcode.
- Android: Set `versionName` and `versionCode` in `android/app/build.gradle`.

Bump the build number for every submission, even if the version name stays the same.
