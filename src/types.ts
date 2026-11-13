import type { DistanceUnit, Measure } from './exercises';

export type WorkoutSet = {
  setNumber: number;
  weight: number;
  reps: number;
  // Added with time/distance/calorie tracking; absent on older saved workouts.
  seconds?: number;
  distance?: number;
  calories?: number;
  // How this set was tracked when logged, so switching a station's tracking
  // mid-workout doesn't change how earlier sets read. Absent on older saves.
  measure?: Measure;
  completed: boolean;
};

export type Station = {
  name: string;
  // Absent on older saved workouts; resolve with stationTracking().
  measure?: Measure;
  distanceUnit?: DistanceUnit;
  sets: WorkoutSet[];
};

export type WorkoutLog = {
  /** Timestamp (ms) when the workout was finished; unique per workout. */
  id: number;
  date: string;
  time: string;
  totalVolume: number;
  totalCompletedSets: number;
  stations: Station[];
};
