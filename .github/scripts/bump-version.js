#!/usr/bin/env node
/**
 * Bakes the CI build number into app.json before `expo prebuild`, so the APK,
 * the IPA and the web bundle all carry the same version.
 *
 *   APP_VERSION      1.2.3   (default: whatever app.json already has)
 *   APP_VERSION_CODE 42      (default: whatever app.json already has;
 *                             Android needs a positive integer that never
 *                             goes backwards — the workflow passes the
 *                             GitHub run number)
 *
 * Safe to run more than once and safe to run locally: with no environment
 * variables set it only fills in the iOS bundle identifier if it is missing.
 */
const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', '..', 'app.json');
const json = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const expo = (json.expo = json.expo || {});

const version = (process.env.APP_VERSION || '').trim();
const code = Number.parseInt((process.env.APP_VERSION_CODE || '').trim(), 10);
const hasCode = Number.isInteger(code) && code > 0;

if (version) {
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    console.error(`APP_VERSION "${version}" does not look like a version (expected 1.2.3)`);
    process.exit(1);
  }
  expo.version = version;
}

expo.android = expo.android || {};
if (hasCode) expo.android.versionCode = code;

expo.ios = expo.ios || {};
if (!expo.ios.bundleIdentifier) {
  // Expo normally derives this from android.package; pin it so EAS/CI agree.
  expo.ios.bundleIdentifier = expo.android.package || 'com.hansaka01.aicroprobot';
}
if (hasCode) expo.ios.buildNumber = String(code);

fs.writeFileSync(appJsonPath, JSON.stringify(json, null, 2) + '\n');

console.log(
  `app.json → version ${expo.version}, android.versionCode ${expo.android.versionCode}, ` +
    `ios.buildNumber ${expo.ios.buildNumber}, ios.bundleIdentifier ${expo.ios.bundleIdentifier}`
);
