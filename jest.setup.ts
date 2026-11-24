import 'react-native-gesture-handler/jestSetup';

// Reanimated 4 runs on the worklets runtime, which has no native side in Jest.
jest.mock('react-native-worklets', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-worklets/src/mock'),
);
// Reanimated 4.7's native initializer calls setCSSEventHandler, which its Jest
// (JSReanimated) backend throws on. Stub just that call; keep the rest real.
jest.mock('react-native-reanimated/src/css/native/proxy', () => ({
  ...jest.requireActual('react-native-reanimated/src/css/native/proxy'),
  setCSSEventHandler: () => undefined,
}));
jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated/mock'),
);

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock(
  'react-native-safe-area-context',
  () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-safe-area-context/jest/mock').default,
);

// Gesture-handler v3's swipeable reads Reanimated listeners the Reanimated mock
// doesn't implement. Tests use a thin stand-in (see the file for details).
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./src/test/mocks/ReanimatedSwipeable'),
);

jest.mock('@react-native-community/netinfo', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

jest.mock('expo-crypto', () => ({
  randomUUID: () => globalThis.crypto.randomUUID(),
  getRandomBytes: (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n)),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_alg: string, text: string) =>
    Array.from(
      new Uint8Array(
        await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
      ),
    )
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: false, canAskAgain: true, status: 'undetermined' }),
  ),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: true, canAskAgain: true, status: 'granted' }),
  ),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  dismissAllNotificationsAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn((req: { identifier?: string }) =>
    Promise.resolve(req.identifier ?? 'id'),
  ),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  clearLastNotificationResponseAsync: jest.fn(() => Promise.resolve()),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { HIGH: 4 },
}));

// Apple Health (F21): unavailable by default, like Expo Go; tests switch it on.
jest.mock('@kingstinct/react-native-healthkit', () => ({
  isHealthDataAvailable: jest.fn(() => false),
  requestAuthorization: jest.fn(() => Promise.resolve(true)),
  queryStatisticsCollectionForQuantity: jest.fn(() => Promise.resolve([])),
}));

// iPhone motion-chip steps (F21): available and granted unless a test says otherwise.
jest.mock('expo-sensors', () => ({
  Pedometer: {
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
    getStepCountAsync: jest.fn(() => Promise.resolve({ steps: 0 })),
    watchStepCount: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

// Data export (F23): an in-memory file system and share sheet.
jest.mock('expo-file-system', () => {
  const files = new Map<string, string | Uint8Array>();
  class File {
    uri: string;
    name: string;
    constructor(dir: { uri?: string } | string, name: string) {
      this.uri = `${typeof dir === 'string' ? dir : (dir.uri ?? 'cache:')}/${name}`;
      this.name = name;
    }
    get exists() {
      return files.has(this.uri);
    }
    create() {
      files.set(this.uri, '');
    }
    delete() {
      files.delete(this.uri);
    }
    write(content: string | Uint8Array) {
      files.set(this.uri, content);
    }
  }
  class Directory {
    uri: string;
    constructor(dir: { uri?: string } | string) {
      this.uri = typeof dir === 'string' ? dir : (dir.uri ?? 'cache:');
    }
    list() {
      return [...files.keys()]
        .filter((u) => u.startsWith(`${this.uri}/`))
        .map((u) => new File(this.uri, u.slice(this.uri.length + 1)));
    }
  }
  return { File, Directory, Paths: { cache: { uri: 'file:///cache' } }, __files: files };
});
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

// Deep links (F25 email links): standalone-style URLs in tests.
jest.mock('expo-linking', () => ({
  createURL: (path: string) => `lifeos://${path}`,
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));
