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
  path.join(os.tmpdir(), 'fitfreak-nutrition-balance-test-'),
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
    path.join(ROOT_DIR, 'src/theme.ts'),
    path.join(ROOT_DIR, 'src/constants/nutrition.ts'),
    path.join(ROOT_DIR, 'src/utils/format.ts'),
    path.join(ROOT_DIR, 'src/features/nutrition/servingMath.ts'),
    path.join(ROOT_DIR, 'src/features/nutrition/energyBalance.ts'),
    path.join(ROOT_DIR, 'src/features/nutrition/nutritionTotals.ts'),
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

const energyBalance = loadTsModule('src/features/nutrition/energyBalance');
const servingMath = loadTsModule('src/features/nutrition/servingMath');
const nutritionTotals = loadTsModule('src/features/nutrition/nutritionTotals');
const themeModule = loadTsModule('src/theme');
const formatModule = loadTsModule('src/utils/format');

const {
  classifyEnergyBalance,
  STATUS_LABELS,
  statusColor,
} = energyBalance;

const {
  caloriesFromMacros,
  scaleMacros,
  addMacros,
  emptyMacros,
  macroCalorieShares,
} = servingMath;

const {
  computeDayNutrition,
  computeRemaining,
} = nutritionTotals;

const { formatCalories, formatGrams } = formatModule;

const { theme } = themeModule;

test('1. classifyEnergyBalance: band boundaries, deficit, maintenance, surplus', () => {
  const maintenance = 2000;
  // tolerance = max(100, 2000 * 0.05) = 100 kcal
  // Band: [1900, 2100]

  // Exact center (0 delta) -> maintenance
  const center = classifyEnergyBalance(2000, maintenance, { hasEntries: true });
  assert.notEqual(center, null);
  assert.equal(center.status, 'maintenance');
  assert.equal(center.deltaKcal, 0);
  assert.equal(center.toleranceKcal, 100);

  // Exact upper band edge: 2100 -> delta = +100 -> maintenance
  const upperEdge = classifyEnergyBalance(2100, maintenance, { hasEntries: true });
  assert.equal(upperEdge.status, 'maintenance');
  assert.equal(upperEdge.deltaKcal, 100);

  // Just over upper band edge: 2101 -> delta = +101 -> surplus
  const justOver = classifyEnergyBalance(2101, maintenance, { hasEntries: true });
  assert.equal(justOver.status, 'surplus');
  assert.equal(justOver.deltaKcal, 101);

  // Exact lower band edge: 1900 -> delta = -100 -> maintenance
  const lowerEdge = classifyEnergyBalance(1900, maintenance, { hasEntries: true });
  assert.equal(lowerEdge.status, 'maintenance');
  assert.equal(lowerEdge.deltaKcal, -100);

  // Just below lower band edge: 1899 -> delta = -101 -> deficit
  const justUnder = classifyEnergyBalance(1899, maintenance, { hasEntries: true });
  assert.equal(justUnder.status, 'deficit');
  assert.equal(justUnder.deltaKcal, -101);

  // Deep deficit and deep surplus
  const deepDeficit = classifyEnergyBalance(1200, maintenance, { hasEntries: true });
  assert.equal(deepDeficit.status, 'deficit');
  assert.equal(deepDeficit.deltaKcal, -800);

  const deepSurplus = classifyEnergyBalance(3000, maintenance, { hasEntries: true });
  assert.equal(deepSurplus.status, 'surplus');
  assert.equal(deepSurplus.deltaKcal, 1000);
});

test('2. classifyEnergyBalance: scaled tolerance for higher maintenance (> 2000 kcal)', () => {
  const maintenance = 3200;
  // tolerance = max(100, 3200 * 0.05) = 160 kcal
  // Band: [3040, 3360]

  const onEdge = classifyEnergyBalance(3360, maintenance, { hasEntries: true });
  assert.equal(onEdge.status, 'maintenance');
  assert.equal(onEdge.toleranceKcal, 160);
  assert.equal(onEdge.deltaKcal, 160);

  const aboveEdge = classifyEnergyBalance(3361, maintenance, { hasEntries: true });
  assert.equal(aboveEdge.status, 'surplus');
  assert.equal(aboveEdge.deltaKcal, 161);
});

test('3. classifyEnergyBalance returns null when no profile or zero entries', () => {
  // maintenanceKcal is null, undefined, 0, or negative
  assert.equal(classifyEnergyBalance(2000, null, { hasEntries: true }), null);
  assert.equal(classifyEnergyBalance(2000, undefined, { hasEntries: true }), null);
  assert.equal(classifyEnergyBalance(2000, 0, { hasEntries: true }), null);
  assert.equal(classifyEnergyBalance(2000, -100, { hasEntries: true }), null);

  // hasEntries is false -> returns null even with valid maintenance
  assert.equal(classifyEnergyBalance(0, 2000, { hasEntries: false }), null);
  assert.equal(classifyEnergyBalance(1500, 2000, { hasEntries: false }), null);
});

test('4. STATUS_LABELS and statusColor match theme.colors.nutrition', () => {
  assert.equal(STATUS_LABELS.deficit, 'Deficit');
  assert.equal(STATUS_LABELS.maintenance, 'Maintenance');
  assert.equal(STATUS_LABELS.surplus, 'Surplus');

  assert.equal(statusColor('deficit'), theme.colors.nutrition.deficit);
  assert.equal(statusColor('maintenance'), theme.colors.nutrition.maintenance);
  assert.equal(statusColor('surplus'), theme.colors.nutrition.surplus);
});

test('5. caloriesFromMacros uses 4/4/9 and rounds', () => {
  // 25*4 + 40*4 + 10*9 = 100 + 160 + 90 = 350
  assert.equal(caloriesFromMacros({ protein: 25, carbs: 40, fat: 10 }), 350);

  // Fractional macros: 25.5*4 (102) + 30.2*4 (120.8) + 12.3*9 (110.7) = 333.5 -> Math.round = 334
  assert.equal(caloriesFromMacros({ protein: 25.5, carbs: 30.2, fat: 12.3 }), 334);

  // Zero macros
  assert.equal(caloriesFromMacros({ protein: 0, carbs: 0, fat: 0 }), 0);
});

test('6. scaleMacros preserves float precision across per_100g, per_100ml, per_piece and named servings', () => {
  // per_100g
  const food100g = {
    basis: 'per_100g',
    macros: { calories: 250, protein: 20, carbs: 30, fat: 5 },
  };
  const scaled100g = scaleMacros(food100g, 150);
  assert.equal(scaled100g.calories, 375);
  assert.equal(scaled100g.protein, 30);
  assert.equal(scaled100g.carbs, 45);
  assert.equal(scaled100g.fat, 7.5);

  // per_100ml
  const food100ml = {
    basis: 'per_100ml',
    macros: { calories: 60, protein: 3.2, carbs: 4.8, fat: 3.5 },
  };
  const scaled100ml = scaleMacros(food100ml, 250);
  assert.equal(scaled100ml.calories, 150);
  assert.equal(scaled100ml.protein, 8);
  assert.equal(scaled100ml.carbs, 12);
  assert.equal(scaled100ml.fat, 8.75);

  // per_piece
  const foodPiece = {
    basis: 'per_piece',
    macros: { calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3 },
  };
  const scaledPiece = scaleMacros(foodPiece, 3);
  assert.equal(scaledPiece.calories, 234);
  assert.ok(Math.abs(scaledPiece.protein - 18.9) < 1e-6);
  assert.ok(Math.abs(scaledPiece.carbs - 1.8) < 1e-6);
  assert.ok(Math.abs(scaledPiece.fat - 15.9) < 1e-6);

  // Named serving (e.g. 1 medium roti = 45g of a per_100g food)
  const roti = {
    basis: 'per_100g',
    macros: { calories: 297, protein: 11, carbs: 58, fat: 3 },
  };
  const scaledRoti = scaleMacros(roti, 45);
  // scale = 45/100 = 0.45
  assert.ok(Math.abs(scaledRoti.calories - 133.65) < 1e-6);
  assert.ok(Math.abs(scaledRoti.protein - 4.95) < 1e-6);
  assert.ok(Math.abs(scaledRoti.carbs - 26.1) < 1e-6);
  assert.ok(Math.abs(scaledRoti.fat - 1.35) < 1e-6);
});

test('7. addMacros, emptyMacros, and macroCalorieShares', () => {
  const empty = emptyMacros();
  assert.deepEqual(empty, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const m1 = { calories: 200, protein: 15, carbs: 20, fat: 5 };
  const m2 = { calories: 300, protein: 25, carbs: 35, fat: 10 };
  const combined = addMacros(m1, m2);
  assert.deepEqual(combined, { calories: 500, protein: 40, carbs: 55, fat: 15 });

  // macroCalorieShares
  // protein 40g (160 kcal), carbs 55g (220 kcal), fat 15g (135 kcal)
  // sum = 160 + 220 + 135 = 515
  const shares = macroCalorieShares(combined);
  assert.ok(Math.abs(shares.protein - 160 / 515) < 1e-6);
  assert.ok(Math.abs(shares.carbs - 220 / 515) < 1e-6);
  assert.ok(Math.abs(shares.fat - 135 / 515) < 1e-6);
  assert.ok(Math.abs(shares.protein + shares.carbs + shares.fat - 1.0) < 1e-6);

  // Zero macros returns 0 shares
  const zeroShares = macroCalorieShares(empty);
  assert.deepEqual(zeroShares, { protein: 0, carbs: 0, fat: 0 });
});

test('8. computeDayNutrition: bucketing 4 meals, ignoring other dates, ordering by loggedAt', () => {
  const targetDate = '2026-11-13';
  const otherDate = '2026-11-12';

  const entries = [
    // Breakfast entry 2 (logged at 09:00)
    {
      id: 'e1',
      dateString: targetDate,
      mealType: 'breakfast',
      foodName: 'Oats',
      basis: 'per_100g',
      quantity: 50,
      macros: { calories: 190, protein: 6.5, carbs: 34, fat: 3 },
      loggedAt: new Date('2026-11-13T09:00:00Z'),
    },
    // Breakfast entry 1 (logged earlier at 08:00)
    {
      id: 'e2',
      dateString: targetDate,
      mealType: 'breakfast',
      foodName: 'Boiled Eggs',
      basis: 'per_piece',
      quantity: 2,
      macros: { calories: 156, protein: 12.6, carbs: 1.2, fat: 10.6 },
      loggedAt: new Date('2026-11-13T08:00:00Z'),
    },
    // Dinner entry (logged at 20:00)
    {
      id: 'e3',
      dateString: targetDate,
      mealType: 'dinner',
      foodName: 'Paneer Curry',
      basis: 'per_100g',
      quantity: 150,
      macros: { calories: 350, protein: 22, carbs: 10, fat: 25 },
      loggedAt: new Date('2026-11-13T20:00:00Z'),
    },
    // Other date entry (should be ignored)
    {
      id: 'e4',
      dateString: otherDate,
      mealType: 'lunch',
      foodName: 'Rice & Dal',
      basis: 'per_100g',
      quantity: 200,
      macros: { calories: 400, protein: 15, carbs: 70, fat: 5 },
      loggedAt: new Date('2026-11-12T13:00:00Z'),
    },
  ];

  const result = computeDayNutrition(entries, targetDate);

  // All 4 meals present
  assert.ok('breakfast' in result.byMeal);
  assert.ok('lunch' in result.byMeal);
  assert.ok('snacks' in result.byMeal);
  assert.ok('dinner' in result.byMeal);

  // Lunch and snacks are empty
  assert.equal(result.byMeal.lunch.entries.length, 0);
  assert.equal(result.byMeal.lunch.totals.calories, 0);
  assert.equal(result.byMeal.snacks.entries.length, 0);
  assert.equal(result.byMeal.snacks.totals.calories, 0);

  // Breakfast has 2 entries, ordered by loggedAt ascending (e2 at 08:00 before e1 at 09:00)
  assert.equal(result.byMeal.breakfast.entries.length, 2);
  assert.equal(result.byMeal.breakfast.entries[0].id, 'e2');
  assert.equal(result.byMeal.breakfast.entries[1].id, 'e1');

  // Breakfast totals = e2 + e1
  assert.equal(result.byMeal.breakfast.totals.calories, 346);
  assert.ok(Math.abs(result.byMeal.breakfast.totals.protein - 19.1) < 1e-6);
  assert.ok(Math.abs(result.byMeal.breakfast.totals.carbs - 35.2) < 1e-6);
  assert.ok(Math.abs(result.byMeal.breakfast.totals.fat - 13.6) < 1e-6);

  // Dinner has 1 entry
  assert.equal(result.byMeal.dinner.entries.length, 1);
  assert.equal(result.byMeal.dinner.entries[0].id, 'e3');

  // Total day entries = 3 (otherDate excluded)
  assert.equal(result.entryCount, 3);

  // Day totals = 346 + 350 = 696 calories
  assert.equal(result.totals.calories, 696);
  assert.ok(Math.abs(result.totals.protein - 41.1) < 1e-6);
});

test('9. computeDayNutrition: handles empty entries array', () => {
  const result = computeDayNutrition([], '2026-11-13');
  assert.equal(result.entryCount, 0);
  assert.equal(result.totals.calories, 0);
  assert.equal(result.byMeal.breakfast.entries.length, 0);
  assert.equal(result.byMeal.lunch.entries.length, 0);
  assert.equal(result.byMeal.snacks.entries.length, 0);
  assert.equal(result.byMeal.dinner.entries.length, 0);
});

test('10. computeRemaining computes calories left vs over target', () => {
  // 500 kcal remaining
  const under = computeRemaining({ calories: 1500, protein: 0, carbs: 0, fat: 0 }, 2000);
  assert.deepEqual(under, { kcal: 500, isOver: false });

  // Exact target
  const exact = computeRemaining({ calories: 2000, protein: 0, carbs: 0, fat: 0 }, 2000);
  assert.deepEqual(exact, { kcal: 0, isOver: false });

  // 250 kcal over target
  const over = computeRemaining({ calories: 2250, protein: 0, carbs: 0, fat: 0 }, 2000);
  assert.deepEqual(over, { kcal: 250, isOver: true });

  // Handles float rounding cleanly
  const floatUnder = computeRemaining({ calories: 1599.6, protein: 0, carbs: 0, fat: 0 }, 2000);
  assert.deepEqual(floatUnder, { kcal: 400, isOver: false });
});

test('11. formatCalories and formatGrams display rounded values with correct units and separators', () => {
  assert.equal(formatCalories(0), '0');
  assert.equal(formatCalories(1712.4), '1,712');
  assert.equal(formatCalories(2654.8), '2,655');
  assert.equal(formatCalories(500), '500');

  assert.equal(formatGrams(0), '0g');
  assert.equal(formatGrams(24.3), '24g');
  assert.equal(formatGrams(127.8), '128g');
});


