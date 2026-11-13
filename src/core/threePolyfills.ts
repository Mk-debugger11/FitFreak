/**
 * Minimal Hermes shims for ES2021 GC primitives (`FinalizationRegistry`, `WeakRef`)
 * used by Three.js's `WebGLGeometries` and `WebGLTextures` bookkeeping.
 * Deterministic `.dispose()` calls remain active; these no-ops prevent startup crashes
 * on runtimes without `FinalizationRegistry`.
 */
const globalScope = globalThis as {
  FinalizationRegistry?: unknown;
  WeakRef?: unknown;
};

if (typeof globalScope.FinalizationRegistry === 'undefined') {
  class FallbackFinalizationRegistry {
    register(): void {}
    unregister(): boolean {
      return false;
    }
  }
  globalScope.FinalizationRegistry = FallbackFinalizationRegistry;
}

if (typeof globalScope.WeakRef === 'undefined') {
  class FallbackWeakRef<T extends object> {
    private readonly target: T;

    constructor(target: T) {
      this.target = target;
    }

    deref(): T {
      return this.target;
    }
  }
  globalScope.WeakRef = FallbackWeakRef;
}

