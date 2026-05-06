import { Link } from '@tanstack/react-router';

export function Navbar() {
  return (
    <nav className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 sticky top-0 z-40">
      <Link to="/" className="flex items-center gap-2 mr-8">
        <div className="w-7 h-7 rounded border border-terminal flex items-center justify-center text-glow">
          <span className="text-terminal text-sm font-bold font-display">N</span>
        </div>
        <span className="font-display text-terminal text-sm text-glow tracking-wider">NETSEM</span>
      </Link>
      <div className="flex items-center gap-1">
        {[
          { to: '/' as const, label: 'Home' },
          { to: '/lab' as const, label: 'Lab' },
          { to: '/courses' as const, label: 'Courses' },
          { to: '/dashboard' as const, label: 'Dashboard' },
          { to: '/ai-assistant' as const, label: 'AI Assistant' },
        ].map(link => (
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
      <span className="text-[10px] text-muted-foreground font-mono">v1.0.0 // SIMULATION MODE</span>
      <span className="text-[10px] text-terminal ml-2 font-display">NETSEM</span>
    </nav>
  );
}