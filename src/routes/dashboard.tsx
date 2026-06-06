import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import React, { useEffect, useState } from 'react';
import { useProgress, xpToLevel, computeStreak, getDailyXp, getHeatmap, ACHIEVEMENTS } from '@/lib/progress';
import { useAuth } from '@/lib/auth';
import { COURSES } from '@/lib/courseContent';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/dashboard')({
  head: () => ({
    meta: [
      { title: 'Dashboard — NetSem' },
      { name: 'description', content: 'Track your networking lab progress, XP, achievements, and skill tree' },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && (!user || user.isGuest)) {
      navigate({ to: '/auth' });
    }
  }, [user, loading, navigate]);

  const [cloudStats, setCloudStats] = useState<{ labsCompleted: number; hoursSpent: number; skillsUnlocked: number } | null>(null);
  useEffect(() => {
    if (!user || user.isGuest) return;
    (async () => {
      const { data } = await supabase
        .from('lab_completions')
        .select('duration_seconds, skills')
        .eq('user_id', user.id);
      if (!data) return;
      const labsCompleted = data.length;
      const hoursSpent = Math.round((data.reduce((a, r) => a + (r.duration_seconds || 0), 0) / 3600) * 10) / 10;
      const skillsUnlocked = new Set(data.flatMap(r => r.skills || [])).size;
      setCloudStats({ labsCompleted, hoursSpent, skillsUnlocked });
    })();
  }, [user]);

  const p = useProgress();
  if (loading || !user || user.isGuest) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  const lvl = xpToLevel(p.xp);
  const streak = computeStreak(p);
  const daily = getDailyXp(p, 30);
  const maxDaily = Math.max(1, ...daily.map(d => d.xp));
  const heatmap = getHeatmap(p, 12);
  const heatMax = Math.max(1, ...heatmap.flat());

  const commandCount = p.events.filter(e => e.type === 'command_run').length;
  const pingCount = p.events.filter(e => e.type === 'ping_success').length;
  const deviceCount = p.events.filter(e => e.type === 'device_added').length;
  const lessonCount = Object.values(p.lessons).reduce((a, b) => a + b.length, 0);

  const SKILLS = [
    { name: 'Routing', value: Math.min(5, Math.floor(commandCount / 20)) },
    { name: 'Switching', value: Math.min(5, Math.floor(deviceCount / 4)) },
    { name: 'Troubleshooting', value: Math.min(5, Math.floor(pingCount / 5)) },
    { name: 'Theory', value: Math.min(5, Math.floor(lessonCount / 3)) },
    { name: 'Security', value: Math.min(5, p.achievements.includes('graduate') ? 4 : 1) },
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display text-terminal text-glow tracking-wider">OPERATOR DASHBOARD</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {user ? `Welcome back, ${user.name}` : <>Not signed in — <Link to="/auth" className="text-terminal underline">sign in</Link> to save progress to your account.</>}
          </p>
        </div>
        <div className="border border-terminal/30 bg-terminal/5 rounded-lg px-4 py-2 text-right">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Level</div>
          <div className="text-3xl font-display text-terminal text-glow leading-none">{lvl.level}</div>
          <div className="mt-2 w-40 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-terminal" style={{ width: `${(lvl.current / lvl.needed) * 100}%` }} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{lvl.current} / {lvl.needed} XP</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Total XP', value: p.xp, icon: '⚡' },
          { label: 'Streak', value: `${streak} day${streak === 1 ? '' : 's'}`, icon: '🔥' },
          { label: 'Commands', value: commandCount, icon: '⌨️' },
          { label: 'Lessons', value: lessonCount, icon: '📚' },
        ].map(s => (
          <div key={s.label} className="border border-border rounded-lg p-4 bg-card/50 text-center">
            <span className="text-2xl">{s.icon}</span>
            <div className="text-xl font-display text-terminal mt-2">{s.value}</div>
            <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Cloud stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Labs Completed', value: cloudStats?.labsCompleted ?? '—', icon: '🧪' },
          { label: 'Hours Spent', value: cloudStats?.hoursSpent ?? '—', icon: '⏱️' },
          { label: 'Skills Unlocked', value: cloudStats?.skillsUnlocked ?? '—', icon: '🛠️' },
        ].map(s => (
          <div key={s.label} className="border border-terminal/30 rounded-lg p-4 bg-terminal/5 text-center">
            <span className="text-2xl">{s.icon}</span>
            <div className="text-xl font-display text-terminal mt-2">{s.value}</div>
            <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{s.label} (Cloud)</div>
          </div>
        ))}
      </div>

      {/* Daily XP chart */}
      <div className="border border-border rounded-lg p-4 bg-card/40 mb-6">
        <h2 className="text-sm font-display text-foreground tracking-wider mb-3">📈 XP — LAST 30 DAYS</h2>
        <svg viewBox="0 0 600 120" className="w-full h-32" preserveAspectRatio="none">
          {daily.map((d, i) => {
            const x = (i / daily.length) * 600;
            const w = 600 / daily.length - 2;
            const h = (d.xp / maxDaily) * 100;
            return <rect key={i} x={x} y={120 - h - 10} width={w} height={h} className="fill-terminal" opacity={0.7} />;
          })}
          <line x1="0" y1="110" x2="600" y2="110" className="stroke-border" strokeWidth="1" />
        </svg>
        <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
          <span>{daily[0]?.date}</span>
          <span>{daily[daily.length - 1]?.date}</span>
        </div>
      </div>

      {/* Heatmap */}
      <div className="border border-border rounded-lg p-4 bg-card/40 mb-6">
        <h2 className="text-sm font-display text-foreground tracking-wider mb-3">📅 ACTIVITY HEATMAP — 12 WEEKS</h2>
        <div className="flex gap-1">
          {heatmap[0].map((_, col) => (
            <div key={col} className="flex flex-col gap-1">
              {heatmap.map((row, r) => {
                const v = row[col];
                const intensity = v / heatMax;
                return (
                  <div
                    key={r}
                    className="w-3 h-3 rounded-sm"
                    style={{ background: v === 0 ? 'var(--secondary)' : `color-mix(in oklab, var(--primary) ${20 + intensity * 80}%, transparent)` }}
                    title={`${v} event${v === 1 ? '' : 's'}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Achievements */}
        <div>
          <h2 className="text-sm font-display text-foreground tracking-wider mb-4 flex items-center gap-2">
            🏆 <span>ACHIEVEMENTS ({p.achievements.length}/{ACHIEVEMENTS.length})</span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {ACHIEVEMENTS.map(b => {
              const earned = p.achievements.includes(b.id);
              return (
                <div key={b.id} className={`border rounded-lg p-3 transition-all ${
                  earned ? 'border-terminal bg-terminal/5' : 'border-border bg-card/30 opacity-50'
                }`}>
                  <span className="text-xl">{b.icon}</span>
                  <div className="text-xs font-display text-foreground mt-1">{b.name}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{b.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Skills */}
        <div>
          <h2 className="text-sm font-display text-foreground tracking-wider mb-4 flex items-center gap-2">
            📊 <span>SKILL TREE</span>
          </h2>
          <div className="space-y-4">
            {SKILLS.map(s => (
              <div key={s.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-foreground">{s.name}</span>
                  <span className="text-muted-foreground">Lv {s.value}/5</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`h-2 flex-1 rounded-sm ${
                      i < s.value ? 'bg-terminal' : 'bg-secondary'
                    }`} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Course progress */}
          <h2 className="text-sm font-display text-foreground tracking-wider mt-8 mb-4 flex items-center gap-2">
            🎓 <span>COURSE PROGRESS</span>
          </h2>
          <div className="space-y-2">
            {COURSES.slice(0, 4).map(c => {
              const done = (p.lessons[c.id] || []).length;
              const pct = Math.round((done / c.lessons.length) * 100);
              return (
                <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="block border border-border rounded p-2 hover:border-terminal/30">
                  <div className="flex justify-between text-xs"><span>{c.icon} {c.title}</span><span className="text-muted-foreground">{pct}%</span></div>
                  <div className="h-1 mt-1 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-terminal" style={{ width: `${pct}%` }} /></div>
                </Link>
              );
            })}
          </div>

          {/* Recent Activity */}
          <h2 className="text-sm font-display text-foreground tracking-wider mt-8 mb-4 flex items-center gap-2">
            📋 <span>RECENT ACTIVITY</span>
          </h2>
          <div className="border border-border rounded-lg bg-card/30 p-3 max-h-64 overflow-y-auto">
            {p.events.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No activity yet — start a lab to begin tracking!</p>
            ) : (
              <ul className="space-y-1">
                {p.events.slice(0, 15).map(e => (
                  <li key={e.id} className="text-[11px] flex items-center gap-2 text-muted-foreground">
                    <span className="text-terminal w-12 text-right">+{e.xp}xp</span>
                    <span className="flex-1 text-foreground/80">{e.type.replace(/_/g, ' ')}</span>
                    <span>{new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}