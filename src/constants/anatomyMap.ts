import type { MuscleId } from './muscles';

/** Metadata stored in glTF node `extras` (`THREE.Object3D.userData`) in `assets/models/body.glb`. */
export interface AnatomyNodeUserData {
  kind?: 'muscle' | 'other' | 'bone';
  label?: string;
  side?: 'l' | 'r' | null;
  group?: string;
}

/**
 * Roll-up table mapping the ~155 unique Z-Anatomy / free-muscles muscle labels inside
 * `assets/models/body.glb` onto FitFreak's 31 trackable `MuscleId`s.
 * Deep anatomical muscles covered by superficial ones map to the overlying muscle group.
 */
export const ANATOMY_LABEL_TO_MUSCLE_ID: Record<string, MuscleId> = {
  // Chest
  'Clavicular head of pectoralis major muscle': 'pectoralis_upper',
  'Sternocostal head of pectoralis major muscle': 'pectoralis_lower',
  'Abdominal part of pectoralis major muscle': 'pectoralis_lower',
  'Pectoralis minor muscle': 'pectoralis_lower',
  'Subclavius muscle': 'pectoralis_upper',
  'Serratus anterior muscle': 'serratus_anterior',

  // Shoulders
  'Clavicular part of deltoid muscle': 'deltoid_anterior',
  'Acromial part of deltoid muscle': 'deltoid_lateral',
  'Scapular spinal part of deltoid muscle': 'deltoid_posterior',
  'Infraspinatus muscle': 'infraspinatus',
  'Supraspinatus muscle': 'infraspinatus',
  'Teres minor muscle': 'infraspinatus',
  'Subscapularis muscle': 'infraspinatus',

  // Biceps
  'Long head of biceps brachii': 'biceps_brachii',
  'Short head of biceps brachii': 'biceps_brachii',
  'Coracobrachialis muscle': 'biceps_brachii',
  'Brachialis muscle': 'brachialis',

  // Triceps
  'Long head of triceps brachii': 'triceps_brachii',
  'Lateral head of triceps brachii': 'triceps_brachii',
  'Medial head of triceps brachii': 'triceps_brachii',
  'Anconeus muscle': 'triceps_brachii',

  // Forearms & hand flexors/extensors
  'Brachioradialis muscle': 'brachioradialis',
  'Flexor carpi radialis': 'forearm_flexors',
  'Humeral head of flexor carpi ulnaris': 'forearm_flexors',
  'Ulnar head of flexor carpi ulnaris': 'forearm_flexors',
  'Palmaris longus muscle': 'forearm_flexors',
  'Deep head of pronator teres': 'forearm_flexors',
  'Superficial head of pronator teres': 'forearm_flexors',
  'Pronator quadratus': 'forearm_flexors',
  'Humero-ulnar head of flexor digitorum superficialis': 'forearm_flexors',
  'Radial head of flexor digitorum superficialis': 'forearm_flexors',
  'Flexor digitorum profundus': 'forearm_flexors',
  'Flexor pollicis longus': 'forearm_flexors',
  'Abductor digiti minimi of hand': 'forearm_flexors',
  'Abductor pollicis brevis': 'forearm_flexors',
  'Deep head of flexor pollicis brevis': 'forearm_flexors',
  'Superficial head of flexor pollicis brevis': 'forearm_flexors',
  'Flexor digiti minimi of hand': 'forearm_flexors',
  'Oblique head of adductor pollicis': 'forearm_flexors',
  'Transverse head of adductor pollicis': 'forearm_flexors',
  'Opponens digiti minimi muscle of hand': 'forearm_flexors',
  'Opponens pollicis muscle': 'forearm_flexors',
  'Lumbrical muscles of hand': 'forearm_flexors',
  'Palmar interossei muscles': 'forearm_flexors',
  'Extensor carpi radialis brevis': 'forearm_extensors',
  'Extensor carpi radialis longus': 'forearm_extensors',
  'Humeral head of extensor carpi ulnaris': 'forearm_extensors',
  'Ulnar head of extensor carpi ulnaris': 'forearm_extensors',
  'Extensor digitorum': 'forearm_extensors',
  'Extensor digiti minimi': 'forearm_extensors',
  'Extensor indicis': 'forearm_extensors',
  'Extensor pollicis brevis': 'forearm_extensors',
  'Extensor pollicis longus': 'forearm_extensors',
  'Abductor pollicis longus': 'forearm_extensors',
  Supinator: 'forearm_extensors',
  'Dorsal interossei muscles of hand': 'forearm_extensors',

  // Traps, lats & back
  'Descending part of trapezius muscle': 'trapezius_upper',
  'Levator scapulae': 'trapezius_upper',
  'Transverse part of trapezius muscle': 'trapezius_middle',
  'Rhomboid major muscle': 'trapezius_middle',
  'Rhomboid minor muscle': 'trapezius_middle',
  'Serratus posterior superior muscle': 'trapezius_middle',
  'Ascending part of trapezius muscle': 'trapezius_lower',
  'Latissimus dorsi muscle': 'latissimus_dorsi',
  'Teres major muscle': 'teres_major',
  'Iliocostalis lumborum muscle': 'erector_spinae',
  'Iliocostalis thoracis muscle': 'erector_spinae',
  'Longissimus thoracis muscle': 'erector_spinae',
  'Spinalis thoracis muscle': 'erector_spinae',
  'Multifidus lumborum muscle': 'erector_spinae',
  'Multifidus thoracis muscle': 'erector_spinae',
  'Semispinalis thoracis muscle': 'erector_spinae',
  'Quadratus lumborum muscle': 'erector_spinae',
  'Serratus posterior inferior muscle': 'erector_spinae',
  Rotatores: 'erector_spinae',
  'Interspinales lumborum muscles': 'erector_spinae',
  'Interspinales thoracis muscles': 'erector_spinae',
  'Dorsal parts of lateral intertransversarii lumborum muscles': 'erector_spinae',
  'Ventral parts of lateral intertransversarii lumborum muscles': 'erector_spinae',

  // Abs & obliques
  'Rectus abdominis muscle': 'rectus_abdominis',
  'Pyramidalis muscle': 'rectus_abdominis',
  'Linea alba': 'rectus_abdominis',
  'External abdominal oblique muscle': 'obliques',
  'Internal abdominal oblique muscle': 'obliques',
  'Transversus abdominis muscle': 'obliques',

  // Neck (anterior vs posterior extensors)
  'Sternocleidomastoid muscle': 'sternocleidomastoid',
  Platysma: 'sternocleidomastoid',
  'Anterior belly of digastric muscle': 'sternocleidomastoid',
  'Posterior belly of digastric muscle': 'sternocleidomastoid',
  'Intermediate tendon of digastric muscle': 'sternocleidomastoid',
  'Geniohyoid muscle': 'sternocleidomastoid',
  'Mylohyoid muscle': 'sternocleidomastoid',
  'Omohyoid muscle': 'sternocleidomastoid',
  'Sternohyoid muscle': 'sternocleidomastoid',
  'Sternothyroid muscle': 'sternocleidomastoid',
  'Stylohyoid muscle': 'sternocleidomastoid',
  'Thyrohyoid muscle': 'sternocleidomastoid',
  'Scalenus anterior muscle': 'sternocleidomastoid',
  'Scalenus medius muscle': 'sternocleidomastoid',
  'Longus capitis muscle': 'sternocleidomastoid',
  'Longus colli muscle': 'sternocleidomastoid',
  'Rectus anterior capitis muscle': 'sternocleidomastoid',
  'Rectus lateralis capitis muscle': 'sternocleidomastoid',
  'Scalenus posterior muscle': 'neck_extensors',
  'Splenius capitis muscle': 'neck_extensors',
  'Splenius colli muscle': 'neck_extensors',
  'Semispinalis colli muscle': 'neck_extensors',
  'Longissimus capitis muscle': 'neck_extensors',
  'Longissimus colli muscle': 'neck_extensors',
  'Iliocostalis colli muscle': 'neck_extensors',
  'Spinalis capitis muscle': 'neck_extensors',
  'Spinalis colli muscle': 'neck_extensors',
  'Multifidus colli muscle': 'neck_extensors',
  'Interspinales colli muscles': 'neck_extensors',
  'Obliquus inferior capitis muscle': 'neck_extensors',
  'Obliquus superior capitis muscle': 'neck_extensors',
  'Rectus posterior major capitis muscle': 'neck_extensors',
  'Rectus posterior minor capitis muscle': 'neck_extensors',

  // Glutes & abductors
  'Gluteus maximus muscle': 'gluteus_maximus',
  'Piriformis muscle': 'gluteus_maximus',
  'Superior gemellus muscle': 'gluteus_maximus',
  'Inferior gemellus muscle': 'gluteus_maximus',
  'Obturator internus': 'gluteus_maximus',
  'Quadratus femoris muscle': 'gluteus_maximus',
  'Gluteus medius muscle': 'gluteus_medius',
  'Gluteus minimus muscle': 'gluteus_medius',
  'Iliotibial tract': 'gluteus_medius',

  // Quads & hip flexors
  'Rectus femoris muscle': 'quadriceps',
  'Vastus lateralis muscle': 'quadriceps',
  'Vastus medialis muscle': 'quadriceps',
  'Vastus intermedius muscle': 'quadriceps',
  'Sartorius muscle': 'quadriceps',
  'Iliacus muscle': 'quadriceps',
  'Psoas major': 'quadriceps',
  'Lateral patellar retinaculum': 'quadriceps',
  'Medial patellar retinaculum': 'quadriceps',

  // Adductors
  'Adductor brevis': 'adductors',
  'Adductor longus': 'adductors',
  'Adductor magnus': 'adductors',
  'Adductor minimus': 'adductors',
  'Gracilis muscle': 'adductors',
  'Obturator externus': 'adductors',
  'Pectineus muscle': 'adductors',

  // Hamstrings
  'Long head of biceps femoris': 'hamstrings',
  'Short head of biceps femoris': 'hamstrings',
  'Semimembranosus muscle': 'hamstrings',
  'Semitendinosus muscle': 'hamstrings',

  // Lower legs / calves / shins
  'Lateral head of gastrocnemius': 'gastrocnemius',
  'Medial head of gastrocnemius': 'gastrocnemius',
  'Plantaris muscle': 'gastrocnemius',
  'Popliteus muscle': 'gastrocnemius',
  'Soleus muscle': 'soleus',
  'Calcaneal tendon': 'soleus',
  'Tibialis posterior muscle': 'soleus',
  'Flexor digitorum longus': 'soleus',
  'Flexor hallucis longus': 'soleus',
  'Tibialis anterior muscle': 'tibialis_anterior',
  'Extensor digitorum longus': 'tibialis_anterior',
  'Extensor hallucis longus': 'tibialis_anterior',
  'Tendon of extensor digitorum longus': 'tibialis_anterior',
  'Fibularis longus muscle': 'tibialis_anterior',
  'Fibularis brevis muscle': 'tibialis_anterior',
  'Fibularis tertius muscle': 'tibialis_anterior',
};

/** Resolves a GLB node's `userData.label` to a FitFreak `MuscleId`, or `null` if non-muscle. */
export const resolveAnatomyMuscleId = (
  userData: AnatomyNodeUserData | undefined,
): MuscleId | null => {
  if (!userData || userData.kind !== 'muscle' || !userData.label) return null;
  return ANATOMY_LABEL_TO_MUSCLE_ID[userData.label] ?? null;
};

