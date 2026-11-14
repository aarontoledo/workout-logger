import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, TrendingUp, Trophy } from 'lucide-react';
import { MEASURE_SHORT } from './exercises';
import { formatDuration, formatSet } from './format';
import {
  METRIC_LABELS, exerciseIndex, formatMetric, metricsFor, personalRecords, sessionBests, shortDate,
  weekStreak, weeklyCounts, type MetricKey, type TrackingKey, type WeekCount,
} from './progress';
import type { WorkoutLog } from './types';

// Chart tokens (app palette: dark slate surfaces, amber accent). Single-series charts,
// so no legend; marks use the accent, all text uses slate text tokens.
const SERIES = '#f59e0b';        // amber-500
const SERIES_ACTIVE = '#fbbf24'; // amber-400 (hovered/selected mark)
const SURFACE = '#0f172a';       // slate-900, the card background (ring/gap color)
const GRID = '#1e293b';          // slate-800 hairlines
const AXIS_TEXT = '#64748b';     // slate-500
const CROSSHAIR = '#475569';     // slate-600

// ---------- Scale helpers ----------

function niceScale(min: number, max: number, targetTicks = 4, integerOnly = false) {
  if (min === max) {
    const pad = Math.abs(max) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * magnitude;
  if (integerOnly) step = Math.max(1, Math.ceil(step));
  const lo = Math.max(0, Math.floor(min / step) * step);
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { lo, hi, ticks };
}

const formatTickNumber = (v: number) =>
  Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2).replace(/\.?0+$/, '');

// ---------- Line chart: one exercise's best set per session ----------

type LinePoint = { x: number; y: number; isPR: boolean };

function LineChart({ points, formatY, active, onActiveChange, ariaLabel }: {
  points: LinePoint[];
  formatY: (v: number) => string;
  active: number | null;
  onActiveChange: (i: number | null) => void;
  ariaLabel: string;
}) {
  const W = 340, H = 190;
  const M = { top: 22, right: 18, bottom: 24, left: 44 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const ys = points.map(p => p.y);
  const { lo, hi, ticks } = niceScale(Math.min(...ys), Math.max(...ys));
  const yPos = (v: number) => M.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const x0 = points[0].x, x1 = points[points.length - 1].x;
  const xPos = (v: number) => (points.length === 1 || x1 === x0 ? M.left + plotW / 2 : M.left + ((v - x0) / (x1 - x0)) * plotW);
  const xs = points.map(p => xPos(p.x));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${yPos(p.y).toFixed(1)}`).join(' ');

  const nearestIndex = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    xs.forEach((x, i) => { if (Math.abs(x - px) < Math.abs(xs[best] - px)) best = i; });
    return best;
  };

  const last = points.length - 1;
  const lastX = xs[last], lastY = yPos(points[last].y);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto block select-none outline-none"
      style={{ touchAction: 'pan-y' }}
      role="img"
      aria-label={ariaLabel}
      tabIndex={0}
      onPointerDown={(e) => onActiveChange(nearestIndex(e.clientX, e.currentTarget.getBoundingClientRect()))}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse' || e.buttons) onActiveChange(nearestIndex(e.clientX, e.currentTarget.getBoundingClientRect()));
      }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') onActiveChange(null); }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const from = active ?? last;
          onActiveChange(Math.max(0, Math.min(last, from + (e.key === 'ArrowRight' ? 1 : -1))));
        } else if (e.key === 'Escape') {
          onActiveChange(null);
        }
      }}
      onBlur={() => onActiveChange(null)}
    >
      {/* gridlines + y labels */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={yPos(t)} y2={yPos(t)} stroke={GRID} strokeWidth={1} />
          <text x={M.left - 6} y={yPos(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={AXIS_TEXT}>
            {formatY(t)}
          </text>
        </g>
      ))}

      {/* x labels: first and last session dates */}
      <text x={points.length === 1 ? xs[0] : M.left} y={H - 6} fontSize={10} fill={AXIS_TEXT}
        textAnchor={points.length === 1 ? 'middle' : 'start'}>
        {shortDate(points[0].x)}
      </text>
      {points.length > 1 && (
        <text x={W - M.right} y={H - 6} fontSize={10} fill={AXIS_TEXT} textAnchor="end">{shortDate(points[last].x)}</text>
      )}

      {/* crosshair */}
      {active !== null && (
        <line x1={xs[active]} x2={xs[active]} y1={M.top - 6} y2={M.top + plotH} stroke={CROSSHAIR} strokeWidth={1} />
      )}

      {points.length > 1 && (
        <path d={path} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* session dots; PRs slightly larger, active one lifts */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={xs[i]}
          cy={yPos(p.y)}
          r={i === active ? 6 : p.isPR ? 5.5 : 4}
          fill={i === active ? SERIES_ACTIVE : SERIES}
          stroke={SURFACE}
          strokeWidth={2}
        />
      ))}

      {/* end label: latest value */}
      {active === null && (
        <text
          x={lastX}
          y={lastY - 12}
          textAnchor={lastX > W - 60 ? 'end' : 'middle'}
          fontSize={11}
          fontWeight={600}
          fill="#e2e8f0"
        >
          {formatY(points[last].y)}
        </text>
      )}
    </svg>
  );
}

// ---------- Column chart: workouts per week ----------

function WeeklyBars({ weeks, active, onActiveChange }: {
  weeks: WeekCount[];
  active: number | null;
  onActiveChange: (i: number | null) => void;
}) {
  const W = 340, H = 130;
  const M = { top: 10, right: 8, bottom: 22, left: 24 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const maxCount = Math.max(...weeks.map(w => w.count));
  const { hi, ticks } = niceScale(0, Math.max(maxCount, 2), 2, true);
  const slot = plotW / weeks.length;
  const barW = Math.min(18, slot - 6);
  const base = M.top + plotH;
  const yPos = (v: number) => base - (v / hi) * plotH;
  const last = weeks.length - 1;

  const barPath = (x: number, top: number) => {
    const r = Math.min(4, base - top, barW / 2);
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto block select-none outline-none"
      role="img"
      aria-label={`Workouts per week for the last ${weeks.length} weeks: ${weeks.map(w => w.count).join(', ')}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const from = active ?? last;
          onActiveChange(Math.max(0, Math.min(last, from + (e.key === 'ArrowRight' ? 1 : -1))));
        }
      }}
      onBlur={() => onActiveChange(null)}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') onActiveChange(null); }}
    >
      {ticks.map(t => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={yPos(t)} y2={yPos(t)} stroke={GRID} strokeWidth={1} />
          <text x={M.left - 6} y={yPos(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={AXIS_TEXT}>{t}</text>
        </g>
      ))}
      {weeks.map((w, i) => {
        const x = M.left + i * slot + (slot - barW) / 2;
        return (
          <g key={w.weekStart}>
            {w.count > 0 && (
              <path d={barPath(x, yPos(w.count))} fill={i === active ? SERIES_ACTIVE : SERIES} />
            )}
            {/* hit target: the whole column slot, bigger than the bar */}
            <rect
              x={M.left + i * slot}
              y={M.top}
              width={slot}
              height={plotH}
              fill="transparent"
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') onActiveChange(i); }}
              onPointerDown={() => onActiveChange(i)}
            />
          </g>
        );
      })}
      <text x={M.left} y={H - 6} fontSize={10} fill={AXIS_TEXT}>{shortDate(weeks[0].weekStart)}</text>
      <text x={W - M.right} y={H - 6} fontSize={10} fill={AXIS_TEXT} textAnchor="end">This week</text>
    </svg>
  );
}

// ---------- Small pieces ----------

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

function Chips<T extends string>({ options, value, onChange, label, ariaLabel }: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex gap-1 overflow-x-auto no-scrollbar">
      {options.map(o => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
            o === value
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}

const PRBadge = () => (
  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
    <Trophy className="w-3 h-3" /> PR
  </span>
);

const trackingLabel = (t: TrackingKey) =>
  MEASURE_SHORT[t.measure] + (t.measure === 'distance' || t.measure === 'weight_distance' ? ` (${t.unit})` : '');

// ---------- Screen ----------

export function ProgressView({ history, onBack }: { history: WorkoutLog[]; onBack: () => void }) {
  const exercises = useMemo(() => exerciseIndex(history), [history]);
  const records = useMemo(() => personalRecords(history), [history]);
  const weeks = useMemo(() => weeklyCounts(history), [history]);
  const streak = useMemo(() => weekStreak(history), [history]);

  const [selectedName, setSelectedName] = useState(() => exercises[0]?.name ?? '');
  const [trackingIndex, setTrackingIndex] = useState(0);
  const [chosenMetric, setChosenMetric] = useState<MetricKey | null>(null);
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [activeWeek, setActiveWeek] = useState<number | null>(null);

  const selected = exercises.find(e => e.name === selectedName) ?? exercises[0];
  const tracking = selected?.trackings[Math.min(trackingIndex, selected.trackings.length - 1)];
  const metrics = tracking ? metricsFor(tracking.measure) : [];
  const metric = chosenMetric && metrics.includes(chosenMetric) ? chosenMetric : metrics[0];

  const sessions = useMemo(
    () => (selected && tracking && metric ? sessionBests(history, selected.name, tracking, metric) : []),
    [history, selected, tracking, metric]
  );

  const selectExercise = (name: string) => {
    setSelectedName(name);
    setTrackingIndex(0);
    setChosenMetric(null);
    setActivePoint(null);
  };

  const thisWeek = weeks[weeks.length - 1].count;
  const shownWeek = activeWeek ?? weeks.length - 1;
  const shownSession = sessions.length ? sessions[activePoint ?? sessions.length - 1] : undefined;
  const fmt = (v: number) => (metric ? formatMetric(metric, v, tracking?.unit) : String(v));
  const formatAxis = (v: number) => (metric === 'seconds' ? formatDuration(v) : formatTickNumber(v));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 max-w-md mx-auto p-4 border-x border-slate-900 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between my-3">
        <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center text-xs font-semibold">
          <ArrowLeft className="w-4 h-4 mr-1" /> Setup
        </button>
        <h1 className="text-base font-bold text-white">Progress</h1>
        <div className="w-12"></div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No workouts yet.</p>
          <p className="text-xs">Finish a session and your progress will show up here.</p>
        </div>
      ) : (
        <div className="space-y-4 my-4">
          {/* Consistency */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Consistency</h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <StatTile label="This week" value={thisWeek} />
              <StatTile label="Week streak" value={streak} />
              <StatTile label="Total workouts" value={history.length} />
            </div>
            <div className="text-[11px] text-slate-400 mb-1 h-4" aria-live="polite">
              {shownWeek === weeks.length - 1 ? 'This week' : `Week of ${shortDate(weeks[shownWeek].weekStart)}`}
              {': '}
              <strong className="text-slate-100">{weeks[shownWeek].count}</strong>
              {weeks[shownWeek].count === 1 ? ' workout' : ' workouts'}
            </div>
            <WeeklyBars weeks={weeks} active={activeWeek} onActiveChange={setActiveWeek} />
          </section>

          {/* Exercise progress */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Exercise Progress</h2>

            {exercises.length === 0 || !selected || !tracking || !metric ? (
              <p className="text-xs text-slate-500">Complete some sets to see exercise progress.</p>
            ) : (
              <>
                <label className="sr-only" htmlFor="progress-exercise">Exercise</label>
                <select
                  id="progress-exercise"
                  value={selected.name}
                  onChange={(e) => selectExercise(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-base font-medium text-white focus:outline-none focus:border-amber-500/60 mb-2"
                >
                  {exercises.map(ex => (
                    <option key={ex.name} value={ex.name}>
                      {ex.name} ({ex.sessionCount} {ex.sessionCount === 1 ? 'session' : 'sessions'})
                    </option>
                  ))}
                </select>

                {(selected.trackings.length > 1 || metrics.length > 1) && (
                  <div className="flex flex-col gap-1.5 mb-2">
                    {selected.trackings.length > 1 && (
                      <Chips
                        ariaLabel="Tracking"
                        options={selected.trackings.map((_, i) => String(i))}
                        value={String(Math.min(trackingIndex, selected.trackings.length - 1))}
                        onChange={(v) => { setTrackingIndex(Number(v)); setChosenMetric(null); setActivePoint(null); }}
                        label={(v) => trackingLabel(selected.trackings[Number(v)])}
                      />
                    )}
                    {metrics.length > 1 && (
                      <Chips
                        ariaLabel="Metric"
                        options={metrics}
                        value={metric}
                        onChange={(m) => setChosenMetric(m)}
                        label={(m) => (m === 'e1rm' ? 'Est. 1RM' : 'Top weight')}
                      />
                    )}
                  </div>
                )}

                {shownSession && (
                  <>
                    {/* Readout: latest session, or the one selected on the chart */}
                    <div className="flex items-end justify-between gap-2 mb-1 min-h-[44px]" aria-live="polite">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">{METRIC_LABELS[metric]}</div>
                        <div className="text-2xl font-bold text-white leading-tight">{fmt(shownSession.value)}</div>
                      </div>
                      <div className="text-right text-[11px] text-slate-400 leading-snug">
                        <div className="flex items-center justify-end gap-1.5">
                          {shownSession.isPR && <PRBadge />}
                          <span>{shownSession.date}</span>
                        </div>
                        <div>Best set: <span className="text-slate-200">{formatSet(shownSession.set, tracking)}</span></div>
                      </div>
                    </div>

                    <LineChart
                      points={sessions.map(s => ({ x: s.workoutId, y: s.value, isPR: s.isPR }))}
                      formatY={formatAxis}
                      active={activePoint}
                      onActiveChange={setActivePoint}
                      ariaLabel={`${METRIC_LABELS[metric]} for ${selected.name} over ${sessions.length} sessions, from ${fmt(sessions[0].value)} to ${fmt(sessions[sessions.length - 1].value)}`}
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      {sessions.length === 1
                        ? 'Log this exercise again to see a trend.'
                        : 'Tap or drag across the chart to see each session. Larger dots are PRs.'}
                      {metric === 'e1rm' && ' Est. 1RM = weight × (1 + reps ÷ 30), from your best set.'}
                    </p>

                    {/* Table view of the same data */}
                    <table className="w-full mt-3 text-[11px]">
                      <caption className="sr-only">Recent sessions for {selected.name}</caption>
                      <thead>
                        <tr className="text-slate-500 text-left">
                          <th className="font-semibold py-1">Date</th>
                          <th className="font-semibold py-1">Best set</th>
                          {metric === 'e1rm' && <th className="font-semibold py-1 text-right">Est. 1RM</th>}
                          <th className="py-1"><span className="sr-only">Record</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...sessions].reverse().slice(0, 8).map(s => (
                          <tr key={s.workoutId} className="border-t border-slate-800 text-slate-300">
                            <td className="py-1.5 tabular-nums">{shortDate(s.workoutId)}</td>
                            <td className="py-1.5">{formatSet(s.set, tracking)}</td>
                            {metric === 'e1rm' && <td className="py-1.5 text-right tabular-nums">{fmt(s.value)}</td>}
                            <td className="py-1.5 text-right">{s.isPR && <PRBadge />}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}
          </section>

          {/* Recent PRs */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Recent PRs</h2>
            {records.length === 0 ? (
              <p className="text-xs text-slate-500">
                PRs appear when you beat a previous best. Your first session of each exercise sets the baseline.
              </p>
            ) : (
              <ul className="space-y-2">
                {records.slice(0, 8).map(r => (
                  <li key={`${r.name}-${r.session.workoutId}-${r.tracking.measure}`}>
                    <button
                      type="button"
                      onClick={() => {
                        selectExercise(r.name);
                        const ex = exercises.find(e => e.name === r.name);
                        const i = ex?.trackings.findIndex(t => t.measure === r.tracking.measure && t.unit === r.tracking.unit) ?? 0;
                        setTrackingIndex(Math.max(0, i));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full text-left flex items-start justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 hover:border-slate-700"
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {r.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {formatSet(r.session.set, r.tracking)}
                          {r.session.previousBest !== undefined && (
                            <span className="text-slate-500">
                              {' '}· {METRIC_LABELS[r.metric].toLowerCase()} {formatMetric(r.metric, r.session.value, r.tracking.unit)},
                              {' '}was {formatMetric(r.metric, r.session.previousBest, r.tracking.unit)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">{shortDate(r.session.workoutId)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
