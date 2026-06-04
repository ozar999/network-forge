import { useEffect, useState, useCallback } from 'react';

// ---------- Types ----------
export type ActivityType =
  | 'lab_open' | 'device_added' | 'connection_made' | 'command_run'
  | 'ping_success' | 'ping_fail' | 'lesson_complete' | 'quiz_passed'
  | 'course_complete' | 'login' | 'topology_saved';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  xp: number;
  meta?: Record<string, string | number>;
  ts: number;
}

export interface Progress {
  xp: number;
  events: ActivityEvent[];
  achievements: string[];
  // per-course lesson completion: { [courseId]: [lessonId] }
  lessons: Record<string, string[]>;
  // per-course quiz scores: { [courseId]: { [quizId]: score } }
  quizzes: Record<string, Record<string, number>>;
  // per-course notes
  notes: Record<string, string>;
}

const STORAGE_KEY = 'netsem_progress';
const MAX_EVENTS = 500;

const XP_TABLE: Record<ActivityType, number> = {
  lab_open: 1,
  device_added: 2,
  connection_made: 3,
  command_run: 1,
  ping_success: 5,
  ping_fail: 1,
  lesson_complete: 25,
  quiz_passed: 50,
  course_complete: 200,
  login: 5,
  topology_saved: 10,
};

// ---------- Achievements ----------
export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  check: (p: Progress) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_boot', name: 'First Boot', desc: 'Open the lab', icon: '🖥️', check: (p) => p.events.some(e => e.type === 'lab_open') },
  { id: 'packet_master', name: 'Packet Master', desc: 'Run 10 successful pings', icon: '📡', check: (p) => p.events.filter(e => e.type === 'ping_success').length >= 10 },
  { id: 'topology_king', name: 'Topology King', desc: 'Build a 10-device network', icon: '👑', check: (p) => (p.events.filter(e => e.type === 'device_added').length) >= 10 },
  { id: 'cli_ninja', name: 'CLI Ninja', desc: 'Execute 100 commands', icon: '⌨️', check: (p) => p.events.filter(e => e.type === 'command_run').length >= 100 },
  { id: 'wired_up', name: 'Wired Up', desc: 'Create 5 connections', icon: '🔌', check: (p) => p.events.filter(e => e.type === 'connection_made').length >= 5 },
  { id: 'scholar', name: 'Scholar', desc: 'Complete 5 lessons', icon: '📚', check: (p) => Object.values(p.lessons).reduce((a, b) => a + b.length, 0) >= 5 },
  { id: 'graduate', name: 'Graduate', desc: 'Complete a full course', icon: '🎓', check: (p) => p.events.some(e => e.type === 'course_complete') },
  { id: 'streak_3', name: 'On Fire', desc: 'Use NetSem 3 days in a row', icon: '🔥', check: (p) => computeStreak(p) >= 3 },
];

// ---------- Levels ----------
// Level n requires 100 * n * (n+1) / 2 XP. Easy curve.
export function xpToLevel(xp: number): { level: number; current: number; needed: number } {
  let level = 1;
  let cumulative = 0;
  while (true) {
    const required = 100 * level;
    if (xp < cumulative + required) {
      return { level, current: xp - cumulative, needed: required };
    }
    cumulative += required;
    level++;
  }
}

export function computeStreak(p: Progress): number {
  const days = new Set<string>();
  for (const e of p.events) days.add(new Date(e.ts).toDateString());
  let streak = 0;
  const d = new Date();
  for (;;) {
    if (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

// ---------- Storage ----------
function load(): Progress {
  if (typeof window === 'undefined') return emptyProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw) as Progress;
    return { ...emptyProgress(), ...p };
  } catch { return emptyProgress(); }
}
function save(p: Progress) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}
function emptyProgress(): Progress {
  return { xp: 0, events: [], achievements: [], lessons: {}, quizzes: {}, notes: {} };
}

// ---------- Subscription ----------
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

let current: Progress | null = null;
function get(): Progress {
  if (!current) current = load();
  return current;
}
function update(fn: (p: Progress) => Progress) {
  const next = fn(get());
  current = next;
  save(next);
  emit();
}

// ---------- Public API ----------
export function trackEvent(type: ActivityType, meta?: Record<string, string | number>) {
  const xp = XP_TABLE[type] ?? 0;
  update((p) => {
    const evt: ActivityEvent = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, xp, meta, ts: Date.now() };
    const events = [evt, ...p.events].slice(0, MAX_EVENTS);
    const newXp = p.xp + xp;
    const next: Progress = { ...p, xp: newXp, events };
    // Re-check achievements
    const earned = ACHIEVEMENTS.filter(a => a.check(next)).map(a => a.id);
    next.achievements = Array.from(new Set([...p.achievements, ...earned]));
    return next;
  });
}

export function completeLesson(courseId: string, lessonId: string) {
  update((p) => {
    const set = new Set(p.lessons[courseId] || []);
    if (set.has(lessonId)) return p;
    set.add(lessonId);
    const lessons = { ...p.lessons, [courseId]: Array.from(set) };
    return { ...p, lessons };
  });
  trackEvent('lesson_complete', { courseId, lessonId });
}

export function saveQuizScore(courseId: string, quizId: string, score: number, passed: boolean) {
  update((p) => {
    const courseQ = { ...(p.quizzes[courseId] || {}), [quizId]: score };
    return { ...p, quizzes: { ...p.quizzes, [courseId]: courseQ } };
  });
  if (passed) trackEvent('quiz_passed', { courseId, quizId, score });
}

export function saveNote(courseId: string, note: string) {
  update((p) => ({ ...p, notes: { ...p.notes, [courseId]: note } }));
}

export function resetProgress() {
  current = emptyProgress();
  save(current);
  emit();
}

// ---------- Hook ----------
export function useProgress(): Progress {
  const [snap, setSnap] = useState<Progress>(() => get());
  useEffect(() => {
    const l = () => setSnap({ ...get() });
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return snap;
}

export function useCourseProgress(courseId: string, totalLessons: number) {
  const p = useProgress();
  const done = (p.lessons[courseId] || []).length;
  return {
    completed: done,
    total: totalLessons,
    percent: totalLessons === 0 ? 0 : Math.round((done / totalLessons) * 100),
    isDone: (lessonId: string) => (p.lessons[courseId] || []).includes(lessonId),
    note: p.notes[courseId] || '',
  };
}

// Helpers consumed by dashboard
export function getDailyXp(p: Progress, days = 30): { date: string; xp: number }[] {
  const out: { date: string; xp: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toDateString();
    const xp = p.events.filter(e => new Date(e.ts).toDateString() === key).reduce((a, b) => a + b.xp, 0);
    out.push({ date: d.toISOString().slice(5, 10), xp });
  }
  return out;
}

export function getHeatmap(p: Progress, weeks = 12): number[][] {
  // Returns 7 rows × `weeks` cols of activity counts
  const cells: number[][] = Array.from({ length: 7 }, () => Array(weeks).fill(0));
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - (weeks * 7 - 1));
  for (const e of p.events) {
    const d = new Date(e.ts);
    const diffDays = Math.floor((d.getTime() - start.getTime()) / 86400000);
    if (diffDays < 0 || diffDays >= weeks * 7) continue;
    const col = Math.floor(diffDays / 7);
    const row = d.getDay();
    cells[row][col] += 1;
  }
  return cells;
}