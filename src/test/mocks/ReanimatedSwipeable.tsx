/**
 * Jest stand-in for react-native-gesture-handler/ReanimatedSwipeable.
 * Renders both action panels and forwards `onSwipeableOpen`, so tests can
 * fire `swipeableOpen` with 'left' | 'right' and press the revealed actions.
 */
import { forwardRef, type ReactNode, useImperativeHandle } from 'react';
import { View } from 'react-native';

type Props = {
  children?: ReactNode;
  renderLeftActions?: () => ReactNode;
  renderRightActions?: () => ReactNode;
  onSwipeableOpen?: (direction: 'left' | 'right') => void;
};

export const SwipeDirection = { LEFT: 'left', RIGHT: 'right' } as const;

const Swipeable = forwardRef<unknown, Props>(function Swipeable(props, ref) {
  useImperativeHandle(ref, () => ({
    close: () => undefined,
    openLeft: () => undefined,
    openRight: () => undefined,
    reset: () => undefined,
  }));
  return (
    // @ts-expect-error -- custom prop so fireEvent(…, 'swipeableOpen') reaches the handler
    <View testID="swipeable" onSwipeableOpen={props.onSwipeableOpen}>
      {props.renderLeftActions?.()}
      {props.children}
      {props.renderRightActions?.()}
    </View>
  );
});

export default Swipeable;
