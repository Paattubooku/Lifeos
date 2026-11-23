import { appSlice, setThemePreference } from '../appSlice';
import { makeStore } from '../index';
import { persistConfig } from '../persist';

describe('store', () => {
  it('defaults to the dark theme', () => {
    expect(appSlice.reducer(undefined, { type: 'init' })).toEqual({ themePreference: 'dark' });
  });

  it('stores the theme preference', () => {
    const store = makeStore();
    store.dispatch(setThemePreference('light'));
    expect(store.getState().app.themePreference).toBe('light');
    store.dispatch(setThemePreference('system'));
    expect(store.getState().app.themePreference).toBe('system');
  });

  it('registers the RTK Query api slice', () => {
    expect(makeStore().getState()).toHaveProperty('api');
  });

  it('persists the app slice, the API cache and the onboarding draft', () => {
    expect(persistConfig.whitelist).toEqual(['app', 'api', 'profile']);
    expect(persistConfig.key).toBe('lifeos-root');
  });
});
