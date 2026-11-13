import { FOOD_CATEGORIES } from '../constants/nutrition';
import { FOOD_BASES } from '../types';
import { normalizeFoodName } from './food';

export interface FoodCatalogValidationError {
  index: number;
  foodName?: string;
  field: string;
  message: string;
}

export interface FoodCatalogValidationOptions {
  allowedCategories?: readonly string[];
  allowedBases?: readonly string[];
  maxCalorieDifferenceFraction?: number;
  requireServings?: boolean;
  requireNotes?: boolean;
}

export interface FoodCatalogValidationResult {
  valid: boolean;
  foodCount: number;
  errors: FoodCatalogValidationError[];
}

interface TermOwner {
  index: number;
  name: string;
  kind: 'name' | 'alias';
}

interface ValidationContext {
  validCategories: ReadonlySet<string>;
  validBases: ReadonlySet<string>;
  maxCalorieDiffFraction: number;
  requireServings: boolean;
  requireNotes: boolean;
  ownerByTerm: Map<string, TermOwner>;
  errors: FoodCatalogValidationError[];
}

const DEFAULT_CATEGORY_SET: ReadonlySet<string> = new Set(FOOD_CATEGORIES);
const DEFAULT_BASIS_SET: ReadonlySet<string> = new Set(FOOD_BASES);
const DEFAULT_MAX_CALORIE_DIFF = 0.15; // 15%

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pushError = (
  errors: FoodCatalogValidationError[],
  index: number,
  field: string,
  message: string,
  foodName?: string,
): void => {
  errors.push({
    index,
    ...(foodName ? { foodName } : {}),
    field,
    message,
  });
};

const validateNameAndAliases = (
  entry: Record<string, unknown>,
  index: number,
  ctx: ValidationContext,
): string | undefined => {
  const rawName = entry.name;
  if (typeof rawName !== 'string' || rawName.trim().length === 0) {
    pushError(ctx.errors, index, 'name', 'Food name must be a non-empty string.');
    return undefined;
  }

  const trimmedName = rawName.trim();
  const normalizedName = normalizeFoodName(trimmedName);
  if (!normalizedName) {
    pushError(
      ctx.errors,
      index,
      'name',
      `Food name "${trimmedName}" is empty after normalization.`,
      trimmedName,
    );
    return trimmedName;
  }

  const existingOwner = ctx.ownerByTerm.get(normalizedName);
  if (existingOwner && existingOwner.index !== index) {
    pushError(
      ctx.errors,
      index,
      'name',
      `Normalized name "${normalizedName}" collides with ${existingOwner.kind} of "${existingOwner.name}" (index ${existingOwner.index}).`,
      trimmedName,
    );
  } else {
    ctx.ownerByTerm.set(normalizedName, { index, name: trimmedName, kind: 'name' });
  }

  if (entry.aliases === undefined) {
    return trimmedName;
  }

  if (!Array.isArray(entry.aliases)) {
    pushError(ctx.errors, index, 'aliases', 'Aliases must be an array of strings.', trimmedName);
    return trimmedName;
  }

  const seenRawAliases = new Set<string>();
  for (const rawAlias of entry.aliases) {
    if (typeof rawAlias !== 'string' || rawAlias.trim().length === 0) {
      pushError(
        ctx.errors,
        index,
        'aliases',
        'Every alias must be a non-empty string.',
        trimmedName,
      );
      continue;
    }

    const trimmedAlias = rawAlias.trim();
    if (trimmedAlias === trimmedName) {
      pushError(
        ctx.errors,
        index,
        'aliases',
        `Alias "${trimmedAlias}" duplicates the food name verbatim.`,
        trimmedName,
      );
      continue;
    }

    const lowerAlias = trimmedAlias.toLowerCase();
    if (seenRawAliases.has(lowerAlias)) {
      pushError(
        ctx.errors,
        index,
        'aliases',
        `Duplicate alias "${trimmedAlias}" within entry.`,
        trimmedName,
      );
      continue;
    }
    seenRawAliases.add(lowerAlias);

    const normalizedAlias = normalizeFoodName(trimmedAlias);
    if (!normalizedAlias) {
      pushError(
        ctx.errors,
        index,
        'aliases',
        `Alias "${trimmedAlias}" is empty after normalization.`,
        trimmedName,
      );
      continue;
    }

    if (normalizedAlias === normalizedName) {
      pushError(
        ctx.errors,
        index,
        'aliases',
        `Alias "${trimmedAlias}" normalizes to the same value as the food name ("${normalizedName}").`,
        trimmedName,
      );
      continue;
    }

    const aliasOwner = ctx.ownerByTerm.get(normalizedAlias);
    if (aliasOwner && aliasOwner.index !== index) {
      pushError(
        ctx.errors,
        index,
        'aliases',
        `Normalized alias "${normalizedAlias}" ("${trimmedAlias}") collides with ${aliasOwner.kind} of "${aliasOwner.name}" (index ${aliasOwner.index}).`,
        trimmedName,
      );
    } else {
      ctx.ownerByTerm.set(normalizedAlias, { index, name: trimmedName, kind: 'alias' });
    }
  }

  return trimmedName;
};

const validateCategoryAndBasis = (
  entry: Record<string, unknown>,
  index: number,
  foodName: string | undefined,
  ctx: ValidationContext,
): { category?: string; basis?: string } => {
  const { category, basis } = entry;

  if (typeof category !== 'string' || !ctx.validCategories.has(category)) {
    pushError(
      ctx.errors,
      index,
      'category',
      `Category "${String(category)}" is not one of allowed categories: [${Array.from(ctx.validCategories).join(', ')}].`,
      foodName,
    );
  }

  if (typeof basis !== 'string' || !ctx.validBases.has(basis)) {
    pushError(
      ctx.errors,
      index,
      'basis',
      `Basis "${String(basis)}" is not one of allowed bases: [${Array.from(ctx.validBases).join(', ')}].`,
      foodName,
    );
  }

  return {
    category: typeof category === 'string' ? category : undefined,
    basis: typeof basis === 'string' ? basis : undefined,
  };
};

const validateMacros = (
  entry: Record<string, unknown>,
  index: number,
  foodName: string | undefined,
  basis: string | undefined,
  ctx: ValidationContext,
): void => {
  const { macros } = entry;
  if (!isPlainRecord(macros)) {
    pushError(ctx.errors, index, 'macros', 'Macros must be an object with calories, protein, carbs, fat.', foodName);
    return;
  }

  const { calories, protein, carbs, fat } = macros;

  for (const [key, val] of Object.entries({ protein, carbs, fat })) {
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
      pushError(
        ctx.errors,
        index,
        `macros.${key}`,
        `Macro "${key}" must be a finite non-negative number; got ${JSON.stringify(val)}.`,
        foodName,
      );
    }
  }

  if (typeof calories !== 'number' || !Number.isFinite(calories) || calories < 0) {
    pushError(
      ctx.errors,
      index,
      'macros.calories',
      `Calories must be a finite non-negative number; got ${JSON.stringify(calories)}.`,
      foodName,
    );
  }

  const p = typeof protein === 'number' && Number.isFinite(protein) && protein >= 0 ? protein : 0;
  const c = typeof carbs === 'number' && Number.isFinite(carbs) && carbs >= 0 ? carbs : 0;
  const f = typeof fat === 'number' && Number.isFinite(fat) && fat >= 0 ? fat : 0;
  const cal = typeof calories === 'number' && Number.isFinite(calories) && calories >= 0 ? calories : 0;

  // Rule: For per_100g and per_100ml, macros must not exceed 100g.
  if (basis === 'per_100g' || basis === 'per_100ml') {
    const macroSum = p + c + f;
    if (macroSum > 100.001) {
      pushError(
        ctx.errors,
        index,
        'macros',
        `Macro sum (protein + carbs + fat = ${macroSum.toFixed(2)}g) exceeds 100g for basis "${basis}".`,
        foodName,
      );
    }
  }

  // Rule: Stored calories must be within maxCalorieDiffFraction of 4/4/9 derived calories
  const derivedCalories = p * 4 + c * 4 + f * 9;
  if (derivedCalories === 0) {
    if (cal !== 0) {
      pushError(
        ctx.errors,
        index,
        'macros.calories',
        `Calories must be 0 when all macros are 0; got ${cal}.`,
        foodName,
      );
    }
  } else {
    const diff = Math.abs(cal - derivedCalories);
    const denom = Math.max(derivedCalories, cal);
    const fraction = diff / denom;
    if (fraction > ctx.maxCalorieDiffFraction) {
      pushError(
        ctx.errors,
        index,
        'macros.calories',
        `Stored calories (${cal}) differ from 4/4/9 derived calories (${derivedCalories.toFixed(1)}) by ${(fraction * 100).toFixed(1)}%, exceeding maximum allowed tolerance of ${(ctx.maxCalorieDiffFraction * 100).toFixed(0)}%.`,
        foodName,
      );
    }
  }
};

const validateServingsAndDefault = (
  entry: Record<string, unknown>,
  index: number,
  foodName: string | undefined,
  ctx: ValidationContext,
): void => {
  const { servings, defaultQuantity } = entry;

  if (servings !== undefined) {
    if (!Array.isArray(servings)) {
      pushError(ctx.errors, index, 'servings', 'Servings must be an array.', foodName);
    } else {
      if (ctx.requireServings && servings.length === 0) {
        pushError(ctx.errors, index, 'servings', 'Food entry must provide at least one serving.', foodName);
      }
      for (let sIdx = 0; sIdx < servings.length; sIdx += 1) {
        const s = servings[sIdx];
        if (!isPlainRecord(s)) {
          pushError(ctx.errors, index, `servings[${sIdx}]`, 'Serving must be an object with label and grams.', foodName);
          continue;
        }
        if (typeof s.label !== 'string' || s.label.trim().length === 0) {
          pushError(ctx.errors, index, `servings[${sIdx}].label`, 'Serving label must be a non-empty string.', foodName);
        }
        if (typeof s.grams !== 'number' || !Number.isFinite(s.grams) || s.grams <= 0) {
          pushError(
            ctx.errors,
            index,
            `servings[${sIdx}].grams`,
            `Serving grams must be a positive finite number; got ${JSON.stringify(s.grams)}.`,
            foodName,
          );
        }
      }
    }
  } else if (ctx.requireServings) {
    pushError(ctx.errors, index, 'servings', 'Food entry must provide at least one serving.', foodName);
  }

  if (defaultQuantity !== undefined) {
    if (typeof defaultQuantity !== 'number' || !Number.isFinite(defaultQuantity) || defaultQuantity <= 0) {
      pushError(
        ctx.errors,
        index,
        'defaultQuantity',
        `defaultQuantity must be a positive finite number; got ${JSON.stringify(defaultQuantity)}.`,
        foodName,
      );
    }
  }

  if (ctx.requireNotes && (typeof entry.notes !== 'string' || entry.notes.trim().length === 0)) {
    pushError(ctx.errors, index, 'notes', 'Notes must be a non-empty string.', foodName);
  }
};

export const validateFoodCatalog = (
  catalog: unknown,
  options: FoodCatalogValidationOptions = {},
): FoodCatalogValidationResult => {
  const errors: FoodCatalogValidationError[] = [];

  if (!Array.isArray(catalog)) {
    errors.push({
      index: -1,
      field: 'catalog',
      message: 'Catalog payload must be an array of food entries.',
    });
    return { valid: false, foodCount: 0, errors };
  }

  const ctx: ValidationContext = {
    validCategories: new Set(options.allowedCategories ?? DEFAULT_CATEGORY_SET),
    validBases: new Set(options.allowedBases ?? DEFAULT_BASIS_SET),
    maxCalorieDiffFraction: options.maxCalorieDifferenceFraction ?? DEFAULT_MAX_CALORIE_DIFF,
    requireServings: options.requireServings ?? true,
    requireNotes: options.requireNotes ?? false,
    ownerByTerm: new Map<string, TermOwner>(),
    errors,
  };

  for (let index = 0; index < catalog.length; index += 1) {
    const raw = catalog[index];
    if (!isPlainRecord(raw)) {
      pushError(errors, index, 'entry', 'Catalog entry must be an object.');
      continue;
    }

    const foodName = validateNameAndAliases(raw, index, ctx);
    const { basis } = validateCategoryAndBasis(raw, index, foodName, ctx);
    validateMacros(raw, index, foodName, basis, ctx);
    validateServingsAndDefault(raw, index, foodName, ctx);
  }

  return {
    valid: errors.length === 0,
    foodCount: catalog.length,
    errors,
  };
};
