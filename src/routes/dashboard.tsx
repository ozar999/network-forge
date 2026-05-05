import { createFileRoute } from '@tanstack/react-router';
import React from 'react';

export const Route = createFileRoute('/dashboard')({
  head: () => ({
    meta: [
      { title: 'Dashboard — NetSim' },
      { name: 'description', content: 'Track your networking lab progress, badges, and skills' },
    ],
  }),
  component: DashboardPage,
});

const STATS = [
  { label: 'Labs Completed', value: '0', icon: '🧪' },
  { label: 'Hours Spent', value: '0h', icon: '⏱️' },
  { label: 'Skills Unlocked', value: '0', icon: '🔓' },
  { label: 'Streak', value: '0 days', icon: '🔥' },
];

const BADGES = [
  { name: 'First Boot', desc: 'Complete your first lab', earned: false, icon: '🖥️' },
  { name: 'Packet Master', desc: 'Run 10 ping simulations', earned: false, icon: '📡' },
  { name: 'Subnet Wizard', desc: 'Complete subnetting course', earned: false, icon: '🧮' },
  { name: 'Router Jockey', desc: 'Configure 5 routers', earned: false, icon: '🔧' },
  { name: 'Topology King', desc: 'Build a 10-device network', earned: false, icon: '👑' },
  { name: 'CLI Ninja', desc: 'Execute 100 commands', earned: false, icon: '⌨️' },
];

const SKILLS = [
  { name: 'Routing', level: 0, max: 5 },
  { name: 'Switching', level: 0, max: 5 },
  { name: 'Subnetting', level: 0, max: 5 },
  { name: 'Security', level: 0, max: 5 },
  { name: 'Troubleshooting', level: 0, max: 5 },
];

function DashboardPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-display text-terminal text-glow tracking-wider mb-6">OPERATOR DASHBOARD</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {STATS.map(s => (
          <div key={s.label} className="border border-border rounded-lg p-4 bg-card/50 text-center">
            <span className="text-2xl">{s.icon}</span>
            <div className="text-xl font-display text-terminal mt-2">{s.value}</div>
            <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Badges */}
        <div>
          <h2 className="text-sm font-display text-foreground tracking-wider mb-4 flex items-center gap-2">
            🏆 <span>BADGES</span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {BADGES.map(b => (
              <div key={b.name} className={`border rounded-lg p-3 transition-all ${
                b.earned ? 'border-terminal bg-terminal/5' : 'border-border bg-card/30 opacity-50'
              }`}>
                <span className="text-xl">{b.icon}</span>
                <div className="text-xs font-display text-foreground mt-1">{b.name}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">{b.desc}</div>
              </div>
            ))}
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
                  <span className="text-muted-foreground">Lv {s.level}/{s.max}</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: s.max }).map((_, i) => (
                    <div key={i} className={`h-2 flex-1 rounded-sm ${
                      i < s.level ? 'bg-terminal' : 'bg-secondary'
                    }`} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <h2 className="text-sm font-display text-foreground tracking-wider mt-8 mb-4 flex items-center gap-2">
            📋 <span>RECENT ACTIVITY</span>
          </h2>
          <div className="border border-border rounded-lg bg-card/30 p-4">
            <p className="text-xs text-muted-foreground text-center py-4">No activity yet — start a lab to begin tracking!</p>
          </div>
        </div>
      </div>
    </div>
  );
}