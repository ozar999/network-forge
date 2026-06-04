import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTheme } from './ThemeProvider';
import { useAuth, signOut } from '@/lib/auth';
import { useProgress, xpToLevel } from '@/lib/progress';

export function Navbar() {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const p = useProgress();
  const lvl = xpToLevel(p.xp);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const links = [
    { to: '/' as const, label: 'Home' },
    { to: '/lab' as const, label: 'Lab' },
    { to: '/courses' as const, label: 'Courses' },
    { to: '/dashboard' as const, label: 'Dashboard' },
    { to: '/ai-assistant' as const, label: 'AI Assistant' },
  ];
  return (
    <nav className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 sticky top-0 z-40">
      <Link to="/" className="flex items-center gap-2 mr-8">
        <div className="w-7 h-7 rounded border border-terminal flex items-center justify-center text-glow">
          <span className="text-terminal text-sm font-bold font-display">N</span>
        </div>
        <span className="font-display text-terminal text-sm text-glow tracking-wider">NETSEM</span>
      </Link>
      <div className="hidden md:flex items-center gap-1">
        {links.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className="px-3 py-1.5 text-xs rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
            activeProps={{ className: 'px-3 py-1.5 text-xs rounded text-terminal bg-terminal/10 border border-terminal/30' }}
            activeOptions={{ exact: true }}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="flex-1" />
      {/* XP pill */}
      <Link to="/dashboard" className="hidden sm:flex items-center gap-2 px-2 py-1 rounded border border-border bg-secondary/30 hover:border-terminal/40 text-[10px] mr-2" title="View dashboard">
        <span className="text-terminal font-display">L{lvl.level}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-foreground">{p.xp} XP</span>
      </Link>
      {/* Auth */}
      {user ? (
        <div className="relative mr-2">
          <button
            onClick={() => setUserMenuOpen(o => !o)}
            className="w-8 h-8 rounded-full border border-border bg-secondary/50 hover:border-terminal/50 flex items-center justify-center text-xs text-foreground"
            title={user.name}
          >{user.name.charAt(0).toUpperCase()}</button>
          {userMenuOpen && (
            <div className="absolute right-0 top-10 w-48 bg-card border border-border rounded shadow-lg p-1 z-50">
              <div className="px-3 py-2 text-[10px] text-muted-foreground border-b border-border">
                <div className="text-foreground text-xs">{user.name}</div>
                {!user.isGuest && <div className="truncate">{user.email}</div>}
                {user.isGuest && <div className="text-noc-yellow">Guest mode</div>}
              </div>
              <Link to="/dashboard" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-xs hover:bg-accent rounded">Dashboard</Link>
              {user.isGuest && <Link to="/auth" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-xs text-terminal hover:bg-accent rounded">Create account</Link>}
              <button onClick={() => { signOut(); setUserMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-noc-red hover:bg-accent rounded">Sign out</button>
            </div>
          )}
        </div>
      ) : (
        <Link to="/auth" className="mr-2 px-3 py-1.5 text-xs rounded border border-terminal/40 text-terminal hover:bg-terminal/10">Sign in</Link>
      )}
      <button
        onClick={toggle}
        aria-label="Toggle theme"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="ml-3 w-8 h-8 rounded-full border border-border bg-secondary/50 hover:bg-accent hover:border-terminal/50 flex items-center justify-center text-sm transition-all"
      >
        {theme === 'dark' ? '🌙' : '☀️'}
      </button>
      <button
        onClick={() => setMobileOpen(o => !o)}
        aria-label="Menu"
        className="md:hidden ml-2 w-8 h-8 rounded border border-border bg-secondary/50 flex items-center justify-center text-foreground"
      >
        ☰
      </button>
      {mobileOpen && (
        <div className="md:hidden absolute top-14 left-0 right-0 bg-card border-b border-border flex flex-col p-2 gap-1 z-40">
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-accent"
              activeProps={{ className: 'px-3 py-2 text-xs rounded text-terminal bg-terminal/10 border border-terminal/30' }}
              activeOptions={{ exact: true }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}