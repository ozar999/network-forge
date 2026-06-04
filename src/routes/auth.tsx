import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import React, { useState } from 'react';
import { signIn, signUp, signInGuest, useAuth } from '@/lib/auth';

export const Route = createFileRoute('/auth')({
  head: () => ({
    meta: [
      { title: 'Sign In — NetSem' },
      { name: 'description', content: 'Sign in or create a NetSem account to save your labs and track progress' },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (user && !user.isGuest) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-6">
        <div className="border border-border rounded-lg p-6 bg-card max-w-md w-full text-center">
          <h1 className="text-xl font-display text-terminal mb-2">Already signed in</h1>
          <p className="text-sm text-muted-foreground mb-4">Hi {user.name} ({user.email})</p>
          <Link to="/dashboard" className="inline-block px-4 py-2 rounded bg-primary text-primary-foreground text-xs">Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = mode === 'signin'
      ? signIn(email, password)
      : signUp(email, password, name);
    if (!res.ok) { setError(res.error || 'Failed'); return; }
    navigate({ to: '/dashboard' });
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-6">
      <div className="border border-border rounded-lg p-8 bg-card/80 backdrop-blur-sm max-w-md w-full">
        <h1 className="text-2xl font-display text-terminal text-glow tracking-wider text-center mb-1">
          {mode === 'signin' ? 'SIGN IN' : 'SIGN UP'}
        </h1>
        <p className="text-xs text-muted-foreground text-center mb-6">
          {mode === 'signin' ? 'Welcome back, operator.' : 'Create your operator account.'}
        </p>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <input
              type="text" required placeholder="Name" value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-secondary/50 border border-border rounded text-sm outline-none focus:border-terminal"
            />
          )}
          <input
            type="email" required placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 bg-secondary/50 border border-border rounded text-sm outline-none focus:border-terminal"
          />
          <input
            type="password" required placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-secondary/50 border border-border rounded text-sm outline-none focus:border-terminal"
          />
          {error && <p className="text-xs text-noc-red">{error}</p>}
          <button type="submit" className="w-full py-2 rounded bg-primary text-primary-foreground text-sm font-display tracking-wider hover:opacity-90">
            {mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>
        </form>
        <div className="flex items-center my-4 gap-2 text-[10px] text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> OR <div className="flex-1 h-px bg-border" />
        </div>
        <button
          onClick={() => { signInGuest(); navigate({ to: '/lab' }); }}
          className="w-full py-2 rounded border border-border text-sm hover:border-terminal/50 hover:text-terminal transition-colors"
        >Continue as Guest</button>
        <p className="text-xs text-center text-muted-foreground mt-4">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }} className="text-terminal hover:underline">
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
        <p className="text-[10px] text-center text-muted-foreground/60 mt-3">
          Accounts are stored locally in this browser. No data leaves your device.
        </p>
      </div>
    </div>
  );
}