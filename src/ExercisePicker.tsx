import { useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { MEASURE_LABELS, searchExercises } from './exercises';

/**
 * Exercise name input with a custom suggestion dropdown. Replaces <datalist>,
 * which iOS Safari only shows as a small strip above the keyboard.
 *
 * - Tapping the field opens the full library to browse; typing filters it.
 * - Any text is accepted, so custom exercises still work.
 */
export function ExercisePicker({ value, onChange, placeholder }: {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  // Until the user types, show the whole library rather than filtering by the current name.
  const [hasTyped, setHasTyped] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const query = hasTyped ? value : '';
  const matches = useMemo(() => searchExercises(query), [query]);
  const exactMatch = matches.some(m => m.name.toLowerCase() === value.trim().toLowerCase());

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setHasTyped(false);
    inputRef.current?.blur();
  };

  const moveHighlight = (delta: number) => {
    if (matches.length === 0) return;
    const next = (highlight + delta + matches.length) % matches.length;
    setHighlight(next);
    listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else moveHighlight(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && matches[highlight]) select(matches[highlight].name);
      else select(value);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="done"
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setHasTyped(false);
          setHighlight(0);
          // Keep the dropdown visible above the iOS keyboard.
          setTimeout(() => inputRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 300);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setHasTyped(true);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={handleKeyDown}
        // text-base (16px) stops iOS Safari from zooming in when the field is focused.
        className="w-full scroll-mt-4 bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-base font-medium text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all"
      />

      {value && (
        <button
          type="button"
          aria-label="Clear exercise"
          // Prevent the input from losing focus so the list stays open after clearing.
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange('');
            setHasTyped(true);
            setOpen(true);
            inputRef.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-300"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {matches.length > 0 ? (
            <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto overscroll-contain">
              {matches.map((ex, i) => (
                <li
                  key={ex.name}
                  role="option"
                  aria-selected={i === highlight}
                  // preventDefault keeps focus in the input so onBlur doesn't close the list before the tap registers.
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => select(ex.name)}
                  onPointerEnter={() => setHighlight(i)}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer border-b border-slate-800/70 last:border-0 ${
                    i === highlight ? 'bg-slate-800' : ''
                  }`}
                >
                  <span className="text-sm text-slate-100">{ex.name}</span>
                  <span className="shrink-0 text-right leading-tight">
                    <span className="block text-[10px] font-semibold text-amber-400/90">{ex.category}</span>
                    <span className="block text-[10px] text-slate-500">{MEASURE_LABELS[ex.measure]}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {hasTyped && value.trim() && !exactMatch && (
            <div className="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-800 bg-slate-950/60">
              {matches.length === 0 ? 'No matches. ' : ''}
              “{value.trim()}” will be logged as a custom exercise (Weight × Reps).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
