import { useCallback, useContext, useEffect, useMemo, useState, createContext, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  Activity, ArrowLeft, ArrowRight, Bell, Bike, CalendarDays, Check, CheckCircle2, ChevronDown,
  CircleHelp, Clock3, Cloud, CloudSun, Dumbbell, Flame, Gauge, Globe2, HeartPulse, House,
  Info, Leaf, Menu, Moon, MoreHorizontal, Pause, Play, Plus, RefreshCw, RotateCcw, Settings2,
  ShieldCheck, SkipBack, SkipForward, SlidersHorizontal, Sparkles, Sun, Target, TimerReset,
  Trophy, UserRound, Volume2, Waves, X, Zap,
} from 'lucide-react';
import NotFound from '@/pages/not-found';
import { goals, mealSets, workouts, type Exercise, type Goal, type View, type Workout } from './data/shadowfit';

const queryClient = new QueryClient();
const STORE_KEY = 'shadowfit-local-v1';

type HistoryEntry = { id: string; workoutId: string; name: string; date: string; minutes: number; sets: number };
type ActiveSession = {
  workoutId: string;
  current: number;
  completed: Record<string, number[]>;
  started: boolean;
  paused: boolean;
  restSeconds: number;
};
type AppState = {
  onboarded: boolean;
  name: string;
  goal: Goal;
  favoriteWorkout: string;
  active: ActiveSession | null;
  history: HistoryEntry[];
  timerDefault: number;
  customRest: number;
  reminder: string;
  hydrationReminder: string;
  mealReminder: string;
  units: 'metric' | 'imperial';
  theme: 'dark' | 'light';
  notifications: string;
  hydration: number;
  mealOffsets: number[];
  weatherLabel: string;
  weatherTemp: string;
  weatherCondition: string;
  weatherRecommendation: string;
};

const defaultState: AppState = {
  onboarded: false, name: 'Athlete', goal: 'strength', favoriteWorkout: 'beginner-full-body',
  active: null, history: [], timerDefault: 60, customRest: 75, reminder: '18:30', hydrationReminder: '10:00', mealReminder: '12:30', units: 'metric',
  theme: 'dark', notifications: 'Not requested', hydration: 3, mealOffsets: [0, 0, 0, 0],
  weatherLabel: 'Indoor is always on', weatherTemp: '—', weatherCondition: 'Manual fallback', weatherRecommendation: 'Indoor workout recommended.',
};

function readState(): AppState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState;
    const saved = JSON.parse(raw) as Partial<AppState>;
    return {
      ...defaultState,
      ...saved,
      hydrationReminder: saved.hydrationReminder ?? defaultState.hydrationReminder,
      mealReminder: saved.mealReminder ?? defaultState.mealReminder,
      weatherCondition: saved.weatherCondition ?? defaultState.weatherCondition,
      weatherRecommendation: saved.weatherRecommendation ?? defaultState.weatherRecommendation,
    };
  } catch { return defaultState; }
}

function currentStreak(history: HistoryEntry[]) {
  const completedDays = new Set(history.map((item) => new Date(item.date).toDateString()));
  const cursor = new Date();
  if (!completedDays.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (completedDays.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

type AppContextValue = { state: AppState; update: (patch: Partial<AppState>) => void; reset: () => void };
const AppContext = createContext<AppContextValue | null>(null);
function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('ShadowFit app context unavailable');
  return context;
}

function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(readState);
  const update = useCallback((patch: Partial<AppState>) => setState((old) => ({ ...old, ...patch })), []);
  const reset = useCallback(() => setState({ ...defaultState, onboarded: true }), []);
  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { document.documentElement.classList.toggle('light', state.theme === 'light'); }, [state.theme]);
  return <AppContext.Provider value={{ state, update, reset }}>{children}</AppContext.Provider>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-2.5" data-testid="brand-shadowfit">
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Zap size={17} strokeWidth={3} /></span>
    {!compact && <span className="font-display text-[15px] font-bold tracking-[.18em]">SHADOW<span className="text-primary">FIT</span></span>}
  </div>;
}

const navItems: Array<{ href: string; label: string; icon: typeof House; view: View }> = [
  { href: '/', label: 'Today', icon: House, view: 'today' },
  { href: '/workout', label: 'Workout', icon: Dumbbell, view: 'workout' },
  { href: '/progress', label: 'Progress', icon: Activity, view: 'progress' },
  { href: '/nutrition', label: 'Fuel', icon: Leaf, view: 'nutrition' },
  { href: '/settings', label: 'Settings', icon: SlidersHorizontal, view: 'settings' },
];

function Shell({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const [location] = useLocation();
  const active = location === '/' ? 'today' : (location.slice(1) as View);
  return <div className="app-shell noise min-h-[100dvh]">
    <aside className="desktop-sidebar fixed inset-y-0 left-0 z-10 w-[238px] flex-col border-r border-border/70 bg-background/75 px-5 py-7 backdrop-blur-xl">
      <Logo />
      <div className="mt-12">
        <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[.22em] text-muted-foreground">Your ritual</p>
        <nav className="space-y-1" aria-label="Primary navigation">
          {navItems.map(({ href, label, icon: Icon, view }) => <Link key={view} href={href} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition ${active === view ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`} data-testid={`link-nav-${view}`}>
            <Icon size={17} strokeWidth={active === view ? 2.5 : 1.8} /><span>{label}</span>
            {active === view && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current" />}
          </Link>)}
        </nav>
      </div>
      <div className="mt-auto">
        <div className="rounded-2xl border border-primary/20 bg-primary/[.07] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Quiet work</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Consistency is a skill. Show up small, then show up again.</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold"><Flame size={14} className="text-accent" /> <span>{currentStreak(state.history)} day streak</span></div>
        </div>
        <p className="mt-5 px-1 font-mono text-[10px] text-muted-foreground/60">v1.0 · local by default</p>
      </div>
    </aside>
    <main className="mx-auto min-h-[100dvh] max-w-[1240px] px-4 pb-28 pt-5 sm:px-7 md:ml-[238px] md:px-10 md:pb-12 md:pt-8">{children}</main>
    <nav className="mobile-nav safe-bottom fixed inset-x-0 bottom-0 z-20 items-center justify-around border-t border-border/80 bg-background/90 px-2 pt-2 backdrop-blur-xl" aria-label="Mobile navigation">
      {navItems.map(({ href, label, icon: Icon, view }) => <Link key={view} href={href} className={`flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold ${active === view ? 'text-primary' : 'text-muted-foreground'}`} data-testid={`link-mobile-nav-${view}`}>
        <Icon size={19} strokeWidth={active === view ? 2.5 : 1.8} /><span>{label}</span>
      </Link>)}
    </nav>
  </div>;
}

function Topbar({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  const { state } = useApp();
  return <header className="mb-7 flex items-start justify-between gap-3">
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{eyebrow}</p>
      <h1 className="font-display mt-2 text-[30px] font-bold leading-none tracking-[-.045em] sm:text-[38px]" data-testid="text-page-title">{title}</h1>
    </div>
    <div className="flex items-center gap-2">
      {action}
      <div className="hidden h-9 items-center gap-2 rounded-full border border-border bg-card px-3 sm:flex">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-secondary"><UserRound size={12} /></span>
        <span className="text-xs font-semibold">{state.name}</span>
      </div>
    </div>
  </header>;
}

function Pill({ children, color = 'muted' }: { children: ReactNode; color?: 'muted' | 'volt' | 'orange' }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.12em] ${color === 'volt' ? 'bg-primary/15 text-primary' : color === 'orange' ? 'bg-accent/15 text-accent' : 'bg-secondary text-muted-foreground'}`}>{children}</span>;
}

function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return <div className={`progress-track h-2 ${className}`}><div className="progress-fill h-full" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

function Onboarding() {
  const { update } = useApp();
  const [name, setName] = useState('Athlete');
  const [goal, setGoal] = useState<Goal>('strength');
  const [step, setStep] = useState(0);
  const complete = () => update({ name: name.trim() || 'Athlete', goal, onboarded: true });
  return <div className="app-shell noise min-h-[100dvh] px-5 py-8 sm:px-10">
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[1040px] flex-col">
      <Logo />
      <div className="my-auto grid gap-12 py-16 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
        <div className="page-enter">
          <Pill color="volt">Set your baseline</Pill>
          <h1 className="font-display mt-6 max-w-[530px] text-5xl font-bold leading-[.93] tracking-[-.07em] sm:text-7xl">Train in the <span className="text-primary">quiet.</span></h1>
          <p className="mt-6 max-w-[450px] text-sm leading-7 text-muted-foreground">ShadowFit is a focused calisthenics ritual for the days you want to get stronger without making a production of it.</p>
          <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground"><ShieldCheck size={15} className="text-primary" /> Everything stays on this device.</div>
        </div>
        <div className="card page-enter p-5 sm:p-7" style={{ animationDelay: '.08s' }}>
          <div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">0{step + 1} / 02</span><div className="flex gap-1"><span className={`h-1 w-9 rounded-full ${step >= 0 ? 'bg-primary' : 'bg-secondary'}`} /><span className={`h-1 w-9 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-secondary'}`} /></div></div>
          {step === 0 ? <div className="mt-8">
            <h2 className="font-display text-2xl font-bold tracking-tight">What should we protect?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Pick the reason you want to keep coming back.</p>
            <label className="mt-7 block text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground" htmlFor="onboarding-name">Your name</label>
            <input id="onboarding-name" data-testid="input-onboarding-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm outline-none focus:border-primary" />
            <div className="mt-5 space-y-2">
              {goals.map((item) => <button key={item.id} type="button" onClick={() => setGoal(item.id)} data-testid={`button-goal-${item.id}`} className={`pressable flex w-full items-center gap-4 rounded-xl border p-4 text-left ${goal === item.id ? 'selection-ring border-primary bg-primary/[.08]' : 'border-border bg-secondary/40'}`}>
                <span className={`font-mono text-xs ${goal === item.id ? 'text-primary' : 'text-muted-foreground'}`}>{item.mark}</span><span className="flex-1"><strong className="block text-sm">{item.label}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span></span>{goal === item.id && <Check size={17} className="text-primary" />}
              </button>)}
            </div>
            <button type="button" onClick={() => setStep(1)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground pressable" data-testid="button-onboarding-next">Continue <ArrowRight size={16} /></button>
          </div> : <div className="mt-8">
            <div className="grid h-28 place-items-center rounded-2xl bg-primary/[.08]"><div className="text-center"><Flame className="mx-auto text-primary" size={25} /><p className="mt-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary">Your first week starts now</p></div></div>
            <h2 className="font-display mt-8 text-2xl font-bold tracking-tight">A small promise.</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">We’ll keep your sessions, progress, and preferences right here. No account. No noise. Just the next useful thing.</p>
            <div className="mt-6 space-y-3 text-sm"><div className="flex gap-3"><CheckCircle2 size={17} className="shrink-0 text-primary" /> Starter workouts ready for today</div><div className="flex gap-3"><CheckCircle2 size={17} className="shrink-0 text-primary" /> A progress log that lives offline</div><div className="flex gap-3"><CheckCircle2 size={17} className="shrink-0 text-primary" /> No notifications unless you ask</div></div>
            <button type="button" onClick={complete} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground pressable" data-testid="button-onboarding-finish">Enter ShadowFit <ArrowRight size={16} /></button>
            <button type="button" onClick={() => setStep(0)} className="mt-3 w-full py-2 text-xs text-muted-foreground" data-testid="button-onboarding-back">Back</button>
          </div>}
        </div>
      </div>
    </div>
  </div>;
}

function useWeather() {
  const { state, update } = useApp();
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState('');
  const request = () => {
    if (!navigator.geolocation) { update({ weatherLabel: 'Location unavailable', weatherCondition: 'Manual fallback', weatherRecommendation: 'Indoor workout recommended.' }); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weather_code&temperature_unit=celsius`);
        const data = await response.json();
        const temperature = Math.round(data.current?.temperature_2m ?? 0);
        const code = Number(data.current?.weather_code ?? 99);
        const condition = code === 0 ? 'Clear skies' : code <= 3 ? 'Partly cloudy' : code <= 67 ? 'Rain nearby' : code <= 77 ? 'Snow nearby' : code <= 82 ? 'Showers nearby' : 'Storm conditions';
        const outdoor = code <= 3 && temperature >= 10 && temperature <= 30;
        update({ weatherLabel: 'Location ready', weatherTemp: `${temperature}°`, weatherCondition: condition, weatherRecommendation: outdoor ? 'Outdoor workout recommended.' : 'Indoor workout recommended.' });
      } catch { update({ weatherLabel: 'Weather unavailable', weatherCondition: 'Manual fallback', weatherRecommendation: 'Indoor workout recommended.' }); }
      setLoading(false);
    }, () => { update({ weatherLabel: 'Permission needed', weatherCondition: 'Manual fallback', weatherRecommendation: 'Indoor workout recommended.' }); setLoading(false); });
  };
  const saveManual = () => { if (manual.trim()) update({ weatherLabel: manual.trim(), weatherTemp: '—', weatherCondition: 'Manual check', weatherRecommendation: 'Choose indoor or outdoor based on conditions.' }); };
  return { state, loading, manual, setManual, request, saveManual };
}

function Today() {
  const { state, update } = useApp();
  const { state: weather, loading, manual, setManual, request, saveManual } = useWeather();
  const workout = workouts.find((item) => item.id === state.favoriteWorkout) ?? workouts[0];
  const streak = currentStreak(state.history);
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const todayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date());
  return <div className="page-enter">
    <Topbar eyebrow={todayLabel} title={`Good morning, ${state.name}.`} action={<button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-secondary" data-testid="button-today-more"><MoreHorizontal size={17} /></button>} />
    <div className="grid gap-4 lg:grid-cols-[1.45fr_.8fr]">
      <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary p-6 text-primary-foreground sm:p-8">
        <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[34px] border-primary-foreground/10" /><div className="absolute -bottom-24 right-10 h-48 w-48 rounded-full border border-primary-foreground/10" />
        <div className="relative">
          <div className="flex items-center justify-between"><Pill color="muted">Today’s session</Pill><span className="font-mono text-xs opacity-60">{workout.duration}</span></div>
          <h2 className="font-display mt-12 max-w-[470px] text-4xl font-bold leading-[.94] tracking-[-.06em] sm:text-6xl">{workout.name}</h2>
          <p className="mt-4 max-w-[360px] text-sm leading-6 opacity-75">{workout.description}</p>
          <div className="mt-8 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-primary-foreground/15 px-3 py-1.5">{workout.exercises.length} movements</span><span className="rounded-full bg-primary-foreground/15 px-3 py-1.5">{workout.focus}</span></div>
          <Link href="/workout" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary-foreground px-5 py-3 text-sm font-bold text-primary-foreground/90 pressable" style={{ color: 'hsl(var(--primary))' }} data-testid="link-start-today">Start session <ArrowRight size={16} /></Link>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <section className="card p-5"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Current streak</p><p className="font-display mt-3 text-4xl font-bold tracking-[-.06em]" data-testid="text-streak">{streak}<span className="ml-2 text-base font-semibold tracking-normal text-muted-foreground">days</span></p></div><div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent"><Flame size={20} /></div></div><div className="mt-5 flex gap-1.5">{days.map((day, index) => <div key={`${day}-${index}`} className="flex flex-1 flex-col items-center gap-1.5"><span className={`h-1.5 w-full rounded-full ${index < Math.min(7, streak) ? 'bg-primary' : 'bg-secondary'}`} /><span className="font-mono text-[9px] text-muted-foreground">{day}</span></div>)}</div></section>
        <section className="card p-5"><div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Weekly target</p><Target size={17} className="text-primary" /></div><div className="mt-3 flex items-end justify-between"><p className="font-display text-4xl font-bold tracking-[-.06em]">{Math.min(100, state.history.length * 17)}<span className="text-xl">%</span></p><span className="mb-1 text-xs text-muted-foreground">{state.history.length} / 6 sessions</span></div><ProgressBar value={state.history.length * 17} className="mt-4" /></section>
      </div>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
       <section className="card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Outside / inside</p><h3 className="font-display mt-2 text-xl font-bold">Choose your room.</h3></div><CloudSun className="text-primary" size={23} /></div><div className="mt-5 rounded-xl bg-secondary/60 p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-card"><Cloud size={19} className="text-muted-foreground" /></div><div className="flex-1"><p className="text-sm font-semibold" data-testid="text-weather-label">{weather.weatherLabel}</p><p className="mt-1 text-xs text-muted-foreground">{weather.weatherCondition} · {weather.weatherRecommendation}</p></div><span className="font-display text-2xl font-bold">{weather.weatherTemp}</span></div></div><div className="mt-4 flex gap-2"><button type="button" onClick={request} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-secondary py-2.5 text-xs font-semibold hover:bg-secondary/80" data-testid="button-use-location"><Globe2 size={14} /> {loading ? 'Checking…' : 'Use location'}</button><div className="flex flex-1 overflow-hidden rounded-lg border border-border"><input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="City fallback" className="min-w-0 flex-1 bg-transparent px-3 text-xs outline-none" data-testid="input-weather-city" /><button type="button" onClick={saveManual} className="px-3 text-primary" data-testid="button-save-weather"><Check size={14} /></button></div></div></section>
      <section className="card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Fuel note</p><h3 className="font-display mt-2 text-xl font-bold">Eat for the work.</h3></div><Leaf className="text-primary" size={23} /></div><p className="mt-5 text-[15px] leading-7 text-muted-foreground">Keep today simple: <span className="font-semibold text-foreground">protein at every meal</span>, a little more water than yesterday, and enough carbs to train without negotiating.</p><div className="mt-5 flex items-center justify-between rounded-xl border border-border px-4 py-3"><div className="flex items-center gap-3"><Waves size={17} className="text-primary" /><span className="text-xs font-semibold">Hydration</span></div><div className="flex gap-1.5">{[0, 1, 2, 3, 4].map((i) => <button key={i} type="button" onClick={() => update({ hydration: i + 1 })} className={`h-7 w-5 rounded-md border ${i < state.hydration ? 'border-primary bg-primary/20' : 'border-border bg-secondary'}`} aria-label={`Mark water ${i + 1}`} data-testid={`button-water-${i + 1}`} />)}</div><span className="font-mono text-[10px] text-muted-foreground">{state.hydration}/5</span></div></section>
    </div>
    <div className="mt-4 flex items-center justify-between rounded-xl border border-border/70 bg-card/50 px-4 py-3"><div className="flex items-center gap-3"><Sparkles size={16} className="text-primary" /><span className="text-xs text-muted-foreground">The goal is not to crush yourself. It’s to become harder to stop.</span></div><Link href="/progress" className="hidden text-xs font-semibold text-primary sm:block" data-testid="link-view-progress">View progress</Link></div>
  </div>;
}

function WorkoutCard({ workout, selected, onSelect }: { workout: Workout; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className={`pressable min-w-[204px] rounded-xl border p-4 text-left ${selected ? 'selection-ring border-primary bg-primary/[.08]' : 'border-border bg-card hover:bg-secondary/50'}`} data-testid={`button-select-workout-${workout.id}`}>
    <div className="flex items-center justify-between"><Pill color={selected ? 'volt' : 'muted'}>{workout.level}</Pill><span className="font-mono text-[10px] text-muted-foreground">{workout.duration}</span></div><h3 className="font-display mt-7 text-lg font-bold tracking-tight">{workout.name}</h3><p className="mt-1 text-xs text-muted-foreground">{workout.focus}</p><div className="mt-5 flex items-center gap-1.5 text-[10px] text-muted-foreground"><Dumbbell size={12} /> {workout.exercises.length} exercises</div>
  </button>;
}

function SessionPanel({ workout }: { workout: Workout }) {
  const { state, update } = useApp();
  const [location, setLocation] = useLocation();
  const active = state.active?.workoutId === workout.id ? state.active : { workoutId: workout.id, current: 0, completed: {}, started: false, paused: false, restSeconds: state.timerDefault };
  const [rest, setRest] = useState(active.restSeconds);
  const [custom, setCustom] = useState(state.customRest);
  const currentExercise = workout.exercises[active.current] ?? workout.exercises[0];
  useEffect(() => { setRest(active.restSeconds); }, [active.restSeconds]);
  useEffect(() => {
    if (!active.started || active.paused || rest <= 0) return;
    const timer = window.setInterval(() => setRest((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [active.started, active.paused, rest]);
  const persist = (patch: Partial<ActiveSession>) => update({ active: { ...active, ...patch } });
  const start = () => persist({ started: true, paused: false });
  const togglePause = () => persist({ paused: !active.paused });
  const toggleSet = (exercise: Exercise, setIndex: number) => {
    const existing = active.completed[exercise.id] ?? [];
    const next = existing.includes(setIndex) ? existing.filter((item) => item !== setIndex) : [...existing, setIndex];
    persist({ completed: { ...active.completed, [exercise.id]: next }, started: true, paused: false, restSeconds: exercise.rest });
    setRest(exercise.rest);
  };
  const finish = () => {
    const sets = Object.values(active.completed).reduce((sum, values) => sum + values.length, 0);
    if (!sets) { window.alert('Complete at least one set before finishing.'); return; }
    update({ active: null, history: [{ id: `${Date.now()}`, workoutId: workout.id, name: workout.name, date: new Date().toISOString(), minutes: parseInt(workout.duration, 10), sets }, ...state.history] });
    setLocation('/progress');
  };
  const setCurrent = (next: number) => persist({ current: Math.max(0, Math.min(workout.exercises.length - 1, next)) });
  const completedSets = Object.values(active.completed).reduce((sum, values) => sum + values.length, 0);
  const totalSets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const completedExercises = workout.exercises.filter((exercise) => (active.completed[exercise.id] ?? []).length === exercise.sets).length;
  const isComplete = completedSets === totalSets;
  const formatTimer = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  return <section className="card overflow-hidden">
    <div className="border-b border-border p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Pill color="volt">{workout.level}</Pill><span className="text-xs text-muted-foreground">{workout.focus}</span></div><h2 className="font-display mt-3 text-3xl font-bold tracking-[-.05em]">{workout.name}</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">{workout.description}</p></div><div className="text-right"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Checklist</p><p className="font-display mt-1 text-3xl font-bold">{completedExercises}<span className="text-base text-muted-foreground">/{workout.exercises.length}</span></p><p className="mt-1 text-[10px] text-muted-foreground">exercises complete</p></div></div><ProgressBar value={(completedSets / totalSets) * 100} className="mt-6" /></div>
    <div className="grid lg:grid-cols-[1.2fr_.8fr]">
      <div className="border-b border-border p-5 sm:p-7 lg:border-b-0 lg:border-r">
        <div className="mb-5 flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Exercise {active.current + 1} / {workout.exercises.length}</p><div className="flex gap-1.5"><button type="button" disabled={active.current === 0} onClick={() => setCurrent(active.current - 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-muted-foreground disabled:opacity-30" data-testid="button-exercise-previous"><SkipBack size={15} /></button><button type="button" disabled={active.current === workout.exercises.length - 1} onClick={() => setCurrent(active.current + 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-muted-foreground disabled:opacity-30" data-testid="button-exercise-next"><SkipForward size={15} /></button></div></div>
        <div className="rounded-2xl bg-secondary/60 p-5"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><Dumbbell size={21} /></span><Pill color="orange">{currentExercise.tag}</Pill></div><h3 className="font-display mt-8 text-2xl font-bold">{currentExercise.name}</h3><p className="mt-1 text-sm text-muted-foreground">{currentExercise.cue}</p><div className="mt-6 flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Target</p><p className="mt-1 text-lg font-bold">{currentExercise.sets} × {currentExercise.reps}</p></div><div className="text-right"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Rest</p><p className="mt-1 text-lg font-bold">{currentExercise.rest}s</p></div></div></div>
        <div className="mt-5 space-y-2">{Array.from({ length: currentExercise.sets }).map((_, index) => { const done = (active.completed[currentExercise.id] ?? []).includes(index); return <button type="button" key={index} onClick={() => toggleSet(currentExercise, index)} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${done ? 'border-primary/40 bg-primary/[.08]' : 'border-border bg-card hover:bg-secondary/40'}`} data-testid={`button-toggle-set-${currentExercise.id}-${index + 1}`}><span className={`grid h-7 w-7 place-items-center rounded-lg border font-mono text-xs ${done ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>{done ? <Check size={14} /> : index + 1}</span><span className={`text-sm font-semibold ${done ? 'text-primary' : ''}`}>Set {index + 1}</span><span className="ml-auto text-xs text-muted-foreground">{currentExercise.reps}</span></button>; })}</div>
         <div className="mt-6 flex flex-wrap gap-2"><button type="button" onClick={active.started ? togglePause : start} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground pressable" data-testid="button-workout-start-pause">{active.started && !active.paused ? <Pause size={16} /> : <Play size={16} />}{active.started && !active.paused ? 'Pause' : active.paused ? 'Resume' : 'Start workout'}</button><button type="button" onClick={() => setCurrent(active.current + 1)} disabled={active.current === workout.exercises.length - 1} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-40" data-testid="button-skip-exercise">Skip exercise</button><button type="button" onClick={finish} className={`rounded-xl px-4 py-3 text-sm font-semibold hover:bg-secondary ${isComplete ? 'bg-primary/15 text-primary' : 'border border-border text-muted-foreground'}`} data-testid="button-workout-finish">{isComplete ? 'Finish workout' : 'Finish early'}</button></div><p className={`mt-3 text-xs ${isComplete ? 'text-primary' : 'text-muted-foreground'}`}>{isComplete ? 'Workout complete — ready to log.' : 'Complete every set for a full session.'}</p>
      </div>
      <div className="p-5 sm:p-7"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Rest timer</p><p className="mt-1 text-sm text-muted-foreground">{active.paused ? 'Paused' : rest > 0 && active.started ? 'Breathe. Stay ready.' : 'Ready for your next set.'}</p></div><TimerReset size={19} className="text-primary" /></div><div className="my-8 text-center"><p className={`font-mono text-6xl font-medium tracking-[-.08em] ${rest > 0 && active.started ? 'text-primary' : ''}`} data-testid="text-rest-timer">{formatTimer(rest)}</p><div className="mx-auto mt-4 h-1 max-w-[190px] overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${active.started ? Math.min(100, (rest / Math.max(1, active.restSeconds)) * 100) : 0}%` }} /></div></div><div className="grid grid-cols-4 gap-1.5">{[30, 60, 90, 120].map((seconds) => <button type="button" key={seconds} onClick={() => { setRest(seconds); persist({ restSeconds: seconds }); }} className={`rounded-lg py-2 text-[11px] font-semibold ${active.restSeconds === seconds ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`} data-testid={`button-rest-${seconds}`}>{seconds}s</button>)}</div><div className="mt-2 flex gap-2"><input type="number" min={10} max={600} value={custom} onChange={(e) => setCustom(Number(e.target.value))} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-xs outline-none" aria-label="Custom rest seconds" data-testid="input-custom-rest" /><button type="button" onClick={() => { setRest(custom); update({ customRest: custom }); persist({ restSeconds: custom }); }} className="rounded-lg border border-border px-3 text-xs font-semibold hover:bg-secondary" data-testid="button-custom-rest">Set</button></div><button type="button" onClick={() => { setRest(0); persist({ restSeconds: 0 }); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary" data-testid="button-skip-rest"><SkipForward size={14} /> Skip rest</button><div className="mt-8 border-t border-border pt-5"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Quick note</p><p className="mt-2 text-xs leading-5 text-muted-foreground">You can leave a set incomplete. A useful session beats a perfect plan you never start.</p></div></div>
    </div>
  </section>;
}

function WorkoutPage() {
  const { state, update } = useApp();
  const selected = workouts.find((item) => item.id === state.favoriteWorkout) ?? workouts[0];
  return <div className="page-enter"><Topbar eyebrow="The work" title="Workout" action={<Link href="/" className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground sm:flex" data-testid="link-workout-home"><House size={14} /> Today</Link>} /><section><div className="mb-3 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Choose your session</p><p className="mt-1 text-sm text-muted-foreground">No equipment. No filler.</p></div><span className="font-mono text-[10px] text-muted-foreground">{workouts.length} ready</span></div><div className="scrollbar-hide -mx-1 flex gap-3 overflow-x-auto px-1 pb-4">{workouts.map((workout) => <WorkoutCard key={workout.id} workout={workout} selected={workout.id === selected.id} onSelect={() => update({ favoriteWorkout: workout.id, active: state.active?.workoutId === workout.id ? state.active : null })} />)}</div></section><SessionPanel workout={selected} /></div>;
}

function Progress() {
  const { state } = useApp();
  const totalMinutes = state.history.reduce((sum, item) => sum + item.minutes, 0);
  const totalSets = state.history.reduce((sum, item) => sum + item.sets, 0);
  const weekValues = [0, 0, 0, 0, 0, 0, 0]; state.history.slice(0, 20).forEach((item) => { const day = (new Date(item.date).getDay() + 6) % 7; weekValues[day] += item.minutes; });
  const max = Math.max(30, ...weekValues);
  const exerciseCounts = state.history.reduce<Record<string, number>>((acc, item) => { acc[item.name] = (acc[item.name] ?? 0) + item.sets; return acc; }, {});
  const prs = Object.entries(exerciseCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const streak = currentStreak(state.history);
  return <div className="page-enter"><Topbar eyebrow="Proof of work" title="Progress" action={<button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground" data-testid="button-progress-filter"><CalendarDays size={16} /></button>} /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Sessions" value={String(state.history.length)} icon={<Dumbbell size={17} />} /><Metric label="Minutes" value={String(totalMinutes)} icon={<Clock3 size={17} />} /><Metric label="Sets moved" value={String(totalSets)} icon={<Gauge size={17} />} /><Metric label="Current streak" value={`${streak}d`} icon={<Flame size={17} />} /></div><div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><section className="card p-5 sm:p-7"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Weekly activity</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Keep the line moving.</h2></div><Pill color="volt">{state.history.length ? 'In motion' : 'Start today'}</Pill></div><div className="mt-8 flex h-44 items-end gap-2 border-b border-border pb-2">{weekValues.map((value, index) => <div key={index} className="flex flex-1 flex-col items-center gap-2"><div className="flex h-full w-full items-end"><div className={`chart-bar w-full ${value ? '' : 'opacity-20'}`} style={{ height: `${Math.max(8, (value / max) * 100)}%` }} /></div><span className="font-mono text-[10px] text-muted-foreground">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span></div>)}</div></section><section className="card p-5 sm:p-7"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Completion</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">A little better.</h2></div><Target size={21} className="text-primary" /></div><div className="mt-8 flex items-center gap-5"><div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${Math.min(100, state.history.length * 17)}%, hsl(var(--secondary)) 0)` }}><div className="grid h-20 w-20 place-items-center rounded-full bg-card"><span className="font-display text-2xl font-bold">{Math.min(100, state.history.length * 17)}%</span></div></div><p className="text-sm leading-6 text-muted-foreground">Your weekly target is six sessions. <span className="font-semibold text-foreground">{Math.max(0, 6 - state.history.length)} to go</span> this week.</p></div></section></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><section className="card p-5 sm:p-7"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Personal records</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Your quiet wins.</h2></div><Trophy size={21} className="text-accent" /></div>{prs.length ? <div className="mt-6 space-y-3">{prs.map(([name, sets], index) => <div key={name} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-3"><span className="font-mono text-xs text-primary">0{index + 1}</span><span className="flex-1 text-sm font-semibold">{name}</span><span className="font-mono text-xs text-muted-foreground">{sets} sets</span></div>)}</div> : <EmptyState icon={<Trophy size={19} />} title="Your first PR is waiting." copy="Finish a session to start building your record." />}</section><section className="card p-5 sm:p-7"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Exercise history</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Recent sessions.</h2></div><Activity size={21} className="text-primary" /></div>{state.history.length ? <div className="mt-6 space-y-3">{state.history.slice(0, 4).map((item) => <div key={item.id} className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Check size={16} /></div><div className="flex-1"><p className="text-sm font-semibold">{item.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {item.minutes} min</p></div><span className="font-mono text-xs text-muted-foreground">{item.sets} sets</span></div>)}</div> : <EmptyState icon={<Activity size={19} />} title="Nothing logged yet." copy="Your history will show up after your first finished workout." />}</section></div></div>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="card p-4 sm:p-5"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><span className="text-primary">{icon}</span></div><p className="font-display mt-5 text-3xl font-bold tracking-[-.06em]" data-testid={`metric-${label.toLowerCase().replace(' ', '-')}`}>{value}</p></div>;
}

function Nutrition() {
  const { state, update } = useApp();
  const rotate = (index: number) => update({ mealOffsets: state.mealOffsets.map((value, mealIndex) => mealIndex === index ? (value + 1) % mealSets[index].meals.length : value) });
  return <div className="page-enter"><Topbar eyebrow="Eat like it matters" title="Nutrition" action={<Link href="/" className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground sm:flex" data-testid="link-nutrition-home"><House size={14} /> Today</Link>} /><div className="rounded-2xl border border-accent/25 bg-accent/[.08] p-5 sm:p-7"><div className="flex items-start gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><HeartPulse size={21} /></div><div><Pill color="orange">Goal · {goals.find((item) => item.id === state.goal)?.label}</Pill><h2 className="font-display mt-3 text-2xl font-bold tracking-tight">Feed the adaptation.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">These are starting points, not rules. Make the easy choice available before hunger gets loud.</p></div></div><div className="mt-6 grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-background/30 p-3"><p className="font-mono text-[10px] text-muted-foreground">PROTEIN</p><p className="mt-2 text-sm font-bold">Every meal</p></div><div className="rounded-xl bg-background/30 p-3"><p className="font-mono text-[10px] text-muted-foreground">WATER</p><p className="mt-2 text-sm font-bold">{state.hydration}/5 reminders checked</p></div><div className="rounded-xl bg-background/30 p-3"><p className="font-mono text-[10px] text-muted-foreground">TIMING</p><p className="mt-2 text-sm font-bold">Train fed, not full</p></div></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{mealSets.map((meal, index) => <MealCard key={meal.title} meal={meal.title} idea={meal.meals[(state.mealOffsets[index] ?? 0) % meal.meals.length]} index={index} onSwap={() => rotate(index)} />)}</div><div className="mt-4 card flex items-center gap-4 p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Waves size={19} /></div><div className="flex-1"><p className="text-sm font-bold">Water, before the reminder.</p><p className="mt-1 text-xs text-muted-foreground">Tap a glass when you finish it. Five is a solid day.</p></div><div className="flex gap-1">{[0, 1, 2, 3, 4].map((i) => <button type="button" key={i} onClick={() => update({ hydration: i + 1 })} className={`h-8 w-5 rounded-md ${i < state.hydration ? 'bg-primary' : 'bg-secondary'}`} data-testid={`button-nutrition-water-${i + 1}`} />)}</div></div></div>;
}

function MealCard({ meal, idea, index, onSwap }: { meal: string; idea: string; index: number; onSwap: () => void }) {
  return <article className="card p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="font-mono text-[10px] text-primary">0{index + 1}</span><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">{meal}</p></div><button type="button" onClick={onSwap} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary" data-testid={`button-swap-meal-${index}`} aria-label={`Swap ${meal}`}><RefreshCw size={15} /></button></div><p className="font-display mt-7 min-h-[52px] text-xl font-bold leading-tight tracking-[-.03em]">{idea}</p><div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 size={14} className="text-primary" /> Simple, high-signal fuel</div></article>;
}

function Settings() {
  const { state, update, reset } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const requestNotifications = async () => {
    if (!('Notification' in window)) { update({ notifications: 'Not available in this browser' }); return; }
    try {
      const permission = await Notification.requestPermission();
      update({ notifications: permission === 'granted' ? 'Enabled' : permission === 'denied' ? 'Blocked in browser' : 'Not requested' });
    } catch {
      update({ notifications: 'Unavailable on this device' });
    }
  };
  const resetAll = () => { if (confirmReset) { reset(); setConfirmReset(false); } else setConfirmReset(true); };
  return <div className="page-enter"><Topbar eyebrow="Make it yours" title="Settings" /><div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]"><section className="card p-5 sm:p-7"><SectionHead icon={<Target size={18} />} eyebrow="Training intent" title="Your goal" /><div className="mt-6 space-y-2">{goals.map((item) => <button type="button" key={item.id} onClick={() => update({ goal: item.id })} className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left ${state.goal === item.id ? 'selection-ring border-primary bg-primary/[.08]' : 'border-border bg-secondary/30'}`} data-testid={`button-settings-goal-${item.id}`}><span className="font-mono text-xs text-primary">{item.mark}</span><span className="flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span></span>{state.goal === item.id && <Check size={16} className="text-primary" />}</button>)}</div><div className="mt-8 border-t border-border pt-6"><SectionHead icon={<Bell size={18} />} eyebrow="Nudges" title="Reminder times" /><div className="mt-4 grid gap-3 sm:grid-cols-3"><ReminderInput label="Workout" value={state.reminder} onChange={(value) => update({ reminder: value })} testId="input-reminder-time" /><ReminderInput label="Hydration" value={state.hydrationReminder} onChange={(value) => update({ hydrationReminder: value })} testId="input-hydration-reminder" /><ReminderInput label="Meals" value={state.mealReminder} onChange={(value) => update({ mealReminder: value })} testId="input-meal-reminder" /></div><p className="mt-3 text-xs text-muted-foreground">Times are saved on this device. Browser notifications still require permission below.</p><div className="mt-4 flex items-center justify-between rounded-xl bg-secondary/40 p-3.5"><div><p className="text-sm font-semibold">Browser notifications</p><p className="mt-1 text-xs text-muted-foreground" data-testid="status-notifications">{state.notifications}</p></div><button type="button" onClick={requestNotifications} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" data-testid="button-request-notifications">Enable</button></div></div></section><div className="space-y-4"><section className="card p-5 sm:p-7"><SectionHead icon={<Settings2 size={18} />} eyebrow="Preferences" title="Environment" /><div className="mt-6 space-y-4"><SettingRow label="Units" detail="Used for future distance and weight notes"><div className="flex rounded-lg bg-secondary p-1">{(['metric', 'imperial'] as const).map((unit) => <button type="button" key={unit} onClick={() => update({ units: unit })} className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${state.units === unit ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} data-testid={`button-units-${unit}`}>{unit}</button>)}</div></SettingRow><SettingRow label="Theme" detail="Keep the blackout or bring in daylight"><button type="button" onClick={() => update({ theme: state.theme === 'dark' ? 'light' : 'dark' })} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold" data-testid="button-toggle-theme">{state.theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}{state.theme === 'dark' ? 'Dark' : 'Light'}</button></SettingRow><SettingRow label="Rest default" detail="Used when a new exercise starts"><select value={state.timerDefault} onChange={(e) => update({ timerDefault: Number(e.target.value) })} className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs outline-none" data-testid="select-rest-default">{[30, 60, 90, 120].map((value) => <option key={value} value={value}>{value} seconds</option>)}</select></SettingRow></div></section><section className="card p-5 sm:p-7"><SectionHead icon={<Info size={18} />} eyebrow="Device" title="About ShadowFit" /><p className="mt-5 text-sm leading-6 text-muted-foreground">A local-first training ritual. Your data is saved in this browser and is never sent anywhere by ShadowFit.</p><div className="mt-5 flex items-center gap-2 text-xs text-primary"><ShieldCheck size={15} /> Private by default</div><div className="mt-6 border-t border-border pt-5"><button type="button" onClick={resetAll} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${confirmReset ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-muted-foreground'}`} data-testid="button-reset-app">{confirmReset ? 'Tap again to reset' : 'Reset workout & progress'} <RotateCcw size={14} /></button>{confirmReset && <button type="button" onClick={() => setConfirmReset(false)} className="ml-3 text-xs text-muted-foreground" data-testid="button-cancel-reset">Cancel</button>}</div></section></div></div></div>;
}

function ReminderInput({ label, value, onChange, testId }: { label: string; value: string; onChange: (value: string) => void; testId: string }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{label}</span><input type="time" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm outline-none focus:border-primary" data-testid={testId} /></label>;
}

function SectionHead({ icon, eyebrow, title }: { icon: ReactNode; eyebrow: string; title: string }) {
  return <div className="flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">{eyebrow}</p><h2 className="font-display mt-1 text-xl font-bold tracking-tight">{title}</h2></div></div>;
}
function SettingRow({ label, detail, children }: { label: string; detail: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>{children}</div>;
}
function EmptyState({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <div className="mt-6 rounded-xl border border-dashed border-border p-5"><div className="text-primary">{icon}</div><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{copy}</p></div>;
}

function AppRoutes() {
  const { state } = useApp();
  if (!state.onboarded) return <Onboarding />;
  return <Switch>
    <Route path="/"><Shell><Today /></Shell></Route>
    <Route path="/workout"><Shell><WorkoutPage /></Shell></Route>
    <Route path="/progress"><Shell><Progress /></Shell></Route>
    <Route path="/nutrition"><Shell><Nutrition /></Shell></Route>
    <Route path="/settings"><Shell><Settings /></Shell></Route>
    <Route component={NotFound} />
  </Switch>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppProvider><RoutedErrorBoundary><AppRoutes /></RoutedErrorBoundary></AppProvider></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;