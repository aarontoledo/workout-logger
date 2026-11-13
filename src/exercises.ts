// Exercise library organized by movement pattern, using equipment typical of
// small-group strength studios (trap bars, DBs, KBs, landmines, cables, TRX,
// sleds, slam balls, bands, sandbags).

/** How a set of an exercise is logged. */
export type Measure =
  | 'weight_reps'      // e.g. 50 lbs × 10 reps
  | 'reps'             // bodyweight, e.g. 12 reps
  | 'time'             // holds and intervals, e.g. 30 sec
  | 'distance'         // e.g. 20 yds, 500 m
  | 'calories'         // machines, e.g. 15 cal
  | 'weight_distance'  // carries and sleds, e.g. 70 lbs × 40 yds
  | 'weight_time';     // carries and sleds for time, e.g. 70 lbs × 30 sec

export type Field = 'weight' | 'reps' | 'seconds' | 'distance' | 'calories';

export type DistanceUnit = 'yds' | 'm' | 'mi';

export const MEASURE_FIELDS: Record<Measure, Field[]> = {
  weight_reps: ['weight', 'reps'],
  reps: ['reps'],
  time: ['seconds'],
  distance: ['distance'],
  calories: ['calories'],
  weight_distance: ['weight', 'distance'],
  weight_time: ['weight', 'seconds'],
};

export const MEASURE_LABELS: Record<Measure, string> = {
  weight_reps: 'Weight × Reps',
  reps: 'Reps',
  time: 'Time',
  distance: 'Distance',
  calories: 'Calories',
  weight_distance: 'Weight × Distance',
  weight_time: 'Weight × Time',
};

/** Compact labels for the tracking switch. */
export const MEASURE_SHORT: Record<Measure, string> = {
  weight_reps: 'Wt × Reps',
  reps: 'Reps',
  time: 'Time',
  distance: 'Distance',
  calories: 'Cals',
  weight_distance: 'Wt × Dist',
  weight_time: 'Wt × Time',
};

type FieldSettings = { label: string; step: number; defaultValue: number };

const FIELD_SETTINGS: Record<Exclude<Field, 'distance'>, FieldSettings> = {
  weight: { label: 'Weight (lbs)', step: 5, defaultValue: 25 },
  reps: { label: 'Reps', step: 1, defaultValue: 10 },
  seconds: { label: 'Time (sec)', step: 15, defaultValue: 30 },
  calories: { label: 'Calories', step: 1, defaultValue: 10 },
};

const DISTANCE_SETTINGS: Record<DistanceUnit, FieldSettings> = {
  yds: { label: 'Distance (yds)', step: 5, defaultValue: 20 },
  m: { label: 'Distance (m)', step: 50, defaultValue: 500 },
  mi: { label: 'Distance (mi)', step: 0.1, defaultValue: 0.5 },
};

/** Label, stepper increment and starting value for an input field. */
export const fieldConfig = (field: Field, unit: DistanceUnit = 'yds'): FieldSettings =>
  field === 'distance' ? DISTANCE_SETTINGS[unit] : FIELD_SETTINGS[field];

export type Exercise = {
  name: string;
  /** Default way to track this exercise (same as measures[0]) */
  measure: Measure;
  /** Every way this exercise can be tracked; the first is the default */
  measures: Measure[];
  distanceUnit: DistanceUnit;
  /** Short category label */
  category: string;
};

export type Category = {
  name: string;
  /** Short label for filter chips */
  short: string;
  exercises: Exercise[];
};

// Exercises that can be tracked more than one way. The first measure must match
// the group the exercise is listed under in EXERCISE_LIBRARY (its default).
type TrackingOptions = { measures: Measure[]; distanceUnit?: DistanceUnit };
// Units match each machine's display: Concept2 rower/SkiErg show meters; US air bikes and treadmills show miles.
const METERS_MACHINE: TrackingOptions = { measures: ['time', 'distance', 'calories'], distanceUnit: 'm' };
const MILES_MACHINE: TrackingOptions = { measures: ['time', 'distance', 'calories'], distanceUnit: 'mi' };
const LOADED_TRAVEL: TrackingOptions = { measures: ['weight_distance', 'weight_time'] };
const TIME_OR_REPS: TrackingOptions = { measures: ['time', 'reps'] };

const TRACKING_OPTIONS: Record<string, TrackingOptions> = {
  'SkiErg Sprint': METERS_MACHINE,
  'Rowing Ergometer Sprint': METERS_MACHINE,
  'Air Bike Sprint': MILES_MACHINE,
  'Treadmill Sprint': MILES_MACHINE,
  'Sled Push': LOADED_TRAVEL,
  'Sled Drag (Backward)': LOADED_TRAVEL,
  'Sled Row': LOADED_TRAVEL,
  'Sled Sprint': LOADED_TRAVEL,
  "Farmer's Walk": LOADED_TRAVEL,
  'Suitcase Carry': LOADED_TRAVEL,
  'Front-Rack KB Carry': LOADED_TRAVEL,
  'Overhead KB Carry': LOADED_TRAVEL,
  'Sandbag Bear-Hug Carry': LOADED_TRAVEL,
  'Single-Arm Overhead Carry': LOADED_TRAVEL,
  'Battle Rope Slams': TIME_OR_REPS,
  'Battle Rope Alternating Waves': TIME_OR_REPS,
  'Jump Rope': TIME_OR_REPS,
  'Mountain Climbers': TIME_OR_REPS,
  'Bear Crawl': { measures: ['distance', 'time'] },
  'Lateral Shuffles': { measures: ['time', 'distance'] },
};

const category = (
  name: string,
  short: string,
  byMeasure: Partial<Record<Measure, string[]>>
): Category => ({
  name,
  short,
  exercises: (Object.entries(byMeasure) as [Measure, string[]][]).flatMap(
    ([measure, names]) => names.map(exName => {
      const options = TRACKING_OPTIONS[exName];
      return {
        name: exName,
        measure,
        measures: options?.measures ?? [measure],
        distanceUnit: options?.distanceUnit ?? 'yds',
        category: short,
      };
    })
  ),
});

export const EXERCISE_LIBRARY: Category[] = [
  category('Squat (Knee Dominant)', 'Squat', {
    weight_reps: [
      'Trap Bar Squat', 'DB Goblet Squat', 'KB Front Squat', 'Barbell Box Squat',
      'Landmine Squat', 'Barbell Back Squat', 'Heels-Elevated Goblet Squat',
      'Sandbag Front Squat', 'Landmine Goblet Squat', 'Tempo Goblet Squat',
    ],
    reps: ['Bodyweight Air Squat'],
    time: ['Wall Sit'],
  }),
  category('Hinge (Hip Dominant)', 'Hinge', {
    weight_reps: [
      'Trap Bar Deadlift', 'KB Deadlift', 'DB Romanian Deadlift (RDL)', 'Single-Leg RDL',
      'KB Swing (Two-Arm)', 'KB Swing (Single-Arm)', 'Barbell Hip Thrust', 'Cable Pull-Through',
      'Good Mornings', 'Single-Leg KB Deadlift', 'Staggered-Stance RDL', 'B-Stance Hip Thrust',
      'DB Hip Thrust', 'KB Sumo Deadlift', 'Back Extension',
    ],
    reps: [
      'Slider Hamstring Curl', 'Stability Ball Leg Curl', 'Glute Bridge',
      'Banded Good Morning', 'Nordic Curl (Eccentric)',
    ],
  }),
  category('Single-Leg & Lunge', 'Single-Leg', {
    weight_reps: [
      'DB Reverse Lunge', 'DB Lateral Lunge', 'DB Step-Up', 'DB Rear-Foot Elevated Split Squat',
      'DB Walking Lunge', 'Goblet Reverse Lunge', 'Landmine Reverse Lunge',
      'KB Front-Rack Split Squat', 'Slider Reverse Lunge', 'Lateral Step-Up',
    ],
    reps: ['TRX Single-Leg Squat', 'Curtsy Lunge', 'Cossack Squat'],
  }),
  category('Push (Upper Body)', 'Push', {
    weight_reps: [
      'DB Bench Press', 'DB Incline Press', 'Half-Kneeling DB Overhead Press', 'Landmine Press',
      'DB Thrusters', 'Dumbbell Shoulder Press', 'Floor Press', 'DB Z-Press', 'Cable Chest Fly',
      'Single-Arm DB Press', 'Half-Kneeling Landmine Press', 'Alternating DB Bench Press',
      'Single-Arm Cable Press', 'DB Arnold Press', 'Landmine Push Press',
    ],
    reps: ['Push-Ups', 'TRX Suspension Push-Up', 'Deficit Push-Up', 'Incline Push-Up', 'Bench Dips'],
  }),
  category('Pull (Upper Body)', 'Pull', {
    weight_reps: [
      'Cable Seated Row', 'DB Bent-Over Row', '2-Point DB Row', 'Lat Pulldown', 'DB Renegade Row',
      'Single-Arm KB Row', 'Face Pulls', 'Chest-Supported Row', 'Straight-Arm Cable Pulldown',
      'Single-Arm Cable Row', 'Half-Kneeling Single-Arm Lat Pulldown', 'Meadows Row',
      'Seal Row', 'DB Pullover',
    ],
    reps: [
      'TRX Inverted Row', 'TRX Y-Raise', 'TRX T-Raise', 'TRX Face Pull', 'Banded Pull-Up',
      'Chin-Up', 'Band Pull-Apart',
    ],
  }),
  category('Core: Anti-Extension', 'Anti-Extension', {
    reps: [
      'Deadbug', 'Stability Ball Rollout', 'TRX Ab Rollout', 'Plank with Reach',
      'Body Saw', 'Ab Wheel Rollout',
    ],
    time: ['Hollow Body Hold'],
    distance: ['Bear Crawl'],
  }),
  category('Core: Anti-Rotation', 'Anti-Rotation', {
    weight_reps: [
      'Pallof Press', 'Half-Kneeling Cable Chop', 'Half-Kneeling Cable Lift', 'Bear Hold DB Drag',
      'Landmine Rainbow', 'Tall-Kneeling Pallof Press with Overhead Reach', 'Russian Twist',
    ],
    time: ['Renegade Row Hold'],
  }),
  category('Core: Anti-Lateral Flexion', 'Anti-Lateral', {
    weight_reps: ['Side Plank with Row'],
    time: ['Side Plank', 'Copenhagen Plank'],
    weight_distance: ['Single-Arm Overhead Carry'],
  }),
  category('Power', 'Power', {
    weight_reps: [
      'Kettlebell Clean', 'Kettlebell Snatch', 'Slam Ball Rainbows', 'Overhead Slam Ball',
      'Medicine Ball Chest Pass', 'Rotational Med Ball Throw', 'Landmine Rotational Press',
      'Trap Bar Jump', 'KB High Pull',
    ],
    reps: ['Skater Jumps', 'Box Jumps', 'Broad Jump', 'Lateral Bound', 'Burpees'],
    weight_distance: ['Sled Sprint'],
  }),
  category('Carries & Loaded Movement', 'Carries', {
    weight_distance: [
      "Farmer's Walk", 'Suitcase Carry', 'Front-Rack KB Carry', 'Overhead KB Carry',
      'Sandbag Bear-Hug Carry', 'Sled Push', 'Sled Drag (Backward)', 'Sled Row',
    ],
  }),
  category('Conditioning', 'Conditioning', {
    time: [
      'SkiErg Sprint', 'Rowing Ergometer Sprint', 'Air Bike Sprint', 'Treadmill Sprint',
      'Battle Rope Slams', 'Battle Rope Alternating Waves', 'Jump Rope', 'Mountain Climbers',
      'Lateral Shuffles',
    ],
  }),
  category('Arms & Accessories', 'Arms', {
    weight_reps: [
      'DB Biceps Curl', 'Hammer Curl', 'Cable Curl', 'Cable Triceps Pushdown', 'DB Skull Crusher',
      'Overhead Triceps Extension', 'Lateral Raise', 'Rear Delt Fly',
    ],
    reps: ['TRX Biceps Curl', 'TRX Triceps Extension'],
  }),
  category('Mobility & Warm-up', 'Mobility', {
    reps: [
      "World's Greatest Stretch", '90/90 Hip Switch', 'Thoracic Open Book', 'Cat-Cow',
      'Banded Shoulder Dislocate', 'Inchworm', 'Spiderman Lunge with Reach', 'Glute Bridge March',
    ],
  }),
];

export const ALL_EXERCISES: Exercise[] = EXERCISE_LIBRARY.flatMap(c => c.exercises);

const EXERCISE_BY_NAME = new Map(ALL_EXERCISES.map(e => [e.name.toLowerCase(), e]));

const ALL_MEASURES = Object.keys(MEASURE_FIELDS) as Measure[];

export type ExerciseInfo = { measures: Measure[]; distanceUnit: DistanceUnit };

/**
 * Tracking options for an exercise name. Custom (typed-in) exercises can be tracked
 * any way, defaulting to weight × reps, with distance in yards.
 */
export const getExerciseInfo = (exerciseName: string): ExerciseInfo => {
  const ex = EXERCISE_BY_NAME.get(exerciseName.trim().toLowerCase());
  return ex
    ? { measures: ex.measures, distanceUnit: ex.distanceUnit }
    : { measures: ALL_MEASURES, distanceUnit: 'yds' };
};

/** Default measurement type for an exercise name. */
export const getMeasure = (exerciseName: string): Measure => getExerciseInfo(exerciseName).measures[0];

// Abbreviations people commonly type, matched in both directions.
const SYNONYMS: [string, string][] = [
  ['db', 'dumbbell'],
  ['kb', 'kettlebell'],
  ['rdl', 'romanian'],
  ['trx', 'suspension'],
  ['bw', 'bodyweight'],
  // A weighted push cart is usually called a sled or prowler.
  ['prowler', 'sled'],
  ['cart', 'sled'],
  ['assault', 'air bike'],
];

const tokenVariants = (token: string): string[] => {
  const variants = [token];
  for (const [abbr, full] of SYNONYMS) {
    if (token === abbr) variants.push(full);
    if (full.startsWith(token) && token.length >= 3) variants.push(abbr);
  }
  return variants;
};

const SEARCH_INDEX = ALL_EXERCISES.map(e => {
  const name = e.name.toLowerCase();
  return {
    exercise: e,
    name,
    words: name.split(/[\s\-()/]+/).filter(Boolean),
    haystack: `${name} ${e.category.toLowerCase()}`,
  };
});

/**
 * Find exercises matching a query. Every typed word must appear somewhere in the
 * exercise name or category (so "row", "kb swing" and "carries" all work).
 * Results are ranked: name starts with query, then whole-query substring, then word matches.
 */
export function searchExercises(query: string): Exercise[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_EXERCISES;
  const tokens = q.split(/\s+/).map(tokenVariants);

  const results: { exercise: Exercise; score: number }[] = [];
  for (const entry of SEARCH_INDEX) {
    if (!tokens.every(variants => variants.some(v => entry.haystack.includes(v)))) continue;
    let score = 0;
    if (entry.name.startsWith(q)) score = 3;
    else if (entry.name.includes(q)) score = 2;
    else if (tokens.every(variants => variants.some(v => entry.words.some(w => w.startsWith(v))))) score = 1;
    results.push({ exercise: entry.exercise, score });
  }
  return results.sort((a, b) => b.score - a.score).map(r => r.exercise);
}

export type StationConfig = {
  name: string;
  setsCount: number;
  /** Tracking chosen on the setup screen; when absent, use the last-used or default measure. */
  measure?: Measure;
};

export const PRESET_ROUTINES: { name: string; exercises: StationConfig[] }[] = [
  {
    name: 'Full Body Balance',
    exercises: [
      { name: 'Trap Bar Deadlift', setsCount: 4 },
      { name: 'DB Bench Press', setsCount: 4 },
      { name: 'DB Goblet Squat', setsCount: 3 },
      { name: 'Cable Seated Row', setsCount: 3 },
      { name: 'Pallof Press', setsCount: 3 },
      { name: 'Slam Ball Rainbows', setsCount: 2 },
    ],
  },
  {
    name: 'Lower Body Focus',
    exercises: [
      { name: 'Trap Bar Squat', setsCount: 4 },
      { name: 'Single-Leg RDL', setsCount: 3 },
      { name: 'DB Reverse Lunge', setsCount: 3 },
      { name: 'KB Swing (Two-Arm)', setsCount: 4 },
      { name: 'Suitcase Carry', setsCount: 3 },
      { name: 'Skater Jumps', setsCount: 2 },
    ],
  },
  {
    name: 'Upper Body Focus',
    exercises: [
      { name: 'DB Incline Press', setsCount: 4 },
      { name: 'TRX Inverted Row', setsCount: 4 },
      { name: 'Landmine Press', setsCount: 3 },
      { name: 'Lat Pulldown', setsCount: 3 },
      { name: 'Push-Ups', setsCount: 3 },
      { name: 'Battle Rope Slams', setsCount: 2 },
    ],
  },
  {
    name: 'Strength & Conditioning',
    exercises: [
      { name: 'Trap Bar Deadlift', setsCount: 4 },
      { name: 'Half-Kneeling Landmine Press', setsCount: 3 },
      { name: 'DB Walking Lunge', setsCount: 3 },
      { name: 'Single-Arm Cable Row', setsCount: 3 },
      { name: 'Sled Push', setsCount: 3 },
      { name: 'Air Bike Sprint', setsCount: 4 },
    ],
  },
  {
    name: 'Core & Carry',
    exercises: [
      { name: 'KB Front Squat', setsCount: 3 },
      { name: 'Deadbug', setsCount: 3 },
      { name: 'Half-Kneeling Cable Chop', setsCount: 3 },
      { name: 'Side Plank', setsCount: 3 },
      { name: "Farmer's Walk", setsCount: 3 },
      { name: 'Hollow Body Hold', setsCount: 3 },
    ],
  },
];
