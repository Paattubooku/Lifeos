// Prepares app.json for an unsigned iPhone build that SideStore re-signs with a
// free Apple ID (.github/workflows/ios-unsigned.yml). Runs only in that build;
// the committed app.json stays set up for Expo Go.
//  - runtimeVersion "sdkVersion" is an Expo Go policy and is not supported in a
//    native build, and there is no EAS Update URL: updates are turned off, so
//    a new version means a new IPA.
//  - The Apple Health plugin adds the HealthKit entitlement, which free Apple
//    IDs can't sign. Without it the app uses the motion sensor for steps
//    (src/features/steps/lib/health.ts already treats Health as unavailable).
import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2] ?? 'app.json';
const json = JSON.parse(readFileSync(path, 'utf8'));
const expo = json.expo;

delete expo.runtimeVersion;
expo.updates = { ...(expo.updates ?? {}), enabled: false };
expo.plugins = (expo.plugins ?? []).filter(
  (p) => (Array.isArray(p) ? p[0] : p) !== '@kingstinct/react-native-healthkit',
);

writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
console.log(`ios-sideload-config: updated ${path}`);
