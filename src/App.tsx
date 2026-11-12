import { useState, useEffect, useRef } from 'react';
import {
  Dumbbell, Play, Plus, Check, Clock, Copy,
  Trash2, BarChart2, Flame, Award, ArrowLeft,
  CheckCircle, Zap, RefreshCw, Layers
} from 'lucide-react';

import {
  ALL_EXERCISES, EXERCISE_LIBRARY, FIELD_CONFIG, MEASURE_FIELDS, MEASURE_LABELS, PRESET_ROUTINES,
  getMeasure, type Field, type Measure, type StationConfig,
} from './exercises';
import { ExercisePicker } from './ExercisePicker';

type WorkoutSet = {
  setNumber: number;
  weight: number;
  reps: number;
  // Added with time/distance tracking; absent on older saved workouts.
  seconds?: number;
  distance?: number;
  completed: boolean;
};

type Station = {
  name: string;
  // Absent on older saved workouts; resolve with stationMeasure().
  measure?: Measure;
  sets: WorkoutSet[];
};

type WorkoutLog = {
  id: number;
  date: string;
  time: string;
  totalVolume: number;
  totalCompletedSets: number;
  stations: Station[];
};

type View = 'setup' | 'workout' | 'summary' | 'history';

const STORAGE_KEY = 'workout_history';

const stationMeasure = (st: Station): Measure => st.measure ?? getMeasure(st.name);

// The values a set carries forward to the next set (everything except number/completion).
const setValues = (s: Partial<WorkoutSet> = {}) => ({
  weight: s.weight ?? FIELD_CONFIG.weight.defaultValue,
  reps: s.reps ?? FIELD_CONFIG.reps.defaultValue,
  seconds: s.seconds ?? FIELD_CONFIG.seconds.defaultValue,
  distance: s.distance ?? FIELD_CONFIG.distance.defaultValue,
});

const formatDuration = (totalSeconds: number) => {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

/** Human-readable set result, e.g. "50 lbs × 10 reps", "45s", "70 lbs × 40 yds". */
const formatSet = (s: WorkoutSet, measure: Measure, compact = false) => {
  const v = setValues(s);
  switch (measure) {
    case 'weight_reps':
      return compact ? `${v.weight}×${v.reps}` : `${v.weight} lbs × ${v.reps} reps`;
    case 'reps':
      return `${v.reps} reps`;
    case 'time':
      return formatDuration(v.seconds);
    case 'distance':
      return `${v.distance} yds`;
    case 'weight_distance':
      return compact ? `${v.weight}×${v.distance}yd` : `${v.weight} lbs × ${v.distance} yds`;
  }
};

function Stepper({ field, value, onSet, onStep }: {
  field: Field;
  value: number;
  onSet: (value: number) => void;
  onStep: (delta: number) => void;
}) {
  const { label, step } = FIELD_CONFIG[field];
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">{label}</div>
      <div className="flex items-center justify-between">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onSet(Number(e.target.value))}
          className="w-16 bg-transparent text-xl font-bold text-white focus:outline-none"
        />
        <div className="flex space-x-1">
          <button
            onClick={() => onStep(-step)}
            className="w-8 h-7 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
          >
            -{step}
          </button>
          <button
            onClick={() => onStep(step)}
            className="w-8 h-7 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
          >
            +{step}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Navigation State: 'setup' | 'workout' | 'summary' | 'history'
  const [view, setView] = useState<View>('setup');
  
  // Selected Category filter for quick picker: 'All' | category name
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('All');
  
  // Setup State - Array of 6 station configurations (name + independent sets count)
  const [stationConfigs, setStationConfigs] = useState<StationConfig[]>(
    () => PRESET_ROUTINES[0].exercises.map(ex => ({ ...ex }))
  );

  // Active Workout Data Structure
  const [activeWorkout, setActiveWorkout] = useState<Station[]>([]);
  const [activeStationIndex, setActiveStationIndex] = useState(0);

  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Storage State
  // Load history from localStorage on initial render
  const [history, setHistory] = useState<WorkoutLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load history", e);
      return [];
    }
  });
  const [copied, setCopied] = useState(false);

  // Timer interval handling
  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsTimerRunning(false);
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning, timerSeconds]);

  // Start Rest Timer
  const startRestTimer = (seconds: number) => {
    setTimerSeconds(seconds);
    setIsTimerRunning(true);
  };

  // Helper to get previous stats for exercise from history
  const getPreviousHistory = (exerciseName: string) => {
    for (let workout of history) {
      const found = workout.stations.find(s => s.name.toLowerCase() === exerciseName.toLowerCase());
      if (found && found.sets.length > 0) {
        const lastSet = found.sets[found.sets.length - 1];
        return { date: workout.date, set: lastSet, measure: stationMeasure(found) };
      }
    }
    return null;
  };

  // Start Workout Initialization with Independent Per-Station Set Counts
  const handleStartWorkout = () => {
    const initialized = stationConfigs.map(config => {
      const prev = getPreviousHistory(config.name);
      const initial = setValues(prev?.set);
      const count = config.setsCount || 3;
      
      const sets = Array.from({ length: count }, (_, i) => ({
        setNumber: i + 1,
        ...initial,
        completed: false
      }));

      return {
        name: config.name,
        measure: getMeasure(config.name),
        sets
      };
    });

    setActiveWorkout(initialized);
    setActiveStationIndex(0);
    setView('workout');
  };

  // Update exercise name for a station
  const updateStationName = (index: number, name: string) => {
    setStationConfigs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], name };
      return updated;
    });
  };

  // Adjust target set count for a station in setup
  const updateStationSetsCount = (index: number, delta: number) => {
    setStationConfigs(prev => {
      const updated = [...prev];
      const currentCount = updated[index].setsCount || 3;
      const newCount = Math.max(1, Math.min(10, currentCount + delta));
      updated[index] = { ...updated[index], setsCount: newCount };
      return updated;
    });
  };

  // Dynamic set insertion during active workout
  const addSetToStation = (stationIdx: number) => {
    setActiveWorkout(prev => {
      const updated = [...prev];
      const station = { ...updated[stationIdx] };
      const sets = [...station.sets];
      const lastSet = sets[sets.length - 1];
      
      const newSet = {
        setNumber: sets.length + 1,
        ...setValues(lastSet),
        completed: false
      };
      
      station.sets = [...sets, newSet];
      updated[stationIdx] = station;
      return updated;
    });
  };

  // Dynamic set removal during active workout
  const removeSetFromStation = (stationIdx: number, setIdxToRemove: number) => {
    setActiveWorkout(prev => {
      const updated = [...prev];
      const station = { ...updated[stationIdx] };
      if (station.sets.length <= 1) return prev; // Keep at least 1 set
      
      const filteredSets = station.sets
        .filter((_, idx) => idx !== setIdxToRemove)
        .map((s, idx) => ({ ...s, setNumber: idx + 1 }));
        
      station.sets = filteredSets;
      updated[stationIdx] = station;
      return updated;
    });
  };

  // Global set count mass adjustment for setup
  const setAllStationsSets = (count: number) => {
    setStationConfigs(prev => prev.map(st => ({ ...st, setsCount: count })));
  };

  // Update Set Data
  const updateSet = (stationIdx: number, setIdx: number, field: Field, deltaOrValue: number, isDelta = false) => {
    setActiveWorkout(prev => {
      const updated = [...prev];
      const station = { ...updated[stationIdx] };
      const sets = [...station.sets];
      const currentSet = { ...sets[setIdx] };

      if (isDelta) {
        const currentVal = Number(currentSet[field]) || 0;
        currentSet[field] = Math.max(0, currentVal + deltaOrValue);
      } else {
        currentSet[field] = deltaOrValue;
      }

      sets[setIdx] = currentSet;
      station.sets = sets;
      updated[stationIdx] = station;
      return updated;
    });
  };

  // Toggle Set Complete
  const toggleSetComplete = (stationIdx: number, setIdx: number) => {
    setActiveWorkout(prev => {
      const updated = [...prev];
      const station = { ...updated[stationIdx] };
      const sets = [...station.sets];
      const target = { ...sets[setIdx] };

      const newlyCompleted = !target.completed;
      target.completed = newlyCompleted;
      sets[setIdx] = target;

      if (newlyCompleted && setIdx < sets.length - 1 && !sets[setIdx + 1].completed) {
        sets[setIdx + 1] = {
          ...sets[setIdx + 1],
          ...setValues(target)
        };
      }

      station.sets = sets;
      updated[stationIdx] = station;
      return updated;
    });

    startRestTimer(60);
  };

  // Fast set duplicate action
  const copyPreviousSet = (stationIdx: number, setIdx: number) => {
    if (setIdx === 0) return;
    setActiveWorkout(prev => {
      const updated = [...prev];
      const station = { ...updated[stationIdx] };
      const sets = [...station.sets];
      const prevSet = sets[setIdx - 1];

      sets[setIdx] = {
        ...sets[setIdx],
        ...setValues(prevSet),
        completed: true
      };

      station.sets = sets;
      updated[stationIdx] = station;
      return updated;
    });
    startRestTimer(60);
  };

  // Complete Workout & Save
  const handleFinishWorkout = () => {
    let totalVolume = 0;
    let totalCompletedSets = 0;

    activeWorkout.forEach(st => {
      const countsTowardVolume = stationMeasure(st) === 'weight_reps';
      st.sets.forEach(s => {
        if (s.completed) {
          if (countsTowardVolume) {
            totalVolume += (Number(s.weight) || 0) * (Number(s.reps) || 0);
          }
          totalCompletedSets += 1;
        }
      });
    });

    const newEntry: WorkoutLog = {
      id: Date.now(),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      totalVolume,
      totalCompletedSets,
      stations: activeWorkout
    };

    const updatedHistory = [newEntry, ...history];
    setHistory(updatedHistory);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (e) {
      console.error("Failed to save workout", e);
    }

    setView('summary');
  };

  // Clipboard export
  const copySummaryToClipboard = () => {
    if (history.length === 0) return;
    const latest = history[0];
    
    let text = `🏋️‍♂️ Workout - ${latest.date}\n`;
    text += `📊 Volume: ${latest.totalVolume.toLocaleString()} lbs | ${latest.totalCompletedSets} sets completed\n\n`;

    latest.stations.forEach((st, idx) => {
      text += `Station ${idx + 1}: ${st.name}\n`;
      st.sets.forEach(s => {
        if (s.completed) {
          text += `  • Set ${s.setNumber}: ${formatSet(s, stationMeasure(st))}\n`;
        }
      });
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter options for movement chips
  const getExercisesForCategory = (cat: string, stationIdx: number): string[] => {
    if (cat === 'All') {
      const chosen = EXERCISE_LIBRARY[stationIdx % EXERCISE_LIBRARY.length];
      return chosen.exercises.slice(0, 5).map(e => e.name);
    }
    return EXERCISE_LIBRARY.find(c => c.name === cat)?.exercises.map(e => e.name) ?? [];
  };

  // Render Setup Screen
  if (view === 'setup') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between max-w-md mx-auto p-4 border-x border-slate-900 font-sans">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between my-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wide text-white">6-Station Workout Logger</h1>
                <p className="text-xs text-slate-400">Independent Sets Per Station</p>
              </div>
            </div>
            <button 
              onClick={() => setView('history')}
              className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white"
              title="Workout History"
            >
              <BarChart2 className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Global Set Preset bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 my-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Set All Stations To</span>
            </div>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              {[3, 4, 5].map(num => (
                <button
                  key={num}
                  onClick={() => setAllStationsSets(num)}
                  className="px-3 py-1 text-xs font-bold rounded-lg transition-all text-slate-400 hover:text-white hover:bg-slate-900"
                >
                  {num} Sets
                </button>
              ))}
            </div>
          </div>

          {/* Quick Routine Presets Bar */}
          <div className="mb-3">
            <div className="text-xs text-slate-400 mb-2 font-medium">Quick Preset Templates:</div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {PRESET_ROUTINES.map((routine, idx) => (
                <button
                  key={idx}
                  onClick={() => setStationConfigs(routine.exercises.map(ex => ({ ...ex })))}
                  className="whitespace-nowrap px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {routine.name}
                </button>
              ))}
            </div>
          </div>

          {/* Category Quick Filter */}
          <div className="mb-4">
            <div className="text-xs text-slate-400 mb-2 font-medium flex items-center justify-between">
              <span>Filter Quick Chips:</span>
              <span className="text-[10px] text-amber-400/80">{ALL_EXERCISES.length} Exercises Loaded</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {[{ name: 'All', short: 'All' }, ...EXERCISE_LIBRARY].map(({ name: cat, short }) => (
                <button
                  key={cat}
                  title={cat}
                  onClick={() => setActiveCategoryFilter(cat)}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    activeCategoryFilter === cat 
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {short}
                </button>
              ))}
            </div>
          </div>

          {/* 6 Stations Input Fields with Autocomplete Datalist */}
          <div className="space-y-3">
            {stationConfigs.map((config, index) => {
              const lastStat = getPreviousHistory(config.name);
              const chipOptions = getExercisesForCategory(activeCategoryFilter, index);

              return (
                <div key={index} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[10px]">
                        {index + 1}
                      </span>
                      Station {index + 1}
                    </span>

                    {/* Per-Station Custom Set Count Control */}
                    <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-0.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Sets:</span>
                      <button
                        onClick={() => updateStationSetsCount(index, -1)}
                        className="w-5 h-5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded flex items-center justify-center text-xs font-bold border border-slate-800"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-amber-400 px-1">{config.setsCount || 3}</span>
                      <button
                        onClick={() => updateStationSetsCount(index, 1)}
                        className="w-5 h-5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded flex items-center justify-center text-xs font-bold border border-slate-800"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <ExercisePicker
                    value={config.name}
                    onChange={(name) => updateStationName(index, name)}
                    placeholder={`Station ${index + 1} Movement...`}
                  />

                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                    <span>{lastStat ? `Last: ${formatSet(lastStat.set, lastStat.measure)}` : ''}</span>
                    <span className="text-slate-500">Tracks {MEASURE_LABELS[getMeasure(config.name)]}</span>
                  </div>

                  {/* Quick Select Chips from Movement Library */}
                  <div className="flex gap-1.5 overflow-x-auto mt-2 pt-0.5 no-scrollbar">
                    {chipOptions.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => updateStationName(index, item)}
                        className="whitespace-nowrap px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800/60 rounded-md text-[11px] text-slate-300 transition-colors"
                      >
                        + {item}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Start Button */}
        <div className="mt-6 pt-2 pb-4">
          <button
            onClick={handleStartWorkout}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 text-base shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            <span>START SESSION NOW</span>
          </button>
        </div>
      </div>
    );
  }

  // Active Workout View with Dynamic Per-Station Sets & Live Set Controls
  if (view === 'workout') {
    const currentStation = activeWorkout[activeStationIndex];
    const previous = getPreviousHistory(currentStation.name);
    const currentMeasure = stationMeasure(currentStation);
    const currentFields = MEASURE_FIELDS[currentMeasure];

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between max-w-md mx-auto p-4 border-x border-slate-900 font-sans relative">
        
        {/* Rest Timer Floating Bar */}
        {timerSeconds > 0 && (
          <div className="sticky top-0 z-50 mb-3 bg-amber-500 text-slate-950 p-2.5 rounded-2xl shadow-xl flex items-center justify-between border border-amber-400 animate-pulse">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span className="font-bold text-sm tracking-wide">REST TIMER</span>
            </div>
            <div className="font-black text-xl tracking-tight">
              {Math.floor(timerSeconds / 60)}:{timerSeconds % 60 < 10 ? '0' : ''}{timerSeconds % 60}
            </div>
            <button 
              onClick={() => setIsTimerRunning(false)}
              className="text-xs bg-slate-950/20 hover:bg-slate-950/40 px-2 py-1 rounded-lg font-bold"
            >
              SKIP
            </button>
          </div>
        )}

        <div>
          {/* Header Bar */}
          <div className="flex items-center justify-between mb-3">
            <button 
              onClick={() => setView('setup')}
              className="text-slate-400 hover:text-white flex items-center text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </button>
            <div className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Station {activeStationIndex + 1} of 6
            </div>
            <button
              onClick={handleFinishWorkout}
              className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
            >
              FINISH
            </button>
          </div>

          {/* Quick Station Selector Tabs (1 to 6 Grid) showing set counts */}
          <div className="grid grid-cols-6 gap-1.5 mb-4">
            {activeWorkout.map((st, i) => {
              const allDone = st.sets.length > 0 && st.sets.every(s => s.completed);
              const isCurrent = activeStationIndex === i;
              return (
                <button
                  key={i}
                  onClick={() => setActiveStationIndex(i)}
                  className={`py-2 rounded-xl text-xs font-bold border flex flex-col items-center justify-center transition-all ${
                    isCurrent 
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-105'
                      : allDone 
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>S{i + 1}</span>
                  <span className="text-[10px] opacity-80">{st.sets.length} sets</span>
                  {allDone && <Check className="w-3 h-3 mt-0.5 text-emerald-400" />}
                </button>
              );
            })}
          </div>

          {/* Current Exercise Title Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
              <Dumbbell className="w-32 h-32 text-white" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Station {activeStationIndex + 1} ({currentStation.sets.length} Sets Scheduled)
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {MEASURE_LABELS[currentMeasure]}
              </div>
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide mb-1">{currentStation.name}</h2>
            
            {/* Last Known Performance Reference */}
            {previous && (
              <div className="text-xs text-slate-400 mt-2 flex items-center gap-1 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>PR / Last Session: <strong className="text-slate-200">{formatSet(previous.set, previous.measure)}</strong></span>
              </div>
            )}
          </div>

          {/* Sets List for Current Station */}
          <div className="space-y-3">
            {currentStation.sets.map((set, setIdx) => (
              <div 
                key={setIdx}
                className={`border rounded-2xl p-3.5 transition-all ${
                  set.completed 
                    ? 'bg-slate-900/40 border-emerald-500/40 opacity-90' 
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center border ${
                      set.completed ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}>
                      {set.setNumber}
                    </span>
                    <span className="text-sm font-semibold text-slate-200">Set {set.setNumber}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {setIdx > 0 && !set.completed && (
                      <button
                        onClick={() => copyPreviousSet(activeStationIndex, setIdx)}
                        className="text-[11px] bg-slate-800 hover:bg-slate-700 text-amber-400 px-2.5 py-1 rounded-lg border border-slate-700 font-medium flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Same as Set {setIdx}
                      </button>
                    )}

                    {currentStation.sets.length > 1 && (
                      <button
                        onClick={() => removeSetFromStation(activeStationIndex, setIdx)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        title="Delete this set"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Steppers for this exercise's measurement type */}
                <div className={`grid gap-3 mb-3 ${currentFields.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {currentFields.map(field => (
                    <Stepper
                      key={field}
                      field={field}
                      value={set[field] ?? FIELD_CONFIG[field].defaultValue}
                      onSet={(v) => updateSet(activeStationIndex, setIdx, field, v)}
                      onStep={(d) => updateSet(activeStationIndex, setIdx, field, d, true)}
                    />
                  ))}
                </div>

                {/* Complete Set Action Button */}
                <button
                  onClick={() => toggleSetComplete(activeStationIndex, setIdx)}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center space-x-2 ${
                    set.completed
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md'
                  }`}
                >
                  {set.completed ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>COMPLETED</span>
                    </>
                  ) : (
                    <span>LOG SET & START REST</span>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Add Set Button for current station */}
          <button
            onClick={() => addSetToStation(activeStationIndex)}
            className="w-full mt-3 py-3 border border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl text-xs font-bold text-amber-400 hover:bg-amber-500/10 flex items-center justify-center space-x-1 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>ADD ANOTHER SET TO STATION {activeStationIndex + 1}</span>
          </button>

          {/* Quick Rest Timer Preset Buttons */}
          <div className="mt-4 bg-slate-900 border border-slate-800 rounded-2xl p-3">
            <div className="text-xs text-slate-400 font-medium mb-2 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Trigger Rest Timer:</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[45, 60, 90].map((sec) => (
                <button
                  key={sec}
                  onClick={() => startRestTimer(sec)}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 py-2 rounded-xl text-xs font-bold text-slate-300 transition-colors"
                >
                  {sec}s Rest
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Navigation Controls */}
        <div className="mt-6 flex justify-between gap-3 pb-2">
          <button
            disabled={activeStationIndex === 0}
            onClick={() => setActiveStationIndex(prev => Math.max(0, prev - 1))}
            className="flex-1 bg-slate-900 disabled:opacity-30 border border-slate-800 text-slate-300 font-bold py-3 rounded-xl text-xs"
          >
            ← PREV STATION
          </button>
          
          {activeStationIndex < 5 ? (
            <button
              onClick={() => setActiveStationIndex(prev => Math.min(5, prev + 1))}
              className="flex-1 bg-amber-500 text-slate-950 font-bold py-3 rounded-xl text-xs shadow-md"
            >
              NEXT STATION →
            </button>
          ) : (
            <button
              onClick={handleFinishWorkout}
              className="flex-1 bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl text-xs shadow-md"
            >
              FINISH SESSION 🎉
            </button>
          )}
        </div>
      </div>
    );
  }

  if (view === 'summary') {
    const latest = history[0];

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between max-w-md mx-auto p-4 border-x border-slate-900 font-sans">
        <div>
          {/* Header */}
          <div className="text-center my-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <Award className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">WORKOUT COMPLETE!</h1>
            <p className="text-xs text-slate-400">{latest?.date} • {latest?.time}</p>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-3 my-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <div className="text-xs text-slate-400 font-medium mb-1">Total Volume Lifted</div>
              <div className="text-2xl font-black text-amber-400">
                {latest?.totalVolume.toLocaleString()} <span className="text-xs font-normal">lbs</span>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <div className="text-xs text-slate-400 font-medium mb-1">Sets Completed</div>
              <div className="text-2xl font-black text-emerald-400">
                {latest?.totalCompletedSets} <span className="text-xs font-normal">sets</span>
              </div>
            </div>
          </div>

          {/* Breakdown List */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 mb-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Station Recap</h3>
            <div className="space-y-3">
              {latest?.stations.map((st, i) => (
                <div key={i} className="border-b border-slate-800/80 pb-2.5 last:border-0 last:pb-0">
                  <div className="text-sm font-bold text-slate-200">
                    Station {i + 1}: {st.name}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {st.sets.filter(s => s.completed).map((s, idx) => (
                      <span key={idx} className="text-[11px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md text-slate-300">
                        {formatSet(s, stationMeasure(st))}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Copy Summary Button */}
          <button
            onClick={copySummaryToClipboard}
            className={`w-full py-3.5 rounded-2xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center space-x-2 border ${
              copied 
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-amber-400" />}
            <span>{copied ? "COPIED TO CLIPBOARD!" : "COPY WORKOUT SUMMARY"}</span>
          </button>
        </div>

        {/* Back Home Button */}
        <div className="py-4">
          <button
            onClick={() => setView('setup')}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-4 rounded-2xl text-sm shadow-lg shadow-amber-500/20"
          >
            DONE & RETURN HOME
          </button>
        </div>
      </div>
    );
  }

  if (view === 'history') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between max-w-md mx-auto p-4 border-x border-slate-900 font-sans">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between my-3">
            <button 
              onClick={() => setView('setup')}
              className="text-slate-400 hover:text-white flex items-center text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Setup
            </button>
            <h1 className="text-base font-bold text-white">Workout History</h1>
            <div className="w-8"></div>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Dumbbell className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No saved workouts yet.</p>
              <p className="text-xs">Completed workouts will appear here automatically.</p>
            </div>
          ) : (
            <div className="space-y-4 my-4">
              {history.map((entry) => (
                <div key={entry.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800">
                    <div>
                      <div className="text-sm font-bold text-white">{entry.date}</div>
                      <div className="text-[10px] text-slate-400">{entry.time}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-amber-400">{entry.totalVolume.toLocaleString()} lbs</div>
                      <div className="text-[10px] text-slate-400">{entry.totalCompletedSets} completed sets</div>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-2">
                    {entry.stations.map((st, i) => (
                      <div key={i} className="text-xs flex justify-between text-slate-300">
                        <span className="font-medium text-slate-400">S{i+1}: {st.name}</span>
                        <span className="font-bold">
                          {st.sets.filter(s => s.completed).map(s => formatSet(s, stationMeasure(st), true)).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clear History Option */}
        {history.length > 0 && (
          <div className="py-4">
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to clear your workout history?")) {
                  setHistory([]);
                  localStorage.removeItem(STORAGE_KEY);
                }
              }}
              className="w-full text-red-400/80 hover:text-red-400 text-xs py-2 flex items-center justify-center gap-1 font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All History
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}