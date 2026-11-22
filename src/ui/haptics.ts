import * as Haptics from 'expo-haptics';

/** Fire-and-forget haptics; never throws (web, simulators, tests). */
export const haptics = {
  tap() {
    Haptics.selectionAsync().catch(() => undefined);
  },
  press() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  hold() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  },
  success() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
};
