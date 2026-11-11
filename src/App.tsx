import { useState, useEffect, useRef } from 'react';
import {
  Dumbbell, Play, Plus, Check, Clock, Copy,
  Trash2, BarChart2, Flame, Award, ArrowLeft,
  CheckCircle, Zap, RefreshCw, Layers
} from 'lucide-react';

type WorkoutSet = {
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
};

type Station = {
  name: string;
  sets: WorkoutSet[];
};

type StationConfig = {
  name: string;
  setsCount: number;
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

// Comprehensive Categorized Alloy Exercise Library by Movement Pattern
const EXERCISE_LIBRARY: Record<string, string[]> = {
  "Squat (Knee Dominant)": [
    "Trap Bar Squat", "DB Goblet Squat", "KB Front Squat", "Barbell Box Squat",
    "Landmine Squat", "TRX Single-Leg Squat", "DB Lateral Lunge", "DB Rear-Foot Elevated Split Squat",
    "DB Reverse Lunge", "DB Step-Up", "Barbell Back Squat", "Bodyweight Air Squat"
  ],
  "Hinge (Hip Dominant)": [
    "Trap Bar Deadlift", "KB Deadlift", "DB Romanian Deadlift (RDL)", "Single-Leg RDL",
    "KB Swing (Two-Arm)", "KB Swing (Single-Arm)", "Barbell Hip Thrust", "Slider Hamstring Curl",
    "Stability Ball Leg Curl", "Cable Pull-Through", "Good Mornings", "Glute Bridge"
  ],
  "Push (Upper Body)": [
    "DB Bench Press", "DB Incline Press", "Half-Kneeling DB Overhead Press", "Push-Ups",
    "TRX Suspension Push-Up", "Landmine Press", "DB Thrusters", "Dumbbell Shoulder Press",
    "Floor Press", "DB Z-Press", "Cable Chest Fly", "Single-Arm DB Press"
  ],
  "Pull (Upper Body)": [
    "Cable Seated Row", "DB Bent-Over Row", "2-Point DB Row", "TRX Inverted Row",
    "TRX Y-Raise", "Lat Pulldown", "Banded Pull-Up", "DB Renegade Row",
    "Single-Arm KB Row", "Face Pulls", "Chest-Supported Row", "Straight-Arm Cable Pulldown"
  ],
  "Core & Stability": [
    "Pallof Press", "Half-Kneeling Cable Chop", "Half-Kneeling Cable Lift", "Suitcase Carry",
    "Farmer's Walk", "Bear Hold DB Drag", "Stability Ball Rollout", "TRX Ab Rollout",
    "Plank with Reach", "Deadbug", "Side Plank with Row", "Russian Twist"
  ],
  "Power & Cardio": [
    "Kettlebell Clean", "Kettlebell Snatch", "Slam Ball Rainbows", "Overhead Slam Ball",
    "Skater Jumps", "Lateral Shuffles", "Battle Rope Slams", "Battle Rope Alternating Waves",
    "Box Jumps", "SkiErg Sprint", "Rowing Ergometer Sprint", "Burpees"
  ]
};

// Flattened master array for instant search matching
const ALL_EXERCISES = Object.values(EXERCISE_LIBRARY).flat();

// Quick setup preset routines with variable set counts per station
const PRESET_ROUTINES: { name: string; exercises: StationConfig[] }[] = [
  {
    name: "Full Body Balance (Alloy Standard)",
    exercises: [
      { name: "Trap Bar Deadlift", setsCount: 4 },
      { name: "DB Bench Press", setsCount: 4 },
      { name: "DB Goblet Squat", setsCount: 3 },
      { name: "Cable Seated Row", setsCount: 3 },
      { name: "Pallof Press", setsCount: 3 },
      { name: "Slam Ball Rainbows", setsCount: 2 }
    ]
  },
  {
    name: "Lower Body Focus",
    exercises: [
      { name: "Trap Bar Squat", setsCount: 4 },
      { name: "Single-Leg RDL", setsCount: 3 },
      { name: "DB Reverse Lunge", setsCount: 3 },
      { name: "KB Swing (Two-Arm)", setsCount: 4 },
      { name: "Suitcase Carry", setsCount: 3 },
      { name: "Skater Jumps", setsCount: 2 }
    ]
  },
  {
    name: "Upper Body Focus",
    exercises: [
      { name: "DB Incline Press", setsCount: 4 },
      { name: "TRX Inverted Row", setsCount: 4 },
      { name: "Landmine Press", setsCount: 3 },
      { name: "Lat Pulldown", setsCount: 3 },
      { name: "Push-Ups", setsCount: 3 },
      { name: "Battle Rope Slams", setsCount: 2 }
    ]
  }
];

export default function App() {
  // Navigation State: 'setup' | 'workout' | 'summary' | 'history'
  const [view, setView] = useState<View>('setup');
  
  // Selected Category filter for quick picker: 'All' | category string
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('All');
  
  // Setup State - Array of 6 station configurations (name + independent sets count)
  const [stationConfigs, setStationConfigs] = useState<StationConfig[]>([
    { name: "Trap Bar Deadlift", setsCount: 4 },
    { name: "DB Bench Press", setsCount: 4 },
    { name: "DB Goblet Squat", setsCount: 3 },
    { name: "Cable Seated Row", setsCount: 3 },
    { name: "Pallof Press", setsCount: 3 },
    { name: "Slam Ball Rainbows", setsCount: 2 }
  ]);

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
      const saved = localStorage.getItem('alloy_workout_history');
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
        return { date: workout.date, weight: lastSet.weight, reps: lastSet.reps };
      }
    }
    return null;
  };

  // Start Workout Initialization with Independent Per-Station Set Counts
  const handleStartWorkout = () => {
    const initialized = stationConfigs.map(config => {
      const prev = getPreviousHistory(config.name);
      const initialWeight = prev ? prev.weight : 25;
      const initialReps = prev ? prev.reps : 10;
      const count = config.setsCount || 3;
      
      const sets = Array.from({ length: count }, (_, i) => ({
        setNumber: i + 1,
        weight: initialWeight,
        reps: initialReps,
        completed: false
      }));

      return {
        name: config.name,
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
        weight: lastSet ? lastSet.weight : 25,
        reps: lastSet ? lastSet.reps : 10,
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
  const updateSet = (stationIdx: number, setIdx: number, field: 'weight' | 'reps', deltaOrValue: number, isDelta = false) => {
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
          weight: target.weight,
          reps: target.reps
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
        weight: prevSet.weight,
        reps: prevSet.reps,
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
      st.sets.forEach(s => {
        if (s.completed) {
          totalVolume += (Number(s.weight) || 0) * (Number(s.reps) || 0);
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
      localStorage.setItem('alloy_workout_history', JSON.stringify(updatedHistory));
    } catch (e) {
      console.error("Failed to save workout", e);
    }

    setView('summary');
  };

  // Clipboard export
  const copySummaryToClipboard = () => {
    if (history.length === 0) return;
    const latest = history[0];
    
    let text = `🏋️‍♂️ Alloy Workout - ${latest.date}\n`;
    text += `📊 Volume: ${latest.totalVolume.toLocaleString()} lbs | ${latest.totalCompletedSets} sets completed\n\n`;

    latest.stations.forEach((st, idx) => {
      text += `Station ${idx + 1}: ${st.name}\n`;
      st.sets.forEach(s => {
        if (s.completed) {
          text += `  • Set ${s.setNumber}: ${s.weight} lbs × ${s.reps} reps\n`;
        }
      });
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter options for movement chips
  const getExercisesForCategory = (cat: string, stationIdx: number) => {
    if (cat === 'All') {
      const keys = Object.keys(EXERCISE_LIBRARY);
      const chosenKey = keys[stationIdx % keys.length];
      return EXERCISE_LIBRARY[chosenKey].slice(0, 5);
    }
    return EXERCISE_LIBRARY[cat] || [];
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
                <h1 className="text-xl font-bold tracking-wide text-white">Alloy 6-Station Logger</h1>
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
              {['All', ...Object.keys(EXERCISE_LIBRARY)].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategoryFilter(cat)}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    activeCategoryFilter === cat 
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {cat.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* 6 Stations Input Fields with Autocomplete Datalist */}
          <datalist id="exercise-master-list">
            {ALL_EXERCISES.map((ex, i) => (
              <option key={i} value={ex} />
            ))}
          </datalist>

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

                  <input
                    type="text"
                    list="exercise-master-list"
                    value={config.name}
                    onChange={(e) => updateStationName(index, e.target.value)}
                    placeholder={`Station ${index + 1} Movement...`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all"
                  />

                  {lastStat && (
                    <div className="mt-1 text-[10px] text-slate-400">
                      PR: {lastStat.weight}lbs × {lastStat.reps}
                    </div>
                  )}

                  {/* Quick Select Chips from Movement Library */}
                  <div className="flex gap-1.5 overflow-x-auto mt-2 pt-0.5 no-scrollbar">
                    {chipOptions.slice(0, 4).map((item, i) => (
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
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide mb-1">{currentStation.name}</h2>
            
            {/* Last Known Performance Reference */}
            {previous && (
              <div className="text-xs text-slate-400 mt-2 flex items-center gap-1 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>PR / Last Session: <strong className="text-slate-200">{previous.weight} lbs × {previous.reps} reps</strong></span>
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

                {/* Weight & Reps Stepper Controls */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {/* Weight Input Box */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Weight (lbs)</div>
                    <div className="flex items-center justify-between">
                      <input
                        type="number"
                        value={set.weight}
                        onChange={(e) => updateSet(activeStationIndex, setIdx, 'weight', Number(e.target.value))}
                        className="w-16 bg-transparent text-xl font-bold text-white focus:outline-none"
                      />
                      <div className="flex space-x-1">
                        <button
                          onClick={() => updateSet(activeStationIndex, setIdx, 'weight', -5, true)}
                          className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
                        >
                          -5
                        </button>
                        <button
                          onClick={() => updateSet(activeStationIndex, setIdx, 'weight', 5, true)}
                          className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
                        >
                          +5
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reps Input Box */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Reps</div>
                    <div className="flex items-center justify-between">
                      <input
                        type="number"
                        value={set.reps}
                        onChange={(e) => updateSet(activeStationIndex, setIdx, 'reps', Number(e.target.value))}
                        className="w-16 bg-transparent text-xl font-bold text-white focus:outline-none"
                      />
                      <div className="flex space-x-1">
                        <button
                          onClick={() => updateSet(activeStationIndex, setIdx, 'reps', -1, true)}
                          className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
                        >
                          -1
                        </button>
                        <button
                          onClick={() => updateSet(activeStationIndex, setIdx, 'reps', 1, true)}
                          className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                  </div>
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
                        {s.weight}lbs × {s.reps}
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
                          {st.sets.filter(s => s.completed).map(s => `${s.weight}×${s.reps}`).join(', ')}
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
                  localStorage.removeItem('alloy_workout_history');
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