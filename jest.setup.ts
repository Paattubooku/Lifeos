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
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: false, canAskAgain: true, status: 'undetermined' }),
  ),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: true, canAskAgain: true, status: 'granted' }),
  ),
}));
