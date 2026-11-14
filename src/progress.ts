// Progress calculations over saved workout history: best set per session for an
// exercise, personal records, and workouts per week. Pure functions, no UI.

import type { DistanceUnit, Measure } from './exercises';
import { formatDuration, setValues, stationTracking } from './format';
import type { WorkoutLog, WorkoutSet } from './types';

// ---------- Metrics: what "best set" means for each way of tracking ----------

export type MetricKey = 'e1rm' | 'topWeight' | 'reps' | 'seconds' | 'distance' | 'calories' | 'load';

/** Metrics available for a measure; the first is the default (and the one PRs use). */
export const metricsFor = (measure: Measure): MetricKey[] => {
  switch (measure) {
    case 'weight_reps': return ['e1rm', 'topWeight'];
    case 'reps': return ['reps'];
    case 'time': return ['seconds'];
    case 'distance': return ['distance'];
    case 'calories': return ['calories'];
    case 'weight_distance':
    case 'weight_time': return ['load'];
  }
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  e1rm: 'Est. 1-rep max',
  topWeight: 'Top set weight',
  reps: 'Most reps',
  seconds: 'Longest set',
  distance: 'Farthest set',
  calories: 'Most calories',
  load: 'Heaviest load',
};

/**
 * Estimated 1-rep max (Epley formula). Lets sets with different weight/rep
 * combinations be compared on one scale, e.g. 60 × 10 ≈ 80 and 65 × 6 ≈ 78.
 */
export const estimatedOneRepMax = (weight: number, reps: number) =>
  reps <= 0 || weight <= 0 ? 0 : reps === 1 ? weight : weight * (1 + reps / 30);

export const metricValue = (metric: MetricKey, set: WorkoutSet): number => {
  const v = setValues(set);
  switch (metric) {
    case 'e1rm': return estimatedOneRepMax(v.weight, v.reps);
    case 'topWeight':
    case 'load': return v.weight;
    case 'reps': return v.reps;
    case 'seconds': return v.seconds;
    case 'distance': return v.distance;
    case 'calories': return v.calories;
  }
};

const round = (n: number, places = 0) => Math.round(n * 10 ** places) / 10 ** places;

export const formatMetric = (metric: MetricKey, value: number, unit: DistanceUnit = 'yds'): string => {
  switch (metric) {
    case 'e1rm':
    case 'topWeight':
    case 'load': return `${round(value)} lbs`;
    case 'reps': return `${round(value)} reps`;
    case 'seconds': return formatDuration(round(value));
    case 'distance': return `${round(value, 2)} ${unit}`;
    case 'calories': return `${round(value)} cal`;
  }
};

// ---------- Exercises that appear in history ----------

/** A way an exercise was tracked. Units only distinguish distance-based measures. */
export type TrackingKey = { measure: Measure; unit: DistanceUnit };

const usesDistance = (m: Measure) => m === 'distance' || m === 'weight_distance';
const sameTracking = (a: TrackingKey, b: TrackingKey) =>
  a.measure === b.measure && (!usesDistance(a.measure) || a.unit === b.unit);

export type ExerciseSummary = {
  name: string;
  /** Timestamp of the most recent workout that included it */
  lastDone: number;
  /** Number of workouts with at least one completed set */
  sessionCount: number;
  /** Ways it has been tracked, most recently used first */
  trackings: TrackingKey[];
};

const byTimeAsc = (history: WorkoutLog[]) => [...history].sort((a, b) => a.id - b.id);

/** Completed sets in a workout for an exercise, with how each set was tracked. */
function completedSets(workout: WorkoutLog, nameKey: string) {
  const sets: { set: WorkoutSet; tracking: TrackingKey }[] = [];
  for (const st of workout.stations) {
    if (st.name.trim().toLowerCase() !== nameKey) continue;
    const stTracking = stationTracking(st);
    for (const set of st.sets) {
      if (!set.completed) continue;
      sets.push({ set, tracking: { measure: set.measure ?? stTracking.measure, unit: stTracking.unit } });
    }
  }
  return sets;
}

/** Every exercise with completed sets in history, most recently done first. */
export function exerciseIndex(history: WorkoutLog[]): ExerciseSummary[] {
  const byName = new Map<string, ExerciseSummary>();
  for (const workout of byTimeAsc(history)) {
    const seenThisWorkout = new Set<string>();
    for (const st of workout.stations) {
      const key = st.name.trim().toLowerCase();
      if (!key) continue;
      const sets = completedSets(workout, key);
      if (sets.length === 0) continue;
      let entry = byName.get(key);
      if (!entry) {
        entry = { name: st.name.trim(), lastDone: 0, sessionCount: 0, trackings: [] };
        byName.set(key, entry);
      }
      if (!seenThisWorkout.has(key)) {
        seenThisWorkout.add(key);
        entry.sessionCount += 1;
        entry.lastDone = workout.id;
        entry.name = st.name.trim(); // latest spelling
      }
      for (const { tracking } of sets) {
        // Move to the front so the most recently used tracking comes first.
        entry.trackings = [tracking, ...entry.trackings.filter(t => !sameTracking(t, tracking))];
      }
    }
  }
  return [...byName.values()].sort((a, b) => b.lastDone - a.lastDone);
}

// ---------- Per-session bests and PRs ----------

export type SessionBest = {
  workoutId: number;
  date: string;
  set: WorkoutSet;
  value: number;
  /** Beat every earlier session (the first session is a baseline, not a PR) */
  isPR: boolean;
  previousBest?: number;
};

/** Best completed set per workout for one exercise / tracking / metric, oldest first. */
export function sessionBests(
  history: WorkoutLog[], name: string, tracking: TrackingKey, metric: MetricKey
): SessionBest[] {
  const key = name.trim().toLowerCase();
  const sessions: SessionBest[] = [];
  let runningBest: number | undefined;
  for (const workout of byTimeAsc(history)) {
    let best: { set: WorkoutSet; value: number } | undefined;
    for (const { set, tracking: t } of completedSets(workout, key)) {
      if (!sameTracking(t, tracking)) continue;
      const value = metricValue(metric, set);
      if (value > 0 && (!best || value > best.value)) best = { set, value };
    }
    if (!best) continue;
    const isPR = runningBest !== undefined && best.value > runningBest;
    sessions.push({ workoutId: workout.id, date: workout.date, set: best.set, value: best.value, isPR, previousBest: runningBest });
    runningBest = Math.max(runningBest ?? 0, best.value);
  }
  return sessions;
}

export type PersonalRecord = { name: string; tracking: TrackingKey; metric: MetricKey; session: SessionBest };

/** Every PR in history (default metric per tracking), newest first. */
export function personalRecords(history: WorkoutLog[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  for (const ex of exerciseIndex(history)) {
    for (const tracking of ex.trackings) {
      const metric = metricsFor(tracking.measure)[0];
      for (const session of sessionBests(history, ex.name, tracking, metric)) {
        if (session.isPR) records.push({ name: ex.name, tracking, metric, session });
      }
    }
  }
  return records.sort((a, b) => b.session.workoutId - a.session.workoutId || a.name.localeCompare(b.name));
}

/** Names (lowercased) of exercises that set a PR in the given workout. */
export function prExercisesInWorkout(history: WorkoutLog[], workoutId: number): Set<string> {
  return new Set(
    personalRecords(history)
      .filter(r => r.session.workoutId === workoutId)
      .map(r => r.name.toLowerCase())
  );
}

// ---------- Consistency ----------

/** Local midnight on the Monday of the week containing `time`. */
export function startOfWeek(time: number): number {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}

const addWeeks = (weekStart: number, n: number) => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7 * n); // calendar math, so daylight-saving shifts don't drift
  return d.getTime();
};

export type WeekCount = { weekStart: number; count: number };

/** Workouts per week for the last `weeks` weeks (oldest first), including this week. */
export function weeklyCounts(history: WorkoutLog[], weeks = 12, now = Date.now()): WeekCount[] {
  const thisWeek = startOfWeek(now);
  const result: WeekCount[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addWeeks(thisWeek, i - (weeks - 1)),
    count: 0,
  }));
  const index = new Map(result.map((w, i) => [w.weekStart, i]));
  for (const workout of history) {
    const i = index.get(startOfWeek(workout.id));
    if (i !== undefined) result[i].count += 1;
  }
  return result;
}

/**
 * Consecutive weeks with at least one workout, ending this week. If this week has
 * none yet, the streak is still alive and counts back from last week.
 */
export function weekStreak(history: WorkoutLog[], now = Date.now()): number {
  const weeksWithWorkouts = new Set(history.map(w => startOfWeek(w.id)));
  let week = startOfWeek(now);
  if (!weeksWithWorkouts.has(week)) week = addWeeks(week, -1);
  let streak = 0;
  while (weeksWithWorkouts.has(week)) {
    streak += 1;
    week = addWeeks(week, -1);
  }
  return streak;
}

export const shortDate = (time: number) =>
  new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
