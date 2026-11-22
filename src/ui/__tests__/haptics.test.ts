import * as Haptics from 'expo-haptics';

import { haptics } from '../haptics';

describe('haptics', () => {
  it('calls the matching expo-haptics API', () => {
    haptics.tap();
    haptics.press();
    haptics.hold();
    haptics.success();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('never throws when haptics are unavailable', async () => {
    jest.mocked(Haptics.selectionAsync).mockRejectedValueOnce(new Error('unavailable'));
    expect(() => haptics.tap()).not.toThrow();
    await Promise.resolve();
  });
});
