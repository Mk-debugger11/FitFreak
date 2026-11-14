import test, { after } from 'node:test';
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

const tmpCompileDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'fitfreak-energy-formulas-test-'),
);
const tmpNodeModulesLink = path.join(tmpCompileDir, 'node_modules');

after(() => {
  try {
    if (fs.existsSync(tmpNodeModulesLink)) {
      fs.unlinkSync(tmpNodeModulesLink);
    }
  } catch {
    // ignore cleanup error
  }
  fs.rmSync(tmpCompileDir, { recursive: true, force: true });
});

function compileWorkspaceModules() {
  const rootFiles = [
    path.join(ROOT_DIR, 'src/types.ts'),
    path.join(ROOT_DIR, 'src/constants/nutrition.ts'),
    path.join(ROOT_DIR, 'src/utils/date.ts'),
    path.join(ROOT_DIR, 'src/features/nutrition/energyFormulas.ts'),
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

const energyFormulas = loadTsModule('src/features/nutrition/energyFormulas');
const nutritionConstants = loadTsModule('src/constants/nutrition');

const {
  PROFILE_LIMITS,
  mifflinStJeorBmr,
  katchMcArdleBmr,
  computeBmr,
  computeMaintenanceCalories,
  computeCalorieTarget,
  computeMacroTargets,
} = energyFormulas;

const { ACTIVITY_MULTIPLIERS, GOAL_ADJUSTMENTS } = nutritionConstants;

/** Helper to create a birthDate corresponding to exact years ago. */
function dateYearsAgo(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  // Ensure same day/month so age calculation is exact
  return d;
}

test('1. mifflinStJeorBmr against hand-worked values for male and female', () => {
  // Male: 10 * 80 + 6.25 * 180 - 5 * 25 + 5 = 800 + 1125 - 125 + 5 = 1805
  const maleBmr = mifflinStJeorBmr({
    sex: 'male',
    weightKg: 80,
    heightCm: 180,
    ageYears: 25,
  });
  assert.equal(maleBmr, 1805);

  // Female: 10 * 60 + 6.25 * 164 - 5 * 30 - 161 = 600 + 1025 - 150 - 161 = 1314
  const femaleBmr = mifflinStJeorBmr({
    sex: 'female',
    weightKg: 60,
    heightCm: 164,
    ageYears: 30,
  });
  assert.equal(femaleBmr, 1314);

  // Female with fractional height: 10 * 60 + 6.25 * 165 - 5 * 30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
  const femaleBmrFractional = mifflinStJeorBmr({
    sex: 'female',
    weightKg: 60,
    heightCm: 165,
    ageYears: 30,
  });
  assert.equal(femaleBmrFractional, 1320.25);
});

test('2. katchMcArdleBmr against hand-worked values', () => {
  // weightKg = 80, bodyFatPercent = 15
  // leanMass = 80 * (1 - 0.15) = 68 kg
  // bmr = 370 + 21.6 * 68 = 370 + 1468.8 = 1838.8
  const bmr1 = katchMcArdleBmr({ weightKg: 80, bodyFatPercent: 15 });
  assert.ok(Math.abs(bmr1 - 1838.8) < 1e-4);

  // weightKg = 70, bodyFatPercent = 20
  // leanMass = 70 * 0.8 = 56 kg
  // bmr = 370 + 21.6 * 56 = 370 + 1209.6 = 1579.6
  const bmr2 = katchMcArdleBmr({ weightKg: 70, bodyFatPercent: 20 });
  assert.ok(Math.abs(bmr2 - 1579.6) < 1e-4);
});

test('3. computeBmr selects Mifflin-St Jeor and rounds kcal', () => {
  const profile = {
    sex: 'male',
    weightKg: 80,
    heightCm: 180,
    birthDate: dateYearsAgo(25),
    activityLevel: 'moderate',
    goal: 'maintain',
  };

  const result = computeBmr(profile);
  assert.notEqual(result, null);
  assert.equal(result.formula, 'mifflin_st_jeor');
  assert.equal(result.kcal, 1805);

  const femaleProfile = {
    sex: 'female',
    weightKg: 60,
    heightCm: 165,
    birthDate: dateYearsAgo(30),
    activityLevel: 'light',
    goal: 'cut',
  };

  const femaleResult = computeBmr(femaleProfile);
  assert.notEqual(femaleResult, null);
  assert.equal(femaleResult.formula, 'mifflin_st_jeor');
  // 1320.25 rounded to 1320
  assert.equal(femaleResult.kcal, 1320);
});

test('4. computeBmr uses Katch-McArdle when bodyFatPercent is valid, falls back when out of range', () => {
  const profile = {
    sex: 'male',
    weightKg: 80,
    heightCm: 180,
    birthDate: dateYearsAgo(25),
    bodyFatPercent: 15,
    activityLevel: 'active',
    goal: 'maintain',
  };

  // 15% is valid (between 3 and 60) -> Katch-McArdle: 1838.8 rounded to 1839
  const resValid = computeBmr(profile);
  assert.notEqual(resValid, null);
  assert.equal(resValid.formula, 'katch_mcardle');
  assert.equal(resValid.kcal, 1839);

  // 0% is out of range (< 3) -> falls back to Mifflin-St Jeor
  const resZero = computeBmr({ ...profile, bodyFatPercent: 0 });
  assert.notEqual(resZero, null);
  assert.equal(resZero.formula, 'mifflin_st_jeor');
  assert.equal(resZero.kcal, 1805);

  // 80% is out of range (> 60) -> falls back to Mifflin-St Jeor
  const resHigh = computeBmr({ ...profile, bodyFatPercent: 80 });
  assert.notEqual(resHigh, null);
  assert.equal(resHigh.formula, 'mifflin_st_jeor');
  assert.equal(resHigh.kcal, 1805);

  // Exact boundary 3% -> Katch-McArdle
  const resMin = computeBmr({ ...profile, bodyFatPercent: 3 });
  assert.equal(resMin.formula, 'katch_mcardle');

  // Exact boundary 60% -> Katch-McArdle
  const resMax = computeBmr({ ...profile, bodyFatPercent: 60 });
  assert.equal(resMax.formula, 'katch_mcardle');
});

test('5. computeBmr returns null for missing or out-of-range profile fields', () => {
  assert.equal(computeBmr(null), null);
  assert.equal(computeBmr(undefined), null);

  const base = {
    sex: 'male',
    weightKg: 80,
    heightCm: 180,
    birthDate: dateYearsAgo(25),
  };

  // Missing sex or invalid sex
  assert.equal(computeBmr({ ...base, sex: undefined }), null);
  assert.equal(computeBmr({ ...base, sex: 'other' }), null);

  // Weight bounds (25 - 300)
  assert.equal(computeBmr({ ...base, weightKg: 24.9 }), null);
  assert.notEqual(computeBmr({ ...base, weightKg: 25 }), null);
  assert.notEqual(computeBmr({ ...base, weightKg: 300 }), null);
  assert.equal(computeBmr({ ...base, weightKg: 300.1 }), null);
  assert.equal(computeBmr({ ...base, weightKg: undefined }), null);

  // Height bounds (100 - 250)
  assert.equal(computeBmr({ ...base, heightCm: 99.9 }), null);
  assert.notEqual(computeBmr({ ...base, heightCm: 100 }), null);
  assert.notEqual(computeBmr({ ...base, heightCm: 250 }), null);
  assert.equal(computeBmr({ ...base, heightCm: 250.1 }), null);
  assert.equal(computeBmr({ ...base, heightCm: undefined }), null);

  // Age bounds (13 - 100)
  assert.equal(computeBmr({ ...base, birthDate: dateYearsAgo(12) }), null);
  assert.notEqual(computeBmr({ ...base, birthDate: dateYearsAgo(13) }), null);
  assert.notEqual(computeBmr({ ...base, birthDate: dateYearsAgo(100) }), null);
  assert.equal(computeBmr({ ...base, birthDate: dateYearsAgo(101) }), null);
  assert.equal(computeBmr({ ...base, birthDate: undefined }), null);
  assert.equal(computeBmr({ ...base, birthDate: new Date('invalid') }), null);
});

test('6. computeMaintenanceCalories applies all activity multipliers', () => {
  const profile = {
    sex: 'male',
    weightKg: 80,
    heightCm: 180,
    birthDate: dateYearsAgo(25),
    goal: 'maintain',
  };
  // BMR = 1805

  const cases = [
    { level: 'sedentary', mult: 1.2, expectedKcal: Math.round(1805 * 1.2) }, // 2166
    { level: 'light', mult: 1.375, expectedKcal: Math.round(1805 * 1.375) }, // 2482
    { level: 'moderate', mult: 1.55, expectedKcal: Math.round(1805 * 1.55) }, // 2798
    { level: 'active', mult: 1.725, expectedKcal: Math.round(1805 * 1.725) }, // 3114
    { level: 'very_active', mult: 1.9, expectedKcal: Math.round(1805 * 1.9) }, // 3430
  ];

  for (const { level, mult, expectedKcal } of cases) {
    const res = computeMaintenanceCalories({ ...profile, activityLevel: level });
    assert.notEqual(res, null);
    assert.equal(res.bmr, 1805);
    assert.equal(res.multiplier, mult);
    assert.equal(res.kcal, expectedKcal);
    assert.equal(res.formula, 'mifflin_st_jeor');
    assert.equal(res.isOverride, false);
  }
});

test('7. computeMaintenanceCalories respects maintenanceOverride and short-circuits', () => {
  const fullProfile = {
    sex: 'male',
    weightKg: 80,
    heightCm: 180,
    birthDate: dateYearsAgo(25),
    activityLevel: 'moderate',
    goal: 'maintain',
    maintenanceOverride: 2400,
  };

  const res = computeMaintenanceCalories(fullProfile);
  assert.notEqual(res, null);
  assert.equal(res.kcal, 2400);
  assert.equal(res.isOverride, true);
  assert.equal(res.formula, 'override');
  assert.equal(res.bmr, 1805);

  // Short-circuit on incomplete profile with only maintenanceOverride
  const incompleteWithOverride = {
    maintenanceOverride: 2250,
  };
  const resIncomplete = computeMaintenanceCalories(incompleteWithOverride);
  assert.notEqual(resIncomplete, null);
  assert.equal(resIncomplete.kcal, 2250);
  assert.equal(resIncomplete.isOverride, true);
  assert.equal(resIncomplete.formula, 'override');

  // Negative or zero override does not short-circuit
  const zeroOverride = { maintenanceOverride: 0 };
  assert.equal(computeMaintenanceCalories(zeroOverride), null);
});

test('8. computeCalorieTarget handles cut, maintain, bulk and 1200 floor', () => {
  const profile = {
    sex: 'male',
    weightKg: 80,
    heightCm: 180,
    birthDate: dateYearsAgo(25),
    activityLevel: 'moderate', // maintenance = 2798
  };

  // Maintain: 2798 + 0 = 2798
  assert.equal(computeCalorieTarget({ ...profile, goal: 'maintain' }), 2798);

  // Cut: 2798 - 500 = 2298
  assert.equal(computeCalorieTarget({ ...profile, goal: 'cut' }), 2298);

  // Bulk: 2798 + 300 = 3098
  assert.equal(computeCalorieTarget({ ...profile, goal: 'bulk' }), 3098);

  // Floor at 1200: small maintenance
  const lowCalProfile = {
    maintenanceOverride: 1400,
    goal: 'cut', // 1400 - 500 = 900 -> floored to 1200
  };
  assert.equal(computeCalorieTarget(lowCalProfile), 1200);

  const edge1200Profile = {
    maintenanceOverride: 1600,
    goal: 'cut', // 1600 - 500 = 1100 -> floored to 1200
  };
  assert.equal(computeCalorieTarget(edge1200Profile), 1200);
});

test('9. computeMacroTargets computes protein, fat, carbs and sums to target', () => {
  const profile = {
    sex: 'male',
    weightKg: 80,
    heightCm: 180,
    birthDate: dateYearsAgo(25),
    activityLevel: 'sedentary', // maintenance = 2166
    goal: 'maintain', // target = 2166
  };

  const macros = computeMacroTargets(profile);
  assert.notEqual(macros, null);
  assert.equal(macros.calories, 2166);

  // protein: 80 * 1.8 = 144 g
  assert.equal(macros.protein, 144);
  // fat: Math.round(2166 * 0.25 / 9) = Math.round(60.166) = 60 g
  assert.equal(macros.fat, 60);
  // calProtein = 144 * 4 = 576, calFat = 60 * 9 = 540 -> sum = 1116
  // carbs: Math.round((2166 - 1116) / 4) = Math.round(1050 / 4) = 263 g (1052 kcal)
  assert.equal(macros.carbs, 263);

  // Macro calorie sum check: 144*4 + 263*4 + 60*9 = 576 + 1052 + 540 = 2168 (within 2 kcal of 2166)
  const sumKcal = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
  assert.ok(Math.abs(sumKcal - macros.calories) <= 2);

  // Custom proteinPerKg
  const customProtein = computeMacroTargets({
    ...profile,
    proteinPerKg: 2.2,
  });
  // protein: 80 * 2.2 = 176 g
  assert.equal(customProtein.protein, 176);
});

test('10. computeMacroTargets guards degenerate low target / heavy user case with no negative carbs', () => {
  // Heavy user (250 kg) with low calorie target (1200 kcal)
  const degenerateProfile = {
    maintenanceOverride: 1200,
    weightKg: 250,
    goal: 'maintain',
  };

  const macros = computeMacroTargets(degenerateProfile);
  assert.notEqual(macros, null);
  assert.equal(macros.calories, 1200);
  assert.equal(macros.carbs, 0); // Floored at 0, never negative
  assert.ok(macros.protein > 0);
  assert.ok(macros.fat > 0);

  // Check proportional scaling:
  // initial protein = 250 * 1.8 = 450 g (1800 kcal)
  // initial fat = round(1200 * 0.25 / 9) = 33 g (297 kcal)
  // total initial kcal = 2097 > 1200
  // proteinTarget = 1200 * (1800 / 2097) = 1030.04 kcal -> / 4 = 257.51 -> round 258 g
  // fatTarget = 1200 * (297 / 2097) = 169.95 kcal -> / 9 = 18.88 -> round 19 g
  assert.equal(macros.protein, 258);
  assert.equal(macros.fat, 19);

  const scaledKcal = macros.protein * 4 + macros.fat * 9;
  // 258 * 4 + 19 * 9 = 1032 + 171 = 1203 kcal (within rounding of 1200)
  assert.ok(Math.abs(scaledKcal - 1200) <= 5);
});
