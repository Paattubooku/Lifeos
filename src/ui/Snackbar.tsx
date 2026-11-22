import { Undo2 } from 'lucide-react-native';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOutDown, SlideInDown } from 'react-native-reanimated';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { motion, radius } from './theme';

export type SnackbarProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Inverted pill: message + optional Undo. */
export function Snackbar({ message, actionLabel, onAction }: SnackbarProps) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.bar, { backgroundColor: colors.inverseSurface }]}
    >
      <Text variant="sub" weight={500} num tone="onInverse" style={styles.message}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${message}`}
          onPress={onAction}
          style={styles.action}
        >
          <Undo2 size={16} color={colors.inverseAction} strokeWidth={2.25} />
          <Text variant="sub" weight={700} style={{ color: colors.inverseAction }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export type ShowSnackbar = (options: SnackbarProps & { duration?: number }) => void;

const SnackbarContext = createContext<ShowSnackbar>(() => undefined);

type Current = SnackbarProps & { id: number };

/**
 * Hosts one snackbar at a time above the tab bar. `useSnackbar()` returns `show`.
 * Every destructive action shows one with Undo for 5 s (PRD §4.5).
 */
export function SnackbarProvider({
  children,
  bottomOffset = 104,
}: {
  children: ReactNode;
  bottomOffset?: number;
}) {
  const [current, setCurrent] = useState<Current | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const show = useCallback<ShowSnackbar>(
    ({ duration = motion.snackbar, ...props }) => {
      clear();
      setCurrent({ ...props, id: nextId.current++ });
      AccessibilityInfo.announceForAccessibility(props.message);
      timer.current = setTimeout(() => setCurrent(null), duration);
    },
    [clear],
  );

  useEffect(() => clear, [clear]);

  const value = useMemo(() => show, [show]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {current ? (
        <Animated.View
          key={current.id}
          entering={SlideInDown.springify().damping(16)}
          exiting={FadeOutDown}
          style={[styles.host, { bottom: bottomOffset }]}
          pointerEvents="box-none"
        >
          <Snackbar
            message={current.message}
            actionLabel={current.actionLabel}
            onAction={
              current.onAction
                ? () => {
                    clear();
                    setCurrent(null);
                    current.onAction?.();
                  }
                : undefined
            }
          />
        </Animated.View>
      ) : null}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): ShowSnackbar {
  return useContext(SnackbarContext);
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingLeft: 16,
    paddingRight: 4,
    borderRadius: radius.card,
  },
  message: { flex: 1 },
  action: { height: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
