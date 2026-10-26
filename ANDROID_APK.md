# FNFCOV Converter for Android

FNFCOV's existing React/Vite application can be packaged as an Android app with Capacitor. The APK uses the same converter interface and conversion code as the web build; this does not make unsupported Psych Engine features magically compatible.

## Automated APK build

The `Android APK` GitHub Actions workflow builds a debug APK on pushes to feature/fix branches, pull requests, or a manual workflow dispatch.

1. Open the repository's **Actions** tab.
2. Select **Android APK** and open the newest successful run.
3. Under **Artifacts**, download `FNFCOV-Converter-Android-debug`.
4. Extract the downloaded ZIP and install `app-debug.apk` on Android. If prompted, allow installation from that file manager/browser.

A debug APK is for testing, not a signed public release. The artifact is retained for 14 days.

## Local build requirements

- Node.js 20+ and Bun
- Java 21
- Android SDK and platform tools

Run:

```sh
bun install --frozen-lockfile
npm install --no-save --package-lock=false @capacitor/core@7 @capacitor/android@7 @capacitor/cli@7
bun run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Current limitations

- Conversion support is limited to the features implemented by FNFCOV.
- Test the APK with sample mods before trusting converted output.
- The first automated build is the point to verify Android SDK/Gradle compatibility; a successful source-code commit alone does not prove the APK built.
