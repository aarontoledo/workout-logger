// Shared helpers for reading saved sets: how a station is tracked, filling in
// defaults for older saves, and formatting set results for display.

import { fieldConfig, getMeasure, type DistanceUnit, type Measure } from './exercises';
import type { Station, WorkoutSet } from './types';

/** How a station's sets are measured and displayed. */
export type Tracking = { measure: Measure; unit: DistanceUnit };

export const stationTracking = (st: Station): Tracking => ({
  measure: st.measure ?? getMeasure(st.name),
  // Before distance units were added, every distance was logged in yards.
  unit: st.distanceUnit ?? 'yds',
});

// The values a set carries forward to the next set (everything except number/completion).
export const setValues = (s: Partial<WorkoutSet> = {}, unit: DistanceUnit = 'yds') => ({
  weight: s.weight ?? fieldConfig('weight').defaultValue,
  reps: s.reps ?? fieldConfig('reps').defaultValue,
  seconds: s.seconds ?? fieldConfig('seconds').defaultValue,
  distance: s.distance ?? fieldConfig('distance', unit).defaultValue,
  calories: s.calories ?? fieldConfig('calories').defaultValue,
});

export const formatDuration = (totalSeconds: number) => {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

/** Human-readable set result, e.g. "50 lbs × 10 reps", "45s", "500 m", "70 lbs × 40 yds". */
export const formatSet = (s: WorkoutSet, tracking: Tracking, compact = false) => {
  const measure = s.measure ?? tracking.measure;
  const unit = tracking.unit;
  // Round for display so floating-point noise (0.8500000000000001) never shows.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const raw = setValues(s, unit);
  const v = { weight: r2(raw.weight), reps: r2(raw.reps), seconds: Math.round(raw.seconds), distance: r2(raw.distance), calories: r2(raw.calories) };
  const dist = compact ? `${v.distance}${unit === 'yds' ? 'yd' : unit}` : `${v.distance} ${unit}`;
  switch (measure) {
    case 'weight_reps':
      return compact ? `${v.weight}×${v.reps}` : `${v.weight} lbs × ${v.reps} reps`;
    case 'reps':
      return `${v.reps} reps`;
    case 'time':
      return formatDuration(v.seconds);
    case 'distance':
      return dist;
    case 'calories':
      return `${v.calories} cal`;
    case 'weight_distance':
      return compact ? `${v.weight}×${dist}` : `${v.weight} lbs × ${dist}`;
    case 'weight_time':
      return compact ? `${v.weight}×${formatDuration(v.seconds)}` : `${v.weight} lbs × ${formatDuration(v.seconds)}`;
  }
};
