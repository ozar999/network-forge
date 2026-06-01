import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTheme } from './ThemeProvider';

export function Navbar() {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
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
      <span className="hidden lg:inline text-[10px] text-muted-foreground font-mono">v1.0.0 // SIMULATION MODE</span>
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