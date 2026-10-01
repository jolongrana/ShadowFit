import { useCallback, useContext, useEffect, useMemo, useRef, useState, createContext, type ChangeEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  Activity, ArrowLeft, ArrowRight, Bell, Bike, CalendarDays, Check, CheckCircle2, ChevronDown,
  CircleHelp, Clock3, Cloud, CloudSun, Dumbbell, Flame, Gauge, Globe2, HeartPulse, House,
  Info, Leaf, Menu, Moon, MoreHorizontal, Pause, Play, Plus, RefreshCw, RotateCcw, Settings2,
  ShieldCheck, SkipBack, SkipForward, SlidersHorizontal, Sparkles, Sun, Target, TimerReset,
  Frown, LogOut, Meh, Smile, Trophy, UserRound, Volume2, Waves, X,
} from 'lucide-react';
import NotFound from '@/pages/not-found';
import CommunityHub from '@/components/community-hub';
import {
  getGetCommunityFriendsQueryKey,
  getGetCommunityLeaderboardQueryKey,
  getGetCommunityMeQueryKey,
  useGetCommunityMe,
  useSyncCommunityWorkouts,
  type GetCommunityMeParams,
} from '@workspace/api-client-react';
import {
  calculateShadowScore,
  currentLocalDay,
  rankForShadowScore,
  streakForLocalDays,
  type ShadowScore,
} from '@workspace/api-zod/shadowfit-score';
import { faceShapes, goals, lookRecommendations, mealSetsByGoal, workouts, type Exercise, type FaceShape, type Goal, type NutritionGoal, type OutfitAdvice, type OutfitStyle, type View, type Workout } from './data/shadowfit';

const queryClient = new QueryClient();
const STORE_KEY = 'shadowfit-local-v1';
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment.');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(76 100% 54%)',
    colorForeground: 'hsl(48 24% 95%)',
    colorMutedForeground: 'hsl(220 9% 62%)',
    colorDanger: 'hsl(2 75% 60%)',
    colorBackground: 'hsl(222 17% 12%)',
    colorInput: 'hsl(221 15% 17%)',
    colorInputForeground: 'hsl(48 24% 95%)',
    colorNeutral: 'hsl(220 12% 20%)',
    fontFamily: 'Manrope, ui-sans-serif, sans-serif',
    borderRadius: '0.9rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-card rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-foreground',
    headerSubtitle: 'text-muted-foreground',
    socialButtonsBlockButtonText: 'text-foreground',
    formFieldLabel: 'text-foreground',
    footerActionLink: 'text-primary hover:brightness-110',
    footerActionText: 'text-muted-foreground',
    dividerText: 'text-muted-foreground',
    identityPreviewEditButton: 'text-primary',
    formFieldSuccessText: 'text-primary',
    alertText: 'text-foreground',
    logoBox: 'h-12',
    logoImage: 'max-h-12 object-contain',
    socialButtonsBlockButton: '!border-border !bg-secondary/60 hover:!bg-secondary',
    formButtonPrimary: '!bg-primary !text-primary-foreground',
    formFieldInput: '!bg-secondary/60 !text-foreground !border-border',
    footerAction: 'text-muted-foreground',
    dividerLine: 'bg-border',
    alert: '!border-border !bg-secondary',
    otpCodeFieldInput: '!bg-secondary/60 !text-foreground !border-border',
    formFieldRow: 'text-foreground',
    main: 'text-foreground',
  },
};

type WorkoutFeeling = 'great' | 'good' | 'okay' | 'tough' | 'rough';
type HistoryEntry = { id: string; workoutId: string; name: string; date: string; minutes: number; sets: number; localDay?: string; feeling?: WorkoutFeeling | null; scoreNoticeShown?: boolean };
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
  nutritionGoal: NutritionGoal;
  weatherLabel: string;
  weatherTemp: string;
  weatherCondition: string;
  weatherRecommendation: string;
  lookPhoto: string;
  faceShape: FaceShape | null;
  dailySteps: Record<string, number>;
  lookHeight: string;
  lookShoulderWidth: string;
  outfitStyle: OutfitStyle;
  outfitAdvice: OutfitAdvice;
};

const defaultState: AppState = {
  onboarded: false, name: 'Athlete', goal: 'strength', favoriteWorkout: 'beginner-full-body',
  active: null, history: [], timerDefault: 60, customRest: 75, reminder: '18:30', hydrationReminder: '10:00', mealReminder: '12:30', units: 'metric',
  theme: 'dark', notifications: 'Not requested', hydration: 3, mealOffsets: [0, 0, 0, 0], nutritionGoal: 'maintain',
  weatherLabel: 'Indoor is always on', weatherTemp: '—', weatherCondition: 'Manual fallback', weatherRecommendation: 'Indoor workout recommended.',
  lookPhoto: '', faceShape: null,
  dailySteps: {}, lookHeight: '', lookShoulderWidth: '', outfitStyle: 'casual', outfitAdvice: 'men',
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
      nutritionGoal: saved.nutritionGoal ?? defaultState.nutritionGoal,
      dailySteps: saved.dailySteps ?? defaultState.dailySteps,
      lookHeight: saved.lookHeight ?? defaultState.lookHeight,
      lookShoulderWidth: saved.lookShoulderWidth ?? defaultState.lookShoulderWidth,
      outfitStyle: saved.outfitStyle ?? defaultState.outfitStyle,
      outfitAdvice: saved.outfitAdvice ?? defaultState.outfitAdvice,
    };
  } catch { return defaultState; }
}

function localTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  catch { return 'UTC'; }
}

function isValidLocalDay(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function historyTimestamp(entry: HistoryEntry): Date | null {
  if (typeof entry.date !== 'string') return null;
  const completedAt = new Date(entry.date);
  return Number.isNaN(completedAt.getTime()) ? null : completedAt;
}

function localDayForHistory(entry: HistoryEntry) {
  if (isValidLocalDay(entry.localDay)) return entry.localDay;
  return currentLocalDay(localTimeZone(), historyTimestamp(entry) ?? new Date(0));
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function lastSevenDays(now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return {
      key: localDateKey(date),
      label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
      date,
    };
  });
}

function currentSeason(date = new Date()) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
}

function outfitIdeas(style: OutfitStyle, advice: OutfitAdvice, season: string, heightCm: number, shoulderCm: number) {
  const looks: Record<OutfitAdvice, Record<OutfitStyle, string>> = {
    men: {
      casual: 'Try a textured tee or knit polo with straight-leg jeans or chinos and clean sneakers.',
      sporty: 'Try a performance tee with tapered joggers or training shorts and a lightweight zip layer.',
      'smart-casual': 'Try an Oxford shirt or fine-gauge knit with tailored trousers and simple leather sneakers.',
      streetwear: 'Try a boxy graphic tee with relaxed cargos, a clean overshirt, and low-profile sneakers.',
    },
    women: {
      casual: 'Try a fitted tee or relaxed knit with straight-leg denim or easy trousers and clean sneakers.',
      sporty: 'Try a supportive athletic top with leggings or training shorts and a lightweight zip layer.',
      'smart-casual': 'Try a soft blouse or fine-gauge knit with tailored trousers or a midi skirt and simple flats.',
      streetwear: 'Try a boxy tee with relaxed cargos or wide-leg denim, a clean overshirt, and low-profile sneakers.',
    },
  };
  const seasonalLayer: Record<string, string> = {
    Spring: 'Add a breathable overshirt or light trench for changing temperatures.',
    Summer: 'Choose airy fabrics such as cotton or linen, and keep the extra layer light.',
    Fall: 'Add a mid-weight overshirt, cardigan, or light jacket for cooler mornings.',
    Winter: 'Layer with a warm coat and a knit or fleece mid-layer; keep the base comfortable indoors.',
  };
  const heightNote = heightCm < 165
    ? 'For your height, a slightly higher rise and shorter jacket can create a clean, uninterrupted line.'
    : heightCm > 185
      ? 'For your height, try balanced contrast or a longer outer layer to give the outfit an intentional proportion.'
      : 'A balanced silhouette works well: pair one relaxed piece with one more structured piece.';
  const shoulderNote = shoulderCm < 40
    ? 'For shoulder fit, look for clean shoulder seams and light structure in jackets or overshirts.'
    : shoulderCm > 47
      ? 'For shoulder fit, choose shoulder seams that sit naturally and softer layers that move without pulling.'
      : 'For shoulder fit, use the shoulder seam as your guide; a comfortable, natural drape is the goal.';
  return {
    outfit: looks[advice][style],
    season: seasonalLayer[season],
    proportions: `${heightNote} ${shoulderNote}`,
  };
}

function shadowScore(state: Pick<AppState, 'history' | 'active'>): ShadowScore {
  const activeSets = state.active ? Object.values(state.active.completed).reduce((sum, values) => sum + values.length, 0) : 0;
  const sessions = state.history.map((item) => ({ sets: item.sets, localDay: localDayForHistory(item) }));
  return calculateShadowScore(sessions, currentLocalDay(localTimeZone()), activeSets);
}

function currentStreak(history: HistoryEntry[]) {
  const days = history.map(localDayForHistory);
  return streakForLocalDays(days, currentLocalDay(localTimeZone()));
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

type ScoreNotice = { id: number; scoreGained: number; rankedUp: boolean; rank: string };
type AppContextValue = {
  state: AppState;
  update: (patch: Partial<AppState> | ((current: AppState) => Partial<AppState>)) => void;
  reset: () => void;
  scoreNotice: ScoreNotice | null;
  showScoreNotice: (scoreGained: number, rankedUp: boolean, rank: string) => void;
};
const AppContext = createContext<AppContextValue | null>(null);
function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('ShadowFit app context unavailable');
  return context;
}

function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(readState);
  const [scoreNotice, setScoreNotice] = useState<ScoreNotice | null>(null);
  const update = useCallback((patch: Partial<AppState> | ((current: AppState) => Partial<AppState>)) => {
    setState((old) => ({ ...old, ...(typeof patch === 'function' ? patch(old) : patch) }));
  }, []);
  const reset = useCallback(() => setState({ ...defaultState, onboarded: true }), []);
  const showScoreNotice = useCallback((scoreGained: number, rankedUp: boolean, rank: string) => {
    if (scoreGained <= 0 && !rankedUp) return;
    const notice = { id: Date.now(), scoreGained, rankedUp, rank };
    setScoreNotice(notice);
    window.setTimeout(() => setScoreNotice((current) => current?.id === notice.id ? null : current), 5200);
  }, []);
  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { document.documentElement.classList.toggle('light', state.theme === 'light'); }, [state.theme]);
  return <AppContext.Provider value={{ state, update, reset, scoreNotice, showScoreNotice }}>{children}</AppContext.Provider>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const nextUserId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== nextUserId) cache.clear();
      previousUserId.current = nextUserId;
    });
    return unsubscribe;
  }, [addListener, cache]);
  return null;
}

function CommunitySyncBridge() {
  const { state, update, showScoreNotice } = useApp();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const cache = useQueryClient();
  const sync = useSyncCommunityWorkouts();
  const completedSyncs = useRef(new Map<string, string>());
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [refreshKey, setRefreshKey] = useState(0);
  const timeZone = useMemo(() => localTimeZone(), []);
  const params = useMemo<GetCommunityMeParams>(() => ({ timeZone }), [timeZone]);
  const profile = useGetCommunityMe(params, {
    query: {
      enabled: Boolean(isLoaded && isSignedIn && userId && online),
      queryKey: getGetCommunityMeQueryKey(params),
      retry: false,
    },
  });

  useEffect(() => {
    const onlineAgain = () => {
      setOnline(true);
      setRefreshKey((key) => key + 1);
      if (isSignedIn) void profile.refetch();
    };
    const offline = () => setOnline(false);
    const focus = () => {
      setRefreshKey((key) => key + 1);
      if (isSignedIn) void profile.refetch();
    };
    window.addEventListener('online', onlineAgain);
    window.addEventListener('offline', offline);
    window.addEventListener('focus', focus);
    return () => {
      window.removeEventListener('online', onlineAgain);
      window.removeEventListener('offline', offline);
      window.removeEventListener('focus', focus);
    };
  }, [isSignedIn, profile.refetch]);

  const historySignature = useMemo(
    () => state.history.map((entry) => [entry.id, entry.workoutId, entry.date, entry.localDay, entry.sets, entry.minutes].join(':')).join('|'),
    [state.history],
  );
  const syncHistory = useMemo(() => state.history, [historySignature]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || !online || !profile.data?.sharingEnabled || !syncHistory.length) return;
    if (completedSyncs.current.get(userId) === historySignature) return;
    const sessions = syncHistory.flatMap((entry) => {
      const completedAt = historyTimestamp(entry);
      if (
        !completedAt ||
        !entry.id ||
        entry.id.length > 80 ||
        !entry.workoutId ||
        entry.workoutId.length > 100 ||
        !Number.isInteger(entry.sets) ||
        entry.sets < 1 ||
        entry.sets > 100 ||
        !Number.isInteger(entry.minutes) ||
        entry.minutes < 1 ||
        entry.minutes > 240
      ) return [];
      const localDay = isValidLocalDay(entry.localDay)
        ? entry.localDay
        : currentLocalDay(timeZone, completedAt);
      return [{
        clientSessionId: entry.id,
        workoutId: entry.workoutId,
        sets: entry.sets,
        minutes: entry.minutes,
        completedAt: completedAt.toISOString(),
        localDay,
      }];
    });
    if (!sessions.length) return;

    let cancelled = false;
    void (async () => {
      let scoreGained = 0;
      let rankedUp = false;
      let rank = 'Initiate';
      try {
        for (let start = 0; start < sessions.length; start += 250) {
          const result = await sync.mutateAsync({
            data: { timeZone, sessions: sessions.slice(start, start + 250) },
          });
          scoreGained += result.scoreGained;
          rankedUp ||= result.rankedUp;
          rank = result.rank;
        }
        if (cancelled) return;
        completedSyncs.current.set(userId, historySignature);
        const pendingNotice = syncHistory.some((entry) => !entry.scoreNoticeShown && sessions.some((session) => session.clientSessionId === entry.id));
        if (pendingNotice) showScoreNotice(scoreGained, rankedUp, rank);
        const syncedIds = new Set(sessions.map((session) => session.clientSessionId));
        update((current) => ({
          history: current.history.map((entry) => syncedIds.has(entry.id) ? { ...entry, scoreNoticeShown: true } : entry),
        }));
        await Promise.all([
          cache.invalidateQueries({ queryKey: getGetCommunityMeQueryKey(params) }),
          cache.invalidateQueries({ queryKey: getGetCommunityFriendsQueryKey() }),
          cache.invalidateQueries({ queryKey: getGetCommunityLeaderboardQueryKey() }),
        ]);
      } catch (error) {
        if (!cancelled) console.warn('ShadowFit sync deferred; local workout history remains available.', error);
      }
    })();
    return () => { cancelled = true; };
  }, [
    cache, historySignature, isLoaded, isSignedIn, online, params,
    profile.data?.sharingEnabled, refreshKey, showScoreNotice, syncHistory,
    sync.mutateAsync, timeZone, update, userId,
  ]);
  return null;
}

function Logo({ compact = false, showcase = false }: { compact?: boolean; showcase?: boolean }) {
  if (showcase) {
    return <div className="flex items-center" data-testid="brand-shadowfit">
      <img src="/shadowfit-lockup.png" alt="ShadowFit" className="h-28 w-28 object-contain sm:h-36 sm:w-36" />
    </div>;
  }
  return <div className="flex items-center gap-2.5" data-testid="brand-shadowfit">
    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
      <img src="/shadowfit-symbol.png" alt="" className="h-full w-full object-contain" />
    </span>
    {!compact && <img src="/shadowfit-wordmark.png" alt="ShadowFit" className="h-8 w-[118px] object-contain object-left" />}
  </div>;
}

function LoadingScreen() {
  return <div className="loading-screen noise flex min-h-[100dvh] items-center justify-center px-6" role="status" aria-live="polite">
    <div className="flex w-full max-w-xs flex-col items-center text-center">
      <div className="loading-logo volt-glow">
        <img src="/shadowfit-lockup.png" alt="ShadowFit" className="h-44 w-44 object-contain sm:h-52 sm:w-52" />
      </div>
      <p className="mt-8 font-mono text-[10px] uppercase tracking-[.26em] text-primary">Prepare your next session</p>
      <div className="loading-track mt-5 h-1 w-44 overflow-hidden rounded-full bg-secondary" aria-hidden="true"><span className="loading-sweep block h-full rounded-full bg-primary" /></div>
      <p className="mt-3 text-xs text-muted-foreground">Loading your ritual…</p>
    </div>
  </div>;
}

const navItems: Array<{ href: string; label: string; icon: typeof House; view: View }> = [
  { href: '/', label: 'Today', icon: House, view: 'today' },
  { href: '/workout', label: 'Workout', icon: Dumbbell, view: 'workout' },
  { href: '/progress', label: 'Progress', icon: Activity, view: 'progress' },
  { href: '/nutrition', label: 'Fuel', icon: Leaf, view: 'nutrition' },
  { href: '/looks', label: 'Looks', icon: Sparkles, view: 'looks' },
  { href: '/community', label: 'Community', icon: UserRound, view: 'community' },
  { href: '/settings', label: 'Settings', icon: SlidersHorizontal, view: 'settings' },
];

function AccountAction({ mobile = false }: { mobile?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  if (!isLoaded) return <span className="px-3 py-2 text-xs text-muted-foreground">Account</span>;
  if (isSignedIn) {
    return <button type="button" onClick={() => void signOut({ redirectUrl: basePath || '/' })} className={`flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground ${mobile ? '' : 'w-full'}`} data-testid={`button-${mobile ? 'mobile-' : ''}sign-out`}>
      <LogOut size={14} /> Sign out
    </button>;
  }
  return <Link href="/sign-in" className={`flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground ${mobile ? '' : 'w-full'}`} data-testid={`link-${mobile ? 'mobile-' : ''}sign-in`}>
    <UserRound size={14} /> Sign in
  </Link>;
}

function ScoreNoticeBanner() {
  const { scoreNotice } = useApp();
  if (!scoreNotice) return null;
  return <div className="score-notice fixed left-1/2 top-3 z-[70] w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-primary/30 bg-card px-4 py-3 shadow-2xl" role="status" aria-live="polite" data-testid="notice-shadow-score">
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{scoreNotice.rankedUp ? <Trophy size={17} /> : <Sparkles size={17} />}</span>
      <div className="min-w-0">
        {scoreNotice.scoreGained > 0 && <p className="font-display text-sm font-bold text-primary">+{scoreNotice.scoreGained} Shadow Score</p>}
        {scoreNotice.rankedUp && <p className="mt-0.5 text-xs font-semibold">Rank up: {scoreNotice.rank}</p>}
        {!scoreNotice.rankedUp && <p className="mt-0.5 text-[10px] text-muted-foreground">Your progress is building.</p>}
      </div>
    </div>
  </div>;
}

function Shell({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const [location] = useLocation();
  const active = location === '/' ? 'today' : (location.slice(1) as View);
  return <div className="app-shell noise min-h-[100dvh]">
    <ScoreNoticeBanner />
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
        <div className="mt-4"><AccountAction /></div>
        <p className="mt-5 px-1 font-mono text-[10px] text-muted-foreground/60">v1.0 · local by default</p>
      </div>
    </aside>
    <main className="mx-auto min-h-[100dvh] max-w-[1240px] px-4 pb-28 pt-5 sm:px-7 md:ml-[238px] md:px-10 md:pb-12 md:pt-8">
      <div className="mb-3 flex justify-end md:hidden"><AccountAction mobile /></div>
      {children}
    </main>
    <nav className="mobile-nav safe-bottom fixed inset-x-0 bottom-0 z-20 items-center justify-around border-t border-border/80 bg-background/90 px-2 pt-2 backdrop-blur-xl" aria-label="Mobile navigation">
      {navItems.map(({ href, label, icon: Icon, view }) => <Link key={view} href={href} className={`flex min-w-[46px] flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-semibold ${active === view ? 'text-primary' : 'text-muted-foreground'}`} data-testid={`link-mobile-nav-${view}`}>
        <Icon size={18} strokeWidth={active === view ? 2.5 : 1.8} /><span>{label}</span>
      </Link>)}
    </nav>
  </div>;
}

function Topbar({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  const { state } = useApp();
  const score = title === 'Progress' ? shadowScore(state) : null;
  return <>
    <header className="mb-7 flex items-start justify-between gap-3">
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
    </header>
    {score && <div className="mb-7"><ShadowScoreCard score={score} /></div>}
  </>;
}

function Pill({ children, color = 'muted' }: { children: ReactNode; color?: 'muted' | 'volt' | 'orange' }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.12em] ${color === 'volt' ? 'bg-primary/15 text-primary' : color === 'orange' ? 'bg-accent/15 text-accent' : 'bg-secondary text-muted-foreground'}`}>{children}</span>;
}

function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return <div className={`progress-track h-2 ${className}`}><div className="progress-fill h-full" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

function ShadowScoreCard({ score, compact = false }: { score: ShadowScore; compact?: boolean }) {
  if (compact) {
    return <section className="card p-5" data-testid="card-shadow-score">
      <div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Shadow score</p><Gauge size={17} className="text-primary" /></div>
      <div className="mt-3 flex items-end justify-between gap-3"><p className="font-display text-4xl font-bold tracking-[-.06em]" data-testid="text-shadow-score">{score.total}<span className="ml-1 text-base font-semibold tracking-normal text-muted-foreground">/1000</span></p><Pill color="volt">{score.total ? 'Building' : 'Start today'}</Pill></div>
      <ProgressBar value={score.total / 10} className="mt-4" />
      <p className="mt-3 text-xs text-muted-foreground">{score.sets} sets · {score.streak} day streak</p>
    </section>;
  }
  return <section className="card overflow-hidden p-5 sm:p-7" data-testid="card-shadow-score">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Shadow score</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Earned in the quiet.</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">A simple measure of the work you keep showing up for. It grows from completed sets and consecutive training days.</p></div><div className="text-right"><p className="font-display text-5xl font-bold tracking-[-.07em] text-primary" data-testid="text-shadow-score">{score.total}</p><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">of 1000</p></div></div>
    <ProgressBar value={score.total / 10} className="mt-6" />
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-secondary/50 p-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold">Completed sets</span><span className="font-mono text-xs text-primary">+{score.setPoints}</span></div><p className="mt-2 text-xs text-muted-foreground">{score.sets} sets · 10 points each · capped at 700</p></div><div className="rounded-xl bg-secondary/50 p-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold">Daily streak</span><span className="font-mono text-xs text-primary">+{score.streakPoints}</span></div><p className="mt-2 text-xs text-muted-foreground">{score.streak} consecutive days · 30 points each · capped at 300</p></div></div>
  </section>;
}

function videoSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} tutorial`)}`;
}

function VideoGuide({ query, label = 'Video guide', testId }: { query: string; label?: string; testId: string }) {
  return <a href={videoSearchUrl(query)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-2 text-[11px] font-semibold text-primary transition hover:bg-primary/20" data-testid={testId}>
    <Play size={13} /> {label} <ArrowRight size={12} />
  </a>;
}

function Onboarding() {
  const { update } = useApp();
  const [name, setName] = useState('Athlete');
  const [goal, setGoal] = useState<Goal>('strength');
  const [step, setStep] = useState(0);
  const complete = () => update({ name: name.trim() || 'Athlete', goal, onboarded: true });
  return <div className="app-shell noise min-h-[100dvh] px-5 py-8 sm:px-10">
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[1040px] flex-col">
      <Logo showcase />
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
  const score = shadowScore(state);
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
         <ShadowScoreCard score={score} compact />
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
  const { state, update, showScoreNotice } = useApp();
  const [location, setLocation] = useLocation();
  const active = state.active?.workoutId === workout.id ? state.active : { workoutId: workout.id, current: 0, completed: {}, started: false, paused: false, restSeconds: state.timerDefault };
  const [rest, setRest] = useState(active.restSeconds);
  const [custom, setCustom] = useState(state.customRest);
  const [ratingEntry, setRatingEntry] = useState<HistoryEntry | null>(null);
  const [celebrationActive, setCelebrationActive] = useState(false);
  const currentExercise = workout.exercises[active.current] ?? workout.exercises[0];
  useEffect(() => { setRest(active.restSeconds); }, [active.restSeconds]);
  useEffect(() => {
    if (!active.started || active.paused || rest <= 0) return;
    const timer = window.setInterval(() => setRest((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [active.started, active.paused, rest]);
  useEffect(() => {
    if (!celebrationActive) return;
    const timer = window.setTimeout(() => setCelebrationActive(false), 3100);
    return () => window.clearTimeout(timer);
  }, [celebrationActive]);
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
    const completedAt = new Date();
    const entry: HistoryEntry = {
      id: `${Date.now()}`,
      workoutId: workout.id,
      name: workout.name,
      date: completedAt.toISOString(),
      localDay: localDateKey(completedAt),
      minutes: Math.max(1, parseInt(workout.duration, 10) || 1),
      sets,
      scoreNoticeShown: true,
    };
    const priorScore = shadowScore({ history: state.history, active: null });
    const history = [entry, ...state.history];
    const nextScore = shadowScore({ history, active: null });
    const previousRank = rankForShadowScore(priorScore.total);
    const nextRank = rankForShadowScore(nextScore.total);
    update({ active: null, history });
    showScoreNotice(
      Math.max(0, nextScore.total - priorScore.total),
      nextRank.level > previousRank.level,
      nextRank.title,
    );
    if (isComplete) {
      setRatingEntry(entry);
      setCelebrationActive(true);
    } else {
      setLocation('/progress');
    }
  };
  const saveFeeling = (feeling: WorkoutFeeling | null) => {
    if (ratingEntry) {
      update((current) => ({
        history: current.history.map((entry) => entry.id === ratingEntry.id ? { ...entry, feeling } : entry),
      }));
    }
    setRatingEntry(null);
    setLocation('/progress');
  };
  const setCurrent = (next: number) => persist({ current: Math.max(0, Math.min(workout.exercises.length - 1, next)) });
  const completedSets = Object.values(active.completed).reduce((sum, values) => sum + values.length, 0);
  const totalSets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const completedExercises = workout.exercises.filter((exercise) => (active.completed[exercise.id] ?? []).length === exercise.sets).length;
  const isComplete = completedSets === totalSets;
  const formatTimer = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const feelings = [
    { id: 'great' as const, label: 'Great', Icon: Smile, color: 'text-primary' },
    { id: 'good' as const, label: 'Good', Icon: Smile, color: 'text-lime-400' },
    { id: 'okay' as const, label: 'Okay', Icon: Meh, color: 'text-accent' },
    { id: 'tough' as const, label: 'Tough', Icon: Frown, color: 'text-orange-400' },
    { id: 'rough' as const, label: 'Rough', Icon: Frown, color: 'text-destructive' },
  ];
  const confettiColors = ['#baff18', '#51d5c2', '#ffad54', '#a78bfa', '#f5f3e8'];
  return <>
  {celebrationActive && <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true" data-testid="workout-confetti">
    {Array.from({ length: 32 }, (_, index) => <span key={index} className="confetti-piece" style={{ left: `${(index * 37) % 100}%`, animationDelay: `${(index % 9) * 75}ms`, backgroundColor: confettiColors[index % confettiColors.length] }} />)}
  </div>}
  <section className="card overflow-hidden">
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
  </section>
  {ratingEntry && <div className="fixed inset-0 z-[65] flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="workout-rating-title" data-testid="overlay-workout-rating">
    <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-7">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Trophy size={22} /></div>
      <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[.18em] text-primary">Session complete</p>
      <h2 id="workout-rating-title" className="font-display mt-2 text-center text-2xl font-bold tracking-tight">How did that workout feel?</h2>
      <p className="mt-2 text-center text-xs text-muted-foreground">Your rating stays on this device.</p>
      <div className="mt-6 grid grid-cols-5 gap-2">
        {feelings.map(({ id, label, Icon, color }) => <button key={id} type="button" onClick={() => saveFeeling(id)} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-secondary/35 px-1 py-3 transition hover:border-primary/50 hover:bg-primary/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Rate workout ${label.toLowerCase()}`} data-testid={`button-workout-feeling-${id}`}>
          <Icon size={25} className={color} strokeWidth={1.8} />
          <span className="text-[10px] font-semibold">{label}</span>
        </button>)}
      </div>
      <button type="button" onClick={() => saveFeeling(null)} className="mt-5 w-full rounded-xl py-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary" data-testid="button-skip-workout-rating">Skip rating</button>
    </div>
  </div>}
  </>;
}

function WorkoutPage() {
  const { state, update } = useApp();
  const selected = workouts.find((item) => item.id === state.favoriteWorkout) ?? workouts[0];
  return <div className="page-enter">
    <Topbar eyebrow="The work" title="Workout" action={<Link href="/" className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground sm:flex" data-testid="link-workout-home"><House size={14} /> Today</Link>} />
    <section><div className="mb-3 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Choose your session</p><p className="mt-1 text-sm text-muted-foreground">No equipment. No filler.</p></div><span className="font-mono text-[10px] text-muted-foreground">{workouts.length} ready</span></div><div className="scrollbar-hide -mx-1 flex gap-3 overflow-x-auto px-1 pb-4">{workouts.map((workout) => <WorkoutCard key={workout.id} workout={workout} selected={workout.id === selected.id} onSelect={() => update({ favoriteWorkout: workout.id, active: state.active?.workoutId === workout.id ? state.active : null })} />)}</div></section>
    <SessionPanel workout={selected} />
    <section className="card mt-4 p-5 sm:p-7"><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Move library</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">See the form.</h2></div><Pill color="volt">Video guides</Pill></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{selected.exercises.map((exercise, index) => <div key={exercise.id} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3"><span className="font-mono text-xs text-primary">0{index + 1}</span><span className="flex-1"><span className="block text-sm font-semibold">{exercise.name}</span><span className="mt-1 block text-xs text-muted-foreground">{exercise.sets} sets · {exercise.reps}</span></span><VideoGuide query={`${exercise.name} exercise form`} label="Watch" testId={`link-video-exercise-${exercise.id}`} /></div>)}</div></section>
  </div>;
}

function WeeklyAreaChart({ title, unit, values, testId }: { title: string; unit: string; values: Array<{ label: string; value: number }>; testId: string }) {
  const width = 700;
  const top = 18;
  const bottom = 158;
  const max = Math.max(1, ...values.map((item) => item.value));
  const points = values.map((item, index) => ({
    ...item,
    x: 18 + index * ((width - 36) / Math.max(1, values.length - 1)),
    y: bottom - (item.value / max) * (bottom - top),
  }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points.at(-1)?.x ?? width - 18} ${bottom} L ${points[0]?.x ?? 18} ${bottom} Z`;
  const gradientId = `area-${testId}`;

  return <section className="card p-5 sm:p-7" data-testid={testId}>
    <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Last seven days</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">{title}</h2><p className="mt-1 text-xs text-muted-foreground">Each point is one calendar day · {unit}</p></div>
    <div className="mt-5">
      <svg viewBox={`0 0 ${width} 180`} preserveAspectRatio="none" className="h-44 w-full overflow-visible" role="img" aria-label={`${title} for the last seven days`}>
        <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity=".34" /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity=".015" /></linearGradient></defs>
        {[top, top + (bottom - top) / 3, top + (bottom - top) * 2 / 3, bottom].map((y) => <line key={y} x1="0" x2={width} y1={y} y2={y} stroke="hsl(var(--border))" strokeDasharray="4 6" />)}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => <circle key={point.label} cx={point.x} cy={point.y} r="4" fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth="2" vectorEffect="non-scaling-stroke"><title>{`${point.label}: ${point.value} ${unit}`}</title></circle>)}
      </svg>
      <div className="mt-1 flex justify-between gap-1">{points.map((point, index) => <div key={`${point.label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center"><span className="font-mono text-[9px] text-muted-foreground">{point.label}</span><span className="mt-1 max-w-full truncate font-mono text-[9px] text-foreground">{point.value.toLocaleString()}</span></div>)}</div>
    </div>
    {!values.some((item) => item.value > 0) && <p className="mt-3 text-center text-xs text-muted-foreground">No {unit} logged in the last seven days yet.</p>}
  </section>;
}

function Progress() {
  const { state, update } = useApp();
  const todayKey = localDateKey(new Date());
  const todaySteps = state.dailySteps[todayKey] ?? 0;
  const days = lastSevenDays();
  const historyByDay = state.history.reduce<Record<string, { minutes: number; sessions: number }>>((totals, item) => {
    const date = new Date(item.date);
    if (!Number.isNaN(date.getTime())) {
      const key = localDateKey(date);
      totals[key] ??= { minutes: 0, sessions: 0 };
      totals[key].minutes += item.minutes;
      totals[key].sessions += 1;
    }
    return totals;
  }, {});
  const weekActivity = days.map((day) => ({
    label: day.label,
    minutes: historyByDay[day.key]?.minutes ?? 0,
    sessions: historyByDay[day.key]?.sessions ?? 0,
    steps: state.dailySteps[day.key] ?? 0,
  }));
  const weeklySessions = weekActivity.reduce((sum, day) => sum + day.sessions, 0);
  const totalMinutes = state.history.reduce((sum, item) => sum + item.minutes, 0);
  const totalSets = state.history.reduce((sum, item) => sum + item.sets, 0);
  const exerciseCounts = state.history.reduce<Record<string, number>>((acc, item) => { acc[item.name] = (acc[item.name] ?? 0) + item.sets; return acc; }, {});
  const prs = Object.entries(exerciseCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const streak = currentStreak(state.history);
  const updateTodaySteps = (value: string) => {
    const steps = Math.min(200000, Math.max(0, Math.floor(Number(value) || 0)));
    update({ dailySteps: { ...state.dailySteps, [todayKey]: steps } });
  };
  const stepProgress = Math.min(100, (todaySteps / 10000) * 100);

  return <div className="page-enter">
    <Topbar eyebrow="Proof of work" title="Progress" action={<div className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground"><CalendarDays size={16} /></div>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Sessions" value={String(state.history.length)} icon={<Dumbbell size={17} />} />
      <Metric label="Minutes" value={String(totalMinutes)} icon={<Clock3 size={17} />} />
      <Metric label="Sets moved" value={String(totalSets)} icon={<Gauge size={17} />} />
      <Metric label="Current streak" value={`${streak}d`} icon={<Flame size={17} />} />
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <div>
        <WeeklyAreaChart title="Workout minutes" unit="minutes" values={weekActivity.map((day) => ({ label: day.label, value: day.minutes }))} testId="chart-weekly-minutes" />
        <p className="mt-2 px-1 text-xs text-muted-foreground">{weeklySessions} workout {weeklySessions === 1 ? 'session' : 'sessions'} logged in this seven-day period.</p>
      </div>
      <section className="card p-5 sm:p-7">
        <div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Weekly target</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Keep showing up.</h2></div><Target size={21} className="text-primary" /></div>
        <div className="mt-8 flex items-center gap-5"><div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${Math.min(100, (weeklySessions / 6) * 100)}%, hsl(var(--secondary)) 0)` }}><div className="grid h-20 w-20 place-items-center rounded-full bg-card"><span className="font-display text-2xl font-bold">{Math.min(100, Math.round((weeklySessions / 6) * 100))}%</span></div></div><p className="text-sm leading-6 text-muted-foreground">Your target is six sessions in seven days. <span className="font-semibold text-foreground">{Math.max(0, 6 - weeklySessions)} to go</span> this week.</p></div>
      </section>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
    <section className="card p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Daily movement</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Track your steps.</h2><p className="mt-1 text-sm text-muted-foreground">Log today’s total; it stays saved on this device.</p></div>
        <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Today’s steps</span><input type="number" min={0} max={200000} step={100} value={todaySteps} onChange={(event) => updateTodaySteps(event.target.value)} className="w-36 rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-right font-mono text-lg outline-none focus:border-primary" aria-label="Today's step count" data-testid="input-daily-steps" /></label>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3"><span className="font-mono text-xs text-muted-foreground">{todaySteps.toLocaleString()} / 10,000 steps</span><button type="button" onClick={() => updateTodaySteps(String(todaySteps + 1000))} className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/80" data-testid="button-add-steps">+1,000 steps</button></div>
      <ProgressBar value={stepProgress} className="mt-3" />
    </section>
    <WeeklyAreaChart title="Steps by day" unit="steps" values={weekActivity.map((day) => ({ label: day.label, value: day.steps }))} testId="chart-weekly-steps" />
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <section className="card p-5 sm:p-7"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Personal records</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Your quiet wins.</h2></div><Trophy size={21} className="text-accent" /></div>{prs.length ? <div className="mt-6 space-y-3">{prs.map(([name, sets], index) => <div key={name} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-3"><span className="font-mono text-xs text-primary">0{index + 1}</span><span className="flex-1 text-sm font-semibold">{name}</span><span className="font-mono text-xs text-muted-foreground">{sets} sets</span></div>)}</div> : <EmptyState icon={<Trophy size={19} />} title="Your first PR is waiting." copy="Finish a session to start building your record." />}</section>
      <section className="card p-5 sm:p-7"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Exercise history</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Recent sessions.</h2></div><Activity size={21} className="text-primary" /></div>{state.history.length ? <div className="mt-6 space-y-3">{state.history.slice(0, 4).map((item) => <div key={item.id} className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Check size={16} /></div><div className="flex-1"><p className="text-sm font-semibold">{item.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {item.minutes} min</p></div><span className="font-mono text-xs text-muted-foreground">{item.sets} sets</span></div>)}</div> : <EmptyState icon={<Activity size={19} />} title="Nothing logged yet." copy="Your history will show up after your first finished workout." />}</section>
    </div>
  </div>;
}

function Looks() {
  const { state, update } = useApp();
  const recommendation = state.faceShape ? lookRecommendations[state.faceShape] : null;
  const shapeLabel = faceShapes.find((shape) => shape.id === state.faceShape)?.label;
  const season = currentSeason();
  const heightCm = Number(state.lookHeight) || 0;
  const shoulderCm = Number(state.lookShoulderWidth) || 0;
  const heightDisplay = state.lookHeight ? (state.units === 'imperial' ? (heightCm / 2.54).toFixed(1) : state.lookHeight) : '';
  const shoulderDisplay = state.lookShoulderWidth ? (state.units === 'imperial' ? (shoulderCm / 2.54).toFixed(1) : state.lookShoulderWidth) : '';
  const outfit = heightCm >= 90 && heightCm <= 240 && shoulderCm >= 25 && shoulderCm <= 70
    ? outfitIdeas(state.outfitStyle, state.outfitAdvice, season, heightCm, shoulderCm)
    : null;
  const outfitStyles: Array<{ id: OutfitStyle; label: string }> = [
    { id: 'casual', label: 'Casual' },
    { id: 'sporty', label: 'Sporty' },
    { id: 'smart-casual', label: 'Smart casual' },
    { id: 'streetwear', label: 'Streetwear' },
  ];

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 720;
        const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        update({ lookPhoto: canvas.toDataURL('image/jpeg', 0.82) });
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return <div className="page-enter">
    <Topbar eyebrow="Personal presentation" title="Looks" action={<Link href="/" className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground sm:flex" data-testid="link-looks-home"><House size={14} /> Today</Link>} />
    <section className="card mb-4 flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5" data-testid="switch-outfit-advice">
      <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Personalize advice</p><p className="mt-1 text-sm font-semibold">Show outfit and haircut ideas for</p><p className="mt-1 text-xs text-muted-foreground">This changes the style suggestions, not your profile or identity.</p></div>
      <fieldset>
        <legend className="sr-only">Advice style</legend>
        <div className="flex rounded-xl border border-border bg-secondary/50 p-1" role="group" aria-label="Choose whether to show men's or women's advice">
          {(['men', 'women'] as const).map((advice) => <button key={advice} type="button" aria-pressed={state.outfitAdvice === advice} onClick={() => update({ outfitAdvice: advice })} className={`flex min-w-24 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold capitalize transition ${state.outfitAdvice === advice ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'}`} data-testid={`button-outfit-advice-${advice}`}>
            {state.outfitAdvice === advice && <Check size={15} aria-hidden="true" />}{advice}
          </button>)}
        </div>
      </fieldset>
    </section>
    <div className="grid gap-4 lg:grid-cols-[.82fr_1.18fr]">
      <section className="card p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Your reference</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Find your frame.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Upload a photo to keep beside your haircut and posture notes. It stays on this device.</p></div><Sparkles className="text-primary" size={22} /></div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-dashed border-border bg-secondary/40">
          {state.lookPhoto ? <div className="relative"><img src={state.lookPhoto} alt="Your uploaded reference" className="max-h-[360px] w-full object-cover" /><button type="button" onClick={() => update({ lookPhoto: '', faceShape: null })} className="absolute right-3 top-3 rounded-lg bg-background/85 px-3 py-2 text-xs font-semibold text-foreground backdrop-blur" data-testid="button-remove-look-photo">Remove</button></div> : <label className="flex min-h-60 cursor-pointer flex-col items-center justify-center p-6 text-center"><span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary"><Plus size={22} /></span><span className="mt-4 text-sm font-bold">Upload a clear face photo</span><span className="mt-2 text-xs leading-5 text-muted-foreground">Front-facing works best. JPG, PNG, or WebP.</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="sr-only" data-testid="input-look-photo" /></label>}
        </div>
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/[.06] p-4"><div className="flex gap-3"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-primary" /><p className="text-xs leading-5 text-muted-foreground">This photo is resized and saved locally in ShadowFit. It is not uploaded to a server or used for identity recognition.</p></div></div>
      </section>
      <section className="card p-5 sm:p-7">
        <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Style guide</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Choose your face shape.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Use the closest match. This is a guide, not an automated verdict.</p></div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">{faceShapes.map((shape) => <button type="button" key={shape.id} disabled={!state.lookPhoto} onClick={() => update({ faceShape: shape.id })} className={`rounded-xl border p-3 text-left transition ${state.faceShape === shape.id ? 'selection-ring border-primary bg-primary/[.08]' : 'border-border bg-secondary/30 hover:bg-secondary/60'} disabled:cursor-not-allowed disabled:opacity-45`} data-testid={`button-face-shape-${shape.id}`}><span className="font-mono text-[10px] text-primary">{shape.label}</span><span className="mt-2 block text-xs leading-4 text-muted-foreground">{shape.detail}</span></button>)}</div>
        {!state.lookPhoto && <p className="mt-4 text-xs text-muted-foreground">Upload a reference photo first, then choose the shape that looks closest to you.</p>}
        {recommendation && <div className="mt-6 space-y-4">
          <section className="rounded-2xl bg-secondary/50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Haircut directions · {state.outfitAdvice}</p><h3 className="font-display mt-1 text-lg font-bold">{shapeLabel} shape</h3></div><VideoGuide query={`${shapeLabel} face shape ${state.outfitAdvice} haircut`} label="Watch ideas" testId="link-video-haircut" /></div><div className="mt-4 flex flex-wrap gap-2">{recommendation.haircuts[state.outfitAdvice].map((cut) => <span key={cut} className="rounded-full border border-border px-3 py-2 text-xs font-semibold">{cut}</span>)}</div></section>
          <section className="rounded-2xl bg-secondary/50 p-4"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Face & neck routine</p><h3 className="font-display mt-1 text-lg font-bold">Relaxed, aligned, repeatable.</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">These movements support posture and jaw relaxation. They do not change bone structure or replace professional care.</p></div><div className="mt-4 space-y-2">{recommendation.routine.map((item, index) => <div key={item.name} className="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-3"><span className="font-mono text-xs text-primary">0{index + 1}</span><div className="flex-1"><p className="text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p></div><VideoGuide query={`${item.name} neck posture exercise`} label="Video" testId={`link-video-face-routine-${index}`} /></div>)}</div></section>
        </div>}
      </section>
    </div>
    <section className="card mt-4 p-5 sm:p-7" data-testid="section-outfit-ideas">
      <div>
        <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Wear the season</p><h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Outfit ideas for {season.toLowerCase()}.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Suggestions use your height, shoulder width, and chosen style. Season follows the calendar on your device.</p></div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-[.85fr_1.15fr]">
        <div className="space-y-5">
          <fieldset><legend className="mb-2 text-xs font-semibold">Choose your style</legend><div className="flex flex-wrap gap-2">{outfitStyles.map((style) => <button type="button" key={style.id} onClick={() => update({ outfitStyle: style.id })} aria-pressed={state.outfitStyle === style.id} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${state.outfitStyle === style.id ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/70'}`} data-testid={`button-outfit-style-${style.id}`}>{style.label}</button>)}</div></fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1.5 block text-xs font-semibold">Height ({state.units === 'imperial' ? 'in' : 'cm'})</span><input type="number" min={state.units === 'imperial' ? 35 : 90} max={state.units === 'imperial' ? 95 : 240} step={state.units === 'imperial' ? 0.5 : 1} value={heightDisplay} onChange={(event) => update({ lookHeight: event.target.value ? String(state.units === 'imperial' ? Number(event.target.value) * 2.54 : Number(event.target.value)) : '' })} placeholder={state.units === 'imperial' ? 'e.g. 68' : 'e.g. 173'} className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm outline-none focus:border-primary" data-testid="input-outfit-height" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold">Shoulder width ({state.units === 'imperial' ? 'in' : 'cm'})</span><input type="number" min={state.units === 'imperial' ? 10 : 25} max={state.units === 'imperial' ? 28 : 70} step={state.units === 'imperial' ? 0.1 : 0.5} value={shoulderDisplay} onChange={(event) => update({ lookShoulderWidth: event.target.value ? String(state.units === 'imperial' ? Number(event.target.value) * 2.54 : Number(event.target.value)) : '' })} placeholder={state.units === 'imperial' ? 'e.g. 17' : 'e.g. 43'} className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm outline-none focus:border-primary" data-testid="input-outfit-shoulder-width" /></label>
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">Measure shoulder width across your back from shoulder point to shoulder point. These are optional fit cues, saved only in this browser.</p>
        </div>
        <div className="rounded-2xl bg-secondary/45 p-4 sm:p-5">
          {outfit ? <div className="space-y-4">
            <div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">{season} · {outfitStyles.find((style) => style.id === state.outfitStyle)?.label} · advice for {state.outfitAdvice}</p><h3 className="font-display mt-2 text-xl font-bold">A useful starting outfit.</h3><p className="mt-3 text-sm leading-6">{outfit.outfit}</p></div>
            <div className="border-t border-border pt-3"><p className="text-xs font-semibold">Seasonal layer</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{outfit.season}</p></div>
            <div className="border-t border-border pt-3"><p className="text-xs font-semibold">Fit notes</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{outfit.proportions}</p></div>
          </div> : <div className="flex min-h-40 flex-col justify-center"><p className="text-sm font-semibold">Add two measurements for a tailored suggestion.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Enter your height and shoulder width. You can update either whenever you want; the advice changes with the selected style, season, and men’s/women’s switch.</p></div>}
        </div>
      </div>
    </section>
  </div>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="card p-4 sm:p-5"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><span className="text-primary">{icon}</span></div><p className="font-display mt-5 text-3xl font-bold tracking-[-.06em]" data-testid={`metric-${label.toLowerCase().replace(' ', '-')}`}>{value}</p></div>;
}

function Nutrition() {
  const { state, update } = useApp();
  const mealSets = mealSetsByGoal[state.nutritionGoal];
  const goalsForEating: Array<{ id: NutritionGoal; label: string; detail: string }> = [
    { id: 'maintain', label: 'Maintain', detail: 'Balanced everyday meal ideas.' },
    { id: 'gain', label: 'Gain weight', detail: 'More energy-dense meals and snacks.' },
    { id: 'lose', label: 'Lose weight', detail: 'Filling meals with protein and vegetables.' },
  ];
  const rotate = (index: number) => update({ mealOffsets: state.mealOffsets.map((value, mealIndex) => mealIndex === index ? (value + 1) % mealSets[index].meals.length : value) });
  const selectGoal = (nutritionGoal: NutritionGoal) => update({ nutritionGoal, mealOffsets: [0, 0, 0, 0] });
  const nutritionSummary = state.nutritionGoal === 'gain'
    ? 'These ideas include energy-dense foods alongside protein to make adding nourishing food easier.'
    : state.nutritionGoal === 'lose'
      ? 'These ideas emphasize protein, produce, and satisfying meals. No foods are off-limits.'
      : 'These balanced ideas are a flexible starting point for everyday meals.';

  return <div className="page-enter">
    <Topbar eyebrow="Eat like it matters" title="Nutrition" action={<Link href="/" className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground sm:flex" data-testid="link-nutrition-home"><House size={14} /> Today</Link>} />
    <section className="card mb-4 p-5 sm:p-6" data-testid="section-nutrition-goal">
      <fieldset>
        <legend className="font-display text-lg font-bold">What’s your current eating goal?</legend>
        <p className="mt-1 text-xs text-muted-foreground">This choice only changes meal ideas; it doesn’t change your training goal.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3" role="group" aria-label="Choose your eating goal">
          {goalsForEating.map((goal) => <button key={goal.id} type="button" aria-pressed={state.nutritionGoal === goal.id} onClick={() => selectGoal(goal.id)} className={`rounded-xl border p-3 text-left transition ${state.nutritionGoal === goal.id ? 'selection-ring border-primary bg-primary/[.08]' : 'border-border bg-secondary/30 hover:bg-secondary/60'}`} data-testid={`button-nutrition-goal-${goal.id}`}>
            <span className={`block text-sm font-semibold ${state.nutritionGoal === goal.id ? 'text-primary' : 'text-foreground'}`}>{goal.label}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{goal.detail}</span>
          </button>)}
        </div>
      </fieldset>
    </section>
    <div className="rounded-2xl border border-accent/25 bg-accent/[.08] p-5 sm:p-7">
      <div className="flex items-start gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><HeartPulse size={21} /></div><div><Pill color="orange">Training goal · {goals.find((item) => item.id === state.goal)?.label}</Pill><h2 className="font-display mt-3 text-2xl font-bold tracking-tight">Feed the adaptation.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{nutritionSummary}</p></div></div>
      <div className="mt-6 grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-background/30 p-3"><p className="font-mono text-[10px] text-muted-foreground">PROTEIN</p><p className="mt-2 text-sm font-bold">Include it regularly</p></div><div className="rounded-xl bg-background/30 p-3"><p className="font-mono text-[10px] text-muted-foreground">WATER</p><p className="mt-2 text-sm font-bold">{state.hydration}/5 reminders checked</p></div><div className="rounded-xl bg-background/30 p-3"><p className="font-mono text-[10px] text-muted-foreground">TIMING</p><p className="mt-2 text-sm font-bold">Train fed, not full</p></div></div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">{mealSets.map((meal, index) => <MealCard key={meal.title} meal={meal.title} idea={meal.meals[(state.mealOffsets[index] ?? 0) % meal.meals.length]} index={index} onSwap={() => rotate(index)} />)}</div>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">Meal ideas are general suggestions, not calorie prescriptions or medical advice. Adjust portions to your needs; consult a qualified professional for personalized guidance.</p>
    <div className="mt-4 card flex items-center gap-4 p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Waves size={19} /></div><div className="flex-1"><p className="text-sm font-bold">Water, before the reminder.</p><p className="mt-1 text-xs text-muted-foreground">Tap a glass when you finish it. Five is a solid day.</p></div><div className="flex gap-1">{[0, 1, 2, 3, 4].map((i) => <button type="button" key={i} onClick={() => update({ hydration: i + 1 })} className={`h-8 w-5 rounded-md ${i < state.hydration ? 'bg-primary' : 'bg-secondary'}`} data-testid={`button-nutrition-water-${i + 1}`} aria-label={`Mark ${i + 1} of 5 water reminders checked`} />)}</div></div>
  </div>;
}

function MealCard({ meal, idea, index, onSwap }: { meal: string; idea: string; index: number; onSwap: () => void }) {
  return <article className="card p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="font-mono text-[10px] text-primary">0{index + 1}</span><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">{meal}</p></div><button type="button" onClick={onSwap} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary" data-testid={`button-swap-meal-${index}`} aria-label={`Swap ${meal}`}><RefreshCw size={15} /></button></div><p className="font-display mt-7 min-h-[52px] text-xl font-bold leading-tight tracking-[-.03em]">{idea}</p><div className="mt-6 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 size={14} className="text-primary" /> Simple, high-signal fuel</div><VideoGuide query={`${idea} recipe preparation`} label="Watch" testId={`link-video-meal-${index}`} /></div></article>;
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
  return <div className="page-enter"><Topbar eyebrow="Make it yours" title="Settings" /><div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]"><section className="card p-5 sm:p-7"><SectionHead icon={<Target size={18} />} eyebrow="Training intent" title="Your goal" /><div className="mt-6 space-y-2">{goals.map((item) => <button type="button" key={item.id} onClick={() => update({ goal: item.id })} className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left ${state.goal === item.id ? 'selection-ring border-primary bg-primary/[.08]' : 'border-border bg-secondary/30'}`} data-testid={`button-settings-goal-${item.id}`}><span className="font-mono text-xs text-primary">{item.mark}</span><span className="flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span></span>{state.goal === item.id && <Check size={16} className="text-primary" />}</button>)}</div><div className="mt-8 border-t border-border pt-6"><SectionHead icon={<Bell size={18} />} eyebrow="Nudges" title="Reminder times" /><div className="mt-4 grid gap-3 sm:grid-cols-3"><ReminderInput label="Workout" value={state.reminder} onChange={(value) => update({ reminder: value })} testId="input-reminder-time" /><ReminderInput label="Hydration" value={state.hydrationReminder} onChange={(value) => update({ hydrationReminder: value })} testId="input-hydration-reminder" /><ReminderInput label="Meals" value={state.mealReminder} onChange={(value) => update({ mealReminder: value })} testId="input-meal-reminder" /></div><p className="mt-3 text-xs text-muted-foreground">Times are saved on this device. Browser notifications still require permission below.</p><div className="mt-4 flex items-center justify-between rounded-xl bg-secondary/40 p-3.5"><div><p className="text-sm font-semibold">Browser notifications</p><p className="mt-1 text-xs text-muted-foreground" data-testid="status-notifications">{state.notifications}</p></div><button type="button" onClick={requestNotifications} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" data-testid="button-request-notifications">Enable</button></div></div></section><div className="space-y-4"><section className="card p-5 sm:p-7"><SectionHead icon={<Settings2 size={18} />} eyebrow="Preferences" title="Environment" /><div className="mt-6 space-y-4"><SettingRow label="Units" detail="Used for future distance and weight notes"><div className="flex rounded-lg bg-secondary p-1">{(['metric', 'imperial'] as const).map((unit) => <button type="button" key={unit} onClick={() => update({ units: unit })} className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${state.units === unit ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} data-testid={`button-units-${unit}`}>{unit}</button>)}</div></SettingRow><SettingRow label="Theme" detail="Keep the blackout or bring in daylight"><button type="button" onClick={() => update({ theme: state.theme === 'dark' ? 'light' : 'dark' })} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold" data-testid="button-toggle-theme">{state.theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}{state.theme === 'dark' ? 'Dark' : 'Light'}</button></SettingRow><SettingRow label="Rest default" detail="Used when a new exercise starts"><select value={state.timerDefault} onChange={(e) => update({ timerDefault: Number(e.target.value) })} className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs outline-none" data-testid="select-rest-default">{[30, 60, 90, 120].map((value) => <option key={value} value={value}>{value} seconds</option>)}</select></SettingRow></div></section><section className="card p-5 sm:p-7"><SectionHead icon={<Info size={18} />} eyebrow="Device" title="About ShadowFit" /><p className="mt-5 text-sm leading-6 text-muted-foreground">Your workout history, appearance photos, and ratings remain on this device. When friends-only sharing is enabled, workout sessions also sync to calculate your score; only accepted friends can see it.</p><div className="mt-5 flex items-center gap-2 text-xs text-primary"><ShieldCheck size={15} /> Private by default</div><div className="mt-6 border-t border-border pt-5"><button type="button" onClick={resetAll} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${confirmReset ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-muted-foreground'}`} data-testid="button-reset-app">{confirmReset ? 'Tap again to reset local data' : 'Reset this device’s workout & progress'} <RotateCcw size={14} /></button>{confirmReset && <><p className="mt-2 text-xs leading-5 text-muted-foreground">This clears local history only. Workout sessions already synced to your ShadowFit account remain.</p><button type="button" onClick={() => setConfirmReset(false)} className="ml-3 text-xs text-muted-foreground" data-testid="button-cancel-reset">Cancel</button></>}</div></section></div></div></div>;
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
  const [location] = useLocation();
  if (!state.onboarded && location !== '/community') return <Onboarding />;
  return <Switch>
    <Route path="/"><Shell><Today /></Shell></Route>
    <Route path="/workout"><Shell><WorkoutPage /></Shell></Route>
    <Route path="/progress"><Shell><Progress /></Shell></Route>
    <Route path="/nutrition"><Shell><Nutrition /></Shell></Route>
    <Route path="/looks"><Shell><Looks /></Shell></Route>
    <Route path="/community"><Shell><CommunityHub /></Shell></Route>
    <Route path="/settings"><Shell><Settings /></Shell></Route>
    <Route component={NotFound} />
  </Switch>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function SignInPage() {
  return <div className="app-shell noise flex min-h-[100dvh] flex-col items-center justify-center px-4 py-8">
    <Link href="/" className="mb-5 flex items-center gap-2.5 text-xs font-extrabold tracking-[.18em] text-foreground" aria-label="ShadowFit home">
      <img src={`${basePath}/logo.svg`} alt="" className="h-9 w-9 rounded-xl" /> SHADOWFIT
    </Link>
    <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
  </div>;
}

function SignUpPage() {
  return <div className="app-shell noise flex min-h-[100dvh] flex-col items-center justify-center px-4 py-8">
    <Link href="/" className="mb-5 flex items-center gap-2.5 text-xs font-extrabold tracking-[.18em] text-foreground" aria-label="ShadowFit home">
      <img src={`${basePath}/logo.svg`} alt="" className="h-9 w-9 rounded-xl" /> SHADOWFIT
    </Link>
    <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
  </div>;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to return to your training circle.' } },
      signUp: { start: { title: 'Create your ShadowFit account', subtitle: 'Your workouts stay local unless you choose to share.' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <ClerkQueryClientCacheInvalidator />
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={MainApp} />
    </Switch>
  </ClerkProvider>;
}

function MainApp() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 850);
    return () => window.clearTimeout(timer);
  }, []);
  return loading ? <LoadingScreen /> : <AppProvider>
    <CommunitySyncBridge />
    <RoutedErrorBoundary><AppRoutes /></RoutedErrorBoundary>
  </AppProvider>;
}

function App() {
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WouterRouter base={basePath}><ClerkRoutes /></WouterRouter>
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>;
}

export default App;