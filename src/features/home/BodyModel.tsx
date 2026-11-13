import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber/native';
import { useGLTF } from '@react-three/drei/native';
import {
  type AnatomyNodeUserData,
  resolveAnatomyMuscleId,
} from '../../constants/anatomyMap';
import type { MuscleId } from '../../constants/muscles';
import {
  type OriginalMaterialMap,
  type OwnedMaterialCache,
  getOwnedHeatMaterial,
  getOwnedStaticMaterial,
  recordOriginalMaterials,
  restoreAndDisposeOwnedMaterials,
} from './bodyMaterials';
import type { MuscleActivityEntry } from './muscleActivity';

/** Props for {@link BodyModel}. */
export interface BodyModelProps {
  muscles: Partial<Record<MuscleId, MuscleActivityEntry>>;
  selectedMuscle: MuscleId | null;
  view: 'front' | 'back';
  onSelectMuscle: (muscleId: MuscleId) => void;
  onLoaded?: () => void;
}

type AnatomyKind = NonNullable<AnatomyNodeUserData['kind']>;

interface MeshEntry {
  mesh: THREE.Mesh;
  kind: AnatomyKind;
  muscleId: MuscleId | null;
}

// Metro resolves bundled `.glb` requires to an asset ID accepted by R3F's native loader.
const BODY_GLB_ASSET = require('../../../assets/models/body.glb') as string;
const ROTATION_DAMPING = 10;
const ROTATION_SNAP_EPSILON = 0.002;
const MAX_ROTATION_DELTA = 0.05;

const isThreeMesh = (object: THREE.Object3D): object is THREE.Mesh =>
  (object as Partial<THREE.Mesh>).isMesh === true;

const resolveEntryMaterial = (
  entry: MeshEntry,
  muscles: Partial<Record<MuscleId, MuscleActivityEntry>>,
  selectedMuscle: MuscleId | null,
  ownedCache: OwnedMaterialCache,
): THREE.MeshStandardMaterial => {
  if (entry.kind === 'bone') {
    return getOwnedStaticMaterial(ownedCache, 'bone');
  }
  if (entry.kind !== 'muscle') {
    return getOwnedStaticMaterial(ownedCache, 'other');
  }
  if (entry.muscleId === null) {
    return getOwnedHeatMaterial(ownedCache, 0);
  }
  if (selectedMuscle !== null && entry.muscleId === selectedMuscle) {
    return getOwnedStaticMaterial(ownedCache, 'selected');
  }
  const intensity = muscles[entry.muscleId]?.heatmapIntensity ?? 0;
  return getOwnedHeatMaterial(ownedCache, intensity);
};

/**
 * Renders the 3D anatomy model, highlights muscles with continuous heatmap
 * shading and selection state, and smoothly rotates between front and back views.
 */
export const BodyModel: React.FC<BodyModelProps> = ({
  muscles,
  selectedMuscle,
  view,
  onSelectMuscle,
  onLoaded,
}) => {
  const gltf = useGLTF(BODY_GLB_ASSET, false, false);
  const invalidate = useThree((state) => state.invalidate);
  const groupRef = useRef<THREE.Group>(null);
  const onLoadedRef = useRef(onLoaded);
  const originalMaterialsRef = useRef<OriginalMaterialMap>(new Map());
  const ownedMaterialsRef = useRef<OwnedMaterialCache>(new Map());

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  const meshEntries = useMemo<MeshEntry[]>(() => {
    const entries: MeshEntry[] = [];
    gltf.scene.traverse((object) => {
      if (!isThreeMesh(object)) return;
      const userData = object.userData as AnatomyNodeUserData;
      const kind: AnatomyKind = userData.kind ?? 'other';
      const muscleId = resolveAnatomyMuscleId(userData);
      entries.push({ mesh: object, kind, muscleId });
    });
    return entries;
  }, [gltf.scene]);

  // Capture glTF's original materials before any heatmap replacement, and restore
  // them onto every mesh prior to disposing component-owned materials on unmount.
  useEffect(() => {
    const originalMaterials = originalMaterialsRef.current;
    const ownedCache = ownedMaterialsRef.current;
    recordOriginalMaterials(meshEntries, originalMaterials);
    onLoadedRef.current?.();

    return () => {
      restoreAndDisposeOwnedMaterials(meshEntries, originalMaterials, ownedCache);
    };
  }, [meshEntries]);

  useEffect(() => {
    const ownedCache = ownedMaterialsRef.current;
    for (const entry of meshEntries) {
      const nextMaterial = resolveEntryMaterial(
        entry,
        muscles,
        selectedMuscle,
        ownedCache,
      );
      if (entry.mesh.material !== nextMaterial) {
        entry.mesh.material = nextMaterial;
      }
    }
    invalidate();
  }, [meshEntries, muscles, selectedMuscle, invalidate]);

  // Wake demand rendering whenever the target orientation changes.
  useEffect(() => {
    invalidate();
  }, [view, invalidate]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const targetY = view === 'back' ? Math.PI : 0;
    const diff = targetY - group.rotation.y;
    if (diff === 0) return;

    if (Math.abs(diff) < ROTATION_SNAP_EPSILON) {
      group.rotation.y = targetY;
      invalidate();
      return;
    }

    // Clamp delta so waking from an idle demand frame never skips the spin.
    const clampedDelta = Math.min(delta, MAX_ROTATION_DELTA);
    const alpha = 1 - Math.exp(-ROTATION_DAMPING * clampedDelta);
    group.rotation.y += diff * alpha;
    invalidate();
  });

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      const muscleId = resolveAnatomyMuscleId(
        event.object.userData as AnatomyNodeUserData,
      );
      if (muscleId === null) return;
      event.stopPropagation();
      onSelectMuscle(muscleId);
    },
    [onSelectMuscle],
  );

  return (
    <group ref={groupRef}>
      <primitive object={gltf.scene} onClick={handleClick} />
    </group>
  );
};
