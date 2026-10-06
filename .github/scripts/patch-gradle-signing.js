#!/usr/bin/env node
/**
 * Teaches the freshly generated (git-ignored) android/app/build.gradle how to
 * sign the release build with YOUR keystore, without ever breaking the build
 * when no keystore is provided.
 *
 * How it works, after this script has run once:
 *
 *   release {
 *       def ciKeystore = System.getenv("CHR_RELEASE_STORE_FILE")
 *       if (ciKeystore != null && file(ciKeystore).exists()) {
 *           ... your keystore ...
 *       } else {
 *           ... the template's debug.keystore (buildable, installable) ...
 *       }
 *   }
 *
 * So: put the four CHR_RELEASE_* environment variables (the workflow turns the
 * Android secrets into them) on the Gradle step and the APK is signed with your
 * key; leave them out and you still get a working, installable APK.
 *
 * Run: node .github/scripts/patch-gradle-signing.js   (after `expo prebuild`)
 */
const fs = require('fs');
const path = require('path');

const gradleFile = path.join(__dirname, '..', '..', 'android', 'app', 'build.gradle');

if (!fs.existsSync(gradleFile)) {
  console.error(`${gradleFile} not found - run "npx expo prebuild --platform android" first`);
  process.exit(1);
}

let src = fs.readFileSync(gradleFile, 'utf8');

if (src.includes('CHR_RELEASE_STORE_FILE')) {
  console.log('build.gradle already knows about CHR_RELEASE_STORE_FILE - nothing to do');
  process.exit(0);
}

const signingConfigs = src.match(/signingConfigs\s*\{/);
if (!signingConfigs) {
  console.error('no signingConfigs block in android/app/build.gradle - template changed?');
  process.exit(1);
}

const insertAt = signingConfigs.index + signingConfigs[0].length;
const releaseBlock = `
        // Added by .github/scripts/patch-gradle-signing.js
        release {
            def ciKeystore = System.getenv("CHR_RELEASE_STORE_FILE")
            if (ciKeystore != null && file(ciKeystore).exists()) {
                storeFile file(ciKeystore)
                storePassword System.getenv("CHR_RELEASE_STORE_PASSWORD")
                keyAlias System.getenv("CHR_RELEASE_KEY_ALIAS")
                keyPassword System.getenv("CHR_RELEASE_KEY_PASSWORD")
            } else {
                // No keystore handed to CI - the debug key still produces an
                // installable, update-compatible APK.
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

src = src.slice(0, insertAt) + releaseBlock + src.slice(insertAt);

// Only the release build type switches to the new config; the debug build type
// keeps signing with the debug key.
const buildTypes = src.indexOf('buildTypes {');
const releaseType = buildTypes === -1 ? -1 : src.indexOf('release {', buildTypes);
const DEBUG_LINE = 'signingConfig signingConfigs.debug';
const signingLine = releaseType === -1 ? -1 : src.indexOf(DEBUG_LINE, releaseType);

if (releaseType === -1 || signingLine === -1) {
  console.error('could not find "signingConfig signingConfigs.debug" inside buildTypes.release');
  process.exit(1);
}

src = src.slice(0, signingLine) + 'signingConfig signingConfigs.release' + src.slice(signingLine + DEBUG_LINE.length);
fs.writeFileSync(gradleFile, src);

// cheap sanity check: the braces of the file we just rewrote must balance
const balance = (t) => [...t].reduce((n, c) => n + (c === '{' ? 1 : c === '}' ? -1 : 0), 0);
if (balance(src) !== 0) {
  console.error('brace balance broke while patching - refusing to leave a broken gradle file');
  process.exit(1);
}

console.log('build.gradle → release build signs with CHR_RELEASE_* or the debug keystore');
