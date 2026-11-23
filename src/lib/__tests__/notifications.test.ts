import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

import { enableReminders, getReminderPermission } from '../notifications';

const get = Notifications.getPermissionsAsync as jest.Mock;
const request = Notifications.requestPermissionsAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('notifications', () => {
  it('reads the permission and fails closed', async () => {
    await expect(getReminderPermission()).resolves.toEqual({ granted: false, canAskAgain: true });
    get.mockRejectedValueOnce(new Error('no module'));
    await expect(getReminderPermission()).resolves.toEqual({ granted: false, canAskAgain: false });
  });

  it('does not ask again when already granted', async () => {
    get.mockResolvedValueOnce({ granted: true, canAskAgain: true });
    await expect(enableReminders()).resolves.toEqual({ granted: true, canAskAgain: true });
    expect(request).not.toHaveBeenCalled();
  });

  it('asks the OS when it still may', async () => {
    await expect(enableReminders()).resolves.toEqual({ granted: true, canAskAgain: true });
    expect(request).toHaveBeenCalledTimes(1);
    request.mockRejectedValueOnce(new Error('x'));
    await expect(enableReminders()).resolves.toEqual({ granted: false, canAskAgain: true });
  });

  it('opens system settings once the user has said no', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockRejectedValueOnce(new Error('x'));
    get.mockResolvedValueOnce({ granted: false, canAskAgain: false });
    await expect(enableReminders()).resolves.toEqual({ granted: false, canAskAgain: false });
    expect(open).toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});
