import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  GestureResponderHandlers,
  Keyboard,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActiveWorkoutStore } from '../../store/activeWorkoutStore';
import { theme } from '../../theme';
import { ActiveWorkout } from '../../types';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';
import {
  MINI_BAR_HEIGHT,
  clampSheetTranslateY,
  shouldMinimizeFromSheet,
  shouldSnapOpenFromMiniBar,
} from './workoutSessionUtils';

const DEFAULT_TAB_BAR_BASE_HEIGHT = 56;
const MIN_COLLAPSED_Y = 200;
const EXPAND_DURATION_MS = 280;
const COLLAPSE_DURATION_MS = 250;
const SNAP_BACK_DURATION_MS = 180;
const GESTURE_ACTIVATION_THRESHOLD = 10;
const GESTURE_DIRECTION_RATIO = 1.3;
const BACKDROP_MAX_OPACITY = 0.6;
const SHEET_FADE_START_RATIO = 0.72;
const EXPAND_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const COLLAPSE_EASING = Easing.out(Easing.cubic);

type SheetAnimationIntent = 'expand' | 'collapse' | null;

/** Props for the animated full-screen active workout overlay sheet. */
export interface ActiveWorkoutSheetProps {
  workoutId: string | null;
  isSheetRendered: boolean;
  isMinimized: boolean;
  isDraggingUp: boolean;
  isAnimating: boolean;
  translateY: Animated.Value;
  collapsedY: number;
  headerPanHandlers: GestureResponderHandlers;
  onMinimize: () => void;
}

/** Return value of `useActiveWorkoutSheetController` coordinating sheet gestures and dock layout. */
export interface ActiveWorkoutSheetController {
  currentWorkout: ActiveWorkout | null;
  isMinimized: boolean;
  resumeWorkout: () => void;
  miniBarPanHandlers: GestureResponderHandlers;
  onTabBarLayout: (event: LayoutChangeEvent) => void;
  sheetProps: ActiveWorkoutSheetProps;
}

/** Coordinates active workout sheet slide animations, drag gestures, Android back handling, and tab bar layout. */
export const useActiveWorkoutSheetController = (): ActiveWorkoutSheetController => {
  const currentWorkout = useActiveWorkoutStore((state) => state.currentWorkout);
  const isMinimized = useActiveWorkoutStore((state) => state.isMinimized);
  const minimizeWorkout = useActiveWorkoutStore((state) => state.minimizeWorkout);
  const resumeWorkout = useActiveWorkoutStore((state) => state.resumeWorkout);

  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [measuredTabBarHeight, setMeasuredTabBarHeight] = useState<number | null>(null);

  const tabBarHeight = measuredTabBarHeight ?? DEFAULT_TAB_BAR_BASE_HEIGHT + insets.bottom;
  const collapsedY = Math.max(windowHeight - tabBarHeight - MINI_BAR_HEIGHT, MIN_COLLAPSED_Y);

  const workoutId = currentWorkout?.id ?? null;
  const hasWorkout = currentWorkout !== null;

  const [isSheetRendered, setIsSheetRendered] = useState<boolean>(hasWorkout);
  const [isDraggingUp, setIsDraggingUp] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const collapsedYRef = useRef<number>(collapsedY);
  const hasWorkoutRef = useRef<boolean>(hasWorkout);
  const isMinimizedRef = useRef<boolean>(isMinimized);
  const draggingUpRef = useRef<boolean>(false);
  const animatingRef = useRef<boolean>(false);
  const animationIntentRef = useRef<SheetAnimationIntent>(null);
  const animationTargetRef = useRef<number | null>(null);
  const fromDragReleaseRef = useRef<boolean>(false);
  const activeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const animationTokenRef = useRef<number>(0);
  const prevTransitionRef = useRef<{ workoutId: string | null; isMinimized: boolean }>({
    workoutId: null,
    isMinimized: false,
  });

  const onTabBarLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight > 0) {
      setMeasuredTabBarHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    }
  }, []);

  const stopAnimation = useCallback(() => {
    animationTokenRef.current += 1;
    activeAnimationRef.current?.stop();
    activeAnimationRef.current = null;
    animatingRef.current = false;
    animationIntentRef.current = null;
    animationTargetRef.current = null;
    setIsAnimating(false);
  }, []);

  const animateTranslateY = useCallback(
    (
      toValue: number,
      duration: number,
      easing: (value: number) => number,
      intent: SheetAnimationIntent = null,
    ) => {
      animationTokenRef.current += 1;
      const token = animationTokenRef.current;
      activeAnimationRef.current?.stop();

      animatingRef.current = true;
      animationIntentRef.current = intent;
      animationTargetRef.current = toValue;
      setIsAnimating(true);

      const animation = Animated.timing(translateY, {
        toValue,
        duration,
        easing,
        useNativeDriver: true,
      });
      activeAnimationRef.current = animation;

      animation.start(() => {
        if (animationTokenRef.current !== token) {
          return;
        }
        activeAnimationRef.current = null;
        animatingRef.current = false;
        animationIntentRef.current = null;
        animationTargetRef.current = null;
        setIsAnimating(false);
      });
    },
    [translateY],
  );

  useLayoutEffect(() => {
    collapsedYRef.current = collapsedY;
    hasWorkoutRef.current = hasWorkout;
    isMinimizedRef.current = isMinimized;
  }, [collapsedY, hasWorkout, isMinimized]);

  useLayoutEffect(() => {
    const prev = prevTransitionRef.current;
    prevTransitionRef.current = { workoutId, isMinimized };

    if (!workoutId) {
      if (prev.workoutId !== null) {
        Keyboard.dismiss();
      }
      stopAnimation();
      draggingUpRef.current = false;
      fromDragReleaseRef.current = false;
      setIsDraggingUp(false);
      setIsSheetRendered(false);
      translateY.setValue(collapsedYRef.current);
      return;
    }

    if (!isMinimized) {
      const isInterruptingCollapse =
        prev.workoutId === workoutId && prev.isMinimized && animatingRef.current;
      const shouldPreservePosition = fromDragReleaseRef.current || isInterruptingCollapse;

      fromDragReleaseRef.current = false;
      draggingUpRef.current = false;
      setIsDraggingUp(false);
      setIsSheetRendered(true);

      if (!shouldPreservePosition) {
        translateY.setValue(collapsedYRef.current);
      }

      animateTranslateY(0, EXPAND_DURATION_MS, EXPAND_EASING, 'expand');
      return;
    }

    setIsSheetRendered(true);
    draggingUpRef.current = false;
    fromDragReleaseRef.current = false;
    setIsDraggingUp(false);

    const transitionedToMinimized = prev.workoutId === workoutId && !prev.isMinimized;
    if (transitionedToMinimized) {
      Keyboard.dismiss();
      animateTranslateY(collapsedYRef.current, COLLAPSE_DURATION_MS, COLLAPSE_EASING, 'collapse');
    } else {
      stopAnimation();
      translateY.setValue(collapsedYRef.current);
    }
  }, [animateTranslateY, isMinimized, stopAnimation, translateY, workoutId]);

  useLayoutEffect(() => {
    // Re-target an in-flight collapse or lock a settled sheet when `collapsedY` changes (e.g. keyboard dismissal).
    if (hasWorkout && isMinimized && !draggingUpRef.current) {
      if (
        animatingRef.current &&
        animationIntentRef.current === 'collapse' &&
        animationTargetRef.current !== collapsedY
      ) {
        animateTranslateY(collapsedY, SNAP_BACK_DURATION_MS, COLLAPSE_EASING, 'collapse');
      } else if (!animatingRef.current) {
        translateY.setValue(collapsedY);
      }
    }
  }, [animateTranslateY, collapsedY, hasWorkout, isMinimized, isDraggingUp, isAnimating, translateY]);

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  useEffect(() => {
    if (!hasWorkout || isMinimized) {
      return;
    }

    // Subscribe while expanded so Android Back minimizes the sheet before tab navigation handles it.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const state = useActiveWorkoutStore.getState();
      if (state.currentWorkout && !state.isMinimized) {
        state.minimizeWorkout();
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [hasWorkout, isMinimized]);

  const headerPanHandlers = useMemo(() => {
    const handleHeaderRelease = (dy: number, vy: number) => {
      if (!hasWorkoutRef.current || isMinimizedRef.current) {
        return;
      }
      if (shouldMinimizeFromSheet(dy, vy)) {
        minimizeWorkout();
      } else {
        animateTranslateY(0, SNAP_BACK_DURATION_MS, COLLAPSE_EASING, 'expand');
      }
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gestureState) =>
        hasWorkoutRef.current &&
        !isMinimizedRef.current &&
        gestureState.dy > GESTURE_ACTIVATION_THRESHOLD &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * GESTURE_DIRECTION_RATIO,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        stopAnimation();
        Keyboard.dismiss();
      },
      onPanResponderMove: (_event, gestureState) => {
        translateY.setValue(clampSheetTranslateY(gestureState.dy, collapsedYRef.current));
      },
      onPanResponderRelease: (_event, gestureState) =>
        handleHeaderRelease(gestureState.dy, gestureState.vy),
      onPanResponderTerminate: (_event, gestureState) =>
        handleHeaderRelease(gestureState.dy, gestureState.vy),
    }).panHandlers;
  }, [animateTranslateY, minimizeWorkout, stopAnimation, translateY]);

  const miniBarPanHandlers = useMemo(() => {
    const handleMiniBarRelease = (dy: number, vy: number) => {
      draggingUpRef.current = false;
      setIsDraggingUp(false);

      if (!hasWorkoutRef.current || !isMinimizedRef.current) {
        return;
      }

      if (shouldSnapOpenFromMiniBar(dy, vy)) {
        fromDragReleaseRef.current = true;
        resumeWorkout();
      } else {
        animateTranslateY(collapsedYRef.current, SNAP_BACK_DURATION_MS, COLLAPSE_EASING, 'collapse');
      }
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gestureState) =>
        hasWorkoutRef.current &&
        isMinimizedRef.current &&
        gestureState.dy < -GESTURE_ACTIVATION_THRESHOLD &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * GESTURE_DIRECTION_RATIO,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        stopAnimation();
        draggingUpRef.current = true;
        setIsDraggingUp(true);
        translateY.setValue(collapsedYRef.current);
      },
      onPanResponderMove: (_event, gestureState) => {
        translateY.setValue(
          clampSheetTranslateY(collapsedYRef.current + gestureState.dy, collapsedYRef.current),
        );
      },
      onPanResponderRelease: (_event, gestureState) =>
        handleMiniBarRelease(gestureState.dy, gestureState.vy),
      onPanResponderTerminate: (_event, gestureState) =>
        handleMiniBarRelease(gestureState.dy, gestureState.vy),
    }).panHandlers;
  }, [animateTranslateY, resumeWorkout, stopAnimation, translateY]);

  const sheetProps: ActiveWorkoutSheetProps = {
    workoutId,
    isSheetRendered,
    isMinimized,
    isDraggingUp,
    isAnimating,
    translateY,
    collapsedY,
    headerPanHandlers,
    onMinimize: minimizeWorkout,
  };

  return {
    currentWorkout,
    isMinimized,
    resumeWorkout,
    miniBarPanHandlers,
    onTabBarLayout,
    sheetProps,
  };
};

/** Full-screen active workout overlay sheet that slides and cross-dissolves into the mini bar. */
export const ActiveWorkoutSheet: React.FC<ActiveWorkoutSheetProps> = ({
  workoutId,
  isSheetRendered,
  isMinimized,
  isDraggingUp,
  isAnimating,
  translateY,
  collapsedY,
  headerPanHandlers,
  onMinimize,
}) => {
  const backdropOpacity = useMemo(
    () =>
      translateY.interpolate({
        inputRange: [0, collapsedY],
        outputRange: [BACKDROP_MAX_OPACITY, 0],
        extrapolate: 'clamp',
      }),
    [collapsedY, translateY],
  );

  const sheetOpacity = useMemo(
    () =>
      translateY.interpolate({
        inputRange: [0, collapsedY * SHEET_FADE_START_RATIO, collapsedY],
        outputRange: [1, 0.96, 0],
        extrapolate: 'clamp',
      }),
    [collapsedY, translateY],
  );

  if (!workoutId || !isSheetRendered) {
    return null;
  }

  const isInteractive = !isMinimized;
  const isIdleMinimized = isMinimized && !isDraggingUp && !isAnimating;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        isIdleMinimized ? styles.overlayHidden : styles.overlayActive,
      ]}
      pointerEvents={isInteractive ? 'auto' : 'none'}
      accessibilityElementsHidden={isIdleMinimized}
      importantForAccessibility={isIdleMinimized ? 'no-hide-descendants' : 'auto'}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.backdrop,
          {
            opacity: backdropOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            opacity: sheetOpacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <ActiveWorkoutScreen
          key={workoutId}
          onMinimize={onMinimize}
          headerPanHandlers={headerPanHandlers}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    overflow: 'hidden',
  },
  overlayActive: {
    zIndex: 20,
    elevation: 20,
  },
  overlayHidden: {
    zIndex: 0,
    elevation: 0,
  },
  backdrop: {
    backgroundColor: theme.colors.background,
  },
  sheet: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
