import React, { Component, ComponentRef, Suspense, useCallback, useRef, useState } from 'react';
import { ActivityIndicator, PixelRatio, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { OrbitControls } from '@react-three/drei/native';
import { Canvas } from '@react-three/fiber/native';
import { Info, RotateCw } from 'lucide-react-native';
import { MuscleId } from '../../constants/muscles';
import { theme } from '../../theme';
import { BodyModel } from './BodyModel';
import { MuscleActivityEntry } from './muscleActivity';
import { resetOrbitCamera, ViewerResetButton } from './ViewerResetButton';
import {
  MAX_ORBIT_DISTANCE,
  MIN_ORBIT_DISTANCE,
  PinchZoomHandler,
  stepOrbitZoom,
  ViewerZoomControls,
} from './ViewerZoomControls';

/** Props for the interactive 3D muscle map stage. */
export interface BodyViewerProps {
  muscles: Partial<Record<MuscleId, MuscleActivityEntry>>;
  selectedMuscle: MuscleId | null;
  view: 'front' | 'back';
  onChangeView: (view: 'front' | 'back') => void;
  onSelectMuscle: (muscleId: MuscleId) => void;
  onOpenCredits: () => void;
}

const CAMERA_CONFIG = {
  position: [0, 0.88, 2.55] as [number, number, number],
  fov: 42,
};

const ORBIT_TARGET: [number, number, number] = [0, 0.86, 0];

// @react-three/fiber/native exposes physical drawingBufferHeight as clientHeight while
// RN touch events report logical DP deltas, so scale rotateSpeed back up by PixelRatio.
const ORBIT_ROTATE_SPEED = Math.max(1.5, PixelRatio.get() * 1.4);

interface CanvasErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  onError?: () => void;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
}

/** Catches WebGL and expo-gl startup failures so the rest of HomeScreen stays functional. */
class CanvasErrorBoundary extends Component<
  CanvasErrorBoundaryProps,
  CanvasErrorBoundaryState
> {
  state: CanvasErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): CanvasErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error('3D body viewer failed to start:', error);
    this.props.onError?.();
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Interactive 3D body viewer hosting the lit Three.js canvas, touch orbit controls,
 * front/back view toggle, loading state, and model credits trigger.
 */
export const BodyViewer: React.FC<BodyViewerProps> = ({
  muscles,
  selectedMuscle,
  view,
  onChangeView,
  onSelectMuscle,
  onOpenCredits,
}) => {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [canZoomIn, setCanZoomIn] = useState(true);
  const [canZoomOut, setCanZoomOut] = useState(true);

  const handleLoaded = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleCanvasError = useCallback(() => {
    setHasError(true);
  }, []);

  const syncZoomBounds = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const distance = controls.getDistance();
    if (!Number.isFinite(distance)) return;
    setCanZoomIn(distance > MIN_ORBIT_DISTANCE + 0.04);
    setCanZoomOut(distance < MAX_ORBIT_DISTANCE - 0.04);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (stepOrbitZoom(controlsRef.current, 'in')) {
      syncZoomBounds();
    }
  }, [syncZoomBounds]);

  const handleZoomOut = useCallback(() => {
    if (stepOrbitZoom(controlsRef.current, 'out')) {
      syncZoomBounds();
    }
  }, [syncZoomBounds]);

  const handleResetPosition = useCallback(() => {
    resetOrbitCamera(controlsRef.current, {
      position: CAMERA_CONFIG.position,
      target: ORBIT_TARGET,
    });
    if (view !== 'front') {
      onChangeView('front');
    }
    setCanZoomIn(true);
    setCanZoomOut(true);
  }, [onChangeView, view]);

  const handleToggleView = useCallback(() => {
    const controls = controlsRef.current;
    if (controls) {
      // OrbitControls resets target to target0, so sync target0 to torso framing first.
      controls.target0?.set?.(ORBIT_TARGET[0], ORBIT_TARGET[1], ORBIT_TARGET[2]);
      controls.reset?.();
    }
    onChangeView(view === 'front' ? 'back' : 'front');
  }, [onChangeView, view]);

  const fallbackView = (
    <View style={styles.fallbackContainer}>
      <Text style={styles.fallbackTitle}>3D body view unavailable</Text>
      <Text style={styles.fallbackBody}>
        The interactive 3D body view could not start on this device.
      </Text>
    </View>
  );

  return (
    <View style={styles.stage}>
      <CanvasErrorBoundary fallback={fallbackView} onError={handleCanvasError}>
        <Canvas frameloop="demand" camera={CAMERA_CONFIG} style={styles.canvas}>
          <color attach="background" args={[theme.colors.anatomy.canvas]} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[2, 3, 4]} intensity={1.15} />
          <directionalLight position={[-2, 1, -3]} intensity={0.55} />
          <Suspense fallback={null}>
            <BodyModel
              muscles={muscles}
              selectedMuscle={selectedMuscle}
              view={view}
              onSelectMuscle={onSelectMuscle}
              onLoaded={handleLoaded}
            />
          </Suspense>
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            enableZoom={false}
            minDistance={MIN_ORBIT_DISTANCE}
            maxDistance={MAX_ORBIT_DISTANCE}
            rotateSpeed={ORBIT_ROTATE_SPEED}
            dampingFactor={0.12}
            target={ORBIT_TARGET}
            minPolarAngle={Math.PI * 0.25}
            maxPolarAngle={Math.PI * 0.72}
            onChange={syncZoomBounds}
          />
          <PinchZoomHandler
            controlsRef={controlsRef}
            enabled={isLoaded && !hasError}
          />
        </Canvas>
      </CanvasErrorBoundary>

      {!isLoaded && !hasError ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.infoButton}
        onPress={onOpenCredits}
        activeOpacity={0.8}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Anatomy model credits"
      >
        <Info size={16} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      {!hasError ? (
        <ViewerZoomControls
          style={styles.zoomControls}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          disabled={!isLoaded}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
        />
      ) : null}

      {!hasError ? (
        <View style={styles.bottomRightControls}>
          <ViewerResetButton
            onReset={handleResetPosition}
            disabled={!isLoaded}
          />
          <TouchableOpacity
            testID="view-toggle-button"
            style={styles.viewToggleButton}
            onPress={handleToggleView}
            activeOpacity={0.8}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              view === 'front' ? 'Switch to back view' : 'Switch to front view'
            }
          >
            <RotateCw size={14} color={theme.colors.text} />
            <Text style={styles.viewToggleText}>
              {view === 'front' ? 'Front' : 'Back'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    position: 'relative',
    backgroundColor: theme.colors.anatomy.canvas,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  fallbackTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    textAlign: 'center',
  },
  fallbackBody: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomControls: {
    position: 'absolute',
    left: 12,
    bottom: 12,
  },
  bottomRightControls: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  viewToggleText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
});
