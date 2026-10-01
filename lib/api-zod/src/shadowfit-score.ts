export const SHADOW_RANKS = [
  { level: 1, title: "Initiate", minimumScore: 0 },
  { level: 2, title: "Scout", minimumScore: 100 },
  { level: 3, title: "Striker", minimumScore: 250 },
  { level: 4, title: "Warden", minimumScore: 450 },
  { level: 5, title: "Phantom", minimumScore: 700 },
  { level: 6, title: "Shadow Elite", minimumScore: 900 },
] as const;

export type ShadowRank = (typeof SHADOW_RANKS)[number];

export function rankForShadowScore(score: number): ShadowRank {
  return [...SHADOW_RANKS].reverse().find((rank) => score >= rank.minimumScore) ?? SHADOW_RANKS[0];
}

export function currentLocalDay(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function offsetDay(day: string, offset: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + offset));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function streakForLocalDays(days: readonly string[], today: string): number {
  const completedDays = new Set(days);
  let cursor = today;
  if (!completedDays.has(cursor)) cursor = offsetDay(cursor, -1);

  let streak = 0;
  while (completedDays.has(cursor)) {
    streak += 1;
    cursor = offsetDay(cursor, -1);
  }
  return streak;
}

export type ShadowScore = {
  total: number;
  sets: number;
  streak: number;
  setPoints: number;
  streakPoints: number;
};

export function calculateShadowScore(
  sessions: readonly { sets: number; localDay: string }[],
  today: string,
  additionalSets = 0,
): ShadowScore {
  const sets = sessions.reduce((sum, session) => sum + session.sets, 0) + additionalSets;
  const streak = streakForLocalDays(sessions.map((session) => session.localDay), today);
  const setPoints = Math.min(700, sets * 10);
  const streakPoints = Math.min(300, streak * 30);
  return { total: setPoints + streakPoints, sets, streak, setPoints, streakPoints };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}