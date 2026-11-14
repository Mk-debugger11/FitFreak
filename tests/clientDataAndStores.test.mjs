import test, { after, beforeEach } from 'node:test';
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
  path.join(os.tmpdir(), 'fitfreak-client-data-test-'),
);
const tmpNodeModulesLink = path.join(tmpCompileDir, 'node_modules');

after(() => {
  try {
    if (fs.existsSync(tmpNodeModulesLink)) {
      fs.unlinkSync(tmpNodeModulesLink);
    }
  } catch {
    // ignore cleanup
  }
  fs.rmSync(tmpCompileDir, { recursive: true, force: true });
});

function compileWorkspaceModules() {
  const rootFiles = [
    path.join(ROOT_DIR, 'src/types.ts'),
    path.join(ROOT_DIR, 'src/constants/nutrition.ts'),
    path.join(ROOT_DIR, 'src/constants/foods.ts'),
    path.join(ROOT_DIR, 'src/constants/exercises.ts'),
    path.join(ROOT_DIR, 'src/constants/muscles.ts'),
    path.join(ROOT_DIR, 'src/utils/id.ts'),
    path.join(ROOT_DIR, 'src/utils/date.ts'),
    path.join(ROOT_DIR, 'src/utils/food.ts'),
    path.join(ROOT_DIR, 'src/utils/exercise.ts'),
    path.join(ROOT_DIR, 'src/features/nutrition/servingMath.ts'),
    path.join(ROOT_DIR, 'src/features/nutrition/energyFormulas.ts'),
    path.join(ROOT_DIR, 'src/services/api.ts'),
    path.join(ROOT_DIR, 'src/store/syncStore.ts'),
    path.join(ROOT_DIR, 'src/store/profileStore.ts'),
    path.join(ROOT_DIR, 'src/store/nutritionStore.ts'),
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

// Mock React Native modules before loading stores
const netinfoPath = require.resolve('@react-native-community/netinfo');
require.cache[netinfoPath] = {
  id: netinfoPath,
  filename: netinfoPath,
  loaded: true,
  exports: {
    default: {
      fetch: () => Promise.resolve({ isConnected: true }),
      addEventListener: () => () => {},
    },
    fetch: () => Promise.resolve({ isConnected: true }),
    addEventListener: () => () => {},
  },
};

const memoryStorage = new Map();
const mockStorage = {
  getItem: async (k) => memoryStorage.get(k) ?? null,
  setItem: async (k, v) => {
    memoryStorage.set(k, v);
  },
  removeItem: async (k) => {
    memoryStorage.delete(k);
  },
  clear: async () => {
    memoryStorage.clear();
  },
};
mockStorage.default = mockStorage;

const asyncStoragePath = require.resolve('@react-native-async-storage/async-storage');
require.cache[asyncStoragePath] = {
  id: asyncStoragePath,
  filename: asyncStoragePath,
  loaded: true,
  exports: mockStorage,
};

const loadTsModule = (relPathWithoutExt) =>
  require(path.join(tmpCompileDir, relPathWithoutExt + '.js'));

const {
  endpoints,
  parseUserProfile,
  parseFoodItem,
  parseCustomFood,
  parseLoggedFood,
  api,
} = loadTsModule('src/services/api');

const {
  useProfileStore,
  getMaintenanceCalories,
} = loadTsModule('src/store/profileStore');

const { useNutritionStore } = loadTsModule('src/store/nutritionStore');
const { useSyncStore } = loadTsModule('src/store/syncStore');
const { ALL_BUILTIN_FOODS } = loadTsModule('src/constants/foods');

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

test('1. API endpoints: profile, foods, customFoods, nutritionEntries defined', () => {
  assert.ok(endpoints.profile.endsWith('/profile'));
  assert.ok(endpoints.foods.endsWith('/foods'));
  assert.ok(endpoints.customFoods.endsWith('/custom-foods'));
  assert.equal(endpoints.customFood('item-123'), `${endpoints.customFoods}/item-123`);
  assert.ok(endpoints.nutritionEntries.endsWith('/nutrition-entries'));
  assert.equal(endpoints.nutritionEntry('entry-456'), `${endpoints.nutritionEntries}/entry-456`);
});

test('2. parseUserProfile: valid profile, optional fields, and invalid inputs', () => {
  const validDto = {
    id: 'user-1',
    sex: 'male',
    heightCm: 180,
    weightKg: 80,
    birthDate: '1990-05-15T00:00:00.000Z',
    activityLevel: 'moderate',
    goal: 'cut',
    bodyFatPercent: 15,
    maintenanceOverride: 2600,
    proteinPerKg: 2.0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  const parsed = parseUserProfile(validDto);
  assert.ok(parsed);
  assert.equal(parsed.id, 'user-1');
  assert.equal(parsed.sex, 'male');
  assert.equal(parsed.heightCm, 180);
  assert.equal(parsed.weightKg, 80);
  assert.ok(parsed.birthDate instanceof Date);
  assert.equal(parsed.birthDate.toISOString(), '1990-05-15T00:00:00.000Z');
  assert.equal(parsed.activityLevel, 'moderate');
  assert.equal(parsed.goal, 'cut');
  assert.equal(parsed.bodyFatPercent, 15);
  assert.equal(parsed.maintenanceOverride, 2600);
  assert.equal(parsed.proteinPerKg, 2.0);

  // Invalid sex
  assert.equal(parseUserProfile({ ...validDto, sex: 'other' }), null);
  // Invalid activityLevel
  assert.equal(parseUserProfile({ ...validDto, activityLevel: 'couch_potato' }), null);
  // Invalid goal
  assert.equal(parseUserProfile({ ...validDto, goal: 'gain_speed' }), null);
  // Invalid height
  assert.equal(parseUserProfile({ ...validDto, heightCm: 0 }), null);
  assert.equal(parseUserProfile({ ...validDto, heightCm: -10 }), null);
  assert.equal(parseUserProfile({ ...validDto, heightCm: NaN }), null);
  // Invalid weight
  assert.equal(parseUserProfile({ ...validDto, weightKg: 0 }), null);
  assert.equal(parseUserProfile({ ...validDto, weightKg: 'abc' }), null);
  // Invalid birthDate
  assert.equal(parseUserProfile({ ...validDto, birthDate: 'not-a-date' }), null);
  assert.equal(parseUserProfile({ ...validDto, birthDate: null }), null);
  // Invalid bodyFatPercent
  assert.equal(parseUserProfile({ ...validDto, bodyFatPercent: -1 }), null);
  assert.equal(parseUserProfile({ ...validDto, bodyFatPercent: NaN }), null);
  // Invalid maintenanceOverride
  assert.equal(parseUserProfile({ ...validDto, maintenanceOverride: 0 }), null);
  assert.equal(parseUserProfile({ ...validDto, maintenanceOverride: -100 }), null);
  // Invalid proteinPerKg
  assert.equal(parseUserProfile({ ...validDto, proteinPerKg: 0 }), null);
  assert.equal(parseUserProfile({ ...validDto, proteinPerKg: -1.5 }), null);
  // Non-object
  assert.equal(parseUserProfile(null), null);
  assert.equal(parseUserProfile(undefined), null);
  assert.equal(parseUserProfile('string'), null);
});

test('3. parseFoodItem: validates fields and derives missing calories via 4/4/9', () => {
  const validWithCalories = {
    name: 'Oatmeal',
    category: 'Grains',
    basis: 'per_100g',
    macros: { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9 },
    servings: [{ label: '1 cup cooked', grams: 234 }],
    aliases: ['Rolled oats'],
    notes: 'Classic rolled oats',
  };

  const parsed1 = parseFoodItem(validWithCalories);
  assert.ok(parsed1);
  assert.equal(parsed1.name, 'Oatmeal');
  assert.equal(parsed1.category, 'Grains');
  assert.equal(parsed1.basis, 'per_100g');
  assert.equal(parsed1.macros.calories, 389);
  assert.equal(parsed1.servings?.length, 1);
  assert.equal(parsed1.servings?.[0].label, '1 cup cooked');
  assert.deepEqual(parsed1.aliases, ['Rolled oats']);

  // Missing calories: derives via 4/4/9 (10*4 + 20*4 + 5*9 = 40 + 80 + 45 = 165)
  const missingCalories = {
    name: 'Protein Snack',
    category: 'Snacks',
    basis: 'per_piece',
    macros: { protein: 10, carbs: 20, fat: 5 },
  };
  const parsed2 = parseFoodItem(missingCalories);
  assert.ok(parsed2);
  assert.equal(parsed2.macros.calories, 165);

  // Invalid cases
  assert.equal(parseFoodItem({ ...validWithCalories, name: '   ' }), null);
  assert.equal(parseFoodItem({ ...validWithCalories, category: 'UnknownCat' }), null);
  assert.equal(parseFoodItem({ ...validWithCalories, basis: 'per_pound' }), null);
  assert.equal(parseFoodItem({ ...validWithCalories, macros: null }), null);
  assert.equal(parseFoodItem({ ...validWithCalories, macros: { protein: -1, carbs: 10, fat: 0 } }), null);
});

test('4. parseCustomFood: requires id and food properties', () => {
  const validCustom = {
    id: 'custom-food-1',
    name: 'My Protein Shake',
    category: 'Supplements',
    basis: 'per_100ml',
    macros: { calories: 120, protein: 25, carbs: 3, fat: 1 },
  };

  const parsed = parseCustomFood(validCustom);
  assert.ok(parsed);
  assert.equal(parsed.id, 'custom-food-1');
  assert.equal(parsed.name, 'My Protein Shake');

  // Missing id
  assert.equal(parseCustomFood({ ...validCustom, id: '' }), null);
  assert.equal(parseCustomFood({ ...validCustom, id: undefined }), null);
  // Invalid food properties
  assert.equal(parseCustomFood({ ...validCustom, category: 'Invalid' }), null);
});

test('5. parseLoggedFood: validates id, mealType, basis, quantity, dates', () => {
  const validLogged = {
    id: 'log-1',
    dateString: '2026-11-14',
    mealType: 'breakfast',
    foodName: 'Boiled Egg',
    basis: 'per_piece',
    quantity: 2,
    servingLabel: '2 large eggs',
    macros: { calories: 140, protein: 12, carbs: 1, fat: 10 },
    foodId: 'food-egg',
    loggedAt: '2026-11-14T08:30:00.000Z',
  };

  const parsed = parseLoggedFood(validLogged);
  assert.ok(parsed);
  assert.equal(parsed.id, 'log-1');
  assert.equal(parsed.dateString, '2026-11-14');
  assert.equal(parsed.mealType, 'breakfast');
  assert.equal(parsed.foodName, 'Boiled Egg');
  assert.equal(parsed.quantity, 2);
  assert.ok(parsed.loggedAt instanceof Date);
  assert.equal(parsed.loggedAt.toISOString(), '2026-11-14T08:30:00.000Z');

  // Invalid dateString format
  assert.equal(parseLoggedFood({ ...validLogged, dateString: '14-11-2026' }), null);
  assert.equal(parseLoggedFood({ ...validLogged, dateString: '2026/11/14' }), null);
  // Invalid mealType
  assert.equal(parseLoggedFood({ ...validLogged, mealType: 'brunch' }), null);
  // Empty foodName
  assert.equal(parseLoggedFood({ ...validLogged, foodName: ' ' }), null);
  // Invalid quantity
  assert.equal(parseLoggedFood({ ...validLogged, quantity: 0 }), null);
  assert.equal(parseLoggedFood({ ...validLogged, quantity: -2 }), null);
  // Invalid loggedAt
  assert.equal(parseLoggedFood({ ...validLogged, loggedAt: 'invalid-date' }), null);
  // Missing id
  assert.equal(parseLoggedFood({ ...validLogged, id: '' }), null);
});

test('6. api methods: getProfile, getFoods, getCustomFoods, getNutritionEntries', async () => {
  const originalFetch = global.fetch;

  try {
    // 6a: getProfile 404 returns null
    global.fetch = async (url) => {
      if (url === endpoints.profile) {
        return { status: 404, ok: false };
      }
      return { status: 500, ok: false };
    };
    const profile404 = await api.getProfile();
    assert.equal(profile404, null);

    // 6b: getProfile 200 with null body returns null
    global.fetch = async (url) => {
      if (url === endpoints.profile) {
        return { status: 200, ok: true, json: async () => null };
      }
      return { status: 500, ok: false };
    };
    const profileNull = await api.getProfile();
    assert.equal(profileNull, null);

    // 6c: getProfile 200 with valid profile returns parsed UserProfile
    global.fetch = async (url) => {
      if (url === endpoints.profile) {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            id: 'p-1',
            sex: 'female',
            heightCm: 165,
            weightKg: 60,
            birthDate: '1992-03-10T00:00:00.000Z',
            activityLevel: 'active',
            goal: 'maintain',
          }),
        };
      }
      return { status: 500, ok: false };
    };
    const profileValid = await api.getProfile();
    assert.ok(profileValid);
    assert.equal(profileValid.sex, 'female');
    assert.equal(profileValid.heightCm, 165);

    // 6d: getFoods 404 returns null
    global.fetch = async (url) => {
      if (url === endpoints.foods) {
        return { status: 404, ok: false };
      }
      return { status: 500, ok: false };
    };
    const foods404 = await api.getFoods();
    assert.equal(foods404, null);

    // 6e: getFoods 200 returns FoodItem[]
    global.fetch = async (url) => {
      if (url === endpoints.foods) {
        return {
          status: 200,
          ok: true,
          json: async () => [
            {
              name: 'Apple',
              category: 'Fruit',
              basis: 'per_piece',
              macros: { calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
            },
          ],
        };
      }
      return { status: 500, ok: false };
    };
    const foodsList = await api.getFoods();
    assert.ok(Array.isArray(foodsList));
    assert.equal(foodsList.length, 1);
    assert.equal(foodsList[0].name, 'Apple');

    // 6f: getCustomFoods returns CustomFood[]
    global.fetch = async (url) => {
      if (url === endpoints.customFoods) {
        return {
          status: 200,
          ok: true,
          json: async () => [
            {
              id: 'cf-1',
              name: 'Homemade Hummus',
              category: 'Cooked Dishes',
              basis: 'per_100g',
              macros: { calories: 166, protein: 7.9, carbs: 14.3, fat: 9.6 },
            },
          ],
        };
      }
      return { status: 500, ok: false };
    };
    const customList = await api.getCustomFoods();
    assert.ok(Array.isArray(customList));
    assert.equal(customList.length, 1);
    assert.equal(customList[0].id, 'cf-1');

    // 6g: getNutritionEntries with query params
    let calledUrl = '';
    global.fetch = async (url) => {
      calledUrl = url;
      return {
        status: 200,
        ok: true,
        json: async () => [
          {
            id: 'ne-1',
            dateString: '2026-11-14',
            mealType: 'lunch',
            foodName: 'Rice Bowl',
            basis: 'per_100g',
            quantity: 200,
            macros: { calories: 260, protein: 5, carbs: 56, fat: 0.8 },
            loggedAt: '2026-11-14T13:00:00.000Z',
          },
        ],
      };
    };
    const entries = await api.getNutritionEntries({
      startDate: '2026-11-01',
      endDate: '2026-11-14',
    });
    assert.ok(calledUrl.includes('startDate=2026-11-01'));
    assert.ok(calledUrl.includes('endDate=2026-11-14'));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].foodName, 'Rice Bowl');
  } finally {
    global.fetch = originalFetch;
  }
});

test('7. profileStore: saveProfile, getMaintenanceCalories, and sync queue enqueue', async () => {
  useSyncStore.getState().clearQueue();
  useProfileStore.setState({ profile: null, hasHydrated: true, isFetching: false });

  // Before profile is saved, getMaintenanceCalories returns null
  assert.equal(getMaintenanceCalories(), null);

  // saveProfile merges patch and creates defaults
  await useProfileStore.getState().saveProfile({
    sex: 'male',
    heightCm: 178,
    weightKg: 75,
    birthDate: new Date('1994-06-20'),
    activityLevel: 'moderate',
    goal: 'maintain',
  });

  const profile = useProfileStore.getState().profile;
  assert.ok(profile);
  assert.ok(profile.id);
  assert.equal(profile.sex, 'male');
  assert.equal(profile.heightCm, 178);
  assert.equal(profile.weightKg, 75);
  assert.ok(profile.birthDate instanceof Date);

  // getMaintenanceCalories now returns a valid finite number
  const maintenance = getMaintenanceCalories();
  assert.ok(typeof maintenance === 'number' && maintenance > 0);

  // Sync queue contains the PUT request
  const queue = useSyncStore.getState().queue;
  assert.equal(queue.length, 1);
  assert.equal(queue[0].url, endpoints.profile);
  assert.equal(queue[0].method, 'PUT');
  assert.equal(queue[0].body.sex, 'male');
});

test('8. nutritionStore: logFood, updateLoggedFood, deleteLoggedFood', () => {
  useSyncStore.getState().clearQueue();
  useNutritionStore.setState({
    loggedFoods: [],
    customFoods: [],
    fetchedNutritionDates: {},
  });

  const foodItem = {
    name: 'Greek Yogurt',
    category: 'Dairy',
    basis: 'per_100g',
    macros: { calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  };

  // logFood scales macros for 200g (2x)
  const logged = useNutritionStore.getState().logFood({
    dateString: '2026-11-14',
    mealType: 'breakfast',
    food: foodItem,
    quantity: 200,
    servingLabel: '200g bowl',
  });

  assert.ok(logged);
  assert.ok(logged.id);
  assert.equal(logged.foodName, 'Greek Yogurt');
  assert.equal(logged.quantity, 200);
  assert.equal(logged.macros.calories, 118);
  assert.equal(logged.macros.protein, 20);

  const state1 = useNutritionStore.getState();
  assert.equal(state1.loggedFoods.length, 1);
  assert.equal(state1.fetchedNutritionDates['2026-11-14'], true);

  // Sync queue received POST
  const queue1 = useSyncStore.getState().queue;
  assert.equal(queue1.length, 1);
  assert.equal(queue1[0].url, endpoints.nutritionEntries);
  assert.equal(queue1[0].method, 'POST');
  assert.equal(queue1[0].body.foodName, 'Greek Yogurt');

  // updateLoggedFood
  useNutritionStore.getState().updateLoggedFood(logged.id, {
    quantity: 250,
    servingLabel: '250g bowl',
  });
  const updated = useNutritionStore.getState().loggedFoods.find((f) => f.id === logged.id);
  assert.equal(updated?.quantity, 250);
  assert.equal(updated?.servingLabel, '250g bowl');

  const queue2 = useSyncStore.getState().queue;
  assert.equal(queue2.length, 2);
  assert.equal(queue2[1].url, endpoints.nutritionEntry(logged.id));
  assert.equal(queue2[1].method, 'PUT');

  // deleteLoggedFood
  useNutritionStore.getState().deleteLoggedFood(logged.id);
  assert.equal(useNutritionStore.getState().loggedFoods.length, 0);

  const queue3 = useSyncStore.getState().queue;
  assert.equal(queue3.length, 3);
  assert.equal(queue3[2].url, endpoints.nutritionEntry(logged.id));
  assert.equal(queue3[2].method, 'DELETE');

  // logFood with customMacros overrides default scaling (e.g. for cooked dishes)
  const cookedDish = {
    name: 'Cooked Rajma',
    category: 'Cooked Dishes',
    basis: 'per_100g',
    macros: { calories: 120, protein: 7, carbs: 18, fat: 2 },
  };
  const customLogged = useNutritionStore.getState().logFood({
    dateString: '2026-11-14',
    mealType: 'lunch',
    food: cookedDish,
    quantity: 150,
    customMacros: { calories: 250, protein: 12, carbs: 26, fat: 8 },
  });
  assert.equal(customLogged.macros.calories, 250);
  assert.equal(customLogged.macros.protein, 12);
  assert.equal(customLogged.macros.carbs, 26);
  assert.equal(customLogged.macros.fat, 8);
});

test('9. nutritionStore: addCustomFood, duplicate rejection, deleteCustomFood', () => {
  useSyncStore.getState().clearQueue();
  useNutritionStore.setState({
    customFoods: [],
  });

  const customPayload = {
    name: 'Homemade Protein Bar',
    category: 'Snacks',
    basis: 'per_piece',
    macros: { calories: 220, protein: 20, carbs: 18, fat: 7 },
  };

  const added = useNutritionStore.getState().addCustomFood(customPayload);
  assert.ok(added);
  assert.ok(added.id);
  assert.equal(added.name, 'Homemade Protein Bar');
  assert.equal(useNutritionStore.getState().customFoods.length, 1);

  // Duplicate name rejection (case and punctuation insensitive)
  const dup = useNutritionStore.getState().addCustomFood({
    ...customPayload,
    name: '  homemade   protein bar! ',
  });
  assert.equal(dup, null);
  assert.equal(useNutritionStore.getState().customFoods.length, 1);

  // Sync queue contains POST
  const queue = useSyncStore.getState().queue;
  assert.equal(queue.length, 1);
  assert.equal(queue[0].url, endpoints.customFoods);
  assert.equal(queue[0].method, 'POST');

  // deleteCustomFood
  useNutritionStore.getState().deleteCustomFood(added.id);
  assert.equal(useNutritionStore.getState().customFoods.length, 0);

  const queueAfterDelete = useSyncStore.getState().queue;
  assert.equal(queueAfterDelete.length, 2);
  assert.equal(queueAfterDelete[1].url, endpoints.customFood(added.id));
  assert.equal(queueAfterDelete[1].method, 'DELETE');
});

test('10. nutritionStore: searchFoods (custom first, prefix first, limit 50)', () => {
  const customFood = {
    id: 'cf-egg',
    name: 'Egg White Omelet',
    category: 'Cooked Dishes',
    basis: 'per_piece',
    macros: { calories: 150, protein: 22, carbs: 2, fat: 3 },
  };

  useNutritionStore.setState({
    customFoods: [customFood],
    foodsCatalog: ALL_BUILTIN_FOODS,
  });

  // Searching 'egg'
  const results = useNutritionStore.getState().searchFoods('egg');
  assert.ok(results.length > 0);
  assert.ok(results.length <= 50);

  // Custom food starts with 'Egg' so it should be near the top
  const foundIndex = results.findIndex((r) => r.name === 'Egg White Omelet');
  assert.ok(foundIndex !== -1);
  // All prefix matches come before non-prefix matches
  const firstNonPrefix = results.findIndex(
    (r) => !r.name.toLowerCase().startsWith('egg') && !r.aliases?.some((a) => a.toLowerCase().startsWith('egg')),
  );
  if (firstNonPrefix !== -1) {
    assert.ok(foundIndex <= firstNonPrefix);
  }

  // Empty query returns empty array
  assert.deepEqual(useNutritionStore.getState().searchFoods('   '), []);
});

test('11. nutritionStore: recentFoods returns distinct foods newest first up to limit', () => {
  const eggFood = {
    name: 'Boiled Egg',
    category: 'Protein',
    basis: 'per_piece',
    macros: { calories: 70, protein: 6, carbs: 0.5, fat: 5 },
  };
  const yogurtFood = {
    name: 'Greek Yogurt',
    category: 'Dairy',
    basis: 'per_100g',
    macros: { calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  };

  useNutritionStore.setState({
    customFoods: [],
    foodsCatalog: [eggFood, yogurtFood, ...ALL_BUILTIN_FOODS],
    loggedFoods: [
      {
        id: '1',
        dateString: '2026-11-14',
        mealType: 'breakfast',
        foodName: 'Boiled Egg',
        basis: 'per_piece',
        quantity: 2,
        macros: { calories: 140, protein: 12, carbs: 1, fat: 10 },
        loggedAt: new Date('2026-11-14T09:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        dateString: '2026-11-14',
        mealType: 'breakfast',
        foodName: 'Boiled Egg', // duplicate food name in log
        basis: 'per_piece',
        quantity: 1,
        macros: { calories: 70, protein: 6, carbs: 0.5, fat: 5 },
        loggedAt: new Date('2026-11-14T08:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '3',
        dateString: '2026-11-13',
        mealType: 'snacks',
        foodName: 'Greek Yogurt',
        basis: 'per_100g',
        quantity: 150,
        macros: { calories: 88, protein: 15, carbs: 5.4, fat: 0.6 },
        loggedAt: new Date('2026-11-13T16:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });

  const recents = useNutritionStore.getState().recentFoods(5);
  // Should deduplicate 'Boiled Egg'
  assert.equal(recents.length, 2);
  assert.equal(recents[0].name, 'Boiled Egg');
  assert.equal(recents[1].name, 'Greek Yogurt');

  // Limit check
  const singleRecent = useNutritionStore.getState().recentFoods(1);
  assert.equal(singleRecent.length, 1);
  assert.equal(singleRecent[0].name, 'Boiled Egg');
});

test('12. profileStore & nutritionStore hydration merge revives Date objects', () => {
  // Test profileStore merge
  const profileOptions = useProfileStore.persist.getOptions();
  const rawPersistedProfile = {
    profile: {
      id: 'p-saved',
      sex: 'male',
      heightCm: 175,
      weightKg: 70,
      birthDate: '1995-01-01T00:00:00.000Z',
      activityLevel: 'moderate',
      goal: 'maintain',
      createdAt: '2026-01-01T12:00:00.000Z',
      updatedAt: '2026-01-02T12:00:00.000Z',
    },
  };
  const mergedProfileState = profileOptions.merge(rawPersistedProfile, {
    profile: null,
    hasHydrated: false,
    isFetching: false,
    fetchProfile: async () => {},
    saveProfile: async () => {},
  });
  assert.ok(mergedProfileState.profile);
  assert.ok(mergedProfileState.profile.birthDate instanceof Date);
  assert.ok(mergedProfileState.profile.createdAt instanceof Date);
  assert.ok(mergedProfileState.profile.updatedAt instanceof Date);
  assert.equal(mergedProfileState.hasHydrated, true);

  // Test nutritionStore merge
  const nutritionOptions = useNutritionStore.persist.getOptions();
  const rawPersistedNutrition = {
    loggedFoods: [
      {
        id: 'log-saved',
        dateString: '2026-11-14',
        mealType: 'dinner',
        foodName: 'Grilled Chicken',
        basis: 'per_100g',
        quantity: 150,
        macros: { calories: 247, protein: 46.5, carbs: 0, fat: 5.4 },
        loggedAt: '2026-11-14T20:00:00.000Z',
        createdAt: '2026-11-14T20:00:00.000Z',
        updatedAt: '2026-11-14T20:00:00.000Z',
      },
      // Invalid entry that should be dropped
      {
        id: 'invalid-entry',
        dateString: 'bad-date',
      },
    ],
    customFoods: [
      {
        id: 'cf-saved',
        name: 'Whey Isolate',
        category: 'Supplements',
        basis: 'per_piece',
        macros: { calories: 120, protein: 25, carbs: 2, fat: 1 },
      },
    ],
    foodsCatalog: [],
    fetchedNutritionDates: { '2026-11-14': true },
  };
  const mergedNutritionState = nutritionOptions.merge(rawPersistedNutrition, {
    isLoading: true,
    isFetching: false,
    hasHydrated: false,
    loggedFoods: [],
    foodsCatalog: ALL_BUILTIN_FOODS,
    customFoods: [],
    fetchedNutritionDates: {},
    fetchNutritionData: async () => {},
    fetchEntriesForDate: async () => {},
    logFood: () => ({}),
    updateLoggedFood: () => {},
    deleteLoggedFood: () => {},
    addCustomFood: () => null,
    deleteCustomFood: () => {},
    searchFoods: () => [],
    recentFoods: () => [],
  });

  assert.equal(mergedNutritionState.loggedFoods.length, 1);
  assert.ok(mergedNutritionState.loggedFoods[0].loggedAt instanceof Date);
  assert.equal(mergedNutritionState.customFoods.length, 1);
  assert.ok(mergedNutritionState.foodsCatalog.length > 0);
  assert.equal(mergedNutritionState.hasHydrated, true);
  assert.equal(mergedNutritionState.isLoading, false);
});

test('13. nutritionStore: fetchNutritionData and fetchEntriesForDate flow', async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async (url) => {
      if (url.includes('/api/nutrition-entries')) {
        return {
          status: 200,
          ok: true,
          json: async () => [
            {
              id: 'ne-fetched-1',
              dateString: '2026-11-14',
              mealType: 'dinner',
              foodName: 'Salmon',
              basis: 'per_100g',
              quantity: 150,
              macros: { calories: 312, protein: 30, carbs: 0, fat: 20 },
              loggedAt: '2026-11-14T19:30:00.000Z',
            },
          ],
        };
      }
      if (url === endpoints.foods) {
        // Return 404 to verify fallback to ALL_BUILTIN_FOODS
        return { status: 404, ok: false };
      }
      if (url === endpoints.customFoods) {
        return {
          status: 200,
          ok: true,
          json: async () => [
            {
              id: 'cf-salmon-roll',
              name: 'Salmon Roll',
              category: 'Cooked Dishes',
              basis: 'per_piece',
              macros: { calories: 300, protein: 12, carbs: 40, fat: 8 },
            },
          ],
        };
      }
      return { status: 404, ok: false };
    };

    useNutritionStore.setState({
      loggedFoods: [],
      customFoods: [],
      foodsCatalog: [],
      fetchedNutritionDates: {},
      isFetching: false,
    });

    await useNutritionStore.getState().fetchNutritionData();

    const state = useNutritionStore.getState();
    assert.equal(state.loggedFoods.length, 1);
    assert.equal(state.loggedFoods[0].foodName, 'Salmon');
    assert.equal(state.customFoods.length, 1);
    assert.equal(state.customFoods[0].name, 'Salmon Roll');
    assert.equal(state.foodsCatalog.length, ALL_BUILTIN_FOODS.length);
    assert.equal(state.fetchedNutritionDates['2026-11-14'], true);

    // fetchEntriesForDate for already fetched date returns early
    let fetchCount = 0;
    global.fetch = async (url) => {
      fetchCount++;
      return { status: 200, ok: true, json: async () => [] };
    };
    await useNutritionStore.getState().fetchEntriesForDate('2026-11-14');
    assert.equal(fetchCount, 0);

    // fetchEntriesForDate for a new date fetches and updates store
    global.fetch = async (url) => {
      fetchCount++;
      return {
        status: 200,
        ok: true,
        json: async () => [
          {
            id: 'ne-fetched-2',
            dateString: '2026-11-01',
            mealType: 'breakfast',
            foodName: 'Banana',
            basis: 'per_piece',
            quantity: 1,
            macros: { calories: 105, protein: 1.3, carbs: 27, fat: 0.3 },
            loggedAt: '2026-11-01T08:00:00.000Z',
          },
        ],
      };
    };
    await useNutritionStore.getState().fetchEntriesForDate('2026-11-01');
    assert.equal(fetchCount, 1);
    assert.equal(useNutritionStore.getState().fetchedNutritionDates['2026-11-01'], true);
    assert.equal(useNutritionStore.getState().loggedFoods.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
