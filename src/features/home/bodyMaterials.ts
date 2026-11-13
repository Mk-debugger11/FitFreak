import * as THREE from 'three';
import { theme } from '../../theme';
import { interpolateHeatColor } from './doseResponse';
import {
  ANATOMY_HEAT_PALETTE,
  DEFAULT_SCORING_CONFIG,
  type HeatColorStop,
} from './scoringConfig';

/** Default number of quantization buckets across `[0, 1]` heat intensity (21 discrete steps). */
export const HEAT_INTENSITY_BUCKETS = 20;

/** Non-heatmap anatomical material keys managed by {@link BodyMaterialManager}. */
export type StaticMaterialKind = 'bone' | 'other' | 'selected';

/** Cache of Three.js materials created and owned by the 3D body component. */
export type OwnedMaterialCache = Map<string, THREE.MeshStandardMaterial>;

/** Registry storing each glTF mesh's original material before any heatmap override. */
export type OriginalMaterialMap = Map<THREE.Object3D, THREE.Material | THREE.Material[]>;

/** Minimal mesh descriptor required for material recording and lifecycle cleanup. */
export interface TrackedMeshEntry {
  mesh: THREE.Mesh;
}

const STATIC_MATERIAL_SPECS: Record<
  StaticMaterialKind,
  { color: string; roughness: number; emissive?: string; emissiveIntensity?: number }
> = {
  bone: {
    color: theme.colors.anatomy.bone,
    roughness: 0.78,
  },
  other: {
    color: theme.colors.anatomy.other,
    roughness: 0.65,
  },
  selected: {
    color: theme.colors.anatomy.selected,
    roughness: 0.4,
    emissive: theme.colors.primary,
    emissiveIntensity: 0.25,
  },
};

/**
 * Quantizes a continuous `[0, 1]` heatmap intensity into `buckets + 1` discrete steps
 * (`0` for non-finite or `<= 0`, `1` for `>= 1`).
 */
export const quantizeHeatIntensity = (
  intensity: number,
  buckets = HEAT_INTENSITY_BUCKETS,
): number => {
  if (!Number.isFinite(intensity) || intensity <= 0) {
    return 0;
  }
  if (intensity >= 1) {
    return 1;
  }
  const safeBuckets =
    Number.isFinite(buckets) && buckets >= 1 ? Math.floor(buckets) : HEAT_INTENSITY_BUCKETS;
  const quantized = Math.round(intensity * safeBuckets) / safeBuckets;
  return Math.min(1, Math.max(0, quantized));
};

/** Returns the deterministic cache key (`heat:<quantized>`) for a heatmap intensity. */
export const getHeatMaterialKey = (
  intensity: number,
  buckets = HEAT_INTENSITY_BUCKETS,
): string => {
  const quantized = quantizeHeatIntensity(intensity, buckets);
  return `heat:${Number(quantized.toFixed(6))}`;
};

/**
 * Retrieves or creates a cached component-owned material for a static anatomy role
 * (`bone`, `other`, or `selected`).
 */
export const getOwnedStaticMaterial = (
  cache: OwnedMaterialCache,
  kind: StaticMaterialKind,
): THREE.MeshStandardMaterial => {
  const cached = cache.get(kind);
  if (cached) {
    return cached;
  }

  const spec = STATIC_MATERIAL_SPECS[kind];
  const material = new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: spec.roughness,
    ...(spec.emissive !== undefined
      ? { emissive: spec.emissive, emissiveIntensity: spec.emissiveIntensity ?? 0 }
      : {}),
  });
  cache.set(kind, material);
  return material;
};

/**
 * Retrieves or creates a cached component-owned `MeshStandardMaterial` shaded
 * according to the quantized `[0, 1]` heatmap intensity.
 */
export const getOwnedHeatMaterial = (
  cache: OwnedMaterialCache,
  intensity: number,
  heatStops: readonly HeatColorStop[] = DEFAULT_SCORING_CONFIG.heatStops,
  buckets = HEAT_INTENSITY_BUCKETS,
): THREE.MeshStandardMaterial => {
  const quantized = quantizeHeatIntensity(intensity, buckets);
  const key = getHeatMaterialKey(quantized, buckets);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const color =
    quantized <= 0 && heatStops === DEFAULT_SCORING_CONFIG.heatStops
      ? ANATOMY_HEAT_PALETTE.none
      : interpolateHeatColor(quantized, heatStops);

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58 - 0.13 * quantized,
  });
  cache.set(key, material);
  return material;
};

/**
 * Captures each mesh's original glTF material prior to its first replacement.
 * Existing entries in `originalMaterials` are never overwritten.
 */
export const recordOriginalMaterials = (
  entries: readonly TrackedMeshEntry[],
  originalMaterials: OriginalMaterialMap,
): void => {
  for (const entry of entries) {
    if (!originalMaterials.has(entry.mesh)) {
      originalMaterials.set(entry.mesh, entry.mesh.material);
    }
  }
};

/**
 * Safely restores every tracked mesh to its original glTF material BEFORE disposing
 * component-owned materials in `ownedCache`, then clears both maps. Original glTF
 * materials are never disposed.
 */
export const restoreAndDisposeOwnedMaterials = (
  entries: readonly TrackedMeshEntry[],
  originalMaterials: OriginalMaterialMap,
  ownedCache: OwnedMaterialCache,
): void => {
  for (const entry of entries) {
    const original = originalMaterials.get(entry.mesh);
    if (original !== undefined) {
      entry.mesh.material = original;
    }
  }

  for (const material of ownedCache.values()) {
    material.dispose();
  }

  ownedCache.clear();
  originalMaterials.clear();
};

/**
 * Stateful coordinator wrapping {@link recordOriginalMaterials},
 * {@link getOwnedStaticMaterial}, {@link getOwnedHeatMaterial}, and
 * {@link restoreAndDisposeOwnedMaterials} for managing 3D anatomy material lifecycles.
 */
export class BodyMaterialManager {
  readonly originalMaterials: OriginalMaterialMap = new Map();
  readonly ownedCache: OwnedMaterialCache = new Map();
  private readonly heatStops: readonly HeatColorStop[];
  private readonly buckets: number;

  constructor(
    heatStops: readonly HeatColorStop[] = DEFAULT_SCORING_CONFIG.heatStops,
    buckets = HEAT_INTENSITY_BUCKETS,
  ) {
    this.heatStops = heatStops;
    this.buckets = buckets;
  }

  /** Records original glTF materials for any unrecorded meshes. */
  recordOriginalMaterials(entries: readonly TrackedMeshEntry[]): void {
    recordOriginalMaterials(entries, this.originalMaterials);
  }

  /** Returns a cached component-owned material for `bone`, `other`, or `selected`. */
  getStaticMaterial(kind: StaticMaterialKind): THREE.MeshStandardMaterial {
    return getOwnedStaticMaterial(this.ownedCache, kind);
  }

  /** Returns a cached component-owned heatmap material for a `[0, 1]` intensity. */
  getHeatMaterial(intensity: number): THREE.MeshStandardMaterial {
    return getOwnedHeatMaterial(this.ownedCache, intensity, this.heatStops, this.buckets);
  }

  /** Restores original glTF materials onto tracked meshes and disposes owned materials. */
  restoreAndDispose(entries: readonly TrackedMeshEntry[]): void {
    restoreAndDisposeOwnedMaterials(entries, this.originalMaterials, this.ownedCache);
  }
}
