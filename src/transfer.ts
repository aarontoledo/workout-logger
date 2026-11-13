// Moving workouts between devices without a server:
// - Backup files: export all history as JSON, import (merge) on another device.
// - Share links: one workout encoded into the URL hash. The hash never reaches the
//   server, so the workout data stays between the sender and the recipient.

import { MEASURE_FIELDS, type DistanceUnit, type Measure } from './exercises';
import type { Station, WorkoutLog, WorkoutSet } from './types';

// ---------- Validation (backup files and share links come from outside the app) ----------

const MEASURES = new Set<string>(Object.keys(MEASURE_FIELDS));
const UNITS = new Set<string>(['yds', 'm', 'mi']);

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
const optNum = (v: unknown) => (v === undefined || v === null ? undefined : num(v));
const optMeasure = (v: unknown) => (typeof v === 'string' && MEASURES.has(v) ? (v as Measure) : undefined);
const optUnit = (v: unknown) => (typeof v === 'string' && UNITS.has(v) ? (v as DistanceUnit) : undefined);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function parseSet(raw: unknown, index: number): WorkoutSet | null {
  if (!isObject(raw)) return null;
  return {
    setNumber: num(raw.setNumber, index + 1),
    weight: num(raw.weight),
    reps: num(raw.reps),
    seconds: optNum(raw.seconds),
    distance: optNum(raw.distance),
    calories: optNum(raw.calories),
    measure: optMeasure(raw.measure),
    completed: raw.completed === true,
  };
}

function parseStation(raw: unknown): Station | null {
  if (!isObject(raw) || typeof raw.name !== 'string' || !Array.isArray(raw.sets)) return null;
  return {
    name: raw.name,
    measure: optMeasure(raw.measure),
    distanceUnit: optUnit(raw.distanceUnit),
    sets: raw.sets.map(parseSet).filter((s): s is WorkoutSet => s !== null),
  };
}

/** Validate and normalize one workout from untrusted JSON; null if it isn't one. */
export function parseWorkout(raw: unknown): WorkoutLog | null {
  if (!isObject(raw) || !Array.isArray(raw.stations)) return null;
  const id = num(raw.id, NaN);
  if (!Number.isFinite(id) || typeof raw.date !== 'string') return null;
  const stations = raw.stations.map(parseStation).filter((s): s is Station => s !== null);
  if (stations.length === 0) return null;
  return {
    id,
    date: raw.date,
    time: typeof raw.time === 'string' ? raw.time : '',
    totalVolume: num(raw.totalVolume),
    totalCompletedSets: num(raw.totalCompletedSets),
    stations,
  };
}

/** Add incoming workouts that aren't already present (matched by id); newest first. */
export function mergeWorkouts(existing: WorkoutLog[], incoming: WorkoutLog[]) {
  const ids = new Set(existing.map(w => w.id));
  const added: WorkoutLog[] = [];
  for (const w of incoming) {
    if (ids.has(w.id)) continue;
    ids.add(w.id);
    added.push(w);
  }
  return {
    merged: [...existing, ...added].sort((a, b) => b.id - a.id),
    added: added.length,
    skipped: incoming.length - added.length,
  };
}

// ---------- Backup files ----------

const BACKUP_FORMAT = 'workout-logger-history';

/**
 * Export all history as a JSON file. On phones, opens the share sheet (AirDrop,
 * Save to Files, email…); elsewhere, or if sharing isn't available, downloads it.
 */
export async function exportHistory(history: WorkoutLog[]): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const json = JSON.stringify(
    { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), workouts: history },
    null,
    2
  );
  const file = new File([json], `workout-history-${new Date().toISOString().slice(0, 10)}.json`, {
    type: 'application/json',
  });

  const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches;
  if (isTouchDevice && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Workout history backup' });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // Any other share failure: fall back to a download.
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

/** Read workouts from a backup file's text. Throws an Error with a user-facing message. */
export function parseBackup(text: string): WorkoutLog[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file couldn't be read as a workout backup.");
  }
  // Accept this app's backup format, or a bare array of workouts.
  const list = Array.isArray(data) ? data : isObject(data) && Array.isArray(data.workouts) ? data.workouts : null;
  if (!list) throw new Error("That file isn't a workout history backup.");
  const workouts = list.map(parseWorkout).filter((w): w is WorkoutLog => w !== null);
  if (list.length > 0 && workouts.length === 0) {
    throw new Error("No workouts in that file could be read.");
  }
  return workouts;
}

// ---------- Share links ----------

export const SHARE_HASH_PREFIX = '#workout=';

const toBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string) => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '==='.slice((b64.length + 3) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
};

const pipeBytes = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream) => {
  const output = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
};

/** Encode a workout for a URL: "z" + compressed (when supported) or "j" + plain JSON, base64url. */
async function encodeWorkout(workout: WorkoutLog): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(workout));
  if (typeof CompressionStream !== 'undefined') {
    try {
      return 'z' + toBase64Url(await pipeBytes(bytes, new CompressionStream('deflate-raw')));
    } catch {
      // Fall through to uncompressed.
    }
  }
  return 'j' + toBase64Url(bytes);
}

/** Decode a workout from a share link payload. Throws if the link is damaged or invalid. */
export async function decodeWorkout(payload: string): Promise<WorkoutLog> {
  const kind = payload[0];
  let bytes = fromBase64Url(payload.slice(1));
  if (kind === 'z') bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'j') throw new Error('Unknown share link format');
  const workout = parseWorkout(JSON.parse(new TextDecoder().decode(bytes)));
  if (!workout) throw new Error('Share link does not contain a workout');
  return workout;
}

/** Full link that opens this workout in the app. */
export async function buildShareUrl(workout: WorkoutLog): Promise<string> {
  return `${location.origin}${location.pathname}${SHARE_HASH_PREFIX}${await encodeWorkout(workout)}`;
}

/**
 * Share a prepared link via the share sheet, or copy it if sharing isn't available.
 * Call directly from a tap (no awaits before it): iOS only allows the share sheet
 * during the tap itself.
 */
export async function shareLink(url: string, title: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
