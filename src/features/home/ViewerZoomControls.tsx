import React, { useCallback, useEffect, useRef } from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useThree } from '@react-three/fiber/native';
import { ZoomIn, ZoomOut } from 'lucide-react-native';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { theme } from '../../theme';

/** Minimum camera-to-target distance allowed for orbit zoom. */
export const MIN_ORBIT_DISTANCE = 1.35;

/** Maximum camera-to-target distance allowed for orbit zoom. */
export const MAX_ORBIT_DISTANCE = 4.2;

/** Multiplicative dolly step factor applied per zoom button press. */
export const ZOOM_BUTTON_STEP_SCALE = 0.82;

const DISTANCE_EPSILON = 0.001;
const MIN_PINCH_SEPARATION = 4;
const MIN_PINCH_RATIO = 0.75;
const MAX_PINCH_RATIO = 1.33;
const BUTTON_SIZE = 36;
const ICON_SIZE = 18;
const DISABLED_OPACITY = 0.4;
const BUTTON_HIT_SLOP = { left: 8, right: 8 } as const;

interface TouchPointLike {
  readonly pageX?: number;
  readonly pageY?: number;
  readonly locationX?: number;
  readonly locationY?: number;
}

interface TouchPointerEventLike {
  readonly type?: string;
  readonly pointerId?: number;
  readonly __fitfreakSynthetic?: boolean;
  readonly touches?: readonly TouchPointLike[];
}

type PointerEventListenerLike = (event: TouchPointerEventLike) => void;

interface PointerEventTarget {
  addEventListener: (type: string, listener: PointerEventListenerLike) => void;
  removeEventListener: (type: string, listener: PointerEventListenerLike) => void;
  dispatchEvent?: (event: Record<string, unknown>) => void;
}

function isPointerEventTarget(candidate: unknown): candidate is PointerEventTarget {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'addEventListener' in candidate &&
    'removeEventListener' in candidate &&
    typeof candidate.addEventListener === 'function' &&
    typeof candidate.removeEventListener === 'function' &&
    (!('dispatchEvent' in candidate) ||
      candidate.dispatchEvent === undefined ||
      typeof candidate.dispatchEvent === 'function')
  );
}

function dispatchSyntheticPointerCancel(target: PointerEventTarget, pointerId: number): void {
  if (typeof EventTarget !== 'undefined' && target instanceof EventTarget) {
    const syntheticEvent =
      typeof PointerEvent === 'function'
        ? new PointerEvent('pointercancel', { pointerId, pointerType: 'touch' })
        : new Event('pointercancel');
    Object.assign(syntheticEvent, {
      pointerId,
      pointerType: 'touch',
      __fitfreakSynthetic: true,
    });
    const domTarget: EventTarget = target;
    domTarget.dispatchEvent(syntheticEvent);
    return;
  }

  target.dispatchEvent?.({
    type: 'pointercancel',
    pointerId,
    pointerType: 'touch',
    __fitfreakSynthetic: true,
  });
}

function getTouchPairDistance(first: TouchPointLike, second: TouchPointLike): number {
  const firstX = first.pageX ?? first.locationX ?? 0;
  const firstY = first.pageY ?? first.locationY ?? 0;
  const secondX = second.pageX ?? second.locationX ?? 0;
  const secondY = second.pageY ?? second.locationY ?? 0;
  return Math.hypot(firstX - secondX, firstY - secondY);
}

/**
 * Steps `OrbitControls` zoom in or out by `ZOOM_BUTTON_STEP_SCALE` when within
 * `[MIN_ORBIT_DISTANCE, MAX_ORBIT_DISTANCE]`. Returns `true` if a step was applied.
 */
export function stepOrbitZoom(
  controls: OrbitControlsImpl | null,
  direction: 'in' | 'out',
): boolean {
  if (!controls) {
    return false;
  }

  const distance = controls.getDistance();
  if (!Number.isFinite(distance)) {
    return false;
  }

  if (direction === 'in') {
    if (distance <= MIN_ORBIT_DISTANCE + DISTANCE_EPSILON) {
      return false;
    }
    controls.dollyIn(ZOOM_BUTTON_STEP_SCALE);
    return true;
  }

  if (distance >= MAX_ORBIT_DISTANCE - DISTANCE_EPSILON) {
    return false;
  }
  controls.dollyOut(ZOOM_BUTTON_STEP_SCALE);
  return true;
}

/** Props for the in-canvas two-finger pinch zoom listener. */
export interface PinchZoomHandlerProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  enabled?: boolean;
}

/**
 * R3F scene helper that bridges React Native multi-touch pinch gestures onto
 * `OrbitControls` dolly zooming while suppressing accidental 1-finger spin.
 */
export const PinchZoomHandler: React.FC<PinchZoomHandlerProps> = ({
  controlsRef,
  enabled = true,
}) => {
  const gl = useThree((state) => state.gl);
  const events = useThree((state) => state.events);
  const invalidate = useThree((state) => state.invalidate);

  const prevDistanceRef = useRef<number | null>(null);
  const disabledRotateRef = useRef(false);
  const activePointerIdsRef = useRef<Set<number>>(new Set());

  const restoreRotate = useCallback(() => {
    if (disabledRotateRef.current && controlsRef.current) {
      controlsRef.current.enableRotate = true;
    }
    disabledRotateRef.current = false;
  }, [controlsRef]);

  useEffect(() => {
    if (!enabled) {
      activePointerIdsRef.current.clear();
      prevDistanceRef.current = null;
      restoreRotate();
      return;
    }

    const connectedTarget: unknown = events?.connected;
    const domElement: unknown = gl?.domElement;
    const target: PointerEventTarget | null = isPointerEventTarget(connectedTarget)
      ? connectedTarget
      : isPointerEventTarget(domElement)
        ? domElement
        : null;

    if (!target) {
      activePointerIdsRef.current.clear();
      prevDistanceRef.current = null;
      restoreRotate();
      return;
    }

    const flushActivePointers = (extraPointerId?: number) => {
      const idsToFlush = new Set(activePointerIdsRef.current);
      if (typeof extraPointerId === 'number') {
        idsToFlush.add(extraPointerId);
      }
      activePointerIdsRef.current.clear();

      idsToFlush.forEach((id) => {
        dispatchSyntheticPointerCancel(target, id);
      });
    };

    const handlePinchGesture = (event: TouchPointerEventLike) => {
      const touches = event.touches;

      if (!touches || touches.length < 2) {
        prevDistanceRef.current = null;
        if (!touches || touches.length === 0) {
          restoreRotate();
        }
        return;
      }

      const controls = controlsRef.current;
      if (!controls) {
        prevDistanceRef.current = null;
        return;
      }

      if (controls.enableRotate) {
        controls.enableRotate = false;
        disabledRotateRef.current = true;
      }

      const firstTouch = touches[0];
      const secondTouch = touches[1];
      if (!firstTouch || !secondTouch) {
        prevDistanceRef.current = null;
        return;
      }

      const currDistance = getTouchPairDistance(firstTouch, secondTouch);
      if (!Number.isFinite(currDistance)) {
        prevDistanceRef.current = null;
        return;
      }

      const prevDistance = prevDistanceRef.current;
      if (
        prevDistance !== null &&
        prevDistance > MIN_PINCH_SEPARATION &&
        currDistance > MIN_PINCH_SEPARATION
      ) {
        const ratio = Math.max(
          MIN_PINCH_RATIO,
          Math.min(MAX_PINCH_RATIO, prevDistance / currDistance),
        );
        controls.dollyIn(ratio);
        invalidate();
      }

      prevDistanceRef.current = currDistance;
    };

    const handlePointerDown: PointerEventListenerLike = (event) => {
      if (event.__fitfreakSynthetic) {
        return;
      }
      if (typeof event.pointerId === 'number') {
        activePointerIdsRef.current.add(event.pointerId);
      }
      handlePinchGesture(event);
    };

    const handlePointerMove: PointerEventListenerLike = (event) => {
      if (event.__fitfreakSynthetic) {
        return;
      }
      handlePinchGesture(event);
    };

    const createPointerEndHandler =
      (
        fallbackType: 'pointerup' | 'pointercancel' | 'pointerleave' | 'lostpointercapture',
      ): PointerEventListenerLike =>
      (event) => {
        if (event.__fitfreakSynthetic) {
          return;
        }

        const eventType = event.type ?? fallbackType;
        if (eventType === 'pointerup' || eventType === 'pointercancel') {
          if (typeof event.pointerId === 'number') {
            activePointerIdsRef.current.delete(event.pointerId);
          }
        }

        prevDistanceRef.current = null;

        const touches = event.touches;
        const isCaptureLostOrLeave =
          eventType === 'lostpointercapture' || eventType === 'pointerleave';

        if (isCaptureLostOrLeave || !touches || touches.length === 0) {
          const extraPointerId =
            isCaptureLostOrLeave && typeof event.pointerId === 'number'
              ? event.pointerId
              : undefined;
          flushActivePointers(extraPointerId);
          restoreRotate();
        }
      };

    const handlePointerUp = createPointerEndHandler('pointerup');
    const handlePointerCancel = createPointerEndHandler('pointercancel');
    const handlePointerLeave = createPointerEndHandler('pointerleave');
    const handleLostPointerCapture = createPointerEndHandler('lostpointercapture');

    target.addEventListener('pointerdown', handlePointerDown);
    target.addEventListener('pointermove', handlePointerMove);
    target.addEventListener('pointerup', handlePointerUp);
    target.addEventListener('pointerleave', handlePointerLeave);
    target.addEventListener('lostpointercapture', handleLostPointerCapture);
    target.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      target.removeEventListener('pointerdown', handlePointerDown);
      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerUp);
      target.removeEventListener('pointerleave', handlePointerLeave);
      target.removeEventListener('lostpointercapture', handleLostPointerCapture);
      target.removeEventListener('pointercancel', handlePointerCancel);
      flushActivePointers();
      prevDistanceRef.current = null;
      restoreRotate();
    };
  }, [controlsRef, enabled, events, gl, invalidate, restoreRotate]);

  return null;
};

/** Props for the floating 3D viewer zoom pill controls. */
export interface ViewerZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  disabled?: boolean;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Compact vertical pill offering accessible step zoom-in and zoom-out buttons
 * styled to match the 3D BodyViewer floating controls.
 */
export const ViewerZoomControls: React.FC<ViewerZoomControlsProps> = ({
  onZoomIn,
  onZoomOut,
  disabled = false,
  canZoomIn = true,
  canZoomOut = true,
  style,
}) => {
  const isZoomInDisabled = disabled || !canZoomIn;
  const isZoomOutDisabled = disabled || !canZoomOut;

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        testID="zoom-in-button"
        style={[styles.button, isZoomInDisabled && styles.buttonDisabled]}
        onPress={onZoomIn}
        disabled={isZoomInDisabled}
        activeOpacity={0.8}
        hitSlop={BUTTON_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="Zoom in"
        accessibilityState={{ disabled: isZoomInDisabled }}
      >
        <ZoomIn size={ICON_SIZE} color={theme.colors.text} />
      </TouchableOpacity>
      <View style={styles.divider} />
      <TouchableOpacity
        testID="zoom-out-button"
        style={[styles.button, isZoomOutDisabled && styles.buttonDisabled]}
        onPress={onZoomOut}
        disabled={isZoomOutDisabled}
        activeOpacity={0.8}
        hitSlop={BUTTON_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="Zoom out"
        accessibilityState={{ disabled: isZoomOutDisabled }}
      >
        <ZoomOut size={ICON_SIZE} color={theme.colors.text} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: BUTTON_SIZE,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    overflow: 'hidden',
  },
  button: {
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: DISABLED_OPACITY,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
});
