const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');

const Exercise = require('./models/Exercise');
const CustomExercise = require('./models/CustomExercise');
const CompletedWorkout = require('./models/CompletedWorkout');
const {
  EQUIPMENT_TYPES,
  MUSCLE_IDS,
  normalizeExerciseName,
  resolveTargetsForExercise,
  sanitizeMuscleList,
  sanitizeMuscleTargets,
} = require('./constants/muscles');

const { EJSON } = mongoose.mongo.BSON;

const DEFAULT_CATALOG_PATH = path.resolve(__dirname, 'data/exerciseCatalog.json');
const DEFAULT_BACKUP_DIR = path.resolve(__dirname, 'backups');
const MUSCLE_ID_SET = new Set(MUSCLE_IDS);
const EQUIPMENT_TYPE_SET = new Set(EQUIPMENT_TYPES);

const arraysEqual = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const sanitizeAliases = (aliases) => {
  if (!Array.isArray(aliases)) return [];
  const seen = new Set();
  const result = [];
  for (const alias of aliases) {
    if (typeof alias !== 'string') continue;
    const trimmed = alias.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

const hasAnyTargets = ({ primaryMuscles, secondaryMuscles, stabilizerMuscles }) =>
  primaryMuscles.length > 0 || secondaryMuscles.length > 0 || stabilizerMuscles.length > 0;

const extractExplicitTargets = (primaryMuscles, secondaryMuscles, stabilizerMuscles) => {
  const targets = sanitizeMuscleTargets({
    primaryMuscles,
    secondaryMuscles,
    stabilizerMuscles,
  });
  return hasAnyTargets(targets) ? targets : null;
};

/**
 * Parses CLI flags for `seedExercises.js` (`--dry-run`, `--db <name>`, `--rollback <path>`, `--help`).
 */
const parseCliArgs = (argv = []) => {
  const options = {
    dryRun: false,
    dbName: undefined,
    rollbackPath: undefined,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--db') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--db requires a database name');
      }
      options.dbName = value.trim();
      i += 1;
    } else if (arg.startsWith('--db=')) {
      const value = arg.slice('--db='.length).trim();
      if (!value) {
        throw new Error('--db requires a database name');
      }
      options.dbName = value;
    } else if (arg === '--rollback') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--rollback requires a backup file path');
      }
      options.rollbackPath = value.trim();
      i += 1;
    } else if (arg.startsWith('--rollback=')) {
      const value = arg.slice('--rollback='.length).trim();
      if (!value) {
        throw new Error('--rollback requires a backup file path');
      }
      options.rollbackPath = value;
    } else {
      throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }

  if (options.dryRun && options.rollbackPath) {
    throw new Error('Cannot combine --dry-run with --rollback');
  }

  return options;
};

const validateMuscleField = (list, fieldName, label, errors) => {
  if (!Array.isArray(list)) {
    errors.push(`${label}: "${fieldName}" must be an array`);
    return [];
  }

  const seen = new Set();
  for (const item of list) {
    if (typeof item !== 'string' || !MUSCLE_ID_SET.has(item)) {
      errors.push(`${label}: invalid muscle ID "${String(item)}" in ${fieldName}`);
      continue;
    }
    if (seen.has(item)) {
      errors.push(`${label}: duplicate muscle ID "${item}" in ${fieldName}`);
    }
    seen.add(item);
  }
  return list;
};

/**
 * Validates the exercise catalog strictly before connecting to MongoDB: checks unique canonical
 * names, valid equipment/muscle enums, and zero duplicate or overlapping IDs across target tiers.
 */
const validateCatalog = (catalogData) => {
  if (!Array.isArray(catalogData) || catalogData.length === 0) {
    throw new Error('Catalog validation failed: catalog must be a non-empty array');
  }

  const errors = [];
  const seenNames = new Map();

  catalogData.forEach((item, index) => {
    const label =
      item && typeof item.name === 'string' && item.name.trim()
        ? `"${item.name.trim()}" (index ${index})`
        : `entry at index ${index}`;

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${label}: entry must be an object`);
      return;
    }

    if (typeof item.name !== 'string' || !item.name.trim()) {
      errors.push(`${label}: "name" must be a non-empty string`);
    } else {
      const normalized = normalizeExerciseName(item.name);
      if (!normalized) {
        errors.push(`${label}: "name" produces an empty normalizedName`);
      } else if (seenNames.has(normalized)) {
        errors.push(
          `${label}: duplicate normalized exercise name "${normalized}" (already defined by ${seenNames.get(normalized)})`
        );
      } else {
        seenNames.set(normalized, label);
      }
    }

    if (typeof item.muscleGroup !== 'string' || !item.muscleGroup.trim()) {
      errors.push(`${label}: "muscleGroup" must be a non-empty string`);
    }

    if (!EQUIPMENT_TYPE_SET.has(item.equipmentType)) {
      errors.push(
        `${label}: invalid equipmentType "${String(item.equipmentType)}". Expected one of: ${EQUIPMENT_TYPES.join(', ')}`
      );
    }

    if (item.aliases !== undefined) {
      if (!Array.isArray(item.aliases)) {
        errors.push(`${label}: "aliases" must be an array when provided`);
      } else {
        for (const alias of item.aliases) {
          if (typeof alias !== 'string' || !alias.trim()) {
            errors.push(`${label}: aliases must contain only non-empty strings`);
            break;
          }
        }
      }
    }

    if (item.notes !== undefined && typeof item.notes !== 'string') {
      errors.push(`${label}: "notes" must be a string when provided`);
    }

    const primary = validateMuscleField(item.primaryMuscles, 'primaryMuscles', label, errors);
    const secondary = validateMuscleField(
      item.secondaryMuscles ?? [],
      'secondaryMuscles',
      label,
      errors
    );
    const stabilizer = validateMuscleField(
      item.stabilizerMuscles ?? [],
      'stabilizerMuscles',
      label,
      errors
    );

    const primarySet = new Set(primary);
    const secondarySet = new Set(secondary);

    for (const id of secondary) {
      if (primarySet.has(id)) {
        errors.push(`${label}: overlapping muscle ID "${id}" in primaryMuscles and secondaryMuscles`);
      }
    }
    for (const id of stabilizer) {
      if (primarySet.has(id)) {
        errors.push(`${label}: overlapping muscle ID "${id}" in primaryMuscles and stabilizerMuscles`);
      }
      if (secondarySet.has(id)) {
        errors.push(
          `${label}: overlapping muscle ID "${id}" in secondaryMuscles and stabilizerMuscles`
        );
      }
    }
  });

  if (errors.length > 0) {
    throw new Error(`Catalog validation failed (${errors.length} issue(s)):\n- ${errors.join('\n- ')}`);
  }

  return {
    valid: true,
    entryCount: catalogData.length,
  };
};

const buildCatalogDocument = (item) => {
  const normalizedName = normalizeExerciseName(item.name);
  const { primaryMuscles, secondaryMuscles, stabilizerMuscles } = sanitizeMuscleTargets({
    primaryMuscles: item.primaryMuscles,
    secondaryMuscles: item.secondaryMuscles,
    stabilizerMuscles: item.stabilizerMuscles,
  });

  return {
    name: item.name.trim(),
    normalizedName,
    aliases: sanitizeAliases(item.aliases),
    muscleGroup: item.muscleGroup.trim(),
    equipmentType: EQUIPMENT_TYPES.includes(item.equipmentType)
      ? item.equipmentType
      : 'barbell',
    primaryMuscles,
    secondaryMuscles,
    stabilizerMuscles,
    notes: typeof item.notes === 'string' ? item.notes : '',
  };
};

const getChangedExerciseFields = (existing, desired) => {
  const changed = [];
  if (existing.name !== desired.name) changed.push('name');
  if (!arraysEqual(existing.aliases, desired.aliases)) changed.push('aliases');
  if (existing.muscleGroup !== desired.muscleGroup) changed.push('muscleGroup');
  if (existing.equipmentType !== desired.equipmentType) changed.push('equipmentType');
  if (!arraysEqual(existing.primaryMuscles, desired.primaryMuscles)) changed.push('primaryMuscles');
  if (!arraysEqual(existing.secondaryMuscles, desired.secondaryMuscles)) {
    changed.push('secondaryMuscles');
  }
  if (
    !Array.isArray(existing.stabilizerMuscles) ||
    !arraysEqual(existing.stabilizerMuscles, desired.stabilizerMuscles)
  ) {
    changed.push('stabilizerMuscles');
  }
  if ((existing.notes ?? '') !== desired.notes) changed.push('notes');
  return changed;
};

/**
 * Computes exact planned Exercise upsert/update operations without modifying MongoDB.
 */
const planExerciseUpdates = (catalogData, existingExercises) => {
  const existingByNorm = new Map(
    existingExercises.map((doc) => [doc.normalizedName || normalizeExerciseName(doc.name), doc])
  );

  const inserts = [];
  const updates = [];
  const ops = [];
  const effectiveByNorm = new Map();

  for (const doc of existingExercises) {
    const norm = doc.normalizedName || normalizeExerciseName(doc.name);
    effectiveByNorm.set(norm, {
      ...doc,
      ...sanitizeMuscleTargets(doc),
    });
  }

  for (const item of catalogData) {
    const desired = buildCatalogDocument(item);
    const existing = existingByNorm.get(desired.normalizedName);

    if (!existing) {
      inserts.push({ name: desired.name, normalizedName: desired.normalizedName });
      ops.push({
        updateOne: {
          filter: { normalizedName: desired.normalizedName },
          update: { $set: desired },
          upsert: true,
        },
      });
    } else {
      const changedFields = getChangedExerciseFields(existing, desired);
      if (changedFields.length > 0) {
        updates.push({
          name: desired.name,
          normalizedName: desired.normalizedName,
          changedFields,
        });
        ops.push({
          updateOne: {
            filter: { normalizedName: desired.normalizedName },
            update: { $set: desired },
            upsert: true,
          },
        });
      }
    }

    effectiveByNorm.set(desired.normalizedName, desired);
  }

  return {
    catalogCount: catalogData.length,
    inserts,
    updates,
    unchangedCount: catalogData.length - inserts.length - updates.length,
    ops,
    effectiveExercises: Array.from(effectiveByNorm.values()),
  };
};

const resolveStoredTargetsWithBackfill = (
  { name, category, primaryMuscles, secondaryMuscles, stabilizerMuscles },
  catalog
) => {
  const explicit = extractExplicitTargets(primaryMuscles, secondaryMuscles, stabilizerMuscles);
  if (!explicit) {
    return resolveTargetsForExercise({ name, category }, catalog);
  }

  if (explicit.stabilizerMuscles.length === 0) {
    const resolved = resolveTargetsForExercise({ name, category }, catalog);
    const relocatedStabilizers = sanitizeMuscleList(
      resolved.stabilizerMuscles,
      new Set(explicit.primaryMuscles)
    );
    const stabilizerSet = new Set(relocatedStabilizers);
    const nextSecondary = explicit.secondaryMuscles.filter(
      (muscleId) => !stabilizerSet.has(muscleId)
    );
    return {
      primaryMuscles: explicit.primaryMuscles,
      secondaryMuscles: nextSecondary,
      stabilizerMuscles: relocatedStabilizers,
    };
  }

  return explicit;
};

/**
 * Computes exact planned CustomExercise enrichment operations without modifying MongoDB.
 */
const planCustomExerciseUpdates = (rawCustomDocs, catalog) => {
  const customCatalogByUser = new Map();
  const docPlans = [];
  let itemsToEnrich = 0;

  for (const doc of rawCustomDocs) {
    const userId = doc.userId || 'default_user';
    const itemChanges = [];
    const nextExercises = [];

    for (let i = 0; i < (doc.exercises || []).length; i += 1) {
      const entry = doc.exercises[i];

      if (typeof entry === 'string') {
        const resolved = resolveTargetsForExercise({ name: entry, category: doc.category }, catalog);
        nextExercises.push({
          name: entry,
          equipmentType: 'barbell',
          primaryMuscles: resolved.primaryMuscles,
          secondaryMuscles: resolved.secondaryMuscles,
          stabilizerMuscles: resolved.stabilizerMuscles,
        });
        itemChanges.push({ index: i, name: entry, action: 'convert_legacy_string' });
        itemsToEnrich += 1;

        if (hasAnyTargets(resolved)) {
          if (!customCatalogByUser.has(userId)) customCatalogByUser.set(userId, []);
          customCatalogByUser.get(userId).push({
            name: entry,
            muscleGroup: doc.category,
            ...resolved,
          });
        }
        continue;
      }

      if (!entry || typeof entry !== 'object') {
        nextExercises.push(entry);
        continue;
      }

      const resolved = resolveStoredTargetsWithBackfill(
        {
          name: entry.name,
          category: doc.category,
          primaryMuscles: entry.primaryMuscles,
          secondaryMuscles: entry.secondaryMuscles,
          stabilizerMuscles: entry.stabilizerMuscles,
        },
        catalog
      );

      const hasRawArrays =
        Array.isArray(entry.primaryMuscles) &&
        Array.isArray(entry.secondaryMuscles) &&
        Array.isArray(entry.stabilizerMuscles);

      const matchesStored =
        hasRawArrays &&
        arraysEqual(entry.primaryMuscles, resolved.primaryMuscles) &&
        arraysEqual(entry.secondaryMuscles, resolved.secondaryMuscles) &&
        arraysEqual(entry.stabilizerMuscles, resolved.stabilizerMuscles);

      if (!matchesStored) {
        itemChanges.push({ index: i, name: entry.name, action: 'enrich_targets' });
        itemsToEnrich += 1;
      }

      nextExercises.push({
        ...entry,
        equipmentType: EQUIPMENT_TYPE_SET.has(entry.equipmentType) ? entry.equipmentType : 'barbell',
        primaryMuscles: resolved.primaryMuscles,
        secondaryMuscles: resolved.secondaryMuscles,
        stabilizerMuscles: resolved.stabilizerMuscles,
      });

      if (hasAnyTargets(resolved)) {
        if (!customCatalogByUser.has(userId)) customCatalogByUser.set(userId, []);
        customCatalogByUser.get(userId).push({
          name: entry.name,
          muscleGroup: doc.category,
          ...resolved,
        });
      }
    }

    if (itemChanges.length > 0) {
      docPlans.push({
        _id: doc._id,
        userId,
        category: doc.category,
        itemChanges,
        nextExercises,
      });
    }
  }

  return {
    totalDocs: rawCustomDocs.length,
    docsToUpdate: docPlans.length,
    itemsToEnrich,
    docPlans,
    customCatalogByUser,
  };
};

const targetsNeedUpdate = (rawContainer, resolved) =>
  !Array.isArray(rawContainer.primaryMuscles) ||
  !arraysEqual(rawContainer.primaryMuscles, resolved.primaryMuscles) ||
  !Array.isArray(rawContainer.secondaryMuscles) ||
  !arraysEqual(rawContainer.secondaryMuscles, resolved.secondaryMuscles) ||
  !Array.isArray(rawContainer.stabilizerMuscles) ||
  !arraysEqual(rawContainer.stabilizerMuscles, resolved.stabilizerMuscles);

/**
 * Computes exact planned CompletedWorkout enrichment operations (leaving `workoutData.sets` intact)
 * without modifying MongoDB.
 */
const planCompletedWorkoutUpdates = (rawWorkouts, dbExercises, customCatalogByUser) => {
  const ops = [];
  const workoutPlans = [];

  for (const workout of rawWorkouts) {
    const userCustom = customCatalogByUser.get(workout.userId || 'default_user') || [];
    const lookupCatalog = [...dbExercises, ...userCustom];
    const hasWorkoutData = Boolean(workout.workoutData && typeof workout.workoutData === 'object');

    const topExplicit = extractExplicitTargets(
      workout.primaryMuscles,
      workout.secondaryMuscles,
      workout.stabilizerMuscles
    );
    const wdExplicit = hasWorkoutData
      ? extractExplicitTargets(
          workout.workoutData.primaryMuscles,
          workout.workoutData.secondaryMuscles,
          workout.workoutData.stabilizerMuscles
        )
      : null;

    const topTargets = topExplicit
      ? resolveStoredTargetsWithBackfill(
          {
            name: workout.name,
            category: workout.category,
            ...topExplicit,
          },
          lookupCatalog
        )
      : wdExplicit
        ? resolveStoredTargetsWithBackfill(
            {
              name: workout.name,
              category: workout.category,
              ...wdExplicit,
            },
            lookupCatalog
          )
        : resolveTargetsForExercise(
            { name: workout.name, category: workout.category },
            lookupCatalog
          );

    const setFields = {};
    if (targetsNeedUpdate(workout, topTargets)) {
      setFields.primaryMuscles = topTargets.primaryMuscles;
      setFields.secondaryMuscles = topTargets.secondaryMuscles;
      setFields.stabilizerMuscles = topTargets.stabilizerMuscles;
    }

    if (hasWorkoutData) {
      const wdName = workout.workoutData.name ?? workout.name;
      const wdCategory = workout.workoutData.category ?? workout.category;

      const wdTargets = wdExplicit
        ? resolveStoredTargetsWithBackfill(
            {
              name: wdName,
              category: wdCategory,
              ...wdExplicit,
            },
            lookupCatalog
          )
        : topExplicit
          ? topTargets
          : resolveTargetsForExercise({ name: wdName, category: wdCategory }, lookupCatalog);

      if (targetsNeedUpdate(workout.workoutData, wdTargets)) {
        setFields['workoutData.primaryMuscles'] = wdTargets.primaryMuscles;
        setFields['workoutData.secondaryMuscles'] = wdTargets.secondaryMuscles;
        setFields['workoutData.stabilizerMuscles'] = wdTargets.stabilizerMuscles;
      }
    }

    const updatedFields = Object.keys(setFields);
    if (updatedFields.length > 0) {
      ops.push({
        updateOne: {
          filter: { _id: workout._id },
          update: { $set: setFields },
        },
      });
      workoutPlans.push({
        id: workout.id || String(workout._id),
        name: workout.name,
        updatedFields,
      });
    }
  }

  return {
    totalWorkouts: rawWorkouts.length,
    docsToUpdate: ops.length,
    ops,
    workoutPlans,
  };
};

const connectToDatabase = async ({ dbName, readOnly = false } = {}) => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is missing');
  }

  const connectOptions = {};
  if (dbName) connectOptions.dbName = dbName;
  if (readOnly) connectOptions.readPreference = 'primary';

  await mongoose.connect(process.env.MONGO_URI, connectOptions);
  console.log(
    `Connected to MongoDB (db: ${mongoose.connection.name}${readOnly ? ', mode: read-only' : ''})`
  );
};

const readDatabaseSnapshots = async () => {
  const [exercises, customexercises, completedworkouts] = await Promise.all([
    Exercise.collection.find({}).toArray(),
    CustomExercise.collection.find({}).toArray(),
    CompletedWorkout.collection.find({}).toArray(),
  ]);

  return {
    exercises,
    customexercises,
    completedworkouts,
  };
};

const writeBackupFile = (backupDir, payload) => {
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(backupDir, `migration-${timestamp}.json`);
  fs.writeFileSync(backupPath, EJSON.stringify(payload, null, 2), 'utf8');
  return backupPath;
};

const persistBackupManifestUpdate = (backupPath, payload) => {
  fs.writeFileSync(backupPath, EJSON.stringify(payload, null, 2), 'utf8');
};

const executeCustomExerciseUpdates = async (docPlans) => {
  let updatedDocs = 0;

  for (const plan of docPlans) {
    const doc = await CustomExercise.findById(plan._id);
    if (!doc) continue;

    doc.exercises = plan.nextExercises;
    doc.markModified('exercises');
    await doc.save();
    updatedDocs += 1;
  }

  return updatedDocs;
};

const printDryRunPlan = ({ validation, exercisePlan, customPlan, workoutPlan }) => {
  console.log(`[dry-run] Catalog validated: ${validation.entryCount} entries.`);
  console.log(
    `[dry-run] exercises planned: inserts=${exercisePlan.inserts.length}, updates=${exercisePlan.updates.length}, unchanged=${exercisePlan.unchangedCount}`
  );
  if (exercisePlan.inserts.length > 0) {
    console.log(
      `[dry-run]   insert names: ${exercisePlan.inserts.map((x) => x.name).join(', ')}`
    );
  }
  if (exercisePlan.updates.length > 0) {
    console.log(
      `[dry-run]   update names: ${exercisePlan.updates
        .map((x) => `${x.name} (${x.changedFields.join(',')})`)
        .join(', ')}`
    );
  }

  console.log(
    `[dry-run] customexercises planned: totalDocs=${customPlan.totalDocs}, docsToUpdate=${customPlan.docsToUpdate}, itemsToEnrich=${customPlan.itemsToEnrich}`
  );
  for (const docPlan of customPlan.docPlans) {
    console.log(
      `[dry-run]   category="${docPlan.category}" userId="${docPlan.userId}": ${docPlan.itemChanges
        .map((c) => `${c.name} (${c.action})`)
        .join(', ')}`
    );
  }

  console.log(
    `[dry-run] completedworkouts planned: totalWorkouts=${workoutPlan.totalWorkouts}, docsToUpdate=${workoutPlan.docsToUpdate}`
  );
  for (const wp of workoutPlan.workoutPlans) {
    console.log(`[dry-run]   workout="${wp.name}" (${wp.id}): $set ${wp.updatedFields.join(', ')}`);
  }

  console.log('[dry-run] Read-only check complete. 0 documents modified.');
};

/**
 * Restores `exercises`, `customexercises`, and `completedworkouts` from a JSON backup snapshot
 * created by `seedExercises`, verifying that restored document counts match the snapshot.
 */
const rollbackFromBackup = async ({ rollbackPath, dbName } = {}) => {
  if (!rollbackPath || typeof rollbackPath !== 'string') {
    throw new Error('Backup file path is required for rollback');
  }

  const resolvedPath = path.resolve(rollbackPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Backup file not found: ${resolvedPath}`);
  }

  const rawText = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = EJSON.parse(rawText);
  const snapshots = parsed && parsed.snapshots;

  if (
    !snapshots ||
    !Array.isArray(snapshots.exercises) ||
    !Array.isArray(snapshots.customexercises) ||
    !Array.isArray(snapshots.completedworkouts)
  ) {
    throw new Error(`Invalid backup snapshot format in ${resolvedPath}`);
  }

  const targetDbName = dbName || parsed.manifest?.dbName || undefined;
  await connectToDatabase({ dbName: targetDbName });

  try {
    const collections = [
      { name: 'exercises', model: Exercise, docs: snapshots.exercises },
      { name: 'customexercises', model: CustomExercise, docs: snapshots.customexercises },
      { name: 'completedworkouts', model: CompletedWorkout, docs: snapshots.completedworkouts },
    ];

    const restoredCounts = {};

    for (const { name, model, docs } of collections) {
      await model.collection.deleteMany({});
      if (docs.length > 0) {
        await model.collection.insertMany(docs, { ordered: true });
      }
      const actualCount = await model.collection.countDocuments();
      if (actualCount !== docs.length) {
        throw new Error(
          `Rollback verification failed for "${name}": expected ${docs.length} documents, got ${actualCount}`
        );
      }
      restoredCounts[name] = actualCount;
    }

    console.log(
      `Rollback complete on db "${mongoose.connection.name}": exercises=${restoredCounts.exercises}, customexercises=${restoredCounts.customexercises}, completedworkouts=${restoredCounts.completedworkouts}`
    );

    return {
      mode: 'rollback',
      dbName: mongoose.connection.name,
      backupPath: resolvedPath,
      restoredCounts,
      verified: true,
    };
  } finally {
    await mongoose.disconnect();
  }
};

/**
 * Runs catalog validation, optional read-only `--dry-run`, live migration with full pre-migration
 * snapshot backup, or `--rollback` restore across `exercises`, `customexercises`, and `completedworkouts`.
 */
const seedExercises = async (options = {}) => {
  const {
    dryRun = false,
    dbName,
    rollbackPath,
    catalogPath = DEFAULT_CATALOG_PATH,
    backupDir = DEFAULT_BACKUP_DIR,
  } = options;

  if (dryRun && rollbackPath) {
    throw new Error('Cannot combine --dry-run with --rollback');
  }

  if (rollbackPath) {
    return rollbackFromBackup({ rollbackPath, dbName });
  }

  const resolvedCatalogPath = path.resolve(catalogPath);
  const catalogData = JSON.parse(fs.readFileSync(resolvedCatalogPath, 'utf8'));
  const validation = validateCatalog(catalogData);

  await connectToDatabase({ dbName, readOnly: dryRun });

  try {
    const snapshots = await readDatabaseSnapshots();
    const exercisePlan = planExerciseUpdates(catalogData, snapshots.exercises);

    if (dryRun) {
      const customPlan = planCustomExerciseUpdates(
        snapshots.customexercises,
        exercisePlan.effectiveExercises
      );
      const workoutPlan = planCompletedWorkoutUpdates(
        snapshots.completedworkouts,
        exercisePlan.effectiveExercises,
        customPlan.customCatalogByUser
      );

      printDryRunPlan({ validation, exercisePlan, customPlan, workoutPlan });

      return {
        mode: 'dry-run',
        dbName: mongoose.connection.name,
        validation,
        plan: {
          exercises: {
            catalogCount: exercisePlan.catalogCount,
            inserts: exercisePlan.inserts,
            updates: exercisePlan.updates,
            unchangedCount: exercisePlan.unchangedCount,
          },
          customexercises: {
            totalDocs: customPlan.totalDocs,
            docsToUpdate: customPlan.docsToUpdate,
            itemsToEnrich: customPlan.itemsToEnrich,
            docPlans: customPlan.docPlans.map(({ _id, userId, category, itemChanges }) => ({
              _id,
              userId,
              category,
              itemChanges,
            })),
          },
          completedworkouts: {
            totalWorkouts: workoutPlan.totalWorkouts,
            docsToUpdate: workoutPlan.docsToUpdate,
            workoutPlans: workoutPlan.workoutPlans,
          },
        },
      };
    }

    const backupPayload = {
      manifest: {
        version: 2,
        status: 'backup_created',
        createdAt: new Date().toISOString(),
        completedAt: null,
        dbName: mongoose.connection.name,
        catalogCount: catalogData.length,
        snapshotCounts: {
          exercises: snapshots.exercises.length,
          customexercises: snapshots.customexercises.length,
          completedworkouts: snapshots.completedworkouts.length,
        },
        migrationSummary: null,
      },
      snapshots,
    };

    const backupPath = writeBackupFile(backupDir, backupPayload);
    console.log(`Pre-migration backup written: ${backupPath}`);

    const exerciseBulkResult =
      exercisePlan.ops.length > 0
        ? await Exercise.bulkWrite(exercisePlan.ops, { ordered: false })
        : null;
    const dbExercises = await Exercise.find({}).lean();

    const exerciseSummary = {
      catalogCount: catalogData.length,
      totalDbExercises: dbExercises.length,
      plannedInserts: exercisePlan.inserts.length,
      plannedUpdates: exercisePlan.updates.length,
      upsertedCount: exerciseBulkResult ? exerciseBulkResult.upsertedCount : 0,
      modifiedCount: exerciseBulkResult ? exerciseBulkResult.modifiedCount : 0,
      matchedCount: exerciseBulkResult ? exerciseBulkResult.matchedCount : 0,
    };
    console.log(
      `Exercises seeded: total=${exerciseSummary.totalDbExercises}, upserted=${exerciseSummary.upsertedCount}, modified=${exerciseSummary.modifiedCount}, matched=${exerciseSummary.matchedCount}`
    );

    const customPlan = planCustomExerciseUpdates(snapshots.customexercises, dbExercises);
    const updatedCustomDocs = await executeCustomExerciseUpdates(customPlan.docPlans);

    const customSummary = {
      totalDocs: customPlan.totalDocs,
      updatedDocs: updatedCustomDocs,
      updatedItems: customPlan.itemsToEnrich,
    };
    console.log(
      `CustomExercises enriched: totalDocs=${customSummary.totalDocs}, updatedDocs=${customSummary.updatedDocs}, updatedItems=${customSummary.updatedItems}`
    );

    const workoutPlan = planCompletedWorkoutUpdates(
      snapshots.completedworkouts,
      dbExercises,
      customPlan.customCatalogByUser
    );
    const workoutBulkResult =
      workoutPlan.ops.length > 0
        ? await CompletedWorkout.bulkWrite(workoutPlan.ops, { ordered: false })
        : null;

    const workoutSummary = {
      totalWorkouts: workoutPlan.totalWorkouts,
      queuedUpdates: workoutPlan.ops.length,
      updatedWorkouts: workoutBulkResult ? workoutBulkResult.modifiedCount : 0,
    };
    console.log(
      `CompletedWorkouts enriched: totalWorkouts=${workoutSummary.totalWorkouts}, updatedWorkouts=${workoutSummary.updatedWorkouts}`
    );

    backupPayload.manifest.status = 'completed';
    backupPayload.manifest.completedAt = new Date().toISOString();
    backupPayload.manifest.migrationSummary = {
      exercises: exerciseSummary,
      customexercises: customSummary,
      completedworkouts: workoutSummary,
    };
    persistBackupManifestUpdate(backupPath, backupPayload);

    return {
      mode: 'migrate',
      dbName: mongoose.connection.name,
      backupPath,
      validation,
      exerciseSummary,
      customSummary,
      workoutSummary,
    };
  } finally {
    await mongoose.disconnect();
  }
};

const printUsage = () => {
  console.log(
    [
      'Usage: node seedExercises.js [options]',
      '',
      'Options:',
      '  --dry-run                  Validate catalog and print planned operations (read-only)',
      '  --db <dbName>              Override target database name on MONGO_URI',
      '  --rollback <backupPath>    Restore pre-migration collections from a JSON backup snapshot',
      '  -h, --help                 Show this help message',
    ].join('\n')
  );
};

if (require.main === module) {
  let cliOptions;
  try {
    cliOptions = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Invalid CLI arguments: ${err.message}`);
    process.exit(1);
  }

  if (cliOptions.help) {
    printUsage();
    process.exit(0);
  }

  seedExercises(cliOptions)
    .then(() => {
      console.log('Exercise migration command complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Exercise migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = {
  seedExercises,
  rollbackFromBackup,
  validateCatalog,
  parseCliArgs,
  planExerciseUpdates,
  planCustomExerciseUpdates,
  planCompletedWorkoutUpdates,
};
