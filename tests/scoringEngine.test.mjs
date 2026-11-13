import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const tmpCompileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitfreak-test-'));
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

function compileWorkspaceModules() {
  const rootFiles = [
    path.join(ROOT_DIR, 'src/features/home/muscleActivity.ts'),
    path.join(ROOT_DIR, 'src/features/home/doseResponse.ts'),
    path.join(ROOT_DIR, 'src/features/home/setPartitioner.ts'),
    path.join(ROOT_DIR, 'src/features/home/effortCalculator.ts'),
    path.join(ROOT_DIR, 'src/features/home/muscleContributions.ts'),
    path.join(ROOT_DIR, 'src/features/home/scoringConfig.ts'),
    path.join(ROOT_DIR, 'src/features/home/bodyMaterials.ts'),
    path.join(ROOT_DIR, 'src/theme.ts'),
    path.join(ROOT_DIR, 'src/utils/exercise.ts'),
    path.join(ROOT_DIR, 'src/constants/exercises.ts'),
    path.join(ROOT_DIR, 'src/constants/muscles.ts'),
    path.join(ROOT_DIR, 'src/services/api.ts'),
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

const scoringConfig = loadTsModule('src/features/home/scoringConfig');
const effortCalculator = loadTsModule('src/features/home/effortCalculator');
const setPartitioner = loadTsModule('src/features/home/setPartitioner');
const doseResponse = loadTsModule('src/features/home/doseResponse');
const muscleActivity = loadTsModule('src/features/home/muscleActivity');
const musclesConst = loadTsModule('src/constants/muscles');
const exerciseUtils = loadTsModule('src/utils/exercise');
const apiModule = loadTsModule('src/services/api');
const bodyMaterials = loadTsModule('src/features/home/bodyMaterials');
const backendMuscles = require(path.join(ROOT_DIR, 'backend/constants/muscles.js'));

const { DEFAULT_SCORING_CONFIG, ANATOMY_HEAT_PALETTE } = scoringConfig;
const { computeRirEffortFactor } = effortCalculator;
const { partitionWorkoutSets } = setPartitioner;
const {
  computeEffectiveLoad,
  computeHeatmapIntensity,
  computeStimulusSaturationPct,
  classifyVolumeZone,
  getActivityLevelFromEffectiveLoad,
  interpolateHeatColor,
} = doseResponse;
const { computeMuscleActivity } = muscleActivity;

const DAY_START = new Date('2026-11-10T00:00:00.000Z');
const DAY_END = new Date('2026-11-10T23:59:59.999Z');
const WEEK_START = new Date('2026-11-09T00:00:00.000Z');
const WEEK_END = new Date('2026-11-15T23:59:59.999Z');

let setSeq = 1;
function makeSet(overrides = {}) {
  const idx = setSeq++;
  const baseTime = new Date(DAY_START.getTime() + 9 * 3600 * 1000 + idx * 60 * 1000);
  return {
    id: `set_${idx}`,
    exerciseId: 'ex_test',
    weight: 60,
    reps: 10,
    completed: true,
    createdAt: baseTime,
    updatedAt: baseTime,
    ...overrides,
  };
}

function makeWorkout({
  id = 'wo_1',
  name = 'Custom Isolation Test',
  category = 'Chest',
  equipmentType = 'barbell',
  primaryMuscles = ['pectoralis_lower'],
  secondaryMuscles = [],
  stabilizerMuscles = [],
  startTime = new Date('2026-11-10T09:00:00.000Z'),
  sets = [],
} = {}) {
  const endTime = new Date(startTime.getTime() + 20 * 60 * 1000);
  return {
    id,
    name,
    category,
    equipmentType,
    primaryMuscles,
    secondaryMuscles,
    stabilizerMuscles,
    startTime,
    endTime,
    totalVolume: sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
    totalSets: sets.filter((s) => s.completed).length,
    workoutData: {
      id: `${id}_active`,
      name,
      category,
      equipmentType,
      primaryMuscles,
      secondaryMuscles,
      stabilizerMuscles,
      startTime,
      endTime,
      sets,
      createdAt: startTime,
      updatedAt: endTime,
    },
    createdAt: startTime,
    updatedAt: endTime,
  };
}

test('Authoritative role-capped effectiveLoad drives all metrics with zero visual-only post-caps', () => {
  const bands = { directLoad: 1.0, rawSecondaryLoad: 2.5, rawStabilizerLoad: 1.5 };
  for (const period of ['daily', 'weekly']) {
    const effective = computeEffectiveLoad(bands, period);
    const intensity = computeHeatmapIntensity(effective, period);
    const saturation = computeStimulusSaturationPct(effective, period);
    const zone = classifyVolumeZone(effective, 0, period, 'pectoralis_lower');
    const level = getActivityLevelFromEffectiveLoad(effective, period, 'pectoralis_lower');

    assert.equal(intensity, computeHeatmapIntensity(effective, period, DEFAULT_SCORING_CONFIG, 'pectoralis_lower'));
    assert.equal(saturation, computeStimulusSaturationPct(effective, period));
    assert.ok(['none', 'light', 'moderate', 'high'].includes(level));
    assert.ok(zone.length > 0);
  }

  const wDirectPlusIndirect = makeWorkout({
    id: 'wo_direct_indirect',
    name: 'Bench Synthetic',
    primaryMuscles: ['pectoralis_lower'],
    secondaryMuscles: ['deltoid_anterior'],
    stabilizerMuscles: ['rectus_abdominis'],
    sets: [makeSet({ weight: 80, reps: 8, isWarmup: false })],
  });
  const wExtraIndirect = makeWorkout({
    id: 'wo_indirect_5',
    name: 'Tricep Synthetic',
    primaryMuscles: ['triceps_brachii'],
    secondaryMuscles: ['deltoid_anterior'],
    stabilizerMuscles: [],
    sets: Array.from({ length: 5 }, () => makeSet({ weight: 40, reps: 10, isWarmup: false })),
  });

  const res = computeMuscleActivity(
    [wDirectPlusIndirect, wExtraIndirect],
    { start: DAY_START, end: DAY_END },
    'daily',
  );
  const pec = res.muscles.pectoralis_lower;
  const frontDelt = res.muscles.deltoid_anterior;
  const triceps = res.muscles.triceps_brachii;
  assert.ok(pec && frontDelt && triceps);

  // Downstream fields must match recomputed outputs strictly from entry.effectiveLoad
  assert.equal(
    pec.heatmapIntensity,
    computeHeatmapIntensity(pec.effectiveLoad, 'daily', DEFAULT_SCORING_CONFIG, 'pectoralis_lower'),
  );
  assert.equal(
    pec.stimulusSaturationPct,
    computeStimulusSaturationPct(pec.effectiveLoad, 'daily', DEFAULT_SCORING_CONFIG, 'pectoralis_lower'),
  );
  assert.equal(
    pec.volumeZone,
    classifyVolumeZone(pec.effectiveLoad, pec.warmupSets, 'daily', 'pectoralis_lower'),
  );
  assert.equal(
    frontDelt.heatmapIntensity,
    computeHeatmapIntensity(frontDelt.effectiveLoad, 'daily', DEFAULT_SCORING_CONFIG, 'deltoid_anterior'),
  );

  // Raw weighted volume stays uncapped (3.0) while effectiveLoad obeys indirectOnlyCeiling
  assert.equal(frontDelt.rawWeightedSets, 3.0);
  assert.ok(
    frontDelt.effectiveLoad <= DEFAULT_SCORING_CONFIG.caps.indirectOnlyCeiling.daily + 1e-9,
    `Expected indirect-only effectiveLoad (${frontDelt.effectiveLoad}) <= ceiling (${DEFAULT_SCORING_CONFIG.caps.indirectOnlyCeiling.daily})`,
  );
  assert.ok(triceps.effectiveLoad > frontDelt.effectiveLoad, '5 direct triceps sets must exceed 6 indirect delt sets');
});

test('1 direct + 5 indirect sets on a muscle: direct contribution remains distinguishable vs 5 indirect-only sets', () => {
  const directOne = makeWorkout({
    id: 'wo_1_plus_5',
    primaryMuscles: ['biceps_brachii'],
    secondaryMuscles: [],
    stabilizerMuscles: [],
    sets: [makeSet({ isWarmup: false })],
  });
  const fiveIndirect = makeWorkout({
    id: 'wo_1_plus_5_part2',
    primaryMuscles: ['latissimus_dorsi'],
    secondaryMuscles: ['biceps_brachii', 'brachialis'],
    stabilizerMuscles: [],
    sets: Array.from({ length: 5 }, () => makeSet({ isWarmup: false })),
  });

  const res = computeMuscleActivity(
    [directOne, fiveIndirect],
    { start: DAY_START, end: DAY_END },
    'daily',
  );

  const biceps = res.muscles.biceps_brachii; // 1 direct + 5 indirect
  const brachialis = res.muscles.brachialis; // 0 direct + 5 indirect
  assert.ok(biceps && brachialis);
  assert.equal(biceps.primarySets, 1);
  assert.equal(biceps.secondarySets, 5);
  assert.equal(biceps.rawWeightedSets, 3.5);
  assert.equal(brachialis.primarySets, 0);
  assert.equal(brachialis.secondarySets, 5);
  assert.equal(brachialis.rawWeightedSets, 2.5);
  assert.ok(
    biceps.effectiveLoad > brachialis.effectiveLoad,
    `1 direct + 5 indirect (${biceps.effectiveLoad}) must exceed 0 direct + 5 indirect (${brachialis.effectiveLoad})`,
  );
  assert.ok(
    biceps.heatmapIntensity > brachialis.heatmapIntensity,
    '1 direct + 5 indirect heatmapIntensity must exceed 5 indirect-only',
  );
});

test('10 stabilizer-only sets remain capped at Light on heatmap and below direct working volume', () => {
  const tenStabilizerOnly = makeWorkout({
    id: 'wo_10_stab',
    primaryMuscles: ['pectoralis_lower'],
    secondaryMuscles: [],
    stabilizerMuscles: ['rectus_abdominis'],
    sets: Array.from({ length: 10 }, () => makeSet({ isWarmup: false })),
  });

  for (const period of ['daily', 'weekly']) {
    const range = period === 'daily' ? { start: DAY_START, end: DAY_END } : { start: WEEK_START, end: WEEK_END };
    const res = computeMuscleActivity([tenStabilizerOnly], range, period);
    const abs = res.muscles.rectus_abdominis;
    assert.ok(abs);
    assert.equal(abs.primarySets, 0);
    assert.equal(abs.secondarySets, 0);
    assert.equal(abs.stabilizerSets, 10);
    assert.equal(abs.rawWeightedSets, 1.5);
    assert.ok(
      abs.effectiveLoad <= DEFAULT_SCORING_CONFIG.caps.stabilizerMaxEffective[period] + 1e-9,
    );
    assert.equal(abs.level, 'light', `Expected stabilizer-only (${period}) to stay light, got ${abs.level}`);
  }
});

test('1 direct + 10 stabilizer sets preserve separate direct and stabilizer contributions', () => {
  const directOne = makeWorkout({
    id: 'wo_direct_1_for_abs',
    primaryMuscles: ['rectus_abdominis'],
    secondaryMuscles: [],
    stabilizerMuscles: [],
    sets: [makeSet({ isWarmup: false })],
  });
  const stabTen = makeWorkout({
    id: 'wo_stab_10_for_abs',
    primaryMuscles: ['pectoralis_lower'],
    secondaryMuscles: [],
    stabilizerMuscles: ['rectus_abdominis'],
    sets: Array.from({ length: 10 }, () => makeSet({ isWarmup: false })),
  });

  const res = computeMuscleActivity([directOne, stabTen], { start: DAY_START, end: DAY_END }, 'daily');
  const abs = res.muscles.rectus_abdominis;
  assert.ok(abs);
  assert.equal(abs.primarySets, 1);
  assert.equal(abs.stabilizerSets, 10);
  assert.equal(abs.sets, 11);
  assert.equal(abs.rawWeightedSets, 2.5);

  const directOnlyRes = computeMuscleActivity([directOne], { start: DAY_START, end: DAY_END }, 'daily');
  const directOnlyAbs = directOnlyRes.muscles.rectus_abdominis;
  assert.ok(directOnlyAbs);
  assert.ok(abs.effectiveLoad > directOnlyAbs.effectiveLoad);
  assert.ok(
    abs.effectiveLoad < 1.0 + DEFAULT_SCORING_CONFIG.caps.stabilizerMaxEffective.daily + 1e-9,
    'Stabilizer contribution must stay bounded when combined with 1 direct set',
  );
});

test('Dose-response progression 1 -> 2 -> 3 daily direct sets reaches High at 3 sets', () => {
  const evalSets = (count) => {
    const workout = makeWorkout({
      id: `wo_prog_${count}`,
      primaryMuscles: ['pectoralis_lower'],
      secondaryMuscles: ['deltoid_anterior', 'triceps_brachii'],
      stabilizerMuscles: ['serratus_anterior'],
      sets: Array.from({ length: count }, () => makeSet({ weight: 80, reps: 8, isWarmup: false })),
    });
    return computeMuscleActivity([workout], { start: DAY_START, end: DAY_END }, 'daily').muscles.pectoralis_lower;
  };

  const s1 = evalSets(1);
  const s2 = evalSets(2);
  const s3 = evalSets(3);
  assert.ok(s1 && s2 && s3);
  assert.ok(s1.heatmapIntensity < s2.heatmapIntensity);
  assert.ok(s2.heatmapIntensity < s3.heatmapIntensity);
  assert.ok(s1.stimulusSaturationPct < s2.stimulusSaturationPct);
  assert.ok(s2.stimulusSaturationPct < s3.stimulusSaturationPct);
  assert.equal(s3.level, 'high');
});

test('Warm-up anchor & chronology: explicit isWarmup false anchors peak and is never overridden; true always warm-up', () => {
  const t = (m) => new Date(DAY_START.getTime() + m * 60 * 1000);

  // Missing isWarmup + verified monotonic timestamps -> light early sets before heavy peak detected as warm-ups
  const historicalAscending = [
    makeSet({ id: 'h1', weight: 20, reps: 10, createdAt: t(1), updatedAt: t(1) }),
    makeSet({ id: 'h2', weight: 40, reps: 8, createdAt: t(2), updatedAt: t(2) }),
    makeSet({ id: 'h3', weight: 80, reps: 8, createdAt: t(3), updatedAt: t(3) }),
    makeSet({ id: 'h4', weight: 80, reps: 8, createdAt: t(4), updatedAt: t(4) }),
  ];
  const partHist = partitionWorkoutSets(historicalAscending);
  assert.equal(partHist.chronologyVerified, true);
  assert.equal(partHist.firstWorkingPeakIndex, 2);
  assert.deepEqual(
    partHist.warmupSets.map((s) => s.id),
    ['h1', 'h2'],
  );
  assert.deepEqual(
    partHist.workingSets.map((s) => s.id),
    ['h3', 'h4'],
  );

  // Explicit isWarmup: false on light set a1 MUST anchor index 0 and never be overridden!
  const explicitAnchor = [
    makeSet({ id: 'a1', weight: 20, reps: 10, isWarmup: false, createdAt: t(1), updatedAt: t(1) }),
    makeSet({ id: 'a2', weight: 40, reps: 8, createdAt: t(2), updatedAt: t(2) }),
    makeSet({ id: 'a3', weight: 80, reps: 8, createdAt: t(3), updatedAt: t(3) }),
  ];
  const partAnchor = partitionWorkoutSets(explicitAnchor);
  assert.equal(partAnchor.firstWorkingPeakIndex, 0);
  assert.equal(partAnchor.warmupSets.length, 0);
  assert.deepEqual(
    partAnchor.workingSets.map((s) => s.id),
    ['a1', 'a2', 'a3'],
  );

  // Explicit isWarmup: true always excluded even when heavier or after working anchor
  const explicitWarmupHeavy = [
    makeSet({ id: 'w1', weight: 20, reps: 10, isWarmup: true, createdAt: t(1), updatedAt: t(1) }),
    makeSet({ id: 'w2', weight: 60, reps: 8, isWarmup: false, createdAt: t(2), updatedAt: t(2) }),
    makeSet({ id: 'w3', weight: 80, reps: 1, isWarmup: true, createdAt: t(3), updatedAt: t(3) }),
  ];
  const partExplicit = partitionWorkoutSets(explicitWarmupHeavy);
  assert.equal(partExplicit.firstWorkingPeakIndex, 1);
  assert.deepEqual(
    partExplicit.warmupSets.map((s) => s.id),
    ['w1', 'w3'],
  );
  assert.deepEqual(
    partExplicit.workingSets.map((s) => s.id),
    ['w2'],
  );

  // Out-of-order array with valid unique timestamps: chronology sorts by createdAt so back-off set at t(10) stays working!
  const reorderedByTimestamp = [
    makeSet({ id: 'u1', weight: 20, reps: 10, createdAt: t(10), updatedAt: t(10) }),
    makeSet({ id: 'u2', weight: 80, reps: 8, createdAt: t(5), updatedAt: t(5) }),
    makeSet({ id: 'u3', weight: 20, reps: 10, isWarmup: true, createdAt: t(2), updatedAt: t(2) }),
  ];
  const partReordered = partitionWorkoutSets(reorderedByTimestamp);
  assert.equal(partReordered.chronologyVerified, true);
  assert.deepEqual(
    partReordered.warmupSets.map((s) => s.id),
    ['u3'],
  );
  assert.deepEqual(
    partReordered.workingSets.map((s) => s.id),
    ['u2', 'u1'],
  );

  // Tied (equal) timestamps across sets -> ambiguous ordering, untagged conservatively kept working
  const tiedTimestamps = [
    makeSet({ id: 't1', weight: 20, reps: 10, createdAt: t(5), updatedAt: t(5) }),
    makeSet({ id: 't2', weight: 80, reps: 8, createdAt: t(5), updatedAt: t(5) }),
    makeSet({ id: 't3', weight: 20, reps: 10, isWarmup: true, createdAt: t(5), updatedAt: t(5) }),
  ];
  const partTied = partitionWorkoutSets(tiedTimestamps);
  assert.equal(partTied.chronologyVerified, false);
  assert.deepEqual(
    partTied.warmupSets.map((s) => s.id),
    ['t3'],
  );
  assert.deepEqual(
    partTied.workingSets.map((s) => s.id),
    ['t1', 't2'],
  );

  // Missing/invalid timestamp -> ambiguous ordering, untagged conservatively kept working
  const missingTimestamps = [
    makeSet({ id: 'm1', weight: 20, reps: 10, createdAt: 'not-a-date' }),
    makeSet({ id: 'm2', weight: 80, reps: 8, createdAt: t(6) }),
  ];
  const partMissing = partitionWorkoutSets(missingTimestamps);
  assert.equal(partMissing.chronologyVerified, false);
  assert.equal(partMissing.warmupSets.length, 0);
  assert.deepEqual(
    partMissing.workingSets.map((s) => s.id),
    ['m1', 'm2'],
  );

  // Does not mutate frozen inputs
  const frozenSets = Object.freeze(historicalAscending.map((s) => Object.freeze({ ...s })));
  const frozenResult = partitionWorkoutSets(frozenSets);
  assert.equal(frozenResult.workingSets.length, 2);
});

test('RIR effortCalculator defaults to 1.0 neutral and supports bounded configurable scaling', () => {
  assert.equal(computeRirEffortFactor(undefined), 1.0);
  assert.equal(computeRirEffortFactor(null), 1.0);
  assert.equal(computeRirEffortFactor(Number.NaN), 1.0);
  assert.equal(computeRirEffortFactor(3), 1.0);

  const enabledConfig = {
    ...DEFAULT_SCORING_CONFIG.effort,
    enabled: true,
  };
  assert.equal(computeRirEffortFactor(undefined, enabledConfig), 1.0);
  assert.equal(computeRirEffortFactor(Number.NaN, enabledConfig), 1.0);
  const at0 = computeRirEffortFactor(0, enabledConfig);
  const at4 = computeRirEffortFactor(4, enabledConfig);
  const at8 = computeRirEffortFactor(8, enabledConfig);
  const belowMin = computeRirEffortFactor(-5, enabledConfig);
  const aboveMax = computeRirEffortFactor(99, enabledConfig);

  assert.equal(at0, 1.0);
  assert.ok(at0 > at4 && at4 > at8);
  assert.equal(belowMin, at0);
  assert.ok(aboveMax >= enabledConfig.minMultiplier);
  assert.ok(aboveMax <= enabledConfig.maxMultiplier);
  assert.equal(computeRirEffortFactor(Number.POSITIVE_INFINITY, enabledConfig), 1.0);

  // Integration check through computeMuscleActivity when effort scoring is enabled
  const customRirScoring = {
    ...DEFAULT_SCORING_CONFIG,
    effort: enabledConfig,
  };
  const hardWorkout = makeWorkout({
    id: 'wo_rir_hard',
    primaryMuscles: ['pectoralis_lower'],
    sets: [makeSet({ rir: 0, isWarmup: false }), makeSet({ rir: 0, isWarmup: false })],
  });
  const easyWorkout = makeWorkout({
    id: 'wo_rir_easy',
    primaryMuscles: ['pectoralis_lower'],
    sets: [makeSet({ rir: 6, isWarmup: false }), makeSet({ rir: 6, isWarmup: false })],
  });
  const hardLoad = computeMuscleActivity([hardWorkout], { start: DAY_START, end: DAY_END }, 'daily', undefined, customRirScoring).muscles.pectoralis_lower?.effectiveLoad ?? 0;
  const easyLoad = computeMuscleActivity([easyWorkout], { start: DAY_START, end: DAY_END }, 'daily', undefined, customRirScoring).muscles.pectoralis_lower?.effectiveLoad ?? 0;
  assert.ok(hardLoad > easyLoad, `Expected RIR=0 load (${hardLoad}) > RIR=6 load (${easyLoad})`);
});

test('Weekly volume zone boundaries (exact 10 -> optimal_mav, > 20 -> very_high_volume) and per-muscle overrides', () => {
  assert.equal(classifyVolumeZone(0, 0, 'weekly', 'pectoralis_lower'), 'rest');
  assert.equal(classifyVolumeZone(0, 2, 'weekly', 'pectoralis_lower'), 'warmup_only');
  assert.equal(classifyVolumeZone(9.99, 0, 'weekly', 'pectoralis_lower'), 'mev_building');
  assert.equal(classifyVolumeZone(10, 0, 'weekly', 'pectoralis_lower'), 'optimal_mav');
  assert.equal(classifyVolumeZone(20, 0, 'weekly', 'pectoralis_lower'), 'optimal_mav');
  const over20 = classifyVolumeZone(20.1, 0, 'weekly', 'pectoralis_lower');
  assert.equal(over20, 'very_high_volume');
  assert.notEqual(over20, 'high_mrv');

  const customConfig = {
    ...DEFAULT_SCORING_CONFIG,
    muscleThresholds: {
      pectoralis_lower: {
        weeklyZones: { maintenanceMax: 4, mevMax: 8, mavMax: 16 },
      },
    },
  };
  assert.equal(classifyVolumeZone(8.5, 0, 'weekly', 'pectoralis_lower', customConfig), 'optimal_mav');
  assert.equal(classifyVolumeZone(8.5, 0, 'weekly', 'biceps_brachii', customConfig), 'mev_building');
  assert.equal(classifyVolumeZone(16.5, 0, 'weekly', 'pectoralis_lower', customConfig), 'very_high_volume');
});

test('Legacy missing stabilizerMuscles, duplicate muscle IDs, and GROUP_MUSCLE_FALLBACK disjointness', () => {
  const legacyWorkout = makeWorkout({
    id: 'wo_legacy_no_stab',
    primaryMuscles: ['pectoralis_lower', 'pectoralis_lower'],
    secondaryMuscles: ['pectoralis_lower', 'triceps_brachii', 'triceps_brachii'],
    stabilizerMuscles: undefined,
    sets: [makeSet({ isWarmup: false })],
  });
  const targets = exerciseUtils.resolveExerciseMuscles(
    'Unlisted Legacy Exercise',
    'Chest',
    {
      primaryMuscles: ['pectoralis_lower', 'pectoralis_lower'],
      secondaryMuscles: ['pectoralis_lower', 'triceps_brachii', 'triceps_brachii'],
    },
  );
  assert.ok(targets);
  assert.deepEqual(targets.primary, ['pectoralis_lower']);
  assert.deepEqual(targets.secondary, ['triceps_brachii']);
  assert.deepEqual(targets.stabilizers, []);

  const act = computeMuscleActivity([legacyWorkout], { start: DAY_START, end: DAY_END }, 'daily');
  assert.equal(act.muscles.pectoralis_lower?.primarySets, 1);
  assert.equal(act.muscles.pectoralis_lower?.secondarySets, 0);
  assert.equal(act.muscles.triceps_brachii?.secondarySets, 1);

  for (const [group, entry] of Object.entries(musclesConst.GROUP_MUSCLE_FALLBACK)) {
    const p = new Set(entry.primary);
    const s = new Set(entry.secondary);
    const st = new Set(entry.stabilizers);
    assert.equal(p.size, entry.primary.length, `Duplicate primary in FE fallback ${group}`);
    assert.equal(s.size, entry.secondary.length, `Duplicate secondary in FE fallback ${group}`);
    assert.equal(st.size, entry.stabilizers.length, `Duplicate stabilizer in FE fallback ${group}`);
    for (const id of s) assert.ok(!p.has(id), `FE ${group} secondary overlaps primary: ${id}`);
    for (const id of st) {
      assert.ok(!p.has(id), `FE ${group} stabilizer overlaps primary: ${id}`);
      assert.ok(!s.has(id), `FE ${group} stabilizer overlaps secondary: ${id}`);
    }
  }

  for (const [group, entry] of Object.entries(backendMuscles.GROUP_MUSCLE_FALLBACK)) {
    const p = new Set(entry.primary);
    const s = new Set(entry.secondary);
    const st = new Set(entry.stabilizerMuscles);
    assert.equal(p.size, entry.primary.length, `Duplicate primary in BE fallback ${group}`);
    assert.equal(s.size, entry.secondary.length, `Duplicate secondary in BE fallback ${group}`);
    assert.equal(st.size, entry.stabilizerMuscles.length, `Duplicate stabilizer in BE fallback ${group}`);
    for (const id of s) assert.ok(!p.has(id), `BE ${group} secondary overlaps primary: ${id}`);
    for (const id of st) {
      assert.ok(!p.has(id), `BE ${group} stabilizer overlaps primary: ${id}`);
      assert.ok(!s.has(id), `BE ${group} stabilizer overlaps secondary: ${id}`);
    }
    const feEntry = musclesConst.GROUP_MUSCLE_FALLBACK[group];
    assert.ok(feEntry, `Missing FE fallback group ${group}`);
    assert.deepEqual(entry.primary, feEntry.primary, `FE/BE primary mismatch for ${group}`);
    assert.deepEqual(entry.secondary, feEntry.secondary, `FE/BE secondary mismatch for ${group}`);
    assert.deepEqual(entry.stabilizerMuscles, feEntry.stabilizers, `FE/BE stabilizer mismatch for ${group}`);
  }
  assert.deepEqual(
    Object.keys(backendMuscles.GROUP_MUSCLE_FALLBACK).sort(),
    Object.keys(musclesConst.GROUP_MUSCLE_FALLBACK).sort(),
  );
  assert.equal(
    exerciseUtils.normalizeExerciseName("Farmer's Walk"),
    backendMuscles.normalizeExerciseName("Farmer's Walk"),
  );
  assert.equal(exerciseUtils.normalizeExerciseName("Farmer's Walk"), 'farmers walk');

  // Null isWarmup behaves identically to untagged undefined
  const t0 = new Date('2026-11-10T09:00:00.000Z');
  const t1 = new Date('2026-11-10T09:01:00.000Z');
  const nullWarmupSets = [
    makeSet({ id: 'nw1', weight: 20, reps: 10, isWarmup: null, createdAt: t0, updatedAt: t0 }),
    makeSet({ id: 'nw2', weight: 80, reps: 8, isWarmup: null, createdAt: t1, updatedAt: t1 }),
  ];
  const partNull = partitionWorkoutSets(nullWarmupSets);
  assert.equal(partNull.warmupSets.length, 1);
  assert.equal(partNull.workingSets.length, 1);
});

test('Old vs updated backend DTO parsing compatibility (api.ts + backend/constants/muscles.js)', () => {
  const oldWorkoutDto = {
    id: 'old_wo_1',
    name: 'Barbell Bench Press',
    category: 'Chest',
    equipmentType: 'barbell',
    primaryMuscles: ['pectoralis_lower', 'pectoralis_lower'],
    secondaryMuscles: ['pectoralis_lower', 'deltoid_anterior', 'triceps_brachii'],
    startTime: '2026-11-10T09:00:00.000Z',
    endTime: '2026-11-10T09:20:00.000Z',
    totalVolume: 800,
    totalSets: 2,
    workoutData: {
      id: 'old_active_1',
      name: 'Barbell Bench Press',
      startTime: '2026-11-10T09:00:00.000Z',
      endTime: '2026-11-10T09:20:00.000Z',
      sets: [
        {
          id: 's1',
          exerciseId: 'ex1',
          weight: 20,
          reps: 10,
          completed: true,
          createdAt: '2026-11-10T09:01:00.000Z',
          updatedAt: '2026-11-10T09:01:00.000Z',
        },
        {
          id: 's2',
          exerciseId: 'ex1',
          weight: 80,
          reps: 8,
          completed: true,
          createdAt: '2026-11-10T09:03:00.000Z',
          updatedAt: '2026-11-10T09:03:00.000Z',
        },
      ],
      createdAt: '2026-11-10T09:00:00.000Z',
      updatedAt: '2026-11-10T09:20:00.000Z',
    },
    createdAt: '2026-11-10T09:00:00.000Z',
    updatedAt: '2026-11-10T09:20:00.000Z',
  };

  const parsedOld = apiModule.parseCompletedWorkout(oldWorkoutDto);
  assert.deepEqual(parsedOld.primaryMuscles, ['pectoralis_lower']);
  assert.deepEqual(parsedOld.secondaryMuscles, ['deltoid_anterior', 'triceps_brachii']);
  assert.equal(parsedOld.workoutData.sets[0].isWarmup, undefined);
  assert.equal(parsedOld.workoutData.sets[0].rir, undefined);

  const activity = computeMuscleActivity([parsedOld], { start: DAY_START, end: DAY_END }, 'daily');
  assert.ok(activity.muscles.pectoralis_lower);
  assert.equal(activity.muscles.pectoralis_lower.warmupSets, 1);
  assert.equal(activity.muscles.pectoralis_lower.primarySets, 1);

  const legacyCustom = apiModule.parseCustomExercise('Barbell rowing');
  assert.equal(legacyCustom.name, 'Barbell rowing');
  assert.equal(legacyCustom.equipmentType, 'barbell');

  const legacyExercise = apiModule.parseExerciseMetadata({
    name: 'Legacy Press',
    muscleGroup: 'Chest',
    equipmentType: 'barbell',
    primaryMuscles: ['pectoralis_lower'],
    secondaryMuscles: ['triceps_brachii'],
  });
  assert.ok(legacyExercise);
  assert.deepEqual(legacyExercise.primaryMuscles, ['pectoralis_lower']);
  assert.deepEqual(legacyExercise.secondaryMuscles, ['triceps_brachii']);

  const beOldTargets = backendMuscles.resolveTargetsForExercise({
    name: 'Unknown Old Exercise',
    category: 'Chest',
    primaryMuscles: ['pectoralis_lower', 'pectoralis_lower'],
    secondaryMuscles: ['pectoralis_lower', 'triceps_brachii'],
  });
  assert.deepEqual(beOldTargets.primaryMuscles, ['pectoralis_lower']);
  assert.deepEqual(beOldTargets.secondaryMuscles, ['triceps_brachii']);
  assert.deepEqual(beOldTargets.stabilizerMuscles, []);

  const beNewTargets = backendMuscles.resolveTargetsForExercise({
    name: 'Barbell Bench Press',
    category: 'Chest',
    primaryMuscles: ['pectoralis_lower'],
    secondaryMuscles: ['deltoid_anterior', 'triceps_brachii'],
    stabilizerMuscles: ['pectoralis_lower', 'serratus_anterior', 'rectus_abdominis', 'serratus_anterior'],
  });
  assert.deepEqual(beNewTargets.stabilizerMuscles, ['serratus_anterior', 'rectus_abdominis']);

  const beCatalogLookup = backendMuscles.resolveTargetsForExercise({ name: 'Deadlift' });
  assert.ok(beCatalogLookup.stabilizerMuscles.length > 0);
  const beBenchLookup = backendMuscles.resolveTargetsForExercise({ name: 'Barbell Bench Press' });
  assert.deepEqual(beBenchLookup.primaryMuscles, ['pectoralis_lower']);
  assert.ok(Array.isArray(beBenchLookup.stabilizerMuscles));

  // Updated v2 backend DTO parsing in api.ts preserves stabilizerMuscles, isWarmup, and clamped rir
  const v2WorkoutDto = {
    ...oldWorkoutDto,
    id: 'v2_wo_1',
    stabilizerMuscles: ['pectoralis_lower', 'serratus_anterior', 'rectus_abdominis', 'serratus_anterior'],
    workoutData: {
      ...oldWorkoutDto.workoutData,
      primaryMuscles: ['pectoralis_lower'],
      secondaryMuscles: ['deltoid_anterior'],
      stabilizerMuscles: ['pectoralis_lower', 'serratus_anterior'],
      sets: [
        {
          id: 'v2_s1',
          exerciseId: 'ex1',
          weight: 20,
          reps: 10,
          completed: true,
          isWarmup: true,
          rir: 4,
          createdAt: '2026-11-10T09:01:00.000Z',
          updatedAt: '2026-11-10T09:01:00.000Z',
        },
        {
          id: 'v2_s2',
          exerciseId: 'ex1',
          weight: 80,
          reps: 8,
          completed: true,
          isWarmup: false,
          rir: 18,
          createdAt: '2026-11-10T09:03:00.000Z',
          updatedAt: '2026-11-10T09:03:00.000Z',
        },
        {
          id: 'v2_s3',
          exerciseId: 'ex1',
          weight: 80,
          reps: 8,
          completed: true,
          isWarmup: 'invalid-bool',
          rir: Number.NaN,
          createdAt: '2026-11-10T09:05:00.000Z',
          updatedAt: '2026-11-10T09:05:00.000Z',
        },
      ],
    },
  };
  const parsedV2 = apiModule.parseCompletedWorkout(v2WorkoutDto);
  assert.deepEqual(parsedV2.stabilizerMuscles, ['serratus_anterior', 'rectus_abdominis']);
  assert.deepEqual(parsedV2.workoutData.stabilizerMuscles, ['serratus_anterior']);
  assert.equal(parsedV2.workoutData.sets[0].isWarmup, true);
  assert.equal(parsedV2.workoutData.sets[0].rir, 4);
  assert.equal(parsedV2.workoutData.sets[1].isWarmup, false);
  assert.equal(parsedV2.workoutData.sets[1].rir, 10);
  assert.equal(parsedV2.workoutData.sets[2].isWarmup, undefined);
  assert.equal(parsedV2.workoutData.sets[2].rir, undefined);

  const v2Custom = apiModule.parseCustomExercise({
    name: 'Custom Seal Row',
    equipmentType: 'barbell',
    primaryMuscles: ['latissimus_dorsi'],
    secondaryMuscles: ['biceps_brachii'],
    stabilizerMuscles: ['latissimus_dorsi', 'erector_spinae', 'erector_spinae'],
  });
  assert.deepEqual(v2Custom.stabilizerMuscles, ['erector_spinae']);

  const v2Exercise = apiModule.parseExerciseMetadata({
    name: 'Deadlift',
    muscleGroup: 'Back',
    equipmentType: 'barbell',
    primaryMuscles: ['hamstrings', 'gluteus_maximus'],
    secondaryMuscles: ['quadriceps'],
    stabilizerMuscles: ['hamstrings', 'erector_spinae', 'forearm_flexors'],
  });
  assert.ok(v2Exercise);
  assert.deepEqual(v2Exercise.stabilizerMuscles, ['erector_spinae', 'forearm_flexors']);
});

test('interpolateHeatColor produces smooth bounded RGB hex gradients across theme stops', () => {
  assert.equal(interpolateHeatColor(0).toUpperCase(), ANATOMY_HEAT_PALETTE.none);
  assert.equal(interpolateHeatColor(-1).toUpperCase(), ANATOMY_HEAT_PALETTE.none);
  assert.equal(interpolateHeatColor(1).toUpperCase(), ANATOMY_HEAT_PALETTE.high);
  assert.equal(interpolateHeatColor(2).toUpperCase(), ANATOMY_HEAT_PALETTE.high);
  const mid = interpolateHeatColor(0.5);
  assert.match(mid, /^#[0-9A-Fa-f]{6}$/);
  assert.notEqual(mid.toUpperCase(), ANATOMY_HEAT_PALETTE.none);
  assert.notEqual(mid.toUpperCase(), ANATOMY_HEAT_PALETTE.high);
});

test('BodyMaterialManager reuses cached materials, preserves glTF originals, and restores before dispose', () => {
  const manager = new bodyMaterials.BodyMaterialManager();
  assert.equal(bodyMaterials.quantizeHeatIntensity(Number.NaN), 0);
  assert.equal(bodyMaterials.quantizeHeatIntensity(-0.5), 0);
  assert.equal(bodyMaterials.quantizeHeatIntensity(1.5), 1);
  assert.equal(bodyMaterials.quantizeHeatIntensity(0.52), 0.5);

  const origMat1 = new THREE.MeshStandardMaterial({ color: '#111111' });
  const origMat2 = new THREE.MeshStandardMaterial({ color: '#222222' });
  let origDisposals = 0;
  origMat1.dispose = () => {
    origDisposals += 1;
  };
  origMat2.dispose = () => {
    origDisposals += 1;
  };

  const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), origMat1);
  const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), origMat2);
  const entries = [{ mesh: mesh1 }, { mesh: mesh2 }];

  manager.recordOriginalMaterials(entries);
  const matA = manager.getHeatMaterial(0.51);
  const matB = manager.getHeatMaterial(0.52);
  const matBone = manager.getStaticMaterial('bone');
  assert.equal(matA, matB, 'Quantized intensity cache must return identical material instance');
  assert.equal(manager.ownedCache.size, 2);

  mesh1.material = matA;
  mesh2.material = matBone;
  // Calling recordOriginalMaterials again must NOT overwrite the captured glTF originals
  manager.recordOriginalMaterials(entries);

  let ownedDisposals = 0;
  for (const ownedMat of manager.ownedCache.values()) {
    const origDispose = ownedMat.dispose.bind(ownedMat);
    ownedMat.dispose = () => {
      assert.equal(mesh1.material, origMat1, 'mesh1 must be restored before owned material disposal');
      assert.equal(mesh2.material, origMat2, 'mesh2 must be restored before owned material disposal');
      ownedDisposals += 1;
      origDispose();
    };
  }

  manager.restoreAndDispose(entries);
  assert.equal(origDisposals, 0, 'Original glTF materials must never be disposed');
  assert.equal(ownedDisposals, 2, 'Both owned materials must be disposed once after mesh restore');
  assert.equal(manager.ownedCache.size, 0);
  assert.equal(manager.originalMaterials.size, 0);
  mesh1.geometry.dispose();
  mesh2.geometry.dispose();
});
