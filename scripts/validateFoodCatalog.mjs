import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_CATALOG_DIR = path.join(ROOT_DIR, 'src', 'constants', 'foodCatalog');
const BACKEND_CATALOG_PATH = path.join(ROOT_DIR, 'backend', 'data', 'foodCatalog.json');

const FRONTEND_FILES = [
  { file: 'beverages.json', expectedCategories: ['Beverages'] },
  { file: 'cookedDishes.json', expectedCategories: ['Cooked Dishes'] },
  { file: 'dairy.json', expectedCategories: ['Dairy'] },
  { file: 'fruitsVeg.json', expectedCategories: ['Fruit', 'Vegetables'] },
  { file: 'grains.json', expectedCategories: ['Grains'] },
  { file: 'nutsSeeds.json', expectedCategories: ['Nuts & Seeds'] },
  { file: 'protein.json', expectedCategories: ['Protein', 'Supplements'] },
  { file: 'snacks.json', expectedCategories: ['Snacks'] },
];

const PARITY_FIELDS = [
  'name',
  'aliases',
  'category',
  'basis',
  'macros',
  'servings',
  'defaultQuantity',
  'notes',
];

const registerTypeScriptHooks = () => {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
        const parentDir = path.dirname(fileURLToPath(context.parentURL));
        const candidateTs = path.resolve(parentDir, `${specifier}.ts`);
        if (!path.extname(specifier) && fs.existsSync(candidateTs)) {
          return { url: pathToFileURL(candidateTs).href, shortCircuit: true };
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.endsWith('.ts')) {
        const filePath = fileURLToPath(url);
        const source = fs.readFileSync(filePath, 'utf8');
        const transpiled = ts.transpileModule(source, {
          fileName: filePath,
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
          },
        });
        return { format: 'module', source: transpiled.outputText, shortCircuit: true };
      }
      if (url.endsWith('.json')) {
        const source = fs.readFileSync(fileURLToPath(url), 'utf8');
        return { format: 'module', source: `export default ${source};`, shortCircuit: true };
      }
      return nextLoad(url, context);
    },
  });
};

const readJsonFile = (filePath, issues) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    issues.push(
      `[${path.relative(ROOT_DIR, filePath)}] Failed to read/parse JSON: ${error.message}`,
    );
    return null;
  }
};

const formatValidationErrors = (label, errors) =>
  errors.map((err) => {
    const entryTag = err.foodName
      ? `#${err.index} (${err.foodName})`
      : err.index >= 0
        ? `#${err.index}`
        : 'catalog';
    return `[${label}] ${entryTag} [${err.field}]: ${err.message}`;
  });

const compareByCategoryAndName = (a, b) =>
  String(a.category).localeCompare(String(b.category)) ||
  String(a.name).localeCompare(String(b.name));

const valuesEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
};

const arraysEqual = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((val, idx) => val === b[idx]);

const checkBackendOrder = (backendEntries, issues) => {
  for (let index = 1; index < backendEntries.length; index += 1) {
    const prev = backendEntries[index - 1];
    const curr = backendEntries[index];
    if (compareByCategoryAndName(prev, curr) > 0) {
      issues.push(
        `[backend/data/foodCatalog.json] Out of deterministic sort order at index ${index}: "${prev.category}::${prev.name}" should come after "${curr.category}::${curr.name}".`,
      );
    }
  }
};

const checkParity = (frontendEntries, backendEntries, issues) => {
  if (frontendEntries.length !== backendEntries.length) {
    issues.push(
      `[parity] Entry count mismatch: frontend has ${frontendEntries.length}, backend has ${backendEntries.length}.`,
    );
  }

  const sortedFrontend = [...frontendEntries].sort(compareByCategoryAndName);
  const minCount = Math.min(sortedFrontend.length, backendEntries.length);

  for (let index = 0; index < minCount; index += 1) {
    const fe = sortedFrontend[index];
    const be = backendEntries[index];
    const label = `${fe?.name ?? `index ${index}`}`;

    for (const field of PARITY_FIELDS) {
      const feVal = fe[field];
      const beVal = be[field];
      const equal = valuesEqual(feVal, beVal);

      if (!equal) {
        issues.push(
          `[parity] Index ${index} (${label}) differs in "${field}": frontend=${JSON.stringify(feVal)} backend=${JSON.stringify(beVal)}`,
        );
      }
    }

    const feKeys = Object.keys(fe).sort();
    const beKeys = Object.keys(be).sort();
    if (!arraysEqual(feKeys, beKeys)) {
      issues.push(
        `[parity] Index ${index} (${label}) key mismatch: frontend=${JSON.stringify(feKeys)} backend=${JSON.stringify(beKeys)}`,
      );
    }
  }
};

const main = async () => {
  const issues = [];
  const filePayloads = [];

  for (const spec of FRONTEND_FILES) {
    const filePath = path.join(FRONTEND_CATALOG_DIR, spec.file);
    const parsed = readJsonFile(filePath, issues);
    if (parsed !== null) {
      filePayloads.push({ ...spec, filePath, entries: parsed });
    }
  }

  const backendEntries = readJsonFile(BACKEND_CATALOG_PATH, issues);

  if (issues.length > 0) {
    for (const issue of issues) console.error(issue);
    process.exit(1);
  }

  registerTypeScriptHooks();
  const validationModuleUrl = pathToFileURL(
    path.join(ROOT_DIR, 'src', 'utils', 'foodCatalogValidation.ts'),
  ).href;
  const { validateFoodCatalog } = await import(validationModuleUrl);

  const frontendEntries = [];
  for (const payload of filePayloads) {
    const relPath = path.relative(ROOT_DIR, payload.filePath);
    if (!Array.isArray(payload.entries) || payload.entries.length === 0) {
      issues.push(`[${relPath}] Catalog file must be a non-empty array.`);
      continue;
    }

    const fileResult = validateFoodCatalog(payload.entries, {
      allowedCategories: payload.expectedCategories,
      requireServings: true,
      requireNotes: true,
      maxCalorieDifferenceFraction: 0.15,
    });
    if (!fileResult.valid) {
      issues.push(...formatValidationErrors(relPath, fileResult.errors));
    }

    frontendEntries.push(...payload.entries);
  }

  const combinedFrontendResult = validateFoodCatalog(frontendEntries, {
    requireServings: true,
    requireNotes: true,
    maxCalorieDifferenceFraction: 0.15,
  });
  if (!combinedFrontendResult.valid) {
    issues.push(
      ...formatValidationErrors('frontend-combined', combinedFrontendResult.errors),
    );
  }

  const backendResult = validateFoodCatalog(backendEntries, {
    requireServings: true,
    requireNotes: true,
    maxCalorieDifferenceFraction: 0.15,
  });
  if (!backendResult.valid) {
    issues.push(
      ...formatValidationErrors('backend/data/foodCatalog.json', backendResult.errors),
    );
  }

  if (Array.isArray(backendEntries)) {
    checkBackendOrder(backendEntries, issues);
    checkParity(frontendEntries, backendEntries, issues);
  }

  if (issues.length > 0) {
    console.error(`Food catalog validation failed with ${issues.length} error(s):`);
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(
    `Food catalog validation passed: ${filePayloads.length} frontend files (${frontendEntries.length} foods) and backend/data/foodCatalog.json (${backendEntries.length} foods) are valid and in exact parity.`,
  );
};

await main();
