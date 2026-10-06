import Constants from 'expo-constants';

/**
 * One place for the app identity.
 *
 * APP_ICON is the same roundel the web/app navbar shows (assets/images/chr-logo.png),
 * so the launcher icon, the loading screen and the in-app header all match.
 */
export const APP_NAME: string = 'AI Crop Robot';

export const SERVER_URL: string =
  process.env.EXPO_PUBLIC_SERVER_URL ?? 'https://crophealth.dpdns.org';

export const APP_VERSION: string =
  (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

export const APP_ICON = require('../assets/images/chr-logo.png');
