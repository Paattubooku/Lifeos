import { persistStore } from 'redux-persist';

import { makeStore } from './index';

/** The app's store. Imported only by app/_layout.tsx so tests never start persistence. */
export const store = makeStore();
export const persistor = persistStore(store);
