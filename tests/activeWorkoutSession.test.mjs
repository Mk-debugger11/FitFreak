import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const tmpCompileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitfreak-active-workout-test-'));
const tmpNodeModulesLink = path.join(tmpCompileDir, 'node_modules');

after(() => {
  try {
    if (fs.existsSync(tmpNodeModulesLink)) {
      fs.unlinkSync(tmpNodeModulesLink);
    }
  } catch {
    // ignore cleanup error if already absent
  }
  fs.rmSync(tmpCompileDir, { recursive: true, force: true });
});

/** Compiles the active workout store, session utilities, and their TS/JSON dependencies to a temp dir. */
function compileWorkspaceModules() {
  const rootFiles = [
    path.join(ROOT_DIR, 'src/store/activeWorkoutStore.ts'),
    path.join(ROOT_DIR, 'src/features/active-workout/workoutSessionUtils.ts'),
    path.join(ROOT_DIR, 'src/utils/exercise.ts'),
    path.join(ROOT_DIR, 'src/utils/date.ts'),
    path.join(ROOT_DIR, 'src/utils/id.ts'),
    path.join(ROOT_DIR, 'src/constants/exercises.ts'),
    path.join(ROOT_DIR, 'src/constants/muscles.ts'),
    path.join(ROOT_DIR, 'src/types.ts'),
  ];

  const configPath = path.join(ROOT_DIR, 'tsconfig.json');
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(
      ts.formatDiagnostic(configFile.error, {
        getCurrentDirectory: () => ROOT_DIR,
        getCanonicalFileName: (f) => f,
        getNewLine: () => '\n',
      }),
    );
  }
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    ROOT_DIR,
  );

  const program = ts.createProgram(rootFiles, {
    ...parsedConfig.options,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    customConditions: undefined,
    types: ['node'],
    ignoreDeprecations: '6.0',
    skipLibCheck: true,
    noEmit: false,
    outDir: tmpCompileDir,
    rootDir: ROOT_DIR,
  });

  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(program.emit().diagnostics);

  const blocking = diagnostics.filter(
    (d) => d.category === ts.DiagnosticCategory.Error,
  );
  if (blocking.length > 0) {
    const formatted = ts.formatDiagnosticsWithColorAndContext(blocking, {
      getCurrentDirectory: () => ROOT_DIR,
      getCanonicalFileName: (f) => f,
      getNewLine: () => '\n',
    });
    throw new Error(`TypeScript compile failed for test suite:\n${formatted}`);
  }
}

compileWorkspaceModules();
fs.symlinkSync(path.join(ROOT_DIR, 'node_modules'), tmpNodeModulesLink, 'dir');

const require = createRequire(import.meta.url);
const loadTsModule = (relPathWithoutExt) =>
  require(path.join(tmpCompileDir, relPathWithoutExt + '.js'));

const { useActiveWorkoutStore } = loadTsModule('src/store/activeWorkoutStore');
const {
  MINI_BAR_HEIGHT,
  SWIPE_UP_DISTANCE,
  SWIPE_DOWN_DISTANCE,
  SWIPE_VELOCITY_THRESHOLD,
  summarizeWorkoutSets,
  formatWorkoutTitle,
  getElapsedMinutes,
  clampSheetTranslateY,
  shouldSnapOpenFromMiniBar,
  shouldMinimizeFromSheet,
} = loadTsModule('src/features/active-workout/workoutSessionUtils');

/** Builds a minimal `WorkoutSet` fixture for summary unit tests. */
function makeSet(overrides = {}) {
  const now = new Date('2026-11-12T10:00:00.000Z');
  return {
    id: 'set-1',
    exerciseId: 'workout-1',
    weight: 100,
    reps: 8,
    completed: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

afterEach(() => {
  useActiveWorkoutStore.getState().cancelWorkout();
});

test('1. initial store state has currentWorkout === null and isMinimized === false', () => {
  const state = useActiveWorkoutStore.getState();
  const initialState = useActiveWorkoutStore.getInitialState();

  assert.equal(state.currentWorkout, null);
  assert.equal(state.isMinimized, false);
  assert.equal(initialState.currentWorkout, null);
  assert.equal(initialState.isMinimized, false);
});

test('2. minimizeWorkout and resumeWorkout when currentWorkout === null are no-ops and do not notify subscribers', () => {
  let notifications = 0;
  const unsubscribe = useActiveWorkoutStore.subscribe(() => {
    notifications += 1;
  });

  try {
    useActiveWorkoutStore.getState().minimizeWorkout();
    useActiveWorkoutStore.getState().resumeWorkout();

    assert.equal(notifications, 0);
    assert.equal(useActiveWorkoutStore.getState().currentWorkout, null);
    assert.equal(useActiveWorkoutStore.getState().isMinimized, false);
  } finally {
    unsubscribe();
  }
});

test('3. startWorkout initializes isMinimized: false, resolves muscles, and resets isMinimized when replacing a minimized workout', () => {
  useActiveWorkoutStore.getState().startWorkout('Bench Press', {
    category: 'Chest',
    equipmentType: 'barbell',
  });

  const firstState = useActiveWorkoutStore.getState();
  assert.equal(firstState.isMinimized, false);
  assert.ok(firstState.currentWorkout);
  assert.equal(typeof firstState.currentWorkout.id, 'string');
  assert.ok(firstState.currentWorkout.id.length > 0);
  assert.equal(firstState.currentWorkout.name, 'Bench Press');
  assert.equal(firstState.currentWorkout.category, 'Chest');
  assert.equal(firstState.currentWorkout.equipmentType, 'barbell');
  assert.deepEqual(firstState.currentWorkout.sets, []);
  assert.ok(firstState.currentWorkout.startTime instanceof Date);
  assert.ok(firstState.currentWorkout.createdAt instanceof Date);
  assert.ok(firstState.currentWorkout.updatedAt instanceof Date);
  assert.deepEqual(firstState.currentWorkout.primaryMuscles, ['pectoralis_lower']);
  assert.deepEqual(firstState.currentWorkout.secondaryMuscles, [
    'pectoralis_upper',
    'deltoid_anterior',
    'triceps_brachii',
  ]);
  assert.deepEqual(firstState.currentWorkout.stabilizerMuscles, []);

  useActiveWorkoutStore.getState().minimizeWorkout();
  assert.equal(useActiveWorkoutStore.getState().isMinimized, true);

  useActiveWorkoutStore.getState().startWorkout('Incline Dumbbell Press', {
    category: 'Chest',
    equipmentType: 'dumbbell',
  });

  const secondState = useActiveWorkoutStore.getState();
  assert.equal(secondState.isMinimized, false);
  assert.ok(secondState.currentWorkout);
  assert.equal(secondState.currentWorkout.name, 'Incline Dumbbell Press');
  assert.equal(secondState.currentWorkout.equipmentType, 'dumbbell');
  assert.deepEqual(secondState.currentWorkout.sets, []);
  assert.deepEqual(secondState.currentWorkout.primaryMuscles, ['pectoralis_upper']);
});

test('4. minimizeWorkout flips isMinimized to true while preserving workout targets/sets and skips redundant subscriber notifications', () => {
  const store = useActiveWorkoutStore.getState();
  store.startWorkout('Bench Press', { category: 'Chest', equipmentType: 'barbell' });

  const startedWorkout = useActiveWorkoutStore.getState().currentWorkout;
  assert.ok(startedWorkout);
  useActiveWorkoutStore.getState().addSet(startedWorkout.id, 100, 8);
  useActiveWorkoutStore.getState().addSet(startedWorkout.id, 120, 5);

  const workoutBeforeMinimize = useActiveWorkoutStore.getState().currentWorkout;
  assert.ok(workoutBeforeMinimize);
  assert.equal(workoutBeforeMinimize.sets.length, 2);

  let notifications = 0;
  const unsubscribe = useActiveWorkoutStore.subscribe(() => {
    notifications += 1;
  });

  try {
    useActiveWorkoutStore.getState().minimizeWorkout();
    const minimizedState = useActiveWorkoutStore.getState();
    assert.equal(notifications, 1);
    assert.equal(minimizedState.isMinimized, true);
    assert.equal(minimizedState.currentWorkout, workoutBeforeMinimize);
    assert.deepEqual(minimizedState.currentWorkout?.primaryMuscles, ['pectoralis_lower']);
    assert.deepEqual(minimizedState.currentWorkout?.secondaryMuscles, [
      'pectoralis_upper',
      'deltoid_anterior',
      'triceps_brachii',
    ]);
    assert.equal(minimizedState.currentWorkout?.sets.length, 2);

    // Redundant minimize call must be a no-op with zero extra notifications.
    useActiveWorkoutStore.getState().minimizeWorkout();
    assert.equal(notifications, 1);
    assert.equal(useActiveWorkoutStore.getState().isMinimized, true);
  } finally {
    unsubscribe();
  }
});

test('5. logging sets while isMinimized === true succeeds and preserves isMinimized: true', () => {
  useActiveWorkoutStore.getState().startWorkout('Bench Press', {
    category: 'Chest',
    equipmentType: 'barbell',
  });
  const workoutId = useActiveWorkoutStore.getState().currentWorkout?.id;
  assert.ok(workoutId);

  useActiveWorkoutStore.getState().minimizeWorkout();
  assert.equal(useActiveWorkoutStore.getState().isMinimized, true);

  useActiveWorkoutStore.getState().addSet(workoutId, 60, 10);
  assert.equal(useActiveWorkoutStore.getState().isMinimized, true);
  assert.equal(useActiveWorkoutStore.getState().currentWorkout?.sets.length, 1);

  useActiveWorkoutStore.getState().addSet(workoutId, 100, 6);
  assert.equal(useActiveWorkoutStore.getState().isMinimized, true);
  let sets = useActiveWorkoutStore.getState().currentWorkout?.sets ?? [];
  assert.equal(sets.length, 2);

  const firstSetId = sets[0].id;
  const secondSetId = sets[1].id;

  useActiveWorkoutStore.getState().updateSet(firstSetId, 65, 12);
  sets = useActiveWorkoutStore.getState().currentWorkout?.sets ?? [];
  assert.equal(useActiveWorkoutStore.getState().isMinimized, true);
  assert.equal(sets[0].weight, 65);
  assert.equal(sets[0].reps, 12);

  useActiveWorkoutStore.getState().toggleSetWarmup(firstSetId);
  sets = useActiveWorkoutStore.getState().currentWorkout?.sets ?? [];
  assert.equal(useActiveWorkoutStore.getState().isMinimized, true);
  assert.equal(sets[0].isWarmup, true);

  useActiveWorkoutStore.getState().toggleSetWarmup(firstSetId);
  sets = useActiveWorkoutStore.getState().currentWorkout?.sets ?? [];
  assert.equal(useActiveWorkoutStore.getState().isMinimized, true);
  assert.equal(sets[0].isWarmup, false);

  useActiveWorkoutStore.getState().toggleSetComplete(secondSetId);
  sets = useActiveWorkoutStore.getState().currentWorkout?.sets ?? [];
  assert.equal(useActiveWorkoutStore.getState().isMinimized, true);
  assert.equal(sets[1].completed, true);

  useActiveWorkoutStore.getState().deleteSet(firstSetId);
  sets = useActiveWorkoutStore.getState().currentWorkout?.sets ?? [];
  assert.equal(useActiveWorkoutStore.getState().isMinimized, true);
  assert.equal(sets.length, 1);
  assert.equal(sets[0].id, secondSetId);
  assert.equal(sets[0].weight, 100);
  assert.equal(sets[0].reps, 6);
  assert.equal(sets[0].completed, true);
});

test('6. resumeWorkout flips isMinimized back to false with sets intact and skips redundant notifications', () => {
  useActiveWorkoutStore.getState().startWorkout('Bench Press', {
    category: 'Chest',
    equipmentType: 'barbell',
  });
  const workoutId = useActiveWorkoutStore.getState().currentWorkout?.id;
  assert.ok(workoutId);

  useActiveWorkoutStore.getState().addSet(workoutId, 60, 10);
  useActiveWorkoutStore.getState().addSet(workoutId, 100, 5);
  const initialSets = useActiveWorkoutStore.getState().currentWorkout?.sets ?? [];
  useActiveWorkoutStore.getState().toggleSetWarmup(initialSets[0].id);
  useActiveWorkoutStore.getState().toggleSetComplete(initialSets[1].id);

  useActiveWorkoutStore.getState().minimizeWorkout();
  const setsBeforeResume = useActiveWorkoutStore.getState().currentWorkout?.sets;
  assert.equal(useActiveWorkoutStore.getState().isMinimized, true);
  assert.equal(setsBeforeResume?.length, 2);

  let notifications = 0;
  const unsubscribe = useActiveWorkoutStore.subscribe(() => {
    notifications += 1;
  });

  try {
    useActiveWorkoutStore.getState().resumeWorkout();
    const resumedState = useActiveWorkoutStore.getState();
    assert.equal(notifications, 1);
    assert.equal(resumedState.isMinimized, false);
    assert.equal(resumedState.currentWorkout?.sets, setsBeforeResume);
    assert.equal(resumedState.currentWorkout?.sets[0].isWarmup, true);
    assert.equal(resumedState.currentWorkout?.sets[1].completed, true);

    // Redundant resume call must be a no-op with zero extra notifications.
    useActiveWorkoutStore.getState().resumeWorkout();
    assert.equal(notifications, 1);
    assert.equal(useActiveWorkoutStore.getState().isMinimized, false);
  } finally {
    unsubscribe();
  }
});

test('7. finishWorkout returns completed workout with endTime and resets both currentWorkout and isMinimized', () => {
  assert.equal(useActiveWorkoutStore.getState().finishWorkout(), null);
  assert.equal(useActiveWorkoutStore.getState().isMinimized, false);

  useActiveWorkoutStore.getState().startWorkout('Bench Press', {
    category: 'Chest',
    equipmentType: 'barbell',
  });
  const workoutId = useActiveWorkoutStore.getState().currentWorkout?.id;
  assert.ok(workoutId);

  useActiveWorkoutStore.getState().addSet(workoutId, 100, 5);
  useActiveWorkoutStore.getState().minimizeWorkout();
  assert.equal(useActiveWorkoutStore.getState().isMinimized, true);

  const finished = useActiveWorkoutStore.getState().finishWorkout();
  assert.ok(finished);
  assert.equal(finished.id, workoutId);
  assert.equal(finished.name, 'Bench Press');
  assert.equal(finished.sets.length, 1);
  assert.ok(finished.endTime instanceof Date);
  assert.ok(finished.updatedAt instanceof Date);

  const postFinishState = useActiveWorkoutStore.getState();
  assert.equal(postFinishState.currentWorkout, null);
  assert.equal(postFinishState.isMinimized, false);
});

test('8. cancelWorkout resets both currentWorkout and isMinimized', () => {
  useActiveWorkoutStore.getState().startWorkout('Bench Press', {
    category: 'Chest',
    equipmentType: 'barbell',
  });
  const workoutId = useActiveWorkoutStore.getState().currentWorkout?.id;
  assert.ok(workoutId);
  useActiveWorkoutStore.getState().addSet(workoutId, 90, 8);
  useActiveWorkoutStore.getState().minimizeWorkout();
  assert.equal(useActiveWorkoutStore.getState().isMinimized, true);

  useActiveWorkoutStore.getState().cancelWorkout();
  assert.equal(useActiveWorkoutStore.getState().currentWorkout, null);
  assert.equal(useActiveWorkoutStore.getState().isMinimized, false);

  // Also verify cancelWorkout from expanded state clears cleanly.
  useActiveWorkoutStore.getState().startWorkout('Squat', {
    category: 'Legs',
    equipmentType: 'barbell',
  });
  assert.equal(useActiveWorkoutStore.getState().isMinimized, false);
  useActiveWorkoutStore.getState().cancelWorkout();
  assert.equal(useActiveWorkoutStore.getState().currentWorkout, null);
  assert.equal(useActiveWorkoutStore.getState().isMinimized, false);
});

test('9. summarizeWorkoutSets handles empty, single/multi working, single/multi warm-up, mixed sets, and completedCount accuracy', () => {
  assert.deepEqual(summarizeWorkoutSets([]), {
    totalCount: 0,
    workingCount: 0,
    warmupCount: 0,
    completedCount: 0,
    summaryLabel: 'No sets logged yet',
  });

  assert.deepEqual(
    summarizeWorkoutSets([makeSet({ id: 'w1', isWarmup: false, completed: false })]),
    {
      totalCount: 1,
      workingCount: 1,
      warmupCount: 0,
      completedCount: 0,
      summaryLabel: '1 working set',
    },
  );

  assert.deepEqual(
    summarizeWorkoutSets([
      makeSet({ id: 'w1', completed: true }),
      makeSet({ id: 'w2', isWarmup: false, completed: true }),
      makeSet({ id: 'w3', completed: false }),
    ]),
    {
      totalCount: 3,
      workingCount: 3,
      warmupCount: 0,
      completedCount: 2,
      summaryLabel: '3 working sets',
    },
  );

  assert.deepEqual(
    summarizeWorkoutSets([makeSet({ id: 'wu1', isWarmup: true, completed: true })]),
    {
      totalCount: 1,
      workingCount: 0,
      warmupCount: 1,
      completedCount: 1,
      summaryLabel: '1 warm-up set',
    },
  );

  assert.deepEqual(
    summarizeWorkoutSets([
      makeSet({ id: 'wu1', isWarmup: true, completed: true }),
      makeSet({ id: 'wu2', isWarmup: true, completed: false }),
    ]),
    {
      totalCount: 2,
      workingCount: 0,
      warmupCount: 2,
      completedCount: 1,
      summaryLabel: '2 warm-up sets',
    },
  );

  assert.deepEqual(
    summarizeWorkoutSets([
      makeSet({ id: 'wu1', isWarmup: true, completed: true }),
      makeSet({ id: 'w1', isWarmup: false, completed: true }),
    ]),
    {
      totalCount: 2,
      workingCount: 1,
      warmupCount: 1,
      completedCount: 2,
      summaryLabel: '1 working set, 1 warm-up',
    },
  );

  assert.deepEqual(
    summarizeWorkoutSets([
      makeSet({ id: 'wu1', isWarmup: true, completed: true }),
      makeSet({ id: 'wu2', isWarmup: true, completed: false }),
      makeSet({ id: 'w1', completed: true }),
      makeSet({ id: 'w2', completed: true }),
      makeSet({ id: 'w3', completed: false }),
    ]),
    {
      totalCount: 5,
      workingCount: 3,
      warmupCount: 2,
      completedCount: 3,
      summaryLabel: '3 working sets, 2 warm-up',
    },
  );
});

test('10. formatWorkoutTitle trims valid names and resolves category-aware fallbacks', () => {
  assert.equal(formatWorkoutTitle('  Bench Press  ', 'Chest'), 'Bench Press');
  assert.equal(formatWorkoutTitle('Romanian Deadlift'), 'Romanian Deadlift');

  assert.equal(formatWorkoutTitle('   ', 'Mixed'), 'Mixed Workout');
  assert.equal(formatWorkoutTitle('', 'Mixed'), 'Mixed Workout');
  assert.equal(formatWorkoutTitle(undefined, 'Mixed'), 'Mixed Workout');

  assert.equal(formatWorkoutTitle('   ', 'Chest'), 'Ongoing Workout');
  assert.equal(formatWorkoutTitle('   '), 'Ongoing Workout');
  assert.equal(formatWorkoutTitle('', undefined), 'Ongoing Workout');
  assert.equal(formatWorkoutTitle(undefined, undefined), 'Ongoing Workout');
});

test('11. getElapsedMinutes handles past Dates, ISO strings, future Dates, and invalid inputs', () => {
  const fixedNow = new Date('2026-11-12T12:00:00.000Z');

  assert.equal(getElapsedMinutes(new Date('2026-11-12T11:15:30.000Z'), fixedNow), 44);
  assert.equal(getElapsedMinutes(new Date('2026-11-12T11:15:00.000Z'), fixedNow), 45);
  assert.equal(getElapsedMinutes(new Date('2026-11-12T12:00:00.000Z'), fixedNow), 0);

  assert.equal(getElapsedMinutes('2026-11-12T11:42:10.000Z', fixedNow), 17);

  // Future dates clamp to 0.
  assert.equal(getElapsedMinutes(new Date('2026-11-12T12:15:00.000Z'), fixedNow), 0);
  assert.equal(getElapsedMinutes('2026-11-12T12:00:01.000Z', fixedNow), 0);
  assert.equal(getElapsedMinutes(new Date(Date.now() + 60 * 60000)), 0);

  // Invalid date inputs clamp to 0.
  assert.equal(getElapsedMinutes('not-a-valid-date', fixedNow), 0);
  assert.equal(getElapsedMinutes('', fixedNow), 0);
  assert.equal(getElapsedMinutes(new Date('invalid-date'), fixedNow), 0);
  assert.equal(getElapsedMinutes(new Date('2026-11-12T11:00:00.000Z'), new Date('invalid-now')), 0);
});

test('12. sheet gesture clamping and swipe boundary checks enforce exact thresholds and finite guards', () => {
  assert.equal(MINI_BAR_HEIGHT, 64);
  assert.equal(SWIPE_UP_DISTANCE, 56);
  assert.equal(SWIPE_DOWN_DISTANCE, 100);
  assert.equal(SWIPE_VELOCITY_THRESHOLD, 0.45);

  // clampSheetTranslateY
  assert.equal(clampSheetTranslateY(0, 400), 0);
  assert.equal(clampSheetTranslateY(150, 400), 150);
  assert.equal(clampSheetTranslateY(400, 400), 400);
  assert.equal(clampSheetTranslateY(-25, 400), 0);
  assert.equal(clampSheetTranslateY(550, 400), 400);
  assert.equal(clampSheetTranslateY(50, -100), 0);
  assert.equal(clampSheetTranslateY(-10, -100), 0);
  assert.equal(clampSheetTranslateY(Number.NaN, 400), 0);
  assert.equal(clampSheetTranslateY(Number.POSITIVE_INFINITY, 400), 0);
  assert.equal(clampSheetTranslateY(Number.NEGATIVE_INFINITY, 400), 0);
  assert.equal(clampSheetTranslateY(50, Number.NaN), 0);
  assert.equal(clampSheetTranslateY(50, Number.POSITIVE_INFINITY), 0);
  assert.equal(clampSheetTranslateY(50, Number.NEGATIVE_INFINITY), 0);

  // shouldSnapOpenFromMiniBar (-55 vs -56, -0.44 vs -0.45)
  assert.equal(shouldSnapOpenFromMiniBar(-55, 0), false);
  assert.equal(shouldSnapOpenFromMiniBar(-56, 0), true);
  assert.equal(shouldSnapOpenFromMiniBar(-56, 0.2), true);
  assert.equal(shouldSnapOpenFromMiniBar(0, -0.44), false);
  assert.equal(shouldSnapOpenFromMiniBar(0, -0.45), true);
  assert.equal(shouldSnapOpenFromMiniBar(15, -0.45), true);
  assert.equal(shouldSnapOpenFromMiniBar(-55, -0.44), false);
  assert.equal(shouldSnapOpenFromMiniBar(56, 0.45), false);

  // shouldMinimizeFromSheet (99 vs 100, 0.44 vs 0.45)
  assert.equal(shouldMinimizeFromSheet(99, 0), false);
  assert.equal(shouldMinimizeFromSheet(100, 0), true);
  assert.equal(shouldMinimizeFromSheet(100, -0.2), true);
  assert.equal(shouldMinimizeFromSheet(0, 0.44), false);
  assert.equal(shouldMinimizeFromSheet(0, 0.45), true);
  assert.equal(shouldMinimizeFromSheet(-15, 0.45), true);
  assert.equal(shouldMinimizeFromSheet(99, 0.44), false);
  assert.equal(shouldMinimizeFromSheet(-100, -0.45), false);
});
